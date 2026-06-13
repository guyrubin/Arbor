import { describe, expect, it } from "vitest";
import type { BehaviorLog, Milestone, PracticeEvent, SpeechAttempt } from "../types";
import { bandTrend, domainBands, domainConfidence, memoryGridSize, pendingSnapshot, weekKey } from "./signals";
import { watchSignals, type WatchInput } from "./watch";
import { composeWeek, suggestObjectives } from "./journey";
import { computeAchievements } from "./achievements";
import { recommend } from "./signals";

const ev = (kind: PracticeEvent["kind"], domain: PracticeEvent["domain"], correct?: boolean, score?: number, meta?: string): PracticeEvent => ({
  id: `e-${Math.random()}`, kind, domain, correct, score, meta, timestamp: new Date().toISOString(),
});

const ms = (domain: Milestone["domain"], checked: boolean): Milestone => ({
  id: `m-${Math.random()}`, domain, ageGroup: "4-5", title: "t", description: "d", checked,
});

describe("bands with practice events + hero metrics", () => {
  it("blends Feelings Lab accuracy into the emotional band", () => {
    const withEvents = domainBands([ms("attachment_regulation", false)], [], [], [],
      [ev("emotion-id", "emotional", true), ev("emotion-id", "emotional", true), ev("emotion-id", "emotional", true)]);
    const without = domainBands([ms("attachment_regulation", false)], [], [], []);
    const e1 = withEvents.find((b) => b.domain === "emotional")!;
    const e0 = without.find((b) => b.domain === "emotional")!;
    expect(e1.signal).toBeGreaterThan(e0.signal);
    expect(e1.basis).toContain("Feelings Lab");
  });

  it("nudges social from story-choice empathy, capped", () => {
    const bands = domainBands([], [], [], [], [], { empathy: 10, courage: 0, resilience: 0, responsibility: 0, wisdom: 0 });
    const social = bands.find((b) => b.domain === "social")!;
    expect(social.basis).toContain("story choices");
    expect(social.signal).toBeLessThanOrEqual(58 + 10); // 50 base + 8 cap (+rounding)
  });

  it("blends memory scores into cognition", () => {
    const bands = domainBands([], [], [], [], [ev("memory", "cognition", undefined, 90), ev("memory", "cognition", undefined, 80)]);
    expect(bands.find((b) => b.domain === "cognition")!.basis).toContain("Memory Match");
  });
});

describe("confidence + snapshots", () => {
  it("confidence grows with observed data", () => {
    expect(domainConfidence("emotional", [], [], [], [], [])).toBe("low");
    const events = Array.from({ length: 25 }, () => ev("emotion-id", "emotional", true));
    expect(domainConfidence("emotional", [], [], [], events, [])).toBe("high");
  });

  it("takes one snapshot per ISO week", () => {
    const bands = domainBands([], [], [], []);
    const snap = pendingSnapshot([], bands, "2026-06-12");
    expect(snap?.id).toBe(weekKey(new Date("2026-06-12T12:00:00")));
    expect(pendingSnapshot([snap!], bands, "2026-06-13")).toBeNull();
  });

  it("computes trend vs previous snapshot", () => {
    const bands = domainBands([], [], [], []);
    const prev = { id: "2026-W23", date: "2026-06-05", bands: bands.map((b) => ({ ...b, signal: b.signal - 10 })) };
    const cur = { id: "2026-W24", date: "2026-06-12", bands: bands.map((b) => ({ domain: b.domain, signal: b.signal, band: b.band })) };
    const t = bandTrend([prev, cur], bands);
    expect(t.language).toBe(10);
  });
});

describe("watch signals (non-diagnostic guardrails)", () => {
  const log = (daysBack: number, intensity: number, durationMinutes = 20): BehaviorLog => ({
    id: `l-${Math.random()}`, timestamp: new Date(Date.now() - daysBack * 86400000).toISOString(),
    behaviorType: "Meltdown", intensity, durationMinutes, trigger: "t", response: "r", context: "Home", resolved: false,
  });
  const base: WatchInput = {
    age: 5, screeningWatchLabels: [], logs: [], stats: [], bands: domainBands([], [], [], []),
    missions: [], adventureScenes: 0, adventureCorrect: 0,
  };

  it("stays silent without real data volume", () => {
    expect(watchSignals(base)).toHaveLength(0);
  });

  it("flags lagging speech sounds only past typical age with enough tries", () => {
    const stats = [{ sound: "p", attempts: 10, accuracy: 30, recentAccuracy: 30, trend: "flat" as const, levelReached: "word" as const }];
    const signals = watchSignals({ ...base, age: 5, stats });
    expect(signals).toHaveLength(1);
    expect(signals[0].level).toBe("monitor");
    expect(signals[0].area).not.toMatch(/ASD|ADHD|autism|disorder/i);
    // same data, younger child → silent (within typical window)
    expect(watchSignals({ ...base, age: 2, stats })).toHaveLength(0);
  });

  it("escalates frequent intense moments to discuss with volume + duration", () => {
    const logs = Array.from({ length: 11 }, (_, i) => log(i, 5, 20));
    const signals = watchSignals({ ...base, logs });
    expect(signals[0].level).toBe("discuss");
    expect(signals[0].evidence.length).toBeGreaterThan(0);
    expect(signals[0].plan.join(" ")).toMatch(/professional/i);
  });

  it("carries screening flags with observable language only", () => {
    const signals = watchSignals({ ...base, screeningWatchLabels: ["Social development"] });
    expect(signals).toHaveLength(1);
    expect(signals[0].domain).toBe("social");
    expect(signals[0].level).toBe("monitor");
  });
});

describe("journey composer", () => {
  const bands = domainBands([ms("attachment_regulation", false), ms("language_communication", true)], [], [], []);
  const rec = recommend(bands, []);

  it("builds a 7-day plan with the focus domain on 3 days", () => {
    const week = composeWeek(bands, rec, "2026-06-12");
    expect(week).toHaveLength(7);
    expect(week.filter((d) => d.isToday)).toHaveLength(1);
    const focusDays = week.filter((d) => {
      const tabByDomain: Record<string, string[]> = {
        speech: ["speech", "mimic"], language: ["speech"], emotional: ["feelings"], cognition: ["adventures"], social: ["stories", "adventures"],
      };
      return tabByDomain[rec.domain].includes(d.extra.tab);
    });
    expect(focusDays.length).toBeGreaterThanOrEqual(3);
  });

  it("is deterministic for the same week", () => {
    const a = composeWeek(bands, rec, "2026-06-12");
    const b = composeWeek(bands, rec, "2026-06-12");
    expect(a.map((d) => d.extra.title)).toEqual(b.map((d) => d.extra.title));
  });

  it("suggests 3 monthly objectives aimed at weak domains", () => {
    const objs = suggestObjectives(bands, "2026-06");
    expect(objs).toHaveLength(3);
    expect(new Set(objs.map((o) => o.id)).size).toBe(3);
    expect(objs.every((o) => o.month === "2026-06" && !o.done)).toBe(true);
  });
});

describe("achievements + adaptive difficulty", () => {
  it("badges are effort-based and start unearned", () => {
    const none = computeAchievements({ speech: [], mimic: [], missions: [], adventures: [], events: [], stats: [], streak: 0, heroRuns: 0 });
    expect(none.every((a) => !a.earned)).toBe(true);
    const some = computeAchievements({
      speech: [{ id: "s", sound: "s", level: "word", target: "sun", result: "got", method: "parent", timestamp: new Date().toISOString() } as SpeechAttempt],
      mimic: [], missions: [], adventures: [], events: [], stats: [], streak: 3, heroRuns: 1,
    });
    expect(some.find((a) => a.id === "first-step")!.earned).toBe(true);
    expect(some.find((a) => a.id === "streak-3")!.earned).toBe(true);
    expect(some.find((a) => a.id === "story-hero")!.earned).toBe(true);
  });

  it("memory grid grows with sustained success and eases back", () => {
    expect(memoryGridSize([])).toBe(6);
    expect(memoryGridSize([90, 90, 90])).toBe(8);
    expect(memoryGridSize([90, 90, 90, 90, 90, 90])).toBe(12);
    expect(memoryGridSize([90, 90, 30, 30, 30])).toBe(6);
  });
});
