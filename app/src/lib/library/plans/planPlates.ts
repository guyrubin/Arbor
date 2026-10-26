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
  "plan-big-feelings": {
    PF1: { light: "day", cx: 0.5, textZone: "inline-end", brief: "A living room in daylight, blocks mid-build, a window; the hero slot empty on the rug" },
    PF2: { light: "day", cx: 0.5, brief: "A kettle on a stove drawn like a friendly machine, steam rising, a thermometer-shaped band going from blue to red beside it; no face, no child" },
    PF3: { light: "day", cx: 0.45, brief: "The same living room after a storm: a toy on its side, blocks scattered, soft light; nobody there" },
    PF4: { light: "golden", cx: 0.5, brief: "The kitchen table in the evening, three chairs, a glowing idea bulb above; warm light" },
    PF5: { light: "day", cx: 0.5, brief: "The living room doorway, a big word card reading nothing (a blank speech bubble shape); the hero slot empty in the middle" },
    PF6: { light: "golden", cx: 0.4, brief: "A calm corner: a big cushion, a soft toy, a book, a small lamp, a plant; very still; the corner empty" },
    PF7: { light: "golden", cx: 0.5, brief: "The living room put back together: the blocks in a tower again, the toy upright; the hero slot empty beside the tower" },
    PF8: { light: "morning", cx: 0.5, textZone: "bottom", brief: "The living room in the morning, sunlight on the rug, the calm corner visible in the back; the hero slot empty in front" },
  },
  "plan-screen-end": {
    PE1: { light: "day", cx: 0.5, textZone: "inline-end", brief: "A family room with a sofa, a tablet face down on the table, a window; the hero slot empty by the sofa" },
    PE2: { light: "day", cx: 0.5, brief: "The sofa close up with the tablet propped on a cushion, the screen a soft glow, no content; the seat empty" },
    PE3: { light: "day", cx: 0.45, brief: "The same sofa, the tablet dark, a cushion on the floor; nobody there" },
    PE4: { light: "golden", cx: 0.5, brief: "The kitchen table in the evening, three chairs, a glowing idea bulb above; warm light" },
    PE5: { light: "day", cx: 0.5, brief: "The sofa with two musical notes drawn in the air above the tablet (two more songs); the seat empty" },
    PE6: { light: "day", cx: 0.4, brief: "A sand timer on the table beside the tablet, the sand half run; the seat empty" },
    PE7: { light: "day", cx: 0.5, brief: "Three picture cards on the table: a snack, shoes and a park, a bath with boats; the hero slot empty beside the table" },
    PE8: { light: "golden", cx: 0.5, textZone: "bottom", brief: "The hallway door open to a sunny park path, shoes ready; the hero slot empty at the door" },
  },
  "plan-new-food": {
    PN1: { light: "day", cx: 0.5, textZone: "inline-end", brief: "A kitchen table set for a meal, a child's plate with two familiar foods and one empty spot; the chair empty" },
    PN2: { light: "day", cx: 0.55, brief: "A garden path with a climbing frame and a picnic blanket with fruit; the hero slot empty on the path" },
    PN3: { light: "day", cx: 0.5, brief: "A friendly picture of a tongue drawn like a map with tiny dots lighting up one by one; no face, no child" },
    PN4: { light: "day", cx: 0.45, brief: "The table from the side, a plate pushed to the edge, a new food on it; nobody there" },
    PN5: { light: "golden", cx: 0.5, brief: "The kitchen table in the evening, three chairs, a glowing idea bulb above; warm light" },
    PN6: { light: "golden", cx: 0.5, brief: "The plate close up: two familiar foods, one small new piece on its spot, a tiny spoon, a little bowl beside; the chair empty" },
    PN7: { light: "day", cx: 0.4, brief: "The kitchen counter with a bowl, a wooden spoon and vegetables being washed in a colander; the hero slot empty at the counter" },
    PN8: { light: "morning", cx: 0.5, textZone: "bottom", brief: "The table in the morning with a calendar of small plates drawn on the wall, sun on the table; the hero slot empty at the chair" },
  },
  "plan-toilet-start": {
    PT1: { light: "morning", cx: 0.5, textZone: "inline-end", brief: "A bright hallway at home with a small potty visible through a door, toys on the floor; the hero slot empty in the hall" },
    PT2: { light: "day", cx: 0.5, brief: "A friendly picture of a tummy as a round tank filling with water and a little door at the bottom, drawn like a game map; no face, no child" },
    PT3: { light: "day", cx: 0.45, brief: "A playroom floor with blocks mid-game and a small damp patch on the rug; nobody there" },
    PT4: { light: "golden", cx: 0.5, brief: "The kitchen table in the evening, three chairs, a glowing idea bulb above; warm light" },
    PT5: { light: "morning", cx: 0.5, brief: "The potty on the bathroom floor, a soft mat, a window; the seat empty" },
    PT6: { light: "morning", cx: 0.4, brief: "The potty with an open box beside it: a book, a small toy; the seat empty" },
    PT7: { light: "day", cx: 0.5, brief: "A shelf with folded dry pants and a laundry basket; calm, nobody there" },
    PT8: { light: "morning", cx: 0.5, textZone: "bottom", brief: "The garden in the morning, a ball on the grass, the house behind; the hero slot empty on the lawn" },
  },
  "plan-stay-in-bed": {
    PB1: { light: "night", cx: 0.5, textZone: "inline-end", brief: "A child's bedroom at night, a bed with a soft blanket, a cup of water on the bedside table, a low lamp; the bed empty" },
    PB2: { light: "day", cx: 0.55, brief: "A playground in daylight, a climbing frame and a slide; the hero slot empty on the path" },
    PB3: { light: "night", cx: 0.45, brief: "The dark hallway from the bedroom door toward the parents' door, a strip of light under it; nobody there" },
    PB4: { light: "golden", cx: 0.5, brief: "The kitchen table in the evening, three chairs, a glowing idea bulb above; warm light" },
    PB5: { light: "night", cx: 0.5, brief: "The bed close up with the cuddly toy on the pillow and the night light on; the bed empty" },
    PB6: { light: "night", cx: 0.4, brief: "The bedside table with a decorated card leaning on the lamp and a cup of water; the bed empty" },
    PB7: { light: "morning", cx: 0.45, brief: "The kitchen table in the morning, two cups, the card lying on the table, sunlight; the hero slot empty at a chair" },
    PB8: { light: "morning", cx: 0.5, textZone: "bottom", brief: "The bedroom window at sunrise, curtains open, the card on the sill; the hero slot empty by the window" },
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
