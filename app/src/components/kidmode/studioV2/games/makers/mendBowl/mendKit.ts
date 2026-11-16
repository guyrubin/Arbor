/** The kit pictures Mend the Bowl stands on (Horizon Valley, register v30):
 * every picture is ONE constant here, with its pixel size and the file it was
 * taken from. The workshop table and the things on it are shipped kit art;
 * the glaze and gold dishes are the kit's own ceramic dish with only its felt
 * centre re-tinted. Nothing here is drawn or generated for this game.
 * (The bowl itself has no kit picture seen from above: it is shaded in code,
 * lit from the upper left like the table. See BowlArt.tsx.) */
import { studioBopArt } from '../../../../../../lib/kidThemeManifest';
import type { BowlGlaze } from './mendBowlRules';

export interface KitPicture { src: string; w: number; h: number; from: string }
const MAKERS = '/visuals/studio-v2/makers/';
const shipped = (stem: string, w: number, h: number): KitPicture => ({ src: studioBopArt(stem), w, h, from: `app/public/visuals/studio-v2/bop/${stem}.webp (shipped)` });
const dish = (stem: string): KitPicture => ({ src: `${MAKERS}${stem}.webp`, w: 219, h: 219, from: 'app/public/visuals/studio-v2/bop/oops-hub.webp (shipped; kit board v30/23, T09), felt centre re-tinted' });

/** The Wonderworks workshop table, seen from directly above. */
export const KIT_TABLE = { ...shipped('scene-table', 1024, 1024), small: studioBopArt('scene-table-480'), centre: { x: 511.5, y: 513 }, linen: 385.5 } as const;
/** One small ceramic dish of glaze per colour, and the dish of gold. */
export const KIT_GLAZE: Record<BowlGlaze, KitPicture> = {
  celadon: dish('mend-bowl-glaze-celadon'), indigo: dish('mend-bowl-glaze-indigo'), rose: dish('mend-bowl-glaze-rose'), cream: dish('mend-bowl-glaze-cream'),
};
export const KIT_GOLD: KitPicture = dish('mend-bowl-gold');
/** Things that live on the workshop table: all shipped kit props, seen from above. */
export const KIT_LAMP = { unlit: shipped('sun-unlit', 520, 520), lit: shipped('sun-lit', 520, 520) } as const;
export const KIT_FERN: KitPicture = shipped('rover-planter', 320, 278);
export const KIT_BLOOM = { folded: shipped('rover-bloom-folded', 125, 122), open: shipped('rover-bloom-open', 280, 254) } as const;
/** Chock, for the cover (in play he is a `BopFriend`). */
export const KIT_CHOCK: KitPicture = shipped('chock-idle', 440, 440);

/** Every picture this activity shows, for the art manifest. */
export const MEND_BOWL_ART: readonly KitPicture[] = [KIT_TABLE, ...Object.values(KIT_GLAZE), KIT_GOLD, KIT_LAMP.unlit, KIT_LAMP.lit, KIT_FERN, KIT_BLOOM.folded, KIT_BLOOM.open, KIT_CHOCK, shipped('chock-happy', 440, 440)];
