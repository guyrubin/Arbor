import React from "react";
import { Icon } from "./Icon";
import "./brandChip.css";

/**
 * v4 — the brand gradient chip: one icon object for the parent app.
 *
 * A soft organic blob (one of three silhouettes) filled with a 135° gradient
 * from a light wash of the tone up to the tone's AA ink, and a FILL 1 white
 * glyph on top. Arbor v4 uses it wherever an object names itself — the week
 * card, Notice today, the agenda rows, the question recents, the Moments area
 * cards, What Arbor remembers, the Together studio doors and rhythm, and the
 * Care cards — so a parent learns ONE visual for "this is a thing you can open".
 *
 * Tokens only: the tone is a CSS colour (always an `--arbor-*` ink token) and
 * the light end is mixed from it, so a new tone never needs a new literal.
 * Decorative by default (aria-hidden): the row or button around it carries the
 * name.
 */
export type BrandChipTone = "sapphire" | "lav" | "green" | "sky" | "peach" | "pink" | "navy" | "amber";
export type BrandChipShape = "leaf" | "arch" | "drop";

/** Each tone's ink: the dark end of the gradient (AA on white). */
export const BRAND_CHIP_INK: Readonly<Record<BrandChipTone, string>> = {
  sapphire: "var(--arbor-clay)",
  lav: "var(--arbor-lav-ink)",
  green: "var(--arbor-green-ink)",
  sky: "var(--arbor-sky-ink)",
  peach: "var(--arbor-peach-ink)",
  pink: "var(--arbor-pink-ink)",
  navy: "var(--arbor-ink)",
  amber: "var(--arbor-yellow-ink)",
};

/** Each tone's light end: its jewel washed toward the card. */
export const BRAND_CHIP_LIGHT: Readonly<Record<BrandChipTone, string>> = {
  sapphire: "color-mix(in srgb, var(--arbor-sky) 45%, var(--arbor-paper-elevated))",
  lav: "color-mix(in srgb, var(--arbor-lav) 60%, var(--arbor-paper-elevated))",
  green: "color-mix(in srgb, var(--arbor-sage) 45%, var(--arbor-paper-elevated))",
  sky: "color-mix(in srgb, var(--arbor-sky) 30%, var(--arbor-paper-elevated))",
  peach: "color-mix(in srgb, var(--arbor-peach) 32%, var(--arbor-paper-elevated))",
  pink: "color-mix(in srgb, var(--arbor-pink) 30%, var(--arbor-paper-elevated))",
  navy: "color-mix(in srgb, var(--arbor-clay) 55%, var(--arbor-paper-elevated))",
  amber: "color-mix(in srgb, var(--arbor-yellow) 45%, var(--arbor-paper-elevated))",
};

/** The eight development areas, each in its registry ink family. */
export const DOMAIN_CHIP_TONE: Readonly<Record<string, BrandChipTone>> = {
  talking: "sapphire",
  moving: "green",
  hands: "amber",
  thinking: "sky",
  playing: "pink",
  feelings: "lav",
  body: "navy",
  family: "peach",
};

const SHAPES: readonly BrandChipShape[] = ["leaf", "arch", "drop"];
/** A stable silhouette for an index, so neighbouring chips never look stamped. */
export function brandChipShape(index: number): BrandChipShape {
  return SHAPES[((index % SHAPES.length) + SHAPES.length) % SHAPES.length];
}

export function BrandChip({
  icon,
  tone = "sapphire",
  shape = "leaf",
  size = 34,
  className,
  testId,
}: {
  icon: string;
  tone?: BrandChipTone;
  shape?: BrandChipShape;
  /** Outer box in px; the glyph is a little over half of it. */
  size?: number;
  className?: string;
  testId?: string;
}) {
  const glyph = Math.round(size * 0.53);
  return (
    <span
      aria-hidden="true"
      data-testid={testId}
      data-brand-chip={tone}
      data-shape={shape}
      className={className ? `brand-chip ${className}` : "brand-chip"}
      style={{
        inlineSize: size,
        blockSize: size,
        ["--chip-light" as string]: BRAND_CHIP_LIGHT[tone],
        ["--chip-ink" as string]: BRAND_CHIP_INK[tone],
      } as React.CSSProperties}
    >
      <Icon name={icon} size={glyph} fill={1} weight={500} className="brand-chip-glyph" />
    </span>
  );
}

export default BrandChip;
