import type { RequestHandler } from "express";
import type { UsageCounterStore } from "./quotaStore.js";

/**
 * Per-user hourly cap on AI-generating endpoints. Guards against runaway cost
 * (looping clients, abuse) on top of the IP rate-limit. Keyed by the verified
 * Firebase uid when present, else the request IP. Counters live in the shared
 * UsageCounterStore (Firestore in prod), so the cap holds across Cloud Run
 * instances (COST-1).
 */
const WINDOW_MS = 60 * 60 * 1000;
const LIMIT = Number(process.env.AI_USER_HOURLY_LIMIT || 80);

export const createAiQuota = (counters: UsageCounterStore): RequestHandler => async (req, res, next) => {
  const key = (req as any).user?.uid || req.ip || "anon";
  const { count, resetAt } = await counters.increment("ai_hourly", key, WINDOW_MS);

  res.setHeader("X-AI-Quota-Limit", String(LIMIT));
  res.setHeader("X-AI-Quota-Remaining", String(Math.max(0, LIMIT - count)));

  if (count > LIMIT) {
    const retrySec = Math.ceil((resetAt - Date.now()) / 1000);
    res.setHeader("Retry-After", String(retrySec));
    res.status(429).json({
      error: "AI usage limit reached",
      details: `You've reached the hourly AI limit (${LIMIT} requests). Please try again in about ${Math.ceil(retrySec / 60)} minutes.`,
    });
    return;
  }
  next();
};
