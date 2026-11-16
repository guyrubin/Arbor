import { memo, useId } from 'react';
import { leafLab, labLevel } from './seasonDialRules';

/** Aya's LeafLab, read out on the terrace: how wet the soil of the tree's bed
 * is, how much light falls on it and how warm the air is. Three pictured
 * gauges, each a function of the year alone, each read by how full it is
 * (never a number, never colour alone). The words for a screen reader come
 * from the same three levels. */
function Gauges({ year }: { year: number }) {
  const id = useId().replace(/:/g, '');
  const lab = leafLab(year);
  const wet = 22 - 17 * lab.moisture, warm = 17.5 - 13 * lab.warmth, rays = 2.2 + 4.6 * lab.light;
  return <span className="sd-lab__gauges" dir="ltr">
    <svg viewBox="0 0 24 24" data-sd-gauge="moisture" data-level={labLevel(lab.moisture)} focusable="false">
      <clipPath id={`${id}drop`}><path d="M12 2.6C8.6 7.2 5.6 10.8 5.6 14.8A6.4 6.4 0 0 0 18.4 14.8C18.4 10.8 15.4 7.2 12 2.6Z" /></clipPath>
      <path d="M12 2.6C8.6 7.2 5.6 10.8 5.6 14.8A6.4 6.4 0 0 0 18.4 14.8C18.4 10.8 15.4 7.2 12 2.6Z" style={{ fill: 'var(--studio-mist)' }} />
      <rect x="4" y={wet.toFixed(2)} width="16" height="22" clipPath={`url(#${id}drop)`} style={{ fill: 'var(--mk-water)' }} />
      <path d="M12 2.6C8.6 7.2 5.6 10.8 5.6 14.8A6.4 6.4 0 0 0 18.4 14.8C18.4 10.8 15.4 7.2 12 2.6Z" style={{ fill: 'none', stroke: 'var(--studio-graphite)', strokeWidth: 1.5, strokeLinejoin: 'round' }} />
    </svg>
    <svg viewBox="0 0 24 24" data-sd-gauge="light" data-level={labLevel(lab.light)} focusable="false">
      {Array.from({ length: 8 }, (_, i) => <line key={i} x1="12" y1={(12 - 6.4).toFixed(1)} x2="12" y2={(12 - 6.4 - rays).toFixed(2)} transform={`rotate(${i * 45} 12 12)`} style={{ stroke: 'var(--studio-graphite)', strokeWidth: 1.7, strokeLinecap: 'round' }} />)}
      <circle cx="12" cy="12" r="4.6" style={{ fill: 'var(--studio-mist)' }} />
      <circle cx="12" cy="12" r={(4.6 * Math.sqrt(lab.light)).toFixed(2)} style={{ fill: 'var(--mk-amber)' }} />
      <circle cx="12" cy="12" r="4.6" style={{ fill: 'none', stroke: 'var(--studio-graphite)', strokeWidth: 1.5 }} />
    </svg>
    <svg viewBox="0 0 24 24" data-sd-gauge="warmth" data-level={labLevel(lab.warmth)} focusable="false">
      <path d="M9.4 4.6A2.6 2.6 0 0 1 14.6 4.6L14.6 13.4A4.6 4.6 0 1 1 9.4 13.4Z" style={{ fill: 'var(--studio-mist)' }} />
      <rect x="10.9" y={warm.toFixed(2)} width="2.2" height={(18 - warm).toFixed(2)} rx="1.1" style={{ fill: `color-mix(in srgb, var(--mk-bluebell), var(--mk-poppy) ${Math.round(lab.warmth * 100)}%)` }} />
      <circle cx="12" cy="17.2" r="2.7" style={{ fill: `color-mix(in srgb, var(--mk-bluebell), var(--mk-poppy) ${Math.round(lab.warmth * 100)}%)` }} />
      <path d="M9.4 4.6A2.6 2.6 0 0 1 14.6 4.6L14.6 13.4A4.6 4.6 0 1 1 9.4 13.4Z" style={{ fill: 'none', stroke: 'var(--studio-graphite)', strokeWidth: 1.5, strokeLinejoin: 'round' }} />
    </svg>
  </span>;
}
export const LeafLabGauges = memo(Gauges);
