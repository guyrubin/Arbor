import { describe, expect, it } from "vitest";
import { PRACTICES } from "../../content/practices";
import { resolveHebrewSlash } from "../hebrewSlashGender";
import { PRACTICE_TITLE_MAX_WORDS, practiceTitle, titleIsWholeDo } from "./practiceTitle";

/* P5 critic r1 on #/overview (product P0-1): the practice title is a SHORT
   headline from the do's own words (≤ 8 words); the full do is the body. */
const words = (s: string) => s.split(/\s+/u).filter(Boolean);
const HANGING_EN = /\b(?:a|an|the|or|and|of|to|with|your|their|on|in|at|for|from|by)$/i;
const HANGING_HE = /(?:^|\s)(?:או|של|עם|על|את|ליד|בכל|באותו|לא)$/u;

describe("practiceTitle — the do's first clause, ≤ 8 words", () => {
  it("splits on the first clause boundary", () => {
    expect(practiceTitle("Read a board book together, and let your child turn every page.", "en")).toBe("Read a board book together");
    expect(practiceTitle("Draw side by side on big paper: you a circle, them anything.", "en")).toBe("Draw side by side on big paper");
    expect(practiceTitle("Look at one page together — name what you see.", "en")).toBe("Look at one page together");
    expect(practiceTitle("קראו יחד ספר קרטון, ותנו לילדה להפוך כל דף.", "he")).toBe("קראו יחד ספר קרטון");
  });
  it("a scene-setting first clause gives way to the action", () => {
    expect(practiceTitle("When the evening is different, a trip, guests, a cold, keep a short version of your usual steps in the usual order.", "en"))
      .toBe("Keep a short version of your usual steps");
    expect(practiceTitle("At a meal, ask one open question with no right answer.", "en")).toBe("Ask one open question with no right answer");
    expect(practiceTitle("בגינה, גשו יחד לילדים שמשחקים.", "he")).toBe("גשו יחד לילדים שמשחקים");
  });
  it("a long clause is cut before a joining word, never mid-phrase", () => {
    expect(practiceTitle("Thread large pasta tubes onto a shoelace together to make a necklace.", "en")).toBe("Thread large pasta tubes onto a shoelace together");
    expect(practiceTitle("Play with toy animals or cars on the floor and narrate what they do with action words.", "en")).toBe("Play with toy animals or cars");
  });
  it("a short headline equal to the whole do is detected (no repeated body line)", () => {
    expect(titleIsWholeDo(practiceTitle("Read it again.", "en"), "Read it again.")).toBe(true);
    expect(titleIsWholeDo(practiceTitle("Read it again, slowly.", "en"), "Read it again, slowly.")).toBe(false);
  });

  // The guard the product critic asked for: iterate the WHOLE library.
  it(`every practice in the library, EN and HE (both genders), yields a title of 2–${PRACTICE_TITLE_MAX_WORDS} words that does not hang`, () => {
    const bad: string[] = [];
    for (const p of PRACTICES) {
      const en = practiceTitle(p.do.en, "en");
      if (words(en).length < 2 || words(en).length > PRACTICE_TITLE_MAX_WORDS || HANGING_EN.test(en)) bad.push(`${p.id} en: ${en}`);
      for (const g of ["boy", "girl"]) {
        const he = practiceTitle(resolveHebrewSlash(p.do.he, g), "he");
        if (words(he).length < 2 || words(he).length > PRACTICE_TITLE_MAX_WORDS || HANGING_HE.test(he)) bad.push(`${p.id} he/${g}: ${he}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it("the title is the do's own words (no new copy to review)", () => {
    for (const p of PRACTICES) {
      const en = practiceTitle(p.do.en, "en");
      expect(p.do.en.toLowerCase()).toContain(words(en)[0].toLowerCase());
      for (const w of words(en).slice(1)) expect(p.do.en).toContain(w.replace(/,$/, ""));
    }
  });
});
