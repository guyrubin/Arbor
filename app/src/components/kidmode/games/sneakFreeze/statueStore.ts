/**
 * The child's statue pictures — B-GAME-09: the last 12 kept ON THE DEVICE.
 *
 * Not the souvenir ledger (rewards/kidSouvenirs): that keeps one sticker per
 * registry world or book, earned once; a statue picture is a new keepsake
 * every sitting. Device-local only (no upload, no network), child-scoped key
 * swept by clearChildLocalState. Newest first; when storage is full the
 * oldest pictures make room; it never throws.
 */
import type { FreezePose } from "./rules";

export const STATUE_KEEP = 12;

export interface StatuePicture {
  id: string;
  /** ISO time it was made. */
  at: string;
  /** image/jpeg data url, composed on the device. */
  url: string;
  pose: FreezePose;
  /** B-GAME-09c: the framing / time-of-day variant (statuePicture.ts), so the
   *  next sitting's picture can differ from this one. */
  variant?: number;
}

/** The older child-only key is intentionally never read: it cannot prove an owner. */
export const LEGACY_STATUES_PREFIX = "arbor.sneakFreeze.statues.";

export interface StatueScope { ownerId: string; childId: string }

/** Owner + child are both required. The child stays the final dot-delimited
 * segment so existing child-deletion sweeps cover this device copy. */
export function statuesKey(scope: StatueScope | null | undefined): string | null {
  if (!scope || typeof scope.ownerId !== "string" || !scope.ownerId.trim()
    || typeof scope.childId !== "string" || !scope.childId.trim()) return null;
  // An owner id containing a dot must not blur the namespace boundary.
  const owner = encodeURIComponent(scope.ownerId).replace(/\./g, "%2E");
  return `arbor.sneakFreeze.statues.v2.${owner}.${scope.childId}`;
}

type Store = Pick<Storage, "getItem" | "setItem">;

function storeOf(storage?: Store | null): Store | null {
  if (storage) return storage;
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function readStatuePictures(scope: StatueScope | null, storage?: Store | null): StatuePicture[] {
  try {
    const key = statuesKey(scope);
    const raw = key ? storeOf(storage)?.getItem(key) : null;
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list)
      ? list.filter((p): p is StatuePicture => !!p && typeof p.id === "string" && typeof p.url === "string" && p.url.startsWith("data:image/jpeg;base64,") && typeof p.at === "string")
      : [];
  } catch {
    return [];
  }
}

/** The variant of the newest kept picture (null when none, or older pictures). */
export function lastStatueVariant(scope: StatueScope | null, storage?: Store | null): number | null {
  const v = readStatuePictures(scope, storage)[0]?.variant;
  return typeof v === "number" && Number.isInteger(v) ? v : null;
}

/** Keep one more picture (newest first, at most 12). Returns what is kept. */
export function keepStatuePicture(scope: StatueScope | null, pic: StatuePicture, storage?: Store | null): StatuePicture[] {
  const key = statuesKey(scope);
  const store = storeOf(storage);
  if (!key || !store || !pic.url.startsWith("data:image/jpeg;base64,")) return [];
  let list = [pic, ...readStatuePictures(scope, store).filter((p) => p.id !== pic.id)].slice(0, STATUE_KEEP);
  while (list.length > 0) {
    try {
      store.setItem(key, JSON.stringify(list));
      return list;
    } catch {
      // Storage full: the oldest picture makes room.
      list = list.slice(0, -1);
    }
  }
  return [];
}

/** Sign-out scrubs current and legacy on-device artwork for every account.
 * Legacy pictures cannot be attributed to an owner and are never migrated.
 * Child deletion is separately covered by clearChildLocalState. */
export function purgeAllStatuePictures(storage?: Storage | null): number {
  let store: Storage | null = null;
  try { store = storage === undefined ? (typeof localStorage === "undefined" ? null : localStorage) : storage; }
  catch { return 0; }
  if (!store) return 0;
  let removed = 0;
  try {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith(LEGACY_STATUES_PREFIX)) keys.push(key);
    }
    for (const key of keys) {
      try { store.removeItem(key); removed++; } catch { /* best effort */ }
    }
  } catch { /* unavailable storage */ }
  return removed;
}
