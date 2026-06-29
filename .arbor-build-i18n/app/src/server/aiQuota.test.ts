import { describe, it, expect, vi } from "vitest";
import { MemoryCounterStore } from "./quotaStore.js";

/**
 * A1/A2 (CIL-bugs-imagegen-quota-missing + CIL-bugs-generate-adventure-no-quota)
 *
 * Verifies that createAiQuota enforces a per-user hourly cap, covering the four
 * routes that were previously UNGATED:
 *   /voice, /extract-log, /generate-adventure, /generate-hero-journey
 *
 * The middleware is the same primitive for all generative routes; the test
 * exercises it directly (unit) so we don't need a full Express integration.
 */

async function loadAiQuota(limit: string) {
  process.env.AI_USER_HOURLY_LIMIT = limit;
  vi.resetModules();
  return (await import("./aiQuota.js")).createAiQuota;
}

/** Minimal Express res double that captures status + body + headers. */
function makeRes() {
  const res: any = {
    statusCode: 0,
    body: undefined as any,
    headers: {} as Record<string, string>,
    setHeader(k: string, v: string) { this.headers[k] = v; },
    status(code: number) { this.statusCode = code; return this; },
    json(payload: any) { this.body = payload; return this; },
  };
  return res;
}

/** Simulate a single authenticated request through the quota middleware. */
async function callQuota(mw: ReturnType<Awaited<ReturnType<typeof loadAiQuota>>>, uid: string) {
  const res = makeRes();
  let passed = false;
  await mw({ user: { uid } } as any, res as any, () => { passed = true; });
  return { res, passed };
}

describe("AI quota middleware (A1/A2) — previously-ungated generative routes", () => {
  it("allows requests within the hourly budget and passes next()", async () => {
    const createAiQuota = await loadAiQuota("5");
    const counters = new MemoryCounterStore();
    const mw = createAiQuota(counters);

    // Five calls should all pass (budget = 5).
    for (let i = 0; i < 5; i++) {
      const { passed } = await callQuota(mw, "user-adventure");
      expect(passed, `call ${i + 1} should pass`).toBe(true);
    }
  });

  it("blocks with 429 when a user exceeds the hourly budget", async () => {
    const createAiQuota = await loadAiQuota("2");
    const counters = new MemoryCounterStore();
    const mw = createAiQuota(counters);

    // Two calls pass, third is blocked — this simulates what happens on
    // /generate-adventure, /generate-hero-journey, /voice, /extract-log now
    // that they are on the allow-list in createApp.ts.
    expect((await callQuota(mw, "u-gen")).passed).toBe(true);
    expect((await callQuota(mw, "u-gen")).passed).toBe(true);

    const blocked = await callQuota(mw, "u-gen");
    expect(blocked.passed).toBe(false);
    expect(blocked.res.statusCode).toBe(429);
    expect(blocked.res.body?.error).toMatch(/AI usage limit/i);
    expect(blocked.res.headers["Retry-After"]).toBeTruthy();
  });

  it("caps each user independently — one user over budget does not block another", async () => {
    const createAiQuota = await loadAiQuota("1");
    const counters = new MemoryCounterStore();
    const mw = createAiQuota(counters);

    // user-a exhausts budget.
    expect((await callQuota(mw, "user-a")).passed).toBe(true);
    expect((await callQuota(mw, "user-a")).passed).toBe(false);

    // user-b is completely unaffected.
    expect((await callQuota(mw, "user-b")).passed).toBe(true);
  });

  it("sets quota headers on every response (within budget and over)", async () => {
    const createAiQuota = await loadAiQuota("3");
    const counters = new MemoryCounterStore();
    const mw = createAiQuota(counters);

    const { res: withinBudget } = await callQuota(mw, "hdr-user");
    expect(withinBudget.headers["X-AI-Quota-Limit"]).toBe("3");
    expect(withinBudget.headers["X-AI-Quota-Remaining"]).toBe("2");

    // Exhaust the limit.
    await callQuota(mw, "hdr-user");
    await callQuota(mw, "hdr-user");
    const { res: overBudget } = await callQuota(mw, "hdr-user");
    expect(overBudget.headers["X-AI-Quota-Remaining"]).toBe("0");
  });

  it("falls back to request IP when no authenticated uid is present", async () => {
    const createAiQuota = await loadAiQuota("1");
    const counters = new MemoryCounterStore();
    const mw = createAiQuota(counters);

    // No user object — simulates an unauthenticated call reaching the middleware.
    const anon = async (ip: string) => {
      const res = makeRes();
      let passed = false;
      await mw({ ip } as any, res as any, () => { passed = true; });
      return { res, passed };
    };

    expect((await anon("1.2.3.4")).passed).toBe(true);
    expect((await anon("1.2.3.4")).passed).toBe(false); // same IP, capped
    expect((await anon("5.6.7.8")).passed).toBe(true);  // different IP, independent
  });
});
