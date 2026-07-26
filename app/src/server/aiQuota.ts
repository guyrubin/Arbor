import type { RequestHandler } from "express";
import type { UsageCounterStore } from "./quotaStore.js";
import { COACH_METER, resolveEntitlement, type EntitlementStore } from "./entitlements.js";
import { logger, requestIdOf } from "./logger.js";

/**
 * Per-user hourly cap on AI-generating endpoints. Guards against runaway cost
 * (looping clients, abuse) on top of the IP rate-limit. Keyed by the verified
 * Firebase uid when present, else the request IP. Counters live in the shared
 * UsageCounterStore (Firestore in prod), so the cap holds across Cloud Run
 * instances (COST-1).
 */
const WINDOW_MS = 60 * 60 * 1000;
const LIMIT = Number(process.env.AI_USER_HOURLY_LIMIT || 80);
const DAY_MS = 24 * 60 * 60 * 1000;

/** AIR-6: /api/tts is char-metered (Cloud TTS bills per character), NOT
 *  model-call-metered — spoken sentences must never starve the parent's hourly
 *  AI budget or 429 a voice conversation mid-session. Default 150k chars/day
 *  ≈ 20 ten-minute continuous voice sessions. */
const TTS_DAILY_CHAR_LIMIT = Number(process.env.TTS_DAILY_CHAR_LIMIT || 150_000);
/** Mirrors the /api/tts handler's clip so metering can never exceed synthesis. */
const TTS_MAX_CHARS_PER_CALL = 4000;

const quotaKeyOf = (req: any): string => req.user?.uid || req.ip || "anon";

/** AIR-7: middleware timing goes to the observability line — a latency budget
 *  needs measured facts, and the pre-handler cost was previously invisible. */
const logGateDuration = (req: any, gate: string, startedAt: number) => {
  try {
    logger.info("ai.gate", { requestId: requestIdOf(req), gate, ms: Date.now() - startedAt });
  } catch { /* telemetry must never break a request */ }
};

const rejectOverHourlyQuota = (res: any, count: number, resetAt: number): boolean => {
  res.setHeader("X-AI-Quota-Limit", String(LIMIT));
  res.setHeader("X-AI-Quota-Remaining", String(Math.max(0, LIMIT - count)));
  if (count > LIMIT) {
    const retrySec = Math.ceil((resetAt - Date.now()) / 1000);
    res.setHeader("Retry-After", String(retrySec));
    res.status(429).json({
      error: "AI usage limit reached",
      details: `You've reached the hourly AI limit (${LIMIT} requests). Please try again in about ${Math.ceil(retrySec / 60)} minutes.`,
    });
    return true;
  }
  return false;
};

export const createAiQuota = (counters: UsageCounterStore): RequestHandler => async (req, res, next) => {
  const startedAt = Date.now();
  const key = quotaKeyOf(req);
  const { count, resetAt } = await counters.increment("ai_hourly", key, WINDOW_MS, { limit: LIMIT });
  logGateDuration(req, "ai_hourly", startedAt);
  if (rejectOverHourlyQuota(res, count, resetAt)) return;
  next();
};

/**
 * AIR-7: ONE combined gate for /chat and /council, replacing the serial
 * aiQuota → coachMeter middleware pair (which cost 4-6 sequential Firestore
 * round-trips before any model token). The hourly-quota increment and the
 * entitlement resolution run CONCURRENTLY; the coach-meter increment (free
 * plans only) follows once — and each increment itself is now one round-trip
 * (quotaStore fast path). Enforcement semantics, headers, and payloads are
 * byte-identical to createAiQuota + createCoachMeter.
 */
export const createCoachGate = (
  counters: UsageCounterStore,
  entitlementStore: EntitlementStore,
): RequestHandler => async (req, res, next) => {
  const startedAt = Date.now();
  const key = quotaKeyOf(req);
  const actor = { uid: (req as any).user?.uid || "local-sandbox", email: ((req as any).user?.email as string | null) || null };

  const [quota, entitlement] = await Promise.all([
    counters.increment("ai_hourly", key, WINDOW_MS, { limit: LIMIT }),
    resolveEntitlement(entitlementStore, actor),
  ]);
  (req as any).entitlement = entitlement;

  if (rejectOverHourlyQuota(res, quota.count, quota.resetAt)) {
    logGateDuration(req, "coach_gate", startedAt);
    return;
  }

  const limit = entitlement.limits.coachMessagesPerDay;
  if (limit === null) {
    logGateDuration(req, "coach_gate", startedAt);
    next();
    return;
  }

  const { count, resetAt } = await counters.increment(COACH_METER, actor.uid, DAY_MS, { limit });
  res.setHeader("X-Coach-Limit", String(limit));
  res.setHeader("X-Coach-Remaining", String(Math.max(0, limit - count)));
  logGateDuration(req, "coach_gate", startedAt);
  if (count > limit) {
    res.status(402).json({
      error: "Daily coaching limit reached",
      details: `The free plan includes ${limit} coach messages per day. Arbor Plus removes the limit.`,
      upgrade: { feature: "coach_unlimited", plan: "plus", resetAt: new Date(resetAt).toISOString() },
    });
    return;
  }
  next();
};

/**
 * AIR-6: character-based DAILY meter for /api/tts. Neural TTS sentence calls
 * previously each burned one unit of the 80/hr model-call quota, so a voice
 * conversation (~5-10 sentences per answer) exhausted the hour in ~7-10 turns
 * and died mid-session. TTS is not a model call: it is billed per character,
 * so it is metered per character — and spoken sentences leave
 * X-AI-Quota-Remaining untouched. The safety posture is unchanged: the lexical
 * screen runs UNCONDITIONALLY inside the /tts handler regardless of metering.
 */
export const createTtsQuota = (counters: UsageCounterStore): RequestHandler => async (req, res, next) => {
  const startedAt = Date.now();
  const key = quotaKeyOf(req);
  const text = typeof (req as any).body?.text === "string" ? (req as any).body.text : "";
  // Meter what synthesis will actually see (the handler clips to the same cap);
  // meter at least 1 char so empty/malformed calls can't loop free.
  const chars = Math.max(1, Math.min(text.length, TTS_MAX_CHARS_PER_CALL));

  const { count, resetAt } = await counters.add("tts_chars_daily", key, chars, DAY_MS, { limit: TTS_DAILY_CHAR_LIMIT });
  res.setHeader("X-TTS-Quota-Limit", String(TTS_DAILY_CHAR_LIMIT));
  res.setHeader("X-TTS-Quota-Remaining", String(Math.max(0, TTS_DAILY_CHAR_LIMIT - count)));
  logGateDuration(req, "tts_chars", startedAt);

  if (count > TTS_DAILY_CHAR_LIMIT) {
    const retrySec = Math.ceil((resetAt - Date.now()) / 1000);
    res.setHeader("Retry-After", String(retrySec));
    // Calm parent register; the client falls back to the on-device voice.
    res.status(429).json({
      error: "Daily voice limit reached",
      details: "Arbor's natural voice is resting for today. Conversations continue with the standard voice and refresh tomorrow.",
    });
    return;
  }
  next();
};
