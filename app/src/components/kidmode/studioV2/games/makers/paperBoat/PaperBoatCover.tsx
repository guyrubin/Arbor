import { useId } from 'react';
import { BoatArt, fade } from './PaperBoatArt';
import { KIT_COVER } from './paperBoatKit';

/** The Paper Boat cover: the kit's Bright Vale stream and its stone bridge
 * (the book's first spread), with the white paper boat sailing on the pool in
 * front. Fills its box (the box sets the size); one clear subject, the boat,
 * so it reads at 80px. No text. */
export default function PaperBoatCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const id = useId().replace(/[^a-zA-Z0-9-]/g, '');
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    <image href={KIT_COVER.src} x="-70" y="-60" width="480" height="360" preserveAspectRatio="xMidYMid slice" />
    <ellipse cx="206" cy="246" rx="92" ry="13" style={{ fill: fade('shadow', 26) }} />
    <ellipse cx="206" cy="244" rx="98" ry="16" style={{ fill: 'none', stroke: fade('white', 80), strokeWidth: 2.4 }} />
    <g transform="translate(112 112) scale(2.35)"><BoatArt uid={`${id}-cover`} /></g>
  </svg>;
}
