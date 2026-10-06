/**
 * B-GROWTH-36 — the say-back by age and by language (deterministic templates).
 * Fixtures from the item: age 2 monolingual word; age 5 bilingual English
 * quote (the line is in Hebrew); age 5 Hebrew quote (no say-back, kept as a
 * quote); age 7 question; every key resolves in EN + HE.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { translate } from "../i18n";
import { genderedKey } from "../today/fromRecord";
import {
  actNowKey,
  hasTransition,
  keptLanguage,
  quoteLanguage,
  quoteShape,
  sayBackFor,
  talkBandForMonths,
} from "./sayBack";

const GUY = ["Hebrew (Native)", "English (Transition)"];

describe("bands and shapes", () => {
  it("age decides the object: words under 3, talk 3–5, school from 6", () => {
    expect(talkBandForMonths(24)).toBe("words");
    expect(talkBandForMonths(35)).toBe("words");
    expect(talkBandForMonths(36)).toBe("talk");
    expect(talkBandForMonths(64)).toBe("talk");
    expect(talkBandForMonths(84)).toBe("school");
    expect(talkBandForMonths(NaN)).toBe("words");
  });
  it("quote shapes in EN + HE", () => {
    expect(quoteShape("dog")).toBe("word");
    expect(quoteShape("כלב")).toBe("word");
    expect(quoteShape("I saw a big truck at the park")).toBe("sentence");
    expect(quoteShape("why is the sky blue")).toBe("question");
    expect(quoteShape("למה הירח הולך איתנו?")).toBe("question");
  });
  it("the kept language is the Native one, else the first listed; transition needs 2+ languages", () => {
    expect(keptLanguage(GUY)).toBe("Hebrew");
    expect(keptLanguage(["English (Transition)", "Hebrew (Native)"])).toBe("Hebrew");
    expect(keptLanguage(["English"])).toBe("English");
    expect(hasTransition(GUY)).toBe(true);
    expect(hasTransition(["Hebrew", "English"])).toBe(false);
    expect(hasTransition(["English (Transition)"])).toBe(false);
  });
  it("the quote's language comes from its script, matched to the profile", () => {
    expect(quoteLanguage("Daddy look, a digger!", GUY)).toBe("English");
    expect(quoteLanguage("אבא תראה", GUY)).toBe("Hebrew");
    expect(quoteLanguage("123", GUY)).toBeNull();
  });
});

describe("the say-back fixtures", () => {
  it("age 2, monolingual, a word → say it back + one describing word, in that language", () => {
    const b = sayBackFor({ text: "ball", languages: ["English"], months: 24 })!;
    expect(b.mode).toBe("same");
    expect(b.band).toBe("words");
    expect(b.lineLocale).toBe("en");
    expect(translate("en", b.lineKey!, b.lineVars)).toBe("Yes, ball! What a lovely ball.");
    const he = sayBackFor({ text: "כדור", languages: ["Hebrew"], months: 24 })!;
    expect(translate("he", he.lineKey!, he.lineVars)).toBe("כן, כדור! איזה כדור יפה.");
  });

  it("age 5, bilingual in transition, an English quote → the line is in HEBREW (kept language)", () => {
    const b = sayBackFor({ text: "I saw a digger at the park", language: "English", languages: GUY, months: 64 })!;
    expect(b.mode).toBe("cross");
    expect(b.said).toBe("English");
    expect(b.answerIn).toBe("Hebrew");
    expect(b.lineLocale).toBe("he");
    expect(translate("he", b.lineKey!, b.lineVars)).toBe("ואז מה?");
    const head = (lang: "en" | "he") =>
      translate(lang, genderedKey(b.headKey, "boy"), { name: "Dylan", said: translate(lang, "ob.lang.english"), kept: translate(lang, "ob.lang.hebrew") });
    expect(head("en")).toBe("He said it in English. Say it back in Hebrew and add one:");
    expect(head("he")).toBe("הוא אמר את זה באנגלית. אמרו את זה בחזרה בעברית והוסיפו עוד משהו:");
    // the UI locale does not change the language of the words to say
    expect(translate(b.lineLocale!, b.lineKey!)).toMatch(/[א-ת]/);
  });

  it("age 5, bilingual, a Hebrew quote → no say-back (kept as a quote)", () => {
    expect(sayBackFor({ text: "אבא, תראה מחפרון!", languages: GUY, months: 64 })).toBeNull();
    expect(sayBackFor({ text: "anything", language: "Hebrew", languages: GUY, months: 64 })).toBeNull();
  });

  it("age 7, a question → 'what do you think?', gendered in Hebrew", () => {
    const b = sayBackFor({ text: "Why does the moon follow our car?", languages: ["English"], months: 84 })!;
    expect(b.shape).toBe("question");
    expect(b.band).toBe("school");
    expect(translate("en", b.lineKey!)).toBe("Good question. What do you think?");
    const he = sayBackFor({ text: "למה הירח נוסע איתנו?", languages: ["Hebrew"], months: 84 })!;
    expect(translate("he", genderedKey(he.lineKey!, "boy"))).toBe("שאלה טובה. מה אתה חושב?");
    expect(translate("he", genderedKey(he.lineKey!, "girl"))).toBe("שאלה טובה. מה את חושבת?");
    expect(translate("he", he.lineKey!)).toBe("שאלה טובה. מה את/ה חושב/ת?");
  });

  it("age 7 sentence → 'what else?'; a kept language without templates → the head carries the ask, no line", () => {
    const s = sayBackFor({ text: "We built a castle today", languages: ["English"], months: 84 })!;
    expect(translate("en", s.lineKey!)).toBe("What else?");
    const r = sayBackFor({ text: "I saw a digger", language: "English", languages: ["Russian (Native)", "English (Transition)"], months: 64 })!;
    expect(r.mode).toBe("cross");
    expect(r.lineKey).toBeNull();
    expect(r.headKey).toBe("elev.words.sayBack.head.crossOther");
  });

  it("empty text → null", () => {
    expect(sayBackFor({ text: "   ", languages: GUY, months: 64 })).toBeNull();
  });
});

describe("Act now if… (drafts, by age)", () => {
  it("under 3 words · 3–5 strangers · from 5 the teacher", () => {
    expect(actNowKey(20)).toBe("elev.words.actNow.words");
    expect(actNowKey(48)).toBe("elev.words.actNow.talk");
    expect(actNowKey(64)).toBe("elev.words.actNow.school");
    expect(translate("en", actNowKey(48), { name: "Dylan" })).toMatch(/hard to understand/);
    expect(translate("en", actNowKey(64), { name: "Dylan" })).toMatch(/teacher raises/);
  });
});

describe("every elev.words.* key resolves in EN and HE, gendered variants included; no count or verdict words", () => {
  const src = readFileSync(new URL("../i18nElevation/words.ts", import.meta.url), "utf8");
  const keys = [...new Set([...src.matchAll(/"(elev\.words\.[\w.]+)"/g)].map((m) => m[1]))];
  it("keys resolve", () => {
    expect(keys.length).toBeGreaterThan(20);
    for (const k of keys) {
      for (const lang of ["en", "he"] as const) {
        expect(translate(lang, k), `${lang}:${k}`).not.toBe(k);
        for (const g of [".boy", ".girl"]) {
          if (src.includes(`g("${k}"`)) expect(translate(lang, `${k}${g}`), `${lang}:${k}${g}`).not.toBe(`${k}${g}`);
        }
      }
    }
  });
  it("no %, score, behind/ahead, typical, streak in the copy", async () => {
    const { en, he } = await import("../i18nElevation/words");
    const bad = /%|\bscore|\bbehind\b|\bahead\b|\btypical|\bstreak|\bdelay|מאחור|ציון|רצף|תקין/i;
    for (const [k, v] of [...Object.entries(en), ...Object.entries(he)]) expect(bad.test(v), k).toBe(false);
  });
  it("the module makes no model call", () => {
    const code = readFileSync(new URL("./sayBack.ts", import.meta.url), "utf8");
    expect(code).not.toMatch(/fetch\(|ai\/|modelRouter|generate/);
  });
});
