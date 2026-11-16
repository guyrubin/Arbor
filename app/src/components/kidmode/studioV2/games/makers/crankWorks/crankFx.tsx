import { FEED, pistonLift, type Ink, type PartId } from './crankWorksRules';
import { GRAB, GRIP, INKS, PEN, WAVE_GLASS, moverOf, poseOf, tagFor, type Pose } from './crankArt';
import { COMPANION_FRAME, KIT_ANCHORCHECK, KIT_COMPANION, type KitPicture } from './crankKit';

/* What is laid over the machines: the part names, AnchorCheck, the companion,
   the showing hand, the two motions drawn side by side, the writer's wave and
   the finish sparks. Interface marks take the Studio tokens through CSS
   classes; scene effects take the makers' palette. */

const DEG = 180 / Math.PI;
const mk = (name: string) => `var(--mk-${name})`;
const tint = (a: string, pct: number, b: string) => `color-mix(in srgb, ${mk(a)} ${pct}%, ${b === 'transparent' ? 'transparent' : mk(b)})`;
const CYAN = tint('sea', 62, 'sky');

type Lang = 'en' | 'he';

/** Every part's name on a pearl tag, its line following the part. A tag is a
 * tap target for its part; the chosen one is ringed, a met one is ticked. */
export function PartTags({ parts, pose, selected, met, names, lang, show, focus }: { parts: readonly PartId[]; pose: Pose; selected: PartId | null; met: readonly PartId[]; names: (part: PartId) => string; lang: Lang; show: number; focus: PartId | null }) {
  return <g className="ck-tags" style={{ opacity: show }}>
    {parts.map((part, i) => {
      const { tag, at } = tagFor(part, pose), name = names(part);
      const width = Math.max(58, name.length * (lang === 'he' ? 8.8 : 8.4) + 34);
      const toward = at.x > tag.x ? 1 : -1, sx = tag.x + toward * width / 2;
      const rise = Math.max(0, Math.min(1, show * (parts.length + 1) - i * 0.6));
      const known = met.includes(part);
      return <g key={part} className="ck-tag" data-crank-part={part} data-crank-tag="" data-chosen={selected === part} data-met={known} data-dim={!!selected && selected !== part} data-focus={focus === part} style={{ opacity: rise }} transform={`translate(0 ${((1 - rise) * 8).toFixed(2)})`}>
        <path d={`M${sx} ${tag.y}L${at.x.toFixed(2)} ${at.y.toFixed(2)}`} className="ck-tag__leader" />
        <circle cx={at.x} cy={at.y} r="4.4" className="ck-tag__dot" />
        <rect x={tag.x - width / 2} y={tag.y - 22} width={width} height="44" rx="14" className="ck-tag__hit" />
        <rect x={tag.x - width / 2 + 1.5} y={tag.y - 14} width={width} height="32" rx="12" className="ck-tag__shade" />
        <rect x={tag.x - width / 2} y={tag.y - 16} width={width} height="32" rx="12" className="ck-tag__card" />
        <g transform={`translate(${tag.x + (lang === 'he' ? 1 : -1) * (width / 2 - 13)} ${tag.y})`}>
          <circle r="6.6" className="ck-tag__mark" />
          {known && <path d="M-3.2 0.2L-0.9 2.5L3.4 -2.2" className="ck-tag__tick" />}
        </g>
        <text x={tag.x + (lang === 'he' ? -9 : 9)} y={tag.y + 5.2} textAnchor="middle" direction={lang === 'he' ? 'rtl' : 'ltr'} className="ck-tag__text">{name}</text>
      </g>;
    })}
  </g>;
}

/** AnchorCheck, the kit's joint tester: its tip rests on the chosen part and a
 * ring of its cyan light spreads from the joint. `age` is seconds since it landed. */
export function AnchorCheck({ x, y, flip, show, age }: { x: number; y: number; flip: boolean; show: number; age: number }) {
  const w = 82, h = w * KIT_ANCHORCHECK.height / KIT_ANCHORCHECK.width;
  const tx = KIT_ANCHORCHECK.tip[0] / KIT_ANCHORCHECK.width * w, ty = KIT_ANCHORCHECK.tip[1] / KIT_ANCHORCHECK.height * h;
  const press = age < 0.3 ? Math.sin(age / 0.3 * Math.PI) * 2.4 : 0;
  const pulse = age < 0.9 ? age / 0.9 : 1;
  return <g className="ck-anchor" style={{ opacity: show }} aria-hidden="true">
    {age < 0.9 && <circle cx={x} cy={y} r={5 + pulse * 20} style={{ fill: 'none', stroke: CYAN, strokeWidth: 3 * (1 - pulse), opacity: 1 - pulse }} />}
    <circle cx={x} cy={y} r="5.4" style={{ fill: tint('sea', 30, 'transparent'), stroke: CYAN, strokeWidth: 1.6 }} />
    <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})${flip ? ' scale(-1 1)' : ''} translate(${(press * 0.8).toFixed(2)} ${(-press).toFixed(2)})`}>
      <ellipse cx={w * 0.42} cy={-h * 0.18 + 9} rx={w * 0.4} ry="5" transform="rotate(-22)" style={{ fill: tint('shadow', 20, 'transparent') }} />
      <image href={KIT_ANCHORCHECK.src} x={-tx} y={-ty} width={w} height={h} />
    </g>
  </g>;
}

/** Who stands by the bench: watching, following the up-and-down with a small
 * nod, cheering (and hopping) at a reward. Tapping them is one of the toys. */
export function Companion({ cheer, hop, nod }: { cheer: boolean; hop: number; nod: number }) {
  const { right, width, foot } = COMPANION_FRAME;
  const up = hop < 0.7 ? Math.abs(Math.sin(hop / 0.35 * Math.PI)) * 12 * (1 - hop / 0.7) : 0;
  const squash = hop < 0.7 ? 1 + Math.sin(hop / 0.35 * Math.PI * 2) * 0.03 * (1 - hop / 0.7) : 1;
  const cx = right - width / 2;
  const picture = (p: KitPicture, shown: boolean) => { const h = width * p.height / p.width; return <image href={p.src} x={right - width} y={foot - h} width={width} height={h} style={{ opacity: shown ? 1 : 0 }} transform={KIT_COMPANION.faces === 'right' ? `translate(${2 * cx} 0) scale(-1 1)` : undefined} />; };
  return <g data-crank-toy="friend" className="ck-friend" transform={`translate(0 ${(-up - nod * 2).toFixed(2)}) translate(${cx} ${foot}) scale(${(2 - squash).toFixed(3)} ${squash.toFixed(3)}) translate(${-cx} ${-foot})`}>
    <ellipse cx={cx} cy={foot - width * 0.56} rx={width * 0.44} ry={width * 0.5} className="ck-grab" />
    {picture(KIT_COMPANION.watch, !cheer)}
    {picture(KIT_COMPANION.cheer, cheer)}
  </g>;
}

/** The showing hand: a soft white hand that takes hold of the wheel and turns
 * it, to show the first gesture. It is drawn only; it never takes a touch. */
export function GhostHand({ x, y, press, show, still, arc }: { x: number; y: number; press: number; show: number; still: boolean; arc: string | null }) {
  const s = 1.05 - press * 0.09;
  return <g className="ck-hand" style={{ opacity: show }} aria-hidden="true">
    {arc && <path d={arc} className="ck-hand__arc" />}
    {press > 0.05 && <circle cx={x} cy={y} r={7 + press * 7} className="ck-hand__touch" style={{ opacity: press * 0.8 }} />}
    <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${still ? -18 : -14 + press * -5}) scale(${s.toFixed(3)})`}>
      <path d="M0 -2c-3.9 0-7 3.1-7 7v21.5l-5.2-4.6c-3-2.6-7.6-1.8-9.3 1.7-1 2.2-.5 4.8 1.2 6.600l14.800 15.300c3.700 3.800 8.800 6 14.100 6h8.400c9.400 0 17-7.600 17-17v-15.500c0-3.600-2.900-6.500-6.500-6.500-1.400 0-2.700.4-3.700 1.200-.9-2.800-3.500-4.800-6.600-4.800-1.700 0-3.200.6-4.400 1.600v-12.500c0-3.900-3.100-7-7-7z" className="ck-hand__shade" transform="translate(2.500 3.500)" />
      <path d="M0 -2c-3.9 0-7 3.1-7 7v21.5l-5.2-4.6c-3-2.6-7.6-1.8-9.3 1.7-1 2.2-.5 4.8 1.2 6.600l14.800 15.300c3.700 3.800 8.800 6 14.100 6h8.400c9.400 0 17-7.600 17-17v-15.500c0-3.600-2.900-6.500-6.500-6.500-1.400 0-2.700.4-3.700 1.200-.9-2.800-3.500-4.800-6.600-4.800-1.700 0-3.200.6-4.400 1.600v-12.500c0-3.900-3.100-7-7-7z" className="ck-hand__skin" />
      <path d="M7 16.500v9M17.500 20v6" className="ck-hand__crease" />
    </g>
  </g>;
}
/** Where the showing hand's fingertip rests for a pose: on the wheel's rim to
 * the right of the shaft, or on the lifter's handle knob. */
export function handSpot(pose: Pose, turned: number): { x: number; y: number; arc: string } {
  const r = GRIP[pose.machine], cx = pose.sx, cy = pose.sy;
  const start = pose.machine === 'toy' ? pose.deg - turned * DEG + 180 : 62;
  const a = (start + turned * DEG) / DEG, a0 = start / DEG, a1 = (start + 80) / DEG, ra = r + 15;
  const pt = (angle: number, radius: number) => `${(cx + radius * Math.sin(angle)).toFixed(1)} ${(cy - radius * Math.cos(angle)).toFixed(1)}`;
  return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a), arc: `M${pt(a0, ra)}A${ra} ${ra} 0 0 1 ${pt(a1, ra)}M${pt(a1 - 0.22, ra + 5)}L${pt(a1, ra)}L${pt(a1 - 0.2, ra - 7)}` };
}

/** Round and round, up and down: the two motions drawn side by side on the
 * closed machine, each with a bead that follows the real angle. */
export function Insight({ pose, show, draw }: { pose: Pose; show: number; draw: number }) {
  const r = GRAB[pose.machine] + 4, cx = pose.sx, cy = pose.sy;
  const mover = moverOf(pose), high = moverOf(poseOf(0, pose.machine)).y, low = moverOf(poseOf(Math.PI, pose.machine)).y;
  const lx = mover.x + (pose.machine === 'writer' ? -22 : 30);
  const bead = pose.machine === 'toy' ? pose.theta + Math.PI : pose.theta;
  const length = 2 * Math.PI * r, d = Math.max(0, Math.min(1, draw));
  return <g className="ck-insight" style={{ opacity: show }} aria-hidden="true">
    <circle cx={cx} cy={cy} r={r} className="ck-insight__round" style={{ strokeDasharray: `${(length * d).toFixed(1)} ${length.toFixed(1)}` }} transform={`rotate(-90 ${cx} ${cy})`} />
    <path d={`M${(cx + r - 6).toFixed(1)} ${cy - 9}L${cx + r} ${cy + 1}L${(cx + r + 7).toFixed(1)} ${cy - 8}`} className="ck-insight__head ck-insight__head--round" style={{ opacity: d > 0.2 ? 1 : 0 }} />
    <circle cx={cx + r * Math.sin(bead)} cy={cy - r * Math.cos(bead)} r="6.5" className="ck-insight__bead ck-insight__bead--round" />
    <path d={`M${lx} ${high + (low - high) * (1 - d) / 2}V${low - (low - high) * (1 - d) / 2}`} className="ck-insight__line" />
    <path d={`M${lx - 6} ${high + 8}L${lx} ${high}L${lx + 6} ${high + 8}M${lx - 6} ${low - 8}L${lx} ${low}L${lx + 6} ${low - 8}`} className="ck-insight__head ck-insight__head--line" style={{ opacity: d > 0.8 ? 1 : 0 }} />
    <circle cx={lx} cy={mover.y} r="6.5" className="ck-insight__bead ck-insight__bead--line" />
  </g>;
}

/** The chosen part's own path, drawn only where it has really been: the crank
 * pin's circle, the slide's straight line. */
export function Traces({ pose, bins, span, round, line }: { pose: Pose; bins: readonly boolean[]; span: readonly [number, number] | null; round: boolean; line: boolean }) {
  const r = Math.hypot(pose.pin.x - pose.sx, pose.pin.y - pose.sy), step = 360 / bins.length;
  const point = (a: number) => { const rad = a / DEG; return `${(pose.sx + r * Math.sin(rad)).toFixed(2)} ${(pose.sy - r * Math.cos(rad)).toFixed(2)}`; };
  let circle = '';
  if (round) bins.forEach((on, i) => { if (on) circle += `M${point(i * step)}A${r} ${r} 0 0 1 ${point((i + 1) * step)}`; });
  return <g className="ck-trace" aria-hidden="true">
    {circle && <path d={circle} className="ck-trace__circle" />}
    {line && span && <path d={`M${pose.sx} ${pose.sy - span[1]}V${pose.sy - span[0]}`} className="ck-trace__line" />}
    {round && <circle cx={pose.pin.x} cy={pose.pin.y} r="4" className="ck-trace__dot" />}
    {line && <circle cx={pose.sx} cy={pose.wristY} r="4" className="ck-trace__dot ck-trace__dot--line" />}
  </g>;
}

/** The writer's line on its glass: the lift, written out against the angle. */
export function WaveLine({ marks, pose }: { marks: readonly Ink[]; pose: Pose }) {
  const penX = pose.sx + PEN.dx, base = pose.sy - PEN.rise, now = pose.theta;
  const lo = now - (WAVE_GLASS.x + 640 - penX) / FEED, hi = now + (penX - WAVE_GLASS.x) / FEED;
  return <g aria-hidden="true">{marks.map(m => {
    const a = Math.max(m.from, lo), b = Math.min(m.to, hi);
    if (!(b > a)) return null;
    const n = Math.max(1, Math.ceil((b - a) / 0.15));
    let d = '';
    for (let i = 0; i <= n; i++) { const t = a + (b - a) * i / n; d += `${i ? 'L' : 'M'}${(penX + FEED * (now - t)).toFixed(1)} ${(base - pistonLift(t)).toFixed(1)}`; }
    const colour = INKS[m.ink] ?? INKS[0];
    return <g key={m.from}>
      <path d={d} style={{ fill: 'none', stroke: colour, strokeWidth: 7, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: .22 }} />
      <path d={d} style={{ fill: 'none', stroke: colour, strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
    </g>;
  })}</g>;
}

export interface Spark { x: number; y: number; vx: number; vy: number; turn: number; spin: number; age: number; life: number; kind: number; hue: number }
const SPARK_HUES = [mk('orange'), CYAN, mk('white'), tint('amber', 60, 'orange'), tint('spring', 70, 'leaf')];
const COG = Array.from({ length: 16 }, (_, i) => { const a = i * Math.PI / 8, r = i % 2 ? 4.2 : 6.4; return `${i ? 'L' : 'M'}${(r * Math.sin(a)).toFixed(2)} ${(-r * Math.cos(a)).toFixed(2)}`; }).join('') + 'Z';
/** The finish: little cogs, rings and beads thrown from the top of the stroke. */
export function Sparks({ sparks }: { sparks: readonly Spark[] }) {
  return <g aria-hidden="true">{sparks.map((s, i) => {
    const fade = Math.max(0, Math.min(1, (s.life - s.age) / 0.35)), grow = Math.min(1, s.age / 0.12);
    return <g key={i} transform={`translate(${s.x.toFixed(1)} ${s.y.toFixed(1)}) rotate(${s.turn.toFixed(0)}) scale(${(grow * (1.25 + (i % 3) * 0.4)).toFixed(2)})`} style={{ opacity: fade }}>
      {s.kind === 0 ? <path d={COG} style={{ fill: SPARK_HUES[s.hue] }} />
        : s.kind === 1 ? <circle r="4.6" style={{ fill: 'none', stroke: SPARK_HUES[s.hue], strokeWidth: 2.4 }} />
          : <circle r="3.2" style={{ fill: SPARK_HUES[s.hue] }} />}
      {s.kind === 0 && <circle r="1.7" style={{ fill: tint('graphite', 70, 'transparent') }} />}
    </g>;
  })}</g>;
}
