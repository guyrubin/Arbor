import { useId } from 'react';

/** The Paper Boat cover: the tile art and the intro/result card window.
 * Fills its box (the box sets the size); one scene for both sizes.
 * Placeholder: neutral Studio night sky over the cream stage. */
export default function PaperBoatCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const id = useId();
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--studio-sky)' }} /><stop offset="1" style={{ stopColor: 'var(--studio-ink-soft)' }} /></linearGradient>
      <radialGradient id={`${id}stage`} cx=".35" cy=".2" r=".9"><stop offset="0" style={{ stopColor: 'var(--studio-canvas-soft)' }} /><stop offset="1" style={{ stopColor: 'var(--studio-canvas)' }} /></radialGradient>
    </defs>
    <rect width="400" height="300" fill={`url(#${id}sky)`} />
    <ellipse cx="200" cy="258" rx="230" ry="96" fill={`url(#${id}stage)`} />
    <ellipse cx="200" cy="236" rx="88" ry="10" opacity=".12" style={{ fill: 'var(--studio-deep-ink)' }} />
    <path d="M122 196h156l-28 34H150z" style={{ fill: 'color-mix(in srgb, var(--studio-canvas) 88%, var(--studio-ink-soft))' }} /><path d="M200 120v76l52-0z" style={{ fill: 'var(--studio-canvas-soft)' }} />
  </svg>;
}
