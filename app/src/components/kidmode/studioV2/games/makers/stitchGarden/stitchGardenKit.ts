/** The kit pictures Stitch Garden is staged on: Aya's stitching table in the
 * Sky Gardens, seen from straight above. Every picture is ONE constant here,
 * with the kit file it comes from (`from`), so the art manifest can list its
 * sources. Nothing is generated: each is a shipped kit image or a crop or
 * cut-out of a kit board made with kit/tools/kitcut.py. Strings and numbers
 * only: the cover and the kept-cloth preview import this too. */
import { STUDIO_BOP_ROOT, STUDIO_MAKERS_ROOT } from '../../../../../../lib/kidThemeManifest';
const BOP = STUDIO_BOP_ROOT;
const CUT = STUDIO_MAKERS_ROOT;
export interface KitPicture { readonly src: string; readonly src480: string | null; readonly width: number; readonly height: number; readonly from: string }
const shipped = (stem: string, width: number, height: number, small = false): KitPicture => ({ src: `${BOP}${stem}.webp`, src480: small ? `${BOP}${stem}-480.webp` : null, width, height, from: `studio-v2/bop/${stem}.webp` });

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

/** From the Studio's shared kit library (`kit-*`, cut once for every maker). */
const library = (stem: string, width: number, height: number, from: string): KitPicture => ({ src: `${CUT}${stem}.webp`, src480: `${CUT}${stem}-480.webp`, width, height, from });

/** The bud that would not hurry (the kit's Flower Journal: day one, later, later still). The three are drawn at one scale, standing on one spot. */
const BOARD_23 = 'kit/v30/23-bop-props-T08-T10.png (T08 Flower Journal)';
export const BUD: readonly KitPicture[] = [library('kit-prop-planter-bud', 258, 400, BOARD_23), library('kit-prop-planter-budding', 262, 400, BOARD_23), library('kit-prop-planter-bloom', 282, 426, BOARD_23)];

/** GobGob, who waits with the bud: his patient face, his glad one when a flower is whole, and his curious one when he is tapped. */
const BOARD_14 = 'kit/v30/14-gobgob-expressions.png';
export const GOBGOB_WAITING: KitPicture | null = library('kit-gobgob-face-patient', 512, 506, BOARD_14);
export const GOBGOB_GLAD: KitPicture | null = library('kit-gobgob-face-delighted', 511, 512, BOARD_14);
export const GOBGOB_CURIOUS: KitPicture | null = library('kit-gobgob-face-curious', 512, 479, BOARD_14);
/** His WaitRing, the patient-progress band, with where its four lights are in the picture (fractions of its width and height). */
export const WAITRING: KitPicture & { readonly lights: readonly { x: number; y: number; w: number; h: number }[] } = {
  ...library('kit-tool-waitring', 638, 354, 'kit/v30/02-gobgob-identity-wardrobes.png'),
  lights: [{ x: 0.138, y: 0.505, w: 0.19, h: 0.215 }, { x: 0.338, y: 0.575, w: 0.154, h: 0.165 }, { x: 0.502, y: 0.572, w: 0.148, h: 0.165 }, { x: 0.657, y: 0.528, w: 0.137, h: 0.19 }],
};
/** Aya's LeafLab: the puck that reads water, light and warmth. The library picture holds the whole set; the crop box is the closed puck alone, in its pixels. */
export const LEAFLAB: (KitPicture & { readonly crop: { x: number; y: number; w: number; h: number } }) | null = { ...library('kit-tool-leaflab', 640, 543, 'kit/v30/05-aya.png'), crop: { x: 6, y: 98, w: 326, h: 266 } };
