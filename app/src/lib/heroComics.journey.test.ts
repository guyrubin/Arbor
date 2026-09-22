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

import { ADVENTURES, STORY_COMIC, JourneyPageFailedBeforeError, _resetJourneyPageFailures, clearJourneyPageFailure, generateJourneyPage, getAdventure, hasJourneyPageFailed, journeyAdventure, journeyPageKey, type JourneyPageArgs } from "./heroComics";
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
  _resetJourneyPageFailures();
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

  // R2 (22 Sep 2026) — DELIBERATE CONTRACT CHANGE. A failure is still never
  // cached AS A PAGE, so a Redraw regenerates. What changed is that the retry
  // must be ASKED for: an automatic re-request on the next mount was paying for
  // the same smudged page on every page turn (critic M2 round 1, P2).
  it("a failed page is not cached, so a Redraw request calls the provider again", async () => {
    generateComic.mockRejectedValueOnce(new Error("503 busy")).mockResolvedValueOnce({ dataUrl: "data:image/png;base64,UEFHRQ==" });
    await expect(generateJourneyPage(args())).rejects.toThrow(/busy/);
    clearJourneyPageFailure(journeyPageKey(args())); // the child taps Redraw
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

/**
 * R2 (critic M2 round 1, P2) — a smudged page cost money on every page turn.
 *
 * The reader remounts a beat whenever the child turns back or forward, and the
 * art effect re-requested a key that had just failed: `pageIndex:1` was logged
 * FOUR times in one sitting. A failed key is now remembered for the session at
 * the spend seam, so the remount re-renders the smudged page for free and only
 * an explicit Redraw pays again.
 */
describe("a page that failed is bought once, not once per page turn", () => {
  it("two mounts, one failure, ONE provider call", async () => {
    generateComic.mockRejectedValue(new Error("provider 503"));
    const a = args();

    // mount 1 — the page is requested and fails
    await expect(generateJourneyPage(a)).rejects.toThrow("provider 503");
    expect(generateComic).toHaveBeenCalledTimes(1);
    expect(hasJourneyPageFailed(journeyPageKey(a))).toBe(true);

    // mount 2 (Back then Next) — the same key is NOT requested again
    await expect(generateJourneyPage(a)).rejects.toBeInstanceOf(JourneyPageFailedBeforeError);
    expect(generateComic).toHaveBeenCalledTimes(1);

    // …and a third turn is still free
    await expect(generateJourneyPage(a)).rejects.toBeInstanceOf(JourneyPageFailedBeforeError);
    expect(generateComic).toHaveBeenCalledTimes(1);
  });

  it("Redraw is the one thing that buys another attempt", async () => {
    generateComic.mockRejectedValue(new Error("provider 503"));
    const a = args();
    await expect(generateJourneyPage(a)).rejects.toThrow("provider 503");
    expect(generateComic).toHaveBeenCalledTimes(1);

    clearJourneyPageFailure(journeyPageKey(a)); // the child taps Redraw
    expect(hasJourneyPageFailed(journeyPageKey(a))).toBe(false);
    generateComic.mockResolvedValue({ dataUrl: "data:image/png;base64,UEFHRQ==" });
    const { url } = await generateJourneyPage(a);
    expect(url).toBe("data:image/png;base64,UEFHRQ==");
    expect(generateComic).toHaveBeenCalledTimes(2);

    // the page is cached now, so turning back to it is free again
    await generateJourneyPage(a);
    expect(generateComic).toHaveBeenCalledTimes(2);
  });

  it("the guard is per PAGE — a sibling beat is unaffected", async () => {
    generateComic.mockRejectedValue(new Error("provider 503"));
    await expect(generateJourneyPage(args({ pageIndex: 1 }))).rejects.toThrow("provider 503");
    generateComic.mockResolvedValue({ dataUrl: "data:image/png;base64,UEFHRQ==" });
    const two = await generateJourneyPage(args({ pageIndex: 2, theme: "the gate opens" }));
    expect(two.url).toBe("data:image/png;base64,UEFHRQ==");
    expect(generateComic).toHaveBeenCalledTimes(2);
    // the failed sibling is still remembered
    expect(hasJourneyPageFailed(journeyPageKey(args({ pageIndex: 1 })))).toBe(true);
  });

  it("is session-scoped: a fresh session may try the page again", async () => {
    generateComic.mockRejectedValue(new Error("provider 503"));
    const a = args();
    await expect(generateJourneyPage(a)).rejects.toThrow("provider 503");
    _resetJourneyPageFailures(); // a new session starts with a clean set
    generateComic.mockResolvedValue({ dataUrl: "data:image/png;base64,UEFHRQ==" });
    await generateJourneyPage(a);
    expect(generateComic).toHaveBeenCalledTimes(2);
  });

  it("NEGATIVE CONTROL: without the guard the same key is requested on every mount", async () => {
    generateComic.mockRejectedValue(new Error("provider 503"));
    const a = args();
    for (let mount = 0; mount < 3; mount++) {
      clearJourneyPageFailure(journeyPageKey(a)); // simulates the pre-fix effect
      await expect(generateJourneyPage(a)).rejects.toThrow("provider 503");
    }
    expect(generateComic).toHaveBeenCalledTimes(3); // what the critic measured
  });
});
