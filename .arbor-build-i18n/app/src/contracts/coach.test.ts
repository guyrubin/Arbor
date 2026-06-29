import { describe, expect, it } from "vitest";
import { coachResponseZodSchema } from "./coach.js";

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
});
