import { useEffect, useId, useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { STORM_BAND, WHEEL_LIMIT, WHEEL_STEP, clampWheel, pointerAngle, wheelDrag } from './paperBoatRules';
import { WheelDisc, fade, mix, mk } from './PaperBoatArt';

/** The boat's wheel: a pale-wood toy wheel on a white ceramic stand, in the
 * dock under the book. Drag around its centre to turn it (a finger on it also
 * holds it against the wind), or use the two buttons the dock puts beside it,
 * or the arrow keys when it has focus. It is a physical object, so it is the same way round
 * in both languages: clockwise is clockwise. The marks over it are interface:
 * a ring in the signal colour marks where to turn to, teal marks steady. */
export interface PaperWheelProps {
  angle: number;
  /** A turn shown but not made (the hint hand's demonstration). */
  nudge?: number;
  enabled: boolean;
  /** Spread one, and once moored: the wheel rests low in its stand. */
  tucked: boolean;
  /** 'steadyBand' shows the steady band at the top; 'lanes' the three channel marks. */
  marks: 'steadyBand' | 'lanes' | 'noMarks';
  steady: boolean;
  /** How far the steadiness has gathered, 0 … 1 (the band fills like a wait ring). */
  calm: number;
  /** The wheel angle to turn to now, if there is one (its mark is ringed). */
  aim: number | null;
  label: string;
  valueText: string;
  onTurn: (angle: number) => void;
  onHold: (held: boolean) => void;
}
export const WHEEL_BOX = { w: 220, h: 172, cx: 110, cy: 104, rim: 88 } as const;
const { cx: CX, cy: CY } = WHEEL_BOX;
const at = (r: number, a: number) => [CX + r * Math.sin((a * Math.PI) / 180), CY - r * Math.cos((a * Math.PI) / 180)];
const arc = (r: number, from: number, to: number) => {
  const [x1, y1] = at(r, from), [x2, y2] = at(r, to);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};
const SEGMENTS = 5;

export function PaperWheel({ angle, nudge = 0, enabled, tucked, marks, steady, calm, aim, label, valueText, onTurn, onHold }: PaperWheelProps) {
  const surface = useRef<SVGSVGElement>(null);
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, '');
  const angleRef = useRef(angle); angleRef.current = angle;
  const enabledRef = useRef(enabled); enabledRef.current = enabled;
  const release = useRef<(() => void) | null>(null);
  useEffect(() => () => release.current?.(), []);
  useEffect(() => { if (!enabled) release.current?.(); }, [enabled]);

  const down = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!enabledRef.current || !surface.current) return;
    event.preventDefault(); event.stopPropagation();
    release.current?.();
    const box = surface.current.getBoundingClientRect();
    const scale = box.width / WHEEL_BOX.w, cx = box.left + CX * scale, cy = box.top + CY * scale, id = event.pointerId;
    let last = pointerAngle(event.clientX - cx, event.clientY - cy);
    onHold(true);
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const next = pointerAngle(e.clientX - cx, e.clientY - cy);
      // Very near the hub the angle is noise: hold still there.
      if (Math.hypot(e.clientX - cx, e.clientY - cy) < 12 * scale) return;
      onTurn(wheelDrag(angleRef.current, last, next)); last = next;
    };
    const up = (e: PointerEvent) => { if (e.pointerId === id) stop(); };
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); release.current = null; onHold(false); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    release.current = stop;
  };
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!enabled) return;
    const step = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? WHEEL_STEP : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -WHEEL_STEP : 0;
    if (event.key === 'Home') { event.preventDefault(); event.stopPropagation(); onTurn(0); return; }
    if (!step) return;
    event.preventDefault(); event.stopPropagation();
    onTurn(clampWheel(angle + step));
  };
  const shown = angle + nudge;
  const gathered = Math.round(Math.max(0, Math.min(1, calm)) * SEGMENTS);

  return (
    <div className="pb-wheel" role="slider" tabIndex={enabled ? 0 : -1} aria-label={label} aria-valuemin={-WHEEL_LIMIT} aria-valuemax={WHEEL_LIMIT} aria-valuenow={Math.round(angle)} aria-valuetext={valueText} aria-disabled={!enabled} data-pb-wheel="" data-steady={steady} data-tucked={tucked} dir="ltr" onKeyDown={key}>
      <svg ref={surface} className="pb-wheel__svg" viewBox={`0 0 ${WHEEL_BOX.w} ${WHEEL_BOX.h}`} aria-hidden="true" focusable="false" data-pb-wheel-disc="" onPointerDown={down}>
        <defs>
          <linearGradient id={`${uid}-base`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: mk('white') }} /><stop offset="1" style={{ stopColor: mix('snow', 60, 'chalk') }} /></linearGradient>
          <clipPath id={`${uid}-clip`}><rect x="-20" y="-30" width="260" height="170" /></clipPath>
        </defs>
        {/* the marks over the wheel */}
        {!tucked && marks !== 'noMarks' && (marks === 'steadyBand'
          ? <g className="pb-wheel__marks">
            <path d={arc(100, -STORM_BAND - 3, STORM_BAND + 3)} style={{ fill: 'none', stroke: 'var(--studio-surface)', strokeWidth: 12, strokeLinecap: 'round' }} />
            {Array.from({ length: SEGMENTS }, (_, i) => { const from = -STORM_BAND + (i * 2 * STORM_BAND) / SEGMENTS + 0.9, to = -STORM_BAND + ((i + 1) * 2 * STORM_BAND) / SEGMENTS - 0.9; return <path key={i} d={arc(100, from, to)} style={{ fill: 'none', stroke: i < gathered ? 'var(--studio-teal)' : 'var(--studio-mist)', strokeWidth: 7, strokeLinecap: 'round' }} />; })}
            {!steady && <path d={arc(108, -STORM_BAND - 2, STORM_BAND + 2)} style={{ fill: 'none', stroke: 'var(--studio-signal)', strokeWidth: 2.4, strokeLinecap: 'round' }} />}
          </g>
          : <g className="pb-wheel__marks">{[-60, 0, 60].map(a => { const [x, y] = at(101, a), on = aim !== null && Math.abs(aim - a) < 1; return <g key={a}>
            <circle cx={x} cy={y} r="5" style={{ fill: 'var(--studio-surface)', stroke: 'var(--studio-graphite-soft)', strokeWidth: 1.6 }} />
            {on && <circle cx={x} cy={y} r="9" style={{ fill: 'none', stroke: 'var(--studio-signal)', strokeWidth: 2.6 }} />}
          </g>; })}</g>)}
        <g clipPath={`url(#${uid}-clip)`}><g className="pb-wheel__tuck">
          <ellipse cx={CX + 4} cy={CY + 8} rx="78" ry="78" style={{ fill: fade('shadow', 14) }} />
          <g style={{ transform: `rotate(${shown.toFixed(2)}deg)`, transformOrigin: `${CX}px ${CY}px` }}><g transform={`translate(${CX - 100} ${CY - 100})`}><WheelDisc uid={uid} /></g></g>
        </g></g>
        {/* the ceramic stand, with its teal inlay */}
        <ellipse cx={CX} cy="167" rx="100" ry="5" style={{ fill: fade('shadow', 16) }} />
        <path d={`M14 166 C 14 148 30 138 52 138 L 168 138 C 190 138 206 148 206 166 Z`} fill={`url(#${uid}-base)`} />
        <path d="M22 158 C 30 146 40 142 54 142 L 166 142 C 180 142 190 146 198 158" style={{ fill: 'none', stroke: mk('sea'), strokeWidth: 2.2, strokeLinecap: 'round' }} />
        <path d="M30 141 C 36 139 44 138 52 138 L 168 138" style={{ fill: 'none', stroke: mk('white'), strokeWidth: 1.6, strokeLinecap: 'round' }} />
      </svg>
    </div>
  );
}
