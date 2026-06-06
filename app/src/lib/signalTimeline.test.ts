import { describe, expect, it } from "vitest";
import {
  buildTimeline,
  computeMomentum,
  deriveNextStep,
  groupByDay,
} from "./signalTimeline.js";
import type { BehaviorLog, Milestone, ActionPlan } from "../types";

const NOW = new Date("2026-06-06T12:00:00.000Z").getTime();
const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

const log = (over: Partial<BehaviorLog> = {}): BehaviorLog => ({
  id: Math.random().toString(36).slice(2),
  timestamp: daysAgo(1),
  behaviorType: "Morning refusal",
  intensity: 3,
  durationMinutes: 15,
  trigger: "Getting dressed",
  response: "Stayed calm",
  context: "Home",
  ...over,
});

const milestone = (over: Partial<Milestone> = {}): Milestone => ({
  id: Math.random().toString(36).slice(2),
  domain: "social_development",
  ageGroup: "3-5y",
  title: "Takes turns in play",
  description: "Shares and waits",
  checked: false,
  ...over,
});

const plan = (over: Partial<ActionPlan> = {}): ActionPlan => ({
  id: "p1",
  title: "Calmer mornings",
  issue: "Transition refusal",
  phases: [{ name: "Phase 1", description: "", steps: [
    { text: "Visual schedule", completed: true },
    { text: "Two choices", completed: false },
  ] }],
  scripts: [],
  successIndicators: [],
  ...over,
});

describe("buildTimeline", () => {
  it("folds every source into one stream, newest first, undated last", () => {
    const signals = buildTimeline({
      behaviorLogs: [log({ timestamp: daysAgo(3) }), log({ timestamp: daysAgo(1) })],
      milestones: [milestone({ checked: true }), milestone({ checked: false })],
      plans: [plan()],
      memory: [{ memoryId: "m1", childId: "c", status: "approved", fact: "Loves trains", source: "chat", retention: "30 days", createdAt: daysAgo(2), latestEventId: "e" }],
      conversations: [{ id: "conv1", title: "Bedtime help", updatedAt: daysAgo(0) }],
    });

    // 2 logs + 1 checked milestone (unchecked excluded) + 1 plan + 1 memory + 1 coach = 6
    expect(signals).toHaveLength(6);
    // newest dated first
    expect(signals[0].kind).toBe("coach");
    // undated (milestone, plan) sink to the end
    expect(signals[signals.length - 1].at).toBeNull();
    // unresolved moment is coral, resolved is mint
    const moments = signals.filter((s) => s.kind === "moment");
    expect(moments.every((m) => m.tone === "coral")).toBe(true);
  });

  it("excludes unchecked milestones and non-approved memory", () => {
    const signals = buildTimeline({
      milestones: [milestone({ checked: false })],
      memory: [{ memoryId: "m", childId: "c", status: "pending", fact: "x", source: "chat", retention: "n", createdAt: daysAgo(1), latestEventId: "e" }],
    });
    expect(signals).toHaveLength(0);
  });
});

describe("computeMomentum", () => {
  it("computes week-over-week trend, easing intensity, and top pattern", () => {
    const logs = [
      // this week: 3 moments, avg intensity 2
      log({ timestamp: daysAgo(1), intensity: 2, behaviorType: "Morning refusal", context: "Home" }),
      log({ timestamp: daysAgo(2), intensity: 2, behaviorType: "Morning refusal", context: "Home" }),
      log({ timestamp: daysAgo(3), intensity: 2, behaviorType: "Bedtime", context: "Home", resolved: true }),
      // last week: 1 moment, avg intensity 4
      log({ timestamp: daysAgo(10), intensity: 4 }),
    ];
    const m = computeMomentum(logs, [plan()], [milestone({ checked: true }), milestone()], NOW);

    expect(m.momentsThisWeek).toBe(3);
    expect(m.momentsPrevWeek).toBe(1);
    expect(m.momentTrend).toBe("up");
    expect(m.avgIntensityThisWeek).toBe(2);
    expect(m.avgIntensityPrevWeek).toBe(4);
    expect(m.intensityTrend).toBe("easing");
    expect(m.topPattern).toBe("Morning refusal");
    expect(m.topContext).toBe("Home");
    expect(m.planSteps).toEqual({ done: 1, total: 2 });
    expect(m.milestones).toEqual({ observed: 1, total: 2 });
    expect(m.winsThisWeek).toBe(1);
  });

  it("handles an empty history without throwing", () => {
    const m = computeMomentum([], [], [], NOW);
    expect(m.momentsThisWeek).toBe(0);
    expect(m.topPattern).toBeNull();
    expect(m.intensityTrend).toBe("none");
  });
});

describe("deriveNextStep", () => {
  it("guides a brand-new parent to capture the first moment", () => {
    const step = deriveNextStep(computeMomentum([], [], [], NOW), "Dylan");
    expect(step?.cta?.label).toBe("Capture a moment");
  });

  it("routes a recurring pattern into a coach prompt", () => {
    const logs = [
      log({ timestamp: daysAgo(1), behaviorType: "Screen shutoff", context: "Home" }),
      log({ timestamp: daysAgo(2), behaviorType: "Screen shutoff", context: "Home" }),
    ];
    const step = deriveNextStep(computeMomentum(logs, [], [], NOW), "Dylan");
    expect(step?.cta?.label.toLowerCase()).toContain("screen shutoff");
    expect(step?.cta?.prompt).toContain("Dylan");
  });
});

describe("groupByDay", () => {
  it("labels Today / Yesterday and buckets undated under Ongoing", () => {
    const signals = buildTimeline({
      behaviorLogs: [log({ timestamp: daysAgo(0) }), log({ timestamp: daysAgo(1) })],
      plans: [plan()],
    });
    const groups = groupByDay(signals, NOW);
    expect(groups[0].label).toBe("Today");
    expect(groups.some((g) => g.label === "Yesterday")).toBe(true);
    expect(groups[groups.length - 1].label).toBe("Ongoing");
  });
});
