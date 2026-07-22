import { AiProviderError, type AiAudience, type AiCapability, type AiDataClass, type CapabilityRequest, type ProviderRef } from "./contracts.js";

export interface ProviderCandidate {
  ref: ProviderRef;
  capabilities: readonly AiCapability[];
  audiences: readonly AiAudience[];
  dataClasses: readonly AiDataClass[];
  trainsOnCustomerData: boolean;
  retentionDays: number;
  score: { quality: number; safety: number; reliability: number; latencyFitness: number; costFitness: number };
}

export interface RoutePolicy {
  allowedRegions: readonly string[];
  requireNoTraining: boolean;
  maxRetentionDays: number;
  weights?: Partial<ProviderCandidate["score"]>;
}

export interface PolicyDecision { selected: ProviderCandidate; eligible: readonly ProviderCandidate[]; rejected: readonly { candidate: ProviderRef; reasons: readonly string[] }[]; }

const rejectionReasons = (request: CapabilityRequest, policy: RoutePolicy, candidate: ProviderCandidate): string[] => {
  const reasons: string[] = [];
  if (!candidate.capabilities.includes(request.capability)) reasons.push("capability");
  if (!candidate.audiences.includes(request.audience)) reasons.push("audience");
  if (request.dataClasses.some((value) => !candidate.dataClasses.includes(value))) reasons.push("data_class");
  if (!candidate.ref.region || !policy.allowedRegions.includes(candidate.ref.region)) reasons.push("region");
  if (policy.requireNoTraining && candidate.trainsOnCustomerData) reasons.push("training");
  if (candidate.retentionDays > policy.maxRetentionDays) reasons.push("retention");
  return reasons;
};

const weightedScore = (candidate: ProviderCandidate, policy: RoutePolicy): number => {
  const weights = { quality: 1, safety: 1, reliability: 1, latencyFitness: 1, costFitness: 1, ...policy.weights };
  return Object.entries(candidate.score).reduce((total, [key, value]) => total + value * weights[key as keyof typeof weights], 0);
};

/** Eligibility is evaluated before scoring. If every candidate violates policy, selection fails closed. */
export const selectProvider = (request: CapabilityRequest, policy: RoutePolicy, candidates: readonly ProviderCandidate[]): PolicyDecision => {
  const rejected: PolicyDecision["rejected"][number][] = [];
  const eligible = candidates.filter((candidate) => {
    const reasons = rejectionReasons(request, policy, candidate);
    if (reasons.length) rejected.push({ candidate: candidate.ref, reasons });
    return reasons.length === 0;
  });
  if (!eligible.length) throw new AiProviderError("policy_denied", `No eligible provider for ${request.capability}`, false);
  const selected = [...eligible].sort((a, b) => weightedScore(b, policy) - weightedScore(a, policy))[0];
  return { selected, eligible, rejected };
};
