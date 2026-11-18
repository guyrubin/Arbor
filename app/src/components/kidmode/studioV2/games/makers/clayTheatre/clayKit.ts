/** Clay Theatre's kit pictures: every raster image the activity shows, in one
 * place, each with the kit source it was cut from (no picture is drawn or
 * generated here). The clay itself is painted on a canvas (clayPaint). */
import { studioBopArt, STUDIO_MAKERS_ROOT } from '../../../../../../lib/kidThemeManifest';
import type { CrewId, GelId, TuneId } from './clayTheatreRules';

export interface KitPicture { src: string; src480: string; width: number; height: number; from: string }
const cut = (stem: string, width: number, height: number, from: string): KitPicture => ({ src: `${STUDIO_MAKERS_ROOT}${stem}.webp`, src480: `${STUDIO_MAKERS_ROOT}${stem}-480.webp`, width, height, from });
const shipped = (stem: string, width: number, height: number): KitPicture => ({ src: studioBopArt(stem), src480: studioBopArt(`${stem}-480`), width, height, from: `studio-v2/bop/${stem}.webp` });

/** The Mirror Quarter's glass rotunda with its round stage: the shipped room, its floor carried on downward so a tall phone is all room. */
export const KIT_ROOM = cut('clay-theatre-rotunda', 1024, 983, 'studio-v2/bop/scene-band.webp (floor extended from its own bottom rows)');
/** Bebe's ProofLens on its tripod, screen toward us: the animator's camera. */
export const KIT_LENS = cut('clay-theatre-prooflens-tripod', 520, 611, 'kit/v30/09-observe-kit.png (ProofLens, IN USE panel)');
/** Where the ProofLens's own screen sits in that picture (fractions), so the live view can be laid on it. */
export const LENS_SCREEN = { left: 0.238, top: 0.166, width: 0.575, height: 0.402 } as const;
/** The knit rug the lumps of clay lie on. */
export const KIT_RUG = shipped('rest-rug', 420, 193);
/** The stage lamp and its three colour gels. */
export const KIT_LAMP = cut('kit-prop-lamp', 452, 586, 'kit/v30/21-bop-props-T01-T04.png (Shadow Hello lamp)');
export const KIT_GELS = cut('kit-prop-colour-discs', 640, 327, 'kit/v30/21-bop-props-T01-T04.png (colour discs on the light base)');
/** Where each disc stands in the gels picture (fraction across), left to right as the kit shows them. */
export const GEL_SPOTS: Readonly<Record<Exclude<GelId, 'clearGel'>, number>> = { roseGel: 0.2, blueGel: 0.5, goldGel: 0.8 };
/** The three music tiles: each is one tune. */
export const KIT_TILES: Readonly<Record<TuneId, KitPicture>> = { tuneA: shipped('tile-yellow', 248, 162), tuneB: shipped('tile-blue', 245, 162), tuneC: shipped('tile-pink', 252, 165) };

/** The crew at the premiere, from the shared kit library (one Bebe, one GobGob, one Aya for the whole Studio):
 * each seen from behind while the film runs, from the side when they turn to
 * each other, and from the front when they turn round to clap. `faces` is the
 * way the stored side view looks; `tall` is the figure's height beside Bebe's. */
export interface CrewArt { back: KitPicture; side: KitPicture; front: KitPicture; faces: 1 | -1; tall: number }
const turn = (who: string, board: string, sizes: readonly [number, number, number, number, number, number]): Pick<CrewArt, 'back' | 'side' | 'front'> => ({
  back: cut(`kit-${who}-back`, sizes[0], sizes[1], `${board} (everyday, back)`), side: cut(`kit-${who}-side`, sizes[2], sizes[3], `${board} (everyday, side)`), front: cut(`kit-${who}-front`, sizes[4], sizes[5], `${board} (everyday, front)`),
});
export const KIT_CREW: Readonly<Record<CrewId, CrewArt>> = {
  bebe: { ...turn('bebe', 'kit/v30/01-bebe-identity-wardrobes.png', [273, 768, 195, 768, 285, 768]), faces: 1, tall: 1 },
  gobgob: { ...turn('gobgob', 'kit/v30/02-gobgob-identity-wardrobes.png', [306, 768, 265, 768, 334, 768]), faces: 1, tall: 0.7 },
  chock: { ...turn('chock', 'kit/v30/03-chock.png', [344, 768, 768, 598, 349, 768]), faces: -1, tall: 0.62 },
  aya: { ...turn('aya', 'kit/v30/05-aya.png', [368, 768, 373, 768, 408, 768]), faces: 1, tall: 0.5 },
  pep: { ...turn('pep', 'kit/v30/04-pep.png', [322, 768, 733, 768, 326, 768]), faces: -1, tall: 0.5 },
};
/** Every picture, for the art manifest. */
export const KIT_SOURCES: readonly KitPicture[] = [KIT_ROOM, KIT_LENS, KIT_RUG, KIT_LAMP, KIT_GELS, ...Object.values(KIT_TILES), ...Object.values(KIT_CREW).flatMap(c => [c.back, c.side, c.front])];
