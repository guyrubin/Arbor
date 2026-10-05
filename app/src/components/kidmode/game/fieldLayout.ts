/**
 * fieldLayout — B-GAME-06 (lane C §B1, ruling G7): the design space of a kid
 * game scene, and where things stand in it. Pure: no React, no DOM.
 *
 * - Two design spaces: landscape 1600×900 and portrait 900×1600, picked by
 *   the field's aspect (>= 1 -> landscape).
 * - Scaled UNIFORMLY to COVER the field: the plate bleeds to every edge,
 *   never stretched, never letterboxed. The scale is capped only when cover
 *   would crop an anchor out of the safe area (square-ish tablets); the plate
 *   art carries PLATE_BLEED beyond the design space for exactly that case.
 * - The safe area = the visible part of the design space inset by 4 % of the
 *   design size on every edge. Every gameplay anchor stays inside it.
 * - Right-to-left mirrors the ART (x -> W - x), never the text; y never moves.
 */

export type FieldOrientation = "landscape" | "portrait";

export interface DesignSize { w: number; h: number }

export const DESIGN: Readonly<Record<FieldOrientation, DesignSize>> = {
  landscape: { w: 1600, h: 900 },
  portrait: { w: 900, h: 1600 },
};

/** Safe-area inset, as a fraction of the design size. */
export const SAFE_INSET = 0.04;
/** The plate is painted this fraction of the design size beyond each edge. */
export const PLATE_BLEED = 0.2;

export function orientationFor(width: number, height: number): FieldOrientation {
  return height <= 0 || width / height >= 1 ? "landscape" : "portrait";
}

/** A point in design units (feet anchor for actors). */
export interface FieldPoint { x: number; y: number }

/** A point on the hero's depth path: the feet, and the hero's height there.
 *  `t` (0..1, optional): the keypoint's place along the run; a path whose
 *  points all carry `t` is interpolated by it instead of by arc length. */
export interface DepthPoint extends FieldPoint { h: number; t?: number }

export interface FieldFit {
  orientation: FieldOrientation;
  design: DesignSize;
  /** Field size in CSS px. */
  width: number;
  height: number;
  scale: number;
  /** Screen position (CSS px) of the design space's top-left corner. */
  offsetX: number;
  offsetY: number;
  /** Visible part of the design space, in design units. */
  visible: { x0: number; y0: number; x1: number; y1: number };
  /** `visible` inset by SAFE_INSET: gameplay anchors live here. */
  safe: { x0: number; y0: number; x1: number; y1: number };
}

/**
 * Cover-fit the design space into a field of `width`×`height` CSS px. `need`
 * is the half-extent (design units, from the design centre) that must stay
 * inside the safe area; without it, plain cover.
 */
export function fitField(width: number, height: number, need?: { halfW: number; halfH: number }, orientation?: FieldOrientation): FieldFit {
  const o = orientation ?? orientationFor(width, height);
  const d = DESIGN[o];
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  let scale = Math.max(w / d.w, h / d.h);
  if (need) {
    const halfW = need.halfW + SAFE_INSET * d.w;
    const halfH = need.halfH + SAFE_INSET * d.h;
    scale = Math.min(scale, w / (2 * halfW), h / (2 * halfH));
  }
  const offsetX = (w - d.w * scale) / 2;
  const offsetY = (h - d.h * scale) / 2;
  const visible = {
    x0: Math.max(0, -offsetX / scale),
    y0: Math.max(0, -offsetY / scale),
    x1: Math.min(d.w, (w - offsetX) / scale),
    y1: Math.min(d.h, (h - offsetY) / scale),
  };
  const ix = SAFE_INSET * d.w;
  const iy = SAFE_INSET * d.h;
  const safe = { x0: visible.x0 + ix, y0: visible.y0 + iy, x1: visible.x1 - ix, y1: visible.y1 - iy };
  return { orientation: o, design: d, width: w, height: h, scale, offsetX, offsetY, visible, safe };
}

/** Mirror a design point for right-to-left (x only). */
export function mirrorX(p: FieldPoint, design: DesignSize, rtl: boolean): FieldPoint {
  return rtl ? { x: design.w - p.x, y: p.y } : { x: p.x, y: p.y };
}

/** Design point -> CSS px inside the field (for the unmirrored controls layer). */
export function toPx(fit: FieldFit, p: FieldPoint, rtl = false): FieldPoint {
  const m = mirrorX(p, fit.design, rtl);
  return { x: fit.offsetX + m.x * fit.scale, y: fit.offsetY + m.y * fit.scale };
}

export function insideSafe(fit: FieldFit, p: FieldPoint): boolean {
  return p.x >= fit.safe.x0 && p.x <= fit.safe.x1 && p.y >= fit.safe.y0 && p.y <= fit.safe.y1;
}

// ── Sneak & Freeze: Savta's courtyard ───────────────────────────────────────

/**
 * Two perspective rules (B-GAME-07d):
 * - The PLATE's floor (Builder 1, read off the plates' paving lines): an
 *   object standing with its base at y is h = k × (y − horizonY) × relH tall,
 *   relH = its height relative to a real child (COVER relH below). Covers and
 *   the cat's stool stand on this floor, so their bases sit on the plate.
 * - The HERO's own depth scale (`hero`): the same rule with its own horizon,
 *   so the child stays a readable child at the back gate (>= 110 px at 375x812,
 *   >= 150 px at 1920x1080) and grows smoothly to the tag close-up (about 52 %
 *   of the field at 375x812, 59 % at 1920x1080) — the usual game cheat of a
 *   hero drawn slightly larger than the set's perspective.
 * The run is a list of KEYPOINTS: the back gate (t 0), the three cover stops
 * at the rules' COVER_FRACTIONS, the tag (t 1); the hero is interpolated by
 * `t`, so a checkpoint is exactly where its cover is. Covers alternate sides
 * of the run, each standing BESIDE its stop (the hero at a cover visibly
 * stands next to it), clear of each other, of the cat, of the gate and of the
 * run's line. Measured against the proof art (COVER_ASPECT, HERO_EXTENT):
 * fieldLayout.test.ts checks every one of those relations at both orientations.
 */
interface CourtyardSpec {
  /** The plate's floor. */
  horizonY: number;
  k: number;
  /** The hero's depth scale. */
  hero: { horizonY: number; k: number };
  /** Keypoints: feet positions from the back gate (t 0) to the tag (t 1). */
  path: readonly (FieldPoint & { t: number })[];
  /** Cover objects: the path fraction they mark (= a keypoint's t), the base
   *  centre's x (its base y = the hero's y there), height relative to a child. */
  covers: readonly { id: CoverId; at: number; x: number; relH: number }[];
  /** The cat's stool: where its legs meet the floor, and its whole height as
   *  a fraction of the hero's height at the tag. */
  watcher: FieldPoint;
  watcherRelH: number;
  hand: FieldPoint;
}

export type CoverId = "lemon-tree" | "bench" | "lantern";

const COURTYARD: Readonly<Record<FieldOrientation, CourtyardSpec>> = {
  portrait: {
    horizonY: 400,
    k: 0.8,
    hero: { horizonY: 318, k: 0.772 },
    path: [
      { x: 478, y: 650, t: 0 },
      { x: 440, y: 790, t: 0.28 },
      { x: 500, y: 890, t: 0.52 },
      { x: 500, y: 1010, t: 0.76 },
      { x: 330, y: 1420, t: 1 },
    ],
    covers: [
      { id: "lemon-tree", at: 0.28, x: 182, relH: 1.2 },
      { id: "lantern", at: 0.52, x: 770, relH: 1.3 },
      { id: "bench", at: 0.76, x: 175, relH: 0.4 },
    ],
    watcher: { x: 645, y: 1420 },
    watcherRelH: 0.43,
    hand: { x: 200, y: 1360 },
  },
  landscape: {
    horizonY: 250,
    k: 0.848,
    hero: { horizonY: 216, k: 0.821 },
    path: [
      { x: 800, y: 380, t: 0 },
      { x: 680, y: 450, t: 0.28 },
      { x: 780, y: 540, t: 0.52 },
      { x: 640, y: 680, t: 0.76 },
      { x: 760, y: 800, t: 1 },
    ],
    covers: [
      { id: "lemon-tree", at: 0.28, x: 545, relH: 1.35 },
      { id: "lantern", at: 0.52, x: 950, relH: 1.45 },
      { id: "bench", at: 0.76, x: 395, relH: 0.5 },
    ],
    watcher: { x: 1100, y: 800 },
    watcherRelH: 0.55,
    hand: { x: 250, y: 740 },
  },
};

/** Visible width / height of each cover object in the proof art (alpha box). */
export const COVER_ASPECT: Readonly<Record<CoverId, number>> = { "lemon-tree": 0.55, bench: 1.42, lantern: 0.26 };
/** The hero's body to the left / right of its feet, as a fraction of its
 *  height, over every pose but the arms-up cheer (freeze-a reaches furthest). */
export const HERO_EXTENT = { left: 0.37, right: 0.46 } as const;
/** The cat on its stool to the left / right of the stool's feet, as a
 *  fraction of its drawn height (the turned-round sprite is the widest). */
export const WATCHER_EXTENT = { left: 0.48, right: 0.34 } as const;
/** The back gate in the plate (design units): no cover may stand in front of it. */
export const GATE: Readonly<Record<FieldOrientation, { x0: number; x1: number; y1: number }>> = {
  portrait: { x0: 393, x1: 556, y1: 650 },
  landscape: { x0: 725, x1: 875, y1: 380 },
};
/** A hero's width relative to its height (front three-quarter, arms in). */
export const HERO_ASPECT = 0.62;

export interface SneakLayout {
  orientation: FieldOrientation;
  design: DesignSize;
  /** The hero's depth path, sampled at its corners (feet + height). */
  heroPath: readonly DepthPoint[];
  covers: readonly { id: CoverId; at: number; feet: FieldPoint; h: number }[];
  /** The cat's stool in the foreground: feet point + full height. */
  watcher: { feet: FieldPoint; h: number };
  /** Where the prize floats when the hero holds it up (its centre). */
  prize: FieldPoint & { size: number };
  /** The pulsing hand glyph in the thumb zone (its centre). */
  hand: FieldPoint;
  /** Every anchor that must stay in the safe area. */
  anchors: readonly { id: string; p: FieldPoint }[];
  /** Half-extent from the design centre that must stay safe (for fitField). */
  need: { halfW: number; halfH: number };
}

/** A real child's height standing at depth y on the plate's floor. */
function floorH(spec: CourtyardSpec, y: number): number {
  return spec.k * (y - spec.horizonY);
}

function heroAt(spec: CourtyardSpec, p: FieldPoint & { t: number }): DepthPoint {
  return { x: p.x, y: p.y, h: Math.round(spec.hero.k * (p.y - spec.hero.horizonY)), t: p.t };
}

/** Cumulative polyline lengths, for even travel along the path. */
function lengths(path: readonly FieldPoint[]): number[] {
  const out = [0];
  for (let i = 1; i < path.length; i++) out.push(out[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
  return out;
}

/** The point at fraction t (0..1) of the run: between keypoints by their `t`
 *  when every point carries one, else by arc length; height interpolated. */
export function pointOnPath(path: readonly DepthPoint[], t: number): DepthPoint {
  if (path.length === 0) return { x: 0, y: 0, h: 0 };
  const tt = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  if (path.every((p) => typeof p.t === "number")) {
    if (tt <= (path[0].t as number)) return path[0];
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      if (tt <= (b.t as number) || i === path.length - 1) {
        const span = (b.t as number) - (a.t as number) || 1;
        const f = Math.min(1, Math.max(0, (tt - (a.t as number)) / span));
        if (f === 1) return b;
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, h: a.h + (b.h - a.h) * f };
      }
    }
    return path[path.length - 1];
  }
  const L = lengths(path);
  const total = L[L.length - 1] || 1;
  const target = tt * total;
  for (let i = 1; i < path.length; i++) {
    if (target <= L[i] || i === path.length - 1) {
      const seg = L[i] - L[i - 1] || 1;
      const f = Math.min(1, Math.max(0, (target - L[i - 1]) / seg));
      const a = path[i - 1];
      const b = path[i];
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, h: a.h + (b.h - a.h) * f };
    }
  }
  return path[path.length - 1];
}

export function sneakLayout(orientation: FieldOrientation): SneakLayout {
  const spec = COURTYARD[orientation];
  const design = DESIGN[orientation];
  const heroPath = spec.path.map((p) => heroAt(spec, p));
  const tagPoint = heroPath[heroPath.length - 1];
  const covers = spec.covers.map((c) => {
    const onPath = pointOnPath(heroPath, c.at);
    const feet = { x: c.x, y: onPath.y };
    return { id: c.id, at: c.at, feet, h: Math.round(floorH(spec, feet.y) * c.relH) };
  });
  const watcher = { feet: spec.watcher, h: Math.round(tagPoint.h * spec.watcherRelH) };
  const prizeSize = Math.round(tagPoint.h * 0.22);
  const prize = { x: tagPoint.x, y: Math.round(tagPoint.y - tagPoint.h - prizeSize * 0.35), size: prizeSize };
  const anchors: { id: string; p: FieldPoint }[] = [
    ...heroPath.map((p, i) => ({ id: `hero.${i}`, p: { x: p.x, y: p.y } })),
    // The hero's head at the tag (the face is what must never be cropped).
    { id: "hero.tag.head", p: { x: tagPoint.x, y: tagPoint.y - tagPoint.h } },
    { id: "hero.back.head", p: { x: heroPath[0].x, y: heroPath[0].y - heroPath[0].h } },
    ...covers.map((c) => ({ id: `cover.${c.id}`, p: c.feet })),
    { id: "watcher", p: watcher.feet },
    { id: "watcher.head", p: { x: watcher.feet.x, y: watcher.feet.y - watcher.h } },
    { id: "prize", p: { x: prize.x, y: prize.y } },
    { id: "hand", p: spec.hand },
  ];
  let halfW = 0;
  let halfH = 0;
  for (const a of anchors) {
    halfW = Math.max(halfW, Math.abs(a.p.x - design.w / 2));
    halfH = Math.max(halfH, Math.abs(a.p.y - design.h / 2));
  }
  return { orientation, design, heroPath, covers, watcher, prize, hand: spec.hand, anchors, need: { halfW, halfH } };
}

/** Fit + layout for a field of the given CSS size. */
export function sneakField(width: number, height: number): { fit: FieldFit; layout: SneakLayout } {
  const orientation = orientationFor(width, height);
  const layout = sneakLayout(orientation);
  return { fit: fitField(width, height, layout.need, orientation), layout };
}
