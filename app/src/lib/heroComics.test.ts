import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the API so buildComicBook/generatePage don't hit the network. Each test
// controls the resolver to exercise success, per-page failure, and dedupe.
// Real exports (PaywallError) are kept so `instanceof` checks stay meaningful.
const generateComic = vi.fn();
vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  api: { generateComic: (...a: unknown[]) => generateComic(...a) },
}));

import {
  ADVENTURES,
  getAdventure,
  adventureTitle,
  comicKey,
  avatarHash,
  clampPage,
  nextPageIndex,
  prevPageIndex,
  swipeToDelta,
  tapToDelta,
  planPages,
  buildComicBook,
  type ComicPageData,
} from "./heroComics";
import { PaywallError } from "./api";
import { _resetSceneCache } from "./sceneCache";

const adventure = ADVENTURES[0];

beforeEach(() => {
  generateComic.mockReset();
  // generatePage now persists results through the shared scene cache; clear it
  // between cases so each test regenerates from its own mocked resolver.
  _resetSceneCache();
});

describe("catalog", () => {
  it("exposes at least 6 adventures with bilingual titles", () => {
    expect(ADVENTURES.length).toBeGreaterThanOrEqual(6);
    for (const a of ADVENTURES) {
      expect(a.title).toBeTruthy();
      expect(a.titleHe).toBeTruthy();
    }
  });

  it("getAdventure + adventureTitle resolve and localize", () => {
    const a = getAdventure(adventure.id)!;
    expect(a).toBeDefined();
    expect(adventureTitle(a, "en")).toBe(a.title);
    expect(adventureTitle(a, "he")).toBe(a.titleHe);
  });
});

describe("page-turn math", () => {
  it("clamps to bounds and steps next/prev", () => {
    expect(clampPage(-3, 4)).toBe(0);
    expect(clampPage(9, 4)).toBe(3);
    expect(nextPageIndex(0, 4)).toBe(1);
    expect(nextPageIndex(3, 4)).toBe(3); // clamped at last
    expect(prevPageIndex(2, 4)).toBe(1);
    expect(prevPageIndex(0, 4)).toBe(0); // clamped at first
  });
});

describe("swipe + tap mapping (RTL inverts)", () => {
  it("ignores below-threshold and vertical-dominant drags (preserves edge-back)", () => {
    expect(swipeToDelta(20, 0, false)).toBe(0); // below threshold
    expect(swipeToDelta(80, 100, false)).toBe(0); // vertical dominates
  });

  it("LTR: swipe left advances, swipe right goes back", () => {
    expect(swipeToDelta(-80, 5, false)).toBe(1);
    expect(swipeToDelta(80, 5, false)).toBe(-1);
  });

  it("RTL: swipe right advances, swipe left goes back", () => {
    expect(swipeToDelta(80, 5, true)).toBe(1);
    expect(swipeToDelta(-80, 5, true)).toBe(-1);
  });

  it("tap zones: middle rests; right=next / left=prev (LTR), mirrored RTL", () => {
    expect(tapToDelta(0.5, false)).toBe(0);
    expect(tapToDelta(0.9, false)).toBe(1);
    expect(tapToDelta(0.1, false)).toBe(-1);
    // RTL mirror
    expect(tapToDelta(0.9, true)).toBe(-1);
    expect(tapToDelta(0.1, true)).toBe(1);
  });
});

describe("cache key", () => {
  it("is stable per (avatar, adventure, lang, page) and hashes data-URLs", () => {
    const url = "data:image/png;base64,AAAA";
    const k1 = comicKey(url, "story-a", "en", 1);
    const k2 = comicKey(avatarHash(url), "story-a", "en", 1);
    expect(k1).toBe(k2); // data-URL and pre-hashed token converge
    expect(comicKey(url, "story-a", "en", 1)).not.toBe(comicKey(url, "story-a", "en", 2));
    expect(comicKey(url, "story-a", "en", 1)).not.toBe(comicKey(url, "story-a", "he", 1));
    expect(comicKey(url, "story-a", "en", 1)).not.toBe(comicKey(url, "story-b", "en", 1));
  });
});

describe("planPages", () => {
  it("builds a cover + one page per beat", () => {
    const pages = planPages(adventure, "en", ["Beat A", "Beat B", "Beat C"]);
    expect(pages).toHaveLength(4);
    expect(pages[0].cover).toBe(true);
    expect(pages[0].index).toBe(0);
    expect(pages.slice(1).every((p) => !p.cover)).toBe(true);
    expect(pages[3].title).toBe("Beat C");
  });
});

describe("buildComicBook", () => {
  const pages = (): ComicPageData[] => planPages(adventure, "en", ["A", "B", "C"]);

  it("generates every page and reports each via onPage", async () => {
    generateComic.mockImplementation(async () => ({ dataUrl: "data:img" }));
    const seen: number[] = [];
    const out = await buildComicBook(adventure, "en", "Mia", "data:hero", pages(), { 1: "a", 2: "b", 3: "c" }, (p) => seen.push(p.index));
    expect(out.every((p) => p.status === "ready")).toBe(true);
    expect(out.every((p) => p.dataUrl === "data:img")).toBe(true);
    expect(seen).toEqual([0, 1, 2, 3]);
  });

  it("isolates a single failed page (others stay readable)", async () => {
    generateComic.mockImplementation(async (payload: { pageIndex?: number }) => {
      if (payload.pageIndex === 2) throw new Error("smudged");
      return { dataUrl: "data:img" };
    });
    const out = await buildComicBook(adventure, "en", "Mia", "data:hero", pages(), { 1: "a", 2: "b", 3: "c" }, () => {});
    expect(out[2].status).toBe("error");
    expect(out[2].dataUrl).toBeUndefined();
    // Every OTHER page resolved fine — one smudge never blocks the book.
    expect(out.filter((p) => p.status === "ready")).toHaveLength(3);
  });

  it("network-style error: page marked error, build continues to the end", async () => {
    generateComic.mockImplementation(async (payload: { pageIndex?: number }) => {
      if (payload.pageIndex === 1) throw new TypeError("Failed to fetch");
      return { dataUrl: "data:img" };
    });
    const seen: number[] = [];
    const out = await buildComicBook(adventure, "en", "Mia", "data:hero", pages(), { 1: "a", 2: "b", 3: "c" }, (p) => seen.push(p.index));
    expect(out[1].status).toBe("error");
    // Pages after the failure were still attempted and reported.
    expect(seen).toEqual([0, 1, 2, 3]);
    expect(generateComic).toHaveBeenCalledTimes(4);
  });

  it("PaywallError STOPS the build: typed rejection, no further generations", async () => {
    generateComic.mockImplementation(async (payload: { pageIndex?: number }) => {
      if (payload.pageIndex === 1) throw new PaywallError("Upgrade to keep drawing", { plan: "plus", feature: "heroComic" });
      return { dataUrl: "data:img" };
    });
    const seen: number[] = [];
    const err = await buildComicBook(adventure, "en", "Mia", "data:hero", pages(), { 1: "a", 2: "b", 3: "c" }, (p) => seen.push(p.index)).catch((e) => e);
    expect(err).toBeInstanceOf(PaywallError);
    expect((err as PaywallError).feature).toBe("heroComic");
    expect((err as PaywallError).plan).toBe("plus");
    // The cover resolved (and was reported) before the paywall hit; the paywalled
    // page was never reported as a smudge and pages 2..3 were never attempted.
    expect(seen).toEqual([0]);
    expect(generateComic).toHaveBeenCalledTimes(2);
  });

  it("flags a whole-book failure only when every page errors", async () => {
    generateComic.mockImplementation(async () => { throw new Error("offline"); });
    const out = await buildComicBook(adventure, "en", "Mia", "data:hero", pages(), { 1: "a", 2: "b", 3: "c" }, () => {});
    expect(out.every((p) => p.status === "error")).toBe(true);
  });

  it("passes cover:true for page 0 and a dialogue for beats", async () => {
    const calls: Array<{ cover?: boolean; dialogue?: string; pageIndex?: number }> = [];
    generateComic.mockImplementation(async (payload: { cover?: boolean; dialogue?: string; pageIndex?: number }) => {
      calls.push(payload);
      return { dataUrl: "data:img" };
    });
    await buildComicBook(adventure, "en", "Mia", "data:hero", pages(), { 1: "a", 2: "b", 3: "c" }, () => {});
    expect(calls[0].cover).toBe(true);
    expect(calls[0].dialogue).toBeUndefined();
    expect(calls[1].cover).toBeUndefined();
    expect(calls[1].dialogue).toBeTruthy();
  });
});
