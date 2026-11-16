import { BOUNCERS, LOGS, NOOK_X, PATH_H, ROOF, STONES, STONE_X, STREAM, TUNNEL, WORLD_H, WORLD_W } from './foxTrailRules';

/** Pep's Trail art: every picture the trail shows, as one table. Nothing here
 * is drawn in code. Characters come from the shared kit library (`kit-*`) and
 * the shipped Bop sprites; the trail's own plates were cropped from shipped
 * valley pictures and graded to dusk and to the lit night (the scripts and the
 * originals stay outside the repo). `from` names the kit source of each file. */
const BOP = '/visuals/studio-v2/bop/', MADE = '/visuals/studio-v2/makers/';
export interface KitArt { src: string; w: number; h: number; from: string }
const made = (stem: string, w: number, h: number, from: string): KitArt => ({ src: `${MADE}${stem}.webp`, w, h, from });
const bop = (stem: string, w: number, h: number): KitArt => ({ src: `${BOP}${stem}.webp`, w, h, from: `shipped bop/${stem}` });
export type Tone = 'dusk' | 'night';
const twin = (stem: string, w: number, h: number, from: string): Record<Tone, KitArt> => ({ dusk: made(`${stem}-dusk`, w, h, from), night: made(`${stem}-night`, w, h, from) });

export const PLATES = {
  /** Sky, mountain and lake (valley-wide, centre). */
  far: twin('fox-trail-far', 710, 600, 'shipped v30/valley-wide (x 420–1130, y 0–600)'),
  /** Pavilion terraces cut along their skyline, mirrored to repeat (valley-wide, left). */
  gardens: twin('fox-trail-gardens', 1200, 370, 'shipped v30/valley-wide (x 0–600, y 330–700)'),
  /** The great glass pavilion that stands in for Horizon Dome (valley-wide, right, mirrored whole). */
  dome: twin('fox-trail-dome', 712, 370, 'shipped v30/valley-wide (x 1180–1536, y 330–700)'),
  /** The white planter wall and the paving the trail runs on, mirrored to repeat (scene-sun). */
  wall: twin('fox-trail-wall', 1670, 546, 'shipped bop/scene-sun (x 0–835, y 478–1024)'),
  /** A run of the same planter, raised: the low place only a roll gets under. */
  planter: twin('fox-trail-planter', 950, 126, 'shipped bop/scene-sun (x 360–835, y 538–664)'),
  /** The pool: a calm strip of the valley's lake. */
  water: twin('fox-trail-water', 720, 76, 'shipped v30/valley-wide (x 600–960, y 528–566)'),
} as const;

export const SPRITES = {
  cushion: bop('item-cushion', 252, 150), lamp: bop('item-lamp', 245, 300), can: bop('item-can', 278, 205),
  padTeal: bop('pad-teal', 248, 220), padAmber: bop('pad-amber', 238, 207), padBlue: bop('pad-blue', 248, 220),
  tileBlue: bop('tile-blue', 245, 162), tilePink: bop('tile-pink', 245, 162), tileYellow: bop('tile-yellow', 245, 162),
  petalAmber: bop('petal-amber', 181, 300), petalTeal: bop('petal-teal', 181, 300), petalCoral: bop('petal-coral', 181, 300),
  sunLit: bop('sun-lit', 520, 520), sunUnlit: bop('sun-unlit', 520, 520),
  flowerOpen: bop('flower-open', 293, 440), flowerFolded: bop('flower-folded', 293, 440),
} as const;

/* ── Pep, the runner: the kit's own side view, moved like a cut-out puppet ── */

/** The kit's standing side view of Pep (board 04, SIDE). The puppet shows this
 * one picture five times, each copy clipped to a part (body, two near legs,
 * and the same two again, shaded, as the far pair), so no private copy of the
 * character is shipped. The box field is where the picture sits on the board. */
export interface PepSheet extends KitArt { box: readonly [x: number, y: number, w: number, h: number]; dy: number }
export const PEP_SIDE: PepSheet = {
  ...made('kit-pep-mission-side', 730, 768, 'shared kit library (kit v30/04-pep.png, MISSION / SIDE)'), box: [407, 514, 421, 443], dy: 498,
};
/** Outlines on the board (EVERYDAY row; `dy` moves them to the MISSION row). */
const BODY: readonly (readonly [number, number])[] = [[395, 0], [860, 0], [860, 300], [812, 318], [800, 338], [770, 338], [752, 318], [735, 300], [716, 293], [700, 291], [650, 304], [604, 322], [604, 338], [540, 338], [516, 330], [505, 318], [395, 318]];
const FORE: readonly (readonly [number, number])[] = [[547, 296], [604, 296], [604, 330], [594, 372], [586, 420], [587, 460], [521, 460], [521, 440], [538, 428], [546, 410], [545, 330]];
const HIND: readonly (readonly [number, number])[] = [[735, 240], [812, 240], [816, 300], [826, 340], [838, 380], [838, 460], [770, 460], [770, 440], [790, 424], [796, 398], [785, 362], [768, 338], [750, 312], [736, 286]];
const pct = (sheet: PepSheet, pts: readonly (readonly [number, number])[]) => `polygon(${pts.map(([x, y]) => `${(((x - sheet.box[0]) / sheet.box[2]) * 100).toFixed(2)}% ${(((y + sheet.dy - sheet.box[1]) / sheet.box[3]) * 100).toFixed(2)}%`).join(', ')})`;
const at = (sheet: PepSheet, x: number, y: number) => `${(((x - sheet.box[0]) / sheet.box[2]) * 100).toFixed(2)}% ${(((y + sheet.dy - sheet.box[1]) / sheet.box[3]) * 100).toFixed(2)}%`;
/** World units per board pixel: Pep stands about 98 units to his ear tips. */
export const PEP_K = 0.22;
export function pepParts(sheet: PepSheet = PEP_SIDE) {
  return {
    w: sheet.box[2] * PEP_K, h: sheet.box[3] * PEP_K,
    /** Where his feet are on the picture (fractions): the point the world places. */
    foot: [(675 - sheet.box[0]) / sheet.box[2], (459 + sheet.dy - sheet.box[1]) / sheet.box[3]] as const,
    body: pct(sheet, BODY), fore: pct(sheet, FORE), hind: pct(sheet, HIND),
    shoulder: at(sheet, 574, 314), hip: at(sheet, 776, 270), centre: at(sheet, 655, 300),
    /** Where a swinging leg's soft top fades in (percent of the picture's height). */
    foreFade: [((296 + sheet.dy - sheet.box[1]) / sheet.box[3]) * 100, ((326 + sheet.dy - sheet.box[1]) / sheet.box[3]) * 100] as const,
    hindFade: [((240 + sheet.dy - sheet.box[1]) / sheet.box[3]) * 100, ((292 + sheet.dy - sheet.box[1]) / sheet.box[3]) * 100] as const,
    /** The TraceBeacon's light on his harness (percent of the picture). */
    beacon: [((528 - sheet.box[0]) / sheet.box[2]) * 100, ((268 + sheet.dy - sheet.box[1]) / sheet.box[3]) * 100] as const,
  };
}

/* ── where things stand along the trail (world units; y is down from the top) ── */

export const GROUND_Y = WORLD_H - PATH_H;
export interface Prop { id: string; art: KitArt; x: number; w: number; /** Lift of its foot above the path. */ up?: number; squash?: number; back?: boolean }
const sized = (id: string, art: KitArt, x: number, w: number, extra: Partial<Prop> = {}): Prop => ({ id, art, x, w, ...extra });
const PADS = [SPRITES.padTeal, SPRITES.padAmber, SPRITES.padBlue];
const TILES = [SPRITES.tileBlue, SPRITES.tilePink, SPRITES.tileYellow];
/** Things Pep meets on the path itself. */
export const COURSE: readonly Prop[] = [
  ...LOGS.map((log, i) => sized(`cushion${i}`, SPRITES.cushion, log.x, log.r * 3.5, { up: -3 })),
  ...BOUNCERS.map((cap, i) => sized(`pad${i}`, PADS[i % PADS.length], cap.x, cap.w * 1.3, { squash: 0.5, up: -4 })),
  ...STONES.map((stone, i) => sized(`tile${i}`, TILES[i % TILES.length], stone.x, stone.w * 1.2, { up: -30 + stone.top })),
];
/** Garden lamps along the wall: dark at dusk, lit when the valley's lights come back. */
export const LAMP_XS: readonly number[] = [300, 1120, 1830, 2250, 2940, 3290, 4180, 4760, 5300];
/** Knit flowers that open as Pep goes by (and when tapped). */
export const FLOWER_XS: readonly number[] = [520, 1010, 1460, 1680, 2180, 3080, 3210, 4090, 4560, 4950];
/** The crew wait at their stations in their mission kit, each with the tool that belongs there:
 * Aya and her LeafLab in the lavender, Bebe and the RouteScope at the pool, Chock and his TrailTag
 * by the raised planter, GobGob and the PulsePod at the Dome. Shared kit-library figures. */
export type FriendId = 'aya' | 'bebe' | 'chock' | 'gobgob';
export interface Station { id: FriendId; art: KitArt; x: number; h: number; low: boolean }
const crew = (stem: string, w: number, h: number): KitArt => made(stem, w, h, 'shared kit library');
export const STATIONS: readonly Station[] = [
  { id: 'aya', art: crew('kit-aya-mission-front', 398, 768), x: 430, h: 84, low: false },
  { id: 'bebe', art: crew('kit-bebe-mission-side', 193, 768), x: STREAM.from - 62, h: 192, low: false },
  { id: 'chock', art: crew('kit-chock-mission-side', 768, 601), x: TUNNEL.from - 268, h: 116, low: true },
  { id: 'gobgob', art: crew('kit-gobgob-mission-front', 325, 768), x: STONE_X + 172, h: 136, low: false },
];
/** Where the PulsePod sits on GobGob's jacket (fractions of his picture). */
export const PULSEPOD = [0.51, 0.4] as const;
export const CAN_X = 365;
/** The Dome's sun: five petals, three of them gone dark until Pep brings their light home. */
export const SUN = { x: STONE_X + 56, y: GROUND_Y - 150, size: 124 } as const;
export const PLANTER = { x: ROOF.from - 6, w: ROOF.to - ROOF.from + 12, top: GROUND_Y - ROOF.h - 8 } as const;
export const POOL = { x: STREAM.from, w: STREAM.to - STREAM.from, top: GROUND_Y - 18, line: GROUND_Y + STREAM.bed - STREAM.water } as const;
export const NOOK = { x: NOOK_X, y: GROUND_Y - ROOF.h - 16 } as const;
export const PETAL_ART = { tallGrass: SPRITES.petalAmber, stone: SPRITES.petalTeal, hollow: SPRITES.petalCoral } as const;

/* ── parallax ── */
export const PARALLAX = { far: 0.03, gardens: 0.3, trail: 1 } as const;
export const layerWidth = (f: number) => Math.ceil(WORLD_W * f + 1900);
export const TRAIL_W = WORLD_W + 700;
/** Where a world x shows up on a parallax layer (for a view about 800 wide). */
export const onLayer = (xw: number, f: number) => xw * f + (1 - f) * 400;
/** Wall tile: 0.5 units a pixel; its paving row 222 is the line Pep's feet run on. */
export const WALL = { k: 0.5, top: GROUND_Y - 222 * 0.5 } as const;
export const GARDENS = { k: 0.5, top: GROUND_Y - 16 - 370 * 0.5 } as const;
export const DOME = { k: 0.66, x: onLayer(STONE_X + 40, PARALLAX.gardens) - 356 * 0.66, top: GROUND_Y - 14 - 370 * 0.66 } as const;
/** The far plate keeps its lake line here, however wide it has to be drawn. */
export const FAR = { lake: 348, lakeRow: 520 / 600, aspect: 600 / 710, minW: 940 } as const;
export const PLANTER_H = PLANTER.w * (126 / 950);
export { TUNNEL };
