import { useId } from 'react';

/** Clay Theatre cover: the tile art and the intro/result card window.
 * Fills its box (the box sets the size); one scene for both sizes.
 * Placeholder: neutral Studio night sky over the cream stage. */
export default function ClayTheatreCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const id = useId();
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--studio-sky)' }} /><stop offset="1" style={{ stopColor: 'var(--studio-ink-soft)' }} /></linearGradient>
      <radialGradient id={`${id}stage`} cx=".35" cy=".2" r=".9"><stop offset="0" style={{ stopColor: 'var(--studio-canvas-soft)' }} /><stop offset="1" style={{ stopColor: 'var(--studio-canvas)' }} /></radialGradient>
    </defs>
    <rect width="400" height="300" fill={`url(#${id}sky)`} />
    <ellipse cx="200" cy="258" rx="230" ry="96" fill={`url(#${id}stage)`} />
    <ellipse cx="200" cy="236" rx="88" ry="10" opacity=".12" style={{ fill: 'var(--studio-deep-ink)' }} />
    <rect x="120" y="128" width="160" height="96" rx="8" style={{ fill: 'var(--studio-canvas-soft)' }} /><path d="M120 128h48c-6 34-6 62 0 96h-48z" style={{ fill: 'color-mix(in srgb, var(--arbor-pink) 35%, var(--studio-canvas))' }} /><path d="M280 128h-48c6 34 6 62 0 96h48z" style={{ fill: 'color-mix(in srgb, var(--arbor-pink) 35%, var(--studio-canvas))' }} /><rect x="114" y="120" width="172" height="12" rx="6" style={{ fill: 'var(--studio-action-gold)' }} />
  </svg>;
}
