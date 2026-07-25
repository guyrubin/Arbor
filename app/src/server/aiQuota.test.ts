import { describe, it, expect, vi, afterAll } from "vitest";
import { MemoryCounterStore } from "./quotaStore.js";

// Env hygiene: these suites tune limits via env + vi.resetModules; restore
// afterwards so other files in the same worker never see the tuned values.
const TUNED_ENV = ["AI_USER_HOURLY_LIMIT", "ENFORCE_ENTITLEMENTS", "FREE_COACH_MESSAGES_PER_DAY", "TTS_DAILY_CHAR_LIMIT"] as const;
const PRIOR_ENV = Object.fromEntries(TUNED_ENV.map((k) => [k, process.env[k]]));
afterAll(() => {
  for (const k of TUNED_ENV) {
    if (PRIOR_ENV[k] === undefined) delete process.env[k];
    else process.env[k] = PRIOR_ENV[k];
  }
  vi.resetModules();
});

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

/**
 * AIR-7 — createCoachGate: ONE combined middleware for /chat + /council that
 * runs the hourly-quota increment and the entitlement lookup CONCURRENTLY,
 * with headers and 429/402 payloads byte-identical to the old serial
 * aiQuota → coachMeter pair.
 */
describe("combined coach gate (AIR-7)", () => {
  async function loadCoachGate(env: Record<string, string>) {
    for (const [k, v] of Object.entries(env)) process.env[k] = v;
    vi.resetModules();
    return (await import("./aiQuota.js")).createCoachGate;
  }

  const freeStore = { getPlan: async () => null, setPlan: async () => {} } as any;
  const plusStore = { getPlan: async () => "plus" as const, setPlan: async () => {} } as any;

  async function callGate(mw: any, uid: string) {
    const res = makeRes();
    let passed = false;
    await mw({ user: { uid } } as any, res as any, () => { passed = true; });
    return { res, passed };
  }

  it("sets BOTH header families and passes a free user within budget", async () => {
    const createCoachGate = await loadCoachGate({
      AI_USER_HOURLY_LIMIT: "10",
      ENFORCE_ENTITLEMENTS: "true",
      FREE_COACH_MESSAGES_PER_DAY: "5",
    });
    const { res, passed } = await callGate(createCoachGate(new MemoryCounterStore(), freeStore), "gate-user");
    expect(passed).toBe(true);
    expect(res.headers["X-AI-Quota-Limit"]).toBe("10");
    expect(res.headers["X-AI-Quota-Remaining"]).toBe("9");
    expect(res.headers["X-Coach-Limit"]).toBe("5");
    expect(res.headers["X-Coach-Remaining"]).toBe("4");
  });

  it("responds 402 with the upgrade payload when the free coach meter is exhausted", async () => {
    const createCoachGate = await loadCoachGate({
      AI_USER_HOURLY_LIMIT: "50",
      ENFORCE_ENTITLEMENTS: "true",
      FREE_COACH_MESSAGES_PER_DAY: "2",
    });
    const mw = createCoachGate(new MemoryCounterStore(), freeStore);
    expect((await callGate(mw, "meter-user")).passed).toBe(true);
    expect((await callGate(mw, "meter-user")).passed).toBe(true);
    const blocked = await callGate(mw, "meter-user");
    expect(blocked.passed).toBe(false);
    expect(blocked.res.statusCode).toBe(402);
    expect(blocked.res.body?.upgrade?.plan).toBe("plus");
  });

  it("responds 429 when the hourly quota is exhausted (quota outranks the meter)", async () => {
    const createCoachGate = await loadCoachGate({
      AI_USER_HOURLY_LIMIT: "1",
      ENFORCE_ENTITLEMENTS: "true",
      FREE_COACH_MESSAGES_PER_DAY: "5",
    });
    const mw = createCoachGate(new MemoryCounterStore(), freeStore);
    expect((await callGate(mw, "q-user")).passed).toBe(true);
    const blocked = await callGate(mw, "q-user");
    expect(blocked.passed).toBe(false);
    expect(blocked.res.statusCode).toBe(429);
    expect(blocked.res.body?.error).toMatch(/AI usage limit/i);
  });

  it("plus plans skip the coach meter entirely (no X-Coach headers)", async () => {
    const createCoachGate = await loadCoachGate({
      AI_USER_HOURLY_LIMIT: "10",
      ENFORCE_ENTITLEMENTS: "true",
    });
    const { res, passed } = await callGate(createCoachGate(new MemoryCounterStore(), plusStore), "plus-user");
    expect(passed).toBe(true);
    expect(res.headers["X-Coach-Limit"]).toBeUndefined();
    expect(res.headers["X-AI-Quota-Limit"]).toBe("10");
  });
});

/**
 * AIR-6 — createTtsQuota: /api/tts is char-metered per day, never
 * model-call-metered. A 10-minute continuous voice session (~60 spoken
 * sentences) must never 429, and spoken sentences must leave the hourly
 * X-AI-Quota headers untouched.
 */
describe("TTS character meter (AIR-6)", () => {
  async function loadTtsQuota(limitChars: string) {
    process.env.TTS_DAILY_CHAR_LIMIT = limitChars;
    vi.resetModules();
    return (await import("./aiQuota.js")).createTtsQuota;
  }

  async function callTts(mw: any, uid: string, text: string) {
    const res = makeRes();
    let passed = false;
    await mw({ user: { uid }, body: { text } } as any, res as any, () => { passed = true; });
    return { res, passed };
  }

  it("a 10-minute continuous voice session never 429s", async () => {
    const createTtsQuota = await loadTtsQuota("150000");
    const mw = createTtsQuota(new MemoryCounterStore());
    // ~10 min of speech ≈ 60 sentences × ~125 chars ≈ 7.5k chars.
    const sentence = "Try naming the feeling before the request, then wait a moment together. ".repeat(2).slice(0, 125);
    for (let i = 0; i < 60; i += 1) {
      const { passed } = await callTts(mw, "voice-parent", sentence);
      expect(passed, `sentence ${i + 1} must pass`).toBe(true);
    }
  });

  it("never touches the hourly AI quota headers", async () => {
    const createTtsQuota = await loadTtsQuota("150000");
    const { res } = await callTts(createTtsQuota(new MemoryCounterStore()), "voice-parent", "Hello there.");
    expect(res.headers["X-AI-Quota-Limit"]).toBeUndefined();
    expect(res.headers["X-AI-Quota-Remaining"]).toBeUndefined();
    expect(res.headers["X-TTS-Quota-Limit"]).toBe("150000");
  });

  it("meters by characters and 429s calmly past the daily cap", async () => {
    const createTtsQuota = await loadTtsQuota("100");
    const mw = createTtsQuota(new MemoryCounterStore());
    expect((await callTts(mw, "capped", "a".repeat(60))).passed).toBe(true);
    // The call that pushes past the cap is rejected (same posture as the hourly quota).
    const blocked = await callTts(mw, "capped", "a".repeat(60));
    expect(blocked.passed).toBe(false);
    expect(blocked.res.statusCode).toBe(429);
    // Calm parent register — no jargon, promises the standard-voice fallback.
    expect(blocked.res.body?.details).toMatch(/standard voice/i);
    expect(blocked.res.headers["Retry-After"]).toBeTruthy();
  });

  it("clips metering to the synthesis cap so one giant body cannot nuke the day", async () => {
    const createTtsQuota = await loadTtsQuota("10000");
    const mw = createTtsQuota(new MemoryCounterStore());
    await callTts(mw, "clip-user", "a".repeat(50_000)); // clipped to 4000
    const { res } = await callTts(mw, "clip-user", "hi");
    expect(Number(res.headers["X-TTS-Quota-Remaining"])).toBe(10000 - 4000 - 2);
  });
});
