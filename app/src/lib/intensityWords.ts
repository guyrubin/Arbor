/**
 * F-CHILD-2 — how hard a moment felt, said in words.
 *
 * The capture slider, the review stepper and the evidence sheet all name a
 * moment's intensity with one of these five words, never as a bare number out
 * of five or a filled meter: the parent's own rating of how hard the moment
 * was is a description of that moment, not a grade of the child.
 */
export const INTENSITY_WORDS = [
  "companion.capture.intensity.1",
  "companion.capture.intensity.2",
  "companion.capture.intensity.3",
  "companion.capture.intensity.4",
  "companion.capture.intensity.5",
] as const;

export type IntensityWordKey = (typeof INTENSITY_WORDS)[number];

/** The word key for a stored intensity; out-of-band or missing values clamp into 1..5 (missing reads as the middle word). */
export function intensityWordKey(n: number | null | undefined): IntensityWordKey {
  const value = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 3;
  const clamped = Math.min(5, Math.max(1, value));
  return INTENSITY_WORDS[clamped - 1];
}
