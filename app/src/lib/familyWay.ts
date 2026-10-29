/**
 * B-PLAY-21 — "Our family's way": the family charter and the "How should
 * Arbor talk with you?" choice as FAMILY-LEVEL fields that follow the account
 * across its signed-in devices, sit in the data export and leave with the
 * account (Guy §8 / G-57 default, 11 Oct).
 *
 * Where they live, and why there (the guards decide):
 *  · NOT a child subcollection: the charter is the household's values and the
 *    tone is the parent's preference — neither is about one child, and a
 *    child-scoped copy would be erased with one of two siblings
 *    (lib/familyCharter.ts SCOPE). So CHILD_SUBCOLLECTIONS does not list it.
 *  · One account document, `users/{uid}/familyWay/current`, registered in
 *    lib/childDataSinks.ts OTHER_FIRESTORE_COLLECTIONS as account data (the
 *    whole-tree sink guard fails on an unregistered path). firestore.rules
 *    already gives `users/{uid}/**` to its owner only; account deletion's
 *    recursiveDelete of `users/{uid}` removes it, and the device keys
 *    (`arbor.familyCharter`, `arbor.lens`, the stamp below) are `arbor.`-keys
 *    the account wipe removes.
 *  · Export: every child's data export carries `familyWay` (both fields),
 *    read from this device's store.
 *
 * DARK: the cross-device sync runs only with the device flag
 * `arbor.flags.familyWaySync` = "1" (the house flag pattern). Off, nothing
 * reads or writes Firestore and the app behaves exactly as before.
 *
 * Pure: the Firestore read/write is injected (`FamilyWayIO`), so the merge
 * rule is tested without a database. Newest change wins, by an ISO stamp the
 * device writes only when the PARENT changes a field (never on load).
 */
import { FAMILY_CHARTER_KEY, hasSavedFamilyCharter, loadFamilyCharter, normalizeCharterValues } from "./familyCharter";

export const FAMILY_WAY_SYNC_FLAG = "arbor.flags.familyWaySync";
/** When this device last changed the charter or the tone (ISO). */
export const FAMILY_WAY_STAMP_KEY = "arbor.familyWay.updatedAt";
/** The tone store ArborContext keeps (`selectedLens`). */
export const LENS_KEY = "arbor.lens";
/** Dispatched on window when the parent changes a field (the sync pushes). */
export const FAMILY_WAY_EVENT = "arbor:family-way-changed";

/** The account collection (registered: lib/childDataSinks OTHER_FIRESTORE_COLLECTIONS). */
export const FAMILY_WAY_COLLECTION = "familyWay";
/** The account document (users/{uid}/familyWay/current). */
export const familyWayPath = (uid: string): string => `users/${uid}/${FAMILY_WAY_COLLECTION}/current`;

export interface FamilyWay {
  /** The saved charter; null = this family never saved one (the starter set shows). */
  charter: string[] | null;
  /** The "How should Arbor talk with you?" choice (a lens id); null = unset. */
  lens: string | null;
  /** ISO time of the change; "" = never changed on this device. */
  updatedAt: string;
}

export interface FamilyWayIO {
  read(): Promise<unknown>;
  write(way: FamilyWay): Promise<void>;
}

type Store = Pick<Storage, "getItem" | "setItem">;
const deviceStore = (): Store | null => {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
};

const MAX_LENS = 64;
const lensOf = (v: unknown): string | null => (typeof v === "string" && v.trim() && v.length <= MAX_LENS ? v.trim() : null);
const stampOf = (v: unknown): string => (typeof v === "string" && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : "");

/** Anything → a family way, or null when it carries neither field. */
export function normalizeFamilyWay(raw: unknown): FamilyWay | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { charter?: unknown; lens?: unknown; updatedAt?: unknown };
  const charter = Array.isArray(r.charter) ? normalizeCharterValues(r.charter) : null;
  const lens = lensOf(r.lens);
  if (charter === null && lens === null) return null;
  return { charter, lens, updatedAt: stampOf(r.updatedAt) };
}

/** This device's family way. */
export function readLocalFamilyWay(store: Store | null = deviceStore()): FamilyWay {
  let lens: string | null = null;
  let updatedAt = "";
  try {
    lens = lensOf(store?.getItem(LENS_KEY) ?? null);
    updatedAt = stampOf(store?.getItem(FAMILY_WAY_STAMP_KEY) ?? null);
  } catch { /* blocked store */ }
  return { charter: store && hasSavedFamilyCharter(store) ? loadFamilyCharter(store) : null, lens, updatedAt };
}

/** Write a family way to this device (the charter only when it carries one). */
export function applyFamilyWay(way: FamilyWay, store: Store | null = deviceStore()): void {
  if (!store) return;
  try {
    if (way.charter !== null) store.setItem(FAMILY_CHARTER_KEY, JSON.stringify(normalizeCharterValues(way.charter)));
    if (way.lens !== null) store.setItem(LENS_KEY, way.lens);
    if (way.updatedAt) store.setItem(FAMILY_WAY_STAMP_KEY, way.updatedAt);
  } catch { /* blocked store */ }
}

/** The parent changed the charter or the tone on this device. */
export function noteFamilyWayChange(store: Store | null = deviceStore(), now: Date = new Date()): void {
  try { store?.setItem(FAMILY_WAY_STAMP_KEY, now.toISOString()); } catch { /* blocked store */ }
  try { if (typeof window !== "undefined") window.dispatchEvent(new Event(FAMILY_WAY_EVENT)); } catch { /* no window */ }
}

/** The parent chose a tone. The tone is stored BEFORE the change event fires:
 *  the sync's listener reads this device's store at that moment, so a write
 *  left to a React effect would upload the previous tone under the new stamp
 *  and the other device would never correct (B-PLAY-21 critic r1). */
export function chooseFamilyLens(lens: string, store: Store | null = deviceStore(), now: Date = new Date()): void {
  const next = lensOf(lens);
  if (next === null) return;
  try { store?.setItem(LENS_KEY, next); } catch { /* blocked store */ }
  noteFamilyWayChange(store, now);
}

export function familyWaySyncOn(store: Pick<Storage, "getItem"> | null = deviceStore()): boolean {
  try { return store?.getItem(FAMILY_WAY_SYNC_FLAG) === "1"; } catch { return false; }
}

/** What the data export carries (both fields, family-level). */
export function familyWayExport(store: Store | null = deviceStore()): { charter: string[] | null; lens: string | null } {
  const { charter, lens } = readLocalFamilyWay(store);
  return { charter, lens };
}

/**
 * One sync: the newer side wins. Remote newer → applied here (returned, so
 * the caller can hand the tone to its live state). Local newer, or no remote
 * yet and this device holds a field (the one-time migration) → written to
 * the account. Equal → nothing.
 */
export async function syncFamilyWay(io: FamilyWayIO, store: Store | null = deviceStore(), now: Date = new Date()): Promise<FamilyWay | null> {
  const local = readLocalFamilyWay(store);
  const remote = normalizeFamilyWay(await io.read());
  if (remote && remote.updatedAt && (!local.updatedAt || remote.updatedAt > local.updatedAt)) {
    applyFamilyWay(remote, store);
    return remote;
  }
  const holds = local.charter !== null || local.lens !== null;
  if (holds && (!remote || (local.updatedAt && (!remote.updatedAt || local.updatedAt > remote.updatedAt)))) {
    const out = { ...local, updatedAt: local.updatedAt || now.toISOString() };
    if (!local.updatedAt) applyFamilyWay({ charter: null, lens: null, updatedAt: out.updatedAt }, store);
    await io.write(out);
  }
  return null;
}
