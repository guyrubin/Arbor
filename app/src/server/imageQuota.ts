import type { RequestHandler } from "express";
import type { UsageCounterStore } from "./quotaStore.js";
import { entitlementsEnforced, resolveEntitlement, type EntitlementStore, type Plan } from "./entitlements.js";

/**
 * S2 — per-user DAILY cap + global circuit breaker on the image-generation
 * endpoints (`/generate-avatar`, `/generate-scene`, `/generate-comic`).
 * B-KID-119 replaced the flat 60/day with the per-plan IMAGE_ALLOWANCE below
 * (day + 30-day windows, a separate hero bucket, refund on failure, breaker 300).
 *
 * Image generation (Gemini 2.5 Flash Image) is a separate, pricier SKU than
 * text, and these endpoints previously had NO quota of any kind — a free/anon
 * caller could loop them and run up unbounded cost. This adds:
 *  - a per-user allowance per plan (IMAGE_ALLOWANCE), keyed by the verified
 *    Firebase uid (else request IP), and
 *  - a global daily circuit breaker (IMAGE_GEN_GLOBAL_DAILY_LIMIT, default
 *    300) so even distributed abuse can't exceed a known daily ceiling.
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
/**
 * B-KID-119 (Guy, 5 Oct): the image allowance follows the PLAN, in ONE table.
 * Free families get the built-in art only (0 scene/comic images); a hero is a
 * separate one-time bucket per rolling 30 days so creating it never eats the
 * story allowance and cannot be farmed. Signed-out callers get nothing. Every
 * number is env-overridable (IMAGE_<PLAN>_PER_DAY / _PER_MONTH / _HERO_PER_30D).
 * "Month" = a fixed 30-day window of the shared UsageCounterStore (the store
 * only does fixed windows, so this is not a calendar month).
 */
export type ImageAllowancePlan = Plan | "signed_out";
export type ImageAllowance = { perDay: number; perMonth: number; heroPer30Days: number };
const envNum = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return process.env[name] !== undefined && Number.isFinite(v) && v >= 0 ? v : fallback;
};
const allowance = (plan: string, perDay: number, perMonth: number, heroPer30Days: number): ImageAllowance => ({
  perDay: envNum(`IMAGE_${plan}_PER_DAY`, perDay),
  perMonth: envNum(`IMAGE_${plan}_PER_MONTH`, perMonth),
  heroPer30Days: envNum(`IMAGE_${plan}_HERO_PER_30D`, heroPer30Days),
});
export const IMAGE_ALLOWANCE: Record<ImageAllowancePlan, ImageAllowance> = {
  signed_out: { perDay: 0, perMonth: 0, heroPer30Days: 0 },
  free: allowance("FREE", 0, 0, 2),
  plus: allowance("PLUS", 3, 30, 4),
  family: allowance("FAMILY", 5, 50, 6),
};
/** Global circuit breaker (all users, all three routes), attempts per day. */
export const IMAGE_GLOBAL_DAILY = envNum("IMAGE_GEN_GLOBAL_DAILY_LIMIT", 300);
const MONTH_MS = 30 * DAY_MS;
export const IMAGE_COUNTERS = { day: "img_user_daily", month: "img_user_30d", hero: "img_hero_30d", global: "img_global_daily" } as const;

/** The plan an image request is charged to. Entitlement read failure → free
 *  (cost-safe, never unlimited); an active trial counts as its plan (the
 *  shared `resolveEntitlement` keeps in_trial records). */
export const imagePlanFor = async (req: unknown, store: EntitlementStore | undefined): Promise<ImageAllowancePlan> => {
  const user = (req as { user?: { uid?: string; email?: string | null } }).user;
  if (!user?.uid && entitlementsEnforced()) return "signed_out";
  if (!store) return "free";
  try {
    const e = await resolveEntitlement(store, { uid: user?.uid || "local-sandbox", email: user?.email || null });
    return e.plan;
  } catch {
    return "free";
  }
};

/**
 * Reserve-then-refund: the middleware counts the request BEFORE the provider
 * call (so parallel calls cannot overrun), and gives the user/day, month and
 * hero units back when the response ends in a non-2xx (provider failure,
 * deadline, moderation, no image) — only delivered images are charged. The
 * global breaker is NOT refunded: it bounds provider attempts, i.e. cost.
 */
export const createImageQuota = (counters: UsageCounterStore, entitlements?: EntitlementStore): RequestHandler => async (req, res, next) => {
  const plan = await imagePlanFor(req, entitlements);
  const a = IMAGE_ALLOWANCE[plan];
  const key = (req as any).user?.uid || req.ip || "anon";
  const isHero = /generate-avatar/.test(`${req.baseUrl || ""}${req.path || ""}${req.originalUrl || ""}`);
  const resting = (window: "day" | "month", resetAt: number) => {
    // B-KID-05: no Retry-After — the allowance does not refresh "in a moment".
    res.setHeader("X-Image-Quota-Reset", new Date(resetAt).toISOString());
    res.status(429).json({ ...IMAGE_RESTING_BODY, window });
  };
  const nextReset = (windowMs: number) => { const now = Date.now(); return now - (now % windowMs) + windowMs; };

  // A zero allowance is refused before any counter or the provider is touched.
  if (isHero ? a.heroPer30Days === 0 : a.perMonth === 0 || a.perDay === 0) {
    res.setHeader("X-Image-Quota-Limit", "0");
    res.setHeader("X-Image-Quota-Remaining", "0");
    const window = isHero || a.perMonth === 0 ? "month" : "day";
    resting(window, nextReset(window === "month" ? MONTH_MS : DAY_MS));
    return;
  }

  // Global circuit breaker — a cheap backstop against distributed abuse.
  const global = await counters.increment(IMAGE_COUNTERS.global, "all", DAY_MS);
  if (global.count > IMAGE_GLOBAL_DAILY) { resting("day", global.resetAt); return; }

  const reserved: { name: string; windowMs: number }[] = [];
  const release = async () => { for (const r of reserved.splice(0)) await counters.add(r.name, key, -1, r.windowMs); };

  if (isHero) {
    const hero = await counters.increment(IMAGE_COUNTERS.hero, key, MONTH_MS, { limit: a.heroPer30Days });
    reserved.push({ name: IMAGE_COUNTERS.hero, windowMs: MONTH_MS });
    res.setHeader("X-Image-Quota-Limit", String(a.heroPer30Days));
    res.setHeader("X-Image-Quota-Remaining", String(Math.max(0, a.heroPer30Days - hero.count)));
    if (hero.count > a.heroPer30Days) { await release(); resting("month", hero.resetAt); return; }
  } else {
    const day = await counters.increment(IMAGE_COUNTERS.day, key, DAY_MS, { limit: a.perDay });
    reserved.push({ name: IMAGE_COUNTERS.day, windowMs: DAY_MS });
    res.setHeader("X-Image-Quota-Limit", String(a.perDay));
    res.setHeader("X-Image-Quota-Remaining", String(Math.max(0, a.perDay - day.count)));
    if (day.count > a.perDay) { await release(); resting("day", day.resetAt); return; }
    const month = await counters.increment(IMAGE_COUNTERS.month, key, MONTH_MS, { limit: a.perMonth });
    reserved.push({ name: IMAGE_COUNTERS.month, windowMs: MONTH_MS });
    res.setHeader("X-Image-Quota-Month-Limit", String(a.perMonth));
    res.setHeader("X-Image-Quota-Month-Remaining", String(Math.max(0, a.perMonth - month.count)));
    res.setHeader("X-Image-Quota-Month-Reset", new Date(month.resetAt).toISOString());
    if (month.count > a.perMonth) { await release(); resting("month", month.resetAt); return; }
  }

  // Delivered images only: a failed response gives the reservation back.
  if (typeof (res as any).on === "function") {
    res.on("finish", () => {
      if (res.statusCode < 200 || res.statusCode >= 300) void release().catch(() => { /* fail open, like the store */ });
    });
  }
  next();
};
