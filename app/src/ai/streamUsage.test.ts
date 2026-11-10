import { afterEach, describe, expect, it, vi } from "vitest";
import { VertexGeminiProvider } from "./modelRouter.js";
import { createTestConfig } from "../testConfig.js";
import { logger } from "../server/logger.js";
import { bindFamilyId, requestContextMiddleware } from "../server/requestContext.js";
import { _setFamilyCostDb } from "../server/familyCostWriter.js";

const partial = { promptTokenCount: 100, candidatesTokenCount: 2, totalTokenCount: 102 };
const finalUsage = { promptTokenCount: 100, candidatesTokenCount: 20, totalTokenCount: 120 };
const chunk = (usageMetadata?: unknown) => ({ candidates: [{ content: { parts: [{ text: "synthetic private reply" }] } }], usageMetadata });
function deferred<T>() {
  let resolve!: (v: T) => void; let reject!: (e: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
function setup(call: () => Promise<any>) {
  const spy = vi.spyOn(logger, "info").mockImplementation(() => {});
  const provider = new VertexGeminiProvider(createTestConfig(), async () => ({ getGenerativeModel: () => ({ generateContentStream: call }) }));
  return { provider, lines: () => spy.mock.calls.filter((c) => c[0] === "ai.usage").map((c) => c[1] as Record<string, unknown>) };
}
afterEach(() => { _setFamilyCostDb(null); vi.restoreAllMocks(); });

for (const method of ["streamText", "generateJsonStream"] as const) {
  describe(`Vertex ${method} usage lifetime`, () => {
    for (const outcome of ["success", "startup-error", "aggregate-error", "unpriced-error"] as const) {
      it(`abandoned startup: ${outcome} leaves one original-family receipt and no resumed content`, async () => {
        const pending = deferred<any>(); const started = deferred<void>();
        const call = vi.fn(() => { started.resolve(); return pending.promise; });
        const { provider, lines } = setup(call);
        const writes: string[] = [];
        _setFamilyCostDb({ collection: () => ({ doc: (id: string) => ({ set: async () => { writes.push(id); } }) }) } as never);
        const abort = new AbortController();
        let next!: Promise<IteratorResult<string>>;
        requestContextMiddleware({ arborRequestId: "request-a", user: { uid: "parent-a" } } as never, {} as never, () => {
          bindFamilyId("family-a");
          next = provider[method]({ route: "analysis_structured", prompt: "synthetic private prompt", budget: { signal: abort.signal } })[Symbol.asyncIterator]().next();
        });
        await started.promise;
        const rejection = expect(next).rejects.toMatchObject({ name: "AbortError" });
        abort.abort(); await rejection;
        expect(lines()).toHaveLength(0);
        const pull = vi.fn(); const close = vi.fn(async () => ({ done: true, value: undefined }));
        const aggregate = deferred<any>();
        requestContextMiddleware({ arborRequestId: "request-b", user: { uid: "parent-b" } } as never, {} as never, () => {
          bindFamilyId("family-b");
          if (outcome === "startup-error") pending.reject(Object.assign(new Error("synthetic private failure"), { status: 503, usageMetadata: finalUsage }));
          else pending.resolve({ stream: { [Symbol.asyncIterator]: () => ({ next: pull, return: close }) }, response: aggregate.promise });
        });
        await flush();
        if (outcome === "success") aggregate.resolve({ usageMetadata: finalUsage, candidates: chunk().candidates });
        if (outcome === "aggregate-error" || outcome === "unpriced-error") aggregate.reject(Object.assign(new Error("synthetic private failure"), outcome === "aggregate-error" ? { usageMetadata: finalUsage } : {}));
        await flush();
        expect(lines()).toHaveLength(1);
        expect(lines()[0]).toMatchObject({ requestId: "request-a", userUid: "parent-a", familyId: "family-a", endedEarly: true, retries: 0, chargedFailure: outcome !== "unpriced-error" });
        if (outcome === "unpriced-error") expect(lines()[0]).not.toHaveProperty("estimatedCostUsd");
        else expect(lines()[0]).toMatchObject({ totalTokens: 120 });
        expect(JSON.stringify(lines())).not.toMatch(/private|parent-b|family-b/);
        expect(writes).toHaveLength(1); expect(writes[0]).toMatch(/^family-a_/);
        expect(call).toHaveBeenCalledTimes(1); expect(pull).not.toHaveBeenCalled();
        expect(close).toHaveBeenCalledTimes(outcome === "startup-error" ? 0 : 1);
      });
    }

    it("uses aggregate usage over earlier chunk usage exactly once", async () => {
      const { provider, lines } = setup(async () => ({ stream: (async function* () { yield chunk(partial); })(), response: Promise.resolve({ usageMetadata: finalUsage }) }));
      for await (const _ of provider[method]({ route: "analysis_structured", prompt: "synthetic" })) { /* consume */ }
      expect(lines()).toHaveLength(1); expect(lines()[0]).toMatchObject({ totalTokens: 120 });
      expect(lines()[0]).not.toHaveProperty("endedEarly");
    });

    it("keeps chunk usage when a successful aggregate has no usage", async () => {
      const { provider, lines } = setup(async () => ({ stream: (async function* () { yield chunk(partial); })(), response: Promise.resolve({}) }));
      for await (const _ of provider[method]({ route: "analysis_structured", prompt: "synthetic" })) { /* consume */ }
      expect(lines()).toHaveLength(1); expect(lines()[0]).toMatchObject({ totalTokens: 102, chargedFailure: false });
    });

    it("does not label a completed stream with no usage as free", async () => {
      const { provider, lines } = setup(async () => ({ stream: (async function* () { yield chunk(); })(), response: Promise.resolve({}) }));
      for await (const _ of provider[method]({ route: "analysis_structured", prompt: "synthetic" })) { /* consume */ }
      expect(lines()).toHaveLength(1); expect(lines()[0]).not.toHaveProperty("estimatedCostUsd");
    });

    it("records billed startup retries separately from the returned stream", async () => {
      const call = vi.fn().mockRejectedValueOnce(Object.assign(new Error("capacity"), { status: 503, usageMetadata: partial }))
        .mockResolvedValueOnce({ stream: (async function* () { yield chunk(); })(), response: Promise.resolve({ usageMetadata: finalUsage }) });
      const { provider, lines } = setup(call);
      for await (const _ of provider[method]({ route: "analysis_structured", prompt: "synthetic" })) { /* consume */ }
      expect(call).toHaveBeenCalledTimes(2); expect(lines()).toHaveLength(2);
      expect(lines()[0]).toMatchObject({ retries: 0, totalTokens: 102, chargedFailure: true });
      expect(lines()[1]).toMatchObject({ retries: 1, totalTokens: 120, chargedFailure: false });
    });

    for (const cleanup of ["reject", "hang"] as const) {
      it(`late-startup cleanup ${cleanup} cannot suppress the usage receipt`, async () => {
        const pending = deferred<any>(); const started = deferred<void>(); const abort = new AbortController();
        const { provider, lines } = setup(() => { started.resolve(); return pending.promise; });
        const next = provider[method]({ route: "analysis_structured", prompt: "synthetic", budget: { signal: abort.signal } })[Symbol.asyncIterator]().next();
        await started.promise;
        const rejection = expect(next).rejects.toMatchObject({ name: "AbortError" }); abort.abort(); await rejection;
        pending.resolve({ stream: { [Symbol.asyncIterator]: () => ({ return: () => cleanup === "hang" ? new Promise(() => {}) : Promise.reject(new Error("cleanup")) }) }, response: Promise.resolve({ usageMetadata: finalUsage }) });
        await flush();
        expect(lines()).toHaveLength(1); expect(lines()[0]).toMatchObject({ totalTokens: 120, endedEarly: true });
      });
    }

    it("aggregate rejection after the last chunk records billed failure and propagates", async () => {
      const error = Object.assign(new Error("synthetic private failure"), { usageMetadata: finalUsage });
      const { provider, lines } = setup(async () => ({ stream: (async function* () { yield chunk(); })(), response: Promise.reject(error) }));
      const run = async () => { for await (const _ of provider[method]({ route: "analysis_structured", prompt: "synthetic" })) { /* consume */ } };
      await expect(run()).rejects.toBe(error);
      expect(lines()).toHaveLength(1); expect(lines()[0]).toMatchObject({ totalTokens: 120, chargedFailure: true, endedEarly: true });
    });

    it("a stalled aggregate releases on abort and a later rejection never adds a receipt", async () => {
      const aggregate = deferred<any>(); const last = deferred<void>(); const abort = new AbortController();
      const { provider, lines } = setup(async () => ({ stream: (async function* () { yield chunk(); last.resolve(); })(), response: aggregate.promise }));
      const run = async () => { for await (const _ of provider[method]({ route: "analysis_structured", prompt: "synthetic", budget: { signal: abort.signal } })) { /* consume */ } };
      const request = run(); await last.promise; await flush();
      const rejection = expect(request).rejects.toMatchObject({ name: "AbortError" });
      abort.abort(); await rejection;
      expect(lines()).toHaveLength(1); expect(lines()[0]).toMatchObject({ endedEarly: true });
      expect(lines()[0]).not.toHaveProperty("estimatedCostUsd");
      aggregate.reject(new Error("synthetic private failure")); await flush();
      expect(lines()).toHaveLength(1);
    });

    it("handles an aggregate rejection while the consumer is paused and preserves immediate early-stop accounting", async () => {
      const aggregate = deferred<any>();
      const { provider, lines } = setup(async () => ({ stream: (async function* () { yield chunk(partial); yield chunk(); })(), response: aggregate.promise }));
      const iterator = provider[method]({ route: "analysis_structured", prompt: "synthetic" })[Symbol.asyncIterator]();
      await iterator.next(); aggregate.reject(new Error("synthetic private failure")); await flush();
      await iterator.return?.();
      expect(lines()).toHaveLength(1); expect(lines()[0]).toMatchObject({ totalTokens: 102, endedEarly: true });
    });

    it("a stream exception records the usage on the error once", async () => {
      const error = Object.assign(new Error("synthetic private failure"), { usageMetadata: finalUsage });
      const { provider, lines } = setup(async () => ({ stream: (async function* () { yield chunk(partial); throw error; })(), response: Promise.reject(error) }));
      const run = async () => { for await (const _ of provider[method]({ route: "analysis_structured", prompt: "synthetic" })) { /* consume */ } };
      await expect(run()).rejects.toBe(error);
      expect(lines()).toHaveLength(1); expect(lines()[0]).toMatchObject({ totalTokens: 120, chargedFailure: true, endedEarly: true });
    });
  });
}
