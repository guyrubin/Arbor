import { memo, type CSSProperties, type ReactNode } from 'react';
import { LINKAGE, crankPin, pistonLift, rodLean, strokeFraction, type MachineId, type PartId } from './crankWorksRules';
import { KIT_FLOWER } from './crankKit';

/* The three machines, drawn in the kit's tool language (pearl-white shell,
   graphite, orange controls, cyan diagnostics) so they belong on the
   TrailBench behind them. One daylight from the top-left; every colour from
   the makers' palette (--mk-*) through var() and color-mix(). The drawing is
   320 by 470; a machine's foot meets the bench deck at y = 385, and the kit
   picture of the bench is laid under it in the same units (STAGE_BOX). All
   three machines use the same linkage, and one angle places every part. */

export const VIEW_W = 320, VIEW_H = 470, DECK_Y = 385;
/** Where the stage picture sits in drawing units (it runs past the drawing on every side). */
export const STAGE_BOX = { x: -240, y: -63.333, w: 800, h: 533.333 } as const;
/** Each machine's shaft, and how near to it a finger takes hold of the wheel. */
export const SHAFT: Readonly<Record<MachineId, { readonly x: number; readonly y: number }>> = { engine: { x: 148, y: 287 }, toy: { x: 148, y: 318 }, writer: { x: 132, y: 287 } };
export const GRAB: Readonly<Record<MachineId, number>> = { engine: 92, toy: 78, writer: 92 };
/** Where a fingertip rests on the thing that turns (wheel rim, handle knob). */
export const GRIP: Readonly<Record<MachineId, number>> = { engine: 73, toy: 54, writer: 73 };
const { l: L } = LINKAGE;
const DEG = 180 / Math.PI;

const mk = (name: string) => `var(--mk-${name})`;
const mix = (a: string, pct: number, b: string) => `color-mix(in srgb, ${mk(a)} ${pct}%, ${b === 'transparent' ? 'transparent' : mk(b)})`;
const fill = (v: string): CSSProperties => ({ fill: v });
const stop = (v: string, opacity?: number): CSSProperties => (opacity === undefined ? { stopColor: v } : { stopColor: v, stopOpacity: opacity });
const ink = (alpha: number) => mix('shadow', alpha, 'transparent');
const light = (alpha: number) => mix('white', alpha, 'transparent');
const CYAN = mix('sea', 62, 'sky'), CYAN_DIM = mix('sea', 45, 'transparent');

/** Everything that changes with the angle, worked out once per frame. */
export interface Pose {
  theta: number; deg: number; machine: MachineId;
  sx: number; sy: number;
  pin: { x: number; y: number };
  wristY: number;
  lean: number;
  /** Where the slide is in its stroke: 0 at the bottom, 1 at the top. */
  lift01: number;
}
export function poseOf(theta: number, machine: MachineId = 'engine'): Pose {
  const p = crankPin(theta), { x: sx, y: sy } = SHAFT[machine];
  return { theta, deg: theta * DEG, machine, sx, sy, pin: { x: sx + p.x, y: sy + p.y }, wristY: sy - pistonLift(theta), lean: rodLean(theta), lift01: strokeFraction(theta) };
}
/** The part of each machine that the eye follows up and down, above the glass:
 * the piston's knob, the flower's seat, the pen. */
export function moverOf(pose: Pose): { x: number; y: number } {
  if (pose.machine === 'toy') return { x: pose.sx, y: pose.wristY - 74 };
  if (pose.machine === 'writer') return { x: pose.sx + 44, y: pose.wristY - 104 };
  return { x: pose.sx, y: pose.wristY - 116 };
}

function about(x: number, y: number, deg: number, cx: number, cy: number) {
  const a = deg / DEG, dx = x - cx, dy = y - cy;
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)].map(n => Math.round(n * 100) / 100);
}
const ring = (cx: number, cy: number, outer: number, inner: number) =>
  `M${cx - outer} ${cy}a${outer} ${outer} 0 1 0 ${outer * 2} 0a${outer} ${outer} 0 1 0 ${-outer * 2} 0ZM${cx - inner} ${cy}a${inner} ${inner} 0 1 1 ${inner * 2} 0a${inner} ${inner} 0 1 1 ${-inner * 2} 0Z`;
function arcPath(r: number, from: number, to: number, cx: number, cy: number) {
  const [x0, y0] = about(cx, cy - r, from, cx, cy), [x1, y1] = about(cx, cy - r, to, cx, cy);
  return `M${x0} ${y0}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}
/** A round head with a straight column rising from it: the housing's outline. */
function keyhole(cx: number, cy: number, r: number, half: number, top: number, corner: number) {
  const dy = Math.round(Math.sqrt(r * r - half * half) * 100) / 100;
  return `M${cx - half} ${cy - dy}V${top + corner}Q${cx - half} ${top} ${cx - half + corner} ${top}H${cx + half - corner}Q${cx + half} ${top} ${cx + half} ${top + corner}V${cy - dy}A${r} ${r} 0 1 1 ${cx - half} ${cy - dy}Z`;
}
const box = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;

/** Shared paints. `id` is a useId() prefix. */
export function CrankDefs({ id }: { id: string }) {
  return <defs>
    <linearGradient id={`${id}pearl`} x1="0" y1="0" x2=".7" y2="1"><stop offset="0" style={stop(mk('white'))} /><stop offset=".5" style={stop(mix('white', 62, 'steel-light'))} /><stop offset="1" style={stop(mix('steel-light', 72, 'steel'))} /></linearGradient>
    <linearGradient id={`${id}pearlV`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop(mix('white', 80, 'steel-light'))} /><stop offset="1" style={stop(mix('steel-light', 60, 'steel'))} /></linearGradient>
    <linearGradient id={`${id}pearlH`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={stop(mix('steel-light', 78, 'steel'))} /><stop offset=".3" style={stop(mk('white'))} /><stop offset=".7" style={stop(mix('white', 60, 'steel-light'))} /><stop offset="1" style={stop(mix('steel-light', 55, 'steel'))} /></linearGradient>
    <linearGradient id={`${id}graphite`} x1="0" y1="0" x2=".6" y2="1"><stop offset="0" style={stop(mix('graphite', 78, 'steel'))} /><stop offset=".5" style={stop(mk('graphite'))} /><stop offset="1" style={stop(mix('graphite', 55, 'shadow'))} /></linearGradient>
    <linearGradient id={`${id}graphiteH`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={stop(mix('graphite', 60, 'shadow'))} /><stop offset=".35" style={stop(mix('graphite', 75, 'steel'))} /><stop offset="1" style={stop(mix('graphite', 60, 'shadow'))} /></linearGradient>
    <linearGradient id={`${id}orange`} x1="0" y1="0" x2=".5" y2="1"><stop offset="0" style={stop(mix('amber', 55, 'orange'))} /><stop offset=".5" style={stop(mk('orange'))} /><stop offset="1" style={stop(mix('orange', 70, 'rust'))} /></linearGradient>
    <radialGradient id={`${id}orangeBall`} cx=".36" cy=".3" r=".8"><stop offset="0" style={stop(mix('amber', 55, 'white'))} /><stop offset=".4" style={stop(mk('orange'))} /><stop offset="1" style={stop(mix('orange', 60, 'rust'))} /></radialGradient>
    <radialGradient id={`${id}steelBall`} cx=".35" cy=".3" r=".8"><stop offset="0" style={stop(mk('white'))} /><stop offset=".4" style={stop(mk('steel-light'))} /><stop offset="1" style={stop(mk('steel-dark'))} /></radialGradient>
    <radialGradient id={`${id}pearlBall`} cx=".35" cy=".28" r=".85"><stop offset="0" style={stop(mk('white'))} /><stop offset=".55" style={stop(mix('white', 55, 'steel-light'))} /><stop offset="1" style={stop(mk('steel'))} /></radialGradient>
    <linearGradient id={`${id}steelRod`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={stop(mk('steel-dark'))} /><stop offset=".3" style={stop(mk('white'))} /><stop offset=".6" style={stop(mk('steel-light'))} /><stop offset="1" style={stop(mk('steel-dark'))} /></linearGradient>
    <radialGradient id={`${id}cavity`} cx=".4" cy=".35" r=".8"><stop offset="0" style={stop(mix('slate', 70, 'graphite'))} /><stop offset=".7" style={stop(mk('graphite'))} /><stop offset="1" style={stop(mix('graphite', 55, 'shadow'))} /></radialGradient>
    <linearGradient id={`${id}glass`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={stop(mk('white'), .34)} /><stop offset=".45" style={stop(mk('sky-pale'), .06)} /><stop offset="1" style={stop(mk('sky'), .16)} /></linearGradient>
    <linearGradient id={`${id}frost`} x1="0" y1="0" x2=".8" y2="1"><stop offset="0" style={stop(mk('white'), .96)} /><stop offset=".55" style={stop(mk('snow'), .86)} /><stop offset="1" style={stop(mix('snow', 70, 'sky-pale'), .9)} /></linearGradient>
    <linearGradient id={`${id}screen`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop(mix('night', 70, 'teal-deep'))} /><stop offset="1" style={stop(mix('night', 86, 'graphite'))} /></linearGradient>
    <radialGradient id={`${id}cyanGlow`} cx=".5" cy=".5" r=".5"><stop offset="0" style={stop(mk('white'), .95)} /><stop offset=".3" style={stop(mk('sky'), .8)} /><stop offset="1" style={stop(mk('sea'), 0)} /></radialGradient>
    <radialGradient id={`${id}shadow`} cx=".5" cy=".5" r=".5"><stop offset="0" style={stop(mk('shadow'), .5)} /><stop offset=".6" style={stop(mk('shadow'), .22)} /><stop offset="1" style={stop(mk('shadow'), 0)} /></radialGradient>
    <pattern id={`${id}dots`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="1.2" cy="1.2" r=".8" style={fill(light(11))} /><circle cx="3.7" cy="3.7" r=".8" style={fill(ink(26))} /></pattern>
    {/* The chosen part wears a crisp white edge with a teal line round it. */}
    <filter id={`${id}pick`} x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
      <feMorphology in="SourceAlpha" operator="dilate" radius="4.2" result="wide" />
      <feFlood style={{ floodColor: 'var(--studio-teal-ink)' }} result="teal" />
      <feComposite in="teal" in2="wide" operator="in" result="ring" />
      <feMorphology in="SourceAlpha" operator="dilate" radius="2.4" result="near" />
      <feFlood style={{ floodColor: 'var(--studio-surface)' }} result="white" />
      <feComposite in="white" in2="near" operator="in" result="edge" />
      <feMerge><feMergeNode in="ring" /><feMergeNode in="edge" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  </defs>;
}

/** Part groups carry their id, so a tap finds the part and the CSS can ring
 * the chosen one and soften the rest. */
function Part({ id, part, selected, children }: { id: string; part: PartId; selected: PartId | null; children: ReactNode }) {
  const lit = selected === part;
  return <g className="ck-part" data-crank-part={part} data-lit={lit} data-dim={!!selected && !lit} filter={lit ? `url(#${id}pick)` : undefined}>{children}</g>;
}

/** The round foot every machine stands on, with its shadow on the bench deck. */
const Foot = memo(function Foot({ id, cx, half = 84, live }: { id: string; cx: number; half?: number; live: boolean }) {
  return <g>
    <ellipse cx={cx + 6} cy={DECK_Y + 5} rx={half + 26} ry="13" fill={`url(#${id}shadow)`} />
    <path d={`M${cx - half} 371a${half} 9 0 0 0 ${half * 2} 0v9a${half} 9 0 0 1 ${-half * 2} 0Z`} fill={`url(#${id}pearlH)`} />
    <path d={`M${cx - half} 380a${half} 9 0 0 0 ${half * 2} 0v3.4a${half} 9 0 0 1 ${-half * 2} 0Z`} fill={`url(#${id}graphiteH)`} />
    <ellipse cx={cx} cy="371" rx={half} ry="9" fill={`url(#${id}pearl)`} />
    <ellipse cx={cx} cy="371" rx={half - 9} ry="6.4" style={{ fill: 'none', stroke: ink(10), strokeWidth: 1.4 }} />
    <path d={`M${cx - half + 3} 372.5a${half - 3} 8 0 0 0 ${(half - 3) * 2} 0`} style={{ fill: 'none', stroke: light(70), strokeWidth: 1.1 }} />
    {[-1, 1].map(s => <rect key={s} x={cx + s * (half - 26) - 8} y="379.5" width="16" height="8" rx="2.4" fill={`url(#${id}orange)`} />)}
    <rect x={cx - 11} y="380.6" width="22" height="4.6" rx="2.3" style={fill(mix('graphite', 70, 'shadow'))} />
    <rect x={cx - 9} y="381.7" width="18" height="2.4" rx="1.2" className="ck-led" data-live={live} style={fill(CYAN)} />
  </g>;
});

/** The big hand wheel, behind the housing: a graphite tyre with orange grips. */
function Wheel({ id, cx, cy, deg }: { id: string; cx: number; cy: number; deg: number }) {
  const outer = ring(cx, cy, 80, 63);
  return <>
    <ellipse cx={cx + 5} cy={cy + 5} rx="80" ry="80" style={fill(ink(13))} />
    <path d={outer} fillRule="evenodd" fill={`url(#${id}graphite)`} />
    <path d={outer} fillRule="evenodd" fill={`url(#${id}dots)`} />
    <g transform={`rotate(${deg} ${cx} ${cy})`}>
      {[0, 72, 144, 216, 288].map(a => <path key={a} d={arcPath(71.5, a - 13, a + 13, cx, cy)} style={{ fill: 'none', stroke: a ? mk('orange') : mix('amber', 45, 'orange'), strokeWidth: 9.5, strokeLinecap: 'round' }} />)}
      {[0, 72, 144, 216, 288].map(a => <path key={a} d={arcPath(74.2, a - 11, a + 11, cx, cy)} style={{ fill: 'none', stroke: light(34), strokeWidth: 1.4, strokeLinecap: 'round' }} />)}
      {[36, 108, 180, 252, 324].map(a => { const [x0, y0] = about(cx, cy - 50, a, cx, cy), [x1, y1] = about(cx, cy - 64, a, cx, cy); return <path key={a} d={`M${x0} ${y0}L${x1} ${y1}`} style={{ stroke: mix('white', 70, 'steel-light'), strokeWidth: 9, strokeLinecap: 'round' }} />; })}
      {(() => { const [x, y] = about(cx, cy - 71.5, 0, cx, cy); return <circle cx={x} cy={y} r="3.4" fill={`url(#${id}pearlBall)`} />; })()}
    </g>
    <circle cx={cx} cy={cy} r="62" style={{ fill: 'none', stroke: mk('orange'), strokeWidth: 2 }} />
    <path d={arcPath(59, 200, 520, cx, cy)} style={{ fill: 'none', stroke: CYAN, strokeWidth: 1.3, strokeDasharray: '14 5', opacity: .85 }} />
    <path d={arcPath(77.5, 285, 350, cx, cy)} style={{ fill: 'none', stroke: light(48), strokeWidth: 2.2, strokeLinecap: 'round' }} />
    <path d={arcPath(78, 105, 165, cx, cy)} style={{ fill: 'none', stroke: ink(34), strokeWidth: 2.6, strokeLinecap: 'round' }} />
  </>;
}

/** The glass-fronted housing: the cavity, the moving parts inside it, the glass
 * (clear, or frosted until the frost is wiped away from the left) and the pearl
 * shell round it. `peek` (0..1) clears a round spot in the frost. */
function Housing({ id, outer, inner, span, open, peek, peekAt, children }: { id: string; outer: string; inner: string; span: readonly [number, number]; open: number; peek: number; peekAt: { x: number; y: number }; children: ReactNode }) {
  const edge = span[0] + open * (span[1] - span[0]);
  const hole = 30 * peek;
  return <>
    <path d={inner} fill={`url(#${id}cavity)`} />
    <path d={inner} fill={`url(#${id}dots)`} style={{ opacity: .5 }} />
    <clipPath id={`${id}inner`}><path d={inner} /></clipPath>
    {children}
    <g clipPath={`url(#${id}inner)`} className="ck-glass">
      <path d={inner} fill={`url(#${id}glass)`} />
      <path d={`M${span[0] + 14} 80L${span[0] + 34} 80L${span[0] - 20} 420L${span[0] - 40} 420Z`} style={fill(light(15))} />
      <path d={`M${span[0] + 44} 80L${span[0] + 52} 80L${span[0] - 2} 420L${span[0] - 10} 420Z`} style={fill(light(10))} />
    </g>
    {open < 1 && <g clipPath={`url(#${id}inner)`}>
      <clipPath id={`${id}wipe`}><rect x={edge} y="0" width="400" height="470" /></clipPath>
      <clipPath id={`${id}peek`}><path clipRule="evenodd" d={`M-400 -400H900V900H-400Z${hole > 0.5 ? `M${peekAt.x - hole} ${peekAt.y}a${hole} ${hole} 0 1 0 ${hole * 2} 0a${hole} ${hole} 0 1 0 ${-hole * 2} 0Z` : ''}`} /></clipPath>
      <g clipPath={`url(#${id}wipe)`}><g clipPath={`url(#${id}peek)`} data-crank-toy="glass">
        <path d={inner} fill={`url(#${id}frost)`} />
        <path d={`M${span[0] + 26} 80L${span[0] + 50} 80L${span[0] - 4} 420L${span[0] - 28} 420Z`} style={fill(light(60))} />
      </g></g>
      {hole > 0.5 && <circle cx={peekAt.x} cy={peekAt.y} r={hole} style={{ fill: 'none', stroke: CYAN, strokeWidth: 1.6, opacity: Math.min(1, peek * 1.4) }} />}
      {open > 0 && <rect x={edge - 1.2} y="0" width="2.4" height="470" style={fill(CYAN)} />}
      {open > 0 && <rect x={edge - 7} y="0" width="7" height="470" style={fill(mix('sky', 30, 'transparent'))} />}
    </g>}
    <path d={outer + inner} fillRule="evenodd" fill={`url(#${id}pearl)`} />
    <path d={inner} style={{ fill: 'none', stroke: mix('graphite', 82, 'shadow'), strokeWidth: 2.6 }} />
    <path d={inner} style={{ fill: 'none', stroke: CYAN_DIM, strokeWidth: 0.9 }} />
    <path d={outer} style={{ fill: 'none', stroke: ink(16), strokeWidth: 1.1 }} />
  </>;
}

/** The crank: an orange web on the shaft, turning with it. */
function Crank({ id, pose, r = 22 }: { id: string; pose: Pose; r?: number }) {
  const { sx, sy, deg } = pose, reach = LINKAGE.r;
  return <g transform={`rotate(${deg} ${sx} ${sy})`}>
    <path d={`M${sx - r - 4} ${sy + 2}A${r + 4} ${r + 4} 0 0 0 ${sx + r + 4} ${sy + 2}Z`} style={fill(mix('orange', 72, 'rust'))} />
    <path d={`M${sx - 13} ${sy}L${sx - 9.5} ${sy - reach}A9.5 9.5 0 0 1 ${sx + 9.5} ${sy - reach}L${sx + 13} ${sy}Z`} style={fill(mk('orange'))} />
    <circle cx={sx} cy={sy} r={r - 6} style={fill(mk('orange'))} />
    <path d={`M${sx - 5} ${sy - 6}L${sx - 3.6} ${sy - reach + 2}`} style={{ stroke: mix('amber', 60, 'white'), strokeWidth: 2.2, strokeLinecap: 'round', opacity: .75 }} />
    <path d={Array.from({ length: 6 }, (_, i) => { const [x, y] = about(sx, sy - 7, i * 60, sx, sy); return `${i ? 'L' : 'M'}${x} ${y}`; }).join('') + 'Z'} fill={`url(#${id}steelBall)`} />
  </g>;
}
/** The rod: a bright bar from the crank pin to the wrist pin, drawn from the
 * pin and leant by the linkage's own angle, so it can never stretch. */
function Rod({ id, pose }: { id: string; pose: Pose }) {
  return <g transform={`translate(${pose.pin.x} ${pose.pin.y}) rotate(${pose.lean})`}>
    <path d={`M-5 -8L-3.4 ${-L + 6}H3.4L5 -8Z`} fill={`url(#${id}steelRod)`} />
    <circle r="11" fill={`url(#${id}steelRod)`} />
    <circle cy={-L} r="7.6" fill={`url(#${id}steelRod)`} />
    <path d={`M-1.6 -14L-1.1 ${-L + 10}`} style={{ stroke: CYAN, strokeWidth: 1.2, strokeLinecap: 'round', opacity: .9 }} />
    <circle r="11" style={{ fill: 'none', stroke: ink(22), strokeWidth: 1 }} />
  </g>;
}
function Pins({ id, pose, selected, slider }: { id: string; pose: Pose; selected: PartId | null; slider: PartId }) {
  return <>
    <circle cx={pose.pin.x} cy={pose.pin.y} r="5.6" fill={`url(#${id}pearlBall)`} className="ck-pin" data-dim={!!selected && selected !== 'crank' && selected !== 'rod'} />
    <circle cx={pose.pin.x} cy={pose.pin.y} r="1.8" style={fill(mk('steel-dark'))} className="ck-pin" data-dim={!!selected && selected !== 'crank' && selected !== 'rod'} />
    <circle cx={pose.sx} cy={pose.wristY} r="4.6" fill={`url(#${id}pearlBall)`} className="ck-pin" data-dim={!!selected && selected !== slider && selected !== 'rod'} />
    <circle cx={pose.sx} cy={pose.wristY} r="1.5" style={fill(mk('steel-dark'))} className="ck-pin" data-dim={!!selected && selected !== slider && selected !== 'rod'} />
  </>;
}
const Neck = memo(function Neck({ id, cx, top }: { id: string; cx: number; top: number }) {
  return <g>
    <path d={`M${cx - 17} ${top}H${cx + 17}L${cx + 26} 372H${cx - 26}Z`} fill={`url(#${id}graphiteH)`} />
    <path d={`M${cx - 17} ${top}H${cx + 17}L${cx + 26} 372H${cx - 26}Z`} fill={`url(#${id}dots)`} />
    <ellipse cx={cx} cy="371.5" rx="30" ry="4.6" fill={`url(#${id}pearlH)`} />
  </g>;
});

export interface MachineArt { id: string; pose: Pose; open: number; selected?: PartId | null; peek?: number; live?: boolean; bounce?: number }

/* ------------------------------------------------------- the glass piston */
const E = SHAFT.engine;
const ENGINE_OUTER = keyhole(E.x, E.y, 56, 30, 127, 10), ENGINE_INNER = keyhole(E.x, E.y, 44, 21, 139, 4);
export const ENGINE_SPAN: readonly [number, number] = [E.x - 46, E.x + 46];

/** `bounce` (-1..1) squashes the orange knob after a tap or at the top of a stroke. */
export function EngineArt({ id, pose, open, selected = null, peek = 0, live = false, bounce = 0 }: MachineArt) {
  const { sx: cx, sy: cy, wristY: wy } = pose;
  const top = wy - 20, tail = top - 96;
  const sq = 1 + bounce * 0.22;
  return <g>
    <Foot id={id} cx={cx} live={live} />
    <Part id={id} part="wheel" selected={selected}><Wheel id={id} cx={cx} cy={cy} deg={pose.deg} /></Part>
    <Neck id={id} cx={cx} top={cy + 48} />
    <Housing id={id} outer={ENGINE_OUTER} inner={ENGINE_INNER} span={ENGINE_SPAN} open={open} peek={peek} peekAt={{ x: cx, y: cy - 4 }}>
      <Part id={id} part="cylinder" selected={selected}>
        {[-21, 17].map(dx => <g key={dx}>
          <rect x={cx + dx} y="139" width="4" height="112" style={fill(mix('steel', 60, 'graphite'))} />
          <rect x={cx + dx + (dx < 0 ? 3 : 0)} y="139" width="1" height="112" style={fill(CYAN)} />
        </g>)}
        {Array.from({ length: 9 }, (_, i) => <rect key={i} x={cx - 21} y={148 + i * 11} width="4" height="1.1" style={fill(light(40))} />)}
        {Array.from({ length: 9 }, (_, i) => <rect key={i} x={cx + 17} y={148 + i * 11} width="4" height="1.1" style={fill(light(40))} />)}
      </Part>
      <Part id={id} part="piston" selected={selected}>
        <rect x={cx - 2.5} y={tail} width="5" height={top - tail + 2} fill={`url(#${id}steelRod)`} />
        <rect x={cx - 16.5} y={top} width="33" height="36" rx="4" fill={`url(#${id}pearlH)`} />
        <rect x={cx - 16.5} y={top} width="33" height="3" rx="1.5" style={fill(light(80))} />
        {[7, 12].map(d => <rect key={d} x={cx - 16.5} y={top + d} width="33" height="2" style={fill(mix('graphite', 80, 'transparent'))} />)}
        <rect x={cx - 11} y={top + 26} width="22" height="3" rx="1.5" style={fill(CYAN)} />
        <circle cx={cx} cy={wy} r="7.4" style={fill(mix('steel', 50, 'steel-light'))} />
      </Part>
      <Part id={id} part="crank" selected={selected}><Crank id={id} pose={pose} /></Part>
      <Part id={id} part="rod" selected={selected}><Rod id={id} pose={pose} /></Part>
      <Pins id={id} pose={pose} selected={selected} slider="piston" />
    </Housing>
    <path d={arcPath(50, 215, 262, cx, cy)} style={{ fill: 'none', stroke: light(85), strokeWidth: 3, strokeLinecap: 'round' }} />
    <path d={`M${cx - 26} 142V214`} style={{ stroke: light(80), strokeWidth: 2.4, strokeLinecap: 'round' }} />
    <path d={arcPath(51, 95, 150, cx, cy)} style={{ fill: 'none', stroke: ink(13), strokeWidth: 4, strokeLinecap: 'round' }} />
    <circle cx={cx - 36} cy={cy + 34} r="3.6" fill={`url(#${id}orangeBall)`} />
    <rect x={cx + 30} y={cy + 33} width="9" height="3" rx="1.5" transform={`rotate(-42 ${cx + 34} ${cy + 34})`} className="ck-led" data-live={live} style={fill(CYAN)} />
    {/* Above the glass: the cap and gland, the top of the piston's rod and its orange knob. */}
    <Part id={id} part="cylinder" selected={selected}>
      <rect x={cx - 36} y="119" width="72" height="13" rx="6" fill={`url(#${id}pearlH)`} />
      <rect x={cx - 36} y="128" width="72" height="4" rx="2" style={fill(ink(12))} />
      <rect x={cx - 30} y="121" width="60" height="1.6" rx=".8" style={fill(light(85))} />
      <rect x={cx - 9} y="111" width="18" height="9" rx="2.6" fill={`url(#${id}graphiteH)`} />
      <rect x={cx - 9} y="116.6" width="18" height="1.4" style={fill(mk('orange'))} />
    </Part>
    <Part id={id} part="piston" selected={selected}>
      <rect x={cx - 2.5} y={tail} width="5" height={Math.max(0, 112 - tail)} fill={`url(#${id}steelRod)`} />
      <g data-crank-toy="knob" transform={`translate(${cx} ${tail + 9}) scale(${(2 - sq).toFixed(3)} ${sq.toFixed(3)}) translate(${-cx} ${-(tail + 9)})`}>
        <circle cx={cx} cy={tail} r="16" style={fill('transparent')} />
        <circle cx={cx} cy={tail} r="10.5" fill={`url(#${id}orangeBall)`} />
        <ellipse cx={cx - 3.4} cy={tail - 4} rx="3.4" ry="2.2" style={fill(light(55))} />
      </g>
    </Part>
  </g>;
}

/* ------------------------------------------------------- the bloom lifter */
const T = SHAFT.toy;
const TOY_OUTER = box(T.x - 66, 184, 132, 187, 16), TOY_INNER = box(T.x - 54, 196, 108, 162, 9);
export const TOY_SPAN: readonly [number, number] = [T.x - 56, T.x + 56];
/** The flower's seat rides this far above the wrist pin, on its stem. */
export const FLOWER_STEM = 74;
const FLOWER_H = 122, FLOWER_W = FLOWER_H * KIT_FLOWER.open.width / KIT_FLOWER.open.height;
/** How open the flower is for a place in the stroke: shut until well up, fully open at the top. */
export const bloomOf = (lift01: number) => Math.max(0, Math.min(1, (lift01 - 0.7) / 0.26));

export function ToyArt({ id, pose, open, selected = null, peek = 0, live = false, bounce = 0 }: MachineArt) {
  const { sx: cx, sy: cy, wristY: wy, deg } = pose;
  const seat = wy - FLOWER_STEM, bloom = bloomOf(pose.lift01);
  const [hx, hy] = about(cx, cy - GRIP.toy, deg + 180, cx, cy);
  const sway = bounce * 7;
  return <g>
    <Foot id={id} cx={cx} live={live} />
    <Housing id={id} outer={TOY_OUTER} inner={TOY_INNER} span={TOY_SPAN} open={open} peek={peek} peekAt={{ x: cx + 24, y: cy - 56 }}>
      <Part id={id} part="bloom" selected={selected}>
        {[-11, 7].map(dx => <rect key={dx} x={cx + dx} y="196" width="4" height="70" style={fill(mix('steel', 60, 'graphite'))} />)}
        <rect x={cx - 3} y={seat} width="6" height={wy - seat} fill={`url(#${id}steelRod)`} />
        <rect x={cx - 9} y={wy - 9} width="18" height="18" rx="4" fill={`url(#${id}pearlH)`} />
      </Part>
      <Part id={id} part="crank" selected={selected}>
        <g transform={`rotate(${deg} ${cx} ${cy})`}>
          <circle cx={cx} cy={cy} r="36" style={fill(mix('orange', 72, 'rust'))} />
          <circle cx={cx} cy={cy} r="33.5" style={fill(mk('orange'))} />
          <circle cx={cx} cy={cy} r="27" style={{ fill: 'none', stroke: mix('amber', 60, 'white'), strokeWidth: 1.6, strokeDasharray: '2 6', strokeLinecap: 'round', opacity: .8 }} />
          <path d={`M${cx} ${cy}V${cy - LINKAGE.r}`} style={{ stroke: mix('orange', 60, 'rust'), strokeWidth: 9, strokeLinecap: 'round' }} />
        </g>
        <path d={arcPath(34.6, 280, 340, cx, cy)} style={{ fill: 'none', stroke: light(50), strokeWidth: 1.6, strokeLinecap: 'round' }} />
      </Part>
      <Part id={id} part="rod" selected={selected}><Rod id={id} pose={pose} /></Part>
      <Pins id={id} pose={pose} selected={selected} slider="bloom" />
    </Housing>
    <path d={`M${cx - 60} 200V352`} style={{ stroke: light(82), strokeWidth: 2.6, strokeLinecap: 'round' }} />
    <path d={`M${cx - 50} 190H${cx + 34}`} style={{ stroke: light(85), strokeWidth: 2.2, strokeLinecap: 'round' }} />
    <path d={`M${cx + 60.5} 204V356`} style={{ stroke: ink(11), strokeWidth: 4, strokeLinecap: 'round' }} />
    <rect x={cx + 40} y="362.5" width="12" height="3" rx="1.5" className="ck-led" data-live={live} style={fill(CYAN)} />
    <circle cx={cx - 46} cy="364" r="3.2" fill={`url(#${id}orangeBall)`} />
    {/* On top: the grommet the stem slides through, the seat and the felt flower. */}
    <rect x={cx - 15} y="178" width="30" height="9" rx="4" fill={`url(#${id}graphiteH)`} />
    <rect x={cx - 15} y="183.4" width="30" height="1.4" style={fill(mk('orange'))} />
    <Part id={id} part="bloom" selected={selected}>
      <rect x={cx - 3} y={seat} width="6" height={Math.max(0, 180 - seat)} fill={`url(#${id}steelRod)`} />
      <ellipse cx={cx} cy={seat + 1} rx="15" ry="4.4" fill={`url(#${id}pearlH)`} />
      <g data-crank-toy="flower" transform={`rotate(${sway.toFixed(2)} ${cx} ${seat})`}>
        <circle cx={cx} cy={seat - FLOWER_H * 0.7} r="36" style={fill('transparent')} />
        <image href={KIT_FLOWER.folded.src} x={cx - FLOWER_W / 2} y={seat - FLOWER_H + 5} width={FLOWER_W} height={FLOWER_H} style={{ opacity: bloom > 0.98 ? 0 : 1 }} />
        <image href={KIT_FLOWER.open.src} x={cx - FLOWER_W / 2} y={seat - FLOWER_H + 5} width={FLOWER_W} height={FLOWER_H} style={{ opacity: bloom }} />
      </g>
    </Part>
    {/* In front of the glass: the handle a hand turns. */}
    <Part id={id} part="handle" selected={selected}>
      <path d={`M${cx} ${cy}L${hx} ${hy}`} style={{ stroke: mix('graphite', 60, 'shadow'), strokeWidth: 13, strokeLinecap: 'round' }} />
      <path d={`M${cx} ${cy}L${hx} ${hy}`} style={{ stroke: mk('graphite'), strokeWidth: 10, strokeLinecap: 'round' }} />
      <path d={`M${cx} ${cy}L${hx} ${hy}`} style={{ stroke: mix('steel', 45, 'transparent'), strokeWidth: 2, strokeLinecap: 'round' }} />
      <circle cx={cx} cy={cy} r="12" fill={`url(#${id}pearlBall)`} />
      <circle cx={cx} cy={cy} r="5" fill={`url(#${id}orangeBall)`} />
      <ellipse cx={hx + 2} cy={hy + 3} rx="13" ry="12" style={fill(ink(20))} />
      <circle cx={hx} cy={hy} r="12.5" fill={`url(#${id}orangeBall)`} />
      <ellipse cx={hx - 4} cy={hy - 5} rx="4" ry="2.6" style={fill(light(50))} />
    </Part>
  </g>;
}

/* --------------------------------------------------------- the wave writer */
const W = SHAFT.writer;
const WRITER_OUTER = keyhole(W.x, W.y, 56, 25, 131, 9), WRITER_INNER = keyhole(W.x, W.y, 44, 16, 143, 4);
export const WRITER_SPAN: readonly [number, number] = [W.x - 46, W.x + 46];
/** The pen sits this far right of the slide and this far above the wrist pin. */
export const PEN = { dx: 44, rise: 104 } as const;
/** The dark glass the pen writes on: it starts at the post and runs off to the right. */
export const WAVE_GLASS = { x: W.x + 30, top: 44, bottom: 142 } as const;
/** Inks the pen can write in: kit cyan, kit orange, and the lock's green. */
export const INKS: readonly string[] = [CYAN, mix('amber', 40, 'orange'), mix('spring', 70, 'leaf')];

/** The glass strip behind the pen. `feed` (drawing units) slides its marks. */
export function WaveGlass({ id, feed, children }: { id: string; feed: number; children?: ReactNode }) {
  const { x, top, bottom } = WAVE_GLASS, mid = (top + bottom) / 2;
  return <g>
    <clipPath id={`${id}strip`}><rect x={x} y={top} width="900" height={bottom - top} /></clipPath>
    <rect x={x + 3} y={top + 4} width="900" height={bottom - top} style={fill(ink(14))} />
    <rect x={x} y={top} width="900" height={bottom - top} fill={`url(#${id}screen)`} />
    <g clipPath={`url(#${id}strip)`}>
      <path d={`M${x} ${mid}H1000`} style={{ stroke: CYAN_DIM, strokeWidth: 1, strokeDasharray: '2 5', strokeDashoffset: -feed }} />
      <path d={`M${x} ${top + 5}H1000M${x} ${bottom - 5}H1000`} style={{ stroke: CYAN_DIM, strokeWidth: 3, strokeDasharray: '1.4 13.6', strokeDashoffset: -feed }} />
      {children}
      <path d={`M${x + 18} ${top}L${x + 44} ${top}L${x + 16} ${bottom}L${x - 10} ${bottom}Z`} style={fill(light(6))} />
    </g>
    <rect x={x - 2} y={top - 6} width="900" height="6" fill={`url(#${id}pearlV)`} />
    <rect x={x - 2} y={bottom} width="900" height="6" fill={`url(#${id}pearlV)`} />
    <rect x={x - 2} y={top - 1} width="900" height="1.2" style={fill(CYAN)} />
  </g>;
}

export function WriterArt({ id, pose, open, selected = null, peek = 0, live = false, bounce = 0, ink: penInk = 0 }: MachineArt & { ink?: number }) {
  const { sx: cx, sy: cy, wristY: wy } = pose;
  const carriage = wy - PEN.rise, penX = cx + PEN.dx;
  const colour = INKS[penInk] ?? INKS[0];
  return <g>
    <Foot id={id} cx={cx} live={live} />
    <Part id={id} part="wheel" selected={selected}><Wheel id={id} cx={cx} cy={cy} deg={pose.deg} /></Part>
    <Neck id={id} cx={cx} top={cy + 48} />
    {/* The post that carries the glass, standing on the housing's shoulder. */}
    <rect x={WAVE_GLASS.x - 10} y={WAVE_GLASS.top - 12} width="10" height={131 - WAVE_GLASS.top + 12} rx="4" fill={`url(#${id}pearlH)`} />
    <Housing id={id} outer={WRITER_OUTER} inner={WRITER_INNER} span={WRITER_SPAN} open={open} peek={peek} peekAt={{ x: cx, y: cy - 4 }}>
      <Part id={id} part="tracer" selected={selected}>
        {[-16, 13].map(dx => <rect key={dx} x={cx + dx} y="143" width="3" height="108" style={fill(mix('steel', 60, 'graphite'))} />)}
        <rect x={cx - 2.5} y={carriage} width="5" height={wy - carriage} fill={`url(#${id}steelRod)`} />
        <rect x={cx - 12} y={wy - 13} width="24" height="26" rx="5" fill={`url(#${id}pearlH)`} />
        <rect x={cx - 8} y={wy + 6} width="16" height="2.6" rx="1.3" style={fill(CYAN)} />
      </Part>
      <Part id={id} part="crank" selected={selected}><Crank id={id} pose={pose} /></Part>
      <Part id={id} part="rod" selected={selected}><Rod id={id} pose={pose} /></Part>
      <Pins id={id} pose={pose} selected={selected} slider="tracer" />
    </Housing>
    <path d={arcPath(50, 215, 262, cx, cy)} style={{ fill: 'none', stroke: light(85), strokeWidth: 3, strokeLinecap: 'round' }} />
    <path d={`M${cx - 21} 146V214`} style={{ stroke: light(80), strokeWidth: 2.2, strokeLinecap: 'round' }} />
    <path d={arcPath(51, 95, 150, cx, cy)} style={{ fill: 'none', stroke: ink(13), strokeWidth: 4, strokeLinecap: 'round' }} />
    <circle cx={cx - 36} cy={cy + 34} r="3.6" fill={`url(#${id}orangeBall)`} />
    <rect x={cx + 30} y={cy + 33} width="9" height="3" rx="1.5" transform={`rotate(-42 ${cx + 34} ${cy + 34})`} className="ck-led" data-live={live} style={fill(CYAN)} />
    <rect x={cx - 31} y="123" width="62" height="13" rx="6" fill={`url(#${id}pearlH)`} />
    <rect x={cx - 31} y="132" width="62" height="4" rx="2" style={fill(ink(12))} />
    <rect x={cx - 8} y="116" width="16" height="8" rx="2.4" fill={`url(#${id}graphiteH)`} />
    {/* The mast, the carriage and the pen: all one piece with the slide. */}
    <Part id={id} part="tracer" selected={selected}>
      <rect x={cx - 2.5} y={carriage} width="5" height={Math.max(0, 118 - carriage)} fill={`url(#${id}steelRod)`} />
      <rect x={cx + 6} y={carriage - 3} width={PEN.dx - 14} height="6" rx="3" fill={`url(#${id}graphiteH)`} />
      <rect x={cx - 10} y={carriage - 8} width="20" height="16" rx="5" fill={`url(#${id}pearlH)`} />
      <rect x={cx - 6} y={carriage - 1.2} width="12" height="2.4" rx="1.2" style={fill(mk('orange'))} />
      <g transform={`translate(${penX} ${carriage}) scale(${(1 + bounce * 0.3).toFixed(3)})`}>
        <rect x="-13" y="-5.5" width="12" height="11" rx="3.5" fill={`url(#${id}orange)`} />
        <circle r="11" fill={`url(#${id}cyanGlow)`} style={{ opacity: .55 }} />
        <circle r="3.6" style={fill(colour)} />
        <circle r="1.5" style={fill(mk('white'))} />
      </g>
    </Part>
  </g>;
}

/** Where each part's name tag sits, and the moving point on the part that the
 * tag's line (and AnchorCheck's tip) reaches, for the present pose. */
export function tagFor(part: PartId, pose: Pose): { tag: { x: number; y: number }; at: { x: number; y: number } } {
  const { pin, wristY: wy, sx, sy, machine } = pose;
  const midRod = { x: (pin.x + sx) / 2, y: (pin.y + wy) / 2 };
  const web = { x: sx + (pin.x - sx) * 0.5, y: sy + (pin.y - sy) * 0.5 };
  if (machine === 'toy') switch (part) {
    case 'handle': { const [x, y] = about(sx, sy - 34, pose.deg + 180, sx, sy); return { tag: { x: 268, y: 262 }, at: { x, y } }; }
    case 'crank': { const [x, y] = about(sx, sy - 26, pose.deg + 90, sx, sy); return { tag: { x: 38, y: 338 }, at: { x, y } }; }
    case 'rod': return { tag: { x: 38, y: 256 }, at: midRod };
    default: return { tag: { x: 252, y: 132 }, at: { x: sx + 4, y: wy - FLOWER_STEM + 6 } };
  }
  if (machine === 'writer') switch (part) {
    case 'wheel': return { tag: { x: 34, y: 338 }, at: { x: sx - 66, y: sy + 28 } };
    case 'crank': return { tag: { x: 250, y: 266 }, at: web };
    case 'rod': return { tag: { x: 30, y: 232 }, at: midRod };
    default: return { tag: { x: 52, y: 92 }, at: { x: sx - 4, y: wy - PEN.rise } };
  }
  switch (part) {
    case 'wheel': return { tag: { x: 38, y: 338 }, at: { x: sx - 66, y: sy + 28 } };
    case 'crank': return { tag: { x: 266, y: 268 }, at: web };
    case 'rod': return { tag: { x: 38, y: 240 }, at: midRod };
    case 'piston': return { tag: { x: 258, y: 190 }, at: { x: sx + 12, y: wy - 4 } };
    default: return { tag: { x: 42, y: 150 }, at: { x: sx - 19, y: 166 } };
  }
}
