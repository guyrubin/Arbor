/** The bowl as a rendered ceramic object, seen from directly above. Pure
 * arithmetic on typed arrays (no canvas, no DOM), so the light is tested.
 *
 * The bowl is a surface of revolution: a flat well, a wall that steepens
 * toward the rim, and a rolled lip. Every pixel gets its surface normal from
 * that profile and is lit by ONE light, the workshop window to the upper left
 * of the table (the same light as the kit's table picture): Lambert shading,
 * the rim's own cast shadow marched across the hollow, a soft occlusion at
 * the foot of the wall and under the lip, linen bounce in the shade, and the
 * window itself reflected in the glaze as a paned highlight. The glaze pools
 * darker where it runs thick (the well's edge), breaks pale and thin over the
 * lip, carries iron specks and the faint rings of the wheel.
 *
 * The lighting is glaze-independent and computed once; recolouring it for a
 * glaze is one cheap pass, so the four glazes are ready the moment a dish is
 * touched. */
export type Rgb = readonly [number, number, number];
export interface BowlTones {
  /** The glaze where it lies at its normal thickness. */
  base: Rgb;
  /** Where it pools thick. */
  deep: Rgb;
  /** Where it breaks thin. */
  light: Rgb;
  /** The clay body, showing at the very top of the lip. */
  clay: Rgb;
  /** Iron specks. */
  speck: Rgb;
  /** What the shade picks up from the table (linen). */
  bounce: Rgb;
}
export interface BowlLighting {
  size: number;
  /** Per pixel: how much of the glaze colour reaches the eye (0 … about 1.3). */
  lit: Float32Array;
  /** Added white: the window in the glaze. */
  spec: Float32Array;
  /** Added table colour in the shade. */
  bounce: Float32Array;
  /** 0 … 1 masks for the glaze's thickness and marks. */
  pool: Float32Array; thin: Float32Array; clay: Float32Array; speck: Float32Array;
  /** Coverage (anti-aliased rim). */
  alpha: Float32Array;
}

/** The profile, in rim radii: the well ends at WELL, the wall meets the lip at LIP. */
export const BOWL_WELL = 0.31, BOWL_LIP = 0.93, BOWL_DEPTH = 0.42;
const WALL = BOWL_LIP - BOWL_WELL, LIP_RISE = 0.116, LIP_FALL = 0.166;
/** Height of the surface at radius r (0 = the well's floor). */
export function bowlHeight(r: number): number {
  if (r <= BOWL_WELL) return 0;
  if (r <= BOWL_LIP) { const t = (r - BOWL_WELL) / WALL; return BOWL_DEPTH * (0.55 * t * t + 0.45 * t * t * t); }
  const s = Math.min(1.2, (r - BOWL_LIP) / (1 - BOWL_LIP));
  return BOWL_DEPTH + LIP_RISE * s - LIP_FALL * s * s;
}
/** Its slope (rise per rim radius), with the potter's rings as a faint ripple. */
export function bowlSlope(r: number): number {
  const e = 0.004, rings = r > BOWL_WELL * 0.5 && r < BOWL_LIP ? 0.035 * Math.cos(r * 96) : 0;
  return (bowlHeight(r + e) - bowlHeight(r - e)) / (2 * e) + rings;
}
/** Toward the light: the window is up and to the left of the table, about 37° above it. */
export const BOWL_LIGHT: Rgb = (() => { const v = [-0.5, -0.62, 0.6], n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n] as const; })();
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
/** Smooth value noise in 0 … 1. */
function noise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const lightingCache = new Map<number, BowlLighting>();
export function emptyLighting(size: number): BowlLighting {
  const n = size * size;
  return { size, lit: new Float32Array(n), spec: new Float32Array(n), bounce: new Float32Array(n), pool: new Float32Array(n), thin: new Float32Array(n), clay: new Float32Array(n), speck: new Float32Array(n), alpha: new Float32Array(n) };
}
/** The light on the bowl for a square texture of `size` pixels (cached). */
export function bowlLighting(size: number): BowlLighting {
  const hit = lightingCache.get(size); if (hit) return hit;
  const out = emptyLighting(size);
  lightRows(out, 0, size);
  lightingCache.set(size, out);
  return out;
}
/** Rows `from` (inclusive) to `to` (exclusive) of the lighting, so a large
 * texture can be worked out a slice at a time without holding up a frame. */
export function lightRows(out: BowlLighting, from: number, to: number): void {
  const size = out.size, [lx, ly, lz] = BOWL_LIGHT;
  // A basis across the window, for its reflection: u along the sill, w up the frame.
  const ul = Math.hypot(ly, lx), ux = -ly / ul, uy = lx / ul, wx = -lz * uy, wy = lz * ux, wz = lx * uy - ly * ux;
  const half = size / 2, px = 1 / half;
  for (let j = Math.max(0, from); j < Math.min(size, to); j++) for (let i = 0; i < size; i++) {
    const x = (i + 0.5 - half) / half, y = (j + 0.5 - half) / half, r = Math.hypot(x, y), k = j * size + i;
    const cover = Math.min(1, Math.max(0, (1 - r) / px + 0.5));
    out.alpha[k] = cover; if (cover <= 0) continue;
    const slope = bowlSlope(Math.min(r, 0.999)), inv = 1 / Math.hypot(slope, 1), cos = r > 1e-6 ? x / r : 0, sin = r > 1e-6 ? y / r : 0;
    const nx = -slope * cos * inv, ny = -slope * sin * inv, nz = inv;
    const h0 = bowlHeight(r);
    // The rim's cast shadow: walk toward the window and see what stands in the way.
    let clear = 1;
    for (let s = 1; s <= 30; s++) {
      const t = s * 0.036, rr = Math.hypot(x + lx * t, y + ly * t); if (rr > 1) break;
      clear = Math.min(clear, (h0 + lz * t - bowlHeight(rr)) / t);
    }
    const shadow = Math.min(1, Math.max(0, 0.42 + clear * 5.2));
    const foot = Math.exp(-(((r - BOWL_WELL) / 0.075) ** 2)), under = smooth(0.78, BOWL_LIP, r) * (r < BOWL_LIP ? 1 : 0);
    const occlusion = 1 - 0.2 * foot - 0.16 * under;
    const diffuse = Math.max(0, nx * lx + ny * ly + nz * lz);
    out.lit[k] = (0.36 + 0.07 * nz + diffuse * shadow * 0.98) * occlusion;
    out.bounce[k] = 0.1 * (1 - nz) * (1 - shadow * 0.6) + 0.02;
    // The window, mirrored in the glaze (view from straight above).
    const rx = 2 * nz * nx, ry = 2 * nz * ny, rz = 2 * nz * nz - 1, toward = rx * lx + ry * ly + rz * lz;
    let spec = 0;
    if (toward > 0) {
      const u = rx * ux + ry * uy, w = rx * wx + ry * wy + rz * wz;
      const pane = (1 - smooth(0.085, 0.13, Math.abs(u))) * (1 - smooth(0.15, 0.21, Math.abs(w)));
      const bars = smooth(0.006, 0.02, Math.abs(u)) * smooth(0.008, 0.024, Math.abs(w + 0.03));
      spec = pane * (0.3 + 0.7 * bars) * 0.82 * shadow + (toward ** 7) * 0.12 * shadow;
    }
    // A hairline of light on the lip where it turns to the window.
    spec += smooth(BOWL_LIP + 0.012, 0.955, r) * (1 - smooth(0.965, 0.99, r)) * Math.max(0, -(cos * lx + sin * ly)) * 0.34;
    out.spec[k] = spec;
    const flow = noise(x * 3.1 + 7, y * 3.1 + 3) - 0.5;
    out.pool[k] = Math.min(1, Math.max(0, 0.62 * foot + (r < BOWL_WELL ? 0.3 - 0.16 * (r / BOWL_WELL) : 0) + flow * 0.22 + 0.1 * smooth(0.5, 0.8, r)));
    out.thin[k] = smooth(0.885, 0.95, r) * 0.85 + Math.max(0, flow) * 0.2;
    out.clay[k] = smooth(0.94, 0.958, r) * (1 - smooth(0.972, 0.995, r)) * 0.5;
    // Iron specks: one possible spot per cell of a jittered grid, most cells empty.
    const g = 26, cx = Math.floor((x + 1) * g), cy = Math.floor((y + 1) * g);
    let spot = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const ax = cx + ox, ay = cy + oy, chance = hash(ax + 0.5, ay + 9.5); if (chance > 0.1) continue;
      const sx = (ax + hash(ax, ay + 3)) / g - 1, sy = (ay + hash(ax + 5, ay)) / g - 1, rad = 0.004 + 0.008 * hash(ax + 1.5, ay + 2.5) ** 2;
      spot = Math.max(spot, 1 - smooth(rad * 0.5, rad, Math.hypot(x - sx, y - sy)));
    }
    out.speck[k] = spot * (r < BOWL_LIP ? 0.42 : 0.16) + (hash(i * 0.73, j * 1.31) - 0.5) * 0.05;
  }
}
/** Keeps a lighting that was worked out in slices. */
export function keepLighting(out: BowlLighting): void { lightingCache.set(out.size, out); }

const toLinear = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const ENCODE = (() => { const lut = new Uint8ClampedArray(1025); for (let i = 0; i <= 1024; i++) { const v = i / 1024; lut[i] = Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)); } return lut; })();
const encode = (v: number) => ENCODE[Math.min(1024, Math.max(0, Math.round(v * 1024)))];
/** The lighting recoloured for one glaze: RGBA bytes, `size` × `size`. */
export function bowlPixels(light: BowlLighting, tones: BowlTones): Uint8ClampedArray {
  const n = light.size * light.size, out = new Uint8ClampedArray(n * 4);
  const lin = (c: Rgb) => [toLinear(c[0]), toLinear(c[1]), toLinear(c[2])];
  const base = lin(tones.base), deep = lin(tones.deep), pale = lin(tones.light), clay = lin(tones.clay), speck = lin(tones.speck), bounce = lin(tones.bounce);
  for (let k = 0; k < n; k++) {
    const a = light.alpha[k]; if (a <= 0) continue;
    const pool = light.pool[k], thin = Math.min(1, light.thin[k]), bare = light.clay[k], spot = light.speck[k], lit = light.lit[k], spec = light.spec[k], bounced = light.bounce[k];
    for (let c = 0; c < 3; c++) {
      let albedo = base[c] + (deep[c] - base[c]) * pool;
      albedo += (pale[c] - albedo) * thin;
      albedo += (clay[c] - albedo) * bare;
      albedo = spot > 0 ? albedo + (speck[c] - albedo) * Math.min(1, spot) : albedo * (1 + spot);
      out[k * 4 + c] = encode(albedo * lit + bounce[c] * bounced + spec);
    }
    out[k * 4 + 3] = Math.round(a * 255);
  }
  return out;
}
