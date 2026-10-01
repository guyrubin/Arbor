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
import { buildDayWindowsSummary, type DayWindowsLog } from "./dayWindowsAgg";
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
    hardDays: 4,
    hardLogs: 5,
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
    hardDays: 0,
    hardLogs: 0,
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
    hardDays: 0,
    hardLogs: 0,
    frictionPeak: null,
    calmWindow: null,
    windDownHour: null,
    bands: Array.from({ length: 15 }, (_, i) => ({ hour: 6 + i, tone: "calm" as const, score: 0 })),
  };
}

/** B-TODAY-06 fixture: 4 hard moments on 3 days at 17:xx, plus plain logs. */
const DAY = 86_400_000;
const atLocal = (daysAgo: number, hour: number, minute = 10) => {
  const d = new Date(NOW_MS - daysAgo * DAY);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
};
const LOGS: DayWindowsLog[] = [
  { timestamp: atLocal(1, 17), intensity: 5 },
  { timestamp: atLocal(1, 17, 40), intensity: 4 },
  { timestamp: atLocal(3, 17), intensity: 5 },
  { timestamp: atLocal(5, 17), intensity: 4 },
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((d) => ({ timestamp: atLocal(d, 10), intensity: 1 })),
];

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

  it("B-TODAY-06: the calmer label is retired (absence of logs is not calm)", () => {
    expect(i18nSrc).not.toContain(LABEL_CALMER);
    expect(i18nSrc).not.toContain('"dw.label.calmer"');
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
  // Also exclude import path strings (e.g. "../rhythm/predict"). Use \r?\n so the
  // strip works on CRLF files too — `.` does not match `\r`, so a bare `\n` would
  // leave the import line (and its path) intact on Windows checkouts.
  const aggNoImports = aggNoComments.replace(/^import\s+.*\r?\n/gm, "");

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

  it("B-TODAY-06: produces NO 'usually-calmer' window", () => {
    const result = buildDayWindowsSummary(makeRichPrediction(), NOW_MS, LOGS);
    expect(result.windows.map((w) => w.label)).toEqual(["often-trickier"]);
  });

  it("produces an 'often-trickier' window when frictionPeak exists", () => {
    const result = buildDayWindowsSummary(makeRichPrediction(), NOW_MS, LOGS);
    const trickier = result.windows.find((w) => w.label === "often-trickier");
    expect(trickier).toBeDefined();
  });

  it("trickier window is centred near the frictionPeak hour (±1h)", () => {
    const pred = makeRichPrediction();
    const result = buildDayWindowsSummary(pred, NOW_MS, LOGS);
    const trickier = result.windows.find((w) => w.label === "often-trickier");
    expect(trickier).toBeDefined();
    const peakHour = pred.frictionPeak!.hour; // 17
    expect(trickier!.startHour).toBeLessThanOrEqual(peakHour);
    expect(trickier!.endHour).toBeGreaterThanOrEqual(peakHour);
  });

  it("pattern observation anchors the denominator to daysLogged", () => {
    const result = buildDayWindowsSummary(makeRichPrediction(), NOW_MS, LOGS);
    expect(result.patternObservation).not.toBeNull();
    expect(result.patternObservation!.daysLogged).toBe(8);
  });

  it("B-TODAY-06: 4 hard moments on 3 days at 17:xx → hardDays is exactly 3 (read from the logs)", () => {
    const result = buildDayWindowsSummary(makeRichPrediction(), NOW_MS, LOGS);
    expect(result.patternObservation!.hardDays).toBe(3);
  });

  it("B-TODAY-06: the peak hour is a number (formatted at render), never an am/pm label", () => {
    const result = buildDayWindowsSummary(makeRichPrediction(), NOW_MS, LOGS);
    expect(result.patternObservation!.peakHour).toBe(17);
    expect(JSON.stringify(result)).not.toMatch(/\d(am|pm)\b/);
  });

  it("B-TODAY-06: hourCounts count the hard logs per hour (6–20)", () => {
    const result = buildDayWindowsSummary(makeRichPrediction(), NOW_MS, LOGS);
    expect(result.hourCounts).toHaveLength(15);
    expect(result.hourCounts.find((c) => c.hour === 17)?.count).toBe(4);
    expect(result.hourCounts.find((c) => c.hour === 10)?.count).toBe(0); // plain moments are not counted
  });

  it("returns daysNeeded=0 when data is sufficient", () => {
    const result = buildDayWindowsSummary(makeRichPrediction(), NOW_MS, LOGS);
    expect(result.daysNeeded).toBe(0);
  });
});

describe("buildDayWindowsSummary — no friction peak edge case", () => {
  it("returns no trickier window when frictionPeak is null", () => {
    const pred = makeRichPrediction();
    pred.frictionPeak = null;
    const result = buildDayWindowsSummary(pred, NOW_MS, LOGS);
    const trickier = result.windows.find((w) => w.label === "often-trickier");
    expect(trickier).toBeUndefined();
  });

  it("patternObservation is null when frictionPeak is null", () => {
    const pred = makeRichPrediction();
    pred.frictionPeak = null;
    const result = buildDayWindowsSummary(pred, NOW_MS, LOGS);
    expect(result.patternObservation).toBeNull();
  });
});

describe("B-TODAY-06 — the evidence floor gates the panel", () => {
  it("a 'medium' read below the hard floor (hand-built) still shows no windows", () => {
    const pred = { ...makeRichPrediction(), hardDays: 1, hardLogs: 1 };
    const result = buildDayWindowsSummary(pred, NOW_MS, LOGS);
    expect(result.hasEnoughData).toBe(false);
    expect(result.windows).toEqual([]);
    expect(result.patternObservation).toBeNull();
    expect(result.hourCounts.every((c) => c.count === 0)).toBe(true);
  });

  it("the fabricated estimator is gone from the module", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "./dayWindowsAgg.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(src).not.toMatch(/estimateFrictionDays|findCalmerStretch|usually-calmer/);
  });
});
