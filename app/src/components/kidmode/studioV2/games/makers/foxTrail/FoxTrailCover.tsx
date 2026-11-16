import { useId } from 'react';
import { PEP_SIDE, PLATES, SPRITES } from './foxKit';

/** Pep's Trail cover: Pep, in his scout harness, running the Sky Gardens path
 * at dusk past a lamp he has just woken, toward the Dome's sun. A kit
 * picture throughout: the trail's own plates and the kit's own Pep, layered.
 * Fills its box; one clear subject at 80 px. */
export default function FoxTrailCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const id = useId().replace(/:/g, '');
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={`${id}glow`}><stop offset="0" style={{ stopColor: 'var(--mk-butter)', stopOpacity: 0.95 }} /><stop offset=".4" style={{ stopColor: 'var(--mk-sun)', stopOpacity: 0.4 }} /><stop offset="1" style={{ stopColor: 'var(--mk-sun)', stopOpacity: 0 }} /></radialGradient>
      <radialGradient id={`${id}shade`}><stop offset="0" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.5 }} /><stop offset="1" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0 }} /></radialGradient>
    </defs>
    <image href={PLATES.sky.dusk.src} x="-30" y="-398" width="470" height="662" preserveAspectRatio="none" />
    <image href={PLATES.gardens.dusk.src} x="-150" y="94" width="430" height="133" preserveAspectRatio="none" />
    <image href={PLATES.dome.dusk.src} x="214" y="72" width="270" height="140" preserveAspectRatio="none" />
    <image href={PLATES.wall.dusk.src} x="-70" y="168" width="560" height="183" preserveAspectRatio="none" />
    {/* the Dome's sun, already answering */}
    <circle cx="338" cy="118" r="70" style={{ fill: `url(#${id}glow)` }} />
    <image href={SPRITES.sunLit.src} x="296" y="76" width="84" height="84" />
    {/* a path lamp he has just woken */}
    <circle cx="92" cy="170" r="34" style={{ fill: `url(#${id}glow)` }} />
    <image href={SPRITES.lamp.src} x="66" y="150" width="58" height="71" />
    <ellipse cx="196" cy="246" rx="62" ry="9" style={{ fill: `url(#${id}shade)` }} />
    <g transform="translate(268 104) scale(-1 1) rotate(5 70 110)"><image href={PEP_SIDE.src} width="146" height={146 * PEP_SIDE.h / PEP_SIDE.w} /></g>
  </svg>;
}
