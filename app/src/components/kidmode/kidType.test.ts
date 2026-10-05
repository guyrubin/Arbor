/**
 * B-KID-133 (D-03) — kid type (KID-DESIGN-DIRECTION §2.2). Two voices, both
 * loaded: the toy voice (Nunito / Heebo, 800) for every UI word, the book
 * voice (Fraunces / Frank Ruhl Libre, 600-700) for story words and book
 * titles. Nothing asks for weight 900 (not loaded: a faux bold). Floor 15 px.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(path.join(__dirname, ...p), "utf8");
const css = read("..", "..", "index.css");

/** Resolve clamp(min, a px + b vw, max) at one viewport width. */
function clampAt(value: string, vw: number): number {
  const m = /clamp\(([\d.]+)px, ([\d.]+)px \+ ([\d.]+)vw, ([\d.]+)px\)/.exec(value)!;
  const [min, base, slope, max] = [m[1], m[2], m[3], m[4]].map(Number);
  return Math.min(max, Math.max(min, base + (slope / 100) * vw));
}
const token = (name: string) => new RegExp(`${name}: (clamp\\([^;]+\\));`).exec(css)![1];

describe("kid type tokens", () => {
  it("give the 375 value on a phone and the >= 1280 value on a desktop (§2.2 table)", () => {
    const table: [string, number, number][] = [
      ["--kid-t-hero", 34, 52], ["--kid-t-title", 24, 32], ["--kid-t-say", 20, 24],
      ["--kid-t-book", 20, 26], ["--kid-t-label", 17, 20], ["--kid-t-tag", 15, 16],
    ];
    for (const [name, phone, wide] of table) {
      expect(Math.round(clampAt(token(name), 375)), `${name} @375`).toBe(phone);
      expect(Math.round(clampAt(token(name), 1280)), `${name} @1280`).toBe(wide);
      expect(clampAt(token(name), 320), `${name} floor`).toBeGreaterThanOrEqual(15);
    }
  });
  it("the loaded weights: Nunito/Heebo <= 800, Fraunces/Frank Ruhl <= 700 — the kid classes never ask for more", () => {
    expect(css.slice(0, 400)).toMatch(/Nunito:ital,wght@0,400;0,500;0,600;0,700;0,800/);
    const kidType = css.slice(css.indexOf("── D-03 · Kid type"), css.indexOf("── D-02 · The toy"));
    expect(kidType).not.toMatch(/font-weight:\s*900|font:\s*900/);
    expect(kidType).toContain(".arbor-play .kid-type-book  { font: 600 var(--kid-t-book)/var(--kid-book-lh) var(--font-display); }");
    expect(kidType).toMatch(/html\[lang="he"\] \.arbor-play,\s*\[dir="rtl"\] \.arbor-play \{ --kid-book-lh: 1\.6; \}/);
  });
});

describe("kid files ask for no faux bold and no parent-scale type", () => {
  const files: [string, string][] = [
    ["KidModeOverlay.tsx", read("KidModeOverlay.tsx")],
    ["game/GameShell.tsx", read("game", "GameShell.tsx")],
    ["KidBookCover.tsx", read("KidBookCover.tsx")],
    ["KidLibrary.tsx", read("KidLibrary.tsx")],
    ["KidComicsShelf.tsx", read("KidComicsShelf.tsx")],
    ["KidErrorBoundary.tsx", read("KidErrorBoundary.tsx")],
    ["rewards/KidSouvenir.tsx", read("rewards", "KidSouvenir.tsx")],
  ];
  it.each(files)("%s: no weight 900, no font-black, no 10-14 px or --t-sm/--t-xs text", (_name, src) => {
    expect(src).not.toMatch(/fontWeight: 900|font-black/);
    expect(src).not.toMatch(/fontSize: 1[0-4]\b|text-\[1[0-4]px\]|"var\(--t-(sm|xs)\)"|\btext-(sm|xs)\b/);
  });
  it("story words are the book voice at --kid-t-book (>= 20 px), line height from --kid-book-lh", () => {
    const player = read("..", "stories", "HeroScenePlayer.tsx");
    expect(player).toContain("fontSize: `max(${KID_BOOK_TEXT_PX}px, var(--kid-t-book))`, fontWeight: 600, lineHeight: \"var(--kid-book-lh)\"");
  });
  it("the bar names the place in the toy voice", () => {
    const overlay = read("KidModeOverlay.tsx");
    const node = overlay.slice(overlay.indexOf("data-kid-bar-title"), overlay.indexOf("{barTitle}"));
    expect(node).toContain('fontFamily: "var(--font-sans)"');
    expect(node).toContain("fontWeight: 800");
  });
});
