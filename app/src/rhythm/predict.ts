/* Rhythm — predictive daily-timing engine.
 *
 * Turns the family's own behaviour log into an anticipatory read of *today*:
 * which hours tend to be hard (friction), which are calm, and when the evening
 * wind-down should start. Pure + deterministic: callers pass `nowMs`, so there
 * is no Date.now() inside the maths and the whole thing is unit-testable.
 *
 * Design stance (matches PRODUCT.md): non-clinical, honest about uncertainty,
 * bands not exact minutes. Sparse data returns a low-confidence read with how
 * many more days of logging are needed — never invented precision.
 */
import { bandForMonths, stageOfBand, type AgeStage } from "../lib/age/forChild";

/** Minimal event shape — decoupled from the app's BehaviorLog on purpose. */
export interface RhythmEvent {
  /** ISO string or epoch ms. */
  timestamp: string | number;
  /** 1–5 difficulty/intensity of the moment. B-DATA-09: absent on a plain
   *  moment — such an event counts toward coverage, never as a hard event. */
  intensity?: number;
}

export type RhythmTone = "calm" | "watch" | "friction";
export type RhythmConfidence = "none" | "low" | "medium" | "high";

export interface RhythmHourBand {
  /** Hour of day, 24h (e.g. 17 = 5pm). */
  hour: number;
  tone: RhythmTone;
  /** Normalised 0–1 friction pressure for the hour. */
  score: number;
}

export interface RhythmPrediction {
  confidence: RhythmConfidence;
  /** Distinct calendar days that contributed at least one logged moment. */
  daysObserved: number;
  /** Days of logging still needed before the read is dependable (0 once usable). */
  daysNeeded: number;
  /** Waking-window bands, one per hour, ordered ascending. */
  bands: RhythmHourBand[];
  /** Predicted hardest hour, if one stands out above the noise. */
  frictionPeak: { hour: number } | null;
  /** Longest calm daytime stretch (good for a focus task), if any. */
  calmWindow: { startHour: number; endHour: number } | null;
  /** Suggested evening wind-down start hour. */
  windDownHour: number | null;
  /**
   * B-TODAY-06 — the evidence floor's inputs. `hardDays` = distinct days with
   * an intensity≥4 log in the window; `hardLogs` = how many such logs. A peak,
   * a calm window and a dependable (medium/high) read all require
   * hardDays ≥ MIN_HARD_DAYS and hardLogs ≥ MIN_HARD_LOGS.
   */
  hardDays: number;
  hardLogs: number;
}

export interface RhythmOptions {
  /** Trailing window to learn from. */
  windowDays?: number;
  /** Waking window shown on the strip (inclusive start, exclusive end). */
  wakeHour?: number;
  sleepHour?: number;
  /** Minimum distinct logged days before the read is "usable". */
  minDays?: number;
  /** Child age in years — seeds the wind-down prior when evening data is thin. */
  ageYears?: number;
}

/** Trailing window the rhythm read learns from (days). */
export const RHYTHM_WINDOW_DAYS = 21;
const DEFAULTS = { windowDays: RHYTHM_WINDOW_DAYS, wakeHour: 6, sleepHour: 21, minDays: 7 } as const;
const DAY_MS = 86_400_000;
/** 4–5 are the moments worth reading around ("hard"). */
export const HIGH_INTENSITY = 4;
/**
 * B-TODAY-06 — evidence floor. One intensity-5 log among ten days of plain
 * moments used to become a friction peak (scores are normalised to the
 * peak), a "13 of 14 days" count downstream and a PREP/CALM cue. Three hard
 * logs on three distinct days is the least that can be called a tendency.
 */
export const MIN_HARD_DAYS = 3;
export const MIN_HARD_LOGS = 3;

/** The day bucket every rhythm count uses (one definition, so n ≤ m holds). */
export const rhythmDayKey = (ms: number): number => Math.floor(ms / DAY_MS);

function toMs(ts: string | number): number {
  return typeof ts === "number" ? ts : new Date(ts).getTime();
}

/** Wind-down prior per stage of the canonical band (baby/toddler ~18:00, preschool 19:00, school 20:00). */
const WIND_DOWN_BY_STAGE: Record<AgeStage, number> = { baby: 18, toddler: 18, preschool: 19, school: 20 };

/** Age-based wind-down prior (hour) used until evening logs are dense enough. */
function windDownPrior(ageYears: number | undefined): number {
  if (ageYears == null) return 19;
  // B-INF-10: the stage of the canonical band, never local age math.
  return WIND_DOWN_BY_STAGE[stageOfBand(bandForMonths(Math.max(0, ageYears) * 12))];
}

/** B-DATA-09: a hard event carries a recorded intensity at or above the
 *  floor; an event without one (a plain moment) is never hard. */
const isHardEvent = (e: RhythmEvent): e is RhythmEvent & { intensity: number } =>
  typeof e.intensity === "number" && e.intensity >= HIGH_INTENSITY;

/**
 * Build today's rhythm read from a list of logged moments.
 * `nowMs` is injected so the function is pure and testable.
 */
export function predictRhythm(
  events: RhythmEvent[],
  nowMs: number,
  opts: RhythmOptions = {}
): RhythmPrediction {
  const windowDays = opts.windowDays ?? DEFAULTS.windowDays;
  const wakeHour = opts.wakeHour ?? DEFAULTS.wakeHour;
  const sleepHour = opts.sleepHour ?? DEFAULTS.sleepHour;
  const minDays = opts.minDays ?? DEFAULTS.minDays;

  const since = nowMs - windowDays * DAY_MS;
  const inWindow = events.filter((e) => {
    const t = toMs(e.timestamp);
    return Number.isFinite(t) && t >= since && t <= nowMs;
  });

  // Distinct contributing days (uncertainty is about *coverage*, not raw count).
  const dayKeys = new Set<number>();
  for (const e of inWindow) dayKeys.add(rhythmDayKey(toMs(e.timestamp)));
  const daysObserved = dayKeys.size;
  const daysNeeded = Math.max(0, minDays - daysObserved);

  // B-TODAY-06: the evidence floor — hard logs and the distinct days they fell on.
  const hardEvents = inWindow.filter((e) => isHardEvent(e));
  const hardLogs = hardEvents.length;
  const hardDays = new Set(hardEvents.map((e) => rhythmDayKey(toMs(e.timestamp)))).size;
  const enoughHard = hardDays >= MIN_HARD_DAYS && hardLogs >= MIN_HARD_LOGS;

  // Intensity-weighted pressure per hour (only hard moments push a band).
  const hours = Array.from({ length: sleepHour - wakeHour }, (_, i) => wakeHour + i);
  const raw = new Map<number, number>(hours.map((h) => [h, 0]));
  for (const e of inWindow) {
    if (!isHardEvent(e)) continue;
    const h = new Date(toMs(e.timestamp)).getHours();
    if (!raw.has(h)) continue;
    raw.set(h, (raw.get(h) ?? 0) + (e.intensity - HIGH_INTENSITY + 1)); // 4→1, 5→2
  }

  const peakRaw = Math.max(0, ...raw.values());
  const bands: RhythmHourBand[] = hours.map((hour) => {
    const score = peakRaw > 0 ? (raw.get(hour) ?? 0) / peakRaw : 0;
    const tone: RhythmTone = score >= 0.66 ? "friction" : score >= 0.33 ? "watch" : "calm";
    return { hour, tone, score };
  });

  const coverage: RhythmConfidence =
    daysObserved === 0 ? "none"
    : daysObserved < minDays ? "low"
    : daysObserved < windowDays * 0.6 ? "medium"
    : "high";
  // Coverage alone is not a rhythm: below the hard-moment floor the read
  // stays "low" however many days were logged.
  const confidence: RhythmConfidence =
    (coverage === "medium" || coverage === "high") && !enoughHard ? "low" : coverage;

  // Below the usable bar, don't assert peaks/windows — only the honest "learning" read.
  if (confidence === "none" || confidence === "low" || peakRaw === 0) {
    return {
      confidence, daysObserved, daysNeeded,
      bands: bands.map((b) => ({ ...b, tone: "calm", score: 0 })),
      frictionPeak: null, calmWindow: null,
      windDownHour: confidence === "none" ? null : Math.floor(windDownPrior(opts.ageYears)),
      hardDays, hardLogs,
    };
  }

  // Hardest hour.
  let frictionPeak: { hour: number } | null = null;
  let best = 0;
  for (const b of bands) if (b.score > best) { best = b.score; frictionPeak = { hour: b.hour }; }

  // Longest calm daytime run (between wake+2 and ~17:00) for a focus suggestion.
  let calmWindow: { startHour: number; endHour: number } | null = null;
  let runStart = -1;
  const dayEnd = Math.min(sleepHour, 17);
  for (let h = wakeHour + 1; h <= dayEnd; h++) {
    const calm = (raw.get(h) ?? 0) === 0;
    if (calm && runStart === -1) runStart = h;
    if ((!calm || h === dayEnd) && runStart !== -1) {
      const end = calm ? h : h - 1;
      if (end - runStart >= 1 && (!calmWindow || end - runStart > calmWindow.endHour - calmWindow.startHour)) {
        calmWindow = { startHour: runStart, endHour: end };
      }
      runStart = -1;
    }
  }

  // Wind-down: an hour before the evening friction cluster if there is one, else the age prior.
  const eveningPeak = bands.filter((b) => b.hour >= 17).sort((a, b) => b.score - a.score)[0];
  const windDownHour =
    eveningPeak && eveningPeak.score >= 0.5
      ? Math.max(17, eveningPeak.hour - 1)
      : Math.floor(windDownPrior(opts.ageYears));

  return { confidence, daysObserved, daysNeeded, bands, frictionPeak, calmWindow, windDownHour, hardDays, hardLogs };
}

/** 24h hour → friendly label, e.g. 17 → "5pm", 9 → "9am". */
export function hourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const am = h < 12;
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${am ? "am" : "pm"}`;
}
