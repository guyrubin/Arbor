/** The kit pictures the Weather Maker is staged on: the Sky Gardens terrace
 * over Horizon Valley. Every picture is ONE constant here, with its pixel
 * size and the kit file it was cut or derived from (the art manifest's
 * source list). Nothing is generated: the season views are the shipped
 * terrace render (`bop/scene-sun`), re-graded season by season with the same
 * camera, so they cross-fade pixel over pixel. Strings and numbers only: the
 * cover imports this too. */
const BOP = '/visuals/studio-v2/bop/';
const MADE = '/visuals/studio-v2/makers/';
export interface KitPicture {
  readonly src: string; readonly src480: string | null; readonly width: number; readonly height: number;
  /** The kit file this picture is, or was derived from, and what was done to it. */
  readonly source: string; readonly edit: string;
}
const shipped = (stem: string, width: number, height: number, small: boolean): KitPicture => ({ src: `${BOP}${stem}.webp`, src480: small ? `${BOP}${stem}-480.webp` : null, width, height, source: `app/public/visuals/studio-v2/bop/${stem}.webp`, edit: 'as shipped' });
const derived = (stem: string, edit: string): KitPicture => ({ src: `${MADE}${stem}.webp`, src480: `${MADE}${stem}-480.webp`, width: 1024, height: 1024, source: 'app/public/visuals/studio-v2/bop/scene-sun.webp', edit });

/** The terrace view at its moments of the year, in order round the dial.
 * `at` is the point of the year the picture is true for; between two the
 * views cross-fade (seasonDialRules `viewMix`). */
export interface SeasonView { readonly id: string; readonly at: number; readonly picture: KitPicture }
export const SEASON_VIEWS: readonly SeasonView[] = [
  { id: 'view-spring', at: 0.075, picture: derived('season-dial-view-spring', 'foliage freshened; blossom graded onto the near boughs') },
  { id: 'view-rain', at: 0.16, picture: derived('season-dial-view-rain', 'spring grade under a grey sky, mist on the lake, the floor wet and mirroring the parapet') },
  { id: 'view-summer', at: 0.325, picture: shipped('scene-sun', 1024, 1024, true) },
  { id: 'view-autumn', at: 0.575, picture: derived('season-dial-view-autumn', 'foliage graded gold, orange and rust; low warm light and a peach horizon') },
  { id: 'view-winter', at: 0.825, picture: derived('season-dial-view-winter', 'foliage frosted from its own highlights, hills and mountain whitened, the lake frozen, snow on the floor shaded by the floor’s own light') },
  { id: 'view-thaw', at: 0.955, picture: derived('season-dial-view-thaw', 'winter grade melting: bare boughs, snow left along the parapet’s foot, wet floor') },
];

/** What the dial is mounted on: the kit's round pale-wood table with the teal ring, seen from above. */
export const DIAL_PLINTH: KitPicture = shipped('scene-table', 1024, 1024, true);

/** A figure from the Studio's shared kit library (cut once for every maker from the kit boards; never a private copy). */
const library = (stem: string, width: number, height: number, board: string): KitPicture => ({ src: `${MADE}${stem}.webp`, src480: `${MADE}${stem}-480.webp`, width, height, source: `kit/v30/${board}`, edit: 'shared library cut-out' });
/** The crew, dressed for the weather they come out in. These three are the
 * shared library's own files; the two that show a child carry the child's
 * name in their stem, as the likeness register requires. */
export const CREW_PICTURES = {
  /** Aya in spring, her LeafLab on its sling. */
  ayaLeafLab: library('kit-aya-mission-front', 398, 768, '05-aya.png'),
  /** GobGob in the yellow hooded jacket, out in the spring rain. */
  gobgobRain: library('kit-gobgob-mission-front', 325, 768, '02-gobgob-identity-wardrobes.png'),
  /** Bebe in the navy hooded jacket, beside the snow friend. */
  bebeSnow: library('kit-bebe-front', 285, 768, '01-bebe-identity-wardrobes.png'),
} as const;
/** The files of this activity in which a child of the kit is visible (for the likeness register). */
export const SEASON_DIAL_CHILD_FILES: readonly string[] = [CREW_PICTURES.gobgobRain.src, CREW_PICTURES.bebeSnow.src];

/** The companions on the terrace (the kit's own renders, as shipped). */
export const FRIEND_PICTURES = {
  ayaIdle: shipped('aya-idle', 440, 440, false), ayaHappy: shipped('aya-happy', 440, 440, false),
  chockIdle: shipped('chock-idle', 440, 440, false), chockHappy: shipped('chock-happy', 440, 440, false),
  pepIdle: shipped('pep-idle', 440, 440, false), pepHappy: shipped('pep-happy', 440, 440, false),
} as const;
/** Kit props used as they are. */
export const WATERING_CAN = shipped('item-can', 278, 205, false);
export const FELT_FLOWER = shipped('flower-open', 293, 440, false);

/** Every picture this activity shows, for the art manifest. */
export const SEASON_DIAL_ART: readonly KitPicture[] = [...SEASON_VIEWS.map(v => v.picture), DIAL_PLINTH, ...Object.values(FRIEND_PICTURES), ...Object.values(CREW_PICTURES), WATERING_CAN, FELT_FLOWER];
