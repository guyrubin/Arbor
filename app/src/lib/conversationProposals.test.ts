import { describe, expect, it } from "vitest";
import { attachProposalConflicts, normalizeConversationProposals, proposalConfidenceLabel } from "./conversationProposals";

const ctx = { sessionId: "s1", turnId: "t1", childId: "child-1", language: "en" as const, now: "2026-07-27T12:00:00.000Z" };

describe("conversation proposal boundary", () => {
  it("normalizes bounded provider output without granting write authority", () => {
    const proposals = normalizeConversationProposals([{ target: "journal", summary: " First bike ride ", sourceExcerpt: "rode alone", confidence: 1.4 }], ctx);
    expect(proposals).toEqual([expect.objectContaining({ id: "t1-0", target: "journal", summary: "First bike ride", confidence: 1, status: "draft" })]);
    expect(proposals[0]).not.toHaveProperty("confirmedBy");
    expect(proposals[0]).not.toHaveProperty("commitRef");
  });

  it("drops malformed and unsupported proposals", () => {
    expect(normalizeConversationProposals([
      { target: "diagnosis", summary: "ADHD", sourceExcerpt: "maybe", confidence: 1 },
      { target: "observation", summary: "", sourceExcerpt: "said it", confidence: 0.8 },
    ], ctx)).toEqual([]);
  });

  it("marks milestone changes and missing milestone ids deterministically", () => {
    const base = normalizeConversationProposals([
      { target: "milestone", summary: "Climbs stairs", sourceExcerpt: "did the stairs", confidence: 0.9, milestoneId: "m1", milestoneStatus: "yes" },
      { target: "milestone", summary: "Uses scissors", sourceExcerpt: "used scissors", confidence: 0.8, milestoneId: "missing", milestoneStatus: "yes" },
    ], ctx);
    const result = attachProposalConflicts(base, { behaviorLogs: [], milestones: [{ id: "m1", domain: "sensory_motor_patterns", ageGroup: "3", title: "Climbs stairs", description: "", checked: false, observationStatus: "not_yet" }] });
    expect(result[0].conflict).toEqual({ code: "milestone_change", existing: "not_yet" });
    expect(result[1].conflict?.code).toBe("missing_milestone");
  });

  it("uses calm confidence bands", () => {
    expect(proposalConfidenceLabel(0.9)).toBe("clear");
    expect(proposalConfidenceLabel(0.7)).toBe("check");
    expect(proposalConfidenceLabel(0.2)).toBe("uncertain");
  });
});
