import type { RequestHandler } from "express";

/**
 * Per-user hourly cap on AI-generating endpoints. Guards against runaway cost
 * (looping clients, abuse) on top of the IP rate-limit. Keyed by the verified
 * Firebase uid when present, else the request IP. In-memory per instance — a
 * pragmatic guardrail; move to Firestore/Redis for a hard global cap.
 */
const WINDOW_MS = 60 * 60 * 1000;
const LIMIT = Number(process.env.AI_USER_HOURLY_LIMIT || 80);

type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

export const aiQuota: RequestHandler = (req, res, next) => {
  const key = (req as any).user?.uid || req.ip || "anon";
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now > bucket.reset) {
    bucket = { count: 0, reset: now + WINDOW_MS };
    buckets.set(key, bucket);
  }
  bucket.count += 1;

  res.setHeader("X-AI-Quota-Limit", String(LIMIT));
  res.setHeader("X-AI-Quota-Remaining", String(Math.max(0, LIMIT - bucket.count)));

  if (bucket.count > LIMIT) {
    const retrySec = Math.ceil((bucket.reset - now) / 1000);
    res.setHeader("Retry-After", String(retrySec));
    res.status(429).json({
      error: "AI usage limit reached",
      details: `You've reached the hourly AI limit (${LIMIT} requests). Please try again in about ${Math.ceil(retrySec / 60)} minutes.`,
    });
    return;
  }
  next();
};
