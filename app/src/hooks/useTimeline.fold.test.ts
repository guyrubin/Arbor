/* B-ASKJB-34 — the Journal leads with the parent's words: the child's play and
 * stories fold to ONE quiet row per day; identical events are read once. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readTimeline, dedupeByMinute, foldPlayDays } from "../lib/timelineFold";
import { signalDetail, signalTitle, type TimelineSignal } from "../lib/signalTimeline";
import { withChildSignals } from "../lib/i18nElevation/childsignals";

const T = (h: number, m = 0) => `2026-09-17T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`;
const t = withChildSignals((key: string) => key, false);

const parentNote = {
  id: "log-1",
  behaviorType: "A moment",
  timestamp: T(19, 5),
  intensity: 1,
  notes: "She told me the moon follows our car",
} as never;

describe("B-ASKJB-34 — one quiet row a day for play and stories", () => {
  it("a day with 3 practice events + 1 parent note renders 1 parent row + 1 folded row", () => {
    const signals = readTimeline({
      behaviorLogs: [parentNote],
      practiceEvents: [{ id: "p1", kind: "pattern", domain: "cognition", timestamp: T(8, 10) }] as never,
      speechAttempts: [{ id: "s1", sound: "s", level: "word", target: "sun", result: "got", method: "parent", timestamp: T(9, 20) }] as never,
      heroRuns: [{ id: "h1", storyId: "st1", title: "x", language: "en", startedAt: T(17, 0), completedAt: T(17, 30), metricsEarned: {}, render: {} }] as never,
    });
    const day = signals.filter((s) => s.at?.startsWith("2026-09-17"));
    expect(day).toHaveLength(2);
    const parent = day.filter((s) => s.kind === "moment");
    const folded = day.filter((s) => s.kind === "practice");
    expect(parent).toHaveLength(1);
    expect(folded).toHaveLength(1);
    expect(folded[0].folded).toHaveLength(3);
    // the parent's row comes first (newest), the folded row sits at its newest activity
    expect(day[0].kind).toBe("moment");
    expect(folded[0].at).toBe(T(17, 30));
    // the folded row's title is the quiet day line; its detail lists the day's activities (the disclosure)
    expect(signalTitle(folded[0], t)).toBe("Play and stories");
    expect(signalDetail(folded[0], t).split(" · ")).toHaveLength(3);
  });

  it("two identical practice events (same type, same minute) render once", () => {
    const dup = { id: "a", kind: "pattern", domain: "cognition", timestamp: T(8, 10) };
    const signals = readTimeline({ practiceEvents: [dup, { ...dup, id: "b", timestamp: "2026-09-17T08:10:41.000Z" }] as never });
    const practice = signals.filter((s) => s.kind === "practice");
    expect(practice).toHaveLength(1);
    expect(practice[0].count).toBe(1);
    expect(practice[0].folded).toBeUndefined();
  });

  it("the same type in a different minute is two events; undated records are kept", () => {
    const kept = dedupeByMinute(
      [{ k: "pattern", at: T(8, 10) }, { k: "pattern", at: T(8, 11) }, { k: "pattern", at: null }, { k: "pattern", at: null }],
      (x) => x.at,
      (x) => x.k,
    );
    expect(kept).toHaveLength(4);
  });

  it("a parent moment saved twice with the same words in the same minute is one row; different words stay two", () => {
    const twice = readTimeline({ behaviorLogs: [parentNote, { ...(parentNote as object), id: "log-2" } as never] });
    expect(twice.filter((s) => s.kind === "moment")).toHaveLength(1);
    const two = readTimeline({ behaviorLogs: [parentNote, { ...(parentNote as object), id: "log-3", notes: "Different words" } as never] });
    expect(two.filter((s) => s.kind === "moment")).toHaveLength(2);
  });

  it("a day with a single activity keeps its own row; other kinds pass through untouched", () => {
    const one: TimelineSignal = { id: "child-practice-2026-09-17", kind: "practice", at: T(8), tone: "sky", practiceType: "practice", count: 2 };
    const ms: TimelineSignal = { id: "m", kind: "milestone", at: T(9), tone: "mint" };
    expect(foldPlayDays([ms, one])).toEqual([ms, one]);
  });

  it("source pin: the hook reads the thread through readTimeline (no second build)", () => {
    const src = readFileSync(resolve(__dirname, "useTimeline.ts"), "utf8");
    expect(src).toContain('import { readTimeline } from "../lib/timelineFold"');
    expect(src).toMatch(/readTimeline\(\{/);
    expect(src).not.toMatch(/import \{[^}]*\bbuildTimeline\b/);
  });
});
