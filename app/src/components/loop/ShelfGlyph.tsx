import React from "react";
import { Icon } from "../ui/Icon";
import { shelfDef, type ShelfDef, type ShelfId } from "../../lib/shelves/registry";

/** The jewel tints a shelf chip may use (DESIGN.md §Components: a `-soft`
 *  chip with `-ink` glyph colour). */
const TINTS = new Set(["sky", "yellow", "lav", "pink", "green", "peach", "clay"]);

type GlyphFields = { glyph?: string; tint?: string };

/**
 * The shelf's mark in every loop slot (NoticeCard, the practice, the shelf
 * grid, Tonight). It reads `glyph` + `tint` from the shelf registry
 * (B-LOOP-15 adds them; that item is PARKED, Guy 6 Oct) and renders NOTHING
 * while the registry carries none — never an emoji, never an image, never a
 * runtime picture. Tokens only.
 */
export function ShelfGlyph({ shelf, size = 36 }: { shelf: ShelfId; size?: 36 | 40 | 44 }) {
  const def = shelfDef(shelf) as ShelfDef & GlyphFields;
  if (!def.glyph) return null;
  const tint = def.tint && TINTS.has(def.tint) ? def.tint : "clay";
  return (
    <span
      data-testid="shelf-glyph"
      data-shelf={shelf}
      aria-hidden="true"
      className="inline-flex flex-none items-center justify-center rounded-xl"
      style={{ width: size, height: size, background: `var(--arbor-${tint}-soft)`, color: `var(--arbor-${tint}-ink)` }}
    >
      <Icon name={def.glyph} size={Math.round(size * 0.53)} />
    </span>
  );
}

export default ShelfGlyph;
