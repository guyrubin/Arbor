import { memo, useId, type CSSProperties, type ReactNode } from 'react';
import {
  BODY_KEYFRAMES, beatBody, bendLeaf, boil, leafPoints, lerp, place, placePoint, seeded, smoothPath, span, type Leaf, type Oval, type PartKey, type Pt, PART_KEYS,
} from './clayShapes';
import {
  AYA_GROUND, FIRST_SHOW, FRESH_HANDS, FROG_D, FROG_X0, FROG_XF, JUMP_SCALE, PLANTER_X, REACH_TOUCH, SOIL_Y, SPLASH_X, ayaFilm, bubbles, cameraTop, droplets, foamRings,
  frogFilm, rocketFilm, rocketKey, ribbonSegments, splashCrown, starsOf, surfaceAt, TAIL_X, tailWave, timeOf, whaleBody, whalePose,
  type AyaFrame, type ClayPrint, type Hands, type ReelId, type ShowLook,
} from './clayTheatreRules';
import {
  BLOOM_Y, CALL_SECONDS, CAST_SCALE, GARDEN_SUN, JUMP_SUN, MOON, PADS, PAD_Y, POND_SUN, arcOf, cloudsOf, cometAt, curtainCall, fishHop, heroPlace, heroPress, moonSpin, popIn, starFlick, wobble,
  type LiveTouch,
} from './clayHands';
import { CLAYS, INK, chalky, fade, mix, type ClayId } from './clayInk';

/** One frame of a clay film, drawn from nothing but the reel, the frame
 * number, the clay, the child's lasting choices (`hands`), tonight's
 * dressing (`show`) and the live touches with their ages: no state, no
 * history. `lite` drops the felt curtain and the clay filter for the tiny
 * frames on the film strip. */
export interface SceneProps { reel: ReelId; frame: number; body: ClayId; trim: ClayId; hands?: Hands; show?: ShowLook; touches?: readonly LiveTouch[]; lite?: boolean; label?: string;
  /** 0 = the curtain gathered open, 1 = drawn right across the film (the start of the curtain call). */
  drapes?: number }
const NO_TOUCH: readonly LiveTouch[] = [];
export function ClayScene({ reel, frame, body, trim, hands = FRESH_HANDS, show = FIRST_SHOW, touches = NO_TOUCH, lite = false, label, drapes = 0 }: SceneProps) {
  const uid = `ct${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const t = timeOf(frame);
  const style = { '--ct-body': chalky(CLAYS[body]), '--ct-trim': chalky(CLAYS[trim]) } as CSSProperties;
  const ids = sceneIds(uid, lite);
  const reelProps: ReelProps = { t, frame, ids, hands, show, touches: lite ? NO_TOUCH : touches };
  return <svg viewBox="0 0 400 300" className="ct-scene" data-reel={reel} data-frame={frame} style={style} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false" preserveAspectRatio="xMidYMid slice">
    <SceneDefs uid={uid} lite={lite} />
    {reel === 'rocket' ? <RocketReel {...reelProps} /> : reel === 'jump' ? <JumpReel {...reelProps} /> : reel === 'ayaSeed' ? <AyaReel {...reelProps} /> : <FrogReel {...reelProps} />}
    {!lite && <FeltCurtain ids={ids} drapes={drapes} ripple={touches.reduce((sum, l) => l.toy === 'feltDrape' ? sum + wobble(l.since) : sum, 0)} />}
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
    <ClayGrad id={id('aya')} c={AYA_BLUE} light={40} dark={66} />
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
    </>}
  </defs>;
});

/** Aya's cobalt, in clay. */
const AYA_BLUE = mix(mix(INK.bluebell, 58, INK.water), 80, INK.indigo);
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

/* ── hands in the clay ────────────────────────────────────────────────── */

type Press = ReturnType<typeof heroPress>;
/** The clay gives under a hand: lower and wider about the place it stands,
 * then (as the press springs back) a little taller and thinner. */
function Squashed({ q, cx, base, children }: { q: number; cx: number; base: number; children: ReactNode }) {
  if (Math.abs(q) < 0.004) return <>{children}</>;
  return <g transform={`translate(${f1(cx)} ${f1(base)}) scale(${(1 + 0.7 * q).toFixed(3)} ${(1 - q).toFixed(3)}) translate(${f1(-cx)} ${f1(-base)})`}>{children}</g>;
}
/** The dents a thumb is making now: a soft hollow, a lit lower rim, the print. */
function Dents({ dents, ids, tone }: { dents: Press['dents']; ids: Ids; tone: string }) {
  return <>{dents.map((d, i) => <g key={i} transform={`translate(${f1(d.x)} ${f1(d.y)})`} style={{ opacity: f1(d.depth) }}>
    <ellipse cx="-1.5" cy="-1.5" rx="13" ry="9.5" style={{ fill: fade(INK.shadow, 40) }} filter={ids.soft} />
    <ellipse cx="2.2" cy="2.4" rx="10" ry="6.5" style={{ fill: mix(tone, 62, INK.white) }} filter={ids.soft} />
    <Print x={0} y={1} r={8} rot={14} o={0.55} tone={INK.shadow} />
  </g>)}</>;
}
/** A star that pops where the night sky is tapped, or a puff of cloud by day. */
function AirPops({ touches, night, dy = 0 }: { touches: readonly LiveTouch[]; night: boolean; dy?: number }) {
  return <>{touches.filter(l => l.toy === 'openAir').map(l => {
    const k = popIn(l.since), o = l.since > 5 ? Math.max(0, 1 - (l.since - 5) / 4) : 1, y = l.y + dy;
    return <g key={l.key} style={{ opacity: f1(o) }}>
      {night
        ? <><path d={smoothPath(starPoints(l.x, y, 7.5 * k, 0.3))} style={{ fill: INK.butter }} />
          {[0, 1, 2, 3].map(i => { const a = i * 1.57 + 0.6, r = 9 + 1.6 * Math.max(0, l.since); return <circle key={i} cx={f1(l.x + r * Math.cos(a))} cy={f1(y + r * Math.sin(a))} r="1.3" style={{ fill: INK.white }} />; })}</>
        : [[-6, 1, 5], [0, -3, 6.5], [6.5, 1, 5]].map(([x, yy, r], i) => <circle key={i} cx={f1(l.x + x * k)} cy={f1(y + yy * k - 0.5 * Math.max(0, l.since))} r={f1(r * k)} style={{ fill: INK.white }} />)}
    </g>;
  })}</>;
}
/** Bubbles that rise from where the water is touched (world y = stage y + dy). */
function HandBubbles({ touches, dy = 0, top = -1e6 }: { touches: readonly LiveTouch[]; dy?: number; top?: number }) {
  return <>{touches.filter(l => l.toy === 'deepWater').flatMap(l => [0, 1, 2].map(i => {
    const s = Math.max(0, l.since), y = l.y + dy - (5 + 2 * i) * s - i * 5, r = (2.4 + i * 0.9) * Math.min(1, 0.5 + s / 3);
    if (y <= top + 4) return null;
    return <circle key={`${l.key}-${i}`} cx={f1(l.x + 4 * Math.sin(s * 0.9 + i * 2))} cy={f1(y)} r={f1(r)} style={{ fill: fade(INK.skyPale, 34), stroke: fade(INK.white, 80), strokeWidth: 1, opacity: f1(1 - s / 11) }} />;
  }))}</>;
}
/** A clay sun; tapped, its rays push out and draw back in. */
function Sun({ x, y, r, touches, ids, frame, dy = 0 }: { x: number; y: number; r: number; touches: readonly LiveTouch[]; ids: Ids; frame: number; dy?: number }) {
  const burst = Math.min(1, touches.reduce((sum, l) => l.toy === 'daySun' ? sum + arcOf(l.since, 12) : sum, 0)), cy = y + dy;
  return <g filter={ids.clay}>
    {burst > 0.02 && Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4 + 0.2; return <path key={i} d={smoothPath(boil(leafPoints({ ax: x + r * 0.9 * Math.cos(a), ay: cy + r * 0.9 * Math.sin(a), tx: x + (r + 6 + 12 * burst) * Math.cos(a), ty: cy + (r + 6 + 12 * burst) * Math.sin(a), w: 3.6 }), frame, 700 + i))} style={{ fill: INK.sun }} />; })}
    <circle cx={x} cy={f1(cy)} r={f1(r * (1 + 0.1 * burst))} style={{ fill: ids.url('gold') }} />
  </g>;
}

/* ── the clay whale / lump / rocket ───────────────────────────────────── */

interface Body { local: Pt[]; parts: PartKey; cx: number; cy: number; rot: number; sx: number; sy: number; lift: number; flame?: number; bend?: number }
const NO_PRINTS: readonly ClayPrint[] = [];
/** The clay body and its parts, placed and boiled for this frame, with the
 * child's thumbprints in it and the dents a hand is pressing now. */
function ClayBody({ b, frame, ids, salt = 1, prints = NO_PRINTS, press }: { b: Body; frame: number; ids: Ids; salt?: number; prints?: readonly ClayPrint[]; press?: Press }) {
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
  const squeezed = !!press?.squeeze && eye.ring < 6;
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
    {/* Fingerprints, the child's own thumbprints, and on the lump the big thumb dent and its folds. */}
    <g clipPath={`url(#${clip})`}>
      <Print x={at([-34, -18])[0]} y={at([-34, -18])[1]} r={7 * scale} rot={b.rot + 20} o={0.2} />
      <Print x={at([10, 20])[0]} y={at([10, 20])[1]} r={6 * scale} rot={b.rot - 30} o={0.14} tone={INK.shadow} />
      {prints.map((p, i) => { const [px, py] = at([p.x, p.y]); return <g key={i}>
        <ellipse cx={f1(px - 1)} cy={f1(py - 1)} rx={f1(10 * scale)} ry={f1(7.5 * scale)} transform={`rotate(${f1(b.rot + p.rot)} ${f1(px)} ${f1(py)})`} style={{ fill: fade(INK.shadow, 16) }} />
        <Print x={px} y={py} r={8.5 * scale} rot={b.rot + p.rot} o={0.4} tone={INK.shadow} />
        <Print x={px + 1} y={py + 1.2} r={8.5 * scale} rot={b.rot + p.rot} o={0.22} />
      </g>; })}
      {dent > 0.02 && <>
        <g transform={`translate(${f1(dx)} ${f1(dy + 4 * scale)}) rotate(${f1(b.rot + 12)}) scale(${f1(scale)})`} style={{ opacity: dent }}>
          <ellipse cx="-1.5" cy="-1.5" rx="17" ry="11" style={{ fill: fade(INK.shadow, 34) }} filter={ids.soft} />
          <ellipse cx="2" cy="2" rx="13.5" ry="8" style={{ fill: mix('var(--ct-body)', 70, INK.white) }} filter={ids.soft} />
        </g>
        <Print x={dx + 1} y={dy + 5 * scale} r={10 * scale} rot={b.rot + 12} o={0.5 * dent} tone={INK.shadow} />
        <path d={`M${f1(at([-44, 6])[0])} ${f1(at([-44, 6])[1])}Q${f1(at([-26, 22])[0])} ${f1(at([-26, 22])[1])} ${f1(at([-4, 18])[0])} ${f1(at([-4, 18])[1])}`} fill="none" strokeLinecap="round" style={{ stroke: fade(INK.shadow, 30), strokeWidth: 2, opacity: dent }} />
        <path d={`M${f1(at([18, 26])[0])} ${f1(at([18, 26])[1])}Q${f1(at([34, 18])[0])} ${f1(at([34, 18])[1])} ${f1(at([40, 4])[0])} ${f1(at([40, 4])[1])}`} fill="none" strokeLinecap="round" style={{ stroke: fade(INK.shadow, 26), strokeWidth: 1.6, opacity: dent }} />
      </>}
      {press && <Dents dents={press.dents} ids={ids} tone="var(--ct-body)" />}
    </g>
    {/* Eye → porthole: the trim ring presses in, the glass grows, the pupil goes. */}
    {eye.ring > 0.4 && <g filter={ids.clay}><circle cx={f1(ex)} cy={f1(ey)} r={f1(eye.ring * scale)} style={{ fill: `url(#${ids.uid}-trim)` }} /></g>}
    {eye.ring > 0.4 && <circle cx={f1(ex)} cy={f1(ey)} r={f1(eye.ring * 0.64 * scale)} style={{ fill: `url(#${ids.uid}-glass)` }} />}
    {eye.ring > 6 && <path d={`M${f1(ex - eye.ring * 0.4 * scale)} ${f1(ey - eye.ring * 0.1 * scale)}A${f1(eye.ring * 0.42 * scale)} ${f1(eye.ring * 0.42 * scale)} 0 0 1 ${f1(ex - eye.ring * 0.05 * scale)} ${f1(ey - eye.ring * 0.42 * scale)}`} fill="none" strokeLinecap="round" style={{ stroke: fade(INK.white, 85), strokeWidth: 1.6 }} />}
    {eye.pupil > 0.3 && (squeezed
      ? <path d={`M${f1(ex - 4.6 * scale)} ${f1(ey + 0.5)}Q${f1(ex)} ${f1(ey - 4 * scale)} ${f1(ex + 4.6 * scale)} ${f1(ey + 0.5)}`} fill="none" strokeLinecap="round" style={{ stroke: INK.ink, strokeWidth: 2.2 }} />
      : <>
        <circle cx={f1(ex)} cy={f1(ey)} r={f1(eye.pupil * scale)} style={{ fill: INK.ink }} />
        <circle cx={f1(ex - eye.pupil * 0.35 * scale)} cy={f1(ey - eye.pupil * 0.4 * scale)} r={f1(Math.max(0.6, eye.pupil * 0.3 * scale))} style={{ fill: INK.white }} />
      </>)}
    {smile > 0.03 && <path d={`M${f1(smilePts[0][0])} ${f1(smilePts[0][1])}Q${f1(smilePts[1][0])} ${f1(smilePts[1][1])} ${f1(smilePts[2][0])} ${f1(smilePts[2][1])}`} fill="none" strokeLinecap="round" style={{ stroke: mix(INK.ink, 80, 'var(--ct-body)'), strokeWidth: 2.2, opacity: smile }} />}
    {smile > 0.03 && <circle cx={f1(smilePts[2][0] - 1)} cy={f1(smilePts[2][1] + 5)} r={f1(4 * scale)} style={{ fill: fade(INK.rose, 45), opacity: smile }} />}
    {spout.s > 0.03 && <g transform={`translate(${f1(sxp)} ${f1(syp)}) scale(${f1(spout.s * (squeezed ? 1.3 : 1))})`} filter={ids.clay}>
      {[[-9, -8, 5], [0, -15, 6.5], [9, -8, 5]].map(([x, y, r], i) => <circle key={i} cx={x} cy={f1(y + Math.sin(frame * 0.9 + i) * 1.4)} r={r} style={{ fill: mix(INK.sky, 70, INK.white) }} />)}
      <path d="M-3 0Q0 -10 3 0Z" style={{ fill: INK.skyPale }} />
    </g>}
  </g>;
}

/* ── film 1: Whale into Rocket ─────────────────────────────────────────── */

const NightBack = memo(function NightBack({ ids }: { ids: Ids }) {
  return <>
    <rect width="400" height="300" style={{ fill: ids.url('night') }} />
    {/* Pin-prick stars painted on the backcloth. */}
    {Array.from({ length: 18 }, (_, i) => <circle key={i} cx={f1(24 + seeded(i, 1) * 352)} cy={f1(30 + seeded(i, 2) * 130)} r={f1(0.8 + seeded(i, 3) * 1.3)} style={{ fill: INK.butter, opacity: 0.35 + seeded(i, 4) * 0.4 }} />)}
  </>;
});
/** The clay moon on its pin: full, a crescent or ringed, one for each show. Tapped, it spins once. */
function Moon({ kind, spin, ids }: { kind: number; spin: number; ids: Ids }) {
  const { x, y, r } = MOON;
  return <g transform={`rotate(${f1(spin)} ${x} ${y})`}>
    {kind === 2 && <ellipse cx={x} cy={y} rx={r * 1.7} ry={r * 0.42} transform={`rotate(-18 ${x} ${y})`} fill="none" style={{ stroke: fade(INK.butter, 70), strokeWidth: 3.4 }} />}
    <g filter={ids.clay}><circle cx={x} cy={y} r={r} style={{ fill: ids.url('moon') }} /></g>
    <circle cx={x - 7} cy={y - 6} r="4.5" style={{ fill: fade(INK.sand, 70) }} /><circle cx={x + 6} cy={y + 8} r="3" style={{ fill: fade(INK.sand, 60) }} /><circle cx={x + 9} cy={y - 8} r="2" style={{ fill: fade(INK.sand, 60) }} />
    {kind === 1 && <circle cx={x + 10} cy={y - 5} r={r * 0.92} style={{ fill: mix(INK.indigo, 62, INK.night) }} />}
    {kind === 2 && <path d={`M${x - r * 1.62} ${f1(y + r * 0.56)}A${r * 1.7} ${f1(r * 0.42)} -18 0 0 ${x + r * 1.62} ${f1(y - r * 0.5)}`} fill="none" style={{ stroke: INK.butter, strokeWidth: 3.4 }} />}
  </g>;
}
function HangingStars({ set, swing, ids, frame }: { set: number; swing: number[]; ids: Ids; frame: number }) {
  return <g>{starsOf(set).map((s, i) => {
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
/** A little clay fish hops out of the sea where a finger touched it. */
function Fish({ touches, ids, frame }: { touches: readonly LiveTouch[]; ids: Ids; frame: number }) {
  return <>{touches.filter(l => l.toy === 'seaSkin').map(l => {
    const h = fishHop(l.since, l.x, l.dir);
    if (!h) return null;
    return <g key={l.key}>
      <ellipse cx={f1(l.x)} cy="250" rx={f1(7 + 13 * h.ring)} ry={f1(2 + 2.6 * h.ring)} fill="none" style={{ stroke: INK.snow, strokeWidth: 1.6, opacity: f1(1 - h.ring) }} />
      <g transform={`translate(${f1(h.x)} ${f1(246 + h.y)}) rotate(${f1(h.rot)}) scale(${l.dir} 1)`} filter={ids.clay}>
        <path d={smoothPath(boil(leafPoints({ ax: -7, ay: 0, tx: -16, ty: -5, w: 3 }), frame, 820))} style={{ fill: ids.url('trim') }} />
        <path d={smoothPath(boil(leafPoints({ ax: -7, ay: 0, tx: -16, ty: 5, w: 3 }), frame, 821))} style={{ fill: ids.url('trim') }} />
        <path d={smoothPath(boil(leafPoints({ ax: -10, ay: 0, tx: 11, ty: 0, w: 6 }), frame, 822))} style={{ fill: ids.url('trim') }} />
        <circle cx="5.5" cy="-1.2" r="1.3" style={{ fill: INK.ink }} />
      </g>
    </g>;
  })}</>;
}
function Comet({ touches }: { touches: readonly LiveTouch[] }) {
  return <>{touches.filter(l => l.toy === 'cometWish').map(l => {
    const c = cometAt(l.since);
    if (!c) return null;
    return <g key={l.key}>
      <path d={smoothPath(leafPoints({ ax: c.x, ay: c.y, tx: c.x - 64 * c.tail, ty: c.y + 16 * c.tail + 6, w: 5 }))} style={{ fill: fade(INK.butter, 70) }} />
      <path d={smoothPath(leafPoints({ ax: c.x, ay: c.y, tx: c.x - 38 * c.tail, ty: c.y + 9 * c.tail + 3, w: 3 }))} style={{ fill: INK.white }} />
      <path d={smoothPath(starPoints(c.x, c.y, 9, l.since * 0.5))} style={{ fill: INK.sun }} />
    </g>;
  })}</>;
}
function RocketReel({ t, frame, ids, hands, show, touches }: ReelProps) {
  const f = rocketFilm(t, hands, show), press = heroPress(touches), hero = heroPlace('rocket', t, hands);
  const body: Body = { local: f.body, parts: f.parts, cx: f.cx, cy: f.cy, rot: f.rot, sx: f.sx, sy: f.sy, lift: f.tailLift, flame: f.flame };
  const spin = touches.reduce((sum, l) => l.toy === 'nightMoon' ? sum + moonSpin(l.since) : sum, 0);
  return <g>
    <NightBack ids={ids} />
    <Moon kind={show.moon} spin={spin} ids={ids} />
    <Comet touches={touches} />
    <AirPops touches={touches} night />
    <HangingStars set={show.stars} swing={f.stars.map((s, i) => s + starFlick(touches, i))} ids={ids} frame={frame} />
    <SeaBand i={0} t={t} ids={ids} />
    <Squashed q={press.squash} cx={hero.cx} base={hero.base}><ClayBody b={body} frame={frame} ids={ids} prints={hands.prints} press={press} /></Squashed>
    <SeaBand i={1} t={t} ids={ids} />
    <ellipse cx={f1(f.cx)} cy="218" rx={f1(64 * f.shadow)} ry="5" style={{ fill: fade(INK.shadow, 30), opacity: f.shadow }} filter={ids.soft} />
    <SeaBand i={2} t={t} ids={ids} />
    <Fish touches={touches} ids={ids} frame={frame} />
    {[3, 4].map(i => <SeaBand key={i} i={i} t={t} ids={ids} />)}
    <Puffs puffs={f.puffs} ids={ids} />
  </g>;
}

/* ── film 2: The Whale's Jump ──────────────────────────────────────────── */

/** Under the sea, no spout: the whale breathes out bubbles instead. */
const JUMP_PARTS: PartKey = { ...PART_KEYS.whale, spout: { ...PART_KEYS.whale.spout, s: 0 } };
const DayBack = memo(function DayBack({ ids }: { ids: Ids }) {
  return <rect x="-20" y="-440" width="440" height="442" style={{ fill: ids.url('day') }} />;
});
/** The clouds of this show's sky; a tapped cloud squishes and puffs back. */
function Clouds({ sky, touches, ids }: { sky: number; touches: readonly LiveTouch[]; ids: Ids }) {
  return <g filter={ids.clay}>{cloudsOf(sky).map(([x, y, s], i) => {
    const q = 0.2 * touches.reduce((sum, l) => l.toy === 'puffCloud' && l.index === i ? sum + wobble(l.since, 1.3, 3) : sum, 0);
    return <g key={i} transform={`translate(${x} ${y}) scale(${(s * (1 + q)).toFixed(3)} ${(s * (1 - q)).toFixed(3)})`}>
      <path d="M-34 6C-40 -6 -26 -14 -16 -9C-12 -22 8 -24 14 -11C24 -16 38 -8 32 6Z" style={{ fill: ids.url('cloud') }} />
    </g>;
  })}</g>;
}
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
function JumpReel({ t, frame, ids, hands, show, touches }: ReelProps) {
  const pose = whalePose(t), cam = cameraTop(t), crown = splashCrown(t);
  const body: Body = { local: whaleBody(pose), parts: JUMP_PARTS, cx: pose.x, cy: pose.y, rot: pose.rot, sx: JUMP_SCALE, sy: JUMP_SCALE, lift: pose.lift, bend: pose.bend };
  const raw = heroPress(touches), press: Press = { ...raw, dents: raw.dents.map(d => ({ ...d, y: d.y + cam })) };
  /** The splash crown: clay water fingers thrown up and out, then falling back. */
  const fingers = crown > 0.01 ? Array.from({ length: 9 }, (_, i) => {
    const u = (i - 4) / 4, h = (40 + 30 * seeded(i, 40)) * crown * (1 - 0.35 * Math.abs(u)), x = SPLASH_X + u * (16 + 18 * crown);
    return { ax: x, ay: 4, tx: x + u * (26 + 22 * crown), ty: 4 - h, w: 6 + 3 * (1 - Math.abs(u)) };
  }) : [];
  return <g transform={`translate(0 ${f1(-cam)})`}>
    <DayBack ids={ids} />
    <Sun x={JUMP_SUN.x} y={JUMP_SUN.y} r={JUMP_SUN.r} touches={touches} ids={ids} frame={frame} />
    <Clouds sky={show.sky} touches={touches} ids={ids} />
    <AirPops touches={touches} night={false} dy={cam} />
    <Seabed ids={ids} />
    <Seaweed t={t} ids={ids} />
    {bubbles(t).map(b => <g key={b.id}><circle cx={f1(b.x)} cy={f1(b.y)} r={f1(b.r)} style={{ fill: fade(INK.skyPale, 30), stroke: fade(INK.white, 70), strokeWidth: 1 }} /><circle cx={f1(b.x - b.r * 0.35)} cy={f1(b.y - b.r * 0.35)} r={f1(b.r * 0.28)} style={{ fill: fade(INK.white, 80) }} /></g>)}
    <HandBubbles touches={touches} dy={cam} top={0} />
    <Squashed q={raw.squash} cx={pose.x} base={pose.y + 24}><ClayBody b={body} frame={frame} ids={ids} prints={hands.prints} press={press} /></Squashed>
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

/* ── film 3: Aya's Flower ──────────────────────────────────────────────── */

const GardenBack = memo(function GardenBack({ ids }: { ids: Ids }) {
  return <>
    <rect width="400" height="300" style={{ fill: ids.url('day') }} />
    <g filter={ids.clay}>
      {/* The valley's mountain, far off, with its snow. */}
      <path d="M232 178C262 150 284 116 300 100C318 116 344 150 372 178Z" style={{ fill: mix(INK.slate, 46, INK.sky) }} />
      <path d="M283 122C290 112 296 104 300 100C305 105 312 113 319 123C312 120 306 127 300 121C294 127 289 119 283 122Z" style={{ fill: INK.snow }} />
      <path d="M-10 196C40 160 96 176 140 184C190 162 250 156 300 176C340 164 380 168 410 182L410 240L-10 240Z" style={{ fill: mix(INK.sage, 80, INK.moss) }} />
      <path d="M-10 214C60 196 120 208 190 206C260 198 330 200 410 210L410 244L-10 244Z" style={{ fill: mix(INK.leaf, 62, INK.spring) }} />
      {/* A white glass pavilion of the valley, far left, and two round shrubs by the wall. */}
      <path d="M22 214V176C22 150 44 134 70 134C96 134 118 150 118 176V214Z" style={{ fill: ids.url('pot') }} />
      <path d="M34 214V178C34 160 50 148 70 148C90 148 106 160 106 178V214Z" style={{ fill: ids.url('glass') }} />
      <path d="M68 148H72V214H68ZM34 180H106V184H34Z" style={{ fill: INK.white }} />
      <circle cx="150" cy="210" r="13" style={{ fill: INK.leaf }} /><circle cx="168" cy="213" r="9" style={{ fill: mix(INK.leaf, 70, INK.spring) }} /><circle cx="338" cy="210" r="14" style={{ fill: mix(INK.leaf, 80, INK.leafDeep) }} /><circle cx="358" cy="214" r="9" style={{ fill: INK.leaf }} />
      {/* The terrace of the Sky Gardens: a white floor and a low white wall with its teal line. */}
      <path d="M-10 222H130C136 222 138 216 144 216H410V246H-10Z" style={{ fill: ids.url('pot') }} />
      <rect x="-10" y="236" width="420" height="70" style={{ fill: mix(INK.snow, 78, INK.linen) }} />
    </g>
    <path d="M-10 232H410" fill="none" style={{ stroke: mix(INK.teal, 70, INK.sea), strokeWidth: 2 }} />
    {[262, 284].map((y, i) => <path key={y} d={ridgePath(y, 0, i * 2, 0.8)} fill="none" style={{ stroke: fade(INK.shadow, 10), strokeWidth: 1.2 }} />)}
  </>;
});
const AYA_S = 1.5;
const AYA_BODY: readonly Pt[] = [[-14, -3], [-17, -16], [-12, -29], [-2, -35], [9, -31], [14, -19], [12, -6], [3, 0], [-9, 0]];
interface AyaPose { x: number; ground: number; lift: number; sx: number; sy: number; droop: number; lean: number; hand: Pt | null; glad: boolean; size?: number }
/** Aya in clay: cobalt blue, a white bib and tail, long ears that say how she feels. */
function ClayAya({ p, frame, ids, press, salt = 0 }: { p: AyaPose; frame: number; ids: Ids; press?: Press; salt?: number }) {
  const size = p.size ?? AYA_S, ox = p.x, oy = p.ground - p.lift, kx = p.sx * size, ky = p.sy * size;
  const at = (q: Pt) => placePoint(q, ox, oy, p.lean, kx, ky);
  const put = (pts: readonly Pt[], s: number) => boil(place(pts, ox, oy, p.lean, kx, ky), frame, 900 + salt * 40 + s);
  const clip = `${ids.uid}-aya${salt}`, outline = smoothPath(put(AYA_BODY, 1));
  const blue = ids.url('aya'), deep = mix(AYA_BLUE, 78, INK.shadow);
  const ear = (root: Pt, up: Pt, down: Pt, w: number, s: number, fill: string) => <path d={smoothPath(put(leafPoints({ ax: root[0], ay: root[1], tx: lerp(up[0], down[0], p.droop), ty: lerp(up[1], down[1], p.droop), w }), s))} style={{ fill }} />;
  const shoulder = at([8, -27]), rest = at([16, -18]), hand = p.hand ?? rest;
  const [hx, hy] = at([6, -44]), [exx, eyy] = at([11, -47]);
  const shut = p.glad || !!press?.squeeze;
  return <g className="ct-aya">
    <ellipse cx={f1(ox)} cy={f1(p.ground + 1)} rx={f1(20 - Math.min(9, p.lift * 0.25))} ry="3.6" style={{ fill: fade(INK.shadow, 30), opacity: f1(1 - Math.min(0.6, p.lift / 70)) }} filter={ids.soft} />
    <g filter={ids.clay}>
      <circle cx={f1(at([-15, -11])[0])} cy={f1(at([-15, -11])[1])} r={f1(6.4 * kx)} style={{ fill: ids.url('fluff') }} />
      <path d={smoothPath(put(leafPoints({ ax: -1, ay: -2, tx: 14, ty: -1, w: 4 }), 2))} style={{ fill: deep }} />
      {ear([1, -52], [-5, -88], [-25, -58], 6.4, 3, deep)}
      <path d={outline} style={{ fill: blue }} />
      <clipPath id={clip}><path d={outline} /></clipPath>
      <ellipse cx={f1(at([7, -15])[0])} cy={f1(at([7, -15])[1])} rx={f1(7 * kx)} ry={f1(11.5 * ky)} clipPath={`url(#${clip})`} style={{ fill: ids.url('fluff') }} />
      <path d={smoothPath(put(leafPoints({ ax: -7, ay: -1, tx: 11, ty: 0, w: 4.8 }), 4))} style={{ fill: blue }} />
      {ear([8, -52], [12, -90], [-16, -44], 6.8, 5, blue)}
      {ear([8.5, -55], [11.5, -84], [-12, -46], 3.1, 6, mix(INK.rose, 70, INK.blossom))}
      <circle cx={f1(hx)} cy={f1(hy)} r={f1(12.6 * kx)} style={{ fill: blue }} />
      <ellipse cx={f1(at([12.5, -39.5])[0])} cy={f1(at([12.5, -39.5])[1])} rx={f1(6.6 * kx)} ry={f1(5.2 * ky)} style={{ fill: ids.url('fluff') }} />
      <path d={smoothPath(boil(leafPoints({ ax: shoulder[0], ay: shoulder[1], tx: hand[0], ty: hand[1], w: 4.2 }), frame, 907 + salt))} style={{ fill: blue }} />
      <circle cx={f1(hand[0])} cy={f1(hand[1])} r="3.2" style={{ fill: blue }} />
    </g>
    {press && <g clipPath={`url(#${clip})`}><Dents dents={press.dents} ids={ids} tone={INK.water} /></g>}
    <Print x={at([-5, -20])[0]} y={at([-5, -20])[1]} r={5.5} rot={-24} o={0.2} />
    <circle cx={f1(at([18.6, -42])[0])} cy={f1(at([18.6, -42])[1])} r="1.7" style={{ fill: INK.roseDeep }} />
    {shut
      ? <path d={`M${f1(exx - 3)} ${f1(eyy + 0.6)}Q${f1(exx)} ${f1(eyy - 3)} ${f1(exx + 3)} ${f1(eyy + 0.6)}`} fill="none" strokeLinecap="round" style={{ stroke: INK.ink, strokeWidth: 1.8 }} />
      : <><circle cx={f1(exx)} cy={f1(eyy)} r="2.7" style={{ fill: INK.ink }} /><circle cx={f1(exx - 0.8)} cy={f1(eyy - 1)} r="0.9" style={{ fill: INK.white }} /></>}
    {p.glad && <path d={`M${f1(at([13, -37])[0])} ${f1(at([13, -37])[1])}Q${f1(at([16, -34])[0])} ${f1(at([16, -34])[1])} ${f1(at([18.5, -38])[0])} ${f1(at([18.5, -38])[1])}`} fill="none" strokeLinecap="round" style={{ stroke: INK.roseDeep, strokeWidth: 1.5 }} />}
    <circle cx={f1(at([8, -40])[0])} cy={f1(at([8, -40])[1])} r="2.6" style={{ fill: fade(INK.rose, 50) }} />
  </g>;
}
/** The flower that comes up in the child's own clay: stem, two leaves, five petals, a glad middle. */
function GardenFlower({ f, frame, ids, extraSway }: { f: AyaFrame; frame: number; ids: Ids; extraSway: number }) {
  if (f.stem <= 0.01) return null;
  const h = 92 * f.stem, bx = PLANTER_X, by = SOIL_Y - 1, tx = bx - 3 * f.stem, ty = by - h, mid: Pt = [bx - 7 * f.stem, by - h * 0.5];
  const on = (u: number): Pt => [(1 - u) * (1 - u) * bx + 2 * u * (1 - u) * mid[0] + u * u * tx, (1 - u) * (1 - u) * by + 2 * u * (1 - u) * mid[1] + u * u * ty];
  const l1 = on(0.36), l2 = on(0.56);
  return <g transform={`rotate(${f1(f.sway + extraSway)} ${bx} ${by})`}>
    <g filter={ids.clay}>
      <path d={`M${bx} ${by}Q${f1(mid[0])} ${f1(mid[1])} ${f1(tx)} ${f1(ty)}`} fill="none" strokeLinecap="round" style={{ stroke: mix(INK.leaf, 82, INK.spring), strokeWidth: 4.6 }} />
      {f.leaves > 0.02 && <>
        <path d={smoothPath(boil(leafPoints({ ax: l1[0], ay: l1[1], tx: l1[0] + 26 * f.leaves, ty: l1[1] - 11 * f.leaves, w: 7.6 * f.leaves }), frame, 930))} style={{ fill: INK.leaf }} />
        <path d={smoothPath(boil(leafPoints({ ax: l2[0], ay: l2[1], tx: l2[0] - 24 * f.leaves, ty: l2[1] - 13 * f.leaves, w: 7 * f.leaves }), frame, 931))} style={{ fill: mix(INK.leaf, 70, INK.spring) }} />
      </>}
      {f.petals.map((k, i) => { if (k <= 0.02) return null; const a = (-90 + i * 72) * Math.PI / 180; return <path key={i} d={smoothPath(boil(leafPoints({ ax: tx, ay: ty, tx: tx + 25 * k * Math.cos(a), ty: ty + 25 * k * Math.sin(a), w: 11.5 * k }), frame, 940 + i))} style={{ fill: i % 2 ? mix('var(--ct-body)', 80, INK.white) : ids.url('body') }} />; })}
      {f.middle > 0.02 && <circle cx={f1(tx)} cy={f1(ty)} r={f1(4 + 6 * f.middle)} style={{ fill: f.petals[0] > 0.1 ? ids.url('trim') : mix(INK.leaf, 70, INK.spring) }} />}
    </g>
    {f.glad && <g>
      <circle cx={f1(tx - 3.4)} cy={f1(ty - 1.6)} r="1.2" style={{ fill: INK.ink }} /><circle cx={f1(tx + 3.4)} cy={f1(ty - 1.6)} r="1.2" style={{ fill: INK.ink }} />
      <path d={`M${f1(tx - 3.8)} ${f1(ty + 2)}Q${f1(tx)} ${f1(ty + 6)} ${f1(tx + 3.8)} ${f1(ty + 2)}`} fill="none" strokeLinecap="round" style={{ stroke: INK.ink, strokeWidth: 1.4 }} />
    </g>}
  </g>;
}
function AyaReel({ t, frame, ids, touches }: ReelProps) {
  const f = ayaFilm(t), press = heroPress(touches);
  const carrying = f.seed.o > 0.99 && f.arm > 0;
  const soil: Pt = [PLANTER_X - 4, SOIL_Y - 4];
  const pose: AyaPose = { x: f.x, ground: AYA_GROUND, lift: f.lift, sx: f.sx, sy: f.sy, droop: f.droop, lean: 11 * f.arm, hand: f.arm > 0.01 ? (carrying ? [f.seed.x, f.seed.y] : [lerp(f.x + 24, soil[0], f.arm), lerp(AYA_GROUND - 27, soil[1], f.arm)]) : null, glad: f.glad };
  const tap = touches.reduce((sum, l) => l.toy === 'gardenBloom' ? sum + 7 * wobble(l.since, 1.1, 5) : sum, 0);
  return <g>
    <GardenBack ids={ids} />
    <Sun x={GARDEN_SUN.x} y={GARDEN_SUN.y} r={GARDEN_SUN.r} touches={touches} ids={ids} frame={frame} />
    <AirPops touches={touches} night={false} />
    {/* The white planter with its teal line, as they stand all over the valley. */}
    <ellipse cx={PLANTER_X} cy="251" rx="36" ry="4.5" style={{ fill: fade(INK.shadow, 26) }} filter={ids.soft} />
    <g filter={ids.clay}>
      <rect x={PLANTER_X - 30} y={SOIL_Y - 2} width="60" height="38" rx="7" style={{ fill: ids.url('pot') }} />
      <ellipse cx={PLANTER_X} cy={SOIL_Y} rx="26" ry="5" style={{ fill: mix(INK.umber, 80, INK.wood) }} />
      {t > 2.6 && <ellipse cx={PLANTER_X - 2} cy={SOIL_Y - 1.5} rx="7" ry="2.6" style={{ fill: mix(INK.umber, 60, INK.wood) }} />}
    </g>
    <rect x={PLANTER_X - 30} y={SOIL_Y + 28} width="60" height="2.4" style={{ fill: mix(INK.teal, 70, INK.sea) }} />
    <GardenFlower f={f} frame={frame} ids={ids} extraSway={tap} />
    {f.cloud.o > 0 && <g filter={ids.clay} transform={`translate(${f1(f.cloud.x)} 96)`}>
      <path d="M-34 8C-42 -6 -26 -15 -16 -10C-12 -24 9 -26 15 -12C26 -17 40 -8 33 8Z" style={{ fill: mix(INK.snowShade, 55, INK.snow) }} />
    </g>}
    {f.drops.map(d => <path key={d.id} d={`M${f1(d.x)} ${f1(d.y - 4)}Q${f1(d.x + 2.6)} ${f1(d.y + 1)} ${f1(d.x)} ${f1(d.y + 2.4)}Q${f1(d.x - 2.6)} ${f1(d.y + 1)} ${f1(d.x)} ${f1(d.y - 4)}Z`} style={{ fill: mix(INK.sea, 70, INK.water) }} />)}
    <Squashed q={press.squash} cx={f.x} base={AYA_GROUND - f.lift}><ClayAya p={pose} frame={frame} ids={ids} press={press} /></Squashed>
    {f.seed.o > 0.02 && <circle cx={f1(f.seed.x)} cy={f1(f.seed.y)} r="3" style={{ fill: mix(INK.umber, 80, INK.wood), opacity: f1(f.seed.o) }} />}
  </g>;
}

/* ── film 4: Halfway Frog ──────────────────────────────────────────────── */

const PondBack = memo(function PondBack({ ids }: { ids: Ids }) {
  return <>
    <rect width="400" height="300" style={{ fill: ids.url('dusk') }} />
    <g filter={ids.clay}>
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
  return `M${f1(x)} ${f1(y)}L${pts.join('L')}Z`;
}
/** The lily pads; a tapped pad dips, rocks and sends out a ring. */
function Pads({ ids, touches }: { ids: Ids; touches: readonly LiveTouch[] }) {
  const dip = (i: number) => 2.6 * touches.reduce((sum, l) => l.toy === 'padLeaf' && l.index === i ? sum + wobble(l.since, 1.1, 4) : sum, 0);
  return <g>
    {touches.filter(l => l.toy === 'padLeaf').map(l => { const p = PADS[l.index], s = Math.max(0, l.since); return <ellipse key={l.key} cx={f1(p.x)} cy={f1(p.y + 2)} rx={f1(p.rx + 2.4 * s)} ry={f1((p.rx + 2.4 * s) * 0.3)} fill="none" style={{ stroke: fade(INK.white, 70), strokeWidth: 1.4, opacity: f1(1 - s / 10) }} />; })}
    {touches.filter(l => l.toy === 'deepWater').map(l => { const s = Math.max(0, l.since); return <ellipse key={l.key} cx={f1(l.x)} cy={f1(l.y)} rx={f1(6 + 2.6 * s)} ry={f1((6 + 2.6 * s) * 0.3)} fill="none" style={{ stroke: fade(INK.white, 75), strokeWidth: 1.4, opacity: f1(1 - s / 11) }} />; })}
    <g filter={ids.clay}>{PADS.map((p, i) => <path key={i} d={padPath(p.x, p.y + dip(i), p.rx, p.rx * 0.3, p.n)} style={{ fill: i % 2 ? ids.url('pad') : mix(INK.leaf, 70, INK.spring) }} />)}</g>
    {PADS.map((p, i) => <g key={i} style={{ stroke: fade(INK.leafDeep, 40), strokeWidth: 0.8 }}>{[0.9, 2.2, 3.6, 5].map(a => <line key={a} x1={f1(p.x)} y1={f1(p.y + dip(i))} x2={f1(p.x + p.rx * 0.8 * Math.cos(p.n + a))} y2={f1(p.y + dip(i) + p.rx * 0.24 * Math.sin(p.n + a))} />)}</g>)}
  </g>;
}
/** The flower's clay, one for each show: blossom pink, lilac, butter. */
const BLOOM_TONES: readonly (readonly [string, string, string])[] = [
  [INK.blossom, mix(INK.rose, 70, INK.blossom), mix(INK.roseDeep, 45, INK.blossom)],
  [mix(INK.lilac, 60, INK.white), INK.lilac, mix(INK.violet, 50, INK.lilac)],
  [INK.butter, mix(INK.amber, 55, INK.butter), mix(INK.orange, 45, INK.butter)],
];
/** The lotus sits high on its stem, so reaching it takes a long clay arm. */
function Lotus({ bob, kind, pollen, ids }: { bob: number; kind: number; pollen: number; ids: Ids }) {
  const bx = FROG_XF + 4, by = BLOOM_Y + bob, tones = BLOOM_TONES[((kind % 3) + 3) % 3];
  return <g>
    <path d={`M${FROG_XF} ${PAD_Y + 2}C${FROG_XF - 8} 170 ${FROG_XF + 10} 140 ${bx} ${f1(by + 10)}`} fill="none" strokeLinecap="round" style={{ stroke: mix(INK.leafDeep, 80, INK.leaf), strokeWidth: 5 }} />
    <path d={`M${FROG_XF - 1.4} ${PAD_Y}C${FROG_XF - 9} 170 ${FROG_XF + 8} 140 ${bx - 1.4} ${f1(by + 12)}`} fill="none" strokeLinecap="round" style={{ stroke: fade(INK.spring, 60), strokeWidth: 1.4 }} />
    <g filter={ids.clay}>
      <path d={padPath(FROG_XF + 10, PAD_Y + 3, 24, 7, 2.6)} style={{ fill: mix(INK.leaf, 70, INK.spring) }} />
      {[-170, -10].map(a => { const r = (a * Math.PI) / 180; return <path key={a} d={smoothPath(leafPoints({ ax: bx, ay: by + 9, tx: bx + 22 * Math.cos(r), ty: by + 9 + 22 * Math.sin(r) + 5, w: 6.5 }))} style={{ fill: tones[2] }} />; })}
      {[-150, -120, -90, -60, -30].map((a, i) => { const r = (a * Math.PI) / 180, len = i === 2 ? 27 : 23; return <path key={a} d={smoothPath(leafPoints({ ax: bx, ay: by + 7, tx: bx + len * Math.cos(r), ty: by + 7 + len * Math.sin(r), w: 8.5 }))} style={{ fill: i % 2 ? tones[0] : tones[1] }} />; })}
      <circle cx={bx} cy={f1(by + 5)} r="6" style={{ fill: ids.url('gold') }} />
    </g>
    {/* A puff of clay pollen when the hand arrives. */}
    {pollen > 0 && pollen < 1 && [0, 1, 2, 3, 4, 5, 6].map(i => { const a = -Math.PI * (0.1 + 0.8 * seeded(i, 81)), r = 8 + (18 + 10 * seeded(i, 82)) * pollen; return <circle key={i} cx={f1(bx + r * Math.cos(a))} cy={f1(by + 4 + r * Math.sin(a) + 14 * pollen * pollen)} r={f1(1.2 + 1.2 * seeded(i, 83))} style={{ fill: INK.sun, opacity: f1(1 - pollen) }} />; })}
  </g>;
}
/** The frog, side on, facing the flower. Local units: feet at 0, nose at +31. */
const FROG_S = 1.25;
const FROG_BODY: readonly Pt[] = [[-26, -2], [-31, -14], [-23, -28], [-6, -35], [12, -33], [25, -25], [31, -14], [27, -4], [10, 0], [-12, 0]];
type FrogFrame = ReturnType<typeof frogFilm>;
function Frog({ f, frame, ids, press }: { f: FrogFrame; frame: number; ids: Ids; press?: Press }) {
  // Reaching, the whole frog tips up onto its toes toward the flower.
  const tip = -9 * f.arm, ox = f.nose - 31 * FROG_S, oy = PAD_Y + 1 - f.lift - 2.5 * f.arm, kx = f.sx * FROG_S * (1 + 0.05 * f.arm), ky = f.sy * FROG_S;
  const put = (pts: readonly Pt[], s: number) => boil(place(pts, ox, oy, tip, kx, ky), frame, s);
  const at = (p: Pt) => placePoint(p, ox, oy, tip, kx, ky);
  const clip = `${ids.uid}-frog`;
  const outline = smoothPath(put(FROG_BODY, 600));
  const shoulder = at([17, -12]);
  const reach: Pt = [FROG_XF - 9, BLOOM_Y + 15 + f.bob];
  // The arm: clay pulled thin. It winds up a little first, then stretches; the middle thins as it goes.
  const wind = Math.sin(Math.PI * Math.min(1, f.arm / 0.22)) * (f.arm < 0.22 ? 1 : 0), go = span(f.arm, 0.12, 1, v => v);
  const hand: Pt = [shoulder[0] + (reach[0] - shoulder[0]) * go - 7 * wind, shoulder[1] + (reach[1] - shoulder[1]) * go + 5 * wind];
  const ctrl: Pt = [(shoulder[0] + hand[0]) / 2 - 36 * go - 4 * wind, Math.min(shoulder[1], hand[1]) + 16 * go + 3 * Math.sin(go * Math.PI)];
  const N = 10, side: Pt[] = [], other: Pt[] = [];
  let tx = 1, ty = 0;
  for (let i = 0; i <= N; i++) {
    const u = i / N, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
    const x = a * shoulder[0] + b * ctrl[0] + c * hand[0], y = a * shoulder[1] + b * ctrl[1] + c * hand[1];
    const dx = 2 * (1 - u) * (ctrl[0] - shoulder[0]) + 2 * u * (hand[0] - ctrl[0]), dy = 2 * (1 - u) * (ctrl[1] - shoulder[1]) + 2 * u * (hand[1] - ctrl[1]), len = Math.hypot(dx, dy) || 1;
    tx = dx / len; ty = dy / len;
    // Thick at the shoulder, tongue-thin where it has been pulled, a soft knuckle near the wrist.
    const w = lerp(4.6, 1.9, Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.08)), 0.8) * go) + 0.9 * Math.exp(-Math.pow((u - 0.86) / 0.07, 2)) + 0.7 * Math.exp(-Math.pow((u - 0.42) / 0.06, 2)) * go;
    side.push([x - ty * w, y + tx * w]); other.unshift([x + ty * w, y - tx * w]);
  }
  const armPath = smoothPath(boil([...side, ...other], frame, 640));
  const spread = lerp(0.2, 0.62, span(f.arm, 0.7, 1)), dir = Math.atan2(ty, tx);
  const happy = f.touched || !!press?.squeeze;
  const eyes: [Pt, number][] = [[[3, -34], 8 * FROG_S], [[16, -33], 7.4 * FROG_S]];
  return <g className="ct-frog">
    <ellipse cx={f1(f.nose - 30)} cy={PAD_Y + 2} rx={f1(32 - Math.min(16, f.lift * 0.3))} ry="4.5" style={{ fill: fade(INK.shadow, 34), opacity: f1(1 - Math.min(0.6, f.lift / 90)) }} filter={ids.soft} />
    <g filter={ids.clay}>
      <path d={smoothPath(put(leafPoints({ ax: -16, ay: -5, tx: -37, ty: -1 + 3 * f.arm, w: 7 }), 601))} style={{ fill: mix(INK.leaf, 78, INK.shadow) }} />
      <path d={outline} style={{ fill: ids.url('frog') }} />
      <clipPath id={clip}><path d={outline} /></clipPath>
      <ellipse cx={f1(at([12, -8])[0])} cy={f1(at([12, -8])[1])} rx={f1(16 * kx)} ry={f1(8 * ky)} transform={`rotate(${f1(tip)} ${f1(at([12, -8])[0])} ${f1(at([12, -8])[1])})`} clipPath={`url(#${clip})`} style={{ fill: ids.url('belly') }} />
      <circle cx={f1(at([-16, -12])[0])} cy={f1(at([-16, -12])[1])} r={f1(11 * kx)} style={{ fill: ids.url('frog') }} />
      {eyes.map(([p, r], i) => { const [x, y] = at(p); return <circle key={i} cx={f1(x)} cy={f1(y)} r={f1(r)} style={{ fill: ids.url('frog') }} />; })}
      <path d={smoothPath(put(leafPoints({ ax: 18, ay: -4, tx: 28, ty: 0, w: 3.6 }), 602))} style={{ fill: mix(INK.leaf, 85, INK.shadow) }} />
    </g>
    {press && <g clipPath={`url(#${clip})`}><Dents dents={press.dents} ids={ids} tone={INK.leaf} /></g>}
    <Print x={at([-14, -20])[0]} y={at([-14, -20])[1]} r={7} rot={-20} o={0.22} />
    <Print x={at([4, -18])[0]} y={at([4, -18])[1]} r={5} rot={30} o={0.14} tone={INK.shadow} />
    {eyes.map(([p, r], i) => { const [x, y] = at(p); return happy
      ? <path key={i} d={`M${f1(x - r * 0.55)} ${f1(y)}Q${f1(x)} ${f1(y - r * 0.6)} ${f1(x + r * 0.55)} ${f1(y)}`} fill="none" strokeLinecap="round" style={{ stroke: INK.ink, strokeWidth: 2 }} />
      : <g key={i}><circle cx={f1(x)} cy={f1(y)} r={f1(r * 0.66)} style={{ fill: INK.white }} /><circle cx={f1(x + 1.4 + f.look)} cy={f1(y - 2.6 * f.look)} r={f1(r * 0.34)} style={{ fill: INK.ink }} /><circle cx={f1(x + 0.6 + f.look)} cy={f1(y - 1.2 - 2.6 * f.look)} r="0.9" style={{ fill: INK.white }} /></g>; })}
    <path d={`M${f1(at([19, -17])[0])} ${f1(at([19, -17])[1])}Q${f1(at([26, -12])[0])} ${f1(at([26, -12])[1])} ${f1(at([31, -18])[0])} ${f1(at([31, -18])[1])}`} fill="none" strokeLinecap="round" style={{ stroke: INK.leafDeep, strokeWidth: 2 }} />
    <circle cx={f1(at([21, -21])[0])} cy={f1(at([21, -21])[1])} r="3.6" style={{ fill: fade(INK.rose, 50) }} />
    {f.arm > 0.01 && <g>
      <path d={armPath} transform="translate(1.6 2.4)" style={{ fill: fade(INK.shadow, 20) }} filter={ids.soft} />
      <g filter={ids.clay}>
        <path d={armPath} style={{ fill: mix(INK.spring, 40, INK.leaf) }} />
        {/* The hand: a soft palm and three round finger pads that open as it arrives. */}
        {[-1, 0, 1].map(k => { const a = dir + k * spread, len = 7.4 - Math.abs(k) * 0.8; return <path key={k} d={smoothPath(boil(leafPoints({ ax: hand[0], ay: hand[1], tx: hand[0] + len * Math.cos(a), ty: hand[1] + len * Math.sin(a), w: 2.6 }), frame, 650 + k))} style={{ fill: ids.url('frog') }} />; })}
        <circle cx={f1(hand[0])} cy={f1(hand[1])} r="4.3" style={{ fill: ids.url('frog') }} />
        {[-1, 0, 1].map(k => { const a = dir + k * spread, len = 8 - Math.abs(k) * 0.8; return <circle key={k} cx={f1(hand[0] + len * Math.cos(a))} cy={f1(hand[1] + len * Math.sin(a))} r="2.1" style={{ fill: mix(INK.spring, 70, INK.butter) }} />; })}
      </g>
      {/* A thumbprint on the forearm, and the stretch marks where the clay was pulled. */}
      {go > 0.5 && [0.3, 0.5, 0.68].map(u => { const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u, x = a * shoulder[0] + b * ctrl[0] + c * hand[0], y = a * shoulder[1] + b * ctrl[1] + c * hand[1]; return <line key={u} x1={f1(x - 1.4)} y1={f1(y - 0.8)} x2={f1(x + 1.4)} y2={f1(y + 0.8)} strokeLinecap="round" style={{ stroke: fade(INK.leafDeep, 40), strokeWidth: 0.9 }} />; })}
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
function Loupe({ f, ids }: { f: FrogFrame; ids: Ids }) {
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
    <circle cx={cx} cy={cy} r={r} fill="none" style={{ stroke: INK.snow, strokeWidth: 5 }} />
    <circle cx={cx} cy={cy} r={r + 2.5} fill="none" style={{ stroke: mix(INK.teal, 70, INK.sea), strokeWidth: 1.4 }} />
    <path d={`M${cx - r * 0.55} ${cy - r * 0.35}A${r * 0.7} ${r * 0.7} 0 0 1 ${cx - r * 0.1} ${cy - r * 0.68}`} fill="none" strokeLinecap="round" style={{ stroke: fade(INK.white, 80), strokeWidth: 2.4 }} />
  </g>;
}
function FrogReel({ t, frame, ids, show, touches }: ReelProps) {
  const f = frogFilm(t), press = heroPress(touches), hero = heroPlace('frog', t);
  const tap = touches.reduce((sum, l) => l.toy === 'lotusBloom' ? sum + 4 * wobble(l.since, 1.1, 5) : sum, 0);
  return <g>
    <PondBack ids={ids} />
    <Sun x={POND_SUN.x} y={POND_SUN.y} r={POND_SUN.r} touches={touches} ids={ids} frame={frame} />
    <AirPops touches={touches} night={false} />
    <Pads ids={ids} touches={touches} />
    <Lotus bob={f.bob + tap} kind={show.bloom} pollen={(t - REACH_TOUCH) / 0.7} ids={ids} />
    <Squashed q={press.squash} cx={hero.cx} base={hero.base}><Frog f={f} frame={frame} ids={ids} press={press} /></Squashed>
    <Loupe f={f} ids={ids} />
    <Ribbon progress={f.progress} ids={ids} />
  </g>;
}

/* ── the felt curtain ─────────────────────────────────────────────────── */

/** The theatre's teal felt curtain: a scalloped valance and two drapes,
 * gathered open for the film (`drapes` 0) or drawn across it (1). */
function FeltCurtain({ ids, drapes, ripple }: { ids: Ids; drapes: number; ripple: number }) {
  const edge = 15 + 189 * drapes + 2.4 * ripple, depth = 9 + 3 * ripple;
  const panel = (flip: boolean) => {
    const x = (v: number) => f1(flip ? 400 - v : v);
    const folds = 1 + Math.floor(edge / 24);
    return <g>
      <path d={`M${x(-2)} -2H${x(edge)}C${x(edge + 5)} 80 ${x(edge - 5)} 190 ${x(edge + 3)} 302H${x(-2)}Z`} style={{ fill: ids.url('felt') }} />
      {Array.from({ length: folds }, (_, i) => { const fx = (edge * (i + 0.6)) / folds; return <path key={i} d={`M${x(fx)} 8C${x(fx + 3)} 90 ${x(fx - 3)} 200 ${x(fx + 1.5)} 300`} fill="none" style={{ stroke: fade(INK.tealDeep, 46), strokeWidth: 1.5 }} />; })}
      <path d={`M${x(edge)} 0C${x(edge + 5)} 80 ${x(edge - 5)} 190 ${x(edge + 3)} 300`} fill="none" strokeDasharray="3 3.4" style={{ stroke: fade(INK.white, 46), strokeWidth: 1 }} />
    </g>;
  };
  const scallops = Array.from({ length: 10 }, (_, i) => `Q${380 - i * 40} ${f1(13 + depth * 2)} ${360 - i * 40} 13`).join('');
  return <g className="ct-frame">
    <g filter={ids.clay}>{panel(false)}{panel(true)}</g>
    <g filter={ids.clay}><path d={`M-2 -2H402V13H400${scallops}H-2Z`} style={{ fill: mix(INK.teal, 86, INK.sea) }} /></g>
    <path d={`M400 13${scallops}`} fill="none" strokeDasharray="3 3.4" transform="translate(0 -3)" style={{ stroke: fade(INK.white, 55), strokeWidth: 1 }} />
    {Array.from({ length: 9 }, (_, i) => <circle key={i} cx={40 + i * 40} cy="15" r="2.7" style={{ fill: INK.snow }} />)}
  </g>;
}

/* ── the curtain call ─────────────────────────────────────────────────── */

/** The finish: the curtain closes and opens again on the whole clay cast,
 * who bow while roses land at their feet. Drawn, like every film frame, from
 * its frame number alone. */
export function CurtainCallScene({ frame, body, trim, hands = FRESH_HANDS, frogToo, label }: { frame: number; body: ClayId; trim: ClayId; hands?: Hands; frogToo: boolean; label?: string }) {
  const uid = `cc${useId().replace(/[^a-zA-Z0-9]/g, '')}`, ids = sceneIds(uid, false);
  const call = curtainCall(Math.min(CALL_SECONDS, timeOf(frame)));
  const style = { '--ct-body': chalky(CLAYS[body]), '--ct-trim': chalky(CLAYS[trim]) } as CSSProperties;
  const xs = frogToo ? [76, 158, 232, 356] : [92, 196, 296], floor = 252, k = frogToo ? CAST_SCALE * 0.88 : CAST_SCALE;
  const whale: Body = { local: beatBody(BODY_KEYFRAMES.whale, 6 * call.bows[0]), parts: PART_KEYS.whale, cx: xs[0], cy: floor - 50 * k + 5 * call.bows[0], rot: 13 * call.bows[0], sx: k, sy: k, lift: 0 };
  const rocket: Body = { local: [...BODY_KEYFRAMES.rocket], parts: rocketKey(hands), cx: xs[1] + 12 * call.bows[1], cy: floor - 86 * k, rot: -90 + 14 * call.bows[1], sx: k, sy: k, lift: 0, flame: 0 };
  const aya: AyaPose = { x: xs[2], ground: floor, lift: 0, sx: 1 + 0.08 * call.bows[2], sy: 1 - 0.2 * call.bows[2], droop: 0.85 * call.bows[2], lean: 16 * call.bows[2], hand: null, glad: true, size: 1.1 };
  const frog: FrogFrame = { progress: 1, nose: xs[3] ?? 0, lift: 0, sx: 1 + 0.08 * call.bows[3], sy: 1 - 0.22 * call.bows[3], hop: 0, arm: 0, touched: true, bob: 0, look: 0, loupe: 0, gap: 0 };
  return <svg viewBox="0 0 400 300" className="ct-scene" data-call-frame={frame} style={style} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false" preserveAspectRatio="xMidYMid slice">
    <SceneDefs uid={uid} lite={false} />
    <rect width="400" height="300" style={{ fill: ids.url('day') }} />
    <g filter={ids.clay}>
      <path d="M-10 186C40 150 96 166 140 174C190 152 250 146 300 166C340 154 380 158 410 172L410 236L-10 236Z" style={{ fill: mix(INK.sage, 80, INK.moss) }} />
      <path d="M-10 204C60 186 120 198 190 196C260 188 330 190 410 200L410 240L-10 240Z" style={{ fill: mix(INK.leaf, 62, INK.spring) }} />
      <rect x="-10" y="232" width="420" height="80" style={{ fill: ids.url('boards') }} />
    </g>
    {[62, 132, 202, 272, 342].map(x => <line key={x} x1={x} y1="234" x2={x + (x - 200) * 0.34} y2="300" style={{ stroke: fade(INK.wood, 34), strokeWidth: 1 }} />)}
    {call.cast > 0 && <g>
      {[xs[0], xs[1]].map((x, i) => <ellipse key={i} cx={x} cy={floor + 2} rx={(i ? 30 : 86) * k} ry="4" style={{ fill: fade(INK.shadow, 28) }} filter={ids.soft} />)}
      <ClayBody b={whale} frame={frame} ids={ids} salt={2} prints={hands.prints} />
      <ClayBody b={rocket} frame={frame} ids={ids} salt={3} />
      <ClayAya p={aya} frame={frame} ids={ids} salt={1} />
      {frogToo && <g transform={`translate(0 ${floor - PAD_Y - 1})`}><Frog f={frog} frame={frame} ids={ids} /></g>}
      {call.roses.map(r => <g key={r.id} transform={`translate(${f1(r.x)} ${f1(r.y)}) rotate(${f1(r.rot)})`} filter={ids.clay}>
        <path d={smoothPath(leafPoints({ ax: 0, ay: 2, tx: -11, ty: 9, w: 2.2 }))} style={{ fill: INK.leaf }} />
        <path d={smoothPath(leafPoints({ ax: -5, ay: 5, tx: -11, ty: 1, w: 2.4 }))} style={{ fill: mix(INK.leaf, 70, INK.spring) }} />
        <circle r="5.4" style={{ fill: ids.url('petal') }} />
        <path d="M-2.6 0.4A2.8 2.8 0 1 1 1.6 2.4A1.6 1.6 0 1 1 0 -0.6" fill="none" strokeLinecap="round" style={{ stroke: mix(INK.roseDeep, 70, INK.rose), strokeWidth: 1.1 }} />
      </g>)}
    </g>}
    <FeltCurtain ids={ids} drapes={call.drapes} ripple={0} />
  </svg>;
}
