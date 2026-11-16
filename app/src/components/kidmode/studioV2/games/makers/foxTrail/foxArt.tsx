import { useId } from 'react';

/** The fox: authored SVG parts on a small rig, facing right, feet at y = 0.
 * The game moves each part every frame (`applyFoxPose`); the cover renders
 * one held pose. Rust and cream with dark socks, tall ears, a big brush tail.
 * One light from the top left, no outlines. */

export type LegPose = readonly [upper: number, lower: number];
export interface FoxPose {
  /** Body bob (units) and lean (radians, + = nose down). */
  bob: number; lean: number;
  /** Sitting: 0..1. */
  sit: number;
  rearNear: LegPose; rearFar: LegPose; frontNear: LegPose; frontFar: LegPose;
  head: number; earNear: number; earFar: number;
  tailBase: number; tailTip: number;
  /** Roll: rotation of the whole fox (radians) and how tucked it is (0..1). */
  spin: number; tuck: number;
  /** Landing squash 0..1, breathing -1..1, eyelids 0 open … 1 shut. */
  squash: number; breathe: number; blink: number;
}
export const FOX_REST: FoxPose = {
  bob: 0, lean: 0, sit: 0, rearNear: [-0.22, 0.34], rearFar: [-0.16, 0.3], frontNear: [0.02, 0], frontFar: [-0.04, 0.04],
  head: 0, earNear: 0, earFar: 0, tailBase: -0.42, tailTip: -0.2, spin: 0, tuck: 0, squash: 0, breathe: 0, blink: 0,
};
const deg = (r: number) => (r * 180 / Math.PI).toFixed(2);
const n = (v: number) => v.toFixed(2);

/** Where each part hangs on the body. */
const HIP_NEAR = [-34, -40] as const, HIP_FAR = [-28, -42] as const;
const SHOULDER_NEAR = [30, -40] as const, SHOULDER_FAR = [35, -42] as const;
const NECK = [40, -56] as const, TAIL = [-47, -50] as const;
const UPPER = 19, LOWER = 21;

export interface FoxTransforms {
  spin: string; lean: string; sit: string;
  rnU: string; rnL: string; rfU: string; rfL: string; fnU: string; fnL: string; ffU: string; ffL: string;
  head: string; earN: string; earF: string; tailB: string; tailT: string; lid: string;
}
export function foxTransforms(p: FoxPose): FoxTransforms {
  const sitRot = -0.52 * p.sit;
  const sx = 1 - 0.4 * p.tuck, sy = 1 - 0.06 * p.tuck - 0.1 * p.squash + 0.012 * p.breathe;
  const lift = -6 * p.tuck;
  return {
    spin: `translate(0 ${n(-32 + lift)}) rotate(${deg(p.spin)}) scale(${n(sx)} ${n(sy)}) translate(0 32)`,
    lean: `translate(0 ${n(p.bob + 4 * p.sit)}) rotate(${deg(p.lean)} 0 -40)`,
    sit: `rotate(${deg(sitRot)} ${HIP_NEAR[0]} ${HIP_NEAR[1]})`,
    rnU: `translate(${HIP_NEAR[0]} ${HIP_NEAR[1]}) rotate(${deg(p.rearNear[0])})`, rnL: `translate(0 ${UPPER}) rotate(${deg(p.rearNear[1])})`,
    rfU: `translate(${HIP_FAR[0]} ${HIP_FAR[1]}) rotate(${deg(p.rearFar[0])})`, rfL: `translate(0 ${UPPER}) rotate(${deg(p.rearFar[1])})`,
    fnU: `translate(${SHOULDER_NEAR[0]} ${SHOULDER_NEAR[1]}) rotate(${deg(p.frontNear[0] - sitRot)})`, fnL: `translate(0 ${UPPER}) rotate(${deg(p.frontNear[1])})`,
    ffU: `translate(${SHOULDER_FAR[0]} ${SHOULDER_FAR[1]}) rotate(${deg(p.frontFar[0] - sitRot)})`, ffL: `translate(0 ${UPPER}) rotate(${deg(p.frontFar[1])})`,
    head: `translate(${NECK[0]} ${NECK[1]}) rotate(${deg(p.head - sitRot * 0.75 - p.lean * 0.6)})`,
    earN: `translate(13 -21) rotate(${deg(p.earNear)})`, earF: `translate(4 -20) rotate(${deg(p.earFar - 0.12)})`,
    tailB: `translate(${TAIL[0]} ${TAIL[1]}) rotate(${deg(p.tailBase)})`, tailT: `translate(-38 0) rotate(${deg(p.tailTip)})`,
    lid: `translate(25 -14) scale(1 ${n(Math.max(0.08, 1 - p.blink))})`,
  };
}
export type FoxPartRefs = Partial<Record<keyof FoxTransforms, SVGGElement | null>>;
/** Moves the parts in place (no React render per frame). */
export function applyFoxPose(parts: FoxPartRefs, pose: FoxPose) {
  const t = foxTransforms(pose);
  for (const key in t) {
    const el = parts[key as keyof FoxTransforms];
    if (el) el.setAttribute('transform', t[key as keyof FoxTransforms]);
  }
}

const RUST = 'var(--mk-rust)';
const sock = { fill: 'var(--mk-fur-dark)' };
const farTone = (fill: string) => `color-mix(in srgb, ${fill} 72%, var(--mk-shadow))`;

function Leg({ kind, far, upper, lower, refs, keys, grad }: { kind: 'rear' | 'front'; far: boolean; upper: string; lower: string; refs?: FoxPartRefs; keys: [keyof FoxTransforms, keyof FoxTransforms]; grad: string }) {
  const fur = far ? farTone(RUST) : `url(#${grad})`;
  const dark = far ? { fill: 'color-mix(in srgb, var(--mk-fur-dark) 80%, var(--mk-shadow))' } : sock;
  return <g transform={upper} ref={el => { if (refs) refs[keys[0]] = el; }}>
    {kind === 'rear'
      ? <path d="M -12 -6 C -14 -16, 6 -18, 11 -8 C 14 0, 8 12, 4 21 L -4 21 C -8 12, -12 4, -12 -6 Z" style={{ fill: fur }} />
      : <path d="M -6 -6 C -6 -10, 6 -10, 6 -6 L 4.4 21 L -3.6 21 Z" style={{ fill: fur }} />}
    {kind === 'front' && <path d="M -4.6 9 L 4.8 9 L 4.4 21 L -3.6 21 Z" style={dark} />}
    <g transform={lower} ref={el => { if (refs) refs[keys[1]] = el; }}>
      {kind === 'rear'
        ? <><path d="M -4 -1 L 4 -1 L 3 19 L -3 19 Z" style={{ fill: far ? farTone(RUST) : RUST }} /><path d="M -3.6 7 L 3.6 7 L 3 19 L -3 19 Z" style={dark} /></>
        : <path d="M -3.6 -1 L 4.2 -1 L 3.2 19 L -3 19 Z" style={dark} />}
      <path d="M -4 17 C -4 21, 0 23, 9 22.6 C 11 22.4, 11 19.6, 8 18.8 C 4 18, 0 16, -4 17 Z" style={dark} />
    </g>
  </g>;
}

export function FoxFigure({ pose = FOX_REST, refs, carried = 0, night = false }: { pose?: FoxPose; refs?: FoxPartRefs; carried?: number; night?: boolean }) {
  const id = useId().replace(/:/g, '');
  const t = foxTransforms(pose);
  const g = (key: keyof FoxTransforms) => ({ transform: t[key], ref: (el: SVGGElement | null) => { if (refs) refs[key] = el; } });
  const coat = `${id}coat`, tail = `${id}tail`, head = `${id}head`, glow = `${id}glow`;
  return <g className="ft-fox-figure" data-night={night}>
    <defs>
      <radialGradient id={coat} cx="0.42" cy="0.12" r="0.95">
        <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--mk-orange) 80%, var(--mk-fur-tip))' }} />
        <stop offset="0.55" style={{ stopColor: RUST }} />
        <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--mk-rust) 62%, var(--mk-umber))' }} />
      </radialGradient>
      <linearGradient id={tail} x1="1" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--mk-rust) 85%, var(--mk-umber))' }} />
        <stop offset="0.5" style={{ stopColor: 'color-mix(in srgb, var(--mk-orange) 70%, var(--mk-rust))' }} />
        <stop offset="1" style={{ stopColor: RUST }} />
      </linearGradient>
      <radialGradient id={head} cx="0.35" cy="0.2" r="0.9">
        <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--mk-orange) 75%, var(--mk-fur-tip))' }} />
        <stop offset="1" style={{ stopColor: RUST }} />
      </radialGradient>
      <radialGradient id={glow}>
        <stop offset="0" style={{ stopColor: 'var(--mk-butter)' }} />
        <stop offset="0.45" style={{ stopColor: 'color-mix(in srgb, var(--mk-sun) 70%, transparent)' }} />
        <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--mk-amber) 0%, transparent)' }} />
      </radialGradient>
    </defs>
    <g {...g('spin')}>
      <g {...g('lean')}>
        <g {...g('sit')}>
          <Leg kind="rear" far upper={t.rfU} lower={t.rfL} refs={refs} keys={['rfU', 'rfL']} grad={coat} />
          <Leg kind="front" far upper={t.ffU} lower={t.ffL} refs={refs} keys={['ffU', 'ffL']} grad={coat} />
          {/* the brush: base and tip follow the body with lag */}
          <g {...g('tailB')}>
            <path d="M 3 -7 C -8 -15, -28 -17, -40 -12 L -40 12 C -28 15, -8 11, 3 7 Z" style={{ fill: `url(#${tail})` }} />
            <g {...g('tailT')}>
              <path d="M 2 -12 C -14 -18, -36 -13, -44 -1 C -37 11, -15 15, 2 11 Z" style={{ fill: `url(#${tail})` }} />
              <path d="M -26 -13 C -34 -11, -43 -6, -45 -1 C -41 7, -33 11, -26 11 C -30 4, -30 -6, -26 -13 Z" style={{ fill: 'var(--mk-cream)' }} />
              <path d="M -8 -14 C -16 -15, -26 -13, -32 -9" style={{ fill: 'none', stroke: 'color-mix(in srgb, var(--mk-fur-tip) 55%, transparent)', strokeWidth: 2.4, strokeLinecap: 'round' }} />
              {[0, 1, 2].map(i => i < carried && <g key={i} className="ft-fox-seed" transform={`translate(${-6 - i * 9} ${1 - (i % 2) * 3})`}>
                <circle r="9" style={{ fill: `url(#${glow})` }} />
                <ellipse rx="3.2" ry="4.2" style={{ fill: 'var(--mk-butter)' }} />
              </g>)}
            </g>
          </g>
          {/* body, belly and chest bib */}
          <path d="M 40 -64 C 20 -71, -20 -69, -40 -63 C -55 -58, -57 -38, -44 -31 C -30 -26, 10 -28, 28 -32 C 42 -35, 50 -46, 48 -55 C 46 -61, 44 -63, 40 -64 Z" style={{ fill: `url(#${coat})` }} />
          <path d="M 32 -35 C 12 -29, -18 -29, -36 -33 C -20 -38, 10 -39, 32 -42 Z" style={{ fill: 'color-mix(in srgb, var(--mk-cream) 88%, var(--mk-fur-tip))' }} />
          <path d="M 44 -58 C 52 -52, 50 -38, 40 -34 C 34 -38, 34 -52, 44 -58 Z" style={{ fill: 'var(--mk-cream)' }} />
          <path d="M 30 -66 C 10 -70, -18 -69, -36 -63" style={{ fill: 'none', stroke: 'color-mix(in srgb, var(--mk-fur-tip) 60%, transparent)', strokeWidth: 3, strokeLinecap: 'round' }} />
          <Leg kind="rear" far={false} upper={t.rnU} lower={t.rnL} refs={refs} keys={['rnU', 'rnL']} grad={coat} />
          <Leg kind="front" far={false} upper={t.fnU} lower={t.fnL} refs={refs} keys={['fnU', 'fnL']} grad={coat} />
          <g {...g('head')}>
            <g {...g('earF')}>
              <path d="M -6 2 C -6 -12, -2 -25, 4 -32 C 8 -24, 10 -12, 8 2 Z" style={{ fill: farTone(RUST) }} />
              <path d="M 1 -22 C 2 -27, 3 -30, 4 -32 C 6 -28, 7 -25, 7 -22 Z" style={{ fill: 'var(--mk-fur-dark)' }} />
            </g>
            <path d="M -4 -4 C -4 -20, 9 -29, 22 -25 C 30 -22, 36 -14, 46 -8 C 50 -6, 50 -1, 46 0 C 36 2, 24 5, 14 7 C 3 8, -4 4, -4 -4 Z" style={{ fill: `url(#${head})` }} />
            <path d="M 6 1 C 16 -3, 30 -5, 47 -2 C 45 1, 32 4, 18 7 C 10 8, 6 5, 6 1 Z" style={{ fill: 'var(--mk-cream)' }} />
            <path d="M -2 -2 C 0 6, 8 9, 14 7 C 8 4, 4 0, 2 -6 Z" style={{ fill: 'color-mix(in srgb, var(--mk-cream) 85%, var(--mk-fur-tip))' }} />
            <ellipse cx="47.4" cy="-4.6" rx="3.6" ry="2.9" style={{ fill: 'var(--mk-shadow)' }} />
            <ellipse cx="46.6" cy="-5.6" rx="1.2" ry=".8" style={{ fill: 'color-mix(in srgb, var(--mk-white) 55%, transparent)' }} />
            <g {...g('lid')}>
              <ellipse rx="3.1" ry="3.5" style={{ fill: 'var(--mk-shadow)' }} />
              <circle cx="1" cy="-1.3" r="1.1" style={{ fill: 'var(--mk-white)' }} />
            </g>
            <path d="M 21 -19.5 Q 25 -21.5 29 -18.6" style={{ fill: 'none', stroke: 'color-mix(in srgb, var(--mk-fur-dark) 70%, transparent)', strokeWidth: 1.4, strokeLinecap: 'round' }} />
            <g {...g('earN')}>
              <path d="M -7 2 C -7 -12, -3 -26, 3 -33 C 8 -25, 11 -12, 9 2 Z" style={{ fill: `url(#${head})` }} />
              <path d="M -3 0 C -3 -10, 0 -20, 3 -26 C 6 -19, 7 -10, 6 0 Z" style={{ fill: 'color-mix(in srgb, var(--mk-cream) 80%, var(--mk-rose))' }} />
              <path d="M 0 -24 C 1.4 -28, 2.4 -31, 3 -33 C 5.4 -30, 7 -26, 7.6 -23 C 5 -24, 2.4 -24.4, 0 -24 Z" style={{ fill: 'var(--mk-fur-dark)' }} />
            </g>
          </g>
        </g>
      </g>
    </g>
  </g>;
}
