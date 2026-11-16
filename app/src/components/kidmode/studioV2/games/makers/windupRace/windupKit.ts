import { STUDIO_V30_ROOT, studioBopArt, studioMakerArt } from '../../../../../../lib/kidThemeManifest';

/** Wind-up Racer kit art: every picture the game shows, one constant each.
 *
 * All of it is the kit's own art. Shipped Studio pictures come through the
 * kid art manifest; pictures cut from the kit boards for this game sit in the
 * makers folder as `windup-race-*`. Nothing here is generated. `KIT_SOURCES`
 * lists every cut picture with its pixel size and the kit file it was cut
 * from (for the art manifest). No picture here shows a child. */

/** A picture and how it stands in the world: `w` × `h` are its pixels, `foot`
 * the pixel that touches the floor (or the middle, for a thing lying flat),
 * and `tall` (or `wide`) its size in world units (one unit is Rover's length). */
export interface KitSprite { src: string; w: number; h: number; footX: number; footY: number; wide: number }
const sprite = (src: string, w: number, h: number, footX: number, footY: number, wide: number): KitSprite => ({ src, w, h, footX, footY, wide });

/* ---------- cut from the kit boards for this game ---------- */

/** Rover, three-quarter view from the front, nose to the right (board 22, the
 * Rover Delivery strip), re-cut at four times the board's size. `button` is
 * the top of its start button, where the wind-up key stands; `eyes` its two
 * lamps; `wheels` where the two near wheels touch the floor. */
export const ROVER_FRONT = sprite(studioMakerArt('windup-race-rover-front'), 640, 458, 310, 432, 1.27);
/** The same render seen as Rover's back: the visor is painted over with the
 * shell's own cream and the play mark is taken off the button, nothing else.
 * It lets a chase camera follow Rover from behind. Stored like the front (the
 * tail to the right); the world flips it. */
export const ROVER_REAR = sprite(studioMakerArt('windup-race-rover-rear'), 640, 458, 310, 432, 1.27);
export const ROVER_MARKS = { buttonX: 324, buttonY: 60, eyes: [[484, 242, 30], [579, 221, 20]], wheels: [[59, 409], [252, 446]] } as const;

export const KIT_SOURCES: readonly { art: string; width: number; height: number; source: string }[] = [
  { art: 'makers/windup-race-rover-front.webp', width: 640, height: 458, source: 'kit/v30/22-bop-props-T05-T07.png (T07 strip, the rover at the left; cut out, callout dot retouched off the button)' },
  { art: 'makers/windup-race-rover-rear.webp', width: 640, height: 458, source: 'kit/v30/22-bop-props-T05-T07.png (the same cut; visor and play mark painted over with the surrounding shell)' },
];

/* ---------- the shared kit library (cut once for every maker; never a private copy) ---------- */

/** Pep from the side, everyday collar. He faces left in the picture. */
export const PEP_SIDE = sprite(studioMakerArt('kit-pep-side'), 733, 768, 380, 760, 2.5);
export const PLANTERS: readonly KitSprite[] = [
  sprite(studioMakerArt('kit-prop-planter-bud'), 258, 400, 129, 392, 1.25),
  sprite(studioMakerArt('kit-prop-planter-budding'), 262, 400, 131, 392, 1.25),
  sprite(studioMakerArt('kit-prop-planter-bloom'), 282, 426, 141, 418, 1.35),
];
/** Shared library pictures this game shows (cut by the librarian, listed in the kit library). */
export const LIBRARY_ART: readonly string[] = ['makers/kit-pep-side.webp', 'makers/kit-prop-planter-bud.webp', 'makers/kit-prop-planter-budding.webp', 'makers/kit-prop-planter-bloom.webp', 'makers/kit-pep-playful.webp'];

/* ---------- shipped kit art, used as it is ---------- */

/** Horizon Valley, far away: the sky, the mountain and the glass domes behind everything. */
export const VALLEY = { src: `${STUDIO_V30_ROOT}valley-wide.webp`, w: 1536, h: 1024, horizon: 0.508 } as const;
/** The pavilion room, for the cover. */
export const ROOM_ART = studioBopArt('scene-delivery');
export const PEP_SIT = sprite(studioBopArt('pep-idle'), 440, 440, 215, 428, 2.2);
export const PEP_BOW = sprite(studioBopArt('pep-happy'), 440, 440, 220, 420, 2.5);
export const FLOWER_FOLDED = sprite(studioBopArt('flower-folded'), 293, 440, 146, 428, 1.25);
export const FLOWER_OPEN = sprite(studioBopArt('flower-open'), 293, 440, 146, 428, 1.25);
export const CUSHION = sprite(studioBopArt('item-cushion'), 252, 150, 126, 132, 2.5);
/** Seen from straight above: these lie flat on the floor, drawn through the camera. */
export const RUG_TOP = sprite(studioBopArt('rover-rug'), 260, 259, 130, 130, 3.4);
export const SIGN_TOP = sprite(studioBopArt('rover-sign'), 223, 223, 111, 111, 1.7);
export const PETALS: readonly KitSprite[] = ['petal-coral', 'petal-amber', 'petal-teal', 'petal-violet', 'petal-blue'].map(stem => sprite(studioBopArt(stem), 180, 300, 90, 150, 0.22));

/** Every picture a play can show, for a warm cache before the first run. */
export const KIT_ART: readonly KitSprite[] = [ROVER_FRONT, ROVER_REAR, PEP_SIDE, PEP_SIT, PEP_BOW, FLOWER_FOLDED, FLOWER_OPEN, CUSHION, RUG_TOP, SIGN_TOP, ...PLANTERS, ...PETALS];
