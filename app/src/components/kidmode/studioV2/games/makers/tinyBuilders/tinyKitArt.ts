/** The kit pictures Tiny Structures stands on (Horizon Valley, register v30).
 * Every picture is ONE path constant. A constant marked STAND-IN points at
 * the closest shipped kit image until its own render is delivered to
 * `public/visuals/studio-v2/makers/<stem>.webp`; swapping it is a one-line
 * change here. Paths only: nothing is fetched or made at runtime. */
const BOP = '/visuals/studio-v2/bop/', V30 = '/visuals/studio-v2/v30/';

/** The Wonderworks lab bench behind the turntable. STAND-IN: the white arched pavilion room. */
export const ART_BENCH = `${BOP}scene-delivery.webp`;
export const ART_BENCH_480 = `${BOP}scene-delivery-480.webp`;
/** The bench close up, where the zoom starts: a leaf with a drop of pond water. STAND-IN: the round linen table. */
export const ART_LEAF = `${BOP}scene-table.webp`;
/** STAND-IN only: the fern laid on the table until the leaf picture arrives. Empty string once ART_LEAF is the real render. */
export const ART_LEAF_FERN = `${BOP}rover-planter.webp`;
/** What the lens shows inside the drop: calm pond water. STAND-IN: the reflection pool, softened in CSS. */
export const ART_WATER = `${V30}portal-feelings-480.webp`;
/** Aya, watching beside the turntable. */
export const ART_AYA_IDLE = `${BOP}aya-idle.webp`;
export const ART_AYA_HAPPY = `${BOP}aya-happy.webp`;
/** Aya peering through her lens (the zoom views). STAND-IN: Aya standing. */
export const ART_AYA_LENS = `${BOP}aya-idle.webp`;
