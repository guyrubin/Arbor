import React from "react";

/**
 * Deterministic, on-brand storybook backdrop derived from a seed (story title + page).
 * A soft illustrated landscape — layered sky, rolling hills and a gentle sun in the
 * Arbor palette — NOT random geometry. No external image API. This is the branded
 * fallback shown before/while a hero scene generates, so a card never reads as an
 * abstract placeholder (D6 / kill the "free version" look).
 */

// Curated, harmonious scenes — each a calm time-of-day in brand-adjacent tones.
const SCENES: { sky: [string, string]; hills: [string, string, string]; sun: string }[] = [
  { sky: ["#fbeede", "#f6d9b8"], hills: ["#cfe0c2", "#9bbf8f", "#6f9e6f"], sun: "#f3b24d" }, // warm dawn
  { sky: ["#e4f0fa", "#cfe6f6"], hills: ["#bcd9c6", "#8fc3a3", "#5fae86"], sun: "#fce39a" }, // soft day
  { sky: ["#ece9fb", "#dcd6f4"], hills: ["#c7c0e8", "#a89cda", "#7a6bd8"], sun: "#f4d991" }, // dusk lavender
  { sky: ["#fbe1ea", "#f6cdd9"], hills: ["#e7c6b6", "#d79f86", "#c2785f"], sun: "#f6b27a" }, // soft rose
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function StoryIllustration({ seed, className = "" }: { seed: string; className?: string }) {
  const h = hash(seed);
  const sc = SCENES[h % SCENES.length];
  // Unique, valid gradient id per instance (useId can contain ":"/"," — strip them).
  const gid = "arborsky-" + React.useId().replace(/[^a-zA-Z0-9]/g, "");

  const sunX = 24 + (h % 56); // 24..79
  const sunY = 22 + ((h >> 4) % 14); // 22..35
  const far = 56 + (h % 8); // crest heights vary gently by seed
  const mid = 66 + ((h >> 2) % 8);
  const near = 78 + ((h >> 5) % 8);

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Story illustration"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sc.sky[0]} />
          <stop offset="1" stopColor={sc.sky[1]} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${gid})`} />
      {/* gentle sun / moon with a soft halo */}
      <circle cx={sunX} cy={sunY} r="15" fill={sc.sun} opacity="0.18" />
      <circle cx={sunX} cy={sunY} r="9" fill={sc.sun} opacity="0.9" />
      {/* three layered hills for depth (far → near) */}
      <path d={`M0 ${far} Q 50 ${far - 12} 100 ${far} L100 100 0 100 Z`} fill={sc.hills[0]} />
      <path d={`M0 ${mid} Q 35 ${mid - 14} 100 ${mid} L100 100 0 100 Z`} fill={sc.hills[1]} />
      <path d={`M0 ${near} Q 60 ${near - 12} 100 ${near} L100 100 0 100 Z`} fill={sc.hills[2]} />
    </svg>
  );
}

export default StoryIllustration;
