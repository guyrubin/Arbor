/**
 * B-SHELL-24 — the text faces are self-hosted: no load asks Google for a font.
 *
 * index.css:1 imported the seven token-named families from fonts.googleapis.com, so every
 * first paint waited on Google, every load sent the parent's IP there, and offline Hebrew fell
 * back to system fonts. Now src/textFonts.css (generated from that exact stylesheet) declares
 * every face from /fonts/text, the files are in public/fonts/text with their OFL notices, the
 * CSP allows no Google font origin and index.html preconnects to none.
 *
 * Retained from the 5 Oct partial: the families loaded are exactly the families the --font-*
 * tokens name (no silent system fallback, nothing nobody uses), with font-display: swap.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const app = path.resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(app, rel), "utf8");
const css = read("src/index.css");
const faces = read("src/textFonts.css");
const FONT_DIR = path.join(app, "public", "fonts", "text");

/** Every Google Fonts request a stylesheet or page can make: an @import, a <link>, a url(). */
export function googleFontRequests(source: string): string[] {
  return [...source.matchAll(/https?:\/\/fonts\.(?:googleapis|gstatic)\.com[^\s'")]*/g)].map((m) => m[0]);
}
/** Strip comments, so prose about the old import cannot satisfy or trip a check. */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "");

/** Families declared by @font-face blocks. */
function declaredFamilies(src: string): Set<string> {
  return new Set([...src.matchAll(/font-family:\s*'([^']+)'/g)].map((m) => m[1]));
}

/** Families named in any --font-* token (generic/system names excluded). */
function tokenFamilies(src: string): Set<string> {
  const out = new Set<string>();
  const GENERIC = /^(serif|sans-serif|system-ui|-apple-system|BlinkMacSystemFont|Georgia|Times New Roman|Assistant)$/;
  for (const m of src.matchAll(/--font-[a-z]+:\s*([^;]+);/g)) {
    for (const raw of m[1].split(",")) {
      const fam = raw.trim().replace(/^['"]|['"]$/g, "");
      if (fam && !GENERIC.test(fam)) out.add(fam);
    }
  }
  return out;
}

describe("B-SHELL-24 · no request to fonts.googleapis.com or gstatic on load", () => {
  it("index.css imports the self-hosted faces and no Google stylesheet", () => {
    expect(googleFontRequests(code(css))).toEqual([]);
    expect(css).toMatch(/^(?:\/\*[^\n]*\*\/\n)?@import "\.\/textFonts\.css";/);
    expect(googleFontRequests(code(faces))).toEqual([]);
  });

  it("NEGATIVE CONTROL: the 28 Oct import, put back into the real index.css, is caught", () => {
    const shipped = `@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500&display=swap');\n${css}`;
    expect(googleFontRequests(code(shipped))).toHaveLength(1);
    expect(googleFontRequests(code(read("index.html").replace("</head>", '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /></head>')))).toHaveLength(1);
  });

  it("index.html preconnects to no Google font origin, and the CSP allows none", () => {
    expect(googleFontRequests(code(read("index.html")))).toEqual([]);
    const csp = read("src/server/createApp.ts");
    const directives = csp.slice(csp.indexOf("const cspDirectives"), csp.indexOf("connectSrc"));
    expect(directives).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com/);
    expect(directives).toContain(`fontSrc: ["'self'", "data:"]`);
  });

  it("every face loads from /fonts/text, and every file it names is a real woff2 on disk", () => {
    const urls = [...faces.matchAll(/src:\s*url\(([^)]+)\)\s*format\('woff2'\)/g)].map((m) => m[1]);
    expect(urls.length).toBe((faces.match(/@font-face/g) ?? []).length);
    for (const url of urls) {
      expect(url).toMatch(/^\/fonts\/text\/[a-z0-9-]+\.woff2$/);
      const file = path.join(FONT_DIR, path.basename(url));
      expect(existsSync(file), url).toBe(true);
      expect(readFileSync(file).subarray(0, 4).toString(), url).toBe("wOF2");
    }
    // nothing unreferenced ships
    const shipped = readdirSync(FONT_DIR).filter((f) => f.endsWith(".woff2"));
    expect(shipped.sort()).toEqual([...new Set(urls.map((u) => path.basename(u)))].sort());
    expect(readFileSync(path.join(FONT_DIR, "LICENSE.txt"), "utf8")).toContain("SIL Open Font License");
  });

  it("Heebo and Frank Ruhl Libre carry their Hebrew faces offline", () => {
    for (const family of ["Heebo", "Frank Ruhl Libre", "IBM Plex Sans Hebrew"]) {
      const hebrew = [...faces.matchAll(/\/\* hebrew \*\/\n@font-face \{([^}]*)\}/g)].map((m) => m[1]).filter((b) => b.includes(`'${family}'`));
      expect(hebrew.length, family).toBeGreaterThan(0);
      for (const block of hebrew) expect(block).toContain("U+0590-05FF");
    }
  });

  it("every face keeps font-display: swap", () => {
    const blocks = faces.match(/@font-face \{[^}]*\}/g) ?? [];
    expect(blocks.length).toBeGreaterThan(40);
    for (const block of blocks) expect(block).toContain("font-display: swap;");
  });
});

describe("B-SHELL-24 · the faces are exactly the token-named families", () => {
  const declared = declaredFamilies(faces);
  const named = tokenFamilies(css);

  it("every declared family is named by a --font-* token", () => {
    expect([...declared].filter((f) => !named.has(f))).toEqual([]);
  });

  it("every web family a token names is declared (no silent system fallback)", () => {
    expect([...named].filter((f) => !declared.has(f))).toEqual([]);
  });

  it("NEGATIVE CONTROL: a face for a family no token names is caught", () => {
    const extra = declaredFamilies(`${faces}\n@font-face { font-family: 'Baloo 2'; src: url(/fonts/text/x.woff2) format('woff2'); }`);
    expect([...extra].filter((f) => !named.has(f))).toEqual(["Baloo 2"]);
  });
});
