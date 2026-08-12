import { describe, expect, it } from "vitest";
import {
  buildMonthsLayer,
  buildTimeline,
  SIGNAL_PROVENANCE,
  signalDetail,
  signalMeta,
  signalTitle,
  type TranslateFn,
} from "./signalTimeline.js";
import type {
  AdventureResult,
  HeroJourneyRun,
  Milestone,
  MimicSession,
  MissionRecord,
  PracticeEvent,
  SpeechAttempt,
} from "../types";

/**
 * Masterplan 1.4 + 1.8 — child-activity fold (kind "practice", provenance
 * "child", same-day same-type aggregation) and the months layer (milestone
 * crossings + CUMULATIVE monotonic totals, no per-period series).
 */

const NOW = new Date("2026-06-06T12:00:00.000Z").getTime();
const daysAgo = (n: number, hour = 12) =>
  new Date(NOW - n * 24 * 60 * 60 * 1000 + (hour - 12) * 60 * 60 * 1000).toISOString();

const speech = (id: string, timestamp: string): SpeechAttempt => ({
  id, sound: "s", level: "word", target: "sun",
  result: "got", method: "parent", timestamp,
});

const practiceEvent = (id: string, timestamp: string): PracticeEvent => ({
  id, kind: "memory", domain: "cognition", timestamp,
});

const mimic = (id: string, timestamp: string): MimicSession => ({
  id, packId: "p", promptId: "pr", rating: 2, timestamp,
});

const adventure = (id: string, timestamp: string): AdventureResult => ({
  id, scenarioId: "sc", sceneId: "s1", skill: "logic", correct: true, timestamp,
});

const mission = (id: string, timestamp: string, completed = true): MissionRecord => ({
  id, date: timestamp.slice(0, 10), missionId: "m", domain: "language", completed, timestamp,
});

const heroRun = (id: string, startedAt: string, completedAt?: string): HeroJourneyRun => ({
  id, storyId: "st", title: "The Brave Fox", language: "en", startedAt, completedAt,
  metricsEarned: {},
  render: { storyId: "st", title: "The Brave Fox", scenes: [], choices: [], reflection: { practiced: [], questions: [] } },
});

const milestone = (over: Partial<Milestone> = {}): Milestone => ({
  id: Math.random().toString(36).slice(2),
  domain: "social_development",
  ageGroup: "3-5y",
  title: "Takes turns in play",
  description: "",
  checked: true,
  ...over,
});

describe("buildTimeline — child-activity fold", () => {
  it("aggregates same-day same-type events into ONE signal with a count", () => {
    const signals = buildTimeline({
      speechAttempts: [
        speech("a", daysAgo(1, 9)),
        speech("b", daysAgo(1, 11)),
        speech("c", daysAgo(1, 15)),
      ],
    });
    expect(signals).toHaveLength(1);
    const s = signals[0];
    expect(s.kind).toBe("practice");
    expect(s.practiceType).toBe("speech");
    expect(s.count).toBe(3);
    // The aggregate carries the LATEST timestamp of the day (recency ordering).
    expect(s.at).toBe(daysAgo(1, 15));
    // Stable per-day id.
    expect(s.id).toBe(`child-speech-${daysAgo(1).slice(0, 10)}`);
  });

  it("keeps different days and different types as separate signals", () => {
    const signals = buildTimeline({
      speechAttempts: [speech("a", daysAgo(1)), speech("b", daysAgo(2))],
      mimicSessions: [mimic("m", daysAgo(1))],
      practiceEvents: [practiceEvent("p", daysAgo(1))],
      adventureResults: [adventure("adv", daysAgo(3))],
    });
    expect(signals).toHaveLength(5);
    const types = signals.map((s) => `${s.practiceType}-${s.at?.slice(0, 10)}`).sort();
    expect(new Set(types).size).toBe(5);
  });

  it("orders child signals newest-first, interleaved with parent signals", () => {
    const signals = buildTimeline({
      behaviorLogs: [{
        id: "b1", timestamp: daysAgo(2), behaviorType: "Morning refusal",
        intensity: 2, durationMinutes: 5, trigger: "", response: "", context: "Home",
      }],
      speechAttempts: [speech("a", daysAgo(1))],
      adventureResults: [adventure("adv", daysAgo(3))],
    });
    expect(signals.map((s) => s.id)).toEqual([
      `child-speech-${daysAgo(1).slice(0, 10)}`,
      "moment-b1",
      `child-adventure-${daysAgo(3).slice(0, 10)}`,
    ]);
  });

  it("counts only COMPLETED missions and prefers a hero run's completion moment", () => {
    const signals = buildTimeline({
      missionRecords: [
        mission("m1", daysAgo(1), true),
        mission("m2", daysAgo(1), false), // not a story beat
      ],
      heroRuns: [
        heroRun("h1", daysAgo(4), daysAgo(2)), // completed → dated by completedAt
        heroRun("h2", daysAgo(5)),             // in progress → dated by startedAt
      ],
    });
    const missionSig = signals.find((s) => s.practiceType === "mission")!;
    expect(missionSig.count).toBe(1);
    const heroDays = signals.filter((s) => s.practiceType === "hero").map((s) => s.at!.slice(0, 10));
    expect(heroDays.sort()).toEqual([daysAgo(5).slice(0, 10), daysAgo(2).slice(0, 10)].sort());
  });

  it("stamps provenance 'child' and stays structured (no baked English, no result/score leak)", () => {
    const signals = buildTimeline({
      speechAttempts: [speech("a", daysAgo(1)), speech("b", daysAgo(1))],
      adventureResults: [adventure("adv", daysAgo(1))],
    });
    for (const s of signals) {
      expect(SIGNAL_PROVENANCE[s.kind]).toBe("child");
    }
    // FIREWALL: correctness/ratings/scores from the raw records never survive
    // the fold — only the type, the day, and the flat count.
    const serialized = JSON.stringify(signals);
    for (const leak of ["correct", "result", "score", "rating", "got", "missed", "Completed", "practice rounds"]) {
      expect(serialized).not.toContain(leak);
    }
  });

  it("resolves practice titles through elev.childsignals.* keys, count-aware", () => {
    const t: TranslateFn = (key, vars) =>
      `[${key}${vars ? "|" + Object.entries(vars).map(([k, v]) => `${k}=${v}`).join(",") : ""}]`;
    const signals = buildTimeline({
      speechAttempts: [speech("a", daysAgo(1)), speech("b", daysAgo(1))],
      missionRecords: [mission("m1", daysAgo(2))],
    });
    const speechSig = signals.find((s) => s.practiceType === "speech")!;
    const missionSig = signals.find((s) => s.practiceType === "mission")!;
    expect(signalTitle(speechSig, t)).toBe("[elev.childsignals.title.speech.many|count=2]");
    expect(signalTitle(missionSig, t)).toBe("[elev.childsignals.title.mission.one|count=1]");
    // No extra detail/meta — the title carries the whole warm event.
    expect(signalDetail(speechSig, t)).toBe("");
    expect(signalMeta(speechSig, t)).toBeUndefined();
  });
});

describe("buildMonthsLayer — months spine (masterplan 1.8)", () => {
  // Fixed absolute dates so month boundaries are deterministic.
  const at = (iso: string) => iso;

  it("groups by month, newest first, with milestone crossings as events", () => {
    const signals = buildTimeline({
      behaviorLogs: [
        { id: "b1", timestamp: at("2026-03-05T10:00:00.000Z"), behaviorType: "X", intensity: 1, durationMinutes: 1, trigger: "", response: "", context: "Home" },
        { id: "b2", timestamp: at("2026-04-10T10:00:00.000Z"), behaviorType: "Y", intensity: 1, durationMinutes: 1, trigger: "", response: "", context: "Home" },
      ],
      milestones: [
        milestone({ id: "m1", title: "First words", observationUpdatedAt: at("2026-03-20T09:00:00.000Z") }),
      ],
    });
    const nodes = buildMonthsLayer(signals);
    expect(nodes.map((n) => n.key)).toEqual(["2026-04", "2026-03"]);
    expect(nodes[1].milestones.map((m) => m.refTitle)).toEqual(["First words"]);
    expect(nodes[0].milestones).toHaveLength(0);
  });

  it("keeps cumulative totals MONOTONIC and correct at month boundaries", () => {
    const signals = buildTimeline({
      behaviorLogs: [
        // Jan: 2 · Feb: 0 (no node) · Mar: 3 — including boundary instants.
        { id: "j1", timestamp: at("2026-01-01T00:00:00.000Z"), behaviorType: "a", intensity: 1, durationMinutes: 1, trigger: "", response: "", context: "Home" },
        { id: "j2", timestamp: at("2026-01-31T23:59:59.000Z"), behaviorType: "b", intensity: 1, durationMinutes: 1, trigger: "", response: "", context: "Home" },
        { id: "r1", timestamp: at("2026-03-01T00:00:00.000Z"), behaviorType: "c", intensity: 1, durationMinutes: 1, trigger: "", response: "", context: "Home" },
        { id: "r2", timestamp: at("2026-03-15T12:00:00.000Z"), behaviorType: "d", intensity: 1, durationMinutes: 1, trigger: "", response: "", context: "Home" },
      ],
      speechAttempts: [speech("s1", at("2026-03-02T08:00:00.000Z"))],
    });
    const nodes = buildMonthsLayer(signals);
    // Newest first: March (2 moments + 1 speech aggregate = 3 signals) then January (2).
    expect(nodes.map((n) => n.key)).toEqual(["2026-03", "2026-01"]);
    expect(nodes[1].cumulativeMoments).toBe(2);      // by January: 2
    expect(nodes[0].cumulativeMoments).toBe(5);      // by March: 5 (monotonic)
    // Monotonicity oldest → newest across the whole layer.
    const oldestFirst = [...nodes].reverse();
    for (let i = 1; i < oldestFirst.length; i++) {
      expect(oldestFirst[i].cumulativeMoments).toBeGreaterThanOrEqual(oldestFirst[i - 1].cumulativeMoments);
    }
  });

  it("excludes undated signals and never exposes a per-month count field", () => {
    const signals = buildTimeline({
      plans: [{ id: "p1", title: "Plan", issue: "", phases: [], scripts: [], successIndicators: [] }],
      behaviorLogs: [
        { id: "b1", timestamp: at("2026-05-05T10:00:00.000Z"), behaviorType: "x", intensity: 1, durationMinutes: 1, trigger: "", response: "", context: "Home" },
      ],
    });
    const nodes = buildMonthsLayer(signals);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].cumulativeMoments).toBe(1);
    // FIREWALL: the node shape carries events + a cumulative total only — a
    // per-month count would be a period-vs-period series one render away.
    expect(Object.keys(nodes[0]).sort()).toEqual(["cumulativeMoments", "key", "milestones"]);
  });

  it("returns an empty layer for an empty or all-undated stream", () => {
    expect(buildMonthsLayer([])).toEqual([]);
    const undatedOnly = buildTimeline({
      plans: [{ id: "p1", title: "Plan", issue: "", phases: [], scripts: [], successIndicators: [] }],
    });
    expect(buildMonthsLayer(undatedOnly)).toEqual([]);
  });
});
