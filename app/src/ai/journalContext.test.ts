/**
 * B-LOOP-13 round 3 — the graded-difficulty screen on the Today's Focus text
 * (today-focus-v1 he-output was UNSAFE on 1.3.1: "…שעשויים להצביע על קושי קל").
 * A grading adjective with a difficulty noun, or an "indicates / points to"
 * frame before one, fails the focus closed in EN and HE; plain parent words
 * about a hard moment are not a grade and pass.
 */
import { describe, expect, it } from "vitest";
import { firstSentence, gradesTheChild, oneSayableSentence, sanitizeDoseRow, sentencesOf, stepFitsPractice } from "./journalContext";

describe("gradesTheChild — graded difficulty fails closed (EN + HE)", () => {
  it("EN: a grading adjective with a difficulty noun, or an indicates / points-to frame", () => {
    for (const line of [
      "This may show a slight difficulty with transitions.",
      "There is a mild delay in his words.",
      "It could be a minor problem at bedtime.",
      "A serious concern about mealtimes.",
      "These moments indicate a struggle with change.",
      "It points to some difficulty with sharing.",
      "This could be a sign of a delay.",
    ]) expect(gradesTheChild(line), line).toBe(true);
  });

  it("HE: noun + grading adjective, and 'להצביע על' + a difficulty noun", () => {
    for (const line of [
      "יש כאן קושי קל במעברים.",
      "ייתכן שמדובר בבעיה קטנה בשינה.",
      "נראה עיכוב משמעותי בדיבור.",
      "רגעים שעשויים להצביע על קושי קל.",
      "הדברים מצביעים על קשיים בארוחות.",
      "יש לו קשיים חמורים במעברים.",
    ]) expect(gradesTheChild(line), line).toBe(true);
  });

  it("plain parent words are not a grade and PASS (EN + HE)", () => {
    for (const line of [
      "קשה לו להירדם.",
      "בקושי קם הבוקר, אז נתחיל לאט.",
      "היה ערב קשה, ננסה משהו קטן מחר.",
      "It is hard for him to fall asleep, so try a quiet minute first.",
      "Bedtime was a big moment today; try one small step.",
      "Try a two-minute warning before leaving the house today.",
      "Mornings have been busiest around transitions this week.",
    ]) expect(gradesTheChild(line), line).toBe(false);
  });
});

describe("sanitizeDoseRow — a long child id is kept (round 3: the 80-char id cap dropped the continuity eval's rows)", () => {
  it("keeps practice.<200-char child id>.<day>; rejects a malformed id", () => {
    const long = `practice.eval-companion-continuity-v1-voice-night-answer-not-today-shapes-tomorrow.2026-10-05`;
    expect(sanitizeDoseRow({ id: long, practiceId: "pr-sleep-06", outcome: "not_today" })).toEqual({ id: long, practiceId: "pr-sleep-06", outcome: "not_today" });
    expect(sanitizeDoseRow({ id: `practice.${"c".repeat(201)}.2026-10-05`, practiceId: "pr-sleep-06" })).toBeNull();
    expect(sanitizeDoseRow({ id: "practice.child a.2026-10-05", practiceId: "pr-sleep-06" })).toBeNull();
    expect(sanitizeDoseRow({ id: "practice.child-a.yesterday", practiceId: "pr-sleep-06" })).toBeNull();
  });
});

describe("stepFitsPractice — the step is ABOUT the chosen practice (round 4)", () => {
  const sleep08 = "Draw the bedtime steps together, one small picture each, and stick the page where your child can point to what comes next. ציירו יחד את שלבי השינה, ציור קטן לכל שלב, ותלו את הדף במקום שבו הילד/ה יכול/ה להצביע על מה שבא אחר כך. What comes after pyjamas? Show me on our page. Sleep שינה sleep";
  it("EN: a bedtime step fits; a words step for a sleep pick does not", () => {
    expect(stepFitsPractice("Tonight, draw the bedtime steps on one page together.", sleep08)).toBe(true);
    expect(stepFitsPractice("Today, let's pay attention to how Noa is using words. Offer two words when Noa reaches for a toy.", sleep08)).toBe(false);
  });
  it("HE: a sleep-routine step fits; a family chores step does not", () => {
    expect(stepFitsPractice("הערב ציירו יחד את שלבי השינה על דף אחד.", sleep08)).toBe(true);
    expect(stepFitsPractice("אפשר לשתף את נועה במטלות קטנות בבית, כמו לאסוף צעצועים.", sleep08)).toBe(false);
  });
});

describe("round 5 — one sentence, EN + HE, at . ! ? ؟ boundaries", () => {
  it("firstSentence cuts at the first boundary (! and ? included, Hebrew too); under 8 chars → ''", () => {
    expect(firstSentence("Step, step, up we go! I'm right next to you.")).toBe("Step, step, up we go!");
    expect(firstSentence("Where's the bear? There he is!")).toBe("Where's the bear?");
    expect(firstSentence("מה בא אחרי הפיג'מה? תראי לי על הדף שלנו.")).toBe("מה בא אחרי הפיג'מה?");
    expect(firstSentence("בוא נלך לשטוף ידיים! אחר כך אוכלים.")).toBe("בוא נלך לשטוף ידיים!");
    expect(firstSentence("מה זה? משאית! משאית אדומה.")).toBe("");
    expect(firstSentence("Ok.")).toBe("");
    expect(firstSentence("One calm sentence with no end mark")).toBe("One calm sentence with no end mark");
  });
  it("sentencesOf / oneSayableSentence: the first sentence of ≥ 8 chars of a catalogue say-line", () => {
    expect(sentencesOf("That boy is crying. Maybe he's sad? What happened, I wonder?")).toEqual(["That boy is crying.", "Maybe he's sad?", "What happened, I wonder?"]);
    expect(oneSayableSentence("That boy is crying. Maybe he's sad? What happened, I wonder?")).toBe("That boy is crying.");
    expect(oneSayableSentence("מה זה? משאית! משאית אדומה. רוצה להגיד גם?")).toBe("משאית אדומה.");
    expect(oneSayableSentence("Hi! Yo!")).toBe("");
  });
});
