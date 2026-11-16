import { useEffect, useId, useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { RotateCcw, RotateCw } from 'lucide-react';
import { STORM_BAND, WHEEL_LIMIT, WHEEL_STEP, clampWheel, pointerAngle, wheelDrag } from './paperBoatRules';
import { CLOTH_GRAIN, WheelDisc, fade, mix, mk } from './PaperBoatArt';

/** The paper wheel: a card disc pinned behind a paper pocket at the book's
 * edge, its top showing through, a thumb notch cut in the pocket. Drag around
 * its centre to turn it (a finger on it also holds it against the wind), or use
 * the two buttons, or the arrow keys when it has focus. It is a physical object,
 * so it is the same way round in both languages: clockwise is clockwise. */
export interface PaperWheelProps {
  angle: number;
  enabled: boolean;
  /** Spread one: the wheel waits tucked in its pocket. */
  tucked: boolean;
  /** 'storm' shows the steady band at the top; 'lanes' the three channel marks. */
  marks: 'storm' | 'lanes';
  steady: boolean;
  label: string;
  valueText: string;
  leftLabel: string;
  rightLabel: string;
  onTurn: (angle: number) => void;
  onHold: (held: boolean) => void;
}
const CX = 110, CY = 108;
const arc = (r: number, from: number, to: number) => {
  const p = (a: number) => [CX + r * Math.sin((a * Math.PI) / 180), CY - r * Math.cos((a * Math.PI) / 180)];
  const [x1, y1] = p(from), [x2, y2] = p(to);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

export function PaperWheel({ angle, enabled, tucked, marks, steady, label, valueText, leftLabel, rightLabel, onTurn, onHold }: PaperWheelProps) {
  const surface = useRef<SVGSVGElement>(null);
  const clip = `${useId().replace(/[^a-zA-Z0-9-]/g, '')}-clip`;
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
    const scale = box.width / 220, cx = box.left + CX * scale, cy = box.top + CY * scale, id = event.pointerId;
    let last = pointerAngle(event.clientX - cx, event.clientY - cy);
    onHold(true);
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const next = pointerAngle(e.clientX - cx, e.clientY - cy);
      // Very near the pin the angle is noise: hold still there.
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

  return <div className="pb-wheel-row" dir="ltr" data-tucked={tucked}>
    <button type="button" className="pb-steer" data-pb-steer="left" aria-label={leftLabel} disabled={!enabled} onClick={() => onTurn(clampWheel(angle - WHEEL_STEP))}><RotateCcw size={26} aria-hidden="true" /></button>
    <div className="pb-wheel" role="slider" tabIndex={enabled ? 0 : -1} aria-label={label} aria-valuemin={-WHEEL_LIMIT} aria-valuemax={WHEEL_LIMIT} aria-valuenow={Math.round(angle)} aria-valuetext={valueText} aria-disabled={!enabled} data-pb-wheel="" data-steady={steady} onKeyDown={key}>
      <svg ref={surface} className="pb-wheel__svg" viewBox="0 0 220 168" aria-hidden="true" focusable="false" data-pb-wheel-disc="" onPointerDown={down}>
        {/* the marks printed on the page above the pocket */}
        {marks === 'storm'
          ? <path d={arc(103, -STORM_BAND, STORM_BAND)} style={{ fill: 'none', stroke: steady ? mk('sun') : fade('gold-light', 80), strokeWidth: 7, strokeLinecap: 'round' }} />
          : [-60, 0, 60].map(a => <path key={a} d={arc(103, a - 3, a + 3)} style={{ fill: 'none', stroke: fade('gold-light', 85), strokeWidth: 6, strokeLinecap: 'round' }} />)}
        <path d={`M${CX - 6} 0 L${CX + 6} 0 L${CX} 7 Z`} style={{ fill: mk('gold') }} />
        <defs><clipPath id={clip}><rect x="-20" y="-20" width="260" height="188" /></clipPath></defs>
        <g clipPath={`url(#${clip})`}><g className="pb-wheel__tuck">
          <ellipse cx={CX + 3} cy={CY + 6} rx="80" ry="80" style={{ fill: fade('shadow', 22) }} />
          <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${CX}px ${CY}px` }}><g transform={`translate(${CX - 100} ${CY - 100})`}><WheelDisc /></g></g>
        </g></g>
        {/* the pocket, with its thumb notch */}
        <path d={`M0 132 L${CX - 26} 132 A26 22 0 0 0 ${CX + 26} 132 L220 132 L220 168 L0 168 Z`} style={{ fill: fade('shadow', 30) }} transform="translate(0 -3)" />
        <path d={`M0 132 L${CX - 26} 132 A26 22 0 0 0 ${CX + 26} 132 L220 132 L220 168 L0 168 Z`} style={{ fill: mk('indigo') }} />
        <path d={`M8 138 L${CX - 30} 138 M${CX + 30} 138 L212 138`} style={{ stroke: mk('gold-light'), strokeWidth: 1.6, strokeDasharray: '5 4', opacity: 0.8 }} />
        <path d={`M0 132 L${CX - 26} 132 A26 22 0 0 0 ${CX + 26} 132 L220 132`} style={{ fill: 'none', stroke: mix('indigo', 50, 'bluebell'), strokeWidth: 2 }} />
      </svg>
      <span className="pb-wheel__cloth" style={{ backgroundImage: CLOTH_GRAIN }} aria-hidden="true" />
    </div>
    <button type="button" className="pb-steer" data-pb-steer="right" aria-label={rightLabel} disabled={!enabled} onClick={() => onTurn(clampWheel(angle + WHEEL_STEP))}><RotateCw size={26} aria-hidden="true" /></button>
  </div>;
}
