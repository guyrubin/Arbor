import { describe, expect, it } from "vitest";
import { createTestConfig } from "../testConfig.js";
import type { ModelProvider } from "../ai/modelRouter.js";
import { AiProviderError } from "../ai/capabilities/contracts.js";
import { UnsafeTtsOutputError } from "./tts.js";
import { buildCapabilityRegistry } from "./createApp.js";

/**
 * COACH-3 + AIR-8 — the CapabilityRegistry the app boots with is real wiring:
 * the google-TTS adapter (now the LIVE /api/tts dispatch seam) and the
 * config's structured-text adapters (Gemini/Claude on Vertex, or the dev
 * Gemini key) are registered at startup, and lookups stay exact-match
 * fail-closed. The TTS adapter runs the unconditional lexical safety floor,
 * so registry.execute is never an unscreened synthesis path.
 */

const stubModelProvider = {
  generateJson: async () => ({ ok: true }),
} as unknown as ModelProvider;

describe("buildCapabilityRegistry", () => {
  it("registers the google speech_synthesis adapter with the config's residency region", () => {
    const registry = buildCapabilityRegistry(createTestConfig(), stubModelProvider);
    const adapter = registry.get("speech_synthesis", "google");
    expect(adapter.provider).toMatchObject({ provider: "google", model: "cloud-tts-v1", region: "eu" });
  });

  it("registers both Vertex structured-text adapters (Claude for coach, Gemini for analysis)", () => {
    const registry = buildCapabilityRegistry(createTestConfig(), stubModelProvider);
    // AIR-4: the coach adapter declares the current Claude Sonnet alias.
    expect(registry.get("structured_text", "vertex_claude").provider.model).toBe("claude-sonnet-5@anthropic");
    expect(registry.get("structured_text", "vertex_gemini").provider.model).toBe("gemini-2.5-pro");
  });

  it("registers the gemini_dev structured-text adapter (declared global) for local dev", () => {
    const registry = buildCapabilityRegistry(createTestConfig({ modelProvider: "gemini_dev" }), stubModelProvider);
    expect(registry.get("structured_text", "gemini_dev").provider).toMatchObject({ region: "global" });
    expect(() => registry.get("structured_text", "vertex_claude")).toThrow(AiProviderError);
  });

  // AIR-8 firewall condition: registry.execute must never expose unscreened
  // synthesizeSpeech — the adapter's lexical floor blocks before any provider
  // call, regardless of which caller resolved it.
  it("TTS adapter blocks lexically-unsafe text before any synthesis (no unscreened path via the registry)", async () => {
    const registry = buildCapabilityRegistry(createTestConfig({ ttsProvider: "google" }), stubModelProvider);
    const adapter = registry.get("speech_synthesis", "google");
    await expect(
      adapter.execute(
        { text: "Your child has autism and needs treatment.", lang: "en" },
        { capability: "speech_synthesis", route: "creative_low_risk", audience: "parent", locale: "en", dataClasses: ["public"], risk: "low" },
      ),
    ).rejects.toBeInstanceOf(UnsafeTtsOutputError);
  });

  it("fails closed (not_configured) for a capability/provider pair that was never registered", () => {
    const registry = buildCapabilityRegistry(createTestConfig(), stubModelProvider);
    try {
      registry.get("realtime_audio", "google");
      expect.unreachable("registry.get must throw for unregistered capabilities");
    } catch (error) {
      expect((error as AiProviderError).code).toBe("not_configured");
    }
  });

  it("delegates structured-text execution to the existing ModelProvider (behavior unchanged)", async () => {
    const registry = buildCapabilityRegistry(createTestConfig(), stubModelProvider);
    const adapter = registry.get("structured_text", "vertex_gemini");
    await expect(
      adapter.execute({ route: "analysis_structured", prompt: "x" }, {
        capability: "structured_text",
        route: "analysis_structured",
        audience: "internal",
        locale: "en",
        dataClasses: ["public"],
        risk: "low",
      }),
    ).resolves.toEqual({ ok: true });
  });
});
