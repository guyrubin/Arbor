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
const PER_USER_DAILY = Number(process.env.IMAGE_GEN_DAILY_LIMIT || 60);
const GLOBAL_DAILY = Number(process.env.IMAGE_GEN_GLOBAL_DAILY_LIMIT || 5000);

export const createImageQuota = (counters: UsageCounterStore): RequestHandler => async (req, res, next) => {
  const key = (req as any).user?.uid || req.ip || "anon";

  // Global circuit breaker first — a cheap backstop against distributed abuse.
  const global = await counters.increment("img_global_daily", "all", DAY_MS);
  if (global.count > GLOBAL_DAILY) {
    res.status(503).json({
      error: "Image generation is busy",
      details: "Arbor is creating a lot of art right now. Please try again later.",
    });
    return;
  }

  const { count, resetAt } = await counters.increment("img_user_daily", key, DAY_MS);
  res.setHeader("X-Image-Quota-Limit", String(PER_USER_DAILY));
  res.setHeader("X-Image-Quota-Remaining", String(Math.max(0, PER_USER_DAILY - count)));

  if (count > PER_USER_DAILY) {
    const retrySec = Math.ceil((resetAt - Date.now()) / 1000);
    res.setHeader("Retry-After", String(retrySec));
    res.status(429).json({
      error: "Daily image limit reached",
      details: `You've reached today's image-creation limit (${PER_USER_DAILY}). It refreshes tomorrow.`,
    });
    return;
  }
  next();
};
