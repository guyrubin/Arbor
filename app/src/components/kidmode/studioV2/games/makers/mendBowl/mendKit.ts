/** The kit pictures Mend the Bowl stands on (Horizon Valley, register v30):
 * every picture is ONE constant here, with its pixel size and the file it was
 * taken from. The workshop floor, the table and the things on it are shipped kit art;
 * the glaze and gold dishes are the kit's own ceramic dish with only its felt
 * centre re-tinted; the roller is the kit's ClearPatch tool, cut from its
 * board. Nothing here is drawn or generated for this game.
 * (The bowl itself has no kit picture seen from above: it is rendered in code
 * as glazed ceramic, lit from the upper left like the table. See bowlRender.ts.
 * Chock and Bebe host from the HUD: the shared kit heads, never a figure
 * standing on a table that is seen from above.) */
import { studioBopArt, STUDIO_MAKERS_ROOT } from '../../../../../../lib/kidThemeManifest';
import type { BowlGlaze } from './mendBowlRules';

export interface KitPicture { src: string; w: number; h: number; from: string }
const MAKERS = STUDIO_MAKERS_ROOT;
const shipped = (stem: string, w: number, h: number): KitPicture => ({ src: studioBopArt(stem), w, h, from: `studio-v2/bop/${stem}.webp (shipped)` });
const dish = (stem: string): KitPicture => ({ src: `${MAKERS}${stem}.webp`, w: 219, h: 219, from: 'studio-v2/bop/oops-hub.webp (shipped; kit board v30/23, T09), felt centre re-tinted' });

/** The Wonderworks workshop table, seen from directly above: the shipped kit table with its own floor carried on below it, so a tall stage has floor in front of the table. */
export const KIT_TABLE = { src: `${MAKERS}mend-bowl-table.webp`, small: `${MAKERS}mend-bowl-table-480.webp`, w: 1024, h: 1324, from: 'studio-v2/bop/scene-table.webp (shipped), floor extended 300 px downward from its own last rows', centre: { x: 511.5, y: 513 }, linen: 385.5 } as const;
/** The same table cut out on its wooden edge (transparent outside), so it can stand on the kit's floor at any screen shape. `linen` and `wood` are radii in the picture's pixels; `linenUnits` is the linen's radius in stage units (LINEN_R). */
export const KIT_TABLETOP = { src: `${MAKERS}mend-bowl-tabletop.webp`, small: `${MAKERS}mend-bowl-tabletop-480.webp`, w: 931, h: 931, from: 'studio-v2/bop/scene-table.webp (shipped): the round table cut out along its wooden edge', centre: { x: 465.5, y: 465 }, linen: 385.5, wood: 461, linenUnits: 205 } as const;
/** The workshop floor from above, with the window's light and a fern's shadow on it (shipped). */
export const KIT_FLOOR: KitPicture = shipped('scene-floor', 1024, 1024);
/** One small ceramic dish of glaze per colour, and the dish of gold. */
export const KIT_GLAZE: Record<BowlGlaze, KitPicture> = {
  celadon: dish('mend-bowl-glaze-celadon'), indigo: dish('mend-bowl-glaze-indigo'), rose: dish('mend-bowl-glaze-rose'), cream: dish('mend-bowl-glaze-cream'),
};
export const KIT_GOLD: KitPicture = dish('mend-bowl-gold');
/** The ClearPatch hand roller (the kit's repair tool: its mend always leaves a seam that shows). */
export const KIT_ROLLER: KitPicture = { src: `${MAKERS}mend-bowl-clearpatch-roller.webp`, w: 428, h: 239, from: '/home/user/kit/v30/10-act-kit.png (CLEARPATCH row, BLOCKED panel: the free roller), traced cut-out' };
/** Where the roller's drum touches down, as a share of the picture (it follows the finger by this point). */
export const ROLLER_CONTACT = { x: 0.2, y: 0.72 } as const;
/** Things that live on the workshop table: all shipped kit props, seen from above. */
export const KIT_LAMP = { unlit: shipped('sun-unlit', 520, 520), lit: shipped('sun-lit', 520, 520) } as const;
export const KIT_FERN: KitPicture = shipped('rover-planter', 320, 278);
export const KIT_BLOOM = { folded: shipped('rover-bloom-folded', 125, 122), open: shipped('rover-bloom-open', 280, 254) } as const;
/** Every picture this activity shows, for the art manifest. */
export const MEND_BOWL_ART: readonly KitPicture[] = [KIT_TABLE, KIT_TABLETOP, KIT_FLOOR, ...Object.values(KIT_GLAZE), KIT_GOLD, KIT_ROLLER, KIT_LAMP.unlit, KIT_LAMP.lit, KIT_FERN, KIT_BLOOM.folded, KIT_BLOOM.open];
