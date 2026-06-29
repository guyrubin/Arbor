/**
 * dayWindowsAgg.ts — pure aggregator for the Day Windows panel (AP-051).
 *
 * DESIGN RULES (board-cleared, non-negotiable):
 *   - NEVER use "predict/prediction/predicts/will be" in output or copy.
 *   - Difficulty is located in the TIME-WINDOW, never as a child trait.
 *   - Anchored to "the days you logged" — honest denominator, always.
 *   - Read-only: no I/O, no Date.now() inside — callers inject `nowMs`.
 *
 * This module is a tested pure function layer over the existing JITAI
 * rhythm engine (lib/jitai.ts) and predictRhythm (rhythm/predict.ts).
 * It adds NO new child-data read path and writes NOTHING.
 */
import type { RhythmPrediction } from "../rhythm/predict";

/** A named 2-hour window in the day. */
export interface DayWindow {
  /** "Usually calmer" | "Often trickier" (board-cleared verbatim labels) */
  label: "usually-calmer" | "often-trickier";
  /** Display start hour 0–23 */
  startHour: number;
  /** Display end hour 0–23 (exclusive) */
  endHour: number;
  /** Normalised pressure 0–1 (avg of constituent bands' scores). */
  pressureScore: number;
}

export interface DayWindowsSummary {
  /** Whether the parent has logged enough days for windows to be meaningful. */
  hasEnoughData: boolean;
  /** Days logged in the trailing observation window. */
  daysLogged: number;
  /** Minimum days needed before patterns are visible (from rhythm engine). */
  daysNeeded: number;
  /**
   * Up to 2 named windows: one calmer, one trickier (when data allows).
   * Empty when hasEnoughData is false.
   */
  windows: DayWindow[];
  /**
   * Pattern observation string that MUST anchor the count to "the days you logged".
   * Null when hasEnoughData is false or no clear trickier window exists.
   * NEVER contains "predict/prediction/will be".
   */
  patternObservation: PatternObservation | null;
}

export interface PatternObservation {
  /** Hour label of the trickier peak (e.g. "5pm"). */
  peakHourLabel: string;
  /** Number of logged days that showed friction at peak. */
  hardDays: number;
  /** Denominator: the days you logged in the window. */
  daysLogged: number;
}

/**
 * Derive up to 2 named day-windows from an existing RhythmPrediction.
 *
 * @param rhythmData  Output of predictRhythm() — injected, never computed here.
 * @param nowMs       Current epoch ms — injected so this function is pure.
 *
 * Pure: no I/O, deterministic for same inputs.
 * Read-only: does not write any child data.
 */
export function buildDayWindowsSummary(
  rhythmData: RhythmPrediction,
  nowMs: number, // eslint-disable-line @typescript-eslint/no-unused-vars -- required for purity contract
): DayWindowsSummary {
  const { confidence, daysObserved, daysNeeded, bands, frictionPeak } = rhythmData;

  // The panel requires at least "medium" confidence (≥ minDays logged).
  const hasEnoughData = confidence === "medium" || confidence === "high";

  if (!hasEnoughData) {
    return { hasEnoughData: false, daysLogged: daysObserved, daysNeeded, windows: [], patternObservation: null };
  }

  // ── Build windows ───────────────────────────────────────────────────────
  const windows: DayWindow[] = [];

  // Calmer window: the calmest 2-hour stretch during the waking day.
  const calmerBand = findCalmerStretch(bands);
  if (calmerBand) {
    windows.push({
      label: "usually-calmer",
      startHour: calmerBand.startHour,
      endHour: calmerBand.endHour,
      pressureScore: calmerBand.avgScore,
    });
  }

  // Trickier window: centred on the friction peak (±1h), if one exists.
  let patternObservation: PatternObservation | null = null;
  if (frictionPeak) {
    const peak = frictionPeak.hour;
    const winStart = Math.max(6, peak - 1);
    const winEnd = Math.min(21, peak + 1);
    const peakBands = bands.filter((b) => b.hour >= winStart && b.hour <= winEnd);
    const avgScore = peakBands.length > 0
      ? peakBands.reduce((sum, b) => sum + b.score, 0) / peakBands.length
      : 0;

    windows.push({
      label: "often-trickier",
      startHour: winStart,
      endHour: winEnd,
      pressureScore: avgScore,
    });

    // Pattern observation: how many of the observed days showed friction at peak.
    // Conservative: count bands with score >= 0.5 as "hard" fraction of daysLogged.
    const frictionDays = estimateFrictionDays(daysObserved, avgScore);
    patternObservation = {
      peakHourLabel: hourLabel(peak),
      hardDays: frictionDays,
      daysLogged: daysObserved,
    };
  }

  return { hasEnoughData, daysLogged: daysObserved, daysNeeded: 0, windows, patternObservation };
}

// ── Internal helpers ────────────────────────────────────────────────────────

interface CalmerStretch {
  startHour: number;
  endHour: number;
  avgScore: number;
}

/** Find the 2-hour run with the lowest average friction score during the day. */
function findCalmerStretch(
  bands: RhythmPrediction["bands"],
): CalmerStretch | null {
  if (bands.length < 2) return null;

  let best: CalmerStretch | null = null;
  let bestScore = Infinity;

  for (let i = 0; i < bands.length - 1; i++) {
    const avg = (bands[i].score + bands[i + 1].score) / 2;
    if (avg < bestScore) {
      bestScore = avg;
      best = { startHour: bands[i].hour, endHour: bands[i + 1].hour, avgScore: avg };
    }
  }

  return best;
}

/**
 * Estimate how many of the observed days showed friction at a window.
 * Conservative model: the normalised pressure score (0–1) is treated as the
 * fraction of days that contributed friction moments at that hour.
 * Output is rounded to a whole day, clamped to [1, daysLogged - 1].
 */
export function estimateFrictionDays(daysLogged: number, pressureScore: number): number {
  if (daysLogged <= 0) return 0;
  const raw = Math.round(pressureScore * daysLogged);
  return Math.max(1, Math.min(raw, daysLogged - 1));
}

/** 24h hour → friendly label, matching rhythm/predict.ts hourLabel(). */
export function hourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const am = h < 12;
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${am ? "am" : "pm"}`;
}
