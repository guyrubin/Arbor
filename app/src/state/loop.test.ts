import { describe, expect, it } from "vitest";
import {
  addDays,
  contractToActionPlan,
  dueFollowUps,
  humanizeCardId,
  leadFrame,
  observeToTrackingPrompts
} from "./loop.js";
import type { CoachContract, InterventionOutcome } from "../types.js";

const contract: CoachContract = {
  riskLevel: "routine",
  ageBand: "3-5y",
  domains: ["attachment_regulation"],
  nonDiagnosticHypotheses: [
    { label: "transition strain", confidence: "medium", rationale: "morning demands exceed flexibility" }
  ],
  todayPlan: ["Use a first-then card", "Name the feeling out loud", ""],
  parentScript: "First shoes, then truck.",
  avoid: ["Do not threaten lateness"],
  observe: ["Recovery time after the limit", "Whether the card reduces protest"],
  escalateIf: ["Sudden regression"],
  frameRouting: {
    aim: "agency",
    twoAxes: "Hold warmth while keeping the boundary on leaving",
    story: "the courage pebble ritual",
    shadow: "anger",
    marriage: "align both parents on the morning routine",
    shepherd: "teacher if persistent"
  },
  memoryProposals: [],
  handoffNotes: { teacher: "Use the same card.", professional: "Routine transition concern." }
};

const NOW = "2026-06-02T09:00:00.000Z";

describe("contractToActionPlan (H-01)", () => {
  it("builds a checkable plan from todayPlan with provenance and a follow-up date", () => {
    const plan = contractToActionPlan(contract, "Mornings are a battle to leave", "dylan-demo", NOW);
    expect(plan.source).toBe("coach");
    expect(plan.childId).toBe("dylan-demo");
    expect(plan.phases[0].steps).toHaveLength(2); // empty step filtered out
    expect(plan.phases[0].steps.every((s) => s.completed === false)).toBe(true);
    expect(plan.scripts[0].say).toBe("First shoes, then truck.");
    expect(plan.followUpDueAt).toBe(addDays(NOW, 3));
    expect(plan.title.toLowerCase()).toContain("transition");
  });

  it("never produces an empty plan", () => {
    const bare = { ...contract, todayPlan: [], observe: [] };
    const plan = contractToActionPlan(bare, "", "c1", NOW);
    expect(plan.phases[0].steps.length).toBeGreaterThan(0);
    expect(plan.successIndicators.length).toBeGreaterThan(0);
  });
});

describe("observeToTrackingPrompts (H-02)", () => {
  it("creates one active tracking prompt per non-empty observe item", () => {
    const prompts = observeToTrackingPrompts(contract, "Mornings", "dylan-demo", NOW);
    expect(prompts).toHaveLength(2);
    expect(prompts[0].active).toBe(true);
    expect(prompts[0].prompt.startsWith("Did you notice:")).toBe(true);
    expect(prompts[0].childId).toBe("dylan-demo");
  });
});

describe("dueFollowUps (H-03)", () => {
  it("returns coach plans past their follow-up date with no recorded outcome", () => {
    const plan = contractToActionPlan(contract, "Mornings", "c1", NOW);
    const later = addDays(NOW, 4);
    expect(dueFollowUps([plan], [], later)).toHaveLength(1);
  });

  it("excludes plans that already have an outcome", () => {
    const plan = contractToActionPlan(contract, "Mornings", "c1", NOW);
    const outcome: InterventionOutcome = {
      id: "o1",
      planId: plan.id,
      childId: "c1",
      rating: "better",
      createdAt: addDays(NOW, 4)
    };
    expect(dueFollowUps([plan], [outcome], addDays(NOW, 4))).toHaveLength(0);
  });

  it("excludes plans not yet due", () => {
    const plan = contractToActionPlan(contract, "Mornings", "c1", NOW);
    expect(dueFollowUps([plan], [], addDays(NOW, 1))).toHaveLength(0);
  });
});

describe("leadFrame (H-10)", () => {
  it("surfaces the most substantive, salient frame", () => {
    const lead = leadFrame(contract.frameRouting);
    // twoAxes is long AND contains 'warmth'/'boundary' signals → should win.
    expect(lead.key).toBe("twoAxes");
    expect(lead.label).toBe("Warmth & Structure");
    expect(lead.text.length).toBeGreaterThan(0);
  });

  it("falls back gracefully when frames are sparse", () => {
    const lead = leadFrame({ aim: "calm", twoAxes: "", story: "", shadow: "", marriage: "", shepherd: "" });
    expect(lead.key).toBe("aim");
  });
});

describe("humanizeCardId (H-11)", () => {
  it("renders a readable label and preserves age bands", () => {
    expect(humanizeCardId("transition-bridge-3-5y")).toBe("Transition Bridge 3-5y");
    expect(humanizeCardId("sleep_routine_0-12m")).toBe("Sleep Routine 0-12m");
  });
});
