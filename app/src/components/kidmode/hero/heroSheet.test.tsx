/**
 * B-GAME-05 — the hero sheet: fallback map (never empty), injected-sheet
 * validation, the dev placeholder, and foot anchoring (a pose swap moves the
 * feet by 0 px).
 */
import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FALLBACK, HERO_POSES, heroSheetKey, parseHeroSheet, readStoredHeroSheet, resolvePose, type HeroPoseId, type HeroSheet, type HeroSprite } from "./heroSheet";
import { devPlaceholderSheet } from "./devPlaceholderSheet";
import { HeroFigure, spriteBox } from "./HeroFigure";

const sprite = (tag: string, foot = { x: 50, y: 190 }): HeroSprite => ({ url: `data:image/png;base64,${tag}`, w: 100, h: 200, foot });
const sheetWith = (poses: HeroPoseId[]): HeroSheet => ({ v: 1, heroId: "t", source: "proof", theme: "film3d", poses: Object.fromEntries(poses.map((p) => [p, sprite(p)])) });

describe("heroSheet — fallback map", () => {
  it("every pose resolves to itself when present", () => {
    const full = sheetWith([...HERO_POSES]);
    for (const p of HERO_POSES) expect(resolvePose(full, p)?.pose).toBe(p);
  });

  it("a missing pose follows its fallback chain, then idle, then anything present — never empty", () => {
    const idleOnly = sheetWith(["idle"]);
    for (const p of HERO_POSES) expect(resolvePose(idleOnly, p)?.pose).toBe("idle");
    expect(resolvePose(sheetWith(["idle", "tiptoe"]), "dash")?.pose).toBe("tiptoe");
    expect(resolvePose(sheetWith(["idle", "freeze-b"]), "freeze-a")?.pose).toBe("freeze-b");
    expect(resolvePose(sheetWith(["idle", "hold-up"]), "cheer")?.pose).toBe("hold-up");
    // No idle at all: still something.
    expect(resolvePose(sheetWith(["oops"]), "cheer")?.pose).toBe("oops");
    // Every pose's chain is made of real poses and never names itself.
    for (const p of HERO_POSES) for (const q of FALLBACK[p]) { expect(HERO_POSES).toContain(q); expect(q).not.toBe(p); }
    expect(resolvePose(null, "idle")).toBeNull();
  });
});

describe("heroSheet — injected proof sheet", () => {
  it("parses a valid sheet and rejects junk, unsafe urls and empty pose sets", () => {
    const ok = parseHeroSheet({ v: 1, heroId: "dylan", source: "proof", poses: { idle: sprite("a"), cheer: { ...sprite("b"), hand: { l: [10, 20], r: [30, 40] } } } });
    expect(ok?.poses.idle?.foot).toEqual({ x: 50, y: 190 });
    expect(ok?.poses.cheer?.hand).toEqual({ l: [10, 20], r: [30, 40] });
    expect(parseHeroSheet(null)).toBeNull();
    expect(parseHeroSheet({ v: 2, poses: { idle: sprite("a") } })).toBeNull();
    expect(parseHeroSheet({ v: 1, poses: {} })).toBeNull();
    expect(parseHeroSheet({ v: 1, poses: { idle: { ...sprite("a"), url: "javascript:alert(1)" } } })).toBeNull();
    expect(parseHeroSheet({ v: 1, poses: { idle: { ...sprite("a"), foot: { x: "1" } } } })).toBeNull();
    expect(parseHeroSheet({ v: 1, poses: { idle: sprite("a"), wave: sprite("w") } })?.poses).not.toHaveProperty("wave");
  });

  it("reads the child-scoped device key, and falls back on bad JSON", () => {
    expect(heroSheetKey("kid1")).toBe("arbor.heroSheet.kid1");
    const store = (v: string | null) => ({ getItem: (k: string) => (k === "arbor.heroSheet.kid1" ? v : null) });
    expect(readStoredHeroSheet("kid1", store(JSON.stringify({ v: 1, poses: { idle: sprite("a") } })))?.poses.idle).toBeTruthy();
    expect(readStoredHeroSheet("kid1", store("{nope"))).toBeNull();
    expect(readStoredHeroSheet("kid1", store(null))).toBeNull();
    expect(readStoredHeroSheet("", store("{}"))).toBeNull();
  });
});

describe("heroSheet — dev placeholder", () => {
  it("has all eight poses, distinct pictures, one foot anchor, and says it is a placeholder", () => {
    const s = devPlaceholderSheet();
    expect(s.source).toBe("dev-placeholder");
    expect(Object.keys(s.poses).sort()).toEqual([...HERO_POSES].sort());
    const urls = HERO_POSES.map((p) => s.poses[p]?.url);
    expect(new Set(urls).size).toBe(8);
    for (const u of urls) expect(u).toMatch(/^data:image\/svg\+xml;utf8,/);
    for (const p of HERO_POSES) expect(s.poses[p]?.foot).toEqual({ x: 100, y: 310 });
    expect(s.poses["hold-up"]?.hand?.l).toBeTruthy();
  });
});

describe("HeroFigure — foot anchoring", () => {
  it("a pose swap moves the feet by 0 px (every sprite is placed by its own foot)", () => {
    // Different foot anchors per pose, as real cut-outs will have.
    const s: HeroSheet = { v: 1, heroId: "t", source: "proof", theme: "film3d", poses: { idle: sprite("i", { x: 50, y: 190 }), oops: { url: "data:image/png;base64,o", w: 160, h: 120, foot: { x: 90, y: 112 } } } };
    const idle = spriteBox(s, "idle", 400)!;
    const oops = spriteBox(s, "oops", 400)!;
    const k = 400 / 200;
    // The foot point of each box lands on (0, 0).
    expect(idle.left + 50 * k).toBeCloseTo(0, 6);
    expect(idle.top + 190 * k).toBeCloseTo(0, 6);
    expect(oops.left + 90 * k).toBeCloseTo(0, 6);
    expect(oops.top + 112 * k).toBeCloseTo(0, 6);
    // Missing pose renders the fallback, never nothing.
    expect(spriteBox(s, "dash", 400)?.pose).toBe("idle");
  });

  it("renders every pose (one visible), a contact shadow, and the feet at (x, y) whatever the pose", () => {
    const sheet = devPlaceholderSheet();
    const a = renderToStaticMarkup(<HeroFigure pose="idle" height={300} sheet={sheet} x={120} y={640} />);
    const b = renderToStaticMarkup(<HeroFigure pose="oops" height={300} sheet={sheet} x={120} y={640} />);
    for (const html of [a, b]) {
      expect(html).toContain("translate(120px, 640px)");
      expect(html).toContain("data-hero-shadow");
      expect((html.match(/<img /g) ?? []).length).toBe(8);
      expect((html.match(/opacity:1/g) ?? []).length).toBe(1);
      expect(html).toContain('aria-hidden="true"');
    }
    expect(a).toContain('data-hero-figure="idle"');
    expect(b).toContain('data-hero-figure="oops"');
    expect(b).not.toMatch(/transition:[^;"]*opacity/);
  });
});
