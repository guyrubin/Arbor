/** Every picture The Paper Boat shows, in one place: its path, its pixel size
 * and the kit file it was cut from. The pop-up book is printed with kit
 * pictures: each spread is one kit environment cut into standing slices (far
 * to near, each from a hand-drawn top edge down to its hinge). The hinge rows
 * are chosen so that, seen from the reader's side, the slices line up into the
 * whole picture again: the depth is real, the picture is intact. The water the
 * boat sails on, the boat, the lanterns and the wheel are drawn (crisp at any
 * size); the stones and the meadow edge are cut from the kit.
 * Characters come from the Studio's shared kit library (`kit-*`), never from
 * a private copy: none of this activity's own files shows Bebe or GobGob.
 * Strings and numbers only. */
import { STUDIO_BOP_ROOT, STUDIO_MAKERS_ROOT } from '../../../../../../lib/kidThemeManifest';
export interface KitArt { src: string; w: number; h: number; from: string }
const MAKERS = STUDIO_MAKERS_ROOT, BOP = STUDIO_BOP_ROOT;
const own = (stem: string, w: number, h: number, from: string): KitArt => ({ src: `${MAKERS}paper-boat-${stem}.webp`, w, h, from });
const bop = (stem: string, w: number, h: number): KitArt => ({ src: `${BOP}${stem}.webp`, w, h, from: `studio-v2/bop/${stem}.webp` });

const BRIGHT_VALE = 'kit/v30/env-bright-vale.png', GLASS_GROVE = 'kit/v30/env-glass-grove-skybridge-sunset.png', WONDERWORKS = 'kit/v30/env-wonderworks-hub-vista.png';
const KEY_ART = 'kit/v30/17-bop-key-art.png';

/** A standing slice: its art (drawn across both pages, 2 px to the book px),
 * the page depth of its hinge, and its height off the page (book px). */
export interface KitSlice { id: string; art: KitArt; y: number; h: number }
const slice = (id: string, art: KitArt, y: number): KitSlice => ({ id, art, y, h: art.h / 2 });

export const KIT_ROOM = own('reading-room', 930, 680, 'studio-v2/v30/portal-stories.webp');
export const KIT_TABLE = bop('scene-table', 1024, 1024);
/** The standing slices of each spread, far to near. */
export const KIT_SLICES: readonly (readonly KitSlice[])[] = [
  [slice('sky', own('s1-sky', 1000, 358, BRIGHT_VALE), 30), slice('hills', own('s1-hills', 1000, 362, BRIGHT_VALE), 58), slice('village', own('s1-village', 1000, 272, BRIGHT_VALE), 92), slice('bridge', own('s1-bridge', 1000, 141, BRIGHT_VALE), 126)],
  [slice('sky', own('s2-sky', 1000, 277, GLASS_GROVE), 22), slice('valley', own('s2-valley', 1000, 321, GLASS_GROVE), 44), slice('skybridge', own('s2-skybridge', 1000, 377, GLASS_GROVE), 72)],
  [slice('sky', own('s3-sky', 1000, 289, WONDERWORKS), 26), slice('hills', own('s3-hills', 1000, 387, WONDERWORKS), 58), slice('shore', own('s3-shore', 1000, 226, WONDERWORKS), 98)],
  [slice('sky', own('s4-sky', 1000, 245, WONDERWORKS), 26), slice('hub', own('s4-hub', 1000, 318, WONDERWORKS), 62), slice('quay', own('s4-quay', 1000, 122, WONDERWORKS), 100)],
];
export const KIT_CLOUDS: readonly KitArt[] = [own('cloud-a', 288, 232, KEY_ART), own('cloud-b', 268, 168, KEY_ART)];
/** The river stones (two boulders from the Wonderworks garden) and the
 * meadow that edges the near bank (its wildflowers, cut like scissor-cut grass). */
export const KIT_ROCKS: readonly KitArt[] = [own('rock-a', 452, 168, WONDERWORKS), own('rock-b', 346, 134, WONDERWORKS)];
export const KIT_MEADOW = own('meadow', 1000, 66, WONDERWORKS);
export const KIT_SCOUT_VIEW = own('scout-view', 320, 320, GLASS_GROVE);
export const KIT_COVER = own('cover', 800, 600, BRIGHT_VALE);

/** Shipped kit props. */
export const KIT_PROPS = {
  lamp: bop('item-lamp', 245, 300),
  bloomOpen: bop('rover-bloom-open', 280, 254),
  bloomFolded: bop('rover-bloom-folded', 125, 122),
  lights: [bop('petal-amber', 180, 300), bop('petal-coral', 179, 300), bop('petal-teal', 181, 300), bop('petal-blue', 181, 300), bop('petal-violet', 181, 300)],
} as const;

/** The crew, as stand-up figures, from the Studio's shared kit library (one
 * Bebe, one GobGob, one Aya for every activity). Mission wardrobe throughout:
 * the journey is a crew outing and each carries their own tool. `faces` is
 * the way the side view looks as stored. */
export type CrewId = 'aya' | 'chock' | 'pep' | 'bebe' | 'gobgob';
export interface CrewArt { front: KitArt; side: KitArt; faces: 'left' | 'right' }
const lib = (stem: string, w: number, h: number, from: string): KitArt => ({ src: `${MAKERS}kit-${stem}.webp`, w, h, from });
export const KIT_CREW: Readonly<Record<CrewId, CrewArt>> = {
  aya: { front: lib('aya-mission-front', 398, 768, 'kit/v30/05-aya.png'), side: lib('aya-mission-side', 374, 768, 'kit/v30/05-aya.png'), faces: 'right' },
  chock: { front: lib('chock-mission-front', 354, 768, 'kit/v30/03-chock.png'), side: lib('chock-mission-side', 768, 601, 'kit/v30/03-chock.png'), faces: 'left' },
  pep: { front: lib('pep-mission-front', 325, 768, 'kit/v30/04-pep.png'), side: lib('pep-mission-side', 730, 768, 'kit/v30/04-pep.png'), faces: 'left' },
  bebe: { front: lib('bebe-mission-front', 281, 768, 'kit/v30/01-bebe-identity-wardrobes.png'), side: lib('bebe-mission-side', 193, 768, 'kit/v30/01-bebe-identity-wardrobes.png'), faces: 'right' },
  gobgob: { front: lib('gobgob-mission-front', 325, 768, 'kit/v30/02-gobgob-identity-wardrobes.png'), side: lib('gobgob-mission-side', 258, 768, 'kit/v30/02-gobgob-identity-wardrobes.png'), faces: 'right' },
};

/** Everything a spread shows, to fetch before its page turns. */
export function spreadArt(spread: number): string[] {
  const list = (KIT_SLICES[spread] ?? []).map(item => item.art.src);
  if (spread === 0) list.push(KIT_ROCKS[0].src, KIT_ROCKS[1].src, KIT_MEADOW.src, KIT_CREW.aya.side.src);
  if (spread === 1) list.push(KIT_CREW.pep.side.src, KIT_CREW.bebe.side.src, KIT_SCOUT_VIEW.src);
  if (spread === 2) list.push(...KIT_CLOUDS.map(item => item.src), KIT_CREW.chock.front.src, KIT_CREW.gobgob.front.src);
  if (spread === 3) list.push(...Object.values(KIT_CREW).map(item => item.front.src));
  return list;
}
