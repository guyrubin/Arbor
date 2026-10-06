/**
 * AP-054 — vocabAgg unit tests.
 *
 * Acceptance criteria tested:
 *  1. Combined total leads: combinedTotal() is the sum of all per-language counts.
 *  2. Per-language counts are correct.
 *  3–7. B-GROWTH-14 retired mixPct() (a share) and buildVocabTrend() (the
 *     stacked per-language chart); profileLangCounts() and monthlyWordCounts()
 *     replace them — counts in the profile's own languages, and a month list.
 *  8. FRAMING GATE: banned words absent from vocabAgg.ts source.
 *  9. LanguageLabVocabView source: interpretation caption + provenance line +
 *     activity sub-line + first-view disclaimer render verbatim.
 * 10. LanguageLabVocabView source: banned word list absent from rendered copy.
 * 11. LanguageLabVocabView source: no warning-token class on either language bar.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  aggregateLangCounts,
  combinedTotal,
  profileLangCounts,
  monthlyWordCounts,
  type LangObservation,
} from "./vocabAgg";

// ── Helpers ───────────────────────────────────────────────────────────────────

function obs(language: string, phrase: string, daysAgo: number, nowMs: number): LangObservation {
  const ts = new Date(nowMs - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  return { id: `${language}-${phrase}-${daysAgo}`, timestamp: ts, language, phrase };
}

const NOW_MS = new Date("2026-06-23T12:00:00Z").getTime();

// ── 1+2. aggregateLangCounts ──────────────────────────────────────────────────

describe("aggregateLangCounts", () => {
  it("counts each language correctly", () => {
    const observations: LangObservation[] = [
      obs("Hebrew", "שלום", 1, NOW_MS),
      obs("Hebrew", "תודה", 2, NOW_MS),
      obs("Hebrew", "מים", 3, NOW_MS),
      obs("English", "dog", 1, NOW_MS),
      obs("English", "cat", 2, NOW_MS),
    ];
    const counts = aggregateLangCounts(observations);
    const he = counts.find((c) => c.language === "Hebrew")!;
    const en = counts.find((c) => c.language === "English")!;
    expect(he.count).toBe(3);
    expect(en.count).toBe(2);
  });

  it("returns empty array for no observations", () => {
    expect(aggregateLangCounts([])).toEqual([]);
  });

  it("sorts descending by count", () => {
    const observations: LangObservation[] = [
      obs("English", "dog", 1, NOW_MS),
      obs("Hebrew", "שלום", 1, NOW_MS),
      obs("Hebrew", "תודה", 2, NOW_MS),
    ];
    const counts = aggregateLangCounts(observations);
    expect(counts[0].language).toBe("Hebrew");
    expect(counts[1].language).toBe("English");
  });

  it("ignores blank language values", () => {
    const observations: LangObservation[] = [
      { id: "1", timestamp: new Date(NOW_MS).toISOString(), language: "  ", phrase: "x" },
      obs("English", "dog", 1, NOW_MS),
    ];
    const counts = aggregateLangCounts(observations);
    expect(counts.length).toBe(1);
    expect(counts[0].language).toBe("English");
  });
});

// ── 1. combinedTotal leads ────────────────────────────────────────────────────

describe("combinedTotal", () => {
  it("is the sum of all per-language counts (combined total leads)", () => {
    const observations: LangObservation[] = [
      obs("Hebrew", "שלום", 1, NOW_MS),
      obs("Hebrew", "תודה", 2, NOW_MS),
      obs("Hebrew", "מים", 3, NOW_MS),
      obs("English", "dog", 1, NOW_MS),
      obs("English", "cat", 2, NOW_MS),
    ];
    const counts = aggregateLangCounts(observations);
    expect(combinedTotal(counts)).toBe(5);
  });

  it("returns 0 for empty counts", () => {
    expect(combinedTotal([])).toBe(0);
  });
});

// ── 3–7. B-GROWTH-14: profile-language counts + month list ─────────────────

describe("profileLangCounts (B-GROWTH-14)", () => {
  it("a Russian+Hebrew profile with 3 Russian words reads Russian 3 · Hebrew 0 — no English", () => {
    const observations = [obs("Russian", "мама", 1, NOW_MS), obs("Russian", "дом", 2, NOW_MS), obs("Russian", "кот", 3, NOW_MS)];
    const rows = profileLangCounts(["Russian", "Hebrew"], aggregateLangCounts(observations));
    expect(rows).toEqual([{ language: "Russian", count: 3 }, { language: "Hebrew", count: 0 }]);
    expect(rows.map((r) => `${r.language} ${r.count}`).join(" · ")).toBe("Russian 3 · Hebrew 0");
    expect(rows.some((r) => /english/i.test(r.language))).toBe(false);
  });

  it("keeps profile order and appends a logged language the profile no longer lists", () => {
    const rows = profileLangCounts(["Arabic", "Hebrew"], [{ language: "Hebrew", count: 2 }, { language: "French", count: 1 }]);
    expect(rows.map((r) => r.language)).toEqual(["Arabic", "Hebrew", "French"]);
    expect(rows.reduce((s, r) => s + r.count, 0)).toBe(3);
  });
});

describe("monthlyWordCounts (B-GROWTH-14)", () => {
  it("counts per calendar month, newest first", () => {
    const at = (iso: string, i: number): LangObservation => ({ id: `o${i}`, timestamp: iso, language: "Hebrew", phrase: `w${i}` });
    const rows = monthlyWordCounts([
      at("2026-09-02T10:00:00Z", 1), at("2026-09-20T10:00:00Z", 2), at("2026-09-30T10:00:00Z", 3), at("2026-09-01T00:00:00Z", 4),
      at("2026-08-15T10:00:00Z", 5), at("2025-12-31T23:00:00Z", 6),
    ]);
    expect(rows).toEqual([
      { year: 2026, month: 8, count: 4 },
      { year: 2026, month: 7, count: 1 },
      { year: 2025, month: 11, count: 1 },
    ]);
  });

  it("returns at most six months and ignores unparseable timestamps", () => {
    const obsAt = (m: number): LangObservation => ({ id: `m${m}`, timestamp: new Date(Date.UTC(2026, m, 5)).toISOString(), language: "Hebrew", phrase: "x" });
    const rows = monthlyWordCounts([...Array.from({ length: 9 }, (_, m) => obsAt(m)), { id: "bad", timestamp: "nope", language: "Hebrew", phrase: "x" }]);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toEqual({ year: 2026, month: 8, count: 1 });
    expect(monthlyWordCounts([])).toEqual([]);
  });
});

// ── 8. Framing gate: banned words absent from vocabAgg.ts source ──────────────

describe("vocabAgg framing gate (source-level)", () => {
  let src: string;
  try {
    src = readFileSync(path.join(process.cwd(), "src/growth/vocabAgg.ts"), "utf8");
  } catch {
    src = "";
  }

  it("source file is present", () => {
    expect(src.length).toBeGreaterThan(0);
  });

  const BANNED = [
    "balance",
    "imbalance",
    "gap",
    "behind",
    "catch up",
    "delay",
    "readiness",
    "screen",
    "assessment",
    "percentile",
  ];

  // We check only in non-comment, non-JSDoc string content sections.
  // Strip block comments and line comments for the check.
  const stripComments = (s: string) =>
    s
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

  for (const word of BANNED) {
    it(`source code does not contain banned word "${word}" outside comments`, () => {
      const stripped = stripComments(src);
      // Case-insensitive word-boundary match (skip "screen" inside "screenModelOutput", etc.)
      const re = new RegExp(`\\b${word}\\b`, "i");
      expect(re.test(stripped)).toBe(false);
    });
  }
});

// ── 9+10+11. LanguageLabVocabView source gates ───────────────────────────────

describe("LanguageLabVocabView source gates", () => {
  let src: string;
  try {
    src = readFileSync(
      path.join(process.cwd(), "src/components/tabs/LanguageLabVocabView.tsx"),
      "utf8",
    );
  } catch {
    src = "";
  }

  it("component source file is present", () => {
    expect(src.length).toBeGreaterThan(0);
  });

  // ── 9. Required copy present verbatim ────────────────────────────────────────

  it("contains the interpretation caption key vl.interpretCaption", () => {
    expect(src).toContain('"vl.interpretCaption"');
  });

  it("contains the provenance line key vl.provenance", () => {
    expect(src).toContain('"vl.provenance"');
  });

  it("contains the activity sub-line key vl.activitySubLine", () => {
    expect(src).toContain('"vl.activitySubLine"');
  });

  it("contains the first-view disclaimer key vl.disclaimer", () => {
    expect(src).toContain('"vl.disclaimer"');
  });

  it('activities section title key is "vl.activitiesTitle" (not "balanced activities")', () => {
    expect(src).toContain('"vl.activitiesTitle"');
  });

  // ── B-GROWTH-14: no Hebrew/English assumption, no chart ─────────────────────

  it("imports nothing from recharts and draws no chart", () => {
    expect(src).not.toMatch(/from\s+["']recharts["']/);
    expect(src).not.toMatch(/<(AreaChart|LineChart|BarChart|ResponsiveContainer|svg)\b/);
    expect(src).not.toMatch(/t\("vl\.(mixLabel|mixValue|trendTitle)"/);
    expect(src).toContain("profileLangCounts(languages, counts)");
    // B-GROWTH-36: the per-month count list is removed (never month against month).
    expect(src).not.toContain('data-testid="vl-month-list"');
    expect(src).not.toContain("monthlyWordCounts(");
  });

  it("finds no language by a /hebrew|english/ regex for a count", () => {
    expect(src).not.toMatch(/heCount|enCount/);
  });

  // ── 10. Banned words absent from the component source ────────────────────────

  const BANNED_IN_VIEW = [
    "balance",       // as a noun for the languages — banned in copy
    "imbalance",
    "catch up",
    "readiness",
    "percentile",
    // "gap" is ALLOWED in CSS class names (gap-1.5, gap-2) and code comments,
    // but must NOT appear as a product-copy concept ("language gap", "the gap").
    // We check i18n key strings only (see separate test below).
  ];

  // Extract only string literals that look like user-visible copy (quoted English words,
  // NOT CSS class strings that contain "gap-N" utility classes).
  // Strip block + line comments, then check for banned words in non-className contexts.
  const stripComments = (s: string) =>
    s
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

  // Remove className="..." and className={...} strings before checking
  // so Tailwind gap-N utilities don't trigger the word-boundary test.
  const stripClassNames = (s: string) =>
    s
      .replace(/className="[^"]*"/g, "")
      .replace(/className=\{[^}]*\}/g, "");

  for (const word of BANNED_IN_VIEW) {
    it(`component source does not contain banned word "${word.trim()}" in copy`, () => {
      const stripped = stripClassNames(stripComments(src));
      const re = new RegExp(`\\b${word.trim()}\\b`, "i");
      expect(re.test(stripped)).toBe(false);
    });
  }

  // "gap" as a language concept is separately forbidden in i18n keys/values.
  it('component source does not use "gap" as a product-copy i18n key or value', () => {
    // Only check t("...") call sites and inline string literals that are copy, not CSS.
    const copyLines = (src.match(/t\("vl\.[^"]+"\)/g) ?? []).join(" ");
    expect(/\bgap\b/i.test(copyLines)).toBe(false);
  });

  // ── 11. No warning-token class on language count bars ────────────────────────

  it("does not apply warning/amber/danger token to any language display", () => {
    // Check for common warning-color tokens that would colour a language negatively.
    expect(/arbor-danger/.test(src)).toBe(false);
    expect(/arbor-yellow-ink/.test(src)).toBe(false);
    // amber / warn as CSS class names
    expect(/className=.*warn/.test(src)).toBe(false);
  });

  it("does not use red or amber color on lower-count language bar", () => {
    // Neither raw color name nor token should appear in bar coloring.
    expect(/var\(--arbor-danger\)/.test(src)).toBe(false);
    expect(/var\(--arbor-yellow-ink\)/.test(src)).toBe(false);
  });
});

/* B-GROWTH-14 — "Logged mix: Hebrew / English" told a Russian- or Arabic-speaking
   family "0 … in English". The vl.* copy now names no language except where a
   key is CHOSEN for a profile language the component matched (the activity
   ideas vl.actHe* / vl.actEn*, which localise the language's own name; see
   REJECTIONS.md B-GROWTH-14). */
describe("B-GROWTH-14 — vl.* copy assumes no language pair", () => {
  const ACTIVITY_KEYS = /^vl\.act(He|En)(Title|Body)$/;
  it("no vl.* string names Hebrew/English (EN) or עברית/אנגלית (HE)", async () => {
    const { en, he } = await import("../lib/i18n");
    const offenders: string[] = [];
    for (const [k, v] of Object.entries(en)) if (k.startsWith("vl.") && !ACTIVITY_KEYS.test(k) && /Hebrew|English/.test(v)) offenders.push(`en:${k}`);
    for (const [k, v] of Object.entries(he)) if (k.startsWith("vl.") && !ACTIVITY_KEYS.test(k) && /עברית|אנגלית/.test(v)) offenders.push(`he:${k}`);
    expect(offenders).toEqual([]);
  });

  it("the caption drops \"mix\"; the month row resolves in EN and HE", async () => {
    const { translate } = await import("../lib/i18n");
    expect(translate("en", "vl.interpretCaption")).not.toMatch(/\bmix\b/i);
    expect(translate("he", "vl.interpretCaption")).not.toContain("תמהיל");
    expect(translate("en", "vl.month.row", { month: "September", n: 4 })).toBe("September · 4 words");
    expect(translate("he", "vl.month.row", { month: "ספטמבר", n: 4 })).toBe("ספטמבר · 4 מילים");
    for (const lang of ["en", "he"] as const) {
      for (const k of ["vl.mixLabel", "vl.mixValue", "vl.trendTitle"]) expect(translate(lang, k)).toBe(k);
    }
  });

  it("NEGATIVE CONTROL — the pre-fix mix line trips the scan", () => {
    expect(/Hebrew|English/.test("Logged mix: Hebrew / English")).toBe(true);
    expect(/עברית|אנגלית/.test("תמהיל מתועד: עברית / אנגלית")).toBe(true);
  });
});
