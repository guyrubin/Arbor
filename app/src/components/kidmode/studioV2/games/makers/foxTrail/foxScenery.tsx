import { memo, useId, type ReactElement } from 'react';
import { seeded } from './foxGrass';
import { LOGS, STONES, STONE_X, STREAM, TUNNEL, WORLD_H, WORLD_W, groundAt, surfaceAt, waterLevel } from './foxTrailRules';

/** The wood, in layered paper-cut. Every layer is drawn once and only slid
 * sideways by the camera. Fills are tone variables (`--ft-*`): the same
 * layer drawn inside `.ft-tone--dusk` is plum, rust and gold, inside
 * `.ft-tone--night` it is night blue and silver, so the mirror's ring can
 * wipe one into the other. Light comes from the top left. */

export const PARALLAX = { hills: 0.12, trees: 0.42, ferns: 0.72, trail: 1 } as const;
export const layerWidth = (f: number) => Math.ceil(WORLD_W * f + 1700);
/** The trail runs on a little past the world's end so no edge ever shows. */
export const TRAIL_W = WORLD_W + 600;
const H = WORLD_H;
const Y = (x: number) => H - groundAt(x);
const f1 = (v: number) => v.toFixed(1);
/** Where a world x shows up on a parallax layer (for a view about 900 wide). */
const onLayer = (xw: number, f: number) => xw * f + (1 - f) * 450;
const fill = (v: string) => ({ fill: `var(--ft-${v})` });
const stop = (v: string) => ({ stopColor: `var(--ft-${v})` });

/** A smooth closed silhouette through points, down to the bottom edge. */
function smoothPath(points: readonly (readonly [number, number])[], bottom = H + 4): string {
  if (points.length < 2) return '';
  let d = `M${f1(points[0][0])} ${bottom} L${f1(points[0][0])} ${f1(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f1(c1[0])} ${f1(c1[1])} ${f1(c2[0])} ${f1(c2[1])} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return `${d} L${f1(points[points.length - 1][0])} ${bottom} Z`;
}
function ridge(width: number, base: number, amp: number, seed: number, step = 90): string {
  const r = seeded(seed), pts: [number, number][] = [];
  const a = r() * 6, b = r() * 6;
  for (let x = -20; x <= width + step; x += step * (0.7 + r() * 0.6)) pts.push([x, base + amp * (Math.sin(x / 410 + a) * 0.6 + Math.sin(x / 170 + b) * 0.3 + (r() - 0.5) * 0.25)]);
  return smoothPath(pts);
}
/** A line of round treetops along a ridge (one path of arcs). */
function treeline(width: number, base: number, seed: number, size: number): string {
  const r = seeded(seed); let d = `M-20 ${H + 4} L-20 ${base}`;
  let x = -20;
  while (x < width + 40) {
    const w = size * (0.6 + r() * 0.9), h = w * (0.7 + r() * 0.6);
    const y = base + Math.sin(x / 300) * 8 - h * 0.2;
    d += ` L${f1(x)} ${f1(y + h * 0.4)} C${f1(x)} ${f1(y - h * 0.5)} ${f1(x + w)} ${f1(y - h * 0.5)} ${f1(x + w)} ${f1(y + h * 0.4)}`;
    x += w * (0.55 + r() * 0.3);
  }
  return `${d} L${f1(x)} ${H + 4} Z`;
}

/** A paper-cut leaf mass: a bumpy closed outline around an ellipse. */
function foliage(cx: number, cy: number, rx: number, ry: number, seed: number, bumps = 9): string {
  const r = seeded(seed), pts: [number, number][] = [];
  for (let i = 0; i < bumps; i++) {
    const a = (i / bumps) * Math.PI * 2 + r() * 0.3, k = 0.86 + r() * 0.22;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 0; i < bumps; i++) {
    const p = pts[i], q = pts[(i + 1) % bumps];
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    const ox = mx - cx, oy = my - cy, len = Math.hypot(ox, oy) || 1, bulge = (0.32 + r() * 0.22) * Math.hypot(q[0] - p[0], q[1] - p[1]);
    d += ` Q${f1(mx + (ox / len) * bulge)} ${f1(my + (oy / len) * bulge)} ${f1(q[0])} ${f1(q[1])}`;
  }
  return `${d} Z`;
}
/** Leaf mass with a warm rim on the side the light comes from (top left). */
function Leaves({ cx, cy, rx, ry, seed, tone = 'canopy' }: { cx: number; cy: number; rx: number; ry: number; seed: number; tone?: 'canopy' | 'canopy-deep' }) {
  const d = foliage(cx, cy, rx, ry, seed);
  return <g>
    <path d={d} transform="translate(-5 -5)" style={fill('canopy-light')} />
    <path d={d} style={fill(tone)} />
    <path d={foliage(cx + rx * 0.12, cy + ry * 0.18, rx * 0.7, ry * 0.62, seed + 7, 7)} style={fill('canopy-deep')} opacity=".55" />
  </g>;
}

/* ── sky ─────────────────────────────────────────────────────────────────── */

export const SkyLayer = memo(function SkyLayer({ tone }: { tone: 'dusk' | 'night' }) {
  const id = useId().replace(/:/g, '');
  const r = seeded(77);
  return <svg className="ft-sky" viewBox="0 0 1000 540" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={stop('sky-0')} /><stop offset=".5" style={stop('sky-1')} /><stop offset=".86" style={stop('sky-2')} />
      </linearGradient>
      <radialGradient id={`${id}g`} cx=".5" cy=".5" r=".5">
        <stop offset="0" style={{ stopColor: 'var(--ft-glow)', stopOpacity: 0.85 }} /><stop offset=".35" style={{ stopColor: 'var(--ft-glow)', stopOpacity: 0.25 }} /><stop offset="1" style={{ stopColor: 'var(--ft-glow)', stopOpacity: 0 }} />
      </radialGradient>
    </defs>
    <rect x="-400" y="-10" width="1800" height="560" style={{ fill: `url(#${id}s)` }} />
    {tone === 'dusk' ? <>
      <circle cx="430" cy="372" r="270" style={{ fill: `url(#${id}g)` }} />
      <circle cx="430" cy="380" r="44" style={{ fill: 'color-mix(in srgb, var(--mk-sun) 80%, var(--mk-butter))' }} />
      {/* a few birds heading home */}
      <path d="M560 250 q 7 -6 13 0 q 6 -6 13 0 M600 232 q 5 -4 9 0 q 4 -4 9 0 M535 226 q 4 -3 8 0 q 4 -3 8 0" style={{ fill: 'none', stroke: 'color-mix(in srgb, var(--mk-plum) 80%, var(--mk-shadow))', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
      {/* soft cloud bands catching the last light */}
      <path d="M-200 214 C 40 196, 160 222, 380 206 C 540 196, 700 214, 1200 200 L1200 214 C 900 228, 640 224, 420 230 C 220 236, 40 228, -200 234 Z" style={{ fill: 'color-mix(in srgb, var(--mk-rose) 55%, transparent)' }} />
      <path d="M-200 282 C 100 270, 300 292, 560 280 C 780 270, 980 286, 1200 278 L1200 290 C 940 300, 700 296, 500 302 C 260 308, 60 296, -200 300 Z" style={{ fill: 'color-mix(in srgb, var(--mk-amber) 45%, transparent)' }} />
      <path d="M-100 140 C 120 128, 260 146, 420 136 C 520 130, 620 140, 700 134 L700 142 C 560 152, 380 152, 220 154 C 80 156, -20 150, -100 152 Z" style={{ fill: 'color-mix(in srgb, var(--mk-rose-deep) 40%, transparent)' }} />
    </> : <>
      {Array.from({ length: 70 }, (_, i) => {
        const x = r() * 1200 - 100, y = r() * 300, s = 0.6 + r() * 1.5;
        return <circle key={i} className={i % 5 === 0 ? 'ft-star ft-star--twinkle' : 'ft-star'} style={{ animationDelay: `${(i % 7) * 0.6}s`, fill: 'var(--mk-snow)', opacity: 0.4 + r() * 0.6 }} cx={f1(x)} cy={f1(y)} r={f1(s)} />;
      })}
      <circle cx="760" cy="120" r="150" style={{ fill: `url(#${id}g)` }} />
      <circle cx="760" cy="120" r="38" style={{ fill: 'color-mix(in srgb, var(--mk-snow) 85%, var(--mk-butter))' }} />
      <circle cx="748" cy="110" r="7" style={{ fill: 'color-mix(in srgb, var(--mk-snow-shade) 70%, transparent)' }} />
      <circle cx="774" cy="132" r="5" style={{ fill: 'color-mix(in srgb, var(--mk-snow-shade) 60%, transparent)' }} />
      <circle cx="768" cy="104" r="3.5" style={{ fill: 'color-mix(in srgb, var(--mk-snow-shade) 60%, transparent)' }} />
      <path d="M-200 250 C 100 238, 300 258, 560 248 C 780 238, 980 254, 1200 246 L1200 256 C 940 266, 700 262, 500 268 C 260 272, 60 262, -200 266 Z" style={{ fill: 'color-mix(in srgb, var(--mk-steel-light) 22%, transparent)' }} />
    </>}
  </svg>;
});

/* ── far hills ───────────────────────────────────────────────────────────── */

export const HillsLayer = memo(function HillsLayer() {
  const id = useId().replace(/:/g, '');
  const w = layerWidth(PARALLAX.hills);
  return <svg className="ft-layer-art" viewBox={`0 0 ${w} ${H}`} preserveAspectRatio="none" width={w} height={H} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}h`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--ft-haze)', stopOpacity: 0 }} /><stop offset="1" style={{ stopColor: 'var(--ft-haze)', stopOpacity: 0.55 }} /></linearGradient>
    </defs>
    <path d={ridge(w, 300, 40, 3, 120)} style={fill('hill-3')} />
    <path d={treeline(w, 318, 5, 34)} style={fill('hill-3')} opacity=".8" />
    <rect x="0" y="250" width={w} height="160" style={{ fill: `url(#${id}h)` }} />
    <path d={ridge(w, 350, 30, 9, 100)} style={fill('hill-2')} />
    <path d={treeline(w, 360, 11, 26)} style={fill('hill-2')} />
    <rect x="0" y="320" width={w} height="110" style={{ fill: `url(#${id}h)` }} opacity=".7" />
    <path d={ridge(w, 392, 20, 13, 80)} style={fill('hill-1')} />
  </svg>;
});

/* ── tree trunks ─────────────────────────────────────────────────────────── */

function Birch({ x, w, base, seed }: { x: number; w: number; base: number; seed: number }) {
  const r = seeded(seed), lean = (r() - 0.5) * 18;
  const top = -40, tw = w * 0.72;
  const trunk = `M${f1(x - w / 2)} ${base + 6} C${f1(x - w / 2 + lean * 0.3)} ${base - 160} ${f1(x - tw / 2 + lean)} ${base - 300} ${f1(x - tw / 2 + lean)} ${top} L${f1(x + tw / 2 + lean)} ${top} C${f1(x + tw / 2 + lean)} ${base - 300} ${f1(x + w / 2 + lean * 0.3)} ${base - 160} ${f1(x + w / 2)} ${base + 6} Z`;
  const marks = Array.from({ length: 9 }, (_, i) => {
    const y = top + 40 + (base - top - 60) * (i / 9) + r() * 24, k = (base - y) / (base - top);
    const cx = x + lean * k, half = (w / 2) * (1 - k * 0.28), len = half * (0.6 + r() * 0.8), off = (r() - 0.6) * half;
    return `M${f1(cx + off - len / 2)} ${f1(y)} Q${f1(cx + off)} ${f1(y - 2.6 - r() * 2)} ${f1(cx + off + len / 2)} ${f1(y)} Q${f1(cx + off)} ${f1(y + 1.4)} ${f1(cx + off - len / 2)} ${f1(y)} Z`;
  }).join(' ');
  const shade = `M${f1(x + w * 0.16)} ${base + 6} C${f1(x + w * 0.2 + lean * 0.3)} ${base - 160} ${f1(x + tw * 0.14 + lean)} ${base - 300} ${f1(x + tw * 0.14 + lean)} ${top} L${f1(x + tw / 2 + lean)} ${top} C${f1(x + tw / 2 + lean)} ${base - 300} ${f1(x + w / 2 + lean * 0.3)} ${base - 160} ${f1(x + w / 2)} ${base + 6} Z`;
  const leaves = Array.from({ length: 5 }, (_, i) => ({ cx: x + lean + (r() - 0.5) * 110, cy: -50 + r() * 70 + i * 12, rr: 30 + r() * 26 }));
  return <g>
    {leaves.map((l, i) => <Leaves key={i} cx={l.cx} cy={l.cy} rx={l.rr * 1.3} ry={l.rr} seed={seed + i * 13} tone={i % 2 ? 'canopy' : 'canopy-deep'} />)}
    <path d={trunk} style={fill('birch')} />
    <path d={shade} style={fill('birch-shade')} opacity=".55" />
    <path d={marks} style={fill('bark-mark')} />
  </g>;
}
function Oak({ x, w, base, seed }: { x: number; w: number; base: number; seed: number }) {
  const r = seeded(seed), top = -40, tw = w * 0.62;
  const trunk = `M${f1(x - w * 0.95)} ${base + 8} C${f1(x - w * 0.6)} ${base - 4} ${f1(x - w / 2)} ${base - 30} ${f1(x - w / 2)} ${base - 70} C${f1(x - w / 2)} ${base - 200} ${f1(x - tw / 2)} ${base - 260} ${f1(x - tw / 2)} ${top} L${f1(x + tw / 2)} ${top} C${f1(x + tw / 2)} ${base - 260} ${f1(x + w / 2)} ${base - 200} ${f1(x + w / 2)} ${base - 70} C${f1(x + w / 2)} ${base - 30} ${f1(x + w * 0.62)} ${base - 4} ${f1(x + w)} ${base + 8} Z`;
  const shade = `M${f1(x + w * 0.12)} ${base + 8} C${f1(x + w * 0.14)} ${base - 100} ${f1(x + tw * 0.1)} ${base - 260} ${f1(x + tw * 0.1)} ${top} L${f1(x + tw / 2)} ${top} C${f1(x + tw / 2)} ${base - 260} ${f1(x + w / 2)} ${base - 200} ${f1(x + w / 2)} ${base - 70} C${f1(x + w / 2)} ${base - 30} ${f1(x + w * 0.62)} ${base - 4} ${f1(x + w)} ${base + 8} Z`;
  const side = r() < 0.5 ? -1 : 1, by = base - 170 - r() * 60;
  const branch = `M${f1(x + side * tw * 0.3)} ${f1(by + 14)} C${f1(x + side * w * 0.9)} ${f1(by - 10)} ${f1(x + side * w * 1.4)} ${f1(by - 40)} ${f1(x + side * w * 1.7)} ${f1(by - 80)} L${f1(x + side * w * 1.6)} ${f1(by - 86)} C${f1(x + side * w * 1.2)} ${f1(by - 50)} ${f1(x + side * w * 0.8)} ${f1(by - 26)} ${f1(x + side * tw * 0.3)} ${f1(by - 6)} Z`;
  const masses = Array.from({ length: 8 }, (_, i) => ({ cx: x + (r() - 0.5) * 260, cy: -70 + r() * 80 + i * 8, rr: 60 + r() * 60 }));
  const ridges = Array.from({ length: 4 }, (_, i) => {
    const ox = x - w * 0.3 + i * w * 0.2 + (r() - 0.5) * 6;
    return `M${f1(ox)} ${base - 10} C${f1(ox + 3)} ${base - 120} ${f1(ox - 4)} ${base - 220} ${f1(ox + 1)} ${top + 20}`;
  }).join(' ');
  return <g>
    {masses.map((m, i) => <Leaves key={i} cx={m.cx} cy={m.cy} rx={m.rr * 1.25} ry={m.rr * 0.85} seed={seed + i * 31} tone={i % 3 === 0 ? 'canopy' : 'canopy-deep'} />)}
    <path d={branch} style={fill('oak')} />
    <path d={trunk} style={fill('oak')} />
    <path d={shade} style={fill('oak-shade')} opacity=".6" />
    <path d={ridges} style={{ fill: 'none', stroke: 'var(--ft-oak-shade)', strokeWidth: 3, strokeLinecap: 'round', opacity: 0.45 }} />
  </g>;
}
function RoundTree({ x, size, base, seed }: { x: number; size: number; base: number; seed: number }) {
  const r = seeded(seed);
  return <g>
    <path d={`M${f1(x - 5)} ${base + 4} L${f1(x - 3)} ${f1(base - size * 1.2)} L${f1(x + 3)} ${f1(base - size * 1.2)} L${f1(x + 5)} ${base + 4} Z`} style={fill('oak')} />
    <Leaves cx={x} cy={base - size * 1.55} rx={size * 1.05} ry={size * 0.95} seed={seed} tone="canopy" />
    <Leaves cx={x + size * 0.3 + r() * 4} cy={base - size * 1.25} rx={size * 0.7} ry={size * 0.55} seed={seed + 5} tone="canopy-deep" />
  </g>;
}

export const TreesLayer = memo(function TreesLayer() {
  const f = PARALLAX.trees, w = layerWidth(f), base = 404;
  const r = seeded(41);
  const trees: ReactElement[] = [];
  const at = (xw: number) => onLayer(xw, f);
  // meadow edge: a few round trees far apart
  for (let xw = -200; xw < 1150; xw += 260 + r() * 200) trees.push(<RoundTree key={`m${xw}`} x={at(xw)} size={30 + r() * 26} base={base - 4} seed={Math.floor(xw)} />);
  trees.push(<Oak key="lone" x={at(560)} w={30} base={base} seed={560} />);
  // the birch stand
  for (let xw = 1100; xw < 2380; xw += 70 + r() * 90) trees.push(<Birch key={`b${xw}`} x={at(xw)} w={14 + r() * 12} base={base + r() * 6} seed={Math.floor(xw)} />);
  // the stream: willows lean low, mostly open
  for (let xw = 2420; xw < 2960; xw += 220 + r() * 120) trees.push(<RoundTree key={`s${xw}`} x={at(xw)} size={40 + r() * 20} base={base} seed={Math.floor(xw) + 3} />);
  // the old oaks
  for (let xw = 3000; xw < 4700; xw += 160 + r() * 140) trees.push(<Oak key={`o${xw}`} x={at(xw)} w={34 + r() * 34} base={base + r() * 8} seed={Math.floor(xw)} />);
  // the clearing: a ring of trees, open sky over the stone
  for (const xw of [4760, 4980, 5160, 6060, 6260, 6500]) trees.push(xw < 5300 ? <Oak key={`c${xw}`} x={at(xw)} w={30 + r() * 20} base={base} seed={xw} /> : <Birch key={`c${xw}`} x={at(xw)} w={16 + r() * 8} base={base} seed={xw} />);
  return <svg className="ft-layer-art" viewBox={`0 0 ${w} ${H}`} preserveAspectRatio="none" width={w} height={H} aria-hidden="true" focusable="false">
    <path d={ridge(w, base - 8, 6, 17, 70)} style={fill('hill-1')} />
    {trees}
    <path d={ridge(w, base + 10, 5, 19, 60)} style={fill('fern-deep')} />
  </svg>;
});

/* ── mid ferns, bushes, reeds ────────────────────────────────────────────── */

function frondPath(x: number, y: number, len: number, angle: number, r: () => number): string {
  // A curved spine with paired leaflets that shrink towards the tip.
  const curl = 0.5 + r() * 0.5, n = 9;
  let d = '';
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1), a = angle + curl * t * Math.sign(angle || 1) * 0.8;
    const px = x + Math.sin(a) * len * t, py = y - Math.cos(a) * len * t;
    const leaf = len * 0.2 * (1 - t * 0.75);
    for (const side of [-1, 1]) {
      const la = a + side * 1.05;
      const ex = px + Math.sin(la) * leaf, ey = py - Math.cos(la) * leaf;
      const nx = Math.cos(la) * leaf * 0.22, ny = Math.sin(la) * leaf * 0.22;
      d += `M${f1(px)} ${f1(py)} Q${f1((px + ex) / 2 + nx)} ${f1((py + ey) / 2 + ny)} ${f1(ex)} ${f1(ey)} Q${f1((px + ex) / 2 - nx)} ${f1((py + ey) / 2 - ny)} ${f1(px)} ${f1(py)} Z `;
    }
  }
  const tip = angle + curl * 0.8 * Math.sign(angle || 1);
  d += `M${f1(x - 1.4)} ${f1(y)} Q${f1(x + Math.sin(angle) * len * 0.5)} ${f1(y - Math.cos(angle) * len * 0.5)} ${f1(x + Math.sin(tip) * len)} ${f1(y - Math.cos(tip) * len)} Q${f1(x + Math.sin(angle) * len * 0.5 + 2)} ${f1(y - Math.cos(angle) * len * 0.5)} ${f1(x + 1.4)} ${f1(y)} Z`;
  return d;
}
function Fern({ x, y, size, seed }: { x: number; y: number; size: number; seed: number }) {
  const r = seeded(seed), count = 4 + Math.floor(r() * 3);
  const back: string[] = [], front: string[] = [];
  for (let i = 0; i < count; i++) {
    const a = -1.15 + (2.3 * i) / (count - 1) + (r() - 0.5) * 0.25;
    (i % 2 ? back : front).push(frondPath(x, y, size * (0.75 + r() * 0.4), a, r));
  }
  return <g><path d={back.join(' ')} style={fill('fern-deep')} /><path d={front.join(' ')} style={fill('fern')} /></g>;
}
function Bush({ x, y, size, seed }: { x: number; y: number; size: number; seed: number }) {
  const r = seeded(seed);
  const d = foliage(x, y - size * 0.45, size * 1.1, size * 0.62, seed, 8);
  return <g>
    <path d={d} transform="translate(-4 -4)" style={fill('fern-light')} />
    <path d={d} style={fill('fern-deep')} />
    <path d={foliage(x - size * 0.2, y - size * 0.6, size * 0.6, size * 0.34, seed + 3, 6)} style={fill('fern')} />
    {r() < 0.5 && [0, 1, 2].map(i => <circle key={i} cx={f1(x - size * 0.5 + i * size * 0.45 + r() * 6)} cy={f1(y - size * (0.5 + r() * 0.3))} r={2.6} style={fill('berry')} />)}
  </g>;
}
function Reeds({ x, y, seed }: { x: number; y: number; seed: number }) {
  const r = seeded(seed);
  let stems = '', heads = '';
  for (let i = 0; i < 7; i++) {
    const sx = x + (i - 3) * 6 + (r() - 0.5) * 4, h = 60 + r() * 50, lean = (r() - 0.5) * 16;
    stems += `M${f1(sx - 1.4)} ${y} Q${f1(sx + lean * 0.4)} ${f1(y - h * 0.5)} ${f1(sx + lean)} ${f1(y - h)} L${f1(sx + lean + 1.2)} ${f1(y - h)} Q${f1(sx + lean * 0.4 + 1.6)} ${f1(y - h * 0.5)} ${f1(sx + 1.4)} ${y} Z `;
    if (i % 2 === 0) heads += `M${f1(sx + lean * 0.9 - 3)} ${f1(y - h * 0.9)} a3 9 ${f1(lean)} 1 0 6 0 a3 9 ${f1(lean)} 1 0 -6 0 Z `;
  }
  return <g><path d={stems} style={fill('fern-deep')} /><path d={heads} style={fill('log')} /></g>;
}
function Mushrooms({ x, y, seed }: { x: number; y: number; seed: number }) {
  const r = seeded(seed);
  return <g>{Array.from({ length: 3 }, (_, i) => {
    const mx = x + i * 11 + r() * 4, h = 8 + r() * 10, cap = 7 + r() * 6;
    return <g key={i}>
      <path d={`M${f1(mx - 2)} ${y} L${f1(mx - 1.6)} ${f1(y - h)} L${f1(mx + 1.6)} ${f1(y - h)} L${f1(mx + 2)} ${y} Z`} style={fill('birch')} />
      <path d={`M${f1(mx - cap)} ${f1(y - h + 1)} Q${f1(mx)} ${f1(y - h - cap * 1.3)} ${f1(mx + cap)} ${f1(y - h + 1)} Z`} style={fill('cap')} />
    </g>;
  })}</g>;
}

export const FernsLayer = memo(function FernsLayer() {
  const f = PARALLAX.ferns, w = layerWidth(f), base = 446;
  const r = seeded(91);
  const at = (xw: number) => onLayer(xw, f);
  const items: ReactElement[] = [];
  let k = 0;
  for (let xw = -300; xw < WORLD_W + 900; xw += 60 + r() * 90) {
    const x = at(xw), roll = r(), key = k++;
    if (xw > 2330 && xw < 2990) { if (roll < 0.6) items.push(<Reeds key={key} x={x} y={base - 4} seed={key} />); continue; }
    if (xw < 1100) items.push(roll < 0.55 ? <Bush key={key} x={x} y={base} size={30 + r() * 26} seed={key} /> : <Fern key={key} x={x} y={base} size={44 + r() * 20} seed={key} />);
    else if (xw < 2330) items.push(roll < 0.75 ? <Fern key={key} x={x} y={base} size={50 + r() * 30} seed={key} /> : <Bush key={key} x={x} y={base} size={28 + r() * 20} seed={key} />);
    else if (xw < 4700) items.push(roll < 0.6 ? <Fern key={key} x={x} y={base} size={64 + r() * 34} seed={key} /> : roll < 0.8 ? <Mushrooms key={key} x={x} y={base - 26} seed={key} /> : <Bush key={key} x={x} y={base} size={34 + r() * 20} seed={key} />);
    else items.push(roll < 0.5 ? <Bush key={key} x={x} y={base} size={22 + r() * 18} seed={key} /> : <Fern key={key} x={x} y={base} size={36 + r() * 20} seed={key} />);
  }
  return <svg className="ft-layer-art" viewBox={`0 0 ${w} ${H}`} preserveAspectRatio="none" width={w} height={H} aria-hidden="true" focusable="false">
    <path d={ridge(w, base - 26, 8, 23, 60)} style={fill('fern-deep')} />
    {items}
    <path d={ridge(w, base - 8, 5, 29, 50)} style={fill('soil-deep')} />
  </svg>;
});

/* ── the trail ───────────────────────────────────────────────────────────── */

function trailPath(offset: number): string {
  const pts: [number, number][] = [];
  for (let x = -10; x <= TRAIL_W + 10; x += 24) pts.push([x, Y(x) + offset]);
  return smoothPath(pts);
}
function Log({ x, r }: { x: number; r: number }) {
  const g = Y(x), cy = g - r;
  return <g>
    <ellipse cx={x + 6} cy={g + 3} rx={r * 1.5} ry={6} style={{ fill: 'color-mix(in srgb, var(--ft-soil-deep) 70%, transparent)' }} />
    <circle cx={x} cy={cy} r={r} style={fill('log')} />
    <circle cx={x - 1.5} cy={cy - 1} r={r - 4.5} style={fill('log-end')} />
    <circle cx={x - 1.5} cy={cy - 1} r={r * 0.62} style={{ fill: 'none', stroke: 'var(--ft-log-ring)', strokeWidth: 1.6 }} />
    <circle cx={x - 1.5} cy={cy - 1} r={r * 0.32} style={{ fill: 'none', stroke: 'var(--ft-log-ring)', strokeWidth: 1.4 }} />
    <path d={`M${x - r * 0.9} ${cy - r * 0.45} C${x - r * 0.6} ${cy - r * 1.1} ${x + r * 0.5} ${cy - r * 1.15} ${x + r * 0.85} ${cy - r * 0.5} C${x + r * 0.4} ${cy - r * 0.8} ${x - r * 0.4} ${cy - r * 0.8} ${x - r * 0.9} ${cy - r * 0.45} Z`} style={fill('moss')} />
    <path d={`M${x - r * 0.8} ${cy - r * 0.6} C${x - r * 0.5} ${cy - r * 1.02} ${x} ${cy - r * 1.06} ${x + r * 0.3} ${cy - r * 0.98}`} style={{ fill: 'none', stroke: 'var(--ft-rim)', strokeWidth: 2, strokeLinecap: 'round' }} />
  </g>;
}
function Stone({ x, w, top }: { x: number; w: number; top: number }) {
  const ty = H - (groundAt(STREAM.from) + top), by = Y(x) + 8, half = w / 2;
  return <g>
    <path d={`M${x - half - 4} ${by} C${x - half - 6} ${ty + 10} ${x - half + 6} ${ty} ${x} ${ty - 1} C${x + half - 6} ${ty} ${x + half + 6} ${ty + 10} ${x + half + 4} ${by} Z`} style={fill('stone')} />
    <path d={`M${x + half * 0.1} ${by} C${x + half * 0.4} ${ty + 16} ${x + half} ${ty + 12} ${x + half + 4} ${by} Z`} style={fill('stone-deep')} opacity=".7" />
    <path d={`M${x - half + 2} ${ty + 8} C${x - half + 8} ${ty + 1} ${x - 6} ${ty - 1} ${x + 6} ${ty} C${x - 4} ${ty + 4} ${x - half + 10} ${ty + 8} ${x - half + 2} ${ty + 8} Z`} style={fill('stone-light')} />
    <path d={`M${x - half * 0.7} ${ty + 3} C${x - half * 0.3} ${ty - 4} ${x + half * 0.4} ${ty - 4} ${x + half * 0.75} ${ty + 4} C${x + half * 0.3} ${ty + 2} ${x - half * 0.2} ${ty + 2} ${x - half * 0.7} ${ty + 3} Z`} style={fill('moss')} />
  </g>;
}
export const TrailLayer = memo(function TrailLayer() {
  const id = useId().replace(/:/g, '');
  const r = seeded(131);
  const water = H - waterLevel();
  const waterPts: string[] = [`M${STREAM.from + 4} ${water}`];
  for (let x = STREAM.from + 4; x <= STREAM.to - 4; x += 12) waterPts.push(`L${x} ${Math.max(water, Y(x) - 1)}`);
  const pebbles = Array.from({ length: 220 }, () => { const x = r() * WORLD_W; return { x, y: Y(x) + 6 + r() * 60, rx: 2 + r() * 5, light: r() < 0.5 }; }).filter(p => p.x < STREAM.from - 10 || p.x > STREAM.to + 10);
  const tufts = Array.from({ length: 160 }, () => r() * WORLD_W).filter(x => x < STREAM.from - 20 || x > STREAM.to + 20);
  const roots = Array.from({ length: 14 }, () => 3000 + r() * 1600);
  const oakY = Y(TUNNEL.from);
  return <svg className="ft-layer-art" viewBox={`0 0 ${TRAIL_W} ${H}`} preserveAspectRatio="none" width={TRAIL_W} height={H} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}soil`} x1="0" y1="0" x2="0" y2="1"><stop offset="0.72" style={stop('soil')} /><stop offset="1" style={stop('soil-deep')} /></linearGradient>
      <linearGradient id={`${id}water`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop('water-light')} /><stop offset=".22" style={stop('water')} /><stop offset="1" style={stop('water-deep')} /></linearGradient>
      <radialGradient id={`${id}hollow`} cx=".5" cy=".55" r=".6"><stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--ft-glow) 30%, var(--ft-oak-shade))' }} /><stop offset="1" style={stop('oak-shade')} /></radialGradient>
    </defs>
    {/* the hollow oak's inside wall, behind the fox */}
    <path d={`M${TUNNEL.from - 40} ${oakY + 4} L${TUNNEL.from - 40} ${oakY - 96} C${TUNNEL.from + 40} ${oakY - 122} ${TUNNEL.to - 40} ${oakY - 122} ${TUNNEL.to + 40} ${oakY - 96} L${TUNNEL.to + 40} ${oakY + 4} Z`} style={{ fill: `url(#${id}hollow)` }} />
    <path d={trailPath(0)} style={{ fill: `url(#${id}soil)` }} />
    {/* the trail: a worn strip with a lit edge */}
    <path d={(() => { let d = ''; for (let x = -10; x <= TRAIL_W + 10; x += 24) d += `${d ? 'L' : 'M'}${x} ${f1(Y(x) + 22)} `; for (let x = TRAIL_W + 10; x >= -10; x -= 24) d += `L${x} ${f1(Y(x) - 1)} `; return `${d}Z`; })()} style={fill('path')} />
    <path d={(() => { let d = ''; for (let x = -10; x <= TRAIL_W + 10; x += 24) d += `${d ? 'L' : 'M'}${x} ${f1(Y(x) + 3)} `; for (let x = TRAIL_W + 10; x >= -10; x -= 24) d += `L${x} ${f1(Y(x) - 1.5)} `; return `${d}Z`; })()} style={fill('path-light')} />
    {pebbles.map((p, i) => <ellipse key={i} cx={f1(p.x)} cy={f1(p.y)} rx={f1(p.rx)} ry={f1(p.rx * 0.6)} style={fill(p.light ? 'path-light' : 'soil-deep')} opacity={p.light ? 0.6 : 0.5} />)}
    {roots.map((x, i) => <path key={`r${i}`} d={`M${f1(x)} ${f1(Y(x) + 4)} C${f1(x + 20)} ${f1(Y(x) + 18)} ${f1(x + 50)} ${f1(Y(x) + 16)} ${f1(x + 80)} ${f1(Y(x) + 34)}`} style={{ fill: 'none', stroke: 'var(--ft-oak)', strokeWidth: 5, strokeLinecap: 'round', opacity: 0.8 }} />)}
    {tufts.map((x, i) => <path key={`t${i}`} d={`M${f1(x - 9)} ${f1(Y(x) + 18)} C${f1(x - 6)} ${f1(Y(x) + 8)} ${f1(x + 6)} ${f1(Y(x) + 8)} ${f1(x + 9)} ${f1(Y(x) + 18)} Z`} style={fill('moss')} opacity=".8" />)}
    {/* the stream */}
    <path d={`${waterPts.join(' ')} L${STREAM.to - 4} ${water} Z`} style={{ fill: `url(#${id}water)` }} />
    {Array.from({ length: 9 }, (_, i) => { const x = STREAM.from + 30 + i * 48 + r() * 20; return <path key={`w${i}`} className="ft-ripple" style={{ fill: 'none', stroke: 'var(--ft-water-light)', strokeWidth: 1.6, strokeLinecap: 'round', opacity: 0.7, animationDelay: `${i * 0.4}s` }} d={`M${f1(x)} ${f1(water + 4 + (i % 3) * 3)} l${f1(14 + r() * 14)} 0`} />; })}
    {STONES.map(s => <Stone key={s.x} {...s} />)}
    {LOGS.map(l => <Log key={l.x} {...l} />)}
  </svg>;
});

/* ── in front of the fox: the hollow oak's near shell ────────────────────── */

export const OakFront = memo(function OakFront() {
  const id = useId().replace(/:/g, '');
  const a = TUNNEL.from, b = TUNNEL.to, g = Y(a), top = g - 116;
  const split = { from: a + 78, to: b - 76 };
  const shell = `M${a - 30} ${g + 6} L${a - 30} ${top + 24} C${a - 28} ${top + 4} ${a - 10} ${top - 2} ${a + 20} ${top} C${a + 90} ${top - 6} ${b - 90} ${top - 6} ${b - 20} ${top} C${b + 10} ${top - 2} ${b + 28} ${top + 4} ${b + 30} ${top + 24} L${b + 30} ${g + 6} Z`;
  const hole = `M${split.from} ${g - 2} C${split.from - 6} ${g - 40} ${split.from + 4} ${top + 34} ${split.from + 22} ${top + 26} L${split.from + 34} ${top + 36} L${split.from + 50} ${top + 22} L${split.from + 64} ${top + 34} L${split.to - 20} ${top + 26} C${split.to + 4} ${top + 32} ${split.to + 8} ${g - 40} ${split.to} ${g - 2} Z`;
  const grain = Array.from({ length: 6 }, (_, i) => `M${a - 16} ${top + 22 + i * 15} C${a + 60} ${top + 18 + i * 15} ${b - 60} ${top + 26 + i * 15} ${b + 16} ${top + 20 + i * 15}`).join(' ');
  return <svg className="ft-layer-art" viewBox={`0 0 ${TRAIL_W} ${H}`} preserveAspectRatio="none" width={TRAIL_W} height={H} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}bark`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop('log-light')} /><stop offset=".35" style={stop('log')} /><stop offset="1" style={stop('oak-shade')} /></linearGradient>
      <mask id={`${id}cut`}>
        <rect x={a - 40} y={top - 20} width={b - a + 80} height={160} style={{ fill: 'var(--mk-white)' }} />
        <path d={hole} style={{ fill: 'var(--mk-shadow)' }} />
        <ellipse cx={a - 22} cy={g - 44} rx={14} ry={46} style={{ fill: 'var(--mk-shadow)' }} />
        <ellipse cx={b + 22} cy={g - 44} rx={14} ry={46} style={{ fill: 'var(--mk-shadow)' }} />
      </mask>
    </defs>
    <ellipse cx={(a + b) / 2} cy={g + 4} rx={(b - a) / 2 + 50} ry={9} style={{ fill: 'color-mix(in srgb, var(--ft-soil-deep) 70%, transparent)' }} />
    <g mask={`url(#${id}cut)`}>
      <path d={shell} style={{ fill: `url(#${id}bark)` }} />
      <path d={grain} style={{ fill: 'none', stroke: 'var(--ft-oak-shade)', strokeWidth: 2.4, strokeLinecap: 'round', opacity: 0.45 }} />
      <path d={`M${a - 10} ${top + 6} C${a + 80} ${top - 2} ${b - 80} ${top - 2} ${b + 10} ${top + 6}`} style={{ fill: 'none', stroke: 'var(--ft-rim)', strokeWidth: 3, strokeLinecap: 'round' }} />
      {/* moss along the top, a bracket fungus, ivy */}
      <path d={`M${a + 4} ${top + 4} C${a + 40} ${top - 14} ${a + 120} ${top - 12} ${a + 170} ${top} C${a + 120} ${top + 6} ${a + 40} ${top + 10} ${a + 4} ${top + 4} Z`} style={fill('moss')} />
      <path d={`M${b - 150} ${top + 2} C${b - 110} ${top - 12} ${b - 40} ${top - 10} ${b - 6} ${top + 4} C${b - 50} ${top + 8} ${b - 110} ${top + 9} ${b - 150} ${top + 2} Z`} style={fill('moss-light')} />
      <path d={`M${b - 50} ${g - 56} C${b - 50} ${g - 66} ${b - 20} ${g - 68} ${b - 14} ${g - 58} Z M${b - 46} ${g - 44} C${b - 46} ${g - 54} ${b - 20} ${g - 55} ${b - 16} ${g - 46} Z`} style={fill('cap')} />
    </g>
    {/* the rims of the two mouths: end grain in a ring */}
    {[a - 22, b + 22].map(cx => <g key={cx}>
      <ellipse cx={cx} cy={g - 46} rx={21} ry={55} style={{ fill: 'none', stroke: 'var(--ft-log)', strokeWidth: 5 }} />
      <ellipse cx={cx} cy={g - 45} rx={17} ry={49} style={{ fill: 'none', stroke: 'var(--ft-log-end)', strokeWidth: 7 }} />
      <ellipse cx={cx} cy={g - 45} rx={13} ry={44} style={{ fill: 'none', stroke: 'var(--ft-log-ring)', strokeWidth: 1.4 }} />
    </g>)}
    <path d={hole} style={{ fill: 'none', stroke: 'var(--ft-log-end)', strokeWidth: 4, strokeLinejoin: 'round' }} />
  </svg>;
});

/* ── the moon-mirror stone ───────────────────────────────────────────────── */

export function MirrorStone({ awake, near }: { awake: boolean; near: boolean }) {
  const id = useId().replace(/:/g, '');
  const x = STONE_X, g = H - surfaceAt(x), my = g - 150;
  return <g className="ft-mirror" data-awake={awake} data-near={near}>
    <defs>
      <radialGradient id={`${id}stone`} cx=".3" cy=".2" r="1"><stop offset="0" style={stop('stone-light')} /><stop offset=".45" style={stop('stone')} /><stop offset="1" style={stop('stone-deep')} /></radialGradient>
      <radialGradient id={`${id}dull`} cx=".38" cy=".32" r=".8"><stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--mk-steel) 60%, var(--mk-plum))' }} /><stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--mk-slate) 70%, var(--mk-plum))' }} /></radialGradient>
      <radialGradient id={`${id}bright`} cx=".42" cy=".38" r=".75"><stop offset="0" style={{ stopColor: 'var(--mk-white)' }} /><stop offset=".55" style={{ stopColor: 'color-mix(in srgb, var(--mk-snow) 80%, var(--mk-sky))' }} /><stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--mk-steel-light) 70%, var(--mk-bluebell))' }} /></radialGradient>
      <radialGradient id={`${id}halo`}><stop offset="0" style={{ stopColor: 'var(--mk-snow)', stopOpacity: 0.85 }} /><stop offset=".4" style={{ stopColor: 'var(--mk-sky-pale)', stopOpacity: 0.3 }} /><stop offset="1" style={{ stopColor: 'var(--mk-sky-pale)', stopOpacity: 0 }} /></radialGradient>
      <radialGradient id={`${id}range`}><stop offset=".6" style={{ stopColor: 'var(--mk-butter)', stopOpacity: 0 }} /><stop offset=".92" style={{ stopColor: 'var(--mk-butter)', stopOpacity: 0.5 }} /><stop offset="1" style={{ stopColor: 'var(--mk-butter)', stopOpacity: 0 }} /></radialGradient>
    </defs>
    <ellipse className="ft-mirror__range" cx={x} cy={g + 6} rx={150} ry={20} style={{ fill: `url(#${id}range)` }} />
    <ellipse cx={x + 14} cy={g + 4} rx={78} ry={10} style={{ fill: 'color-mix(in srgb, var(--ft-soil-deep) 75%, transparent)' }} />
    {/* two small leaning stones keep it company */}
    <path d={`M${x - 120} ${g + 4} C${x - 124} ${g - 30} ${x - 110} ${g - 52} ${x - 96} ${g - 50} C${x - 84} ${g - 46} ${x - 80} ${g - 20} ${x - 82} ${g + 4} Z`} style={{ fill: `url(#${id}stone)` }} />
    <path d={`M${x + 96} ${g + 4} C${x + 94} ${g - 22} ${x + 104} ${g - 38} ${x + 116} ${g - 36} C${x + 126} ${g - 32} ${x + 128} ${g - 14} ${x + 126} ${g + 4} Z`} style={{ fill: `url(#${id}stone)` }} />
    {/* the standing stone */}
    <path d={`M${x - 58} ${g + 6} C${x - 64} ${g - 80} ${x - 56} ${g - 200} ${x - 20} ${g - 228} C${x + 6} ${g - 246} ${x + 40} ${g - 230} ${x + 52} ${g - 196} C${x + 66} ${g - 150} ${x + 64} ${g - 60} ${x + 60} ${g + 6} Z`} style={{ fill: `url(#${id}stone)` }} />
    <path d={`M${x + 20} ${g + 6} C${x + 40} ${g - 70} ${x + 46} ${g - 160} ${x + 34} ${g - 218} C${x + 48} ${g - 210} ${x + 54} ${g - 190} ${x + 58} ${g - 160} C${x + 66} ${g - 100} ${x + 64} ${g - 40} ${x + 60} ${g + 6} Z`} style={fill('stone-deep')} opacity=".5" />
    <path d={`M${x - 36} ${g - 214} C${x - 16} ${g - 250} ${x + 30} ${g - 248} ${x + 46} ${g - 208} C${x + 30} ${g - 220} ${x + 10} ${g - 222} ${x - 4} ${g - 214} C${x - 10} ${g - 196} ${x - 24} ${g - 190} ${x - 30} ${g - 176} C${x - 36} ${g - 190} ${x - 40} ${g - 202} ${x - 36} ${g - 214} Z`} style={fill('moss')} />
    <path d={`M${x - 58} ${g - 30} C${x - 50} ${g - 44} ${x - 30} ${g - 40} ${x - 20} ${g - 26} C${x - 10} ${g - 12} ${x - 30} ${g + 6} ${x - 58} ${g + 6} Z`} style={fill('moss')} />
    {[[-30, -110, 4], [24, -60, 3], [-12, -40, 2.5], [30, -184, 3.5]].map(([dx, dy, rr], i) => <circle key={i} cx={x + dx} cy={g + dy} r={rr} style={fill('moss-light')} opacity=".7" />)}
    {/* the mirror */}
    <circle className="ft-mirror__halo" cx={x} cy={my} r={130} style={{ fill: `url(#${id}halo)` }} />
    <circle cx={x} cy={my} r={37} style={fill('stone-light')} />
    <circle cx={x + 1.5} cy={my + 2} r={31} style={fill('stone-deep')} />
    <circle cx={x} cy={my} r={30} style={{ fill: `url(#${id}dull)` }} />
    <circle className="ft-mirror__face" cx={x} cy={my} r={30} style={{ fill: `url(#${id}bright)` }} />
    <path className="ft-mirror__shine" d={`M${x - 18} ${my - 8} C${x - 14} ${my - 20} ${x - 4} ${my - 24} ${x + 6} ${my - 24}`} style={{ fill: 'none', stroke: 'color-mix(in srgb, var(--mk-white) 70%, transparent)', strokeWidth: 4, strokeLinecap: 'round' }} />
    {Array.from({ length: 12 }, (_, i) => { const ang = (i / 12) * Math.PI * 2; return <path key={i} className="ft-mirror__ray" d={`M${f1(x + Math.cos(ang) * 46)} ${f1(my + Math.sin(ang) * 46)} L${f1(x + Math.cos(ang) * (i % 2 ? 66 : 82))} ${f1(my + Math.sin(ang) * (i % 2 ? 66 : 82))}`} style={{ fill: 'none', stroke: 'var(--mk-snow)', strokeWidth: 3, strokeLinecap: 'round' }} />; })}
  </g>;
}

/* ── a lantern-seed ──────────────────────────────────────────────────────── */

/** A pale, papery, ribbed pod with a small warm light inside. */
export function LanternSeed({ hidden = false }: { hidden?: boolean }) {
  const id = useId().replace(/:/g, '');
  return <g className="ft-seed-art" data-hidden={hidden}>
    <defs>
      <radialGradient id={`${id}glow`}><stop offset="0" style={{ stopColor: 'var(--mk-butter)', stopOpacity: 0.95 }} /><stop offset=".3" style={{ stopColor: 'var(--mk-sun)', stopOpacity: 0.45 }} /><stop offset="1" style={{ stopColor: 'var(--mk-amber)', stopOpacity: 0 }} /></radialGradient>
      <radialGradient id={`${id}pod`} cx=".38" cy=".3" r=".85"><stop offset="0" style={{ stopColor: 'var(--mk-white)' }} /><stop offset=".5" style={{ stopColor: 'var(--mk-butter)' }} /><stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--mk-amber) 70%, var(--mk-sand))' }} /></radialGradient>
    </defs>
    <circle className="ft-seed-art__glow" cy={-14} r={hidden ? 30 : 38} style={{ fill: `url(#${id}glow)` }} />
    {!hidden && <>
      <path d="M0 -30 C 10 -28, 15 -18, 13 -10 C 11 -3, 5 0, 0 0 C -5 0, -11 -3, -13 -10 C -15 -18, -10 -28, 0 -30 Z" style={{ fill: `url(#${id}pod)` }} />
      <path d="M0 -29 C 4 -20, 4 -8, 0 0 M0 -29 C -4 -20, -4 -8, 0 0 M -7 -26 C -10 -16, -8 -6, -3 -1 M 7 -26 C 10 -16, 8 -6, 3 -1" style={{ fill: 'none', stroke: 'color-mix(in srgb, var(--mk-amber) 55%, transparent)', strokeWidth: 1.2 }} />
      <path d="M -2 -30 C -2 -34, 2 -36, 5 -37" style={{ fill: 'none', stroke: 'var(--mk-moss)', strokeWidth: 2, strokeLinecap: 'round' }} />
      <ellipse cx={-4.5} cy={-20} rx={2.6} ry={5} style={{ fill: 'color-mix(in srgb, var(--mk-white) 70%, transparent)' }} />
    </>}
  </g>;
}
