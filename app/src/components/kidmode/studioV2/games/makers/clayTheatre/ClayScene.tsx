import { memo, useId, type CSSProperties } from 'react';
import {
  BODY_KEYFRAMES, beatBody, bendLeaf, boil, leafPoints, lerp, place, placePoint, seeded, smoothPath, span, type Leaf, type Oval, type PartKey, type Pt, PART_KEYS,
} from './clayShapes';
import {
  AYA_GROUND, FIRST_SHOW, FRESH_HANDS, FROG_D, FROG_X0, FROG_XF, JUMP_SCALE, PLANTER_X, REACH_TOUCH, SOIL_Y, SPLASH_X, ayaFilm, bubbles, cameraTop, droplets, foamRings,
  frogFilm, rocketFilm, rocketKey, ribbonSegments, splashCrown, starsOf, surfaceAt, TAIL_X, tailWave, timeOf, whaleBody, whalePose,
  type AyaFrame, type ClayPrint, type Hands, type ReelId, type ShowLook,
} from './clayTheatreRules';
import {
  BLOOM_Y, CALL_SECONDS, GARDEN_SUN, JUMP_SUN, MOON, PADS, PAD_Y, POND_SUN, arcOf, cloudsOf, cometAt, curtainCall, fishHop, heroPlace, heroPress, moonSpin, popIn, starFlick, wobble,
  type LiveTouch,
} from './clayHands';
import { CLAYS, INK, chalky, fade, mix, type ClayId } from './clayInk';

/** One frame of a clay film, drawn from nothing but the reel, the frame
 * number, the clay, the child's lasting choices (`hands`), tonight's
 * dressing (`show`) and the live touches with their ages: no state, no
 * history. `lite` drops the felt curtain and the clay filter for the tiny
 * frames on the film strip. */
export interface SceneProps { reel: ReelId; frame: number; body: ClayId; trim: ClayId; hands?: Hands; show?: ShowLook; touches?: readonly LiveTouch[]; lite?: boolean; label?: string }
const NO_TOUCH: readonly LiveTouch[] = [];
export function ClayScene({ reel, frame, body, trim, hands = FRESH_HANDS, show = FIRST_SHOW, touches = NO_TOUCH, lite = false, label }: SceneProps) {
  const uid = `ct${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const t = timeOf(frame);
  const style = { '--ct-body': chalky(CLAYS[body]), '--ct-trim': chalky(CLAYS[trim]) } as CSSProperties;
  const ids = sceneIds(uid, lite);
  const reelProps: ReelProps = { t, frame, ids, hands, show, touches: lite ? NO_TOUCH : touches };
  return <svg viewBox="0 0 400 300" className="ct-scene" data-reel={reel} data-frame={frame} style={style} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false" preserveAspectRatio="xMidYMid slice">
    <SceneDefs uid={uid} lite={lite} />
    {reel === 'rocket' ? <RocketReel {...reelProps} /> : reel === 'jump' ? <JumpReel {...reelProps} /> : reel === 'ayaSeed' ? <AyaReel {...reelProps} /> : <FrogReel {...reelProps} />}
    {!lite && <FeltCurtain ids={ids} drapes={0} ripple={touches.reduce((sum, l) => l.toy === 'feltDrape' ? sum + wobble(l.since) : sum, 0)} />}
  </svg>;
}
interface ReelProps { t: number; frame: number; ids: Ids; hands: Hands; show: ShowLook; touches: readonly LiveTouch[] }

type Ids = ReturnType<typeof sceneIds>;
function sceneIds(uid: string, lite: boolean) {
  const url = (name: string) => `url(#${uid}-${name})`;
  return { uid, url, clay: lite ? undefined : url('clay'), soft: lite ? undefined : url('soft') };
}

/* ── shared clay materials ─────────────────────────────────────────────── */

function ClayGrad({ id, c, light = 50, dark = 68 }: { id: string; c: string; light?: number; dark?: number }) {
  return <radialGradient id={id} cx=".34" cy=".28" r=".86" fx=".3" fy=".22">
    <stop offset="0" style={{ stopColor: mix(c, light, INK.white) }} />
    <stop offset=".46" style={{ stopColor: c }} />
    <stop offset="1" style={{ stopColor: mix(c, dark, INK.shadow) }} />
  </radialGradient>;
}
const SceneDefs = memo(function SceneDefs({ uid, lite }: { uid: string; lite: boolean }) {
  const id = (name: string) => `${uid}-${name}`;
  return <defs>
    <ClayGrad id={id('body')} c="var(--ct-body)" />
    <ClayGrad id={id('trim')} c="var(--ct-trim)" light={55} />
    <ClayGrad id={id('gold')} c={INK.sun} light={45} dark={60} />
    <ClayGrad id={id('smoke')} c={INK.cream} light={60} dark={82} />
    <ClayGrad id={id('frog')} c={chalky(INK.leaf)} light={45} />
    <ClayGrad id={id('belly')} c={INK.butter} light={60} dark={82} />
    <ClayGrad id={id('pad')} c={mix(INK.leaf, 85, INK.leafDeep)} light={40} dark={74} />
    <ClayGrad id={id('petal')} c={INK.blossom} light={65} dark={78} />
    <ClayGrad id={id('flame')} c={INK.orange} light={30} dark={80} />
    <ClayGrad id={id('cloud')} c={INK.snow} light={70} dark={88} />
    <ClayGrad id={id('moon')} c={INK.butter} light={60} dark={84} />
    <ClayGrad id={id('aya')} c={chalky(mix(INK.water, 58, INK.bluebell))} light={46} dark={70} />
    <ClayGrad id={id('fluff')} c={INK.snow} light={70} dark={86} />
    <ClayGrad id={id('pot')} c={INK.white} light={80} dark={88} />
    <linearGradient id={id('felt')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: mix(INK.teal, 74, INK.sea) }} /><stop offset="1" style={{ stopColor: mix(INK.tealDeep, 62, INK.teal) }} /></linearGradient>
    <linearGradient id={id('boards')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: mix(INK.woodLight, 62, INK.white) }} /><stop offset="1" style={{ stopColor: mix(INK.woodLight, 86, INK.wood) }} /></linearGradient>
    <radialGradient id={id('glass')} cx=".35" cy=".3" r=".8"><stop offset="0" style={{ stopColor: INK.white }} /><stop offset=".4" style={{ stopColor: INK.skyPale }} /><stop offset="1" style={{ stopColor: INK.sky }} /></radialGradient>
    <linearGradient id={id('night')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: mix(INK.night, 82, INK.indigoDeep) }} /><stop offset=".7" style={{ stopColor: mix(INK.indigo, 70, INK.violet) }} /><stop offset="1" style={{ stopColor: mix(INK.violet, 55, INK.rose) }} /></linearGradient>
    <linearGradient id={id('day')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: INK.sky }} /><stop offset="1" style={{ stopColor: INK.skyPale }} /></linearGradient>
    <linearGradient id={id('deep')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: INK.sea }} /><stop offset=".45" style={{ stopColor: INK.teal }} /><stop offset="1" style={{ stopColor: mix(INK.tealDeep, 60, INK.indigoDeep) }} /></linearGradient>
    <linearGradient id={id('dusk')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: mix(INK.sky, 70, INK.skyPale) }} /><stop offset=".75" style={{ stopColor: mix(INK.butter, 70, INK.skyPale) }} /><stop offset="1" style={{ stopColor: INK.blossom }} /></linearGradient>
    <linearGradient id={id('pond')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: mix(INK.celadon, 80, INK.sea) }} /><stop offset="1" style={{ stopColor: mix(INK.teal, 75, INK.celadonDeep) }} /></linearGradient>
    <linearGradient id={id('sand')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: INK.sand }} /><stop offset="1" style={{ stopColor: mix(INK.sand, 60, INK.wood) }} /></linearGradient>
    <linearGradient id={id('ray')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: fade(INK.white, 34) }} /><stop offset="1" style={{ stopColor: fade(INK.white, 0) }} /></linearGradient>
    <pattern id={id('hatch')} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" style={{ fill: INK.linen }} /><rect width="1.6" height="5" style={{ fill: INK.linenShade }} /></pattern>
    {!lite && <>
      {/* Matte clay: a soft inner shadow on the lower right, a soft lift on the upper left. */}
      <filter id={id('clay')} x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
        <feOffset in="SourceAlpha" dx="-3" dy="-4" result="o" />
        <feGaussianBlur in="o" stdDeviation="3.4" result="b" />
        <feComposite in="SourceAlpha" in2="b" operator="arithmetic" k2="1" k3="-1" result="rim" />
        <feFlood style={{ floodColor: INK.shadow, floodOpacity: 0.34 }} result="sc" />
        <feComposite in="sc" in2="rim" operator="in" result="shade" />
        <feOffset in="SourceAlpha" dx="2.4" dy="3" result="o2" />
        <feGaussianBlur in="o2" stdDeviation="2.2" result="b2" />
        <feComposite in="SourceAlpha" in2="b2" operator="arithmetic" k2="1" k3="-1" result="rim2" />
        <feFlood style={{ floodColor: INK.white, floodOpacity: 0.42 }} result="hc" />
        <feComposite in="hc" in2="rim2" operator="in" result="hi" />
        <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="shade" /><feMergeNode in="hi" /></feMerge>
      </filter>
      <filter id={id('soft')} x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="3" /></filter>
      {/* Felt: a soft nap over the cloth, shaded like the clay. */}
      <filter id={id('nap')} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="7" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .34 -.05" result="fuzz" />
        <feComposite in="fuzz" in2="SourceAlpha" operator="in" result="lint" />
        <feOffset in="SourceAlpha" dx="-2" dy="-3" result="o" /><feGaussianBlur in="o" stdDeviation="3" result="b" />
        <feComposite in="SourceAlpha" in2="b" operator="arithmetic" k2="1" k3="-1" result="rim" />
        <feFlood style={{ floodColor: INK.shadow, floodOpacity: 0.3 }} result="sc" /><feComposite in="sc" in2="rim" operator="in" result="shade" />
        <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="lint" /><feMergeNode in="shade" /></feMerge>
      </filter>
    </>}
  </defs>;
});

const f1 = (v: number) => Math.round(v * 10) / 10;
/** A rounded clay star (smooth through alternating points). */
function starPoints(cx: number, cy: number, r: number, rot = 0): Pt[] {
  return Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5 + rot, rr = i % 2 ? r * 0.52 : r; return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as Pt; });
}
/** Ridged clay bands: a wavy top edge, a highlight ridge along it. */
function bandPath(y: number, t: number, phase: number, amp: number, x0 = -10, x1 = 410, bottom = 320): string {
  const pts: string[] = [];
  for (let x = x0; x <= x1; x += 10) pts.push(`${x} ${f1(y + amp * Math.sin(x / 30 + t * 1.6 + phase) + amp * 0.4 * Math.sin(x / 9 + phase * 2))}`);
  return `M${pts.join('L')}L${x1} ${bottom}L${x0} ${bottom}Z`;
}
function ridgePath(y: number, t: number, phase: number, amp: number): string {
  const pts: string[] = [];
  for (let x = -10; x <= 410; x += 10) pts.push(`${x} ${f1(y + 2 + amp * Math.sin(x / 30 + t * 1.6 + phase) + amp * 0.4 * Math.sin(x / 9 + phase * 2))}`);
  return `M${pts.join('L')}`;
}
/** A tiny fingerprint: three nested arcs, pressed into the clay. */
function Print({ x, y, r, rot, o, tone = INK.white }: { x: number; y: number; r: number; rot: number; o: number; tone?: string }) {
  if (o <= 0.01) return null;
  return <g transform={`translate(${f1(x)} ${f1(y)}) rotate(${f1(rot)})`} style={{ opacity: o }} fill="none" strokeLinecap="round">
    {[1, 0.7, 0.42].map((k, i) => <path key={i} d={`M${f1(-r * k)} 0A${f1(r * k)} ${f1(r * k * 0.8)} 0 0 1 ${f1(r * k)} 0`} style={{ stroke: tone, strokeWidth: 1.1 }} />)}
  </g>;
}

/* ── the clay whale / lump / rocket ───────────────────────────────────── */

interface Body { local: Pt[]; parts: PartKey; cx: number; cy: number; rot: number; sx: number; sy: number; lift: number; flame?: number; bend?: number }
/** The clay body and its parts, placed and boiled for this frame. */
function ClayBody({ b, frame, ids, salt = 1 }: { b: Body; frame: number; ids: Ids; salt?: number }) {
  const put = (pts: readonly Pt[], s: number) => boil(place(pts, b.cx, b.cy, b.rot, b.sx, b.sy), frame, salt * 31 + s);
  const at = (p: Pt) => placePoint(p, b.cx, b.cy, b.rot, b.sx, b.sy);
  const scale = (b.sx + b.sy) / 2;
  const outline = smoothPath(put(b.local, 1));
  const clip = `${ids.uid}-clip${salt}`;
  const leaf = (l: Leaf, s: number) => smoothPath(put(beatBody(leafPoints(bendLeaf(l, b.bend ?? 0)), b.lift), s));
  const oval = (o: Oval, fill: string) => {
    if (o.rx < 0.5 || o.ry < 0.5) return null;
    const [x, y] = at([o.cx, o.cy]);
    return <ellipse cx={f1(x)} cy={f1(y)} rx={f1(o.rx * b.sx)} ry={f1(o.ry * b.sy)} transform={`rotate(${f1(b.rot)} ${f1(x)} ${f1(y)})`} style={{ fill }} />;
  };
  const { eye, smile, spout, dent } = b.parts;
  const [ex, ey] = at([eye.x, eye.y]);
  const flame = b.flame ?? 0;
  const smilePts = [at([eye.x + 6, eye.y + 17]), at([eye.x + 17, eye.y + 21]), at([eye.x + 27, eye.y + 14])];
  const [dx, dy] = at([14, -42]);
  const [sxp, syp] = at([spout.x, spout.y]);
  return <g className="ct-body">
    {flame > 0.02 && <g style={{ opacity: Math.min(1, flame * 1.6) }}>
      <path d={smoothPath(put(leafPoints({ ax: -74, ay: 0, tx: -74 - 62 * flame, ty: 0, w: 17 * Math.min(1, flame + 0.2) }), 60))} style={{ fill: `url(#${ids.uid}-flame)` }} filter={ids.clay} />
      <path d={smoothPath(put(leafPoints({ ax: -74, ay: 0, tx: -74 - 38 * flame, ty: 0, w: 9 * Math.min(1, flame + 0.2) }), 61))} style={{ fill: INK.sun }} />
    </g>}
    <g filter={ids.clay}>
      <path d={leaf(b.parts.flukes[0], 20)} style={{ fill: `url(#${ids.uid}-body)` }} />
      <path d={leaf(b.parts.flukes[1], 21)} style={{ fill: mix('var(--ct-body)', 82, INK.shadow) }} />
      <path d={outline} style={{ fill: `url(#${ids.uid}-body)` }} />
      <clipPath id={clip}><path d={outline} /></clipPath>
      <g clipPath={`url(#${clip})`}>
        {oval(b.parts.trim, `url(#${ids.uid}-trim)`)}
        {oval(b.parts.band, `url(#${ids.uid}-trim)`)}
      </g>
    </g>
    {/* Fingerprints and, on the lump, the big thumb dent and its folds. */}
    <g clipPath={`url(#${clip})`}>
      <Print x={at([-34, -18])[0]} y={at([-34, -18])[1]} r={7 * scale} rot={b.rot + 20} o={0.2} />
      <Print x={at([10, 20])[0]} y={at([10, 20])[1]} r={6 * scale} rot={b.rot - 30} o={0.14} tone={INK.shadow} />
      {dent > 0.02 && <>
        <g transform={`translate(${f1(dx)} ${f1(dy + 4 * scale)}) rotate(${f1(b.rot + 12)}) scale(${f1(scale)})`} style={{ opacity: dent }}>
          <ellipse cx="-1.5" cy="-1.5" rx="17" ry="11" style={{ fill: fade(INK.shadow, 34) }} filter={ids.soft} />
          <ellipse cx="2" cy="2" rx="13.5" ry="8" style={{ fill: mix('var(--ct-body)', 70, INK.white) }} filter={ids.soft} />
        </g>
        <Print x={dx + 1} y={dy + 5 * scale} r={10 * scale} rot={b.rot + 12} o={0.5 * dent} tone={INK.shadow} />
        <path d={`M${f1(at([-44, 6])[0])} ${f1(at([-44, 6])[1])}Q${f1(at([-26, 22])[0])} ${f1(at([-26, 22])[1])} ${f1(at([-4, 18])[0])} ${f1(at([-4, 18])[1])}`} fill="none" strokeLinecap="round" style={{ stroke: fade(INK.shadow, 30), strokeWidth: 2, opacity: dent }} />
        <path d={`M${f1(at([18, 26])[0])} ${f1(at([18, 26])[1])}Q${f1(at([34, 18])[0])} ${f1(at([34, 18])[1])} ${f1(at([40, 4])[0])} ${f1(at([40, 4])[1])}`} fill="none" strokeLinecap="round" style={{ stroke: fade(INK.shadow, 26), strokeWidth: 1.6, opacity: dent }} />
      </>}
    </g>
    {/* Eye → porthole: the trim ring presses in, the glass grows, the pupil goes. */}
    {eye.ring > 0.4 && <g filter={ids.clay}><circle cx={f1(ex)} cy={f1(ey)} r={f1(eye.ring * scale)} style={{ fill: `url(#${ids.uid}-trim)` }} /></g>}
    {eye.ring > 0.4 && <circle cx={f1(ex)} cy={f1(ey)} r={f1(eye.ring * 0.64 * scale)} style={{ fill: `url(#${ids.uid}-glass)` }} />}
    {eye.pupil > 0.3 && <>
      <circle cx={f1(ex)} cy={f1(ey)} r={f1(eye.pupil * scale)} style={{ fill: INK.ink }} />
      <circle cx={f1(ex - eye.pupil * 0.35 * scale)} cy={f1(ey - eye.pupil * 0.4 * scale)} r={f1(Math.max(0.6, eye.pupil * 0.3 * scale))} style={{ fill: INK.white }} />
    </>}
    {smile > 0.03 && <path d={`M${f1(smilePts[0][0])} ${f1(smilePts[0][1])}Q${f1(smilePts[1][0])} ${f1(smilePts[1][1])} ${f1(smilePts[2][0])} ${f1(smilePts[2][1])}`} fill="none" strokeLinecap="round" style={{ stroke: mix(INK.ink, 80, 'var(--ct-body)'), strokeWidth: 2.2, opacity: smile }} />}
    {smile > 0.03 && <circle cx={f1(smilePts[2][0] - 1)} cy={f1(smilePts[2][1] + 5)} r={f1(4 * scale)} style={{ fill: fade(INK.rose, 45), opacity: smile }} />}
    {spout.s > 0.03 && <g transform={`translate(${f1(sxp)} ${f1(syp)}) scale(${f1(spout.s)})`} filter={ids.clay}>
      {[[-9, -8, 5], [0, -15, 6.5], [9, -8, 5]].map(([x, y, r], i) => <circle key={i} cx={x} cy={f1(y + Math.sin(frame * 0.9 + i) * 1.4)} r={r} style={{ fill: mix(INK.sky, 70, INK.white) }} />)}
      <path d="M-3 0Q0 -10 3 0Z" style={{ fill: INK.skyPale }} />
    </g>}
  </g>;
}

/* ── film 1: Whale into Rocket ─────────────────────────────────────────── */

const NightBack = memo(function NightBack({ ids }: { ids: Ids }) {
  return <>
    <rect width="400" height="300" style={{ fill: ids.url('night') }} />
    {/* Pin-prick stars painted on the backcloth, and a cardboard moon. */}
    {Array.from({ length: 16 }, (_, i) => <circle key={i} cx={f1(30 + seeded(i, 1) * 340)} cy={f1(40 + seeded(i, 2) * 120)} r={f1(0.8 + seeded(i, 3) * 1.3)} style={{ fill: INK.butter, opacity: 0.35 + seeded(i, 4) * 0.4 }} />)}
    <g filter={ids.clay}>
      <circle cx="318" cy="78" r="21" style={{ fill: ids.url('moon') }} />
    </g>
    <circle cx="311" cy="72" r="4.5" style={{ fill: fade(INK.sand, 70) }} /><circle cx="324" cy="86" r="3" style={{ fill: fade(INK.sand, 60) }} /><circle cx="327" cy="70" r="2" style={{ fill: fade(INK.sand, 60) }} />
  </>;
});
function HangingStars({ swing, ids, frame }: { swing: number[]; ids: Ids; frame: number }) {
  return <g>{STARS.map((s, i) => {
    const y = 26 + s.len;
    return <g key={i} transform={`rotate(${f1(swing[i])} ${s.x} 0)`}>
      <line x1={s.x} y1="0" x2={s.x} y2={y - s.r * 0.8} style={{ stroke: fade(INK.steelLight, 70), strokeWidth: 0.9 }} />
      <g filter={ids.clay}><path d={smoothPath(boil(starPoints(s.x, y, s.r, 0.1 * i), frame, 300 + i))} style={{ fill: ids.url('gold') }} /></g>
    </g>;
  })}</g>;
}
const SEA_BANDS: readonly { y: number; c: string; amp: number }[] = [
  { y: 198, c: mix(INK.tealDeep, 80, INK.indigo), amp: 2.5 },
  { y: 214, c: INK.teal, amp: 3 },
  { y: 232, c: mix(INK.sea, 85, INK.teal), amp: 3.2 },
  { y: 250, c: mix(INK.water, 75, INK.sea), amp: 3 },
  { y: 266, c: mix(INK.tealDeep, 70, INK.water), amp: 2.6 },
];
function SeaBand({ i, t, ids }: { i: number; t: number; ids: Ids }) {
  const b = SEA_BANDS[i];
  return <g>
    <g filter={ids.clay}><path d={bandPath(b.y, t * (i % 2 ? -1 : 1), i * 1.3, b.amp)} style={{ fill: b.c }} /></g>
    <path d={ridgePath(b.y, t * (i % 2 ? -1 : 1), i * 1.3, b.amp)} fill="none" strokeLinecap="round" style={{ stroke: fade(INK.white, 30), strokeWidth: 1.6 }} />
  </g>;
}
function Puffs({ puffs, ids }: { puffs: { id: number; x: number; y: number; r: number; o: number }[]; ids: Ids }) {
  return <g>{puffs.map(p => <g key={p.id} style={{ opacity: f1(p.o) }} filter={ids.clay}>
    <circle cx={f1(p.x)} cy={f1(p.y)} r={f1(p.r)} style={{ fill: ids.url('smoke') }} />
    <circle cx={f1(p.x - p.r * 0.62)} cy={f1(p.y + p.r * 0.25)} r={f1(p.r * 0.62)} style={{ fill: ids.url('smoke') }} />
    <circle cx={f1(p.x + p.r * 0.58)} cy={f1(p.y + p.r * 0.3)} r={f1(p.r * 0.56)} style={{ fill: ids.url('smoke') }} />
  </g>)}</g>;
}
function RocketReel({ t, frame, ids }: { t: number; frame: number; ids: Ids; lite: boolean }) {
  const f = rocketFilm(t);
  const body: Body = { local: f.body, parts: f.parts, cx: f.cx, cy: f.cy, rot: f.rot, sx: f.sx, sy: f.sy, lift: f.tailLift, flame: f.flame };
  return <g>
    <NightBack ids={ids} />
    <HangingStars swing={f.stars} ids={ids} frame={frame} />
    <SeaBand i={0} t={t} ids={ids} />
    <ClayBody b={body} frame={frame} ids={ids} />
    <SeaBand i={1} t={t} ids={ids} />
    <ellipse cx={f1(f.cx)} cy="218" rx={f1(64 * f.shadow)} ry="5" style={{ fill: fade(INK.shadow, 30), opacity: f.shadow }} filter={ids.soft} />
    {[2, 3, 4].map(i => <SeaBand key={i} i={i} t={t} ids={ids} />)}
    <Puffs puffs={f.puffs} ids={ids} />
  </g>;
}

/* ── film 2: The Whale's Jump ──────────────────────────────────────────── */

/** Under the sea, no spout: the whale breathes out bubbles instead. */
const JUMP_PARTS: PartKey = { ...PART_KEYS.whale, spout: { ...PART_KEYS.whale.spout, s: 0 } };
const DayBack = memo(function DayBack({ ids }: { ids: Ids }) {
  return <>
    <rect x="-20" y="-440" width="440" height="442" style={{ fill: ids.url('day') }} />
    <g filter={ids.clay}>
      <circle cx="330" cy="-134" r="19" style={{ fill: ids.url('gold') }} />
      {[[220, -150, 1], [96, -110, 0.85], [356, -80, 0.8]].map(([x, y, s], i) => <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M-34 6C-40 -6 -26 -14 -16 -9C-12 -22 8 -24 14 -11C24 -16 38 -8 32 6Z" style={{ fill: ids.url('cloud') }} />
      </g>)}
    </g>
  </>;
});
const Seabed = memo(function Seabed({ ids }: { ids: Ids }) {
  return <>
    <rect x="-20" y="0" width="440" height="330" style={{ fill: ids.url('deep') }} />
    {[[60, 0, 100], [180, 0, 150], [300, 0, 120]].map(([x, , w], i) => <path key={i} d={`M${x - 14} 2L${x + 14} 2L${x + w * 0.5} 230L${x - w * 0.5} 230Z`} style={{ fill: ids.url('ray') }} />)}
    <g filter={ids.clay}>
      <path d={bandPath(204, 0, 0.6, 3, -20, 420, 330)} style={{ fill: ids.url('sand') }} />
      <path d={bandPath(218, 0, 2.2, 2.4, -20, 420, 330)} style={{ fill: mix(INK.sand, 70, INK.woodLight) }} />
      {[[48, 210, 9], [92, 214, 6], [262, 208, 8], [372, 212, 10]].map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.66} style={{ fill: mix(INK.steel, 70, INK.sand) }} />)}
    </g>
  </>;
});
function Seaweed({ t, ids }: { t: number; ids: Ids }) {
  return <g filter={ids.clay}>{[[30, 1], [76, 0.8], [236, 1.1], [352, 0.9], [388, 0.7]].map(([x, s], i) => {
    const sway = 6 * Math.sin(t * 1.4 + i * 1.9);
    return <path key={i} d={smoothPath(leafPoints({ ax: x, ay: 214, tx: x + sway, ty: 214 - 62 * s, w: 7 * s }))} style={{ fill: i % 2 ? INK.leafDeep : INK.moss }} />;
  })}</g>;
}
function Surface({ t, ids }: { t: number; ids: Ids }) {
  const top: string[] = [], bottom: string[] = [];
  for (let x = -20; x <= 420; x += 8) { const y = surfaceAt(x, t); top.push(`${x} ${f1(y - 3)}`); bottom.unshift(`${x} ${f1(y + 8)}`); }
  return <g>
    <g filter={ids.clay}><path d={`M${top.join('L')}L${bottom.join('L')}Z`} style={{ fill: mix(INK.sea, 70, INK.skyPale) }} /></g>
    <path d={`M${top.join('L')}`} fill="none" style={{ stroke: fade(INK.white, 55), strokeWidth: 1.6 }} />
  </g>;
}
function TailWave({ t, ids, frame }: { t: number; ids: Ids; frame: number }) {
  const w = tailWave(t);
  if (w.rise <= 0.01) return null;
  const x = TAIL_X, base = 10, top = base - 52 * w.rise;
  const stalk: Pt[] = [[x - 9, base], [x - 7, top + 8], [x - 3, top], [x + 3, top], [x + 7, top + 8], [x + 10, base]];
  return <g transform={`rotate(${f1(w.rot)} ${x} ${base})`} filter={ids.clay}>
    <path d={smoothPath(boil(leafPoints({ ax: x, ay: top + 2, tx: x - 34, ty: top - 16, w: 10 }), frame, 400))} style={{ fill: ids.url('body') }} />
    <path d={smoothPath(boil(leafPoints({ ax: x, ay: top + 2, tx: x + 34, ty: top - 16, w: 10 }), frame, 401))} style={{ fill: mix('var(--ct-body)', 85, INK.shadow) }} />
    <path d={smoothPath(boil(stalk, frame, 402))} style={{ fill: ids.url('body') }} />
  </g>;
}
function JumpReel({ t, frame, ids }: { t: number; frame: number; ids: Ids; lite: boolean }) {
  const pose = whalePose(t), cam = cameraTop(t), crown = splashCrown(t);
  const body: Body = { local: whaleBody(pose), parts: JUMP_PARTS, cx: pose.x, cy: pose.y, rot: pose.rot, sx: JUMP_SCALE, sy: JUMP_SCALE, lift: pose.lift, bend: pose.bend };
  /** The splash crown: clay water fingers thrown up and out, then falling back. */
  const fingers = crown > 0.01 ? Array.from({ length: 9 }, (_, i) => {
    const u = (i - 4) / 4, h = (40 + 30 * seeded(i, 40)) * crown * (1 - 0.35 * Math.abs(u)), x = SPLASH_X + u * (16 + 18 * crown);
    return { ax: x, ay: 4, tx: x + u * (26 + 22 * crown), ty: 4 - h, w: 6 + 3 * (1 - Math.abs(u)) };
  }) : [];
  return <g transform={`translate(0 ${f1(-cam)})`}>
    <DayBack ids={ids} />
    <Seabed ids={ids} />
    <Seaweed t={t} ids={ids} />
    {bubbles(t).map(b => <g key={b.id}><circle cx={f1(b.x)} cy={f1(b.y)} r={f1(b.r)} style={{ fill: fade(INK.skyPale, 30), stroke: fade(INK.white, 70), strokeWidth: 1 }} /><circle cx={f1(b.x - b.r * 0.35)} cy={f1(b.y - b.r * 0.35)} r={f1(b.r * 0.28)} style={{ fill: fade(INK.white, 80) }} /></g>)}
    <ClayBody b={body} frame={frame} ids={ids} />
    <TailWave t={t} ids={ids} frame={frame} />
    {/* Under the surface everything takes on the sea's colour. */}
    <rect x="-20" y="4" width="440" height="330" style={{ fill: fade(INK.teal, 26) }} />
    <Surface t={t} ids={ids} />
    {foamRings(t).map(r => <ellipse key={r.id} cx={r.x} cy="1" rx={f1(r.rx)} ry={f1(r.ry)} fill="none" style={{ stroke: INK.snow, strokeWidth: f1(1 + 3 * r.o), opacity: f1(r.o) }} />)}
    {crown > 0.01 && <g filter={ids.clay}>
      {fingers.map((l, i) => <path key={i} d={smoothPath(boil(leafPoints(l), frame, 500 + i))} style={{ fill: i % 2 ? mix(INK.sea, 50, INK.white) : mix(INK.sky, 45, INK.white) }} />)}
      <ellipse cx={SPLASH_X} cy="3" rx={f1(30 + 26 * crown)} ry={f1(5 + 3 * crown)} style={{ fill: INK.snow }} />
    </g>}
    {droplets(t).map(d => <g key={d.id}><circle cx={f1(d.x)} cy={f1(d.y)} r={f1(d.r)} style={{ fill: mix(INK.sea, 82, INK.water) }} /><circle cx={f1(d.x - d.r * 0.3)} cy={f1(d.y - d.r * 0.35)} r={f1(d.r * 0.32)} style={{ fill: INK.white }} /></g>)}
  </g>;
}

/* ── film 3: Halfway Frog ──────────────────────────────────────────────── */

const PAD_Y = 208;
const PondBack = memo(function PondBack({ ids }: { ids: Ids }) {
  return <>
    <rect width="400" height="300" style={{ fill: ids.url('dusk') }} />
    <g filter={ids.clay}>
      <circle cx="92" cy="86" r="17" style={{ fill: ids.url('gold') }} />
      <path d="M-10 170C40 132 96 150 140 160C190 136 250 128 300 150C340 138 380 142 410 156L410 200L-10 200Z" style={{ fill: mix(INK.sage, 80, INK.moss) }} />
      <path d="M-10 184C60 166 120 178 190 176C260 168 330 170 410 180L410 204L-10 204Z" style={{ fill: mix(INK.moss, 75, INK.leafDeep) }} />
    </g>
    <rect y="190" width="400" height="110" style={{ fill: ids.url('pond') }} />
    {[200, 222, 240].map((y, i) => <path key={y} d={ridgePath(y, 0, i * 2, 1.4)} fill="none" style={{ stroke: fade(INK.white, 26), strokeWidth: 1.3 }} />)}
    {/* Reeds and cattails at the pond's edges. */}
    <g filter={ids.clay}>
      {[[30, 120, 0], [42, 136, 1], [372, 116, 1], [386, 134, 0]].map(([x, y, k], i) => <g key={i}>
        <path d={smoothPath(leafPoints({ ax: x, ay: 214, tx: x + (k ? 6 : -6), ty: y, w: 3.4 }))} style={{ fill: INK.leafDeep }} />
        <rect x={x + (k ? 3 : -7) } y={y + 4} width="7" height="22" rx="3.5" style={{ fill: INK.umber }} />
      </g>)}
    </g>
  </>;
});
/** One lily pad with its notch: an ellipse with a wedge cut out. */
function padPath(x: number, y: number, rx: number, ry: number, notch: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= 24; i++) { const a = notch + 0.32 + (i / 24) * (Math.PI * 2 - 0.64); pts.push(`${f1(x + rx * Math.cos(a))} ${f1(y + ry * Math.sin(a))}`); }
  return `M${x} ${y}L${pts.join('L')}Z`;
}
const PADS: readonly { x: number; y: number; rx: number; n: number }[] = Array.from({ length: 9 }, (_, i) => ({ x: 46 + i * 36 + (seeded(i, 5) - 0.5) * 6, y: PAD_Y + (seeded(i, 6) - 0.5) * 4, rx: 25 + seeded(i, 7) * 5, n: 0.5 + seeded(i, 8) * 2 }));
const Pads = memo(function Pads({ ids }: { ids: Ids }) {
  return <g>
    <g filter={ids.clay}>{PADS.map((p, i) => <path key={i} d={padPath(p.x, p.y, p.rx, p.rx * 0.3, p.n)} style={{ fill: i % 2 ? ids.url('pad') : mix(INK.leaf, 70, INK.spring) }} />)}</g>
    {PADS.map((p, i) => <g key={i} style={{ stroke: fade(INK.leafDeep, 40), strokeWidth: 0.8 }}>{[0.9, 2.2, 3.6, 5].map(a => <line key={a} x1={f1(p.x)} y1={f1(p.y)} x2={f1(p.x + p.rx * 0.8 * Math.cos(p.n + a))} y2={f1(p.y + p.rx * 0.24 * Math.sin(p.n + a))} />)}</g>)}
  </g>;
});
/** Where the lotus flower sits: high on its stem, so reaching it takes a long clay arm. */
const BLOOM_Y = 100;
function Lotus({ bob, ids }: { bob: number; ids: Ids }) {
  const bx = FROG_XF + 4, by = BLOOM_Y + bob;
  return <g>
    <path d={`M${FROG_XF} ${PAD_Y + 2}C${FROG_XF - 8} 170 ${FROG_XF + 10} 140 ${bx} ${f1(by + 10)}`} fill="none" strokeLinecap="round" style={{ stroke: mix(INK.leafDeep, 80, INK.leaf), strokeWidth: 5 }} />
    <path d={`M${FROG_XF - 1.4} ${PAD_Y}C${FROG_XF - 9} 170 ${FROG_XF + 8} 140 ${bx - 1.4} ${f1(by + 12)}`} fill="none" strokeLinecap="round" style={{ stroke: fade(INK.spring, 60), strokeWidth: 1.4 }} />
    <g filter={ids.clay}>
      <path d={padPath(FROG_XF + 10, PAD_Y + 3, 24, 7, 2.6)} style={{ fill: mix(INK.leaf, 70, INK.spring) }} />
      {[-170, -10].map(a => { const r = (a * Math.PI) / 180; return <path key={a} d={smoothPath(leafPoints({ ax: bx, ay: by + 9, tx: bx + 22 * Math.cos(r), ty: by + 9 + 22 * Math.sin(r) + 5, w: 6.5 }))} style={{ fill: mix(INK.roseDeep, 45, INK.blossom) }} />; })}
      {[-150, -120, -90, -60, -30].map((a, i) => { const r = (a * Math.PI) / 180, len = i === 2 ? 27 : 23; return <path key={a} d={smoothPath(leafPoints({ ax: bx, ay: by + 7, tx: bx + len * Math.cos(r), ty: by + 7 + len * Math.sin(r), w: 8.5 }))} style={{ fill: i % 2 ? ids.url('petal') : mix(INK.rose, 70, INK.blossom) }} />; })}
      <circle cx={bx} cy={f1(by + 5)} r="6" style={{ fill: ids.url('gold') }} />
    </g>
  </g>;
}
/** The frog, side on, facing the flower. Local units: feet at 0, nose at +31. */
const FROG_S = 1.25;
const FROG_BODY: readonly Pt[] = [[-26, -2], [-31, -14], [-23, -28], [-6, -35], [12, -33], [25, -25], [31, -14], [27, -4], [10, 0], [-12, 0]];
function Frog({ f, frame, ids }: { f: ReturnType<typeof frogFilm>; frame: number; ids: Ids }) {
  const ox = f.nose - 31 * FROG_S, oy = PAD_Y + 1 - f.lift, kx = f.sx * FROG_S, ky = f.sy * FROG_S;
  const put = (pts: readonly Pt[], s: number) => boil(place(pts, ox, oy, 0, kx, ky), frame, s);
  const at = (p: Pt) => placePoint(p, ox, oy, 0, kx, ky);
  const clip = `${ids.uid}-frog`;
  const outline = smoothPath(put(FROG_BODY, 600));
  const shoulder = at([17, -12]);
  const reach: Pt = [FROG_XF - 4, BLOOM_Y + 16 + f.bob];
  const hand: Pt = [shoulder[0] + (reach[0] - shoulder[0]) * f.arm, shoulder[1] + (reach[1] - shoulder[1]) * f.arm];
  const bendY = Math.min(shoulder[1], hand[1]) + 6 * f.arm, bendX = (shoulder[0] + hand[0]) / 2 - 16 * f.arm;
  const happy = f.touched;
  const eyes: [Pt, number][] = [[[3, -34], 8 * FROG_S], [[16, -33], 7.4 * FROG_S]];
  const arm = `M${f1(shoulder[0])} ${f1(shoulder[1])}Q${f1(bendX)} ${f1(bendY)} ${f1(hand[0])} ${f1(hand[1])}`;
  return <g className="ct-frog">
    <ellipse cx={f1(f.nose - 30)} cy={PAD_Y + 2} rx={f1(32 - Math.min(16, f.lift * 0.3))} ry="4.5" style={{ fill: fade(INK.shadow, 34), opacity: f1(1 - Math.min(0.6, f.lift / 90)) }} filter={ids.soft} />
    <g filter={ids.clay}>
      <path d={smoothPath(put(leafPoints({ ax: -16, ay: -5, tx: -37, ty: -1, w: 7 }), 601))} style={{ fill: mix(INK.leaf, 78, INK.shadow) }} />
      <path d={outline} style={{ fill: ids.url('frog') }} />
      <clipPath id={clip}><path d={outline} /></clipPath>
      <ellipse cx={f1(at([12, -8])[0])} cy={f1(at([12, -8])[1])} rx={f1(16 * kx)} ry={f1(8 * ky)} clipPath={`url(#${clip})`} style={{ fill: ids.url('belly') }} />
      <circle cx={f1(at([-16, -12])[0])} cy={f1(at([-16, -12])[1])} r={f1(11 * kx)} style={{ fill: ids.url('frog') }} />
      {eyes.map(([p, r], i) => { const [x, y] = at(p); return <circle key={i} cx={f1(x)} cy={f1(y)} r={f1(r)} style={{ fill: ids.url('frog') }} />; })}
      <path d={smoothPath(put(leafPoints({ ax: 18, ay: -4, tx: 28, ty: 0, w: 3.6 }), 602))} style={{ fill: mix(INK.leaf, 85, INK.shadow) }} />
    </g>
    <Print x={at([-14, -20])[0]} y={at([-14, -20])[1]} r={7} rot={-20} o={0.22} />
    <Print x={at([4, -18])[0]} y={at([4, -18])[1]} r={5} rot={30} o={0.14} tone={INK.shadow} />
    {eyes.map(([p, r], i) => { const [x, y] = at(p); return happy
      ? <path key={i} d={`M${f1(x - r * 0.55)} ${f1(y)}Q${f1(x)} ${f1(y - r * 0.6)} ${f1(x + r * 0.55)} ${f1(y)}`} fill="none" strokeLinecap="round" style={{ stroke: INK.ink, strokeWidth: 2 }} />
      : <g key={i}><circle cx={f1(x)} cy={f1(y)} r={f1(r * 0.66)} style={{ fill: INK.white }} /><circle cx={f1(x + 1.4 + f.look)} cy={f1(y - 2.6 * f.look)} r={f1(r * 0.34)} style={{ fill: INK.ink }} /><circle cx={f1(x + 0.6 + f.look)} cy={f1(y - 1.2 - 2.6 * f.look)} r="0.9" style={{ fill: INK.white }} /></g>; })}
    <path d={`M${f1(at([19, -17])[0])} ${f1(at([19, -17])[1])}Q${f1(at([26, -12])[0])} ${f1(at([26, -12])[1])} ${f1(at([31, -18])[0])} ${f1(at([31, -18])[1])}`} fill="none" strokeLinecap="round" style={{ stroke: INK.leafDeep, strokeWidth: 2 }} />
    <circle cx={f1(at([21, -21])[0])} cy={f1(at([21, -21])[1])} r="3.6" style={{ fill: fade(INK.rose, 50) }} />
    {f.arm > 0.01 && <g>
      <g filter={ids.clay}><path d={arm} fill="none" strokeLinecap="round" style={{ stroke: mix(INK.spring, 55, INK.leaf), strokeWidth: 6.5 }} /></g>
      <path d={arm} fill="none" strokeLinecap="round" transform="translate(-0.8 -1.4)" style={{ stroke: fade(INK.white, 40), strokeWidth: 1.6 }} />
      <g filter={ids.clay}>{[-40, 0, 40].map(a => { const r = ((a - 70) * Math.PI) / 180; return <circle key={a} cx={f1(hand[0] + 4.2 * Math.cos(r))} cy={f1(hand[1] + 4.2 * Math.sin(r))} r="2.6" style={{ fill: ids.url('frog') }} />; })}
        <circle cx={f1(hand[0])} cy={f1(hand[1])} r="4.4" style={{ fill: ids.url('frog') }} /></g>
    </g>}
  </g>;
}
const RIBBON_Y = 252, RIBBON_H = 13;
const SEG_TONES: readonly string[] = [INK.sun, INK.orange, INK.rose, INK.lilac, INK.sky, INK.spring, INK.amber];
const SEG_LABELS: readonly string[] = ['½', '¼', '⅛'];
/** The measuring ribbon under the pond: each hop's stretch in its exact proportion. */
function Ribbon({ progress, ids }: { progress: number; ids: Ids }) {
  return <g className="ct-ribbon">
    <rect x={FROG_X0 - 4} y={RIBBON_Y - 3} width={FROG_D + 8} height={RIBBON_H + 6} rx="3" style={{ fill: INK.paper }} filter={ids.clay} />
    <rect x={FROG_X0} y={RIBBON_Y} width={FROG_D} height={RIBBON_H} style={{ fill: ids.url('hatch') }} />
    {ribbonSegments().map((s, i) => {
      const from = FROG_X0 + FROG_D * s.from, full = FROG_D * s.length;
      const filled = Math.max(0, Math.min(full, FROG_D * progress - FROG_D * s.from));
      return <g key={s.hop}>
        {filled > 0.05 && <rect x={f1(from)} y={RIBBON_Y} width={Math.round(filled * 1000) / 1000} height={RIBBON_H} style={{ fill: SEG_TONES[i] }} data-seg={s.hop} />}
        <line x1={f1(from)} x2={f1(from)} y1={RIBBON_Y - 2} y2={RIBBON_Y + RIBBON_H + 2} style={{ stroke: INK.ink, strokeWidth: 0.7, opacity: 0.5 }} />
        {i < SEG_LABELS.length && filled > full * 0.5 && <text x={f1(from + full / 2)} y={RIBBON_Y + RIBBON_H - 3} textAnchor="middle" className="ct-frac" style={{ fill: INK.ink }}>{SEG_LABELS[i]}</text>}
      </g>;
    })}
    <path d={`M${FROG_X0} ${RIBBON_Y - 6}l-4 -7h8z`} style={{ fill: INK.leafDeep }} />
    <path d={`M${FROG_XF} ${RIBBON_Y - 6}l-4 -7h8z`} style={{ fill: INK.roseDeep }} />
  </g>;
}
/** A magnifying glass over what is left, once it is too small to see. */
function Loupe({ f, ids }: { f: ReturnType<typeof frogFilm>; ids: Ids }) {
  if (f.loupe <= 0.01) return null;
  const cx = 236, cy = 96, r = 28, zoom = 4, g = Math.min(26, f.gap * zoom);
  return <g style={{ opacity: f1(f.loupe) }} className="ct-loupe">
    <line x1={f1(FROG_XF - f.gap / 2)} y1={PAD_Y - 16} x2={cx + r * 0.4} y2={cy + r * 0.9} strokeDasharray="2 3" style={{ stroke: fade(INK.ink, 45), strokeWidth: 1 }} />
    <circle cx={cx} cy={cy} r={r} style={{ fill: INK.skyPale }} />
    <clipPath id={`${ids.uid}-loupe`}><circle cx={cx} cy={cy} r={r - 2} /></clipPath>
    <g clipPath={`url(#${ids.uid}-loupe)`}>
      <rect x={cx - r} y={cy + 8} width={2 * r} height={r} style={{ fill: mix(INK.celadon, 70, INK.sea) }} />
      <circle cx={f1(cx - g / 2 - 26)} cy={cy} r="26" style={{ fill: mix(INK.leaf, 70, INK.spring) }} />
      <circle cx={f1(cx - g / 2 - 8)} cy={cy - 9} r="2.6" style={{ fill: INK.leafDeep }} />
      <rect x={f1(cx + g / 2)} y={cy - r} width="9" height={2 * r} rx="3" style={{ fill: mix(INK.leafDeep, 80, INK.leaf) }} />
    </g>
    <circle cx={cx} cy={cy} r={r} fill="none" style={{ stroke: INK.brass, strokeWidth: 4 }} />
    <path d={`M${cx - r * 0.55} ${cy - r * 0.35}A${r * 0.7} ${r * 0.7} 0 0 1 ${cx - r * 0.1} ${cy - r * 0.68}`} fill="none" strokeLinecap="round" style={{ stroke: fade(INK.white, 80), strokeWidth: 2.4 }} />
  </g>;
}
function FrogReel({ t, frame, ids }: { t: number; frame: number; ids: Ids; lite: boolean }) {
  const f = frogFilm(t);
  return <g>
    <PondBack ids={ids} />
    <Pads ids={ids} />
    <Lotus bob={f.bob} ids={ids} />
    <Frog f={f} frame={frame} ids={ids} />
    <Loupe f={f} ids={ids} />
    <Ribbon progress={f.progress} ids={ids} />
  </g>;
}

/* ── the cardboard proscenium ─────────────────────────────────────────── */

const Proscenium = memo(function Proscenium({ uid }: { uid: string }) {
  const id = (name: string) => `${uid}-${name}`, url = (name: string) => `url(#${id(name)})`;
  const scallops = Array.from({ length: 10 }, (_, i) => { const x = 20 + i * 36; return `Q${x + 18} 52 ${x + 36} 40`; }).join('');
  const tape = (x: number, y: number, rot: number): ReactNode => <path key={`${x}${y}`} d="M-19 -5l2 1.5l-2 1.5l2 1.5l-2 1.5h38l-2 -1.5l2 -1.5l-2 -1.5l2 -1.5z" transform={`translate(${x} ${y}) rotate(${rot})`} style={{ fill: fade(INK.butter, 82) }} />;
  return <g className="ct-frame" aria-hidden="true">
    <defs>
      <linearGradient id={id('card')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={{ stopColor: mix(INK.woodLight, 80, INK.sand) }} /><stop offset="1" style={{ stopColor: mix(INK.wood, 80, INK.woodLight) }} /></linearGradient>
      <linearGradient id={id('felt')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: mix(INK.red, 80, INK.roseDeep) }} /><stop offset="1" style={{ stopColor: mix(INK.roseDeep, 75, INK.plum) }} /></linearGradient>
      <filter id={id('lip')} x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="2.6" /></filter>
    </defs>
    {/* The window's inner shadow, so the scene sits inside the box. */}
    <rect x="20" y="30" width="360" height="244" rx="6" fill="none" style={{ stroke: fade(INK.shadow, 45), strokeWidth: 9 }} filter={`url(#${id('lip')})`} />
    <path fillRule="evenodd" d="M0 0H400V300H0ZM26 30H374Q380 30 380 36V268Q380 274 374 274H26Q20 274 20 268V36Q20 30 26 30Z" style={{ fill: url('card') }} />
    <rect x="21" y="31" width="358" height="242" rx="5" fill="none" strokeDasharray="1.4 2.6" style={{ stroke: mix(INK.woodDark, 70, INK.wood), strokeWidth: 2.4, opacity: 0.55 }} />
    {/* Gathered side drapes. */}
    <path d="M20 40C34 90 22 160 36 274H20Z" style={{ fill: url('felt') }} />
    <path d="M380 40C366 90 378 160 364 274H380Z" style={{ fill: url('felt') }} />
    <path d="M24 60C30 110 26 180 30 270" fill="none" style={{ stroke: fade(INK.plum, 50), strokeWidth: 1.4 }} />
    <path d="M376 60C370 110 374 180 370 270" fill="none" style={{ stroke: fade(INK.plum, 50), strokeWidth: 1.4 }} />
    {/* The felt valance with its scallops and gold braid. */}
    <path d={`M20 40${scallops}L384 40V16H16V40Z`} style={{ fill: url('felt') }} />
    <path d={`M20 40${scallops}`} fill="none" strokeLinecap="round" style={{ stroke: INK.goldLight, strokeWidth: 2.2 }} />
    {Array.from({ length: 10 }, (_, i) => <circle key={i} cx={38 + i * 36} cy="47.5" r="2.4" style={{ fill: INK.gold }} />)}
    <rect x="14" y="10" width="372" height="10" rx="4" style={{ fill: mix(INK.wood, 70, INK.woodDark) }} />
    {/* The stage lip, footlights and tape. */}
    <rect x="10" y="274" width="380" height="20" rx="4" style={{ fill: mix(INK.wood, 85, INK.woodDark) }} />
    <rect x="10" y="274" width="380" height="4" style={{ fill: fade(INK.shadow, 30) }} />
    {[70, 135, 200, 265, 330].map(x => <g key={x}><ellipse cx={x} cy="278" rx="11" ry="5" style={{ fill: fade(INK.goldLight, 40) }} /><path d={`M${x - 7} 280A7 5 0 0 1 ${x + 7} 280Z`} style={{ fill: INK.goldLight }} /></g>)}
    {[tape(26, 26, -32), tape(374, 26, 32), tape(24, 276, 28), tape(376, 276, -28)]}
  </g>;
});
