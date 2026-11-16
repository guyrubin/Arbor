import { studioBopArt, STUDIO_MAKERS_ROOT } from '../../../../../../lib/kidThemeManifest';

/* How Things Move: every picture the activity shows, in one place. Each entry
   is one file, its pixel size and the kit source it was cut from. The stage
   and the tool are this activity's own cuts; the companion comes from the
   Studio's shared art (never a private copy of a character). */
const MAKERS = STUDIO_MAKERS_ROOT;
export interface KitPicture { readonly src: string; readonly width: number; readonly height: number; readonly source: string }

/** The TrailBench, deployed, in the Wonderworks pavilion. No character in it. */
export const KIT_STAGE: KitPicture = {
  src: `${MAKERS}crank-works-stage.webp`, width: 1536, height: 1024,
  source: 'kit v30/11-trailbench.png (DEPLOYED hero, cut out) over app bop/scene-delivery.webp (softened)',
};
/** AnchorCheck, the kit tool that tests one joint. Its tip is the lower left end. */
export const KIT_ANCHORCHECK: KitPicture & { readonly tip: readonly [number, number] } = {
  src: `${MAKERS}crank-works-anchorcheck.webp`, width: 495, height: 304, tip: [20, 244],
  source: 'kit v30/10-act-kit.png (ANCHORCHECK hero, cut out)',
};
/** The felt flower the lifter raises: folded on the way, open at the top. */
export const KIT_FLOWER = {
  folded: { src: studioBopArt('flower-folded'), width: 293, height: 440, source: 'app bop/flower-folded.webp (shipped)' },
  open: { src: studioBopArt('flower-open'), width: 293, height: 440, source: 'app bop/flower-open.webp (shipped)' },
} as const satisfies Record<string, KitPicture>;
/** A head-and-shoulders picture from the Studio's shared kit library (never a
 * private copy of a character). `faces` is the way the picture looks as stored. */
export interface KitBust { readonly watch: KitPicture; readonly cheer: KitPicture; readonly faces: 'left' | 'right' }
const bust = (stem: string, width: number, height: number, board: string): KitPicture => ({ src: `${MAKERS}${stem}.webp`, width, height, source: `shared kit library ${stem} (${board})` });
export const KIT_COMPANIONS = {
  /** Chock, the bench's steady friend: attentive while watching, relieved at a reward. */
  chock: { watch: bust('kit-chock-attentive', 506, 512, 'kit v30/15-companion-reactions.png'), cheer: bust('kit-chock-relieved', 512, 491, 'kit v30/15-companion-reactions.png'), faces: 'right' },
  /** Bebe, the kit's builder: curious while watching, a smile at a reward. These
   * two files show a real child; they are the shared library's, named for the
   * app's likeness register. */
  bebe: { watch: bust('kit-bebe-face-curious', 426, 512, 'kit v30/12-bebe-expressions.png'), cheer: bust('kit-bebe-face-smile', 425, 512, 'kit v30/12-bebe-expressions.png'), faces: 'right' },
} as const satisfies Record<string, KitBust>;
/** Who stands by the bench, looking across at the machine. One word to change. */
export const KIT_COMPANION: KitBust = KIT_COMPANIONS.chock;
/** Where the companion's picture sits in the drawing (drawing units): at the
 * right, its straight lower edge below the stage, turned to face the machine. */
export const COMPANION_FRAME = { right: 338, width: 118, foot: 488 } as const;
