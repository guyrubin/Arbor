/** B-AIOPS-02 — the shared-family daily Live allowance is a server-owned,
 * non-refundable, expiring reservation. These pin: overlapping mints cannot
 * exceed the allowance (serialized), free vs paid allowances, expiry settles
 * at full slice, renewal only while allowance remains, reconciliation can
 * never credit more than the unconsumed part of an expired reservation and
 * never on a client report alone, and an unminted token releases its slice. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemoryLiveBudgetStore, LIVE_RESTING, LIVE_SLICE_MAX_MS, LIVE_MIN_SLICE_MS, liveAllowanceMs, liveSliceMs,
  settleExpired, recordObserved, cancelUnminted, committedMs, emptyLiveBudgetDay, liveBudgetDay, liveBudgetDayEnd,
  VOICE_TURN_RESERVE_MS, settleTurnCharge, spokenMsForChars,
  type LiveReservation,
} from "./liveBudget.js";

const MIN = 60_000;
const T0 = Date.parse("2026-10-18T10:00:00Z");
const envKeys = ["LIVE_FREE_MINUTES_PER_DAY", "LIVE_PAID_MINUTES_PER_DAY", "LIVE_RESERVATION_MINUTES", "LIVE_RECONCILE_CREDIT"];
const saved = new Map<string, string | undefined>();
beforeEach(() => {
  for (const k of envKeys) { saved.set(k, process.env[k]); delete process.env[k]; }
  // The arithmetic in these blocks uses 5-minute slices; the 60-second
  // default is pinned in its own block below.
  process.env.LIVE_RESERVATION_MINUTES = "5";
  vi.useFakeTimers(); vi.setSystemTime(T0);
});
afterEach(() => {
  for (const k of envKeys) { const v = saved.get(k); if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  vi.useRealTimers();
});

const reservation = (over: Partial<LiveReservation> = {}): LiveReservation => ({
  id: "r1", uid: "parent-a", ms: 5 * MIN, startedAt: T0, expiresAt: T0 + 5 * MIN,
  observedMs: 0, incomplete: false, closed: false, settledMs: null, ...over,
});

describe("accepted allowances", () => {
  it("Free 3 minutes, Plus and Family 20 minutes per family-day; slices never exceed 5 minutes", () => {
    expect(liveAllowanceMs("free")).toBe(3 * MIN);
    expect(liveAllowanceMs("plus")).toBe(20 * MIN);
    expect(liveAllowanceMs("family")).toBe(20 * MIN);
    process.env.LIVE_RESERVATION_MINUTES = "30";
    expect(liveSliceMs()).toBe(LIVE_SLICE_MAX_MS);
    expect(liveBudgetDay(T0)).toBe("2026-10-18");
    expect(liveBudgetDayEnd("2026-10-18")).toBe(Date.parse("2026-10-19T00:00:00Z"));
  });
});

describe("overlapping mints serialize on the family-day document", () => {
  it("two parents on two devices at the same instant cannot exceed the Free allowance", async () => {
    const store = new MemoryLiveBudgetStore();
    // 3 min allowance: the first mint takes 3 min (slice capped by remainder); the second is refused.
    const [a, b] = await Promise.all([
      store.reserve({ familyId: "fam", plan: "free", uid: "parent-a" }),
      store.reserve({ familyId: "fam", plan: "free", uid: "parent-b" }),
    ]);
    const results = [a, b];
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const ok = results.find((r) => r.ok)!;
    const refused = results.find((r) => !r.ok)!;
    expect(ok.ok && ok.reservation.ms).toBe(3 * MIN);
    expect(refused.ok === false && refused.code).toBe(LIVE_RESTING);
    expect(refused.ok === false && refused.remainingMs).toBe(0);
    expect((await store.peek("fam", "free")).remainingMs).toBe(0);
  });

  it("paid: ten simultaneous mints yield exactly four 5-minute slices and six refusals", async () => {
    const store = new MemoryLiveBudgetStore();
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) =>
      store.reserve({ familyId: "fam", plan: "plus", uid: `parent-${i % 2}` })));
    const granted = results.filter((r) => r.ok);
    expect(granted).toHaveLength(4);
    expect(granted.reduce((s, r) => s + (r.ok ? r.reservation.ms : 0), 0)).toBe(20 * MIN);
    expect(results.filter((r) => !r.ok)).toHaveLength(6);
  });

  it("families are independent; another family's spend never touches ours", async () => {
    const store = new MemoryLiveBudgetStore();
    await store.reserve({ familyId: "fam-a", plan: "free", uid: "a" });
    const other = await store.reserve({ familyId: "fam-b", plan: "free", uid: "b" });
    expect(other.ok).toBe(true);
  });
});

describe("expiry and renewal", () => {
  it("an expired reservation is charged in full by default, with no client report at all", () => {
    const doc = { ...emptyLiveBudgetDay("fam", "2026-10-18"), reservations: { r1: reservation() } };
    expect(committedMs(doc)).toBe(5 * MIN);
    const before = settleExpired(doc, T0 + 4 * MIN);
    expect(before.consumedMs).toBe(0);
    const after = settleExpired(doc, T0 + 5 * MIN);
    expect(after.consumedMs).toBe(5 * MIN);
    expect(after.reservations.r1.settledMs).toBe(5 * MIN);
    // Settling is idempotent across later reads.
    expect(settleExpired(after, T0 + 9 * MIN).consumedMs).toBe(5 * MIN);
  });

  it("renewal reserves the next slice only while allowance remains, and the remainder shrinks the slice", async () => {
    const store = new MemoryLiveBudgetStore();
    const first = await store.reserve({ familyId: "fam", plan: "plus", uid: "a" });
    expect(first.ok && first.reservation.ms).toBe(5 * MIN);
    vi.setSystemTime(T0 + 5 * MIN);
    for (let i = 0; i < 2; i++) {
      const next = await store.reserve({ familyId: "fam", plan: "plus", uid: "a" });
      expect(next.ok).toBe(true);
      vi.setSystemTime(Date.now() + 5 * MIN);
    }
    // 15 of 20 minutes committed: the last renewal is a 5-minute slice, then nothing.
    const last = await store.reserve({ familyId: "fam", plan: "plus", uid: "a" });
    expect(last.ok && last.reservation.ms).toBe(5 * MIN);
    expect(last.ok && last.remainingMs).toBe(0);
    const refused = await store.reserve({ familyId: "fam", plan: "plus", uid: "a" });
    expect(refused.ok).toBe(false);
  });

  it("a remainder shorter than the minimum slice is treated as spent, not minted as a 10-second token", async () => {
    process.env.LIVE_FREE_MINUTES_PER_DAY = "5.4"; // 5 min 24 s
    const store = new MemoryLiveBudgetStore();
    expect((await store.reserve({ familyId: "fam", plan: "free", uid: "a" })).ok).toBe(true);
    const tail = await store.reserve({ familyId: "fam", plan: "free", uid: "a" });
    expect(tail.ok).toBe(false);
    expect(tail.ok === false && tail.remainingMs).toBeLessThan(LIVE_MIN_SLICE_MS);
  });

  it("the allowance resets on the next UTC day", async () => {
    const store = new MemoryLiveBudgetStore();
    await store.reserve({ familyId: "fam", plan: "free", uid: "a" });
    expect((await store.reserve({ familyId: "fam", plan: "free", uid: "a" })).ok).toBe(false);
    vi.setSystemTime(Date.parse("2026-10-19T00:00:01Z"));
    expect((await store.reserve({ familyId: "fam", plan: "free", uid: "a" })).ok).toBe(true);
  });
});

describe("reconciliation never refunds on a client report", () => {
  it("observed time is recorded but committed time is unchanged while the token is live", async () => {
    const store = new MemoryLiveBudgetStore();
    const r = await store.reserve({ familyId: "fam", plan: "free", uid: "a" });
    if (!r.ok) throw new Error("expected reservation");
    // A client claims it closed after 1 second (or never opened at all).
    await store.observe("fam", r.reservation.day, r.reservation.id, { observedMs: 1_000, incomplete: false, closed: true });
    expect((await store.peek("fam", "free")).remainingMs).toBe(0);
    expect((await store.reserve({ familyId: "fam", plan: "free", uid: "b" })).ok).toBe(false);
  });

  it("default policy: an expired reservation with a clean 1-second close is still charged in full", async () => {
    const store = new MemoryLiveBudgetStore();
    const r = await store.reserve({ familyId: "fam", plan: "plus", uid: "a" });
    if (!r.ok) throw new Error("expected reservation");
    await store.observe("fam", r.reservation.day, r.reservation.id, { observedMs: 1_000, incomplete: false, closed: true });
    vi.setSystemTime(r.reservation.expiresAt);
    expect((await store.peek("fam", "plus")).committedMs).toBe(5 * MIN);
  });

  it("opt-in observed policy: the credit is bounded by the reservation and withheld for incomplete or unclosed telemetry", () => {
    const day = "2026-10-18";
    const base = emptyLiveBudgetDay("fam", day);
    const clean = recordObserved({ ...base, reservations: { r1: reservation() } }, "r1", { observedMs: 2 * MIN, incomplete: false, closed: true }, T0 + MIN);
    expect(settleExpired(clean, T0 + 5 * MIN, "observed").consumedMs).toBe(2 * MIN);
    // A report claiming MORE than the slice cannot inflate or go negative.
    const inflated = recordObserved({ ...base, reservations: { r1: reservation() } }, "r1", { observedMs: 60 * MIN, incomplete: false, closed: true }, T0);
    expect(settleExpired(inflated, T0 + 5 * MIN, "observed").consumedMs).toBe(5 * MIN);
    // Lost heartbeats (incomplete) or a missing close: charged in full.
    const gap = recordObserved({ ...base, reservations: { r1: reservation() } }, "r1", { observedMs: 45_000, incomplete: true, closed: true }, T0);
    expect(settleExpired(gap, T0 + 5 * MIN, "observed").consumedMs).toBe(5 * MIN);
    const open = recordObserved({ ...base, reservations: { r1: reservation() } }, "r1", { observedMs: 10_000, incomplete: false, closed: false }, T0);
    expect(settleExpired(open, T0 + 5 * MIN, "observed").consumedMs).toBe(5 * MIN);
    // Never before the provider expiry, whatever the client says.
    expect(settleExpired(clean, T0 + 4 * MIN, "observed").consumedMs).toBe(0);
    expect(committedMs(clean)).toBe(5 * MIN);
    // Observed time is monotonic and ignored once settled.
    const settled = settleExpired(clean, T0 + 5 * MIN, "observed");
    expect(recordObserved(settled, "r1", { observedMs: 0, incomplete: false, closed: true }, T0 + 6 * MIN)).toEqual(settled);
  });
});

describe("an unminted token releases its slice (server fact, not client report)", () => {
  it("cancel drops a reservation with no observed time; one that was used stays", async () => {
    const store = new MemoryLiveBudgetStore();
    const r = await store.reserve({ familyId: "fam", plan: "free", uid: "a" });
    if (!r.ok) throw new Error("expected reservation");
    await store.cancel("fam", r.reservation.day, r.reservation.id);
    expect((await store.peek("fam", "free")).remainingMs).toBe(3 * MIN);
    const again = await store.reserve({ familyId: "fam", plan: "free", uid: "a" });
    if (!again.ok) throw new Error("expected reservation");
    await store.observe("fam", again.reservation.day, again.reservation.id, { observedMs: 5_000, incomplete: false, closed: true });
    await store.cancel("fam", again.reservation.day, again.reservation.id);
    expect((await store.peek("fam", "free")).remainingMs).toBe(0);
    // Pure helper: an expired/settled reservation is never cancellable.
    const settled = settleExpired({ ...emptyLiveBudgetDay("fam", "2026-10-18"), reservations: { r1: reservation() } }, T0 + 5 * MIN);
    expect(cancelUnminted(settled, "r1", T0 + 6 * MIN)).toEqual(settled);
  });
});

describe("the fallback path (browser speech → /api/voice) spends the same allowance", () => {
  it("a fallback turn reserves before the model call and the server settles it to the spoken length it handled", async () => {
    const store = new MemoryLiveBudgetStore();
    const turn = await store.reserveTurn({ familyId: "fam", plan: "free", uid: "a", holdMs: 30_000 });
    if (!turn.ok) throw new Error("expected a turn");
    expect(turn.reservation.ms).toBe(VOICE_TURN_RESERVE_MS);
    expect((await store.peek("fam", "free")).committedMs).toBe(VOICE_TURN_RESERVE_MS);
    // 140 spoken characters (parent + reply) = 10 seconds.
    await store.settleTurn("fam", turn.reservation.day, turn.reservation.id, spokenMsForChars(140));
    expect((await store.peek("fam", "free")).committedMs).toBe(10_000);
    // Settling is once: a second (or late) settle cannot lower or raise it.
    await store.settleTurn("fam", turn.reservation.day, turn.reservation.id, 0);
    expect((await store.peek("fam", "free")).committedMs).toBe(10_000);
  });

  it("Live and fallback turns draw from ONE family-day allowance: a spent Live allowance refuses the loop and vice versa", async () => {
    const store = new MemoryLiveBudgetStore();
    expect((await store.reserve({ familyId: "fam", plan: "free", uid: "a" })).ok).toBe(true);
    const turn = await store.reserveTurn({ familyId: "fam", plan: "free", uid: "b", holdMs: 30_000 });
    expect(turn.ok).toBe(false);
    expect(turn.ok === false && turn.code).toBe(LIVE_RESTING);
    const other = new MemoryLiveBudgetStore();
    for (let i = 0; i < 6; i++) {
      const t = await other.reserveTurn({ familyId: "fam", plan: "free", uid: "a", holdMs: 30_000 });
      if (!t.ok) throw new Error(`turn ${i} refused`);
      await other.settleTurn("fam", t.reservation.day, t.reservation.id, 30_000);
    }
    // 6 × 30 s = the Free 3 minutes: neither path may start now.
    expect((await other.reserveTurn({ familyId: "fam", plan: "free", uid: "a", holdMs: 30_000 })).ok).toBe(false);
    expect((await other.reserve({ familyId: "fam", plan: "free", uid: "b" })).ok).toBe(false);
  });

  it("overlap: concurrent fallback turns and Live mints from two parents never commit past the allowance", async () => {
    const store = new MemoryLiveBudgetStore();
    const results = await Promise.all([
      ...Array.from({ length: 8 }, (_, i) => store.reserveTurn({ familyId: "fam", plan: "free", uid: `p${i % 2}`, holdMs: 30_000 })),
      store.reserve({ familyId: "fam", plan: "free", uid: "p0" }),
    ]);
    const committed = results.reduce((sum, r) => sum + (r.ok ? r.reservation.ms : 0), 0);
    expect(committed).toBeLessThanOrEqual(3 * MIN);
    expect(results.some((r) => !r.ok)).toBe(true);
  });

  it("crash: a turn the server never settled is charged its full reserve at its hold expiry, not zero", async () => {
    const store = new MemoryLiveBudgetStore();
    const turn = await store.reserveTurn({ familyId: "fam", plan: "plus", uid: "a", holdMs: 30_000 });
    if (!turn.ok) throw new Error("expected a turn");
    expect(turn.reservation.expiresAt).toBe(T0 + 30_000);
    vi.setSystemTime(T0 + 30_000);
    const snap = await store.peek("fam", "plus");
    expect(snap.committedMs).toBe(VOICE_TURN_RESERVE_MS);
    // The late settle after the crash window changes nothing.
    await store.settleTurn("fam", turn.reservation.day, turn.reservation.id, 1_000);
    expect((await store.peek("fam", "plus")).committedMs).toBe(VOICE_TURN_RESERVE_MS);
    // Even the opt-in observed credit policy never discounts a crashed turn.
    process.env.LIVE_RECONCILE_CREDIT = "observed";
    const doc = { ...emptyLiveBudgetDay("fam", "2026-10-18"), reservations: { t1: reservation({ id: "t1", kind: "turn", ms: 30_000, expiresAt: T0 + 30_000, closed: true }) } };
    expect(settleExpired(doc, T0 + 30_000, "observed").consumedMs).toBe(30_000);
  });

  it("a Live token can never be settled down through the turn seam", () => {
    const doc = { ...emptyLiveBudgetDay("fam", "2026-10-18"), reservations: { r1: reservation() } };
    expect(settleTurnCharge(doc, "r1", 0, T0)).toEqual(doc);
    expect(spokenMsForChars(14)).toBe(1_000);
    expect(spokenMsForChars(-5)).toBe(0);
  });
});

describe("retry: a client that retries the mint cannot buy more than the allowance", () => {
  it("each retry is a new non-refundable reservation; the family total stays bounded", async () => {
    const store = new MemoryLiveBudgetStore();
    const outcomes = [];
    for (let i = 0; i < 6; i++) outcomes.push(await store.reserve({ familyId: "fam", plan: "plus", uid: "a" }));
    expect(outcomes.filter((o) => o.ok)).toHaveLength(4);
    expect((await store.peek("fam", "plus")).committedMs).toBe(20 * MIN);
  });
});

describe("P1-1 — the default slice is one minute: a failed start never costs the day", () => {
  it("a Free family's first mint reserves 60 s, not all 180 s; three slices make the day", async () => {
    delete process.env.LIVE_RESERVATION_MINUTES;
    expect(liveSliceMs()).toBe(MIN);
    const store = new MemoryLiveBudgetStore();
    const first = await store.reserve({ familyId: "fam", plan: "free", uid: "a" });
    if (!first.ok) throw new Error("expected a slice");
    expect(first.reservation.ms).toBe(MIN);
    expect(first.reservation.expiresAt).toBe(T0 + MIN);
    // The socket never reached audio and the token simply expired: 60 s gone, 120 s left.
    vi.setSystemTime(T0 + MIN);
    expect((await store.peek("fam", "free")).remainingMs).toBe(2 * MIN);
    expect((await store.reserve({ familyId: "fam", plan: "free", uid: "a" })).ok).toBe(true);
    expect((await store.reserve({ familyId: "fam", plan: "free", uid: "a" })).ok).toBe(true);
    expect((await store.reserve({ familyId: "fam", plan: "free", uid: "a" })).ok).toBe(false);
  });

  it("a paid family's twenty minutes are twenty one-minute slices", async () => {
    delete process.env.LIVE_RESERVATION_MINUTES;
    const store = new MemoryLiveBudgetStore();
    const results = await Promise.all(Array.from({ length: 22 }, () => store.reserve({ familyId: "fam", plan: "plus", uid: "a" })));
    expect(results.filter((r) => r.ok)).toHaveLength(20);
  });
});

describe("round 3 — a long renewal CHAINED onto the slice it renews: two seams, charged = talk time", () => {
  const renewFrom = async (store: InstanceType<typeof MemoryLiveBudgetStore>, plan: "free" | "plus", uid: string, renewOf: string) =>
    store.reserve({ familyId: "fam", plan, uid, renewOf });

  it("paid: 1 + 10 + 9 minutes; each renewal starts where the renewed slice ends, so the family is charged exactly the 20 minutes it can talk", async () => {
    delete process.env.LIVE_RESERVATION_MINUTES;
    const store = new MemoryLiveBudgetStore();
    const first = await store.reserve({ familyId: "fam", plan: "plus", uid: "a" });
    if (!first.ok) throw new Error("expected the first slice");
    expect(first.reservation.ms).toBe(MIN);
    vi.setSystemTime(T0 + 20_000); // the first exchange completed
    const second = await renewFrom(store, "plus", "a", first.reservation.id);
    if (!second.ok) throw new Error("expected a renewal");
    expect(second.reservation.ms).toBe(10 * MIN);
    expect(second.reservation.expiresAt).toBe(first.reservation.expiresAt + 10 * MIN);
    vi.setSystemTime(second.reservation.expiresAt - 30_000);
    const third = await renewFrom(store, "plus", "a", second.reservation.id);
    if (!third.ok) throw new Error("expected the second renewal");
    expect(third.reservation.ms).toBe(9 * MIN);
    expect(third.reservation.expiresAt).toBe(T0 + 20 * MIN);
    expect(third.remainingMs).toBe(0);
    // Charged: 20 minutes. Talk window: T0 → T0 + 20 min.
    vi.setSystemTime(T0 + 20 * MIN);
    expect((await store.peek("fam", "plus")).committedMs).toBe(20 * MIN);
  });

  it("Free: 60 s, then the remaining 120 s chained — one seam, 180 s charged for 180 s of talk", async () => {
    delete process.env.LIVE_RESERVATION_MINUTES;
    const store = new MemoryLiveBudgetStore();
    const first = await store.reserve({ familyId: "fam", plan: "free", uid: "a" });
    if (!first.ok) throw new Error("expected the first slice");
    vi.setSystemTime(T0 + 15_000);
    const second = await renewFrom(store, "free", "a", first.reservation.id);
    if (!second.ok) throw new Error("expected a renewal");
    expect(second.reservation.ms).toBe(2 * MIN);
    expect(second.reservation.expiresAt).toBe(T0 + 3 * MIN);
    expect((await renewFrom(store, "free", "a", second.reservation.id)).ok).toBe(false);
  });

  it("a renewal must chain onto the caller's own live slice, inside its last 90 s, once — anything else is refused and reserves nothing", async () => {
    delete process.env.LIVE_RESERVATION_MINUTES;
    const store = new MemoryLiveBudgetStore();
    const first = await store.reserve({ familyId: "fam", plan: "plus", uid: "a" });
    if (!first.ok) throw new Error("expected the first slice");
    const refused = async (r: Promise<Awaited<ReturnType<typeof store.reserve>>>) => {
      const result = await r;
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.code).toBe("renewal_invalid");
    };
    await refused(renewFrom(store, "plus", "b", first.reservation.id)); // another parent's slice
    await refused(renewFrom(store, "plus", "a", "not-a-reservation"));
    vi.setSystemTime(T0 + 30_000);
    const ok = await renewFrom(store, "plus", "a", first.reservation.id);
    expect(ok.ok).toBe(true);
    await refused(renewFrom(store, "plus", "a", first.reservation.id)); // a slice renews once
    if (!ok.ok) throw new Error("unreachable");
    await refused(renewFrom(store, "plus", "a", ok.reservation.id)); // 10 minutes before its end: too early
    vi.setSystemTime(ok.reservation.expiresAt + 1);
    await refused(renewFrom(store, "plus", "a", ok.reservation.id)); // expired
    const turn = await store.reserveTurn({ familyId: "fam", plan: "plus", uid: "a", holdMs: 30_000 });
    if (!turn.ok) throw new Error("expected a turn");
    await refused(renewFrom(store, "plus", "a", turn.reservation.id)); // a fallback turn is not a slice
    const live = Object.values([...store.days.values()][0].reservations).filter((r) => r.kind !== "turn");
    expect(live).toHaveLength(2);
  });
});
