import { describe, expect, it } from "vitest";
import { PROFESSIONAL_HELP_TERMS, scrubSeededProfessionalHelp, seededScrubCount } from "./seededEscalation.js";

/**
 * B-AI-14 (live fix, 6 Oct) — the seeded-turn professional-help screen. The
 * live judge on 29dc0273 saw the boundary restated outside escalateIf: the
 * shepherd frame ("a pediatrician can rule out medical factors and provide
 * referrals to a child psychologist…") and a prose summary the parent asked
 * for. The route runs this screen on SEEDED turns only, after
 * applyGovernedEscalation; it drops sentences, never blocks the answer.
 */
const contract = (over: Record<string, unknown> = {}) => ({
  text: "That sounds really hard. Stay close and keep your voice low.",
  parentScript: "I'm here. You're safe.",
  observe: ["When it starts."],
  todayPlan: ["Name the feeling and offer two choices."],
  nonDiagnosticHypotheses: [{ label: "Big feelings at transitions", confidence: "one possibility", rationale: "Common at this age." }],
  frameRouting: { aim: "a", twoAxes: "b", story: "c", shadow: "d", marriage: "e", shepherd: "Keep the evening calm." },
  escalateIf: [] as string[],
  ...over,
});

describe("B-AI-14 — seeded-turn professional-help scrub (EN)", () => {
  it("the live shepherd restatement is removed; the rest of the frame stays", () => {
    const c = contract({
      frameRouting: { aim: "a", twoAxes: "b", story: "c", shadow: "d", marriage: "e", shepherd: "Protect his sister first. If the behavior persists or escalates, a pediatrician can rule out medical factors and provide referrals to a child psychologist or behavioral specialist for further assessment and support." },
    });
    expect(scrubSeededProfessionalHelp(c, "en")).toBe(1);
    expect(c.frameRouting.shepherd).toBe("Protect his sister first.");
  });

  it("a prose summary of when to get professional help is removed from text; the answer survives", () => {
    const c = contract({ text: "You are doing the right things. If it keeps happening every day, talk to your doctor about professional help. For now, stay close." });
    expect(scrubSeededProfessionalHelp(c, "en")).toBe(1);
    expect(c.text).toBe("You are doing the right things. For now, stay close.");
  });

  it("an emptied optional field is omitted; an emptied required field gets the neutral fallback; a hypothesis that names a professional is dropped", () => {
    const c = contract({
      text: "Seek help from a therapist.",
      parentScript: "Let's call the pediatrician.",
      todayPlan: ["Ask a specialist."],
      observe: ["Whether a doctor is needed.", "When it starts."],
      nonDiagnosticHypotheses: [{ label: "Needs a psychologist", confidence: "one possibility", rationale: "x" }],
      frameRouting: { aim: "a", twoAxes: "b", story: "c", shadow: "d", marriage: "e", shepherd: "Reach out for support from a professional." },
    });
    scrubSeededProfessionalHelp(c, "en");
    expect("text" in c).toBe(false);
    expect(c.parentScript).toBe("Use the words from the guide's Say this step.");
    expect(c.todayPlan).toEqual(["Follow the guide's Do now step."]);
    expect(c.observe).toEqual(["When it starts."]);
    expect(c.nonDiagnosticHypotheses).toEqual([]);
    expect(c.frameRouting.shepherd).toBe("—");
  });

  it("an answer with no professional-help wording is untouched, byte for byte", () => {
    const c = contract();
    const before = JSON.stringify(c);
    expect(scrubSeededProfessionalHelp(c, "en")).toBe(0);
    expect(JSON.stringify(c)).toBe(before);
  });

  it("the counter accumulates removed sentences", () => {
    const start = seededScrubCount();
    scrubSeededProfessionalHelp(contract({ parentScript: "Call the doctor." }), "en");
    expect(seededScrubCount()).toBe(start + 1);
  });
});

describe("B-AI-14 — seeded-turn professional-help scrub (HE)", () => {
  it("a Hebrew shepherd restatement and a Hebrew prose summary are removed", () => {
    const c = contract({
      text: "זה נשמע קשה מאוד. אם זה נמשך, כדאי לפנות לרופא/ת ילדים או לאיש מקצוע. בינתיים, הישארו קרובים.",
      frameRouting: { aim: "a", twoAxes: "b", story: "c", shadow: "d", marriage: "e", shepherd: "שמרו על שגרה רגועה. אם זה מחמיר, פסיכולוג/ית ילדים יוכלו לעזור." },
    });
    expect(scrubSeededProfessionalHelp(c, "he")).toBe(2);
    expect(c.text).toBe("זה נשמע קשה מאוד. בינתיים, הישארו קרובים.");
    expect(c.frameRouting.shepherd).toBe("שמרו על שגרה רגועה.");
  });

  it("the daycare caregiver (מטפלת) and addressing the child (לפנות לילד/ה) are NOT professional-help wording", () => {
    const c = contract({
      text: "ספרו למטפלת בגן מה עובד בבית. כדאי לפנות לילד/ה בקול שקט.",
      parentScript: "אני כאן איתך.",
    });
    const before = JSON.stringify(c);
    expect(scrubSeededProfessionalHelp(c, "he")).toBe(0);
    expect(JSON.stringify(c)).toBe(before);
  });

  it("an emptied required Hebrew field gets the Hebrew fallback", () => {
    const c = contract({ parentScript: "כדאי לקבל עזרה מקצועית." });
    scrubSeededProfessionalHelp(c, "he");
    expect(c.parentScript).toBe("אפשר להשתמש במילים מהמדריך.");
  });

  it("the term lists are language-scoped: the EN list does not run on a Hebrew answer and vice versa", () => {
    expect(PROFESSIONAL_HELP_TERMS.en.some((re) => re.test("רופא"))).toBe(false);
    expect(PROFESSIONAL_HELP_TERMS.he.some((re) => re.test("doctor"))).toBe(false);
    const c = contract({ text: "Talk to your doctor." });
    expect(scrubSeededProfessionalHelp(c, "he")).toBe(0);
  });
});
