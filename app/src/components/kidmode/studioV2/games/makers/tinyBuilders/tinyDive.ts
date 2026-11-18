/** The dive: one continuous fall through powers of ten, from a drop of pond
 * water on Aya's LeafLab down to a real phage. Pure numbers. The whole pond
 * is one map measured in micrometres (a thousandth of a millimetre); the
 * camera is a point on that map and a field width, and the child's depth
 * (0 at the drop, 4 at the phage) moves both. Between two stops the field
 * shrinks evenly on a log scale and the camera closes on the next thing the
 * way a zoom lens does: about one fixed point of the picture.
 *
 * Every size is a round, typical figure (the words say "about"):
 * a hanging drop about 5 mm across; a water flea (Daphnia) about 1 mm long
 * (the genus runs 0.2 to 5 mm); Paramecium about 0.2 mm long; a rod-shaped
 * bacterium such as E. coli about 2 micrometres long; a T4 phage about 0.2
 * micrometres from the top of its head to its baseplate. The test beside the
 * rules checks the words and the drawing against these figures. */
export type DiveThing = 'drop' | 'flea' | 'cell' | 'bacterium' | 'phage';
export const DIVE_THINGS: readonly DiveThing[] = ['drop', 'flea', 'cell', 'bacterium', 'phage'];
/** Typical real lengths, in micrometres. */
export const REAL_MICROMETRES: Readonly<Record<DiveThing, number>> = { drop: 5000, flea: 1000, cell: 200, bacterium: 2, phage: 0.2 };
export function timesLonger(big: DiveThing, small: DiveThing): number { return REAL_MICROMETRES[big] / REAL_MICROMETRES[small]; }

export interface Pt { x: number; y: number }
export interface DiveStop {
  thing: DiveThing;
  /** Where the thing is on the map (micrometres; y grows down the picture). */
  at: Pt;
  /** Where the camera looks when this stop fills the picture. */
  look: Pt;
  /** The width of pond across the picture's shorter side at this stop. */
  field: number;
}
/** How much of the picture's shorter side each thing fills at its own stop. */
export const FRAME_SHARE: Readonly<Record<DiveThing, number>> = { drop: 0.42, flea: 0.5, cell: 0.46, bacterium: 0.3, phage: 0.3 };
const stop = (thing: DiveThing, at: Pt, look: Pt = at): DiveStop => ({ thing, at, look, field: REAL_MICROMETRES[thing] / FRAME_SHARE[thing] });
const FLEA: Pt = { x: 420, y: -180 };
const CELL: Pt = { x: FLEA.x + 690, y: FLEA.y + 410 };
const BACTERIUM: Pt = { x: CELL.x + 150, y: CELL.y - 120 };
/** The rod lies level; the phage floats just over its upper side. */
export const ROD = { length: REAL_MICROMETRES.bacterium, width: 0.8 } as const;
const PHAGE_AT: Pt = { x: BACTERIUM.x + 0.18, y: BACTERIUM.y - ROD.width / 2 - 0.24 };
export const DIVE_STOPS: readonly DiveStop[] = [
  stop('drop', { x: 0, y: 0 }),
  stop('flea', FLEA),
  stop('cell', CELL),
  stop('bacterium', BACTERIUM, { x: BACTERIUM.x, y: BACTERIUM.y - 0.5 }),
  stop('phage', PHAGE_AT, { x: PHAGE_AT.x, y: PHAGE_AT.y + 0.06 }),
];
export const LAST_DEPTH = DIVE_STOPS.length - 1;
export const clampDepth = (d: number, max = LAST_DEPTH): number => Number.isFinite(d) ? Math.max(0, Math.min(max, d)) : 0;

export interface DiveCamera { x: number; y: number; field: number }
/** The camera at a depth. At a whole number it is that stop's own framing. */
export function diveCamera(depth: number): DiveCamera {
  const d = clampDepth(depth), k = Math.min(LAST_DEPTH - 1, Math.floor(d)), t = d - k;
  const from = DIVE_STOPS[k], to = DIVE_STOPS[k + 1];
  const field = Math.exp(Math.log(from.field) + (Math.log(to.field) - Math.log(from.field)) * t);
  // A zoom about a fixed point: the camera's distance from where it is going shrinks with the field.
  const u = (field - to.field) / (from.field - to.field);
  return { x: to.look.x + (from.look.x - to.look.x) * u, y: to.look.y + (from.look.y - to.look.y) * u, field };
}
/** How many times closer than the first picture (the powers of ten on the glass). */
export function magnification(depth: number): number { return DIVE_STOPS[0].field / diveCamera(depth).field; }
/** The whole dive, drop to phage. */
export const TOTAL_MAGNIFICATION = DIVE_STOPS[0].field / DIVE_STOPS[LAST_DEPTH].field;
/** The power of ten the picture has passed: 0 at the drop, 4 at the phage. */
export function decade(depth: number): number { return Math.max(0, Math.floor(Math.log10(magnification(depth)) + 1e-9)); }
/** A map point on a screen whose shorter side is `side` pixels and centre is `cx, cy`. */
export function toScreen(camera: DiveCamera, p: Pt, side: number, cx: number, cy: number): Pt & { k: number } {
  const k = side / camera.field;
  return { x: cx + (p.x - camera.x) * k, y: cy + (p.y - camera.y) * k, k };
}

/** How far the child may dive: one stop past the last thing recorded. */
export function depthLimit(found: number): number { return clampDepth(Math.max(0, Math.trunc(found)) + 1); }
/** A thing can be recorded once the dive is this close to its stop. */
export const RECORD_REACH = 0.3;
export function canRecord(depth: number, found: number): boolean {
  const next = Math.trunc(found) + 1;
  return next <= LAST_DEPTH && depth >= next - RECORD_REACH;
}
/** Holding dives at this many stops a second; it eases to a rest at the limit. */
export const DIVE_SPEED = 0.42;
export function diveStep(depth: number, direction: number, dtSeconds: number, limit: number): number {
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return clampDepth(depth, limit);
  const room = direction > 0 ? limit - depth : depth;
  const ease = Math.min(1, 0.18 + Math.max(0, room) * 3.2);
  return clampDepth(depth + Math.sign(direction) * DIVE_SPEED * ease * dtSeconds, limit);
}
/** A pinch or a wheel: the field shrinks by `ratio`; the answer is the new depth. */
export function depthForZoom(depth: number, ratio: number, limit: number): number {
  if (!(ratio > 0) || !Number.isFinite(ratio)) return clampDepth(depth, limit);
  const d = clampDepth(depth, limit), k = Math.min(LAST_DEPTH - 1, Math.floor(d));
  const span = Math.log(DIVE_STOPS[k].field / DIVE_STOPS[k + 1].field);
  return clampDepth(d + Math.log(ratio) / span, limit);
}

/* ---------- who lives in the drop ---------- */
export type PondKind = 'flea' | 'paramecium' | 'volvox' | 'euglena' | 'diatom' | 'waterBear' | 'rotifer' | 'rod' | 'phage';
export interface PondLife { kind: PondKind; x: number; y: number; /** Length in micrometres. */ size: number; turn: number; /** A private clock offset, so no two move together. */ phase: number; /** The four to find, and the secret. */ role?: DiveThing | 'secret' }
/** Typical lengths of the extras (micrometres), all round figures. */
export const EXTRA_SIZE: Readonly<Record<Exclude<PondKind, 'flea' | 'paramecium' | 'rod' | 'phage'>, number>> = { volvox: 350, euglena: 60, diatom: 80, waterBear: 250, rotifer: 220 };
export const SECRETS: readonly ('waterBear' | 'rotifer')[] = ['waterBear', 'rotifer'];

function mulberry(seed: number): () => number {
  let state = (Math.floor(seed) >>> 0) || 1;
  return () => { state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** The pond for one round. The four things to find always sit at their stops
 * (so the dive is the same journey); everything else, and which secret animal
 * hides beside the paramecium, changes with the seed. Nothing overlaps the
 * four, and nothing sits where the camera is heading. */
export function pondFor(seed: number): PondLife[] {
  const random = mulberry(seed), life: PondLife[] = [];
  const turn = () => random() * 360, phase = () => random() * 10;
  life.push({ kind: 'flea', ...FLEA, size: REAL_MICROMETRES.flea, turn: -18 + random() * 36, phase: phase(), role: 'flea' });
  life.push({ kind: 'paramecium', ...CELL, size: REAL_MICROMETRES.cell, turn: -30 + random() * 60, phase: phase(), role: 'cell' });
  life.push({ kind: 'rod', ...BACTERIUM, size: REAL_MICROMETRES.bacterium, turn: 0, phase: phase(), role: 'bacterium' });
  life.push({ kind: 'phage', ...PHAGE_AT, size: REAL_MICROMETRES.phage, turn: -14 + random() * 28, phase: phase(), role: 'phage' });
  const clearOf = (x: number, y: number, r: number) => life.every(l => Math.hypot(l.x - x, l.y - y) > r + l.size * 0.6);
  const scatter = (kind: PondKind, count: number, size: number, cx: number, cy: number, spread: number, keepOut: number, role?: PondLife['role']) => {
    for (let n = 0, tries = 0; n < count && tries < count * 30; tries++) {
      const a = random() * Math.PI * 2, r = keepOut + random() * (spread - keepOut), x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      const s = size * (0.8 + random() * 0.4);
      if (!clearOf(x, y, s * 0.6)) continue;
      life.push({ kind, x, y, size: s, turn: turn(), phase: phase(), role }); n++;
    }
  };
  // In the drop: other fleas and green globes, far from the way down.
  scatter('flea', 2, 900, 0, 0, 2000, 1500);
  scatter('volvox', 3 + Math.floor(random() * 2), EXTRA_SIZE.volvox, 0, 0, 2100, 900);
  // Round the flea: single cells.
  scatter('paramecium', 3, 190, FLEA.x, FLEA.y, 1300, 700);
  scatter('euglena', 6, EXTRA_SIZE.euglena, CELL.x, CELL.y, 520, 190);
  scatter('diatom', 5, EXTRA_SIZE.diatom, CELL.x, CELL.y, 560, 200);
  // The secret: one small animal near the paramecium, never on the way down.
  const secret = SECRETS[Math.floor(random() * SECRETS.length)];
  const side = random() < 0.5 ? -1 : 1;
  life.push({ kind: secret, x: CELL.x - 180 - random() * 20, y: CELL.y + side * (225 + random() * 20), size: EXTRA_SIZE[secret], turn: turn(), phase: phase(), role: 'secret' });
  // Round the bacterium: more rods, some in chains; and round the phage, a few more phages adrift.
  scatter('rod', 9, 2, BACTERIUM.x, BACTERIUM.y, 11, 2.4);
  scatter('phage', 4, 0.2, PHAGE_AT.x, PHAGE_AT.y - 0.4, 1.5, 0.55);
  return life;
}
