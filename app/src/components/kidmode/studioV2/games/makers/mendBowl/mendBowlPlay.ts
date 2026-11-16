/** Mend the Bowl play helpers. Pure: no React, no timers, no randomness.
 * The saved creation and its validator live in `mendBowlRules.ts` and are not
 * touched here; this file holds what only the play view needs: how the table
 * is framed at each screen shape, where the things on it stand, a second
 * arrangement of the pieces for a replay, and the small sums behind a
 * forgiving trace. */
import { ROTATE_STEP, SEAM_COVER, SNAP_DEG, normalizeDeg, type BowlPatternData, type Point, type Pose } from './mendBowlRules';

/* ---------- the table, framed for the screen ---------- */
/** The part of the table the stage shows, in stage units. The bowl and its
 * cloth always sit in 0…440 by 0…390; a tall stage shows more table in front
 * of the cloth, a wide stage more to each side. */
export interface StageView { x: number; y: number; w: number; h: number }
export const VIEW_BASE = { w: 440, h: 470 } as const;
export const VIEW_MAX = { w: 640, h: 580 } as const;
/** Where the front strip of the table starts (just under the cloth's hem). */
export const STRIP_TOP = 394;

export function stageView(boxW: number, boxH: number): StageView {
  if (!(boxW > 0) || !(boxH > 0)) return { x: 0, y: 0, w: VIEW_BASE.w, h: VIEW_BASE.h };
  const ratio = boxH / boxW;
  if (ratio >= VIEW_BASE.h / VIEW_BASE.w) return { x: 0, y: 0, w: VIEW_BASE.w, h: Math.round(Math.min(VIEW_MAX.h, VIEW_BASE.w * ratio)) };
  const w = Math.round(Math.min(VIEW_MAX.w, VIEW_BASE.h / ratio));
  return { x: (VIEW_BASE.w - w) / 2, y: 0, w, h: VIEW_BASE.h };
}
/** A pointer position inside the stage box, in stage units (the drawing is
 * scaled evenly and centred, exactly as the SVG layers are). */
export function toUnits(view: StageView, boxW: number, boxH: number, px: number, py: number): Point {
  if (!(boxW > 0) || !(boxH > 0)) return { x: 0, y: 0 };
  const scale = Math.min(boxW / view.w, boxH / view.h);
  return { x: view.x + view.w / 2 + (px - boxW / 2) / scale, y: view.y + view.h / 2 + (py - boxH / 2) / scale };
}
/** Stage units per screen pixel. */
export function unitsPerPixel(view: StageView, boxW: number, boxH: number): number {
  return boxW > 0 && boxH > 0 ? 1 / Math.min(boxW / view.w, boxH / view.h) : 1;
}

/** The five standing places along the front of the table: `feet` is where a
 * thing's base rests, `scale` grows the things when the strip is deep. */
export interface TableRow { feet: number; scale: number; slots: readonly [number, number, number, number, number] }
export const PROP_HEIGHT = 60;
export function tableRow(view: StageView): TableRow {
  const depth = view.y + view.h - STRIP_TOP;
  const scale = Math.max(1, Math.min(1.34, (depth - 14) / (PROP_HEIGHT + 2)));
  const feet = STRIP_TOP + (depth + PROP_HEIGHT * scale) / 2 - 2;
  const span = Math.min(view.w, 540) * 0.8, centre = view.x + view.w / 2;
  const at = (k: number) => Math.round(centre + (k / 4 - 0.5) * span);
  return { feet: Math.round(feet), scale: Math.round(scale * 100) / 100, slots: [at(0), at(1), at(2), at(3), at(4)] };
}

/* ---------- a second arrangement for a replay ---------- */
/** How far a replay swirls the scatter about the middle of the table, in degrees. */
export const SWIRLS = [0, 40, -40] as const;
/** The pieces' poses after the break. Arrangement 0 is the authored scatter;
 * 1 and 2 carry every piece's resting place round the table by a part turn
 * (one way, then the other) and 1 also turns each piece the other way, so a
 * replay of the same break is a different puzzle with the same spacing. */
export function arrange(pattern: BowlPatternData, variant: number, centre: Point): Pose[] {
  const v = ((variant % SWIRLS.length) + SWIRLS.length) % SWIRLS.length, a = SWIRLS[v] * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return pattern.pieces.map(piece => {
    if (v === 0) return { ...piece.start };
    const dx = piece.centroid.x + piece.start.x - centre.x, dy = piece.centroid.y + piece.start.y - centre.y;
    return { x: Math.round(centre.x + dx * c - dy * s - piece.centroid.x), y: Math.round(centre.y + dx * s + dy * c - piece.centroid.y), r: v === 1 ? -piece.start.r : piece.start.r };
  });
}

/* ---------- fitting, kindly ---------- */
/** A piece parked this close to home is kept there even when it is still turned. */
export const NEAR_DIST = 46;
/** True when a dropped piece is at its place but turned too far to click in:
 * it waits there, and one turn will finish the job. */
export function waitsForTurn(pose: Pose): boolean {
  return Math.hypot(pose.x, pose.y) <= NEAR_DIST && Math.abs(normalizeDeg(pose.r)) > SNAP_DEG;
}
/** The turn-button step that brings a pose nearer upright. */
export function turnToward(pose: Pose): number {
  return normalizeDeg(pose.r) > 0 ? -ROTATE_STEP : ROTATE_STEP;
}
/** The loose piece a turn button acts on when none is chosen: the most turned. */
export function mostTurned(poses: readonly Pose[], placed: readonly boolean[]): number {
  let best = -1, most = -1;
  poses.forEach((pose, i) => { const r = Math.abs(normalizeDeg(pose.r)); if (!placed[i] && r > most) { most = r; best = i; } });
  return best;
}
/** The piece the first hint demonstrates: a loose one that needs no turning. */
export function easiestPiece(poses: readonly Pose[], placed: readonly boolean[]): number {
  let best = -1, least = Infinity;
  poses.forEach((pose, i) => { const r = Math.abs(normalizeDeg(pose.r)); if (!placed[i] && r < least) { least = r; best = i; } });
  return best;
}

/* ---------- tracing, kindly ---------- */
/** A finger that lifts with this much of a seam covered has done enough: the
 * gold runs on by itself. (While the finger is down the mark is SEAM_COVER.) */
export const SEAM_LIFT_COVER = 0.5;
export function liftCompletes(share: number): boolean {
  return share >= SEAM_LIFT_COVER && share < SEAM_COVER;
}
/** The seam sample nearest a point. */
export function nearestSample(samples: readonly Point[], p: Point): { index: number; distance: number } {
  let index = -1, distance = Infinity;
  samples.forEach((s, i) => { const d = Math.hypot(s.x - p.x, s.y - p.y); if (d < distance) { distance = d; index = i; } });
  return { index, distance };
}
/** The point a share t (0…1) of the way along evenly spaced samples. */
export function pointAlong(samples: readonly Point[], t: number): Point {
  if (!samples.length) return { x: 0, y: 0 };
  const f = Math.min(1, Math.max(0, t)) * (samples.length - 1), i = Math.min(samples.length - 2, Math.floor(f)), u = f - i;
  if (samples.length === 1) return samples[0];
  return { x: samples[i].x + (samples[i + 1].x - samples[i].x) * u, y: samples[i].y + (samples[i + 1].y - samples[i].y) * u };
}
/** Tracing plays a rising run: the step (0…steps) a covered share has reached. */
export const TRACE_STEPS = 7;
export function traceStep(share: number): number {
  return Math.min(TRACE_STEPS, Math.floor(Math.max(0, share) * TRACE_STEPS / SEAM_COVER));
}
/** Gold eases in and out of a seam (0…1 → 0…1). */
export function easeFlow(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c < 0.5 ? 2 * c * c : 1 - (-2 * c + 2) ** 2 / 2;
}
