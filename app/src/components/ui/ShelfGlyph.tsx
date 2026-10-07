import React from "react";
import { Icon } from "./Icon";
import { shelfDef, type ShelfId, type ShelfTint } from "../../lib/shelves/registry";

/**
 * B-DESIGN-02 (P7-DESIGN framer decision, 7 Oct; DESIGN.md §Components) — the
 * shelf's mark as a 44 px DUOTONE glyph: the registry's Material Symbols glyph
 * twice in one cell — a FILL 1 layer in the shelf's jewel at 30 % under a
 * 500-weight outline in the shipped -ink — on the shelf's -soft chip (a white
 * chip when the glyph sits on the shelf's wash).
 *
 * The tint names the SHELF, never the child: the props carry no count, answer or
 * state, so every shelf is drawn the same way whatever its record holds.
 *
 * Supersedes components/loop/ShelfGlyph (the shipped 36–40 px flat chip) once
 * B-DESIGN-03/04 move its seven call sites; until then both exist and this one
 * is mounted nowhere.
 */
export type ShelfTone = { jewel: string; soft: string; ink: string; wash: string };

/** Per registry tint: the jewel (fill layer + the 96 px bleed), the -soft chip,
 *  the AA -ink outline, and the fixed-strength wash. "deep" (hands) = the paper
 *  well with ink (option-ab-blend.html `.t-deep`). Tokens only. */
export const SHELF_TONE: Readonly<Record<ShelfTint, ShelfTone>> = {
  sky: { jewel: "var(--arbor-sky)", soft: "var(--arbor-sky-soft)", ink: "var(--arbor-sky-ink)", wash: "var(--arbor-sky-wash)" },
  yellow: { jewel: "var(--arbor-yellow)", soft: "var(--arbor-yellow-soft)", ink: "var(--arbor-yellow-ink)", wash: "var(--arbor-yellow-wash)" },
  lav: { jewel: "var(--arbor-lav)", soft: "var(--arbor-lav-soft)", ink: "var(--arbor-lav-ink)", wash: "var(--arbor-lav-wash)" },
  pink: { jewel: "var(--arbor-pink)", soft: "var(--arbor-pink-soft)", ink: "var(--arbor-pink-ink)", wash: "var(--arbor-pink-wash)" },
  green: { jewel: "var(--arbor-sage)", soft: "var(--arbor-green-soft)", ink: "var(--arbor-green-ink)", wash: "var(--arbor-green-wash)" },
  peach: { jewel: "var(--arbor-peach)", soft: "var(--arbor-peach-soft)", ink: "var(--arbor-peach-ink)", wash: "var(--arbor-peach-wash)" },
  deep: { jewel: "var(--arbor-clay)", soft: "var(--arbor-paper-deep)", ink: "var(--arbor-ink)", wash: "var(--arbor-paper-deep)" },
};

/** The shelf's tone pair, read from the registry tint. */
export function shelfTone(shelf: ShelfId): ShelfTone {
  return SHELF_TONE[shelfDef(shelf).tint] ?? SHELF_TONE.deep;
}

/** Glyph px per chip size (the mock's 23 px in 44, 19 px in 36). */
const GLYPH_PX: Readonly<Record<44 | 36, number>> = { 44: 23, 36: 19 };

export function ShelfGlyph({ shelf, size = 44, onWash = false }: { shelf: ShelfId; size?: 44 | 36; onWash?: boolean }) {
  const def = shelfDef(shelf);
  if (!def.glyph) return null;
  const tone = shelfTone(shelf);
  const px = GLYPH_PX[size];
  // The icon class `.msr` forces direction:ltr; the layers inherit the page's
  // direction so a positioned glyph resolves inline-start/end correctly in HE.
  const layer: React.CSSProperties = { gridArea: "1 / 1", direction: "inherit" };
  return (
    <span
      data-testid="shelf-glyph-duotone"
      data-shelf={shelf}
      data-tint={def.tint}
      aria-hidden="true"
      className="inline-grid flex-none place-items-center"
      style={{
        width: size,
        height: size,
        borderRadius: "var(--r)",
        background: onWash ? "var(--arbor-paper-elevated)" : tone.soft,
        boxShadow: onWash
          ? `0 0 0 1px color-mix(in srgb, ${tone.ink} 10%, transparent)`
          : `inset 0 0 0 1px color-mix(in srgb, ${tone.ink} 12%, transparent)`,
      }}
    >
      <Icon name={def.glyph} size={px} fill={1} weight={400} style={{ ...layer, color: `color-mix(in srgb, ${tone.jewel} 30%, transparent)` }} />
      <Icon name={def.glyph} size={px} fill={0} weight={500} style={{ ...layer, color: tone.ink }} />
    </span>
  );
}

export default ShelfGlyph;
