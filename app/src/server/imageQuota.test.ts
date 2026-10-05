import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryCounterStore } from "./quotaStore.js";
import type { EntitlementStore, Plan } from "./entitlements.js";

/** Re-import the middleware with a fresh module registry so the env-derived
 *  allowance table is re-read per test. */
async function load(env: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  vi.resetModules();
  return await import("./imageQuota.js");
}

/** Minimal Express res double: status + body + headers + a `finish` hook. */
function makeRes() {
  const listeners: Record<string, (() => void)[]> = {};
  const res: any = {
    statusCode: 200,
    body: undefined as any,
    headers: {} as Record<string, string>,
    setHeader(k: string, v: string) { this.headers[k] = v; },
    status(code: number) { this.statusCode = code; return this; },
    json(payload: any) { this.body = payload; return this; },
    on(ev: string, fn: () => void) { (listeners[ev] ||= []).push(fn); return this; },
    end(code: number) { this.statusCode = code; for (const fn of listeners.finish || []) fn(); },
  };
  return res;
}

const storeFor = (plans: Record<string, Plan | "throw">, status: "active" | "in_trial" = "active"): EntitlementStore => ({
  async getPlan(uid) { const p = plans[uid]; if (p === "throw") throw new Error("firestore down"); return p ?? null; },
  async getRecord(uid) { const p = plans[uid]; if (p === "throw") throw new Error("firestore down"); return p ? { plan: p, status } : null; },
});

const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

async function call(mw: any, uid: string | null, route = "/api/generate-scene") {
  const res = makeRes();
  let passed = false;
  await mw({ user: uid ? { uid } : undefined, ip: "1.2.3.4", baseUrl: route, path: "/", originalUrl: route } as any, res, () => { passed = true; });
  return { res, passed };
}

const ENV_KEYS = ["ENFORCE_ENTITLEMENTS", "IMAGE_GEN_GLOBAL_DAILY_LIMIT", "IMAGE_PLUS_PER_DAY", "IMAGE_PLUS_PER_MONTH"];
beforeEach(() => { process.env.ENFORCE_ENTITLEMENTS = "true"; });
afterEach(() => { for (const k of ENV_KEYS) delete process.env[k]; vi.useRealTimers(); });

describe("B-KID-119: image allowance follows the plan", () => {
  it("one table, Guy's 5 Oct (2) numbers; breaker default 300/day", async () => {
    const { IMAGE_ALLOWANCE, IMAGE_GLOBAL_DAILY } = await load();
    expect(IMAGE_ALLOWANCE).toEqual({
      signed_out: { perDay: 0, perMonth: 0, heroPer30Days: 0 },
      free: { perDay: 0, perMonth: 0, heroPer30Days: 2 },
      plus: { perDay: 3, perMonth: 30, heroPer30Days: 4 },
      family: { perDay: 5, perMonth: 50, heroPer30Days: 6 },
    });
    expect(IMAGE_GLOBAL_DAILY).toBe(300);
  });

  it("env overrides one number without touching the rest", async () => {
    const { IMAGE_ALLOWANCE } = await load({ IMAGE_PLUS_PER_DAY: "7" });
    expect(IMAGE_ALLOWANCE.plus).toEqual({ perDay: 7, perMonth: 30, heroPer30Days: 4 });
  });

  it("free: zero scene images, refused before any counter or provider", async () => {
    const { createImageQuota } = await load();
    const counters = new MemoryCounterStore();
    const mw = createImageQuota(counters, storeFor({}));
    const r = await call(mw, "free-parent");
    expect(r.passed).toBe(false);
    expect(r.res.statusCode).toBe(429);
    expect(r.res.body).toMatchObject({ code: "image_resting", retryable: false, window: "month" });
    expect(r.res.headers["X-Image-Quota-Limit"]).toBe("0");
    expect(r.res.headers["X-Image-Quota-Reset"]).toMatch(/^\d{4}-/);
    expect(r.res.headers["Retry-After"]).toBeUndefined();
    expect((await counters.peek("img_global_daily", "all", 86400000)).count).toBe(0);
    expect((await call(mw, "free-parent", "/api/generate-comic")).passed).toBe(false);
  });

  it("signed-out callers get nothing when entitlements are enforced", async () => {
    const { createImageQuota } = await load();
    const mw = createImageQuota(new MemoryCounterStore(), storeFor({}));
    for (const route of ["/api/generate-scene", "/api/generate-avatar"]) {
      const r = await call(mw, null, route);
      expect(r.passed, route).toBe(false);
      expect(r.res.statusCode).toBe(429);
    }
  });

  it("plus: 3 per day, then 429 window=day with the reset header", async () => {
    const { createImageQuota } = await load();
    const mw = createImageQuota(new MemoryCounterStore(), storeFor({ p: "plus" }));
    for (let i = 0; i < 3; i++) expect((await call(mw, "p")).passed).toBe(true);
    const blocked = await call(mw, "p");
    expect(blocked.passed).toBe(false);
    expect(blocked.res.body).toMatchObject({ code: "image_resting", window: "day" });
    expect(blocked.res.headers["X-Image-Quota-Remaining"]).toBe("0");
    expect(blocked.res.headers["X-Image-Quota-Reset"]).toBeDefined();
  });

  it("family: 5 per day; an active trial counts as its plan", async () => {
    const { createImageQuota } = await load();
    const mw = createImageQuota(new MemoryCounterStore(), storeFor({ f: "family" }, "in_trial"));
    for (let i = 0; i < 5; i++) expect((await call(mw, "f")).passed).toBe(true);
    expect((await call(mw, "f")).passed).toBe(false);
  });

  it("the 30-day window caps across days (plus 30/month) with window=month", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Math.ceil(Date.now() / (30 * 86400000)) * 30 * 86400000 + 1000));
    const { createImageQuota } = await load();
    const mw = createImageQuota(new MemoryCounterStore(), storeFor({ p: "plus" }));
    let delivered = 0;
    for (let day = 0; day < 10; day++) {
      for (let i = 0; i < 4; i++) if ((await call(mw, "p")).passed) delivered++;
      vi.advanceTimersByTime(86400000); // a fresh day window, same 30-day window
    }
    expect(delivered).toBe(30); // 3/day × 10 days, the 4th each day refused
    const blocked = await call(mw, "p"); // day 11: the day allows it, the month does not
    expect(blocked.passed).toBe(false);
    expect(blocked.res.body.window).toBe("month");
    expect(blocked.res.headers["X-Image-Quota-Month-Remaining"]).toBe("0");
  });

  it("hero creation is its own bucket: free gets 2 per 30 days, it never eats the scene allowance", async () => {
    const { createImageQuota } = await load();
    const counters = new MemoryCounterStore();
    const mw = createImageQuota(counters, storeFor({ p: "plus" }));
    const free = createImageQuota(counters, storeFor({}));
    expect((await call(free, "kid", "/api/generate-avatar")).passed).toBe(true);
    expect((await call(free, "kid", "/api/generate-avatar")).passed).toBe(true);
    const third = await call(free, "kid", "/api/generate-avatar");
    expect(third.passed).toBe(false);
    expect(third.res.body.window).toBe("month");
    for (let i = 0; i < 4; i++) expect((await call(mw, "p", "/api/generate-avatar")).passed).toBe(true);
    expect((await call(mw, "p", "/api/generate-avatar")).passed).toBe(false);
    // the plus parent's 3 scenes today are untouched by 4 hero creations
    for (let i = 0; i < 3; i++) expect((await call(mw, "p")).passed).toBe(true);
  });

  it("counts delivered images only: a failed response refunds the reservation", async () => {
    const { createImageQuota } = await load();
    const counters = new MemoryCounterStore();
    const mw = createImageQuota(counters, storeFor({ p: "plus" }));
    for (let i = 0; i < 5; i++) {
      const r = await call(mw, "p");
      expect(r.passed).toBe(true);
      r.res.end(503); // provider failed / no image
      await settle();
    }
    expect((await counters.peek("img_user_daily", "p", 86400000)).count).toBe(0);
    expect((await counters.peek("img_user_30d", "p", 30 * 86400000)).count).toBe(0);
    const ok = await call(mw, "p");
    ok.res.end(200);
    await settle();
    expect((await counters.peek("img_user_daily", "p", 86400000)).count).toBe(1);
    // the breaker counts attempts (cost), never refunded
    expect((await counters.peek("img_global_daily", "all", 86400000)).count).toBe(6);
  });

  it("entitlement read failure applies the FREE numbers, never unlimited", async () => {
    const { createImageQuota, imagePlanFor } = await load();
    const store = storeFor({ broken: "throw" });
    expect(await imagePlanFor({ user: { uid: "broken" } }, store)).toBe("free");
    const mw = createImageQuota(new MemoryCounterStore(), store);
    expect((await call(mw, "broken")).passed).toBe(false);
    expect((await call(mw, "broken", "/api/generate-avatar")).passed).toBe(true);
  });

  it("the global breaker stops everyone at the ceiling", async () => {
    const { createImageQuota } = await load({ IMAGE_GEN_GLOBAL_DAILY_LIMIT: "2" });
    const mw = createImageQuota(new MemoryCounterStore(), storeFor({ a: "family", b: "family" }));
    expect((await call(mw, "a")).passed).toBe(true);
    expect((await call(mw, "b")).passed).toBe(true);
    const r = await call(mw, "a");
    expect(r.passed).toBe(false);
    expect(r.res.body.window).toBe("day");
  });
});

describe("B-KID-119: the client never fires a scene/comic call the plan cannot grant", () => {
  it("allowance 0 → generateScene/generateComic refuse locally (no fetch); a paid allowance still calls", async () => {
    vi.resetModules();
    const mod = await import("../lib/api.js");
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ dataUrl: "data:x" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    try {
      mod.noteImageAllowance({ perDay: 0, perMonth: 0 });
      await expect(mod.api.generateScene({ imagePrompt: "p" })).rejects.toSatisfy(mod.isImageResting);
      await expect(mod.api.generateComic({ theme: "t" })).rejects.toSatisfy(mod.isImageResting);
      expect(fetchSpy).not.toHaveBeenCalled();
      mod.noteImageAllowance({ perDay: 3, perMonth: 30 });
      await expect(mod.api.generateScene({ imagePrompt: "p" })).resolves.toEqual({ dataUrl: "data:x" });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
      mod.__resetImageAllowance();
    }
  });
  it("a resting refusal turns further scene calls off for the session", async () => {
    vi.resetModules();
    const mod = await import("../lib/api.js");
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ code: "image_resting", window: "month" }), { status: 429 }));
    vi.stubGlobal("fetch", fetchSpy);
    try {
      await expect(mod.api.generateScene({ imagePrompt: "p" })).rejects.toSatisfy(mod.isImageResting);
      await expect(mod.api.generateScene({ imagePrompt: "p" })).rejects.toSatisfy(mod.isImageResting);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
      mod.__resetImageAllowance();
    }
  });
  it("/entitlement carries the plan's allowance row", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../routes/api.ts", import.meta.url), "utf8");
    expect(src).toContain("imageAllowance: IMAGE_ALLOWANCE[entitlement.plan],");
  });
});
