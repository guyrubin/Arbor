/**
 * B-KID-167 — a red-line match offers no plan and shows the governed care
 * line (the hard-moment cards' escalation sentence, byte-identical); no match
 * offers the plan; the questions are the pattern's own red lines in parent
 * words, never a score.
 */
import { describe, expect, it } from "vitest";
import { sharedEscalation } from "../../content/hardMomentCards";
import { PLAN_POO_SIT } from "../library/plans/patterns/planPooSit";
import { redLineOutcome, redLineQuestions } from "./redLines";

describe("red lines at the pattern door", () => {
  it("no sign ticked → the plan is offered", () => {
    expect(redLineOutcome(PLAN_POO_SIT, [])).toEqual({ offer: "plan" });
    expect(redLineOutcome(PLAN_POO_SIT, ["not-a-sign"])).toEqual({ offer: "plan" });
  });

  it("one sign ticked → care, the governed escalation line verbatim, no plan", () => {
    const out = redLineOutcome(PLAN_POO_SIT, ["blood"]);
    expect(out.offer).toBe("care");
    if (out.offer !== "care") throw new Error("unreachable");
    expect(out.matched.map((m) => m.id)).toEqual(["blood"]);
    expect(out.careLine).toBe(sharedEscalation);
    expect(out.careLine.en).toContain("talk with your pediatrician");
    expect(out.careLine.he).toContain("רופא הילדים");
    // no diagnosis, no urgency grade, no count of signs
    expect(JSON.stringify(out)).not.toMatch(/constipation|urgent|high|medium|low|\b\d+ of \d+/i);
  });

  it("the questions are the pattern's red lines, in parent words, with no number, verdict or 'signs of' framing", () => {
    const qs = redLineQuestions(PLAN_POO_SIT);
    expect(qs.map((q) => q.id)).toEqual(["blood", "fever-vomit", "swollen", "weight-growth", "from-birth", "after-event", "under-3"]);
    for (const q of qs) {
      expect(q.text.en).not.toMatch(/\d|score|signs? of|symptom|diagnos/i);
      expect(q.text.he).toMatch(/[֐-׿]/);
      expect(q.text.en).not.toMatch(/\byou are\b/i);
    }
  });
});
