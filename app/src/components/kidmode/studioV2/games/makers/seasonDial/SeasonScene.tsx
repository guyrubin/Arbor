import { memo, useId, type CSSProperties } from 'react';
import { appleState, meadowFlowers, wrapYear, blossomState, budState, cloudCover, cloudPaint, fallenLeaves, groundAt, leafState, lifeAt, lightAt, mixPaint, puddles, skyAt, snowCap, snowDepth, sunAt, type Paint } from './seasonDialRules';
import { TREE } from './seasonDialTree';
import { leafPaint, paint, shaded } from './seasonDialPaint';

/** The little world on top of the dial: a paper-cut landscape and the old
 * apple tree. Everything here is drawn from `year` alone. Scene units are
 * 400 by 320; light comes from the top left. */
export const SCENE_W = 400, SCENE_H = 320;

/** The meadow's top edge: a knoll under the tree, a gentle roll elsewhere. */
export function groundY(x: number): number {
  return 268 - 12 * Math.exp(-(((x - 250) / 72) ** 2)) + 3.2 * Math.sin(x / 47) - 0.012 * (x - 200);
}
const ridge = (y0: number, amp: number, f: number, phase: number) => {
  let d = `M-10 ${SCENE_H}L-10 ${(y0 + amp * Math.sin(phase)).toFixed(1)}`;
  for (let x = 0; x <= SCENE_W + 10; x += 10) d += `L${x} ${(y0 + amp * Math.sin(x * f + phase) + amp * 0.4 * Math.sin(x * f * 2.3 + phase * 1.7)).toFixed(1)}`;
  return `${d}L${SCENE_W + 10} ${SCENE_H}Z`;
};
const FAR_HILL = ridge(206, 7, 0.016, 1.2);
const MID_HILL = ridge(232, 6, 0.012, 3.1);
const NEAR = (() => {
  let d = `M-10 ${SCENE_H}L-10 ${groundY(-10).toFixed(1)}`;
  for (let x = 0; x <= SCENE_W + 10; x += 8) d += `L${x} ${groundY(x).toFixed(1)}`;
  return `${d}L${SCENE_W + 10} ${SCENE_H}Z`;
})();
/** The snow blanket: the meadow line, lifted, with soft drifts. */
const SNOW = (() => {
  let d = `M-10 ${SCENE_H}L-10 ${(groundY(-10) - 2).toFixed(1)}`;
  for (let x = 0; x <= SCENE_W + 10; x += 8) d += `L${x} ${(groundY(x) - 2.5 - 2.2 * Math.max(0, Math.sin(x / 23 + 1))).toFixed(1)}`;
  return `${d}L${SCENE_W + 10} ${SCENE_H}Z`;
})();
/** The far treeline: a row of soft rounded crowns along the far hill. */
const TREELINE = (() => {
  let d = 'M-10 216';
  let x = -10, i = 0;
  while (x < SCENE_W + 10) {
    const w = 11 + ((i * 37) % 9), h = 7 + ((i * 53) % 8), y = 206 + 6 * Math.sin(x * 0.016 + 1.2);
    d += `L${x.toFixed(1)} ${(y + 2).toFixed(1)}Q${(x + w / 2).toFixed(1)} ${(y - h * 1.6).toFixed(1)} ${(x + w).toFixed(1)} ${(y + 2).toFixed(1)}`;
    x += w * 0.78; i++;
  }
  return `${d}L${SCENE_W + 10} 230L-10 230Z`;
})();
/** Grass tufts on the near meadow (spring and summer). */
const TUFTS = Array.from({ length: 26 }, (_, i) => {
  const x = 8 + ((i * 97) % 384), y = groundY(x) + 6 + ((i * 41) % 38);
  const s = 0.7 + ((i * 13) % 6) / 10;
  return `M${x} ${y}q${(-2 * s).toFixed(1)} ${(-6 * s).toFixed(1)} ${(-5 * s).toFixed(1)} ${(-8 * s).toFixed(1)}q${(4 * s).toFixed(1)} ${(2 * s).toFixed(1)} ${(5 * s).toFixed(1)} ${(6 * s).toFixed(1)}q${(1 * s).toFixed(1)} ${(-6 * s).toFixed(1)} ${(4 * s).toFixed(1)} ${(-9 * s).toFixed(1)}q${(-1 * s).toFixed(1)} ${(6 * s).toFixed(1)} ${(-1 * s).toFixed(1)} ${(9 * s).toFixed(1)}Z`;
}).join('');
/** Fallen leaves on the meadow under the tree, each with its own colour. */
const FALLEN = Array.from({ length: 34 }, (_, i) => {
  const spread = ((i * 61) % 100) / 100, side = i % 2 ? 1 : -1;
  const x = 236 + side * (8 + spread * 120) - 20 * ((i * 7) % 3), y = groundY(x) + 3 + ((i * 29) % 30);
  return { x: Math.round(x), y: Math.round(y), a: (i * 67) % 360, tint: 3 + ((i * 43) % 25) / 10, s: 0.55 + ((i * 17) % 5) / 12, at: ((i * 31) % 34) / 34 };
});
/** Meadow flowers: white and pink in spring, butter-yellow into summer. */
const FLOWERS = Array.from({ length: 22 }, (_, i) => {
  const x = 14 + ((i * 113) % 372), y = groundY(x) + 10 + ((i * 47) % 40);
  return { x, y: Math.round(y), r: 1.5 + ((i * 7) % 3) * 0.4, c: (['white', 'blossom', 'butter', 'white', 'lilac'] as const)[i % 5], at: ((i * 19) % 22) / 22 };
}).filter(f => Math.abs(f.x - 250) > 30);
const PUDDLES = [{ x: 96, rx: 30, ry: 4.6 }, { x: 318, rx: 22, ry: 3.6 }, { x: 178, rx: 14, ry: 2.6 }].map(p => ({ ...p, y: groundY(p.x) + 22 }));
const CLOUDS = [{ x: 268, y: 54, s: 1.15, d: 0 }, { x: 150, y: 34, s: 0.8, d: 1 }, { x: 352, y: 92, s: 0.7, d: 2 }, { x: 40, y: 70, s: 0.9, d: 3 }];
const PERCH_SLOPE = Math.tan((TREE.perch.angle * Math.PI) / 180);
const LEAF = 'M0 0C2.6-3.4 7.6-4.1 12 0C7.6 4.1 2.6 3.4 0 0Z';

function Cloud({ fill, shade }: { fill: string; shade: string }) {
  return <g>
    <path d="M-34 6C-36-4-26-10-17-7C-15-19 0-23 9-14C15-21 30-18 31-6C40-5 42 6 34 8Z" style={{ fill: shade }} transform="translate(2 4)" />
    <path d="M-34 6C-36-4-26-10-17-7C-15-19 0-23 9-14C15-21 30-18 31-6C40-5 42 6 34 8Z" style={{ fill }} />
    <path d="M-24-6C-20-10-15-9-13-7M-3-17C3-19 8-16 9-13" style={{ fill: 'none', stroke: 'var(--mk-white)', strokeWidth: 2.2, strokeLinecap: 'round', opacity: 0.55 }} />
  </g>;
}

function Bird({ x, y, flip, look }: { x: number; y: number; flip?: boolean; look: number }) {
  return <g transform={`translate(${x} ${y})${flip ? ' scale(-1 1)' : ''}`}>
    <g className="sd-bird">
      <path d="M-9 -2C-13 0-14 3-15 6L-7 2Z" style={{ fill: 'var(--mk-fur)' }} />
      <ellipse cx="0" cy="-5" rx="8" ry="6.6" style={{ fill: 'var(--mk-fur)' }} />
      <path d="M1 -9C6-8 8-3 6 1C3 3-1 2-2-1C-1-4-1-7 1-9Z" style={{ fill: 'var(--mk-orange)' }} />
      <path d="M-6 -6C-3-9 1-8 2-5C-1-4-4-3-6-6Z" style={{ fill: 'var(--mk-fur-dark)', opacity: 0.55 }} />
      <circle cx={4 + look} cy="-11" r="4.6" style={{ fill: 'var(--mk-fur)' }} />
      <circle cx={5.6 + look} cy="-11.8" r="1.05" style={{ fill: 'var(--mk-ink)' }} />
      <circle cx={5.9 + look} cy="-12.2" r=".35" style={{ fill: 'var(--mk-white)' }} />
      <path d={`M${8.2 + look} -11.2l3 .9-3 1Z`} style={{ fill: 'var(--mk-amber)' }} />
      <path d="M-1 1.2l-.6 2.6M2 1.4l.3 2.5" style={{ stroke: 'var(--mk-umber)', strokeWidth: 0.9, strokeLinecap: 'round' }} />
    </g>
  </g>;
}

function Squirrel() {
  return <g>
    <ellipse cx="2" cy="1.5" rx="16" ry="2.6" style={{ fill: 'var(--mk-shadow)', opacity: 0.18 }} />
    <path d="M-6 0C-20-2-24-14-19-24C-15-31-6-31-4-24C-2-18-9-17-10-12C-11-7-6-4 0-2Z" style={{ fill: 'var(--mk-rust)' }} />
    <path d="M-17-21C-15-27-8-28-6-24C-8-24-11-22-12-18C-14-17-17-18-17-21Z" style={{ fill: 'var(--mk-fur-tip)', opacity: 0.7 }} />
    <ellipse cx="3" cy="-7" rx="7" ry="8" style={{ fill: 'var(--mk-clay)' }} />
    <ellipse cx="5.2" cy="-5.2" rx="3.6" ry="5" style={{ fill: 'var(--mk-clay-pale)' }} />
    <circle cx="6" cy="-16" r="5.2" style={{ fill: 'var(--mk-clay)' }} />
    <path d="M3-20l.6-4.4 2.6 3.4Z" style={{ fill: 'var(--mk-rust)' }} />
    <circle cx="8.2" cy="-16.8" r="1" style={{ fill: 'var(--mk-ink)' }} />
    <circle cx="11" cy="-15" r=".9" style={{ fill: 'var(--mk-umber)' }} />
    <ellipse cx="9" cy="-8" rx="2.6" ry="2.3" style={{ fill: 'var(--mk-wood-dark)' }} />
    <path d="M7.4-9.8c1-.8 2.4-.8 3.2 0" style={{ stroke: 'var(--mk-umber)', strokeWidth: 0.8, fill: 'none' }} />
    <path d="M6-7.5c1.8.2 2.6-.4 3.2-1.2" style={{ stroke: 'var(--mk-rust)', strokeWidth: 1.6, strokeLinecap: 'round', fill: 'none' }} />
    <ellipse cx="0" cy="0" rx="4" ry="1.6" style={{ fill: 'var(--mk-rust)' }} />
  </g>;
}

function Snowman({ id }: { id: string }) {
  return <g>
    <ellipse cx="4" cy="1" rx="22" ry="3.4" style={{ fill: 'var(--mk-indigo)', opacity: 0.16 }} />
    <circle cx="0" cy="-12" r="15" fill={`url(#${id}snowball)`} />
    <circle cx="0" cy="-34" r="11" fill={`url(#${id}snowball)`} />
    <circle cx="0" cy="-51" r="8" fill={`url(#${id}snowball)`} />
    <path d="M-9-34L-24-44M-20-41.5l-3.4 1M-21-42.5l-1-3.6M9-35L23-42M19.5-40.4l1.8 3.2M20.4-41l2.2-2.6" style={{ stroke: 'var(--mk-umber)', strokeWidth: 1.5, strokeLinecap: 'round', fill: 'none' }} />
    <path d="M-8.6-44.6C-3-41.6 3-41.6 8.6-44.6L8.8-40.6C3-38 -3-38-8.8-40.6Z" style={{ fill: 'var(--mk-red)' }} />
    <path d="M3.6-41.6L6.4-28.8L1.8-28.4L.6-40.8Z" style={{ fill: 'var(--mk-poppy)' }} />
    <path d="M2.4-31.6l3.4-.3M2-34.4l3-.3" style={{ stroke: 'var(--mk-red)', strokeWidth: 0.8 }} />
    <circle cx="-2.8" cy="-53" r="1.1" style={{ fill: 'var(--mk-ink)' }} />
    <circle cx="2.8" cy="-53" r="1.1" style={{ fill: 'var(--mk-ink)' }} />
    <path d="M.2-50.6L8.4-49.2L.4-48.4Z" style={{ fill: 'var(--mk-orange)' }} />
    <circle cx="0" cy="-30" r="1.1" style={{ fill: 'var(--mk-ink)' }} />
    <circle cx="0" cy="-25" r="1.1" style={{ fill: 'var(--mk-ink)' }} />
    <circle cx="0" cy="-14" r="1.2" style={{ fill: 'var(--mk-ink)' }} />
  </g>;
}

function SceneArt({ year }: { year: number }) {
  const id = useId().replace(/:/g, '');
  const sky = skyAt(year), sun = sunAt(year), light = lightAt(year), ground = groundAt(year);
  const flowers = meadowFlowers(year);
  /** The snowman is built up as winter comes and melts down (not fades) as it goes. */
  const melt = wrapYear(year) > 0.84 ? 1 : 0;
  const snow = snowDepth(year), cap = snowCap(year), wet = puddles(year), fallen = fallenLeaves(year), life = lifeAt(year);
  const cover = cloudCover(year), cloud = paint(cloudPaint(year));
  const cloudShade = paint(mixPaint(cloudPaint(year), 'steel', 0.35));
  const snowy = (p: Paint, k: number) => paint(mixPaint(p, 'snow-shade', snow * k));
  const shadowW = 92 * light.shadowLength;
  const base = TREE.base;
  const barkLit = paint(mixPaint('fur-light', 'amber', 0.15 + 0.3 * light.warm));
  const leafNodes = [];
  for (let i = 0; i < TREE.leaves.length; i++) {
    const leaf = TREE.leaves[i], st = leafState(leaf.seed, year);
    if (st.on <= 0.01 || st.size <= 0.02) continue;
    const scale = (st.size * leaf.length) / 12;
    leafNodes.push(<path key={i} d={LEAF} transform={`translate(${leaf.x} ${(leaf.y + st.drop * 9).toFixed(1)}) rotate(${leaf.angle + st.drop * 40}) scale(${scale.toFixed(3)})`} style={{ fill: paint(shaded(leafPaint(st.tint), leaf.shade)), opacity: st.on }} />);
  }
  // Foliage in two paper layers: a mass (same tone, so the overlaps merge
  // into one scalloped silhouette) and a lit layer up and to the left.
  const massNodes = [], litNodes = [];
  for (let i = 0; i < TREE.clumps.length; i++) {
    const c = TREE.clumps[i], st = leafState(c.seed, year);
    const k = st.size * st.on;
    if (k <= 0.02) continue;
    const r = c.r * (0.3 + 0.7 * k), leafy = leafPaint(st.tint), o = Math.min(1, 3 * k);
    massNodes.push(<circle key={i} cx={c.x} cy={c.y} r={r.toFixed(1)} style={{ fill: paint(mixPaint(leafy, 'shadow', 0.14)), opacity: o }} />);
    if (c.shade < 0.48) litNodes.push(<circle key={i} cx={(c.x - r * 0.24).toFixed(1)} cy={(c.y - r * 0.3).toFixed(1)} r={(r * 0.7).toFixed(1)} style={{ fill: paint(mixPaint(leafy, 'butter', 0.07)), opacity: o * 0.85 }} />);
  }
  const blossomNodes = [];
  for (let i = 0; i < TREE.blossoms.length; i++) {
    const b = TREE.blossoms[i], st = blossomState(b.seed, year);
    const k = st.open * st.on;
    if (k <= 0.02) continue;
    blossomNodes.push(<use key={i} href={`#${id}bloom`} transform={`translate(${b.x} ${b.y}) rotate(${Math.round(b.seed * 72)}) scale(${(b.r * (0.35 + 0.65 * st.open) / 5).toFixed(3)})`} style={{ opacity: st.on, fill: paint(b.shade < 0.4 ? mixPaint('blossom', 'white', 0.45) : mixPaint('blossom', 'rose', b.shade * 0.4)) }} />);
  }
  const budNodes = [];
  for (let i = 0; i < TREE.buds.length; i++) {
    const b = TREE.buds[i], k = budState(b.seed, year);
    if (k <= 0.02) continue;
    budNodes.push(<ellipse key={i} cx={b.x} cy={b.y} rx={(b.r * (0.5 + 0.6 * k)).toFixed(2)} ry={(b.r * (0.7 + 0.9 * k)).toFixed(2)} style={{ fill: paint(mixPaint('rose-deep', 'leaf', 0.25 + b.seed * 0.4)), opacity: Math.min(1, k * 1.6) }} />);
  }
  const appleNodes = [];
  for (let i = 0; i < TREE.apples.length; i++) {
    const a = TREE.apples[i], st = appleState(a.seed, year);
    if (st.size <= 0.03) continue;
    const r = a.r * (0.35 + 0.65 * st.size);
    appleNodes.push(<g key={i} transform={`translate(${a.x} ${a.y})`} style={{ opacity: Math.min(1, st.size * 2) }}>
      <path d={`M0 ${(-r * 0.8).toFixed(1)}l.8 -3.2`} style={{ stroke: 'var(--mk-umber)', strokeWidth: 0.9, strokeLinecap: 'round' }} />
      <circle r={r.toFixed(2)} style={{ fill: paint(st.red < 0.5 ? mixPaint(mixPaint('spring', 'leaf', 0.3), 'amber', st.red * 1.6) : mixPaint(mixPaint(mixPaint('spring', 'leaf', 0.3), 'amber', 0.8), 'red', (st.red - 0.5) * 2)) }} />
      <circle cx={(-r * 0.32).toFixed(2)} cy={(-r * 0.34).toFixed(2)} r={(r * 0.32).toFixed(2)} style={{ fill: 'var(--mk-white)', opacity: 0.4 }} />
    </g>);
  }

  return <svg className="sd-scene__art" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: paint(sky.top) }} />
        <stop offset=".46" style={{ stopColor: paint(sky.mid) }} />
        <stop offset=".7" style={{ stopColor: paint(sky.low) }} />
      </linearGradient>
      <radialGradient id={`${id}glow`}>
        <stop offset="0" style={{ stopColor: paint(sun.glow), stopOpacity: sun.glowAlpha }} />
        <stop offset="1" style={{ stopColor: paint(sun.glow), stopOpacity: 0 }} />
      </radialGradient>
      <radialGradient id={`${id}sun`} cx=".38" cy=".36" r=".7">
        <stop offset="0" style={{ stopColor: paint(mixPaint(sun.core, 'white', 0.45)) }} />
        <stop offset="1" style={{ stopColor: paint(sun.core) }} />
      </radialGradient>
      <linearGradient id={`${id}near`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: paint(ground.near) }} />
        <stop offset="1" style={{ stopColor: paint(ground.nearShade) }} />
      </linearGradient>
      <linearGradient id={`${id}snow`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: 'var(--mk-snow)' }} />
        <stop offset=".45" style={{ stopColor: 'color-mix(in srgb, var(--mk-snow), var(--mk-snow-shade) 55%)' }} />
        <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--mk-snow-shade), var(--mk-lilac) 30%)' }} />
      </linearGradient>
      <radialGradient id={`${id}snowball`} cx=".34" cy=".3" r=".8">
        <stop offset="0" style={{ stopColor: 'var(--mk-snow)' }} />
        <stop offset=".6" style={{ stopColor: 'color-mix(in srgb, var(--mk-snow), var(--mk-snow-shade) 45%)' }} />
        <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--mk-snow-shade), var(--mk-lilac) 35%)' }} />
      </radialGradient>
      <linearGradient id={`${id}bark`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" style={{ stopColor: 'var(--mk-fur)' }} />
        <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--mk-umber), var(--mk-fur-dark) 30%)' }} />
      </linearGradient>
      <radialGradient id={`${id}vignette`} cx=".5" cy=".42" r=".75">
        <stop offset=".62" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0 }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.26 }} />
      </radialGradient>
      <radialGradient id={`${id}shadow`}>
        <stop offset="0" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 1 }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0 }} />
      </radialGradient>
      <g id={`${id}bloom`}>
        <circle cx="0" cy="-2.9" r="2.6" /><circle cx="2.76" cy="-.9" r="2.6" /><circle cx="1.7" cy="2.35" r="2.6" /><circle cx="-1.7" cy="2.35" r="2.6" /><circle cx="-2.76" cy="-.9" r="2.6" />
        <circle r="1.25" style={{ fill: 'var(--mk-amber)' }} />
        <circle r=".55" cx="-.2" cy="-.2" style={{ fill: 'var(--mk-rose-deep)' }} />
      </g>
    </defs>

    <rect width={SCENE_W} height={SCENE_H} fill={`url(#${id}sky)`} />
    <circle cx={sun.x} cy={sun.y} r={sun.glowR} fill={`url(#${id}glow)`} />
    <circle cx={sun.x} cy={sun.y} r={sun.r} fill={`url(#${id}sun)`} style={{ opacity: 1 - 0.35 * cover * cover }} />

    <g className="sd-clouds">
      {CLOUDS.map((c, i) => {
        const o = Math.min(1, Math.max(0, cover * 3.4 - i * 0.75));
        return o > 0.01 && <g key={i} className="sd-cloud" style={{ '--sd-drift': `${12 + i * 5}px`, '--sd-cloud-time': `${38 + i * 11}s`, opacity: o } as CSSProperties}>
          <g transform={`translate(${c.x} ${c.y}) scale(${c.s * (0.85 + cover * 0.3)})`}><Cloud fill={cloud} shade={cloudShade} /></g>
        </g>;
      })}
    </g>

    <path d={TREELINE} style={{ fill: snowy(ground.treeline, 0.55) }} />
    <path d={FAR_HILL} style={{ fill: snowy(ground.far, 0.85) }} />
    <path d={FAR_HILL} transform="translate(0 2)" style={{ fill: 'none', stroke: 'var(--mk-white)', strokeWidth: 1.2, opacity: 0.18 }} />
    <path d={MID_HILL} style={{ fill: snowy(mixPaint(ground.far, ground.nearShade, 0.55), 0.85) }} />
    <path d={NEAR} fill={`url(#${id}near)`} />
    <path d={TUFTS} style={{ fill: paint(mixPaint(ground.near, 'leaf', 0.45)), opacity: ground.grass * (1 - snow) }} />
    {flowers > 0.01 && FLOWERS.map((f, i) => f.at < flowers && <g key={i} transform={`translate(${f.x} ${f.y})`}>
      <circle r={f.r} style={{ fill: `var(--mk-${f.c})` }} /><circle r={f.r * 0.4} style={{ fill: 'var(--mk-amber)' }} />
    </g>)}

    {/* The tree's long shadow, thrown away from the top-left sun. */}
    <ellipse cx={base.x + shadowW * 0.42} cy={base.y + 4} rx={shadowW} ry={9} fill={`url(#${id}shadow)`} style={{ opacity: light.shadow }} />

    {wet > 0.01 && PUDDLES.map((p, i) => <g key={i} style={{ opacity: wet }}>
      <ellipse cx={p.x} cy={p.y} rx={p.rx} ry={p.ry} style={{ fill: paint(mixPaint(sky.mid, 'water', 0.35)) }} />
      <ellipse cx={p.x - p.rx * 0.25} cy={p.y - p.ry * 0.25} rx={p.rx * 0.45} ry={p.ry * 0.3} style={{ fill: 'var(--mk-white)', opacity: 0.45 }} />
    </g>)}

    {fallen > 0.01 && FALLEN.map((f, i) => f.at < fallen && <path key={i} d={LEAF} transform={`translate(${f.x} ${f.y}) rotate(${f.a}) scale(${f.s.toFixed(2)})`} style={{ fill: paint(shaded(leafPaint(f.tint), 0.55)), opacity: Math.min(1, (fallen - f.at) * 6) * (1 - snow) }} />)}

    {snow > 0.01 && <g style={{ opacity: Math.min(1, snow * 1.5) }}>
      <path d={SNOW} fill={`url(#${id}snow)`} transform={`translate(0 ${(4 * (1 - snow)).toFixed(1)})`} />
      <ellipse cx={base.x + shadowW * 0.4} cy={base.y + 2} rx={shadowW * 0.9} ry={6} style={{ fill: 'var(--mk-lilac)', opacity: 0.32 }} />
    </g>}

    {life.snowman > 0.01 && <g transform={`translate(112 ${(groundY(112) + 5).toFixed(1)}) scale(${(0.75 + 0.25 * life.snowman).toFixed(3)} ${(melt * (0.35 + 0.65 * life.snowman) + (1 - melt) * life.snowman).toFixed(3)})`} style={{ opacity: Math.min(1, life.snowman * (melt ? 2.2 : 1.2)) }}><Snowman id={id} /></g>}
    {life.squirrel > 0.01 && <g transform={`translate(176 ${(groundY(176) + 8).toFixed(1)})`} style={{ opacity: life.squirrel }}><Squirrel /></g>}

    <g className="sd-tree" style={{ transformOrigin: `${base.x}px ${base.y}px` }}>
      <ellipse cx={base.x - 2} cy={base.y + 5} rx="34" ry="5" style={{ fill: 'var(--mk-shadow)', opacity: 0.2 }} />
      <path d={TREE.roots} style={{ fill: 'var(--mk-fur)' }} />
      {TREE.strokes.map(s => <path key={`b${s.width}`} d={s.bark} style={{ fill: 'none', stroke: 'var(--mk-fur)', strokeWidth: s.width, strokeLinecap: 'round' }} />)}
      {TREE.strokes.map(s => <path key={`s${s.width}`} d={s.shade} style={{ fill: 'none', stroke: 'color-mix(in srgb, var(--mk-umber), var(--mk-fur-dark) 40%)', strokeWidth: s.width * 0.42, strokeLinecap: 'round' }} />)}
      {TREE.strokes.map(s => <path key={`l${s.width}`} d={s.lit} style={{ fill: 'none', stroke: barkLit, strokeWidth: s.width * 0.24, strokeLinecap: 'round', opacity: 0.8 }} />)}
      <path d={TREE.grain} style={{ fill: 'none', stroke: 'var(--mk-fur-dark)', strokeWidth: 1.3, strokeLinecap: 'round', opacity: 0.38 }} />
      <ellipse cx={base.x - 12} cy={base.y - 38} rx="3.6" ry="5" transform={`rotate(22 ${base.x - 12} ${base.y - 38})`} style={{ fill: 'var(--mk-fur-dark)' }} />
      <path d={`M${base.x - 15} ${base.y - 42}c1.2-1.8 3.4-2 4.6-.4`} style={{ fill: 'none', stroke: 'var(--mk-fur-light)', strokeWidth: 1, strokeLinecap: 'round' }} />
      {cap > 0.01 && <g style={{ opacity: Math.min(1, cap * 2) }}>
        <path d={TREE.capsThick} transform="translate(0 .8)" style={{ fill: 'none', stroke: 'var(--mk-snow-shade)', strokeWidth: 4.6 * cap, strokeLinecap: 'round' }} />
        <path d={TREE.capsThick} style={{ fill: 'none', stroke: 'var(--mk-snow)', strokeWidth: 4 * cap, strokeLinecap: 'round' }} />
        <path d={TREE.capsThin} transform="translate(0 .5)" style={{ fill: 'none', stroke: 'var(--mk-snow-shade)', strokeWidth: 2.4 * cap, strokeLinecap: 'round' }} />
        <path d={TREE.capsThin} style={{ fill: 'none', stroke: 'var(--mk-snow)', strokeWidth: 2 * cap, strokeLinecap: 'round' }} />
      </g>}
      <g className="sd-crown">
        {massNodes}
        {litNodes}
        {budNodes}
        {blossomNodes}
        {leafNodes}
        {appleNodes}
      </g>
      {life.birds > 0.01 && <g style={{ opacity: life.birds }}>
        <g transform={`translate(${TREE.perch.x} ${TREE.perch.y}) scale(1.25)`}><Bird x={-8} y={1 - 8 * PERCH_SLOPE} look={0} flip />
        <Bird x={8} y={1 + 8 * PERCH_SLOPE} look={-0.6} /></g>
      </g>}
    </g>

    {/* The light of the season over everything: warm in autumn, cool in winter. */}
    <rect width={SCENE_W} height={SCENE_H} style={{ fill: 'var(--mk-amber)', opacity: 0.1 * light.warm }} />
    <rect width={SCENE_W} height={SCENE_H} style={{ fill: 'var(--mk-indigo)', opacity: 0.08 * light.cool }} />
    <rect width={SCENE_W} height={SCENE_H} fill={`url(#${id}vignette)`} />
  </svg>;
}

/** Memoised on the year: the ambient motion is CSS and canvas, so the SVG
 * only changes when the dial does. */
export const SeasonScene = memo(SceneArt);

/** A little paper grain over the scene: drawn once, never re-rendered. */
export const SceneGrain = memo(function SceneGrain() {
  const id = useId().replace(/:/g, '');
  return <svg className="sd-scene__grain" viewBox="0 0 200 160" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <filter id={`${id}grain`} x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="200" height="160" filter={`url(#${id}grain)`} />
  </svg>;
});
