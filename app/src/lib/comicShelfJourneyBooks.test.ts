import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * M3 (22 Sep 2026) — a comic a child made by READING a story is a real book on
 * both shelves.
 *
 * Before this pass the parent shelf COUNTED it ("1 of 13 books on the shelf")
 * while its grid listed only the 13 authored adventures, so the book had no
 * tile and could not be opened; on the child shelf its `comic4|journey|…` keys
 * were rejected by the frozen-identity check, which only accepted `|book|`, so
 * every read-along comic read "unavailable". Both books also shared one
 * savedComics doc id (the adventureId), so the last save won and the other
 * book's page bytes were orphaned in IndexedDB.
 *
 * Functional tier: the read path is exercised against a real page store.
 * Source tier: the wiring that cannot be rendered here (node environment, no
 * DOM) is locked at source level, in the style of comicShelfDurability.
 */

const generateComic = vi.fn();
vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  api: { generateComic: (...a: unknown[]) => generateComic(...a) },
}));

import {
  ADVENTURES,
  STORY_COMIC,
  bookPageCount,
  comicGenerationKey,
  readSavedMetaCoverFromStore,
  rehydrateSavedMetaPagesFromStore,
  savedBookTitle,
  savedComicDocId,
  savedMetaKind,
  savedMetaPageTotal,
  savedMetaPagesAvailable,
  shelfBooks,
  toSavedComicMeta,
  type SavedComicMeta,
} from "./heroComics";
import { HERO_STORIES } from "./heroJourneys";
import { en as kidsEn, he as kidsHe } from "./i18nElevation/kidsStories";
import { _resetSceneCache } from "./sceneCache";
import {
  _resetComicPageStore,
  _setComicPageBackend,
  putComicPage,
  type ComicPageBackend,
  type ComicPageRecord,
} from "./comicPageStore";

const CHILD = "child-1";
const PNG = "data:image/png;base64,iVBORw0KGgo=";
/** The story the audit's fixture used: a catalog story with NO authored copy. */
const UNCOVERED = HERO_STORIES.find((s) => !STORY_COMIC[s.id])!;
const AUTHORED = ADVENTURES[0];

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

/** The 9 keys a story read with a hero freezes: cover + 8 beats. */
const journeyKeys = (storyId: string, pages = 9): string[] =>
  Array.from({ length: pages }, (_, pageIndex) => comicGenerationKey({
    avatarOrHash: "hero-token",
    adventureId: storyId,
    lang: "en",
    pageIndex,
    requestKind: "journey",
    style: "storybook",
    childIdentity: CHILD,
    heroName: "Mia",
    promptIdentity: `beat-${pageIndex}`,
  }));

const journeyMeta = (storyId: string, keys = journeyKeys(storyId)): SavedComicMeta => toSavedComicMeta({
  id: storyId,
  adventureId: storyId,
  kind: "journey",
  title: "The night we lit the path",
  lang: "en",
  pageUrls: [],
  createdAt: "2026-09-22T19:00:00.000Z",
  pageKeys: keys,
});

let mem: ReturnType<typeof memBackend>;
beforeEach(() => {
  generateComic.mockReset();
  _resetSceneCache();
  mem = memBackend();
  _resetComicPageStore();
  _setComicPageBackend(mem.backend);
});
afterEach(() => { _setComicPageBackend(null); });

describe("M3 — a read-along comic opens from the device store", () => {
  it("reads all 9 pages (cover + 8 beats), not the authored book's page plan", async () => {
    const meta = journeyMeta(UNCOVERED.id);
    for (const key of meta.pageKeys!) await putComicPage(CHILD, key, PNG);

    expect(savedMetaPageTotal(meta)).toBe(9);
    // The bug this replaces: bookPageCount assumes the authored beat plan.
    expect(savedMetaPageTotal(meta)).not.toBe(bookPageCount(meta.adventureId));
    await expect(savedMetaPagesAvailable(CHILD, meta, "no-hero")).resolves.toBe(true);
    await expect(rehydrateSavedMetaPagesFromStore(CHILD, meta, "no-hero")).resolves.toHaveLength(9);
    await expect(readSavedMetaCoverFromStore(CHILD, meta, "no-hero")).resolves.toBe(PNG);
    expect(generateComic).not.toHaveBeenCalled();
  });

  it("never shows a book that cannot open: one missing page fails closed", async () => {
    const meta = journeyMeta(UNCOVERED.id);
    for (const key of meta.pageKeys!.slice(0, -1)) await putComicPage(CHILD, key, PNG);
    await expect(savedMetaPagesAvailable(CHILD, meta, "no-hero")).resolves.toBe(false);
    await expect(rehydrateSavedMetaPagesFromStore(CHILD, meta, "no-hero")).resolves.toEqual([]);
  });

  it("stays inside its own child partition and rejects a mixed-kind key list", async () => {
    const meta = journeyMeta(UNCOVERED.id);
    for (const key of meta.pageKeys!) await putComicPage(CHILD, key, PNG);
    await expect(savedMetaPagesAvailable("child-b", meta, "no-hero")).resolves.toBe(false);

    const mixed: SavedComicMeta = {
      ...meta,
      pageKeys: [meta.pageKeys![0], meta.pageKeys![1].replace("|journey|", "|book|")],
      pageCount: 2,
    };
    await expect(savedMetaPagesAvailable(CHILD, mixed, "no-hero")).resolves.toBe(false);
  });
});

describe("M3 round 2 — the frozen-identity check stays STRICT for journey keys", () => {
  it("rejects a record whose beat keys carry a per-beat seed in the story slot (parts[6])", async () => {
    // HeroScenePlayer once minted beat keys with storyId = `<storyId>-<beatId>-<hero>`;
    // only the cover carried the real story id. Such a record cannot prove it
    // owns those pages, so it must never read — the fix is minting, not a
    // looser validator (a prefix match would let one story claim another's bytes).
    const exact = journeyKeys(UNCOVERED.id);
    const seeded = exact.map((key, index) => {
      if (index === 0) return key;
      const parts = key.split("|");
      parts[6] = `${UNCOVERED.id}-beat${index}-Dylan`;
      return parts.join("|");
    });
    const meta = journeyMeta(UNCOVERED.id, seeded);
    for (const key of seeded) await putComicPage(CHILD, key, PNG);
    await expect(savedMetaPagesAvailable(CHILD, meta, "no-hero")).resolves.toBe(false);
    await expect(rehydrateSavedMetaPagesFromStore(CHILD, meta, "no-hero")).resolves.toEqual([]);
    await expect(readSavedMetaCoverFromStore(CHILD, meta, "no-hero")).resolves.toBeUndefined();
  });

  it("rejects a seed-shaped COVER too — index 0 is held to the same exact match", async () => {
    const keys = journeyKeys(UNCOVERED.id).map((key, index) => {
      if (index !== 0) return key;
      const parts = key.split("|");
      parts[6] = `${UNCOVERED.id}-cover-Dylan`;
      return parts.join("|");
    });
    const meta = journeyMeta(UNCOVERED.id, keys);
    for (const key of keys) await putComicPage(CHILD, key, PNG);
    await expect(savedMetaPagesAvailable(CHILD, meta, "no-hero")).resolves.toBe(false);
  });

  it("source keeps the exact comparison and no prefix escape hatch", () => {
    const hero = fs.readFileSync(path.resolve(__dirname, "heroComics.ts"), "utf8");
    expect(hero).toContain("|| parts[6] !== meta.adventureId");
    expect(hero).not.toMatch(/parts\[6\]\.startsWith/);
  });
});

describe("M3 round 2 — titles follow the UI language", () => {
  it("a read-along comic saved in English shows the catalog titleHe under a Hebrew UI", () => {
    const meta = journeyMeta(UNCOVERED.id);
    expect(savedBookTitle(meta, "he")).toBe(UNCOVERED.titleHe);
    // Same language: the title the story gave the book wins.
    expect(savedBookTitle(meta, "en")).toBe("The night we lit the path");
    // No stored title: the catalog is the fallback.
    expect(savedBookTitle({ ...meta, title: "" }, "en")).toBe(UNCOVERED.title);
  });
});

describe("M3 — two books for one story, two shelf slots", () => {
  it("a read-along comic gets its own doc id, so neither save orphans the other", () => {
    const journey = journeyMeta(AUTHORED.id);
    expect(journey.id).toBe(savedComicDocId(AUTHORED.id, "journey"));
    expect(journey.id).not.toBe(AUTHORED.id);
    expect(journey.adventureId).toBe(AUTHORED.id);
    expect(savedMetaKind(journey)).toBe("journey");
  });

  it("the parent shelf lists BOTH: the authored slot and the read-along comic", () => {
    const parentBook = toSavedComicMeta({
      id: AUTHORED.id, adventureId: AUTHORED.id, title: AUTHORED.title, lang: "en",
      pageUrls: [], createdAt: "2026-09-20T00:00:00.000Z",
    });
    const { authored, extra } = shelfBooks([parentBook, journeyMeta(AUTHORED.id)]);
    expect(authored).toHaveLength(ADVENTURES.length);
    const slot = authored.find((b) => b.id === AUTHORED.id)!;
    expect(slot.kind).toBe("book");
    expect(slot.meta).toBe(parentBook);
    expect(extra).toHaveLength(1);
    expect(extra[0].id).toBe(`${AUTHORED.id}:journey`);
    expect(extra[0].adventureId).toBe(AUTHORED.id);
    expect(extra[0].kind).toBe("journey");
    // One tile per book — a shelf of 13 adventures now shows 14 books.
    expect(authored.length + extra.length).toBe(ADVENTURES.length + 1);
  });

  it("a story with NO authored comic copy still gets a tile with a title and a pack", () => {
    const { authored, extra } = shelfBooks([journeyMeta(UNCOVERED.id)]);
    expect(authored.every((b) => b.id !== `${UNCOVERED.id}:journey`)).toBe(true);
    expect(extra).toHaveLength(1);
    expect(extra[0].title).toBe(UNCOVERED.title);
    expect(extra[0].titleHe).toBe(UNCOVERED.titleHe);
    expect(extra[0].pack).toBe(UNCOVERED.pack);
    expect(extra[0].meta?.title).toBe("The night we lit the path");
  });

  it("a LEGACY read-along record parked on the authored slot is still typed journey", () => {
    const legacy: SavedComicMeta = {
      id: AUTHORED.id,
      adventureId: AUTHORED.id,
      title: "Saved before the id split",
      lang: "en",
      createdAt: "2026-09-21T00:00:00.000Z",
      pageKeys: journeyKeys(AUTHORED.id, 3),
      pageCount: 3,
      identityVersion: "character-v4",
    };
    const { authored, extra } = shelfBooks([legacy]);
    expect(extra).toEqual([]);
    const slot = authored.find((b) => b.id === AUTHORED.id)!;
    // Read-only, because its pages were drawn for the story, not the book.
    expect(slot.kind).toBe("journey");
    expect(savedMetaPageTotal(slot.meta!)).toBe(3);
  });

  it("a saved record for an unknown story is dropped, never a tile that cannot open", () => {
    const orphan: SavedComicMeta = {
      id: "not-a-story:journey", adventureId: "not-a-story", title: "?", lang: "en",
      createdAt: "2026-09-22T00:00:00.000Z", pageKeys: ["comic4|journey|character-v4|s|c|h|not-a-story|en|0|p|a"],
      pageCount: 1, identityVersion: "character-v4",
    };
    expect(shelfBooks([orphan]).extra).toEqual([]);
  });
});

/* ── Source tier: the wiring a node environment cannot render ────────────── */

const SRC = path.resolve(__dirname, "..");
const read = (rel: string): string => fs.readFileSync(path.join(SRC, rel), "utf8");

describe("M3 — parent shelf source wiring (components/tabs/ComicsTab.tsx)", () => {
  const code = read("components/tabs/ComicsTab.tsx");

  it("lists the read-along comics it counts (grid = authored + saved journey books)", () => {
    expect(code).toContain("shelfBooks(savedCol.items)");
    expect(code).toContain("const shelfAdventures = [...shownAuthored, ...journeyBooks]");
    expect(code).toContain("const shelfTotal = ADVENTURES.length + journeyBooks.length");
    expect(code).toContain("`${savedCount} of ${shelfTotal} books on the shelf`");
    expect(code).not.toContain("of ${ADVENTURES.length} books on the shelf");
  });

  it("opens a read-along comic READ-ONLY — no generating reader, no save seam", () => {
    expect(code).toContain('visibleOpenBook.kind === "journey"');
    expect(code).toContain("<SavedComicReader");
    // The journey branch returns BEFORE the ComicReader branch is reached.
    expect(code.indexOf("<SavedComicReader")).toBeLessThan(code.indexOf("<ComicReader"));
    const journeyBranch = code.slice(code.indexOf('visibleOpenBook.kind === "journey"'), code.indexOf("<ComicReader"));
    expect(journeyBranch).not.toContain("onSave=");
    expect(journeyBranch).not.toContain("onPaywall=");
    expect(journeyBranch).not.toContain("heroDataUrl=");
  });

  it("page count and cover come from the saved record, never from the authored plan", () => {
    expect(code).not.toContain("bookPageCount");
    expect(code).toContain("visibleOpenBook.pages.map((dataUrl, index)");
    expect(code).toContain("readSavedMetaCoverFromStore(childProfile.id, m, avatarKeyToken)");
    // Probes and covers are keyed by DOC id: two books, two verdicts.
    expect(code).toContain("map[m.id] = await savedMetaPagesAvailable(childProfile.id, m, avatarKeyToken)");
    expect(code).toContain("covers[m.id] = cover");
  });

  it("'Make this comic' stays an authored-adventure move, and a cold journey book opens nothing", () => {
    expect(code).toContain('const offDevice = a.kind === "journey" && !readAgain');
    expect(code).toContain('he ? "לא במכשיר הזה" : "Not on this device"');
    // The build entry is the no-meta branch of openComic, which a saved
    // read-along comic can never reach.
    expect(code).toMatch(/if \(!meta\) \{[\s\S]{0,400}kind: "book", pages: \[\]/);
    // The off-device face is not a control.
    expect(code).toMatch(/\{offDevice \? \([\s\S]{0,400}<div/);
  });
});

describe("M3 — child shelf source wiring (components/kidmode/KidComicsShelf.tsx)", () => {
  const code = read("components/kidmode/KidComicsShelf.tsx");

  it("expects the saved record's own page count, not the authored book plan", () => {
    expect(code).toContain("savedMetaPageTotal(meta)");
    expect(code).not.toContain("bookPageCount");
  });

  it("shows the book's own cover on the shelf card, validated before it renders", () => {
    expect(code).toContain("readSavedMetaCoverFromStore(childProfile.id, meta, avatarToken)");
    expect(code).toContain("if (cover && isStrictComicImageDataUrl(cover)) nextCovers[meta.id] = cover");
    expect(code).toContain('<img src={cover} alt=""');
  });

  it("never shows a book that cannot open: only probed-available books render", () => {
    expect(code).toContain('books.filter(({ meta }) => availability.values[meta.id] === "available")');
    expect(code).toContain("openableBooks.map(");
    expect(code).not.toContain("books.map(({ meta, adventure })");
    // Checking holds the loading panel; nothing disabled is ever drawn.
    expect(code).toContain("(books.length > 0 && !probeReady)");
    expect(code).not.toContain('"shelf.unavailableShort"');
    expect(code).not.toMatch(/disabled=\{state/);
  });

  it("each card is cover-led: fixed 3:2 box, object-cover, one big control, title below", () => {
    const card = code.slice(code.indexOf("openableBooks.map("), code.indexOf("</button>", code.indexOf("openableBooks.map(")));
    expect(card).toContain('aspectRatio: "3 / 2"');
    expect(card).toContain("object-cover");
    expect(card).not.toContain("object-contain");
    expect(card.match(/<button[\s>]/g)?.length).toBe(1);
    expect(card).toContain("savedBookTitle(meta, aiLang, adventure)");
  });

  it("keeps the child register: still no generation, share, download or purchase seam", () => {
    expect(code).not.toMatch(/api\.|generateComic\(|generatePage\(|buildComicBook\(|openPaywall/);
  });
});

describe("M3 round 2 — copy", () => {
  it("the child shelf says 'your comics' in both languages (the child made them)", () => {
    expect(kidsEn["shelf.subtitle"]).toMatch(/^Your comics/);
    expect(kidsHe["shelf.subtitle"]).toContain("הקומיקסים שלכם");
    expect(kidsEn["shelf.subtitle"]).not.toContain("grown-up");
    expect(kidsHe["shelf.subtitle"]).not.toContain("מבוגר");
  });

  it("the parent off-device state says what to do, in both languages, and covers never pillarbox", () => {
    const code = read("components/tabs/ComicsTab.tsx");
    expect(code).toContain("read the story again on this device (Hero Stories)");
    expect(code).toContain("קראו את הסיפור שוב במכשיר הזה");
    expect(code).not.toContain("object-contain");
    expect(code).toContain("savedBookTitle(saved, aiLang, a)");
  });
});

describe("M3 — the story writes the read-along comic to its own slot", () => {
  it("HeroJourneyTab saves with kind 'journey'", () => {
    const code = read("components/tabs/HeroJourneyTab.tsx");
    const save = code.slice(code.indexOf("const saveStoryAsComic"), code.indexOf("const finishJourney"));
    expect(save).toContain('kind: "journey"');
    expect(save).toContain("pageKeys: keys");
  });
});
