import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generateComic = vi.fn();
vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  api: { generateComic: (...args: unknown[]) => generateComic(...args) },
}));

import {
  ADVENTURES,
  COMIC_IDENTITY_VERSION,
  ComicGenerationCancelledError,
  bookPageCount,
  buildComicBook,
  comicGenerationKey,
  comicKey,
  generatePage,
  isStrictComicImageDataUrl,
  planPages,
  rehydrateSavedMetaPagesFromStore,
  savedMetaPagesAvailable,
  type SavedComicMeta,
} from "./heroComics";
import {
  _resetComicPageStore,
  _setComicPageBackend,
  purgeComicPages,
  putComicPage,
  type ComicPageBackend,
  type ComicPageRecord,
} from "./comicPageStore";
import { _resetSceneCache, getScene, resolveScene, setScene } from "./sceneCache";
import type { AvatarStyle } from "./api";

const adventure = ADVENTURES[0];
const PNG = "data:image/png;base64,iVBORw0KGgo=";

function memoryBackend() {
  const records = new Map<string, ComicPageRecord>();
  const backend: ComicPageBackend = {
    get: async (key) => records.get(key),
    has: async (key) => records.has(key),
    put: async (record) => { records.set(record.key, { ...record }); },
    delete: async (key) => { records.delete(key); },
    getAll: async () => [...records.values()],
    clear: async () => { records.clear(); },
  };
  return { records, backend };
}

let memory: ReturnType<typeof memoryBackend>;

beforeEach(() => {
  generateComic.mockReset();
  generateComic.mockResolvedValue({ dataUrl: PNG });
  _resetSceneCache();
  memory = memoryBackend();
  _setComicPageBackend(memory.backend);
});

afterEach(() => {
  _resetComicPageStore();
});

describe("comic v4 generation identity", () => {
  const base = {
    avatarOrHash: "data:image/png;base64,iVBORw0KGgo=",
    adventureId: adventure.id,
    lang: "en" as const,
    pageIndex: 1,
    requestKind: "book" as const,
    style: "storybook" as AvatarStyle,
    childIdentity: "child-a",
    heroName: "Mia",
    promptIdentity: "prompt-a",
  };

  it("separates request kind, medium, reference, child, hero name, language, versioned prompt and page", () => {
    const key = comicGenerationKey(base);
    for (const changed of [
      { requestKind: "journey" as const },
      { style: "watercolor" as AvatarStyle },
      { avatarOrHash: "data:image/png;base64,iVBORw0KGgp=" },
      { childIdentity: "child-b" },
      { heroName: "Noa" },
      { lang: "he" as const },
      { promptIdentity: "prompt-b" },
      { pageIndex: 2 },
    ]) {
      expect(comicGenerationKey({ ...base, ...changed })).not.toBe(key);
    }
    expect(key).toContain(`|${COMIC_IDENTITY_VERSION}|`);
  });

  it("threads all five media to the provider request", async () => {
    const styles: AvatarStyle[] = ["storybook", "soft3d", "watercolor", "flat", "comichero"];
    for (const style of styles) {
      const page = { index: 0, title: "Cover", cover: true, status: "pending" as const };
      await generatePage({ adventure, lang: "en", heroName: "Mia", heroDataUrl: base.avatarOrHash, page, style });
    }
    expect(generateComic.mock.calls.map(([payload]) => (payload as { style: AvatarStyle }).style)).toEqual(styles);
  });
});

describe("saved artifact isolation and compatibility", () => {
  const legacyMeta: SavedComicMeta = {
    id: adventure.id,
    adventureId: adventure.id,
    title: adventure.title,
    lang: "en",
    createdAt: "2026-09-01T00:00:00.000Z",
  };

  it("never lets a process-global legacy scene satisfy another child's missing book", async () => {
    const key = comicKey("no-hero", adventure.id, "en", 0);
    setScene(key, PNG);
    await expect(savedMetaPagesAvailable("child-b", legacyMeta, "no-hero")).resolves.toBe(false);
    await expect(rehydrateSavedMetaPagesFromStore("child-b", legacyMeta, "no-hero")).resolves.toEqual([]);
  });

  it("reads a complete legacy comic3 book only from its own child partition", async () => {
    const total = bookPageCount(adventure.id);
    for (let index = 0; index < total; index++) {
      await putComicPage("child-a", comicKey("no-hero", adventure.id, "en", index), PNG);
    }
    await expect(rehydrateSavedMetaPagesFromStore("child-a", legacyMeta, "no-hero")).resolves.toHaveLength(total);
    await expect(rehydrateSavedMetaPagesFromStore("child-b", legacyMeta, "no-hero")).resolves.toEqual([]);
  });

  it("rehydrates frozen v4 keys despite current avatar changes and rejects malformed v4 metadata", async () => {
    const pageKeys = Array.from({ length: bookPageCount(adventure.id) }, (_, pageIndex) =>
      comicGenerationKey({
        avatarOrHash: "saved-reference",
        adventureId: adventure.id,
        lang: "en",
        pageIndex,
        requestKind: "book",
        style: "watercolor",
        childIdentity: "child-a",
        heroName: "Mia",
        promptIdentity: `saved-${pageIndex}`,
      }));
    for (const key of pageKeys) await putComicPage("child-a", key, PNG);
    const frozen: SavedComicMeta = {
      ...legacyMeta,
      pageKeys,
      pageCount: pageKeys.length,
      identityVersion: COMIC_IDENTITY_VERSION,
    };
    await expect(rehydrateSavedMetaPagesFromStore("child-a", frozen, "a-new-avatar")).resolves.toEqual(pageKeys.map(() => PNG));

    const malformed: SavedComicMeta = { ...frozen, pageKeys: ["comic4|broken"] };
    await putComicPage("child-a", comicKey("a-new-avatar", adventure.id, "en", 0), PNG);
    await expect(savedMetaPagesAvailable("child-a", malformed, "a-new-avatar")).resolves.toBe(false);
    await expect(rehydrateSavedMetaPagesFromStore("child-a", malformed, "a-new-avatar")).resolves.toEqual([]);
  });
});

describe("stored comic image validation", () => {
  it("accepts supported raster signatures and rejects loose/corrupt/active data URLs", () => {
    expect(isStrictComicImageDataUrl(PNG)).toBe(true);
    expect(isStrictComicImageDataUrl("data:image/jpeg;base64,/9j/AA==")).toBe(true);
    expect(isStrictComicImageDataUrl("data:image/webp;base64,UklGRgAAAABXRUJQ")).toBe(true);
    expect(isStrictComicImageDataUrl("data:image/gif;base64,R0lGODlh")).toBe(true);
    expect(isStrictComicImageDataUrl("data:image/avif;base64,AAAAAGZ0eXBhdmlm")).toBe(true);
    expect(isStrictComicImageDataUrl("data:image/png;base64,AAAA")).toBe(false);
    expect(isStrictComicImageDataUrl("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
    expect(isStrictComicImageDataUrl("data:image/png;base64,not base64")).toBe(false);
  });
});

describe("whole-book erase lifetime", () => {
  it("stops after an in-flight first page is purged and never caches, stores, or starts later pages", async () => {
    let release!: (value: { dataUrl: string }) => void;
    generateComic.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const pages = planPages(adventure, "en", ["Beat one", "Beat two"]);
    const seen: number[] = [];
    const coverKey = comicGenerationKey({
      avatarOrHash: "no-hero",
      adventureId: adventure.id,
      lang: "en",
      pageIndex: 0,
      requestKind: "book",
      style: "comichero",
      childIdentity: "child-a",
      heroName: "Mia",
      promptIdentity: JSON.stringify({
        theme: `${adventure.copy.theme} — dramatic comic-book COVER with the title, no panels`,
        dialogue: null,
        sfx: adventure.copy.sfx,
        cover: true,
      }),
    });
    const building = buildComicBook(adventure, "en", "Mia", undefined, pages, {}, (page) => seen.push(page.index), "child-a");
    const rejection = expect(building).rejects.toBeInstanceOf(ComicGenerationCancelledError);
    await vi.waitFor(() => expect(generateComic).toHaveBeenCalledTimes(1));

    await purgeComicPages("child-a");
    release({ dataUrl: PNG });
    await rejection;

    expect(generateComic).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([]);
    expect(memory.records.size).toBe(0);
    expect(getScene(coverKey)).toBeUndefined();
  });

  it("does not start a provider call that was still in the scene throttle queue when purge occurred", async () => {
    let releaseA!: (value: string) => void;
    let releaseB!: (value: string) => void;
    const blockerA = resolveScene("queue-block-a", () => new Promise((resolve) => { releaseA = resolve; }));
    const blockerB = resolveScene("queue-block-b", () => new Promise((resolve) => { releaseB = resolve; }));
    const pages = planPages(adventure, "en", ["Beat one"]);
    const building = buildComicBook(adventure, "en", "Mia", undefined, pages, {}, () => {}, "child-a");
    const rejection = expect(building).rejects.toBeInstanceOf(ComicGenerationCancelledError);
    await Promise.resolve();
    expect(generateComic).not.toHaveBeenCalled();

    await purgeComicPages("child-a");
    releaseA(PNG);
    releaseB(PNG);
    await Promise.all([blockerA, blockerB]);
    await rejection;

    expect(generateComic).not.toHaveBeenCalled();
    expect(memory.records.size).toBe(0);
  });
});
