import { STUDIO_BOP_ROOT, STUDIO_MAKERS_ROOT } from '../../../../../../lib/kidThemeManifest';

/** Pep's Trail art: every picture the run shows, as one table. Characters come
 * from the shared kit library (`kit-*`) and the shipped Bop sprites; the
 * trail's own plates were cropped from shipped valley pictures, cut along
 * their skylines and graded to dusk and to the lit night (the scripts and the
 * originals stay outside the repo). `from` names the source of each file.
 * No picture here shows Bebe or GobGob except the shared `kit-bebe-*` and
 * `kit-gobgob-*` figures. */
const BOP = STUDIO_BOP_ROOT, MADE = STUDIO_MAKERS_ROOT;
export interface KitArt { src: string; w: number; h: number; from: string }
const made = (stem: string, w: number, h: number, from: string): KitArt => ({ src: `${MADE}${stem}.webp`, w, h, from });
const bop = (stem: string, w: number, h: number): KitArt => ({ src: `${BOP}${stem}.webp`, w, h, from: `shipped bop/${stem}` });
export type Tone = 'dusk' | 'night';
const twin = (stem: string, w: number, h: number, from: string): Record<Tone, KitArt> => ({ dusk: made(`${stem}-dusk`, w, h, from), night: made(`${stem}-night`, w, h, from) });

export const PLATES = {
  /** Sky, mountain and lake, with sky enough above for a portrait phone (valley-wide, centre; the top 400 rows continue its sky). */
  sky: twin('fox-trail-sky', 1030, 1000, 'shipped v30/valley-wide (x 232–1262, y 0–600)'),
  /** Pavilion terraces cut along their skyline, mirrored to repeat (valley-wide, left). Shown twice: far and middle distance. */
  gardens: twin('fox-trail-gardens', 1200, 370, 'shipped v30/valley-wide (x 0–600, y 330–700)'),
  /** The near terraces: the great pavilion, its planted walls and trees, mirrored to repeat (valley-wide, right). */
  terrace: twin('fox-trail-terrace', 1212, 350, 'shipped v30/valley-wide (x 930–1536, y 350–700)'),
  /** The great glass pavilion that stands in for Horizon Dome (valley-wide, right, mirrored whole). */
  dome: twin('fox-trail-dome', 712, 370, 'shipped v30/valley-wide (x 1180–1536, y 330–700)'),
  /** The white planter wall and the paving the trail runs on, mirrored to repeat (scene-sun). */
  wall: twin('fox-trail-wall', 1670, 546, 'shipped bop/scene-sun (x 0–835, y 478–1024)'),
  /** The flower bed at the camera's feet: lupins and delphiniums, mirrored to repeat (valley-wide, lower left). */
  blooms: twin('fox-trail-blooms', 744, 118, 'shipped v30/valley-wide (x 0–372, y 612–730)'),
} as const;

export const SPRITES = {
  lamp: bop('item-lamp', 245, 300), can: bop('item-can', 278, 205), fern: bop('rover-planter', 320, 278),
  sunLit: bop('sun-lit', 520, 520), sunUnlit: bop('sun-unlit', 520, 520),
  planterBud: made('kit-prop-planter-bud', 258, 400, 'shared kit library'),
  planterBloom: made('kit-prop-planter-bloom', 282, 426, 'shared kit library'),
  trailBench: made('kit-prop-trailbench', 768, 388, 'shared kit library'),
} as const;

/* ── Pep, the runner: the kit's own side view, moved like a cut-out puppet ── */

/** The kit's standing side view of Pep in his scout harness (board 04, MISSION /
 * SIDE). The puppet shows this one picture several times, each copy clipped to
 * a part (body, head, two near legs, and the same two again, shaded, as the
 * far pair), so no private copy of the character is shipped. The box field is where
 * the picture sits on the board; outlines are in board pixels. */
export interface PepSheet extends KitArt { box: readonly [x: number, y: number, w: number, h: number]; dy: number }
export const PEP_SIDE: PepSheet = {
  ...made('kit-pep-mission-side', 730, 768, 'shared kit library (kit v30/04-pep.png, MISSION / SIDE)'), box: [407, 514, 421, 443], dy: 498,
};
type Outline = readonly (readonly [number, number])[];
/** The body ends at the harness's neck strap; the head is its own part and nods about the neck. */
const BODY: Outline = [[578, 128], [610, 100], [860, 100], [860, 300], [812, 318], [800, 338], [770, 338], [752, 318], [735, 300], [716, 293], [700, 291], [650, 304], [604, 322], [604, 338], [540, 338], [516, 330], [505, 318], [440, 318], [440, 236], [462, 218]];
const HEAD: Outline = [[395, 0], [600, 0], [600, 130], [585, 165], [481, 238], [470, 215], [395, 215]];
const FORE: Outline = [[547, 296], [604, 296], [604, 330], [594, 372], [586, 420], [587, 460], [521, 460], [521, 440], [538, 428], [546, 410], [545, 330]];
const HIND: Outline = [[735, 240], [812, 240], [816, 300], [826, 340], [838, 380], [838, 460], [770, 460], [770, 440], [790, 424], [796, 398], [785, 362], [768, 338], [750, 312], [736, 286]];
const fx = (sheet: PepSheet, x: number) => ((x - sheet.box[0]) / sheet.box[2]) * 100;
const fy = (sheet: PepSheet, y: number) => ((y + sheet.dy - sheet.box[1]) / sheet.box[3]) * 100;
const pct = (sheet: PepSheet, pts: Outline) => `polygon(${pts.map(([x, y]) => `${fx(sheet, x).toFixed(2)}% ${fy(sheet, y).toFixed(2)}%`).join(', ')})`;
const at = (sheet: PepSheet, x: number, y: number) => `${fx(sheet, x).toFixed(2)}% ${fy(sheet, y).toFixed(2)}%`;
/** World units per board pixel: Pep stands about 128 units to his ear tips, a quarter of a phone's width. */
/** The static cover uses the native right-facing mission pose; the runtime puppet keeps its own geometry. */
export const PEP_COVER = made('kit-pep-mission-sniffing', 600, 624, 'shared kit library (kit v30/16-wonder-crew-key-art.png)');
export const PEP_K = 0.29;
export function pepParts(sheet: PepSheet = PEP_SIDE) {
  return {
    w: sheet.box[2] * PEP_K, h: sheet.box[3] * PEP_K,
    /** Where his feet are on the picture (fractions): the point the world places. */
    foot: [(675 - sheet.box[0]) / sheet.box[2], (459 + sheet.dy - sheet.box[1]) / sheet.box[3]] as const,
    body: pct(sheet, BODY), head: pct(sheet, HEAD), fore: pct(sheet, FORE), hind: pct(sheet, HIND),
    shoulder: at(sheet, 574, 314), hip: at(sheet, 776, 270), centre: at(sheet, 655, 300), neck: at(sheet, 533, 200),
    /** Where a swinging leg's soft top fades in (percent of the picture's height). */
    foreFade: [fy(sheet, 296), fy(sheet, 326)] as const,
    hindFade: [fy(sheet, 240), fy(sheet, 292)] as const,
    /** The ScoutCam's dome on his back (percent of the picture). */
    cam: [fx(sheet, 622), fy(sheet, 173)] as const,
  };
}

/* ── the scene's measures (world units; the path is y = 0 and up is negative on screen) ── */

/** How far above the path the lake's far shore sits: the camera's eye level. */
export const HORIZON = 150;
export interface Layer { id: string; art: keyof typeof PLATES; /** Units per picture pixel. */ k: number; /** How fast it passes (1 = the trail). */ f: number; /** Its foot, in units below the horizon line (+) … */ foot: number; /** … and how far it sinks while Pep is up on the skybridge. */ sink: number }
/** The parallax stack between the sky and the trail, far to near: the two valley pictures by turns, so no row repeats its neighbour. */
export const LAYERS: readonly Layer[] = [
  { id: 'farShore', art: 'gardens', k: 0.26, f: 0.05, foot: 30, sink: 60 },
  { id: 'farTerrace', art: 'terrace', k: 0.36, f: 0.09, foot: 54, sink: 96 },
  { id: 'midGardens', art: 'gardens', k: 0.62, f: 0.17, foot: 112, sink: 150 },
  { id: 'nearTerrace', art: 'terrace', k: 0.78, f: 0.36, foot: 150, sink: 270 },
];
/** The sky plate: its lake row, where the mountain stands on it, how big the mountain is drawn (units per
 * picture pixel, on a wide view and on a narrow one), and how far across the view it drifts over the whole run. */
export const SKY = { lakeRow: 920 / 1000, peak: 543 / 1030, wide: 1.35, narrow: 2, from: 0.76, to: 0.34 } as const;
/** Wall tile: 0.5 units a pixel; its paving row 222 is the line Pep's feet run on. */
export const WALL = { k: 0.5, floorRow: 222 } as const;
/** In front of the trail: the flower bed, then ferns so near the camera they are a blur. */
export const BLOOMS = { k: 1.3, f: 1.35 } as const;
export const FERNS = { f: 2.2, every: 3400, w: 280 } as const;
/** Where Pep stands in the view (fraction from its left edge): a little farther back on a narrow phone. */
export const LEAD = { wide: 0.27, narrow: 0.22 } as const;

/** The crew at their stations, each in mission kit. Shared kit-library figures; heights in units. */
export type FriendId = 'aya' | 'chock' | 'bebe' | 'gobgob';
export interface Friend { id: FriendId; art: KitArt; h: number; /** Offset from the station's stopping place. */ dx: number; /** The stored picture faces right: mirror it so the friend looks back at Pep. */ flip: boolean }
const crew = (stem: string, w: number, h: number): KitArt => made(stem, w, h, 'shared kit library');
export const FRIENDS: Readonly<Record<FriendId, Friend>> = {
  aya: { id: 'aya', art: crew('kit-aya-mission-front', 398, 768), h: 96, dx: 150, flip: false },
  chock: { id: 'chock', art: crew('kit-chock-mission-side', 768, 601), h: 138, dx: 210, flip: false },
  bebe: { id: 'bebe', art: crew('kit-bebe-mission-side', 193, 768), h: 226, dx: 228, flip: true },
  gobgob: { id: 'gobgob', art: crew('kit-gobgob-mission-front', 325, 768), h: 150, dx: 150, flip: false },
};
/** Who waits at the end of each stretch. The last station is the Dome, where Bebe and GobGob wait with the TrailBench. */
export const STATION_CREW: readonly (readonly FriendId[])[] = [['aya'], ['chock'], ['gobgob', 'bebe']];
/** The Dome's sun, on its tall stand behind the crew at the last station: dark until the ScoutCam flashes. */
export const DOME_SUN = { dx: 189, y: 252, size: 132 } as const;
/** Where Aya and Chock stand when the whole crew gathers at the Dome for the finale (offsets from Pep). */
export const GATHER: readonly { who: FriendId; dx: number; back: number }[] = [{ who: 'aya', dx: -84, back: 0 }, { who: 'chock', dx: 338, back: 0 }];
