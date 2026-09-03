/**
 * Regenerate the self-hosted Material Symbols Rounded icon subset.
 *
 * WHY THIS EXISTS
 * ---------------
 * The app used to load the icon font from fonts.googleapis.com at runtime.
 * That made the ENTIRE iconography a hard third-party network dependency of a
 * PWA that otherwise works offline (Firestore offline persistence + an app
 * shell service worker) — and its failure mode was the worst possible one:
 * Material Symbols renders icons as *ligatures*, so a font that never arrives
 * leaves the literal ligature words ("home", "monitoring", "expand_more", …)
 * on screen. The unsubsetted Google request also ships the FULL variable font:
 * 5.3 MB.
 *
 * This script builds a subset containing only the ligatures the codebase can
 * actually ask for, writes it into public/fonts/ (precached by the service
 * worker, see public/sw.js) and records the exact icon-name list next to it so
 * a guard test can fail the build when code starts using a glyph the shipped
 * font does not contain (src/components/ui/iconFontSubset.test.ts).
 *
 * USAGE (needs network; NOT part of `npm run build`):
 *   npm run build:icon-font
 *
 * Run it whenever src/ starts using new icon names — the guard test tells you.
 *
 * HOW NAMES ARE COLLECTED
 * -----------------------
 * Icon names reach <Icon name=…> from many places: literals in JSX, `msIcon`
 * fields in nav/data tables, ternaries, Record<> lookup maps. Rather than try
 * to trace all of them, we take every snake_case string literal in runtime source under src/ and
 * intersect it with the official Material Symbols vocabulary snapshot
 * (scripts/material-symbols-icon-names.txt). That over-collects a little
 * (generic words such as "error" or "search" that happen to be icon names too)
 * — harmless, a handful of extra glyphs — and cannot under-collect, which is
 * the failure that would put English words back on the screen.
 *
 * The vocabulary snapshot is refreshed with `--refresh-vocabulary` from
 * https://fonts.google.com/metadata/icons.
 *
 * LICENSE: Material Symbols is Apache-2.0 (google/material-design-icons). The
 * license text ships alongside the font in public/fonts/LICENSE.txt.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(here, "..");
const SRC = path.join(APP, "src");
const FONT_DIR = path.join(APP, "public", "fonts");
const VOCAB = path.join(here, "material-symbols-icon-names.txt");

/** Variable axes requested from Google Fonts.
 *  opsz/wght/FILL are driven per-instance by src/components/ui/Icon.tsx.
 *  GRAD is pinned at 0 (the only value the codebase ever sets) — asking for the
 *  full -50..200 GRAD range nearly doubles the file for zero visual gain. */
export const AXES = "opsz,wght,FILL,GRAD@20..48,100..700,0..1,0";
export const FONT_FILE = "material-symbols-rounded-subset.woff2";
export const NAMES_FILE = "material-symbols-rounded-subset.icons.txt";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

/** Runtime source only: tests and declarations cannot request a shipped glyph. */
export function sourceFiles(dir = SRC, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry !== "__tests__" && entry !== "__mocks__") sourceFiles(p, out);
    } else if (/\.[jt]sx?$/.test(entry) && !/\.(?:test|spec)\.[jt]sx?$|\.d\.ts$/.test(entry)) {
      out.push(p);
    }
  }
  return out;
}

/** Read the vocabulary snapshot (one icon name per line, `#` comments). */
export function readVocabulary(file = VOCAB) {
  return new Set(
    readFileSync(file, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#")),
  );
}

/**
 * Icon names the codebase can ask for = snake_case string literals ∩ vocabulary.
 * Shared verbatim with the guard test so generation and enforcement cannot drift.
 */
export function collectIconNames(vocabulary, files = sourceFiles()) {
  const names = new Set();
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/["'`]([a-z][a-z0-9_]+)["'`]/g)) {
      if (vocabulary.has(m[1])) names.add(m[1]);
    }
  }
  return [...names].sort();
}

async function refreshVocabulary() {
  const res = await fetch("https://fonts.google.com/metadata/icons?incomplete=true&key=material_symbols", {
    headers: { "user-agent": UA },
  });
  if (!res.ok) throw new Error(`metadata fetch failed: ${res.status}`);
  const meta = JSON.parse((await res.text()).replace(/^\)\]\}'\n?/, ""));
  const names = [...new Set(meta.icons.map((i) => i.name))].sort();
  writeFileSync(
    VOCAB,
    `# Material Symbols icon-name vocabulary snapshot (google/material-design-icons, Apache-2.0).\n` +
      `# Source: https://fonts.google.com/metadata/icons — refresh with:\n` +
      `#   node scripts/build-icon-font.mjs --refresh-vocabulary\n` +
      `# Used to tell icon names apart from ordinary strings when subsetting the font.\n` +
      names.join("\n") +
      "\n",
  );
  console.log(`[icon-font] vocabulary refreshed: ${names.length} names`);
}

async function main() {
  if (process.argv.includes("--refresh-vocabulary")) await refreshVocabulary();

  const names = collectIconNames(readVocabulary());
  console.log(`[icon-font] ${names.length} icon names referenced by src/`);

  const cssUrl = new URL("https://fonts.googleapis.com/css2");
  cssUrl.searchParams.set("family", `Material Symbols Rounded:${AXES}`);
  cssUrl.searchParams.set("icon_names", names.join(","));
  const cssRes = await fetch(cssUrl, { headers: { "user-agent": UA } });
  if (!cssRes.ok) throw new Error(`css2 request failed: ${cssRes.status} ${await cssRes.text()}`);
  const css = await cssRes.text();
  const woff2Url = css.match(/url\(([^)]+)\)\s*format\('woff2'\)/)?.[1];
  if (!woff2Url) throw new Error("no woff2 url in the css2 response");

  const fontRes = await fetch(woff2Url, { headers: { "user-agent": UA } });
  if (!fontRes.ok) throw new Error(`font fetch failed: ${fontRes.status}`);
  const bytes = Buffer.from(await fontRes.arrayBuffer());

  mkdirSync(FONT_DIR, { recursive: true });
  writeFileSync(path.join(FONT_DIR, FONT_FILE), bytes);
  writeFileSync(
    path.join(FONT_DIR, NAMES_FILE),
    `# Ligatures contained in ${FONT_FILE} — generated by scripts/build-icon-font.mjs.\n` +
      `# Axes: ${AXES}\n` +
      `# Guarded by src/components/ui/iconFontSubset.test.ts: every icon name src/ can\n` +
      `# reference must appear here, or the font would render the ligature as English text.\n` +
      names.join("\n") +
      "\n",
  );

  const licensePath = path.join(FONT_DIR, "LICENSE.txt");
  if (!existsSync(licensePath)) console.warn(`[icon-font] WARNING: ${licensePath} is missing (Apache-2.0 notice required)`);

  console.log(`[icon-font] wrote public/fonts/${FONT_FILE} — ${(bytes.length / 1024).toFixed(1)} KB`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("build-icon-font.mjs")) {
  main().catch((err) => {
    console.error("[icon-font]", err);
    process.exit(1);
  });
}
