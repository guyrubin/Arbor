/** The pictures the Woolly Mammoth is staged with. The Ice Age itself (sky,
 * ridges, snow, grass, herd, aurora) and the mammoth are painted by the game
 * on one canvas. The only kit picture in the scene is the hall of chapter
 * one: the kit's glass rotunda (Horizon Dome's great glass hall) with its
 * five window openings cut clear, so the painted Ice Age shows through them.
 * It is the dim foreground the child stands in, lit by the window. The crew
 * and the tools come from the Studio's shared kit library only; this activity
 * ships no copy of its own. Measurements are taken from the image itself. */
import { STUDIO_MAKERS_ROOT } from '../../../../../../lib/kidThemeManifest';
import type { DiscoveryId, Vec } from './iceAgeFriendRules';

const MAKERS = STUDIO_MAKERS_ROOT;
export interface KitPicture { src: string; src480: string; width: number; height: number; /** The kit file it was made from (for the art manifest). */ source: string }
const made = (stem: string, width: number, height: number, source: string): KitPicture => ({ src: `${MAKERS}${stem}.webp`, src480: `${MAKERS}${stem}-480.webp`, width, height, source });

/** The hall: `bop/scene-band` with the valley masked out of its five glass openings (transparent there). */
export const HALL_PICTURE = made('ice-age-friend-hall', 1024, 683, 'studio-v2/bop/scene-band.webp');

/** The cover's view beyond the glass: the same kit picture, its valley recoloured to an Ice Age winter (snow, dry grass, cold air). The game itself paints its own. */
export const STEPPE_PICTURE = made('ice-age-friend-steppe', 1024, 683, 'studio-v2/bop/scene-band.webp');

/** The crew, seen from behind, in mission wardrobe (this is an expedition):
 * the shared kit library's `kit-*-mission-back` figures. One Bebe, one GobGob,
 * one of each friend for the whole Studio. */
export type FriendId = 'bebe' | 'gobgob' | 'pep' | 'chock' | 'aya';
export const FRIEND_ORDER: readonly FriendId[] = ['bebe', 'gobgob', 'pep', 'chock', 'aya'];
export const FRIENDS: Readonly<Record<FriendId, {
  src: string;
  /** Height against the mammoth's own height on screen. They stand nearer to us than it does, and still it is more than twice as tall as the tallest of them. */
  tall: number;
  /** Width over height of the figure. */
  aspect: number;
  /** Shown only where the floor is wide enough for all five. */
  wideOnly?: boolean;
}>> = {
  bebe: { src: `${MAKERS}kit-bebe-mission-back.webp`, tall: 0.3, aspect: 274 / 768 },
  gobgob: { src: `${MAKERS}kit-gobgob-mission-back.webp`, tall: 0.215, aspect: 329 / 768 },
  pep: { src: `${MAKERS}kit-pep-mission-back.webp`, tall: 0.13, aspect: 322 / 768 },
  chock: { src: `${MAKERS}kit-chock-mission-back.webp`, tall: 0.175, aspect: 352 / 768, wideOnly: true },
  aya: { src: `${MAKERS}kit-aya-mission-back.webp`, tall: 0.11, aspect: 376 / 768, wideOnly: true },
};

/** The crew's tools, as the kit renders them, each for the picture it finds. */
export const TOOL_PICTURE: Readonly<Record<DiscoveryId, { src: string; source: string }>> = {
  tusks: { src: `${MAKERS}kit-tool-routescope-480.webp`, source: 'kit/v30/09-observe-kit.png' },
  trunk: { src: `${MAKERS}kit-tool-waitring-480.webp`, source: 'kit/v30/02-gobgob-identity-wardrobes.png' },
  coats: { src: `${MAKERS}kit-tool-prooflens-480.webp`, source: 'kit/v30/09-observe-kit.png' },
  herd: { src: `${MAKERS}kit-tool-scoutcam-open-480.webp`, source: 'kit/v30/04-pep.png' },
  hump: { src: `${MAKERS}kit-tool-viewcheck-480.webp`, source: 'kit/v30/09-observe-kit.png' },
};

export interface HallGeometry {
  /** Each sheet of the glass wall, as fractions of the picture. */
  panes: readonly (readonly Vec[])[];
  /** The middle pane, in picture pixels: the one the giant's eye is behind. */
  pane: { x0: number; x1: number; y0: number; y1: number };
  /** The three panes of the bay, in picture pixels: what a wide screen frames. */
  trio: { x0: number; x1: number };
}
const W = HALL_PICTURE.width, H = HALL_PICTURE.height;
const px = (points: readonly Vec[]): Vec[] => points.map(([x, y]) => [x / W, y / H] as const);
/** The five openings of the rotunda, traced in picture pixels (the same polygons the cut-out was made with). */
export const HALL: HallGeometry = {
  panes: [
    px([[0, 452], [0, 80], [30, 88], [60, 105], [84, 129], [96, 157], [96, 446]]),
    px([[259, 440], [259, 205], [266, 184], [285, 167], [310, 159], [332, 157], [355, 159], [378, 169], [392, 187], [398, 209], [398, 438]]),
    px([[420, 456], [420, 164], [610, 164], [610, 456]]),
    px([[624, 438], [624, 205], [631, 184], [649, 167], [673, 159], [696, 157], [719, 159], [742, 168], [759, 185], [767, 206], [767, 440]]),
    px([[928, 446], [928, 152], [943, 124], [967, 100], [997, 82], [1024, 72], [1024, 452]]),
  ],
  pane: { x0: 420, x1: 610, y0: 164, y1: 456 },
  trio: { x0: 259, x1: 767 },
};
