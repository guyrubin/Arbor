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

export function statuesKey(childId: string): string {
  return `arbor.sneakFreeze.statues.${childId}`;
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

export function readStatuePictures(childId: string, storage?: Store | null): StatuePicture[] {
  try {
    const raw = childId ? storeOf(storage)?.getItem(statuesKey(childId)) : null;
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list)
      ? list.filter((p): p is StatuePicture => !!p && typeof p.id === "string" && typeof p.url === "string" && p.url.startsWith("data:image/") && typeof p.at === "string")
      : [];
  } catch {
    return [];
  }
}

/** The variant of the newest kept picture (null when none, or older pictures). */
export function lastStatueVariant(childId: string, storage?: Store | null): number | null {
  const v = readStatuePictures(childId, storage)[0]?.variant;
  return typeof v === "number" && Number.isInteger(v) ? v : null;
}

/** Keep one more picture (newest first, at most 12). Returns what is kept. */
export function keepStatuePicture(childId: string, pic: StatuePicture, storage?: Store | null): StatuePicture[] {
  const store = storeOf(storage);
  if (!childId || !store) return [];
  let list = [pic, ...readStatuePictures(childId, store).filter((p) => p.id !== pic.id)].slice(0, STATUE_KEEP);
  while (list.length > 0) {
    try {
      store.setItem(statuesKey(childId), JSON.stringify(list));
      return list;
    } catch {
      // Storage full: the oldest picture makes room.
      list = list.slice(0, -1);
    }
  }
  return [];
}
