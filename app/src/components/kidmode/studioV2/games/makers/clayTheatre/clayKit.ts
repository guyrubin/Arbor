/** Clay Theatre's kit pictures: every raster image the activity shows, in one
 * place. The room is the shipped Mirror Quarter rotunda; the audience and the
 * two posters are cut from the v30 kit boards with `kitcut.py` (no picture is
 * drawn or generated here). `from` names the kit source each was cut from. */
import { studioBopArt } from '../../../../../../lib/kidThemeManifest';

const MAKERS_ROOT = '/visuals/studio-v2/makers/';
export interface KitPicture { src: string; src480: string; width: number; height: number; from: string }
const cut = (stem: string, width: number, height: number, from: string): KitPicture => ({ src: `${MAKERS_ROOT}${stem}.webp`, src480: `${MAKERS_ROOT}${stem}-480.webp`, width, height, from });
const shipped = (stem: string, width: number, height: number): KitPicture => ({ src: studioBopArt(stem), src480: studioBopArt(`${stem}-480`), width, height, from: `app/public/visuals/studio-v2/bop/${stem}.webp` });

/** The glass rotunda of the Mirror Quarter, its round stage empty. */
export const KIT_ROOM = shipped('scene-band', 1024, 683);
/** The audience, seen from behind, watching the little stage. Kit renders only, cut at the waist. */
export const KIT_AUDIENCE = {
  gobgob: cut('clay-theatre-gobgob-back', 180, 261, 'kit/v30/02-gobgob-identity-wardrobes.png (everyday, back)'),
  bebe: cut('clay-theatre-bebe-back', 161, 254, 'kit/v30/01-bebe-identity-wardrobes.png (everyday, back)'),
  aya: cut('clay-theatre-aya-back', 219, 334, 'kit/v30/05-aya.png (everyday, back)'),
  chock: cut('clay-theatre-chock-back', 154, 160, 'kit/v30/03-chock.png (everyday, back)'),
  pep: cut('clay-theatre-pep-back', 155, 166, 'kit/v30/04-pep.png (everyday, back)'),
} as const;
export type AudienceId = keyof typeof KIT_AUDIENCE;
/** Left to right along the front of the stage. */
export const AUDIENCE_ROW: readonly AudienceId[] = ['gobgob', 'bebe', 'aya', 'chock', 'pep'];
/** The two playbills hung beside the stage: the channel key art, whole. */
export const KIT_POSTERS = [
  cut('clay-theatre-poster-bop', 640, 427, 'kit/v30/17-bop-key-art.png'),
  cut('clay-theatre-poster-crew', 640, 427, 'kit/v30/16-wonder-crew-key-art.png'),
] as const;
/** The felt pads the four film reels (and the clay) are kept on. */
export const KIT_PADS = { rocket: 'pad-navy', jump: 'pad-blue', ayaSeed: 'pad-amber', frog: 'pad-teal', clay: 'pad-cream' } as const;
export const KIT_LAMP = shipped('item-lamp', 245, 300);
export const kitPad = (stem: string) => studioBopArt(stem);
/** Every picture, for the art manifest. */
export const KIT_SOURCES: readonly KitPicture[] = [KIT_ROOM, ...Object.values(KIT_AUDIENCE), ...KIT_POSTERS, KIT_LAMP];
