import { describe, expect, it } from "vitest";
import { CONCERN_CUES_EN, CONCERN_CUES_HE, EVENT_CUES_EN, EVENT_CUES_HE, hasConcernCue, hasEventCue } from "./concernCues";
import { describesConcernOrAbsence } from "../../server/milestoneMatch";

/* B-LOOP-06 (extract_log 1.3.1) — the ONE worry / negation list. The live
   judge on 1.3.0 turned loop-match-concern-en/he into a Words shelf; the
   server now drops any match on a description that carries one of these. */
describe("concernCues — a worry or a skill not shown is never milestone evidence", () => {
  const CONCERN = [
    "I'm worried she still doesn't put two words together like her cousin does.",
    "He can't climb the stairs yet.",
    "She won't point at things.",
    "He isn't yet walking on his own.",
    "Still not saying mama.",
    "We're concerned about his speech.",
    "I'm afraid he never answers to his name.",
    "She doesn’t wave bye (curly apostrophe).",
    "אני דואגת שהיא עדיין לא מחברת שתי מילים כמו בת הדודה שלה.",
    "הוא לא מצביע על דברים.",
    "היא אף פעם לא עונה לשם שלה.",
    "אנחנו מודאגים מהדיבור שלו.",
    "אבא דואג כי הוא עדיין לא הולך.",
  ];
  const SKILL = [
    "She said 'big ball' at the park today and pointed at it.",
    "We went to grandma's and had pasta for dinner.",
    "She counted to ten and said about fifty different words today.",
    "He fell asleep right after his bath and the book, no fuss.",
    "היא אמרה 'כדור גדול' בגינה היום והצביעה עליו.",
    "הוא נרדם מיד אחרי האמבטיה והספר, בלי מאבק.",
    "היא ספרה עד עשר ואמרה היום בערך חמישים מילים שונות.",
    // a word that merely CONTAINS לא is not the negation
    "היא אכלה את כל הצלחת המלאה.",
  ];
  it.each(CONCERN)("concern: %s", (text) => {
    expect(hasConcernCue(text)).toBe(true);
    expect(describesConcernOrAbsence(text)).toBe(true);
  });
  it.each(SKILL)("no cue: %s", (text) => {
    expect(hasConcernCue(text)).toBe(false);
    expect(describesConcernOrAbsence(text)).toBe(false);
  });
  it("the condition-question screen is reused, not re-listed", () => {
    expect(hasConcernCue("Does she have autism? She lines up her cars.")).toBe(false);
    expect(describesConcernOrAbsence("Does she have autism? She lines up her cars.")).toBe(true);
  });
  it("every cue the prompt names is caught by the guard (prompt and guard cannot drift)", () => {
    for (const cue of CONCERN_CUES_EN) expect(hasConcernCue(`she ${cue} that`)).toBe(true);
    for (const cue of CONCERN_CUES_HE) {
      for (const form of cue.includes("/") ? [cue.replace(/\/ת$/, ""), cue.replace("/", "")] : [cue]) {
        expect(hasConcernCue(`אמא ${form} היום`)).toBe(true);
      }
    }
  });
  it("event cues (data): an outing, a visit or a meal names no skill; EN + HE", () => {
    expect(hasEventCue("We went to grandma's and had pasta for dinner.")).toBe(true);
    expect(hasEventCue("הלכנו לסבתא ואכלנו פסטה לארוחת ערב.")).toBe(true);
    expect(hasEventCue("ביקרנו בגן החיות.")).toBe(true);
    for (const cue of EVENT_CUES_EN) expect(hasEventCue(`so ${cue} there`)).toBe(true);
    for (const cue of EVENT_CUES_HE) expect(hasEventCue(`אז ${cue} שם`)).toBe(true);
    // skills shown in the words carry no event cue
    for (const text of [
      "She said 'big ball' at the park today and pointed at it.",
      "He fell asleep right after his bath and the book, no fuss.",
      "He was playing with his cars this afternoon and seemed busy.",
      "She counted to ten and said about fifty different words today.",
      "היא אמרה 'כדור גדול' בגינה היום והצביעה עליו.",
      "הוא נרדם מיד אחרי האמבטיה והספר, בלי מאבק.",
      "היא ספרה עד עשר ואמרה היום בערך חמישים מילים שונות.",
    ]) expect(hasEventCue(text)).toBe(false);
  });
  it("non-strings and blanks are not cues", () => {
    expect(hasConcernCue(undefined)).toBe(false);
    expect(hasConcernCue("   ")).toBe(false);
    expect(hasConcernCue(42)).toBe(false);
  });
});
