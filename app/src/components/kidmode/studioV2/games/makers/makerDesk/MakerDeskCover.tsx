import { useId } from 'react';
import { DESK_KIT } from './deskKit';

/** Maker Desk cover, composed from kit pictures: the arched studio of Horizon
 * Valley, the TrailBench with its lid screen awake, and Chock beside it. One
 * clear subject (the bench and its glowing lid) so it reads at 80px; it fills
 * its box and slices to any shape (tile, book row, card window, round
 * sticker). Kit art only; the glow is the maker palette. */
export default function MakerDeskCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const id = useId();
  const small = size === 'tile';
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={`${id}glow`} cx=".5" cy=".5" r=".5"><stop offset="0" style={{ stopColor: 'var(--mk-sea)', stopOpacity: 0.55 }} /><stop offset="1" style={{ stopColor: 'var(--mk-sea)', stopOpacity: 0 }} /></radialGradient>
      <radialGradient id={`${id}floor`} cx=".5" cy=".5" r=".5"><stop offset="0" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.3 }} /><stop offset="1" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0 }} /></radialGradient>
    </defs>
    <image href={small ? DESK_KIT.room.src480 ?? DESK_KIT.room.src : DESK_KIT.room.src} x="-10" y="-96" width="420" height="420" preserveAspectRatio="xMidYMid slice" />
    <ellipse cx="226" cy="262" rx="150" ry="20" fill={`url(#${id}floor)`} />
    <image href={small ? DESK_KIT.bench.src480 ?? DESK_KIT.bench.src : DESK_KIT.bench.src} x="84" y="68" width="286" height="204" />
    <ellipse cx="250" cy="96" rx="120" ry="52" fill={`url(#${id}glow)`} />
    <image href={DESK_KIT.chockIdle.src} x="-14" y="118" width="186" height="186" />
  </svg>;
}
