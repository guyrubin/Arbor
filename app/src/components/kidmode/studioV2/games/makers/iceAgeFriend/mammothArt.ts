/** The pictures the Woolly Mammoth is staged in: the great glass hall of
 * Horizon Dome, the Ice Age steppe seen through its wall of glass, Pep, and
 * the basket of grass. Each picture is ONE constant here. Until the hall and
 * steppe renders made for this activity arrive (`/visuals/studio-v2/makers/
 * ice-age-friend-*.webp`), each stands in with the closest shipped kit image;
 * `standIn` says so. Measurements are fractions of the picture, taken by eye
 * from the image itself, so a new render only needs its own numbers. */
import { studioBopArt } from '../../../../../../lib/kidThemeManifest';
import type { Vec } from './iceAgeFriendRules';

export interface HallArt {
  src: string; src480: string; width: number; height: number; standIn: boolean;
  /** Each sheet of the glass wall: the steppe and (until it steps in) the mammoth show only through these. */
  panes: readonly (readonly Vec[])[];
  /** Where the mammoth stands in the hall (the middle of its feet), and the most of the picture's width it may span. */
  stage: { x: number; y: number; span: number };
  /** Where it stands beyond the glass, and its size there against its size in the hall. */
  beyond: { x: number; y: number; scale: number };
}
export interface SteppeArt {
  src: string; standIn: boolean;
  /** The plate is laid over the whole hall picture, enlarged about this point of itself. */
  origin: Vec; zoom: number;
  /** True while a kit valley picture stands in: it is cooled and whitened into winter in CSS. */
  wintered: boolean;
}

const px = (points: readonly Vec[], w: number, h: number): Vec[] => points.map(([x, y]) => [x / w, y / h] as const);
const BAND_W = 1024, BAND_H = 683;
/** `scene-band`: the glass rotunda. Its five window openings, traced in picture pixels. */
const BAND_PANES: readonly (readonly Vec[])[] = [
  [[0, 426], [0, 78], [30, 86], [60, 104], [84, 128], [97, 156], [97, 426]],
  [[258, 408], [258, 205], [266, 183], [285, 166], [310, 158], [332, 156], [355, 158], [378, 168], [393, 186], [399, 208], [399, 408]],
  [[419, 456], [419, 163], [611, 163], [611, 456]],
  [[623, 408], [623, 205], [630, 183], [648, 166], [672, 158], [695, 156], [718, 158], [742, 167], [760, 184], [768, 205], [768, 408]],
  [[927, 426], [927, 150], [942, 122], [966, 98], [996, 80], [1024, 70], [1024, 426]],
];

/** STAND-IN for `ice-age-friend-hall` (wide) and `ice-age-friend-hall-tall`: the shipped glass rotunda. */
export const HALL_WIDE: HallArt = {
  src: studioBopArt('scene-band'), src480: studioBopArt('scene-band-480'), width: BAND_W, height: BAND_H, standIn: true,
  panes: BAND_PANES.map(pane => px(pane, BAND_W, BAND_H)),
  stage: { x: 513 / BAND_W, y: 556 / BAND_H, span: 0.6 },
  beyond: { x: 548 / BAND_W, y: 447 / BAND_H, scale: 0.72 },
};
export const HALL_TALL: HallArt = HALL_WIDE;
/** The hall picture for a stage of this shape. */
export function hallFor(width: number, height: number): HallArt {
  return height > width * 1.15 ? HALL_TALL : HALL_WIDE;
}

/** STAND-IN for `ice-age-friend-steppe`: the valley's lake and snow-capped mountain, wintered. */
export const STEPPE: SteppeArt = { src: '/visuals/studio-v2/v30/valley-wide.webp', standIn: true, origin: [0.501, 0.43], zoom: 2.6, wintered: true };

/** Pep watches from the floor. STAND-IN for `ice-age-friend-pep-look` (the shipped Pep already looks up and to the right). */
export const PEP_IDLE = 'pep-idle';
export const PEP_HAPPY = 'pep-happy';
/** STAND-IN for `ice-age-friend-grass` (a basket of steppe grass): the shipped knit cushion, with the game's own grass on it. */
export const GRASS_REST = { src: studioBopArt('item-cushion'), standIn: true, width: 252, height: 150 };
/** `ice-age-friend-herd` has no shipped stand-in: until it arrives the far herd is only heard. */
export const HERD: { src: string } | null = null;

/** The pane outline as one CSS polygon (zero-width bridges join the sheets), for clipping a layer laid over the hall picture. */
export function panesClipPath(hall: HallArt): string {
  const first = hall.panes[0]?.[0];
  if (!first) return 'none';
  const pct = ([x, y]: Vec) => `${(x * 100).toFixed(2)}% ${(y * 100).toFixed(2)}%`;
  const parts: string[] = [];
  for (const pane of hall.panes) { for (const point of pane) parts.push(pct(point)); parts.push(pct(pane[0]), pct(first)); }
  return `polygon(${parts.join(', ')})`;
}
