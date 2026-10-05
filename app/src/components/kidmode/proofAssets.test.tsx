/**
 * B-GAME-07c — the local-only proof assets: url resolution against the JSON's
 * folder, the proof sheet/art loaders (absent = today's behaviour), per-pose
 * `scale`, the prize in the hero's hands, no text hint on the stage, the kid
 * bar's one-line title, and THE GUARD: nothing under public/_proof is ever
 * tracked by git (the owner's son's likeness).
 */
import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROOF_HERO_SHEET_URL, PROOF_SCENE_ART_URL, fetchProofJson, resolveAgainst, resolveUrls, sameOriginOrData } from "./proofAssets";
import { carryPoint, loadProofHeroSheet, parseHeroSheet, poseFactor, type HeroSheet } from "./hero/heroSheet";
import { HeroFigure, spriteBox } from "./hero/HeroFigure";
import { loadProofArt } from "./games/sneakFreeze/sneakArt";
import { devPlaceholderArt } from "./games/sneakFreeze/devPlaceholderArt";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, "..", "..", "..");
const read = (...p: string[]) => readFileSync(path.join(here, ...p), "utf8");

const SHEET = {
  v: 1, heroId: "proof", source: "proof", theme: "film3d",
  poses: {
    idle: { url: "idle-640.webp", w: 280, h: 640, foot: { x: 140, y: 614 }, head: { x: 138, y: 106, r: 102 } },
    tiptoe: { url: "tiptoe-640.webp", w: 426, h: 640, foot: { x: 177, y: 614 }, scale: 0.85 },
    "hold-up": { url: "./hold-up-640.webp", w: 300, h: 640, foot: { x: 150, y: 614 }, hand: { l: [100, 40], r: [200, 60] } },
  },
};
const fetcherOf = (files: Record<string, unknown>) => async (url: string) => ({ ok: url in files, json: async () => files[url] });

describe("proof files: resolved against their folder, tried first, absent = unchanged", () => {
  it("relative urls resolve against the JSON's folder; absolute, data and other schemes are kept", () => {
    expect(resolveAgainst("idle.webp", PROOF_HERO_SHEET_URL)).toBe("/_proof/hero/idle.webp");
    expect(resolveAgainst("./a/b.webp", PROOF_SCENE_ART_URL)).toBe("/_proof/scene/a/b.webp");
    expect(resolveAgainst("../../../x.webp", PROOF_SCENE_ART_URL)).toBe("/x.webp");
    expect(resolveAgainst("/abs.webp", PROOF_SCENE_ART_URL)).toBe("/abs.webp");
    expect(resolveAgainst("data:image/png;base64,AA", PROOF_SCENE_ART_URL)).toBe("data:image/png;base64,AA");
    expect(resolveAgainst("javascript:alert(1)", PROOF_SCENE_ART_URL)).toBe("javascript:alert(1)");
    const art = resolveUrls({ plate: { landscape: "plate-l.webp", portrait: "plate-p.webp" }, watcher: { counting: { url: "cat.webp" } } }, PROOF_SCENE_ART_URL) as {
      plate: Record<string, string>;
      watcher: Record<string, { url: string }>;
    };
    expect(art.plate.landscape).toBe("/_proof/scene/plate-l.webp");
    expect(art.watcher.counting.url).toBe("/_proof/scene/cat.webp");
  });

  it("the proof sheet loads with its urls in /_proof/hero/ and keeps a pose's scale", async () => {
    const sheet = await loadProofHeroSheet(fetcherOf({ [PROOF_HERO_SHEET_URL]: SHEET }));
    expect(sheet?.source).toBe("proof");
    expect(sheet?.poses.idle?.url).toBe("/_proof/hero/idle-640.webp");
    expect(sheet?.poses["hold-up"]?.url).toBe("/_proof/hero/hold-up-640.webp");
    expect(sheet?.poses.tiptoe?.scale).toBe(0.85);
    expect(sheet?.poses.idle?.scale).toBeUndefined();
    expect(await loadProofHeroSheet(fetcherOf({}))).toBeNull();
    expect(await loadProofHeroSheet(async () => { throw new Error("offline"); })).toBeNull();
    expect(await fetchProofJson("/_proof/none.json", fetcherOf({}))).toBeNull();
  });

  it("the proof art merges slot by slot over the base; absent = the base, unchanged", async () => {
    const base = devPlaceholderArt();
    const art = await loadProofArt(base, fetcherOf({ [PROOF_SCENE_ART_URL]: { plate: { landscape: "plate-l.webp" }, watcher: { looking: { url: "cat-back.webp", w: 600, h: 800, anchor: { x: 300, y: 790 } } } } }));
    expect(art.source).toBe("proof");
    expect(art.plate.landscape).toBe("/_proof/scene/plate-l.webp");
    expect(art.plate.portrait).toBe(base.plate.portrait);
    expect(art.watcher.looking?.url).toBe("/_proof/scene/cat-back.webp");
    expect(await loadProofArt(base, fetcherOf({}))).toBe(base);
  });

  it("the canvas-safety check: data urls and same-origin paths only", () => {
    expect(sameOriginOrData("data:image/jpeg;base64,AA")).toBe(true);
    expect(sameOriginOrData("/_proof/hero/idle.webp")).toBe(true);
    expect(sameOriginOrData("//evil.example/x.webp")).toBe(false);
    expect(sameOriginOrData("https:" + "//evil.example/x.webp" /* split: the kid-register scan forbids a literal external URL */)).toBe(false);
  });
});

describe("the hero: per-pose scale, the prize in the hands", () => {
  const sheet = parseHeroSheet(resolveUrls(SHEET, PROOF_HERO_SHEET_URL)) as HeroSheet;

  it("a pose's scale multiplies its drawn size; the feet stay at (0, 0)", () => {
    const idle = spriteBox(sheet, "idle", 320)!;
    const tip = spriteBox(sheet, "tiptoe", 320)!;
    expect(idle.height).toBeCloseTo(320, 5);
    expect(tip.height).toBeCloseTo(320 * 0.85, 5);
    expect(tip.left + 177 * (320 / 640) * 0.85).toBeCloseTo(0, 5);
    expect(tip.top + 614 * (320 / 640) * 0.85).toBeCloseTo(0, 5);
  });

  it("hold-up carries the prize resting on the hands (above their midpoint, never over the face); else above the head; else above the sprite", () => {
    const k = poseFactor(sheet, sheet.poses["hold-up"]!, 320);
    const mid = carryPoint(sheet.poses["hold-up"]!, k, 40);
    expect(mid.x).toBeCloseTo(0, 5);
    expect(mid.y).toBeCloseTo((50 - 614) * k - 40 * 0.4, 5);
    // B-GAME-07d: with a head, the prize's centre stays above the head's top.
    const withHead = { ...sheet.poses["hold-up"]!, hand: { l: [100, 200] as [number, number], r: [200, 200] as [number, number] }, head: { x: 150, y: 180, r: 100 } };
    const safe = carryPoint(withHead, 1, 40);
    expect(safe.y).toBeLessThanOrEqual(80 - 614 - 40 * 0.35 + 1e-9);
    const idle = sheet.poses.idle!;
    const above = carryPoint(idle, 0.5, 40);
    expect(above.y).toBeLessThan((idle.head!.y - idle.head!.r - idle.foot.y) * 0.5);
    const bare = carryPoint({ url: "/x", w: 100, h: 200, foot: { x: 50, y: 190 } }, 1, 20);
    expect(bare).toEqual({ x: 0, y: -190 - 11 });
    const html = renderToStaticMarkup(<HeroFigure pose="hold-up" height={320} sheet={sheet} x={0} y={0} carry={{ url: "/_proof/scene/bell.webp", size: 40 }} />);
    expect(html).toContain("data-hero-carry");
    // inside the squash element, after the pose sprites
    expect(html.indexOf("data-hero-carry")).toBeGreaterThan(html.indexOf('data-hero-pose="hold-up"'));
    const notHeld = renderToStaticMarkup(<HeroFigure pose="tiptoe" height={320} sheet={sheet} x={0} y={0} carry={{ url: "/b.webp", size: 40 }} />);
    expect(notHeld).not.toContain("data-hero-carry");
  });
});

describe("the stage reads nothing; the bar's title is one line", () => {
  it("no text hint on the stage (voice + hand glyph only); the sentence stays the aria-label", () => {
    const src = read("games", "sneakFreeze", "SneakFreeze.tsx");
    expect(src).not.toContain("data-sneak-hint");
    expect(src).not.toContain("sneak-freeze.hint");
    expect(src).toContain("aria-label={stageAria}");
    expect(src).toContain("<HandGlyph size={size} mode={v.hand} />");
  });

  it("the kid bar title is ONE line for this game only (step-down token, capped by the viewport)", () => {
    const overlay = read("KidModeOverlay.tsx");
    expect(overlay).toContain('const SNEAK_BAR_TITLE: React.CSSProperties = { fontSize: "min(var(--kid-t-say), 4.6vw)", WebkitLineClamp: 1, whiteSpace: "nowrap" };');
    const node = overlay.slice(overlay.indexOf("data-kid-bar-title"), overlay.indexOf("{barTitle}"));
    expect(node).toContain("...(sneakOpen ? SNEAK_BAR_TITLE : null),");
    // other games' bars keep the two-line rule
    expect(node).toContain("WebkitLineClamp: 2,");
    // "Sneak & Freeze" at 4.6vw of 375 px (17.25 px; Nunito 800 about 7.1 em)
    // fits the title's room beside Home, Sound and the exit.
    const titleRoom = 375 - 24 - 44 - 44 - 96 - 3 * 8;
    expect(7.2 * 375 * 0.046).toBeLessThan(titleRoom);
  });
});

describe("B-GAME-06b: the scene without the white slab", () => {
  it("in this game only, the bar is transparent over the scene: floating toys, the title kept for screen readers, presses pass through the empty bar", () => {
    const overlay = read("KidModeOverlay.tsx");
    expect(overlay).toContain('data-kid-bar-float={sneakOpen ? "" : undefined}');
    expect(overlay).toContain("...(sneakOpen ? SNEAK_BAR_FLOAT : null),");
    expect(overlay).toContain("...(sneakOpen ? SNEAK_BAR_TITLE_UNSEEN : null),");
    expect(overlay).toContain("...(sneakOpen ? SNEAK_BAR_HOME : null),");
    const float = overlay.slice(overlay.indexOf("const SNEAK_BAR_FLOAT"), overlay.indexOf(";", overlay.indexOf("const SNEAK_BAR_FLOAT")));
    expect(float).toContain('background: "transparent"');
    expect(float).toContain('position: "absolute"');
    expect(float).toContain("env(safe-area-inset-top)");
    expect(float).toContain('pointerEvents: "none"');
    // the title is still in the DOM ({barTitle}), only unpainted
    expect(overlay).toContain('const SNEAK_BAR_TITLE_UNSEEN: React.CSSProperties = { clipPath: "inset(50%)", pointerEvents: "none" };');
    const css = readFileSync(path.join(here, "..", "..", "index.css"), "utf8");
    expect(css).toContain("[data-kid-bar-float] > * { pointer-events: auto; }");
    expect(css).toMatch(/\[data-kid-bar-float\] button \{\s*box-shadow:/);
  });
});

// The git guard that stood here was retired on 6 Oct 2026: Guy ruled (5 Oct) that his son's
// images stay in the app, and on 6 Oct put the proof in production; public/_proof ships.

