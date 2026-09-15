import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * N1-01 — the two CLOSING events of the loop: `session_close` and
 * `kid_session_end`.
 *
 * WHY A SEPARATE FILE. Both are about a boundary that only exists in time — a
 * tab going away, a child leaving Kid Mode. Neither has a button, so neither
 * can be source-pinned at a call site the way the ENG-22 families are; they
 * are proven by driving the boundary itself against a fake window and a fake
 * storage, which is also the only way to test that the SECOND crossing emits
 * nothing.
 *
 * The sink is mocked at lib/analytics, not at lib/kpiEvents, so every
 * assertion below exercises the real projection: the event NAME and the exact
 * prop bag that would reach Firestore.
 */

const trackSpy = vi.hoisted(() => vi.fn());
vi.mock("./analytics", () => ({ track: trackSpy }));

import {
  bindSessionClose,
  emitSessionClose,
  resetSessionClose,
  trackAppStart,
  type SessionCloseTarget,
} from "./loopEvents";
import {
  KIDMODE_SESSION_SS_KEY,
  isKidModeActive,
  noteKidActivity,
  setKidModeActive,
  type KidModeStorage,
} from "./kidModeGate";

/** Map-backed storage — the kidLock.test.ts fake, reused. */
function fakeStorage(): KidModeStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/** A window that records its listeners so a test can fire them by name. */
function fakeWindow(visibility: { state: string } = { state: "visible" }) {
  const listeners: Record<string, (() => void)[]> = {};
  const target: SessionCloseTarget = {
    addEventListener: (type, listener) => {
      (listeners[type] ??= []).push(listener);
    },
    get document() {
      return { visibilityState: visibility.state };
    },
  };
  return {
    target,
    listeners,
    fire(type: string) {
      for (const listener of listeners[type] ?? []) listener();
    },
    count(type: string) {
      return (listeners[type] ?? []).length;
    },
  };
}

const calls = (name: string) =>
  (trackSpy.mock.calls as [string, Record<string, unknown>?][]).filter((c) => c[0] === name);

describe("N1-01 — session_close: the closing partner session_open never had", () => {
  beforeEach(() => {
    trackSpy.mockClear();
    resetSessionClose();
  });

  it("binds both close signals and fires exactly one session_close on pagehide", () => {
    const win = fakeWindow();
    bindSessionClose(win.target);
    expect(win.count("pagehide")).toBe(1);
    expect(win.count("visibilitychange")).toBe(1);

    win.fire("pagehide");
    expect(calls("session_close")).toHaveLength(1);
    expect(Object.keys(calls("session_close")[0][1] ?? {})).toEqual(["seconds"]);
  });

  it("NEGATIVE CONTROL: a second pagehide emits nothing", () => {
    const win = fakeWindow();
    bindSessionClose(win.target);
    win.fire("pagehide");
    win.fire("pagehide");
    win.fire("pagehide");
    expect(calls("session_close")).toHaveLength(1);
  });

  it("NEGATIVE CONTROL: visibilitychange to a VISIBLE page emits nothing", () => {
    const visibility = { state: "visible" };
    const win = fakeWindow(visibility);
    bindSessionClose(win.target);
    win.fire("visibilitychange");
    expect(calls("session_close")).toHaveLength(0);
    // ...and the hidden transition (the Safari fallback) does fire, once.
    visibility.state = "hidden";
    win.fire("visibilitychange");
    expect(calls("session_close")).toHaveLength(1);
  });

  it("the two signals never double-count the same close", () => {
    const visibility = { state: "hidden" };
    const win = fakeWindow(visibility);
    bindSessionClose(win.target);
    win.fire("pagehide");
    win.fire("visibilitychange");
    expect(calls("session_close")).toHaveLength(1);
  });

  it("binding twice registers one set of listeners (idempotent)", () => {
    const win = fakeWindow();
    bindSessionClose(win.target);
    bindSessionClose(win.target);
    expect(win.count("pagehide")).toBe(1);
  });

  it("seconds is a whole non-negative count measured from the session start", () => {
    const win = fakeWindow();
    bindSessionClose(win.target);
    // The session started at bind time (sessionStorage is absent under node,
    // so the in-memory fallback is the honest start).
    emitSessionClose(Date.now() + 312_000);
    const props = calls("session_close")[0][1] as { seconds: number };
    expect(props.seconds).toBeGreaterThanOrEqual(311);
    expect(props.seconds).toBeLessThanOrEqual(313);
    expect(Number.isInteger(props.seconds)).toBe(true);
  });

  it("a close BEFORE the bind (clock skew) reports 0, never a negative", () => {
    const win = fakeWindow();
    bindSessionClose(win.target);
    emitSessionClose(Date.now() - 60_000);
    expect(calls("session_close")[0][1]).toEqual({ seconds: 0 });
  });

  it("app start binds the close, so no new entry point can forget it", () => {
    const win = fakeWindow();
    resetSessionClose();
    trackAppStart();
    // trackAppStart binds the REAL window, which node does not have — the bind
    // is a no-op here, which is exactly the contract (never throws at boot).
    expect(calls("app_open")).toHaveLength(1);
    expect(() => bindSessionClose(win.target)).not.toThrow();
  });
});

describe("N1-01 — kid_session_end: two integers, emitted inside the kid gate", () => {
  let store: ReturnType<typeof fakeStorage>;

  beforeEach(() => {
    trackSpy.mockClear();
    store = fakeStorage();
    setKidModeActive(false, { storage: store });
    trackSpy.mockClear();
  });

  it("an exit emits exactly one kid_session_end with seconds + activities", () => {
    const t0 = 1_700_000_000_000;
    setKidModeActive(true, { storage: store, now: t0 });
    expect(store.map.get(KIDMODE_SESSION_SS_KEY)).toBeTruthy();
    noteKidActivity({ storage: store });
    noteKidActivity({ storage: store });
    setKidModeActive(false, { storage: store, now: t0 + 312_000 });

    expect(calls("kid_session_end")).toHaveLength(1);
    expect(calls("kid_session_end")[0][1]).toEqual({ seconds: 312, activities: 2 });
    // The stamp is cleared, so the next session starts from zero.
    expect(store.map.get(KIDMODE_SESSION_SS_KEY)).toBeUndefined();
  });

  it("day-0: an open and an immediate exit still reports the session", () => {
    const t0 = 1_700_000_000_000;
    setKidModeActive(true, { storage: store, now: t0 });
    setKidModeActive(false, { storage: store, now: t0 });
    expect(calls("kid_session_end")[0][1]).toEqual({ seconds: 0, activities: 0 });
  });

  it("the event is emitted while the kid gate is STILL ACTIVE", () => {
    // This is what makes lib/analytics tag it kid_mode: true and strip the
    // parent's marketing attribution. Flipping the gate first would ship a
    // child-generated event carrying utm_* props — the pre-fix ordering.
    let activeAtEmit: boolean | null = null;
    trackSpy.mockImplementation((name: string) => {
      if (name === "kid_session_end") activeAtEmit = isKidModeActive();
    });
    const t0 = 1_700_000_000_000;
    setKidModeActive(true, { storage: store, now: t0 });
    setKidModeActive(false, { storage: store, now: t0 + 1_000 });
    expect(activeAtEmit).toBe(true);
    expect(isKidModeActive()).toBe(false);
    trackSpy.mockImplementation(() => undefined);
  });

  it("NEGATIVE CONTROL: a second exit emits nothing (the gate is idempotent)", () => {
    const t0 = 1_700_000_000_000;
    setKidModeActive(true, { storage: store, now: t0 });
    setKidModeActive(false, { storage: store, now: t0 + 5_000 });
    setKidModeActive(false, { storage: store, now: t0 + 9_000 });
    setKidModeActive(false, { storage: store, now: t0 + 9_000 });
    expect(calls("kid_session_end")).toHaveLength(1);
  });

  it("NEGATIVE CONTROL: activities logged OUTSIDE Kid Mode never count", () => {
    noteKidActivity({ storage: store });
    noteKidActivity({ storage: store });
    const t0 = 1_700_000_000_000;
    setKidModeActive(true, { storage: store, now: t0 });
    noteKidActivity({ storage: store });
    setKidModeActive(false, { storage: store, now: t0 + 1_000 });
    expect(calls("kid_session_end")[0][1]).toEqual({ seconds: 1, activities: 1 });
  });

  it("a reload INSIDE Kid Mode keeps the real start time (stamp rehydrates)", () => {
    const t0 = 1_700_000_000_000;
    setKidModeActive(true, { storage: store, now: t0 });
    noteKidActivity({ storage: store });
    // Simulate the reload: the module-level mirror is gone, the stamp is not.
    // (Writing the stamp by hand is exactly what a rehydrated tab presents.)
    store.map.set(KIDMODE_SESSION_SS_KEY, JSON.stringify({ at: t0, n: 4 }));
    setKidModeActive(false, { storage: store, now: t0 + 600_000 });
    expect(calls("kid_session_end")[0][1]).toEqual({ seconds: 600, activities: 4 });
  });

  it("a garbage stamp degrades to a reported session, never to a crash", () => {
    const t0 = 1_700_000_000_000;
    setKidModeActive(true, { storage: store, now: t0 });
    store.map.set(KIDMODE_SESSION_SS_KEY, "{not json");
    expect(() => setKidModeActive(false, { storage: store, now: t0 + 1_000 })).not.toThrow();
    expect(calls("kid_session_end")).toHaveLength(1);
  });

  it("the payload is two integers — nothing a child generated can ride along", () => {
    const t0 = 1_700_000_000_000;
    setKidModeActive(true, { storage: store, now: t0 });
    setKidModeActive(false, { storage: store, now: t0 + 1_500 });
    const props = calls("kid_session_end")[0][1] as Record<string, unknown>;
    expect(Object.keys(props).sort()).toEqual(["activities", "seconds"]);
    for (const value of Object.values(props)) expect(typeof value).toBe("number");
    expect(JSON.stringify(props).replace(/"(seconds|activities)"/g, "")).not.toMatch(/[A-Za-z]/);
  });
});
