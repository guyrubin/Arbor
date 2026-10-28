/**
 * B-ASKJB-44 — the deterministic floor under "handoff notes restate only what
 * the parent reported". Negative controls are the exact notes that shipped on
 * companion-topics-v1 topic-enjoy-he (coach_chat 1.9.0, 10 Oct), copied from
 * evals/companion-topics-v1.results.jsonl.
 */
import { describe, expect, it } from "vitest";
import { findHandoffFinding, scrubHandoffBriefFindings, withoutHandoffFindings } from "./clinicalScan";

const SHIPPED_PROFESSIONAL_HE = "הילד מגיב היטב לזמני חיבור קצרים המבוססים על ויסות משותף ומשחק חופשי, ללא עדות לקשיי קשב או ויסות משמעותיים בהקשר זה.";
const SHIPPED_PROFESSIONAL_HE_2 = "נצפתה אינטראקציה חיובית סביב ציור משותף חופשי; מומלץ להמשיך לעודד פעילויות מבוססות קשר וויסות הדדי.";
const SHIPPED_EN = "no evidence of attention or regulation difficulties";

describe("B-ASKJB-44 · the invented-finding floor", () => {
  it("drops the exact sentences that shipped (EN + both HE notes); nothing of them survives", () => {
    expect(findHandoffFinding(SHIPPED_EN)).toBe("no evidence of");
    expect(findHandoffFinding(SHIPPED_PROFESSIONAL_HE)).toBe("ללא עדות");
    expect(findHandoffFinding(SHIPPED_PROFESSIONAL_HE_2)).toBe("נצפתה");
    expect(withoutHandoffFindings(SHIPPED_PROFESSIONAL_HE)).toBe("");
    expect(withoutHandoffFindings(SHIPPED_PROFESSIONAL_HE_2)).toBe("");
    expect(withoutHandoffFindings(`The parent says bedtime starts at 8. There is ${SHIPPED_EN}.`)).toBe("The parent says bedtime starts at 8.");
  });

  it.each([
    "She shows no signs of anxiety at drop-off.",
    "He does not show any signs of a speech delay.",
    "No attention or regulation difficulties were seen.",
    "No concerns were noted during play.",
    "Sensory issues have been ruled out.",
    "His language is within normal limits.",
    "Nothing to suggest a developmental problem.",
    "She screened negative for autism risk.",
    "He is developing normally for his age.",
    "A calm, positive interaction was observed.",
    "Free of any signs of distress.",
    "אין סימנים לחרדה בפרידה בבוקר.",
    "לא נראים סימנים של עיכוב שפתי.",
    "אין קשיים בוויסות הרגשי.",
    "ההתפתחות בטווח התקין לגילו.",
    "אין חשש לקושי בקשב.",
    "זוהתה התקדמות בשפה.",
  ])("drops: %s", (sentence) => {
    expect(findHandoffFinding(sentence), sentence).not.toBeNull();
    expect(withoutHandoffFindings(sentence)).toBe("");
  });

  it.each([
    "The parent reports that Noa cries at drop-off most mornings.",
    "Mom says a two-minute warning before leaving helps.",
    "Noa enjoys drawing together for a few minutes after dinner.",
    "Please give a warning before transitions; there is no rush to finish the drawing.",
    "ההורה מספר/ת שנועה בוכה בפרידה בבוקר.",
    "לפי ההורה, אזהרה של שתי דקות לפני מעבר עוזרת.",
    "נועה נהנית לצייר יחד כמה דקות אחרי ארוחת הערב.",
  ])("keeps the parent's report byte-identical: %s", (sentence) => {
    expect(findHandoffFinding(sentence)).toBeNull();
    expect(withoutHandoffFindings(sentence)).toBe(sentence);
  });

  it("keeps the other sentences of a mixed note in order", () => {
    const note = "Noa enjoys drawing with a parent. No signs of attention difficulties. A short warning before cleanup helps.";
    expect(withoutHandoffFindings(note)).toBe("Noa enjoys drawing with a parent. A short warning before cleanup helps.");
  });

  it("scrubs every string field and list item of a School Brief draft; untouched drafts are unchanged", () => {
    const draft: Record<string, unknown> = {
      title: "School note",
      overview: "Mia does best with a warning before a change. There is no evidence of a speech delay.",
      keyStrengths: ["Curious", "Shows no signs of social difficulties."],
      suggestedTeacherStrategies: ["Give a two-minute warning"],
      crisisEscalationTrigger: "If refusals last much longer than usual for two weeks, mention it to the family.",
    };
    expect(scrubHandoffBriefFindings(draft)).toBe(2);
    expect(draft).toEqual({
      title: "School note",
      overview: "Mia does best with a warning before a change.",
      keyStrengths: ["Curious"],
      suggestedTeacherStrategies: ["Give a two-minute warning"],
      crisisEscalationTrigger: "If refusals last much longer than usual for two weeks, mention it to the family.",
    });
    const clean = { overview: "Mia does best with a warning.", keyStrengths: ["Curious"] };
    expect(scrubHandoffBriefFindings(clean)).toBe(0);
  });
});
