/** Mend the Bowl play helpers. Pure: no React, no timers, no randomness.
 * The saved creation and its validator live in `mendBowlRules.ts` and are not
 * touched here; this file holds what only the play view needs: how the table
 * is framed at each screen shape, where the things on it stand, a second
 * arrangement of the pieces for a replay, and the small sums behind a
 * forgiving trace. */
import { ROTATE_STEP, SEAM_COVER, SNAP_DEG, normalizeDeg, type BowlPatternData, type Point, type Pose } from './mendBowlRules';

/* ---------- the table, framed for the screen ---------- */
/** The part of the table the stage shows, in stage units. The bowl sits at the
 * table's centre (220, 220). A wide stage shows more table to each side; a tall
 * stage shows more above and below, and once the top of the picture is reached
 * it shows the floor in front of the table instead. */
export interface StageView { x: number; y: number; w: number; h: number }
export const VIEW_CENTRE: Point = { x: 220, y: 220 };
export const VIEW_BASE = { w: 440, h: 470 } as const;
/** The table picture's reach in stage units: the view never leaves it. */
export const VIEW_TOP = -50;
export const VIEW_MAX = { w: 540, h: 680 } as const;

export function stageView(boxW: number, boxH: number): StageView {
  let w: number = VIEW_BASE.w, h: number = VIEW_BASE.h;
  if (boxW > 0 && boxH > 0) {
    const ratio = boxH / boxW;
    if (ratio >= VIEW_BASE.h / VIEW_BASE.w) h = Math.round(Math.min(VIEW_MAX.h, VIEW_BASE.w * ratio));
    else w = Math.round(Math.min(VIEW_MAX.w, VIEW_BASE.h / ratio));
  }
  return { x: VIEW_CENTRE.x - w / 2, y: Math.max(VIEW_TOP, VIEW_CENTRE.y - h / 2), w, h };
}
/** A pointer position inside the stage box, in stage units (the drawing is
 * scaled evenly and centred, exactly as the SVG layers are). */
export function toUnits(view: StageView, boxW: number, boxH: number, px: number, py: number): Point {
  if (!(boxW > 0) || !(boxH > 0)) return { ...VIEW_CENTRE };
  const scale = Math.min(boxW / view.w, boxH / view.h);
  return { x: view.x + view.w / 2 + (px - boxW / 2) / scale, y: view.y + view.h / 2 + (py - boxH / 2) / scale };
}
/** Stage units per screen pixel. */
export function unitsPerPixel(view: StageView, boxW: number, boxH: number): number {
  return boxW > 0 && boxH > 0 ? 1 / Math.min(boxW / view.w, boxH / view.h) : 1;
}

/** Where the things on the table stand (centre and width, stage units). They
 * keep to the rim of the linen and the wood beyond it, clear of the pieces,
 * and all of them are inside the smallest view. Left and right are the
 * table's own: nothing here mirrors with the reading direction. */
export interface TableSpot { x: number; y: number; size: number }
export const TABLE_SPOTS = {
  lamp: { x: 62, y: 54, size: 78 },
  fern: { x: 380, y: 50, size: 88 },
  bloom: { x: 408, y: 150, size: 48 },
  gold: { x: 72, y: 384, size: 70 },
  roller: { x: 140, y: 410, size: 86 },
} as const satisfies Record<string, TableSpot>;
/** Where a standing friend goes: on the floor in front of the table when the
 * stage is tall, beside the table when it is wide. `x` is the figure's left
 * edge, `feet` its base line, `tall` its height (stage units). When the stage
 * shows neither floor nor room at the side, there is no place for one. */
export interface StandingSpot { x: number; feet: number; tall: number }
export const FRIEND_TALL = 176;
export function standingSpot(view: StageView): StandingSpot | null {
  const floor = view.y + view.h - (VIEW_CENTRE.y + 235), side = -view.x;
  // On the floor, the figure's head stays just under the tools at the table's near-left edge.
  if (floor >= 110) return { x: view.x + 10, feet: view.y + view.h - 6, tall: Math.min(FRIEND_TALL, floor + 26) };
  if (side >= 30) return { x: view.x + 4, feet: view.y + view.h - 6, tall: FRIEND_TALL };
  return null;
}
/** The four glaze dishes, in an arc in front of the bowl (left to right). */
export const GLAZE_SPOTS: readonly TableSpot[] = [150, 122, 94, 66].map(deg => ({
  x: Math.round(VIEW_CENTRE.x + 152 * Math.cos(deg * Math.PI / 180)), y: Math.round(VIEW_CENTRE.y + 152 * Math.sin(deg * Math.PI / 180)), size: 66,
}));

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
