import { describe, expect, it } from "vitest";
import { renderBlockedOutputMarkdown, screenModelOutputLexical } from "./outputScreen.js";

describe("output safety screen (AI-2) — lexical floor", () => {
  it("flags definitive diagnostic claims about the child", () => {
    expect(screenModelOutputLexical("Based on this, your child has autism and needs therapy.").category).toBe("diagnosis");
    expect(screenModelOutputLexical("She is autistic, which explains the meltdowns.").category).toBe("diagnosis");
    expect(screenModelOutputLexical("This indicates ADHD.").category).toBe("diagnosis");
    expect(screenModelOutputLexical("[Child] has ADHD.").category).toBe("diagnosis");
  });

  it("flags medication dosing guidance", () => {
    expect(screenModelOutputLexical("Give 3 mg of melatonin before bed.").category).toBe("medication");
    expect(screenModelOutputLexical("A dose of 5 ml ibuprofen should help.").category).toBe("medication");
  });

  it("flags start/stop-treatment directives", () => {
    expect(screenModelOutputLexical("You should stop the medication for a week and see.").category).toBe("treatment_directive");
  });

  it("does NOT flag normal developmental guidance or referral suggestions", () => {
    const safe = [
      "Transitions are hard at this age. Name the feeling, offer two choices, and keep the goodbye short.",
      "If this pattern continues, it's worth discussing with your pediatrician — bring your Arbor notes.",
      "Some children with similar patterns benefit from an occupational therapy evaluation; a professional can assess in person.",
      "Try a 5 minute wind-down routine before bed.",
    ];
    for (const text of safe) {
      expect(screenModelOutputLexical(text).flagged).toBe(false);
    }
  });

  it("renders a parent-facing, non-alarming replacement", () => {
    const text = renderBlockedOutputMarkdown();
    expect(text).toContain("never a diagnosis");
    expect(text).toContain("Reports & Handoffs");
  });
});
