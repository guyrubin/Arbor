import { useId, type CSSProperties, type ReactNode } from 'react';
import {
  BASE, COLLAR, CX, DNA, FIBRE, FIBRE_COUNT, HEAD, LIGHT, SHEATH, SHEATH_MIN, SHEATH_WIDEN, TUBE_R, WHISKER,
  dnaCoil, fibreAngle, headFacets, headOutline, kneeFor, project, toRad, type Facet, type Pt,
} from './phageGeometry';

/** The phage, drawn as a hand-painted museum model: a faceted teal-to-violet
 * head, amber sheath rings, graphite baseplate and legs, one light from the
 * top-left. Every part is computed from the same 2.5D turn, so the head's
 * facets re-shade and the legs swap front and back as it turns.
 *
 * Coordinates are the drawing units of phageGeometry (a 400 x 440 box). The
 * caller places and scales it; this draws parts only, never text. */

export type PartId = 'head' | 'collar' | 'tail' | 'baseplate' | 'fibres';
export interface PartsOn { head: boolean; collar: boolean; tail: boolean; baseplate: boolean; fibres: readonly boolean[] }
export const EVERY_PART: PartsOn = { head: true, collar: true, tail: true, baseplate: true, fibres: [true, true, true, true, true, true] };
const NO_PART: PartsOn = { head: false, collar: false, tail: false, baseplate: false, fibres: [false, false, false, false, false, false] };

export interface PhagePose {
  rotation: number;
  tilt: number;
  /** 0 closed, 1 the head and tail are cut open (the near right quarter is lifted away). */
  cut?: number;
  /** Sheath length share: 1 relaxed down to SHEATH_MIN squeezed. */
  sheath?: number;
  /** The body sinks this far towards the fixed fibre tips as the legs bend. */
  settle?: number;
  /** DNA moved out of the head, 0 to 1. */
  dna?: number;
}
export interface PhageArtProps extends PhagePose {
  /** Parts drawn solid. */
  on?: PartsOn;
  /** Parts drawn as the faint blueprint outline. */
  ghost?: PartsOn;
  /** Blueprint parts that glow (the selected piece's place). */
  glow?: PartsOn;
  /** One part lifted with a soft gold light (its name is showing). */
  lit?: PartId | 'dna' | null;
  /** Adds `data-part` hit areas for tapping parts. */
  interactive?: boolean;
  /** Draw the DNA thread's path into the cell (landing). */
  thread?: boolean;
}

const pct = (v: number) => Math.round(Math.max(0, Math.min(100, v)) / 2) * 2;
const mix = (a: string, share: number, b: string) => `color-mix(in srgb, ${a} ${pct(share)}%, ${b})`;
const poly = (pts: readonly Pt[]) => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
const line = (pts: readonly Pt[]) => pts.length ? `M${pts.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L')}` : '';
const fill = (value: string): CSSProperties => ({ fill: value });
const strokeOf = (value: string): CSSProperties => ({ stroke: value });

/** Facet colour: teal at the top of the head turning violet towards the
 * collar, lightened where the facet faces the light and deepened away from it. */
function facetFill(f: Facet): string {
  const base = mix('var(--mk-violet)', 8 + f.height * 84, 'var(--mk-teal)');
  const v = 0.16 + 0.84 * f.light;
  return v >= 0.58 ? mix('var(--mk-snow)', (v - 0.58) / 0.42 * 38, base) : mix('var(--mk-night)', (0.58 - v) / 0.58 * 64, base);
}
function innerFill(f: Facet): string {
  return mix('var(--mk-night)', 46 + f.light * 30, mix('var(--mk-plum)', 60, 'var(--mk-teal-deep)'));
}

/** Where the six fibre tips stand (for contact shadows), in drawing units. */
export function fibreTips(rotation: number, tilt: number): (Pt & { near: number })[] {
  return Array.from({ length: FIBRE_COUNT }, (_, i) => {
    const p = project(FIBRE.tip.r, fibreAngle(i, 0), FIBRE.tip.y, rotation, tilt);
    return { x: p.sx, y: p.sy, near: p.z / FIBRE.tip.r };
  });
}

/** The thread's way out once the cell is reached: down the tube, then a
 * loose loop inside the cell (relative to the tube's tip). */
const CELL_PATH = 'c -1 8 -14 9 -26 14 c -12 5 -6 15 10 14 c 16 -1 26 -9 40 -6 c 12 3 8 12 -6 15 c -14 2 -30 -2 -44 2 c -10 3 -12 8 -6 9';

export default function PhageArt({ rotation, tilt, cut = 0, sheath = 1, settle = 0, dna = 0, on = EVERY_PART, ghost = NO_PART, glow = NO_PART, lit = null, interactive = false, thread = false }: PhageArtProps) {
  const id = useId();
  const ref = (name: string) => `url(#${id}${name})`;
  const s = Math.max(SHEATH_MIN, Math.min(1, sheath));
  const squeeze = (1 - s) / (1 - SHEATH_MIN);
  /** The head, collar and top of the sheath come down as the sheath squeezes. */
  const drop = SHEATH.length * (1 - s) + settle;
  const sheathTop = SHEATH.top + drop, sheathLen = SHEATH.length * s, sheathR = SHEATH.r * (1 + SHEATH_WIDEN * squeeze);
  const baseTop = BASE.top + settle, baseBottom = baseTop + BASE.height;
  const tubeTop = COLLAR.bottom + drop, tubeBottom = tubeTop + (BASE.top + BASE.height - COLLAR.bottom);
  const cutX = 400 - (400 - (CX - 3)) * Math.max(0, Math.min(1, cut));
  const opened = cut > 0.02;

  const hit = (part: PartId | 'dna') => interactive ? { 'data-part': part } : {};
  const litStyle = (part: PartId | 'dna'): CSSProperties | undefined => lit === part ? { filter: ref('lit') } : undefined;

  /* ---- fibres ---- */
  const fibre = (i: number, look: 'solid' | 'ghost' | 'glow') => {
    const theta = fibreAngle(i, 0);
    const corner = { r: FIBRE.corner.r, y: FIBRE.corner.y + settle };
    const tip = { r: FIBRE.tip.r, y: FIBRE.tip.y };
    const knee = kneeFor(corner, tip);
    const P = (q: { r: number; y: number }) => { const p = project(q.r, theta, q.y, rotation, tilt); return { x: p.sx, y: p.sy, z: p.z }; };
    const a = P(corner), k = P(knee), b = P(tip);
    const near = Math.sin(toRad(fibreAngle(i, rotation)));
    const d1 = `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${k.x.toFixed(1)} ${k.y.toFixed(1)}`, d2 = `M${k.x.toFixed(1)} ${k.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    if (look !== 'solid') return <g key={`f${i}${look}`} className={look === 'glow' ? 'tiny-glow' : 'tiny-ghost'}><path d={`${d1}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`} /></g>;
    const body = near >= 0 ? mix('var(--mk-steel-dark)', 18 + near * 30, 'var(--mk-graphite)') : mix('var(--mk-night)', 26 - near * 22, 'var(--mk-graphite)');
    const shine = near >= 0 ? mix('var(--mk-steel-light)', 70, 'transparent') : mix('var(--mk-steel)', 34, 'transparent');
    const w = 0.86 + near * 0.12;
    return <g key={`f${i}`} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d={d1} strokeWidth={5.2 * w} style={strokeOf(body)} />
      <path d={d2} strokeWidth={4.2 * w} style={strokeOf(body)} />
      <path d={d1} strokeWidth={1.5} transform="translate(-0.9 -1)" style={strokeOf(shine)} />
      <path d={d2} strokeWidth={1.2} transform="translate(-0.8 -0.9)" style={strokeOf(shine)} />
      <circle cx={k.x} cy={k.y} r={3.4 * w} style={fill(body)} />
      <circle cx={k.x - 0.9} cy={k.y - 1} r={1.3} style={fill(shine)} />
      <circle cx={b.x} cy={b.y} r={2.8 * w} style={fill(body)} />
    </g>;
  };
  const fibreHits = () => interactive && on.fibres.some(Boolean) ? <g data-part="fibres" className="tiny-hit">
    {Array.from({ length: FIBRE_COUNT }, (_, i) => {
      if (!on.fibres[i]) return null;
      const theta = fibreAngle(i, 0), corner = { r: FIBRE.corner.r, y: FIBRE.corner.y + settle }, knee = kneeFor(corner, FIBRE.tip);
      const pts = [corner, knee, FIBRE.tip].map(q => { const p = project(q.r, theta, q.y, rotation, tilt); return { x: p.sx, y: p.sy }; });
      return <path key={i} d={line(pts)} fill="none" strokeWidth={22} strokeLinecap="round" pointerEvents="stroke" style={strokeOf('transparent')} />;
    })}
  </g> : null;
  const fibreSet = (front: boolean) => {
    const order = Array.from({ length: FIBRE_COUNT }, (_, i) => i).filter(i => (Math.sin(toRad(fibreAngle(i, rotation))) >= 0) === front)
      .sort((a, b) => Math.sin(toRad(fibreAngle(a, rotation))) - Math.sin(toRad(fibreAngle(b, rotation))));
    return <>
      {order.filter(i => ghost.fibres[i] && !on.fibres[i]).map(i => fibre(i, glow.fibres[i] ? 'glow' : 'ghost'))}
      <g style={litStyle('fibres')}>{order.filter(i => on.fibres[i]).map(i => fibre(i, 'solid'))}</g>
    </>;
  };

  /* ---- whiskers on the collar ---- */
  const whiskers = (front: boolean, look: 'solid' | 'ghost' | 'glow') => Array.from({ length: 6 }, (_, i) => {
    const theta = i * 60, near = Math.sin(toRad(theta + rotation));
    if ((near >= 0) !== front) return null;
    const a = project(WHISKER.from.r, theta, WHISKER.from.y + drop, rotation, tilt), b = project(WHISKER.to.r, theta, WHISKER.to.y + drop, rotation, tilt);
    const d = `M${a.sx.toFixed(1)} ${a.sy.toFixed(1)}Q${((a.sx + b.sx) / 2 + (b.sx - CX) * 0.08).toFixed(1)} ${(a.sy + 4).toFixed(1)} ${b.sx.toFixed(1)} ${b.sy.toFixed(1)}`;
    if (look !== 'solid') return <path key={i} d={d} className={look === 'glow' ? 'tiny-glow' : 'tiny-ghost'} />;
    return <path key={i} d={d} fill="none" strokeWidth={1.7} strokeLinecap="round" style={strokeOf(front ? mix('var(--mk-steel-light)', 80, 'var(--mk-steel)') : mix('var(--mk-steel-dark)', 70, 'var(--mk-night)'))} />;
  });

  /* ---- head ---- */
  const facets = headFacets(rotation, tilt, drop);
  const outline = headOutline(rotation, tilt, drop);
  const head = (look: 'solid' | 'ghost' | 'glow') => {
    if (look !== 'solid') return <g className={look === 'glow' ? 'tiny-glow' : 'tiny-ghost'}>{facets.filter(f => f.front).map((f, i) => <polygon key={i} points={poly(f.points)} />)}</g>;
    // The coil keeps a little tilt of its own, so it still reads as loops of thread in the side view.
    const coil = dnaCoil(rotation, Math.max(tilt, 0.2), 1 - dna, drop);
    const front = facets.filter(f => f.front);
    const back = facets.filter(f => !f.front).sort((a, b) => a.depth - b.depth);
    // Where the cut edge crosses the outline.
    let rim: [number, number] | null = null;
    if (opened) {
      const ys: number[] = [];
      for (let i = 0; i < outline.length; i++) {
        const p = outline[i], q = outline[(i + 1) % outline.length];
        if ((p.x - cutX) * (q.x - cutX) <= 0 && p.x !== q.x) ys.push(p.y + (q.y - p.y) * (cutX - p.x) / (q.x - p.x));
      }
      if (ys.length >= 2) rim = [Math.min(...ys), Math.max(...ys)];
    }
    return <g style={litStyle('head')}>
      {opened && <g>
        {back.map((f, i) => <polygon key={i} points={poly(f.points)} style={fill(innerFill(f))} />)}
        <g {...hit('dna')} style={litStyle('dna')}>
          {coil.back.map((run, i) => <path key={`b${i}`} d={line(run)} fill="none" strokeWidth={2.4} strokeLinecap="round" style={strokeOf(mix('var(--mk-rose-deep)', 62, 'var(--mk-plum)'))} />)}
          {coil.front.map((run, i) => <path key={`f${i}`} d={line(run)} fill="none" strokeWidth={2.9} strokeLinecap="round" style={strokeOf(mix('var(--mk-blossom)', 64, 'var(--mk-rose)'))} />)}
          {coil.end && dna > 0 && <path d={`M${coil.end.x.toFixed(1)} ${coil.end.y.toFixed(1)}L${CX} ${HEAD.bottom + drop}`} fill="none" strokeWidth={2.6} strokeLinecap="round" style={strokeOf(mix('var(--mk-blossom)', 64, 'var(--mk-rose)'))} />}
          {interactive && <rect x={cutX} y={HEAD.top + drop + 8} width={HEAD.r + 6} height={HEAD.bottom - HEAD.top - 16} className="tiny-hit" style={fill('transparent')} />}
        </g>
      </g>}
      <g clipPath={opened ? ref('cut') : undefined} {...hit('head')}>
        {front.map((f, i) => <polygon key={i} points={poly(f.points)} strokeWidth={0.7} strokeLinejoin="round" style={{ fill: facetFill(f), stroke: mix('var(--mk-snow)', 22, 'transparent') }} />)}
        <polygon points={poly(outline)} style={fill(ref('gloss'))} />
      </g>
      {rim && <g strokeLinecap="round">
        <path d={`M${cutX + 1.6} ${rim[0] + 3}L${cutX + 1.6} ${rim[1] - 3}`} strokeWidth={2} style={strokeOf(mix('var(--mk-night)', 50, 'transparent'))} />
        <path d={`M${cutX} ${rim[0] + 2}L${cutX} ${rim[1] - 2}`} strokeWidth={2.4} style={strokeOf(mix('var(--mk-sky-pale)', 80, 'var(--mk-sea)'))} />
      </g>}
    </g>;
  };

  /* ---- collar ---- */
  const collar = (look: 'solid' | 'ghost' | 'glow') => {
    const top = COLLAR.top + drop, plate = COLLAR.plateY + drop, bottom = COLLAR.bottom + drop;
    const ry = (r: number) => r * tilt;
    if (look !== 'solid') return <g className={look === 'glow' ? 'tiny-glow' : 'tiny-ghost'}>
      <rect x={CX - COLLAR.r} y={top} width={COLLAR.r * 2} height={bottom - top} rx={2} />
      <ellipse cx={CX} cy={plate} rx={COLLAR.plateR} ry={ry(COLLAR.plateR) + 1.6} />
      {whiskers(true, look)}{whiskers(false, look)}
    </g>;
    return <g style={litStyle('collar')} {...hit('collar')}>
      <rect x={CX - COLLAR.r} y={top - 8} width={COLLAR.r * 2} height={bottom - top + 8 + ry(COLLAR.r)} rx={3} style={fill(ref('steel'))} />
      <ellipse cx={CX} cy={plate + 1.6} rx={COLLAR.plateR} ry={ry(COLLAR.plateR) + 1.9} style={fill(mix('var(--mk-night)', 40, 'var(--mk-steel-dark)'))} />
      <ellipse cx={CX} cy={plate} rx={COLLAR.plateR} ry={ry(COLLAR.plateR) + 1.6} style={fill(ref('plate'))} />
      {interactive && <rect x={CX - 26} y={top - 2} width={52} height={bottom - top + 10} className="tiny-hit" style={fill('transparent')} />}
    </g>;
  };

  /* ---- sheath and tube ---- */
  const rings = SHEATH.rings, pitch = sheathLen / rings;
  const sheathRings = () => Array.from({ length: rings }, (_, i) => {
    const y = sheathTop + i * pitch, h = pitch * 0.84;
    const bumps: ReactNode[] = [];
    for (let k = 0; k < 6; k++) {
      const a = toRad(k * 60 + i * 14 + rotation), near = Math.sin(a);
      if (near < 0.2) continue;
      bumps.push(<ellipse key={k} cx={CX + sheathR * 0.8 * Math.cos(a)} cy={y + h * 0.55} rx={0.7 + 2.2 * near} ry={h * 0.3} style={fill(mix('var(--mk-butter)', 46, 'transparent'))} />);
    }
    return <g key={i}>
      <rect x={CX - sheathR} y={y} width={sheathR * 2} height={h} rx={Math.min(h / 2, 3)} style={fill(ref('amber'))} />
      {tilt > 0.02 && <ellipse cx={CX} cy={y + 0.6} rx={sheathR * 0.94} ry={Math.max(0.6, sheathR * tilt * 0.8)} style={fill(mix('var(--mk-butter)', 40, 'var(--mk-amber)'))} />}
      {bumps}
    </g>;
  });
  const threadD = `M${CX} ${HEAD.bottom + drop}L${CX} ${tubeBottom}${CELL_PATH}`;
  const threadPath = (clip?: string) => thread && dna > 0 ? <path d={threadD} pathLength={1} fill="none" strokeWidth={2.6} strokeLinecap="round" strokeDasharray={`${Math.min(1, dna).toFixed(3)} 2`} clipPath={clip} style={strokeOf(mix('var(--mk-blossom)', 64, 'var(--mk-rose)'))} /> : null;
  const tube = () => <g>
    <rect x={CX - TUBE_R} y={tubeTop} width={TUBE_R * 2} height={tubeBottom - tubeTop} rx={2} style={fill(ref('tube'))} />
    <rect x={CX - 1.4} y={tubeTop} width={2.8} height={tubeBottom - tubeTop - 1} style={fill(mix('var(--mk-night)', 78, 'var(--mk-graphite)'))} />
  </g>;
  const sheathPart = (look: 'solid' | 'ghost' | 'glow') => {
    if (look !== 'solid') return <g className={look === 'glow' ? 'tiny-glow' : 'tiny-ghost'}>
      <rect x={CX - sheathR} y={sheathTop} width={sheathR * 2} height={sheathLen} rx={3} />
      {Array.from({ length: rings - 1 }, (_, i) => <path key={i} d={`M${CX - sheathR} ${sheathTop + (i + 1) * pitch}h${sheathR * 2}`} />)}
    </g>;
    return <g style={litStyle('tail')} {...hit('tail')}>
      {opened && <>
        <rect x={CX - sheathR} y={sheathTop} width={sheathR * 2} height={sheathLen} rx={3} style={fill(mix('var(--mk-night)', 38, 'var(--mk-gold-deep)'))} />
        <g clipPath={ref('tubeclip')}>{tube()}</g>
        {threadPath(ref('tubeclip'))}
      </>}
      <g clipPath={opened ? ref('cut') : undefined}>{sheathRings()}</g>
      {opened && <path d={`M${cutX} ${sheathTop + 1}L${cutX} ${sheathTop + sheathLen - 1}`} strokeWidth={2} strokeLinecap="round" style={strokeOf(mix('var(--mk-butter)', 80, 'var(--mk-amber)'))} />}
      {interactive && <rect x={CX - 24} y={sheathTop} width={48} height={sheathLen} className="tiny-hit" style={fill('transparent')} />}
    </g>;
  };

  /* ---- baseplate ---- */
  const corners = Array.from({ length: 6 }, (_, i) => fibreAngle(i, 0));
  const basePart = (look: 'solid' | 'ghost' | 'glow') => {
    const top = corners.map(t => { const p = project(BASE.r, t, baseTop, rotation, tilt); return { x: p.sx, y: p.sy }; });
    const bottom = corners.map(t => { const p = project(BASE.r, t, baseBottom, rotation, tilt); return { x: p.sx, y: p.sy }; });
    const sides = corners.map((t, i) => {
      const mid = toRad(t + 30 + rotation), near = Math.sin(mid);
      const n = { x: Math.cos(mid), y: 0, z: near };
      const light = Math.max(0, n.x * LIGHT.x + n.z * LIGHT.z);
      const j = (i + 1) % 6;
      return { near, light, pts: [top[i], top[j], bottom[j], bottom[i]] };
    }).filter(f => f.near > 0);
    if (look !== 'solid') return <g className={look === 'glow' ? 'tiny-glow' : 'tiny-ghost'}>
      {tilt > 0.02 && <polygon points={poly(top)} />}
      {sides.map((f, i) => <polygon key={i} points={poly(f.pts)} />)}
    </g>;
    return <g style={litStyle('baseplate')} {...hit('baseplate')}>
      {sides.map((f, i) => <polygon key={i} points={poly(f.pts)} strokeWidth={0.6} strokeLinejoin="round" style={{ fill: f.light > 0.2 ? mix('var(--mk-steel)', 10 + f.light * 46, 'var(--mk-graphite)') : mix('var(--mk-night)', 34 - f.light * 60, 'var(--mk-graphite)'), stroke: mix('var(--mk-steel-light)', 18, 'transparent') }} />)}
      {tilt > 0.02 && <polygon points={poly(top)} strokeWidth={0.8} strokeLinejoin="round" style={{ fill: mix('var(--mk-steel-light)', 30, 'var(--mk-steel-dark)'), stroke: mix('var(--mk-steel-light)', 40, 'transparent') }} />}
      {tilt > 0.02 && <ellipse cx={CX} cy={baseTop} rx={sheathR + 3} ry={(sheathR + 3) * tilt} style={fill(mix('var(--mk-night)', 34, 'var(--mk-graphite)'))} />}
      {interactive && <rect x={CX - 36} y={baseTop - 8} width={72} height={BASE.height + 16} className="tiny-hit" style={fill('transparent')} />}
    </g>;
  };

  const show = (part: Exclude<PartId, 'fibres'>, draw: (look: 'solid' | 'ghost' | 'glow') => ReactNode) =>
    on[part] ? draw('solid') : ghost[part] ? draw(glow[part] ? 'glow' : 'ghost') : null;

  return <g className="tiny-phage" data-cut={opened || undefined}>
    <defs>
      <clipPath id={`${id}cut`}><rect x={-60} y={-60} width={cutX + 60} height={700} /></clipPath>
      <clipPath id={`${id}tubeclip`}><rect x={0} y={tubeTop} width={400} height={Math.max(0, baseTop - tubeTop)} /></clipPath>
      <linearGradient id={`${id}amber`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" style={{ stopColor: 'var(--mk-gold-light)' }} />
        <stop offset=".32" style={{ stopColor: 'var(--mk-amber)' }} />
        <stop offset=".72" style={{ stopColor: 'var(--mk-gold)' }} />
        <stop offset="1" style={{ stopColor: mix('var(--mk-gold-deep)', 80, 'var(--mk-umber)') }} />
      </linearGradient>
      <linearGradient id={`${id}steel`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" style={{ stopColor: 'var(--mk-steel-light)' }} />
        <stop offset=".45" style={{ stopColor: 'var(--mk-steel)' }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-steel-dark)' }} />
      </linearGradient>
      <linearGradient id={`${id}tube`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" style={{ stopColor: 'var(--mk-steel-light)' }} />
        <stop offset=".5" style={{ stopColor: 'var(--mk-steel-dark)' }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-graphite)' }} />
      </linearGradient>
      <radialGradient id={`${id}plate`} cx=".38" cy=".3" r=".8">
        <stop offset="0" style={{ stopColor: 'var(--mk-chalk)' }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-steel)' }} />
      </radialGradient>
      <radialGradient id={`${id}gloss`} gradientUnits="userSpaceOnUse" cx={CX - 17} cy={HEAD.top + 40 + drop} r={44}>
        <stop offset="0" style={{ stopColor: mix('var(--mk-white)', 46, 'transparent') }} />
        <stop offset=".55" style={{ stopColor: mix('var(--mk-white)', 10, 'transparent') }} />
        <stop offset="1" style={{ stopColor: mix('var(--mk-white)', 0, 'transparent') }} />
      </radialGradient>
      <filter id={`${id}lit`} x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0" stdDeviation="3.2" style={{ floodColor: 'var(--mk-sun)' }} floodOpacity=".95" />
        <feDropShadow dx="0" dy="0" stdDeviation="7" style={{ floodColor: 'var(--mk-amber)' }} floodOpacity=".55" />
      </filter>
    </defs>
    {fibreSet(false)}
    {on.collar ? <g style={litStyle('collar')}>{whiskers(false, 'solid')}</g> : null}
    {on.tail && (squeeze > 0 || thread) && <>{tube()}{threadPath()}</>}
    {show('baseplate', basePart)}
    {show('tail', sheathPart)}
    {show('collar', collar)}
    {on.collar ? <g style={litStyle('collar')}>{whiskers(true, 'solid')}</g> : null}
    {show('head', head)}
    {fibreSet(true)}
    {fibreHits()}
  </g>;
}

/** A single piece for the tray, cropped to its own box. */
const CROPS: Record<string, string> = {
  head: '146 30 108 142', collar: '150 150 100 54', tail: '168 166 64 124', tailCollar: '146 150 108 142',
  baseplate: '160 268 80 40', fibres: '78 246 244 126', fibrePair: '78 246 244 126',
};
export function PieceArt({ kind, rotation, tilt }: { kind: string; rotation: number; tilt: number }) {
  const on: PartsOn = {
    head: kind === 'head', collar: kind === 'collar' || kind === 'tailCollar', tail: kind === 'tail' || kind === 'tailCollar',
    baseplate: kind === 'baseplate', fibres: Array.from({ length: 6 }, (_, i) => kind === 'fibres' || (kind === 'fibrePair' && i % 3 === 0)),
  };
  return <svg viewBox={CROPS[kind] ?? CROPS.head} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" className="tiny-piece__art"><PhageArt rotation={rotation} tilt={tilt} on={on} /></svg>;
}

export { DNA };
