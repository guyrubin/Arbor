import { describe, expect, it } from "vitest";
import { briefToMarkdown, safeFileName } from "./exporters.js";
import type { SchoolBrief } from "../types.js";

const brief: SchoolBrief = {
  title: "Kindergarten transition summary",
  date: "2026-06-02",
  overview: "Dylan is warm and imaginative; mornings are hard.",
  keyStrengths: ["Empathy", "Imaginative play"],
  classroomChallenges: ["Transition refusal"],
  languageSupportPlan: ["Practice school phrases in both languages"],
  suggestedTeacherStrategies: ["Use a first-then card at the door"],
  crisisEscalationTrigger: "Sudden regression or withdrawal."
};

describe("briefToMarkdown (H-08)", () => {
  it("produces a complete, non-diagnostic handoff document", () => {
    const md = briefToMarkdown(brief, "Dylan", "teacher");
    expect(md).toContain("# Arbor Development Handoff — Dylan");
    expect(md).toContain("**Prepared for:** Teacher");
    expect(md).toContain("not a diagnosis");
    expect(md).toContain("- Empathy");
    expect(md).toContain("## When to escalate");
  });

  it("renders an em dash for empty sections", () => {
    const md = briefToMarkdown({ ...brief, keyStrengths: [] }, "Dylan", "teacher");
    expect(md).toContain("## Key strengths\n- —");
  });
});

describe("safeFileName", () => {
  it("slugifies names for safe downloads", () => {
    expect(safeFileName("Dylan R.")).toBe("dylan-r");
    expect(safeFileName("???")).toBe("child");
  });
});
