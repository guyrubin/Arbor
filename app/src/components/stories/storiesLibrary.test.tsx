/**
 * B-KID-87 (KB-29) — the parent Stories hub on the library.
 *
 *  - #/stories: the Tonight cover shows the BOOK (its own cover from the kid
 *    theme manifest), the avatar bust only for a book with no cover there.
 *  - "More stories" is the library grid: one StoryCard per book, on its cover,
 *    never a generated scene or an emoji motif.
 *  - #/comics leads with "Our books" (the same library on covers), the
 *    "{n} of {total} books" meter is gone, and a family with no hero reads the
 *    whole library (the hero card invites; nothing is gated).
 * Rendered with react-dom/server (no jsdom in this repo) + source pins on the
 * seams the rendered check depends on.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { StoryCard, STORY_PACK_LABEL } from "./StoryCard";
import { HERO_STORIES } from "../../lib/heroJourneys";
import { kidArt, storyCoverKey } from "../../lib/kidThemeManifest";
import { translate } from "../../lib/i18n";
import { consumeStoryOpen, requestStoryOpen } from "../../lib/storyOpenRequest";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "../..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const HERO = strip(read("components/tabs/HeroJourneyTab.tsx"));
const COMICS = strip(read("components/tabs/ComicsTab.tsx"));
const EMOJI = /\p{Extended_Pictographic}/u;

const story = (id: string) => HERO_STORIES.find((s) => s.id === id)!;

describe("StoryCard — one parent card for a library book", () => {
  it("a book with a cover in the theme renders that cover (manifest file), 3:4, the title under it", () => {
    const s = story("david-and-goliath");
    const art = kidArt("film3d", storyCoverKey(s.id))!;
    expect(art).toBeTruthy();
    const html = renderToStaticMarkup(<StoryCard story={s} lang="en" theme="film3d" onOpen={() => {}} />);
    expect(html).toContain(`src="${art.src480}"`);
    expect(html).toContain("aspect-ratio:3 / 4");
    expect(html).toContain(s.title);
    expect(html).not.toContain("data-story-card-titlecard");
    expect(html).not.toMatch(EMOJI);
  });

  it("a book with no cover in the theme gets the token title card (never another theme's file)", () => {
    const s = story("david-and-goliath");
    expect(kidArt("storybook", storyCoverKey(s.id))).toBeNull();
    const html = renderToStaticMarkup(<StoryCard story={s} lang="he" theme="storybook" onOpen={() => {}} />);
    expect(html).toContain("data-story-card-titlecard");
    expect(html).not.toContain("<img");
    expect(html).toContain(s.titleHe);
    expect(html).toContain(STORY_PACK_LABEL[s.pack].he);
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  it("is parent register: no comic tokens, no generated scene, no model call", () => {
    const card = strip(read("components/stories/StoryCard.tsx"));
    expect(card).not.toMatch(/var\(--comic-|comic-panel|arbor-play/);
    expect(card).not.toMatch(/WorldScene|api\.|generate/);
  });
});

describe("#/stories — Tonight shows the book; More stories is the library grid", () => {
  it("the Tonight art band renders the manifest cover of tonight's book, the avatar only without one", () => {
    expect(HERO).toContain("const tonightCover = tonightStory ? storyCover(tonightStory.id) : null;");
    const band = HERO.slice(HERO.indexOf('data-testid="stories-cover"'), HERO.indexOf('data-testid="hero-first-gate"'));
    expect(band).toMatch(/\{tonightCover \? \([\s\S]*src=\{tonightCover\.src480\}[\s\S]*data-testid="stories-tonight-book-cover"[\s\S]*\) : <HeroAvatar size=\{84\} ring animate=\{false\} \/>\}/);
    // the hero row stays in the band (B-PLAY-15), Play stays the one stamp
    expect(HERO).toContain('data-primary-move="read-tonights-story"');
  });

  it("More stories draws StoryCard per book; no WorldScene, no emoji motif, no SFX burst", () => {
    // B-PLAY-12: the "Your library" module left for #/comics; the More stories
    // grid ends with its disclosure.
    const gridAt = HERO.indexOf('data-testid="stories-library-grid"');
    expect(gridAt).toBeGreaterThan(-1);
    const grid = HERO.slice(gridAt, HERO.indexOf("</details>", gridAt));
    expect(grid).toContain("<StoryCard");
    expect(grid).toContain("onOpen={() => { void startJourney(story); }}");
    expect(HERO).not.toContain("<WorldScene");
    expect(grid).not.toContain("comic-sfx");
    expect(grid).not.toContain("art.emoji");
  });

  it("a book asked for by Our books opens once through the parent door (never in Kid Mode)", () => {
    expect(HERO).toMatch(/if \(isKidModeActive\(\)\) return;\s*const requested = consumeStoryOpen\(\);/);
    expect(HERO).toContain("if (story && storyHasLanguage(story, storyLang)) void startJourney(story);");
  });
});

describe("#/comics — Our books leads, the meter is gone, nothing is gated", () => {
  it("Our books lists the library (language + age view) on StoryCards and opens the Stories reader", () => {
    expect(COMICS).toContain("const ourBooks = storiesForLanguage(HERO_STORIES, storyLang).filter(");
    expect(COMICS).toContain('<StoryCard key={story.id} story={story} lang={uiLang === "he" ? "he" : "en"} theme={kidTheme} onOpen={() => openStory(story.id)} />');
    expect(COMICS).toMatch(/requestStoryOpen\(storyId\);\s*nav\("stories"\);/);
    expect(COMICS).toContain('t("elev.comics.ourBooks.title")');
  });

  it("the saved comics stay listed below it with the one open-comic stamp", () => {
    expect(COMICS).toContain('data-module="comics-shelf" data-primary-move="open-comic"');
    expect(COMICS.indexOf("{ourBooksSection}", COMICS.indexOf("── Bookshelf view"))).toBeLessThan(COMICS.indexOf('data-module="comics-shelf"'));
  });

  it("no completion meter: the 'n of total books on the shelf' line is gone", () => {
    expect(COMICS).not.toMatch(/ of \$\{shelfTotal\} books on the shelf|מתוך \$\{shelfTotal\}/);
    expect(COMICS).not.toContain("comics-shelf-summary");
    // NEGATIVE CONTROL: the pre-fix line is what the rule rejects
    expect("`${savedCount} of ${shelfTotal} books on the shelf`").toMatch(/ of \$\{shelfTotal\} books on the shelf/);
  });

  it("a family with no hero gets the hero card AND the whole library", () => {
    const noHero = COMICS.slice(COMICS.indexOf("if (!hasHero)"), COMICS.indexOf("const openAdventure"));
    expect(noHero).toContain("setHeroDialogOpen(true)");
    expect(noHero).toContain("{ourBooksSection}");
  });

  it("the Our books title is keyed EN + HE", () => {
    expect(translate("en", "elev.comics.ourBooks.title")).toBe("Our books");
    expect(translate("he", "elev.comics.ourBooks.title")).not.toMatch(/[A-Za-z]/);
  });
});

describe("storyOpenRequest — one-shot", () => {
  it("a request is read once", () => {
    requestStoryOpen("noahs-ark");
    expect(consumeStoryOpen()).toBe("noahs-ark");
    expect(consumeStoryOpen()).toBeNull();
  });
});

describe("B-KID-81 (KB-14) — one story card, one pack table, no dead story state", () => {
  it("the per-file pack/emoji tables are gone: HeroJourneyTab and ComicsTab read the ONE module", () => {
    for (const [name, src] of [["HeroJourneyTab", HERO], ["ComicsTab", COMICS]] as const) {
      expect(src, name).not.toMatch(/const (PACK_WORLD|PACK_SOFT|STORY_ART|STORY_EMOJI)\b/);
      expect(src, name).toMatch(/import \{[^}]*STORY_PACK_LABEL[^}]*STORY_PACK_SOFT[^}]*\} from "\.\.\/stories\/StoryCard";/);
    }
    // No emoji motif left on either parent story surface's cards.
    expect(COMICS).not.toMatch(/\{emoji\}|art\.emoji/);
    expect(HERO).not.toMatch(/art\.emoji|STORY_ART\[/);
  });

  it("the never-set resting state is gone (it could only ever render false)", () => {
    expect(HERO).not.toMatch(/storyResting/);
  });

  it("one catalogue per register: the parent grid is StoryCard, the kid grid is KidLibrary", () => {
    expect((HERO.match(/<StoryCard\b/g) || []).length).toBe(1);
    expect((HERO.match(/<KidLibrary\b/g) || []).length).toBe(1);
    expect((COMICS.match(/<StoryCard\b/g) || []).length).toBe(1);
  });
});
