/** The kit pictures the Weather Maker is staged on: the Sky Gardens terrace
 * over Horizon Valley. Every picture is ONE constant here, with its pixel
 * size and the kit file it was cut or derived from (the art manifest's
 * source list). Nothing is generated: the season views are the shipped
 * terrace render (`bop/scene-sun`), re-graded season by season with the same
 * camera, so they cross-fade pixel over pixel. Strings and numbers only: the
 * cover imports this too. */
import { STUDIO_BOP_ROOT, STUDIO_MAKERS_ROOT } from '../../../../../../lib/kidThemeManifest';
const BOP = STUDIO_BOP_ROOT;
const MADE = STUDIO_MAKERS_ROOT;
export interface KitPicture {
  readonly src: string; readonly src480: string | null; readonly width: number; readonly height: number;
  /** The kit file this picture is, or was derived from, and what was done to it. */
  readonly source: string; readonly edit: string;
}
const shipped = (stem: string, width: number, height: number, small: boolean): KitPicture => ({ src: `${BOP}${stem}.webp`, src480: small ? `${BOP}${stem}-480.webp` : null, width, height, source: `studio-v2/bop/${stem}.webp`, edit: 'as shipped' });
const derived = (stem: string, edit: string): KitPicture => ({ src: `${MADE}${stem}.webp`, src480: `${MADE}${stem}-480.webp`, width: 1024, height: 1024, source: 'studio-v2/bop/scene-sun.webp', edit });

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

/** A figure from the Studio's shared kit library (cut once for every maker from the kit boards; never a private copy). */
const library = (stem: string, width: number, height: number, board: string): KitPicture => ({ src: `${MADE}${stem}.webp`, src480: `${MADE}${stem}-480.webp`, width, height, source: `kit/${board}`, edit: 'shared library cut-out' });
/** Who comes out onto the terrace, each doing the season's own thing, all in
 * the mission wardrobe (one wardrobe for the whole activity). `faces` is the
 * way the figure looks in its file: 1 right, -1 left, 0 at the viewer. */
export interface CastPicture extends KitPicture { readonly faces: 1 | 0 | -1; /** Its height beside a standing child (Bebe is 1). */ readonly tall: number }
const cast = (picture: KitPicture, faces: 1 | 0 | -1, tall: number): CastPicture => ({ ...picture, faces, tall });
export const CAST_PICTURES = {
  /** Aya in spring, a potted seedling in her paws, LeafLab on its sling. */
  ayaSpring: cast(library('kit-aya-holding-plant', 450, 768, 'v30/16-wonder-crew-key-art.png'), 0, 0.8),
  /** Aya in winter, LeafLab on its sling, watching the snow. */
  ayaWinter: cast(library('kit-aya-mission-front', 398, 768, 'v30/05-aya.png'), 0, 0.8),
  /** Chock in the summer shade. */
  chockSummer: cast(library('kit-chock-mission-side', 768, 601, 'v30/03-chock.png'), -1, 0.64),
  /** Pep nosing through the autumn leaves. */
  pepAutumn: cast(library('kit-pep-mission-sniffing', 600, 624, 'v30/16-wonder-crew-key-art.png'), 1, 0.52),
  /** GobGob in the yellow jacket, pointing at the spring rain. */
  gobgobRain: cast(library('kit-gobgob-mission-pointing', 438, 768, 'v30/16-wonder-crew-key-art.png'), 1, 0.84),
  /** Bebe beside the snow friend. */
  bebeSnow: cast(library('kit-bebe-mission-front', 281, 768, 'v30/01-bebe-identity-wardrobes.png'), 0, 1),
} as const;
/** The files of this activity in which a child of the kit is visible (for the likeness register). */
export const SEASON_DIAL_CHILD_FILES: readonly string[] = [CAST_PICTURES.gobgobRain.src, CAST_PICTURES.bebeSnow.src];
/** Aya's seedling in its three steps (chapter two): the kit's own planter. */
export const PLANTER_PICTURES: readonly KitPicture[] = [
  library('kit-prop-planter-bud', 258, 400, 'v30/23-bop-props-T08-T10.png'), library('kit-prop-planter-budding', 262, 400, 'v30/23-bop-props-T08-T10.png'), library('kit-prop-planter-bloom', 282, 426, 'v30/23-bop-props-T08-T10.png'),
];
/** The companion on the cover (the kit's own render, as shipped). */
export const FRIEND_PICTURES = { ayaIdle: shipped('aya-idle', 440, 440, false) } as const;

/** Every picture this activity shows, for the art manifest. */
export const SEASON_DIAL_ART: readonly KitPicture[] = [...SEASON_VIEWS.map(v => v.picture), ...Object.values(CAST_PICTURES), ...PLANTER_PICTURES, ...Object.values(FRIEND_PICTURES)];
