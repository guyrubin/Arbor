/**
 * dayWindowsAgg.ts — pure aggregator for the Day Windows panel (AP-051).
 *
 * DESIGN RULES (board-cleared, non-negotiable):
 *   - NEVER use "predict/prediction/predicts/will be" in output or copy.
 *   - Difficulty is located in the TIME-WINDOW, never as a child trait.
 *   - Anchored to "the days you logged" — honest denominator, always.
 *   - Read-only: no I/O, no Date.now() inside — callers inject `nowMs`.
 *
 * B-TODAY-06 (law 1 + law 9):
 *   - REAL COUNT. The day count was `round(pressureScore × daysLogged)`
 *     clamped to [1, daysLogged−1] — with scores normalised to the peak, one
 *     intensity-5 log read "13 of 14 days". It is now counted from the logs:
 *     distinct days with a hard (4–5) log within ±1 h of the peak.
 *   - NO CALM WINDOW. "Usually calmer" was the first all-zero 2-hour pair —
 *     absence of logs read as calm. Removed with `findCalmerStretch`.
 *   - EVIDENCE FLOOR. Windows render only above rhythm/predict's floor
 *     (MIN_HARD_DAYS hard days, MIN_HARD_LOGS hard logs).
 *   - COUNTS PER HOUR, not tones: the panel draws single-ink bars from
 *     `hourCounts`, never a green/peach grade of the child's day.
 *   - The peak hour is a NUMBER; the panel formats it in the UI language.
 *
 * Adds NO new child-data read path and writes NOTHING.
 */
import { HIGH_INTENSITY, MIN_HARD_DAYS, MIN_HARD_LOGS, RHYTHM_WINDOW_DAYS, rhythmDayKey, type RhythmPrediction } from "../rhythm/predict";

/** A log as the aggregator needs it (timestamp + optional 1–5 intensity).
 *  B-DATA-09: a plain moment stores no intensity — it is never a hard moment. */
export interface DayWindowsLog {
  timestamp: string | number;
  intensity?: number;
}

/** A named 2-hour window in the day. */
export interface DayWindow {
  /** "Often trickier" (board-cleared verbatim label). */
  label: "often-trickier";
  /** Display start hour 0–23 */
  startHour: number;
  /** Display end hour 0–23 */
  endHour: number;
}

/** Hard (4–5) logs per waking hour, inside the observation window. */
export interface HourCount {
  hour: number;
  count: number;
}

export interface DayWindowsSummary {
  /** Whether the logs clear the evidence floor for windows to be meaningful. */
  hasEnoughData: boolean;
  /** Days logged in the trailing observation window. */
  daysLogged: number;
  /** Minimum days needed before patterns are visible (from rhythm engine). */
  daysNeeded: number;
  /** At most one window — the trickier one, when data allows. */
  windows: DayWindow[];
  /** Null when hasEnoughData is false or no peak exists. */
  patternObservation: PatternObservation | null;
  /** Waking hours 6–20; all zero below the floor (the learning strip). */
  hourCounts: HourCount[];
}

export interface PatternObservation {
  /** Peak hour 0–23 — formatted at render in the UI language. */
  peakHour: number;
  /** Distinct logged days with a hard moment within ±1 h of the peak. */
  hardDays: number;
  /** Denominator: the days you logged in the window. */
  daysLogged: number;
}

const DAY_MS = 86_400_000;
const FIRST_HOUR = 6;
const LAST_HOUR = 20;

const toMs = (ts: string | number): number => (typeof ts === "number" ? ts : new Date(ts).getTime());

/**
 * Derive the Day Windows summary from a RhythmPrediction plus the SAME logs
 * it was built from (the counts are read from the logs, never estimated).
 *
 * Pure: no I/O, deterministic for same inputs.
 */
export function buildDayWindowsSummary(
  rhythmData: RhythmPrediction,
  nowMs: number,
  logs: DayWindowsLog[] = [],
  windowDays: number = RHYTHM_WINDOW_DAYS,
): DayWindowsSummary {
  const { confidence, daysObserved, daysNeeded, frictionPeak } = rhythmData;
  const zeroCounts = (): HourCount[] =>
    Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => ({ hour: FIRST_HOUR + i, count: 0 }));

  // Dependable read AND the hard-moment floor (rhythm/predict already folds
  // the floor into `confidence`; checked here too so a hand-built read cannot
  // slip past it).
  const hasEnoughData =
    (confidence === "medium" || confidence === "high") &&
    rhythmData.hardDays >= MIN_HARD_DAYS &&
    rhythmData.hardLogs >= MIN_HARD_LOGS;

  if (!hasEnoughData) {
    return { hasEnoughData: false, daysLogged: daysObserved, daysNeeded, windows: [], patternObservation: null, hourCounts: zeroCounts() };
  }

  const since = nowMs - windowDays * DAY_MS;
  const hard = logs.filter((l) => {
    const t = toMs(l.timestamp);
    return Number.isFinite(t) && t >= since && t <= nowMs && typeof l.intensity === "number" && l.intensity >= HIGH_INTENSITY;
  });

  const hourCounts = zeroCounts();
  for (const l of hard) {
    const h = new Date(toMs(l.timestamp)).getHours();
    const slot = hourCounts.find((c) => c.hour === h);
    if (slot) slot.count += 1;
  }

  const windows: DayWindow[] = [];
  let patternObservation: PatternObservation | null = null;
  if (frictionPeak) {
    const peak = frictionPeak.hour;
    const winStart = Math.max(FIRST_HOUR, peak - 1);
    const winEnd = Math.min(LAST_HOUR + 1, peak + 1);
    windows.push({ label: "often-trickier", startHour: winStart, endHour: winEnd });

    // The real count: distinct logged days with a hard moment near the peak.
    const nearPeakDays = new Set<number>();
    for (const l of hard) {
      const ms = toMs(l.timestamp);
      const h = new Date(ms).getHours();
      if (h >= peak - 1 && h <= peak + 1) nearPeakDays.add(rhythmDayKey(ms));
    }
    patternObservation = { peakHour: peak, hardDays: nearPeakDays.size, daysLogged: daysObserved };
  }

  return { hasEnoughData, daysLogged: daysObserved, daysNeeded: 0, windows, patternObservation, hourCounts };
}
