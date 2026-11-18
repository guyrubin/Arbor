/**
 * B-KID-133 (the token audit, agent half) + B-GAME-25 (reduced motion plays
 * the full game, agent half): the child-scoped design contract, read off the
 * source so a rebuilt screen cannot drift away from it.
 *
 *  - Colour: every kid stylesheet's raw colour literals (hex, rgb, hsl) are a
 *    FROZEN per-file count that may only shrink (DESIGN.md: token names only,
 *    never new hex); a new kid stylesheet starts at zero.
 *  - Type: kid stylesheets name only the kid voices — the studio font, the
 *    toy voice (--font-sans, re-declared Nunito / Heebo inside .arbor-play)
 *    and the book voice (--font-display) — never a parent face by name; kid
 *    components use no parent type class.
 *  - Motion: every kid stylesheet that animates or transitions has its
 *    prefers-reduced-motion block, and no kid or library code waits on an
 *    animation or transition END to move a game, a book or a reward on (those
 *    events never fire when reduced motion turns the animation off).
 *
 * Phone and desktop renders, contrast and focus are the rendered half
 * (scripts/kids-acceptance-browser.mjs); a physical device is Guy's.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const KID_DIRS = ["components/kidmode", "components/library"];
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const rel = (f: string) => path.relative(SRC, f).split(path.sep).join("/");
const files = KID_DIRS.flatMap((d) => walk(path.join(SRC, d))).map(rel).sort();
const css = files.filter((f) => f.endsWith(".css"));
const code = files.filter((f) => /\.(tsx?|css)$/.test(f) && !/\.test\.tsx?$/.test(f));
const read = (f: string) => readFileSync(path.join(SRC, f), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");

const COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g;
/** FROZEN (28 Oct 2026; ratcheted 16 Nov 2026 by the v30 re-token): raw
 *  colour literals per kid stylesheet. May only shrink. The token file holds
 *  the register's ten source colours; the rest of the shell holds none. */
const COLOUR_LITERALS: Readonly<Record<string, number>> = {
  "components/kidmode/studioV2/games/adventures/adventures.css": 151,
  // The makers' material palette (16 Nov 2026): the one token file their scene art draws from.
  "components/kidmode/studioV2/games/makers/makerPalette.css": 64,
  // The makers' shared play kit (the Game Cut): one stage and one HUD for all twelve, on tokens only.
  "components/kidmode/studioV2/games/makers/play/makerPlay.css": 0,
  "components/kidmode/studioV2/games/studioGames.css": 0,
  "components/kidmode/studioV2/studioActivityArt.css": 0,
  "components/kidmode/studioV2/studioAdventureScene.css": 0,
  "components/kidmode/studioV2/studioBar.css": 0,
  "components/kidmode/studioV2/studioCreations.css": 0,
  "components/kidmode/studioV2/studioGame.css": 0,
  "components/kidmode/studioV2/studioKeepsakes.css": 0,
  "components/kidmode/studioV2/studioSky.css": 0,
  "components/kidmode/studioV2/studioTokens.css": 10,
  "components/kidmode/studioV2/studioV2.css": 0,
  "components/library/bookReader.css": 0,
};
const KID_FONTS = new Set(["var(--studio-font)", "var(--font-sans)", "var(--font-display)", "inherit", "nunito,heebo,sans-serif"]);
const PARENT_FACES = /instrument sans|ibm plex|\binter\b|fraunces|frank ruhl|georgia|times new roman/i;
const PARENT_TYPE_CLASS = /\barbor-(?:type|display)-[a-z]+|\barbor-parent\b/;

export function colourCount(source: string): number {
  return (strip(source).match(COLOUR) ?? []).length;
}
export function fontFamilies(source: string): string[] {
  return [...strip(source).matchAll(/font-family\s*:\s*([^;}]+)/g)].map((m) => m[1].replace(/!important/, "").trim().replace(/\s*,\s*/g, ",").toLowerCase());
}
export function animates(source: string): boolean {
  return /(?:^|[;{\s])(?:animation(?:-name)?|transition(?:-property)?)\s*:(?!\s*none\b)/m.test(strip(source));
}

describe("B-KID-133: kid colour stays on tokens (shrink-only)", () => {
  it("the audit reads every kid stylesheet", () => {
    expect(css).toContain("components/library/bookReader.css");
    expect(css).toContain("components/kidmode/studioV2/studioV2.css");
    expect(css.length).toBeGreaterThanOrEqual(11);
  });
  it.each(css)("%s: no more raw colour than frozen", (f) => {
    const n = colourCount(read(f));
    expect(n, `${f}: ${n} raw colour literals; use the kid tokens (a new stylesheet starts at 0)`).toBeLessThanOrEqual(COLOUR_LITERALS[f] ?? 0);
  });
  it("the frozen list names only stylesheets that exist (ratchet down when one goes)", () => {
    for (const f of Object.keys(COLOUR_LITERALS)) expect(css, f).toContain(f);
  });
});

/** v30 (the art kit's register v30, 15 Nov 2026; DESIGN.md §Kid register v30):
 *  pearl surfaces, graphite type, one teal. The pre-v30 gold action and the
 *  night-sky illustration classes must not come back into the Studio. */
const PRE_V30 = /--studio-(?:action-gold|action-fill|game-gold|gold)\b|\bstudio-sky__|\bstudio-v2__gold-button\b/;
export function undefinedStudioTokens(defined: string, used: string): string[] {
  const have = new Set([...strip(defined).matchAll(/(--studio-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  for (const m of defined.matchAll(/["'](--studio-[a-z0-9-]+)["']\s*:/g)) have.add(m[1]);
  return [...new Set([...strip(used).matchAll(/var\((--studio-[a-z0-9-]+)/g)].map((m) => m[1]))].filter((t) => !have.has(t));
}
describe("v30: the Studio wears one register", () => {
  const studio = code.filter((f) => f.startsWith("components/kidmode/studioV2/"));
  it("no pre-v30 gold token or night-sky class in the Studio", () => {
    expect(studio.filter((f) => PRE_V30.test(strip(read(f))))).toEqual([]);
  });
  it("every --studio-* token a kid stylesheet uses is defined (a removed token fails here, not as a blank colour)", () => {
    const defined = code.map(read).join("\n");
    expect(undefinedStudioTokens(defined, css.map(read).join("\n"))).toEqual([]);
  });
  it("negative controls: the v30 scans bite", () => {
    expect(PRE_V30.test(".a{background:var(--studio-action-gold)}")).toBe(true);
    expect(PRE_V30.test('<span className="studio-sky__aurora" />')).toBe(true);
    expect(PRE_V30.test(".a{background:var(--studio-action)}")).toBe(false);
    expect(undefinedStudioTokens(".x{--studio-teal:#000}", ".a{color:var(--studio-teal);background:var(--studio-gone)}")).toEqual(["--studio-gone"]);
  });
});

describe("B-KID-133: kid type is the kid voices only, never a parent face", () => {
  it.each(css)("%s: font families", (f) => {
    for (const ff of fontFamilies(read(f))) {
      expect(KID_FONTS.has(ff), `${f}: font-family ${ff}`).toBe(true);
      expect(PARENT_FACES.test(ff), `${f}: a parent face`).toBe(false);
    }
  });
  it("the toy voice is Nunito / Heebo inside .arbor-play (the --font-sans kid stylesheets use)", () => {
    const index = read("index.css");
    expect(index).toMatch(/\.arbor-play \{ --font-sans: 'Nunito', 'Heebo',/);
    expect(index).toMatch(/html\[lang="he"\] \.arbor-play \{ --font-sans: "Heebo",/);
    expect(read("components/kidmode/studioV2/studioTokens.css")).toMatch(/--studio-font: Nunito, Heebo, sans-serif;/);
  });
  it("round 2: kid components that name a font inline name a kid voice, and the hold-to-exit caption declares the toy voice", () => {
    const INLINE_KID = new Set(["var(--font-sans)", "var(--font-display)", "var(--studio-font)", "inherit"]);
    const bad = code.filter((f) => f.endsWith(".tsx")).flatMap((f) => [...read(f).matchAll(/fontFamily:\s*"([^"]+)"/g)].map((m) => [f, m[1]] as const)).filter(([, v]) => !INLINE_KID.has(v.trim()) || PARENT_FACES.test(v));
    expect(bad).toEqual([]);
    const exit = read("components/kidmode/HoldExitButton.tsx");
    expect(exit.slice(exit.indexOf("data-kid-exit-caption"), exit.indexOf("data-kid-exit-caption") + 400)).toMatch(/fontFamily: "var\(--font-sans\)"/);
  });
  it("no kid or library component uses a parent type class", () => {
    const leaks = code.filter((f) => f.endsWith(".tsx") && PARENT_TYPE_CLASS.test(read(f)));
    expect(leaks).toEqual([]);
  });
});

describe("B-GAME-25: reduced motion keeps every game and book playable", () => {
  // The Studio V2 tree shares one kill switch in studioV2.css (`.studio-v2 *`
  // loses every animation and transition); any other kid stylesheet carries its own.
  const STUDIO_KILL_SWITCH = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\.studio-v2 \*\{animation:none!important;transition:none!important/;
  it("the Studio V2 kill switch is in place", () => {
    expect(read("components/kidmode/studioV2/studioV2.css")).toMatch(STUDIO_KILL_SWITCH);
  });
  it.each(css.filter((f) => animates(read(f))))("%s animates, so reduced motion turns it off", (f) => {
    const own = /@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(read(f));
    expect(own || f.startsWith("components/kidmode/studioV2/"), `${f}: add a prefers-reduced-motion: reduce block`).toBe(true);
  });
  it("nothing waits on an animation or transition end to move play on (those never fire with motion off)", () => {
    const waits = code.filter((f) => /\.(tsx?)$/.test(f) && /onAnimationEnd|onTransitionEnd|["']animationend["']|["']transitionend["']/.test(read(f)));
    expect(waits).toEqual([]);
  });
  it("negative controls: the scans bite", () => {
    expect(colourCount(".a{color:#fff;background:rgba(0,0,0,.2)} /* #000 */")).toBe(2);
    expect(fontFamilies(".a{font-family: 'Instrument Sans', sans-serif !important}")).toEqual(["'instrument sans',sans-serif"]);
    expect(animates(".a{transition: opacity .2s}")).toBe(true);
    expect(animates(".a{animation: none}")).toBe(false);
    expect(PARENT_TYPE_CLASS.test('<h1 className="arbor-type-hero">')).toBe(true);
  });
});
