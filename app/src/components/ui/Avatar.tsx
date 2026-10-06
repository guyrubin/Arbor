import React from "react";

/**
 * Avatar — a person's photo when available, otherwise their initials on a
 * deterministic brand-tinted background. Used for the parent and (optionally)
 * each child. Google sign-in supplies `photoURL`; the CSP allows lh3.* images.
 */
// P1-NEXTLEVEL critic r2 (profile design, Law 4): the identity disc reads the
// jewel ink tokens — no second palette. Initials sit in --arbor-on-accent.
const PALETTE = [
  "var(--arbor-green-ink)",
  "var(--arbor-sky-ink)",
  "var(--arbor-clay-ink)",
  "var(--arbor-lav-ink)",
  "var(--arbor-peach-ink)",
  "var(--arbor-pink-ink)",
];

function colorFor(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function initialsOf(name?: string | null): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const i = parts.map((w) => w[0] || "").join("").toUpperCase();
  return i || "·";
}

export function Avatar({
  name,
  photoURL,
  size = 36,
  ring = false,
  className = "",
}: {
  name?: string | null;
  photoURL?: string | null;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const dims: React.CSSProperties = { width: size, height: size };
  const ringStyle: React.CSSProperties = ring ? { boxShadow: "0 0 0 2px var(--arbor-paper-elevated), 0 0 0 3.5px var(--arbor-rule-strong)" } : {};

  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name || "Profile photo"}
        referrerPolicy="no-referrer"
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ ...dims, ...ringStyle }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`rounded-full inline-flex items-center justify-center font-bold flex-shrink-0 ${className}`}
      style={{ ...dims, ...ringStyle, background: colorFor(name || "·"), color: "var(--arbor-on-accent)", fontSize: Math.round(size * 0.4) }}
    >
      {initialsOf(name)}
    </span>
  );
}

export default Avatar;
