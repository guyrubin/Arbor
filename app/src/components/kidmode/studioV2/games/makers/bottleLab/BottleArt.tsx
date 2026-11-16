/** Bottle Lab art: one set of hand-built SVG layers shared by the play view,
 * the kept bottle's preview and the cover. A calm still life: a banded paper
 * wall, a cream table, one lamp. The glass is never outlined; it is made of
 * what glass does to light: the wall seen through it (bent by a real
 * displacement map), a tint that deepens toward the edges, the dark and bright
 * refraction bands along the outline, the lamp's streak and rim, and the
 * shadow with the light the full bottle focuses into it.
 *
 * Every colour is a maker-palette or Studio token through var() and
 * color-mix(); the tint of the glass travels as four --bl-* properties. */
import type { CSSProperties, ReactNode } from 'react';
import { AXIS_X, BASE_Y, ELLIPSE, PROFILES, SCENE_H, SCENE_W, TABLE_Y, WALL, bandPath, baseRadius, bottomY, innerPath, maxRadius, radiusAt, silhouettePath, topY, waterPath, type ShapeId } from './bottleGeometry';
import { LAMP_ARC, LAMP_MAX, LAMP_MIN, lampEffects, lampPosition, slotView, spawnBubble, type BottleFinish, type BottleSticker, type BottleStickerPlacement, type BottleTint } from './bottleLabRules';
import type { RefractionMap } from './bottleRefraction';

const mix = (a: string, b: string, p: number) => `color-mix(in srgb, var(${a}) ${p}%, var(${b}))`;
const alpha = (a: string, p: number) => `color-mix(in srgb, var(${a}) ${p}%, transparent)`;
const fill = (value: string, opacity?: number): CSSProperties => opacity === undefined ? { fill: value } : { fill: value, opacity };
const stop = (value: string, opacity = 1): CSSProperties => ({ stopColor: value, stopOpacity: opacity });

/** The four glass tints: body, edge, deep (the darkest refraction band) and light. */
export const TINT_STYLE: Readonly<Record<BottleTint, CSSProperties>> = {
  clear: { '--bl-glass': 'var(--mk-snow)', '--bl-edge': mix('--mk-celadon-deep', '--mk-steel-dark', 50), '--bl-deep': 'var(--mk-slate)', '--bl-light': 'var(--mk-white)', '--bl-water': mix('--mk-sky', '--mk-celadon', 55), '--bl-body': '0.06' } as CSSProperties,
  sea: { '--bl-glass': mix('--mk-sea', '--mk-celadon', 70), '--bl-edge': 'var(--mk-teal)', '--bl-deep': 'var(--mk-teal-deep)', '--bl-light': 'var(--mk-sky-pale)', '--bl-water': 'var(--mk-sea)', '--bl-body': '0.3' } as CSSProperties,
  amber: { '--bl-glass': 'var(--mk-amber)', '--bl-edge': mix('--mk-rust', '--mk-amber', 55), '--bl-deep': 'var(--mk-umber)', '--bl-light': 'var(--mk-butter)', '--bl-water': mix('--mk-amber', '--mk-orange', 60), '--bl-body': '0.32' } as CSSProperties,
  rose: { '--bl-glass': 'var(--mk-rose)', '--bl-edge': 'var(--mk-rose-deep)', '--bl-deep': 'var(--mk-plum)', '--bl-light': 'var(--mk-blossom)', '--bl-water': mix('--mk-rose', '--mk-blossom', 60), '--bl-body': '0.3' } as CSSProperties,
};

/** Ids for one drawing: every gradient, clip and filter carries the uid. */
export const ids = (uid: string) => {
  const u = uid.replace(/[^a-zA-Z0-9_-]/g, '');
  const id = (name: string) => `bl${u}-${name}`;
  return { id, url: (name: string) => `url(#${id(name)})` };
};

// ── Defs ───────────────────────────────────────────────────────────────────

/** Shared definitions; put them in the first layer of a drawing. */
export function BottleDefs({ uid, shape, finish, map }: { uid: string; shape: ShapeId; finish: BottleFinish; map: RefractionMap | null }) {
  const { id } = ids(uid);
  const frost = finish === 'frost';
  return <defs>
    <clipPath id={id('outer')}><path d={silhouettePath(shape)} /></clipPath>
    <clipPath id={id('inner')}><path d={innerPath(shape)} /></clipPath>
    <clipPath id={id('water')}><path d={waterPath(shape)} /></clipPath>
    <linearGradient id={id('wall')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={stop('var(--mk-white)', 0.5)} /><stop offset=".55" style={stop('var(--mk-white)', 0)} /><stop offset="1" style={stop('var(--mk-shadow)', 0.12)} /></linearGradient>
    <linearGradient id={id('table')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop(mix('--mk-cream', '--mk-white', 60))} /><stop offset=".35" style={stop('var(--mk-cream)')} /><stop offset="1" style={stop(mix('--mk-linen', '--mk-linen-shade', 55))} /></linearGradient>
    <linearGradient id={id('tableSide')} x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={stop('var(--mk-white)', 0.35)} /><stop offset=".5" style={stop('var(--mk-white)', 0)} /><stop offset="1" style={stop('var(--mk-shadow)', 0.08)} /></linearGradient>
    <linearGradient id={id('seam')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop('var(--mk-shadow)', 0)} /><stop offset="1" style={stop('var(--mk-shadow)', 0.16)} /></linearGradient>
    <filter id={id('grain')} x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" stitchTiles="stitch" /><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.05" /></filter>
    <filter id={id('soft1')} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.2" /></filter>
    <filter id={id('soft')} x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation={frost ? 2.2 : 0.7} /></filter>
    <filter id={id('backSticker')} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={frost ? 3 : 0.9} /></filter>
    {/* The refraction itself: the backdrop resampled through the map. */}
    <filter id={id('refract')} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" x="0" y="0" width={SCENE_W} height={SCENE_H} colorInterpolationFilters="sRGB">
      {map && <feImage href={map.href} x={map.x} y={map.y} width={map.width} height={map.height} preserveAspectRatio="none" result="map" />}
      {map ? <feDisplacementMap in="SourceGraphic" in2="map" scale={map.scale} xChannelSelector="R" yChannelSelector="G" result="bent" /> : <feOffset in="SourceGraphic" result="bent" />}
      <feGaussianBlur in="bent" stdDeviation={frost ? 5 : 0.35} />
    </filter>
    <linearGradient id={id('water')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop('var(--bl-water)', 0.16)} /><stop offset="1" style={stop('var(--bl-water)', 0.34)} /></linearGradient>
    <linearGradient id={id('body')} gradientUnits="userSpaceOnUse" x1={AXIS_X - maxRadius(shape)} x2={AXIS_X + maxRadius(shape)} y1="0" y2="0">
      <stop offset="0" style={stop('var(--bl-edge)', 0.75)} /><stop offset=".22" style={stop('var(--bl-glass)', 0.55)} /><stop offset=".5" style={stop('var(--bl-glass)', 0.35)} /><stop offset=".78" style={stop('var(--bl-glass)', 0.55)} /><stop offset="1" style={stop('var(--bl-edge)', 0.75)} />
    </linearGradient>
    <linearGradient id={id('streak')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop('var(--mk-white)', 0)} /><stop offset=".12" style={stop('var(--mk-white)', 1)} /><stop offset=".5" style={stop('var(--mk-white)', 0.75)} /><stop offset="1" style={stop('var(--mk-white)', 0)} /></linearGradient>
    <linearGradient id={id('rim')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop('var(--bl-light)', 0)} /><stop offset=".3" style={stop('var(--bl-light)', 1)} /><stop offset="1" style={stop('var(--bl-light)', 0.2)} /></linearGradient>
    <linearGradient id={id('steel')} x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={stop('var(--mk-steel-dark)')} /><stop offset=".22" style={stop('var(--mk-steel)')} /><stop offset=".4" style={stop('var(--mk-steel-light)')} /><stop offset=".58" style={stop('var(--mk-steel)')} /><stop offset=".86" style={stop(mix('--mk-steel-dark', '--mk-steel', 60))} /><stop offset="1" style={stop('var(--mk-graphite)')} /></linearGradient>
    <linearGradient id={id('steelTop')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={stop('var(--mk-steel-light)')} /><stop offset="1" style={stop('var(--mk-steel)')} /></linearGradient>
    <radialGradient id={id('caustic')}><stop offset="0" style={stop(mix('--bl-light', '--mk-white', 40))} /><stop offset=".45" style={stop(mix('--bl-glass', '--mk-white', 45), 0.7)} /><stop offset="1" style={stop('var(--bl-glass)', 0)} /></radialGradient>
    <radialGradient id={id('pool')}><stop offset="0" style={stop('var(--mk-butter)', 0.55)} /><stop offset=".5" style={stop('var(--mk-butter)', 0.18)} /><stop offset="1" style={stop('var(--mk-butter)', 0)} /></radialGradient>
    <radialGradient id={id('bulb')}><stop offset="0" style={stop('var(--mk-white)')} /><stop offset=".35" style={stop('var(--mk-sun)', 0.9)} /><stop offset="1" style={stop('var(--mk-sun)', 0)} /></radialGradient>
    <linearGradient id={id('beam')} x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={stop('var(--mk-butter)', 0.5)} /><stop offset="1" style={stop('var(--mk-butter)', 0)} /></linearGradient>
    <linearGradient id={id('shade')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop(mix('--mk-indigo', '--mk-bluebell', 70))} /><stop offset="1" style={stop('var(--mk-indigo-deep)')} /></linearGradient>
    <radialGradient id={id('bubble')} cx=".4" cy=".36" r=".64" fx=".34" fy=".28"><stop offset="0" style={stop('var(--mk-white)', 1)} /><stop offset=".28" style={stop('var(--mk-white)', 0.4)} /><stop offset=".68" style={stop('var(--bl-light)', 0.1)} /><stop offset=".9" style={stop('var(--bl-deep)', 0.42)} /><stop offset="1" style={stop('var(--bl-deep)', 0.6)} /></radialGradient>
    <linearGradient id={id('frost')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop('var(--mk-white)', 0.5)} /><stop offset="1" style={stop('var(--mk-white)', 0.3)} /></linearGradient>
  </defs>;
}

// ── The still life ─────────────────────────────────────────────────────────

const BAND = 27;
/** The torn lower edge of a paper strip: a deterministic, gentle wobble. */
const L = -240, R = SCENE_W + 260, T = -90;
function stripEdge(y: number, i: number, from = L, to = R): string {
  const pts: string[] = [];
  for (let x = to; x >= from; x -= 6) pts.push(`${x} ${(y + 0.9 * Math.sin(x * 0.11 + i * 1.7) + 0.6 * Math.sin(x * 0.27 + i * 3.1)).toFixed(1)}`);
  return pts.join('L');
}
const STRAW = { x0: -26, slope: 0.74, width: 15 } as const;
const strawX = (y: number) => STRAW.x0 + y * STRAW.slope;

/** The paper wall and the table. Drawn twice: once as the room, once through the glass. */
export function Backdrop({ uid, grain = true }: { uid: string; grain?: boolean }) {
  const { url } = ids(uid);
  const strips: ReactNode[] = [];
  for (let i = 0, y = -BAND * 4; y < TABLE_Y; i++, y += BAND * 2) {
    const top = y + BAND, bottom = Math.min(TABLE_Y, top + BAND);
    const d = `M${L} ${top}L${R} ${top}L${stripEdge(bottom, i)}Z`;
    strips.push(<g key={i}>
      <path d={d} transform="translate(0 2.4)" style={fill('var(--mk-shadow)', 0.13)} filter={url('soft1')} />
      <path d={d} style={fill(mix('--mk-bluebell', '--mk-paper-shade', 36))} />
      <path d={`M${L} ${top}L${R} ${top}L${R} ${top + 3}L${L} ${top + 3}Z`} style={fill('var(--mk-white)', 0.18)} />
    </g>);
  }
  const ys = [T, TABLE_Y + 2];
  const straw = `M${strawX(ys[0]) - STRAW.width / 2} ${ys[0]}L${strawX(ys[0]) + STRAW.width / 2} ${ys[0]}L${strawX(ys[1]) + STRAW.width / 2} ${ys[1]}L${strawX(ys[1]) - STRAW.width / 2} ${ys[1]}Z`;
  const W = R - L, B = SCENE_H + 90;
  return <g>
    <rect x={L} y={T} width={W} height={TABLE_Y - T + 2} style={fill('var(--mk-paper)')} />
    {strips}
    <path d={straw} transform="translate(2.5 1.5)" style={fill('var(--mk-shadow)', 0.16)} filter={url('soft1')} />
    <path d={straw} style={fill(mix('--mk-gold', '--mk-rust', 78))} />
    <path d={`M${strawX(T) - 2} ${T}L${strawX(T) + 2} ${T}L${strawX(TABLE_Y) + 2} ${TABLE_Y}L${strawX(TABLE_Y) - 2} ${TABLE_Y}Z`} style={fill('var(--mk-gold-light)', 0.65)} />
    <rect x={L} y={T} width={W} height={TABLE_Y - T + 2} style={{ fill: url('wall') }} />
    {/* The table: a cream top, lit from the back left, with a soft seam at the wall. */}
    <rect x={L} y={TABLE_Y} width={W} height={B - TABLE_Y} style={{ fill: url('table') }} />
    <rect x={L} y={TABLE_Y} width={W} height={B - TABLE_Y} style={{ fill: url('tableSide') }} />
    <rect x={L} y={TABLE_Y - 10} width={W} height="10" style={{ fill: url('seam') }} />
    <rect x={L} y={TABLE_Y} width={W} height="1.6" style={fill('var(--mk-white)', 0.75)} />
    {grain && <rect x={L} y={T} width={W} height={B - T} filter={url('grain')} style={fill('var(--mk-umber)', 0.09)} />}
  </g>;
}

/** The lamp's warm pool on the wall and its faint beam, or the room's even light. */
export function LampLight({ uid, angle, on }: { uid: string; angle: number; on: boolean }) {
  const { url } = ids(uid);
  const p = lampPosition(angle);
  if (!on) return <rect x={L} y={T} width={R - L} height={SCENE_H + 180} style={fill(mix('--mk-indigo', '--mk-slate', 50), 0.16)} />;
  const toward = Math.atan2(260 - p.y, 180 - p.x) * 180 / Math.PI;
  return <g style={{ mixBlendMode: 'screen' }}>
    <ellipse cx={p.x + (180 - p.x) * 0.35} cy={p.y + (250 - p.y) * 0.35} rx="190" ry="170" style={{ fill: url('pool') }} />
    <path d="M0 -8L230 -64L230 64L0 8Z" transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${toward.toFixed(1)})`} style={{ fill: url('beam'), opacity: 0.32 }} />
  </g>;
}

/** The shadow is the bottle's own shape laid on the table away from the lamp
 * (neck at the far end), tinted by the glass, with the bright caustic inside. */
export function TableShadow({ uid, shape, angle, on }: { uid: string; shape: ShapeId; angle: number; on: boolean }) {
  const { id, url } = ids(uid);
  const fx = lampEffects(angle, on);
  const a = fx.shadowAngle * Math.PI / 180, dir = { x: Math.cos(a), y: Math.sin(a) };
  // Across the shadow, depth on the table is squashed by the view from above.
  const nx = -dir.y, ny = dir.x * ELLIPSE * 2.2, nl = Math.hypot(nx, ny) || 1;
  const n = { x: nx / nl * Math.max(0.36, Math.hypot(nx, ny)), y: ny / nl * Math.max(0.36, Math.hypot(nx, ny)) };
  const top = topY(shape), height = BASE_Y - top, base = { x: AXIS_X, y: BASE_Y };
  const left: string[] = [], right: string[] = [];
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const y = BASE_Y - t * height, r = Math.max(radiusAt(shape, y), t > 0.98 ? radiusAt(shape, top) : 0);
    const c = { x: base.x + dir.x * fx.shadowLength * t, y: base.y + dir.y * fx.shadowLength * t };
    left.push(`${(c.x + n.x * r).toFixed(1)} ${(c.y + n.y * r).toFixed(1)}`);
    right.unshift(`${(c.x - n.x * r).toFixed(1)} ${(c.y - n.y * r).toFixed(1)}`);
  }
  const rb = baseRadius(shape);
  const ct = fx.causticAt, cy = BASE_Y - ct * height, cr = radiusAt(shape, cy) || maxRadius(shape);
  const cc = { x: base.x + dir.x * fx.shadowLength * ct, y: base.y + dir.y * fx.shadowLength * ct };
  const along = Math.max(10, fx.shadowLength * 0.22 * fx.causticSize), across = cr * fx.causticSize * Math.hypot(n.x, n.y);
  return <g>
    <filter id={id('shadow')} x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation={fx.shadowSoftness.toFixed(1)} /></filter>
    <g filter={url('shadow')}>
      <path d={`M${left.join('L')}L${right.join('L')}Z`} style={fill(mix('--bl-deep', '--mk-shadow', 35), fx.shadowOpacity)} />
    </g>
    {/* Contact shadow: where the glass touches the table it is always darkest. */}
    <ellipse cx={AXIS_X} cy={BASE_Y + 1.5} rx={rb * 1.04} ry={rb * ELLIPSE * 1.15} filter={url('soft1')} style={fill('var(--mk-shadow)', on ? 0.42 : 0.3)} />
    {fx.causticOpacity > 0 && <ellipse cx={cc.x} cy={cc.y} rx={along} ry={Math.max(4, across * 0.55)} transform={`rotate(${fx.shadowAngle.toFixed(1)} ${cc.x.toFixed(1)} ${cc.y.toFixed(1)})`} style={{ fill: url('caustic'), opacity: fx.causticOpacity, mixBlendMode: 'screen' }} />}
  </g>;
}

/** The arc rail and the lamp on it, aimed at the bottle. */
export function Lamp({ uid, angle, on }: { uid: string; angle: number; on: boolean }) {
  const { url } = ids(uid);
  const p = lampPosition(angle);
  const arc: string[] = [];
  // The rail runs a little past both stops, so the lamp never sits on its very end.
  for (let a = LAMP_MIN - 5; a <= LAMP_MAX + 5; a += 2.5) { const t = a * 1.3 * Math.PI / 180; arc.push(`${(LAMP_ARC.cx + LAMP_ARC.rx * Math.sin(t)).toFixed(1)} ${(LAMP_ARC.cy - LAMP_ARC.ry * Math.cos(t)).toFixed(1)}`); }
  const rail = `M${arc.join('L')}`;
  return <g>
    <path d={rail} transform="translate(1.5 2.5)" style={{ fill: 'none', stroke: 'var(--mk-shadow)', strokeOpacity: 0.14, strokeWidth: 5, strokeLinecap: 'round' }} filter={url('soft1')} />
    <path d={rail} style={{ fill: 'none', stroke: 'var(--mk-brass)', strokeWidth: 3.6, strokeLinecap: 'round' }} />
    <path d={rail} style={{ fill: 'none', stroke: 'var(--mk-gold-light)', strokeOpacity: 0.7, strokeWidth: 1.1, strokeLinecap: 'round' }} transform="translate(-0.4 -0.7)" />
    <g transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}>
      {on && <circle r="34" style={{ fill: url('bulb'), opacity: 0.55 }} transform={`rotate(${p.aim.toFixed(1)}) translate(16 0)`} />}
      <g transform={`rotate(${p.aim.toFixed(1)})`}>
        {/* clip and knuckle on the rail */}
        <circle cx="-13" r="6.5" style={fill('var(--mk-brass)')} /><circle cx="-14.2" cy="-1.4" r="2.6" style={fill('var(--mk-gold-light)', 0.8)} />
        <path d="M-10 -9.5C-10 -13 -6 -15 -1 -15L9 -17.5L11 -17.5L11 17.5L9 17.5L-1 15C-6 15 -10 13 -10 9.5Z" transform="translate(1.5 2.5)" style={fill('var(--mk-shadow)', 0.2)} />
        <path d="M-10 -9.5C-10 -13 -6 -15 -1 -15L9 -17.5L11 -17.5L11 17.5L9 17.5L-1 15C-6 15 -10 13 -10 9.5Z" style={{ fill: url('shade') }} />
        <path d="M-8 -9C-6 -12 -2 -13 2 -13.5L8 -15" style={{ fill: 'none', stroke: 'var(--mk-white)', strokeOpacity: 0.35, strokeWidth: 1.6, strokeLinecap: 'round' }} />
        <ellipse cx="11" rx="3.4" ry="17.5" style={fill(on ? 'var(--mk-sun)' : mix('--mk-indigo-deep', '--mk-shadow', 60))} />
        <ellipse cx="11.5" rx="2.2" ry="11" style={fill(on ? 'var(--mk-white)' : 'var(--mk-steel-dark)', on ? 0.95 : 0.6)} />
      </g>
    </g>
  </g>;
}

// ── The glass ──────────────────────────────────────────────────────────────

/** What is seen through the glass: the wall again, bent by the map, then the
 * far wall's tint and the water. Changes only with shape, tint and finish. */
export function GlassInside({ uid, shape, finish }: { uid: string; shape: ShapeId; finish: BottleFinish }) {
  const { url } = ids(uid);
  const level = PROFILES[shape].water, rw = radiusAt(shape, level) * (1 - WALL), rb = baseRadius(shape);
  return <g>
    <g clipPath={url('outer')}>
      <g filter={url('refract')}><Backdrop uid={uid} grain={false} /></g>
      {/* the far wall of the glass: tinted, a little darker at the sides */}
      <path d={silhouettePath(shape)} style={{ fill: url('body'), opacity: 'var(--bl-body)' } as CSSProperties} />
    </g>
    <g clipPath={url('inner')}>
      <path d={waterPath(shape)} style={{ fill: url('water') }} />
      {/* the underside of the far water line catches the light */}
      <ellipse cx={AXIS_X} cy={level} rx={rw} ry={rw * ELLIPSE} style={fill(mix('--bl-light', '--mk-white', 50), 0.32)} />
      {/* the thick glass of the base */}
      <ellipse cx={AXIS_X} cy={BASE_Y - 5} rx={rb * 0.9} ry={rb * ELLIPSE * 0.9} style={fill('var(--bl-deep)', 0.2)} />
    </g>
    {finish === 'frost' && <g clipPath={url('outer')}>
      <path d={silhouettePath(shape)} style={{ fill: url('frost') }} />
      <rect x={AXIS_X - 100} y={topY(shape) - 4} width="200" height={bottomY(shape) - topY(shape) + 8} filter={url('grain')} style={fill('var(--mk-white)', 0.14)} />
    </g>}
  </g>;
}

/** The near glass: a tint that deepens toward the outline in soft steps, then
 * the refraction bands (a dark band, a bright hairline, a dark rim) that make
 * the edge read as glass without any outline. */
export function GlassFront({ uid, shape, finish }: { uid: string; shape: ShapeId; finish: BottleFinish }) {
  const { url } = ids(uid);
  const frost = finish === 'frost';
  const both = (a: number, b: number) => `${bandPath(shape, a, b)}${bandPath(shape, -b, -a)}`;
  return <g clipPath={url('outer')}>
    <g filter={url('soft')}>
      {[0.58, 0.74, 0.84, 0.9].map((k, i) => <path key={k} d={both(k, 1)} style={fill('var(--bl-edge)', frost ? 0.08 : 0.07 + i * 0.03)} />)}
      <path d={both(0.885, 0.95)} style={fill('var(--bl-deep)', frost ? 0.22 : 0.42)} />
      <path d={both(0.956, 0.976)} style={fill('var(--bl-light)', frost ? 0.4 : 0.85)} />
      <path d={both(0.982, 1.01)} style={fill('var(--bl-deep)', frost ? 0.3 : 0.55)} />
    </g>
    {/* The thick base: a dark lens with a bright near edge. */}
    <BaseGlass uid={uid} shape={shape} frost={frost} />
  </g>;
}

function BaseGlass({ uid, shape, frost }: { uid: string; shape: ShapeId; frost: boolean }) {
  const { url } = ids(uid);
  const rb = baseRadius(shape), ry = rb * ELLIPSE;
  return <g filter={url('soft')}>
    <path d={`M${AXIS_X - rb} ${BASE_Y}A${rb} ${ry} 0 0 0 ${AXIS_X + rb} ${BASE_Y}L${AXIS_X + rb * 0.97} ${BASE_Y - 9}A${rb * 0.97} ${ry} 0 0 1 ${AXIS_X - rb * 0.97} ${BASE_Y - 9}Z`} style={fill('var(--bl-deep)', frost ? 0.18 : 0.3)} />
    <path d={`M${AXIS_X - rb * 0.86} ${BASE_Y + ry * 0.35}A${rb * 0.88} ${ry * 0.8} 0 0 0 ${AXIS_X + rb * 0.86} ${BASE_Y + ry * 0.35}`} style={{ fill: 'none', stroke: 'var(--bl-light)', strokeOpacity: frost ? 0.4 : 0.85, strokeWidth: 1.6 }} />
    <path d={`M${AXIS_X - rb * 0.97} ${BASE_Y - 9}A${rb * 0.97} ${ry} 0 0 0 ${AXIS_X + rb * 0.97} ${BASE_Y - 9}`} style={{ fill: 'none', stroke: 'var(--mk-white)', strokeOpacity: frost ? 0.25 : 0.5, strokeWidth: 1.2 }} />
  </g>;
}

/** The water's surface ring from just above: the near meniscus is a bright
 * line, the far edge a darker one. `slosh` tilts it after a shake. */
export function WaterSurface({ uid, shape, slosh = 0 }: { uid: string; shape: ShapeId; slosh?: number }) {
  const { url } = ids(uid);
  const level = PROFILES[shape].water, rw = radiusAt(shape, level) * (1 - WALL), ry = rw * ELLIPSE;
  return <g clipPath={url('inner')} transform={slosh ? `rotate(${slosh.toFixed(2)} ${AXIS_X} ${level})` : undefined}>
    <path d={`M${AXIS_X - rw} ${level}A${rw} ${ry} 0 0 1 ${AXIS_X + rw} ${level}`} style={{ fill: 'none', stroke: 'var(--bl-deep)', strokeOpacity: 0.35, strokeWidth: 1.4 }} />
    <path d={`M${AXIS_X - rw} ${level}A${rw} ${ry} 0 0 0 ${AXIS_X + rw} ${level}`} style={{ fill: 'none', stroke: 'var(--mk-white)', strokeOpacity: 0.95, strokeWidth: 2 }} />
    <path d={`M${AXIS_X - rw * 0.98} ${level + 2.2}A${rw * 0.98} ${ry} 0 0 0 ${AXIS_X + rw * 0.98} ${level + 2.2}`} style={{ fill: 'none', stroke: 'var(--bl-deep)', strokeOpacity: 0.22, strokeWidth: 2.4 }} />
  </g>;
}

/** The lamp on the glass: the streak (toward the lamp), the rim light (away
 * from it), a glint on the shoulder. Broad and soft on frosted glass. */
export function GlassLight({ uid, shape, finish, angle, on }: { uid: string; shape: ShapeId; finish: BottleFinish; angle: number; on: boolean }) {
  const { url } = ids(uid);
  const fx = lampEffects(angle, on), frost = finish === 'frost';
  const width = frost ? fx.streakWidth * 2.8 : fx.streakWidth;
  const top = topY(shape) + 4, level = PROFILES[shape].water;
  const clampU = (u: number) => Math.max(-0.985, Math.min(0.985, u));
  const sA = clampU(fx.streakU - width), sB = clampU(fx.streakU + width);
  const rA = clampU(fx.rimU - 0.045), rB = clampU(fx.rimU + 0.03);
  // The glint: the shine's brightest point, where the shoulder turns toward the lamp.
  const shoulder = PROFILES[shape].rows[0] - 22;
  const gx = AXIS_X + fx.streakU * radiusAt(shape, shoulder);
  return <g clipPath={url('outer')}>
    <g filter={frost ? url('soft') : undefined}>
      <path d={bandPath(shape, sA, sB, top, BASE_Y - 6)} style={{ fill: url('streak'), opacity: fx.streakOpacity * (frost ? 0.55 : 1) }} />
      <path d={bandPath(shape, clampU(fx.streakU - width * 0.3), clampU(fx.streakU + width * 0.25), level + 6, BASE_Y - 14)} style={{ fill: 'var(--mk-white)', opacity: on && !frost ? 0.55 : 0.12 }} />
      <path d={bandPath(shape, rA, rB, top + 10, BASE_Y - 4)} style={{ fill: url('rim'), opacity: fx.rimOpacity * (frost ? 0.6 : 1) }} />
    </g>
    {on && <ellipse cx={gx} cy={shoulder} rx={frost ? 9 : 4} ry={frost ? 12 : 7} filter={url('soft1')} style={fill('var(--mk-white)', frost ? 0.45 : 0.95)} />}
  </g>;
}

/** The brushed steel cap and its carry loop. The loop turns with the bottle. */
export function Cap({ uid, shape, rotation, angle, on }: { uid: string; shape: ShapeId; rotation: number; angle: number; on: boolean }) {
  const { url } = ids(uid);
  const top = topY(shape), r = radiusAt(shape, top) + 4.5, h = 30, y0 = top - h + 8, ry = r * ELLIPSE;
  const fx = lampEffects(angle, on);
  const turn = Math.cos(rotation * Math.PI / 180), loopW = Math.max(1.2, 11 * Math.abs(turn));
  const lines = [6, 10, 14, 18, 22];
  return <g>
    <ellipse cx={AXIS_X} cy={y0 + h + 0.5} rx={r + 1} ry={ry + 1} filter={url('soft1')} style={fill('var(--mk-shadow)', 0.3)} />
    {/* the loop behind the cap top */}
    <ellipse cx={AXIS_X} cy={y0 - 10} rx={loopW} ry="13" style={{ fill: 'none', stroke: 'var(--mk-steel-dark)', strokeWidth: 5.5 }} />
    <ellipse cx={AXIS_X} cy={y0 - 10} rx={loopW} ry="13" style={{ fill: 'none', stroke: url('steel'), strokeWidth: 3.6 }} />
    <path d={`M${AXIS_X - loopW} ${y0 - 10}A${loopW} 13 0 0 1 ${AXIS_X - loopW * 0.2} ${y0 - 22.6}`} style={{ fill: 'none', stroke: 'var(--mk-white)', strokeOpacity: 0.7, strokeWidth: 1.1 }} />
    <rect x={AXIS_X - 5} y={y0 - 4} width="10" height="6" rx="2" style={fill('var(--mk-steel-dark)')} />
    <path d={`M${AXIS_X - r} ${y0}L${AXIS_X - r} ${y0 + h}A${r} ${ry} 0 0 0 ${AXIS_X + r} ${y0 + h}L${AXIS_X + r} ${y0}Z`} style={{ fill: url('steel') }} />
    {lines.map(dy => <path key={dy} d={`M${AXIS_X - r} ${y0 + dy}A${r} ${ry} 0 0 0 ${AXIS_X + r} ${y0 + dy}`} style={{ fill: 'none', stroke: dy % 8 ? 'var(--mk-white)' : 'var(--mk-graphite)', strokeOpacity: dy % 8 ? 0.22 : 0.12, strokeWidth: 0.6 }} />)}
    <path d={`M${AXIS_X - r} ${y0 + h - 4}A${r} ${ry} 0 0 0 ${AXIS_X + r} ${y0 + h - 4}L${AXIS_X + r} ${y0 + h}A${r} ${ry} 0 0 1 ${AXIS_X - r} ${y0 + h}Z`} style={fill('var(--mk-graphite)', 0.35)} />
    <rect x={AXIS_X + fx.streakU * r * 0.9 - 2} y={y0 + 2} width="4" height={h - 6} rx="2" style={fill('var(--mk-white)', on ? 0.75 : 0.35)} />
    <ellipse cx={AXIS_X} cy={y0} rx={r} ry={ry} style={{ fill: url('steelTop') }} />
    <ellipse cx={AXIS_X} cy={y0} rx={r} ry={ry} style={{ fill: 'none', stroke: 'var(--mk-white)', strokeOpacity: 0.55, strokeWidth: 0.8 }} />
  </g>;
}

// ── Stickers ───────────────────────────────────────────────────────────────

const STICKER_PAINT: Readonly<Record<BottleSticker, { a: string; b: string; ink: string }>> = {
  star: { a: 'var(--mk-sun)', b: 'var(--mk-amber)', ink: 'var(--mk-gold-deep)' },
  leaf: { a: 'var(--mk-spring)', b: 'var(--mk-leaf)', ink: 'var(--mk-leaf-deep)' },
  wave: { a: 'var(--mk-sky)', b: 'var(--mk-water)', ink: 'var(--mk-indigo)' },
  sun: { a: 'var(--mk-butter)', b: 'var(--mk-orange)', ink: 'var(--mk-rust)' },
  moon: { a: 'var(--mk-lilac)', b: 'var(--mk-violet)', ink: 'var(--mk-indigo-deep)' },
  heart: { a: 'var(--mk-blossom)', b: 'var(--mk-rose-deep)', ink: 'var(--mk-plum)' },
};
/** Each sticker in a 40 by 40 box about its centre. */
const STICKER_SHAPE: Readonly<Record<BottleSticker, string>> = {
  star: 'M0 -17.5C1.4 -17.5 2.2 -16.6 2.9 -15.1L6.4 -8.1L14 -7C15.8 -6.7 16.6 -5.9 16.9 -4.9C17.2 -3.7 16.7 -2.7 15.5 -1.6L10 3.8L11.3 11.4C11.6 13.2 11.2 14.3 10.3 14.9C9.3 15.6 8.1 15.4 6.6 14.6L0 11.1L-6.6 14.6C-8.1 15.4 -9.3 15.6 -10.3 14.9C-11.2 14.3 -11.6 13.2 -11.3 11.4L-10 3.8L-15.5 -1.6C-16.7 -2.7 -17.2 -3.7 -16.9 -4.9C-16.6 -5.9 -15.8 -6.7 -14 -7L-6.4 -8.1L-2.9 -15.1C-2.2 -16.6 -1.4 -17.5 0 -17.5Z',
  leaf: 'M-14 15C-17 6 -14 -6 -5 -12C2 -16.5 10 -17 16 -16.5C16.8 -9 15.5 1 9 8C3 14.5 -6 17 -14 15Z',
  wave: 'M-17 13C-17 2 -11 -9 0 -12.5C8 -15 15.5 -12 17 -6C11.5 -9 5 -7.5 3 -2.5C1.5 1.5 4.5 5.5 9.5 5.5C12.5 5.5 15 4.5 17 3L17 13Z',
  sun: 'M0 -18L3.2 -11.4L10.6 -14.6L9.3 -7.4L16.8 -5.2L11 0L16.8 5.2L9.3 7.4L10.6 14.6L3.2 11.4L0 18L-3.2 11.4L-10.6 14.6L-9.3 7.4L-16.8 5.2L-11 0L-16.8 -5.2L-9.3 -7.4L-10.6 -14.6L-3.2 -11.4Z',
  moon: 'M3 -16.5C-6.5 -15.5 -14 -7.5 -14 1.5C-14 10.5 -6.5 17.5 2.5 17.5C8.5 17.5 13.5 14.5 16 9.5C13.5 11 10.5 11.8 7.5 11.8C-1 11.8 -7 5.5 -7 -2.5C-7 -8.5 -3.5 -13.8 3 -16.5Z',
  heart: 'M0 16C-3 13.4 -15.5 5.8 -15.5 -4C-15.5 -10.5 -10.8 -14.5 -6.2 -14.5C-3.2 -14.5 -1.2 -12.8 0 -10.6C1.2 -12.8 3.2 -14.5 6.2 -14.5C10.8 -14.5 15.5 -10.5 15.5 -4C15.5 5.8 3 13.4 0 16Z',
};

/** One vinyl sticker: a thin white die-cut edge, a soft two-tone print, a
 * small printed detail and a gloss. */
export function StickerArt({ uid, art, lift = false }: { uid: string; art: BottleSticker; lift?: boolean }) {
  const { id, url } = ids(uid);
  const paint = STICKER_PAINT[art], d = STICKER_SHAPE[art];
  return <g>
    <defs><linearGradient id={id(`st-${art}`)} x1="0" y1="0" x2=".6" y2="1"><stop offset="0" style={stop(paint.a)} /><stop offset="1" style={stop(paint.b)} /></linearGradient></defs>
    <path d={d} transform={lift ? 'translate(1.5 3)' : 'translate(0.6 1.2)'} style={{ fill: 'var(--mk-shadow)', opacity: lift ? 0.25 : 0.22, stroke: 'var(--mk-shadow)', strokeWidth: 4.5, strokeLinejoin: 'round' }} />
    <path d={d} style={{ fill: 'var(--mk-white)', stroke: 'var(--mk-white)', strokeWidth: 4.5, strokeLinejoin: 'round' }} />
    <path d={d} style={{ fill: url(`st-${art}`) }} />
    <StickerDetail art={art} ink={paint.ink} />
    <path d="M-11 -9C-7 -13 -1 -14 3 -13" style={{ fill: 'none', stroke: 'var(--mk-white)', strokeOpacity: 0.55, strokeWidth: 2.2, strokeLinecap: 'round' }} />
  </g>;
}
function StickerDetail({ art, ink }: { art: BottleSticker; ink: string }) {
  const line = (d: string, w = 1.8, o = 0.55) => <path d={d} style={{ fill: 'none', stroke: ink, strokeOpacity: o, strokeWidth: w, strokeLinecap: 'round', strokeLinejoin: 'round' }} />;
  switch (art) {
    case 'star': return <path d="M0 -7L2 -2.6L6.6 -2.2L3.1 1L4.1 5.6L0 3.2L-4.1 5.6L-3.1 1L-6.6 -2.2L-2 -2.6Z" style={{ fill: 'var(--mk-white)', opacity: 0.45 }} />;
    case 'leaf': return <>{line('M-11 12C-4 4 4 -4 13 -13', 1.6, 0.6)}{line('M-3 4.5L-4 -3M3 -2L1.5 -9M3 -2L10 -3.5M-3 4.5L5 3', 1.2, 0.45)}</>;
    case 'wave': return <>{line('M-13 9C-11 2 -6 -4 1 -6.5', 1.5, 0.35)}<circle cx="11" cy="-1" r="1.6" style={{ fill: 'var(--mk-white)', opacity: 0.8 }} /><circle cx="14" cy="-4.5" r="1" style={{ fill: 'var(--mk-white)', opacity: 0.7 }} /></>;
    case 'sun': return <><circle r="8.6" style={{ fill: 'var(--mk-sun)' }} /><circle r="8.6" style={{ fill: 'none', stroke: ink, strokeOpacity: 0.3, strokeWidth: 1.2 }} />{line('M-3.5 1.8C-1.8 3.8 1.8 3.8 3.5 1.8', 1.4, 0.6)}<circle cx="-3" cy="-2" r="1.1" style={{ fill: ink, opacity: 0.6 }} /><circle cx="3" cy="-2" r="1.1" style={{ fill: ink, opacity: 0.6 }} /></>;
    case 'moon': return <><path d="M10.5 -11L11.6 -8.4L14.3 -8.1L12.3 -6.3L12.9 -3.6L10.5 -5L8.1 -3.6L8.7 -6.3L6.7 -8.1L9.4 -8.4Z" style={{ fill: 'var(--mk-butter)' }} /><circle cx="-6" cy="5" r="1.8" style={{ fill: ink, opacity: 0.25 }} /><circle cx="-2" cy="11" r="1.2" style={{ fill: ink, opacity: 0.25 }} /></>;
    case 'heart': return <path d="M-9 -6C-9 -9 -6.5 -10.5 -4.5 -10" style={{ fill: 'none', stroke: 'var(--mk-white)', strokeOpacity: 0.6, strokeWidth: 2.4, strokeLinecap: 'round' }} />;
  }
}

/** Where a slot is drawn: its centre, size and foreshortening at a turn. */
export function slotPlace(shape: ShapeId, slot: number, rotation: number) {
  const v = slotView(slot, rotation), y = PROFILES[shape].rows[v.row], r = radiusAt(shape, y) * (1 + 0.02);
  return { ...v, cx: AXIS_X + v.x * r, cy: y + v.depth * r * ELLIPSE, size: PROFILES[shape].sticker };
}

/** The stickers on one half of the bottle. The far half is seen through the
 * glass: its stickers mirrored, faint and softened. */
export function StickerLayer({ uid, shape, stickers, rotation, side, peeling }: { uid: string; shape: ShapeId; stickers: readonly BottleStickerPlacement[]; rotation: number; side: 'back' | 'front'; peeling?: number | null }) {
  const { url } = ids(uid);
  const shown = stickers.map(s => ({ s, p: slotPlace(shape, s.slot, rotation) })).filter(({ p }) => side === 'front' ? p.front : !p.front)
    // Far to near, so a nearer sticker covers a farther one.
    .sort((a, b) => a.p.depth - b.p.depth);
  if (!shown.length) return null;
  return <g clipPath={url('outer')} filter={side === 'back' ? url('backSticker') : undefined} style={side === 'back' ? { opacity: 0.5 } : undefined}>
    {shown.map(({ s, p }) => {
      const k = p.size / 40, sx = (side === 'back' ? p.depth : Math.max(0.02, p.scaleX)) * k;
      return <g key={s.slot} data-bl-sticker={s.art} data-slot={s.slot} transform={`translate(${p.cx.toFixed(2)} ${p.cy.toFixed(2)}) scale(${sx.toFixed(3)} ${k.toFixed(3)})`} style={peeling === s.slot ? { opacity: 0.4 } : undefined}>
        <StickerArt uid={uid} art={s.art} />
      </g>;
    })}
  </g>;
}

/** The rings that show where a picked sticker can go. */
export function SlotRings({ uid, shape, slots, rotation, hot }: { uid: string; shape: ShapeId; slots: readonly number[]; rotation: number; hot?: number | null }) {
  const { url } = ids(uid);
  return <g clipPath={url('outer')} className="bl-rings">
    {slots.map(slot => {
      const p = slotPlace(shape, slot, rotation), r = p.size * 0.52;
      return <g key={slot} transform={`translate(${p.cx.toFixed(2)} ${p.cy.toFixed(2)}) scale(${p.scaleX.toFixed(3)} 1)`} data-hot={hot === slot}>
        <circle r={r} style={{ fill: 'var(--mk-white)', opacity: hot === slot ? 0.55 : 0.28 }} />
        <circle r={r} className="bl-ring" style={{ fill: 'none', stroke: hot === slot ? 'var(--studio-action-gold)' : 'var(--mk-white)', strokeWidth: hot === slot ? 3.2 : 2.2, strokeDasharray: '5 4' }} />
      </g>;
    })}
  </g>;
}

/** A few resting bubbles for a still picture, the same every time. */
export function StillBubbles({ uid, shape, count = 9 }: { uid: string; shape: ShapeId; count?: number }) {
  const { url } = ids(uid);
  let seed = 11;
  const roll = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const list = Array.from({ length: count }, (_, i) => spawnBubble(shape, i, roll, AXIS_X, true));
  return <g clipPath={url('inner')}>{list.map(b => <circle key={b.id} cx={b.x} cy={b.y} r={b.r} style={{ fill: url('bubble') }} />)}</g>;
}

// ── The whole still life in one picture (preview and cover) ───────────────

export interface StillContentProps {
  uid: string; shape: ShapeId; finish: BottleFinish; stickers: readonly BottleStickerPlacement[];
  rotation: number; lamp: number; map: RefractionMap | null; showLamp?: boolean;
}
/** Every layer, back to front, for a picture that does not move. */
export function StillContent({ uid, shape, finish, stickers, rotation, lamp, map, showLamp = true }: StillContentProps) {
  return <>
    <BottleDefs uid={uid} shape={shape} finish={finish} map={map} />
    <Backdrop uid={uid} />
    <LampLight uid={uid} angle={lamp} on />
    <TableShadow uid={uid} shape={shape} angle={lamp} on />
    {showLamp && <Lamp uid={uid} angle={lamp} on />}
    <GlassInside uid={uid} shape={shape} finish={finish} />
    <StillBubbles uid={uid} shape={shape} />
    <StickerLayer uid={uid} shape={shape} stickers={stickers} rotation={rotation} side="back" />
    <GlassFront uid={uid} shape={shape} finish={finish} />
    <WaterSurface uid={uid} shape={shape} />
    <StickerLayer uid={uid} shape={shape} stickers={stickers} rotation={rotation} side="front" />
    <GlassLight uid={uid} shape={shape} finish={finish} angle={lamp} on />
    <Cap uid={uid} shape={shape} rotation={rotation} angle={lamp} on />
  </>;
}
