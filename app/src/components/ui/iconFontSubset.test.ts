/**
 * Icon-font robustness guards.
 *
 * The icon set is a ligature font: every failure to load it renders the
 * ligature name as English text ("home", "monitoring", "edit_note",
 * "expand_more") in the middle of the UI — including for a Hebrew-speaking
 * parent. It used to be loaded from fonts.googleapis.com with no font-display,
 * no fallback and no precache, so an offline-capable PWA had an uncacheable
 * blocking dependency on Google's CDN for its whole iconography.
 *
 * These tests lock in the fix:
 *   1. the font is self-hosted and shipped in public/fonts;
 *   2. index.html no longer reaches out to Google for it;
 *   3. the service worker precaches it, so it survives offline;
 *   4. glyphs are hidden until the face is confirmed loaded, so the failure
 *      mode is a blank slot rather than an English word;
 *   5. every icon name src/ can reference is actually IN the shipped subset —
 *      a name outside it renders as its own ligature text, i.e. defect 1 again.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// Same extraction the generator uses — importing it (rather than re-implementing)
// is what stops the shipped subset and the guard from drifting apart.
import { collectIconNames, sourceFiles, readVocabulary, FONT_FILE, NAMES_FILE } from "../../../scripts/build-icon-font.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(here, "..", "..", "..");
const fontDir = path.join(APP, "public", "fonts");
const indexHtml = readFileSync(path.join(APP, "index.html"), "utf8");
const sw = readFileSync(path.join(APP, "public", "sw.js"), "utf8");

describe("icon font is self-hosted", () => {
  it("ships the subsetted woff2 in public/fonts", () => {
    const f = path.join(fontDir, FONT_FILE);
    expect(existsSync(f), `${f} is missing — run: npm run build:icon-font`).toBe(true);
    expect(statSync(f).size).toBeGreaterThan(10_000);
  });

  it("ships the Apache-2.0 notice next to the font", () => {
    const license = path.join(fontDir, "LICENSE.txt");
    expect(existsSync(license)).toBe(true);
    expect(readFileSync(license, "utf8")).toContain("Apache License");
  });

  it("index.html declares a local @font-face for it and loads no icon CSS from Google", () => {
    expect(indexHtml).toContain("@font-face");
    expect(indexHtml).toContain(`/fonts/${FONT_FILE}`);
    // preconnect hints are fine (index.css still imports the TEXT webfonts);
    // an icon-font stylesheet request is not.
    expect(
      /fonts\.googleapis\.com\/css2[^"']*Material\+Symbols/.test(indexHtml),
      "index.html still requests Material Symbols from fonts.googleapis.com",
    ).toBe(false);
  });

  it("never lets a fallback face paint the ligature text", () => {
    // `swap` (and the default `auto`) paint the ligature name in a fallback
    // face while the icon font loads. `block` + the readiness gate do not.
    expect(indexHtml).toMatch(/font-display:\s*block/);
    expect(indexHtml).toMatch(/\.msr\s*\{[^}]*visibility:\s*hidden/s);
    expect(indexHtml).toMatch(/html\.msr-ready\s+\.msr\s*\{[^}]*visibility:\s*visible/s);
    expect(indexHtml).toContain("msr-ready");
    expect(indexHtml).toContain("document.fonts");
  });

  it("neutralizes inherited text styling on .msr (uppercase parents mangle ligatures into English)", () => {
    // An .msr inside uppercase/tracked chrome inherits text-transform +
    // letter-spacing, turning "child_care" into "CHILD_CARE" — which matches
    // NO ligature, so the English word paints even WITH the font loaded.
    expect(indexHtml).toMatch(/\.msr\s*\{[^}]*text-transform:\s*none/s);
    expect(indexHtml).toMatch(/\.msr\s*\{[^}]*letter-spacing:\s*normal/s);
    // An icon is never selectable text either.
    expect(indexHtml).toMatch(/\.msr\s*\{[^}]*user-select:\s*none/s);
  });

  it("the gate NEVER reveals glyph slots without the font (no-API and throw paths stay hidden)", () => {
    // Blank slots beat English words — the file's own doctrine. Revealing when
    // the Font Loading API is absent (or throws) shows unresolved ligature
    // text in whatever face the browser falls back to.
    expect(indexHtml).not.toMatch(/\{\s*reveal\(\);\s*return;?\s*\}/);
    expect(indexHtml).not.toMatch(/catch\s*\([^)]*\)\s*\{\s*reveal\(\)/);
  });
});

describe("icon font survives offline", () => {
  it("the service worker precaches it at install", () => {
    expect(sw).toContain(`/fonts/${FONT_FILE}`);
    expect(sw).toMatch(/PRECACHE\s*=\s*\[/);
    expect(sw).toMatch(/install[\s\S]{0,700}addAll\(PRECACHE\)/);
  });

  it("cache lookups ignore Vary, or the precached font is never found", () => {
    // Hosts answer with `Vary: Origin`; a font is always fetched in CORS mode
    // (crossorigin preload + @font-face) so it carries an Origin header the
    // install-time addAll() request did not. Honouring Vary = guaranteed miss.
    for (const m of sw.matchAll(/caches\.match\(([\s\S]{0,80}?)\)\s*[.;)]/g)) {
      expect(m[1], `caches.match(${m[1]}) must pass { ignoreVary: true }`).toContain("ignoreVary");
    }
    expect(sw.match(/ignoreVary/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

describe("the shipped subset covers every icon the app can ask for", () => {
  const manifestPath = path.join(fontDir, NAMES_FILE);

  it("ships the generated icon-name manifest", () => {
    expect(existsSync(manifestPath), `${manifestPath} is missing — run: npm run build:icon-font`).toBe(true);
  });

  it("contains every Material Symbols ligature referenced in src/", () => {
    const shipped = new Set(
      readFileSync(manifestPath, "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#")),
    );
    const used = collectIconNames(readVocabulary());
    const missing = used.filter((n) => !shipped.has(n));
    expect(
      missing,
      `these icon names are used in src/ but are NOT in the shipped font subset — they would render as English words. Run: npm run build:icon-font`,
    ).toEqual([]);
    expect(used.length).toBeGreaterThan(50); // the extraction still finds icons
  });
});

describe("icon extraction follows runtime source", () => {
  it("covers nested TS/JS consumers without treating test assertions as shipped icons", () => {
    const root = mkdtempSync(path.join(tmpdir(), "arbor-icon-source-"));
    try {
      const fixtures: Record<string, string> = {
        "components/Icon.tsx": '<Icon name="home" />',
        "navigation.ts": 'export const icon = "search";',
        "legacy.jsx": '<Icon name="edit_note" />',
        "icons.js": 'export const icon = "child_care";',
        "dimensions.test.ts": 'expect("height").toBe("height");',
        "view.spec.tsx": '<Fixture value="width" />',
        "legacy.test.js": 'expect("error").toBeDefined();',
        "legacy.spec.jsx": '<Fixture value="close" />',
        "types.d.ts": 'type Dimension = "height";',
        "__tests__/fixture.tsx": '<Fixture value="height" />',
        "__mocks__/fixture.ts": 'export const value = "width";',
      };
      for (const [relative, content] of Object.entries(fixtures)) {
        const file = path.join(root, relative);
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, content);
      }
      const files = sourceFiles(root);
      expect(files.map((file: string) => path.relative(root, file).split(path.sep).join("/")).sort())
        .toEqual(["components/Icon.tsx", "icons.js", "legacy.jsx", "navigation.ts"]);
      const vocabulary = new Set(["home", "search", "edit_note", "child_care", "height", "width", "error", "close"]);
      expect(collectIconNames(vocabulary, files)).toEqual(["child_care", "edit_note", "home", "search"]);
      // A new runtime icon must still reach the coverage gate, even when it is
      // absent from today's shipped manifest.
      writeFileSync(path.join(root, "navigation.ts"), 'export const icon = "height";');
      expect(collectIconNames(vocabulary, sourceFiles(root))).toContain("height");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
