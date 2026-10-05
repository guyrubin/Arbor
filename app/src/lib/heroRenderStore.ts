/**
 * B-KID-127 — a story written for a child is kept: never generated twice.
 *
 * The personalised HeroJourneyRender lived only in an in-memory Map keyed
 * `child|story|lang|day` (HeroJourneyTab journeyMemo): every reload, app
 * restart or new day paid a model call and a ~7 s wait for a story that
 * already existed. This is its device store - the comic page store's pattern
 * (IndexedDB behind an in-memory front, injectable backend, silent no-op where
 * IndexedDB is missing) - for TEXT ONLY. The cross-device copy is the per-child
 * `heroRenders` collection (useChildCollection, registered in
 * lib/childData CHILD_SUBCOLLECTIONS for export + erase); this module never
 * imports the API layer and never calls fetch.
 *
 * Keyed per child + story + language, NO day: a saved render is reused until
 * the child's first name or the story's authored spine changes (`sig`), or a
 * parent explicitly asks for a new version (an overwrite). Bounded by COUNT of
 * stories (MAX_RENDERS, oldest-saved first). Purged with the child (erase) and
 * on sign-out / account deletion, like the comic pages.
 */
import type { HeroBeat, HeroJourneyRender } from "../types";

export const MAX_RENDERS = 120;

export interface SavedHeroRender {
  /** `${childId}|${storyId}|${lang}` on the device; `${storyId}|${lang}` in the child collection. */
  id: string;
  childId: string;
  storyId: string;
  lang: "en" | "he";
  /** renderSignature(first name, story) at the time it was written. */
  sig: string;
  savedAt: string;
  render: HeroJourneyRender;
}

export interface HeroRenderBackend {
  get(id: string): Promise<SavedHeroRender | undefined>;
  put(record: SavedHeroRender): Promise<void>;
  delete(id: string): Promise<void>;
  getAll(): Promise<SavedHeroRender[]>;
  clear(): Promise<void>;
}

export const heroRenderDeviceId = (childId: string, storyId: string, lang: "en" | "he"): string => `${childId}|${storyId}|${lang}`;
export const heroRenderDocId = (storyId: string, lang: "en" | "he"): string => `${storyId}|${lang}`;

/** The authored fields of a beat a render is written from (all optional so a
 *  bare `{ id }` beat still signs). */
export type SignedBeat = { id: string } & Partial<Pick<HeroBeat, "title" | "titleHe" | "spine" | "spineHe" | "spineHeF" | "choices">>;
export interface SignedStory {
  id: string;
  beats: readonly SignedBeat[];
}

/** B-KID-132: the authored WORDS of every beat and Decision choice (EN, HE and
 *  the feminine HE), so a re-authored text — not only a re-shaped spine — makes
 *  the saved personalised words stale and the child gets the new book. */
function authoredText(story: SignedStory): string {
  return story.beats
    .map((b) => [b.id, b.title, b.titleHe, b.spine, b.spineHe, b.spineHeF,
      ...(b.choices ?? []).flatMap((c) => [c.id, c.label, c.labelHe, c.labelHeF, c.outcomeHint, c.outcomeHintHe, c.outcomeHintHeF])]
      .map((x) => x ?? "").join("~"))
    .join("^");
}

/** A small stable hash (FNV-1a, hex) of what the render was written FOR: the
 *  child's first name, the story id, the authored beat spine and (B-KID-132)
 *  the authored words. A name change or a re-authored story makes the saved
 *  words stale. */
export function renderSignature(firstName: string, story: SignedStory): string {
  const input = `${firstName.trim()}|${story.id}|${story.beats.length}|${story.beats.map((b) => b.id).join(",")}|${authoredText(story)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Text only: a render carrying image data (a data: URL) is never stored. */
export function isTextOnlyRender(render: HeroJourneyRender): boolean {
  try {
    return !JSON.stringify(render).includes("data:");
  } catch {
    return false;
  }
}

const DB_NAME = "arbor-hero-renders";
const STORE = "renders";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    let result!: T;
    req.onsuccess = () => { result = req.result; };
    req.onerror = () => reject(req.error);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

function createIdbBackend(): HeroRenderBackend {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const db = () => (dbPromise ??= openDb());
  return {
    async get(id) { return (await tx<SavedHeroRender | undefined>(await db(), "readonly", (s) => s.get(id) as IDBRequest<SavedHeroRender | undefined>)) ?? undefined; },
    async put(record) { await tx(await db(), "readwrite", (s) => s.put(record)); },
    async delete(id) { await tx(await db(), "readwrite", (s) => s.delete(id)); },
    async getAll() { return (await tx<SavedHeroRender[]>(await db(), "readonly", (s) => s.getAll() as IDBRequest<SavedHeroRender[]>)) ?? []; },
    async clear() { await tx(await db(), "readwrite", (s) => s.clear()); },
  };
}

let backend: HeroRenderBackend | null | undefined;
const front = new Map<string, SavedHeroRender>();
const hydrated = new Set<string>();

function resolveBackend(): HeroRenderBackend | null {
  if (backend !== undefined) return backend;
  try {
    backend = typeof indexedDB !== "undefined" ? createIdbBackend() : null;
  } catch {
    backend = null;
  }
  return backend;
}

/** Test hook: inject a backend (null = none). Clears the memory front. */
export function _setHeroRenderBackend(b: HeroRenderBackend | null): void {
  backend = b;
  front.clear();
  hydrated.clear();
}

/** Test hook: forget the memory front (a simulated reload); the backend stays. */
export function _resetHeroRenderFront(): void {
  front.clear();
  hydrated.clear();
}

/** Synchronous read from the memory front (first paint). Stale sig = none. */
export function getSavedRender(childId: string, storyId: string, lang: "en" | "he", sig: string): HeroJourneyRender | undefined {
  const rec = front.get(heroRenderDeviceId(childId, storyId, lang));
  return rec && rec.sig === sig ? rec.render : undefined;
}

/** Load this child's saved renders from the device into the memory front
 *  (once per child per session). Never throws. */
export async function hydrateHeroRenders(childId: string): Promise<void> {
  if (hydrated.has(childId)) return;
  hydrated.add(childId);
  try {
    const all = (await resolveBackend()?.getAll()) ?? [];
    for (const rec of all) if (rec.childId === childId && !front.has(rec.id)) front.set(rec.id, rec);
  } catch {
    /* durability is an enhancement, never a dependency */
  }
}

/** Memory front, then the device store. */
export async function loadSavedRender(childId: string, storyId: string, lang: "en" | "he", sig: string): Promise<HeroJourneyRender | undefined> {
  const hit = getSavedRender(childId, storyId, lang, sig);
  if (hit) return hit;
  try {
    const rec = await resolveBackend()?.get(heroRenderDeviceId(childId, storyId, lang));
    if (rec && rec.sig === sig) {
      front.set(rec.id, rec);
      return rec.render;
    }
  } catch {
    /* fall through: nothing saved */
  }
  return undefined;
}

/** Keep a render on this device (memory + IndexedDB), count-bounded. Returns
 *  the record (for the child collection) or null when it is not storable. */
export function saveRender(childId: string, storyId: string, lang: "en" | "he", sig: string, render: HeroJourneyRender, now: Date = new Date()): SavedHeroRender | null {
  if (!isTextOnlyRender(render)) return null;
  const rec: SavedHeroRender = { id: heroRenderDeviceId(childId, storyId, lang), childId, storyId, lang, sig, savedAt: now.toISOString(), render };
  front.set(rec.id, rec);
  const b = resolveBackend();
  if (b) {
    void (async () => {
      try {
        await b.put(rec);
        const all = await b.getAll();
        if (all.length > MAX_RENDERS) {
          const old = [...all].sort((x, y) => (x.savedAt < y.savedAt ? -1 : x.savedAt > y.savedAt ? 1 : 0)).slice(0, all.length - MAX_RENDERS);
          for (const o of old) { await b.delete(o.id); front.delete(o.id); }
        }
      } catch {
        /* best effort */
      }
    })();
  }
  return rec;
}

/** Remember a render that arrived through the child collection (another
 *  device) in the memory front + device store, without re-uploading it. */
export function adoptSavedRender(rec: SavedHeroRender): void {
  const id = heroRenderDeviceId(rec.childId, rec.storyId, rec.lang);
  const cur = front.get(id);
  if (cur && cur.savedAt >= rec.savedAt) return;
  const local = { ...rec, id };
  front.set(id, local);
  void resolveBackend()?.put(local).catch(() => {});
}

/** Erase: this child's saved renders leave the device. */
export async function purgeHeroRenders(childId: string): Promise<void> {
  for (const id of [...front.keys()]) if (id.startsWith(`${childId}|`)) front.delete(id);
  hydrated.delete(childId);
  const b = resolveBackend();
  if (!b) return;
  const all = await b.getAll();
  for (const rec of all) if (rec.childId === childId) await b.delete(rec.id);
}

/** Sign-out / account deletion: every saved render leaves the device. */
export async function purgeAllHeroRenders(): Promise<void> {
  front.clear();
  hydrated.clear();
  await resolveBackend()?.clear();
}

/**
 * The ONE path to a child's personalised words for a story (B-KID-127):
 * this device's saved render -> the child's account copy (another device) ->
 * ONE generation, which is kept (device + account) for every later open. A
 * failed or moderated answer throws out of `generate` and is never saved.
 * No day in any key: a story is never generated twice for the same child,
 * name and language unless a parent asks for a new version (`fresh`).
 */
export async function resolvePersonalisedRender(args: {
  childId: string;
  story: SignedStory;
  lang: "en" | "he";
  firstName: string;
  remote: readonly SavedHeroRender[];
  generate: () => Promise<HeroJourneyRender>;
  persistRemote: (doc: SavedHeroRender) => void;
  fresh?: boolean;
}): Promise<{ render: HeroJourneyRender; source: "device" | "account" | "generated" }> {
  const sig = renderSignature(args.firstName, args.story);
  if (!args.fresh) {
    const local = await loadSavedRender(args.childId, args.story.id, args.lang, sig);
    if (local) return { render: local, source: "device" };
    const acct = args.remote.find((r) => r.storyId === args.story.id && r.lang === args.lang && r.sig === sig);
    if (acct) {
      adoptSavedRender({ ...acct, childId: args.childId });
      return { render: acct.render, source: "account" };
    }
  }
  const render = await args.generate();
  const rec = saveRender(args.childId, args.story.id, args.lang, sig, render);
  if (rec) args.persistRemote({ ...rec, id: heroRenderDocId(args.story.id, args.lang) });
  return { render, source: "generated" };
}
