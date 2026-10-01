import type { RequestHandler } from "express";
import type { UsageCounterStore } from "./quotaStore.js";

/**
 * S2 — per-user DAILY cap + global circuit breaker on the image-generation
 * endpoints (`/generate-avatar`, `/generate-scene`, `/generate-comic`).
 *
 * Image generation (Gemini 2.5 Flash Image) is a separate, pricier SKU than
 * text, and these endpoints previously had NO quota of any kind — a free/anon
 * caller could loop them and run up unbounded cost. This adds:
 *  - a per-user daily cap (IMAGE_GEN_DAILY_LIMIT, default 60), keyed by the
 *    verified Firebase uid (else request IP), and
 *  - a global daily circuit breaker (IMAGE_GEN_GLOBAL_DAILY_LIMIT, default
 *    5000) so even distributed abuse can't exceed a known daily ceiling.
 *
 * Counters live in the shared cross-instance UsageCounterStore (Firestore in
 * prod), so caps hold across Cloud Run instances. The store fails OPEN on
 * backend errors (availability over enforcement) — the same posture as the
 * existing hourly AI quota.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * B-KID-05: quota exhaustion is not "busy". A spent daily cap (ours, below) or
 * a provider quota of `limit: 0` will not clear in 15 seconds, so telling the
 * parent "try again in a moment" with `Retry-After: 15` invited a retry loop
 * against a door that stays shut until tomorrow. Exhaustion answers 429 with
 * this code and NO Retry-After; the client says "Hero drawing is resting today;
 * Sprout will star". Transient provider errors keep 503 + Retry-After.
 */
export const IMAGE_RESTING = "image_resting";
export const IMAGE_RESTING_BODY = Object.freeze({
  error: "Hero drawing is resting today",
  code: IMAGE_RESTING,
  retryable: false,
});

/** Provider-side quota exhaustion (as opposed to a transient overload). */
export const isImageQuotaExhausted = (err: unknown): boolean => {
  const e = err as { message?: unknown } | null;
  const msg = String((e && e.message) || err || "");
  if (/\blimit:?\s*0\b/i.test(msg)) return true;
  return /quota/i.test(msg) && /per[\s_-]?day|PerDay|daily/i.test(msg);
};

/** The one place an image-route failure becomes a status + body (route-tested). */
export const imageFailureResponse = (
  error: unknown,
  isTransient: (err: unknown) => boolean,
  fallback: string,
): { status: number; retryAfter?: string; body: Record<string, unknown> } => {
  if (isImageQuotaExhausted(error)) return { status: 429, body: { ...IMAGE_RESTING_BODY } };
  if (isTransient(error)) {
    return { status: 503, retryAfter: "15", body: { error: "Image creation is busy. Please try again in a moment.", retryable: true } };
  }
  return { status: 500, body: { error: fallback } };
};
const PER_USER_DAILY = Number(process.env.IMAGE_GEN_DAILY_LIMIT || 60);
const GLOBAL_DAILY = Number(process.env.IMAGE_GEN_GLOBAL_DAILY_LIMIT || 5000);

export const createImageQuota = (counters: UsageCounterStore): RequestHandler => async (req, res, next) => {
  const key = (req as any).user?.uid || req.ip || "anon";

  // Global circuit breaker first — a cheap backstop against distributed abuse.
  const global = await counters.increment("img_global_daily", "all", DAY_MS);
  if (global.count > GLOBAL_DAILY) {
    // B-KID-05: the global daily ceiling is spent until tomorrow — resting.
    res.status(429).json({ ...IMAGE_RESTING_BODY });
    return;
  }

  const { count, resetAt } = await counters.increment("img_user_daily", key, DAY_MS);
  res.setHeader("X-Image-Quota-Limit", String(PER_USER_DAILY));
  res.setHeader("X-Image-Quota-Remaining", String(Math.max(0, PER_USER_DAILY - count)));

  if (count > PER_USER_DAILY) {
    // B-KID-05: no Retry-After — the cap refreshes tomorrow (X-Image-Quota-Reset
    // carries the moment for any caller that wants it), never "in a moment".
    res.setHeader("X-Image-Quota-Reset", new Date(resetAt).toISOString());
    res.status(429).json({ ...IMAGE_RESTING_BODY });
    return;
  }
  next();
};
