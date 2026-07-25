import { describe, expect, it } from "vitest";
import { buildSourceCards, coachResponseZodSchema } from "./coach.js";

const validCoach = {
  riskLevel: "routine",
  ageBand: "3-5y",
  domains: ["attachment_regulation"],
  nonDiagnosticHypotheses: [{ label: "transition strain", confidence: "medium", rationale: "morning demands exceed current flexibility" }],
  todayPlan: ["Use a visual first-then card"],
  parentScript: "First shoes, then truck.",
  avoid: ["Do not threaten"],
  observe: ["Recovery time"],
  escalateIf: ["Sudden regression appears"],
  frameRouting: { aim: "agency", twoAxes: "warmth and structure", story: "ritual", shadow: "anger", marriage: "align caregivers", shepherd: "teacher if persistent" },
  memoryProposals: [],
  handoffNotes: { teacher: "Use the same card.", professional: "Routine transition concern." },
  sourceCardsUsed: ["transition-bridge-3-5y"]
};

describe("coach Zod schema", () => {
  it("accepts complete structured coach output", () => {
    expect(coachResponseZodSchema.parse(validCoach)).toMatchObject({ ageBand: "3-5y" });
  });

  it("rejects malformed coach output missing escalation thresholds", () => {
    const malformed = { ...validCoach, escalateIf: [] };
    expect(() => coachResponseZodSchema.parse(malformed)).toThrow();
  });

  // COACH-6: resolved citation metadata is an OPTIONAL contract field — the
  // model never emits it; the server backfills it after parsing.
  it("accepts the optional resolved sourceCards field", () => {
    const withCards = {
      ...validCoach,
      sourceCards: [{ id: "transition-bridge-3-5y", title: "Transition Bridge (3-5y)", type: "intervention" }],
    };
    expect(coachResponseZodSchema.parse(withCards).sourceCards?.[0]?.title).toBe("Transition Bridge (3-5y)");
    expect(coachResponseZodSchema.parse(validCoach).sourceCards).toBeUndefined();
  });

  it("rejects a sourceCards entry with an empty title", () => {
    const malformed = { ...validCoach, sourceCards: [{ id: "x", title: "", type: "intervention" }] };
    expect(() => coachResponseZodSchema.parse(malformed)).toThrow();
  });
});

describe("buildSourceCards (COACH-6 citation resolution)", () => {
  const cards = [
    { id: "transition-bridge-3-5y", title: "Transition Bridge (3-5y)", type: "intervention" },
    { id: "bowlby-attachment", title: "Bowlby: Secure Base", type: "scholar" },
  ];

  it("resolves cited ids to real titles + types, preserving citation order", () => {
    expect(buildSourceCards(["bowlby-attachment", "transition-bridge-3-5y"], cards)).toEqual([
      { id: "bowlby-attachment", title: "Bowlby: Secure Base", type: "scholar" },
      { id: "transition-bridge-3-5y", title: "Transition Bridge (3-5y)", type: "intervention" },
    ]);
  });

  it("drops ids with no matching card (client falls back to the slug row)", () => {
    expect(buildSourceCards(["hallucinated-card", "bowlby-attachment"], cards)).toEqual([
      { id: "bowlby-attachment", title: "Bowlby: Secure Base", type: "scholar" },
    ]);
  });

  it("returns an empty list for missing/empty ids", () => {
    expect(buildSourceCards(undefined, cards)).toEqual([]);
    expect(buildSourceCards([], cards)).toEqual([]);
  });
});
