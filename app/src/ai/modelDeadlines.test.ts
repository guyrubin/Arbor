import { describe, it, expect, vi } from "vitest";
import { withDefaultModelDeadlines } from "./modelDeadlines.js";
import type { ModelProvider } from "./modelRouter.js";

describe("all model routes have a finite wait", () => {
  it("supplies a bounded signal to legacy JSON and image calls", async () => {
    const generateJson = vi.fn(async () => ({}));
    const generateImage = vi.fn(async () => ({ data: "synthetic", mimeType: "image/png" }));
    const wrapped = withDefaultModelDeadlines({ generateJson, generateImage } as unknown as ModelProvider);
    await wrapped.generateJson({ route: "analysis_structured", prompt: "test" });
    await wrapped.generateImage({ prompt: "test" });
    expect((generateJson.mock.calls[0] as any)[0].budget).toMatchObject({ totalMs: 45000, signal: expect.any(AbortSignal) });
    expect((generateImage.mock.calls[0] as any)[0].budget).toMatchObject({ totalMs: 60000, signal: expect.any(AbortSignal) });
  });
  it("preserves an explicit route budget and releases a hung provider on cancellation", async () => {
    const controller = new AbortController();
    const budget = { signal: controller.signal, totalMs: 15000 };
    const generateJson = vi.fn(() => new Promise(() => {}));
    const wrapped = withDefaultModelDeadlines({ generateJson } as unknown as ModelProvider);
    const call = wrapped.generateJson({ route: "analysis_structured", prompt: "test", budget });
    const rejection = expect(call).rejects.toMatchObject({ name: "AbortError" });
    controller.abort(); await rejection;
    expect((generateJson.mock.calls[0] as any)[0].budget).toBe(budget);
  });
});
