import { afterEach, describe, expect, it, vi } from "vitest";
import { advanceLiveUsage, withLiveUsageDeadline, splitLiveUsageDays, MemoryLiveUsageStore, type LiveUsageSession } from "./liveUsage.js";

const session = (): LiveUsageSession => ({ uid: "parent", familyId: "family", plan: "free",
  model: "test-model", createdAt: 1_000, expiresAt: 181_000, observedMs: 0, closed: false, incomplete: false });
afterEach(() => vi.useRealTimers());
describe("Live observed duration", () => {
  it("does not count token mint or microphone setup as a call", () => {
    const r = advanceLiveUsage(session(), "closed", 20_000);
    expect(r.deltaMs).toBe(0); expect(r.session.closed).toBe(true);
  });
  it("counts server elapsed time once across heartbeats and duplicate closes", () => {
    let s = advanceLiveUsage(session(), "opened", 5_000).session;
    s = advanceLiveUsage(s, "heartbeat", 20_000).session;
    s = advanceLiveUsage(s, "closed", 25_000).session;
    expect(s.observedMs).toBe(20_000);
    expect(advanceLiveUsage(s, "closed", 30_000).deltaMs).toBe(0);
    expect(advanceLiveUsage(s, "opened", 35_000).opened).toBe(false);
  });
  it("does not reopen or charge a startup that closed before open arrived", () => {
    const closed = advanceLiveUsage(session(), "closed", 3_000).session;
    expect(advanceLiveUsage(closed, "opened", 4_000).session.openedAt).toBeUndefined();
  });
  it("marks gaps incomplete and never invents hours of audio", () => {
    const s = advanceLiveUsage(session(), "opened", 5_000).session;
    const r = advanceLiveUsage(s, "closed", 300_000);
    expect(r.session).toMatchObject({ incomplete: true, closed: true, observedMs: 45_000 });
  });
  it("ignores clock reversal and never counts beyond token expiry", () => {
    let s = advanceLiveUsage(session(), "opened", 170_000).session;
    s = advanceLiveUsage(s, "heartbeat", 160_000).session;
    expect(s.lastSeenAt).toBe(170_000);
    expect(advanceLiveUsage(s, "closed", 190_000).deltaMs).toBe(11_000);
  });
  it("never trusts another parent's session id", async () => {
    vi.useFakeTimers(); vi.setSystemTime(1_000);
    const store = new MemoryLiveUsageStore();
    const id = await store.create(session());
    expect(await store.report("other-parent", id, "opened")).toBeNull();
    expect(await store.report("parent", "../invalid", "opened")).toBeNull();
    await store.report("parent", id, "opened");
    vi.setSystemTime(11_000);
    // B-AIOPS-02: the report also carries the family/budget pointer for the
    // route's reconciliation write; the client still sees observedMs/incomplete only.
    expect(await store.report("parent", id, "closed")).toEqual({ observedMs: 10_000, incomplete: false, closed: true, familyId: "family" });
    vi.setSystemTime(21_000);
    expect(await store.report("parent", id, "closed")).toEqual({ observedMs: 10_000, incomplete: false, closed: true, familyId: "family" });
  });
});

it("splits UTC days without dropping or duplicating midnight duration", () => {
  const midnight = Date.parse("2026-10-16T00:00:00Z");
  expect(Object.fromEntries(splitLiveUsageDays(midnight + 5_000, 15_000))).toEqual({
    "2026-10-16": 5_000, "2026-10-15": 10_000,
  });
  expect(Object.fromEntries(splitLiveUsageDays(midnight, 15_000))).toEqual({ "2026-10-15": 15_000 });
});

it("bounded accounting setup cannot strand a minted voice token", async () => {
  vi.useFakeTimers();
  const pending = withLiveUsageDeadline(() => new Promise(() => {}));
  const checked = expect(pending).rejects.toThrow("Live usage setup timed out");
  await vi.advanceTimersByTimeAsync(1_000);
  await checked;
  expect(vi.getTimerCount()).toBe(0);
  expect(await withLiveUsageDeadline(async () => "session-id")).toBe("session-id");
  expect(vi.getTimerCount()).toBe(0);
});
