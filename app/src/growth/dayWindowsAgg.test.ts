/**
 * AP-051 — Day Windows panel: pure-aggregator unit tests.
 *
 * SAFETY GATE tests (tested here so the eval:safety gate can grep them too):
 *   - The determinism guard string renders (copy contract test).
 *   - Banned words are ABSENT from the module source AND from rendered copy.
 *   - Low-data state (<7 days logged) surfaces the correct messaging path.
 *   - Aggregator buckets correctly from a known RhythmPrediction.
 */
import { describe, it, expect } from "vitest";
import { buildDayWindowsSummary, estimateFrictionDays } from "./dayWindowsAgg";
import type { RhythmPrediction } from "../rhythm/predict";
import fs from "node:fs";
import path from "node:path";

// ── BANNED WORD LIST (AP-051 builder hard rules) ──────────────────────────
const BANNED_WORDS = ["will be", "predicts", "predict", "prediction", "dysregulated", "behavioral episode"];

// ── Fixtures ───────────────────────────────────────────────────────────────
const NOW_MS = new Date("2026-06-23T14:00:00Z").getTime();

/** A rhythm prediction with enough data (medium confidence). */
function makeRichPrediction(): RhythmPrediction {
  return {
    confidence: "medium",
    daysObserved: 8,
    daysNeeded: 0,
    frictionPeak: { hour: 17 },
    calmWindow: { startHour: 10, endHour: 12 },
    windDownHour: 19,
    bands: [
      { hour: 6,  tone: "calm",     score: 0.00 },
      { hour: 7,  tone: "calm",     score: 0.05 },
      { hour: 8,  tone: "calm",     score: 0.10 },
      { hour: 9,  tone: "calm",     score: 0.05 },
      { hour: 10, tone: "calm",     score: 0.00 },
      { hour: 11, tone: "calm",     score: 0.00 },
      { hour: 12, tone: "calm",     score: 0.10 },
      { hour: 13, tone: "watch",    score: 0.20 },
      { hour: 14, tone: "watch",    score: 0.30 },
      { hour: 15, tone: "watch",    score: 0.40 },
      { hour: 16, tone: "watch",    score: 0.55 },
      { hour: 17, tone: "friction", score: 1.00 },
      { hour: 18, tone: "watch",    score: 0.60 },
      { hour: 19, tone: "watch",    score: 0.30 },
      { hour: 20, tone: "calm",     score: 0.10 },
    ],
  };
}

/** A prediction with insufficient data (low confidence). */
function makeLowDataPrediction(): RhythmPrediction {
  return {
    confidence: "low",
    daysObserved: 3,
    daysNeeded: 4,
    frictionPeak: null,
    calmWindow: null,
    windDownHour: 19,
    bands: Array.from({ length: 15 }, (_, i) => ({ hour: 6 + i, tone: "calm" as const, score: 0 })),
  };
}

function makeNoneDataPrediction(): RhythmPrediction {
  return {
    confidence: "none",
    daysObserved: 0,
    daysNeeded: 7,
    frictionPeak: null,
    calmWindow: null,
    windDownHour: null,
    bands: Array.from({ length: 15 }, (_, i) => ({ hour: 6 + i, tone: "calm" as const, score: 0 })),
  };
}

// ── Copy contract: board-cleared verbatim strings ─────────────────────────
// These test strings match what DayWindowsPanel renders via i18n keys.
const DETERMINISM_GUARD =
  "These are tendencies, not predictions — every day is different, and you know your child best.";
const LOW_DATA_MSG =
  "Keep logging and these patterns get clearer. Right now there's not quite enough to see a rhythm yet.";
const PANEL_TITLE = "Your Day at a Glance";
const LABEL_CALMER = "Usually calmer";
const LABEL_TRICKIER = "Often trickier";

describe("AP-051 copy contract — board-cleared verbatim strings are present in i18n.ts", () => {
  const i18nPath = path.resolve(__dirname, "../lib/i18n.ts");
  const i18nSrc = fs.existsSync(i18nPath) ? fs.readFileSync(i18nPath, "utf8") : "";

  it("determinism guard is in i18n.ts (ALWAYS visible, non-predictive)", () => {
    expect(i18nSrc).toContain(DETERMINISM_GUARD);
  });

  it("low-data message is in i18n.ts", () => {
    expect(i18nSrc).toContain(LOW_DATA_MSG);
  });

  it("panel title is in i18n.ts", () => {
    expect(i18nSrc).toContain(PANEL_TITLE);
  });

  it("calmer label is in i18n.ts", () => {
    expect(i18nSrc).toContain(LABEL_CALMER);
  });

  it("trickier label is in i18n.ts", () => {
    expect(i18nSrc).toContain(LABEL_TRICKIER);
  });
});

describe("AP-051 safety gate — banned words absent from aggregator + i18n keys", () => {
  const i18nPath = path.resolve(__dirname, "../lib/i18n.ts");
  const i18nSrc = fs.existsSync(i18nPath) ? fs.readFileSync(i18nPath, "utf8") : "";

  // Extract only dw.* key VALUES from i18n.ts.
  const dwKeyRegex = /"dw\.[^"]*":\s*"([^"]*)"/g;
  const dwValues: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = dwKeyRegex.exec(i18nSrc)) !== null) {
    dwValues.push(m[1]);
  }
  const dwCopy = dwValues.join(" ");

  // The guard string ("not predictions") is board-cleared anti-predictive copy.
  // The test must NOT flag it — only AFFIRMATIVE predictive assertions are banned.
  // Strategy: remove the guard string before checking, then verify the guard itself
  // is present (it must always be there), and that no OTHER string is affirmatively predictive.
  const dwCopyWithoutGuard = dwCopy.replace(
    /These are tendencies, not predictions[^.]*\./i,
    ""
  ).replace(
    /not predictions/gi,
    ""
  );

  // Affirmative predictive patterns that are banned in user-facing copy.
  // "will be" is always banned. "predicts/predict/prediction" are banned EXCEPT
  // as part of the guard negation (which we removed above).
  const AFFIRMATIVE_BANNED = ["will be", "predicts", "predict", "prediction", "dysregulated", "behavioral episode"];

  for (const banned of AFFIRMATIVE_BANNED) {
    it(`"${banned}" is absent from dw.* i18n values (affirmative use)`, () => {
      expect(dwCopyWithoutGuard.toLowerCase()).not.toContain(banned.toLowerCase());
    });
  }

  // Source check: strip ALL type names and import lines, then check for
  // banned user-facing words in runtime logic and strings.
  const aggPath = path.resolve(__dirname, "./dayWindowsAgg.ts");
  const aggSrc = fs.existsSync(aggPath) ? fs.readFileSync(aggPath, "utf8") : "";

  // Check user-facing STRING LITERALS only — not identifiers, type names, or
  // parameter names. Strip comments first (they document the RULE against these
  // words, so they legitimately reference them), then scan quoted strings.
  const aggNoComments = aggSrc
    .replace(/\/\*[\s\S]*?\*\//g, "")   // block comments (TSDoc)
    .replace(/\/\/[^\n]*/g, "");         // line comments
  // Also exclude import path strings (e.g. "../rhythm/predict").
  const aggNoImports = aggNoComments.replace(/^import\s+.*\n/gm, "");

  const stringLiteralRegex = /["'`]([^"'`\n]{2,}?)["'`]/g;
  const aggStrings: string[] = [];
  let sm: RegExpExecArray | null;
  while ((sm = stringLiteralRegex.exec(aggNoImports)) !== null) {
    aggStrings.push(sm[1]);
  }
  const aggStringContent = aggStrings.join(" ");

  for (const banned of AFFIRMATIVE_BANNED) {
    it(`"${banned}" is absent from dayWindowsAgg.ts string literals (excl. comments/imports)`, () => {
      expect(aggStringContent.toLowerCase()).not.toContain(banned.toLowerCase());
    });
  }
});

// ── Aggregator logic tests ────────────────────────────────────────────────
describe("buildDayWindowsSummary — low-data path (<7 days logged)", () => {
  it("returns hasEnoughData=false when confidence is low", () => {
    const result = buildDayWindowsSummary(makeLowDataPrediction(), NOW_MS);
    expect(result.hasEnoughData).toBe(false);
  });

  it("returns hasEnoughData=false when confidence is none", () => {
    const result = buildDayWindowsSummary(makeNoneDataPrediction(), NOW_MS);
    expect(result.hasEnoughData).toBe(false);
  });

  it("returns empty windows on low-data path", () => {
    const result = buildDayWindowsSummary(makeLowDataPrediction(), NOW_MS);
    expect(result.windows).toHaveLength(0);
  });

  it("returns null patternObservation on low-data path", () => {
    const result = buildDayWindowsSummary(makeLowDataPrediction(), NOW_MS);
    expect(result.patternObservation).toBeNull();
  });

  it("surfaces daysNeeded so the UI can show the low-data nudge", () => {
    const result = buildDayWindowsSummary(makeLowDataPrediction(), NOW_MS);
    expect(result.daysNeeded).toBeGreaterThan(0);
  });
});

describe("buildDayWindowsSummary — sufficient data path (medium/high confidence)", () => {
  it("returns hasEnoughData=true for medium confidence", () => {
    const result = buildDayWindowsSummary(makeRichPrediction(), NOW_MS);
    expect(result.hasEnoughData).toBe(true);
  });

  it("returns hasEnoughData=true for high confidence", () => {
    const pred = makeRichPrediction();
    pred.confidence = "high";
    const result = buildDayWindowsSummary(pred, NOW_MS);
    expect(result.hasEnoughData).toBe(true);
  });

  it("produces a 'usually-calmer' window", () => {
    const result = buildDayWindowsSummary(makeRichPrediction(), NOW_MS);
    const calmer = result.windows.find((w) => w.label === "usually-calmer");
    expect(calmer).toBeDefined();
  });

  it("produces an 'often-trickier' window when frictionPeak exists", () => {
    const result = buildDayWindowsSummary(makeRichPrediction(), NOW_MS);
    const trickier = result.windows.find((w) => w.label === "often-trickier");
    expect(trickier).toBeDefined();
  });

  it("calmer window has lower pressureScore than trickier window", () => {
    const result = buildDayWindowsSummary(makeRichPrediction(), NOW_MS);
    const calmer = result.windows.find((w) => w.label === "usually-calmer");
    const trickier = result.windows.find((w) => w.label === "often-trickier");
    expect(calmer).toBeDefined();
    expect(trickier).toBeDefined();
    expect(calmer!.pressureScore).toBeLessThan(trickier!.pressureScore);
  });

  it("trickier window is centred near the frictionPeak hour (±2h)", () => {
    const pred = makeRichPrediction();
    const result = buildDayWindowsSummary(pred, NOW_MS);
    const trickier = result.windows.find((w) => w.label === "often-trickier");
    expect(trickier).toBeDefined();
    const peakHour = pred.frictionPeak!.hour; // 17
    expect(trickier!.startHour).toBeLessThanOrEqual(peakHour);
    expect(trickier!.endHour).toBeGreaterThanOrEqual(peakHour);
  });

  it("pattern observation is non-null and anchors denominator to daysLogged", () => {
    const result = buildDayWindowsSummary(makeRichPrediction(), NOW_MS);
    expect(result.patternObservation).not.toBeNull();
    expect(result.patternObservation!.daysLogged).toBe(8);
  });

  it("patternObservation.hardDays < daysLogged (honest — not every day)", () => {
    const result = buildDayWindowsSummary(makeRichPrediction(), NOW_MS);
    const obs = result.patternObservation!;
    expect(obs.hardDays).toBeLessThan(obs.daysLogged);
  });

  it("patternObservation.hardDays >= 1 (minimum honest signal)", () => {
    const result = buildDayWindowsSummary(makeRichPrediction(), NOW_MS);
    expect(result.patternObservation!.hardDays).toBeGreaterThanOrEqual(1);
  });

  it("pattern peak hour label is a recognisable time string", () => {
    const result = buildDayWindowsSummary(makeRichPrediction(), NOW_MS);
    // frictionPeak.hour=17 → "5pm"
    expect(result.patternObservation!.peakHourLabel).toBe("5pm");
  });

  it("returns daysNeeded=0 when data is sufficient", () => {
    const result = buildDayWindowsSummary(makeRichPrediction(), NOW_MS);
    expect(result.daysNeeded).toBe(0);
  });
});

describe("buildDayWindowsSummary — no friction peak edge case", () => {
  it("returns no trickier window when frictionPeak is null", () => {
    const pred = makeRichPrediction();
    pred.frictionPeak = null;
    const result = buildDayWindowsSummary(pred, NOW_MS);
    const trickier = result.windows.find((w) => w.label === "often-trickier");
    expect(trickier).toBeUndefined();
  });

  it("patternObservation is null when frictionPeak is null", () => {
    const pred = makeRichPrediction();
    pred.frictionPeak = null;
    const result = buildDayWindowsSummary(pred, NOW_MS);
    expect(result.patternObservation).toBeNull();
  });
});

describe("estimateFrictionDays — pure helper", () => {
  it("clamps output to at most daysLogged - 1", () => {
    expect(estimateFrictionDays(7, 1.0)).toBeLessThan(7);
  });

  it("returns at least 1 when daysLogged > 0 and score > 0", () => {
    expect(estimateFrictionDays(7, 0.01)).toBeGreaterThanOrEqual(1);
  });

  it("returns 0 when daysLogged is 0", () => {
    expect(estimateFrictionDays(0, 0.8)).toBe(0);
  });

  it("scales linearly with pressureScore", () => {
    // 0.7 of 10 days ≈ 7 days, clamped to 9
    expect(estimateFrictionDays(10, 0.7)).toBe(7);
    // 0.5 of 10 days = 5
    expect(estimateFrictionDays(10, 0.5)).toBe(5);
  });
});
