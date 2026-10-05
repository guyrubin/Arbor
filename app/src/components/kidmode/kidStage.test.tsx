/**
 * B-KID-133 (D-01) — the Stage behind every kid view (KID-DESIGN-DIRECTION
 * §2.4.1). No kid view is white paper: the home is the hero's room (tall
 * reading room on a phone, the garden + castle library on a wide screen), a
 * game its world card, a book its cover, the library the garden. Rendered
 * with react-dom/server (no jsdom in this repo).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../context/ArborContext", () => ({ useArborOptional: () => ({ childProfile: { id: "c1", kidTheme: "film3d" } }) }));

import { KidStage } from "./KidStage";
import { KID_STAGE_BLUR, kidStageArt, kidStageFor } from "./kidStageArt";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const css = readFileSync(path.join(__dirname, "..", "..", "index.css"), "utf8");
const overlay = readFileSync(path.join(__dirname, "KidModeOverlay.tsx"), "utf8");

describe("which picture is the stage", () => {
  it("home: the tall reading room on a phone, the garden on a wide screen; legible (blur 4) with a crisp top band", () => {
    const s = kidStageArt("film3d", { kind: "home" });
    expect(s.tall?.src).toContain("arbor-academy-play-hero-bg");
    expect(s.wide?.src).toContain("kid-discovery-garden-v2");
    expect(s.blur).toBe(4);
    expect(s.sharpTop).toBe(true);
  });
  it("a game = its world card; a book = its cover; the library = the garden", () => {
    expect(kidStageArt("film3d", { kind: "world", worldId: "pattern" }).wide?.src).toContain("game-pattern");
    expect(kidStageArt("film3d", { kind: "story", storyId: "noahs-ark" }).wide?.src).toContain("story-noahs-ark");
    expect(kidStageArt("film3d", { kind: "library" }).wide?.src).toContain("kid-discovery-garden-v2");
    expect([KID_STAGE_BLUR.library, KID_STAGE_BLUR.world, KID_STAGE_BLUR.story]).toEqual([10, 22, 26]);
  });
  it("one theme, never mixed: a theme without the art gets the flat token stage, never another theme's file", () => {
    const s = kidStageArt("storybook", { kind: "home" });
    expect(s.wide).toBeNull();
    const html = renderToStaticMarkup(<KidStage scene={{ kind: "library" }} />);
    expect(html).not.toContain("data-empty");
    expect(kidStageArt("film3d", { kind: "world", worldId: "no-such-world" }).id).toBe("fallback:world");
  });
  it("the overlay's default scene per view", () => {
    expect(kidStageFor("home", null)).toEqual({ kind: "home" });
    expect(kidStageFor("arcade", "beat")).toEqual({ kind: "world", worldId: "beat" });
    expect(kidStageFor("journeys", "noahs-ark")).toEqual({ kind: "story", storyId: "noahs-ark" });
    expect(kidStageFor("journeys", null)).toEqual({ kind: "library" });
    expect(kidStageFor("feelings", null)).toEqual({ kind: "world", worldId: "feelings" });
  });
});

describe("the stage layer", () => {
  const html = renderToStaticMarkup(<KidStage scene={{ kind: "home" }} />);
  it("is decorative, carries the blur as a variable, and swaps tall/wide art by media query", () => {
    expect(html).toMatch(/^<div aria-hidden="true" class="kid-stage" data-kid-stage="home" data-sharp-top=""/);
    expect(html).toContain("--stage-blur:4px");
    expect(html).toContain('media="(max-width: 767px)"');
    expect(html).toContain("arbor-academy-play-hero-bg-480.webp");
    expect(html).toContain('class="kid-stage-soft"');
    expect(html).toContain('class="kid-stage-sharp"');
    expect(html).toContain('class="kid-stage-tint"');
  });
  it("CSS: absolute under the content, blurred, navy tint (never black), crisp band only on phone portrait, no animation", () => {
    const block = css.slice(css.indexOf("── D-01 · The Stage"), css.indexOf("Words never sit on the stage"));
    expect(block).toMatch(/\.arbor-play \.kid-stage \{[^}]*position: absolute;[^}]*inset: 0;[^}]*z-index: 0;[^}]*contain: strict;/);
    expect(block).toContain("filter: blur(var(--stage-blur, 22px)) saturate(1.2);");
    expect(block).toContain("transform: scale(1.12);");
    expect(block).toContain("@media (max-width: 767px) and (orientation: portrait)");
    expect(block).toContain("color-mix(in oklab, var(--arbor-ink) 38%, transparent)");
    expect(block).not.toMatch(/animation|#[0-9a-f]{3,6}\b|comic-ink/i);
    expect(css).toContain(".arbor-play[data-kid-staged]::before { display: none; }");
  });
  it("the overlay: stage first, content above it, navy behind (a slow image never flashes white)", () => {
    expect(overlay).toContain('data-kid-staged=""');
    expect(overlay.indexOf("<KidStage scene={stageScene} />")).toBeLessThan(overlay.indexOf("{surface && ("));
    expect(overlay).toContain('zIndex: 69, background: "var(--arbor-ink)"');
    expect((overlay.match(/position: "relative",\s*zIndex: 1,/g) ?? []).length).toBe(2);
  });
});
