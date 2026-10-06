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

describe("B-PROV-07 · entitlement weights the choice between eligible candidates", async () => {
  const { routePolicyFor, ENTITLEMENT_WEIGHTS } = await import("./policy.js");
  const text: CapabilityRequest<"structured_text"> = { capability: "structured_text", route: "coach_high_stakes", audience: "parent", locale: "en", dataClasses: ["child_profile"], risk: "high" };
  const textCandidate = (provider: string, score: ProviderCandidate["score"], region = "eu"): ProviderCandidate => ({ ref: { provider, model: `${provider}-model`, region }, capabilities: ["structured_text"], audiences: ["parent"], dataClasses: ["child_profile"], trainsOnCustomerData: false, retentionDays: 0, score });
  const cheaper = textCandidate("cheaper", { quality: 3, safety: 3, reliability: 3, latencyFitness: 4, costFitness: 4 });
  const better = textCandidate("better", { quality: 4, safety: 4, reliability: 3, latencyFitness: 3, costFitness: 2 });

  it("no entitlement → today's unweighted policy (no weights key)", () => {
    expect(routePolicyFor({ arborEnv: "prod" })).toEqual({ allowedRegions: ["eu"], requireNoTraining: true, maxRetentionDays: 30 });
    expect(routePolicyFor({ arborEnv: "prod" }, { entitlement: undefined })).not.toHaveProperty("weights");
  });

  it("free → costFitness 3, paid → quality 3 (other weights stay 1)", () => {
    expect(ENTITLEMENT_WEIGHTS).toEqual({ free: { costFitness: 3 }, paid: { quality: 3 } });
    expect(routePolicyFor({ arborEnv: "prod" }, { entitlement: "free" }).weights).toEqual({ costFitness: 3 });
    expect(routePolicyFor({ arborEnv: "prod" }, { entitlement: "paid" }).weights).toEqual({ quality: 3 });
  });

  it("two eligible candidates: free picks the cheaper, paid picks the higher quality — in either list order", () => {
    for (const list of [[cheaper, better], [better, cheaper]]) {
      const free = { ...text, entitlement: "free" as const };
      const paid = { ...text, entitlement: "paid" as const };
      expect(selectProvider(free, routePolicyFor({ arborEnv: "prod" }, free), list).selected.ref.provider).toBe("cheaper");
      expect(selectProvider(paid, routePolicyFor({ arborEnv: "prod" }, paid), list).selected.ref.provider).toBe("better");
    }
  });

  it("an ineligible region is rejected before scoring, whatever the entitlement weights", () => {
    const outside = textCandidate("outside-eu", { quality: 10, safety: 10, reliability: 10, latencyFitness: 10, costFitness: 10 }, "us");
    for (const entitlement of ["free", "paid"] as const) {
      const req = { ...text, entitlement };
      const decision = selectProvider(req, routePolicyFor({ arborEnv: "prod" }, req), [outside, cheaper, better]);
      expect(decision.selected.ref.provider).not.toBe("outside-eu");
      expect(decision.eligible.map((c) => c.ref.provider)).toEqual(["cheaper", "better"]);
      expect(decision.rejected).toEqual([{ candidate: outside.ref, reasons: ["region"] }]);
    }
    expect(() => selectProvider({ ...text, entitlement: "paid" }, routePolicyFor({ arborEnv: "prod" }, { entitlement: "paid" }), [outside])).toThrow(AiProviderError);
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
