import React from "react";

/**
 * Avatar — a person's photo when available, otherwise their initials on a
 * deterministic brand-tinted background. Used for the parent and (optionally)
 * each child. Google sign-in supplies `photoURL`; the CSP allows lh3.* images.
 */
const PALETTE = ["#2f6d52", "#2f5a73", "#9a5b2b", "#7a4a86", "#b3463c", "#3a7d6b", "#5b6e2f"];

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
  const ringStyle: React.CSSProperties = ring ? { boxShadow: "0 0 0 2px var(--arbor-paper-elevated), 0 0 0 3.5px rgba(52,178,119,0.35)" } : {};

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
      className={`rounded-full inline-flex items-center justify-center font-bold text-white flex-shrink-0 ${className}`}
      style={{ ...dims, ...ringStyle, background: colorFor(name || "·"), fontSize: Math.round(size * 0.4) }}
    >
      {initialsOf(name)}
    </span>
  );
}

export default Avatar;
