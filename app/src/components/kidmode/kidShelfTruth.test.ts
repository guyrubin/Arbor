/**
 * B-KID-38 (KB-06, truth) — the kid shelf tells the truth to a child with no
 * hero. The reader shelves a book only when the child has a hero
 * (HeroJourneyTab saveStoryAsComic returns without one), yet the empty shelf
 * promised "Read a hero story and your comic appears here." Now a hero-less
 * child reads "Your books live here — read one to start" and the shelf's one
 * button opens the story catalogue. Static pins (no jsdom).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { en, he } from "../../lib/i18nElevation/kidsStories";

const SRC = path.resolve(__dirname, "..", "..");
const shelf = readFileSync(path.join(SRC, "components/kidmode/KidComicsShelf.tsx"), "utf8");
const overlay = readFileSync(path.join(SRC, "components/kidmode/KidModeOverlay.tsx"), "utf8");
const tab = readFileSync(path.join(SRC, "components/tabs/HeroJourneyTab.tsx"), "utf8");

describe("B-KID-38: the empty shelf for a child with no hero", () => {
  it("the 'comic appears' promise renders only with a hero; without one, the honest line", () => {
    expect(shelf).toMatch(/\{heroUrl \? \(\s*<>\s*<p[^>]*>\{kidsStoriesText\("shelf\.empty", aiLang\)\}<\/p>\s*<p[^>]*>\{kidsStoriesText\("shelf\.emptyHint", aiLang\)\}<\/p>/);
    expect(shelf).toContain('{kidsStoriesText("shelf.emptyNoHero", aiLang)}');
  });
  it("the shelf's door opens the story catalogue", () => {
    expect(shelf).toContain('<PlayButton tone="clay" onClick={onOpenStories}>{kidsStoriesText("shelf.openStories", aiLang)}</PlayButton>');
    expect(overlay).toContain('onOpenStories={() => setView("journeys")}');
  });
  it("the premise holds: the reader never shelves without a hero", () => {
    expect(tab).toContain("if (!activeStory || !render || !heroAvatarUrl) return;");
  });
  it.each(["shelf.emptyNoHero", "shelf.openStories"])("%s exists in EN and Hebrew and promises no comic", (key) => {
    expect(en[key]).toBeTruthy();
    expect(/[א-ת]/.test(he[key] ?? "")).toBe(true);
    expect(en[key]).not.toMatch(/comic/i);
    expect(he[key]).not.toContain("קומיקס");
  });
  it("NEGATIVE CONTROL: the old hint promises a comic", () => {
    expect(en["shelf.emptyHint"]).toMatch(/comic appears/);
  });
});
