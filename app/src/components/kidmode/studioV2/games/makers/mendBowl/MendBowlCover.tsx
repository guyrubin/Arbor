import { useId } from 'react';
import '../makerPalette.css';
import { LinenCloth, MendedBowl } from './BowlArt';

/** Mend the Bowl cover: the mended celadon bowl, gold in its seams, on the
 * indigo linen. One subject that still reads at 80px; the same drawing as the
 * play, so the tile shows what the child will make. */
export default function MendBowlCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  // The card window is wide (up to ~3:1), so the card drawing is smaller: the whole bowl stays in view.
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={`${uid}-glow`} cx=".36" cy=".2" r=".85">
        <stop offset="0" style={{ stopColor: 'var(--mk-sky-pale)', stopOpacity: 0.32 }} />
        <stop offset=".6" style={{ stopColor: 'var(--mk-sky-pale)', stopOpacity: 0 }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-night)', stopOpacity: 0.45 }} />
      </radialGradient>
    </defs>
    <LinenCloth uid={`${uid}c`} shape="full" />
    <rect width="400" height="300" fill={`url(#${uid}-glow)`} />
    <g transform={size === 'tile' ? 'translate(200 158) scale(1.08) translate(-220 -178)' : 'translate(200 154) scale(.64) translate(-220 -178)'}>
      <MendedBowl glaze="celadon" pattern={1} uid={`${uid}b`} />
    </g>
  </svg>;
}
