import { memo, useId, type CSSProperties } from 'react';
import {
  FRIENDS, appleState, blossomState, budState, cloudCover, cloudPaint, fallenLeaves, friendsAt, frost, leafState, lifeAt, lightAt, mixPaint, puddles, rainbow, skyAt,
  snowCap, snowDepth, sunAt, viewMix, type Friend,
} from './seasonDialRules';
import { TREE } from './seasonDialTree';
import { applePaint, leafPaint, paint, shaded, yearLook } from './seasonDialPaint';
import { CLOUDS, FRIEND_AT, PUDDLES, SCENE_H, SCENE_W, SNOWMAN_AT, TREE_AT, cloudShown } from './seasonDialToys';
import { FRIEND_PICTURES, SEASON_VIEWS, WATERING_CAN } from './seasonDialKit';

/** The little world over the dial: the Sky Gardens terrace above Horizon
 * Valley (the kit's rendered view, the same camera at each moment of the
 * year, cross-faded), with the old apple tree in its bed, the light, the
 * small life and the friends laid over it. Everything here is drawn from
 * `year` alone; `live` only says which toys are answering a touch right now.
 * Scene units are 400 by 320; the light comes from the top left. */

/** Which toys are answering a touch (the ids restart their little motions). */
export interface LiveToys {
  readonly tree?: number; readonly sun?: number; readonly birds?: number; readonly friend?: number; readonly snowman?: number; readonly knot?: number;
  /** Which cloud was touched. */
  readonly cloud?: { readonly id: number; readonly index: number };
  /** Apples that are off the twig just now (they are falling on the canvas). */
  readonly apples?: readonly number[];
  /** A reward moment: every friend who is there hops. */
  readonly cheer?: number;
}
const NOTHING: LiveToys = {};

const VIEW_STOPS = SEASON_VIEWS.map(v => v.at);
const LEAF = 'M0 0C2.6-3.4 7.6-4.1 12 0C7.6 4.1 2.6 3.4 0 0ZM1.8 0L9.6 .3L9.6-.3Z';
const PERCH_SLOPE = Math.tan((TREE.perch.angle * Math.PI) / 180);
const TREE_PLACE = `translate(${TREE_AT.x} ${TREE_AT.y}) scale(${TREE_AT.scale}) translate(${-TREE.base.x} ${-TREE.base.y})`;
/** Fallen leaves on the terrace round the tree's bed, each with its own colour. */
const FALLEN = Array.from({ length: 40 }, (_, i) => {
  const spread = ((i * 61) % 100) / 100, side = i % 2 ? 1 : -1;
  const x = TREE_AT.x - 26 + side * (10 + spread * 150) - 22 * ((i * 7) % 3), y = 264 + ((i * 29) % 50);
  return { x: Math.round(Math.min(392, Math.max(8, x))), y, a: (i * 67) % 360, tint: 3 + ((i * 43) % 25) / 10, s: 0.5 + ((i * 17) % 5) / 11, at: ((i * 31) % 40) / 40 };
});
const FROST = 'M0 0L0 46C4 38 6 30 5 22M0 30C8 26 13 19 14 10M0 16C7 15 12 10 13 4M0 0L48 0C39 4 31 6 23 5M31 0C27 8 20 13 11 14M17 0C16 7 11 12 5 13M0 0L26 26M10 10L10 22M10 10L22 10M18 18L18 27M18 18L27 18';

function Cloud({ fill, shade }: { fill: string; shade: string }) {
  return <g>
    <path d="M-34 6C-36-4-26-10-17-7C-15-19 0-23 9-14C15-21 30-18 31-6C40-5 42 6 34 8Z" style={{ fill: shade }} transform="translate(1.5 3.5)" />
    <path d="M-34 6C-36-4-26-10-17-7C-15-19 0-23 9-14C15-21 30-18 31-6C40-5 42 6 34 8Z" style={{ fill }} />
    <ellipse cx="-6" cy="-9" rx="15" ry="7" style={{ fill: 'var(--mk-white)', opacity: 0.5 }} />
  </g>;
}

function Bird({ x, y, flip, look, breast, late }: { x: number; y: number; flip?: boolean; look: number; breast: string; late?: boolean }) {
  return <g transform={`translate(${x} ${y})${flip ? ' scale(-1 1)' : ''}`}>
    <g className="sd-bird" data-late={late || undefined}>
      <path d="M-9 -2C-13 0-14 3-15 6L-7 2Z" style={{ fill: 'var(--mk-fur)' }} />
      <ellipse cx="0" cy="-5" rx="8" ry="6.6" style={{ fill: 'var(--mk-fur)' }} />
      <path d="M1 -9C6-8 8-3 6 1C3 3-1 2-2-1C-1-4-1-7 1-9Z" style={{ fill: `var(--mk-${breast})` }} />
      <path className="sd-bird__wing" d="M-6 -6C-3-9 1-8 2-5C-1-4-4-3-6-6Z" style={{ fill: 'var(--mk-fur-dark)', opacity: 0.6 }} />
      <circle cx={4 + look} cy="-11" r="4.6" style={{ fill: 'var(--mk-fur)' }} />
      <circle cx={5.6 + look} cy="-11.8" r="1.05" style={{ fill: 'var(--mk-ink)' }} />
      <circle cx={5.9 + look} cy="-12.2" r=".35" style={{ fill: 'var(--mk-white)' }} />
      <path d={`M${8.2 + look} -11.2l3 .9-3 1Z`} style={{ fill: 'var(--mk-amber)' }} />
      <path d="M-1 1.2l-.6 2.6M2 1.4l.3 2.5" style={{ stroke: 'var(--mk-umber)', strokeWidth: 0.9, strokeLinecap: 'round' }} />
    </g>
  </g>;
}

function Snowman({ id, scarf, scarfEnd }: { id: string; scarf: string; scarfEnd: string }) {
  return <g>
    <ellipse cx="6" cy="1" rx="24" ry="4" fill={`url(#${id}shadow)`} style={{ opacity: 0.3 }} />
    <circle cx="0" cy="-12" r="15" fill={`url(#${id}snowball)`} />
    <circle cx="0" cy="-34" r="11" fill={`url(#${id}snowball)`} />
    <circle cx="0" cy="-51" r="8" fill={`url(#${id}snowball)`} />
    <path d="M-9-34L-24-44M-20-41.5l-3.4 1M-21-42.5l-1-3.6M9-35L23-42M19.5-40.4l1.8 3.2M20.4-41l2.2-2.6" style={{ stroke: 'var(--mk-umber)', strokeWidth: 1.5, strokeLinecap: 'round', fill: 'none' }} />
    <path d="M-8.6-44.6C-3-41.6 3-41.6 8.6-44.6L8.8-40.6C3-38 -3-38-8.8-40.6Z" style={{ fill: `var(--mk-${scarf})` }} />
    <path d="M3.6-41.6L6.4-28.8L1.8-28.4L.6-40.8Z" style={{ fill: `var(--mk-${scarfEnd})` }} />
    <path d="M2.4-31.6l3.4-.3M2-34.4l3-.3M-5-42.4l0 2.8M-1-41.6l0 2.8" style={{ stroke: `var(--mk-${scarf})`, strokeWidth: 0.8, opacity: 0.8 }} />
    <circle cx="-2.8" cy="-53" r="1.1" style={{ fill: 'var(--mk-ink)' }} />
    <circle cx="2.8" cy="-53" r="1.1" style={{ fill: 'var(--mk-ink)' }} />
    <path d="M.2-50.6L8.4-49.2L.4-48.4Z" style={{ fill: 'var(--mk-orange)' }} />
    <circle cx="0" cy="-30" r="1.1" style={{ fill: 'var(--mk-ink)' }} />
    <circle cx="0" cy="-25" r="1.1" style={{ fill: 'var(--mk-ink)' }} />
    <circle cx="0" cy="-14" r="1.2" style={{ fill: 'var(--mk-ink)' }} />
  </g>;
}

/** The rendered views, cross-faded: the one the year is leaving drawn whole, the one it is coming to over it. */
function Views({ year }: { year: number }) {
  const mix = viewMix(VIEW_STOPS, year);
  return <div className="sd-views" aria-hidden="true">
    {SEASON_VIEWS.map((v, i) => {
      const shown = i === mix.from || (i === mix.to && mix.t > 0.004);
      return <img key={v.id} className="sd-view" data-sd-view={v.id} src={v.picture.src} alt="" draggable={false} decoding="async"
        style={{ opacity: i === mix.from ? 1 : i === mix.to ? mix.t : 0, zIndex: i === mix.to ? 2 : 1, visibility: shown ? 'visible' : 'hidden' }} />;
    })}
  </div>;
}

function SceneArt({ year, live = NOTHING, kind = 0 }: { year: number; live?: LiveToys; kind?: number }) {
  const id = useId().replace(/:/g, '');
  const sky = skyAt(year), sun = sunAt(year), light = lightAt(year), look = yearLook(kind);
  /** The snow friend is built up as winter comes and melts down (not fades) as it goes. */
  const melt = year > 0.84 ? 1 : 0;
  const snow = snowDepth(year), cap = snowCap(year), pools = puddles(year), fallen = fallenLeaves(year), life = lifeAt(year);
  const cover = cloudCover(year), cloud = paint(cloudPaint(year)), bow = rainbow(year), ice = frost(year);
  const cloudShade = paint(mixPaint(cloudPaint(year), 'steel', 0.3));
  const shadowW = 78 * light.shadowLength;
  const base = TREE.base;
  const barkLit = paint(mixPaint('fur-light', 'amber', 0.15 + 0.3 * light.warm));
  const off = live.apples ?? [];

  // The crown is leaves all the way down: sprays of leaves at every twig end
  // in two layers (a darker one behind, a sunlit one up and to the left),
  // then the single leaves, each with its own moment to turn and let go.
  const backNodes = [], litNodes = [];
  for (let i = 0; i < TREE.clumps.length; i++) {
    const c = TREE.clumps[i], st = leafState(c.seed, year);
    const k = st.size * st.on;
    if (k <= 0.02) continue;
    const s = 0.34 + 0.72 * k, tint = st.tint + (c.seed.hue - 0.5) * (st.tint < 2 ? 0.5 : 0.25), leafy = leafPaint(tint), o = Math.min(1, 3 * k);
    backNodes.push(<path key={i} d={c.spray} transform={`translate(${c.x} ${c.y}) scale(${s.toFixed(3)})`} style={{ fill: paint(mixPaint(leafy, 'shadow', 0.2 + 0.14 * c.shade)), opacity: o }} />);
    if (c.shade < 0.56) litNodes.push(<path key={i} d={c.spray} transform={`translate(${(c.x - c.r * 0.2).toFixed(1)} ${(c.y - c.r * 0.26).toFixed(1)}) rotate(${Math.round(c.seed.hue * 50 - 25)}) scale(${(s * 0.78).toFixed(3)})`} style={{ fill: paint(mixPaint(leafy, 'butter', 0.1 + 0.12 * (0.56 - c.shade))), opacity: o }} />);
  }
  const leafNodes = [];
  for (let i = 0; i < TREE.leaves.length; i++) {
    const leaf = TREE.leaves[i], st = leafState(leaf.seed, year);
    if (st.on <= 0.01 || st.size <= 0.02) continue;
    const scale = (st.size * leaf.length) / 12, tint = st.tint + (leaf.seed.hue - 0.5) * (st.tint < 2 ? 0.7 : 0.2);
    leafNodes.push(<path key={i} d={LEAF} fillRule="evenodd" transform={`translate(${leaf.x} ${(leaf.y + st.drop * 9).toFixed(1)}) rotate(${leaf.angle + st.drop * 40}) scale(${scale.toFixed(3)})`} style={{ fill: paint(shaded(leafPaint(tint), leaf.shade)), opacity: st.on }} />);
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
    if (st.size <= 0.03 || off.includes(i)) continue;
    const r = a.r * (0.35 + 0.65 * st.size);
    appleNodes.push(<g key={i} className="sd-apple" transform={`translate(${a.x} ${a.y})`} style={{ opacity: Math.min(1, st.size * 2) }}>
      <path d={`M0 ${(-r * 0.8).toFixed(1)}l.8 -3.2`} style={{ stroke: 'var(--mk-umber)', strokeWidth: 0.9, strokeLinecap: 'round' }} />
      <circle r={r.toFixed(2)} fill={`url(#${id}apple)`} style={{ color: paint(applePaint(st.red, kind)) }} />
      <circle cx={(-r * 0.32).toFixed(2)} cy={(-r * 0.34).toFixed(2)} r={(r * 0.3).toFixed(2)} style={{ fill: 'var(--mk-white)', opacity: 0.45 }} />
    </g>);
  }

  return <>
    <Views year={year} />
    <svg className="sd-scene__art" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}glow`}>
          <stop offset="0" style={{ stopColor: paint(sun.glow), stopOpacity: sun.glowAlpha }} />
          <stop offset="1" style={{ stopColor: paint(sun.glow), stopOpacity: 0 }} />
        </radialGradient>
        <radialGradient id={`${id}sun`}>
          <stop offset="0" style={{ stopColor: 'var(--mk-white)' }} />
          <stop offset=".55" style={{ stopColor: paint(mixPaint(sun.core, 'white', 0.5)) }} />
          <stop offset=".82" style={{ stopColor: paint(sun.core), stopOpacity: 0.9 }} />
          <stop offset="1" style={{ stopColor: paint(sun.core), stopOpacity: 0 }} />
        </radialGradient>
        <radialGradient id={`${id}snowball`} cx=".34" cy=".3" r=".8">
          <stop offset="0" style={{ stopColor: 'var(--mk-white)' }} />
          <stop offset=".6" style={{ stopColor: 'color-mix(in srgb, var(--mk-snow), var(--mk-snow-shade) 45%)' }} />
          <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--mk-snow-shade), var(--mk-lilac) 35%)' }} />
        </radialGradient>
        <radialGradient id={`${id}apple`} cx=".36" cy=".32" r=".8">
          <stop offset="0" style={{ stopColor: 'color-mix(in srgb, currentColor, var(--mk-white) 22%)' }} />
          <stop offset=".6" style={{ stopColor: 'currentColor' }} />
          <stop offset="1" style={{ stopColor: 'color-mix(in srgb, currentColor, var(--mk-shadow) 30%)' }} />
        </radialGradient>
        <linearGradient id={`${id}kerb`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--mk-white)' }} />
          <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--mk-chalk), var(--mk-steel-light) 55%)' }} />
        </linearGradient>
        <radialGradient id={`${id}soil`} cx=".5" cy=".4" r=".7">
          <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--mk-umber), var(--mk-wood-dark) 40%)' }} />
          <stop offset="1" style={{ stopColor: 'var(--mk-fur-dark)' }} />
        </radialGradient>
        <radialGradient id={`${id}vignette`} cx=".5" cy=".42" r=".78">
          <stop offset=".66" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0 }} />
          <stop offset="1" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.2 }} />
        </radialGradient>
        <radialGradient id={`${id}shadow`}>
          <stop offset="0" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 1 }} />
          <stop offset=".6" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.5 }} />
          <stop offset="1" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0 }} />
        </radialGradient>
        <filter id={`${id}soft`} x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation="1.6" /></filter>
        <clipPath id={`${id}above`}><rect width={SCENE_W} height="158" /></clipPath>
        <g id={`${id}bloom`}>
          <circle cx="0" cy="-2.9" r="2.6" /><circle cx="2.76" cy="-.9" r="2.6" /><circle cx="1.7" cy="2.35" r="2.6" /><circle cx="-1.7" cy="2.35" r="2.6" /><circle cx="-2.76" cy="-.9" r="2.6" />
          <circle r="1.25" style={{ fill: 'var(--mk-amber)' }} />
          <circle r=".55" cx="-.2" cy="-.2" style={{ fill: 'var(--mk-rose-deep)' }} />
        </g>
      </defs>

      <circle cx={sun.x} cy={sun.y} r={sun.glowR} fill={`url(#${id}glow)`} />
      <g className="sd-sun" key={`sun${live.sun ?? 0}`} data-live={live.sun ? true : undefined} style={{ transformOrigin: `${sun.x}px ${sun.y}px` }}>
        {live.sun !== undefined && <g className="sd-sun__rays" style={{ transformOrigin: `${sun.x}px ${sun.y}px` }}>
          {Array.from({ length: 12 }, (_, i) => <line key={i} x1={sun.x} y1={sun.y - sun.r - 5} x2={sun.x} y2={sun.y - sun.r - (i % 2 ? 11 : 16)} transform={`rotate(${i * 30} ${sun.x} ${sun.y})`} style={{ stroke: paint(mixPaint(sun.core, 'white', 0.35)), strokeWidth: 2.4, strokeLinecap: 'round' }} />)}
        </g>}
        <circle cx={sun.x} cy={sun.y} r={sun.r * 1.25} fill={`url(#${id}sun)`} style={{ opacity: 1 - 0.4 * cover * cover }} />
      </g>

      {bow > 0.01 && <g clipPath={`url(#${id}above)`} filter={`url(#${id}soft)`} style={{ opacity: bow * 0.5 }}>
        {(['red', 'orange', 'sun', 'leaf', 'water', 'violet'] as const).map((c, i) => <circle key={c} cx="176" cy="176" r={132 - i * 4.4} style={{ fill: 'none', stroke: `var(--mk-${c})`, strokeWidth: 4.6 }} />)}
      </g>}

      <g className="sd-clouds">
        {CLOUDS.map((c, i) => {
          const o = cloudShown(i, year), hit = live.cloud?.index === i ? live.cloud.id : 0;
          return o > 0.01 && <g key={i} className="sd-cloud" style={{ '--sd-drift': `${10 + i * 4}px`, '--sd-cloud-time': `${38 + i * 11}s`, opacity: o * 0.94 } as CSSProperties}>
            <g transform={`translate(${c.x} ${c.y}) scale(${c.s * (0.85 + cover * 0.3)})`} filter={`url(#${id}soft)`}>
              <g key={hit} className={hit ? 'sd-cloud__puff' : undefined}><Cloud fill={cloud} shade={cloudShade} /></g>
            </g>
          </g>;
        })}
      </g>

      {/* Pools of melt-water on the terrace floor. */
      {pools > 0.01 && PUDDLES.map((p, i) => <g key={i} style={{ opacity: pools * 0.9 }}>
        <ellipse cx={p.x} cy={p.y} rx={p.rx} ry={p.ry} style={{ fill: paint(mixPaint(mixPaint(sky.mid, 'water', 0.3), 'white', 0.25)) }} />
        <ellipse cx={p.x} cy={p.y + 0.8} rx={p.rx * 0.94} ry={p.ry * 0.82} style={{ fill: paint(mixPaint(sky.top, 'slate', 0.2)), opacity: 0.55 }} />
        <ellipse cx={p.x - p.rx * 0.28} cy={p.y - p.ry * 0.3} rx={p.rx * 0.4} ry={p.ry * 0.26} style={{ fill: 'var(--mk-white)', opacity: 0.6 }} />
      </g>)}

      {/* The tree's shadow on the terrace, thrown away from the top-left sun. */}
      <ellipse cx={TREE_AT.x + shadowW * 0.5} cy={TREE_AT.y + 9} rx={shadowW} ry={11} fill={`url(#${id}shadow)`} style={{ opacity: light.shadow * 1.1 }} />

      {life.snowman > 0.01 && <g transform={`translate(${SNOWMAN_AT.x} ${SNOWMAN_AT.y}) scale(${(0.72 * (0.75 + 0.25 * life.snowman)).toFixed(3)} ${(0.72 * (melt * (0.35 + 0.65 * life.snowman) + (1 - melt) * life.snowman)).toFixed(3)})`} style={{ opacity: Math.min(1, life.snowman * (melt ? 2.2 : 1.2)) }}>
        <g key={live.snowman ?? 0} className={live.snowman !== undefined ? 'sd-snowman sd-snowman--wobble' : 'sd-snowman'}><Snowman id={id} scarf={look.scarf} scarfEnd={look.scarfEnd} /></g>
      </g>}

      {/* The tree's bed: a low pearl kerb with the valley's teal inlay, set in the terrace floor. */}
      <g transform={`translate(${TREE_AT.x} ${TREE_AT.y + 4})`}>
        <ellipse cx="3" cy="5" rx="52" ry="12" fill={`url(#${id}shadow)`} style={{ opacity: 0.26 }} />
        <ellipse rx="46" ry="10.5" style={{ fill: 'color-mix(in srgb, var(--mk-chalk), var(--mk-steel-light) 60%)' }} transform="translate(0 3.2)" />
        <ellipse rx="46" ry="10.5" fill={`url(#${id}kerb)`} />
        <ellipse rx="42.5" ry="9.2" style={{ fill: 'none', stroke: 'var(--mk-sea)', strokeWidth: 1.5, opacity: 0.85 }} />
        <ellipse rx="38" ry="7.6" fill={`url(#${id}soil)`} />
        <ellipse rx="38" ry="7.6" style={{ fill: 'var(--mk-snow)', opacity: Math.min(1, snow * 1.3) }} />
      </g>

      {fallen > 0.01 && FALLEN.map((f, i) => f.at < fallen && <path key={i} d={LEAF} fillRule="evenodd" transform={`translate(${f.x} ${f.y}) rotate(${f.a}) scale(${f.s.toFixed(2)} ${(f.s * 0.6).toFixed(2)})`} style={{ fill: paint(shaded(leafPaint(f.tint), 0.5)), opacity: Math.min(1, (fallen - f.at) * 6) * (1 - snow) }} />)}

      <g transform={TREE_PLACE}>
        <g key={live.tree ?? 0} className={live.tree !== undefined ? 'sd-shake' : undefined} style={{ transformOrigin: `${base.x}px ${base.y}px` }}>
          <g className="sd-tree" style={{ transformOrigin: `${base.x}px ${base.y}px` }}>
            <path d={TREE.roots} style={{ fill: 'var(--mk-fur)' }} />
            {TREE.strokes.map(s => <path key={`b${s.width}`} d={s.bark} style={{ fill: 'none', stroke: 'var(--mk-fur)', strokeWidth: s.width, strokeLinecap: 'round' }} />)}
            {TREE.strokes.map(s => <path key={`s${s.width}`} d={s.shade} style={{ fill: 'none', stroke: 'color-mix(in srgb, var(--mk-umber), var(--mk-fur-dark) 40%)', strokeWidth: s.width * 0.42, strokeLinecap: 'round' }} />)}
            {TREE.strokes.map(s => <path key={`l${s.width}`} d={s.lit} style={{ fill: 'none', stroke: barkLit, strokeWidth: s.width * 0.24, strokeLinecap: 'round', opacity: 0.8 }} />)}
            <path d={TREE.grain} style={{ fill: 'none', stroke: 'var(--mk-fur-dark)', strokeWidth: 1.3, strokeLinecap: 'round', opacity: 0.38 }} />
            <ellipse cx={base.x - 12} cy={base.y - 38} rx="3.8" ry="5.2" transform={`rotate(22 ${base.x - 12} ${base.y - 38})`} style={{ fill: 'var(--mk-fur-dark)' }} />
            <path d={`M${base.x - 15} ${base.y - 42}c1.2-1.8 3.4-2 4.6-.4`} style={{ fill: 'none', stroke: 'var(--mk-fur-light)', strokeWidth: 1, strokeLinecap: 'round' }} />
            {/* Somebody lives in the knot-hole. */}
            {live.knot !== undefined && <g key={live.knot} className="sd-peek" transform={`translate(${base.x - 12} ${base.y - 38})`}>
              <circle cx="-1.5" cy="-.4" r="1.25" style={{ fill: 'var(--mk-sun)' }} /><circle cx="1.6" cy=".5" r="1.25" style={{ fill: 'var(--mk-sun)' }} />
              <circle cx="-1.5" cy="-.4" r=".5" style={{ fill: 'var(--mk-ink)' }} /><circle cx="1.6" cy=".5" r=".5" style={{ fill: 'var(--mk-ink)' }} />
            </g>}
            {cap > 0.01 && <g style={{ opacity: Math.min(1, cap * 2) }}>
              <path d={TREE.capsThick} transform="translate(0 .8)" style={{ fill: 'none', stroke: 'var(--mk-snow-shade)', strokeWidth: 4.6 * cap, strokeLinecap: 'round' }} />
              <path d={TREE.capsThick} style={{ fill: 'none', stroke: 'var(--mk-white)', strokeWidth: 4 * cap, strokeLinecap: 'round' }} />
              <path d={TREE.capsThin} transform="translate(0 .5)" style={{ fill: 'none', stroke: 'var(--mk-snow-shade)', strokeWidth: 2.4 * cap, strokeLinecap: 'round' }} />
              <path d={TREE.capsThin} style={{ fill: 'none', stroke: 'var(--mk-white)', strokeWidth: 2 * cap, strokeLinecap: 'round' }} />
            </g>}
            <g className="sd-crown">
              {backNodes}
              {litNodes}
              {budNodes}
              {blossomNodes}
              {leafNodes}
              {appleNodes}
            </g>
            {life.birds > 0.01 && <g style={{ opacity: life.birds }}>
              <g key={live.birds ?? 0} className={live.birds !== undefined ? 'sd-birds sd-birds--flutter' : 'sd-birds'} transform={`translate(${TREE.perch.x} ${TREE.perch.y}) scale(1.3)`}>
                <Bird x={-8} y={1 - 8 * PERCH_SLOPE} look={0} flip breast={look.breast} />
                <Bird x={8} y={1 + 8 * PERCH_SLOPE} look={-0.6} breast={look.breast} late />
              </g>
            </g>}
          </g>
        </g>
      </g>

      {/* The light of the season over everything: warm in autumn, cool in winter. */}
      <rect width={SCENE_W} height={SCENE_H} style={{ fill: 'var(--mk-amber)', opacity: 0.09 * light.warm }} />
      <rect width={SCENE_W} height={SCENE_H} style={{ fill: 'var(--mk-indigo)', opacity: 0.07 * light.cool }} />
      {ice > 0.01 && <g style={{ opacity: ice * 0.85 }}>
        {[[0, 0, 1, 1], [SCENE_W, 0, -1, 1], [0, SCENE_H, 1, -1], [SCENE_W, SCENE_H, -1, -1]].map(([x, y, sx, sy], i) => <path key={i} d={FROST} transform={`translate(${x} ${y}) scale(${sx * (1 + 0.2 * (i % 2))} ${sy * (1 + 0.2 * (i % 2))})`} style={{ fill: 'none', stroke: 'var(--mk-white)', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }} />)}
      </g>}
      <rect width={SCENE_W} height={SCENE_H} fill={`url(#${id}vignette)`} />
    </svg>
    <Friends year={year} live={live} />
  </>;
}

const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(2)}%`;
/** The companions: the kit's own pictures, each standing on the terrace for
 * its part of the year. A touch or a reward moment makes the one who is
 * there hop (the happy pose). */
function Friends({ year, live }: { year: number; live: LiveToys }) {
  const there = friendsAt(year);
  const glad = live.friend !== undefined || live.cheer !== undefined, beat = `${live.friend ?? 0}-${live.cheer ?? 0}`;
  const picture = (f: Friend) => f === 'ayaWinter' ? (glad ? FRIEND_PICTURES.ayaHappy : FRIEND_PICTURES.ayaWinter) : f === 'ayaSpring' ? (glad ? FRIEND_PICTURES.ayaHappy : FRIEND_PICTURES.ayaIdle)
    : f === 'chockSummer' ? (glad ? FRIEND_PICTURES.chockHappy : FRIEND_PICTURES.chockIdle) : (glad ? FRIEND_PICTURES.pepIdle : FRIEND_PICTURES.pepHappy);
  return <div className="sd-friends" aria-hidden="true">
    {there.ayaSpring > 0.01 && <img className="sd-prop" src={WATERING_CAN.src} alt="" draggable={false} decoding="async"
      style={{ insetInlineStart: pct(FRIEND_AT.ayaSpring.x - 62, SCENE_W), insetBlockStart: pct(FRIEND_AT.ayaSpring.y - 22, SCENE_H), inlineSize: pct(34, SCENE_W), opacity: there.ayaSpring }} />}
    {FRIENDS.map(f => {
      const at = FRIEND_AT[f], o = there[f];
      if (o <= 0.01) return null;
      return <span key={f} className="sd-friend" data-sd-friend={f} style={{ insetInlineStart: pct(at.x - at.w / 2, SCENE_W), insetBlockStart: pct(at.y - at.w, SCENE_H), inlineSize: pct(at.w, SCENE_W), opacity: o }}>
        <img key={glad ? beat : 'calm'} className={glad ? 'sd-friend__art sd-friend__art--glad' : 'sd-friend__art'} src={picture(f).src} alt="" draggable={false} decoding="async" style={at.flip ? { scale: '-1 1' } : undefined} />
      </span>;
    })}
  </div>;
}

/** Memoised on the year: the ambient motion is CSS and canvas, so the scene
 * only changes when the dial does or a toy answers. */
export const SeasonScene = memo(SceneArt);
