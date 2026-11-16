import React from "react";
import { Icon } from "../../ui/Icon";

/**
 * A Challenge plan's face: the plain typographic cover (the canvas `cp-book`).
 * No plate art is committed for these books yet, so the cover is words on
 * paper, never a Living Form or an invented picture. `sm` is the spine-sized
 * chip (glyph only), `lg` the stage cover with the name line.
 */
export function ChallengeBook({ title, nameLine, size, width, label }: { title: string; nameLine?: string; size?: "sm" | "lg"; width: number; label: string }) {
  return (
    <span className={size ? `cp-book ${size}` : "cp-book"} style={{ width }} role="img" aria-label={label}>
      <i className="bi" aria-hidden="true">
        <Icon name="auto_stories" size={size === "lg" ? 20 : 14} />
      </i>
      <b dir="auto">{title}</b>
      {nameLine && <small dir="auto">{nameLine}</small>}
    </span>
  );
}
