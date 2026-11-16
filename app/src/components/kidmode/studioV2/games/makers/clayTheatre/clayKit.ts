/** Clay Theatre's kit pictures: every raster image the activity shows, in one
 * place. The room is the shipped Mirror Quarter rotunda; the audience and the
 * two posters are cut from the v30 kit boards with `kitcut.py` (no picture is
 * drawn or generated here). `from` names the kit source each was cut from. */
import { studioBopArt, STUDIO_MAKERS_ROOT } from '../../../../../../lib/kidThemeManifest';

const MAKERS_ROOT = STUDIO_MAKERS_ROOT;
export interface KitPicture { src: string; src480: string; width: number; height: number; from: string }
const cut = (stem: string, width: number, height: number, from: string): KitPicture => ({ src: `${MAKERS_ROOT}${stem}.webp`, src480: `${MAKERS_ROOT}${stem}-480.webp`, width, height, from });
const shipped = (stem: string, width: number, height: number): KitPicture => ({ src: studioBopArt(stem), src480: studioBopArt(`${stem}-480`), width, height, from: `studio-v2/bop/${stem}.webp` });

/** The glass rotunda of the Mirror Quarter, its round stage empty. */
export const KIT_ROOM = shipped('scene-band', 1024, 683);
/** A character from the shared kit library (one Bebe, one GobGob, one Aya for the whole Studio). */
const kit = (stem: string, width: number, height: number, from: string): KitPicture => cut(stem, width, height, from);
/** The audience, seen from behind, watching the little stage: the shared
 * library's back views. `show` is how much of the figure, from the top, rises
 * above the front edge of the picture (head and shoulders, like a row of
 * seats seen from behind). */
export const KIT_AUDIENCE = {
  bebe: { ...kit('kit-bebe-back', 273, 768, 'kit/v30/01-bebe-identity-wardrobes.png (everyday, back)'), show: 0.5 },
  gobgob: { ...kit('kit-gobgob-back', 306, 768, 'kit/v30/02-gobgob-identity-wardrobes.png (everyday, back)'), show: 0.55 },
  chock: { ...kit('kit-chock-back', 344, 768, 'kit/v30/03-chock.png (everyday, back)'), show: 0.4 },
  aya: { ...kit('kit-aya-back', 368, 768, 'kit/v30/05-aya.png (everyday, back)'), show: 0.7 },
  pep: { ...kit('kit-pep-back', 322, 768, 'kit/v30/04-pep.png (everyday, back)'), show: 0.36 },
} as const;
export type AudienceId = keyof typeof KIT_AUDIENCE;
/** Left to right along the front of the stage. */
export const AUDIENCE_ROW: readonly AudienceId[] = ['bebe', 'gobgob', 'chock', 'aya', 'pep'];
/** The two playbills hung beside the stage: the channel key art, whole. */
export const KIT_POSTERS = [
  cut('clay-theatre-crew-poster-bop', 640, 427, 'kit/v30/17-bop-key-art.png'),
  cut('clay-theatre-crew-poster-crew', 640, 427, 'kit/v30/16-wonder-crew-key-art.png'),
] as const;
/** The felt pads the four film reels (and the clay) are kept on. */
export const KIT_PADS = { rocket: 'pad-navy', jump: 'pad-blue', ayaSeed: 'pad-amber', frog: 'pad-teal', clay: 'pad-cream' } as const;
/** Bebe's ProofLens, the camera puck that records an actual view: it filmed these reels. */
export const KIT_PROOFLENS = cut('clay-theatre-prooflens', 296, 206, 'kit/v30/09-observe-kit.png (ProofLens, hero shot)');
export const kitPad = (stem: string) => studioBopArt(stem);
/** Every picture, for the art manifest. */
export const KIT_SOURCES: readonly KitPicture[] = [KIT_ROOM, ...Object.values(KIT_AUDIENCE), ...KIT_POSTERS, KIT_PROOFLENS];
