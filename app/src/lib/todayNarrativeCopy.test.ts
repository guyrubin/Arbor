/**
 * Today-narrative copy defects found by the visual audit 2026-08-12.
 *
 * (a) PLURALIZATION — `today.narrative.changedBody` had no singular form, so a
 *     week with one saved activity rendered "3 moments and 1 activities were
 *     saved this week", with the identical bug in Hebrew ("1 פעילויות").
 *     Fixed on the codebase's .one/.many convention (cf.
 *     elev.sincevisit.row.moment.one/.many): each of the three counts resolves
 *     its own fragment, and the composite template — same key, same
 *     placeholders — stitches them.
 *
 * (b) HEBREW BRAND NAME — one Hebrew screen mixed "ארבור" ("ארבור זוכר",
 *     "צעדים ראשונים עם ארבור") with the Latin mark ("Arbor ינחה את הצעד
 *     הבא"). The HE dictionary's own majority settles it: transliterated
 *     ארבור. Two exceptions stay Latin and are pinned here so the sweep is not
 *     re-run over them.
 */
import { describe, expect, it } from "vitest";
import { en, he, translate } from "./i18n";

// translate() wraps RTL interpolations in Unicode bidi isolates (FSI…PDI).
// Strip them before comparing rendered prose.
const plain = (s: string) => s.replace(/[⁦-⁩]/g, "");

const FRAGMENTS = [
  "today.narrative.changedBody.moments",
  "today.narrative.changedBody.plays",
  "today.narrative.changedBody.milestones",
];

describe("(a) changedBody — .one/.many pairs exist in both dictionaries", () => {
  for (const base of FRAGMENTS) {
    it(`${base}.one/.many are present and non-empty in en + he`, () => {
      for (const dict of [en, he]) {
        expect(dict[`${base}.one`]).toBeTruthy();
        expect(dict[`${base}.many`]).toBeTruthy();
      }
    });
    it(`${base}.many carries the {n} count, .one does not need it`, () => {
      expect(en[`${base}.many`]).toContain("{n}");
      expect(he[`${base}.many`]).toContain("{n}");
    });
  }

  it("the composite template keeps its original key and placeholders", () => {
    for (const dict of [en, he]) {
      const v = dict["today.narrative.changedBody"];
      expect(v).toContain("{moments}");
      expect(v).toContain("{plays}");
      expect(v).toContain("{milestones}");
    }
  });
});

/** The consumer's rule (ProgressNarrative): n === 1 is the ONLY singular. */
const plural = (lang: "en" | "he", base: string, n: number) =>
  translate(lang, `${base}.${n === 1 ? "one" : "many"}`, { n });
const changed = (lang: "en" | "he", moments: number, plays: number, milestones: number) =>
  plain(
    translate(lang, "today.narrative.changedBody", {
      moments: plural(lang, "today.narrative.changedBody.moments", moments),
      plays: plural(lang, "today.narrative.changedBody.plays", plays),
      milestones: plural(lang, "today.narrative.changedBody.milestones", milestones),
    })
  );

describe("(a) changedBody — rendered sentences agree in number", () => {
  it("EN: the reported 1-activity case no longer reads '1 activities'", () => {
    const out = changed("en", 3, 1, 1);
    expect(out).toBe("3 moments and 1 activity were saved this week. 1 milestone has been noticed so far.");
    expect(out).not.toContain("1 activities");
  });

  it("HE: the identical bug is gone ('1 פעילויות' never renders)", () => {
    const out = changed("he", 3, 1, 1);
    expect(out).toBe("3 רגעים ופעילות אחת נשמרו השבוע. אבן דרך אחת סומנה עד כה.");
    expect(out).not.toContain("1 פעילויות");
  });

  it("all-singular reads correctly in both languages", () => {
    expect(changed("en", 1, 1, 1)).toBe("1 moment and 1 activity were saved this week. 1 milestone has been noticed so far.");
    expect(changed("he", 1, 1, 1)).toBe("רגע אחד ופעילות אחת נשמרו השבוע. אבן דרך אחת סומנה עד כה.");
  });

  it("zero takes the plural form in both languages (0 is not singular)", () => {
    expect(changed("en", 0, 0, 0)).toBe("0 moments and 0 activities were saved this week. 0 milestones have been noticed so far.");
    expect(changed("he", 0, 0, 0)).toContain("0 רגעים");
  });

  it("no stray placeholder survives interpolation", () => {
    for (const lang of ["en", "he"] as const) {
      for (const n of [0, 1, 5]) expect(changed(lang, n, n, n)).not.toMatch(/\{[a-z]+\}/);
    }
  });

  it("firewall: the counts-only register holds — no %, score or trend adjective", () => {
    for (const lang of ["en", "he"] as const) {
      expect(changed(lang, 3, 1, 1)).not.toMatch(/%|score|faster|slower|better|worse/i);
    }
  });
});

describe("(b) Hebrew brand name — one convention, the dictionary's own majority", () => {
  /** Latin "Arbor" survives only where the Latin wordmark IS the content. */
  const ALLOWED_LATIN = new Set([
    "aria.arborMark", // the accessible name of the Latin logo mark itself
    "consult.visionNote.title", // "Arbor Vision" — a named sub-product
  ]);

  it("no HE value carries a bare Latin 'Arbor' outside the two exceptions", () => {
    const offenders = Object.keys(he).filter(
      (k) => !ALLOWED_LATIN.has(k) && /\bArbor\b/.test(he[k])
    );
    expect(offenders, `HE values still using the Latin mark: ${offenders.join(", ")}`).toEqual([]);
  });

  it("the two exceptions still hold their Latin form (they are the mark, not prose)", () => {
    expect(he["aria.arborMark"]).toBe("Arbor");
    expect(he["consult.visionNote.title"]).toContain("Arbor Vision");
  });

  it("the transliterated form is what Hebrew prose uses, and it is the majority", () => {
    const HEB = "ארבור"; // ארבור
    const translit = Object.values(he).filter((v) => v.includes(HEB)).length;
    const latin = Object.values(he).filter((v) => /\bArbor\b/.test(v)).length;
    expect(translit).toBeGreaterThan(latin);
    // The audit's own examples, now consistent on one screen.
    expect(he["today.intent.remembers"]).toContain(HEB);
    expect(he["today.header.sub"]).toContain(HEB);
    expect(he["today.header.sub"]).not.toMatch(/\bArbor\b/);
  });

  it("no Hebrew prefix is left dangling on a hyphen before the brand", () => {
    const HEB = "ארבור";
    const dangling = Object.keys(he).filter((k) =>
      new RegExp(`[א-ת][-־‐‑]${HEB}`).test(he[k])
    );
    expect(dangling, `hyphenated brand forms: ${dangling.join(", ")}`).toEqual([]);
  });
});
