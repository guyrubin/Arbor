/* B-AIOPS-01 — the AI usage receipt: its fields match the audit
 * (docs/ops/ai-usage-receipts.md), it stays content-free, and a stream that
 * stops early still leaves a receipt.
 *
 * Before 28 Oct, recordUsage ran only after a stream's last chunk: a reply the
 * output screen stopped mid-stream, an aborted voice turn or a closed client
 * billed its tokens and left no `ai.usage` line, so the receipts could never
 * reconcile to the bill. The provider seams now write the receipt in `finally`
 * with `endedEarly: true` (never twice). No network: the Vertex client and the
 * Claude endpoint are scripted. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Type } from "@google/genai";
import { logger } from "../server/logger";
import { createTestConfig } from "../testConfig";
import { PRICE_TABLE } from "./priceTable";
import { buildUsageEvent, recordUsage } from "./usage";
import { buildTtsUsageEvent } from "./ttsUsage";
import { VertexGeminiProvider, type VertexClientFactory } from "./modelRouter";
import { ClaudeVertexProvider } from "./claudeVertexProvider";

vi.mock("google-auth-library", () => ({
  GoogleAuth: class { async getClient() { return { getAccessToken: async () => ({ token: "synthetic-adc-token" }) }; } },
}));

const here = path.dirname(fileURLToPath(import.meta.url));
const DOC = readFileSync(path.resolve(here, "..", "..", "..", "docs", "ops", "ai-usage-receipts.md"), "utf8");

type Row = Record<string, string>;
function fieldTable(doc: string): Row[] {
  const start = doc.indexOf("\n## Receipt fields\n");
  const rest = doc.slice(start + 19);
  const end = rest.search(/\n## /);
  const lines = (end < 0 ? rest : rest.slice(0, end)).split("\n").filter((l) => l.startsWith("|"));
  const cells = (l: string) => l.slice(1, -1).split("|").map((c) => c.trim());
  const header = cells(lines[0] ?? "|");
  return lines.slice(2).map((l) => Object.fromEntries(cells(l).map((c, i) => [header[i], c])));
}
const ticked = (cell: string) => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);

/** Every key a receipt line can carry: two maximal events (audio and cache
 *  usage price separately) plus the request context recordUsage adds. */
function emittedKeys(): Set<string> {
  const cached = Object.keys(PRICE_TABLE).find((k) => PRICE_TABLE[k].cacheWrite5mPerM !== undefined && PRICE_TABLE[k].cacheReadPerM !== undefined)!;
  const audio = Object.keys(PRICE_TABLE).find((k) => PRICE_TABLE[k].audioInputPerM !== undefined)!;
  const meta = (model: string) => ({ route: "analysis_structured" as const, provider: "vertex_gemini" as const, model, resolvedModel: model, promptVersion: "1.0.0", endedEarly: true });
  const a = buildUsageEvent(meta(cached), { promptTokens: 900, outputTokens: 20, totalTokens: 930, thoughtsTokens: 10, cacheReadTokens: 100, cacheWrite5mTokens: 50, cacheWrite1hTokens: 50 }, { totalMs: 900, firstChunkMs: 120 })!;
  const b = buildUsageEvent(meta(audio), { promptTokens: 900, outputTokens: 20, totalTokens: 920, audioInputTokens: 300 }, { totalMs: 900 })!;
  expect(a.estimatedCostUsd).toBeTypeOf("number");
  return new Set([...Object.keys(a), ...Object.keys(b), "requestId", "userUid"]);
}

const ID_KEYS = new Set(["route", "provider", "model", "resolvedModel", "promptVersion", "requestId", "userUid", "lang", "usageUnit", "priceTableAsOf"]);
function contentFreeErrors(event: Record<string, unknown>): string[] {
  return Object.entries(event).flatMap(([k, v]) => {
    if (v === null || typeof v === "number" || typeof v === "boolean") return [];
    if (typeof v === "string" && ID_KEYS.has(k) && v.length <= 80 && !/\s/.test(v)) return [];
    return [`${k} carries ${typeof v === "string" ? `free text "${v.slice(0, 30)}"` : typeof v}`];
  });
}

afterEach(() => { vi.restoreAllMocks(); globalThis.fetch = realFetch; });
const realFetch = globalThis.fetch;
const usageLines = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.filter((c: unknown[]) => c[0] === "ai.usage").map((c: unknown[]) => c[1] as Record<string, unknown>);

/* ── the audit table stays true to the receipt ────────────────────────────── */

describe("B-AIOPS-01 — receipt fields match the audit", () => {
  it("the 'present' rows name exactly the keys an ai.usage line carries", () => {
    const rows = fieldTable(DOC);
    expect(rows.length).toBeGreaterThanOrEqual(10);
    const documented = new Set(rows.filter((r) => r.Status === "present").flatMap((r) => ticked(r["On the receipt"])));
    expect([...documented].sort()).toEqual([...emittedKeys()].sort());
  });

  it("every row the audit marks missing is really missing", () => {
    const keys = emittedKeys();
    const missing = fieldTable(DOC).filter((r) => r.Status === "missing").map((r) => r["Required by the row"].toLowerCase());
    expect(missing).toEqual(expect.arrayContaining(["capability", "context classes", "citation ids", "action types", "safety result", "attempts and retries", "fallback taken"]));
    for (const name of ["capability", "contextClasses", "citationIds", "actionTypes", "safetyResult", "attempts", "fallback"]) expect(keys.has(name), name).toBe(false);
  });

  it("receipts are content-free: ids, enums and numbers only", () => {
    const spy = vi.spyOn(logger, "info").mockImplementation(() => {});
    recordUsage({ route: "coach_high_stakes", provider: "vertex_gemini", model: Object.keys(PRICE_TABLE)[0], promptVersion: "1.9.0" },
      { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 }, { totalMs: 40 });
    const [line] = usageLines(spy);
    expect(line).toBeTruthy();
    expect(contentFreeErrors(line)).toEqual([]);
    expect(contentFreeErrors(buildTtsUsageEvent("en-US-voice", "en", 120, 300))).toEqual([]);
    // Negative control: a receipt that carried the reply would fail.
    expect(contentFreeErrors({ ...line, text: "Noa had a hard morning" })).toEqual(['text carries free text "Noa had a hard morning"']);
  });
});

/* ── early-stopped streams keep their receipt ─────────────────────────────── */

type Item = { text?: string; usage?: Record<string, number> };
function vertexStreamFactory(items: Item[], finalUsage: Record<string, number>): VertexClientFactory {
  const chunk = (it: Item) => ({ candidates: [{ content: { parts: it.text ? [{ text: it.text }] : [] } }], ...(it.usage ? { usageMetadata: it.usage } : {}) });
  return async () => ({
    getGenerativeModel: () => ({
      generateContentStream: async () => ({
        stream: (async function* () { for (const it of items) yield chunk(it); })(),
        response: Promise.resolve({ usageMetadata: finalUsage }),
      }),
    }),
  }) as any;
}
const ITEMS: Item[] = [
  { text: "First sentence. ", usage: { promptTokenCount: 700, candidatesTokenCount: 4, totalTokenCount: 704 } },
  { text: "Second sentence. " },
  { text: "Third sentence." },
];
const FINAL = { promptTokenCount: 700, candidatesTokenCount: 30, totalTokenCount: 730 };

describe("B-AIOPS-01 — a stream that stops early still leaves one receipt", () => {
  for (const method of ["streamText", "generateJsonStream"] as const) {
    it(`Vertex ${method}: the consumer stops after the first chunk → one receipt, endedEarly, tokens seen so far`, async () => {
      const spy = vi.spyOn(logger, "info").mockImplementation(() => {});
      const provider = new VertexGeminiProvider(createTestConfig(), vertexStreamFactory(ITEMS, FINAL));
      for await (const _ of provider[method]({ route: "analysis_structured", prompt: "synthetic", promptVersion: "1.10.6" } as any)) break;
      const lines = usageLines(spy);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({ endedEarly: true, promptTokens: 700, outputTokens: 4, promptVersion: "1.10.6" });
    });

    it(`Vertex ${method}: a completed stream → one receipt with the final usage and no endedEarly`, async () => {
      const spy = vi.spyOn(logger, "info").mockImplementation(() => {});
      const provider = new VertexGeminiProvider(createTestConfig(), vertexStreamFactory(ITEMS.map(({ text }) => ({ text })), FINAL));
      const out: string[] = [];
      for await (const t of provider[method]({ route: "analysis_structured", prompt: "synthetic" } as any)) out.push(t);
      expect(out).toHaveLength(3);
      const lines = usageLines(spy);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({ outputTokens: 30 });
      expect(lines[0].endedEarly).toBeUndefined();
    });
  }

  it("Vertex: an abort mid-stream rethrows and still leaves one endedEarly receipt", async () => {
    const spy = vi.spyOn(logger, "info").mockImplementation(() => {});
    const controller = new AbortController();
    const provider = new VertexGeminiProvider(createTestConfig(), vertexStreamFactory(ITEMS, FINAL));
    const run = async () => {
      for await (const _ of provider.streamText({ route: "analysis_structured", prompt: "synthetic", budget: { signal: controller.signal, deadlineAt: Date.now() + 60_000, totalMs: 60_000 } } as any)) controller.abort();
    };
    await expect(run()).rejects.toThrow();
    const lines = usageLines(spy);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ endedEarly: true, promptTokens: 700 });
  });

  it("Claude: the consumer stops after the first chunk → one receipt with the input tokens from message_start", async () => {
    const spy = vi.spyOn(logger, "info").mockImplementation(() => {});
    const events = [
      { type: "message_start", message: { usage: { input_tokens: 321 } } },
      { type: "content_block_start", index: 0, content_block: { type: "text" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hello " } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "there." } },
      { type: "message_delta", usage: { output_tokens: 9 } },
      { type: "message_stop" },
    ];
    const bytes = new TextEncoder().encode(events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n`).join("\n") + "\n");
    // One event per pull, so the upstream body is still open when the consumer stops.
    let offset = 0;
    const cancelled = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= bytes.length) { controller.close(); return; }
        const end = bytes.indexOf(10, bytes.indexOf(10, offset) + 1) + 1 || bytes.length;
        controller.enqueue(bytes.slice(offset, end)); offset = end;
      },
      cancel: cancelled,
    });
    globalThis.fetch = (async () => ({ ok: true, body })) as unknown as typeof fetch;
    const provider = new ClaudeVertexProvider(createTestConfig());
    for await (const _ of provider.generateJsonStream({ route: "coach_high_stakes", prompt: "synthetic", schema: { type: Type.OBJECT, properties: { text: { type: Type.STRING } } } })) break;
    const lines = usageLines(spy);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ endedEarly: true, provider: "vertex_claude", promptTokens: 321 });
    // The upstream body is cancelled, so generation (and billing) stops.
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(offset).toBeLessThan(bytes.length);
  });

  it("Claude: the receipt is written before the cancel, so a cancel that never settles cannot lose it", async () => {
    const spy = vi.spyOn(logger, "info").mockImplementation(() => {});
    const events = [
      { type: "message_start", message: { usage: { input_tokens: 77 } } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hello " } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "there." } },
    ];
    const bytes = new TextEncoder().encode(events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n`).join("\n") + "\n");
    let sent = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) { if (!sent) { sent = true; controller.enqueue(bytes); } },
      cancel: () => new Promise<void>(() => { /* never settles */ }),
    });
    globalThis.fetch = (async () => ({ ok: true, body })) as unknown as typeof fetch;
    const provider = new ClaudeVertexProvider(createTestConfig());
    const iterator = provider.generateJsonStream({ route: "coach_high_stakes", prompt: "synthetic" })[Symbol.asyncIterator]();
    await iterator.next();
    void iterator.return?.(undefined); // the consumer stops; the cancel hangs
    await new Promise((resolve) => setTimeout(resolve, 20));
    const lines = usageLines(spy);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ endedEarly: true, promptTokens: 77 });
  });
});
