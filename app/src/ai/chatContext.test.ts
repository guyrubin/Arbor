/**
 * Masterplan 1.3 — unit tests for the ONE context-assembly module:
 *  - server-defensive sanitizers (caps, whitelists, clamps, degrade-to-legacy),
 *  - client-side buildChatContext (thread mapping, live/ack exclusion,
 *    counts-only weekly digest, toggle gating),
 *  - the per-child consent flag (DEFAULT ON since B-ASKJB-07; explicit "0" ⇒
 *    off; storage unavailable ⇒ off) and the one-time notice.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RECENT_TURNS_MAX,
  RECENT_TURNS_TOTAL_CHAR_CAP,
  RECENT_TURN_CHAR_CAP,
  buildChatContext,
  computeWeeklyContext,
  dismissWeeklyContextNotice,
  readWeeklyContextConsent,
  sanitizeRecentTurns,
  sanitizeWeeklyContext,
  shouldShowWeeklyContextNotice,
  weeklyContextConsentKey,
  weeklyContextNoticeKey,
  writeWeeklyContextConsent,
} from "./chatContext.js";

const NOW = new Date("2026-08-11T12:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe("sanitizeRecentTurns — server cap enforcement", () => {
  it("degrades every malformed shape to [] (⇒ legacy prompt bytes)", () => {
    for (const junk of [undefined, null, "hi", 7, {}, [{ role: "system", text: "x" }], [{ role: "parent" }], [{ role: "parent", text: 4 }], [{ role: "parent", text: "   " }]]) {
      expect(sanitizeRecentTurns(junk)).toEqual([]);
    }
  });

  it("whitelists roles, trims, and caps each turn at RECENT_TURN_CHAR_CAP", () => {
    const out = sanitizeRecentTurns([
      { role: "parent", text: `  ${"a".repeat(2000)}  ` },
      { role: "coach", text: "ok" },
      { role: "assistant", text: "smuggled" },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].text).toHaveLength(RECENT_TURN_CHAR_CAP);
    expect(out[1]).toEqual({ role: "coach", text: "ok" });
  });

  it("keeps only the MOST RECENT six turns", () => {
    const turns = Array.from({ length: 10 }, (_, i) => ({ role: "parent" as const, text: `turn-${i}` }));
    const out = sanitizeRecentTurns(turns);
    expect(out).toHaveLength(RECENT_TURNS_MAX);
    expect(out[0].text).toBe("turn-4");
    expect(out[5].text).toBe("turn-9");
  });

  it("enforces the ~4000-char TOTAL budget by dropping the oldest turns", () => {
    const turns = Array.from({ length: 6 }, (_, i) => ({ role: "coach" as const, text: `${i}:` + "x".repeat(RECENT_TURN_CHAR_CAP - 2) }));
    const out = sanitizeRecentTurns(turns);
    const total = out.reduce((sum, t) => sum + t.text.length, 0);
    expect(total).toBeLessThanOrEqual(RECENT_TURNS_TOTAL_CHAR_CAP);
    // Newest survives; the drop came from the head.
    expect(out[out.length - 1].text.startsWith("5:")).toBe(true);
    expect(out.length).toBeLessThan(6);
  });

  it("a single oversized turn survives (per-turn capped), never an empty result", () => {
    const out = sanitizeRecentTurns([{ role: "parent", text: "y".repeat(9999) }]);
    expect(out).toHaveLength(1);
    expect(out[0].text).toHaveLength(RECENT_TURN_CHAR_CAP);
    expect(out[0].text.length).toBeLessThanOrEqual(RECENT_TURNS_TOTAL_CHAR_CAP);
  });
});

describe("sanitizeWeeklyContext — counts and categories only", () => {
  it("returns null for every non-conforming shape (⇒ no prompt line)", () => {
    for (const junk of [undefined, null, "on", 3, [], { momentCount: "4", milestonesCrossedCount: 1 }, { momentCount: 4 }, { milestonesCrossedCount: 1 }, { momentCount: NaN, milestonesCrossedCount: 1 }]) {
      expect(sanitizeWeeklyContext(junk)).toBeNull();
    }
  });

  it("clamps counts to integers in [0, 999] and drops out-of-enum outcomes", () => {
    expect(
      sanitizeWeeklyContext({ momentCount: -3, milestonesCrossedCount: 12345.7, lastActionOutcome: "cured" }),
    ).toEqual({ momentCount: 0, milestonesCrossedCount: 999 });
  });

  it("strips a legacy topTrigger field entirely (free-typed text never survives) and keeps a valid outcome", () => {
    const out = sanitizeWeeklyContext({
      momentCount: 4,
      milestonesCrossedCount: 1,
      topTrigger: "hit his sister when I took the iPad",
      lastActionOutcome: "not_today",
    });
    expect(out).toEqual({
      momentCount: 4,
      milestonesCrossedCount: 1,
      lastActionOutcome: "not_today",
    });
    expect(JSON.stringify(out)).not.toContain("iPad");
  });
});

describe("computeWeeklyContext — derived from data the client already holds", () => {
  const sources = {
    behaviorLogs: [
      { timestamp: daysAgo(1), trigger: "transitions" },
      { timestamp: daysAgo(2), trigger: "transitions" },
      { timestamp: daysAgo(3), trigger: "hunger" },
      { timestamp: daysAgo(30), trigger: "old-should-not-count" }, // outside window
    ],
    milestones: [
      { checked: true, observationUpdatedAt: daysAgo(2) },
      { checked: true, observationUpdatedAt: daysAgo(20) }, // outside window
      { checked: false, observationUpdatedAt: daysAgo(1) }, // not crossed
    ],
    actionLoop: [
      { outcome: "helped", outcomeAt: daysAgo(5) },
      { outcome: "somewhat", outcomeAt: daysAgo(2) }, // newest ⇒ wins
      { outcome: "helped", outcomeAt: daysAgo(40) }, // outside window
    ],
  };

  it("counts the 7-day window — counts and closed enums only, no trigger text", () => {
    expect(computeWeeklyContext(sources, NOW)).toEqual({
      momentCount: 3,
      milestonesCrossedCount: 1,
      lastActionOutcome: "somewhat",
    });
  });

  it("a quiet week is honest zeros, with the optional fields ABSENT", () => {
    expect(computeWeeklyContext({ behaviorLogs: [], milestones: [], actionLoop: [] }, NOW)).toEqual({
      momentCount: 0,
      milestonesCrossedCount: 0,
    });
  });
});

describe("buildChatContext — the one call ArborContext.sendMessage makes", () => {
  const thread = [
    { sender: "user" as const, text: "He melts down at shutoff." },
    { sender: "ai" as const, text: "Try a two-minute warning." },
    { sender: "user" as const, text: "And bedtime?" },
    { sender: "ai" as const, text: "…", chatAck: true }, // local ack — excluded
    { sender: "ai" as const, text: "streaming", chatLive: true }, // live — excluded
    { sender: "ai" as const, text: "caption", voiceLive: true }, // live — excluded
  ];

  it("maps settled turns to parent/coach roles and excludes ack + live bubbles", () => {
    const out = buildChatContext({ thread, behaviorLogs: [], milestones: [], actionLoop: [], weeklyContextEnabled: false, now: NOW });
    expect(out.recentTurns).toEqual([
      { role: "parent", text: "He melts down at shutoff." },
      { role: "coach", text: "Try a two-minute warning." },
      { role: "parent", text: "And bedtime?" },
    ]);
    // Toggle OFF ⇒ the field is ABSENT, not empty (byte-identical request).
    expect("weeklyContext" in out).toBe(false);
  });

  it("an empty/fresh thread yields NO recentTurns field at all", () => {
    const out = buildChatContext({ thread: [], behaviorLogs: [], milestones: [], actionLoop: [], weeklyContextEnabled: false });
    expect("recentTurns" in out).toBe(false);
  });

  it("toggle ON attaches the counts-only weekly digest", () => {
    const out = buildChatContext({
      thread: [],
      behaviorLogs: [{ timestamp: daysAgo(1), trigger: "transitions" }],
      milestones: [],
      actionLoop: [],
      weeklyContextEnabled: true,
      now: NOW,
    });
    expect(out.weeklyContext).toEqual({ momentCount: 1, milestonesCrossedCount: 0 });
  });
});

describe("weekly-context consent flag — per child, DEFAULT ON (B-ASKJB-07, Guy G1)", () => {
  const store = new Map<string, string>();
  const fakeLocalStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };

  afterEach(() => {
    store.clear();
    vi.unstubAllGlobals();
  });

  it("defaults to ON when nothing is stored; OFF when storage is unavailable or throws", () => {
    vi.stubGlobal("localStorage", fakeLocalStorage);
    expect(readWeeklyContextConsent("child-1")).toBe(true);
    vi.unstubAllGlobals(); // node env: no localStorage at all
    expect(readWeeklyContextConsent("child-1")).toBe(false);
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); } });
    expect(readWeeklyContextConsent("child-1")).toBe(false);
  });

  it("an explicit off is stored as \"0\" per child and stays off", () => {
    vi.stubGlobal("localStorage", fakeLocalStorage);
    expect(weeklyContextConsentKey("c9")).toBe("arbor.coach.weeklyContext.c9");
    writeWeeklyContextConsent("c9", false);
    expect(store.get("arbor.coach.weeklyContext.c9")).toBe("0");
    expect(readWeeklyContextConsent("c9")).toBe(false);
    expect(readWeeklyContextConsent("other-child")).toBe(true); // per-child scope
    writeWeeklyContextConsent("c9", true);
    expect(readWeeklyContextConsent("c9")).toBe(true);
    // A legacy explicit "on" from the opt-in era still reads on.
    store.set("arbor.coach.weeklyContext.legacy", "on");
    expect(readWeeklyContextConsent("legacy")).toBe(true);
  });

  it("new child: the first send carries weeklyContext; after off the next send omits it (legacy bytes)", () => {
    vi.stubGlobal("localStorage", fakeLocalStorage);
    const inputs = {
      thread: [],
      behaviorLogs: [{ timestamp: daysAgo(1), trigger: "transitions" }],
      milestones: [],
      actionLoop: [],
      now: NOW,
    };
    const first = buildChatContext({ ...inputs, weeklyContextEnabled: readWeeklyContextConsent("new-child") });
    expect(first.weeklyContext).toEqual({ momentCount: 1, milestonesCrossedCount: 0 });
    writeWeeklyContextConsent("new-child", false);
    const next = buildChatContext({ ...inputs, weeklyContextEnabled: readWeeklyContextConsent("new-child") });
    expect("weeklyContext" in next).toBe(false);
    const legacy = buildChatContext({ ...inputs, weeklyContextEnabled: false });
    expect(JSON.stringify(next)).toBe(JSON.stringify(legacy));
  });

  it("the one-time notice shows only while the default is in force, and dismiss persists per child", () => {
    vi.stubGlobal("localStorage", fakeLocalStorage);
    expect(shouldShowWeeklyContextNotice("a")).toBe(true);
    dismissWeeklyContextNotice("a");
    expect(store.get(weeklyContextNoticeKey("a"))).toBe("1");
    expect(shouldShowWeeklyContextNotice("a")).toBe(false);
    expect(shouldShowWeeklyContextNotice("b")).toBe(true); // per child
    writeWeeklyContextConsent("b", false); // the parent chose: no notice
    expect(shouldShowWeeklyContextNotice("b")).toBe(false);
    vi.unstubAllGlobals();
    expect(shouldShowWeeklyContextNotice("c")).toBe(false); // no storage ⇒ consent off ⇒ nothing to announce
  });
});

/* B-GROWTH-15 — words written down reach the coach's weekly counts as an
   INTEGER only (`wordsLoggedCount`). The words never cross this seam; a
   string in the field is dropped, never coerced; a body without the ledger is
   byte-identical to the legacy one. */
describe("B-GROWTH-15 — wordsLoggedCount is a count, never the words", () => {
  const langObs = [
    { id: "w1", timestamp: daysAgo(0), language: "Hebrew", phrase: "אבא" },
    { id: "w2", timestamp: daysAgo(0), language: "Hebrew", phrase: "כדור" },
    { id: "w3", timestamp: daysAgo(12), language: "Hebrew", phrase: "מים" }, // outside window
  ];

  it("sanitizeWeeklyContext rejects strings in wordsLoggedCount (dropped, not coerced)", () => {
    for (const junk of ["2", "אבא, כדור", ["אבא"], { n: 2 }, NaN, null]) {
      const out = sanitizeWeeklyContext({ momentCount: 1, milestonesCrossedCount: 0, wordsLoggedCount: junk });
      expect(out).toEqual({ momentCount: 1, milestonesCrossedCount: 0 });
      expect(out && "wordsLoggedCount" in out).toBe(false);
    }
  });

  it("sanitizeWeeklyContext clamps a numeric wordsLoggedCount like the other counts", () => {
    expect(sanitizeWeeklyContext({ momentCount: 0, milestonesCrossedCount: 0, wordsLoggedCount: 2 })).toEqual({ momentCount: 0, milestonesCrossedCount: 0, wordsLoggedCount: 2 });
    expect(sanitizeWeeklyContext({ momentCount: 0, milestonesCrossedCount: 0, wordsLoggedCount: 5000.4 })?.wordsLoggedCount).toBe(999);
    expect(sanitizeWeeklyContext({ momentCount: 0, milestonesCrossedCount: 0, wordsLoggedCount: -1 })?.wordsLoggedCount).toBe(0);
  });

  it("request snapshot: two Hebrew words today ⇒ the /chat body carries wordsLoggedCount: 2 and no phrase text", () => {
    const body = buildChatContext({
      thread: [], behaviorLogs: [], milestones: [], actionLoop: [], langObs, weeklyContextEnabled: true, now: NOW,
    });
    expect(body).toEqual({ weeklyContext: { momentCount: 0, milestonesCrossedCount: 0, wordsLoggedCount: 2 } });
    const wire = JSON.stringify(body);
    for (const phrase of ["אבא", "כדור", "מים", "Hebrew"]) expect(wire).not.toContain(phrase);
    // the server's re-sanitation keeps the count
    expect(sanitizeWeeklyContext(JSON.parse(wire).weeklyContext)?.wordsLoggedCount).toBe(2);
  });

  it("toggle OFF sends nothing; no ledger passed ⇒ the field is ABSENT (legacy bytes)", () => {
    expect("weeklyContext" in buildChatContext({ thread: [], behaviorLogs: [], milestones: [], actionLoop: [], langObs, weeklyContextEnabled: false, now: NOW })).toBe(false);
    const legacy = buildChatContext({ thread: [], behaviorLogs: [], milestones: [], actionLoop: [], weeklyContextEnabled: true, now: NOW });
    expect(legacy.weeklyContext && "wordsLoggedCount" in legacy.weeklyContext).toBe(false);
  });

  it("NEGATIVE CONTROL — a coercing sanitizer would have let the phrase list through", () => {
    const coerce = (v: unknown) => (typeof v === "string" ? v : null);
    expect(coerce("אבא, כדור")).toContain("אבא");
  });
});
