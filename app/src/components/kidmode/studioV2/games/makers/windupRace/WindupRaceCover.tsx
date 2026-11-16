import { useId } from 'react';

/** Wind-up Racer cover: the tile art and the intro/result card window.
 * Fills its box (the box sets the size); one scene for both sizes.
 * Placeholder: neutral Studio night sky over the cream stage. */
export default function WindupRaceCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const id = useId();
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--studio-sky)' }} /><stop offset="1" style={{ stopColor: 'var(--studio-ink-soft)' }} /></linearGradient>
      <radialGradient id={`${id}stage`} cx=".35" cy=".2" r=".9"><stop offset="0" style={{ stopColor: 'var(--studio-canvas-soft)' }} /><stop offset="1" style={{ stopColor: 'var(--studio-canvas)' }} /></radialGradient>
    </defs>
    <rect width="400" height="300" fill={`url(#${id}sky)`} />
    <ellipse cx="200" cy="258" rx="230" ry="96" fill={`url(#${id}stage)`} />
    <ellipse cx="200" cy="236" rx="88" ry="10" opacity=".12" style={{ fill: 'var(--studio-deep-ink)' }} />
    <rect x="132" y="206" width="136" height="16" rx="8" style={{ fill: 'color-mix(in srgb, var(--studio-canvas) 88%, var(--studio-ink-soft))' }} /><path d="M176 202v-78" strokeWidth="6" strokeLinecap="round" style={{ stroke: 'var(--studio-ink-soft)' }} /><path d="M179 126h48l-12 16 12 16h-48z" style={{ fill: 'var(--studio-action-gold)' }} />
  </svg>;
}
