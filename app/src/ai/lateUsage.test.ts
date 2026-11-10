import { afterEach, describe, expect, it, vi } from "vitest";
import { VertexGeminiProvider } from "./modelRouter.js";
import { raceWithAbort } from "./modelRetry.js";
import { createTestConfig } from "../testConfig.js";
import { logger } from "../server/logger.js";
import { bindFamilyId, requestContextMiddleware } from "../server/requestContext.js";
import { _setFamilyCostDb } from "../server/familyCostWriter.js";

const usage = { promptTokenCount: 100, candidatesTokenCount: 20, totalTokenCount: 120 };
const result = { response: { usageMetadata: usage, candidates: [{ content: { parts: [{ text: '{"ok":true}', inlineData: { mimeType: "image/png", data: "c3ludGhldGlj" } }] } }] } };
function deferred<T>() {
  let resolve!: (v: T) => void; let reject!: (e: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
afterEach(() => { _setFamilyCostDb(null); vi.restoreAllMocks(); });

describe("B-AIOPS-01 abandoned Vertex unary calls", () => {
  for (const method of ["generateJson", "generateImage"] as const) {
    for (const outcome of ["success", "billed-error", "unpriced-error"] as const) {
      it(`${method}: ${outcome} after abort keeps one original-family receipt and never retries`, async () => {
        const spy = vi.spyOn(logger, "info").mockImplementation(() => {});
        const writes: string[] = [];
        _setFamilyCostDb({ collection: () => ({ doc: (id: string) => ({ set: async () => { writes.push(id); } }) }) } as never);
        const pending = deferred<typeof result>();
        const started = deferred<void>();
        const call = vi.fn(() => { started.resolve(); return pending.promise; });
        const provider = new VertexGeminiProvider(createTestConfig(), async () => ({ getGenerativeModel: () => ({ generateContent: call }) }));
        const abort = new AbortController();
        let request!: Promise<unknown>;
        requestContextMiddleware({ arborRequestId: "request-a", user: { uid: "parent-a" } } as never, {} as never, () => {
          bindFamilyId("family-a");
          request = provider[method]({ route: "analysis_structured", prompt: "synthetic private text", budget: { signal: abort.signal } } as never);
        });
        await started.promise;
        const rejection = expect(request).rejects.toMatchObject({ name: "AbortError" });
        abort.abort();
        await rejection; // ends without waiting for the provider
        expect(writes).toHaveLength(0);
        requestContextMiddleware({ arborRequestId: "request-b", user: { uid: "parent-b" } } as never, {} as never, () => {
          bindFamilyId("family-b");
          if (outcome === "success") pending.resolve(result);
          else pending.reject(Object.assign(new Error("synthetic private provider failure"), { status: 503,
            ...(outcome === "billed-error" ? { usageMetadata: usage } : {}) }));
        });
        await flush();
        const lines = spy.mock.calls.filter((c) => c[0] === "ai.usage").map((c) => c[1] as Record<string, unknown>);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatchObject({ requestId: "request-a", userUid: "parent-a", familyId: "family-a",
          endedEarly: true, retries: 0, chargedFailure: outcome !== "unpriced-error" });
        if (method === "generateImage") expect(lines[0].imageCount).toBe(0);
        if (outcome === "unpriced-error") expect(lines[0]).not.toHaveProperty("estimatedCostUsd");
        else expect(lines[0].totalTokens).toBe(120);
        expect(JSON.stringify(lines)).not.toMatch(/private|c3ludGhldGlj|parent-b|family-b/);
        expect(call).toHaveBeenCalledTimes(1);
        expect(writes).toHaveLength(1);
        expect(writes[0]).toMatch(/^family-a_/);
      });
    }
    it(`${method}: normal completion writes once even if the signal aborts later`, async () => {
      const spy = vi.spyOn(logger, "info").mockImplementation(() => {});
      const abort = new AbortController();
      const provider = new VertexGeminiProvider(createTestConfig(), async () => ({ getGenerativeModel: () => ({ generateContent: async () => result }) }));
      await provider[method]({ route: "analysis_structured", prompt: "synthetic", budget: { signal: abort.signal } } as never);
      abort.abort(); await flush();
      const lines = spy.mock.calls.filter((c) => c[0] === "ai.usage");
      expect(lines).toHaveLength(1);
      expect(lines[0][1]).not.toHaveProperty("endedEarly");
    });
  }

  it("consumes an issued promise's rejection when the signal was already aborted", async () => {
    const abort = new AbortController(); abort.abort();
    const late = { resolved: vi.fn(), rejected: vi.fn() };
    const pending = deferred<number>();
    await expect(raceWithAbort(pending.promise, abort.signal, late)).rejects.toMatchObject({ name: "AbortError" });
    const error = new Error("synthetic late failure"); pending.reject(error); await flush();
    expect(late.rejected).toHaveBeenCalledExactlyOnceWith(error);
    expect(late.resolved).not.toHaveBeenCalled();
  });
});
