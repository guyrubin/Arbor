/**
 * Regenerate the self-hosted TEXT webfonts (MOB-18 / CR-10).
 *
 * WHY THIS EXISTS
 * ---------------
 * src/index.css used to start with a render-blocking `@import` of seven
 * Google-Fonts families (~25 weights) from fonts.googleapis.com. On the native
 * shells that made the app's own typography a hard network dependency of every
 * cold start (a bundled app painting in Georgia / system-ui until the network
 * answers), and on the web it cost two third-party round-trips before the
 * Fraunces h1 — the LCP element on Today — could paint, then shifted layout
 * when the font swapped in. The icon font was already self-hosted for exactly
 * this reason (scripts/build-icon-font.mjs); this script does the same for the
 * four DESIGN-law text families:
 *
 *   Fraunces (display, Latin) · Nunito (body, Latin)
 *   Frank Ruhl Libre (display, Hebrew) · Heebo (body, Hebrew)
 *
 * Plus Jakarta Sans, Baloo 2 and Instrument Serif are NOT built: the first two
 * had zero font-family references, Instrument Serif's --font-editorial token
 * falls back to Georgia (CR-10).
 *
 * WHAT IT PRODUCES (public/fonts/)
 *   text-<family>-<style>-<subset>.woff2   variable-font subsets (latin / hebrew)
 *   text-fonts.manifest.json               every face + the fallback metrics
 *   TEXT-FONTS-LICENSE.txt                 the SIL OFL notices (required)
 *
 * and prints the `@font-face` block that src/index.css carries by hand. The
 * guard test src/lib/fontsManifest.test.ts keeps index.css, this manifest,
 * the files on disk and public/sw.js PRECACHE in lock-step.
 *
 * Fallback metrics: for each family the script reads head/hhea/OS/2 out of the
 * downloaded woff2 (the metric tables are stored untransformed, so a brotli
 * decompress + table walk is enough — no font library needed) and computes
 * `size-adjust` / `ascent-override` / `descent-override` / `line-gap-override`
 * against a hand-entered system fallback (Georgia / Arial / Times New Roman
 * OS/2 values), the fontaine/capsize formula. Those metric-matched fallback
 * faces are declared as "<Family> Fallback" and belong right after the family
 * in every --font-* stack.
 *
 * USAGE (needs network; NOT part of `npm run build`):
 *   node scripts/build-text-fonts.mjs
 *
 * LICENSE: all four families are SIL Open Font License 1.1 (google/fonts).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brotliDecompressSync } from "node:zlib";

const here = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(here, "..");
const FONT_DIR = path.join(APP, "public", "fonts");
export const MANIFEST_FILE = "text-fonts.manifest.json";
export const LICENSE_FILE = "TEXT-FONTS-LICENSE.txt";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

/** The four DESIGN-law families, the axes the app actually uses, and the
 *  script subsets each must carry (Hebrew UI still renders Latin digits/names). */
export const FAMILIES = [
  { family: "Fraunces", oflDir: "fraunces", axes: "opsz,wght@9..144,400..700", subsets: ["latin"], fallback: "Georgia" },
  { family: "Nunito", oflDir: "nunito", axes: "ital,wght@0,400..800;1,400", subsets: ["latin"], fallback: "Arial" },
  { family: "Heebo", oflDir: "heebo", axes: "wght@400..800", subsets: ["hebrew", "latin"], fallback: "Arial" },
  { family: "Frank Ruhl Libre", oflDir: "frankruhllibre", axes: "wght@500..700", subsets: ["hebrew", "latin"], fallback: "Times New Roman" },
];

/** OS/2 + hhea metrics of the system fallbacks (unitsPerEm 2048), the values
 *  the capsize metrics set carries for these faces. Hand-entered — they are
 *  only used to shape the "<Family> Fallback" faces. */
export const SYSTEM_FALLBACKS = {
  Georgia: { unitsPerEm: 2048, ascent: 1878, descent: 449, lineGap: 0, xAvgCharWidth: 910 },
  Arial: { unitsPerEm: 2048, ascent: 1854, descent: 434, lineGap: 67, xAvgCharWidth: 904 },
  "Times New Roman": { unitsPerEm: 2048, ascent: 1825, descent: 443, lineGap: 87, xAvgCharWidth: 821 },
};

export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/* ── woff2 metric reader ─────────────────────────────────────────────────── */
const KNOWN_TAGS = ("cmap head hhea hmtx maxp name OS/2 post cvt  fpgm glyf loca prep CFF  VORG EBDT EBLC gasp hdmx " +
  "kern LTSH PCLT VDMX vhea vmtx BASE GDEF GPOS GSUB EBSC JSTF MATH CBDT CBLC COLR CPAL SVG  sbix acnt avar bdat " +
  "bloc bsln cvar fdsc feat fmtx fvar gvar hsty just lcar mort morx opbd prop trak Zapf Silf Glat Gloc Feat Sill")
  .match(/.{4}\s?/g).map((t) => t.trimEnd().padEnd(4));

function readBase128(buf, pos) {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const b = buf[pos++];
    value = (value * 128) + (b & 0x7f);
    if ((b & 0x80) === 0) return [value, pos];
  }
  throw new Error("bad UIntBase128");
}

/** Metrics (unitsPerEm, ascent, descent, lineGap, xAvgCharWidth) from a woff2 buffer. */
export function readWoff2Metrics(buf) {
  if (buf.toString("latin1", 0, 4) !== "wOF2") throw new Error("not a woff2 file");
  const numTables = buf.readUInt16BE(12);
  const totalCompressedSize = buf.readUInt32BE(20);
  let pos = 48;
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[pos++];
    let tag;
    if ((flags & 0x3f) === 0x3f) { tag = buf.toString("latin1", pos, pos + 4); pos += 4; }
    else tag = KNOWN_TAGS[flags & 0x3f];
    const version = (flags >> 6) & 3;
    let origLength, transformLength;
    [origLength, pos] = readBase128(buf, pos);
    const isGlyfLoca = tag === "glyf" || tag === "loca";
    const transformed = isGlyfLoca ? version === 0 : version !== 0;
    if (transformed) [transformLength, pos] = readBase128(buf, pos);
    tables.push({ tag: tag.trim(), length: transformed ? transformLength : origLength, transformed });
  }
  const data = brotliDecompressSync(buf.subarray(pos, pos + totalCompressedSize));
  let offset = 0;
  const at = {};
  for (const t of tables) { at[t.tag] = data.subarray(offset, offset + t.length); offset += t.length; }
  const head = at.head, hhea = at.hhea, os2 = at["OS/2"];
  if (!head || !hhea || !os2) throw new Error("missing head/hhea/OS/2");
  const useTypo = (os2.readUInt16BE(62) & (1 << 7)) !== 0 && os2.length >= 74;
  const hmtxTransformed = tables.find((t) => t.tag === "hmtx")?.transformed === true;
  return {
    unitsPerEm: head.readUInt16BE(18),
    ascent: useTypo ? os2.readInt16BE(68) : hhea.readInt16BE(4),
    descent: Math.abs(useTypo ? os2.readInt16BE(70) : hhea.readInt16BE(6)),
    lineGap: useTypo ? os2.readInt16BE(72) : hhea.readInt16BE(8),
    // Same basis as the capsize xWidthAvg the SYSTEM_FALLBACKS carry: the
    // English-letter-frequency-weighted advance width, NOT OS/2 xAvgCharWidth
    // (which averages EVERY glyph and over-states a Latin subset by ~30%).
    xAvgCharWidth: weightedAdvance(at.cmap, at.hmtx, hhea.readUInt16BE(34), hmtxTransformed) ?? os2.readInt16BE(2),
  };
}

/** English letter frequencies (Lewand) + a 17.5% space share — the sample the
 *  fallback metrics are matched on. */
const LETTER_WEIGHTS = {
  a: 8.167, b: 1.492, c: 2.782, d: 4.253, e: 12.702, f: 2.228, g: 2.015, h: 6.094, i: 6.966, j: 0.153,
  k: 0.772, l: 4.025, m: 2.406, n: 6.749, o: 7.507, p: 1.929, q: 0.095, r: 5.987, s: 6.327, t: 9.056,
  u: 2.758, v: 0.978, w: 2.36, x: 0.15, y: 1.974, z: 0.074, " ": 17.5,
};

/** cmap (format 4 or 12) → char code → glyph id. */
function cmapLookup(cmap) {
  if (!cmap) return null;
  const n = cmap.readUInt16BE(2);
  let best = null;
  for (let i = 0; i < n; i++) {
    const pid = cmap.readUInt16BE(4 + i * 8), eid = cmap.readUInt16BE(6 + i * 8), off = cmap.readUInt32BE(8 + i * 8);
    const format = cmap.readUInt16BE(off);
    if ((pid === 3 && (eid === 1 || eid === 10)) || pid === 0) {
      if (format === 12 || (format === 4 && !best)) best = { off, format };
    }
  }
  if (!best) return null;
  const { off, format } = best;
  if (format === 12) {
    const groups = cmap.readUInt32BE(off + 12);
    return (c) => {
      for (let g = 0; g < groups; g++) {
        const p = off + 16 + g * 12;
        const s = cmap.readUInt32BE(p), e = cmap.readUInt32BE(p + 4);
        if (c >= s && c <= e) return cmap.readUInt32BE(p + 8) + (c - s);
      }
      return 0;
    };
  }
  const segCount = cmap.readUInt16BE(off + 6) / 2;
  const endAt = off + 14, startAt = endAt + segCount * 2 + 2, deltaAt = startAt + segCount * 2, rangeAt = deltaAt + segCount * 2;
  return (c) => {
    for (let i = 0; i < segCount; i++) {
      const end = cmap.readUInt16BE(endAt + i * 2);
      if (c > end) continue;
      const start = cmap.readUInt16BE(startAt + i * 2);
      if (c < start) return 0;
      const delta = cmap.readInt16BE(deltaAt + i * 2), ro = cmap.readUInt16BE(rangeAt + i * 2);
      if (ro === 0) return (c + delta) & 0xffff;
      const gidAt = rangeAt + i * 2 + ro + (c - start) * 2;
      const gid = cmap.readUInt16BE(gidAt);
      return gid === 0 ? 0 : (gid + delta) & 0xffff;
    }
    return 0;
  };
}

/** Frequency-weighted advance width over LETTER_WEIGHTS (font units). */
function weightedAdvance(cmap, hmtx, numHMetrics, transformed) {
  const lookup = cmapLookup(cmap);
  if (!lookup || !hmtx) return null;
  const adv = (gid) => {
    const i = Math.min(gid, numHMetrics - 1);
    return transformed ? hmtx.readUInt16BE(1 + i * 2) : hmtx.readUInt16BE(i * 4);
  };
  let sum = 0, wsum = 0;
  for (const [ch, w] of Object.entries(LETTER_WEIGHTS)) {
    const gid = lookup(ch.charCodeAt(0));
    if (!gid) continue;
    sum += adv(gid) * w;
    wsum += w;
  }
  return wsum ? Math.round(sum / wsum) : null;
}

/** fontaine/capsize: size-adjust + overrides so the fallback occupies the same box. */
export function fallbackOverrides(main, fb) {
  const sizeAdjust = (main.xAvgCharWidth / main.unitsPerEm) / (fb.xAvgCharWidth / fb.unitsPerEm);
  const pct = (v) => `${(v * 100).toFixed(2)}%`;
  return {
    sizeAdjust: pct(sizeAdjust),
    ascentOverride: pct(main.ascent / main.unitsPerEm / sizeAdjust),
    descentOverride: pct(main.descent / main.unitsPerEm / sizeAdjust),
    lineGapOverride: pct(main.lineGap / main.unitsPerEm / sizeAdjust),
  };
}

/* ── Google css2 → faces ─────────────────────────────────────────────────── */
export function parseCss2(css) {
  const faces = [];
  const re = /\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
  for (const m of css.matchAll(re)) {
    const body = m[2];
    const prop = (name) => body.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
    faces.push({
      subset: m[1],
      family: prop("font-family")?.replace(/^['"]|['"]$/g, ""),
      style: prop("font-style"),
      weight: prop("font-weight"),
      url: body.match(/url\(([^)]+)\)\s*format\(['"]woff2['"]\)/)?.[1],
      unicodeRange: prop("unicode-range"),
    });
  }
  return faces;
}

export function faceFileName(family, style, subset) {
  return `text-${slug(family)}-${style}-${subset}.woff2`;
}

/** The @font-face block src/index.css carries (printed for hand-paste). */
export function renderFontFaceCss(manifest) {
  const out = [];
  for (const fam of manifest.families) {
    for (const face of fam.faces) {
      out.push(`@font-face {
  font-family: '${fam.family}';
  font-style: ${face.style};
  font-weight: ${face.weight};
  font-display: swap;
  src: url('/fonts/${face.file}') format('woff2');
  unicode-range: ${face.unicodeRange};
}`);
    }
    const o = fam.fallbackOverrides;
    out.push(`@font-face {
  font-family: '${fam.family} Fallback';
  src: local('${fam.fallback}');
  size-adjust: ${o.sizeAdjust};
  ascent-override: ${o.ascentOverride};
  descent-override: ${o.descentOverride};
  line-gap-override: ${o.lineGapOverride};
}`);
  }
  return out.join("\n");
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

async function main() {
  mkdirSync(FONT_DIR, { recursive: true });
  const manifest = { generatedBy: "scripts/build-text-fonts.mjs", generatedAt: new Date().toISOString(), families: [] };
  const license = [];

  for (const spec of FAMILIES) {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(spec.family).replace(/%20/g, "+")}:${spec.axes}&display=swap`;
    const faces = parseCss2(await fetchText(cssUrl)).filter((f) => spec.subsets.includes(f.subset));
    if (faces.length === 0) throw new Error(`${spec.family}: no faces for subsets ${spec.subsets.join(",")}`);
    const entry = { family: spec.family, fallback: spec.fallback, faces: [] };
    let metrics = null;
    for (const face of faces) {
      const res = await fetch(face.url, { headers: { "user-agent": UA } });
      if (!res.ok) throw new Error(`${face.url} → ${res.status}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      const file = faceFileName(spec.family, face.style, face.subset);
      writeFileSync(path.join(FONT_DIR, file), bytes);
      // Metrics come from the LATIN upright face: the width sample is Latin
      // letters, so a Hebrew subset (no Latin glyphs) would measure nothing.
      if (!metrics && face.style === "normal" && face.subset === "latin") metrics = readWoff2Metrics(bytes);
      entry.faces.push({ file, subset: face.subset, style: face.style, weight: face.weight, unicodeRange: face.unicodeRange, bytes: bytes.length });
      console.log(`[text-fonts] ${file} — ${(bytes.length / 1024).toFixed(1)} KB`);
    }
    entry.metrics = metrics;
    entry.fallbackOverrides = fallbackOverrides(metrics, SYSTEM_FALLBACKS[spec.fallback]);
    manifest.families.push(entry);

    const ofl = await fetchText(`https://raw.githubusercontent.com/google/fonts/main/ofl/${spec.oflDir}/OFL.txt`);
    license.push(`════════ ${spec.family} ════════\n${ofl.trim()}\n`);
  }

  writeFileSync(path.join(FONT_DIR, MANIFEST_FILE), JSON.stringify(manifest, null, 2) + "\n");
  writeFileSync(
    path.join(FONT_DIR, LICENSE_FILE),
    `Self-hosted text webfonts — SIL Open Font License 1.1 notices.\nBuilt by scripts/build-text-fonts.mjs from google/fonts.\n\n${license.join("\n")}`,
  );
  console.log("\n/* ── paste into src/index.css (replaces the Google @import) ── */\n" + renderFontFaceCss(manifest));
}

if (process.argv[1]?.endsWith("build-text-fonts.mjs")) {
  main().catch((err) => {
    console.error("[text-fonts]", err);
    process.exit(1);
  });
}
