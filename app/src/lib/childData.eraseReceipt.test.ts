/**
 * B-BOOK-20 — one synthetic child, walked through export and then erase,
 * across every registered sink: documents, device caches and owned Storage.
 *
 * Done when (Kids lineage B-BOOK-20): a guard lists each store
 * (childDataSinks.guard.test.ts); on a fixture child, export contains each one
 * and erase removes each one, with the erase receipt counting the Storage
 * files. Here:
 *  - the export carries every registered subcollection, the profile, every
 *    server category and the private book files, with a complete receipt;
 *  - the erase receipt lists EVERY registered sink (childSinkIds) with what
 *    it removed, and counts the Storage files per prefix;
 *  - afterwards nothing registered for the child remains — in Firestore, the
 *    device keys or any IndexedDB store — and the sibling is untouched;
 *  - a sink the erase could not reach is "not-reached" on the receipt, never
 *    a silent zero.
 * Synthetic data only. Firebase, the server and the byte export are fakes at
 * their boundary; the device stores are the real modules on in-memory backends.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChildProfile } from "../types";

const fx = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  failCollection: "",
  serverErase: "ok" as "ok" | "offline",
  erased: { memoryEvents: 0, shares: 0, consents: 0, consultRequests: 0 },
  storage: { photos: 0, books: 0 },
  firebaseEnabled: true,
}));

vi.mock("./firebase", () => ({
  db: {},
  get firebaseEnabled() { return fx.firebaseEnabled; },
  auth: { currentUser: { uid: "synthetic-owner" } },
}));
vi.mock("firebase/auth", () => ({ onAuthStateChanged: () => () => undefined }));
vi.mock("firebase/firestore", () => {
  const children = (path: string) => [...fx.docs.keys()].filter((p) => p.startsWith(`${path}/`) && !p.slice(path.length + 1).includes("/"));
  return {
    collection: (_db: unknown, path: string) => path,
    doc: (_db: unknown, path: string) => ({ path }),
    getDocs: async (path: string) => {
      if (path.endsWith(`/${fx.failCollection}`) && fx.failCollection) throw new Error("synthetic source unavailable");
      return { docs: children(path).map((p) => ({ id: p.split("/").at(-1), ref: { path: p }, data: () => fx.docs.get(p) })) };
    },
    deleteDoc: async (ref: { path: string }) => { fx.docs.delete(ref.path); },
  };
});
vi.mock("./api", () => ({
  api: {
    privacyExport: async (childId: string) => ({
      exportedAt: "t",
      childId,
      serverData: {
        memoryEvents: [{ eventId: "m1", childId }],
        shares: [{ id: "s1", childId }],
        consents: [{ id: "c1", childId, purpose: "voice_processing" }],
        consultRequests: [{ id: "r1", childId, note: "synthetic note" }],
      },
    }),
    privacyErase: async (childId: string) => {
      if (fx.serverErase === "offline") throw new Error("synthetic offline");
      return {
        erased: { ...fx.erased, storageFiles: fx.storage.photos + fx.storage.books },
        storage: { ...fx.storage },
        childId,
        erasedAt: "t",
      };
    },
  },
}));
vi.mock("./bookAssetExport", () => ({
  exportPrivateBookAssets: vi.fn(async (_uid: string, _childId: string, metadata: Array<{ bookId: string; files: string[] }>) => {
    const files = metadata.flatMap((m) => (m.files ?? []).map((p) => ({ bookId: m.bookId, path: p, bytes: 4, status: "included" })));
    return { format: "arbor-private-book-assets-v1", status: "complete", inventory: "complete", issues: [], includedFiles: files.length, includedBytes: files.length * 4, files };
  }),
}));

import { CHILD_SUBCOLLECTIONS, eraseEverything, exportChildData } from "./childData";
import { childSinkIds, erasedRecordCount, OTHER_CHILD_SINKS, subcollectionSinkId } from "./childDataSinks";
import { _setComicPageBackend, _resetComicPageStore, getComicPage, type ComicPageBackend, type ComicPageRecord } from "./comicPageStore";
import { _setHeroRenderBackend, _resetHeroRenderFront, type HeroRenderBackend, type SavedHeroRender } from "./heroRenderStore";
import { setBookAssetBackend, type BookAssetBackend } from "./bookAssetStore";

const UID = "synthetic-owner";
const CHILD = "synthetic-child";
const SIBLING = "synthetic-sibling";
const base = (child: string) => `users/${UID}/children/${child}`;

class MemStore {
  map = new Map<string, string>();
  get length() { return this.map.size; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

function memBackends() {
  const comics = new Map<string, ComicPageRecord>();
  const renders = new Map<string, SavedHeroRender>();
  const books = new Map<string, { id: string; childId: string; ownerKey?: string; blob: Blob }>();
  const comic: ComicPageBackend = {
    get: async (k) => comics.get(k), has: async (k) => comics.has(k), put: async (r) => { comics.set(r.key, r); },
    delete: async (k) => { comics.delete(k); }, getAll: async () => [...comics.values()], clear: async () => { comics.clear(); },
  };
  const render: HeroRenderBackend = {
    get: async (id) => renders.get(id), put: async (r) => { renders.set(r.id, r); }, delete: async (id) => { renders.delete(id); },
    getAll: async () => [...renders.values()], clear: async () => { renders.clear(); },
  };
  const book: BookAssetBackend = {
    get: async (id) => books.get(id), put: async (r) => { books.set(r.id, r); },
    deleteWhere: async (pred) => { for (const [id, r] of books) if (pred(r)) books.delete(id); },
  };
  return { comics, renders, books, comic, render, book };
}

let local: MemStore;
let session: MemStore;
let idb: ReturnType<typeof memBackends>;

function seed(child: string) {
  fx.docs.set(base(child), { id: child, name: "Synthetic" });
  for (const name of CHILD_SUBCOLLECTIONS) {
    fx.docs.set(`${base(child)}/${name}/d1`, name === "bookAssets"
      ? { bookId: "synthetic-book", files: ["hero-sheets/s/look-up.webp", "narration/s/en/p1.mp3"] }
      : { synthetic: name });
  }
  local.setItem(`arbor.safetyChecklist.${child}`, "1");
  local.setItem(`arbor.growth.month.seen.${child}.2026-10`, "1");
  session.setItem(`arbor.screen.draft.${child}.band-3`, "{}");
  idb.comics.set(`${child}|scene`, { key: `${child}|scene`, childId: child, dataUrl: "data:image/webp;base64,AAAA", lastUsed: 1 });
  idb.renders.set(`${child}|story|en`, { id: `${child}|story|en`, childId: child, storyId: "story", lang: "en", sig: "s", savedAt: "t" } as SavedHeroRender);
  idb.books.set(`${child}-file`, { id: `${child}-file`, childId: child, ownerKey: UID, blob: new Blob(["WEBP"]) });
}

const childRemains = (child: string) => [
  ...[...fx.docs.keys()].filter((p) => p.startsWith(base(child))),
  ...[...local.map.keys(), ...session.map.keys()].filter((k) => k.includes(`.${child}`)),
  ...[...idb.comics.values()].filter((r) => r.childId === child).map((r) => `comic:${r.key}`),
  ...[...idb.renders.values()].filter((r) => r.childId === child).map((r) => `render:${r.id}`),
  ...[...idb.books.values()].filter((r) => r.childId === child).map((r) => `book:${r.id}`),
];

beforeEach(() => {
  fx.docs.clear();
  fx.failCollection = "";
  fx.serverErase = "ok";
  fx.firebaseEnabled = true;
  fx.erased = { memoryEvents: 3, shares: 1, consents: 2, consultRequests: 1 };
  fx.storage = { photos: 2, books: 5 };
  local = new MemStore();
  session = new MemStore();
  vi.stubGlobal("localStorage", local as unknown as Storage);
  vi.stubGlobal("sessionStorage", session as unknown as Storage);
  idb = memBackends();
  _resetComicPageStore();
  _setComicPageBackend(idb.comic);
  _resetHeroRenderFront();
  _setHeroRenderBackend(idb.render);
  setBookAssetBackend(idb.book);
  seed(CHILD);
  seed(SIBLING);
});
afterEach(() => vi.unstubAllGlobals());

describe("B-BOOK-20 · a synthetic child through export, then erase", () => {
  it("export carries every registered sink with a complete receipt", async () => {
    const out = await exportChildData(UID, { id: CHILD, name: "Synthetic" } as ChildProfile);
    expect(out.exportReceipt.status).toBe("complete");
    expect(Object.keys(out.collections)).toEqual(CHILD_SUBCOLLECTIONS);
    for (const name of CHILD_SUBCOLLECTIONS) {
      expect(out.collections[name], name).toHaveLength(1);
      expect(out.exportReceipt.collections[name], name).toBe("included");
    }
    expect(out.profile.id).toBe(CHILD);
    expect(Object.keys(out.serverData ?? {}).sort()).toEqual(["consents", "consultRequests", "memoryEvents", "shares"]);
    // The owned Storage files of this child, with their per-file receipt.
    expect(out.privateBookAssets).toMatchObject({ status: "complete", includedFiles: 2 });
    expect(out.privateBookAssets!.files.map((f) => f.path)).toEqual(["hero-sheets/s/look-up.webp", "narration/s/en/p1.mp3"]);
  });

  it("erase: the receipt lists every registered sink, counts the Storage files, and nothing of the child remains", async () => {
    expect(childRemains(CHILD).length).toBeGreaterThan(CHILD_SUBCOLLECTIONS.length);
    const receipt = await eraseEverything(UID, CHILD);

    // Every registered sink, in register order, and nothing else.
    expect(Object.keys(receipt.sinks!)).toEqual(childSinkIds(CHILD_SUBCOLLECTIONS));
    expect(Object.values(receipt.sinks!).filter((v) => v === "not-reached")).toEqual([]);
    for (const name of CHILD_SUBCOLLECTIONS) expect(receipt.sinks![subcollectionSinkId(name)], name).toBe(1);
    expect(receipt.sinks).toMatchObject({
      profile: 1,
      "server:memoryEvents": 3,
      "server:familyChildRef": "cleared",
      "server:shares": 1,
      "server:consents": 2,
      "server:consultRequests": 1,
      "storage:photos": 2,
      "storage:books": 5,
      "device:webStorage": 3,
      "device:comicPages": "cleared",
      "device:heroRenders": "cleared",
      "device:bookAssets": "cleared",
      "device:firestoreCache": "cleared",
    });
    // What the parent reads on the receipt.
    expect(receipt.counts.storageFiles).toBe(7);
    expect(receipt.counts.clientDocs).toBe(3);
    expect(erasedRecordCount(receipt.sinks)).toBe(CHILD_SUBCOLLECTIONS.length + 1 + 1);

    expect(childRemains(CHILD)).toEqual([]);
    expect(await getComicPage(CHILD, "scene")).toBeUndefined();
    // The sibling is untouched in every store.
    expect([...fx.docs.keys()].filter((p) => p.startsWith(base(SIBLING)))).toHaveLength(CHILD_SUBCOLLECTIONS.length + 1);
    expect(idb.comics.has(`${SIBLING}|scene`) && idb.renders.has(`${SIBLING}|story|en`) && idb.books.has(`${SIBLING}-file`)).toBe(true);
    expect(local.getItem(`arbor.safetyChecklist.${SIBLING}`)).toBe("1");
    expect(session.getItem(`arbor.screen.draft.${SIBLING}.band-3`)).toBe("{}");
  });

  it("every registered non-subcollection sink is on the receipt (the registry and the receipt cannot drift)", async () => {
    const receipt = await eraseEverything(UID, CHILD);
    for (const sink of OTHER_CHILD_SINKS) expect(receipt.sinks, sink.id).toHaveProperty([sink.id]);
  });

  it("a part the erase could not reach says so instead of claiming zero", async () => {
    fx.serverErase = "offline";
    fx.failCollection = "keepsakes";
    const receipt = await eraseEverything(UID, CHILD);
    for (const id of ["server:memoryEvents", "server:familyChildRef", "server:shares", "server:consents", "server:consultRequests", "storage:photos", "storage:books"]) {
      expect(receipt.sinks![id], id).toBe("not-reached");
    }
    expect(receipt.sinks![subcollectionSinkId("keepsakes")]).toBe("not-reached");
    expect(receipt.sinks!["device:firestoreCache"]).toBe("not-reached");
    // Everything else still went.
    expect(receipt.sinks![subcollectionSinkId("behaviorLogs")]).toBe(1);
    expect(childRemains(CHILD)).toEqual([`${base(CHILD)}/keepsakes/d1`]);
  });

  it("sandbox: the same walk on the device, the profile row included", async () => {
    fx.firebaseEnabled = false;
    fx.docs.clear();
    for (const name of CHILD_SUBCOLLECTIONS) {
      local.setItem(`arbor.${name}.${CHILD}`, JSON.stringify([{ id: "d1" }, { id: "d2" }]));
      local.setItem(`arbor.${name}.${SIBLING}`, JSON.stringify([{ id: "d1" }]));
    }
    local.setItem("arbor.children", JSON.stringify([{ id: CHILD, name: "Synthetic" }, { id: SIBLING, name: "Sibling" }]));
    const exported = await exportChildData(undefined, { id: CHILD, name: "Synthetic" } as ChildProfile);
    for (const name of CHILD_SUBCOLLECTIONS) expect(exported.collections[name], name).toHaveLength(2);

    const receipt = await eraseEverything(undefined, CHILD);
    expect(Object.keys(receipt.sinks!)).toEqual(childSinkIds(CHILD_SUBCOLLECTIONS));
    for (const name of CHILD_SUBCOLLECTIONS) expect(receipt.sinks![subcollectionSinkId(name)], name).toBe(2);
    expect(receipt.sinks!.profile).toBe(1);
    expect(JSON.parse(local.getItem("arbor.children")!)).toEqual([{ id: SIBLING, name: "Sibling" }]);
    expect(childRemains(CHILD)).toEqual([]);
    for (const name of CHILD_SUBCOLLECTIONS) expect(local.getItem(`arbor.${name}.${SIBLING}`), name).not.toBeNull();
  });
});
