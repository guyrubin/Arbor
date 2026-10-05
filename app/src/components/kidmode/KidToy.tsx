/**
 * KidToy — B-KID-133 (D-02, KID-DESIGN-DIRECTION §2.3): the ONE button
 * primitive of the kid register. A moulded candy token: thick rounded body, a
 * solid lip underneath, a gloss highlight on top; it sinks and squashes when
 * pressed and springs back on release (pure CSS, `.kid-toy` in index.css;
 * reduced motion = the lip press only, no squash).
 *
 * - tone "go"     — yellow face, ochre lip, navy label: the screen's ONE
 *                   primary action (Read, Next, Play again, This one!).
 * - tone "paper"  — paper face: Back, Home, secondary actions.
 * - tone "sapphire" — rare: an "on" state (the Sound toggle).
 * - shape "round" — an icon-only toy (Home, hear-it, Back); needs aria-label.
 * Glyphs are Material Symbols Rounded (self-hosted subset); a directional
 * arrow mirrors in Hebrew. Never wider than its label + padding.
 */
import React from "react";
import { Icon } from "../ui/Icon";

export type KidToyTone = "go" | "paper" | "sapphire";
export type KidToySize = "s" | "m" | "l";

/** Glyphs that point along the reading direction (mirror in RTL). */
const DIRECTIONAL = new Set(["arrow_forward", "arrow_back", "chevron_left", "chevron_right"]);

export interface KidToyProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  tone?: KidToyTone;
  size?: KidToySize;
  shape?: "bar" | "round";
  /** Leading glyph (Material Symbols ligature). */
  glyph?: string;
  /** Trailing glyph (e.g. arrow_forward after "Read"). */
  glyphEnd?: string;
  /** Piece feedback: correct (green lip) / not-yet (lavender, never red). */
  state?: "correct" | "not-yet";
  children?: React.ReactNode;
}

function ToyGlyph({ name }: { name: string }) {
  return (
    <span aria-hidden="true" className={`kid-toy-glyph${DIRECTIONAL.has(name) ? " rtl:-scale-x-100" : ""}`} style={{ display: "inline-grid" }}>
      <Icon name={name} size={28} fill={1} weight={700} style={{ fontSize: "inherit" }} />
    </span>
  );
}

export function KidToy({ tone = "paper", size = "m", shape = "bar", glyph, glyphEnd, state, children, className = "", type = "button", ...rest }: KidToyProps) {
  return (
    <button
      type={type}
      {...rest}
      className={`kid-toy ${className}`.trim()}
      data-tone={tone}
      data-size={size}
      data-shape={shape}
      data-state={state}
    >
      {glyph && <ToyGlyph name={glyph} />}
      {children != null && children !== false && <span className="kid-toy-label">{children}</span>}
      {glyphEnd && <ToyGlyph name={glyphEnd} />}
    </button>
  );
}

export default KidToy;
