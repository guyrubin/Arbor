/** Paints the Ice Age: the mammoth steppe, on the same canvas as the mammoth
 * and by the same hand, so the animal and its world share one horizon and one
 * light. Sky, low sun, three ridges, snow with dry grass standing through it,
 * the far herd, and at night the stars, the aurora and the five pictures the
 * child took, hung as a constellation. The hour runs from a gold afternoon
 * (0) through sunset (1) and dusk (2) to night (3). Everything is placed from
 * the ground the mammoth stands on: `feetY` is where its feet are on screen,
 * `horizonY` where the eye's height meets the distance. Colours come from the
 * makers' palette; there are no colour literals in this file. */
import { seeded, trunkAngle, trunkHalfWidth, TRUNK_SAMPLES, type Vec } from './iceAgeFriendRules';
import { TRUNK_LENGTH, bezierAt, mammothView, type MammothView } from './mammothShape';
import { mix, paint, type Light, type Palette, type RGB } from './mammothRender';
import type { AuroraId, Round, SkyId } from './mammothStory';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ── the hour's colours ───────────────────────────────────────────────── */

export interface Tones {
  top: RGB; mid: RGB; low: RGB; glow: RGB; sun: RGB;
  snow: RGB; snowFar: RGB; shade: RGB; ridgeFar: RGB; ridgeMid: RGB; ridgeNear: RGB; haze: RGB;
  grassBase: RGB; grassTip: RGB;
  /** The herd far off, and the colour of anything in shadow at this hour. */
  far: RGB; dark: RGB;
  /** How high the sun stands over the horizon (a fraction of the stage's height; below 0 it has set). */
  sunUp: number;
  stars: number;
}
function keys(p: Palette): Tones[] {
  return [
    { // gold afternoon
      top: mix(p.sky, p.water, 0.42), mid: mix(p.sky, p['sky-pale'], 0.3), low: mix(p['sky-pale'], p.butter, 0.62), glow: mix(p.butter, p.sun, 0.4), sun: mix(p.sun, p.white, 0.55),
      snow: mix(p.snow, p.butter, 0.1), snowFar: mix(p.snow, p['sky-pale'], 0.6), shade: mix(p['snow-shade'], p.bluebell, 0.22), ridgeFar: mix(p['sky-pale'], p.bluebell, 0.3), ridgeMid: mix(p.sky, p.slate, 0.42), ridgeNear: mix(p.slate, p.sky, 0.22), haze: mix(p.white, p.butter, 0.35),
      grassBase: mix(p.wood, p.moss, 0.35), grassTip: mix(p.sand, p.butter, 0.5), far: mix(p.umber, p.slate, 0.5), dark: mix(p.umber, p.shadow, 0.5), sunUp: 0.2, stars: 0,
    },
    { // sunset
      top: mix(p.indigo, p.bluebell, 0.45), mid: mix(p.lilac, p.rose, 0.5), low: mix(p.amber, p.orange, 0.45), glow: mix(p.orange, p.sun, 0.35), sun: mix(p.orange, p.sun, 0.5),
      snow: mix(p.blossom, p.snow, 0.4), snowFar: mix(p.rose, p.lilac, 0.45), shade: mix(p.bluebell, p.plum, 0.3), ridgeFar: mix(p.lilac, p.rose, 0.35), ridgeMid: mix(p.violet, p.slate, 0.5), ridgeNear: mix(p.plum, p.indigo, 0.55), haze: mix(p.amber, p.blossom, 0.5),
      grassBase: mix(p['wood-dark'], p.rust, 0.4), grassTip: mix(p.amber, p.sand, 0.4), far: mix(p.plum, p['indigo-deep'], 0.5), dark: mix(p['indigo-deep'], p.plum, 0.4), sunUp: 0.035, stars: 0,
    },
    { // dusk
      top: mix(p['indigo-deep'], p.night, 0.35), mid: mix(p.indigo, p.violet, 0.4), low: mix(p['rose-deep'], p.plum, 0.5), glow: mix(p['rose-deep'], p.orange, 0.3), sun: mix(p['rose-deep'], p.orange, 0.5),
      snow: mix(p.bluebell, p['snow-shade'], 0.6), snowFar: mix(p.indigo, p.lilac, 0.4), shade: mix(p.indigo, p['indigo-deep'], 0.4), ridgeFar: mix(p.indigo, p.lilac, 0.28), ridgeMid: mix(p.indigo, p['indigo-deep'], 0.5), ridgeNear: mix(p['indigo-deep'], p.night, 0.4), haze: mix(p['rose-deep'], p.lilac, 0.5),
      grassBase: mix(p['indigo-deep'], p.umber, 0.4), grassTip: mix(p.slate, p.rose, 0.3), far: mix(p['indigo-deep'], p.night, 0.5), dark: mix(p.night, p['indigo-deep'], 0.3), sunUp: -0.06, stars: 0.35,
    },
    { // night
      top: p.night, mid: mix(p.night, p['indigo-deep'], 0.7), low: mix(p['indigo-deep'], p['teal-deep'], 0.42), glow: mix(p['teal-deep'], p.celadon, 0.3), sun: p.white,
      snow: mix(p.indigo, p['snow-shade'], 0.42), snowFar: mix(p['indigo-deep'], p.slate, 0.45), shade: mix(p['indigo-deep'], p.night, 0.5), ridgeFar: mix(p['indigo-deep'], p.indigo, 0.55), ridgeMid: mix(p['indigo-deep'], p.night, 0.35), ridgeNear: mix(p.night, p['indigo-deep'], 0.25), haze: mix(p['teal-deep'], p.indigo, 0.5),
      grassBase: mix(p.night, p['indigo-deep'], 0.6), grassTip: mix(p.slate, p.celadon, 0.25), far: mix(p.night, p['indigo-deep'], 0.4), dark: p.night, sunUp: -0.2, stars: 1,
    },
  ];
}
const TONE_COLOURS = ['top', 'mid', 'low', 'glow', 'sun', 'snow', 'snowFar', 'shade', 'ridgeFar', 'ridgeMid', 'ridgeNear', 'haze', 'grassBase', 'grassTip', 'far', 'dark'] as const;
/** The colours of the hour, in this visit's weather. */
export function tonesAt(p: Palette, hour: number, sky: SkyId): Tones {
  const all = keys(p), h = Math.max(0, Math.min(3, hour)), i = Math.min(2, Math.floor(h)), t = h - i, a = all[i], b = all[i + 1];
  const out = { sunUp: lerp(a.sunUp, b.sunUp, t), stars: lerp(a.stars, b.stars, t) } as Tones;
  for (const key of TONE_COLOURS) out[key] = mix(a[key], b[key], t);
  if (sky === 'snowFlurry') { for (const key of ['top', 'mid', 'low', 'glow'] as const) out[key] = mix(out[key], mix(p.chalk, p['storm-grey'], 0.25 + 0.2 * clamp01(h)), 0.36); out.stars *= 0.8; }
  if (sky === 'roseMist') { out.mid = mix(out.mid, p.lilac, 0.26); out.low = mix(out.low, p.blossom, 0.3); out.haze = mix(out.haze, p.blossom, 0.4); out.snowFar = mix(out.snowFar, p.blossom, 0.22); }
  return out;
}

/** How the hour lights the mammoth. At night the light is the aurora's, from overhead. */
export function lightAt(p: Palette, hour: number, aurora = 0): Light {
  const h = Math.max(0, Math.min(3, hour)), day = 1 - smooth(1.1, 2.1, h), night = smooth(1.6, 2.8, h), set = smooth(0.5, 1.1, h) * (1 - smooth(1.3, 2.1, h));
  const sunDir: Vec = [-0.88, -0.47 + 0.3 * smooth(0.3, 1.3, h)], skyDir: Vec = [-0.24, -0.97];
  const k = night, m = Math.hypot(lerp(sunDir[0], skyDir[0], k), lerp(sunDir[1], skyDir[1], k)) || 1;
  const auroraKey = mix(p.spring, p.celadon, 0.4);
  return {
    dir: [lerp(sunDir[0], skyDir[0], k) / m, lerp(sunDir[1], skyDir[1], k) / m],
    key: mix(mix(mix(p.butter, p.white, 0.3), mix(p.amber, p.orange, 0.5), set), auroraKey, night),
    keyAmount: lerp(0.14 + 0.06 * set, 0.05 + 0.1 * aurora, night) * (0.4 + 0.6 * Math.max(day, night)),
    shade: mix(mix(p.shadow, p.indigo, 0.3 + 0.4 * set), p.night, night), shadeAmount: 0.085 + 0.03 * set + 0.03 * night,
    ambient: mix(mix(p.rose, p['indigo-deep'], smooth(0.9, 1.9, h)), p.night, night), ambientAmount: 0.05 * set + 0.3 * smooth(1.2, 2.2, h) + 0.2 * night,
    bounce: mix(mix(p['snow-shade'], p.blossom, set), p.bluebell, night), bounceAmount: 0.07 * day + 0.03,
  };
}

/* ── the ground the mammoth stands on, on screen ──────────────────────── */

export interface Ground {
  width: number; height: number;
  /** Where the mammoth's feet are, and where the horizon is (CSS px). */
  feetY: number; horizonY: number;
  /** CSS px per world unit at the mammoth's own distance. */
  unit: number;
  /** Screen x of world x = 0 at the mammoth's distance. */
  originX: number;
  /** How far the ground has passed under the walk, in world units. */
  scroll: number;
}
/** How much smaller a thing is at depth d (0 at the mammoth, 1 a mammoth-length further, negative nearer). */
export const nearness = (d: number) => 1 / (1 + Math.max(-0.8, d));
/** A point on the ground: world x at depth d, on screen. */
export function groundPoint(g: Ground, x: number, d: number): Vec {
  const k = nearness(d), vp = g.width / 2;
  return [vp + (g.originX + (x + g.scroll) * g.unit - vp) * k, g.horizonY + (g.feetY - g.horizonY) * k];
}

/* ── what one visit's steppe is made of ───────────────────────────────── */

interface Tuft { a: number; d: number; h: number; lean: number; tone: number; blades: number; phase: number }
interface Drift { a: number; d: number; w: number; lit: number }
interface Member { dx: number; dd: number; size: number; turned: boolean; phase: number; young: boolean }
export interface Steppe {
  ridges: { profile: Float32Array; peaks: number[]; rise: number; drift: number }[];
  tufts: Tuft[]; drifts: Drift[]; clouds: { x: number; y: number; w: number; h: number; drift: number }[]; stars: { x: number; y: number; r: number; phase: number }[]; glitter: { a: number; d: number; phase: number }[];
  herd: Member[];
  aurora: AuroraId;
}
function ridgeProfile(random: () => number, n: number, rough: number): Float32Array {
  const out = new Float32Array(n);
  // A few octaves of value noise: broad masses, then shoulders, then crags.
  for (const [steps, weight] of [[5, 0.6], [11, 0.26], [23, 0.1 * rough], [47, 0.05 * rough]] as const) {
    const knots = Array.from({ length: steps + 2 }, () => random());
    for (let i = 0; i < n; i++) { const f = (i / (n - 1)) * steps, j = Math.floor(f), t = f - j, s = t * t * (3 - 2 * t); out[i] += (knots[j] + (knots[j + 1] - knots[j]) * s) * weight; }
  }
  let lo = Infinity, hi = -Infinity;
  for (const v of out) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (let i = 0; i < n; i++) out[i] = 0.18 + 0.82 * ((out[i] - lo) / (hi - lo || 1));
  return out;
}
export const TUFT_FIELD = 3000;
export function makeSteppe(round: Round): Steppe {
  const ridgeRandom = seeded(round.ridge), grassRandom = seeded(round.grass), herdRandom = seeded(round.seed ^ 0x51ed);
  const ridges = [{ rise: 0.2, drift: 0.012, rough: 1 }, { rise: 0.115, drift: 0.03, rough: 0.8 }, { rise: 0.05, drift: 0.07, rough: 0.4 }].map(({ rise, drift, rough }) => {
    const profile = ridgeProfile(ridgeRandom, 140, rough), peaks: number[] = [];
    for (let i = 3; i < profile.length - 3; i++) if (profile[i] > profile[i - 3] && profile[i] >= profile[i + 3] && profile[i] > 0.5 && (peaks.length === 0 || i - peaks[peaks.length - 1] > 6)) peaks.push(i);
    return { profile, peaks, rise, drift };
  });
  // Grass: thin and small far off, thick and tall at our feet. Sorted far to near, so nearer tufts overlap.
  const tufts: Tuft[] = Array.from({ length: 150 }, () => {
    const u = grassRandom(), d = u < 0.24 ? -0.5 + grassRandom() * 0.44 : -0.04 + Math.pow(grassRandom(), 1.5) * 5;
    return { a: grassRandom(), d, h: 34 + grassRandom() * 44, lean: (grassRandom() - 0.5) * 0.5, tone: grassRandom(), blades: 4 + Math.floor(grassRandom() * 4), phase: grassRandom() * Math.PI * 2 };
  }).sort((p, q) => q.d - p.d);
  const drifts: Drift[] = Array.from({ length: 34 }, () => ({ a: grassRandom(), d: -0.45 + Math.pow(grassRandom(), 1.3) * 5, w: 220 + grassRandom() * 520, lit: grassRandom() }));
  // Long thin bars of cloud lying low in the sky, where the sun will light them from beneath.
  const clouds = Array.from({ length: 7 }, () => ({ x: grassRandom(), y: 0.42 + grassRandom() * 0.46, w: 0.22 + grassRandom() * 0.4, h: 0.012 + grassRandom() * 0.02, drift: 0.002 + grassRandom() * 0.004 }));
  const stars = Array.from({ length: 150 }, () => ({ x: grassRandom(), y: Math.pow(grassRandom(), 1.25), r: 0.5 + grassRandom() * grassRandom() * 1.7, phase: grassRandom() * Math.PI * 2 }));
  const glitter = Array.from({ length: 46 }, () => ({ a: grassRandom(), d: -0.5 + grassRandom() * 1.6, phase: grassRandom() * Math.PI * 2 }));
  const herd: Member[] = Array.from({ length: round.herdSize }, (_, i) => {
    const young = i > 1 && herdRandom() < 0.34;
    return { dx: (i - (round.herdSize - 1) / 2) * 470 + (herdRandom() - 0.5) * 220, dd: (herdRandom() - 0.5) * 0.5, size: young ? 0.5 + herdRandom() * 0.14 : 0.82 + herdRandom() * 0.24, turned: herdRandom() < 0.5, phase: herdRandom() * Math.PI * 2, young };
  }).sort((p, q) => q.dd - p.dd);
  return { ridges, tufts, drifts, clouds, stars, glitter, herd, aurora: round.aurora };
}

export interface HerdState {
  /** World x of the herd's middle at its own depth, how many mammoth-lengths off it is, and how clearly it shows (0 lost in the haze .. 1). */
  x: number; depth: number; show: number;
  /** How high each member's trunk is lifted (0..1): the answer to the call. */
  lift: readonly number[];
  /** A finder on screen (CSS px): inside it the herd shows clearly whatever the haze. */
  finder?: { x: number; y: number; r: number } | null;
}
export interface SkyShow {
  /** The aurora, 0..1 unrolled. */
  aurora: number;
  /** The five pictures as stars: where each hangs (CSS px), how far each has risen (0..1), and its picture. */
  pictures: readonly { at: Vec; risen: number; image: CanvasImageSource | null; small?: boolean }[];
  /** A shooting star: where it began (0..1 across the sky) and how far through its fall it is (0..1). */
  streak?: { x: number; y: number; k: number } | null;
}
export interface SteppeFrame {
  ctx: CanvasRenderingContext2D; dpr: number; ground: Ground; palette: Palette; steppe: Steppe; sky: SkyId;
  hour: number; time: number; wind: number; reduced: boolean;
  herd: HerdState | null; show: SkyShow | null;
}

/* ── painting ─────────────────────────────────────────────────────────── */

const AURORA_INKS: Readonly<Record<AuroraId, (p: Palette) => [RGB, RGB, RGB]>> = {
  greenTeal: p => [mix(p.spring, p.leaf, 0.4), mix(p.sea, p.teal, 0.3), mix(p.celadon, p.leaf, 0.3)],
  greenViolet: p => [mix(p.spring, p.leaf, 0.45), mix(p.lilac, p.violet, 0.45), mix(p.celadon, p.teal, 0.3)],
  tealRose: p => [mix(p.sea, p.teal, 0.4), mix(p.rose, p.violet, 0.35), mix(p.spring, p.leaf, 0.4)],
};

/** Everything behind the mammoth: sky, sun, stars, aurora, the pictures, ridges, the far herd, the snow and the grass beyond its feet. */
export function drawSteppeBack(f: SteppeFrame): Tones {
  const { ctx, dpr, ground: g, palette: p, steppe, time } = f;
  const W = g.width, H = g.height, hz = g.horizonY, t = tonesAt(p, f.hour, f.sky);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

  /* sky */
  const skyTop = Math.min(0, hz - H * 1.1), sky = ctx.createLinearGradient(0, skyTop, 0, hz);
  sky.addColorStop(0, paint(t.top)); sky.addColorStop(0.55, paint(t.mid)); sky.addColorStop(0.9, paint(t.low)); sky.addColorStop(1, paint(mix(t.low, t.glow, 0.5)));
  ctx.fillStyle = sky; ctx.fillRect(0, Math.min(0, skyTop), W, Math.max(0, hz) + 2 - Math.min(0, skyTop));

  /* stars */
  if (t.stars > 0.02) {
    ctx.fillStyle = paint(p.white);
    for (const s of steppe.stars) {
      const y = s.y * (hz - 8); if (y < -4 || y > hz) continue;
      const tw = f.reduced ? 0.8 : 0.62 + 0.38 * Math.sin(time * (0.7 + s.r) + s.phase);
      ctx.globalAlpha = t.stars * tw * (0.35 + 0.65 * (1 - s.y * 0.7));
      ctx.beginPath(); ctx.arc(s.x * W, y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* the sun and its glow */
  const sunX = W * (0.5 - 0.27) + (g.originX - W / 2) * 0.01, sunY = hz - t.sunUp * H, sunR = Math.max(16, Math.min(W, H) * (0.05 + 0.03 * smooth(0.3, 1, f.hour)));
  const sunShow = 1 - smooth(1.5, 2.2, f.hour);
  if (sunShow > 0.01) {
    ctx.globalCompositeOperation = 'lighter';
    for (const [r, a] of [[11, 0.2], [5, 0.3], [2.3, 0.42]] as const) {
      const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * r);
      glow.addColorStop(0, paint(t.glow, a * sunShow)); glow.addColorStop(1, paint(t.glow, 0));
      ctx.fillStyle = glow; ctx.fillRect(0, Math.max(0, sunY - sunR * r), W, Math.max(0, Math.min(hz, sunY + sunR * r) - Math.max(0, sunY - sunR * r)));
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, hz + 1); ctx.clip();
    const disc = ctx.createRadialGradient(sunX, sunY, sunR * 0.5, sunX, sunY, sunR);
    disc.addColorStop(0, paint(t.sun, sunShow)); disc.addColorStop(0.8, paint(t.sun, 0.95 * sunShow)); disc.addColorStop(1, paint(t.sun, 0));
    ctx.fillStyle = disc; ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /* bars of cloud, lit along their under-edge by the low sun; at night they are only a darker blue */
  const cloudLit = mix(mix(t.low, p.white, 0.45), t.glow, 0.35 * sunShow), cloudDark = mix(t.mid, t.dark, 0.25), cloudShow = (f.sky === 'snowFlurry' ? 0.8 : 0.55) * (1 - 0.6 * t.stars);
  for (const cloud of steppe.clouds) {
    const cw = cloud.w * W, ch = Math.max(3, cloud.h * Math.max(hz, 60)), x = (((cloud.x + (f.reduced ? 0 : time * cloud.drift)) % 1.5) - 0.25) * W, y = cloud.y * hz;
    if (y < -ch || y > hz) continue;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ch / cw);
    for (const [dy, tone, alpha] of [[-0.25, cloudDark, 0.34], [0.2, cloudLit, 0.62]] as const) {
      const body = ctx.createRadialGradient(0, cw * dy, 0, 0, cw * dy, cw);
      body.addColorStop(0, paint(tone, alpha * cloudShow)); body.addColorStop(0.5, paint(tone, alpha * cloudShow * 0.5)); body.addColorStop(1, paint(tone, 0));
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, cw * dy, cw, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /* the aurora and the pictures in the sky */
  if (f.show) drawSkyShow(f, t);

  /* ridges, far to near, each a shade nearer and darker, the far one snow-capped */
  steppe.ridges.forEach((ridge, index) => {
    const n = ridge.profile.length, span = W * 1.7 + 500, x0 = -0.35 * W - 250 + ((g.originX - W / 2) + g.scroll * g.unit) * ridge.drift;
    const rise = ridge.rise * Math.min(H, W * 0.9) * (0.8 + 0.2 * Math.min(1.6, g.unit)), base = hz + 2;
    const tone = index === 0 ? t.ridgeFar : index === 1 ? t.ridgeMid : t.ridgeNear;
    const path = new Path2D();
    path.moveTo(x0, base);
    for (let i = 0; i < n; i++) path.lineTo(x0 + (i / (n - 1)) * span, base - ridge.profile[i] * rise);
    path.lineTo(x0 + span, base); path.closePath();
    const fill = ctx.createLinearGradient(0, base - rise, 0, base);
    fill.addColorStop(0, paint(index === 0 ? mix(tone, t.snowFar, 0.55) : mix(tone, t.mid, 0.12))); fill.addColorStop(0.5, paint(tone)); fill.addColorStop(1, paint(mix(tone, t.haze, 0.5)));
    ctx.fillStyle = fill; ctx.fill(path);
    // The side of each peak away from the sun falls into shade.
    ctx.save(); ctx.clip(path);
    ctx.fillStyle = paint(mix(tone, t.dark, 0.5), index === 2 ? 0.1 : 0.18);
    ctx.beginPath();
    for (const peak of ridge.peaks) {
      const px = x0 + (peak / (n - 1)) * span, py = base - ridge.profile[peak] * rise, w = rise * (0.5 + ridge.profile[peak] * 0.6);
      ctx.moveTo(px, py - 1); ctx.lineTo(px + w * 1.25, base); ctx.lineTo(px + w * 0.12, base); ctx.lineTo(px + w * 0.2, py + (base - py) * 0.45); ctx.closePath();
    }
    ctx.fill();
    // Light catches the sun's side of the far snows.
    if (index < 2) {
      ctx.fillStyle = paint(mix(t.glow, p.white, 0.45), 0.15 * (1 - smooth(1.4, 2.4, f.hour)) + 0.03);
      ctx.beginPath();
      for (const peak of ridge.peaks) {
        const px = x0 + (peak / (n - 1)) * span, py = base - ridge.profile[peak] * rise, w = rise * (0.4 + ridge.profile[peak] * 0.5);
        ctx.moveTo(px, py - 1); ctx.lineTo(px - w * 0.9, py + (base - py) * 0.62); ctx.lineTo(px - w * 0.2, py + (base - py) * 0.4); ctx.closePath();
      }
      ctx.fill();
    }
    ctx.restore();
  });

  /* the snow */
  const snow = ctx.createLinearGradient(0, hz, 0, Math.max(hz + 1, H));
  snow.addColorStop(0, paint(mix(t.snowFar, t.haze, 0.4))); snow.addColorStop(0.16, paint(t.snowFar)); snow.addColorStop(0.6, paint(mix(t.snowFar, t.snow, 0.7))); snow.addColorStop(1, paint(t.snow));
  ctx.fillStyle = snow; ctx.fillRect(0, hz, W, Math.max(0, H - hz) + 2);
  // The sun's light lying on the snow under it: brightest at the horizon, spreading and fading toward us.
  if (sunShow > 0.01 && t.sunUp > -0.03) {
    ctx.save(); ctx.translate(sunX, hz); ctx.scale(1, Math.max(0.2, (H - hz) / Math.max(1, W) * 1.5));
    const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.5);
    pool.addColorStop(0, paint(t.glow, 0.55 * sunShow)); pool.addColorStop(0.4, paint(t.glow, 0.2 * sunShow)); pool.addColorStop(1, paint(t.glow, 0));
    ctx.fillStyle = pool; ctx.beginPath(); ctx.arc(0, 0, W * 0.5, 0, Math.PI); ctx.fill(); ctx.restore();
  }
  // Drifts: long low swells of snow, each lit on the side the sun is on, with its own soft shade lying beyond it.
  for (const drift of steppe.drifts) {
    const k = nearness(drift.d), [x, y] = fieldPoint(g, drift.a, drift.d), rx = drift.w * g.unit * k, ry = Math.max(1.5, rx * 0.075 * k);
    if (x < -rx * 1.4 || x > W + rx * 1.4 || y > H + ry * 2 || y < hz) continue;
    for (const [dx, dy, tone, alpha] of [[rx * 0.2, ry * 0.75, t.shade, 0.2], [0, 0, mix(t.snow, p.white, 0.55), 0.34 + 0.26 * drift.lit]] as const) {
      ctx.save(); ctx.translate(x + dx, y + dy); ctx.scale(1, ry / rx);
      const swell = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      swell.addColorStop(0, paint(tone, alpha)); swell.addColorStop(0.5, paint(tone, alpha * 0.55)); swell.addColorStop(1, paint(tone, 0));
      ctx.fillStyle = swell; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }
  // Mist lying along the horizon.
  const mist = ctx.createLinearGradient(0, hz - H * 0.05, 0, hz + H * 0.045);
  mist.addColorStop(0, paint(t.haze, 0)); mist.addColorStop(0.55, paint(t.haze, f.sky === 'roseMist' ? 0.6 : 0.38)); mist.addColorStop(1, paint(t.haze, 0));
  ctx.fillStyle = mist; ctx.fillRect(0, hz - H * 0.05, W, H * 0.1);

  if (f.herd) drawHerd(f, f.herd, t);
  drawTufts(f, t, false);
  return t;
}

/** What stands nearer than the mammoth: the grass at our feet and the glitter on the snow. Drawn after the animal. */
export function drawSteppeFront(f: SteppeFrame, t: Tones): void {
  const { ctx, dpr, ground: g, palette: p, steppe, time } = f;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const glint = (1 - smooth(1.2, 2, f.hour)) * 0.9 + 0.25 * smooth(2.4, 3, f.hour);
  if (glint > 0.02 && !f.reduced) {
    ctx.fillStyle = paint(mix(p.white, t.glow, 0.2));
    for (const s of steppe.glitter) {
      const tw = Math.max(0, Math.sin(time * 2.1 + s.phase * 7)); if (tw < 0.72) continue;
      const [x, y] = fieldPoint(g, s.a, s.d); if (y < g.horizonY || y > g.height) continue;
      ctx.globalAlpha = glint * (tw - 0.72) / 0.28;
      const r = 1.1 + 1.6 * nearness(s.d) * Math.min(1.4, g.unit);
      ctx.beginPath(); ctx.moveTo(x - r * 2, y); ctx.quadraticCurveTo(x, y - r * 0.3, x + r * 2, y); ctx.quadraticCurveTo(x, y + r * 0.3, x - r * 2, y);
      ctx.moveTo(x, y - r * 2); ctx.quadraticCurveTo(x + r * 0.3, y, x, y + r * 2); ctx.quadraticCurveTo(x - r * 0.3, y, x, y - r * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  drawTufts(f, t, true);
}

/** A place in the endless field: `a` 0..1 across it at depth d, wrapped so the ground never runs out under the walk. */
function fieldPoint(g: Ground, a: number, d: number): Vec {
  const k = nearness(d), span = TUFT_FIELD / k, vp = g.width / 2;
  let x = (a - 0.5) * span + (g.originX - vp) / g.unit + g.scroll;
  x = ((x + span / 2) % span + span) % span - span / 2;
  return [vp + x * g.unit * k, g.horizonY + (g.feetY - g.horizonY) * k];
}

function drawTufts(f: SteppeFrame, t: Tones, front: boolean) {
  const { ctx, ground: g, steppe, time } = f;
  const inks = [paint(mix(t.grassBase, t.dark, 0.25)), paint(t.grassBase), paint(mix(t.grassBase, t.grassTip, 0.6)), paint(t.grassTip)];
  const sway = f.reduced ? 0 : 1;
  ctx.lineCap = 'round';
  // Batched by ink: one path for each tone, far tufts first.
  for (let ink = 0; ink < inks.length; ink++) {
    ctx.fillStyle = inks[ink]; ctx.beginPath();
    let any = false;
    for (const tuft of steppe.tufts) {
      if ((tuft.d <= -0.02) !== front) continue;
      const k = nearness(tuft.d), [x, y] = fieldPoint(g, tuft.a, tuft.d), unit = g.unit * k;
      if (x < -60 || x > g.width + 60 || y > g.height + 30 || y < g.horizonY - 2 || unit < 0.06) continue;
      const gust = sway * (0.5 + 0.5 * Math.sin(time * 1.7 + x * 0.006 + tuft.phase)) * (0.25 + f.wind * 0.75);
      for (let b = 0; b < tuft.blades; b++) {
        if (((b + Math.floor(tuft.tone * 4)) % inks.length) !== ink) continue;
        const spread = (b - (tuft.blades - 1) / 2) / tuft.blades, h = tuft.h * unit * (0.62 + 0.38 * ((b * 37 + 11) % 7) / 6);
        const lean = tuft.lean + spread * 1.5 + gust * 0.5, w = Math.max(0.5, 2.6 * unit), bx = x + spread * 16 * unit;
        const tx = bx + Math.sin(lean) * h, ty = y - Math.cos(lean) * h * 0.96;
        ctx.moveTo(bx - w, y + 1); ctx.quadraticCurveTo(bx - w * 0.2 + (tx - bx) * 0.25, y - h * 0.55, tx, ty); ctx.quadraticCurveTo(bx + w * 0.6 + (tx - bx) * 0.3, y - h * 0.5, bx + w, y + 1); ctx.closePath();
        any = true;
      }
    }
    if (any) ctx.fill();
  }
  // A little snow banked at the foot of each near tuft, so it stands in the snow and not on it.
  ctx.fillStyle = paint(mix(t.snow, t.shade, 0.25), 0.9); ctx.beginPath();
  for (const tuft of steppe.tufts) {
    if ((tuft.d <= -0.02) !== front || tuft.d > 1.2) continue;
    const k = nearness(tuft.d), [x, y] = fieldPoint(g, tuft.a, tuft.d), unit = g.unit * k;
    if (x < -60 || x > g.width + 60 || y > g.height + 30) continue;
    ctx.moveTo(x + 15 * unit, y + 1.5 * unit); ctx.ellipse(x, y + 1.5 * unit, 15 * unit, 3.4 * unit, 0, 0, Math.PI * 2);
  }
  ctx.fill();
}

/* ── the herd ─────────────────────────────────────────────────────────── */

const shapeCache = new WeakMap<MammothView, { far: Path2D; near: Path2D; fringe: Path2D }>();
function herdShapes(view: MammothView) {
  let cached = shapeCache.get(view); if (cached) return cached;
  const poly = (path: Path2D, points: readonly Vec[]) => { points.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y))); path.closePath(); };
  const far = new Path2D(), near = new Path2D(), fringe = new Path2D(), s = view.shapes;
  poly(far, s.legFarHind); poly(far, s.legFarFront);
  for (const part of [s.body, s.head, s.tail, s.legHind, s.legFront, s.ear]) poly(near, part);
  // A shaggy edge: short locks hanging from the belly, the flanks and the chin.
  const random = seeded(77);
  for (const part of [s.body, s.head, s.legHind, s.legFront]) {
    for (let i = 0; i < part.length; i += 2) {
      const [x, y] = part[i], [nx, ny] = part[(i + 2) % part.length];
      if (nx - x === 0 && ny - y === 0) continue;
      // Only where the outline faces down or back.
      const down = (view.mirror ? x - nx : nx - x) < 0 || Math.abs(ny - y) > Math.abs(nx - x);
      if (!down) continue;
      const len = 14 + random() * 24, lean = (view.mirror ? -1 : 1) * (4 + random() * 8);
      fringe.moveTo(x - 5, y - 4); fringe.lineTo(x + lean, y + len); fringe.lineTo(x + 6, y - 3); fringe.closePath();
    }
  }
  cached = { far, near, fringe };
  shapeCache.set(view, cached);
  return cached;
}
function drawHerd(f: SteppeFrame, herd: HerdState, t: Tones) {
  const { ctx, ground: g, steppe, time, palette: p } = f;
  steppe.herd.forEach((member, index) => {
    const d = herd.depth + member.dd, k = nearness(d), [x, y] = groundPoint(g, herd.x + member.dx - g.scroll, d), unit = g.unit * k * member.size;
    if (x < -400 * unit - 40 || x > g.width + 400 * unit + 40 || unit < 0.015) return;
    let show = herd.show;
    if (herd.finder) { const m = Math.hypot(x - herd.finder.x, (y - 220 * unit) - herd.finder.y); show = Math.max(show, 1 - smooth(herd.finder.r * 0.75, herd.finder.r * 1.25, m)); }
    if (show < 0.02) return;
    const view = mammothView(member.turned ? 'turned' : 'side'), shapes = herdShapes(view), m = view.mirror ? -1 : 1;
    const cx = (view.furBounds.minX + view.furBounds.maxX) / 2, lift = clamp01(herd.lift[index] ?? 0);
    // Far off the air is between us: the herd takes the colour of the distance.
    const air = clamp01((d - 0.6) / 5), body = mix(t.far, t.haze, 0.18 + 0.5 * air), dark = mix(body, t.dark, 0.3), bob = f.reduced ? 0 : Math.sin(time * 0.9 + member.phase) * 2;
    ctx.save(); ctx.globalAlpha = show; ctx.translate(x - cx * unit, y - view.groundY * unit); ctx.scale(unit, unit);
    // Its shadow on the snow.
    ctx.fillStyle = paint(t.shade, 0.5); ctx.beginPath(); ctx.ellipse(cx + 60, view.groundY + 4, 300, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = paint(dark); ctx.fill(shapes.far);
    ctx.translate(0, bob);
    // The far tusk, then the body, then the trunk and the near tusk over it.
    const tusk = (chain: MammothView['tusks']['near'], tone: RGB, shrink: number) => {
      if (member.young) return;
      ctx.strokeStyle = paint(tone); ctx.lineCap = 'round'; ctx.lineWidth = 10 * shrink; ctx.beginPath();
      chain.forEach((b, j) => { for (let i = j ? 1 : 0; i <= 10; i++) { const [bx, by] = bezierAt(b, i / 10); if (!j && !i) ctx.moveTo(bx, by); else ctx.lineTo(bx, by); } });
      ctx.stroke();
    };
    tusk(view.tusks.far, mix(mix(p.sand, p.cream, 0.5), body, 0.62 + 0.25 * air), 0.9);
    const fill = ctx.createLinearGradient(0, view.furBounds.minY, 0, view.groundY);
    fill.addColorStop(0, paint(mix(body, t.glow, 0.34 * (1 - air)))); fill.addColorStop(0.3, paint(mix(body, t.glow, 0.08))); fill.addColorStop(0.55, paint(body)); fill.addColorStop(1, paint(dark));
    ctx.fillStyle = fill; ctx.fill(shapes.near); ctx.fill(shapes.fringe);
    // The trunk: hanging, swinging a little, or lifted to answer the call.
    const swing = f.reduced ? 0 : Math.sin(time * 0.6 + member.phase) * 0.14;
    let tx = view.trunkBase[0], ty = view.trunkBase[1];
    const step = TRUNK_LENGTH * (member.young ? 0.8 : 1) / (TRUNK_SAMPLES - 1);
    ctx.strokeStyle = paint(mix(body, dark, 0.3)); ctx.lineCap = 'round';
    for (let i = 0; i < TRUNK_SAMPLES - 1; i += 2) {
      const s = i / (TRUNK_SAMPLES - 1), raw = trunkAngle(s, lift, swing), a = view.mirror ? Math.PI - raw : raw;
      const ex = tx + Math.cos(a) * step * 2, ey = ty + Math.sin(a) * step * 2;
      ctx.lineWidth = trunkHalfWidth(s) * 2; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(ex, ey); ctx.stroke();
      tx = ex; ty = ey;
    }
    tusk(view.tusks.near, mix(mix(p.cream, p.white, 0.4), body, 0.42 + 0.4 * air), 1);
    ctx.restore();
  });
  ctx.globalAlpha = 1;
}

/* ── the night's show ─────────────────────────────────────────────────── */

function drawSkyShow(f: SteppeFrame, t: Tones) {
  const { ctx, ground: g, palette: p, time, steppe } = f, show = f.show!, W = g.width, hz = g.horizonY;
  if (show.aurora > 0.01) {
    const [a, b, c] = AURORA_INKS[steppe.aurora](p), slow = f.reduced ? 0 : time;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    // Each curtain is many thin rays side by side, wide enough to melt into one another: bright along its lower hem, fading upward.
    const strips = Math.max(70, Math.min(220, Math.round(W / 6))), wide = (W * 1.1 / strips) * 3;
    [[a, 0.16, 0.5, 0], [b, 0.32, 0.38, 1.9], [c, 0.06, 0.3, 4.1]].forEach(([tone, at, tallness, phase], band) => {
      // Each curtain unrolls from one side of the sky.
      const reach = clamp01(show.aurora * 1.5 - band * 0.2);
      if (reach <= 0) return;
      for (let i = 0; i < strips; i++) {
        const u = i / (strips - 1), across = band % 2 ? 1 - u : u;
        if (across > reach) continue;
        const fold = Math.sin(u * 5.2 + slow * 0.33 + (phase as number)) * 0.5 + Math.sin(u * 12.7 - slow * 0.21 + (phase as number) * 2) * 0.22;
        const x = u * W * 1.1 - W * 0.05, top = hz * ((at as number) - 0.06 + fold * 0.075), height = hz * (tallness as number) * (0.72 + 0.28 * Math.sin(u * 9 + slow * 0.5 + band));
        const shimmer = 0.6 + 0.4 * Math.sin(u * 23 + slow * 1.3 + band * 2) * Math.sin(u * 7.1 - slow * 0.7), edge = Math.min(1, (reach - across) * 6) * Math.sin(Math.PI * Math.min(1, Math.max(0, u * 1.02)));
        const alpha = 0.1 * shimmer * edge * show.aurora;
        if (alpha < 0.003) continue;
        const ray = ctx.createLinearGradient(0, top, 0, top + height);
        ray.addColorStop(0, paint(tone as RGB, 0)); ray.addColorStop(0.6, paint(tone as RGB, alpha * 0.55)); ray.addColorStop(0.9, paint(mix(tone as RGB, p.white, 0.25), alpha)); ray.addColorStop(1, paint(tone as RGB, 0));
        ctx.fillStyle = ray; ctx.fillRect(x - wide / 2, top, wide, height);
      }
    });
    // Its light on the snow far off.
    const wash = ctx.createLinearGradient(0, hz, 0, hz + (g.height - hz) * 0.6);
    wash.addColorStop(0, paint(a, 0.16 * show.aurora)); wash.addColorStop(1, paint(a, 0));
    ctx.fillStyle = wash; ctx.fillRect(0, hz, W, (g.height - hz) * 0.6);
    ctx.restore();
  }
  if (show.streak && show.streak.k > 0 && show.streak.k < 1) {
    const s = show.streak, x = (s.x + s.k * 0.22) * W, y = (s.y + s.k * 0.16) * hz, tail = 90 * (1 - Math.abs(s.k - 0.5) * 2 * 0.4);
    const trail = ctx.createLinearGradient(x, y, x - tail, y - tail * 0.72);
    trail.addColorStop(0, paint(p.white, Math.sin(Math.PI * s.k))); trail.addColorStop(1, paint(p.white, 0));
    ctx.strokeStyle = trail; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - tail, y - tail * 0.72); ctx.stroke();
  }
  // The line that joins the pictures, drawn as far as they have risen.
  const pics = show.pictures.filter(pic => !pic.small);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 1; i < pics.length; i++) {
    const k = Math.min(pics[i - 1].risen, pics[i].risen); if (k < 0.9) continue;
    const grow = smooth(0.9, 1, k);
    ctx.strokeStyle = paint(mix(p.white, t.glow, 0.25), 0.55 * grow); ctx.lineWidth = 1.6; ctx.setLineDash([2, 7]);
    ctx.beginPath(); ctx.moveTo(pics[i - 1].at[0], pics[i - 1].at[1]); ctx.lineTo(pics[i].at[0], pics[i].at[1]); ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const pic of show.pictures) {
    if (pic.risen <= 0) continue;
    const k = smooth(0, 1, pic.risen), size = (pic.small ? 9 : Math.max(19, Math.min(34, W * 0.036))) * (0.4 + 0.6 * k) * (1 + 0.12 * Math.sin(Math.PI * Math.min(1, pic.risen * 1.4))), [x, y] = pic.at;
    const twinkle = f.reduced ? 1 : 0.86 + 0.14 * Math.sin(time * 2.2 + x * 0.05);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(x, y, size * 0.5, x, y, size * 3.1);
    halo.addColorStop(0, paint(mix(p.white, t.glow, 0.3), 0.5 * k * twinkle)); halo.addColorStop(1, paint(t.glow, 0));
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, size * 3.1, 0, Math.PI * 2); ctx.fill();
    // Four long points of light.
    ctx.fillStyle = paint(p.white, 0.85 * k * twinkle);
    const r = size * (pic.small ? 2.4 : 2.1);
    ctx.beginPath(); ctx.moveTo(x - r, y); ctx.quadraticCurveTo(x, y - r * 0.07, x + r, y); ctx.quadraticCurveTo(x, y + r * 0.07, x - r, y);
    ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x + r * 0.07, y, x, y + r); ctx.quadraticCurveTo(x - r * 0.07, y, x, y - r); ctx.fill();
    ctx.restore();
    if (pic.small) { ctx.fillStyle = paint(p.white, k); ctx.beginPath(); ctx.arc(x, y, size * 0.34, 0, Math.PI * 2); ctx.fill(); continue; }
    // The picture itself, round, in a ring of light.
    ctx.save(); ctx.globalAlpha = k;
    ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.closePath();
    ctx.fillStyle = paint(mix(p.white, t.glow, 0.2)); ctx.fill();
    if (pic.image) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, size - 2.2, 0, Math.PI * 2); ctx.clip(); try { ctx.drawImage(pic.image, x - size, y - size, size * 2, size * 2); } catch { /* not ready */ } ctx.restore(); }
    ctx.restore();
  }
}
