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

describe("output safety screen (CI-13) — hedged-inference label leaks", () => {
  // The canonical canary: a soft, hedged inferred label is the most likely
  // contract breach on the model-authored behavior/co-regulation surfaces, and
  // it escaped the literal subject+verb patterns until CI-13.
  it("catches the canonical 'this looks like ADHD' label leak", () => {
    expect(screenModelOutputLexical("This looks like ADHD.").category).toBe("diagnosis");
  });

  it("catches the family of hedged inferred labels", () => {
    const hedged = [
      "Honestly, this seems like autism to me.",
      "It sounds like she has an anxiety disorder.",
      "He appears to be on the autism spectrum.",
      "Based on the pattern, it's likely ADHD.",
      "These behaviors point to OCD.",
      "This suggests sensory processing disorder.",
    ];
    for (const text of hedged) {
      expect(screenModelOutputLexical(text).flagged, text).toBe(true);
      expect(screenModelOutputLexical(text).category, text).toBe("diagnosis");
    }
  });

  it("does NOT false-positive on hedged phrasing with no condition", () => {
    const clean = [
      "The strategy appears to be working well after a few days.",
      "This looks like a good moment to introduce a wind-down routine.",
      "It seems like transitions are the hardest part of her day.",
      "That sounds like a frustrating evening — let's keep it simple.",
    ];
    for (const text of clean) {
      expect(screenModelOutputLexical(text).flagged).toBe(false);
    }
  });

  // The exact model-authored strings each wired route concatenates and screens.
  it("catches a hedged label inside an /analyze-behavior expertInsights+actionPlan concat", () => {
    const insightStrings = ["Pattern note\nFrom the logs, this looks like ADHD and would explain the focus dips."].join("\n");
    const screenable = ["Strategies are mixed", insightStrings, "Next, try a visual schedule."].join("\n");
    expect(screenModelOutputLexical(screenable).flagged).toBe(true);
  });

  it("catches a hedged label inside a /voice (co-regulation) buffered reply", () => {
    const bufferedVoiceReply =
      "I hear how tiring this is. Honestly, from what you describe it seems like autism — try naming the feeling and offering two choices.";
    expect(screenModelOutputLexical(bufferedVoiceReply).flagged).toBe(true);
  });
});
