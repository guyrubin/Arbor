import { studioBopArt } from '../../../../../../lib/kidThemeManifest';

/** Wind-up Racer kit art: every picture the game shows, one constant each.
 *
 * Shipped kit pictures come through the kid art manifest (`studioBopArt`).
 * Pictures requested for this activity (scratchpad art-requests, stems
 * `windup-race-*`) land beside the kit folder, in `studio-v2/makers/`; until
 * one is delivered its constant points at the closest shipped kit picture (a
 * STAND-IN, marked below) or is null where the thing is drawn with glass,
 * brass, wood or knit shading instead. Swapping a delivery in is one line
 * here, plus the layout numbers beside it where the new picture is framed
 * differently. */
const kit = (stem: string) => studioBopArt(stem);
/** A delivered activity picture (same root as the kit, folder `makers`). */
export const made = (stem: string) => studioBopArt(stem).replace('/bop/', '/makers/');

/* ---------- requested, standing in ---------- */

/** Rover. STAND-IN for `windup-race-rover` (side-on from a little above, nose
 * right): the shipped top view, turned nose-right and foreshortened. */
export const ROVER_ART = kit('rover-car');
/** True while ROVER_ART is the top view (it is laid flat and given a drawn side). */
export const ROVER_IS_TOP_VIEW = true;
/** The gallery wall. STAND-IN for the top of `windup-race-gallery`: the wall
 * band of the shipped pavilion room, repeated, every other one mirrored. */
export const WALL_ART = kit('scene-delivery');
/** How much of WALL_ART's height is wall (the rest is its own floor, hidden). */
export const WALL_SHARE = 0.665;
/** The gallery floor. STAND-IN for the bottom of `windup-race-gallery`: the
 * shipped floor from above, foreshortened to the camera. */
export const FLOOR_ART = kit('scene-floor');
/** Pep running. STAND-IN for `windup-race-pep-run`: the play-bow, mirrored. */
export const PEP_RUN_ART = kit('pep-happy');
/** The knit ball. STAND-IN for `windup-race-ball`: the folded knit bloom. */
export const BALL_ART = kit('rover-bloom-folded');
/** Drawn until delivered: `windup-race-tunnel`, `-key`, `-wood`, `-knit`, `-cover`. */
export const TUNNEL_ART: string | null = null;
export const KEY_ART: string | null = null;
export const WOOD_ART: string | null = null;
export const KNIT_ART: string | null = null;
export const COVER_ART: string | null = null;

/* ---------- shipped kit art, used as it is ---------- */

export const PEP_IDLE_ART = kit('pep-idle');
export const PEP_HAPPY_ART = kit('pep-happy');
export const FLOWER_FOLDED_ART = kit('flower-folded');
export const FLOWER_OPEN_ART = kit('flower-open');
export const BLOOM_ART = kit('rover-bloom-open');
export const CUSHION_ART = kit('item-cushion');
export const START_PAD_ART = kit('rover-sign');
export const RUG_ART = kit('rest-rug');
export const CAN_ART = kit('item-can');
export const LAMP_ART = kit('item-lamp');
export const PETAL_ARTS = ['petal-coral', 'petal-amber', 'petal-teal', 'petal-violet', 'petal-blue'].map(kit);
export const PAD_ARTS = ['pad-teal', 'pad-amber', 'pad-cream', 'pad-blue', 'pad-navy', 'pad-white'].map(kit);
export const TILE_ARTS = ['tile-blue', 'tile-pink', 'tile-yellow'].map(kit);

/** Every picture a play can show, for a warm cache before the first run. */
export const KIT_ART: readonly string[] = [ROVER_ART, WALL_ART, FLOOR_ART, PEP_IDLE_ART, PEP_HAPPY_ART, PEP_RUN_ART, BALL_ART, FLOWER_FOLDED_ART, FLOWER_OPEN_ART, BLOOM_ART, CUSHION_ART, START_PAD_ART, RUG_ART, CAN_ART, LAMP_ART, ...PETAL_ARTS, ...PAD_ARTS, ...TILE_ARTS];
