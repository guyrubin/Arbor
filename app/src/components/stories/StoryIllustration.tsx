import React from "react";

/**
 * Deterministic warm geometric illustration derived from a seed string (story
 * title + page). No external image API — pure SVG patterns.
 */
const PALETTES: string[][] = [
  ["#d7aa55", "#e2562d", "#6f9e6f"],
  ["#68B4FF", "#A07AF8", "#18F0D2"],
  ["#FFC07A", "#FF5822", "#f4d991"],
  ["#9bbf5a", "#38C8F0", "#CCA8FF"],
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
  const pal = PALETTES[h % PALETTES.length];
  const cx = 30 + (h % 40);
  const cy = 30 + ((h >> 3) % 40);
  const r = 18 + (h % 16);
  const rot = h % 360;

  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="Story illustration" preserveAspectRatio="xMidYMid slice">
      <rect width="100" height="100" fill={pal[0]} opacity="0.12" />
      <circle cx={cx} cy={cy} r={r} fill={pal[1]} opacity="0.55" />
      <g transform={`rotate(${rot} 50 50)`}>
        <rect x="55" y="20" width="30" height="30" rx="6" fill={pal[2]} opacity="0.5" />
      </g>
      <polygon
        points={`${20 + (h % 10)},80 ${50},${40 + (h % 20)} ${80 - (h % 10)},80`}
        fill={pal[0]}
        opacity="0.45"
      />
      <circle cx={70 + (h % 8)} cy={25} r={6} fill={pal[1]} opacity="0.8" />
    </svg>
  );
}

export default StoryIllustration;
