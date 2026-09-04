/**
 * The Condition-3 clinical scan must work in every language a document can be
 * GENERATED in — not just the one the term list was first written in.
 *
 * THE DEFECT, RESTATED AS A TEST: LC-11 made /generate-handoff emit Hebrew
 * prose for a Hebrew-UI parent, because the School Brief is written for a
 * Hebrew-speaking gan teacher. Condition 3 ("zero clinical-diagnosis
 * language") is enforced only by findClinicalDiagnosisTerm, whose term list was
 * entirely English and matched with `\b`. So the guarantee was not weakened for
 * Hebrew briefs — it was absent. A brief reading "סימנים של עיכוב שפתי" or
 * "חשד להפרעת קשב" exported clean, for precisely the parents the feature
 * targeted.
 *
 * The second trap is subtler and is why a naive fix would not have worked:
 * JavaScript's `\b` is defined over [A-Za-z0-9_], so a Hebrew letter is a
 * non-word character on both sides. Appending Hebrew terms to the English
 * matcher would have produced a list that looks protective and matches
 * nothing. The negative control below pins that.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  CLINICAL_DIAGNOSIS_TERMS,
  CLINICAL_DIAGNOSIS_TERMS_HE,
  CLINICAL_DIAGNOSIS_TERMS_BY_LANGUAGE,
  findClinicalDiagnosisTerm,
} from "./clinicalScan";

describe("a Hebrew brief is scanned, not waved through", () => {
  // Real sentences of the shape the model returns for a Hebrew-UI parent.
  const hebrewBriefs: Array<[string, string]> = [
    ["language delay", "בשיחות בגן ניכרים סימנים של עיכוב שפתי קל."],
    ["ADHD suspicion", "יש חשד להפרעת קשב וריכוז שכדאי לבדוק."],
    ["autism", "ההורים ציינו שעלתה שאלה של אוטיזם."],
    ["diagnosis", "הילד עבר אבחון בשנה שעברה."],
    ["diagnosed, feminine", "היא מאובחנת עם לקות למידה."],
    ["deficit", "קיים ליקוי בעיבוד חושי."],
    ["syndrome", "מדובר בתסמונת גנטית."],
  ];

  it.each(hebrewBriefs)("blocks a Hebrew brief containing a %s claim", (_label, text) => {
    expect(findClinicalDiagnosisTerm(text)).toBeTruthy();
  });

  it("still passes ordinary Hebrew classroom prose", () => {
    const clean = [
      "הוא נהנה לשחק עם חברים בחצר ואוהב לבנות מגדלים.",
      "כדאי לתת לו זמן להיפרד בבוקר, זה עוזר לו להיכנס ליום.",
      "היא אוהבת סיפורים לפני השינה ומבקשת אותו סיפור שוב ושוב.",
    ];
    for (const text of clean) expect(findClinicalDiagnosisTerm(text)).toBeNull();
  });

  it("NEGATIVE CONTROL: `\\b` cannot bound a Hebrew word, so the old matcher was inert", () => {
    // This is the fix that would have looked right and guarded nothing.
    const boundaryMatcher = (text: string) =>
      CLINICAL_DIAGNOSIS_TERMS_HE.some((term) => new RegExp(`\\b${term}\\b`, "i").test(text));
    for (const [, text] of hebrewBriefs) {
      expect(boundaryMatcher(text), "if this ever passes, `\\b` semantics changed — revisit the matcher").toBe(false);
      // ...while the shipped scanner catches every one of them.
      expect(findClinicalDiagnosisTerm(text)).toBeTruthy();
    }
  });

  it("matches through Hebrew prefixes and suffixes, which carry the same claim", () => {
    // ל+הפרעת, עיכוב+ים, ו+מאובחן — one glued particle must not be an escape.
    for (const text of ["חשד להפרעת קשב", "נצפו עיכובים בשפה", "הילד ומאובחן כבר שנה"]) {
      expect(findClinicalDiagnosisTerm(text)).toBeTruthy();
    }
  });
});

describe("English behaviour is unchanged by the Hebrew addition", () => {
  it("still catches the English terms on a word boundary", () => {
    expect(findClinicalDiagnosisTerm("This is a clear ADHD diagnosis")).toBeTruthy();
    expect(findClinicalDiagnosisTerm("a speech delay was mentioned")).toBeTruthy();
  });

  it("still does NOT match an English term embedded in a longer word", () => {
    // The `\b` behaviour is load-bearing for English and must not become a
    // substring match: "delayed" is a term, but "undelayedly" was never one and
    // "Adhdish" is not a word a brief would contain.
    expect(findClinicalDiagnosisTerm("the bus was not delaye")).toBeNull();
    expect(findClinicalDiagnosisTerm("she is a diagnostician's daughter")).toBeNull();
  });

  it("clean English prose still passes", () => {
    expect(findClinicalDiagnosisTerm("He loves building towers and playing outside.")).toBeNull();
  });
});

describe("coverage is pinned to the languages a document can be generated in", () => {
  /**
   * The real failure mode is not a missing word — it is a missing LANGUAGE.
   * Adding a third generation language would otherwise ship an export nothing
   * can scan, exactly as Hebrew did. So the term map is pinned against the
   * union in lib/api.ts that decides what language the model is asked to write.
   */
  const apiSrc = fs.readFileSync(path.resolve(__dirname, "api.ts"), "utf8").replace(/\r\n/g, "\n");

  it("the scanned file is real (a vacuous scan is not a pass)", () => {
    expect(apiSrc).toBeTruthy();
    expect(apiSrc).toContain("export function getAiLanguage()");
  });

  it("every generation language has a non-empty term list", () => {
    const union = /export function getAiLanguage\(\):\s*([^{]+)\{/.exec(apiSrc)?.[1] ?? "";
    expect(union, "could not read the AI-language union from lib/api.ts").toBeTruthy();
    const languages = [...union.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);
    expect(languages.length).toBeGreaterThan(0);
    for (const lang of languages) {
      const terms = (CLINICAL_DIAGNOSIS_TERMS_BY_LANGUAGE as Record<string, readonly string[]>)[lang];
      expect(
        terms,
        `a School Brief can be generated in "${lang}" but the Condition-3 scan has no term list for it — ` +
          `add one to CLINICAL_DIAGNOSIS_TERMS_BY_LANGUAGE, or the export is unscannable in that language`,
      ).toBeTruthy();
      expect(terms.length).toBeGreaterThan(0);
    }
  });

  it("each list actually fires through the shared scanner", () => {
    // A list present but unreachable from findClinicalDiagnosisTerm would be
    // the same defect wearing a passing test.
    for (const [lang, terms] of Object.entries(CLINICAL_DIAGNOSIS_TERMS_BY_LANGUAGE)) {
      for (const term of terms) {
        expect(findClinicalDiagnosisTerm(`context ${term} context`), `${lang}: "${term}" is not reachable`).toBeTruthy();
      }
    }
  });

  it("the English list was not silently emptied", () => {
    expect(CLINICAL_DIAGNOSIS_TERMS.length).toBeGreaterThanOrEqual(10);
    expect(CLINICAL_DIAGNOSIS_TERMS_HE.length).toBeGreaterThanOrEqual(10);
  });
});
