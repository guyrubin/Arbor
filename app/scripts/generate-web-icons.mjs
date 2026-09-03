/**
 * W2 — web/PWA icon pipeline (store-polish audit S4).
 *
 * Source of truth: icons/icon-*.webp — which are PNG data with a .webp
 * extension (verified by magic bytes; this script fails loudly if a real
 * WebP ever lands there, because pure-Node cannot decode VP8).
 *
 * Outputs, all under public/icons/ so vite actually ships them:
 *   icon-{48,72,96,128,192,256,512}.png   — byte-for-byte copies, honest .png names
 *   icon-maskable-{192,512}.png           — mascot at ~66% centered on the paper
 *                                           background (#fbfaf7), per the maskable
 *                                           safe-zone spec (radius 0.4 → 80% circle)
 *   apple-touch-icon.png                  — 180x180, mascot full-tile on opaque paper
 *                                           (iOS composites onto black otherwise)
 *
 * No image dependency exists in node_modules (no sharp/jimp), so this is a
 * self-contained PNG codec: zlib inflate/deflate + scanline unfilter/filter,
 * area-average resampling with premultiplied alpha. Non-interlaced 8-bit
 * RGBA/RGB input only — exactly what the icon set is.
 *
 * Run: node scripts/generate-web-icons.mjs   (from app/)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(appDir, "icons");
const outDir = path.join(appDir, "public", "icons");

const PAPER = { r: 0xfb, g: 0xfa, b: 0xf7 }; // --arbor-paper, matches theme-color
const SIZES = [48, 72, 96, 128, 192, 256, 512];
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// ---------------------------------------------------------------- PNG decode

function decodePng(buf, name) {
  if (!buf.subarray(0, 8).equals(PNG_MAGIC)) {
    throw new Error(`${name} is not PNG data (a real .webp needs an image library)`);
  }
  let pos = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + len;
  }
  if (bitDepth !== 8 || interlace !== 0 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(`${name}: unsupported PNG (bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace})`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rgba = Buffer.alloc(width * height * 4);
  const prev = Buffer.alloc(stride);
  const cur = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    raw.copy(cur, 0, y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? cur[i - channels] : 0;
      const up = prev[i];
      const ul = i >= channels ? prev[i - channels] : 0;
      let v = cur[i];
      if (filter === 1) v = (v + left) & 0xff;
      else if (filter === 2) v = (v + up) & 0xff;
      else if (filter === 3) v = (v + ((left + up) >> 1)) & 0xff;
      else if (filter === 4) v = (v + paeth(left, up, ul)) & 0xff;
      else if (filter !== 0) throw new Error(`${name}: unknown filter ${filter}`);
      cur[i] = v;
    }
    for (let x = 0; x < width; x++) {
      const s = x * channels, d = (y * width + x) * 4;
      rgba[d] = cur[s];
      rgba[d + 1] = cur[s + 1];
      rgba[d + 2] = cur[s + 2];
      rgba[d + 3] = channels === 4 ? cur[s + 3] : 255;
    }
    cur.copy(prev);
  }
  return { width, height, rgba };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

// ---------------------------------------------------------------- PNG encode

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: None — deflate does fine on flat art
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    PNG_MAGIC,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------- resample + composite

/** Area-average downscale (premultiplied alpha, fractional source boxes). */
function resize(img, dw, dh) {
  const { width: sw, height: sh, rgba } = img;
  const out = Buffer.alloc(dw * dh * 4);
  const rx = sw / dw, ry = sh / dh;
  for (let dy = 0; dy < dh; dy++) {
    const sy0 = dy * ry, sy1 = (dy + 1) * ry;
    for (let dx = 0; dx < dw; dx++) {
      const sx0 = dx * rx, sx1 = (dx + 1) * rx;
      let r = 0, g = 0, b = 0, a = 0, w = 0;
      for (let sy = Math.floor(sy0); sy < Math.min(Math.ceil(sy1), sh); sy++) {
        const wy = Math.min(sy + 1, sy1) - Math.max(sy, sy0);
        for (let sx = Math.floor(sx0); sx < Math.min(Math.ceil(sx1), sw); sx++) {
          const wx = Math.min(sx + 1, sx1) - Math.max(sx, sx0);
          const weight = wx * wy;
          const s = (sy * sw + sx) * 4;
          const alpha = rgba[s + 3] / 255;
          r += rgba[s] * alpha * weight;
          g += rgba[s + 1] * alpha * weight;
          b += rgba[s + 2] * alpha * weight;
          a += alpha * weight;
          w += weight;
        }
      }
      const d = (dy * dw + dx) * 4;
      if (a > 0) {
        out[d] = Math.round(r / a);
        out[d + 1] = Math.round(g / a);
        out[d + 2] = Math.round(b / a);
      }
      out[d + 3] = Math.round((a / w) * 255);
    }
  }
  return { width: dw, height: dh, rgba: out };
}

/** Opaque canvas of PAPER with `img` alpha-composited centered. */
function onPaper(canvasSize, img) {
  const out = Buffer.alloc(canvasSize * canvasSize * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = PAPER.r; out[i + 1] = PAPER.g; out[i + 2] = PAPER.b; out[i + 3] = 255;
  }
  const ox = Math.round((canvasSize - img.width) / 2);
  const oy = Math.round((canvasSize - img.height) / 2);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const s = (y * img.width + x) * 4;
      const a = img.rgba[s + 3] / 255;
      if (a === 0) continue;
      const d = ((oy + y) * canvasSize + (ox + x)) * 4;
      out[d] = Math.round(img.rgba[s] * a + out[d] * (1 - a));
      out[d + 1] = Math.round(img.rgba[s + 1] * a + out[d + 1] * (1 - a));
      out[d + 2] = Math.round(img.rgba[s + 2] * a + out[d + 2] * (1 - a));
    }
  }
  return { width: canvasSize, height: canvasSize, rgba: out };
}

// -------------------------------------------------------------------- build

mkdirSync(outDir, { recursive: true });

// 1) Honest copies: the source files are already PNG — just verify and rename.
for (const size of SIZES) {
  const src = readFileSync(path.join(srcDir, `icon-${size}.webp`));
  if (!src.subarray(0, 8).equals(PNG_MAGIC)) {
    throw new Error(`icons/icon-${size}.webp is not PNG data — regenerate this pipeline with an image library`);
  }
  writeFileSync(path.join(outDir, `icon-${size}.png`), src);
  console.log(`icon-${size}.png (copied, ${src.length}b)`);
}

// 2) Maskable variants: mascot at 66% on paper (safe zone = 80% circle).
const master = decodePng(readFileSync(path.join(srcDir, "icon-512.webp")), "icon-512");
for (const size of [192, 512]) {
  const inner = Math.round(size * 0.66);
  const img = onPaper(size, resize(master, inner, inner));
  const png = encodePng(img.width, img.height, img.rgba);
  writeFileSync(path.join(outDir, `icon-maskable-${size}.png`), png);
  console.log(`icon-maskable-${size}.png (${png.length}b)`);
}

// 3) apple-touch-icon: 180x180 opaque — iOS flattens transparency onto black.
const touch = onPaper(180, resize(master, 180, 180));
const touchPng = encodePng(touch.width, touch.height, touch.rgba);
writeFileSync(path.join(outDir, "apple-touch-icon.png"), touchPng);
console.log(`apple-touch-icon.png (${touchPng.length}b)`);

console.log("done →", path.relative(appDir, outDir));
