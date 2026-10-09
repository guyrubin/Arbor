/**
 * heroSheetStore — B-GAME-13c: the child's generated pose sheet in the child's
 * own record (READ by the game, WRITTEN only by the parent-side builder).
 *
 *   signed in:  users/{uid}/children/{cid}/heroSheet/{poseId | _meta}
 *   sandbox:    the same docs as one array at `arbor.heroSheet.<cid>` (the
 *               useChildCollection local shape; an older proof injection at
 *               that key is a single HeroSheet object and is left to
 *               readStoredHeroSheet)
 *
 * `heroSheet` is registered in CHILD_SUBCOLLECTIONS (lib/childData.ts), so the
 * data export and the erase cover it. This module never calls a model.
 */
import { collection, deleteDoc, doc, getDocs, onSnapshot, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, firebaseEnabled } from "./firebase";
import {
  HERO_SHEET_META_ID,
  HERO_SHEET_POSE_IDS,
  isHeroSheetPose,
  type HeroSheetMetaDoc,
  type HeroSheetPoseDoc,
  type HeroSheetPoseId,
} from "./heroSheetContract";
import { heroSheetKey, type HeroSheet, type HeroSprite } from "../components/kidmode/hero/heroSheet";

export const HERO_SHEET_COLLECTION = "heroSheet";
/** Fired on window when the sandbox copy changes (same-tab listeners). */
export const HERO_SHEET_EVENT = "arbor:heroSheet";

export interface HeroSheetDocs {
  meta: HeroSheetMetaDoc | null;
  poses: Partial<Record<HeroSheetPoseId, HeroSheetPoseDoc>>;
}

export interface HeroSheetStore {
  read(): Promise<HeroSheetDocs>;
  writePose(d: HeroSheetPoseDoc): Promise<void>;
  writeMeta(m: HeroSheetMetaDoc): Promise<void>;
  remove(ids: readonly string[]): Promise<void>;
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Validate raw docs (Firestore or local) into the typed pair; junk is dropped. */
export function parseHeroSheetDocs(list: unknown): HeroSheetDocs {
  const out: HeroSheetDocs = { meta: null, poses: {} };
  if (!Array.isArray(list)) return out;
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const id = r.id;
    const hash = r.avatarHash;
    if (typeof hash !== "string") continue;
    if (id === HERO_SHEET_META_ID) {
      const heroId = r.heroId;
      const stoppedBy = r.stoppedBy;
      const updatedAt = r.updatedAt;
      out.meta = {
        id: HERO_SHEET_META_ID,
        v: 1,
        heroId: typeof heroId === "string" ? heroId : hash,
        source: "generated",
        avatarHash: hash,
        poses: Array.isArray(r.poses) ? r.poses.filter(isHeroSheetPose) : [],
        status: r.status === "complete" || r.status === "stopped" ? r.status : "building",
        ...(typeof stoppedBy === "string" ? { stoppedBy } : {}),
        updatedAt: typeof updatedAt === "string" ? updatedAt : "",
      };
      continue;
    }
    if (!isHeroSheetPose(id) || r.pose !== id) continue;
    const dataUrl = r.dataUrl;
    const w = r.w;
    const h = r.h;
    const foot = (r.foot ?? {}) as Record<string, unknown>;
    const head = (r.head ?? {}) as Record<string, unknown>;
    const fx = foot.x, fy = foot.y, hx = head.x, hy = head.y, hr = head.r;
    if (typeof dataUrl !== "string" || !/^data:image\/(webp|png);base64,/.test(dataUrl)) continue;
    if (!num(w) || !num(h) || !num(fx) || !num(fy) || !num(hx) || !num(hy) || !num(hr)) continue;
    const scale = r.scale;
    const model = r.model;
    const keyColour = r.keyColour;
    const createdAt = r.createdAt;
    const d: HeroSheetPoseDoc = {
      id, v: 1, pose: id, dataUrl, w, h,
      foot: { x: fx, y: fy }, head: { x: hx, y: hy, r: hr },
      scale: num(scale) ? scale : 1,
      avatarHash: hash,
      model: typeof model === "string" ? model : "",
      keyColour: typeof keyColour === "string" ? keyColour : "",
      createdAt: typeof createdAt === "string" ? createdAt : "",
    };
    const hand = (r.hand ?? {}) as Record<string, unknown>;
    const pt = (v: unknown): [number, number] | undefined => (Array.isArray(v) && v.length === 2 && num(v[0]) && num(v[1]) ? [v[0], v[1]] : undefined);
    const hl = pt(hand.l);
    const hrr = pt(hand.r);
    if (hl || hrr) d.hand = { ...(hl ? { l: hl } : {}), ...(hrr ? { r: hrr } : {}) };
    const anchor = r.anchor;
    if (typeof anchor === "string") d.anchor = anchor;
    if (r.review === "ok") d.review = "ok";
    if (r.redrawn === true) d.redrawn = true;
    out.poses[id] = d;
  }
  return out;
}

/**
 * The playable sheet from the stored docs, or null. Only poses drawn from the
 * meta's hero count; `avatarHash` (the child's current hero) makes an older
 * sheet stale. A sheet plays once it has idle AND cheer (the rest falls back).
 */
export function sheetFromDocs(docs: HeroSheetDocs | null | undefined, avatarHash?: string | null): HeroSheet | null {
  if (!docs?.meta) return null;
  const hash = docs.meta.avatarHash;
  if (avatarHash && avatarHash !== hash) return null;
  const poses: Partial<Record<HeroSheetPoseId, HeroSprite>> = {};
  for (const p of HERO_SHEET_POSE_IDS) {
    const d = docs.poses[p];
    if (!d || d.avatarHash !== hash) continue;
    const s: HeroSprite = { url: d.dataUrl, w: d.w, h: d.h, foot: { ...d.foot }, head: { ...d.head } };
    if (d.hand) s.hand = { ...d.hand };
    if (d.scale && d.scale !== 1 && d.scale > 0.2 && d.scale < 5) s.scale = d.scale;
    poses[p] = s;
  }
  if (!poses.idle || !poses.cheer) return null;
  return { v: 1, heroId: docs.meta.heroId, source: "generated", theme: "film3d", createdAt: docs.meta.updatedAt || undefined, poses };
}

/** Firestore drops nothing silently: undefined keys are stripped before a write. */
const clean = <T extends object>(o: T): Record<string, unknown> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

function signedInUid(): string | null {
  const u = auth?.currentUser;
  return firebaseEnabled && db && u && u.uid !== "local-sandbox" ? u.uid : null;
}

function localStore(childId: string, storage: Pick<Storage, "getItem" | "setItem">): HeroSheetStore {
  const key = heroSheetKey(childId);
  const readList = (): Record<string, unknown>[] => {
    try {
      const v = JSON.parse(storage.getItem(key) || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };
  const save = (list: Record<string, unknown>[]) => {
    storage.setItem(key, JSON.stringify(list));
    try {
      if (typeof window !== "undefined" && typeof CustomEvent === "function") window.dispatchEvent(new CustomEvent(HERO_SHEET_EVENT, { detail: { childId } }));
    } catch {
      /* no window */
    }
  };
  const upsert = (item: Record<string, unknown>) => {
    const list = readList().filter((d) => d.id !== item.id);
    save([...list, item]);
  };
  return {
    async read() { return parseHeroSheetDocs(readList()); },
    async writePose(d) { upsert(clean(d)); },
    async writeMeta(m) { upsert(clean(m)); },
    async remove(ids) { save(readList().filter((d) => !ids.includes(String(d.id)))); },
  };
}

function remoteStore(uid: string, childId: string): HeroSheetStore {
  const path = `users/${uid}/children/${childId}/${HERO_SHEET_COLLECTION}`;
  const database = db!;
  return {
    async read() {
      const snap = await getDocs(collection(database, path));
      return parseHeroSheetDocs(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
    },
    async writePose(d) { await setDoc(doc(database, path, d.id), clean(d)); },
    async writeMeta(m) { await setDoc(doc(database, path, m.id), clean(m)); },
    async remove(ids) { await Promise.all(ids.map((id) => deleteDoc(doc(database, path, id)))); },
  };
}

/** The store for this child: Firestore when signed in, else the device copy. */
export function heroSheetStoreFor(childId: string, opts: { uid?: string | null; storage?: Pick<Storage, "getItem" | "setItem"> } = {}): HeroSheetStore {
  const uid = opts.uid === undefined ? signedInUid() : opts.uid;
  if (uid && db) return remoteStore(uid, childId);
  const storage = opts.storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
  if (!storage) {
    const mem = new Map<string, string>();
    return localStore(childId, { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => { mem.set(k, v); } });
  }
  return localStore(childId, storage);
}

/** Live docs for one child (Firestore listener, or the device copy + its event). */
export function subscribeHeroSheetDocs(childId: string, cb: (docs: HeroSheetDocs) => void): () => void {
  if (!childId) return () => {};
  if (firebaseEnabled && auth && db) {
    let unsubDocs: (() => void) | null = null;
    const database = db;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubDocs?.();
      unsubDocs = null;
      if (!user) { cb({ meta: null, poses: {} }); return; }
      unsubDocs = onSnapshot(
        collection(database, `users/${user.uid}/children/${childId}/${HERO_SHEET_COLLECTION}`),
        (snap) => cb(parseHeroSheetDocs(snap.docs.map((d) => ({ ...d.data(), id: d.id })))),
        () => cb({ meta: null, poses: {} }),
      );
    });
    return () => { unsubAuth(); unsubDocs?.(); };
  }
  const store = heroSheetStoreFor(childId, { uid: null });
  const push = () => { void store.read().then(cb, () => cb({ meta: null, poses: {} })); };
  push();
  if (typeof window === "undefined") return () => {};
  // Same-tab only: the builder runs in the tab the parent accepted the hero in.
  const onEvent = (e: Event) => { const d = (e as CustomEvent<{ childId?: string }>).detail; if (!d || d.childId === childId) push(); };
  window.addEventListener(HERO_SHEET_EVENT, onEvent);
  return () => { window.removeEventListener(HERO_SHEET_EVENT, onEvent); };
}
