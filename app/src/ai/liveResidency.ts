/**
 * B-PROV-01 — Live voice residency made honest: the realtime path goes
 * through the same provider policy as every other AI route.
 *
 * THE DEFECT THIS CLOSES
 * ──────────────────────
 * `/live/token` minted against Google's GLOBAL AI Studio endpoint with the
 * Gemini API key, while `capabilities/policy.ts` pins production to `["eu"]`.
 * The realtime path simply never asked the policy, so the one route that
 * carries a parent's live voice was the one route outside the residency rule.
 *
 * WHAT IT DOES NOW (program decision 2026-10-01, B-PROV-01 / D2)
 * ─────────────────────────────────────────────────────────────
 *  - The current path is a `realtime_audio` candidate with an HONEST
 *    `region: "global"`.
 *  - Production admits it only under a DATED exception —
 *    `LIVE_GLOBAL_EXCEPTION_UNTIL` (default below; env override, `off`
 *    disables). After that day production denies it: `/live/availability`
 *    reports unavailable and `/live/token` answers 503, so the browser takes
 *    the EU STT → text → TTS loop it already has.
 *  - The Vertex `eu` attempt is a second candidate behind `LIVE_VERTEX_EU`
 *    (default off). When it is on it outranks the global path and survives
 *    the exception's end. Ephemeral Live tokens are a Gemini Developer API
 *    feature, so the EU mint may fail at the provider; that failure is a 503
 *    and the same browser fallback — never a silent hop back to global.
 *  - `/live/availability` carries `exceptionUntil` exactly when the selected
 *    path is the global one AND it was admitted by the exception (production);
 *    B-ASKJB-02's data-use line names the endpoint and the date from it.
 *
 * Pure: config + clock in, decision out. No SDK, no network.
 */
import type { ArborConfig } from "../config/env.js";
import { AiProviderError, type CapabilityRequest } from "./capabilities/contracts.js";
import { providerRegion, routePolicyFor, selectProvider, type PolicyDecision, type ProviderCandidate, type RoutePolicy } from "./capabilities/policy.js";

/** The program's dated exception for the global Live endpoint (1 Oct 2026). */
export const LIVE_GLOBAL_EXCEPTION_UNTIL = "2026-10-31";

/** Provider ids — the token handler dispatches on these. */
export const LIVE_GLOBAL_PROVIDER = "google-ai-studio-live";
export const LIVE_VERTEX_EU_PROVIDER = "vertex-live";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Env value → exception day. Unset → the program default; `off`/`none`/`false`
 *  → no exception; anything that is not a calendar day → no exception
 *  (fail closed — a typo must never extend residency). */
export const liveExceptionFromEnv = (value: string | undefined): string | undefined => {
  if (value === undefined) return LIVE_GLOBAL_EXCEPTION_UNTIL;
  const v = value.trim();
  if (!v || /^(off|none|false|0)$/i.test(v)) return undefined;
  if (!ISO_DAY.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) return undefined;
  return v;
};

/** True through the END of the named day (UTC). */
export const liveExceptionActive = (until: string | undefined, nowMs: number): boolean => {
  if (!until || !ISO_DAY.test(until)) return false;
  const end = Date.parse(`${until}T23:59:59.999Z`);
  return Number.isFinite(end) && nowMs <= end;
};

/** The realtime request every Live decision is made for. */
export const LIVE_REQUEST: CapabilityRequest<"realtime_audio"> = {
  capability: "realtime_audio",
  route: "coach_high_stakes",
  audience: "parent",
  locale: "en",
  // The token pins the spoken persona built from the child's profile/memory.
  dataClasses: ["account", "child_profile"],
  risk: "high",
};

/** The current path: AI Studio ephemeral tokens on the global endpoint. */
export const liveGlobalCandidate = (config: Pick<ArborConfig, "liveModel">): ProviderCandidate => ({
  ref: { provider: LIVE_GLOBAL_PROVIDER, model: config.liveModel, region: "global" },
  capabilities: ["realtime_audio"],
  audiences: ["parent"],
  dataClasses: ["account", "child_profile"],
  trainsOnCustomerData: false,
  retentionDays: 0,
  score: { quality: 3, safety: 3, reliability: 3, latencyFitness: 3, costFitness: 3 },
});

/** The Vertex `eu` attempt. Scored above the global path so, when both are
 *  eligible, residency wins. */
export const liveVertexEuCandidate = (config: Pick<ArborConfig, "liveModel" | "liveVertexLocation" | "vertexLocation">): ProviderCandidate => ({
  ref: { provider: LIVE_VERTEX_EU_PROVIDER, model: config.liveModel, region: providerRegion(config.liveVertexLocation || config.vertexLocation) },
  capabilities: ["realtime_audio"],
  audiences: ["parent"],
  dataClasses: ["account", "child_profile"],
  trainsOnCustomerData: false,
  retentionDays: 0,
  score: { quality: 3, safety: 4, reliability: 3, latencyFitness: 3, costFitness: 3 },
});

type LiveConfig = Pick<
  ArborConfig,
  "arborEnv" | "liveEnabled" | "geminiApiKey" | "liveModel" | "vertexLocation" | "gcpProjectId" | "liveGlobalExceptionUntil" | "liveVertexEu" | "liveVertexLocation"
>;

/** Base route policy, plus "global" ONLY while the dated exception runs. */
export const realtimePolicyFor = (config: LiveConfig, nowMs: number): RoutePolicy => {
  const base = routePolicyFor(config);
  if (base.allowedRegions.includes("global") || !liveExceptionActive(config.liveGlobalExceptionUntil, nowMs)) return base;
  return { ...base, allowedRegions: [...base.allowedRegions, "global"] };
};

/** Candidates the config actually provides (VC-7: nothing without LIVE_ENABLED). */
export const liveCandidatesFor = (config: LiveConfig): ProviderCandidate[] => {
  if (!config.liveEnabled) return [];
  const out: ProviderCandidate[] = [];
  if (config.liveVertexEu && config.gcpProjectId) out.push(liveVertexEuCandidate(config));
  if (config.geminiApiKey) out.push(liveGlobalCandidate(config));
  return out;
};

export interface LiveDecision {
  available: boolean;
  /** Set only when the selected path is global and the dated exception admitted it. */
  exceptionUntil?: string;
  decision?: PolicyDecision;
  reason?: "not_configured" | "policy_denied";
}

/** THE Live decision: availability, token minting and logging all read this. */
export const decideLive = (config: LiveConfig, nowMs: number = Date.now()): LiveDecision => {
  const candidates = liveCandidatesFor(config);
  if (!candidates.length) return { available: false, reason: "not_configured" };
  const policy = realtimePolicyFor(config, nowMs);
  let decision: PolicyDecision;
  try {
    decision = selectProvider(LIVE_REQUEST, policy, candidates);
  } catch (error) {
    if (error instanceof AiProviderError && error.code === "policy_denied") return { available: false, reason: "policy_denied" };
    throw error;
  }
  const admittedByException =
    decision.selected.ref.region === "global" && !routePolicyFor(config).allowedRegions.includes("global");
  return {
    available: true,
    decision,
    ...(admittedByException && config.liveGlobalExceptionUntil ? { exceptionUntil: config.liveGlobalExceptionUntil } : {}),
  };
};
