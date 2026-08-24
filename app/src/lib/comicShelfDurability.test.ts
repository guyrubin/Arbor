import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * AIX-S5 — comics shelf durability + honesty.
 *
 * Functional tier: with the device-local page store seeded (a "previous
 * session"), re-opening a saved book resolves every page with ZERO
 * /generate-comic calls; fresh generations write through to the store; the
 * shelf probe (savedPagesAvailable) is honest about partial caches.
 *
 * Source tier (coachCaptureHonesty.test.ts style): the firewall conditions —
 * purge on child erase + sign-out, device-local-only (no network module may
 * read the store), and the "Rebuild this book" honesty badge — are locked at
 * the source level so they cannot silently regress.
 */

// Mock the API exactly like heroComics.test.ts — generateComic is the ONLY
// network path to comic art, so "mock not called" IS the zero-network assert.
const generateComic = vi.fn();
vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  api: { generateComic: (...a: unknown[]) => generateComic(...a) },
}));

import {
  ADVENTURES,
  bookPageCount,
  buildComicBook,
  comicKey,
  generatePage,
  planPages,
  rehydrateSavedPagesFromStore,
  savedPagesAvailable,
} from "./heroComics";
import { _resetSceneCache } from "./sceneCache";
import {
  _resetComicPageStore,
  _setComicPageBackend,
  putComicPage,
  type ComicPageBackend,
  type ComicPageRecord,
} from "./comicPageStore";

const adventure = ADVENTURES[0];
const CHILD = "child-1";

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

let mem: ReturnType<typeof memBackend>;

beforeEach(() => {
  generateComic.mockReset();
  _resetSceneCache(); // simulate a NEW session: memory cache empty
  mem = memBackend();
  _setComicPageBackend(mem.backend);
});

afterEach(() => {
  _resetComicPageStore();
});

async function seedFullBook(avatarToken = "no-hero") {
  const total = bookPageCount(adventure.id);
  for (let i = 0; i < total; i++) {
    await putComicPage(CHILD, comicKey(avatarToken, adventure.id, "en", i), `data:page-${i}`);
  }
  return total;
}

describe("AIX-S5 — reopening a saved book after a full reload", () => {
  it("rehydrates every page from the store with ZERO /generate-comic calls", async () => {
    const total = await seedFullBook();
    const pages = await rehydrateSavedPagesFromStore(CHILD, adventure.id, "en", "no-hero");
    expect(pages).toHaveLength(total);
    expect(pages[0]).toBe("data:page-0");
    expect(generateComic).not.toHaveBeenCalled();
  });

  it("a full book build over a seeded store makes ZERO /generate-comic calls", async () => {
    await seedFullBook();
    const spec = planPages(adventure, "en", Array.from({ length: bookPageCount(adventure.id) - 1 }, (_, i) => `Beat ${i + 1}`));
    const out = await buildComicBook(adventure, "en", "Mia", undefined, spec, {}, () => {}, CHILD);
    expect(out.every((p) => p.status === "ready")).toBe(true);
    expect(generateComic).not.toHaveBeenCalled();
  });

  it("returns [] (fresh-build fallback) when ANY page is missing — never a partial book", async () => {
    const total = await seedFullBook();
    mem.map.delete(`${CHILD}|${comicKey("no-hero", adventure.id, "en", total - 1)}`);
    const pages = await rehydrateSavedPagesFromStore(CHILD, adventure.id, "en", "no-hero");
    expect(pages).toEqual([]);
  });
});

describe("AIX-S5 — write-through persistence", () => {
  it("a freshly generated page is persisted to the device-local store", async () => {
    generateComic.mockResolvedValue({ dataUrl: "data:fresh" });
    const page = { index: 0, title: "Cover", cover: true, status: "pending" as const };
    const url = await generatePage({ adventure, lang: "en", heroName: "Mia", page, childId: CHILD });
    expect(url).toBe("data:fresh");
    // flush the fire-and-forget put
    await new Promise((r) => setTimeout(r, 0));
    expect(mem.map.get(`${CHILD}|${comicKey("no-hero", adventure.id, "en", 0)}`)?.dataUrl).toBe("data:fresh");
  });

  it("without a childId behavior is unchanged (no store writes)", async () => {
    generateComic.mockResolvedValue({ dataUrl: "data:fresh" });
    const page = { index: 0, title: "Cover", cover: true, status: "pending" as const };
    await generatePage({ adventure, lang: "en", heroName: "Mia", page });
    await new Promise((r) => setTimeout(r, 0));
    expect(mem.map.size).toBe(0);
  });
});

describe("AIX-S5 — shelf honesty probe (savedPagesAvailable)", () => {
  it("true only when EVERY page is available on this device", async () => {
    await seedFullBook();
    expect(await savedPagesAvailable(CHILD, adventure.id, "en", "no-hero")).toBe(true);
  });

  it("false for a cold state (new device / evicted pages) — never 'Read again'", async () => {
    expect(await savedPagesAvailable(CHILD, adventure.id, "en", "no-hero")).toBe(false);
    const total = await seedFullBook();
    mem.map.delete(`${CHILD}|${comicKey("no-hero", adventure.id, "en", total - 1)}`);
    expect(await savedPagesAvailable(CHILD, adventure.id, "en", "no-hero")).toBe(false);
  });
});

/* ── Source tier: firewall conditions locked at source level ─────────────── */

const SRC_ROOT = path.resolve(__dirname, "..");
const read = (rel: string): string => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");

describe("AIX-S5 — firewall condition: purge wiring", () => {
  it("child erase purges the comic-page store inside wipeClientChildData", () => {
    const code = read("lib/childData.ts");
    expect(code).toContain('import { purgeComicPages } from "./comicPageStore"');
    const wipe = code.slice(code.indexOf("async function wipeClientChildData"));
    expect(wipe).toContain("purgeComicPages(childId)");
  });

  it("sign-out purges the comic-page store for ALL children", () => {
    const code = read("context/AuthContext.tsx");
    expect(code).toContain("purgeAllComicPages");
    const signOutBody = code.slice(code.indexOf("const signOut = async ()"));
    expect(signOutBody).toContain("purgeAllComicPages()");
    // The purge must not be gated behind firebaseEnabled — it must run BEFORE
    // the early return (the store is device-local either way).
    expect(signOutBody.indexOf("purgeAllComicPages()")).toBeLessThan(signOutBody.indexOf("if (!firebaseEnabled"));
  });
});

describe("AIX-S5 — firewall condition: device-local ONLY (no network reads the store)", () => {
  it("comicPageStore never imports the API layer, firebase, or calls fetch", () => {
    const code = read("lib/comicPageStore.ts");
    expect(code).not.toMatch(/from ["']\.\/api["']/);
    expect(code).not.toMatch(/from ["'].*firebase/);
    expect(code).not.toContain("fetch(");
    expect(code).not.toContain("XMLHttpRequest");
    expect(code).not.toContain("navigator.sendBeacon");
  });

  it("the store is imported ONLY by its allow-listed consumers (no upload path)", () => {
    const allowed = new Set([
      "lib/comicPageStore.ts",
      "lib/comicPageStore.test.ts",
      "lib/comicShelfDurability.test.ts",
      "lib/heroComics.ts", // read/write-through for page art
      "lib/childData.ts", // GDPR erase purge
      "context/AuthContext.tsx", // sign-out purge
      "components/layout/DeleteAccountModal.tsx", // STORE-4 account-deletion purge (erase path, not upload)
      "components/tabs/ComicsTab.tsx", // doc comment only (consumes via heroComics)
    ]);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        const rel = path.relative(SRC_ROOT, full).replace(/\\/g, "/");
        if (allowed.has(rel)) continue;
        if (fs.readFileSync(full, "utf8").includes("comicPageStore")) offenders.push(rel);
      }
    };
    walk(SRC_ROOT);
    expect(offenders, `unexpected comicPageStore consumers: ${offenders.join(", ")}`).toEqual([]);
  });

  it("no importer passes store pages into a network call (page data stays local)", () => {
    // heroComics: the persisted read feeds ONLY setScene + the return value.
    const hero = read("lib/heroComics.ts");
    expect(hero).toContain("getComicPage(childId, key)");
    expect(hero).toContain("putComicPage(childId, key, url)");
    // The store functions must never appear inside an api.* call's arguments.
    expect(hero).not.toMatch(/api\.[a-zA-Z]+\([^)]*getComicPage/s);
  });
});

describe("AIX-S5 — honesty badge (ComicsTab source)", () => {
  const code = read("components/tabs/ComicsTab.tsx");

  it("'Read again' renders ONLY behind the fullyCached probe", () => {
    expect(code).toContain("savedPagesAvailable");
    expect(code).toMatch(/readAgain = !!saved && fullyCached\[a\.id\] === true/);
    // Every "Read again" literal is inside the readAgain branch (HE + EN).
    expect(code).toContain('he ? "לקרוא שוב" : "Read again"');
    expect(code).not.toMatch(/saved \? \(he \? "לקרוא שוב"/);
  });

  it("saved-but-cold books say 'Rebuild this book' (HE + EN), aria included", () => {
    expect(code).toContain('"Rebuild this book"');
    expect(code).toContain("לבנות את הספר מחדש");
    expect(code).toMatch(/aria-label=\{readAgain[\s\S]{0,220}Rebuild this book/);
  });

  it("opening a saved book rehydrates from the store (zero-call path wired)", () => {
    expect(code).toContain("rehydrateSavedPagesFromStore(childProfile.id");
    expect(code).toContain("childId={childProfile.id}");
  });
});
