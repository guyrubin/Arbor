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

const library = (stem: string, width: number, height: number): KitPicture => ({ src: `${MADE}${stem}.webp`, src480: `${MADE}${stem}-480.webp`, width, height, source: `shared kit library ${stem}, cut from kit v30/15-companion-reactions.png` });

export const DESK_KIT = {
  /** The room: the empty arched pavilion with the valley beyond. */
  room: bop('scene-delivery', 1024, 1024, true),
  /** The desk and its computer: the TrailBench, deployed. Cut from the kit's
   * TrailBench board (the DEPLOYED hero picture), its floor removed. */
  bench: { src: `${MADE}maker-desk-bench.webp`, src480: `${MADE}maker-desk-bench-480.webp`, width: 753, height: 525, source: 'kit v30/11-trailbench.png, DEPLOYED hero (x 737, y 33, 753 by 525), cut out with scratchpad md/kit.py' } as KitPicture,
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
export const LID_GLASS = '30.3% 4.2%, 87.6% 5.7%, 86.7% 30.5%, 28.7% 26.1%';
/** Where each docked tool sits in the bench picture (percent of its box). */
export const TRAY_SPOTS: readonly (readonly [number, number])[] = [[19.9, 47.2], [32.7, 48.2], [44.6, 49.9], [57.6, 51.4], [71, 53.1]];
