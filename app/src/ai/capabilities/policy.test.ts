import { describe, expect, it } from "vitest";
import { AiProviderError, type CapabilityRequest } from "./contracts.js";
import { selectProvider, type ProviderCandidate, type RoutePolicy } from "./policy.js";

const request: CapabilityRequest<"realtime_audio"> = { capability: "realtime_audio", route: "coach_high_stakes", audience: "parent", locale: "he", dataClasses: ["child_profile"], risk: "high" };
const policy: RoutePolicy = { allowedRegions: ["eu"], requireNoTraining: true, maxRetentionDays: 0, weights: { safety: 3, quality: 2 } };
const candidate = (provider: string, over: Partial<ProviderCandidate> = {}): ProviderCandidate => ({ ref: { provider, model: `${provider}-voice`, region: "eu" }, capabilities: ["realtime_audio"], audiences: ["parent"], dataClasses: ["child_profile"], trainsOnCustomerData: false, retentionDays: 0, score: { quality: 4, safety: 4, reliability: 4, latencyFitness: 4, costFitness: 4 }, ...over });

describe("selectProvider", () => {
  it("scores only candidates that passed every policy gate", () => {
    const ineligible = candidate("outside-eu", { ref: { provider: "outside-eu", model: "voice", region: "us" }, score: { quality: 10, safety: 10, reliability: 10, latencyFitness: 10, costFitness: 10 } });
    const safe = candidate("eu-safe");
    const decision = selectProvider(request, policy, [ineligible, safe]);
    expect(decision.selected.ref.provider).toBe("eu-safe");
    expect(decision.rejected[0]).toMatchObject({ candidate: { provider: "outside-eu" }, reasons: ["region"] });
  });
  it("prefers the highest weighted eligible score", () => {
    const quality = candidate("quality", { score: { quality: 5, safety: 5, reliability: 3, latencyFitness: 2, costFitness: 2 } });
    const cheap = candidate("cheap", { score: { quality: 3, safety: 3, reliability: 5, latencyFitness: 5, costFitness: 5 } });
    expect(selectProvider(request, policy, [cheap, quality]).selected.ref.provider).toBe("quality");
  });
  it("fails closed when every provider violates policy", () => {
    const retained = candidate("retained", { retentionDays: 30 });
    expect(() => selectProvider(request, policy, [retained])).toThrow(AiProviderError);
    try { selectProvider(request, policy, [retained]); } catch (error) { expect((error as AiProviderError).code).toBe("policy_denied"); }
  });
});

describe("B-PROV-01 · realtime_audio under the dated residency exception", async () => {
  const live = await import("../liveResidency.js");
  const { routePolicyFor } = await import("./policy.js");
  const NOW = Date.parse("2026-10-01T12:00:00Z");
  const prod = (over: Record<string, unknown> = {}) => ({
    arborEnv: "prod" as const, liveEnabled: true, geminiApiKey: "k", liveModel: "gemini-3.8-live",
    vertexLocation: "europe-west4", gcpProjectId: undefined as string | undefined,
    liveGlobalExceptionUntil: "2026-10-31" as string | undefined, liveVertexEu: false, liveVertexLocation: "europe-west4", ...over,
  });

  it("the current path is an honest region:'global' candidate, and the base prod policy rejects it", () => {
    const candidate = live.liveGlobalCandidate({ liveModel: "gemini-3.8-live" });
    expect(candidate.ref.region).toBe("global");
    expect(() => selectProvider(live.LIVE_REQUEST, routePolicyFor({ arborEnv: "prod" }), [candidate])).toThrow(AiProviderError);
  });

  it("before / on the date the realtime policy admits 'global'; after it, it does not", () => {
    expect(live.realtimePolicyFor(prod(), NOW).allowedRegions).toEqual(["eu", "global"]);
    expect(live.realtimePolicyFor(prod(), Date.parse("2026-10-31T23:59:59Z")).allowedRegions).toContain("global");
    expect(live.realtimePolicyFor(prod(), Date.parse("2026-11-01T00:00:01Z")).allowedRegions).toEqual(["eu"]);
    expect(live.realtimePolicyFor(prod({ liveGlobalExceptionUntil: undefined }), NOW).allowedRegions).toEqual(["eu"]);
  });

  it("decideLive: exceptionUntil only while the exception is what admits global", () => {
    expect(live.decideLive(prod(), NOW)).toMatchObject({ available: true, exceptionUntil: "2026-10-31" });
    const after = live.decideLive(prod(), Date.parse("2026-11-02T00:00:00Z"));
    expect(after).toEqual({ available: false, reason: "policy_denied" });
    expect(live.decideLive({ ...prod(), arborEnv: "local" }, NOW).exceptionUntil).toBeUndefined();
    expect(live.decideLive(prod({ liveEnabled: false }), NOW)).toEqual({ available: false, reason: "not_configured" });
  });

  it("the Vertex eu candidate is eligible in prod without any exception and outranks global", () => {
    const d = live.decideLive(prod({ liveVertexEu: true, gcpProjectId: "p" }), NOW);
    expect(d.decision?.selected.ref).toMatchObject({ provider: live.LIVE_VERTEX_EU_PROVIDER, region: "eu" });
    expect(d.exceptionUntil).toBeUndefined();
    const after = live.decideLive(prod({ liveVertexEu: true, gcpProjectId: "p" }), Date.parse("2027-01-01T00:00:00Z"));
    expect(after.available).toBe(true);
  });
});
