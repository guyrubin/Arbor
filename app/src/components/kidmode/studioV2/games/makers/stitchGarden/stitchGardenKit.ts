/** The kit pictures Stitch Garden is staged on: Aya's stitching table in the
 * Sky Gardens, seen from straight above. Every picture is ONE constant here,
 * with the kit file it comes from (`from`), so the art manifest can list its
 * sources. Nothing is generated: each is a shipped kit image or a crop or
 * cut-out of a kit board made with kit/tools/kitcut.py. Strings and numbers
 * only: the cover and the kept-cloth preview import this too. */
const BOP = '/visuals/studio-v2/bop/';
const CUT = '/visuals/studio-v2/makers/';
export interface KitPicture { readonly src: string; readonly src480: string | null; readonly width: number; readonly height: number; readonly from: string }
const shipped = (stem: string, width: number, height: number, small = false): KitPicture => ({ src: `${BOP}${stem}.webp`, src480: small ? `${BOP}${stem}-480.webp` : null, width, height, from: `app/public/visuals/studio-v2/bop/${stem}.webp` });
/** A piece cut for this activity from a kit board. */
export const cut = (stem: string, width: number, height: number, from: string): KitPicture => ({ src: `${CUT}${stem}.webp`, src480: `${CUT}${stem}-480.webp`, width, height, from });

/** A round thing photographed from straight above, measured in its own
 * pixels: where its centre is, and the radius the drawing lines it up by. */
export interface RoundPicture extends KitPicture { readonly cx: number; readonly cy: number; readonly r: number }

/** The round linen table. `r` is its teal ring, which is drawn `ringAt` units
 * out from the hoop's centre: the hoop lies well inside the linen top, and the
 * ring and the pale rim show in the corners of the stage. The cloth held in
 * the hoop is the same linen, so `linenR` is how far the plain weave reaches. */
export const TABLE: RoundPicture & { readonly ringAt: number; readonly linenR: number } = { ...shipped('scene-table', 1024, 1024, true), cx: 511.5, cy: 513.5, r: 380, ringAt: 236, linenR: 370 };

/** Aya, who looks after the garden. Both poses share one square canvas, feet on the bottom edge. */
export const AYA_WATCHING: KitPicture = shipped('aya-idle', 440, 440);
export const AYA_GLAD: KitPicture = shipped('aya-happy', 440, 440);
/** Her watering can: the sip of water in the story. */
export const WATERING_CAN: KitPicture = shipped('item-can', 278, 205);
/** Where the needle rests: a knit round, seen from above. */
export const PINCUSHION: KitPicture = shipped('rover-bloom-folded', 280, 254);

/** The bud that would not hurry (the kit's Flower Journal: day one, later, later still), cut to one canvas so the pot never moves. */
const BOARD_23 = 'kit/v30/23-bop-props-T08-T10.png (T08 Flower Journal)';
export const BUD: readonly KitPicture[] = [1, 2, 3].map(n => cut(`stitch-garden-bud-${n}`, 277, 410, BOARD_23));

/** From the Studio's shared kit library (`kit-*`, cut once for every maker).
 * A null picture has not been cut yet: its place on the table stays empty. */
const library = (stem: string, width: number, height: number, from: string): KitPicture => ({ src: `${CUT}${stem}.webp`, src480: `${CUT}${stem}-480.webp`, width, height, from });
/** GobGob, who waits with the bud: his patient face, his glad one when a flower is whole, and his curious one when he is tapped. */
const BOARD_14 = 'kit/v30/14-gobgob-expressions.png';
export const GOBGOB_WAITING: KitPicture | null = library('kit-gobgob-face-patient', 512, 506, BOARD_14);
export const GOBGOB_GLAD: KitPicture | null = library('kit-gobgob-face-delighted', 511, 512, BOARD_14);
export const GOBGOB_CURIOUS: KitPicture | null = library('kit-gobgob-face-curious', 512, 479, BOARD_14);
/** Aya's LeafLab: the puck that reads water, light and warmth. Not in the library yet. */
export const LEAFLAB: KitPicture | null = null;
