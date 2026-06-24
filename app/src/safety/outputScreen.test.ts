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

  // LANG-15 gate §5: the lexical screen must catch language-domain diagnosis
  // leaks that would be especially harmful on the LANG-15 parent coaching surface.
  it("flags language-domain diagnosis leaks (LANG-15 §5)", () => {
    expect(screenModelOutputLexical("Based on her babbling, your child has autism.").category).toBe("diagnosis");
    expect(screenModelOutputLexical("She has autism spectrum disorder.").category).toBe("diagnosis");
    expect(screenModelOutputLexical("This indicates apraxia of speech.").category).toBe("diagnosis");
    expect(screenModelOutputLexical("[Child] has autism and needs speech therapy.").category).toBe("diagnosis");
  });

  it("does NOT flag parent-mediated strategy guidance (LANG-15 §5 safe-pass)", () => {
    const safe = [
      "Wait three seconds after your child makes a sound — give them space to take another turn.",
      "Narrate what you are doing as you bathe your baby. Keep your voice calm and natural.",
      "Something feels worth discussing? It is always worth raising with your pediatrician or an SLP.",
      "I would like to discuss my child's language development at our next visit.",
      "Try some language moments in Word World.",
      "daily back-and-forth and following your child's lead is how young children build communication — these activities give you structured moments to do that",
    ];
    for (const text of safe) {
      expect(screenModelOutputLexical(text).flagged).toBe(false);
    }
  });
});
