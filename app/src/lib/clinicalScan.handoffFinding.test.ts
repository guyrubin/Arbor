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
    "She fell asleep without any difficulty on Tuesday.",
    "I observed that she lines up her cars before bed.",
    "Her mother noted that mornings go better with a picture chart.",
    "Shows no hesitation joining group games.",
    "היא מטפסת על המגלשה הגבוהה ללא חשש.",
    "הוא אוהב לקפוץ לשלוליות אחרי הגשם.",
    "הוא נרדם ללא קושי ביום שלישי.",
    "אני ראיתי שהיא מסדרת את המכוניות לפני השינה.",
    "ההורה זיהה שהבקרים קלים יותר עם לוח תמונות.",
  ])("not a finding, kept verbatim: %s", (sentence) => {
    expect(statesUnreportedFinding(sentence)).toBe(false);
    expect(withoutHandoffFindings(sentence)).toBe(sentence);
  });

  // Round 4 (critic round 3 P1): a reporter in the note is not the parent's
  // words. These four stated a finding and were kept on attribution alone;
  // they are kept now only when the parent's text carries the finding.
  it.each([
    ["He has been seen by the pediatrician, who ruled out an ear infection.", "The pediatrician ruled out an ear infection last month."],
    ["Mom reports no sleep difficulties since the new routine.", "Honestly no sleep difficulties since the new routine, just mornings."],
    ["Her teacher said she was observed hitting a classmate twice this week.", "Her teacher said she was observed hitting a classmate twice this week. What do I tell her?"],
    ["הגננת סיפרה שהוא נצפה מרביץ לילד אחר פעמיים השבוע.", "הגננת סיפרה לי שהוא נצפה מרביץ לילד אחר פעמיים השבוע. מה עושים?"],
  ])("a reported finding is kept only with the parent's words: %s", (sentence, parentText) => {
    expect(statesUnreportedFinding(sentence)).toBe(true);
    expect(withoutHandoffFindings(sentence)).toBe("");
    expect(statesUnreportedFinding(sentence, { parentText })).toBe(false);
    expect(withoutHandoffFindings(sentence, { parentText })).toBe(sentence);
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

/* Critic round 2 (P1): attribution and escalation are structural. A reporter
   word or an urgent word earlier in the clause no longer launders a finding;
   only the parent's own input, a reporter + reporting verb that directly
   govern the finding, a trailing "according to <reporter>", or a condition
   together with a referral action keep it. */
describe("B-ASKJB-44 · round 2 — invented findings behind a lead-in are dropped", () => {
  it.each([
    "Parent reports morning separation crying, with no evidence of attention or regulation difficulties.",
    "During parent-child play, no signs of attention or regulation difficulties were observed.",
    "In free play with his mother, Noa shows no signs of sensory overload.",
    "Our conversation suggests no evidence of a language delay.",
    "He settled immediately and showed no signs of anxiety at drop-off.",
    "My son shows no signs of attention difficulties.",
    "We see no evidence of developmental delay in his play.",
    "If useful for context: there are no signs of a speech delay.",
    "Should the teacher ask, there is no evidence of ADHD.",
    "ההורים מדווחים שהילד מגיב היטב לזמני חיבור קצרים, ללא עדות לקשיי קשב או ויסות משמעותיים בהקשר זה.",
    "במשחק משותף עם אמא נצפתה אינטראקציה חיובית.",
    "הוא נרגע מיד וללא סימנים למצוקה.",
    "נראה שאין סימנים לקושי בקשב.",
    "הילד שיחק בקוביות ונצפתה הנאה רבה.",
    "חשוב לציין שנצפתה התקדמות בשפה.",
    "כשנצפה בגן, הוא שיחק לבד.",
    "ההתנהגות תקינה ואין סימנים לעיכוב שפתי.",
    "האחות אמרה שהם שיחקו יפה, ללא סימנים למצוקה.",
  ])("dropped: %s", (sentence) => {
    expect(statesUnreportedFinding(sentence)).toBe(true);
    expect(withoutHandoffFindings(sentence)).toBe("");
  });

  it("clause level: the real fixture note keeps its first clause and drops the finding", () => {
    expect(withoutHandoffFindings("The child responds well to short connection times; no evidence of attention or regulation difficulties in this context."))
      .toBe("The child responds well to short connection times;");
    expect(withoutHandoffFindings("Teachers can check in briefly; there is no evidence of a learning difficulty."))
      .toBe("Teachers can check in briefly;");
  });

  it("a trailing attribution to a named reporter (P2d) is kept only when the parent wrote the finding and named the reporter (round 4)", () => {
    for (const [s, parentText] of [
      ["No signs of anxiety at drop-off, according to her teacher.", "Her teacher told me there are no signs of anxiety at drop-off."],
      ["אין סימנים לחרדה בפרידה, לדברי הגננת.", "הגננת אמרה לי שאין סימנים לחרדה בפרידה."],
    ]) {
      expect(withoutHandoffFindings(s)).toBe("");
      expect(withoutHandoffFindings(s, { parentText })).toBe(s);
    }
  });

  it("kept: a finding the parent's own input contains (first person passes only this way)", () => {
    const parentText = "My son shows no signs of attention difficulties at home, his teacher agrees.";
    expect(withoutHandoffFindings("My son shows no signs of attention difficulties.", { parentText })).toBe("My son shows no signs of attention difficulties.");
    expect(withoutHandoffFindings("My son shows no signs of attention difficulties.")).toBe("");
    const heParent = "הרופאה אמרה לנו שאין עדות לדלקת אוזניים.";
    expect(withoutHandoffFindings("אין עדות לדלקת אוזניים.", { parentText: heParent })).toBe("אין עדות לדלקת אוזניים.");
  });

  it("the urgent or reporter-like word alone no longer keeps a line: a condition needs a referral action", () => {
    expect(statesUnreportedFinding("If he is calm, there are no signs of distress.")).toBe(true);
    // A referral with no condition keeps only its own clause; the finding clause still drops.
    expect(withoutHandoffFindings("There are no signs of distress; call the family immediately.")).toBe("call the family immediately.");
    expect(statesUnreportedFinding("If there are no signs of calming after 20 minutes, call the family.")).toBe(false);
  });
});

/* Critic round 3 (P1), fixed in round 4: the attribution and trailing-clause
   exemptions never checked the parent's words, and containment matched only
   the finding's opening phrase. Now a finding passes only when ONE sentence
   of the parent's text holds the finding phrase AND its object (in order,
   close together), every source the note credits is one the parent named,
   and the parent's sentence is a statement (not a question or an "if").
   Every class below has cases that fail on 5fb5666f (40 expectations); the
   kept-verbatim cases that already held there stay as pins. */
describe("B-ASKJB-44 · round 4 — the parent's own words decide, never attribution (EN + HE)", () => {
  const UNRELATED_EN = "We have a few minutes together after dinner. What can we do? He loves drawing.";
  const UNRELATED_HE = "יש לנו כמה דקות יחד אחרי ארוחת הערב. מה אפשר לעשות?";

  it.each([
    ["Parent reports no evidence of attention or regulation difficulties.", UNRELATED_EN],
    ["The parents say that he shows no signs of sensory overload.", UNRELATED_EN],
    ["Her teacher says there is no evidence of attention difficulties.", UNRELATED_EN],
    ["The pediatrician, who ruled out a hearing problem, was pleased.", UNRELATED_EN],
    ["ההורים מספרים שאין סימנים לקשיי קשב או ויסות.", UNRELATED_HE],
    ["הגננת סיפרה שאין סימנים לחרדה בפרידה.", "הגננת סיפרה שהוא בוכה בפרידה."],
    ["הגננת סיפרה שהוא נצפה משחק לבד.", UNRELATED_HE],
  ])("an attributed finding the parent never wrote is dropped: %s", (sentence, parentText) => {
    expect(statesUnreportedFinding(sentence, { parentText })).toBe(true);
    expect(withoutHandoffFindings(sentence, { parentText })).toBe("");
  });

  it.each([
    ["There is no evidence of attention difficulties, according to the family.", UNRELATED_EN],
    ["No signs of anxiety at drop-off, according to her teacher.", "Her teacher says he settles fast. No idea about drop-off yet."],
    ["No signs of sensory overload at parties, her teacher says.", UNRELATED_EN],
    ["אין עדות לקשיי קשב, לדברי ההורים.", UNRELATED_HE],
    ["אין סימנים לחרדה בפרידה, לדברי הגננת.", "הגננת אמרה שהוא נרגע מהר."],
  ])("a trailing-clause finding the parent never wrote is dropped: %s", (sentence, parentText) => {
    expect(statesUnreportedFinding(sentence, { parentText })).toBe(true);
    expect(withoutHandoffFindings(sentence, { parentText })).toBe("");
  });

  it.each([
    ["There is no evidence of attention or regulation difficulties.", "The doctor found no evidence of an ear infection last week. He still cries at drop-off."],
    ["There are no signs of difficulty with transitions at school.", "There are no signs of difficulty with transitions at home."],
    ["No evidence of attention or regulation difficulties.", "No evidence of attention difficulties, the teacher said."],
    ["No signs of crying at home.", "No signs of anxiety at school, but lots of crying at home."],
    ["אין סימנים לקשיי קשב או ויסות.", "הרופאה אמרה שאין סימנים לדלקת אוזניים. הוא עדיין בוכה בבוקר."],
    ["אין סימנים לחרדה בגן.", "אין סימנים לחרדה בבית."],
    ["אין עדות לקשיי קשב או ויסות.", "אין עדות לקשיי קשב, אמרה הגננת."],
  ])("only the opening phrase in the parent's text is not enough; the object must be there too: %s", (sentence, parentText) => {
    expect(statesUnreportedFinding(sentence, { parentText })).toBe(true);
    expect(withoutHandoffFindings(sentence, { parentText })).toBe("");
  });

  it.each([
    ["No signs of anxiety at drop-off, according to the pediatrician.", "No signs of anxiety at drop-off, his teacher said."],
    ["According to Dr. Cohen, there are no signs of anxiety at drop-off.", "There are no signs of anxiety at drop-off."],
    ["Dana says there are no signs of anxiety at drop-off.", "There are no signs of anxiety at drop-off."],
    ["אין סימנים לחרדה, לדברי המורה.", "ההורה אמר שאין סימנים לחרדה."],
    ["לדברי דנה, אין סימנים לחרדה בפרידה.", "אין סימנים לחרדה בפרידה."],
  ])("a source the parent never named is not credited, even when the parent wrote the finding: %s", (sentence, parentText) => {
    expect(withoutHandoffFindings(sentence, { parentText })).toBe("");
  });

  it.each([
    ["There is no evidence of ADHD.", "Could it be that there is no evidence of ADHD?"],
    ["There are no signs of anxiety at drop-off.", "If there are no signs of anxiety at drop-off by Friday we will stop the chart."],
    ["אין סימנים לחרדה בפרידה.", "האם זה נורמלי שאין סימנים לחרדה בפרידה?"],
    ["אין סימנים לחרדה בפרידה.", "אם אין סימנים לחרדה בפרידה עד יום שישי נפסיק."],
  ])("a parent's question or 'if' is not a report: %s", (sentence, parentText) => {
    expect(withoutHandoffFindings(sentence, { parentText })).toBe("");
  });

  it.each([
    // tense and number change; the finding and its object are the parent's
    ["He shows no signs of anxiety at bedtime.", "He showed no signs of anxiety at bedtime yesterday."],
    ["There are no signs of distress at drop-off.", "No signs of anxiety, distress or crying at drop-off this week."],
    ["No signs of anxiety at drop-off, according to her teacher.", "The teacher called today. She said there are no signs of anxiety at drop off."],
    ["According to Dr. Cohen, there are no signs of anxiety at drop-off.", "Dr. Cohen said there are no signs of anxiety at drop-off."],
    ["Sensory issues have been ruled out.", "The OT said sensory issues have been ruled out."],
    // Hebrew: glued particles and endings on the parent's side or the note's
    ["אין סימנים לחרדה בפרידה.", "הגננת אמרה: אין סימן לחרדה בפרידה."],
    ["אין סימנים לחרדה בפרידה, לדברי הגננת.", "הגננת אמרה לי שאין סימנים של חרדה בפרידה בבוקר."],
    ["אין סימנים לקשיים בשינה.", "בבית אין סימנים של קשיים בשינה מאז השגרה החדשה."],
    ["אין סימנים לחרדה בפרידה, אמרה הגננת.", "הגננת אמרה שאין סימנים לחרדה בפרידה."],
  ])("a finding the parent fully stated is kept verbatim: %s", (sentence, parentText) => {
    expect(statesUnreportedFinding(sentence, { parentText })).toBe(false);
    expect(withoutHandoffFindings(sentence, { parentText })).toBe(sentence);
  });

  it("Hebrew words compare across particles and endings, never across two different words", () => {
    // "מורה" (teacher) and "הורה" (parent) differ only in a particle-like first letter: never the same source.
    expect(withoutHandoffFindings("אין סימנים לחרדה, לדברי המורים.", { parentText: "ההורים אמרו שאין סימנים לחרדה." })).toBe("");
    expect(withoutHandoffFindings("אין סימנים לחרדה, לדברי המורים.", { parentText: "המורים אמרו שאין סימנים לחרדה." })).toBe("אין סימנים לחרדה, לדברי המורים.");
  });

  it.each([
    "If there are no signs of improvement after two weeks, talk with Dr. Levi.",
    "If there are no signs of improvement after two weeks, talk with Dr Levi.",
    "אם אין סימנים של רגיעה אחרי 20 דקות, דברו עם ד\"ר לוי.",
    "אם אין סימנים של רגיעה אחרי 20 דקות, דברו עם ד״ר לוי.",
  ])("an escalation line that names the doctor by title is kept verbatim, with or without the parent's words: %s", (line) => {
    expect(withoutHandoffFindings(line)).toBe(line);
    expect(withoutHandoffFindings(line, { parentText: UNRELATED_EN })).toBe(line);
    expect(withoutHandoffFindings(line, { parentText: UNRELATED_HE })).toBe(line);
  });

  it("every round-1 escalation line and the School Brief escalation field survive with the parent's text given (EN + HE)", () => {
    for (const line of [
      "If he shows no signs of calming after 20 minutes, or hurts himself or others, call the parent and the school nurse right away.",
      "If there is no improvement in the sleep difficulties after four weeks, talk with your pediatrician.",
      "אם אין סימנים של רגיעה אחרי 20 דקות, או שהוא פוגע בעצמו, יש להתקשר מיד להורים.",
      "אם אין שיפור בקשיי השינה אחרי ארבעה שבועות, כדאי לדבר עם רופאת הילדים.",
    ]) {
      expect(withoutHandoffFindings(line, { parentText: UNRELATED_EN })).toBe(line);
    }
    const brief: Record<string, unknown> = {
      overview: "Noa is settling in. No signs of anxiety at drop-off, according to her teacher. She likes a warning before cleanup.",
      keyStrengths: ["Curious", "No sleep difficulties since the new routine."],
      crisisEscalationTrigger: "No signs of distress so far; contact the family the same day if that changes.",
    };
    const parentText = "No sleep difficulties since the new routine\nshe cries at drop-off";
    expect(scrubHandoffBriefFindings(brief, { parentText })).toBe(1);
    expect(brief).toEqual({
      overview: "Noa is settling in. She likes a warning before cleanup.",
      keyStrengths: ["Curious", "No sleep difficulties since the new routine."],
      crisisEscalationTrigger: "No signs of distress so far; contact the family the same day if that changes.",
    });
  });
});
