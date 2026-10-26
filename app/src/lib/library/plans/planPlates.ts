/**
 * lib/library/plans/planPlates — B-BOOK-75 (standard §0): the pattern plate
 * registry. A pattern's plates are authored once, child-free and text-free, in
 * the game-tile look with one key light and the hero slot EMPTY, and SHARED by
 * every family who composes that pattern — so a pattern is painted once.
 *
 *   public/visuals/plans/<patternId>/<plateId>.webp   (3:2 master, committed)
 *   the DEV placeholder folder, <patternId>/<plateId>.webp (git-ignored; bookPlates.devPlaceholderPath)
 *
 * The plate table reuses BookPlate with `bookId` = the pattern id, so
 * plateSources' DEV fallback lands on the placeholder path above. Provenance
 * starts EMPTY (childFree / textFree false, reviewedBy null) and is set only
 * when a plate has been viewed full size (lane B §4.9). Pure.
 */
import { makePlate, type BookPlate, type LightRig, type PlateTable } from "../bookPlates";
import type { PatternId } from "../types";

/** The public root of the real (committed) plan plates. */
export const PLAN_PLATE_ROOT = "/visuals/plans";

interface PlateSpec {
  light: LightRig;
  /** The authored 3:4 window centre. */
  cx?: number;
  textZone?: BookPlate["textZone"];
  /** A one-line brief for the art agent and the placeholder generator. */
  brief: string;
}

function table(patternId: PatternId, specs: Record<string, PlateSpec>): PlateTable {
  const out: Record<string, BookPlate> = {};
  for (const [id, s] of Object.entries(specs)) {
    out[id] = {
      ...makePlate(patternId, id, s.light, { window: { cx: s.cx ?? 0.5 }, ...(s.textZone ? { textZone: s.textZone } : {}) }),
      file: `${PLAN_PLATE_ROOT}/${patternId}/${id}.webp`,
    };
  }
  return out;
}

/** The art briefs, per pattern and plate (read by the placeholder generator
 *  through the exported table's ids; the brief text is for the art round). */
export const PLAN_PLATE_BRIEFS: Partial<Record<PatternId, Record<string, PlateSpec>>> = {
  "plan-poo-sit": {
    PP1: { light: "morning", cx: 0.5, textZone: "inline-end", brief: "A bright living room, toys mid-play, a window with morning light; the hero slot empty on the rug" },
    PP2: { light: "day", cx: 0.55, brief: "A friendly picture of how a body works: a big soft outline of a tummy and a winding path for the food, drawn like a game map; no face, no child" },
    PP3: { light: "day", cx: 0.45, brief: "A hallway with the bathroom door half open, a toy left on the floor mid-game; soft light, nobody there" },
    PP4: { light: "golden", cx: 0.5, brief: "The kitchen table after dinner, three chairs, a glowing idea bulb drawn above the table; warm evening light" },
    PP5: { light: "golden", cx: 0.5, brief: "A calm bathroom: the toilet with a small wooden step in front of it, a plant, a towel; the seat empty" },
    PP6: { light: "golden", cx: 0.4, brief: "The same bathroom from the floor: an open wonder box with a book, a bubble bottle and a small game spilling out" },
    PP7: { light: "dusk", cx: 0.5, brief: "The same bathroom in soft dusk light, the step and the box in their places, very still" },
    PP8: { light: "morning", cx: 0.5, textZone: "bottom", brief: "A sunny garden or balcony in the morning, a kite in the sky; the hero slot empty in the middle" },
  },
  "plan-sleep-alone": {
    PS1: { light: "night", cx: 0.5, textZone: "inline-end", brief: "A child's bedroom at night, a small bed with a soft blanket, a window with a moon, a low lamp; the bed empty" },
    PS2: { light: "day", cx: 0.55, brief: "A playground in daylight, a climbing frame and a slide; the hero slot empty on the path" },
    PS3: { light: "night", cx: 0.45, brief: "The same bedroom from the bed, the door a little open with a strip of hallway light; the room feels big; nobody there" },
    PS4: { light: "golden", cx: 0.5, brief: "The kitchen table in the evening, three chairs, a glowing idea bulb above; warm light" },
    PS5: { light: "dusk", cx: 0.5, brief: "The bathroom and the bedroom door in soft evening light: a towel, folded pyjamas, one book on the bed" },
    PS6: { light: "night", cx: 0.5, brief: "The bedroom at night with a chair beside the bed, then the same chair drawn faintly nearer the door; the bed empty" },
    PS7: { light: "morning", cx: 0.45, brief: "The kitchen table in the morning, two cups, sunlight on the table; the hero slot empty at a chair" },
    PS8: { light: "morning", cx: 0.5, textZone: "bottom", brief: "The bedroom window at sunrise, curtains open, birds outside; the hero slot empty by the window" },
  },
  "plan-dropoff": {
    PD1: { light: "morning", cx: 0.5, textZone: "inline-end", brief: "The kindergarten gate in the morning, a path to the door, a tree with a swing; the hero slot empty on the path" },
    PD2: { light: "morning", cx: 0.55, brief: "The hallway at home with shoes by the door and a small bag on a hook; nobody there" },
    PD3: { light: "morning", cx: 0.45, brief: "The kindergarten door from outside, other children's shoes lined up, the door half open; the hero slot empty at the threshold" },
    PD4: { light: "golden", cx: 0.5, brief: "The kitchen table in the evening, three chairs, a glowing idea bulb above; warm light" },
    PD5: { light: "morning", cx: 0.5, brief: "The gate again, close up: two hands drawn as a high-five shape in the air, a kiss mark drawn on a palm; no faces" },
    PD6: { light: "day", cx: 0.4, brief: "A kindergarten shelf with a small pocket on it, a tiny stone and a folded photo card in the pocket; no child" },
    PD7: { light: "day", cx: 0.5, brief: "The kindergarten room from inside: a round clock on the wall, a window with the gate visible, a snack table; no child" },
    PD8: { light: "golden", cx: 0.5, textZone: "bottom", brief: "The gate in the afternoon light, the door open wide, a grown-up's silhouette far away waving; the hero slot empty in front" },
  },
};

const TABLES: Partial<Record<PatternId, PlateTable>> = Object.fromEntries(
  Object.entries(PLAN_PLATE_BRIEFS).map(([id, specs]) => [id, table(id as PatternId, specs!)]),
) as Partial<Record<PatternId, PlateTable>>;

/** The plate table of a pattern ({} for a pattern without plates yet). */
export function planPlateTable(patternId: PatternId): PlateTable {
  return Object.prototype.hasOwnProperty.call(TABLES, patternId) ? TABLES[patternId]! : {};
}

export function getPlanPlate(patternId: PatternId, plateId: string): BookPlate | undefined {
  const t = planPlateTable(patternId);
  return Object.prototype.hasOwnProperty.call(t, plateId) ? t[plateId] : undefined;
}
