/** The pictures the Woolly Mammoth is staged in. The hall is the kit's glass
 * rotunda (Horizon Dome's great glass hall); its five window openings were cut
 * out so the Ice Age shows through them, and the Ice Age steppe is the same
 * view turned to winter, so the two always line up. The mammoth's fur is drawn
 * by the game between them (beyond the glass) or over them (in the hall).
 * Characters come from the Studio's shared kit library only. Measurements are
 * fractions of the picture, taken from the image itself. */
import { studioBopArt, STUDIO_MAKERS_ROOT } from '../../../../../../lib/kidThemeManifest';
import type { Vec } from './iceAgeFriendRules';

const MAKERS = STUDIO_MAKERS_ROOT;
export interface KitPicture { src: string; src480: string; width: number; height: number; /** The kit file it was made from (for the art manifest). */ source: string }
const made = (stem: string, width: number, height: number, source: string): KitPicture => ({ src: `${MAKERS}${stem}.webp`, src480: `${MAKERS}${stem}-480.webp`, width, height, source });

/** The hall: `bop/scene-band` with the valley masked out of its five glass openings (transparent there). */
export const HALL_PICTURE = made('ice-age-friend-hall', 1024, 683, 'studio-v2/bop/scene-band.webp');
/** The steppe beyond the glass: the same picture, its valley recoloured to an Ice Age winter (snow, dry grass, cold air). */
export const STEPPE_PICTURE = made('ice-age-friend-steppe', 1024, 683, 'studio-v2/bop/scene-band.webp');
/** The knit cushion the grass rests on: a shipped Bop prop. */
export const CUSHION_PICTURE: KitPicture = { src: studioBopArt('item-cushion'), src480: studioBopArt('item-cushion-480'), width: 252, height: 150, source: 'studio-v2/bop/item-cushion.webp' };

/** The crew who stand in the hall looking up at the giant, seen from behind, in mission wardrobe (this is an
 * expedition): the shared kit library's `kit-*-mission-back` figures. One Bebe, one GobGob, one of each friend
 * for the whole Studio; this activity ships no copy of its own. */
export type FriendId = 'bebe' | 'gobgob' | 'pep' | 'chock' | 'aya';
export const FRIEND_ORDER: readonly FriendId[] = ['bebe', 'gobgob', 'pep', 'chock', 'aya'];
export const FRIENDS: Readonly<Record<FriendId, {
  src: string;
  /** Height against the mammoth's own height (a child, a toddler, two dogs and a small rabbit, a little nearer to us than it is). */
  tall: number;
  /** Width over height of the figure. */
  aspect: number;
  /** Shown only where the floor is wide enough for all five. */
  wideOnly?: boolean;
}>> = {
  bebe: { src: `${MAKERS}kit-bebe-mission-back.webp`, tall: 0.46, aspect: 274 / 768 },
  gobgob: { src: `${MAKERS}kit-gobgob-mission-back.webp`, tall: 0.33, aspect: 329 / 768 },
  pep: { src: `${MAKERS}kit-pep-mission-back.webp`, tall: 0.2, aspect: 322 / 768 },
  chock: { src: `${MAKERS}kit-chock-mission-back.webp`, tall: 0.27, aspect: 352 / 768, wideOnly: true },
  aya: { src: `${MAKERS}kit-aya-mission-back.webp`, tall: 0.17, aspect: 376 / 768, wideOnly: true },
};

export interface HallGeometry {
  /** Each sheet of the glass wall: the steppe (and the snow falling on it) shows only through these. */
  panes: readonly (readonly Vec[])[];
  /** Where the mammoth stands in the hall (its middle, at its feet), and the most of the picture's width it may span. */
  stage: { x: number; y: number; span: number };
  /** Where it stands beyond the glass, and its size there against its size in the hall. */
  beyond: { x: number; y: number; scale: number };
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
  stage: { x: 513 / W, y: 556 / H, span: 0.6 },
  beyond: { x: 548 / W, y: 449 / H, scale: 0.72 },
};
