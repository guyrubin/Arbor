import { describe, expect, it } from "vitest";
import { buildSourceCards, coachResponseZodSchema, renderCoachResponse } from "./coach.js";

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

  // ASK-4: the followUps cap is a zod TRANSFORM — a chatty model that emits
  // 4+ items can never fail the whole answer; the seam clamps to 3 trimmed,
  // non-empty strings of <=140 chars.
  it("caps followUps at 3 short strings via the zod transform (never a parse failure)", () => {
    const parsed = coachResponseZodSchema.parse({
      ...validCoach,
      followUps: ["  What if she stalls again?  ", "", "How long should it take?", "What do I say at the door?", "A fourth overflow question"],
    });
    expect(parsed.followUps).toEqual([
      "What if she stalls again?",
      "How long should it take?",
      "What do I say at the door?",
    ]);
    const long = coachResponseZodSchema.parse({ ...validCoach, followUps: ["x".repeat(400)] });
    expect(long.followUps?.[0]).toHaveLength(140);
    // Absent / all-blank collapses to undefined — the client falls back to
    // the static trio.
    expect(coachResponseZodSchema.parse(validCoach).followUps).toBeUndefined();
    expect(coachResponseZodSchema.parse({ ...validCoach, followUps: ["  ", ""] }).followUps).toBeUndefined();
  });

  // ASK-4 FIREWALL CONDITION: followUps flow through renderCoachResponse so
  // screenModelOutput covers every chip string — a rendered-but-unscreened
  // field would be the first bypass of the AI-2 output screen.
  it("renderCoachResponse appends the capped followUps (screen coverage) and omits the section when absent", () => {
    const parsed = coachResponseZodSchema.parse({
      ...validCoach,
      followUps: ["What if she stalls again?", "How long should it take?"],
    });
    const rendered = renderCoachResponse(parsed);
    expect(rendered).toContain("### Suggested Follow-ups");
    for (const q of parsed.followUps ?? []) expect(rendered).toContain(q);
    const bare = renderCoachResponse(coachResponseZodSchema.parse(validCoach));
    expect(bare).not.toContain("Suggested Follow-ups");
  });

  // ASK-6: approvedMemoryFactsUsed is a server-backfilled integer COUNT.
  it("accepts the optional approvedMemoryFactsUsed count and rejects non-integers", () => {
    expect(coachResponseZodSchema.parse({ ...validCoach, approvedMemoryFactsUsed: 4 }).approvedMemoryFactsUsed).toBe(4);
    expect(coachResponseZodSchema.parse(validCoach).approvedMemoryFactsUsed).toBeUndefined();
    expect(() => coachResponseZodSchema.parse({ ...validCoach, approvedMemoryFactsUsed: 2.5 })).toThrow();
    expect(() => coachResponseZodSchema.parse({ ...validCoach, approvedMemoryFactsUsed: -1 })).toThrow();
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
