import { useId, type Ref } from 'react';

/** The snowy steppe behind the mammoth, in paper-cut layers authored in the
 * same world units as the animal. The engine sets each layer's transform, so
 * far layers drift less than near ones when the camera moves (parallax). */
type Pt = readonly [number, number];
const RANGE: readonly Pt[] = [[-900, 520], [-760, 404], [-640, 452], [-520, 352], [-380, 440], [-260, 384], [-120, 468], [0, 334], [140, 432], [260, 372], [400, 458], [520, 312], [660, 422], [800, 362], [950, 448], [1080, 326], [1220, 430], [1360, 384], [1500, 462], [1640, 344], [1780, 440], [1900, 520]];
const line = (pts: readonly Pt[]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('');
const RANGE_PATH = `${line(RANGE)}L1900 980L-900 980Z`;
/** The lit (left) snowfield on every peak: light comes from the top left. */
const CAPS = RANGE.map((peak, i) => {
  const left = RANGE[i - 1], right = RANGE[i + 1];
  if (!left || !right || peak[1] > left[1] || peak[1] > right[1]) return '';
  const l = (k: number): Pt => [peak[0] + (left[0] - peak[0]) * k, peak[1] + (left[1] - peak[1]) * k];
  const r = (k: number): Pt => [peak[0] + (right[0] - peak[0]) * k, peak[1] + (right[1] - peak[1]) * k];
  const a = l(0.5), b = r(0.22);
  return `M${peak[0]} ${peak[1]}L${a[0]} ${a[1]}L${a[0] + 22} ${a[1] - 12}L${peak[0] + (a[0] - peak[0]) * 0.25 + 6} ${peak[1] + (a[1] - peak[1]) * 0.6}L${b[0] - 4} ${b[1] + 8}L${b[0]} ${b[1]}Z`;
}).join('');
const hills = (base: number, amp: number, step: number, phase: number) => {
  let d = `M-1000 ${base + 400}L-1000 ${base}`;
  for (let x = -1000; x < 2000; x += step) {
    const y = base - amp * (0.6 + 0.4 * Math.sin((x + phase) * 0.006)) * (0.75 + 0.25 * Math.sin((x + phase) * 0.017));
    d += `Q${x + step / 2} ${y} ${x + step} ${base - amp * 0.35 * (1 + Math.sin((x + step + phase) * 0.004))}`;
  }
  return `${d}L2000 ${base + 400}Z`;
};
const MID = hills(548, 70, 260, 0);
const NEAR = hills(600, 46, 340, 170);
/** A small herd far off on the hills, in silhouette: same anatomy, tiny. */
const HERD_ONE = 'M0 -30C6 -44 22 -48 30 -40C38 -48 58 -46 70 -38C82 -32 94 -24 98 -12C100 0 96 10 92 14L90 30L82 30L80 16L64 18L62 30L54 30L52 16L36 14L34 30L26 30L24 14C16 12 10 4 8 -4C4 6 6 18 12 24L8 28C0 22 -2 8 0 -4C-8 -2 -14 6 -12 14C-10 18 -6 18 -4 16L-6 20C-14 22 -18 14 -16 6C-14 -2 -6 -8 0 -10Z';
const HERD: readonly { x: number; y: number; k: number; flip: boolean }[] = [
  { x: 1010, y: 484, k: 0.34, flip: false }, { x: 1080, y: 490, k: 0.28, flip: false }, { x: -140, y: 500, k: 0.3, flip: true },
];

export function SteppeBackdrop({ svgRef, layerRef }: { svgRef: Ref<SVGSVGElement>; layerRef: (depth: number) => Ref<SVGGElement> }) {
  const id = useId();
  return <svg ref={svgRef} className="iaf-backdrop" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--mk-sky) 62%, var(--mk-indigo))' }} />
        <stop offset=".55" style={{ stopColor: 'var(--mk-sky-pale)' }} />
        <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--mk-butter) 45%, var(--mk-snow))' }} />
      </linearGradient>
      <radialGradient id={`${id}sun`} cx=".5" cy=".5" r=".5">
        <stop offset="0" style={{ stopColor: 'var(--mk-white)' }} />
        <stop offset=".22" style={{ stopColor: 'color-mix(in srgb, var(--mk-butter) 80%, var(--mk-white))' }} />
        <stop offset=".5" style={{ stopColor: 'color-mix(in srgb, var(--mk-sun) 35%, transparent)' }} />
        <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--mk-sun) 0%, transparent)' }} />
      </radialGradient>
      <linearGradient id={`${id}rangeFill`} x1="0" y1="300" x2="0" y2="540" gradientUnits="userSpaceOnUse">
        <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--mk-snow-shade) 58%, var(--mk-storm))' }} />
        <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--mk-sky-pale) 80%, var(--mk-snow-shade))' }} />
      </linearGradient>
      <linearGradient id={`${id}mid`} x1="0" y1="460" x2="0" y2="620" gradientUnits="userSpaceOnUse">
        <stop offset="0" style={{ stopColor: 'var(--mk-snow)' }} />
        <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--mk-snow-shade) 85%, var(--mk-storm))' }} />
      </linearGradient>
      <linearGradient id={`${id}near`} x1="0" y1="540" x2="0" y2="660" gradientUnits="userSpaceOnUse">
        <stop offset="0" style={{ stopColor: 'var(--mk-white)' }} />
        <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--mk-snow-shade) 70%, var(--mk-snow))' }} />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill={`url(#${id}sky)`} />
    <g ref={layerRef(0.04)}>
      <circle cx="40" cy="150" r="190" fill={`url(#${id}sun)`} />
    </g>
    <g ref={layerRef(0.14)}>
      <path d={RANGE_PATH} transform="translate(0 7)" style={{ fill: 'var(--mk-storm)', opacity: 0.16 }} />
      <path d={RANGE_PATH} fill={`url(#${id}rangeFill)`} />
      <path d={CAPS} style={{ fill: 'color-mix(in srgb, var(--mk-white) 85%, var(--mk-sky-pale))', opacity: 0.9 }} />
    </g>
    <g ref={layerRef(0.36)}>
      <path d={MID} transform="translate(0 8)" style={{ fill: 'var(--mk-storm)', opacity: 0.18 }} />
      <path d={MID} fill={`url(#${id}mid)`} />
      {HERD.map((h, i) => <path key={i} d={HERD_ONE} transform={`translate(${h.x} ${h.y}) scale(${h.flip ? -h.k : h.k} ${h.k})`} style={{ fill: 'color-mix(in srgb, var(--mk-storm) 70%, var(--mk-snow-shade))' }} />)}
    </g>
    <g ref={layerRef(0.7)}>
      <path d={NEAR} transform="translate(0 9)" style={{ fill: 'var(--mk-storm)', opacity: 0.2 }} />
      <path d={NEAR} fill={`url(#${id}near)`} />
    </g>
  </svg>;
}

/** A paper-cut snowflake: six arms, each with two little branches. Lit when its secret is found. */
const ARM = 'M-1.6 0L-1.6 -15.5L0 -18L1.6 -15.5L1.6 0Z M-1 -8L-6.4 -12.6L-5.2 -14L0 -10Z M1 -8L6.4 -12.6L5.2 -14L0 -10Z M-0.8 -12.6L-3.4 -15.4L-2.4 -16.4L0 -14.4Z M0.8 -12.6L3.4 -15.4L2.4 -16.4L0 -14.4Z';
export function SnowBadge({ lit }: { lit: boolean }) {
  return <svg className="iaf-flake" viewBox="-20 -20 40 40" aria-hidden="true" focusable="false" data-lit={lit}>
    <circle r="19" className="iaf-flake__disc" />
    <g className="iaf-flake__shadow" transform="translate(.8 1.4)">{[0, 60, 120, 180, 240, 300].map(a => <path key={a} d={ARM} transform={`rotate(${a})`} />)}</g>
    <g className="iaf-flake__arms">{[0, 60, 120, 180, 240, 300].map(a => <path key={a} d={ARM} transform={`rotate(${a})`} />)}<circle r="3.2" /></g>
  </svg>;
}
