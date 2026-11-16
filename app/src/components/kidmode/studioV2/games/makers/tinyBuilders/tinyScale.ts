/** The zoom journey: from a drop of pond water on Aya's bench down to a real
 * phage, in four stops. Pure numbers. Every size is a round, typical figure
 * (the words on screen say "about"); each picture draws its two things in the
 * proportion written here, and the test beside the rules checks that the
 * drawing and the words agree with these figures.
 *
 * Sources of the round figures: a hanging drop of water is about 3 mm across;
 * Paramecium caudatum is about 0.2 mm long (the genus runs 0.05 to 0.33 mm);
 * Escherichia coli is a rod about 2 micrometres long; a T4 phage is about
 * 0.2 micrometres from the top of its head to its baseplate. */
export type ScaleThing = 'drop' | 'swimmer' | 'cell' | 'phage';
/** Typical real sizes, in micrometres (a thousandth of a millimetre). */
export const REAL_MICROMETRES: Readonly<Record<ScaleThing, number>> = { drop: 3000, swimmer: 200, cell: 2, phage: 0.2 };

export type ScaleStopId = 'leaf' | 'swimmer' | 'cell' | 'phage';
export interface ScaleStop {
  id: ScaleStopId;
  /** What fills the picture. */
  big: ScaleThing;
  /** What is seen small in it, ringed: the next stop's subject (none at the last stop). */
  small: ScaleThing | null;
  /** Drawn lengths in drawing units (the 400-wide stage). */
  bigUnits: number;
  smallUnits: number;
  /** The centre of the ring round the small thing: where the zoom dives in. */
  ring: { x: number; y: number; r: number } | null;
}
/** The leaf picture shows about 5 cm of bench, so the 3 mm drop is 6 % of
 * its width; a paramecium in it would be a fifteenth of the drop, far too
 * small to draw, so the ring simply marks the drop. */
export const SCALE_STOPS: readonly ScaleStop[] = [
  { id: 'leaf', big: 'drop', small: null, bigUnits: 24, smallUnits: 0, ring: { x: 200, y: 220, r: 30 } },
  { id: 'swimmer', big: 'swimmer', small: 'cell', bigUnits: 236, smallUnits: 2.4, ring: { x: 96, y: 118, r: 22 } },
  { id: 'cell', big: 'cell', small: 'phage', bigUnits: 324, smallUnits: 31, ring: { x: 252, y: 190, r: 28 } },
  { id: 'phage', big: 'phage', small: null, bigUnits: 298, smallUnits: 0, ring: null },
];
export const LAST_STOP = SCALE_STOPS.length - 1;
export function clampStop(stop: number): number {
  return Number.isFinite(stop) ? Math.max(0, Math.min(LAST_STOP, Math.trunc(stop))) : 0;
}
/** How many of `small` laid end to end are as long as one `big`. */
export function timesLonger(big: ScaleThing, small: ScaleThing): number {
  return REAL_MICROMETRES[big] / REAL_MICROMETRES[small];
}
/** How much bigger the next picture draws its subject than this one draws it small. */
export function zoomFactor(stop: number): number {
  const here = SCALE_STOPS[clampStop(stop)], next = SCALE_STOPS[clampStop(stop + 1)];
  if (!here.ring || here === next) return 1;
  // The leaf picture's ring marks the whole drop; the next picture is inside it.
  if (here.small === null) return (next.bigUnits / REAL_MICROMETRES[next.big]) / (here.bigUnits / REAL_MICROMETRES[here.big]);
  return next.bigUnits / here.smallUnits;
}
/** A zoom takes longer the further it dives, but never drags. */
export function zoomMs(stop: number): number {
  return Math.round(Math.min(2100, 900 + 210 * Math.log(Math.max(1, zoomFactor(stop)))));
}
