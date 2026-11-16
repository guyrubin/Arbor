import { studioBopArt } from '../../../../../../lib/kidThemeManifest';

/** Wind-up Racer kit art: every picture the game shows, one constant each.
 *
 * All of it is the kit's own art. Shipped Studio pictures come through the
 * kid art manifest (`studioBopArt`); pictures cut from the kit boards for the
 * makers sit beside them in the `makers` folder. Nothing here is generated.
 * `KIT_SOURCES` lists every cut picture with its pixel size and the kit file
 * it was cut from (for the art manifest). */
const kit = (stem: string) => studioBopArt(stem);
/** A picture in the makers folder (same root as the kit folder). */
const made = (stem: string) => studioBopArt(stem).replace('/bop/', '/makers/');

/* ---------- cut from the kit boards ---------- */

/** Rover, three-quarter side view, nose to the right (board 22, the Rover strip).
 * The shared library's `kit-prop-rover-side` replaces this cut when it lands. */
export const ROVER_ART = made('windup-race-rover');
/** ROVER_ART's pixel size, the point on its bottom edge under the middle of
 * the car, the top of the start button the key stands on, and its two eyes. */
export const ROVER_FRAME = { w: 595, h: 424, footX: 297, footY: 412, buttonX: 300, buttonY: 30, eyes: [[445, 222], [533, 205]] } as const;

/* ---------- the shared kit library (cut once for every maker; never a private copy) ---------- */

/** Pep from the side, everyday collar. He faces left in the picture. */
export const PEP_SIDE_ART = made('kit-pep-side');
/** GobGob, delighted: he pops up to cheer when the last flower opens. A kit
 * render of a real child, used as cut (the file is the library's, named and
 * registered there). Set to null to play without him. */
export const CHEER_ART: string | null = made('kit-gobgob-face-delighted');

export const KIT_SOURCES: readonly { art: string; width: number; height: number; source: string }[] = [
  { art: 'makers/windup-race-rover.webp', width: 595, height: 424, source: 'kit/v30/22-bop-props-T05-T07.png (T07 strip, the rover at the left)' },
];

/* ---------- shipped kit art, used as it is ---------- */

/** The gallery wall: the wall band of the pavilion room, repeated, every other one mirrored. */
export const WALL_ART = kit('scene-delivery');
/** How much of WALL_ART's height is wall (the rest is its own floor, covered by ours). */
export const WALL_SHARE = 0.672;
/** The gallery floor: the kit floor from above, foreshortened to the camera. */
export const FLOOR_ART = kit('scene-floor');
export const PEP_IDLE_ART = kit('pep-idle');
export const PEP_HAPPY_ART = kit('pep-happy');
export const FLOWER_FOLDED_ART = kit('flower-folded');
export const FLOWER_OPEN_ART = kit('flower-open');
export const BLOOM_ART = kit('rover-bloom-open');
export const BALL_ART = kit('rover-bloom-folded');
export const CUSHION_ART = kit('item-cushion');
export const SIGN_ART = kit('rover-sign');
export const RUG_ART = kit('rest-rug');
export const CAN_ART = kit('item-can');
export const LAMP_ART = kit('item-lamp');
export const PETAL_ARTS = ['petal-coral', 'petal-amber', 'petal-teal', 'petal-violet', 'petal-blue'].map(kit);
export const PAD_ARTS = ['pad-teal', 'pad-amber', 'pad-cream', 'pad-blue', 'pad-navy', 'pad-white'].map(kit);
export const TILE_ARTS = ['tile-blue', 'tile-pink', 'tile-yellow'].map(kit);

/** Shared library pictures this game shows (cut by the librarian, listed in the kit library). */
export const LIBRARY_ART: readonly string[] = ['makers/kit-pep-side.webp', 'makers/kit-gobgob-face-delighted.webp'];

/** Every picture a play can show, for a warm cache before the first run. */
export const KIT_ART: readonly string[] = [ROVER_ART, PEP_SIDE_ART, ...(CHEER_ART ? [CHEER_ART] : []), WALL_ART, FLOOR_ART, PEP_IDLE_ART, PEP_HAPPY_ART, FLOWER_FOLDED_ART, FLOWER_OPEN_ART, BLOOM_ART, BALL_ART, CUSHION_ART, SIGN_ART, RUG_ART, CAN_ART, LAMP_ART, ...PETAL_ARTS, ...PAD_ARTS, ...TILE_ARTS];
