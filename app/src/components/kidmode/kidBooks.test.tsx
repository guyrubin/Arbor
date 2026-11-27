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
import { kidBooks, kidShelfFor } from "./kidBooks";
import { pickTonightsStory } from "./tonightsStory";
import { fiveSmoothStones } from "../../lib/library/books/fiveSmoothStones";
import { KidBookCover, KidBookTitleCard } from "./KidBookCover";
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

  it("B-BOOK-51: orders opened books by actual instants across timezone offsets", () => {
    const books = kidBooks({
      lang: "en", ageMonths: null, showAllAges: true, hasCover: () => true,
      nowMs: Date.parse("2026-11-17T08:00:00Z"),
      runs: [
        // Textual 08:00 is actually earlier than 07:00 UTC.
        { storyId: "noahs-ark", startedAt: "2026-11-01T08:00:00+02:00" },
        { storyId: "jonah-and-the-great-fish", startedAt: "2026-11-01T07:00:00Z" },
      ],
    });
    expect(books.slice(0, 2).map(b => b.story.id)).toEqual(["jonah-and-the-great-fish", "noahs-ark"]);
  });

  it("B-BOOK-51: imported invalid and future timestamps neither displace books nor invent completion", () => {
    const books = kidBooks({
      lang: "en", ageMonths: null, showAllAges: true, hasCover: () => true,
      nowMs: Date.parse("2026-11-17T08:00:00Z"),
      runs: [
        { storyId: "noahs-ark", completedAt: "2099-01-01T00:00:00Z" },
        { storyId: "jonah-and-the-great-fish", startedAt: "broken" },
        { storyId: "joseph-and-his-brothers", startedAt: "2026-11-16T11:00:00Z", completedAt: "not-a-date" },
        { storyId: "moses-and-pharaoh", completedAt: "2026-11-16T10:00:00Z" },
      ],
    });
    expect(books.slice(0, 2).map(b => [b.story.id, b.state])).toEqual([
      ["joseph-and-his-brothers", "started"],
      ["moses-and-pharaoh", "finished"],
    ]);
    expect(books.find(b => b.story.id === "noahs-ark")?.state).toBe("new");
    expect(books.find(b => b.story.id === "jonah-and-the-great-fish")?.state).toBe("new");
  });

  it("B-BOOK-51: impossible civil dates cannot invent completion or displace valid history", () => {
    const books = kidBooks({
      lang: "en", ageMonths: null, showAllAges: true, hasCover: () => true,
      nowMs: Date.parse("2026-11-17T08:00:00Z"),
      runs: [
        // JavaScript Date.parse normalizes these to March 2 and May 1.
        { storyId: "noahs-ark", completedAt: "2026-02-30T12:00:00Z" },
        { storyId: "jonah-and-the-great-fish", completedAt: "2026-04-31T12:00:00+02:00" },
        // 2026 is not a leap year; a valid opening remains just started.
        { storyId: "joseph-and-his-brothers", startedAt: "2026-02-28T12:00:00Z", completedAt: "2026-02-29T12:00:00Z" },
        // 2024 is a leap year, and offset conversion must still work.
        { storyId: "moses-and-pharaoh", completedAt: "2024-02-29T12:00:00+02:00" },
        { storyId: "jacob-wrestling-the-angel", startedAt: "2026-11-16T15:00:00-02:00" },
        { storyId: "david-and-goliath", completedAt: "2026-11-16T24:00:00Z" },
      ],
    });
    expect(books.slice(0, 3).map(b => [b.story.id, b.state])).toEqual([
      ["jacob-wrestling-the-angel", "started"],
      ["joseph-and-his-brothers", "started"],
      ["moses-and-pharaoh", "finished"],
    ]);
    for (const id of ["noahs-ark", "jonah-and-the-great-fish", "david-and-goliath"]) {
      expect(books.find(b => b.story.id === id)?.state, id).toBe("new");
    }
  });

  it("B-BOOK-51: later rereading never removes genuine prior completion", () => {
    const books = kidBooks({
      lang: "en", ageMonths: null, showAllAges: true, hasCover: () => true,
      nowMs: Date.parse("2026-11-17T08:00:00Z"),
      runs: [
        { storyId: "noahs-ark", completedAt: "2026-11-11T10:00:00Z" },
        { storyId: "noahs-ark", startedAt: "2026-11-16T10:00:00Z" },
      ],
    });
    expect(books[0]).toMatchObject({ story: { id: "noahs-ark" }, state: "finished" });
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
    // B-BOOK-31 re-pin: a hero-free cover (the storybook plate) is the covered case.
    const html = renderToStaticMarkup(<KidBookCover {...base} theme="storybook" storyId="the-lantern-path" layout="grid" />);
    expect(html).toContain("<img");
    expect(html).toContain("lantern-path-v1");
    // B-KID-122 re-pin: the title card is the loading placeholder UNDER the image (before it in the DOM).
    expect(html.indexOf("data-kid-book-titlecard")).toBeGreaterThan(-1);
    expect(html.indexOf("data-kid-book-titlecard")).toBeLessThan(html.indexOf("<img"));
  });

  it("B-KID-122: first-row covers load eagerly; the rest lazy; the picture fades in over a sized slot", () => {
    const eager = renderToStaticMarkup(<KidBookCover {...base} theme="storybook" storyId="the-lantern-path" title="Noah's Ark" layout="row" eager />);
    const lazy = renderToStaticMarkup(<KidBookCover {...base} theme="storybook" storyId="the-lantern-path" title="Noah's Ark" layout="row" />);
    expect(eager).toMatch(/<img[^>]*loading="eager"/);
    expect(lazy).toMatch(/<img[^>]*loading="lazy"/);
    expect(eager).toMatch(/<img[^>]*width="\d+"[^>]*height="\d+"/);
    expect(eager).toContain("aspect-ratio:3 / 4");
    expect(eager).toMatch(/<img[^>]*data-kid-book-img="pending"[^>]*opacity:0/);
    expect(eager).toContain("motion-reduce:transition-none");
    expect(eager).toContain("Noah&#x27;s Ark");
  });

  it("B-BOOK-31: a cover that paints the reference family's child is never another child's cover — the book keeps its complete title card", () => {
    for (const id of HERO_STORIES.map((x) => x.id)) {
      const painted = kidArt("film3d", storyCoverKey(id));
      if (!painted?.hasHero) continue;
      const html = renderToStaticMarkup(<KidBookCover {...base} storyId={id} title="A book" layout="grid" />);
      expect(html, id).not.toContain("/visuals/cards/");
      // B-KID-172 re-pin: never blank paper — the one picture is the kit's hero-free reading room.
      const srcs = [...html.matchAll(/<img[^>]*src="([^"]+)"/g)].map((m) => m[1]);
      expect(srcs, id).toEqual([kidArt("film3d", "studio.portal.stories")!.src480]);
      expect(kidArt("film3d", "studio.portal.stories")!.hasHero).toBe(false);
      expect(html, id).toContain("data-kid-book-fallback-art");
      expect(html, id).toContain("data-kid-book-titlecard");
      expect(html, id).toContain("A book");
    }
  });

  it("B-BOOK-26: a title-card cover carries the child's OWN portrait (the caller's HeroAvatar); a hero-less child keeps the plain complete card", () => {
    const own = <img data-own="" src="data:image/png;base64,T1dO" alt="" />;
    const withHero = renderToStaticMarkup(<KidBookCover {...base} storyId="noahs-ark" title="A book" layout="grid" hero={own} />);
    expect(withHero).toContain("data-kid-book-own-hero");
    expect(withHero).toContain("data-own");
    expect(withHero).toContain("data-kid-book-titlecard");
    const heroless = renderToStaticMarkup(<KidBookCover {...base} storyId="noahs-ark" title="A book" layout="grid" />);
    expect(heroless).not.toContain("data-kid-book-own-hero");
    // a hero-free picture cover needs no sticker
    expect(renderToStaticMarkup(<KidBookCover {...base} theme="storybook" storyId="the-lantern-path" layout="grid" hero={own} />)).not.toContain("data-kid-book-own-hero");
    const lib = readFileSync(path.join(__dirname, "KidLibrary.tsx"), "utf8");
    expect(lib).toContain("const ownHero = resolveHeroUrl(childProfile) ? <HeroAvatar");
    expect(lib).toContain("hero={ownHero}");
    // T7: the portrait on a cover carries no star badge
    expect(lib).toMatch(/<HeroAvatar size=\{40\}[^>]*badge=\{false\}/);
  });

  it("B-BOOK-26 (critic r1 P1): the legacy reader's cover is the same composition scaled — the title card with the child's large own portrait, the title once", () => {
    const own = <img data-own="" src="data:image/png;base64,T1dO" alt="" />;
    const big = renderToStaticMarkup(<span style={{ position: "relative", display: "block", width: 350, height: 466 }}><KidBookTitleCard title="Noah's Ark" pack="courage" hero={own} heroSize={162} titleSize={28} /></span>);
    expect(big).toContain("data-kid-book-own-hero");
    expect(big).toMatch(/inline-size:162px;block-size:162px/);
    expect(big).toContain("font-size:28px");
    expect(big.match(/Noah&#x27;s Ark/g)).toHaveLength(1);
    const tab = readFileSync(path.join(__dirname, "..", "tabs", "HeroJourneyTab.tsx"), "utf8");
    expect(tab).toContain("const coverHero = heroAvatarUrl ? <HeroAvatar size={150} mood=\"wave\" animate={false} ring={false} badge={false} decorative /> : undefined;");
    // B-KID-172 re-pin: the reader's cover stands on the same kit picture as the shelf tile.
    expect(tab).toMatch(/<KidBookTitleCard title=\{[^}]+\}[^>]*hero=\{coverHero\} heroSize=\{162\} titleSize=\{28\} theme=\{kidTheme\} \/>/);
    // The fallback title is visible on the card normally, and on the facing
    // page in short landscape, where the fixed-size portrait hid its words.
    expect(big).toContain('data-kid-book-card-title=""');
    expect(tab).toContain('data-kid-book-fallback-title={!bookArt ? "" : undefined}');
    const css = readFileSync(path.join(__dirname, "..", "stories", "legacyBook.css"), "utf8");
    expect(css).toContain('[data-kid-book-fallback-title] { display: none; }');
    const sideways = css.slice(css.indexOf('@media (min-width: 640px) and (max-height: 520px)'));
    expect(sideways).toContain('[data-kid-book-cover] [data-kid-book-card-title] { display: none !important; }');
    expect(sideways).toContain('[data-kid-book-cover] [data-kid-book-fallback-title] { display: block; }');
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
    // B-KID-172 re-pin: the theme's own kit picture (its Stories door), never another theme's file.
    const srcs = [...html.matchAll(/<img[^>]*src="([^"]+)"/g)].map((m) => m[1]);
    expect(srcs).toEqual([kidArt("storybook", "studio.portal.stories")!.src480]);
    expect(html).not.toContain("/visuals/cards/");
    expect(html).not.toMatch(EMOJI);
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(html).toContain('data-pack="courage"');
    expect(html).toContain("var(--studio-pearl)");
    expect(html).not.toContain("var(--comic-line)");
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
    const titleCard = html.match(/<span[^>]*data-kid-book-titlecard=""[^>]*>/)?.[0];
    expect(titleCard).toContain('aria-hidden="true"');
    expect((html.match(/The Lantern Path/g) ?? []).length).toBe(2);
  });
});

describe("B-KID-85 — the kid library is a cover grid in the kid register", () => {
  // code only (the header comment names what was removed)
  const lib = readFileSync(path.join(__dirname, "KidLibrary.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const tab = readFileSync(path.join(__dirname, "..", "tabs", "HeroJourneyTab.tsx"), "utf8");
  const kidBranch = tab.slice(tab.indexOf("    return kidMode ? ("), tab.indexOf("    ) : (\n      <DsRoot composition={composition} className=\"ds-mychild stories-v10\""));

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
    const parent = tab.slice(tab.indexOf("    ) : (\n      <DsRoot composition={composition} className=\"ds-mychild stories-v10\""));
    expect(parent).toContain("setPackFilter");
    expect(parent).toContain("agefilter-toggle-hero-journeys");
  });
});

describe("K2: one David book per child", () => {
  const withBook = kidShelfFor([{ book: fiveSmoothStones }]);
  it("a child who has Five Smooth Stones no longer has the legacy David story; a child without it keeps it", () => {
    expect(fiveSmoothStones.replacesStory).toBe("david-and-goliath");
    expect(KID_SHELF_STORIES.some((s) => s.id === "david-and-goliath")).toBe(true);
    expect(withBook.some((s) => s.id === "david-and-goliath")).toBe(false);
    expect(withBook).toHaveLength(KID_SHELF_STORIES.length - 1);
    expect(kidShelfFor([])).toEqual(KID_SHELF_STORIES);
    const books = kidBooks({ lang: "en", ageMonths: 60, showAllAges: true, hasCover: () => true, runs: [{ storyId: "david-and-goliath", startedAt: "2026-10-01T18:00:00Z" }], stories: withBook });
    expect(books.some((b) => b.story.id === "david-and-goliath")).toBe(false);
    for (let d = 1; d <= 28; d++) {
      const day = `2026-10-${String(d).padStart(2, "0")}`;
      expect(pickTonightsStory(day, "kid1", { lang: "en", stories: withBook }).story?.id, day).not.toBe("david-and-goliath");
    }
  });

  it("the kid home and the kid story surface read the child's shelf for the list AND Tonight", () => {
    const dash = readFileSync(path.join(__dirname, "KidDashboard.tsx"), "utf8");
    expect(dash).toContain("const kidShelf = useMemo(() => kidShelfFor(libraryBooks), [libraryBooks]);");
    expect(dash.match(/stories: kidShelf,/g)).toHaveLength(2);
    const tab = readFileSync(path.join(__dirname, "..", "tabs", "HeroJourneyTab.tsx"), "utf8");
    expect(tab).toContain("const kidShelf = useMemo(() => kidShelfFor(libraryBooks), [libraryBooks]);");
    expect(tab).toContain("runs, stories: kidShelf })}");
    expect(tab).toMatch(/lang: storyLang,\s*stories: kidShelf,\s*\}\)/);
  });
});
