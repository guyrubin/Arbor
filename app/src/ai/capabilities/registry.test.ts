import { describe, expect, it, vi } from "vitest";
import { AiProviderError, type AiCapability, type CapabilityAdapter, type CapabilityRequest } from "./contracts.js";
import { CapabilityRegistry } from "./registry.js";
const context = <C extends AiCapability>(capability: C): CapabilityRequest<C> => ({ capability, route: "creative_low_risk", audience: "parent", locale: "en", dataClasses: ["account"], risk: "low" });
describe("CapabilityRegistry", () => {
  it("dispatches an exact capability/provider pair", async () => {
    const execute = vi.fn(async (input: string) => input.toUpperCase());
    const adapter: CapabilityAdapter<"speech_synthesis", string, string> = { capability: "speech_synthesis", provider: { provider: "fake", model: "voice-1", region: "eu" }, execute };
    const registry = new CapabilityRegistry(); registry.register(adapter);
    const resolved = registry.get<"speech_synthesis", string, string>("speech_synthesis", "fake");
    await expect(resolved.execute("hello", context("speech_synthesis"))).resolves.toBe("HELLO"); expect(execute).toHaveBeenCalledOnce();
  });
  it("rejects duplicate registrations", () => {
    const registry = new CapabilityRegistry();
    const adapter: CapabilityAdapter<"structured_text", unknown, unknown> = { capability: "structured_text", provider: { provider: "fake", model: "text-1" }, execute: async (input) => input };
    registry.register(adapter); expect(() => registry.register(adapter)).toThrow(AiProviderError);
  });
  it("fails closed when an adapter is absent", () => {
    const registry = new CapabilityRegistry();
    try { registry.get("realtime_audio", "missing"); throw new Error("expected failure"); }
    catch (error) { expect(error).toBeInstanceOf(AiProviderError); expect((error as AiProviderError).code).toBe("not_configured"); expect((error as AiProviderError).retryable).toBe(false); }
  });
});
