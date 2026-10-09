/**
 * B-PLAY-12 — the Stories library merges into the Comics shelf (hero-less
 * stories included). Guard over the shelf model (lib/storyShelf) plus the
 * seams the rendered shelf depends on.
 *
 * Law (6): nothing a parent could reach before becomes unreachable — every run
 * the #/stories "Your library" module listed appears on #/comics: as its
 * read-along comic when the shelf shows that comic, otherwise as a text book.
 * Fixture: 3 runs, 1 with a comic, 2 without.
 */
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { libraryRuns, runComicDocId, storyShelfTextBooks } from "./storyShelf";
import { savedComicDocId, shelfBooks, type SavedComicMeta } from "./heroComics";
import { getStorySpec } from "./heroJourneys";
import { translate, type UiLang } from "./i18n";
import type { HeroJourneyRender, HeroJourneyRun } from "../types";

const harness = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../context/LanguageContext", () => ({
  useLanguage: () => ({ uiLang: harness.lang, t: (k: string, v?: Record<string, string | number>) => translate(harness.lang as UiLang, k, v) }),
}));
import StoryTextReader, { storyTextPages } from "../components/stories/StoryTextReader";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");
const strip = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const render = (storyId: string, title: string): HeroJourneyRender => ({
  storyId,
  title,
  scenes: [],
  choices: [],
  reflection: { practiced: [], questions: [] },
});
const run = (id: string, storyId: string, at: { completedAt?: string; startedAt: string }, extra: Partial<HeroJourneyRun> = {}): HeroJourneyRun => ({
  id,
  storyId,
  title: storyId,
  language: "en",
  startedAt: at.startedAt,
  ...(at.completedAt ? { completedAt: at.completedAt } : {}),
  render: render(storyId, storyId),
  ...extra,
});

// 3 runs: A has a read-along comic on the shelf; B (finished) and C (in progress) have none.
const A = run("run-a", "noahs-ark", { startedAt: "2026-10-01T18:00:00.000Z", completedAt: "2026-10-01T18:20:00.000Z" });
const B = run("run-b", "david-and-goliath", { startedAt: "2026-10-05T18:00:00.000Z", completedAt: "2026-10-05T18:25:00.000Z" });
const C = run("run-c", "the-lion-who-was-afraid", { startedAt: "2026-10-07T18:00:00.000Z" });
const RUNS = [A, B, C];
const COMIC_A: SavedComicMeta = {
  id: savedComicDocId("noahs-ark", "journey"),
  adventureId: "noahs-ark",
  title: "Noah's Ark",
  lang: "en",
  createdAt: "2026-10-01T18:21:00.000Z",
  kind: "journey",
};
const tellable = () => true;

describe("B-PLAY-12 · the shelf model (fixture: 3 runs, 1 with a comic, 2 without)", () => {
  it("the fixture's stories are real catalogue stories", () => {
    for (const r of RUNS) expect(getStorySpec(r.storyId), r.storyId).toBeTruthy();
  });

  it("text books = the two runs with no comic, newest first (completedAt, else startedAt)", () => {
    const books = storyShelfTextBooks({ runs: RUNS, savedComics: [COMIC_A], tellable });
    expect(books.map((r) => r.id)).toEqual(["run-c", "run-b"]);
  });

  it("LAW: every run the Stories library listed appears on #/comics — as its comic or as a text book", () => {
    const input = { runs: RUNS, savedComics: [COMIC_A], tellable };
    const comicsOnShelf = new Set(shelfBooks(input.savedComics).extra.map((b) => b.id));
    const textBooks = new Set(storyShelfTextBooks(input).map((r) => r.id));
    const library = libraryRuns(input);
    expect(library).toHaveLength(3);
    for (const r of library) {
      const comic = runComicDocId(r, input);
      const reachable = (comic !== null && comicsOnShelf.has(comic)) || textBooks.has(r.id);
      expect(reachable, `${r.id} is unreachable on #/comics`).toBe(true);
    }
    // ... and no run is listed twice.
    expect(runComicDocId(A, input)).toBe(COMIC_A.id);
    expect(textBooks.has("run-a")).toBe(false);
  });

  it("no hero: the shelf draws no comic tiles, so every run is a text book", () => {
    const books = storyShelfTextBooks({ runs: RUNS, savedComics: [COMIC_A], tellable, comicShown: () => false });
    expect(books.map((r) => r.id)).toEqual(["run-c", "run-b", "run-a"]);
  });

  it("a comic whose pages this device has confirmed gone gives its run back as a text book", () => {
    const books = storyShelfTextBooks({ runs: RUNS, savedComics: [COMIC_A], tellable, comicShown: (id) => id !== COMIC_A.id });
    expect(books.map((r) => r.id)).toContain("run-a");
  });

  it("a parent-built book for the same story is a different book: it never stands in for the run", () => {
    const built: SavedComicMeta = { ...COMIC_A, id: "noahs-ark", kind: "book" };
    expect(storyShelfTextBooks({ runs: RUNS, savedComics: [built], tellable }).map((r) => r.id)).toContain("run-a");
  });

  it("keeps the Stories library's language filter (parity: what was listed there is listed here)", () => {
    const books = storyShelfTextBooks({ runs: RUNS, savedComics: [], tellable: (id) => id !== "david-and-goliath" });
    expect(books.map((r) => r.id)).toEqual(["run-c", "run-a"]);
  });

  it("negative control: the naive move (comics only) leaves the two comic-less runs unreachable", () => {
    const comicsOnly = new Set(shelfBooks([COMIC_A]).extra.map((b) => b.adventureId));
    const lost = RUNS.filter((r) => !comicsOnly.has(r.storyId));
    expect(lost.map((r) => r.id)).toEqual(["run-b", "run-c"]);
  });
});

describe("B-PLAY-12 · the surfaces", () => {
  const HERO = strip(read("components/tabs/HeroJourneyTab.tsx"));
  const COMICS = strip(read("components/tabs/ComicsTab.tsx"));

  it("#/stories no longer carries the library module or its run replay", () => {
    expect(HERO).not.toContain('data-module="stories-library"');
    expect(HERO).not.toContain("replay(run)");
    expect(HERO).not.toContain("shelfRuns");
  });

  it("#/comics lists the text books in BOTH branches — inside the comic shelf, and for a family with no hero", () => {
    expect(COMICS).toContain("comicShown: (docId) => hasHero && shownJourneyIds.has(docId) && scopedCached[docId] !== false,");
    expect((COMICS.match(/\{storyBooks\.map\(storyBookTile\)\}/g) ?? []).length).toBe(2);
    const noHero = COMICS.slice(COMICS.indexOf("if (!hasHero)"), COMICS.indexOf("const openAdventure"));
    expect(noHero).toContain("{storyBooks.map(storyBookTile)}");
    const shelf = COMICS.slice(COMICS.indexOf('data-module="comics-shelf"'));
    expect(shelf).toContain("{storyBooks.map(storyBookTile)}");
    // The reread opens in place, before either branch.
    expect(COMICS.indexOf("if (openRun)")).toBeGreaterThan(-1);
    expect(COMICS.indexOf("if (openRun)")).toBeLessThan(COMICS.indexOf("if (!hasHero)"));
    expect(COMICS).toContain("<StoryTextReader");
  });

  it("a text book's tile: title, date (or In progress), Read the story — 44 px is the whole cover button", () => {
    const tile = COMICS.slice(COMICS.indexOf("const storyBookTile"), COMICS.indexOf("if (openRun)"));
    expect(tile.length).toBeGreaterThan(200);
    expect(tile).toContain("runTitle(run,");
    expect(tile).toContain('run.completedAt ? fmtDay(run.completedAt, uiLang) : t("elev.comics.storyBook.inProgress")');
    expect(tile).toContain('t("elev.comics.storyBook.read")');
    expect(tile).toContain('className="absolute inset-0 grid place-items-center"');
    expect(tile).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("the reader makes no model call and writes nothing", () => {
    const reader = strip(read("components/stories/StoryTextReader.tsx"));
    expect(reader).not.toMatch(/\bapi\.|fetch\(|generate|upsert|useChildCollection/);
  });
});

describe("B-PLAY-12 · the inline reader", () => {
  const spec = getStorySpec("david-and-goliath")!;
  const reread = run("run-b", "david-and-goliath", { startedAt: B.startedAt, completedAt: B.completedAt }, { choiceId: "c" });

  it("reads every page in spine order; the consequence page carries the chosen consequence", () => {
    const { pages, choiceLabel } = storyTextPages(reread, { name: "Dana", gender: "girl" });
    expect(pages.map((p) => p.beatId)).toEqual(spec.beats.map((b) => b.id));
    expect(choiceLabel).toBeTruthy();
    const chosen = spec.beats.find((b) => b.id === "decision")!.choices!.find((c) => c.id === "c")!;
    expect(pages.find((p) => p.beatId === "consequence")!.narration).not.toBe("");
    expect(choiceLabel).toContain(chosen.label.split(" ")[0]);
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: renders the run's words with Back, the choice line and the date — UI copy keyed`, () => {
      harness.lang = lang;
      const html = renderToStaticMarkup(<StoryTextReader run={reread} hero={{ name: "Dana" }} onBack={() => {}} />);
      expect(html).toContain('data-testid="story-text-reader"');
      expect((html.match(/data-testid="story-text-page"/g) ?? []).length).toBe(spec.beats.length);
      expect(html).toContain('data-testid="story-text-choice"');
      expect(html).toContain(translate(lang, "elev.comics.storyBook.back"));
      expect(html).toContain(translate(lang, "elev.comics.storyBook.choice"));
      // The story's own language drives the text direction, not the UI's.
      expect(html).toMatch(/<ol[^>]*lang="en"[^>]*dir="ltr"/);
      expect(html).toMatch(/data-testid="story-text-reader-back"[^>]*class="[^"]*min-h-11/);
    });
  }

  it("every new string is EN + HE, and the Hebrew is not the English", () => {
    for (const k of [
      "elev.comics.storyBooks.title",
      "elev.comics.storyBook.read",
      "elev.comics.storyBook.readAria",
      "elev.comics.storyBook.chip",
      "elev.comics.storyBook.inProgress",
      "elev.comics.storyBook.back",
      "elev.comics.storyBook.choice",
    ]) {
      expect(translate("en", k), k).not.toBe(k);
      expect(translate("he", k), k).not.toBe(translate("en", k));
      expect(translate("he", k, { title: "x" }).replace("x", ""), k).not.toMatch(/[A-Za-z]/);
    }
  });
});
