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
