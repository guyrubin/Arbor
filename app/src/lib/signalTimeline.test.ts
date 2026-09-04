import { describe, expect, it } from "vitest";
import {
  buildTimeline,
  computeMomentum,
  deriveNextStep,
  groupByDay,
  isAutoSignal,
  SIGNAL_PROVENANCE,
  signalDetail,
  signalMeta,
  signalTitle,
  TIMELINE_SOURCE_IDS,
  type SignalKind,
  type TranslateFn,
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
    });

    // 2 logs + 1 checked milestone (unchecked excluded) + 1 plan + 1 memory = 5
    expect(signals).toHaveLength(5);
    // newest dated first
    expect(signals[0].kind).toBe("moment");
    expect(signals[0].at).toBe(daysAgo(1));
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

  // JRNL-5 — a confirmed observation carries the day the parent noticed it.
  it("dates a checked milestone from observationUpdatedAt; legacy undated stays Ongoing", () => {
    const dated = milestone({ id: "dated", checked: true, observationUpdatedAt: daysAgo(0) });
    const legacy = milestone({ id: "legacy", checked: true });
    const signals = buildTimeline({ milestones: [dated, legacy] });

    expect(signals.find((s) => s.id === "milestone-dated")?.at).toBe(daysAgo(0));
    expect(signals.find((s) => s.id === "milestone-legacy")?.at).toBeNull();

    const groups = groupByDay(signals, NOW, { locale: "en" });
    expect(groups[0].label).toBe("Today");
    expect(groups[0].signals.map((s) => s.id)).toContain("milestone-dated");
    expect(groups[groups.length - 1].label).toBe("Ongoing");
    expect(groups[groups.length - 1].signals.map((s) => s.id)).toContain("milestone-legacy");
  });

  // JRNL-3 — signals are structured; no baked display English in the stream.
  it("emits structured signals with no baked English UI copy", () => {
    const serialized = JSON.stringify(buildTimeline({
      behaviorLogs: [log()],
      milestones: [milestone({ checked: true, observationUpdatedAt: daysAgo(0) })],
      plans: [plan()],
      memory: [{ memoryId: "m1", childId: "c", status: "approved", fact: "Loves trains", source: "chat", retention: "30 days", createdAt: daysAgo(2), latestEventId: "e" }],
      play: [{ id: "pl1", activityId: "a", title: "Freeze dance", domain: "motor", reason: "concern-match", source: "today", timestamp: daysAgo(1) }],
    }));
    for (const baked of [
      "Logged moment", "Observed:", "Growth plan", " steps",
      "Approved to memory", "Played:", "Builds ",
      "matched to a recent pattern",
    ]) {
      expect(serialized).not.toContain(baked);
    }
  });
});

/* ── AI-04 — the consent gate over Ask threads ────────────────────────────── */

describe("AI-04 consent gate: an Ask thread never folds itself into the child's stream", () => {
  /**
   * The exact row ArborContext.commitConversationProposal writes when the
   * parent taps "Keep this" on a typed answer: a behaviorLogs document whose
   * id is `typed-<proposalId>`, whose trigger is the kept sentence and whose
   * notes carry the parent's own question. Nothing else about it is special —
   * which is the whole point of the design: consent is expressed by the row
   * existing at all.
   */
  const keptRow = (): BehaviorLog => ({
    id: "typed-prop-1",
    timestamp: daysAgo(0),
    behaviorType: "Journal moment",
    intensity: 1,
    durationMinutes: 0,
    trigger: "Move bathtime fifteen minutes earlier tonight.",
    response: "Parent-confirmed from a typed coach conversation",
    notes: "Bedtime is a battle every night. What do I do?",
    context: "Home",
    conversationProposalId: "prop-1",
    sourceExcerpt: "Bedtime is a battle every night. What do I do?",
  });

  it("POSITIVE: what the parent KEPT still reaches the timeline, via its Journal row", () => {
    const row = keptRow();
    // NEGATIVE CONTROL for vacuity: the fixture genuinely carries the kept
    // sentence, so an empty-in/empty-out pass cannot green-light this.
    expect(row.trigger.trim().length).toBeGreaterThan(0);

    const signals = buildTimeline({ behaviorLogs: [row] });
    expect(signals).toHaveLength(1);
    // buildTimeline ingests behaviorLogs and keys the signal `moment-<logId>`
    // — the same prefix captureProvenance.provenanceForSignal resolves, so the
    // kept row can still show where it came from.
    expect(signals[0].id).toBe("moment-typed-prop-1");
    expect(signals[0].kind).toBe("moment");
    expect(signalDetail(signals[0], (k) => `[${k}]`)).toBe(row.trigger);
  });

  it("NEGATIVE CONTROL: a raw conversation handed in as a source produces NOTHING", () => {
    // The key is gone from TimelineSources, so this is deliberately cast: the
    // assertion is about the RUNTIME, not the types. A gate that only exists
    // in the type system would still fold the rows at runtime, which is the
    // exact defect this test exists to catch.
    const withThreads = {
      conversations: [{ id: "conv1", title: "Bedtime help", updatedAt: daysAgo(0) }],
    } as unknown as Parameters<typeof buildTimeline>[0];
    // The fixture is real and non-empty — otherwise "no signals" proves nothing.
    expect((withThreads as unknown as { conversations: unknown[] }).conversations).toHaveLength(1);
    expect(buildTimeline(withThreads)).toEqual([]);
    // …and the same builder DOES produce a row from a real source, so the
    // empty result above is the gate, not a broken call.
    expect(buildTimeline({ behaviorLogs: [keptRow()] })).toHaveLength(1);
  });

  it("the ingest registry no longer offers 'conversations' as a declarable source", () => {
    // SC-4 in surfaceContract.test.ts resolves every threadWrite against this
    // list; leaving a key nothing reads would let a future surface declare a
    // thread write into a void and still pass.
    expect(TIMELINE_SOURCE_IDS.length).toBeGreaterThan(0);
    expect(TIMELINE_SOURCE_IDS).toContain("behaviorLogs");
    expect(TIMELINE_SOURCE_IDS as readonly string[]).not.toContain("conversations");
  });
});

// JRNL-4 — provenance honesty: the parent authored moments, confirmed
// milestones and play; Arbor authored memory facts and plans;
// the CHILD authored practice-kind activity (masterplan 1.4).
describe("signal provenance", () => {
  it("locks the kind → provenance table (MANUAL = moment/milestone/play, CHILD = practice)", () => {
    expect(SIGNAL_PROVENANCE).toEqual({
      moment: "manual",
      milestone: "manual",
      play: "manual",
      plan: "auto",
      memory: "auto",
      // AI-04 (consent gate): there is no "coach" kind. A kept line is the
      // parent's own act and rides in as kind "moment" / provenance manual.
      practice: "child",
      // TJB-05 — accepting the day's step and saying how it went are the
      // PARENT's acts, even though Arbor offered the step.
      action: "manual",
    });
    expect(isAutoSignal("moment")).toBe(false);
    expect(isAutoSignal("milestone")).toBe(false);
    expect(isAutoSignal("play")).toBe(false);
    expect(isAutoSignal("plan")).toBe(true);
    expect(isAutoSignal("memory")).toBe(true);
    // Child activity is neither the parent's manual log nor an Arbor derivation.
    expect(isAutoSignal("practice")).toBe(false);
  });
});

// JRNL-3 — render helpers label structured signals through i18n keys only.
describe("signal render labels", () => {
  const t: TranslateFn = (key, vars) => `[${key}${vars ? "|" + Object.entries(vars).map(([k, v]) => `${k}=${v}`).join(",") : ""}]`;

  it("resolves every kind's title through timeline.* keys", () => {
    const signals = buildTimeline({
      behaviorLogs: [log({ id: "b1", behaviorType: "Sensory Meltdown" }), log({ id: "b2", behaviorType: "" })],
      milestones: [milestone({ id: "m1", checked: true, title: "First words" })],
      plans: [plan({ id: "p1", title: "" })],
      memory: [{ memoryId: "mem1", childId: "c", status: "approved", fact: "Loves trains", source: "chat", retention: "30 days", createdAt: daysAgo(2), latestEventId: "e" }],
      play: [{ id: "pl1", activityId: "a", title: "Freeze dance", domain: "motor", reason: "stage-match", source: "today", timestamp: daysAgo(1) }],
    });
    const byId = (id: string) => signals.find((s) => s.id === id)!;

    expect(signalTitle(byId("moment-b1"), t)).toBe("Sensory Meltdown");
    expect(signalTitle(byId("moment-b2"), t)).toBe("[timeline.title.moment]");
    expect(signalTitle(byId("milestone-m1"), t)).toBe("[timeline.title.observed|title=First words]");
    expect(signalTitle(byId("plan-p1"), t)).toBe("[timeline.title.plan]");
    expect(signalTitle(byId("memory-mem1"), t)).toBe("[timeline.title.memory]");
    expect(signalTitle(byId("play-pl1"), t)).toBe("[timeline.title.played|title=Freeze dance]");
  });

  it("localizes play detail, plan steps, duration and pattern-match meta", () => {
    const signals = buildTimeline({
      behaviorLogs: [log({ id: "b1", context: "Home", durationMinutes: 15 })],
      plans: [plan({ id: "p1" })],
      play: [{ id: "pl1", activityId: "a", title: "Freeze dance", domain: "motor", reason: "concern-match", source: "today", timestamp: daysAgo(1) }],
    });
    const byId = (id: string) => signals.find((s) => s.id === id)!;

    expect(signalDetail(byId("play-pl1"), t)).toBe("[timeline.detail.builds|domain=[timeline.playdomain.motor]]");
    expect(signalMeta(byId("play-pl1"), t)).toBe("[timeline.meta.match]");
    expect(signalMeta(byId("plan-p1"), t)).toBe("[timeline.meta.steps|done=1,total=2]");
    expect(signalMeta(byId("moment-b1"), t)).toBe("Home · [timeline.meta.minutes|n=15]");
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
    const groups = groupByDay(signals, NOW, { locale: "en" });
    expect(groups[0].label).toBe("Today");
    expect(groups.some((g) => g.label === "Yesterday")).toBe(true);
    expect(groups[groups.length - 1].label).toBe("Ongoing");
  });

  // JRNL-3 — day-group labels localize via Intl + the ongoing label is injected.
  it("localizes day labels for Hebrew and honors the injected ongoing label", () => {
    const signals = buildTimeline({
      behaviorLogs: [log({ timestamp: daysAgo(0) }), log({ timestamp: daysAgo(1) })],
      plans: [plan()],
    });
    const groups = groupByDay(signals, NOW, { locale: "he", ongoingLabel: "מתמשך" });
    expect(groups[0].label).toBe("היום");
    expect(groups.some((g) => g.label === "אתמול")).toBe(true);
    expect(groups[groups.length - 1].label).toBe("מתמשך");
    // No English leaks into any HE group label.
    for (const g of groups) expect(g.label).not.toMatch(/[A-Za-z]/);
  });
});
