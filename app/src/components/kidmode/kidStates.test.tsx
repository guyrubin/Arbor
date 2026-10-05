/**
 * B-KID-79 (KA-23) — the kid loading and error states. ONE loading state
 * (the world's card or the theme's home stage + the hero idling), never the
 * parent grey skeleton; ONE error state: Sprout + Home.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("../ui/HeroAvatar", () => ({ HeroAvatar: () => <span data-hero="" /> }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: "en", aiLang: "en", t: (k: string) => k }) }));

import { KidStageFallback } from "./KidStageFallback";
import { KidCrashFallback } from "./KidErrorBoundary";
import { ArborMascot } from "../ui/ArborMascot";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(path.join(__dirname, ...p), "utf8");
const EMOJI = /\p{Extended_Pictographic}/u;

describe("the one kid loading state", () => {
  it("a world shows its own card (film3d: the hero is in the picture, no sticker)", () => {
    const html = renderToStaticMarkup(<KidStageFallback worldId="memory" />);
    expect(html).toContain("game-memory");
    expect(html).not.toContain("data-hero");
  });
  it("any other kid surface shows the theme's home stage with the hero idling in front", () => {
    const html = renderToStaticMarkup(<KidStageFallback />);
    expect(html).toContain("kid-discovery-garden-v2");
    expect(html).toContain("data-kid-idle");
    expect(html).toContain("data-hero");
    expect(html).toContain('aria-hidden="true"');
  });
  it("no parent skeleton inside Kid Mode: every kid Suspense and the shelf's loading use it", () => {
    const overlay = read("KidModeOverlay.tsx");
    expect(overlay).not.toMatch(/TabSkeleton|SectionSkeleton/);
    expect(overlay.match(/<Suspense fallback=\{<KidStageFallback/g)?.length).toBe(4);
    const shelf = read("KidComicsShelf.tsx");
    expect(shelf).toContain("<KidStageFallback />");
    expect(shelf).not.toContain('kidsStoriesText("shelf.loading", aiLang)');
  });
});

describe("the one kid error state", () => {
  const html = renderToStaticMarkup(<KidCrashFallback title="Oops, this part needs a rest" homeLabel="Home" onHome={() => {}} guide={<ArborMascot size={96} mood="think" />} />);
  it("Sprout + one line + ONE Home button", () => {
    expect(html).toContain("data-kid-crash-sprout");
    expect((html.match(/<button\b/g) ?? []).length).toBe(1);
    expect(html).toContain(">Home<");
    expect(html).toContain('role="alert"');
  });
  it("the overlay hands Sprout to the boundary", () => {
    expect(read("KidModeOverlay.tsx")).toContain('guide={<ArborMascot size={96} mood="think" />}');
  });
  it("no emoji glyph standing in for the character", () => {
    const visible = html.replace(/<[^>]+>/g, "");
    expect(visible).not.toMatch(EMOJI);
  });
});
