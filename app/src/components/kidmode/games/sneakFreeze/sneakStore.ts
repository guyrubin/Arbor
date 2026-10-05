/**
 * Sneak & Freeze device state — B-GAME-07b.
 *
 * The per-child play level lives ON THE DEVICE only (ruling G9: the band is
 * never rendered, named or sent anywhere). Child-scoped keys end in
 * `.<childId>`, so clearChildLocalState sweeps them with the child.
 */
import { startFor, type Level, type Track } from "./rules";

export function levelKey(childId: string): string {
  return `arbor.sneakFreeze.level.${childId}`;
}

export interface PlayLevel { track: Track; level: Level }

const isLevel = (v: unknown): v is Level => v === 1 || v === 2 || v === 3;

export function readPlayLevel(childId: string, ageYears: number | null, storage?: Pick<Storage, "getItem"> | null): PlayLevel {
  const fallback = startFor(ageYears);
  try {
    const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
    const raw = childId ? store?.getItem(levelKey(childId)) : null;
    if (!raw) return fallback;
    const v = JSON.parse(raw) as Record<string, unknown>;
    // The track follows the age (a birthday moves it); the level is the device's memory.
    return isLevel(v.level) ? { track: fallback.track, level: v.level } : fallback;
  } catch {
    return fallback;
  }
}

export function writePlayLevel(childId: string, v: PlayLevel, storage?: Pick<Storage, "setItem"> | null): void {
  if (!childId) return;
  try {
    const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
    store?.setItem(levelKey(childId), JSON.stringify({ level: v.level }));
  } catch {
    /* storage unavailable: the next sitting starts from the age default */
  }
}

/** B-GAME-07e: the demonstration plays on a device's first sitting only. */
export const DEMO_SEEN_KEY = "arbor.sneakFreeze.demoSeen";

export function demoSeen(storage?: Pick<Storage, "getItem"> | null): boolean {
  try {
    const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
    return store?.getItem(DEMO_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markDemoSeen(storage?: Pick<Storage, "setItem"> | null): void {
  try {
    const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
    store?.setItem(DEMO_SEEN_KEY, "1");
  } catch {
    /* storage unavailable: the demonstration plays again next time (harmless) */
  }
}
