/**
 * heroKeyer — B-GAME-13a: the cut-out tool and its quality gate, ported from
 * the offline proof tools (execution/2026-10-06--kids-games/art/key.py and
 * art/poses/normalise.py) to pure functions over RGBA pixels, so the parent's
 * device can key a generated pose (Canvas getImageData -> here -> putImageData).
 *
 * No canvas, no DOM, no model: the same input gives the same output (tests run
 * on synthetic pixels in node).
 *
 * Pipeline (key.py):
 *  1. key colour = per-channel median of a 12 px border ring;
 *  2. alpha from "spill" = membership of the key's hue band (-30/+40 deg, soft
 *     edges 12/10 deg) x absolute chroma, through a smoothstep (a hue band, not
 *     g - max(r, b): the renders put a soft yellow-green glow round the figure);
 *  3. erode 1 px, drop specks under 0.5 % of the figure, keep soft edge pixels
 *     within 3 px of a kept figure, feather ~0.75 px;
 *  4. despill within 4 px of the edge: the key's channel <= mean(others) + 6;
 *  5. QA gate (any fail = reject the pose, never ship it):
 *       border uniformity  dE76 of 8 ring patches vs the key < 6 (else a floor,
 *                          gradient or vignette),
 *       margin             >= 6 % of the image on every side (feet, hands, hair),
 *       residue            kept pixels with a visible key tint <= 0.2 %,
 *       holes              enclosed transparent pixels whose source colour is
 *                          not the key <= 0.1 % (a figure colour keyed away),
 *       figures            exactly one (components overlapping in x are one);
 *  6. trim to the alpha box + 4 % padding; anchors: foot = centre of the lowest
 *     3 % of opaque rows (y = the lowest opaque row); head = top 28 % band.
 *
 * Normalisation (normalise.py, generalised from one child to any hero): the
 * head width is the mean of two measures — the widest opaque run through the
 * head column (closed mask, stop below the widest row once the run falls under
 * 85 %), and the "top-of-head" colour mop (the idle's hair or hat colour,
 * learned from the idle) times the idle's own run/mop ratio. Raised arms that
 * touch the hair inflate the run, so a run far above the mop is replaced by the
 * mop. Every pose is then resampled to the idle's pixels-per-head.
 */

export interface RgbaImage {
  width: number;
  height: number;
  /** RGBA, row-major, 4 bytes per pixel (ImageData.data layout). */
  data: Uint8ClampedArray;
}

export interface Point { x: number; y: number }
export interface HeadAnchor { x: number; y: number; r: number }
export interface HandAnchor { l?: [number, number]; r?: [number, number] }

export interface KeyQa {
  /** Plain reasons; empty = PASS. */
  fails: string[];
  borderDeltaE: number;
  margins: { left: number; right: number; top: number; bottom: number } | null;
  residue: number;
  holes: number;
  figures: number;
}

export interface KeyedSprite {
  ok: boolean;
  qa: KeyQa;
  /** "#RRGGBB" of the sampled key. */
  keyColour: string;
  /** The trimmed, padded RGBA sprite (null only when no figure was found). */
  sprite: RgbaImage | null;
  /** Anchors in sprite px. */
  foot: Point;
  head: HeadAnchor;
  /** Figure height in source px. */
  figureH: number;
}

const RING = 12;
const PATCH = 24;

export const QA_LIMITS = Object.freeze({
  borderDeltaE: 6,
  margin: 0.06,
  residue: 0.002,
  holes: 0.001,
  speck: 0.005,
  pad: 0.04,
});

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Hue in degrees [0, 360) and HSV saturation (key.py hue_sat). */
export function hueSat(r: number, g: number, b: number): [number, number] {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn + 1e-6;
  let h: number;
  if (mx === r) h = ((((g - b) / d) % 6) + 6) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, (mx - mn) / Math.max(mx, 1e-6)];
}

/** Signed hue difference a - b, wrapped into [-180, 180). */
function hueDiff(a: number, b: number): number {
  return ((((a - b + 180) % 360) + 360) % 360) - 180;
}

const lin = (c: number) => { const v = c / 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; };
const labF = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

export function srgbToLab(r: number, g: number, b: number): [number, number, number] {
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const fx = labF(x), fy = labF(y), fz = labF(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function deltaE(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export const hex = (c: readonly number[]): string =>
  "#" + c.slice(0, 3).map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("").toUpperCase();

/* ── Morphology on float/byte masks (square windows, like PIL Min/MaxFilter) ── */

function morph(src: Float32Array, w: number, h: number, radius: number, op: "min" | "max"): Float32Array {
  if (radius <= 0) return src.slice();
  const pick = op === "min" ? Math.min : Math.max;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let v = src[row + x];
      const x0 = Math.max(0, x - radius), x1 = Math.min(w - 1, x + radius);
      for (let k = x0; k <= x1; k++) v = pick(v, src[row + k]);
      tmp[row + x] = v;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let v = tmp[y * w + x];
      const y0 = Math.max(0, y - radius), y1 = Math.min(h - 1, y + radius);
      for (let k = y0; k <= y1; k++) v = pick(v, tmp[k * w + x]);
      out[y * w + x] = v;
    }
  }
  return out;
}

const toFloat = (m: Uint8Array): Float32Array => { const f = new Float32Array(m.length); for (let i = 0; i < m.length; i++) f[i] = m[i]; return f; };
const toMask = (f: Float32Array, at = 0.5): Uint8Array => { const m = new Uint8Array(f.length); for (let i = 0; i < f.length; i++) m[i] = f[i] >= at ? 1 : 0; return m; };

/** 3x3 separable Gaussian, sigma 0.75 (the 0.75 px feather). */
function feather(src: Float32Array, w: number, h: number): Float32Array {
  const c = 0.5488, s = 0.2256;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    tmp[i] = c * src[i] + s * src[x > 0 ? i - 1 : i] + s * src[x < w - 1 ? i + 1 : i];
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    out[i] = c * tmp[i] + s * tmp[y > 0 ? i - w : i] + s * tmp[y < h - 1 ? i + w : i];
  }
  return out;
}

/** 4-connected component labels of a 0/1 mask. */
function label(mask: Uint8Array, w: number, h: number): { lab: Int32Array; sizes: number[] } {
  const lab = new Int32Array(w * h);
  const sizes: number[] = [0];
  const stack = new Int32Array(w * h);
  let n = 0;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || lab[start]) continue;
    n += 1;
    let sp = 0, size = 0;
    stack[sp++] = start;
    lab[start] = n;
    while (sp) {
      const i = stack[--sp];
      size++;
      const x = i % w, y = (i - x) / w;
      if (x > 0 && mask[i - 1] && !lab[i - 1]) { lab[i - 1] = n; stack[sp++] = i - 1; }
      if (x < w - 1 && mask[i + 1] && !lab[i + 1]) { lab[i + 1] = n; stack[sp++] = i + 1; }
      if (y > 0 && mask[i - w] && !lab[i - w]) { lab[i - w] = n; stack[sp++] = i - w; }
      if (y < h - 1 && mask[i + w] && !lab[i + w]) { lab[i + w] = n; stack[sp++] = i + w; }
    }
    sizes.push(size);
  }
  return { lab, sizes };
}

interface Figure { x0: number; x1: number; y0: number; y1: number; labels: number[] }

/** key.py figures(): components >= 0.5 % of the largest, merged when their
 *  x-ranges overlap (a detached hand or cape tip), left to right. */
function figuresOf(alpha: Float32Array, w: number, h: number): { figs: Figure[]; lab: Int32Array } {
  const { lab, sizes } = label(toMask(alpha), w, h);
  let max = 0;
  for (let k = 1; k < sizes.length; k++) if (sizes[k] > max) max = sizes[k];
  if (!max) return { figs: [], lab };
  const boxes = new Map<number, Figure>();
  for (let k = 1; k < sizes.length; k++) if (sizes[k] >= QA_LIMITS.speck * max) boxes.set(k, { x0: w, x1: -1, y0: h, y1: -1, labels: [k] });
  for (let i = 0; i < lab.length; i++) {
    const b = boxes.get(lab[i]);
    if (!b) continue;
    const x = i % w, y = (i - x) / w;
    b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y);
  }
  const sorted = [...boxes.values()].sort((a, b) => a.x0 - b.x0);
  const merged: Figure[] = [];
  for (const b of sorted) {
    const m = merged[merged.length - 1];
    if (m && b.x0 <= m.x1) {
      m.x0 = Math.min(m.x0, b.x0); m.x1 = Math.max(m.x1, b.x1); m.y0 = Math.min(m.y0, b.y0); m.y1 = Math.max(m.y1, b.y1);
      m.labels.push(...b.labels);
    } else merged.push({ ...b, labels: [...b.labels] });
  }
  return { figs: merged, lab };
}

/** Per-channel median of the border ring (histogram median, exact). */
export function sampleKey(img: RgbaImage): [number, number, number] {
  const { width: w, height: h, data } = img;
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  let n = 0;
  const ring = Math.min(RING, Math.floor(Math.min(w, h) / 4));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (y >= ring && y < h - ring && x >= ring && x < w - ring) continue;
    const i = (y * w + x) * 4;
    hist[0][data[i]]++; hist[1][data[i + 1]]++; hist[2][data[i + 2]]++;
    n++;
  }
  const med = (hh: Uint32Array) => { let acc = 0; for (let v = 0; v < 256; v++) { acc += hh[v]; if (acc * 2 >= n) return v; } return 255; };
  return [med(hist[0]), med(hist[1]), med(hist[2])];
}

/** Worst dE76 of 8 ring patches (the centre is the figure) against the key. */
export function borderDeltaE(img: RgbaImage, key: readonly number[]): number {
  const { width: w, height: h, data } = img;
  const p = Math.min(PATCH, Math.floor(Math.min(w, h) / 4));
  const ys = [0, Math.floor(h / 2 - p / 2), h - p];
  const xs = [0, Math.floor(w / 2 - p / 2), w - p];
  const klab = srgbToLab(key[0], key[1], key[2]);
  let worst = 0;
  for (const y0 of ys) for (const x0 of xs) {
    if (y0 === ys[1] && x0 === xs[1]) continue;
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = y0; y < y0 + p; y++) for (let x = x0; x < x0 + p; x++) {
      const i = (y * w + x) * 4; r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
    worst = Math.max(worst, deltaE(srgbToLab(r / n, g / n, b / n), klab));
  }
  return worst;
}

/** The colour-keyed alpha (key.py key_alpha), before erosion and feather. */
export function keyAlpha(img: RgbaImage, key: readonly number[]): Float32Array {
  const { width: w, height: h, data } = img;
  const [kh, ks] = hueSat(key[0], key[1], key[2]);
  const kc = Math.max(key[0], key[1], key[2]) - Math.min(key[0], key[1], key[2]);
  const alpha = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const r = data[p * 4], g = data[p * 4 + 1], b = data[p * 4 + 2];
    const [hh, s] = hueSat(r, g, b);
    const d = hueDiff(hh, kh);
    const band = smoothstep(-42, -30, d) * (1 - smoothstep(40, 50, d));
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    const satw = smoothstep(0.2 * kc, 0.5 * kc, chroma) * smoothstep(0.1 * ks, 0.45 * ks, s);
    alpha[p] = 1 - smoothstep(0.35, 0.85, band * satw);
  }
  return alpha;
}

/** Index of the key's dominant channel (1 = green for the chroma green). */
const dominant = (key: readonly number[]): 0 | 1 | 2 => (key[1] >= key[0] && key[1] >= key[2] ? 1 : key[2] >= key[0] ? 2 : 0);

/**
 * Key one generated pose (one figure on a flat key colour) and run the QA gate.
 * `ok` is false on any gate failure; `sprite` is still returned for review.
 */
export function keySprite(img: RgbaImage): KeyedSprite {
  const { width: W, height: H, data: src } = img;
  const fails: string[] = [];
  const key = sampleKey(img);
  const keyColour = hex(key);
  const klab = srgbToLab(key[0], key[1], key[2]);
  const [kh] = hueSat(key[0], key[1], key[2]);
  const c = dominant(key);
  const o1 = c === 0 ? 1 : 0, o2 = c === 2 ? 1 : 2;

  const worst = borderDeltaE(img, key);
  if (worst >= QA_LIMITS.borderDeltaE) fails.push(`border not uniform: dE ${worst.toFixed(1)} >= ${QA_LIMITS.borderDeltaE} (floor, gradient or vignette)`);

  const alphaRaw = keyAlpha(img, key);
  let alpha = morph(alphaRaw, W, H, 1, "min");
  const { figs, lab } = figuresOf(alpha, W, H);
  const empty: KeyedSprite = {
    ok: false, keyColour, sprite: null, foot: { x: 0, y: 0 }, head: { x: 0, y: 0, r: 0 }, figureH: 0,
    qa: { fails: [...fails, "no figure found"], borderDeltaE: worst, margins: null, residue: 0, holes: 0, figures: 0 },
  };
  if (!figs.length) return empty;
  if (figs.length > 1) fails.push(`${figs.length} figures found, 1 expected`);
  // The figure that is kept: the largest-area one when several were found.
  const fig = figs.length === 1 ? figs[0] : figs.slice().sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0))[0];
  const keepLabels = new Set<number>();
  for (const f of figs) for (const l of f.labels) keepLabels.add(l);
  const figLabels = new Set(fig.labels);
  const keep = new Uint8Array(W * H);
  const fmask = new Uint8Array(W * H);
  for (let i = 0; i < lab.length; i++) { if (keepLabels.has(lab[i])) keep[i] = 1; if (figLabels.has(lab[i])) fmask[i] = 1; }
  const near = morph(toFloat(keep), W, H, 3, "max");
  for (let i = 0; i < alpha.length; i++) if (near[i] < 0.5) alpha[i] = 0;
  alpha = feather(alpha, W, H);

  // Despill in the edge band (alpha > 0, not 4 px inside the hard mask).
  const inner = morph(toFloat(toMask(alpha)), W, H, 4, "min");
  const out = new Float32Array(W * H * 3);
  for (let p = 0; p < W * H; p++) {
    out[p * 3] = src[p * 4]; out[p * 3 + 1] = src[p * 4 + 1]; out[p * 3 + 2] = src[p * 4 + 2];
    if (alpha[p] > 0 && inner[p] < 0.5) {
      const cap = (out[p * 3 + o1] + out[p * 3 + o2]) / 2 + 6;
      if (out[p * 3 + c] > cap) out[p * 3 + c] = cap;
    }
  }

  // Margins (of the image size).
  const margins = { left: fig.x0 / W, right: (W - 1 - fig.x1) / W, top: fig.y0 / H, bottom: (H - 1 - fig.y1) / H };
  const low = Object.entries(margins).filter(([, v]) => v < QA_LIMITS.margin);
  if (low.length) fails.push("margin under 6 %: " + low.map(([k, v]) => `${k} ${(v * 100).toFixed(1)} %`).join(", "));

  // Residue: kept pixels with a visible key tint.
  const own = morph(toFloat(fmask), W, H, 3, "max");
  let opaque = 0, tinted = 0;
  for (let p = 0; p < W * H; p++) {
    if (own[p] < 0.5 || alpha[p] < 0.5) continue;
    opaque++;
    const r = out[p * 3], g = out[p * 3 + 1], b = out[p * 3 + 2];
    const v = [r, g, b];
    if (v[c] - Math.max(v[o1], v[o2]) > 8 && Math.abs(hueDiff(hueSat(r, g, b)[0], kh)) < 40) tinted++;
  }
  const residue = tinted / Math.max(opaque, 1);
  if (residue > QA_LIMITS.residue) fails.push(`key-hue residue ${(residue * 100).toFixed(2)} % > 0.2 %`);

  // Holes: enclosed pixels the COLOUR key removed whose source is not backdrop.
  const outside = new Uint8Array(W * H);
  const stack = new Int32Array(W * H);
  let sp = 0;
  const isWall = (p: number) => own[p] >= 0.5 && alpha[p] >= 0.5;
  const seed = (p: number) => { if (!outside[p] && !isWall(p)) { outside[p] = 1; stack[sp++] = p; } };
  for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
  while (sp) {
    const p = stack[--sp];
    const x = p % W, y = (p - x) / W;
    if (x > 0) seed(p - 1);
    if (x < W - 1) seed(p + 1);
    if (y > 0) seed(p - W);
    if (y < H - 1) seed(p + W);
  }
  let holes = 0;
  for (let p = 0; p < W * H; p++) {
    if (outside[p] || isWall(p) || own[p] < 0.5 || alphaRaw[p] >= 0.5) continue;
    const r = src[p * 4], g = src[p * 4 + 1], b = src[p * 4 + 2];
    const dk = deltaE(srgbToLab(r, g, b), klab);
    const dh = hueDiff(hueSat(r, g, b)[0], kh);
    const backdrop = dk < 12 || (dh > -42 && dh < 20);
    if (!backdrop) holes++;
  }
  const holeShare = holes / Math.max(opaque, 1);
  if (holeShare > QA_LIMITS.holes) fails.push(`holes inside the figure ${holes} px (${(holeShare * 100).toFixed(2)} % > 0.1 %): a figure colour was keyed away`);

  // Trim + 4 % padding; only this figure's alpha in the crop.
  const fh = fig.y1 - fig.y0 + 1, fw = fig.x1 - fig.x0 + 1;
  const pad = Math.round(QA_LIMITS.pad * Math.max(fh, fw));
  const cx0 = Math.max(0, fig.x0 - pad), cy0 = Math.max(0, fig.y0 - pad);
  const cx1 = Math.min(W, fig.x1 + pad + 1), cy1 = Math.min(H, fig.y1 + pad + 1);
  const sw = cx1 - cx0, sh = cy1 - cy0;
  const data = new Uint8ClampedArray(sw * sh * 4);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const p = (y + cy0) * W + (x + cx0);
    const q = (y * sw + x) * 4;
    const a = own[p] >= 0.5 ? alpha[p] : 0;
    data[q] = out[p * 3]; data[q + 1] = out[p * 3 + 1]; data[q + 2] = out[p * 3 + 2]; data[q + 3] = Math.round(a * 255);
  }
  const sprite: RgbaImage = { width: sw, height: sh, data };
  const { foot, head } = basicAnchors(sprite);
  return {
    ok: fails.length === 0,
    keyColour,
    sprite,
    foot,
    head,
    figureH: fh,
    qa: { fails, borderDeltaE: worst, margins, residue, holes, figures: figs.length },
  };
}

/* ── Anchors ──────────────────────────────────────────────────────────────── */

const opaqueAt = (img: RgbaImage, x: number, y: number) => img.data[(y * img.width + x) * 4 + 3] >= 128;

function opaqueRows(img: RgbaImage): number[] {
  const rows: number[] = [];
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) if (opaqueAt(img, x, y)) { rows.push(y); break; }
  }
  return rows;
}

/** foot = centre of the lowest 3 % of opaque rows (y = the lowest opaque row);
 *  head = the top 28 % band (x = centre of the widest run through the band's
 *  centre column, r = half that run). key.py, step 6. */
export function basicAnchors(img: RgbaImage): { foot: Point; head: HeadAnchor } {
  const rows = opaqueRows(img);
  if (!rows.length) return { foot: { x: img.width / 2, y: img.height - 1 }, head: { x: img.width / 2, y: 0, r: 0 } };
  const top = rows[0], bot = rows[rows.length - 1];
  const nlow = Math.max(1, Math.round(0.03 * rows.length));
  const low = rows.slice(-nlow);
  let sx = 0, n = 0;
  for (let x = 0; x < img.width; x++) if (low.some((y) => opaqueAt(img, x, y))) { sx += x; n++; }
  const foot = { x: n ? sx / n : img.width / 2, y: bot };
  const bandH = Math.max(1, Math.floor(0.28 * (bot - top + 1)));
  let cx = 0, cn = 0;
  for (let x = 0; x < img.width; x++) {
    for (let y = top; y < top + bandH; y++) if (opaqueAt(img, x, y)) { cx += x; cn++; break; }
  }
  const hx = cn ? cx / cn : img.width / 2;
  let best = { w: 0, x: hx };
  const xi = Math.min(img.width - 1, Math.max(0, Math.round(hx)));
  for (let y = top; y < top + bandH; y++) {
    if (!opaqueAt(img, xi, y)) continue;
    let l = xi, r = xi;
    while (l > 0 && opaqueAt(img, l - 1, y)) l--;
    while (r < img.width - 1 && opaqueAt(img, r + 1, y)) r++;
    if (r - l + 1 > best.w) best = { w: r - l + 1, x: (l + r) / 2 };
  }
  return { foot, head: { x: best.x, y: top + bandH / 2, r: best.w / 2 } };
}

/** The colour on top of the idle's head (hair or hat): median of the opaque
 *  pixels in the top 4 % of the figure, within half a head of its centre. */
export function sampleHeadTopColour(idle: RgbaImage): [number, number, number] | null {
  const { head } = basicAnchors(idle);
  const rows = opaqueRows(idle);
  if (!rows.length || head.r <= 0) return null;
  const top = rows[0], figH = rows[rows.length - 1] - top + 1;
  const ch: number[][] = [[], [], []];
  for (let y = top; y < top + Math.max(2, Math.round(0.04 * figH)); y++) {
    for (let x = Math.max(0, Math.floor(head.x - head.r * 0.5)); x <= Math.min(idle.width - 1, Math.ceil(head.x + head.r * 0.5)); x++) {
      if (!opaqueAt(idle, x, y)) continue;
      const i = (y * idle.width + x) * 4;
      ch[0].push(idle.data[i]); ch[1].push(idle.data[i + 1]); ch[2].push(idle.data[i + 2]);
    }
  }
  if (!ch[0].length) return null;
  const med = (v: number[]) => v.sort((a, b) => a - b)[Math.floor(v.length / 2)];
  return [med(ch[0]), med(ch[1]), med(ch[2])];
}

export interface HeadMeasure {
  /** Head width, sprite px. */
  w: number;
  /** Head centre x, the hair-top row, the widest row. */
  x: number;
  hairTop: number;
  row: number;
  run: number;
  mop: number;
}

/** Mask of opaque pixels close to `colour` (dE < 18) in the top half of the figure. */
function colourMask(img: RgbaImage, colour: readonly number[] | null): Uint8Array {
  const m = new Uint8Array(img.width * img.height);
  if (!colour) return m;
  const rows = opaqueRows(img);
  if (!rows.length) return m;
  const lim = rows[0] + Math.floor((rows[rows.length - 1] - rows[0]) / 2);
  const ref = srgbToLab(colour[0], colour[1], colour[2]);
  for (let y = rows[0]; y < lim; y++) for (let x = 0; x < img.width; x++) {
    const i = (y * img.width + x) * 4;
    if (img.data[i + 3] < 128) continue;
    if (deltaE(srgbToLab(img.data[i], img.data[i + 1], img.data[i + 2]), ref) < 18) m[y * img.width + x] = 1;
  }
  return m;
}

function runThrough(mask: Uint8Array | Float32Array, w: number, x: number, y: number): [number, number, number] {
  const i = y * w + x;
  if (mask[i] < 0.5) return [0, x, x];
  let l = x, r = x;
  while (l > 0 && mask[i - (x - l) - 1] >= 0.5) l--;
  while (r < w - 1 && mask[i + (r - x) + 1] >= 0.5) r++;
  return [r - l + 1, l, r];
}

/**
 * Head width of one pose (normalise.py measure + hair_mop, generalised):
 * `headTop` = the idle's head-top colour; `k` = the idle's run/mop ratio (pass
 * null when measuring the idle itself).
 */
export function measureHead(img: RgbaImage, headTop: readonly number[] | null, k: number | null): HeadMeasure {
  const { width: w, height: h } = img;
  const al = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) al[p] = img.data[p * 4 + 3] >= 128 ? 1 : 0;
  const closed = morph(morph(al, w, h, 4, "max"), w, h, 4, "min");
  const rows = opaqueRows(img);
  const basic = basicAnchors(img);
  if (!rows.length) return { w: 0, x: basic.head.x, hairTop: 0, row: 0, run: 0, mop: 0 };
  const top = rows[0], figH = rows[rows.length - 1] - top + 1;

  // Head column: median x of the head-top colour (raised fists and the cape
  // are other colours, so they do not pull it), else the band centre.
  const cm = colourMask(img, headTop);
  const xs: number[] = [];
  for (let p = 0; p < cm.length; p++) if (cm[p]) xs.push(p % w);
  let hx = xs.length > 20 ? xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)] : Math.round(basic.head.x);
  hx = Math.min(w - 1, Math.max(0, Math.round(hx)));

  // Opaque run through the head column (closed mask: curl gaps do not end it).
  let hair = -1;
  for (let y = 0; y < h; y++) if (closed[y * w + hx] >= 0.5) { hair = y; break; }
  if (hair < 0) return { w: basic.head.r * 2, x: basic.head.x, hairTop: top, row: top, run: basic.head.r * 2, mop: 0 };
  const settle = Math.floor(0.06 * figH);
  let best = 0, by = 0, bl = hx, br = hx;
  for (let i = 0; hair + i < h; i++) {
    const [rw, l, r] = runThrough(closed, w, hx, hair + i);
    if (rw > best) { best = rw; by = i; bl = l; br = r; }
    else if (best && rw < 0.85 * best && i > by && i > settle) break;
  }

  // Head-top colour mop (closed 7 px): widest row through the head column.
  const mopMask = morph(morph(toFloat(cm), w, h, 7, "max"), w, h, 7, "min");
  let mop = 0;
  for (let y = 0; y < h; y++) mop = Math.max(mop, runThrough(mopMask, w, hx, y)[0]);

  let width = best, x = (bl + br) / 2;
  if (k && mop > 0) {
    const fromMop = k * mop;
    if (best > 1.3 * fromMop) { width = fromMop; x = hx; } // raised arms touch the hair: the run is not the head
    else width = (best + fromMop) / 2;
  }
  return { w: width, x, hairTop: hair, row: hair + by, run: best, mop };
}

/** hold-up: the hands = centroids of the opaque pixels in the top 15 % of the
 *  figure left / right of the head (outside half a head radius). */
export function handAnchors(img: RgbaImage, head: HeadAnchor): HandAnchor | undefined {
  const rows = opaqueRows(img);
  if (!rows.length) return undefined;
  const top = rows[0], figH = rows[rows.length - 1] - top + 1;
  const sides = { l: [0, 0, 0], r: [0, 0, 0] };
  for (let y = top; y < top + Math.max(2, Math.round(0.15 * figH)); y++) for (let x = 0; x < img.width; x++) {
    if (!opaqueAt(img, x, y)) continue;
    const s = x < head.x - head.r * 0.5 ? sides.l : x > head.x + head.r * 0.5 ? sides.r : null;
    if (s) { s[0] += x; s[1] += y; s[2]++; }
  }
  const pt = (s: number[]): [number, number] | undefined => (s[2] > 4 ? [round1(s[0] / s[2]), round1(s[1] / s[2])] : undefined);
  const l = pt(sides.l), r = pt(sides.r);
  return l || r ? { ...(l ? { l } : {}), ...(r ? { r } : {}) } : undefined;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** oops: the seat = the end of the first opaque run down the head column. */
function seatOf(img: RgbaImage, x: number, hairTop: number, foot: Point): Point {
  const xi = Math.min(img.width - 1, Math.max(0, Math.round(x)));
  let y = hairTop;
  while (y < img.height - 1 && opaqueAt(img, xi, y + 1)) y++;
  const rows = opaqueRows(img);
  const mid = rows.length ? rows[0] + (rows[rows.length - 1] - rows[0]) / 2 : 0;
  return y > mid ? { x: xi, y } : foot;
}

export interface NormalisedPose {
  /** Resample factor to apply to the keyed sprite. */
  resize: number;
  /** Residual draw factor (HeroSprite.scale) when the resample was capped. */
  scale: number;
  /** Output sprite size and anchors, in OUTPUT px (after `resize`). */
  w: number;
  h: number;
  foot: Point;
  head: HeadAnchor;
  hand?: HandAnchor;
  /** Head width measured in source px (QA: drift report). */
  headW: number;
}

export const SHEET_IDLE_H = 960;
const MAX_OUT_H = 1400;
const MAX_UPSCALE = 2;

/**
 * One pixels-per-head scale for the whole sheet: idle is exported SHEET_IDLE_H
 * px tall; every other pose is resampled so its head width equals the idle's.
 * A resample capped by MAX_OUT_H / MAX_UPSCALE carries the rest in `scale`.
 */
export function normalisePoses<P extends string>(sprites: Partial<Record<P, RgbaImage>>, idlePose: NoInfer<P>): Partial<Record<P, NormalisedPose>> {
  const idle = sprites[idlePose];
  const out: Partial<Record<P, NormalisedPose>> = {};
  if (!idle) return out;
  const ref = sheetReference(idle);
  for (const pose of Object.keys(sprites) as P[]) {
    const img = sprites[pose];
    if (img) out[pose] = normalisePose(pose, img, ref);
  }
  return out;
}

/** What every pose is normalised against, learned once from the idle (the
 *  keyed idle, or the stored 960 px idle when a build resumes). */
export interface SheetReference {
  headTop: [number, number, number] | null;
  /** The idle's run/mop ratio (null: no head-top colour found). */
  k: number | null;
  /** Head width the sheet is drawn at, output px. */
  target: number;
  /** The idle's own resample factor to SHEET_IDLE_H. */
  idleResize: number;
}

export function sheetReference(idle: RgbaImage): SheetReference {
  const headTop = sampleHeadTopColour(idle);
  const mi = measureHead(idle, headTop, null);
  const k = mi.mop > 0 ? mi.run / mi.mop : null;
  const idleM = k ? measureHead(idle, headTop, k) : mi;
  const idleResize = SHEET_IDLE_H / idle.height;
  return { headTop, k, target: idleM.w * idleResize, idleResize };
}

/** One pose at the sheet's pixels-per-head (the idle itself: SHEET_IDLE_H tall). */
export function normalisePose(pose: string, img: RgbaImage, ref: SheetReference): NormalisedPose {
  const m = measureHead(img, ref.headTop, ref.k);
  const want = pose === "idle" ? ref.idleResize : m.w > 0 ? ref.target / m.w : ref.idleResize;
  // The idle IS the reference (drawn at the figure height the game asks for):
  // always SHEET_IDLE_H tall, scale 1. Other poses are capped; `scale` carries the rest.
  const resize = pose === "idle" ? want : Math.min(want, MAX_UPSCALE, MAX_OUT_H / img.height);
  const r = (m.w / 2) * resize;
  let foot = basicAnchors(img).foot;
  if (pose === "oops") foot = seatOf(img, m.x, m.hairTop, foot);
  const hy = Math.max(((m.hairTop + m.row) / 2) * resize, m.hairTop * resize + r * 0.9);
  const head = { x: round1(m.x * resize), y: round1(hy), r: round1(r) };
  const hand = pose === "hold-up" ? handAnchors(img, { x: m.x, y: hy / resize, r: m.w / 2 }) : undefined;
  const at = (p: [number, number]): [number, number] => [round1(p[0] * resize), round1(p[1] * resize)];
  const outHand: HandAnchor | undefined = hand ? { ...(hand.l ? { l: at(hand.l) } : {}), ...(hand.r ? { r: at(hand.r) } : {}) } : undefined;
  return {
    resize,
    scale: Math.round((want / resize) * 10000) / 10000,
    w: Math.max(1, Math.round(img.width * resize)),
    h: Math.max(1, Math.round(img.height * resize)),
    foot: { x: round1(foot.x * resize), y: round1(foot.y * resize) },
    head,
    ...(outHand ? { hand: outHand } : {}),
    headW: m.w,
  };
}
