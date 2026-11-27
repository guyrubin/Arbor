import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryCounterStore, QuotaStoreUnavailableError, QUOTA_UNAVAILABLE_BODY, isQuotaStoreUnavailable, sendQuotaUnavailable } from "./quotaStore.js";

/**
 * AIR-7 mock state: the fake Firestore counts round-trips so the tests can
 * pin "one write, no read" on the fast path. Module-scoped because vi.mock
 * factories are hoisted above describe blocks.
 */
let serverCount = 0;
let setCalls = 0;
let getCalls = 0;
/** B-AIOPS-01: make the fake datastore throw on write / read. */
let failSet = false;
let failGet = false;

vi.mock("firebase-admin/app", () => ({
  getApps: () => [{}],
  initializeApp: vi.fn(),
  applicationDefault: vi.fn(),
}));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    increment: (n: number) => ({ __increment: n }),
    serverTimestamp: () => ({ __ts: true }),
  },
  getFirestore: () => ({
    collection: () => ({
      doc: () => ({
        set: async (data: any) => {
          setCalls += 1;
          if (failSet) throw new Error("synthetic firestore outage");
          serverCount += Number(data?.count?.__increment ?? 0);
        },
        get: async () => {
          getCalls += 1;
          if (failGet) throw new Error("synthetic firestore outage");
          return { data: () => ({ count: serverCount }) };
        },
      }),
    }),
  }),
}));

describe("usage counter store (COST-1)", () => {
  it("increments per key within a window", async () => {
    const store = new MemoryCounterStore();
    await store.increment("ai_hourly", "user-a", 60_000);
    const second = await store.increment("ai_hourly", "user-a", 60_000);
    const other = await store.increment("ai_hourly", "user-b", 60_000);
    expect(second.count).toBe(2);
    expect(other.count).toBe(1);
  });

  it("keeps separate counters per name (hourly quota vs coach meter)", async () => {
    const store = new MemoryCounterStore();
    await store.increment("ai_hourly", "user-a", 60_000);
    const coach = await store.increment("coach_daily", "user-a", 60_000);
    expect(coach.count).toBe(1);
  });

  it("peek reads without incrementing", async () => {
    const store = new MemoryCounterStore();
    await store.increment("coach_daily", "user-a", 60_000);
    const peeked = await store.peek("coach_daily", "user-a", 60_000);
    expect(peeked.count).toBe(1);
    const peekedEmpty = await store.peek("coach_daily", "nobody", 60_000);
    expect(peekedEmpty.count).toBe(0);
  });

  // AIR-6: amount-based meters (character-metered TTS cap).
  it("add() accumulates amounts on the same window semantics", async () => {
    const store = new MemoryCounterStore();
    await store.add("tts_chars_daily", "user-a", 120, 60_000);
    const after = await store.add("tts_chars_daily", "user-a", 80, 60_000);
    expect(after.count).toBe(200);
    expect((await store.peek("tts_chars_daily", "user-a", 60_000)).count).toBe(200);
  });
});

/**
 * AIR-7: the Firestore store used to pay TWO round-trips (set THEN get) on
 * EVERY increment — dead pre-model latency on every /chat. With a declared
 * limit it now trusts FieldValue.increment + a local estimate far from the
 * limit (ONE round-trip) and re-reads the authoritative count only near the
 * limit, so enforcement stays exact where it matters.
 */
describe("FirestoreCounterStore single-round-trip fast path (AIR-7)", () => {
  beforeEach(() => {
    serverCount = 0;
    setCalls = 0;
    getCalls = 0;
    failSet = false;
    failGet = false;
  });

  const makeStore = async () => {
    const { FirestoreCounterStore } = await import("./quotaStore.js");
    return new FirestoreCounterStore({ firestoreDatabaseId: "(default)" } as any);
  };

  it("far from the limit: one write, no read after the baseline sync", async () => {
    const store = await makeStore();
    // First increment establishes the baseline (1 write + 1 read).
    const first = await store.increment("ai_hourly", "u1", 60_000, { limit: 80 });
    expect(first.count).toBe(1);
    expect(setCalls).toBe(1);
    expect(getCalls).toBe(1);

    // Next increments ride the estimate: writes accrue, reads DON'T.
    const second = await store.increment("ai_hourly", "u1", 60_000, { limit: 80 });
    const third = await store.increment("ai_hourly", "u1", 60_000, { limit: 80 });
    expect(second.count).toBe(2);
    expect(third.count).toBe(3);
    expect(setCalls).toBe(3);
    expect(getCalls).toBe(1);
  });

  it("near the limit (>=80%): every call reads the authoritative count", async () => {
    const store = await makeStore();
    const limit = 5;
    let last = { count: 0, resetAt: 0 };
    for (let i = 0; i < 6; i += 1) {
      last = await store.increment("ai_hourly", "u2", 60_000, { limit });
    }
    // Enforcement stays exact at the boundary — the 6th call sees count 6 > 5.
    expect(last.count).toBe(6);
    expect(getCalls).toBeGreaterThanOrEqual(2);
  });

  it("without a declared limit the count stays exact (write + read every call)", async () => {
    const store = await makeStore();
    await store.increment("coach_daily", "u3", 60_000);
    const second = await store.increment("coach_daily", "u3", 60_000);
    expect(second.count).toBe(2);
    expect(setCalls).toBe(2);
    expect(getCalls).toBe(2);
  });

  it("add() rides the same fast path for amount meters", async () => {
    const store = await makeStore();
    await store.add("tts_chars_daily", "u4", 100, 60_000, { limit: 150_000 });
    const after = await store.add("tts_chars_daily", "u4", 50, 60_000, { limit: 150_000 });
    expect(after.count).toBe(150);
    expect(getCalls).toBe(1); // only the baseline sync read
  });
});

/**
 * B-AIOPS-01: a datastore error is NOT "zero usage". The store used to answer
 * `{ count: 0 }` on any Firestore failure (logged "failing open"), so every cap
 * granted spare capacity it could not prove. It now throws a typed error.
 */
describe("FirestoreCounterStore fails closed on a datastore error (B-AIOPS-01)", () => {
  beforeEach(() => {
    serverCount = 0;
    setCalls = 0;
    getCalls = 0;
    failSet = false;
    failGet = false;
  });

  const makeStore = async () => {
    const { FirestoreCounterStore } = await import("./quotaStore.js");
    return new FirestoreCounterStore({ firestoreDatabaseId: "(default)" } as any);
  };

  it("increment: a failed write throws QuotaStoreUnavailableError, never count 0", async () => {
    const store = await makeStore();
    failSet = true;
    await expect(store.increment("ai_hourly", "u1", 60_000, { limit: 80 })).rejects.toBeInstanceOf(QuotaStoreUnavailableError);
    await expect(store.add("tts_chars_daily", "u1", 10, 60_000)).rejects.toBeInstanceOf(QuotaStoreUnavailableError);
  });

  it("increment: a failed authoritative read throws too", async () => {
    const store = await makeStore();
    failGet = true;
    const err = await store.increment("img_user_daily", "u2", 60_000).catch((e) => e);
    expect(isQuotaStoreUnavailable(err)).toBe(true);
    expect(err.counter).toBe("img_user_daily");
  });

  it("peek: a failed read throws instead of reporting 0 used", async () => {
    const store = await makeStore();
    failGet = true;
    await expect(store.peek("coach_daily", "u3", 60_000)).rejects.toBeInstanceOf(QuotaStoreUnavailableError);
  });

  it("normal path unchanged once the store recovers", async () => {
    const store = await makeStore();
    failSet = true;
    await store.increment("ai_hourly", "u4", 60_000).catch(() => undefined);
    failSet = false;
    const ok = await store.increment("ai_hourly", "u4", 60_000);
    expect(ok.count).toBe(1);
    expect((await store.peek("ai_hourly", "u4", 60_000)).count).toBe(1);
  });

  it("sendQuotaUnavailable answers a calm retryable 503 with Retry-After", () => {
    const headers: Record<string, string> = {};
    let status = 0;
    let body: unknown;
    sendQuotaUnavailable({ setHeader: (k, v) => { headers[k] = v; }, status: (c) => { status = c; return { json: (b) => { body = b; } }; } });
    expect(status).toBe(503);
    expect(headers["Retry-After"]).toBe("15");
    expect(body).toEqual({ error: "quota_unavailable", code: "quota_unavailable", retryable: true });
    expect(QUOTA_UNAVAILABLE_BODY.retryable).toBe(true);
  });

  it("MemoryCounterStore is unchanged (never throws for a normal call)", async () => {
    const store = new MemoryCounterStore();
    expect((await store.peek("x", "k", 60_000)).count).toBe(0);
    expect((await store.increment("x", "k", 60_000)).count).toBe(1);
  });
});
