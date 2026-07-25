/**
 * AIR-1 (ask-cadence) — ClaudeVertexProvider.generateJsonStream is REAL
 * streaming now: `:streamRawPredict` SSE, yielding the tool call's
 * `input_json_delta.partial_json` chunks as they generate. Before this seam
 * landed, prod /chat "streaming" was `yield JSON.stringify(await callClaude())`
 * — one chunk at the very end, TTFT = full generation time.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ClaudeVertexProvider } from "./claudeVertexProvider.js";
import { createTestConfig } from "../testConfig.js";
import { Type } from "@google/genai";

vi.mock("google-auth-library", () => ({
  GoogleAuth: class {
    async getClient() {
      return { getAccessToken: async () => ({ token: "fake-adc-token" }) };
    }
  },
}));

const sseBody = (events: Record<string, unknown>[]) =>
  events.map((e) => `event: ${(e as any).type}\ndata: ${JSON.stringify(e)}\n`).join("\n") + "\n";

const streamResponse = (body: string, chunkSize = 24) => {
  const bytes = new TextEncoder().encode(body);
  let offset = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(offset, offset + chunkSize));
      offset += chunkSize;
    },
  });
  return { ok: true, body: stream } as unknown as Response;
};

const CONTRACT_JSON = JSON.stringify({ text: "First words. Then more.", riskLevel: "Low" });

const anthropicEvents = () => {
  // The tool input streams as partial_json fragments — split the document in 5.
  const size = Math.ceil(CONTRACT_JSON.length / 5);
  const parts = [];
  for (let i = 0; i < CONTRACT_JSON.length; i += size) parts.push(CONTRACT_JSON.slice(i, i + size));
  return [
    { type: "message_start", message: { usage: { input_tokens: 321 } } },
    { type: "content_block_start", index: 0, content_block: { type: "tool_use", name: "arbor_coach_response" } },
    ...parts.map((p) => ({ type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: p } })),
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", usage: { output_tokens: 55 }, delta: { stop_reason: "tool_use" } },
    { type: "message_stop" },
  ];
};

const realFetch = globalThis.fetch;
let fetchCalls: { url: string; init: RequestInit }[] = [];

beforeEach(() => {
  fetchCalls = [];
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("ClaudeVertexProvider.generateJsonStream (streamRawPredict)", () => {
  it("yields >1 chunk whose concatenation is the exact tool-input JSON, via the streamRawPredict endpoint with stream:true", async () => {
    globalThis.fetch = (async (url: any, init: any) => {
      fetchCalls.push({ url: String(url), init });
      return streamResponse(sseBody(anthropicEvents()));
    }) as typeof fetch;

    const provider = new ClaudeVertexProvider(createTestConfig());
    const chunks: string[] = [];
    for await (const chunk of provider.generateJsonStream({
      route: "coach_high_stakes",
      prompt: "hello",
      schema: { type: Type.OBJECT, properties: { text: { type: Type.STRING } } },
    })) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(1); // REAL streaming — the AIR-1 seam
    expect(chunks.join("")).toBe(CONTRACT_JSON);

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toContain(":streamRawPredict");
    const body = JSON.parse(String(fetchCalls[0].init.body));
    expect(body.stream).toBe(true);
    expect(body.anthropic_version).toBe("vertex-2023-10-16");
    expect(body.tool_choice).toEqual({ type: "tool", name: "arbor_coach_response" });
  });

  it("yields text_delta chunks when no schema/tool is supplied", async () => {
    const events = [
      { type: "message_start", message: { usage: { input_tokens: 10 } } },
      { type: "content_block_start", index: 0, content_block: { type: "text" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hello " } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "there." } },
      { type: "message_stop" },
    ];
    globalThis.fetch = (async () => streamResponse(sseBody(events))) as typeof fetch;

    const provider = new ClaudeVertexProvider(createTestConfig());
    const chunks: string[] = [];
    for await (const c of provider.generateJsonStream({ route: "coach_high_stakes", prompt: "hi" })) chunks.push(c);
    expect(chunks).toEqual(["Hello ", "there."]);
  });

  it("surfaces the HTTP status on connection errors so withModelRetry can back off", async () => {
    globalThis.fetch = (async () => ({ ok: false, status: 404, text: async () => "not found" }) as unknown as Response) as typeof fetch;
    const provider = new ClaudeVertexProvider(createTestConfig());
    const iterate = async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _chunk of provider.generateJsonStream({ route: "coach_high_stakes", prompt: "hi" })) {
        /* never yields */
      }
    };
    await expect(iterate()).rejects.toThrow(/404/);
  });
});
