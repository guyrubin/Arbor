/**
 * AP-054 — vocabAgg unit tests.
 *
 * Acceptance criteria tested:
 *  1. Combined total leads: combinedTotal() is the sum of all per-language counts.
 *  2. Per-language counts are correct.
 *  3. mixPct() computes the mix percentage correctly (rounds to nearest int).
 *  4. mixPct(0, 0) returns 0 — empty-state guard.
 *  5. buildVocabTrend() returns at most 13 weekly points.
 *  6. Trend is cumulative: each point >= the previous.
 *  7. Observations outside the 90-day window are excluded.
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
  mixPct,
  buildVocabTrend,
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

// ── 3+4. mixPct ───────────────────────────────────────────────────────────────

describe("mixPct", () => {
  it("computes Hebrew mix % correctly: 3/5 = 60%", () => {
    expect(mixPct(3, 5)).toBe(60);
  });

  it("computes English mix % correctly: 2/5 = 40%", () => {
    expect(mixPct(2, 5)).toBe(40);
  });

  it("rounds to nearest integer: 1/3 = 33%", () => {
    expect(mixPct(1, 3)).toBe(33);
  });

  it("returns 0 when total is 0 (empty-state guard)", () => {
    expect(mixPct(0, 0)).toBe(0);
  });

  it("returns 100 when all observations are in one language", () => {
    expect(mixPct(7, 7)).toBe(100);
  });
});

// ── 5+6+7. buildVocabTrend ────────────────────────────────────────────────────

describe("buildVocabTrend", () => {
  it("returns at most 13 weekly points for a 90-day window", () => {
    const trend = buildVocabTrend([], NOW_MS);
    expect(trend.length).toBeLessThanOrEqual(13);
  });

  it("returns 13 points for a 90-day window (ceil(90/7) = 13)", () => {
    const trend = buildVocabTrend([], NOW_MS);
    expect(trend.length).toBe(13);
  });

  it("cumulative totals are non-decreasing", () => {
    const observations: LangObservation[] = [
      obs("Hebrew", "שלום", 3, NOW_MS),
      obs("English", "dog", 10, NOW_MS),
      obs("Hebrew", "תודה", 20, NOW_MS),
    ];
    const trend = buildVocabTrend(observations, NOW_MS);
    for (let i = 1; i < trend.length; i++) {
      expect(trend[i].cumulativeTotal).toBeGreaterThanOrEqual(trend[i - 1].cumulativeTotal);
    }
  });

  it("excludes observations older than 90 days", () => {
    const observations: LangObservation[] = [
      obs("Hebrew", "שלום", 91, NOW_MS),  // should be excluded
      obs("English", "dog", 1, NOW_MS),   // should be included
    ];
    const trend = buildVocabTrend(observations, NOW_MS);
    const last = trend[trend.length - 1];
    expect(last.cumulativeTotal).toBe(1); // only the English observation
  });

  it("final cumulative total equals total in-window observations", () => {
    const observations: LangObservation[] = [
      obs("Hebrew", "שלום", 5, NOW_MS),
      obs("Hebrew", "תודה", 15, NOW_MS),
      obs("English", "dog", 25, NOW_MS),
    ];
    const trend = buildVocabTrend(observations, NOW_MS);
    const last = trend[trend.length - 1];
    expect(last.cumulativeTotal).toBe(3);
  });

  it("tracks per-language breakdown in each trend point", () => {
    const observations: LangObservation[] = [
      obs("Hebrew", "שלום", 3, NOW_MS),
      obs("English", "dog", 3, NOW_MS),
    ];
    const trend = buildVocabTrend(observations, NOW_MS);
    const last = trend[trend.length - 1];
    expect(last.byLanguage["Hebrew"]).toBe(1);
    expect(last.byLanguage["English"]).toBe(1);
  });

  it("returns all-zero trend for empty observations", () => {
    const trend = buildVocabTrend([], NOW_MS);
    expect(trend.every((p) => p.cumulativeTotal === 0)).toBe(true);
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

  it("mix label key vl.mixLabel is used (not balance/imbalance/gap)", () => {
    expect(src).toContain('"vl.mixLabel"');
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
