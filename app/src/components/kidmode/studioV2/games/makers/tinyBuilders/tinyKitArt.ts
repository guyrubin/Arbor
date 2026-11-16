/** The kit pictures Tiny Structures stands on (Horizon Valley, register v30):
 * one small module of path constants, each with its pixel size and the kit
 * file it was cut from. Nothing is fetched or made at runtime. No picture of
 * this activity's own (`tiny-builders-*`) shows a child. Characters come from
 * the shared kit library only: Aya in the scene (`kit-aya-front`), and the
 * coach heads the shared HUD draws (Aya, and Bebe with his ProofLens:
 * `kit-bebe-face-*`, whose names carry `bebe` as the likeness register needs). */
import { STUDIO_BOP_ROOT, STUDIO_MAKERS_ROOT } from '../../../../../../lib/kidThemeManifest';
const BOP = STUDIO_BOP_ROOT, MAKERS = STUDIO_MAKERS_ROOT;
export interface KitArt { src: string; src480: string; width: number; height: number; /** The kit file it was cut from. */ source: string }
const art = (root: string, stem: string, width: number, height: number, source: string): KitArt => ({ src: `${root}${stem}.webp`, src480: `${root}${stem}-480.webp`, width, height, source });

/** The Wonderworks room behind the bench: the white arched pavilion, valley in the windows (shipped). */
export const ART_ROOM = art(BOP, 'scene-delivery', 1024, 1024, 'app shipped: bop/scene-delivery');
/** The row of the room picture that sits on the bench's far rail: just under the valley's hills in the windows, so the arches and the view fill the frame and the rail hides the wall's foot and the floor. */
export const ROOM_FLOOR_Y = 560;
/** The TrailBench, stowed (shared kit library): on the cover. */
export const ART_TRAILBENCH = art(MAKERS, 'kit-prop-trailbench', 768, 388, 'shared kit library: kit-prop-trailbench (v30/11-trailbench.png, STOWED)');
/** The ProofLens, lens up: Bebe's camera puck, lying on the bench. */
export const ART_PROOFLENS = art(MAKERS, 'kit-tool-prooflens', 622, 426, 'shared kit library: kit-tool-prooflens (v30/09-observe-kit.png)');
/** Aya's LeafLab (shared kit library: closed puck, open puck and capsule). Only the closed puck is shown: the drop of pond water sits on it. */
export const ART_LEAFLAB = art(MAKERS, 'kit-tool-leaflab', 640, 543, 'shared kit library: kit-tool-leaflab (v30/05-aya.png)');
/** The closed puck inside ART_LEAFLAB, in its pixels: x, y, width, height. */
export const LEAFLAB_CLOSED: readonly [number, number, number, number] = [40, 118, 270, 246];
/** Aya, standing, seen from the front (shared kit library): she watches over the bench's far rail. */
export const ART_AYA = art(MAKERS, 'kit-aya-front', 408, 768, 'shared kit library: kit-aya-front (v30/05-aya.png, EVERYDAY front)');
/** Wonderworks in Horizon Valley: the last frame of the pull-back. No characters. */
export const ART_VALLEY = art(MAKERS, 'tiny-builders-valley', 1280, 478, 'kit v30/env-wonderworks-hub-vista.png (the hero picture, top 624 px)');
/** Where the workshop's open front sits in ART_VALLEY, as shares of the picture: the pull-back rises out of it. */
export const VALLEY_WORKSHOP: readonly [number, number] = [0.4, 0.56];
/** Every picture this activity shows, for the art manifest. */
export const TINY_KIT_ART: readonly KitArt[] = [ART_ROOM, ART_TRAILBENCH, ART_PROOFLENS, ART_LEAFLAB, ART_AYA, ART_VALLEY];
