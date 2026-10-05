/**
 * B-KID-88 / B-KID-85 — the kid's "My books": ONE list (kidBooks) and ONE
 * cover (KidBookCover), read by the home row and the library grid.
 * Rendered with react-dom/server (no jsdom in this repo).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { kidBooks } from "./kidBooks";
import { KidBookCover } from "./KidBookCover";
import { HERO_STORIES, storyHasLanguage } from "../../lib/heroJourneys";
import { kidArt, storyCoverKey } from "../../lib/kidThemeManifest";

const film3dCover = (id: string) => kidArt("film3d", storyCoverKey(id)) !== null;
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
    expect(all.length).toBe(HERO_STORIES.length);
  });

  it("opened books lead, most recent first; then illustrated before title cards", () => {
    const books = kidBooks({
      lang: "en", ageMonths: 60, showAllAges: false, hasCover: film3dCover,
      runs: [
        { storyId: "noahs-ark", completedAt: "2026-09-01T18:00:00Z" },
        { storyId: "the-lantern-path", completedAt: "2026-09-03T18:00:00Z" },
      ],
    });
    expect(books.slice(0, 2).map((b) => [b.story.id, b.state])).toEqual([["the-lantern-path", "finished"], ["noahs-ark", "finished"]]);
    const rest = books.slice(2);
    const firstTitleCard = rest.findIndex((b) => !film3dCover(b.story.id));
    expect(firstTitleCard).toBeGreaterThan(0);
    expect(rest.slice(firstTitleCard).every((b) => !film3dCover(b.story.id))).toBe(true);
    expect(rest.every((b) => b.state === "new")).toBe(true);
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

  it("a story covered in the theme shows its cover, edge to edge; no title card", () => {
    const html = renderToStaticMarkup(<KidBookCover {...base} storyId="noahs-ark" title="Noah's Ark" layout="grid" />);
    expect(html).toContain("<img");
    expect(html).toContain("story-noahs-ark");
    expect(html).not.toContain("data-kid-book-titlecard");
  });

  it("a story with no cover in the theme gets the designed title card: tokens only, no emoji, never another theme's file", () => {
    expect(film3dCover("the-lantern-path")).toBe(false);
    const html = renderToStaticMarkup(<KidBookCover {...base} storyId="the-lantern-path" layout="row" />);
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
