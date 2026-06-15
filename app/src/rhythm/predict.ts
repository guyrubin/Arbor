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

/** Minimal event shape — decoupled from the app's BehaviorLog on purpose. */
export interface RhythmEvent {
  /** ISO string or epoch ms. */
  timestamp: string | number;
  /** 1–5 difficulty/intensity of the moment. */
  intensity: number;
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

const DEFAULTS = { windowDays: 21, wakeHour: 6, sleepHour: 21, minDays: 7 } as const;
const DAY_MS = 86_400_000;
const HIGH_INTENSITY = 4; // 4–5 are the moments worth predicting around

function toMs(ts: string | number): number {
  return typeof ts === "number" ? ts : new Date(ts).getTime();
}

/** Age-based wind-down prior (hour) used until evening logs are dense enough. */
function windDownPrior(ageYears: number | undefined): number {
  if (ageYears == null) return 19;
  if (ageYears < 1) return 18;
  if (ageYears < 3) return 18.5 | 0; // ~18:30 → floor to 18 for an hour band
  if (ageYears < 6) return 19;
  return 20;
}

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
  for (const e of inWindow) dayKeys.add(Math.floor(toMs(e.timestamp) / DAY_MS));
  const daysObserved = dayKeys.size;
  const daysNeeded = Math.max(0, minDays - daysObserved);

  // Intensity-weighted pressure per hour (only hard moments push a band).
  const hours = Array.from({ length: sleepHour - wakeHour }, (_, i) => wakeHour + i);
  const raw = new Map<number, number>(hours.map((h) => [h, 0]));
  for (const e of inWindow) {
    if (e.intensity < HIGH_INTENSITY) continue;
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

  const confidence: RhythmConfidence =
    daysObserved === 0 ? "none"
    : daysObserved < minDays ? "low"
    : daysObserved < windowDays * 0.6 ? "medium"
    : "high";

  // Below the usable bar, don't assert peaks/windows — only the honest "learning" read.
  if (confidence === "none" || confidence === "low" || peakRaw === 0) {
    return {
      confidence, daysObserved, daysNeeded,
      bands: bands.map((b) => ({ ...b, tone: "calm", score: 0 })),
      frictionPeak: null, calmWindow: null,
      windDownHour: confidence === "none" ? null : Math.floor(windDownPrior(opts.ageYears)),
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

  return { confidence, daysObserved, daysNeeded, bands, frictionPeak, calmWindow, windDownHour };
}

/** 24h hour → friendly label, e.g. 17 → "5pm", 9 → "9am". */
export function hourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const am = h < 12;
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${am ? "am" : "pm"}`;
}
