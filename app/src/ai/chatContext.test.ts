/**
 * Masterplan 1.3 — unit tests for the ONE context-assembly module:
 *  - server-defensive sanitizers (caps, whitelists, clamps, degrade-to-legacy),
 *  - client-side buildChatContext (thread mapping, live/ack exclusion,
 *    counts-only weekly digest, toggle gating),
 *  - the per-child consent flag (DEFAULT OFF; storage failure ⇒ off).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RECENT_TURNS_MAX,
  RECENT_TURNS_TOTAL_CHAR_CAP,
  RECENT_TURN_CHAR_CAP,
  buildChatContext,
  computeWeeklyContext,
  readWeeklyContextConsent,
  sanitizeRecentTurns,
  sanitizeWeeklyContext,
  weeklyContextConsentKey,
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

describe("weekly-context consent flag — per child, DEFAULT OFF", () => {
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

  it("defaults to OFF when nothing is stored, and OFF when storage is unavailable", () => {
    vi.stubGlobal("localStorage", fakeLocalStorage);
    expect(readWeeklyContextConsent("child-1")).toBe(false);
    vi.unstubAllGlobals(); // node env: no localStorage at all
    expect(readWeeklyContextConsent("child-1")).toBe(false);
  });

  it("round-trips per child under the pinned key shape", () => {
    vi.stubGlobal("localStorage", fakeLocalStorage);
    expect(weeklyContextConsentKey("c9")).toBe("arbor.coach.weeklyContext.c9");
    writeWeeklyContextConsent("c9", true);
    expect(readWeeklyContextConsent("c9")).toBe(true);
    expect(readWeeklyContextConsent("other-child")).toBe(false); // per-child scope
    writeWeeklyContextConsent("c9", false);
    expect(readWeeklyContextConsent("c9")).toBe(false);
    expect(store.has("arbor.coach.weeklyContext.c9")).toBe(false); // off = removed
  });
});
