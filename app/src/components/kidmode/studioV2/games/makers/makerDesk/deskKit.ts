/** The kit pictures the Maker Desk is staged with: the white arched studio
 * pavilion of Horizon Valley, the TrailBench (the crew's rolling lab bench,
 * deployed, its lid screen up) and shipped kit props and companions. Every
 * picture is ONE constant here: its path, its pixel size and the kit file it
 * comes from. Strings and numbers only: the cover imports this too. */
import { STUDIO_BOP_ROOT, STUDIO_MAKERS_ROOT, STUDIO_V30_ROOT } from '../../../../../../lib/kidThemeManifest';
const BOP = STUDIO_BOP_ROOT;
const V30 = STUDIO_V30_ROOT;
const MADE = STUDIO_MAKERS_ROOT;
export interface KitPicture { readonly src: string; readonly src480: string | null; readonly width: number; readonly height: number; readonly source: string }
const bop = (stem: string, width: number, height: number, small = false): KitPicture => ({ src: `${BOP}${stem}.webp`, src480: small ? `${BOP}${stem}-480.webp` : null, width, height, source: `shipped app art: bop/${stem}` });

const library = (stem: string, width: number, height: number, from = 'v30/15-companion-reactions.png'): KitPicture => ({ src: `${MADE}${stem}.webp`, src480: `${MADE}${stem}-480.webp`, width, height, source: `shared kit library ${stem}, cut from kit ${from}` });
const made = (stem: string, width: number, height: number, source: string): KitPicture => ({ src: `${MADE}${stem}.webp`, src480: `${MADE}${stem}-480.webp`, width, height, source });

export const DESK_KIT = {
  /** The room: the empty arched pavilion with the valley beyond. */
  room: bop('scene-delivery', 1024, 1024, true),
  /** The same room for landscape screens: the shipped picture with its own mirror on each side, cropped to the arches and the floor. */
  roomWide: made('maker-desk-room-wide', 1600, 750, 'shipped app art bop/scene-delivery, mirrored outward on both sides and cropped (scratchpad v3/md/art.py)'),
  /** The bench at cockpit size: the same kit cut-out, enlarged 1.7x and lightly sharpened. */
  benchHd: made('maker-desk-bench-hd', 1280, 913, 'maker-desk-bench (kit v30/11-trailbench.png, DEPLOYED hero), enlarged with Lanczos and an unsharp mask (scratchpad v3/md/art.py)'),
  /** The bench's own cyan lights, lifted out of the same picture as a soft glow layer (same box as the bench). */
  benchLights: made('maker-desk-bench-lights', 753, 537, 'maker-desk-bench (kit v30/11-trailbench.png): its cyan pixels, blurred into a glow (scratchpad v3/md/art.py)'),
  /** The five docked tools, held up when touched: the shared kit library's own cut-outs. */
  toolProofLens: library('kit-tool-prooflens', 622, 426, 'v30/09-observe-kit.png'), toolViewCheck: library('kit-tool-viewcheck', 640, 448, 'v30/09-observe-kit.png'),
  toolPulsePod: library('kit-tool-pulsepod', 372, 528, 'v30/02-gobgob-identity-wardrobes.png'), toolLeafLab: library('kit-tool-leaflab', 640, 543, 'v30/05-aya.png'), toolClearPatch: library('kit-tool-clearpatch', 480, 260, 'v30/10-act-kit.png'),
  /** The planter on the floor, in its three kit stages: tight bud, swelling bud, full bloom. */
  planterBud: library('kit-prop-planter-bud', 258, 400, 'v30/23-bop-props-T08-T10.png'), planterBudding: library('kit-prop-planter-budding', 262, 400, 'v30/23-bop-props-T08-T10.png'), planterBloom: library('kit-prop-planter-bloom', 282, 426, 'v30/23-bop-props-T08-T10.png'),
  /** The desk and its computer: the TrailBench, deployed. Cut from the kit's
   * TrailBench board (the DEPLOYED hero picture), its floor removed. */
  bench: { src: `${MADE}maker-desk-bench.webp`, src480: `${MADE}maker-desk-bench-480.webp`, width: 753, height: 537, source: 'kit v30/11-trailbench.png, DEPLOYED hero (x 737, y 33, 753 by 537), cut out with its whole feet and no floor between them (scratchpad v3/md/recut.py)' } as KitPicture,
  /** Chock, whole (the wide room and the cover): shipped. */
  chockIdle: bop('chock-idle', 440, 440), chockHappy: bop('chock-happy', 440, 440),
  /** Chock and Aya looking over an edge, from the Studio's shared kit library (one copy for every maker). */
  chockWatch: library('kit-chock-attentive', 506, 512), chockUnsure: library('kit-chock-uncertain', 512, 464), chockGlad: library('kit-chock-relieved', 512, 491),
  ayaPeek: library('kit-aya-inquisitive', 512, 459), ayaGlad: library('kit-aya-delighted', 512, 449),
  lamp: bop('item-lamp', 245, 300), can: bop('item-can', 278, 205),
  flowerFolded: bop('flower-folded', 293, 440), flowerOpen: bop('flower-open', 293, 440),
  rug: bop('rest-rug', 420, 193),
  tileYellow: bop('tile-yellow', 245, 162), tileBlue: bop('tile-blue', 245, 162), tilePink: bop('tile-pink', 245, 162),
  /** Keepsakes on the show steps for the older creation kinds. */
  cushion: bop('item-cushion', 252, 150), band: bop('item-band', 186, 146), journal: bop('item-journal', 269, 196),
  /** The desktop wallpaper inside the computer: the valley, shown in chunky squares. */
  valley: { src: `${V30}valley-wide-480.webp`, src480: null, width: 480, height: 320, source: 'shipped app art: v30/valley-wide-480' } as KitPicture,
} as const;

/** The lid's glass, as corners in the bench picture (percent of its box):
 * top-left, top-right, bottom-right, bottom-left. The screen overlay is
 * clipped to it, so the sleeping and waking screen sits inside the lid. */
export const LID_GLASS = '30.3% 4.1%, 87.6% 5.6%, 86.7% 29.8%, 28.7% 25.5%';
/** Where each docked tool sits in the bench picture (percent of its box). */
export const TRAY_SPOTS: readonly (readonly [number, number])[] = [[19.9, 46.1], [32.7, 47.1], [44.6, 48.8], [57.6, 50.3], [71, 51.9]];
/** The middle of the lid's glass, and the front light bar, in the bench picture (percent of its box). */
export const LID_CENTRE: readonly [number, number] = [58.3, 16.2];
export const FRONT_BAR: readonly [number, number] = [41.5, 64.5];
/** The room pictures as fractions of their own box: the three arched windows (left, top, width, height). */
export const WINDOWS_TALL: readonly (readonly [number, number, number, number])[] = [[16.6, 25.4, 16.4, 37], [41.6, 25.4, 16.8, 37], [67, 25.4, 16.4, 37]];
export const WINDOWS_WIDE: readonly (readonly [number, number, number, number])[] = [[31.4, 12.4, 9.4, 44], [45.3, 12.4, 9.6, 44], [59.2, 12.4, 9.4, 44]];
