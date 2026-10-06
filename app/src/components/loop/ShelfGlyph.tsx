import React from "react";
import { Icon } from "../ui/Icon";
import { shelfDef, type ShelfId } from "../../lib/shelves/registry";

/** The -soft / -ink token pair per tint; "deep" is the paper well with ink-soft. */
const TINT_TOKENS: Readonly<Record<string, { bg: string; ink: string }>> = {
  sky: { bg: "var(--arbor-sky-soft)", ink: "var(--arbor-sky-ink)" },
  yellow: { bg: "var(--arbor-yellow-soft)", ink: "var(--arbor-yellow-ink)" },
  lav: { bg: "var(--arbor-lav-soft)", ink: "var(--arbor-lav-ink)" },
  pink: { bg: "var(--arbor-pink-soft)", ink: "var(--arbor-pink-ink)" },
  green: { bg: "var(--arbor-green-soft)", ink: "var(--arbor-green-ink)" },
  peach: { bg: "var(--arbor-peach-soft)", ink: "var(--arbor-peach-ink)" },
  deep: { bg: "var(--arbor-paper-deep)", ink: "var(--arbor-ink-soft)" },
};

/**
 * The shelf's mark in every loop slot (NoticeCard, the practice, the shelf
 * map, the shelf grid, Tonight): the registry's Material Symbols glyph in a
 * tinted chip (framer ruling 6 Oct; DESIGN.md §Components). Never an emoji,
 * never an image, never a runtime picture (B-LOOP-15's renders stay parked).
 * The tint names the shelf, never the child: every shelf is drawn the same
 * way whatever its count.
 */
export function ShelfGlyph({ shelf, size = 36 }: { shelf: ShelfId; size?: 36 | 40 | 44 }) {
  const def = shelfDef(shelf);
  if (!def.glyph) return null;
  const tone = TINT_TOKENS[def.tint] ?? TINT_TOKENS.deep;
  return (
    <span
      data-testid="shelf-glyph"
      data-shelf={shelf}
      aria-hidden="true"
      className="inline-flex flex-none items-center justify-center rounded-xl"
      style={{ width: size, height: size, background: tone.bg, color: tone.ink }}
    >
      <Icon name={def.glyph} size={Math.round(size * 0.53)} />
    </span>
  );
}

export default ShelfGlyph;
