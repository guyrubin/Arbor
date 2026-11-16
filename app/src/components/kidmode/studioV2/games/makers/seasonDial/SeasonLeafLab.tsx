import { memo, useId } from 'react';
import { labLevel, type LeafLab } from './seasonDialRules';
import type { Ask, Level } from './seasonDialPlay';

/** Aya's LeafLab on the HUD glass: how wet the bed is, how much light falls
 * on it and how warm the air is. Three pictured gauges, each read by how full
 * it is (never a number, never colour alone). When the seedling asks for
 * something (chapter two), each gauge carries a three-step ladder: the step
 * the reading stands on is filled, the step that is asked for wears a ring,
 * and a gauge that is right shows a tick. Chrome in v30 tokens; the three
 * pictures keep the scene's colours. */
const GAUGES = ['moisture', 'light', 'warmth'] as const;
type Gauge = typeof GAUGES[number];
function Picture({ gauge, value, id }: { gauge: Gauge; value: number; id: string }) {
  if (gauge === 'moisture') {
    const wet = 22 - 17 * value;
    return <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <clipPath id={`${id}drop`}><path d="M12 2.6C8.6 7.2 5.6 10.8 5.6 14.8A6.4 6.4 0 0 0 18.4 14.8C18.4 10.8 15.4 7.2 12 2.6Z" /></clipPath>
      <path d="M12 2.6C8.6 7.2 5.6 10.8 5.6 14.8A6.4 6.4 0 0 0 18.4 14.8C18.4 10.8 15.4 7.2 12 2.6Z" style={{ fill: 'var(--studio-mist)' }} />
      <rect x="4" y={wet.toFixed(2)} width="16" height="22" clipPath={`url(#${id}drop)`} style={{ fill: 'var(--mk-water)' }} />
      <path d="M12 2.6C8.6 7.2 5.6 10.8 5.6 14.8A6.4 6.4 0 0 0 18.4 14.8C18.4 10.8 15.4 7.2 12 2.6Z" style={{ fill: 'none', stroke: 'var(--studio-graphite)', strokeWidth: 1.5, strokeLinejoin: 'round' }} />
    </svg>;
  }
  if (gauge === 'light') {
    const rays = 2.2 + 4.6 * value;
    return <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => <line key={i} x1="12" y1="5.6" x2="12" y2={(5.6 - rays).toFixed(2)} transform={`rotate(${i * 45} 12 12)`} style={{ stroke: 'var(--studio-graphite)', strokeWidth: 1.7, strokeLinecap: 'round' }} />)}
      <circle cx="12" cy="12" r="4.6" style={{ fill: 'var(--studio-mist)' }} />
      <circle cx="12" cy="12" r={(4.6 * Math.sqrt(Math.max(0, value))).toFixed(2)} style={{ fill: 'var(--mk-amber)' }} />
      <circle cx="12" cy="12" r="4.6" style={{ fill: 'none', stroke: 'var(--studio-graphite)', strokeWidth: 1.5 }} />
    </svg>;
  }
  const warm = 17.5 - 13 * value, paint = `color-mix(in srgb, var(--mk-bluebell), var(--mk-poppy) ${Math.round(value * 100)}%)`;
  return <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
    <path d="M9.4 4.6A2.6 2.6 0 0 1 14.6 4.6L14.6 13.4A4.6 4.6 0 1 1 9.4 13.4Z" style={{ fill: 'var(--studio-mist)' }} />
    <rect x="10.9" y={warm.toFixed(2)} width="2.2" height={(18 - warm).toFixed(2)} rx="1.1" style={{ fill: paint }} />
    <circle cx="12" cy="17.2" r="2.7" style={{ fill: paint }} />
    <path d="M9.4 4.6A2.6 2.6 0 0 1 14.6 4.6L14.6 13.4A4.6 4.6 0 1 1 9.4 13.4Z" style={{ fill: 'none', stroke: 'var(--studio-graphite)', strokeWidth: 1.5, strokeLinejoin: 'round' }} />
  </svg>;
}
function Gauges({ lab, ask }: { lab: LeafLab; ask?: Ask | null }) {
  const id = useId().replace(/:/g, '');
  return <span className="sd-lab__gauges" dir="ltr">
    {GAUGES.map(gauge => {
      const have = labLevel(lab[gauge]), want: Level | null = ask ? ask[gauge] : null, right = ask ? want === null || want === have : false;
      return <span key={gauge} className="sd-lab__gauge" data-sd-gauge={gauge} data-level={have} data-want={want ?? undefined} data-right={ask ? right : undefined}>
        <Picture gauge={gauge} value={Math.round(lab[gauge] * 50) / 50} id={`${id}${gauge}`} />
        {ask && <span className="sd-lab__ladder" aria-hidden="true">
          {[2, 1, 0].map(step => <i key={step} data-on={have === step || undefined} data-want={want === step || undefined} />)}
          {right && <svg className="sd-lab__tick" viewBox="0 0 16 16"><path d="M3.5 8.4l3 3 6-6.6" /></svg>}
        </span>}
      </span>;
    })}
  </span>;
}
export const LeafLabGauges = memo(Gauges);
