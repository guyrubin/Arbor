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
