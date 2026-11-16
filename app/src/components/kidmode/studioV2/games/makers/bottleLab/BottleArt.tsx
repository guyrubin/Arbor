/** Bottle Lab art: the layers shared by the play view, the kept bottle's
 * preview and the cover. Glass Grove's bottle bench: the kit's arched pavilion
 * room (a shipped picture), the kit lamp, Aya, and one procedural thing, the
 * glass bottle. The glass is never outlined; it is made of what glass does to
 * light: the room seen through it (bent by a real displacement map, so the
 * arches and the valley flip in the water), a tint that deepens toward the
 * edges, the dark and bright refraction bands along the outline, the lamp's
 * streak and rim, and its coloured shadow with the light the water focuses.
 *
 * Every colour is a maker-palette or Studio token through var() and
 * color-mix(); the tint of the glass travels as --bl-* properties. */
import type { CSSProperties, ReactNode } from 'react';
import { AXIS_X, BASE_Y, ELLIPSE, PROFILES, SCENE_H, SCENE_W, WALL, bandPath, baseRadius, bottomY, innerPath, maxRadius, radiusAt, silhouettePath, topY, waterPath, type ShapeId } from './bottleGeometry';
import { KIT_AYA, KIT_LAMP, KIT_ROOM, STICKER_PRINT } from './bottleKit';
import { lampEffects, lampPosition, slotView, spawnBubble, type BottleFinish, type BottleSticker, type BottleStickerPlacement, type BottleTint } from './bottleLabRules';
import type { RefractionMap } from './bottleRefraction';
import { AYA, stickerShade } from './bottleToys';

const mix = (a: string, b: string, p: number) => `color-mix(in srgb, var(${a}) ${p}%, var(${b}))`;
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

/** One refraction filter: the picture behind, resampled through a map. It
 * works only on the bottle's own patch of the scene (plus the strip either
 * side that the water lens reaches into). */
function Refract({ id, map, frost }: { id: string; map: RefractionMap | null | undefined; frost: boolean }) {
  const box = map ? { x: map.x - map.width * 0.2, y: map.y - 24, width: map.width * 1.4, height: map.height + 48 } : { x: 0, y: 0, width: SCENE_W, height: SCENE_H };
  return <filter id={id} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" {...box} colorInterpolationFilters="sRGB">
    {map && <feImage href={map.href} x={map.x} y={map.y} width={map.width} height={map.height} preserveAspectRatio="none" result="map" />}
    {map ? <feDisplacementMap in="SourceGraphic" in2="map" scale={map.scale} xChannelSelector="R" yChannelSelector="G" result="bent" /> : <feOffset in="SourceGraphic" result="bent" />}
    <feGaussianBlur in="bent" stdDeviation={frost ? 5 : 0.35} />
  </filter>;
}

/** Shared definitions; put them in the first layer of a drawing. `map` bends
 * a still picture; play passes `air` and `wet` as well (see bottleRefraction). */
export function BottleDefs({ uid, shape, finish, map, air, wet }: { uid: string; shape: ShapeId; finish: BottleFinish; map: RefractionMap | null; air?: RefractionMap | null; wet?: RefractionMap | null }) {
  const { id } = ids(uid);
  const frost = finish === 'frost';
  return <defs>
    <clipPath id={id('outer')}><path d={silhouettePath(shape)} /></clipPath>
    <clipPath id={id('inner')}><path d={innerPath(shape)} /></clipPath>
    <clipPath id={id('water')}><path d={waterPath(shape)} /></clipPath>
    <filter id={id('frostGrain')} x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" stitchTiles="stitch" /><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.05" /></filter>
    <filter id={id('soft1')} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.2" /></filter>
    <filter id={id('soft3')} x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="3.2" /></filter>
    <filter id={id('soft')} x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation={frost ? 2.2 : 0.7} /></filter>
    <filter id={id('backSticker')} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={frost ? 3 : 0.9} /></filter>
    <Refract id={id('refract')} map={map} frost={frost} />
    {air !== undefined && <Refract id={id('refractAir')} map={air} frost={frost} />}
    {wet !== undefined && <Refract id={id('refractWet')} map={wet} frost={frost} />}
    <linearGradient id={id('water')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop('var(--bl-water)', 0.16)} /><stop offset="1" style={stop('var(--bl-water)', 0.34)} /></linearGradient>
    <linearGradient id={id('body')} gradientUnits="userSpaceOnUse" x1={AXIS_X - maxRadius(shape)} x2={AXIS_X + maxRadius(shape)} y1="0" y2="0">
      <stop offset="0" style={stop('var(--bl-edge)', 0.75)} /><stop offset=".22" style={stop('var(--bl-glass)', 0.55)} /><stop offset=".5" style={stop('var(--bl-glass)', 0.35)} /><stop offset=".78" style={stop('var(--bl-glass)', 0.55)} /><stop offset="1" style={stop('var(--bl-edge)', 0.75)} />
    </linearGradient>
    <linearGradient id={id('streak')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop('var(--mk-white)', 0)} /><stop offset=".12" style={stop('var(--mk-white)', 1)} /><stop offset=".5" style={stop('var(--mk-white)', 0.75)} /><stop offset="1" style={stop('var(--mk-white)', 0)} /></linearGradient>
    <linearGradient id={id('rim')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop('var(--bl-light)', 0)} /><stop offset=".3" style={stop('var(--bl-light)', 1)} /><stop offset="1" style={stop('var(--bl-light)', 0.2)} /></linearGradient>
    {/* The cap: pale kit wood with a teal ring and loop. */}
    <linearGradient id={id('cap')} x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={stop('var(--mk-wood)')} /><stop offset=".2" style={stop('var(--mk-wood-light)')} /><stop offset=".42" style={stop(mix('--mk-wood-light', '--mk-white', 62))} /><stop offset=".62" style={stop('var(--mk-wood-light)')} /><stop offset="1" style={stop(mix('--mk-wood', '--mk-wood-dark', 62))} /></linearGradient>
    <linearGradient id={id('capTop')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={stop(mix('--mk-wood-light', '--mk-white', 50))} /><stop offset="1" style={stop('var(--mk-wood-light)')} /></linearGradient>
    <linearGradient id={id('loop')} x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={stop('var(--mk-teal-deep)')} /><stop offset=".4" style={stop('var(--mk-sea)')} /><stop offset="1" style={stop('var(--mk-teal)')} /></linearGradient>
    <radialGradient id={id('caustic')}><stop offset="0" style={stop(mix('--bl-light', '--mk-white', 40))} /><stop offset=".45" style={stop(mix('--bl-glass', '--mk-white', 45), 0.7)} /><stop offset="1" style={stop('var(--bl-glass)', 0)} /></radialGradient>
    <radialGradient id={id('lampPool')}><stop offset="0" style={stop('var(--mk-butter)', 0.5)} /><stop offset=".55" style={stop('var(--mk-butter)', 0.16)} /><stop offset="1" style={stop('var(--mk-butter)', 0)} /></radialGradient>
    <radialGradient id={id('bulb')}><stop offset="0" style={stop('var(--mk-white)')} /><stop offset=".35" style={stop('var(--mk-sun)', 0.8)} /><stop offset="1" style={stop('var(--mk-sun)', 0)} /></radialGradient>
    <radialGradient id={id('bubble')} cx=".4" cy=".36" r=".64" fx=".34" fy=".28"><stop offset="0" style={stop('var(--mk-white)', 1)} /><stop offset=".28" style={stop('var(--mk-white)', 0.4)} /><stop offset=".68" style={stop('var(--bl-light)', 0.1)} /><stop offset=".9" style={stop('var(--bl-deep)', 0.42)} /><stop offset="1" style={stop('var(--bl-deep)', 0.6)} /></radialGradient>
    <linearGradient id={id('frost')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop('var(--mk-white)', 0.5)} /><stop offset="1" style={stop('var(--mk-white)', 0.3)} /></linearGradient>
  </defs>;
}

// ── The room ───────────────────────────────────────────────────────────────

const L = KIT_ROOM.place.x, T = KIT_ROOM.place.y, W = KIT_ROOM.place.width, H = KIT_ROOM.place.height;

/** The kit's pavilion room. Drawn as the room, and again through the glass. */
export function Backdrop({ small = false }: { small?: boolean }) {
  return <image href={small ? KIT_ROOM.src480 : KIT_ROOM.src} x={L} y={T} width={W} height={H} preserveAspectRatio="none" />;
}

/** Where the lamp's bulb is, for its glow. */
const lampHead = (angle: number) => { const p = lampPosition(angle); return { x: p.x + p.face * 36, y: p.y - 76 }; };

/** The lamp's warm pool on the floor and wall, or the room's dimmer light with the lamp off. */
export function LampLight({ uid, angle, on }: { uid: string; angle: number; on: boolean }) {
  const { url } = ids(uid);
  if (!on) return <rect x={L} y={T} width={W} height={H} style={fill(mix('--mk-indigo', '--mk-slate', 50), 0.2)} />;
  const h = lampHead(angle), toward = h.x + (AXIS_X - h.x) * 0.5;
  return <g>
    <ellipse cx={toward} cy={BASE_Y - 4} rx="150" ry="50" style={{ fill: url('lampPool'), opacity: 0.9 }} />
    <ellipse cx={toward} cy={h.y + 30} rx="130" ry="110" style={{ fill: url('lampPool'), opacity: 0.5 }} />
  </g>;
}

/** The bottle's own shadow laid on the floor away from the lamp (neck at the
 * far end): not grey but the colour of its glass, with the bright patch the
 * water focuses inside it and a small dark shape for every sticker. */
export function TableShadow({ uid, shape, angle, on, stickers = [], rotation = 0 }: { uid: string; shape: ShapeId; angle: number; on: boolean; stickers?: readonly BottleStickerPlacement[]; rotation?: number }) {
  const { url } = ids(uid);
  const fx = lampEffects(angle, on);
  const a = fx.shadowAngle * Math.PI / 180, dir = { x: Math.cos(a), y: Math.sin(a) };
  // Across the shadow, depth on the floor is squashed by the view from above.
  const nx = -dir.y, ny = dir.x * ELLIPSE * 2.2, nl = Math.hypot(nx, ny) || 1, wide = Math.max(0.36, nl);
  const n = { x: nx / nl * wide, y: ny / nl * wide };
  const top = topY(shape), height = BASE_Y - top;
  const at = (t: number, u: number, r: number) => ({ x: AXIS_X + dir.x * fx.shadowLength * t + n.x * r * u, y: BASE_Y + dir.y * fx.shadowLength * t + n.y * r * u });
  const outline = (k: number) => {
    const left: string[] = [], right: string[] = [];
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const r = Math.max(radiusAt(shape, BASE_Y - t * height), t > 0.98 ? radiusAt(shape, top) : 0) * k, p = at(t, 1, r), q = at(t, -1, r);
      left.push(`${p.x.toFixed(1)} ${p.y.toFixed(1)}`); right.unshift(`${q.x.toFixed(1)} ${q.y.toFixed(1)}`);
    }
    return `M${left.join('L')}L${right.join('L')}Z`;
  };
  const rb = baseRadius(shape);
  const ct = fx.causticAt, cr = radiusAt(shape, BASE_Y - ct * height) || maxRadius(shape), cc = at(ct, 0, 0);
  const along = Math.max(10, fx.shadowLength * 0.22 * fx.causticSize), across = cr * fx.causticSize * wide;
  const turn = `rotate(${fx.shadowAngle.toFixed(1)})`;
  return <g>
    <g filter={url('soft3')}>
      <path d={outline(1)} style={fill(mix('--bl-deep', '--mk-shadow', 55), fx.shadowOpacity * 0.72)} />
      {on && <path d={outline(0.7)} style={fill(mix('--bl-glass', '--bl-light', 70), 0.5)} />}
    </g>
    {on && <g filter={url('soft1')}>{stickers.map(s => {
      const v = stickerShade(shape, s, rotation, angle), p = at(v.t, v.u * 0.82, v.radius), half = PROFILES[shape].sticker / 2;
      return <ellipse key={s.slot} data-bl-shade={s.slot} rx={Math.max(3, fx.shadowLength * half / height)} ry={Math.max(2, half * v.wide * wide)} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) ${turn}`} style={fill('var(--mk-shadow)', 0.3)} />;
    })}</g>}
    {/* Contact shadow: where the glass touches the floor it is always darkest. */}
    <ellipse cx={AXIS_X} cy={BASE_Y + 1.5} rx={rb * 1.04} ry={rb * ELLIPSE * 1.15} filter={url('soft1')} style={fill('var(--mk-shadow)', on ? 0.36 : 0.26)} />
    {fx.causticOpacity > 0 && <ellipse rx={along} ry={Math.max(4, across * 0.55)} transform={`translate(${cc.x.toFixed(1)} ${cc.y.toFixed(1)}) ${turn}`} style={{ fill: url('caustic'), opacity: fx.causticOpacity }} />}
  </g>;
}

/** The kit's desk lamp, standing just behind the bottle's line. Its head
 * always leans toward the glass; it swivels as it passes behind the bottle. */
export const LAMP_SIZE = { width: 84, height: 103, foot: 27 } as const;
export function Lamp({ uid, angle, on, shadow = true }: { uid: string; angle: number; on: boolean; shadow?: boolean }) {
  const { url } = ids(uid);
  const p = lampPosition(angle), face = Math.abs(p.face) < 0.3 ? (p.face < 0 ? -0.3 : 0.3) : p.face;
  return <g transform={`translate(${p.x.toFixed(1)} ${p.y})`} data-bl-lamp-art="">
    {shadow && <ellipse cy="-1" rx="27" ry="5" filter={url('soft1')} style={fill('var(--mk-shadow)', 0.26)} />}
    <g transform={`scale(${face.toFixed(3)} 1)`}>
      <image href={KIT_LAMP.src} x={-LAMP_SIZE.foot} y={3 - LAMP_SIZE.height} width={LAMP_SIZE.width} height={LAMP_SIZE.height} preserveAspectRatio="none" style={on ? undefined : { filter: 'saturate(.45) brightness(.86)' }} />
      {on && <circle cx="36" cy="-74" r="26" style={{ fill: url('bulb'), opacity: 0.6 }} />}
    </g>
  </g>;
}

/** Aya, feet at (x, y). Every pose is one square canvas with the feet on its bottom edge. */
const AYA_BOX = AYA.height / 415 * 440;
export function AyaArt({ uid, mood = 'idle', x, y, shadow = true }: { uid: string; mood?: 'idle' | 'happy'; x: number; y: number; shadow?: boolean }) {
  const { url } = ids(uid);
  return <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
    {shadow && <ellipse cy="-2" rx="20" ry="4.5" filter={url('soft1')} style={fill('var(--mk-shadow)', 0.3)} />}
    <image href={KIT_AYA[mood].src} x={-AYA_BOX / 2} y={-AYA_BOX * 427 / 440} width={AYA_BOX} height={AYA_BOX} preserveAspectRatio="none" />
  </g>;
}

// ── The glass ──────────────────────────────────────────────────────────────

/** What is seen through the glass. `still` is the whole of it for a picture
 * that does not move: the room bent by the map, the far wall's tint, the
 * water. Play draws it in two parts so the water line can move for nothing:
 * `air` (the whole inside as it looks with no water) and, above it and cut
 * off at the water line by the stage, `wet` (the whole inside as it looks
 * full of water). `children` stand behind the bottle and are bent with the room. */
export function GlassInside({ uid, shape, finish, part = 'still', small = false, children }: { uid: string; shape: ShapeId; finish: BottleFinish; part?: 'still' | 'air' | 'wet'; small?: boolean; children?: ReactNode }) {
  const { url } = ids(uid);
  const level = PROFILES[shape].water, rw = radiusAt(shape, level) * (1 - WALL), rb = baseRadius(shape);
  const bent = part === 'air' ? 'refractAir' : part === 'wet' ? 'refractWet' : 'refract';
  return <g>
    <g clipPath={url(part === 'wet' ? 'inner' : 'outer')}>
      <g filter={url(bent)}><Backdrop small={small} />{children}</g>
      {/* the far wall of the glass: tinted, a little darker at the sides */}
      <path d={silhouettePath(shape)} style={{ fill: url('body'), opacity: 'var(--bl-body)' } as CSSProperties} />
    </g>
    <g clipPath={url('inner')}>
      {part === 'still' && <path d={waterPath(shape)} style={{ fill: url('water') }} />}
      {part === 'wet' && <path d={innerPath(shape)} style={{ fill: url('water') }} />}
      {/* the underside of the far water line catches the light */}
      {part === 'still' && <ellipse cx={AXIS_X} cy={level} rx={rw} ry={rw * ELLIPSE} style={fill(mix('--bl-light', '--mk-white', 50), 0.32)} />}
      {/* the thick glass of the base */}
      <ellipse cx={AXIS_X} cy={BASE_Y - 5} rx={rb * 0.9} ry={rb * ELLIPSE * 0.9} style={fill('var(--bl-deep)', 0.2)} />
    </g>
    {finish === 'frost' && <g clipPath={url(part === 'wet' ? 'inner' : 'outer')}>
      <path d={silhouettePath(shape)} style={{ fill: url('frost') }} />
      {part !== 'wet' && <rect x={AXIS_X - 100} y={topY(shape) - 4} width="200" height={bottomY(shape) - topY(shape) + 8} filter={url('frostGrain')} style={fill('var(--mk-white)', 0.14)} />}
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
    <Lip shape={shape} frost={frost} />
  </g>;
}

/** The open mouth of the bottle: a thick glass lip. The cap sits over it when it is on. */
function Lip({ shape, frost }: { shape: ShapeId; frost: boolean }) {
  const top = topY(shape), r = radiusAt(shape, top), ry = r * ELLIPSE;
  return <g>
    <ellipse cx={AXIS_X} cy={top} rx={r * 0.78} ry={ry * 0.78} style={fill('var(--bl-deep)', frost ? 0.2 : 0.34)} />
    <ellipse cx={AXIS_X} cy={top} rx={r * 0.92} ry={ry * 0.92} style={{ fill: 'none', stroke: 'var(--bl-light)', strokeOpacity: frost ? 0.5 : 0.95, strokeWidth: 1.8 }} />
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

/** The pale-wood cap with its teal ring and carry loop. The loop turns with the bottle. */
export function Cap({ uid, shape, rotation, angle, on }: { uid: string; shape: ShapeId; rotation: number; angle: number; on: boolean }) {
  const { url } = ids(uid);
  const top = topY(shape), r = radiusAt(shape, top) + 4.5, h = 30, y0 = top - h + 8, ry = r * ELLIPSE;
  const fx = lampEffects(angle, on);
  const turn = Math.cos(rotation * Math.PI / 180), loopW = Math.max(1.2, 11 * Math.abs(turn));
  const band = (dy: number) => `M${AXIS_X - r} ${y0 + dy}A${r} ${ry} 0 0 0 ${AXIS_X + r} ${y0 + dy}`;
  return <g>
    <ellipse cx={AXIS_X} cy={y0 + h + 0.5} rx={r + 1} ry={ry + 1} filter={url('soft1')} style={fill('var(--mk-shadow)', 0.3)} />
    {/* the loop behind the cap top */}
    <ellipse cx={AXIS_X} cy={y0 - 10} rx={loopW} ry="13" style={{ fill: 'none', stroke: 'var(--mk-teal-deep)', strokeWidth: 5.5 }} />
    <ellipse cx={AXIS_X} cy={y0 - 10} rx={loopW} ry="13" style={{ fill: 'none', stroke: url('loop'), strokeWidth: 3.6 }} />
    <path d={`M${AXIS_X - loopW} ${y0 - 10}A${loopW} 13 0 0 1 ${AXIS_X - loopW * 0.2} ${y0 - 22.6}`} style={{ fill: 'none', stroke: 'var(--mk-white)', strokeOpacity: 0.6, strokeWidth: 1.1 }} />
    <rect x={AXIS_X - 5} y={y0 - 4} width="10" height="6" rx="2" style={fill('var(--mk-teal-deep)')} />
    <path d={`M${AXIS_X - r} ${y0}L${AXIS_X - r} ${y0 + h}A${r} ${ry} 0 0 0 ${AXIS_X + r} ${y0 + h}L${AXIS_X + r} ${y0}Z`} style={{ fill: url('cap') }} />
    {[7, 13, 18].map(dy => <path key={dy} d={band(dy)} style={{ fill: 'none', stroke: 'var(--mk-wood-dark)', strokeOpacity: 0.16, strokeWidth: 0.7 }} />)}
    {/* the teal ring where the cap meets the glass */}
    <path d={`${band(h - 6)}L${AXIS_X + r} ${y0 + h}A${r} ${ry} 0 0 1 ${AXIS_X - r} ${y0 + h}Z`} style={fill('var(--mk-teal)')} />
    <path d={band(h - 6)} style={{ fill: 'none', stroke: 'var(--mk-sky-pale)', strokeOpacity: 0.7, strokeWidth: 0.8 }} />
    <rect x={AXIS_X + fx.streakU * r * 0.9 - 2} y={y0 + 2} width="4" height={h - 10} rx="2" style={fill('var(--mk-white)', on ? 0.5 : 0.25)} />
    <ellipse cx={AXIS_X} cy={y0} rx={r} ry={ry} style={{ fill: url('capTop') }} />
    <ellipse cx={AXIS_X} cy={y0} rx={r} ry={ry} style={{ fill: 'none', stroke: 'var(--mk-white)', strokeOpacity: 0.6, strokeWidth: 0.8 }} />
  </g>;
}
/** Where the cap's hinge is: it flips open about this point of the picture. */
export const capHinge = (shape: ShapeId) => ({ x: AXIS_X - radiusAt(shape, topY(shape)) - 4.5, y: topY(shape) + 8 });

// ── Stickers ───────────────────────────────────────────────────────────────

const STICKER_RING: Readonly<Record<BottleSticker, string>> = {
  star: '--mk-orange', leaf: '--mk-leaf', wave: '--mk-water', sun: '--mk-amber', moon: '--mk-bluebell', heart: '--mk-rose',
};
const DISC = 18;
/** One vinyl sticker: a round white die-cut disc printed with a kit motif
 * (a companion's face, Aya's leaf, the petal sun, the knit flower), a thin
 * ring of its own colour and a gloss. Drawn about its centre in a 40 box. */
export function StickerArt({ art, lift = false }: { uid?: string; art: BottleSticker; lift?: boolean }) {
  const print = STICKER_PRINT[art], ring = STICKER_RING[art], size = DISC * 2 * print.fit;
  const [cx, cy, crop] = print.crop;
  return <g>
    <circle r={DISC + 1} transform={lift ? 'translate(1.6 3.2)' : 'translate(0.6 1.3)'} style={fill('var(--mk-shadow)', lift ? 0.22 : 0.26)} />
    <circle r={DISC + 1} style={fill('var(--mk-white)')} />
    <circle r={DISC - 1.4} style={fill(mix(ring, '--mk-white', 16))} />
    <circle r={DISC - 1.4} style={{ fill: 'none', stroke: `var(${ring})`, strokeOpacity: 0.55, strokeWidth: 1.3 }} />
    <svg x={-size / 2} y={-size / 2} width={size} height={size} viewBox={`${cx} ${cy} ${crop} ${crop}`} overflow="hidden"><image href={print.picture.src} width={print.picture.width} height={print.picture.height} /></svg>
    <path d="M-12.5 -8C-9 -13 -3.5 -15.5 2 -15.5" style={{ fill: 'none', stroke: 'var(--mk-white)', strokeOpacity: 0.7, strokeWidth: 2, strokeLinecap: 'round' }} />
  </g>;
}

/** Where a slot is drawn: its centre, size and foreshortening at a turn. */
export function slotPlace(shape: ShapeId, slot: number, rotation: number) {
  const v = slotView(slot, rotation), y = PROFILES[shape].rows[v.row], r = radiusAt(shape, y) * (1 + 0.02);
  return { ...v, cx: AXIS_X + v.x * r, cy: y + v.depth * r * ELLIPSE, size: PROFILES[shape].sticker };
}

/** The stickers on one half of the bottle. The far half is seen through the
 * glass: its stickers mirrored, faint and softened. `fresh` is the slot just
 * pressed on (it gets the press and the smoothed-out air bubble); `ghost` is
 * a sticker being peeled off. */
export function StickerLayer({ uid, shape, stickers, rotation, side, fresh = null, ghost = null }: { uid: string; shape: ShapeId; stickers: readonly BottleStickerPlacement[]; rotation: number; side: 'back' | 'front'; fresh?: number | null; ghost?: BottleStickerPlacement | null }) {
  const { url } = ids(uid);
  const all = ghost && side === 'front' ? [...stickers, ghost] : stickers;
  const shown = all.map(s => ({ s, p: slotPlace(shape, s.slot, rotation) })).filter(({ p }) => side === 'front' ? p.front : !p.front)
    // Far to near, so a nearer sticker covers a farther one.
    .sort((a, b) => a.p.depth - b.p.depth);
  if (!shown.length) return null;
  return <g clipPath={url('outer')} filter={side === 'back' ? url('backSticker') : undefined} style={side === 'back' ? { opacity: 0.5 } : undefined}>
    {shown.map(({ s, p }) => {
      const k = p.size / 40, sx = (side === 'back' ? p.depth : Math.max(0.02, p.scaleX)) * k, peeling = s === ghost;
      return <g key={peeling ? 'ghost' : s.slot} data-bl-sticker={peeling ? undefined : s.art} data-slot={s.slot} transform={`translate(${p.cx.toFixed(2)} ${p.cy.toFixed(2)}) scale(${sx.toFixed(3)} ${k.toFixed(3)})`}>
        <g className={peeling ? 'bl-vinyl bl-vinyl--peel' : fresh === s.slot ? 'bl-vinyl bl-vinyl--press' : 'bl-vinyl'}>
          <StickerArt art={s.art} />
          {fresh === s.slot && !peeling && <ellipse className="bl-vinyl__air" cx="3" cy="2" rx="6.5" ry="5" style={fill('var(--mk-white)', 0.75)} />}
        </g>
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
        <circle r={r} style={{ fill: 'var(--mk-white)', opacity: hot === slot ? 0.6 : 0.3 }} />
        <circle r={r} className="bl-ring" style={{ fill: 'none', stroke: hot === slot ? 'var(--studio-signal)' : 'var(--mk-white)', strokeWidth: hot === slot ? 3.4 : 2.4, strokeDasharray: '5 4' }} />
        <circle r={r + 1.6} style={{ fill: 'none', stroke: 'var(--studio-graphite)', strokeOpacity: 0.28, strokeWidth: 0.8 }} />
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
  rotation: number; lamp: number; map: RefractionMap | null; showLamp?: boolean; friend?: boolean; small?: boolean;
}
/** Every layer, back to front, for a picture that does not move. */
export function StillContent({ uid, shape, finish, stickers, rotation, lamp, map, showLamp = true, friend = false, small = false }: StillContentProps) {
  return <>
    <BottleDefs uid={uid} shape={shape} finish={finish} map={map} />
    <Backdrop small={small} />
    <LampLight uid={uid} angle={lamp} on />
    <TableShadow uid={uid} shape={shape} angle={lamp} on stickers={stickers} rotation={rotation} />
    {showLamp && <Lamp uid={uid} angle={lamp} on />}
    {friend && <AyaArt uid={uid} x={AXIS_X + AYA.reach} y={AYA.feet} />}
    <GlassInside uid={uid} shape={shape} finish={finish} small={small} />
    <StillBubbles uid={uid} shape={shape} />
    <StickerLayer uid={uid} shape={shape} stickers={stickers} rotation={rotation} side="back" />
    <GlassFront uid={uid} shape={shape} finish={finish} />
    <WaterSurface uid={uid} shape={shape} />
    <StickerLayer uid={uid} shape={shape} stickers={stickers} rotation={rotation} side="front" />
    <GlassLight uid={uid} shape={shape} finish={finish} angle={lamp} on />
    <Cap uid={uid} shape={shape} rotation={rotation} angle={lamp} on />
  </>;
}
