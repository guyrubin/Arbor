/**
 * B-ASKJB-44 — the deterministic floor under "handoff notes restate only what
 * the parent reported". Negative controls are the exact notes that shipped on
 * companion-topics-v1 topic-enjoy-he (coach_chat 1.9.0, 10 Oct), copied from
 * evals/companion-topics-v1.results.jsonl.
 */
import { describe, expect, it } from "vitest";
import { findHandoffFinding, scrubHandoffBriefFindings, statesUnreportedFinding, withoutHandoffFindings } from "./clinicalScan";

const SHIPPED_PROFESSIONAL_HE = "הילד מגיב היטב לזמני חיבור קצרים המבוססים על ויסות משותף ומשחק חופשי, ללא עדות לקשיי קשב או ויסות משמעותיים בהקשר זה.";
const SHIPPED_PROFESSIONAL_HE_2 = "נצפתה אינטראקציה חיובית סביב ציור משותף חופשי; מומלץ להמשיך לעודד פעילויות מבוססות קשר וויסות הדדי.";
const SHIPPED_EN = "no evidence of attention or regulation difficulties";

describe("B-ASKJB-44 · the invented-finding floor", () => {
  it("drops the exact sentences that shipped (EN + both HE notes); nothing of them survives", () => {
    expect(findHandoffFinding(SHIPPED_EN)).toBe("no evidence of");
    expect(findHandoffFinding(SHIPPED_PROFESSIONAL_HE)).toBe("ללא עדות");
    expect(findHandoffFinding(SHIPPED_PROFESSIONAL_HE_2)).toBe("נצפתה");
    expect(withoutHandoffFindings(SHIPPED_PROFESSIONAL_HE)).toBe("");
    // The finding clause goes; the advice clause after ";" is not a finding and stays.
    expect(withoutHandoffFindings(SHIPPED_PROFESSIONAL_HE_2)).toBe("מומלץ להמשיך לעודד פעילויות מבוססות קשר וויסות הדדי.");
    expect(withoutHandoffFindings(SHIPPED_PROFESSIONAL_HE_2)).not.toContain("נצפתה");
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

/* Critic round 1 (P1): the floor never removes an escalation line, never
   scrubs the School Brief's crisisEscalationTrigger, and keeps what the
   parent (or a named reporter) actually reported. The critic's probes. */
describe("B-ASKJB-44 · escalation lines survive the floor verbatim (EN + HE)", () => {
  it.each([
    "If he shows no signs of calming after 20 minutes, or hurts himself or others, call the parent and the school nurse right away.",
    "If there is no response to calming strategies and she is in danger, call 112 immediately.",
    "If difficulties persist with no improvement over several weeks, recommend a talk with a qualified professional.",
    "If there is no improvement in the sleep difficulties after four weeks, talk with your pediatrician.",
    "If there is no progress or new difficulties appear, discuss it with a qualified professional.",
    "אם אין סימנים של רגיעה אחרי 20 דקות, או שהוא פוגע בעצמו, יש להתקשר מיד להורים.",
    "אם הקשיים נמשכים ללא שיפור במשך כמה שבועות, מומלץ לשוחח עם איש מקצוע מוסמך.",
    "אם אין שיפור בקשיי השינה אחרי ארבעה שבועות, כדאי לדבר עם רופאת הילדים.",
  ])("kept: %s", (line) => {
    expect(statesUnreportedFinding(line)).toBe(false);
    expect(withoutHandoffFindings(line)).toBe(line);
  });

  it("the School Brief's crisisEscalationTrigger is never scrubbed, in EN and HE", () => {
    for (const trigger of [
      "If he shows no signs of calming after 20 minutes, or hurts himself or others, call the parent and the school nurse right away.",
      "אם אין סימנים של רגיעה אחרי 20 דקות, או שהוא פוגע בעצמו, יש להתקשר מיד להורים.",
      "No signs of distress so far; contact the family the same day if that changes.",
    ]) {
      const brief: Record<string, unknown> = { overview: "Shows no signs of anxiety at drop-off. Likes a warning.", crisisEscalationTrigger: trigger };
      expect(scrubHandoffBriefFindings(brief)).toBe(1);
      expect(brief.crisisEscalationTrigger).toBe(trigger);
      expect(brief.overview).toBe("Likes a warning.");
    }
  });
});

describe("B-ASKJB-44 · what the parent reported is kept (the critic's probes)", () => {
  it.each([
    "She was seen by a speech therapist last spring.",
    "He has been seen by the pediatrician, who ruled out an ear infection.",
    "She fell asleep without any difficulty on Tuesday.",
    "Mom reports no sleep difficulties since the new routine.",
    "Her teacher said she was observed hitting a classmate twice this week.",
    "I observed that she lines up her cars before bed.",
    "Her mother noted that mornings go better with a picture chart.",
    "Shows no hesitation joining group games.",
    "היא מטפסת על המגלשה הגבוהה ללא חשש.",
    "הוא אוהב לקפוץ לשלוליות אחרי הגשם.",
    "הגננת סיפרה שהוא נצפה מרביץ לילד אחר פעמיים השבוע.",
    "הוא נרדם ללא קושי ביום שלישי.",
    "אני ראיתי שהיא מסדרת את המכוניות לפני השינה.",
    "ההורה זיהה שהבקרים קלים יותר עם לוח תמונות.",
  ])("kept verbatim: %s", (sentence) => {
    expect(statesUnreportedFinding(sentence)).toBe(false);
    expect(withoutHandoffFindings(sentence)).toBe(sentence);
  });

  it("the floor's own positives still drop: the notes that shipped and an unreported 'no evidence of'", () => {
    expect(withoutHandoffFindings(SHIPPED_PROFESSIONAL_HE)).toBe("");
    expect(withoutHandoffFindings(SHIPPED_PROFESSIONAL_HE_2)).not.toContain("נצפתה");
    expect(withoutHandoffFindings("Maya shows no signs of attention difficulties.")).toBe("");
    expect(withoutHandoffFindings("מאיה נהנית מבנייה בקוביות, ללא עדות לקשיי קשב או ויסות משמעותיים בהקשר זה.")).toBe("");
    // Whole-word Hebrew: the stem inside a longer word does not match, the word itself does.
    expect(findHandoffFinding("הוא אוהב לקפוץ לשלוליות")).toBeNull();
    expect(findHandoffFinding("קשה לשלול קושי בקשב")).toBe("לשלול");
  });
});
