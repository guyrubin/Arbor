import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * G2 (22 Sep 2026) — every Hero Story read with a hero is a comic.
 *
 * Functional tier: journey pages go through the same device-local pipeline as
 * book pages (memory cache → IndexedDB → ONE provider call → write-through),
 * are keyed as `journey` requests so they never collide with parent-built
 * books, and a cover is a distinct page. Catalog stories without authored
 * viral copy still resolve to an Adventure so their saved books can open.
 */

const generateComic = vi.fn();
vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  api: { generateComic: (...a: unknown[]) => generateComic(...a) },
}));

import { ADVENTURES, STORY_COMIC, generateJourneyPage, getAdventure, journeyAdventure, journeyPageKey, type JourneyPageArgs } from "./heroComics";
import { HERO_STORIES } from "./heroJourneys";
import { _resetSceneCache } from "./sceneCache";
import { _resetComicPageStore, _setComicPageBackend, type ComicPageBackend, type ComicPageRecord } from "./comicPageStore";

const CHILD = "child-1";
const HERO = "data:image/png;base64,QUJD";

function memBackend() {
  const map = new Map<string, ComicPageRecord>();
  const backend: ComicPageBackend = {
    async get(key) { return map.get(key); },
    async has(key) { return map.has(key); },
    async put(rec) { map.set(rec.key, { ...rec }); },
    async delete(key) { map.delete(key); },
    async getAll() { return [...map.values()]; },
    async clear() { map.clear(); },
  };
  return { map, backend };
}

const args = (over: Partial<JourneyPageArgs> = {}): JourneyPageArgs => ({
  storyId: "the-lantern-path",
  lang: "en",
  heroName: "Mia",
  heroDataUrl: HERO,
  style: "storybook",
  childId: CHILD,
  childIdentity: CHILD,
  pageIndex: 1,
  theme: "the hero lifts a lantern at the gate",
  dialogue: "Let's light the way!",
  sfx: ["GLOW!"],
  ...over,
});

let mem: ReturnType<typeof memBackend>;
beforeEach(() => {
  mem = memBackend();
  _resetComicPageStore(); // forgets the backend — inject ours AFTER the reset
  _setComicPageBackend(mem.backend);
  _resetSceneCache();
  generateComic.mockReset();
});
afterEach(() => { _setComicPageBackend(null); });

describe("journey pages — one pipeline, keyed apart from books", () => {
  it("a fresh page makes ONE provider call, returns its key, and writes through to the child's device store", async () => {
    generateComic.mockResolvedValue({ dataUrl: "data:image/png;base64,UEFHRQ==" });
    const a = args();
    const { key, url } = await generateJourneyPage(a);
    expect(url).toBe("data:image/png;base64,UEFHRQ==");
    expect(key).toBe(journeyPageKey(a));
    expect(key.startsWith("comic4|journey|")).toBe(true);
    expect(generateComic).toHaveBeenCalledTimes(1);
    expect(generateComic.mock.calls[0][0]).toMatchObject({ avatar: { dataUrl: HERO }, heroName: "Mia", theme: a.theme, dialogue: a.dialogue, sfx: ["GLOW!"], style: "storybook", pageIndex: 1 });
    await new Promise((r) => setTimeout(r, 0));
    const stored = [...mem.map.values()].find((rec) => rec.key === `${CHILD}|${key}`);
    expect(stored?.dataUrl).toBe(url);
  });

  it("re-reading the same page never re-pays the provider (memory, then the device store)", async () => {
    generateComic.mockResolvedValue({ dataUrl: "data:image/png;base64,UEFHRQ==" });
    await generateJourneyPage(args());
    await generateJourneyPage(args());
    expect(generateComic).toHaveBeenCalledTimes(1);
    // A new session: memory cache gone, device store still holds the page.
    _resetSceneCache();
    await new Promise((r) => setTimeout(r, 0));
    const again = await generateJourneyPage(args());
    expect(again.url).toBe("data:image/png;base64,UEFHRQ==");
    expect(generateComic).toHaveBeenCalledTimes(1);
  });

  it("the cover is its own page: cover flag and index change the key, and the request carries the title with no bubble", async () => {
    generateComic.mockResolvedValue({ dataUrl: "data:image/png;base64,Q09WRVI=" });
    const cover = args({ pageIndex: 0, cover: true, title: "The Lantern Path", theme: "The Lantern Path — a lantern-lit path", dialogue: undefined, sfx: [] });
    expect(journeyPageKey(cover)).not.toBe(journeyPageKey(args()));
    await generateJourneyPage(cover);
    const payload = generateComic.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.cover).toBe(true);
    expect(payload.title).toBe("The Lantern Path");
    expect("dialogue" in payload).toBe(false);
  });

  it("a journey page and a parent-built book page for the same story never share a key", () => {
    const journey = journeyPageKey(args({ storyId: ADVENTURES[0].id }));
    expect(journey.split("|")[1]).toBe("journey");
    expect(journey).not.toContain("|book|");
  });

  it("a failed page is not cached, so a Redraw request calls the provider again", async () => {
    generateComic.mockRejectedValueOnce(new Error("503 busy")).mockResolvedValueOnce({ dataUrl: "data:image/png;base64,UEFHRQ==" });
    await expect(generateJourneyPage(args())).rejects.toThrow(/busy/);
    const { url } = await generateJourneyPage(args());
    expect(url).toBe("data:image/png;base64,UEFHRQ==");
    expect(generateComic).toHaveBeenCalledTimes(2);
  });
});

describe("every catalog story can be shelved", () => {
  it("a story without authored viral copy still resolves to an Adventure from its own spec", () => {
    const uncovered = HERO_STORIES.find((s) => !STORY_COMIC[s.id]);
    expect(uncovered, "the catalog has at least one story without STORY_COMIC copy").toBeTruthy();
    const adventure = getAdventure(uncovered!.id);
    expect(adventure?.id).toBe(uncovered!.id);
    expect(adventure?.title).toBe(uncovered!.title);
    expect(adventure?.copy.theme).toBe(uncovered!.theme);
    expect(adventure?.copy.dialogue).toBe("");
    expect(journeyAdventure("not-a-story")).toBeUndefined();
  });

  it("authored adventures keep their viral copy (the fallback never shadows them)", () => {
    const authored = ADVENTURES[0];
    expect(getAdventure(authored.id)?.copy).toBe(authored.copy);
  });
});
