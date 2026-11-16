/** The kit pictures Tiny Structures stands on (Horizon Valley, register v30):
 * one small module of path constants, each with its pixel size and the kit
 * file it was cut from. Nothing is fetched or made at runtime. No picture of
 * this activity's own (`tiny-builders-*`) shows a child: the monitor's screen
 * was painted blank in the file (the game draws its lens view there).
 * Characters come from the shipped kit art (Aya) and the shared kit library
 * (Bebe, `kit-bebe-*`) only. */
const BOP = '/visuals/studio-v2/bop/', MAKERS = '/visuals/studio-v2/makers/';
export interface KitArt { src: string; src480: string; width: number; height: number; /** The kit file it was cut from. */ source: string }
const art = (root: string, stem: string, width: number, height: number, source: string): KitArt => ({ src: `${root}${stem}.webp`, src480: `${root}${stem}-480.webp`, width, height, source });

/** The Wonderworks room behind the bench: the white arched pavilion, valley in the windows (shipped). */
export const ART_ROOM = art(BOP, 'scene-delivery', 1024, 1024, 'app shipped: bop/scene-delivery');
/** The TrailBench, stowed: the rolling lab the model's turntable stands on. Own cut-out, to be swapped for the shared `kit-prop-trailbench` when it lands. */
export const ART_TRAILBENCH = art(MAKERS, 'tiny-builders-trailbench', 655, 342, 'kit v30/11-trailbench.png (STOWED hero, cut out)');
/** The ProofLens, lens up: the look-closer tool lying on the bench. */
export const ART_PROOFLENS = art(MAKERS, 'tiny-builders-prooflens', 297, 211, 'kit v30/09-observe-kit.png (PROOFLENS hero, cut out)');
/** The ProofLens on its tripod before its big screen; the screen is blank for the game's lens view. */
export const ART_MONITOR = art(MAKERS, 'tiny-builders-lens-monitor', 450, 546, 'kit v30/25-prooflens.png (RESTORE CONTEXT panel, right part; screen painted blank)');
/** Where the blank screen sits in ART_MONITOR, as shares of the picture: its four corners, clockwise from top-left. */
export const MONITOR_SCREEN: readonly (readonly [number, number])[] = [[14 / 450, 74 / 546], [432 / 450, 56 / 546], [432 / 450, 347 / 546], [14 / 450, 331 / 546]];
/** Calm pond water for the lens view: the reflection pool, softened. */
export const ART_WATER = art(MAKERS, 'tiny-builders-water', 640, 704, 'app shipped: v30/portal-feelings (pool, blurred and lightened)');
/** A fern from above: the leaf the drop of pond water sits on (shipped). */
export const ART_FERN = art(BOP, 'rover-planter', 320, 278, 'app shipped: bop/rover-planter');
/** Aya's LeafLab, closed: the puck the drop of pond water sits on. Own cut-out, to be swapped for the shared `kit-tool-leaflab` when it lands. */
export const ART_LEAFLAB = art(MAKERS, 'tiny-builders-leaflab', 165, 147, 'kit v30/05-aya.png (LEAFLAB product shot, closed, cut out)');
/** Bebe, watching the ProofLens screen (shared kit library; the file names carry `bebe`, as the likeness register needs). Shown flipped, to look at the screen. */
export const ART_BEBE_WATCHING = art(MAKERS, 'kit-bebe-face-curious', 426, 512, 'shared kit library: kit-bebe-face-curious (v30/12-bebe-expressions.png)');
export const ART_BEBE_PLEASED = art(MAKERS, 'kit-bebe-face-smile', 425, 512, 'shared kit library: kit-bebe-face-smile (v30/12-bebe-expressions.png)');
/** Every picture this activity shows, for the art manifest. Aya comes through BopFriend (shipped `bop/aya-idle`, `bop/aya-happy`). */
export const TINY_KIT_ART: readonly KitArt[] = [ART_ROOM, ART_TRAILBENCH, ART_PROOFLENS, ART_MONITOR, ART_WATER, ART_FERN, ART_LEAFLAB, ART_BEBE_WATCHING, ART_BEBE_PLEASED];
