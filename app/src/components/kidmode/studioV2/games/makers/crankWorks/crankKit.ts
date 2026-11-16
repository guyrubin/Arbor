import { STUDIO_MAKERS_ROOT } from '../../../../../../lib/kidThemeManifest';

/* How Things Move: every picture the activity shows, in one place. Each entry
   is one file, its pixel size and the art it was cut or edited from. The room
   and the bench are this activity's own edits of kit art; the tool is its own
   cut; Chock comes from the Studio's shared kit library (never a private copy
   of a character). The machine itself is drawn in code (crankPaint.ts). */
const MAKERS = STUDIO_MAKERS_ROOT;
export interface KitPicture { readonly src: string; readonly width: number; readonly height: number; readonly source: string }

/** The Wonderworks pavilion, softened with distance. No character in it. */
export const KIT_ROOM: KitPicture = {
  src: `${MAKERS}crank-works-room.webp`, width: 1024, height: 1024,
  source: 'app bop/scene-delivery.webp (shipped), softened (Gaussian blur 2.6)',
};
/** The TrailBench, deployed, cut out of its board, wheels and lift feet and all. No character in it. */
export const KIT_BENCH: KitPicture = {
  src: `${MAKERS}crank-works-bench.webp`, width: 1580, height: 1084,
  source: 'kit v30/11-trailbench.png (DEPLOYED hero, x 735 y 25 w 790 h 542, board and floor removed, enlarged 2x with a light unsharp mask)',
};
/** AnchorCheck, the kit tool that tests one joint. Its tip is the lower left end. */
export const KIT_ANCHORCHECK: KitPicture & { readonly tip: readonly [number, number] } = {
  src: `${MAKERS}crank-works-anchorcheck.webp`, width: 495, height: 304, tip: [20, 244],
  source: 'kit v30/10-act-kit.png (ANCHORCHECK hero, cut out)',
};
/** Chock in his work harness, standing, seen from the side (he faces left, toward the machine). */
export const KIT_CHOCK: KitPicture = {
  src: `${MAKERS}kit-chock-mission-side.webp`, width: 768, height: 601,
  source: 'shared kit library kit-chock-mission-side (kit v30/03-chock.png)',
};
/** The one companion of this activity: the HUD's coach head and the figure by the bench. */
export const KIT_COMPANION = 'chock' as const;
