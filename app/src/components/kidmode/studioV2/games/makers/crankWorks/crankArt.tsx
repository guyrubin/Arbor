import { memo, type CSSProperties, type ReactNode } from 'react';
import { LINKAGE, crankPin, pistonLift, rodLean, type PartId } from './crankWorksRules';

/* The workshop drawing. One light from the top-left; no outlines; every
   colour from the makers' palette (--mk-*) through var() and color-mix().
   Gradients that sit on a turning part are counter-turned so their light
   stays put while the part spins. The drawing is 400 by 440; the shaft of
   both machines is at (200, 312), and both use the same linkage. */

/** The visible window onto the drawing (the wall and table run beyond it). */
export const VIEW_X = 40, VIEW_W = 320, VIEW_H = 440;
export const SX = 200, SY = 312;
const { r: R, l: L } = LINKAGE;
const DEG = 180 / Math.PI;

const mk = (name: string) => `var(--mk-${name})`;
const mix = (a: string, pct: number, b: string) => `color-mix(in srgb, ${mk(a)} ${pct}%, ${b === 'transparent' ? 'transparent' : mk(b)})`;
const fill = (v: string): CSSProperties => ({ fill: v });
const stop = (v: string, opacity?: number): CSSProperties => (opacity === undefined ? { stopColor: v } : { stopColor: v, stopOpacity: opacity });
const ink = (alpha: number) => mix('shadow', alpha, 'transparent');
const light = (alpha: number) => mix('white', alpha, 'transparent');

/** Everything that changes with the angle, worked out once per frame. */
export interface Pose {
  theta: number;
  deg: number;
  pin: { x: number; y: number };
  wristY: number;
  lean: number;
}
export function poseOf(theta: number): Pose {
  const p = crankPin(theta);
  return { theta, deg: theta * DEG, pin: { x: SX + p.x, y: SY + p.y }, wristY: SY - pistonLift(theta), lean: rodLean(theta) };
}

/** Rotate a point about the shaft (degrees, clockwise on screen). */
function about(x: number, y: number, deg: number, cx = SX, cy = SY) {
  const a = deg / DEG, dx = x - cx, dy = y - cy;
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)].map(n => Math.round(n * 100) / 100);
}
const ring = (cx: number, cy: number, outer: number, inner: number) =>
  `M${cx - outer} ${cy}a${outer} ${outer} 0 1 0 ${outer * 2} 0a${outer} ${outer} 0 1 0 ${-outer * 2} 0ZM${cx - inner} ${cy}a${inner} ${inner} 0 1 1 ${inner * 2} 0a${inner} ${inner} 0 1 1 ${-inner * 2} 0Z`;
function arcPath(r: number, from: number, to: number, cx = SX, cy = SY) {
  const [x0, y0] = about(cx, cy - r, from, cx, cy), [x1, y1] = about(cx, cy - r, to, cx, cy);
  return `M${x0} ${y0}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}
/** A soft wood grain: a few long wavy lines across a board. */
function grain(x0: number, x1: number, y0: number, y1: number, lines: number, seed: number) {
  let d = '';
  for (let i = 0; i < lines; i++) {
    const y = y0 + (y1 - y0) * (i + 0.5) / lines, w = (x1 - x0) / 4, a = 1.2 + ((seed * (i + 3)) % 5) * 0.35, s = (seed + i) % 2 ? 1 : -1;
    d += `M${x0} ${y}c${w * 0.6} ${-a * s} ${w * 1.3} ${a * s} ${w * 2} 0s${w * 1.4} ${-a * s} ${w * 2} ${a * 0.4 * s}`;
  }
  return d;
}

/** Shared paints. `id` is a useId() prefix. */
export function CrankDefs({ id }: { id: string }) {
  return <defs>
    <linearGradient id={`${id}wall`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop(mk('paper'))} /><stop offset=".72" style={stop(mk('cream'))} /><stop offset="1" style={stop(mk('paper-shade'))} /></linearGradient>
    <radialGradient id={`${id}lamp`} cx=".18" cy=".1" r=".75"><stop offset="0" style={stop(mk('white'), .85)} /><stop offset="1" style={stop(mk('white'), 0)} /></radialGradient>
    <linearGradient id={`${id}table`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop(mk('wood'))} /><stop offset="1" style={stop(mk('wood-dark'))} /></linearGradient>
    <linearGradient id={`${id}plinth`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop(mk('wood-light'))} /><stop offset=".55" style={stop(mk('wood'))} /><stop offset="1" style={stop(mix('wood', 80, 'wood-dark'))} /></linearGradient>
    <radialGradient id={`${id}shadow`} cx=".5" cy=".5" r=".5"><stop offset="0" style={stop(mk('shadow'), .34)} /><stop offset="1" style={stop(mk('shadow'), 0)} /></radialGradient>
    <linearGradient id={`${id}enamel`} gradientUnits="userSpaceOnUse" x1="140" y1="100" x2="270" y2="380"><stop offset="0" style={stop(mix('teal', 82, 'sea'))} /><stop offset=".45" style={stop(mk('teal'))} /><stop offset="1" style={stop(mk('teal-deep'))} /></linearGradient>
    <linearGradient id={`${id}brass`} x1="0" y1="0" x2=".4" y2="1"><stop offset="0" style={stop(mk('gold-light'))} /><stop offset=".45" style={stop(mk('gold'))} /><stop offset="1" style={stop(mk('gold-deep'))} /></linearGradient>
    <linearGradient id={`${id}brassBar`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop(mk('gold-light'))} /><stop offset=".5" style={stop(mk('brass'))} /><stop offset="1" style={stop(mk('gold-deep'))} /></linearGradient>
    <radialGradient id={`${id}stud`} cx=".35" cy=".3" r=".75"><stop offset="0" style={stop(mk('gold-light'))} /><stop offset=".6" style={stop(mk('brass'))} /><stop offset="1" style={stop(mk('gold-deep'))} /></radialGradient>
    <radialGradient id={`${id}steelBall`} cx=".35" cy=".3" r=".8"><stop offset="0" style={stop(mk('white'))} /><stop offset=".35" style={stop(mk('steel-light'))} /><stop offset="1" style={stop(mk('steel-dark'))} /></radialGradient>
    <radialGradient id={`${id}redBall`} cx=".35" cy=".3" r=".8"><stop offset="0" style={stop(mix('poppy', 45, 'white'))} /><stop offset=".45" style={stop(mk('poppy'))} /><stop offset="1" style={stop(mix('red', 70, 'shadow'))} /></radialGradient>
    <linearGradient id={`${id}rim`} gradientUnits="userSpaceOnUse" x1={SX - 80} y1={SY - 90} x2={SX + 70} y2={SY + 90}><stop offset="0" style={stop(mk('steel-light'))} /><stop offset=".5" style={stop(mk('steel'))} /><stop offset="1" style={stop(mk('steel-dark'))} /></linearGradient>
    <linearGradient id={`${id}steelRod`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={stop(mk('steel-dark'))} /><stop offset=".3" style={stop(mk('steel-light'))} /><stop offset=".55" style={stop(mk('steel'))} /><stop offset="1" style={stop(mk('steel-dark'))} /></linearGradient>
    <linearGradient id={`${id}wall-steel`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={stop(mk('steel'))} /><stop offset=".5" style={stop(mk('steel-light'))} /><stop offset="1" style={stop(mk('steel'))} /></linearGradient>
    <linearGradient id={`${id}bore`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={stop(mk('graphite'))} /><stop offset=".42" style={stop(mk('slate'))} /><stop offset="1" style={stop(mix('graphite', 80, 'shadow'))} /></linearGradient>
    <radialGradient id={`${id}cavity`} gradientUnits="userSpaceOnUse" cx="178" cy="262" r="110"><stop offset="0" style={stop(mk('slate'))} /><stop offset=".7" style={stop(mk('graphite'))} /><stop offset="1" style={stop(mix('graphite', 60, 'shadow'))} /></radialGradient>
    <linearGradient id={`${id}copper`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={stop(mk('rust'))} /><stop offset=".28" style={stop(mk('clay-light'))} /><stop offset=".6" style={stop(mk('clay'))} /><stop offset="1" style={stop(mix('rust', 75, 'umber'))} /></linearGradient>
    <linearGradient id={`${id}woodBack`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop(mix('wood-light', 80, 'wood'))} /><stop offset="1" style={stop(mk('wood-light'))} /></linearGradient>
    <linearGradient id={`${id}woodBoard`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop(mix('wood-light', 70, 'butter'))} /><stop offset="1" style={stop(mk('wood'))} /></linearGradient>
    <linearGradient id={`${id}paint`} gradientUnits="userSpaceOnUse" x1="120" y1="160" x2="280" y2="400"><stop offset="0" style={stop(mix('poppy', 85, 'orange'))} /><stop offset=".55" style={stop(mk('poppy'))} /><stop offset="1" style={stop(mk('red'))} /></linearGradient>
    <linearGradient id={`${id}post`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={stop(mix('red', 85, 'poppy'))} /><stop offset="1" style={stop(mix('red', 75, 'shadow'))} /></linearGradient>
    <linearGradient id={`${id}dowel`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={stop(mk('wood'))} /><stop offset=".35" style={stop(mix('wood-light', 70, 'butter'))} /><stop offset="1" style={stop(mk('wood'))} /></linearGradient>
    <linearGradient id={`${id}slat`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={stop(mk('leaf-deep'))} /><stop offset=".35" style={stop(mix('leaf', 80, 'spring'))} /><stop offset="1" style={stop(mk('leaf-deep'))} /></linearGradient>
    <linearGradient id={`${id}birdBody`} x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" style={stop(mix('sea', 70, 'sky'))} /><stop offset=".55" style={stop(mk('water'))} /><stop offset="1" style={stop(mix('water', 70, 'indigo'))} /></linearGradient>
    <radialGradient id={`${id}birdHead`} cx=".35" cy=".3" r=".8"><stop offset="0" style={stop(mix('sea', 60, 'sky'))} /><stop offset="1" style={stop(mk('water'))} /></radialGradient>
    <pattern id={`${id}hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="6" style={fill(ink(18))} /></pattern>
    <filter id={`${id}glow`} x="-40%" y="-40%" width="180%" height="180%" colorInterpolationFilters="sRGB">
      <feMorphology in="SourceAlpha" operator="dilate" radius="2.5" result="grow" />
      <feGaussianBlur in="grow" stdDeviation="3.5" result="soft" />
      <feFlood style={{ floodColor: mk('sun') }} result="sun" />
      <feComposite in="sun" in2="soft" operator="in" result="halo" />
      <feMerge><feMergeNode in="halo" /><feMergeNode in="halo" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  </defs>;
}

/** The back wall and the work table, wide enough to fill any stage shape. */
export const Workshop = memo(function Workshop({ id }: { id: string }) {
  return <g aria-hidden="true">
    <rect x="-800" y="-800" width="2000" height="1226" fill={`url(#${id}wall)`} />
    <rect x="-200" y="-120" width="760" height="560" fill={`url(#${id}lamp)`} />
    {/* Faint tongue-and-groove boards behind the bench. */}
    <path d={Array.from({ length: 24 }, (_, i) => `M${-560 + i * 64} -400V426`).join('')} style={{ stroke: mix('paper-shade', 55, 'transparent'), strokeWidth: 2 }} />
    <rect x="-800" y="426" width="2000" height="8" style={fill(mk('wood-light'))} />
    <rect x="-800" y="433" width="2000" height="400" fill={`url(#${id}table)`} />
    <path d={grain(-800, 1200, 440, 520, 4, 3)} style={{ fill: 'none', stroke: mix('wood-dark', 40, 'transparent'), strokeWidth: 1.4 }} />
  </g>;
});

/** The wooden plinth both machines stand on, with its contact shadow. */
const Plinth = memo(function Plinth({ id }: { id: string }) {
  return <g>
    <ellipse cx={SX} cy="428" rx="160" ry="8" fill={`url(#${id}shadow)`} />
    <rect x="64" y="404" width="272" height="23" rx="7" fill={`url(#${id}plinth)`} />
    <path d={grain(70, 330, 409, 424, 3, 5)} style={{ fill: 'none', stroke: mix('wood-dark', 38, 'transparent'), strokeWidth: 1.1 }} />
    <rect x="68" y="405" width="264" height="2.4" rx="1.2" style={fill(light(55))} />
    <rect x="66" y="423" width="268" height="3" rx="1.5" style={fill(ink(14))} />
    {[84, 316].map(x => <g key={x}><circle cx={x} cy="415.5" r="4" fill={`url(#${id}stud)`} /><path d={`M${x - 2.4} ${415.5}h4.8`} style={{ stroke: mk('gold-deep'), strokeWidth: 1 }} /></g>)}
  </g>;
});

/** A ring of rivets on a circle, skipping an arc (degrees, clockwise from top). */
function Rivets({ id, r, count, skip = [0, 0], cx = SX, cy = SY, size = 2.6 }: { id: string; r: number; count: number; skip?: [number, number]; cx?: number; cy?: number; size?: number }) {
  return <>{Array.from({ length: count }, (_, i) => i * 360 / count).filter(a => !(a >= skip[0] && a <= skip[1]) && !(a - 360 >= skip[0] && a - 360 <= skip[1])).map(a => {
    const [x, y] = about(cx, cy - r, a, cx, cy);
    return <circle key={a} cx={x} cy={y} r={size} fill={`url(#${id}stud)`} />;
  })}</>;
}

/** Part groups carry their id, so a tap finds the part and the CSS can glow
 * the chosen one and soften the rest. */
function Part({ id, part, selected, children }: { id: string; part: PartId; selected: PartId | null; children: ReactNode }) {
  const lit = selected === part;
  return <g className="ck-part" data-crank-part={part} data-lit={lit} data-dim={!!selected && !lit} filter={lit ? `url(#${id}glow)` : undefined}>{children}</g>;
}

/* ------------------------------------------------------------- engine */
/** The engine's casing: cylinder jacket on a round crankcase cover. */
export const ENGINE_CASE = `M152 112H248V270H240A58 58 0 1 1 160 270H152Z`;
export const ENGINE_CASE_SPAN: readonly [number, number] = [146, 264];
const SPOKES = Array.from({ length: 6 }, (_, i) => {
  const pts = [[-6.5, -18], [-10, -48], [-4.5, -77], [4.5, -77], [2.5, -48], [6.5, -18]].map(([x, y]) => about(SX + x, SY + y, i * 60));
  const [a, b, c, d, e, f] = pts;
  return `M${a[0]} ${a[1]}Q${b[0]} ${b[1]} ${c[0]} ${c[1]}L${d[0]} ${d[1]}Q${e[0]} ${e[1]} ${f[0]} ${f[1]}Z`;
}).join('');
const BALANCE = `${arcPath(76, 18, 46)}`;

function Flywheel({ id, pose }: { id: string; pose: Pose }) {
  const turn = `rotate(${pose.deg} ${SX} ${SY})`, still = `rotate(${-pose.deg} ${SX} ${SY})`;
  return <>
    <g transform={turn}>
      <linearGradient id={`${id}spoke`} gradientUnits="userSpaceOnUse" x1={SX - 70} y1={SY - 70} x2={SX + 70} y2={SY + 70} gradientTransform={still}>
        <stop offset="0" style={stop(mix('poppy', 80, 'white'))} /><stop offset=".45" style={stop(mk('red'))} /><stop offset="1" style={stop(mix('red', 70, 'shadow'))} />
      </linearGradient>
      <path d={SPOKES} fill={`url(#${id}spoke)`} />
      <circle cx={SX} cy={SY} r="22" fill={`url(#${id}spoke)`} />
      <path d={BALANCE} style={{ fill: 'none', stroke: mk('brass'), strokeWidth: 9 }} />
      <path d={arcPath(78, 20, 44)} style={{ fill: 'none', stroke: mk('gold-light'), strokeWidth: 1.4, opacity: .8 }} />
    </g>
    <path d={ring(SX, SY, 90, 76)} fill={`url(#${id}rim)`} fillRule="evenodd" />
    <circle cx={SX} cy={SY} r="76.8" style={{ fill: 'none', stroke: ink(30), strokeWidth: 1.6 }} />
    <circle cx={SX} cy={SY} r="89.2" style={{ fill: 'none', stroke: light(50), strokeWidth: 1 }} />
    <path d={arcPath(84, 280, 345)} style={{ fill: 'none', stroke: light(75), strokeWidth: 3.2, strokeLinecap: 'round' }} />
    <path d={arcPath(84, 100, 160)} style={{ fill: 'none', stroke: ink(22), strokeWidth: 3, strokeLinecap: 'round' }} />
  </>;
}

/** The fixed frame: a teal pedestal carrying the shaft, on the plinth. */
const Pedestal = memo(function Pedestal({ id }: { id: string }) {
  return <g>
    <path d="M172 352C168 378 152 394 134 402H266C248 394 232 378 228 352Z" fill={`url(#${id}enamel)`} />
    <path d="M176 360C173 380 162 392 150 398" style={{ fill: 'none', stroke: light(28), strokeWidth: 3, strokeLinecap: 'round' }} />
    <rect x="124" y="397" width="152" height="9" rx="3" fill={`url(#${id}brassBar)`} />
    {[138, 262].map(x => <circle key={x} cx={x} cy="401.5" r="2.6" fill={`url(#${id}stud)`} />)}
  </g>;
});

/** The engine. `open` is 0 (case on) to 1 (case wiped away). */
export function EngineArt({ id, pose, open, selected = null }: { id: string; pose: Pose; open: number; selected?: PartId | null }) {
  const { pin, wristY: wy, lean, deg } = pose;
  const top = wy - 22, tail = top - 136;
  const edge = ENGINE_CASE_SPAN[0] + open * (ENGINE_CASE_SPAN[1] - ENGINE_CASE_SPAN[0]);
  const turn = `rotate(${deg} ${SX} ${SY})`;
  return <g>
    <Plinth id={id} />
    <Part id={id} part="wheel" selected={selected}><Flywheel id={id} pose={pose} /></Part>
    <Pedestal id={id} />
    {/* Inside the crankcase: a dark cavity the parts move in front of. */}
    <g>
      <circle cx={SX} cy={SY} r="54" fill={`url(#${id}cavity)`} />
      <rect x="158" y="236" width="84" height="60" fill={`url(#${id}cavity)`} />
      <circle cx={SX} cy={SY} r="53" style={{ fill: 'none', stroke: ink(30), strokeWidth: 2 }} />
    </g>
    <Part id={id} part="cylinder" selected={selected}>
      <rect x="175" y="118" width="50" height="146" fill={`url(#${id}bore)`} />
      <rect x="196" y="122" width="6" height="140" rx="3" style={fill(light(10))} />
      {[[158, 17], [225, 17]].map(([x, w]) => <g key={x}>
        <rect x={x} y="112" width={w} height="152" fill={`url(#${id}wall-steel)`} />
        <rect x={x} y="112" width={w} height="152" fill={`url(#${id}hatch)`} />
      </g>)}
      <rect x="158" y="112" width="84" height="8" style={fill(mk('steel-dark'))} />
      <rect x="175" y="120" width="50" height="3" style={fill(ink(30))} />
    </Part>
    <Part id={id} part="piston" selected={selected}>
      <rect x="197" y={tail} width="6" height={top - tail + 2} fill={`url(#${id}steelRod)`} />
      <rect x="175.5" y={top} width="49" height="40" rx="3" fill={`url(#${id}copper)`} />
      <rect x="175.5" y={top} width="49" height="3" rx="1.5" style={fill(light(35))} />
      {[7, 12.5].map(d => <rect key={d} x="175.5" y={top + d} width="49" height="1.8" style={fill(mix('umber', 70, 'transparent'))} />)}
      <path d={`M182 ${wy - 8}H218V${wy + 18}H182Z`} style={fill(mix('umber', 55, 'rust'))} />
      <path d={`M182 ${wy - 8}H218V${wy - 5}H182Z`} style={fill(ink(30))} />
    </Part>
    <Part id={id} part="crank" selected={selected}>
      <g transform={turn}>
        <linearGradient id={`${id}goldTurn`} gradientUnits="userSpaceOnUse" x1={SX - 40} y1={SY - 50} x2={SX + 36} y2={SY + 40} gradientTransform={`rotate(${-deg} ${SX} ${SY})`}>
          <stop offset="0" style={stop(mk('gold-light'))} /><stop offset=".5" style={stop(mk('gold'))} /><stop offset="1" style={stop(mk('gold-deep'))} />
        </linearGradient>
        <path d={`M${SX - 30} ${SY}A30 30 0 0 0 ${SX + 30} ${SY}Z`} fill={`url(#${id}goldTurn)`} />
        <path d={`M${SX - 18} ${SY}L${SX - 12} ${SY - R}A12 12 0 0 1 ${SX + 12} ${SY - R}L${SX + 18} ${SY}Z`} fill={`url(#${id}goldTurn)`} />
        <circle cx={SX} cy={SY} r="19" fill={`url(#${id}goldTurn)`} />
        <path d={`M${SX - 26} ${SY + 6}A27 27 0 0 0 ${SX + 26} ${SY + 6}`} style={{ fill: 'none', stroke: ink(22), strokeWidth: 1.4 }} />
        <circle cx={SX} cy={SY} r="7.5" fill={`url(#${id}steelBall)`} />
        <path d={`M${SX} ${SY - 6}V${SY + 6}`} style={{ stroke: mk('steel-dark'), strokeWidth: 1.6 }} />
      </g>
    </Part>
    <Part id={id} part="rod" selected={selected}>
      <g transform={`translate(${pin.x} ${pin.y}) rotate(${lean})`}>
        <path d={`M-5.5 -9L-3.6 ${-L + 7}H3.6L5.5 -9Z`} fill={`url(#${id}steelRod)`} />
        <circle r="13" fill={`url(#${id}steelRod)`} />
        <circle cy={-L} r="8.5" fill={`url(#${id}steelRod)`} />
        <path d={`M-2.6 -15L-1.8 ${-L + 12}`} style={{ stroke: light(70), strokeWidth: 1.4, strokeLinecap: 'round' }} />
        <circle r="13" style={{ fill: 'none', stroke: ink(20), strokeWidth: 1.2 }} />
      </g>
    </Part>
    {/* The two pins, lit from the top-left whichever way the parts face. */}
    <circle cx={pin.x} cy={pin.y} r="6.5" fill={`url(#${id}steelBall)`} className="ck-pin" data-dim={!!selected && selected !== 'crank' && selected !== 'rod'} />
    <circle cx={SX} cy={wy} r="5.2" fill={`url(#${id}steelBall)`} className="ck-pin" data-dim={!!selected && selected !== 'piston' && selected !== 'rod'} />

    {/* The front casing, wiped away from the left by a moving clip. */}
    {open < 1 && <g className="ck-case">
      <clipPath id={`${id}wipe`}><rect x={edge} y="80" width="320" height="320" /></clipPath>
      <clipPath id={`${id}caseShape`}><path d={ENGINE_CASE} /><rect x="146" y="262" width="108" height="10" /></clipPath>
      <g clipPath={`url(#${id}wipe)`}>
        <path d={ENGINE_CASE} fill={`url(#${id}enamel)`} />
        <path d="M162 122V258" style={{ stroke: light(30), strokeWidth: 7, strokeLinecap: 'round' }} />
        <path d={arcPath(48, 228, 300)} style={{ fill: 'none', stroke: light(30), strokeWidth: 5, strokeLinecap: 'round' }} />
        <path d="M240 124V256" style={{ stroke: ink(18), strokeWidth: 5, strokeLinecap: 'round' }} />
        {[134, 222].map(y => <g key={y}>
          <rect x="148" y={y} width="104" height="8" rx="2.5" fill={`url(#${id}brassBar)`} />
          {[158, 178, 200, 222, 242].map(x => <circle key={x} cx={x} cy={y + 4} r="1.9" style={fill(mk('gold-deep'))} />)}
        </g>)}
        <rect x="146" y="263" width="108" height="9" rx="3" fill={`url(#${id}brassBar)`} />
        <ellipse cx={SX} cy="182" rx="22" ry="15" fill={`url(#${id}brass)`} />
        <ellipse cx={SX} cy="182" rx="17.5" ry="11" style={{ fill: mix('teal-deep', 85, 'shadow'), stroke: mk('gold-deep'), strokeWidth: 1 }} />
        <circle cx={SX} cy="182" r="6.5" style={{ fill: 'none', stroke: mk('gold-light'), strokeWidth: 2.4, strokeDasharray: '2.2 1.9' }} />
        <circle cx={SX} cy="182" r="2.4" style={fill(mk('gold-light'))} />
        {[-19, 19].map(dx => <circle key={dx} cx={SX + dx} cy="182" r="1.6" style={fill(mk('gold-deep'))} />)}
        <Rivets id={id} r={47} count={14} skip={[-40, 40]} />
        <circle cx={SX} cy={SY} r="17" fill={`url(#${id}brass)`} />
        <path d={Array.from({ length: 6 }, (_, i) => { const [x, y] = about(SX, SY - 9.5, i * 60 + 30); return `${i ? 'L' : 'M'}${x} ${y}`; }).join('') + 'Z'} fill={`url(#${id}stud)`} />
        <circle cx={SX - 4} cy={SY - 5} r="3" style={fill(light(55))} />
        {/* A little brass oil cup on the crankcase shoulder. */}
        <path d="M244 284l11 -6l3 5l-11 6Z" fill={`url(#${id}brassBar)`} />
        <rect x="252" y="268" width="10" height="13" rx="2" fill={`url(#${id}brass)`} transform="rotate(-28 257 274)" />
        <ellipse cx="260" cy="266.5" rx="6" ry="2.4" transform="rotate(-28 260 266.5)" style={fill(mk('gold-deep'))} />
      </g>
      {open > 0 && <g clipPath={`url(#${id}caseShape)`}>
        <rect x={edge - 16} y="80" width="16" height="320" style={fill(ink(26))} />
        <rect x={edge} y="80" width="4" height="320" style={fill(mk('teal-deep'))} />
        <rect x={edge} y="80" width="1.5" height="320" style={fill(mix('sea', 70, 'white'))} />
      </g>}
    </g>}
    {open > 0 && <path d={ENGINE_CASE} className="ck-ghost" style={{ fill: 'none', stroke: mix('teal', 70, 'transparent'), strokeWidth: 2, strokeDasharray: '7 6', opacity: Math.min(1, open) * .8 }} />}

    {/* Above the case: the cylinder head and gland, the top of the piston's
        tail rod and its red knob — the motion seen with the case shut. */}
    <Part id={id} part="cylinder" selected={selected}>
      <rect x="148" y="98" width="104" height="15" rx="3.5" fill={`url(#${id}brassBar)`} />
      {[160, 180, 220, 240].map(x => <circle key={x} cx={x} cy="105.5" r="2.6" fill={`url(#${id}stud)`} />)}
      <rect x="186" y="86" width="28" height="13" rx="2.5" fill={`url(#${id}brass)`} />
      <rect x="183" y="84" width="34" height="4.5" rx="2" fill={`url(#${id}brassBar)`} />
    </Part>
    <Part id={id} part="piston" selected={selected}>
      <rect x="197" y={tail} width="6" height={Math.max(0, 86 - tail)} fill={`url(#${id}steelRod)`} />
      <circle cx={SX} cy={tail} r="8.5" fill={`url(#${id}redBall)`} />
    </Part>
  </g>;
}

/* ---------------------------------------------------------------- toy */
export const TOY_CASE = `M100 164H300V394H100Z`;
export const TOY_CASE_SPAN: readonly [number, number] = [96, 304];
const POST_X = 308;
/** The bird rides this far above the wrist pin, on its stick. */
export const BIRD_STICK = 94;
/** The beak's tip, from the bird's feet. The bell hangs exactly where the tip
 * arrives at the top of the stroke, so it is struck once per turn. */
export const BEAK = { x: 42, y: -50 } as const;
export const BELL_LIP = { x: SX + BEAK.x, y: SY - (L + R) - BIRD_STICK + BEAK.y } as const;
const BELL_X = BELL_LIP.x + 8, BELL_TOP = BELL_LIP.y - 25;

function Daisy({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-2 6C-8 12 -14 12 -18 9C-13 6 -7 5 -2 6Z" style={fill(mk('leaf'))} />
    <path d="M2 6C8 13 15 13 18 10C13 6 7 5 2 6Z" style={fill(mix('leaf', 80, 'spring'))} />
    {Array.from({ length: 6 }, (_, i) => <ellipse key={i} cx="0" cy="-6" rx="3.6" ry="6" transform={`rotate(${i * 60})`} style={fill(mk('butter'))} />)}
    <circle r="3.6" style={fill(mk('amber'))} />
  </g>;
}
const ToyBox = memo(function ToyBox({ id }: { id: string }) {
  return <g>
    <rect x="100" y="164" width="200" height="230" fill={`url(#${id}woodBack)`} />
    <path d={grain(102, 298, 172, 390, 10, 2)} style={{ fill: 'none', stroke: mix('wood', 55, 'transparent'), strokeWidth: 1.3 }} />
    <rect x="100" y="164" width="200" height="14" style={fill(ink(18))} />
    <rect x="100" y="164" width="10" height="230" style={fill(ink(12))} />
    <rect x="86" y="160" width="14" height="236" fill={`url(#${id}post)`} />
    <rect x="300" y="160" width="14" height="236" fill={`url(#${id}post)`} />
    <rect x="88" y="160" width="3.5" height="236" style={fill(light(25))} />
    <rect x="302" y="160" width="3" height="236" style={fill(light(14))} />
    <rect x="80" y="392" width="240" height="14" rx="3" fill={`url(#${id}woodBoard)`} />
    <rect x="82" y="393" width="236" height="2" rx="1" style={fill(light(45))} />
  </g>;
});
function TopBoard({ id }: { id: string }) {
  return <g>
    <rect x="76" y="150" width="248" height="14" rx="3.5" fill={`url(#${id}woodBoard)`} />
    <path d={grain(80, 320, 153, 161, 2, 4)} style={{ fill: 'none', stroke: mix('wood-dark', 30, 'transparent'), strokeWidth: 1 }} />
    <rect x="78" y="151" width="244" height="2.4" rx="1.2" style={fill(light(55))} />
    <rect x="78" y="162" width="244" height="2" style={fill(ink(16))} />
  </g>;
}
function Bird({ id }: { id: string }) {
  return <g>
    <ellipse cx="0" cy="-1" rx="13" ry="4" style={fill(mk('wood-dark'))} />
    <ellipse cx="0" cy="-2.5" rx="11" ry="3" style={fill(mk('wood'))} />
    <path d="M-20 -26C-34 -40 -44 -52 -40 -60C-33 -58 -24 -46 -14 -34Z" style={fill(mk('indigo'))} />
    <path d="M-16 -28C-34 -36 -46 -42 -48 -50C-40 -52 -28 -44 -12 -34Z" style={fill(mix('indigo', 75, 'bluebell'))} />
    <ellipse cx="0" cy="-20" rx="25" ry="18.5" transform="rotate(-18 0 -20)" fill={`url(#${id}birdBody)`} />
    <path d="M4 -6C18 -9 25 -20 24 -31C18 -22 10 -15 -4 -11Z" style={fill(mix('butter', 85, 'sun'))} />
    <path d="M-17 -18C-8 -32 8 -32 12 -24C6 -16 -6 -12 -17 -18Z" style={fill(mk('indigo'))} />
    {[-9, -2, 5].map(x => <circle key={x} cx={x} cy={-22} r="1.7" style={fill(mix('sky', 80, 'white'))} />)}
    <path d="M-15 -26C-9 -34 -2 -35 4 -32" style={{ fill: 'none', stroke: light(40), strokeWidth: 2, strokeLinecap: 'round' }} />
    <circle cx="22" cy="-40" r="13.5" fill={`url(#${id}birdHead)`} />
    <path d="M17 -52C15 -60 18 -63 22 -60C21 -57 20 -55 19 -52Z" style={fill(mk('indigo'))} />
    <path d="M21 -53C23 -60 27 -61 28 -57C26 -55 24 -54 22 -52Z" style={fill(mix('indigo', 75, 'bluebell'))} />
    <path d={`M31 -48.5L${BEAK.x} ${BEAK.y}L35.4 -41.6Z`} style={fill(mk('orange'))} />
    <path d={`M31 -48.5L${BEAK.x} ${BEAK.y}L33.5 -45.5Z`} style={fill(mk('amber'))} />
    <circle cx="25.5" cy="-43" r="4.2" style={fill(mk('white'))} />
    <circle cx="26.6" cy="-43.4" r="2.4" style={fill(mk('ink'))} />
    <circle cx="27.4" cy="-44.3" r=".9" style={fill(mk('white'))} />
    <circle cx="20" cy="-35" r="3.4" style={fill(mix('rose', 70, 'transparent'))} />
  </g>;
}
function Bell({ id, swing }: { id: string; swing: number }) {
  return <g>
    <path d={`M${POST_X} 150V10Q${POST_X} 2 ${POST_X - 8} 2H${BELL_X + 4}`} style={{ fill: 'none', stroke: mk('brass'), strokeWidth: 4.5, strokeLinecap: 'round' }} />
    <path d={`M${POST_X - 1.2} 148V11`} style={{ fill: 'none', stroke: mk('gold-light'), strokeWidth: 1.2, strokeLinecap: 'round' }} />
    <rect x={POST_X - 8} y="143" width="16" height="8" rx="2" fill={`url(#${id}brassBar)`} />
    <g transform={`rotate(${swing} ${BELL_X} 3)`}>
      <path d={`M${BELL_X} 3V${BELL_TOP + 2}`} style={{ stroke: mk('gold-deep'), strokeWidth: 2 }} />
      <circle cx={BELL_X} cy={BELL_LIP.y + 1.5} r="3.6" style={fill(mk('gold-deep'))} />
      <path d={`M${BELL_X - 15} ${BELL_LIP.y}C${BELL_X - 12} ${BELL_LIP.y - 6} ${BELL_X - 11} ${BELL_TOP + 14} ${BELL_X - 9} ${BELL_TOP + 6}C${BELL_X - 7} ${BELL_TOP} ${BELL_X + 7} ${BELL_TOP} ${BELL_X + 9} ${BELL_TOP + 6}C${BELL_X + 11} ${BELL_TOP + 14} ${BELL_X + 12} ${BELL_LIP.y - 6} ${BELL_X + 15} ${BELL_LIP.y}Z`} fill={`url(#${id}brass)`} />
      <rect x={BELL_X - 16} y={BELL_LIP.y - 3} width="32" height="4" rx="2" fill={`url(#${id}brassBar)`} />
      <path d={`M${BELL_X - 6} ${BELL_TOP + 7}C${BELL_X - 8} ${BELL_TOP + 13} ${BELL_X - 9} ${BELL_LIP.y - 9} ${BELL_X - 10} ${BELL_LIP.y - 5}`} style={{ fill: 'none', stroke: light(70), strokeWidth: 2.2, strokeLinecap: 'round' }} />
      <circle cx={BELL_X} cy={BELL_TOP + 1} r="3" fill={`url(#${id}stud)`} />
    </g>
  </g>;
}

/** The bird toy. `swing` (degrees) rocks the bell after a peck. */
export function ToyArt({ id, pose, open, selected = null, swing = 0 }: { id: string; pose: Pose; open: number; selected?: PartId | null; swing?: number }) {
  const { pin, wristY: wy, lean, deg } = pose;
  const feet = wy - BIRD_STICK;
  const edge = TOY_CASE_SPAN[0] + open * (TOY_CASE_SPAN[1] - TOY_CASE_SPAN[0]);
  const [hx, hy] = about(SX, SY - 68, deg + 180), [mx, my] = about(SX, SY - 30, deg + 180);
  return <g>
    <Plinth id={id} />
    <ToyBox id={id} />
    <Bell id={id} swing={swing} />
    <Part id={id} part="bird" selected={selected}>
      <rect x="195" y={feet} width="10" height={wy - feet} fill={`url(#${id}dowel)`} />
    </Part>
    <Part id={id} part="crank" selected={selected}>
      <g transform={`rotate(${deg} ${SX} ${SY})`}>
        <linearGradient id={`${id}amberTurn`} gradientUnits="userSpaceOnUse" x1={SX - 40} y1={SY - 46} x2={SX + 40} y2={SY + 46} gradientTransform={`rotate(${-deg} ${SX} ${SY})`}>
          <stop offset="0" style={stop(mix('amber', 60, 'butter'))} /><stop offset=".5" style={stop(mk('amber'))} /><stop offset="1" style={stop(mix('amber', 70, 'orange'))} />
        </linearGradient>
        <circle cx={SX} cy={SY} r="46" fill={`url(#${id}amberTurn)`} />
        <circle cx={SX} cy={SY} r="38" style={{ fill: 'none', stroke: mix('orange', 55, 'transparent'), strokeWidth: 2, strokeDasharray: '2 5', strokeLinecap: 'round' }} />
        <circle cx={SX} cy={SY} r="45" style={{ fill: 'none', stroke: mix('orange', 50, 'transparent'), strokeWidth: 2 }} />
      </g>
      <circle cx={SX} cy={SY} r="46" style={{ fill: 'none', stroke: light(40), strokeWidth: 2, strokeDasharray: '40 300', strokeDashoffset: -205 }} />
    </Part>
    <Part id={id} part="rod" selected={selected}>
      <g transform={`translate(${pin.x} ${pin.y}) rotate(${lean})`}>
        <rect x="-7" y={-L - 8} width="14" height={L + 16} rx="7" fill={`url(#${id}slat)`} />
        <rect x="-4.5" y={-L - 2} width="2" height={L - 2} rx="1" style={fill(light(30))} />
      </g>
    </Part>
    <circle cx={pin.x} cy={pin.y} r="6" style={fill(mk('wood-dark'))} className="ck-pin" data-dim={!!selected && selected !== 'crank' && selected !== 'rod'} />
    <circle cx={pin.x - 1.6} cy={pin.y - 1.8} r="2" style={fill(light(35))} className="ck-pin" />
    <circle cx={SX} cy={wy} r="5" style={fill(mk('wood-dark'))} className="ck-pin" data-dim={!!selected && selected !== 'bird' && selected !== 'rod'} />

    {open < 1 && <g className="ck-case">
      <clipPath id={`${id}wipe`}><rect x={edge} y="150" width="200" height="260" /></clipPath>
      <g clipPath={`url(#${id}wipe)`}>
        <path d={TOY_CASE} fill={`url(#${id}paint)`} />
        <rect x="112" y="176" width="176" height="206" rx="12" style={{ fill: 'none', stroke: mix('butter', 85, 'transparent'), strokeWidth: 3, strokeDasharray: '0.5 9', strokeLinecap: 'round' }} />
        <rect x="104" y="168" width="192" height="5" rx="2" style={fill(light(22))} />
        <Daisy x={134} y={200} /><Daisy x={266} y={200} /><Daisy x={132} y={360} s={0.85} /><Daisy x={268} y={360} s={0.85} />
        {/* A little painted sun between the flowers. */}
        <path d={Array.from({ length: 10 }, (_, i) => { const [x0, y0] = about(SX, 200 - 10.5, i * 36, SX, 200), [x1, y1] = about(SX, 200 - 15.5, i * 36, SX, 200); return `M${x0} ${y0}L${x1} ${y1}`; }).join('')} style={{ stroke: mix('butter', 90, 'transparent'), strokeWidth: 2.6, strokeLinecap: 'round' }} />
        <circle cx={SX} cy="200" r="7.5" style={fill(mk('butter'))} />
        <circle cx={SX - 2} cy="198" r="2.5" style={fill(light(55))} />
        <circle cx={SX} cy={SY} r="52" style={{ fill: 'none', stroke: mix('butter', 70, 'transparent'), strokeWidth: 2.5, strokeDasharray: '1 7', strokeLinecap: 'round' }} />
      </g>
      {open > 0 && <g clipPath={`url(#${id}wipe)`}>
        <rect x={edge} y="164" width="5" height="230" style={fill(mix('red', 70, 'shadow'))} />
        <rect x={edge} y="164" width="1.4" height="230" style={fill(mix('poppy', 50, 'white'))} />
      </g>}
      {open > 0 && <rect x={edge - 14} y="164" width="14" height="230" style={fill(ink(18))} />}
    </g>}

    <TopBoard id={id} />
    <Part id={id} part="bird" selected={selected}>
      <rect x="195" y={feet} width="10" height={Math.max(0, 151 - feet)} fill={`url(#${id}dowel)`} />
      <g transform={`translate(${SX} ${feet})`}><Bird id={id} /></g>
    </Part>
    <ellipse cx={SX} cy="151" rx="10" ry="3" style={fill(mk('gold-deep'))} />
    <ellipse cx={SX} cy="150.4" rx="8" ry="2" style={fill(mk('gold-light'))} />
    <rect x="195" y="146" width="10" height="5" fill={`url(#${id}dowel)`} />

    <Part id={id} part="handle" selected={selected}>
      <path d={`M${SX} ${SY}L${hx} ${hy}`} style={{ stroke: mk('wood-dark'), strokeWidth: 17, strokeLinecap: 'round' }} />
      <path d={`M${SX} ${SY}L${hx} ${hy}`} style={{ stroke: mk('wood'), strokeWidth: 13, strokeLinecap: 'round' }} />
      <path d={`M${SX} ${SY}L${mx} ${my}`} style={{ stroke: light(18), strokeWidth: 4, strokeLinecap: 'round' }} />
      <circle cx={SX} cy={SY} r="12" fill={`url(#${id}brass)`} />
      <circle cx={SX} cy={SY} r="4" style={fill(mk('gold-deep'))} />
      <ellipse cx={hx + 2} cy={hy + 3} rx="15" ry="14" style={fill(ink(22))} />
      <circle cx={hx} cy={hy} r="14.5" fill={`url(#${id}redBall)`} />
    </Part>
  </g>;
}

/** Where each part's label tag sits, and the moving point its leader line
 * reaches, for the present pose. */
export function tagFor(part: PartId, pose: Pose): { tag: { x: number; y: number }; at: { x: number; y: number } } {
  const { pin, wristY: wy } = pose;
  switch (part) {
    case 'wheel': return { tag: { x: 92, y: 384 }, at: { x: SX - 78, y: SY + 28 } };
    case 'crank': return { tag: { x: 308, y: 384 }, at: { x: SX + (pin.x - SX) * 0.55, y: SY + (pin.y - SY) * 0.55 } };
    case 'rod': return { tag: { x: 92, y: 214 }, at: { x: (pin.x + SX) / 2, y: (pin.y + wy) / 2 } };
    case 'piston': return { tag: { x: 308, y: 196 }, at: { x: 222, y: wy - 4 } };
    case 'cylinder': return { tag: { x: 92, y: 140 }, at: { x: 164, y: 160 } };
    case 'handle': { const [x, y] = about(SX, SY - 46, pose.deg + 180); return { tag: { x: 312, y: 236 }, at: { x, y } }; }
    case 'bird': return { tag: { x: 96, y: 44 }, at: { x: SX - 8, y: wy - BIRD_STICK - 22 } };
  }
}
