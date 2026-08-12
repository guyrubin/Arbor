/**
 * Trust Center strings — firewall + parity guard (masterplan 3.3/3.4/3.1).
 *
 * 1. FIREWALL SCAN: banned verdict/trend vocabulary is absent from every
 *    module value in BOTH languages — EXCEPT inside the explicit "Arbor never
 *    shows…" negation sentences, whose keys are suffixed `.never` (the
 *    allowlist). A negative-control fixture proves the scanner actually
 *    catches violations (bash-heredoc lesson: prove the filter works).
 * 2. ALLOWLIST COVERAGE: each banned token really does appear in a `.never`
 *    key — the negation disclaimers exist and the allowlist is load-bearing.
 * 3. PARITY: en/he key sets are identical, all keys "elev.trust."-namespaced,
 *    no empty values.
 * 4. trustText(): he-first resolution, en fallback, {var} interpolation.
 * 5. CONSISTENCY: the screening-flag copy mirrors i18nElevation/screeningcalm
 *    ("worth a conversation" / "שווה שיחה" — a conversation starter, never a
 *    result), and the mockup lock line ships VERBATIM in Hebrew.
 */
import { describe, expect, it } from "vitest";
import { en, he, trustText } from "./trustcenter";
import { en as calmEn, he as calmHe } from "./screeningcalm";

// ── The banned vocabulary (both languages), per the build spec ───────────────
const BANNED_EN = ["score", "on track", "%", "high risk"];
const BANNED_HE = ["ציון", "אחוז", "סיכון גבוה"];
const BANNED_ALL = [...BANNED_EN, ...BANNED_HE];

const ALLOWLIST_RE = /\.never$/;

/** Fold Hebrew final letters to their base forms so "ציון" matches "ציונים"
 *  (the plural swaps final nun ן for נ — a naive substring scan is blind to
 *  every inflected form). */
const FINALS: Record<string, string> = { "ן": "נ", "ם": "מ", "ך": "כ", "ף": "פ", "ץ": "צ" };
function norm(s: string): string {
  return s.toLowerCase().replace(/[ןםךףץ]/g, (c) => FINALS[c]);
}

/** Scan one dictionary; returns [key, token] pairs found OUTSIDE the allowlist. */
function scanDict(dict: Record<string, string>): Array<[string, string]> {
  const hits: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(dict)) {
    if (ALLOWLIST_RE.test(key)) continue;
    const folded = norm(value);
    for (const token of BANNED_ALL) {
      if (folded.includes(norm(token))) hits.push([key, token]);
    }
  }
  return hits;
}

describe("trustcenter firewall — negative control (the scanner must catch violations)", () => {
  it("flags a fixture value containing banned vocabulary", () => {
    const dirty = {
      "elev.trust.fake.a": "Your child's score is 80% — high risk, not on track",
      "elev.trust.fake.b": "קיבלתם ציון של 90 אחוז — סיכון גבוה",
    };
    const hits = scanDict(dirty);
    // Every banned token must be caught at least once across the fixture.
    for (const token of BANNED_ALL) {
      expect(hits.some(([, t]) => t === token), `scanner missed "${token}"`).toBe(true);
    }
  });

  it("does NOT flag an allowlisted `.never` fixture key (the negation seam)", () => {
    expect(scanDict({ "elev.trust.fake.never": "never shows a score or %" })).toEqual([]);
  });
});

describe("trustcenter firewall — module values are clean outside .never keys", () => {
  it("EN: no banned vocabulary outside `.never` keys", () => {
    expect(scanDict(en)).toEqual([]);
  });
  it("HE: no banned vocabulary outside `.never` keys", () => {
    expect(scanDict(he)).toEqual([]);
  });
});

describe("trustcenter firewall — the negation disclaimers exist (allowlist coverage)", () => {
  const enNever = norm(Object.entries(en).filter(([k]) => ALLOWLIST_RE.test(k)).map(([, v]) => v).join(" "));
  const heNever = norm(Object.entries(he).filter(([k]) => ALLOWLIST_RE.test(k)).map(([, v]) => v).join(" "));

  for (const token of BANNED_EN) {
    it(`EN .never keys state the refusal for "${token}"`, () => {
      expect(enNever).toContain(norm(token));
    });
  }
  for (const token of BANNED_HE) {
    it(`HE .never keys state the refusal for "${token}"`, () => {
      expect(heNever).toContain(norm(token));
    });
  }
});

describe("trustcenter i18n parity", () => {
  it("en and he expose identical key sets", () => {
    const enKeys = Object.keys(en).sort();
    const heKeys = Object.keys(he).sort();
    expect(heKeys).toEqual(enKeys);
  });

  it("every key is elev.trust.-namespaced (existing-keys-win merge safety)", () => {
    for (const k of Object.keys(en)) expect(k.startsWith("elev.trust.")).toBe(true);
  });

  it("no empty values in either language", () => {
    for (const dict of [en, he]) {
      for (const [k, v] of Object.entries(dict)) {
        expect(v.trim().length, `empty value for ${k}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("trustText resolver", () => {
  it("resolves Hebrew when uiLang is he", () => {
    expect(trustText("he", "elev.trust.title")).toBe(he["elev.trust.title"]);
  });
  it("falls back to English for unknown languages", () => {
    expect(trustText("fr", "elev.trust.title")).toBe(en["elev.trust.title"]);
  });
  it("returns the key itself when unknown (app-wide convention)", () => {
    expect(trustText("en", "elev.trust.__missing__")).toBe("elev.trust.__missing__");
  });
  it("interpolates {var} placeholders and leaves unknown vars as-is", () => {
    const dictless = trustText("en", "elev.trust.__missing__ {n}", { n: 3 });
    expect(dictless).toBe("elev.trust.__missing__ 3");
  });
});

describe("trustcenter copy contracts", () => {
  it("HE lock line ships VERBATIM from Maytal's mockup frame 2", () => {
    expect(he["elev.trust.how.lock"]).toBe("המידע שלכם מאובטח — לא משתפים מידע אישי");
  });

  it("the flag legend mirrors screeningcalm's phrase (en: worth a conversation)", () => {
    expect(calmEn["elev.screencalm.row.discuss"]).toBe("worth a conversation");
    expect(en["elev.trust.signs.flag.label"].toLowerCase()).toContain("worth a conversation");
    // Honest-uncertainty rule: the flag is a conversation starter, not a result.
    expect(en["elev.trust.signs.flag.desc"].toLowerCase()).toContain("conversation starter");
    expect(en["elev.trust.signs.flag.desc"].toLowerCase()).toContain("not a result");
  });

  it("the flag legend mirrors screeningcalm's phrase (he: שווה שיחה)", () => {
    expect(calmHe["elev.screencalm.row.discuss"]).toBe("שווה שיחה");
    expect(he["elev.trust.signs.flag.label"]).toContain("שווה שיחה");
    expect(he["elev.trust.signs.flag.desc"]).toContain("לא תוצאה");
  });

  it("honest uncertainty: ranges + typical-for-this-age phrasing, never point claims", () => {
    expect(en["elev.trust.signs.ranges"].toLowerCase()).toContain("ranges");
    expect(en["elev.trust.signs.ranges"].toLowerCase()).toContain("typical for this age");
    expect(he["elev.trust.signs.ranges"]).toContain("טווחים");
  });

  it("GD-10 fail-closed: no expert-team / named-reviewer language in the module", () => {
    for (const dict of [en, he]) {
      for (const v of Object.values(dict)) {
        expect(v.toLowerCase()).not.toContain("expert team");
        expect(v).not.toContain("צוות מומחים");
        expect(v.toLowerCase()).not.toContain("reviewed by");
      }
    }
  });
});
