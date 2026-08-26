/**
 * F-09 — ONE counting source of truth for "this week in the story".
 *
 * JournalTab previously showed two contradictory numbers side by side: the
 * week stat counted the trailing-7-day window while the "connecting N recent
 * moments" story copy sliced the ALL-TIME stream — so a journal whose last
 * entry was a month old still claimed "connecting 3 recent moments" next to a
 * week count of 0. Both now derive from the shared `weekWindow` selector:
 * weekCount = weekWindow(...).length, recentSignals = that SAME list sliced,
 * so the story count can never exceed the adjacent stat.
 */
import { describe, expect, it } from "vitest";
import { weekWindow, type TimelineSignal } from "./signalTimeline.js";
import { translate } from "./i18n";

const NOW = new Date("2026-08-20T12:00:00.000Z").getTime();
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

const sig = (at: string | null, id = Math.random().toString(36).slice(2)): TimelineSignal => ({
  id,
  kind: "moment",
  at,
  tone: "mint",
});

describe("weekWindow — the trailing-7-day selector", () => {
  it("keeps only dated signals inside (now − 7d, now]", () => {
    const inWin1 = sig(daysAgo(1), "a");
    const inWin6 = sig(daysAgo(6), "b");
    const out8 = sig(daysAgo(8), "c");
    const undated = sig(null, "d");
    const future = sig(daysAgo(-1), "e");
    const got = weekWindow([inWin1, inWin6, out8, undated, future], NOW);
    expect(got.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("preserves the input order (newest-first from buildTimeline)", () => {
    const s1 = sig(daysAgo(0.5), "newest");
    const s2 = sig(daysAgo(2), "mid");
    const s3 = sig(daysAgo(6.5), "oldest");
    expect(weekWindow([s1, s2, s3], NOW).map((s) => s.id)).toEqual(["newest", "mid", "oldest"]);
  });

  it("drops signals with unparseable timestamps", () => {
    expect(weekWindow([sig("garbage", "x"), sig(daysAgo(1), "y")], NOW).map((s) => s.id)).toEqual(["y"]);
  });

  it("returns [] for an empty or fully-stale stream", () => {
    expect(weekWindow([], NOW)).toEqual([]);
    expect(weekWindow([sig(daysAgo(30)), sig(daysAgo(400)), sig(null)], NOW)).toEqual([]);
  });
});

describe("F-09 — story copy count can never exceed the week stat", () => {
  /** Mirrors JournalTab's derivation: both numbers come from ONE list. */
  const derive = (signals: TimelineSignal[]) => {
    const weekSignals = weekWindow(signals, NOW);
    return { weekCount: weekSignals.length, storyCount: weekSignals.slice(0, 3).length };
  };

  it("storyCount <= weekCount across window shapes", () => {
    const cases: TimelineSignal[][] = [
      [],
      [sig(daysAgo(1))],
      [sig(daysAgo(1)), sig(daysAgo(2)), sig(daysAgo(3)), sig(daysAgo(4))],
      [sig(daysAgo(30)), sig(daysAgo(31)), sig(daysAgo(32))],
      [sig(daysAgo(1)), sig(daysAgo(30)), sig(null)],
    ];
    for (const signals of cases) {
      const { weekCount, storyCount } = derive(signals);
      expect(storyCount).toBeLessThanOrEqual(weekCount);
    }
  });

  it("the regression case: an all-stale journal claims 0 moments, not 3", () => {
    const stale = [sig(daysAgo(30)), sig(daysAgo(45)), sig(daysAgo(60))];
    const { weekCount, storyCount } = derive(stale);
    expect(weekCount).toBe(0);
    expect(storyCount).toBe(0); // pre-fix: signals.slice(0,3).length === 3
  });

  it("an empty window routes to journal.story.empty, which reads as a real sentence (en+he)", () => {
    const { storyCount } = derive([sig(daysAgo(20))]);
    expect(storyCount).toBe(0);
    for (const lang of ["en", "he"] as const) {
      const empty = translate(lang, "journal.story.empty");
      expect(empty).not.toBe("journal.story.empty"); // key resolves
      expect(empty).not.toContain("{count}"); // no dangling interpolation
      expect(empty.length).toBeGreaterThan(10);
    }
  });
});
