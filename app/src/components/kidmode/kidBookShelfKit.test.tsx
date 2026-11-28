/**
 * B-KID-172 — the bookshelf, the book reader and the Stories room wear the
 * Studio kit: every cover shows a picture (its own hero-free cover, else the
 * kit's reading room with its title — never blank paper), the shelf tiles are
 * Studio cards, the reader's controls are the Studio action, and the Stories
 * room is the Studio picture grid. Render and source guards.
 */
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KidBookCover, KidBookTitleCard, kidBookFallbackArt } from "./KidBookCover";
import { KID_SHELF_STORIES } from "../../lib/heroJourneys";
import { KID_THEME_IDS, kidArt } from "../../lib/kidThemeManifest";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(path.join(here, ...p), "utf8");
const base = { pack: "courage" as const, readLabel: "I read this", onOpen: () => {} };
const imgSrcs = (html: string) => [...html.matchAll(/<img[^>]*src="([^"]+)"/g)].map((m) => m[1]);

describe("B-KID-172 the shelf: every cover shows a picture", () => {
  it.each(KID_THEME_IDS)("%s: no kid-shelf cover is blank paper; a book without its own cover stands on the kit's hero-free reading room with its title", (theme) => {
    const fallback = kidBookFallbackArt(theme);
    expect(fallback).not.toBeNull();
    expect(fallback!.hasHero).toBe(false);
    expect(fallback!.src480).toBe(kidArt(theme, "studio.portal.stories")!.src480);
    for (const story of KID_SHELF_STORIES) {
      for (const layout of ["row", "grid"] as const) {
        const html = renderToStaticMarkup(<KidBookCover {...base} theme={theme} storyId={story.id} title="Synthetic title" layout={layout} />);
        const srcs = imgSrcs(html);
        expect(srcs.length, `${theme}/${story.id}`).toBeGreaterThan(0);
        expect(html, story.id).not.toContain("/visuals/cards/");
        expect(html, story.id).not.toContain("var(--comic-line)");
        expect(html, story.id).not.toContain("--arbor-green-cta-start");
        expect(html, story.id).toContain("Synthetic title");
        if (html.includes("data-kid-book-fallback-art")) {
          expect(srcs, story.id).toEqual([fallback!.src480]);
          expect(html, story.id).toContain("data-kid-book-title-plate");
        }
      }
    }
  });

  it("the loading placeholder under a real cover stays the plain pearl card (no second picture to fetch)", () => {
    const html = renderToStaticMarkup(<span><KidBookTitleCard title="Book" pack="truth" /></span>);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("data-kid-book-fallback-art");
    expect(html).toContain("var(--studio-pearl)");
  });

  it("the child's OWN portrait stays the only figure the card adds, once, off the title plate", () => {
    const own = <img data-own="" src="data:image/svg+xml,synthetic" alt="" />;
    const html = renderToStaticMarkup(<span><KidBookTitleCard title="Book" pack="truth" theme="film3d" hero={own} /></span>);
    expect(html.match(/data-own=""/g)).toHaveLength(1);
    expect(html.match(/data-kid-book-own-hero=""/g)).toHaveLength(1);
    expect(html.match(/>Book</g)).toHaveLength(1);
    expect(html).toMatch(/data-kid-book-own-hero=""[^>]*inset-block-start/);
  });

  it("the grid tile is a Studio card (white, soft lift), reduced motion holds it still; the empty shelf is a frosted card, not the comic panel", () => {
    expect(read("KidBookCover.tsx")).toContain("data-kid-book-layout={layout}");
    const css = read("kidBookCover.css");
    const card = css.slice(css.indexOf('[data-kid-book-layout="grid"] {'));
    expect(card).toContain("background: var(--studio-surface)");
    expect(card).toContain("border-radius: var(--studio-radius-card)");
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[\s\S]*data-kid-book-layout="grid"\][\s\S]*transform: none/);
    const lib = read("KidLibrary.tsx");
    expect(lib).not.toContain("comic-panel");
    expect(lib).not.toContain("--arbor-ink");
    expect(lib).toMatch(/data-testid="kid-library-empty" data-kid-studio=""/);
  });
});

describe("B-KID-172 the reader: Studio type and the Studio Next", () => {
  const tab = read("..", "tabs", "HeroJourneyTab.tsx");
  it("the legacy reader's Next and Read again are the Studio action; its cover stands on the kit picture", () => {
    expect(tab).toMatch(/data-kid-book-next=""[\s\S]{0,200}background: "var\(--studio-action\)", color: "var\(--studio-action-ink\)"/);
    expect(tab).toContain("theme={kidTheme} />}");
  });
  it("a refused pin's cover wears the Studio look: no comic ink line, no raw blue, no display serif", () => {
    const pin = tab.slice(tab.indexOf("data-kid-book-pin-cover"), tab.indexOf("// The page's one move"));
    expect(pin).not.toContain("--comic-line");
    expect(pin).not.toContain("--arbor-green-cta-start");
    expect(pin).not.toContain("--font-display");
    expect(pin).toContain('background: "var(--studio-action)"');
    expect(pin).toContain("<KidBookTitleCard title={pinTitle} pack={refusedPin.pack} theme={kidTheme}");
  });
  it("a short landscape cover hides the title plate with the title (the facing page names the book)", () => {
    const css = read("..", "stories", "legacyBook.css");
    const sideways = css.slice(css.indexOf("@media (min-width: 640px) and (max-height: 520px)"));
    expect(sideways).toContain("[data-kid-book-cover] [data-kid-book-title-plate] { display: none !important; }");
  });
});

describe("B-KID-172 the Stories room is the Studio picture grid", () => {
  const world = read("studioV2", "StudioWorld.tsx");
  const stories = world.slice(world.indexOf('worldId === "stories" ? <>'), world.indexOf("B-KID-171: a game shelf"));
  it("books, story makers and the bookshelf door are picture tiles — no list rows, arrows or grey placeholder", () => {
    expect(stories).toContain('className="studio-v2__activity-grid" data-shelf="books"');
    expect(stories).toContain('className="studio-v2__activity-grid" data-shelf="story-makers"');
    expect(stories).not.toContain("studio-v2__activity-icon");
    expect(stories).not.toContain("ArrowRight");
    // a book's cover: its own plate over the kit fallback, so a missing plate is never blank
    expect(stories).toMatch(/<KidBookTitleCard [^>]*theme=\{theme\}[^>]*\/><LibraryBookCover /);
    // the bookshelf door shows the kit's reading room
    expect(world).toContain("const shelfArt = kidBookFallbackArt(theme);");
    expect(stories).toMatch(/data-studio-books=""[\s\S]*shelfArt\.src480/);
    // which books and makers are shown is unchanged
    expect(stories).toContain("books.map(entry =>");
    expect(stories).toContain("activities.map(activity =>");
    expect(stories).toContain("onOpenBook(entry.book.id)");
  });
  it("book covers keep a 3:4 shape (a lone last book too), three across on wide screens", () => {
    const css = read("studioV2", "studioV2.css");
    expect(css).toContain(".studio-v2__activity-grid[data-shelf=books] .studio-v2__activity-art{aspect-ratio:3/4");
    expect(css).toContain(".studio-v2__activity-grid[data-shelf=books]>.studio-v2__activity:last-child:nth-child(odd){grid-column:auto}");
    expect(css).toMatch(/@media\(min-width:951px\)\{\.studio-v2__activity-grid\[data-shelf=books\]\{grid-template-columns:repeat\(3/);
  });
});
