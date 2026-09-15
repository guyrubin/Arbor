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

/* ══════════════════════════════════════════════════════════════════════════
   N1-01-R5 — `kid_session_end.activities` has callers.

   The counter above is wired end-to-end and, on the branch it shipped on, read
   ZERO in every session: no kid surface ever called `noteKidActivity()`. An
   integer that is always 0 is worse than an absent one — it reads as "the
   child did nothing", which is a statement about a child, and it would have
   been quoted as one at T+7.

   The scan is over SOURCE because there is no other way to prove a call site
   exists: each seam sits inside a component's own completion handler, and a
   runtime test of eight components is a test of jsdom, not of the wiring.
   ══════════════════════════════════════════════════════════════════════════ */
import * as fs from "node:fs";
import * as path from "node:path";

const SRC_ROOT = path.resolve(__dirname, "..");

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Live (comment-stripped) `noteKidActivity()` calls in a source text. */
const activityCalls = (source: string): number =>
  (stripComments(source).match(/\bnoteKidActivity\(\)/g) ?? []).length;

describe("N1-01-R5 — every kid-world completion seam counts one activity", () => {
  /** file → the completion seam it must count, for the failure message. */
  const SEAMS: { file: string; seam: string }[] = [
    { file: "components/practice/PatternPowerWorld.tsx", seam: "a Pattern Power round resolved" },
    { file: "components/practice/BeatKeeperWorld.tsx", seam: "a Beat Keeper round scored" },
    { file: "components/practice/MemoryMatch.tsx", seam: "a Mind Vault board solved" },
    { file: "components/practice/MimicMatch.tsx", seam: "a Mimic face rated" },
    { file: "components/practice/SpeechCoachTab.tsx", seam: "a Sound Lab attempt saved" },
    { file: "components/practice/FeelingsLabTab.tsx", seam: "a feeling named correctly" },
    { file: "components/practice/HeroPoseWorld.tsx", seam: "a Hero Pose confirmed" },
    { file: "components/tabs/HeroJourneyTab.tsx", seam: "a Hero Journey story finished" },
  ];

  const sources = SEAMS.map((entry) => ({
    ...entry,
    text: fs.readFileSync(path.join(SRC_ROOT, entry.file), "utf8"),
  }));

  it("at least seven kid surfaces call noteKidActivity() (the item's floor)", () => {
    const wired = sources.filter((s) => activityCalls(s.text) > 0);
    expect(wired.length).toBeGreaterThanOrEqual(7);
  });

  it("each named seam has exactly one call — a double count is as wrong as none", () => {
    const counts = Object.fromEntries(sources.map((s) => [s.file, activityCalls(s.text)]));
    expect(counts).toEqual(Object.fromEntries(SEAMS.map((s) => [s.file, 1])));
  });

  it("each call site imports the counter from the gate, not a local re-declaration", () => {
    for (const source of sources) {
      expect(stripComments(source.text)).toMatch(
        /import \{[^}]*noteKidActivity[^}]*\} from "[^"]*lib\/kidModeGate"/,
      );
    }
  });

  it("NEGATIVE CONTROL: a file with the seam and no call is not wired", () => {
    // The pre-fix Hero Pose handler, verbatim: the completion is right there
    // and nothing counts it. Both the scan and the import pin must read false.
    const preFix = [
      "  const didIt = () => {",
      '    log("pose", "social", { correct: true, meta: pose.id });',
      "    setCheer(true);",
      "    window.setTimeout(() => { setCheer(false); setIdx((i) => i + 1); }, 1000);",
      "  };",
    ].join("\n");
    expect(activityCalls(preFix)).toBe(0);
    expect(preFix).not.toMatch(/import \{[^}]*noteKidActivity/);
  });

  it("NEGATIVE CONTROL: a call named only in a comment does not count as wiring", () => {
    expect(activityCalls("// TODO: call noteKidActivity() here one day\nsetCheer(true);")).toBe(0);
    expect(activityCalls("/* noteKidActivity() belongs at the seam */")).toBe(0);
  });

  it("no child content rides along: the counter takes no arguments at any seam", () => {
    for (const source of sources) {
      // `noteKidActivity(deps)` is the TEST seam; production calls pass nothing.
      expect(stripComments(source.text)).not.toMatch(/noteKidActivity\(\s*[^)\s]/);
    }
  });
});
