import { useId } from 'react';
import '../makerPalette.css';
import { KitTable, MendedBowl } from './BowlArt';
import { BOWL_CENTRE } from './mendBowlPatterns';
import { KIT_CHOCK } from './mendKit';

/** Mend the Bowl cover, a kit picture: the Wonderworks workshop table from
 * above (shipped), the mended celadon bowl on its linen with gold in its
 * seams, and Chock keeping it company (shipped). One subject that still reads
 * at 80px; the bowl is the same drawing as the play, so the tile shows what
 * the child will make. */
export default function MendBowlCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  // The card window is wide (up to ~3:1) and the Studio stands the child's hero at one end of it,
  // so the card keeps the bowl smaller and in the middle. The table is scaled on its own: it always fills the window.
  const tile = size === 'tile', bowl = tile ? { s: 1.2, x: 186, y: 150 } : { s: 0.7, x: 196, y: 150 }, table = tile ? 1.2 : 0.86;
  const chock = tile ? { w: 150, x: 262, y: 150 } : { w: 100, x: 34, y: 118 };
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    <g transform={`translate(${bowl.x} ${bowl.y}) scale(${table}) translate(${-BOWL_CENTRE.x} ${-BOWL_CENTRE.y})`}><KitTable small={tile} /></g>
    <g transform={`translate(${bowl.x} ${bowl.y}) scale(${bowl.s}) translate(${-BOWL_CENTRE.x} ${-BOWL_CENTRE.y})`}><MendedBowl glaze="celadon" pattern={1} uid={`${uid}b`} /></g>
    <image href={KIT_CHOCK.src} x={chock.x} y={chock.y} width={chock.w} height={chock.w * KIT_CHOCK.h / KIT_CHOCK.w} />
  </svg>;
}
