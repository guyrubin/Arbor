/**
 * B-KID-128 — book pages keep the picture's proportions on every screen.
 *
 * Production (Guy, 1920x742): the page <img> (a 1024x1365 portrait cover) was
 * drawn into a 1920x408 box with object-fit cover - a letterbox slice of the
 * whale's mouth and the top of the child's hair. The contract now: below
 * 640 px the art is full-bleed at 4:5; from 640 px the reader is a two-column
 * spread with the picture at its own 3:4, as tall as the screen allows, the
 * words and Back/Next beside it; no fixed block-size on the art box (a fixed
 * height on a full-width box is what letterboxed). The per-beat variation on
 * the spread is a zoom (<= 1.15) toward the beat's focal point.
 * Rendered with react-dom/server; the pixel check at 375/768/1280/1920 is Fable's.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: "en", aiLang: "en", t: (k: string) => k }) }));
vi.mock("../../lib/api", () => ({ api: {} }));
vi.mock("../../lib/tts", () => ({ stopSpeaking: vi.fn() }));
vi.mock("../../lib/kidModeGate", () => ({ isKidModeActive: () => true }));

import { BEAT_FOCUS, BEAT_SCALE_CLASS, HeroScenePlayer, KID_BOOK_ART_CLASS, KID_BOOK_SPREAD_CLASS } from "./HeroScenePlayer";
import type { HeroSceneRender } from "../../types";

const scene: HeroSceneRender = { beatId: "call", title: "The Call", narration: "Dana hears the sea.", imagePrompt: "" };
const page = (beat: number) => renderToStaticMarkup(
  <HeroScenePlayer layout="book" scene={scene} seed="s" beatNumber={beat} beatTotal={8} fallbackArtUrl="/c.webp" fallbackArtHasHero aside={<nav data-test-aside="">nav</nav>} />,
);
const artTag = (html: string) => html.match(/<div class="[^"]*"[^>]*data-kid-book-art=""[^>]*>/)?.[0] ?? "";

describe("B-KID-128: the book page layout contract", () => {
  const html = page(1);
  it("phone (< 640 px): full-bleed art at 4:5 - never a fixed height", () => {
    expect(KID_BOOK_ART_CLASS).toContain("w-full");
    expect(KID_BOOK_ART_CLASS).toContain("aspect-[4/5]");
    const tag = artTag(html);
    expect(tag).toContain("aspect-[4/5]");
    expect(tag).not.toMatch(/block-size|height:/);
  });
  it("wide (>= 640 px): a two-column spread, the picture at its own 3:4, sized by the screen height, framed", () => {
    expect(KID_BOOK_SPREAD_CLASS).toMatch(/sm:grid\b/);
    expect(KID_BOOK_SPREAD_CLASS).toContain("sm:grid-cols-[auto_minmax(0,24rem)]");
    expect(KID_BOOK_ART_CLASS).toContain("sm:aspect-[3/4]");
    expect(KID_BOOK_ART_CLASS).toContain("sm:w-auto");
    expect(KID_BOOK_ART_CLASS).toMatch(/sm:h-\[min\(80vh,/);
    expect(KID_BOOK_ART_CLASS).toContain("sm:[border:var(--comic-line)]");
    expect(html).toContain(KID_BOOK_SPREAD_CLASS);
  });
  it("the words and the page's controls share the second column (aside rendered after the text)", () => {
    const text = html.indexOf("data-kid-book-text");
    const aside = html.indexOf("data-test-aside");
    expect(text).toBeGreaterThan(artTag(html) ? html.indexOf("data-kid-book-art") : -1);
    expect(aside).toBeGreaterThan(text);
  });
  it("per-beat variation on the spread is a zoom <= 1.15 toward the focal point", () => {
    for (const c of BEAT_SCALE_CLASS) {
      const m = c.match(/scale-(?:\[(\d+(?:\.\d+)?)\]|(\d+))$/);
      const v = m?.[1] ? Number(m[1]) : Number(m?.[2]) / 100;
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(1.15);
    }
    const p3 = page(3);
    expect(p3).toContain(BEAT_SCALE_CLASS[2]);
    expect(p3).toContain(`transform-origin:${BEAT_FOCUS[2]}`);
  });
  it("the reader's cover page and the refused-pin cover use the same spread + art box (no 55dvh block anywhere)", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const tab = readFileSync(path.join(here, "..", "tabs", "HeroJourneyTab.tsx"), "utf8");
    const player = readFileSync(path.join(here, "HeroScenePlayer.tsx"), "utf8");
    expect(tab).toContain('data-kid-book-cover="" className={KID_BOOK_SPREAD_CLASS}');
    expect((tab.match(/className=\{KID_BOOK_ART_CLASS\}/g) ?? []).length).toBe(2);
    expect(tab).toContain("aside={bookSide}");
    expect(tab + player).not.toContain("clamp(220px, 55dvh");
    expect(tab + player).not.toContain("blockSize: KID_BOOK_ART_BLOCK");
  });
  it("the library grid caps a cover's width instead of growing giant cards at 1280/1920", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const lib = readFileSync(path.join(here, "..", "kidmode", "KidLibrary.tsx"), "utf8");
    expect(lib).toContain("sm:grid-cols-[repeat(auto-fill,minmax(150px,220px))]");
  });
});
