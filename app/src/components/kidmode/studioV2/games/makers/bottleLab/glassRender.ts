/** The glass itself: a small software renderer. For every pixel of the bottle
 * it works out where the eye's ray lands on the picture behind (the room, the
 * bench, Aya, the stickers on the far side: whatever the scene drew into
 * `behind`), fetches red, green and blue at slightly different places
 * (dispersion: the coloured fringe at every bright edge), then lets the glass
 * act on that light: tint that deepens where the ray runs through more
 * glass, the dark and bright bands along the outline, the pavilion's windows
 * mirrored as streaks, frost that blurs and veils, the glow of hot glass, the
 * strong lens of water. Nothing here is drawn with a stroke: the bottle is
 * only what it does to the room.
 *
 * It runs on a buffer a fraction of the screen's size (a few tens of
 * thousands of pixels) and the scene scales it up; fine lines (lip, foot,
 * water line, stickers) are drawn over it at full sharpness by the scene. */
import { DISPERSION, glassPath, lensAir, lensWet } from './glassworks';

export type Rgb = readonly [number, number, number];
export interface GlassFrame {
  /** Per buffer row: the axis (buffer px) and half-width (buffer px, 0 = no glass on this row). */
  axis: Float32Array; radius: Float32Array;
  /** The first and last rows of the body proper (between them the caps are the lip and the foot). */
  topRow: number; footRow: number;
  /** The water line's row (past the last row: no water) and its tilt (rows per radius across). */
  waterRow: number; waterTilt: number;
  /** The glass's colour above the soak front and below it; the front's row. Colours are 0..1 pass-through. */
  tintFrom: Rgb; tintTo: Rgb; tintFront: number;
  /** 0 shiny .. 1 frosted. */
  frost: number;
  /** 0 cold .. 1 glowing hot. */
  heat: number;
  /** 0 daylight .. 1 the finale's sun behind the glass. */
  glow: number;
  /** 0 .. 1: the secret's rainbow. */
  rainbow: number;
  /** -1 .. 1: where the window streaks sit (they slide with the pointer and the wobble). */
  light: number;
  time: number;
  /** The scene's own colours, resolved from the palette (0..255). */
  sky: Rgb; ember: Rgb; flame: Rgb; veil: Rgb;
}

const LUT = 512;
const NZ = new Float32Array(LUT), AIR = new Float32Array(LUT), WET = new Float32Array(LUT), PATH = new Float32Array(LUT), EDGE_MUL = new Float32Array(LUT), EDGE_ADD = new Float32Array(LUT), FRESNEL = new Float32Array(LUT);
for (let n = 0; n < LUT; n++) {
  const a = (n + 0.5) / LUT, nz = Math.sqrt(Math.max(0, 1 - a * a));
  NZ[n] = nz; AIR[n] = lensAir(a); WET[n] = lensWet(a); PATH[n] = glassPath(nz);
  const bell = (at: number, wide: number) => Math.exp(-(((a - at) / wide) ** 2));
  // A soft darkening toward the outline, the dark band of light thrown back inside the wall, a bright hairline, the dark rim.
  EDGE_MUL[n] = 1 - 0.1 * Math.max(0, (a - 0.6) / 0.4) ** 2 - 0.36 * bell(0.915, 0.034) - 0.4 * bell(0.995, 0.012);
  EDGE_ADD[n] = 0.82 * bell(0.964, 0.011) + 0.16 * bell(0.86, 0.02);
  FRESNEL[n] = 0.34 * (1 - nz) ** 2.4;
}

export interface Glass {
  /** Sizes the buffers; returns the context the scene draws the picture behind the glass into. */
  resize(width: number, height: number): CanvasRenderingContext2D | null;
  /** Shades one frame from what `behind` holds now; returns the canvas to draw. */
  render(frame: GlassFrame): HTMLCanvasElement | null;
  readonly width: number; readonly height: number;
  dispose(): void;
}

/** Blobby noise in 0..255: frost creeps out from a few spots, and never looks like static. */
function frostNoise(width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height), gw = 9, gh = 12, grid = new Float32Array((gw + 1) * (gh + 1));
  let s = 97531;
  const roll = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let n = 0; n < grid.length; n++) grid[n] = roll();
  for (let j = 0; j < height; j++) {
    const gy = j / height * gh, y0 = Math.floor(gy), fy = gy - y0, sy = fy * fy * (3 - 2 * fy);
    for (let i = 0; i < width; i++) {
      const gx = i / width * gw, x0 = Math.floor(gx), fx = gx - x0, sx = fx * fx * (3 - 2 * fx);
      const a = grid[y0 * (gw + 1) + x0], b = grid[y0 * (gw + 1) + x0 + 1], c = grid[(y0 + 1) * (gw + 1) + x0], d = grid[(y0 + 1) * (gw + 1) + x0 + 1];
      const blob = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
      out[j * width + i] = Math.max(0, Math.min(255, (blob * 0.8 + roll() * 0.2) * 255));
    }
  }
  return out;
}

export function createGlass(): Glass | null {
  if (typeof document === 'undefined') return null;
  const behindCanvas = document.createElement('canvas'), blurSmall = document.createElement('canvas'), blurCanvas = document.createElement('canvas'), outCanvas = document.createElement('canvas');
  let behind: CanvasRenderingContext2D | null = null, blurS: CanvasRenderingContext2D | null = null, blur: CanvasRenderingContext2D | null = null, out: CanvasRenderingContext2D | null = null;
  let w = 0, h = 0, image: ImageData | null = null, noise: Uint8Array | null = null;
  const streak = new Float32Array(1024), tintA = new Float32Array(LUT * 3), tintB = new Float32Array(LUT * 3), bodyB = new Float32Array(LUT * 3);
  let lastTint = '';

  return {
    get width() { return w; }, get height() { return h; },
    resize(width, height) {
      const nw = Math.max(8, Math.round(width)), nh = Math.max(8, Math.round(height));
      if (nw !== w || nh !== h || !behind) {
        w = nw; h = nh;
        behindCanvas.width = w; behindCanvas.height = h; outCanvas.width = w; outCanvas.height = h; blurCanvas.width = w; blurCanvas.height = h;
        blurSmall.width = Math.max(4, Math.round(w / 7)); blurSmall.height = Math.max(4, Math.round(h / 7));
        try {
          behind = behindCanvas.getContext('2d', { willReadFrequently: true });
          blur = blurCanvas.getContext('2d', { willReadFrequently: true });
          blurS = blurSmall.getContext('2d'); out = outCanvas.getContext('2d');
          image = out ? out.createImageData(w, h) : null;
        } catch { behind = null; }
        noise = frostNoise(w, h);
      }
      return behind;
    },
    render(f) {
      if (!behind || !out || !image || !noise) return null;
      let src: Uint8ClampedArray, soft: Uint8ClampedArray | null = null;
      try {
        src = behind.getImageData(0, 0, w, h).data;
        if (f.frost > 0.01 && blur && blurS) {
          // A cheap wide blur that every browser has: down to a seventh, and back up smoothed.
          blurS.imageSmoothingEnabled = true; blurS.drawImage(behindCanvas, 0, 0, blurSmall.width, blurSmall.height);
          blur.imageSmoothingEnabled = true; blur.drawImage(blurSmall, 0, 0, w, h);
          soft = blur.getImageData(0, 0, w, h).data;
        }
      } catch { return null; }
      const dst = image.data; dst.fill(0);

      // The glass's colour, per distance from the axis: pale in the middle, deep at the edge.
      const key = `${f.tintFrom.join()}|${f.tintTo.join()}`;
      if (key !== lastTint) {
        lastTint = key;
        for (let n = 0; n < LUT; n++) for (let c = 0; c < 3; c++) {
          tintA[n * 3 + c] = Math.pow(Math.max(0.02, f.tintFrom[c]), 0.34 * PATH[n]);
          tintB[n * 3 + c] = Math.pow(Math.max(0.02, f.tintTo[c]), 0.34 * PATH[n]);
          // Water takes a little of the glass's colour right through its middle.
          bodyB[n * 3 + c] = Math.pow(Math.max(0.02, f.tintTo[c]), 0.2 * NZ[n]);
        }
      }
      // The pavilion's windows on the glass: two streaks to the left, a soft one to the right; frost spreads them.
      const spread = 1 + f.frost * 2.4, amp = 1 - f.frost * 0.62, shift = f.light * 0.09;
      for (let n = 0; n < 1024; n++) {
        const u = (n + 0.5) / 512 - 1, bell = (at: number, wide: number) => Math.exp(-(((u - at - shift) / (wide * spread)) ** 2));
        streak[n] = amp * (0.78 * bell(-0.5, 0.062) + 0.5 * bell(-0.33, 0.016) + 0.3 * bell(0.62, 0.05) + 0.16 * bell(0.78, 0.014));
      }

      const { axis, radius } = f, lastRow = h - 1, lastCol = w - 1.001;
      const frostCut = f.frost * 1.3, heat = f.heat, glow = f.glow, rain = f.rainbow;
      const dR = DISPERSION.red, dB = DISPERSION.blue, extra = 1 + rain * 5;
      const midWet = (Math.min(lastRow, f.waterRow) + f.footRow) / 2, midAir = f.footRow - (f.footRow - f.topRow) * 0.36;
      for (let j = 0; j < h; j++) {
        const R = radius[j];
        if (!(R > 0.6)) continue;
        const ax = axis[j], from = Math.max(0, Math.ceil(ax - R - 0.5)), to = Math.min(w - 1, Math.floor(ax + R + 0.5));
        // How the surface leans on this row: a shoulder faces the sky and shines, a belly turning under faces the bench.
        const above = radius[Math.max(0, j - 2)] || R, below = radius[Math.min(lastRow, j + 2)] || R, slope = (below - above) / 4;
        const inBody = j >= f.topRow && j <= f.footRow;
        const bodyV = (j - f.topRow) / Math.max(1, f.footRow - f.topRow);
        // A window's streak is not endless: it starts under the lip, is brightest on the shoulder and fades over the belly.
        const pane = bodyV < 0.5 ? Math.min(1, Math.max(0, (bodyV - 0.04) / 0.14)) : Math.max(0.16, 1 - (bodyV - 0.5) / 0.36);
        const shine = inBody ? Math.max(0.2, Math.min(1.35, 0.72 + slope * 1.5)) * pane : 0.4;
        // Hot glass is hottest low down, where it sits on the pad.
        const rowHeat = heat * (0.7 + 0.3 * Math.max(0, Math.min(1, bodyV)) ** 1.5);
        const tintMix = Math.max(0, Math.min(1, (j - f.tintFront) / 5 + 0.5));
        for (let i = from; i <= to; i++) {
          const u = (i + 0.5 - ax) / R, au = u < 0 ? -u : u;
          if (au >= 1.02) continue;
          const n = au >= 1 ? LUT - 1 : (au * LUT) | 0, sign = u < 0 ? -1 : 1, nz = NZ[n];
          const wet = j > f.waterRow + f.waterTilt * u && au < 0.955;
          // Where the ray lands behind the glass.
          let off: number, sy = j;
          if (wet) { off = ax + R * sign * WET[n] - (i + 0.5); sy = midWet + (j - midWet) * 0.84; }
          else { off = R * sign * AIR[n]; sy = midAir + (j - midAir) * 1.16 - slope * nz * 3; }
          if (heat > 0) off += Math.sin(j * 0.21 + f.time * 2.6 + u * 2) * rowHeat * R * 0.035;
          const row = (sy < 0 ? 0 : sy > lastRow ? lastRow : sy | 0) * w;
          let r: number, g: number, b: number;
          {
            let x = i + off * (wet ? 1 - (1 - dR) * 0.5 * extra : 1 - (1 - dR) * extra); x = x < 0 ? 0 : x > lastCol ? lastCol : x; let x0 = x | 0, fx = x - x0, p = (row + x0) * 4;
            r = src[p] + (src[p + 4] - src[p]) * fx;
            x = i + off; x = x < 0 ? 0 : x > lastCol ? lastCol : x; x0 = x | 0; fx = x - x0; p = (row + x0) * 4;
            g = src[p + 1] + (src[p + 5] - src[p + 1]) * fx;
            const gp = p;
            x = i + off * (wet ? 1 + (dB - 1) * 0.5 * extra : 1 + (dB - 1) * extra); x = x < 0 ? 0 : x > lastCol ? lastCol : x; x0 = x | 0; fx = x - x0; p = (row + x0) * 4;
            b = src[p + 2] + (src[p + 6] - src[p + 2]) * fx;
            // Frost: the same place, blurred, where the frost has reached.
            if (soft) {
              // Water wets the rough inside of frosted glass, and wet frost lets far more of the picture through.
              const fr = (frostCut - noise[j * w + i] / 255) * 5, k = (fr <= 0 ? 0 : fr >= 1 ? 1 : fr) * (wet ? 0.42 : 1);
              if (k > 0) {
                const grain = ((noise[(j * w + i * 7 + 13) % noise.length] & 31) - 15) * 0.5;
                const v0 = f.veil[0], v1 = f.veil[1], v2 = f.veil[2];
                r += ((soft[gp] * 0.6 + v0 * 0.4 + grain) - r) * k; g += ((soft[gp + 1] * 0.6 + v1 * 0.4 + grain) - g) * k; b += ((soft[gp + 2] * 0.6 + v2 * 0.4 + grain) - b) * k;
              }
            }
          }
          // The glass's own colour.
          const t = n * 3;
          let tr = tintA[t] + (tintB[t] - tintA[t]) * tintMix, tg = tintA[t + 1] + (tintB[t + 1] - tintA[t + 1]) * tintMix, tb = tintA[t + 2] + (tintB[t + 2] - tintA[t + 2]) * tintMix;
          if (wet) { tr *= bodyB[t]; tg *= bodyB[t + 1]; tb *= bodyB[t + 2]; }
          const band = EDGE_MUL[n] + (1 - EDGE_MUL[n]) * f.frost * 0.45;
          r *= tr * band; g *= tg * band; b *= tb * band;
          // The finale's sun behind it: the glass lights up in its own colour.
          if (glow > 0) { const lift = glow * (0.2 + 0.5 * nz); r += (255 - r) * lift * tr * 0.55; g += (255 - g) * lift * tg * 0.55; b += (255 - b) * lift * tb * 0.55; }
          // Sky off the curving surface, the windows' streaks, the bright hairline inside the outline.
          const fres = FRESNEL[n], add = (EDGE_ADD[n] * (1 - f.frost * 0.5) + streak[u >= 0.998 ? 1023 : u <= -1 ? 0 : ((u + 1) * 512) | 0] * shine) * (1 - rowHeat * 0.3);
          r += (f.sky[0] - r) * fres; g += (f.sky[1] - g) * fres; b += (f.sky[2] - b) * fres;
          r += (255 - r) * add; g += (255 - g) * add; b += (255 - b) * add;
          if (rowHeat > 0) {
            // Hot glass glows from inside: ember at the edge, flame in the thick middle.
            const core = nz * nz, e = rowHeat * (0.64 + 0.3 * core);
            const hr = f.ember[0] + (f.flame[0] - f.ember[0]) * core, hg = f.ember[1] + (f.flame[1] - f.ember[1]) * core, hb = f.ember[2] + (f.flame[2] - f.ember[2]) * core;
            r += (hr - r) * e; g += (hg - g) * e; b += (hb - b) * e;
            const hot = rowHeat * rowHeat * core * 0.5; r += (255 - r) * hot; g += (255 - g) * hot * 0.92; b += (255 - b) * hot * 0.55;
          }
          if (rain > 0) {
            // The secret: a band of spectrum crossing the glass.
            const ph = u * 1.6 + j * 0.012 - f.time * 0.9, k = rain * 0.34 * nz;
            r += (255 - r) * k * (0.5 + 0.5 * Math.sin(ph * 6.283)); g += (255 - g) * k * (0.5 + 0.5 * Math.sin(ph * 6.283 + 2.094)); b += (255 - b) * k * (0.5 + 0.5 * Math.sin(ph * 6.283 + 4.189));
          }
          const o = (j * w + i) * 4, edge = (1 - au) * R + 0.5;
          dst[o] = r; dst[o + 1] = g; dst[o + 2] = b; dst[o + 3] = edge >= 1 ? 255 : edge <= 0 ? 0 : edge * 255;
        }
      }
      out.putImageData(image, 0, 0);
      return outCanvas;
    },
    dispose() { behind = null; blur = null; blurS = null; out = null; image = null; noise = null; behindCanvas.width = behindCanvas.height = 0; outCanvas.width = outCanvas.height = 0; blurCanvas.width = blurCanvas.height = 0; blurSmall.width = blurSmall.height = 0; },
  };
}
