/**
 * CI-30 — Daily Plan Generator unit tests.
 *
 * Covers:
 *  - assembleWhyLine: all template variants (goal+interest, goal-only, interest-only,
 *    stage, weekend, sparse)
 *  - screenHookRequired gate: why-line passes through screenModelOutputLexical; a
 *    flagged string (condition-name injection) is replaced with the sparse fallback.
 *  - Effect-verb ban: no why-line template contains a banned effect-verb on child capacity.
 *  - Comprehension-token ban: no template contains SLP comprehension tokens.
 *  - buildDailyPlan: sparse/no-goal/happy-path/weekend variants.
 *  - buildGoalObservation: COPPA write-path structure (no progress score / % / trend).
 *  - estimateLoggedDayCount: distinct calendar days from timestamps.
 *  - No progress-aggregation code path (gate requiredFix #3).
 */

import { describe, it, expect } from "vitest";
import {
  assembleWhyLine,
  buildDailyPlan,
  buildGoalObservation,
  estimateLoggedDayCount,
  isWeekendDate,
} from "./dailyPlan";
import { screenModelOutputLexical } from "../safety/outputScreen";
import type { ActiveGoal } from "./goalBuilder";
import type { ScoredActivity } from "../playbank/select";

// ── Fixture helpers ───────────────────────────────────────────────────────────

const MOCK_GOAL: ActiveGoal = {
  goalId: "big-feelings",
  label: "Naming and managing big feelings",
  domainId: "regulation",
  addedAt: new Date().toISOString(),
};

const MOCK_SCORED_ACTIVITY: ScoredActivity = {
  activity: {
    id: "test-act-1",
    title: "Balloon Breathing",
    domain: "regulation",
    bands: ["toddler"],
    durationMin: 15,
    whatItBuilds: "calm and attention",
    steps: ["Breathe in slowly.", "Hold.", "Breathe out."],
    householdItems: ["balloon"],
    skillTags: ["self-regulation"],
    themeableContextSlot: true,
  },
  score: 2.4,
  reason: "goal-match",
};

// ── assembleWhyLine: template variants ────────────────────────────────────────

describe("assembleWhyLine — template variants (screenHookRequired gate)", () => {
  it("sparse path: returns fixed sparse line, never calls condition token", () => {
    const { whyLine, wasFlagged } = assembleWhyLine({
      goalLabel: "Naming and managing big feelings",
      childName: "Maya",
      matchedInterest: "Trains",
      isWeekend: false,
      sparse: true,
    });
    expect(whyLine).toBe(
      "Sharpens as you log more days. Developmentally informed, grounded in CDC/AAP/ASHA/WHO."
    );
    expect(wasFlagged).toBe(false);
  });

  it("goal + interest: contains goal label and interest, no effect-verb on child", () => {
    const { whyLine, wasFlagged } = assembleWhyLine({
      goalLabel: "Naming and managing big feelings",
      childName: "Maya",
      matchedInterest: "Trains",
      isWeekend: false,
      sparse: false,
    });
    expect(whyLine).toContain("Naming and managing big feelings");
    expect(whyLine).toContain("Trains");
    expect(whyLine).toContain("Maya");
    expect(wasFlagged).toBe(false);
    // screenModelOutputLexical must pass the assembled string
    expect(screenModelOutputLexical(whyLine).flagged).toBe(false);
  });

  it("goal only (no interest): contains goal label, no interest placeholder", () => {
    const { whyLine, wasFlagged } = assembleWhyLine({
      goalLabel: "Settling at drop-off / easing separations",
      childName: "Noah",
      matchedInterest: null,
      isWeekend: false,
      sparse: false,
    });
    expect(whyLine).toContain("Settling at drop-off");
    expect(whyLine).toContain("Noah");
    expect(wasFlagged).toBe(false);
    expect(screenModelOutputLexical(whyLine).flagged).toBe(false);
  });

  it("interest only (no goal): contains interest, no goal reference", () => {
    const { whyLine, wasFlagged } = assembleWhyLine({
      goalLabel: null,
      childName: "Lila",
      matchedInterest: "Dinosaurs",
      isWeekend: false,
      sparse: false,
    });
    expect(whyLine).toContain("Dinosaurs");
    expect(whyLine).toContain("Lila");
    expect(wasFlagged).toBe(false);
    expect(screenModelOutputLexical(whyLine).flagged).toBe(false);
  });

  it("stage fallback (no goal, no interest): generic developmentally informed line", () => {
    const { whyLine, wasFlagged } = assembleWhyLine({
      goalLabel: null,
      childName: "Ben",
      matchedInterest: null,
      isWeekend: false,
      sparse: false,
    });
    expect(whyLine).toContain("Ben");
    expect(whyLine).toContain("Developmentally informed");
    expect(wasFlagged).toBe(false);
    expect(screenModelOutputLexical(whyLine).flagged).toBe(false);
  });

  it("weekend + goal: contains weekend note and goal label", () => {
    const { whyLine, wasFlagged } = assembleWhyLine({
      goalLabel: "Winding down at bedtime",
      childName: "Emma",
      matchedInterest: null,
      isWeekend: true,
      sparse: false,
    });
    expect(whyLine).toContain("weekend plan");
    expect(whyLine).toContain("Winding down at bedtime");
    expect(wasFlagged).toBe(false);
    expect(screenModelOutputLexical(whyLine).flagged).toBe(false);
  });

  it("weekend no goal: contains weekend note, no goal reference", () => {
    const { whyLine, wasFlagged } = assembleWhyLine({
      goalLabel: null,
      childName: "Tom",
      matchedInterest: null,
      isWeekend: true,
      sparse: false,
    });
    expect(whyLine).toContain("weekend plan");
    expect(wasFlagged).toBe(false);
    expect(screenModelOutputLexical(whyLine).flagged).toBe(false);
  });
});

// ── screenHookRequired gate: condition-name injection is flagged and replaced ──

describe("screenHookRequired gate — condition-name injection must be blocked", () => {
  it("if a goal label somehow contained a condition name, assembleWhyLine falls back to sparse", () => {
    // Simulate a label that bypassed the CI-28 lint (defensive test).
    // The CONDITIONS regex in screenModelOutputLexical should catch it.
    // Note: CI-28 lint should prevent this at build time; this is a runtime defence.
    const { whyLine, wasFlagged } = assembleWhyLine({
      // This string would have been blocked by CI-28 lint in practice.
      // Here we test the CI-30 runtime screen defence.
      goalLabel: "your child has autism",  // would be flagged by CONDITIONS regex
      childName: "Alex",
      matchedInterest: null,
      isWeekend: false,
      sparse: false,
    });
    // The assembled string "Picked because you're working on your child has autism with Alex"
    // should be flagged by screenModelOutputLexical (diagnosis pattern).
    expect(wasFlagged).toBe(true);
    // The displayed line must be the safe sparse fallback, never the flagged string.
    expect(whyLine).toBe(
      "Sharpens as you log more days. Developmentally informed, grounded in CDC/AAP/ASHA/WHO."
    );
    // The returned why-line itself must pass the screen.
    expect(screenModelOutputLexical(whyLine).flagged).toBe(false);
  });

  it("all allowed why-line variants pass screenModelOutputLexical", () => {
    const cases = [
      {
        goalLabel: "Following multi-step instructions",
        childName: "Sam",
        matchedInterest: "Space",
        isWeekend: false,
        sparse: false,
      },
      {
        goalLabel: "Taking turns and sharing",
        childName: "Mia",
        matchedInterest: null,
        isWeekend: true,
        sparse: false,
      },
      {
        goalLabel: null,
        childName: "Leo",
        matchedInterest: "Animals",
        isWeekend: false,
        sparse: false,
      },
      {
        goalLabel: null,
        childName: "Zoe",
        matchedInterest: null,
        isWeekend: false,
        sparse: false,
      },
    ];
    for (const c of cases) {
      const { whyLine } = assembleWhyLine(c);
      expect(
        screenModelOutputLexical(whyLine).flagged,
        `Expected not flagged: "${whyLine}"`
      ).toBe(false);
    }
  });
});

// ── Effect-verb ban (requiredFix #5): no template contains banned verbs ────────

describe("why-line effect-verb ban (requiredFix #5)", () => {
  // Banned effect-verbs used on child capacity (verb form, not noun/interest token).
  // "Trains" as a noun (child interest like "love of Trains") is explicitly NOT banned.
  // The regex avoids matching nouns: it requires the word to follow a space (verb position),
  // not to follow "in ", "of ", or "love of " (noun/interest position).
  // More precise: flag only if the matched word is not immediately preceded by "in " or "of ".
  const EFFECT_VERB_AS_VERB =
    /(?<!\bin |\bof |\blove of )\b(improves?|boosts?|strengthens?|develops?|reduces?|calms?\s+child|fixes?\s+child)\b/i;
  // "builds" and "trains" are also banned as verbs but must be distinguished from
  // "builds" used as a subject noun (e.g. "what it builds") and "trains" as interest noun.
  // The why-line templates never use these as verbs on child capacity — assert separately.
  const TRAINS_AS_VERB = /\b(?:activity|play|game|exercise|session)\s+trains?\b/i;
  const BUILDS_AS_VERB = /\b(?:activity|play|game|exercise|session)\s+builds?\b/i;
  const COMPREHENSION =
    /\b(understands?|comprehends?|follows?\s+directions?|articulates?\s+better|speech\s+is\s+improving)\b/i;

  const allVariants = [
    assembleWhyLine({ goalLabel: "Following multi-step instructions", childName: "Sam", matchedInterest: "Trains", isWeekend: false, sparse: false }).whyLine,
    assembleWhyLine({ goalLabel: "Naming and managing big feelings", childName: "Maya", matchedInterest: null, isWeekend: false, sparse: false }).whyLine,
    assembleWhyLine({ goalLabel: null, childName: "Leo", matchedInterest: "Space", isWeekend: false, sparse: false }).whyLine,
    assembleWhyLine({ goalLabel: null, childName: "Zoe", matchedInterest: null, isWeekend: false, sparse: false }).whyLine,
    assembleWhyLine({ goalLabel: "Winding down at bedtime", childName: "Emma", matchedInterest: null, isWeekend: true, sparse: false }).whyLine,
    assembleWhyLine({ goalLabel: null, childName: "Tom", matchedInterest: null, isWeekend: true, sparse: false }).whyLine,
    assembleWhyLine({ goalLabel: null, childName: "Tim", matchedInterest: null, isWeekend: false, sparse: true }).whyLine,
  ];

  it("no why-line variant contains a banned effect-verb on child capacity", () => {
    for (const line of allVariants) {
      expect(
        EFFECT_VERB_AS_VERB.test(line),
        `Effect-verb-on-child found in: "${line}"`
      ).toBe(false);
      expect(
        TRAINS_AS_VERB.test(line),
        `'trains' as verb found in: "${line}"`
      ).toBe(false);
      expect(
        BUILDS_AS_VERB.test(line),
        `'builds' as verb found in: "${line}"`
      ).toBe(false);
    }
  });

  it("no why-line variant contains a banned comprehension token", () => {
    for (const line of allVariants) {
      expect(
        COMPREHENSION.test(line),
        `Comprehension token found in: "${line}"`
      ).toBe(false);
    }
  });

  it('no why-line contains banned verdict strings (progress score, % to goal, etc.)', () => {
    const VERDICTS =
      /\b(goal progress score|% to goal|goal complete|goal achieved|on track|improving on this goal)\b/i;
    for (const line of allVariants) {
      expect(
        VERDICTS.test(line),
        `Verdict string found in: "${line}"`
      ).toBe(false);
    }
  });

  it('no why-line contains banned clinical claim strings', () => {
    const CLINICAL = /\b(clinically validated|clinician-reviewed|clinically proven|assesses|screens|evaluates)\b/i;
    for (const line of allVariants) {
      expect(
        CLINICAL.test(line),
        `Clinical claim found in: "${line}"`
      ).toBe(false);
    }
  });
});

// ── buildDailyPlan: core variants ─────────────────────────────────────────────

describe("buildDailyPlan", () => {
  it("returns null when picks is empty", () => {
    expect(
      buildDailyPlan({
        picks: [],
        activeGoals: [MOCK_GOAL],
        childName: "Maya",
        loggedDayCount: 10,
        nowMs: Date.now(),
      })
    ).toBeNull();
  });

  it("happy path: goal matches activity domain → plan has goal + non-sparse why-line", () => {
    const plan = buildDailyPlan({
      picks: [MOCK_SCORED_ACTIVITY],
      activeGoals: [MOCK_GOAL],
      childName: "Maya",
      loggedDayCount: 10,
      nowMs: new Date("2026-06-24T09:00:00Z").getTime(), // Tuesday
    });
    expect(plan).not.toBeNull();
    expect(plan!.goal?.goalId).toBe("big-feelings");
    expect(plan!.sparse).toBe(false);
    expect(plan!.isWeekend).toBe(false);
    expect(plan!.defaultSessionLength).toBe("standard");
    expect(screenModelOutputLexical(plan!.whyLine).flagged).toBe(false);
  });

  it("sparse path (< 5 logged days): plan has activity, why-line is sparse fallback", () => {
    const plan = buildDailyPlan({
      picks: [MOCK_SCORED_ACTIVITY],
      activeGoals: [MOCK_GOAL],
      childName: "Maya",
      loggedDayCount: 3,
      nowMs: new Date("2026-06-24T09:00:00Z").getTime(),
    });
    expect(plan).not.toBeNull();
    expect(plan!.sparse).toBe(true);
    expect(plan!.whyLine).toContain("Sharpens as you log more days");
    expect(plan!.scoredActivity.activity.id).toBe("test-act-1");
  });

  it("no-goal path: goal is null, plan still returns an activity", () => {
    const plan = buildDailyPlan({
      picks: [MOCK_SCORED_ACTIVITY],
      activeGoals: [],
      childName: "Noah",
      loggedDayCount: 10,
      nowMs: new Date("2026-06-24T09:00:00Z").getTime(),
    });
    expect(plan).not.toBeNull();
    expect(plan!.goal).toBeNull();
    expect(plan!.scoredActivity.activity.id).toBe("test-act-1");
    expect(screenModelOutputLexical(plan!.whyLine).flagged).toBe(false);
  });

  it("weekend path: defaultSessionLength is extended, whyLine contains weekend note", () => {
    // 2026-06-27 is a Saturday
    const saturdayMs = new Date("2026-06-27T09:00:00Z").getTime();
    const plan = buildDailyPlan({
      picks: [MOCK_SCORED_ACTIVITY],
      activeGoals: [MOCK_GOAL],
      childName: "Emma",
      loggedDayCount: 10,
      nowMs: saturdayMs,
    });
    expect(plan).not.toBeNull();
    expect(plan!.isWeekend).toBe(true);
    expect(plan!.defaultSessionLength).toBe("extended");
    expect(plan!.whyLine).toContain("weekend plan");
  });
});

// ── isWeekendDate ─────────────────────────────────────────────────────────────

describe("isWeekendDate", () => {
  it("returns true for Saturday", () => {
    expect(isWeekendDate(new Date("2026-06-27").getTime())).toBe(true); // Saturday
  });
  it("returns true for Sunday", () => {
    expect(isWeekendDate(new Date("2026-06-28").getTime())).toBe(true); // Sunday
  });
  it("returns false for a weekday", () => {
    expect(isWeekendDate(new Date("2026-06-24").getTime())).toBe(false); // Tuesday
  });
});

// ── buildGoalObservation: COPPA write-path (gate requiredFix #3 + #4) ─────────

describe("buildGoalObservation (COPPA write-path gate)", () => {
  const MOCK_PLAN = buildDailyPlan({
    picks: [MOCK_SCORED_ACTIVITY],
    activeGoals: [MOCK_GOAL],
    childName: "Maya",
    loggedDayCount: 10,
    nowMs: new Date("2026-06-24T09:00:00Z").getTime(),
  })!;

  it("returns a document with goalId, capabilityNodeId, observationText, timestamp", () => {
    const obs = buildGoalObservation({
      plan: MOCK_PLAN,
      observationText: "She tried to name her feelings twice during the game.",
    });
    expect(obs.goalId).toBe("big-feelings");
    expect(obs.capabilityNodeId).toBe("regulation");
    expect(obs.observationText).toBe("She tried to name her feelings twice during the game.");
    expect(obs.timestamp).toBeTruthy();
    expect(new Date(obs.timestamp).getTime()).not.toBeNaN();
  });

  it("truncates observationText to 200 chars (COPPA write-path max)", () => {
    const long = "x".repeat(300);
    const obs = buildGoalObservation({ plan: MOCK_PLAN, observationText: long });
    expect(obs.observationText.length).toBe(200);
  });

  it("observation document has NO progress-score / percentage field (gate requiredFix #3)", () => {
    const obs = buildGoalObservation({
      plan: MOCK_PLAN,
      observationText: "Great moment today.",
    });
    // Assert the observation type has no progress/score/percent fields.
    const keys = Object.keys(obs);
    const forbiddenFields = ["progress", "score", "percent", "percentage", "onTrack", "completion"];
    for (const field of forbiddenFields) {
      expect(keys).not.toContain(field);
    }
  });

  it("observation text itself is never aggregated — it is a plain string (requiredFix #3)", () => {
    const obs = buildGoalObservation({
      plan: MOCK_PLAN,
      observationText: "She smiled and said 'big feelings'.",
    });
    expect(typeof obs.observationText).toBe("string");
    // No numeric aggregation: cannot be parsed as a meaningful score
    const asNumber = Number(obs.observationText);
    expect(isNaN(asNumber)).toBe(true);
  });
});

// ── estimateLoggedDayCount ────────────────────────────────────────────────────

describe("estimateLoggedDayCount", () => {
  it("returns 0 for empty logs", () => {
    expect(estimateLoggedDayCount([])).toBe(0);
  });

  it("counts distinct calendar days, not entries", () => {
    const logs = [
      { timestamp: "2026-06-20T09:00:00Z" },
      { timestamp: "2026-06-20T15:00:00Z" }, // same day as above
      { timestamp: "2026-06-21T10:00:00Z" },
      { timestamp: "2026-06-22T08:30:00Z" },
    ];
    expect(estimateLoggedDayCount(logs)).toBe(3); // 3 distinct days
  });

  it("handles numeric timestamp (ms since epoch)", () => {
    const logs = [
      { timestamp: new Date("2026-06-20T09:00:00Z").getTime() },
      { timestamp: new Date("2026-06-21T09:00:00Z").getTime() },
    ];
    expect(estimateLoggedDayCount(logs)).toBe(2);
  });

  it("returns 5+ for 5 distinct days (triggers personalized why-line)", () => {
    const days = ["2026-06-18", "2026-06-19", "2026-06-20", "2026-06-21", "2026-06-22"];
    const logs = days.map((d) => ({ timestamp: `${d}T10:00:00Z` }));
    expect(estimateLoggedDayCount(logs)).toBeGreaterThanOrEqual(5);
  });

  it("returns < 5 for 3 distinct days (triggers sparse why-line)", () => {
    const logs = [
      { timestamp: "2026-06-20T09:00:00Z" },
      { timestamp: "2026-06-21T09:00:00Z" },
      { timestamp: "2026-06-22T09:00:00Z" },
    ];
    expect(estimateLoggedDayCount(logs)).toBeLessThan(5);
  });
});

// ── No-progress-aggregation code path (build-time gate, requiredFix #3) ───────

describe("no progress-aggregation code path (gate requiredFix #3)", () => {
  it("DailyPlan type has no progress/score/%/ring/onTrack/trend field", () => {
    const plan = buildDailyPlan({
      picks: [MOCK_SCORED_ACTIVITY],
      activeGoals: [MOCK_GOAL],
      childName: "Maya",
      loggedDayCount: 10,
      nowMs: Date.now(),
    })!;
    const keys = Object.keys(plan);
    const forbidden = ["progress", "score", "percent", "percentage", "onTrack", "ring", "trend", "sparkline", "streak"];
    for (const field of forbidden) {
      expect(keys, `DailyPlan must not have field "${field}"`).not.toContain(field);
    }
  });
});
