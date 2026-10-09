/**
 * B-KID-88 / B-KID-85 — the kid's "My books": ONE list (kidBooks) and ONE
 * cover (KidBookCover), read by the home row and the library grid.
 * Rendered with react-dom/server (no jsdom in this repo).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { en as kidsEn, he as kidsHe } from "../../lib/i18nElevation/kidsStories";
import { describe, expect, it } from "vitest";
import { kidBooks } from "./kidBooks";
import { KidBookCover } from "./KidBookCover";
import { HERO_STORIES, KID_RETIRED_STORY_IDS, KID_SHELF_STORIES, storyHasLanguage } from "../../lib/heroJourneys";
import { kidArt, storyCoverKey } from "../../lib/kidThemeManifest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const film3dCover = (id: string) => kidArt("film3d", storyCoverKey(id)) !== null;
const storybookCover = (id: string) => kidArt("storybook", storyCoverKey(id)) !== null;
const EMOJI = /\p{Extended_Pictographic}/u;

describe("kidBooks — the one list", () => {
  it("Hebrew: only stories that can be told in Hebrew", () => {
    const books = kidBooks({ lang: "he", ageMonths: null, showAllAges: true, hasCover: film3dCover, runs: [] });
    expect(books.length).toBeGreaterThan(0);
    for (const b of books) expect(storyHasLanguage(b.story, "he"), b.story.id).toBe(true);
  });

  it("age view: a 4-year-old does not get the 6-8 books; Show all ages lifts it", () => {
    const four = kidBooks({ lang: "en", ageMonths: 48, showAllAges: false, hasCover: film3dCover, runs: [] });
    expect(four.some((b) => b.story.id === "moses-and-pharaoh")).toBe(false);
    const all = kidBooks({ lang: "en", ageMonths: 48, showAllAges: true, hasCover: film3dCover, runs: [] });
    expect(all.length).toBe(KID_SHELF_STORIES.length);
  });

  it("B-BOOK-29: the kid shelf is the canonical-text books only - the five retired and the originals never appear", () => {
    const all = kidBooks({ lang: "en", ageMonths: null, showAllAges: true, hasCover: film3dCover, runs: [] }).map((b) => b.story.id);
    expect(all.sort()).toEqual(["david-and-goliath", "jacob-wrestling-the-angel", "jonah-and-the-great-fish", "joseph-and-his-brothers", "moses-and-pharaoh", "noahs-ark"]);
    for (const id of KID_RETIRED_STORY_IDS) expect(all, id).not.toContain(id);
    for (const s of HERO_STORIES.filter((x) => x.origin === "original")) expect(all, s.id).not.toContain(s.id);
  });

  it("opened books lead, most recent first; then illustrated before title cards", () => {
    // B-KID-131 re-pin: film3d covers every story, so the mixed shelf is proven
    // in the storybook theme (3 covers); film3d has no title cards at all.
    // B-BOOK-29 re-pin: the shelf is the canonical-text books; the ordering
    // rule is proven over the full catalogue (injected), as before.
    const runs = [
      { storyId: "noahs-ark", completedAt: "2026-09-01T18:00:00Z" },
      { storyId: "the-lantern-path", completedAt: "2026-09-03T18:00:00Z" },
    ];
    const books = kidBooks({ lang: "en", ageMonths: 60, showAllAges: false, hasCover: storybookCover, runs, stories: HERO_STORIES });
    expect(books.slice(0, 2).map((b) => [b.story.id, b.state])).toEqual([["the-lantern-path", "finished"], ["noahs-ark", "finished"]]);
    const rest = books.slice(2);
    const firstTitleCard = rest.findIndex((b) => !storybookCover(b.story.id));
    expect(firstTitleCard).toBeGreaterThan(0);
    expect(rest.slice(firstTitleCard).every((b) => !storybookCover(b.story.id))).toBe(true);
    expect(rest.every((b) => b.state === "new")).toBe(true);
    const film = kidBooks({ lang: "en", ageMonths: 60, showAllAges: false, hasCover: film3dCover, runs });
    expect(film.every((b) => film3dCover(b.story.id))).toBe(true);
  });

  it("every story appears at most once (a re-read is one book)", () => {
    const books = kidBooks({ lang: "en", ageMonths: null, showAllAges: true, hasCover: film3dCover, runs: [
      { storyId: "noahs-ark", completedAt: "2026-09-01T18:00:00Z" },
      { storyId: "noahs-ark", completedAt: "2026-09-05T18:00:00Z" },
    ] });
    const ids = books.map((b) => b.story.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("KidBookCover — the one cover", () => {
  const base = { title: "The Lantern Path", pack: "courage" as const, theme: "film3d" as const, readLabel: "I read this", onOpen: () => {} };

  it("a story covered in the theme shows its cover, edge to edge (B-KID-122: over its title card, which shows until the picture has loaded)", () => {
    const html = renderToStaticMarkup(<KidBookCover {...base} storyId="noahs-ark" title="Noah's Ark" layout="grid" />);
    expect(html).toContain("<img");
    expect(html).toContain("story-noahs-ark");
    // B-KID-122 re-pin: the title card is the loading placeholder UNDER the image (before it in the DOM).
    expect(html.indexOf("data-kid-book-titlecard")).toBeGreaterThan(-1);
    expect(html.indexOf("data-kid-book-titlecard")).toBeLessThan(html.indexOf("<img"));
  });

  it("B-KID-122: first-row covers load eagerly; the rest lazy; the picture fades in over a sized slot", () => {
    const eager = renderToStaticMarkup(<KidBookCover {...base} storyId="noahs-ark" title="Noah's Ark" layout="row" eager />);
    const lazy = renderToStaticMarkup(<KidBookCover {...base} storyId="noahs-ark" title="Noah's Ark" layout="row" />);
    expect(eager).toMatch(/<img[^>]*loading="eager"/);
    expect(lazy).toMatch(/<img[^>]*loading="lazy"/);
    expect(eager).toMatch(/<img[^>]*width="\d+"[^>]*height="\d+"/);
    expect(eager).toContain("aspect-ratio:3 / 4");
    expect(eager).toMatch(/<img[^>]*data-kid-book-img="pending"[^>]*opacity:0/);
    expect(eager).toContain("motion-reduce:transition-none");
    expect(eager).toContain("Noah&#x27;s Ark");
  });

  it("B-KID-122: the home row and the library mark their first row eager; Tonight's cover is high priority", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const read = (f: string) => readFileSync(path.join(here, f), "utf8");
    expect(read("KidLibrary.tsx")).toContain("eager={i < KID_BOOK_EAGER_COUNT}");
    expect(read("KidDashboard.tsx")).toContain("eager={i < KID_BOOK_EAGER_COUNT}");
    expect(read("KidDashboard.tsx")).toMatch(/<WorldScene worldId=\{tonightsArtId\}[^>]*priority>/);
    expect(read(path.join("..", "practice", "WorldScene.tsx"))).toContain('loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined}');
  });

  it("a story with no cover in the theme gets the designed title card: tokens only, no emoji, never another theme's file", () => {
    // B-KID-131 re-pin: every story has a film3d cover; a cover-less story is a storybook one.
    expect(storybookCover("noahs-ark")).toBe(false);
    const html = renderToStaticMarkup(<KidBookCover {...base} theme="storybook" storyId="noahs-ark" title="Noah's Ark" layout="row" />);
    expect(html).toContain("data-kid-book-titlecard");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("/visuals/");
    expect(html).not.toMatch(EMOJI);
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(html).toContain("var(--arbor-pack-courage)");
  });

  it("a finished book carries ONE small read mark — never a number or a star", () => {
    const read = renderToStaticMarkup(<KidBookCover {...base} storyId="the-lantern-path" layout="row" read />);
    expect((read.match(/data-kid-book-read/g) ?? []).length).toBe(1);
    expect(read).toContain('aria-label="I read this"');
    expect(read).not.toMatch(/★|⭐|\b\d+\b<\/span>/);
    const unread = renderToStaticMarkup(<KidBookCover {...base} storyId="the-lantern-path" layout="row" />);
    expect(unread).not.toContain("data-kid-book-read");
  });

  it("the cover is one button whose name is the title printed under it", () => {
    const html = renderToStaticMarkup(<KidBookCover {...base} storyId="the-lantern-path" layout="grid" />);
    expect((html.match(/<button\b/g) ?? []).length).toBe(1);
    // the in-card title is aria-hidden; the caption is the visible + accessible name
    expect(html).toContain('aria-hidden="true" data-kid-book-titlecard');
    expect((html.match(/The Lantern Path/g) ?? []).length).toBe(2);
  });
});

describe("B-KID-85 — the kid library is a cover grid in the kid register", () => {
  // code only (the header comment names what was removed)
  const lib = readFileSync(path.join(__dirname, "KidLibrary.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const tab = readFileSync(path.join(__dirname, "..", "tabs", "HeroJourneyTab.tsx"), "utf8");
  const kidBranch = tab.slice(tab.indexOf("    return kidMode ? ("), tab.indexOf("    ) : (\n      <div className=\"space-y-6 max-w-[1100px]\">"));

  it("the kid branch of the story surface is ONE KidLibrary over kidBooks", () => {
    expect(kidBranch).toContain("<KidLibrary");
    expect(kidBranch).toContain("kidBooks({ lang: storyLang, ageMonths: childMonths, showAllAges,");
    for (const gone of ["role=\"tablist\"", "setPackFilter", "ORIGINAL", "מקורי", "agefilter-toggle", "Your aim", "HeroCrest", "ArborMascot", "shelfRuns.map", "PACK_WORLD"]) {
      expect(kidBranch, gone).not.toContain(gone);
    }
  });

  it("no filter chips, ages, ribbons, virtue tags or counts in the library itself", () => {
    for (const gone of ["pack filter", "packFilter", "ageRange", "showAll", "ORIGINAL", "primaryMetric", "METRIC", ".length}", "★"]) {
      expect(lib, gone).not.toContain(gone);
    }
    // 2 columns at phone width; the saved comics follow the books
    expect(lib).toContain("grid grid-cols-2");
    expect(lib.indexOf("<KidBookCover")).toBeLessThan(lib.indexOf('variant="madeBefore"'));
  });

  it("honest empty state: the hero + one true line, EN + HE", () => {
    expect(lib).toContain('kidsStoriesText("kidBooks.empty", lang)');
    expect(kidsEn["kidBooks.empty"]).toBeTruthy();
    expect(kidsHe["kidBooks.empty"]).toMatch(/[א-ת]/);
    expect(kidsHe["kidBooks.madeBefore"]).toMatch(/[א-ת]/);
  });

  it("the overlay names the screen 'My books' (one title, no second one inside)", () => {
    const overlay = readFileSync(path.join(__dirname, "KidModeOverlay.tsx"), "utf8");
    expect(overlay).toContain('journeys: { labelKey: "kidBooks.title", Comp: HeroJourneyTab }');
    expect(lib).not.toMatch(/<h1\b/);
  });

  it("NEGATIVE CONTROL: the parent catalogue keeps its filter and age switch", () => {
    const parent = tab.slice(tab.indexOf("    ) : (\n      <div className=\"space-y-6 max-w-[1100px]\">"));
    expect(parent).toContain("setPackFilter");
    expect(parent).toContain("agefilter-toggle-hero-journeys");
  });
});
