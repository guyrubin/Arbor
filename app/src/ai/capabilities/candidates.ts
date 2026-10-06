/**
 * B-PROV-07 — the per-route provider candidate LIST the route policy chooses
 * from. Unset = today's single candidate per route (the configured provider
 * and the route's configured model), so production behaviour is unchanged.
 *
 * Override per route with `AI_CANDIDATES_<ROUTE>` (e.g.
 * AI_CANDIDATES_COACH_HIGH_STAKES="vertex_claude:claude-sonnet-5@anthropic,vertex_gemini:gemini-2.5-flash"),
 * a comma list of `provider:model[:region]`, parsed defensively:
 *  - only a provider the configured MODEL_PROVIDER can actually dispatch is
 *    kept (vertex → vertex_claude | vertex_gemini; gemini_dev → gemini_dev;
 *    mock → mock), and a Vertex entry's model must match its provider family
 *    (the dispatcher routes by model id: claude-* → Claude, else Gemini);
 *  - the region is DECLARED from where that provider's calls really go
 *    (VERTEX_CLAUDE_LOCATION for Claude, VERTEX_LOCATION for Gemini, "global"
 *    for the AI-Studio key and the fixtures). An optional `:region` token is an
 *    assertion only: an entry whose token disagrees with the real region is
 *    dropped, never trusted;
 *  - malformed entries are dropped; an all-invalid list falls back to the
 *    single default candidate.
 * Every candidate carries honest posture flags (`trainsOnCustomerData`,
 * `retentionDays`) for the policy gate, which rejects ineligible candidates
 * BEFORE scoring (policy.selectProvider).
 */
import type { ArborConfig } from "../../config/env.js";
import type { ModelRoute } from "../modelRouter.js";
import { claudeVertexLocation } from "../claudeVertexProvider.js";
import { MOCK_MODEL_ID } from "../mockProvider.js";
import { providerRegion, type ProviderCandidate } from "./policy.js";

export type CandidateProviderId = "vertex_claude" | "vertex_gemini" | "gemini_dev" | "mock";

/** Data-handling posture per provider (region is derived from config, below). */
export const PROVIDER_POSTURE: Record<CandidateProviderId, { trainsOnCustomerData: boolean; retentionDays: number }> = {
  vertex_claude: { trainsOnCustomerData: false, retentionDays: 0 },
  vertex_gemini: { trainsOnCustomerData: false, retentionDays: 0 },
  // AI-Studio developer API: no regional endpoint, 30-day abuse-monitoring retention.
  gemini_dev: { trainsOnCustomerData: false, retentionDays: 30 },
  mock: { trainsOnCustomerData: false, retentionDays: 0 },
};

const CANDIDATE_CAPABILITIES = ["structured_text", "text_stream"] as const;
const CANDIDATE_AUDIENCES = ["parent", "professional", "internal"] as const;
const CANDIDATE_DATA_CLASSES = ["public", "account", "child_profile"] as const;

type Score = ProviderCandidate["score"];
const NEUTRAL_SCORE: Score = { quality: 3, safety: 3, reliability: 3, latencyFitness: 3, costFitness: 3 };

/** Relative fitness by model family (1–5) — an ordering for the weighted
 *  choice between eligible candidates, not a measurement. Unknown → neutral. */
export const modelScore = (model: string): Score => {
  const m = model.toLowerCase();
  if (/^claude-opus/.test(m)) return { quality: 5, safety: 4, reliability: 3, latencyFitness: 2, costFitness: 1 };
  if (/^claude-/.test(m)) return { quality: 4, safety: 4, reliability: 3, latencyFitness: 3, costFitness: 2 };
  if (/^gemini-.*-pro/.test(m)) return { quality: 4, safety: 3, reliability: 3, latencyFitness: 3, costFitness: 3 };
  if (/^gemini-.*-flash-lite/.test(m)) return { quality: 2, safety: 3, reliability: 3, latencyFitness: 5, costFitness: 5 };
  if (/^gemini-.*-flash/.test(m)) return { quality: 3, safety: 3, reliability: 3, latencyFitness: 4, costFitness: 4 };
  return NEUTRAL_SCORE;
};

const isClaudeModel = (model: string) => /^claude-/i.test(model);

/** The raw config→model map for a route (no policy). */
export const configuredModelForRoute = (config: ArborConfig, route: ModelRoute): string => {
  if (config.modelProvider === "gemini_dev") return config.geminiModel;
  if (config.modelProvider === "mock") return MOCK_MODEL_ID;
  const map: Record<ModelRoute, string> = {
    coach_high_stakes: config.vertexModelChat,
    creative_low_risk: config.vertexModelStory,
    analysis_structured: config.vertexModelAnalysis,
    handoff_structured: config.vertexModelHandoff,
  };
  return map[route];
};

/** The coarse region a provider's calls actually go to under this config. */
export const declaredRegion = (config: ArborConfig, provider: CandidateProviderId): string => {
  if (provider === "vertex_claude") return providerRegion(claudeVertexLocation(config));
  if (provider === "vertex_gemini") return providerRegion(config.vertexLocation);
  // The AI-Studio key has no regional endpoint and the fixtures (B-INF-04)
  // make no call: both declared "global", which the prod EU-only policy denies.
  return "global";
};

/** Providers the configured MODEL_PROVIDER can dispatch a call to. */
const dispatchable = (config: ArborConfig): readonly CandidateProviderId[] =>
  config.modelProvider === "mock" ? ["mock"] : config.modelProvider === "gemini_dev" ? ["gemini_dev"] : ["vertex_claude", "vertex_gemini"];

export const buildCandidate = (config: ArborConfig, provider: CandidateProviderId, model: string): ProviderCandidate => ({
  ref: { provider, model, region: declaredRegion(config, provider) },
  capabilities: [...CANDIDATE_CAPABILITIES],
  audiences: [...CANDIDATE_AUDIENCES],
  dataClasses: [...CANDIDATE_DATA_CLASSES],
  ...PROVIDER_POSTURE[provider],
  score: provider === "mock" ? NEUTRAL_SCORE : modelScore(model),
});

/** Today's single candidate for a route: the configured provider + model. */
export const defaultCandidateFor = (config: ArborConfig, route: ModelRoute): ProviderCandidate => {
  const model = configuredModelForRoute(config, route);
  const provider: CandidateProviderId =
    config.modelProvider === "mock" ? "mock"
      : config.modelProvider === "gemini_dev" ? "gemini_dev"
        : isClaudeModel(model) ? "vertex_claude" : "vertex_gemini";
  return buildCandidate(config, provider, model);
};

/** The env key holding a route's candidate list. */
export const candidatesEnvKey = (route: ModelRoute): string => `AI_CANDIDATES_${route.toUpperCase()}`;

const PROVIDERS: readonly CandidateProviderId[] = ["vertex_claude", "vertex_gemini", "gemini_dev", "mock"];
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._@-]{0,127}$/;

/** Parse a `provider:model[:region]` comma list against this config. Pure. */
export const parseCandidateList = (config: ArborConfig, raw: string | undefined): ProviderCandidate[] => {
  if (!raw || typeof raw !== "string") return [];
  const allowed = dispatchable(config);
  const seen = new Set<string>();
  const out: ProviderCandidate[] = [];
  for (const entry of raw.split(",")) {
    const parts = entry.trim().split(":").map((p) => p.trim());
    if (parts.length < 2 || parts.length > 3) continue;
    const [providerRaw, model, regionToken] = parts;
    const provider = providerRaw.toLowerCase() as CandidateProviderId;
    if (!PROVIDERS.includes(provider) || !allowed.includes(provider)) continue;
    if (!MODEL_ID.test(model)) continue;
    if (provider === "vertex_claude" && !isClaudeModel(model)) continue;
    if (provider === "vertex_gemini" && isClaudeModel(model)) continue;
    if (provider === "mock" && model !== MOCK_MODEL_ID) continue;
    const candidate = buildCandidate(config, provider, model);
    if (regionToken !== undefined && providerRegion(regionToken) !== candidate.ref.region) continue;
    const key = `${provider}:${model}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return out;
};

/** B-PROV-07: the candidate list for a route. Unset/invalid env → the single default. */
export const candidatesFor = (
  config: ArborConfig,
  route: ModelRoute,
  env: Readonly<Record<string, string | undefined>> = process.env,
): ProviderCandidate[] => {
  const parsed = parseCandidateList(config, env[candidatesEnvKey(route)]);
  return parsed.length ? parsed : [defaultCandidateFor(config, route)];
};
