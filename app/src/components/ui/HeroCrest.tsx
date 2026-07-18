import React from "react";
import type { Cosmetic } from "../../practice/cosmetics";

/* HeroCrest — wraps the hero avatar with the cosmetics EARNED through play:
   the active frame (a themed ring + emblem) and any earned badges (small
   corner chips). Pure presentation; the caller supplies what evaluateCosmetics
   returned. Reusable anywhere the hero appears (Arcade now; Today/Academy next). */

const FRAME_RING: Record<string, string> = {
  "sprout-frame": "var(--arbor-primary)",
  "bloom-frame": "var(--arbor-pink)",
  "star-frame": "var(--arbor-yellow)",
  "tree-frame": "var(--arbor-primary-deep)",
};

export default function HeroCrest({
  size = 104,
  frame = null,
  badges = [],
  children,
}: {
  size?: number;
  frame?: Cosmetic | null;
  badges?: Cosmetic[];
  children: React.ReactNode;
}) {
  const ringColor = frame ? FRAME_RING[frame.id] ?? "var(--arbor-primary)" : null;
  const chip = Math.max(22, Math.round(size * 0.26));
  const shown = badges.slice(0, 3);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {/* Active frame: a bold ink-edged ring in the frame's color, behind the avatar. */}
      {ringColor && (
        <span aria-hidden="true" className="absolute rounded-full"
          style={{ inset: -7, background: ringColor, border: "var(--comic-line)", zIndex: 0 }} />
      )}
      <div className="relative" style={{ zIndex: 1, width: size, height: size }}>{children}</div>

      {/* Frame emblem badge (top-left). */}
      {frame && (
        <span title={frame.requirement} aria-label={`${frame.label} frame`}
          className="absolute grid place-items-center rounded-full"
          style={{ left: -6, top: -6, width: chip, height: chip, fontSize: chip * 0.52,
            background: "#fff", border: "var(--comic-line)", zIndex: 2 }}>
          <span aria-hidden="true">{frame.emoji}</span>
        </span>
      )}

      {/* Earned badges stack (bottom-right). */}
      {shown.length > 0 && (
        <div className="absolute flex" style={{ right: -6, bottom: -6, zIndex: 2 }}>
          {shown.map((b, i) => (
            <span key={b.id} title={b.requirement} aria-label={`${b.label} badge`}
              className="grid place-items-center rounded-full"
              style={{ width: chip, height: chip, fontSize: chip * 0.5, marginLeft: i === 0 ? 0 : -chip * 0.32,
                background: "#fff", border: "var(--comic-line)" }}>
              <span aria-hidden="true">{b.emoji}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
