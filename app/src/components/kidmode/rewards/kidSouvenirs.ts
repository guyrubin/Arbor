/**
 * kidSouvenirs — B-KID-96 v1 (R1: one reward ledger) + B-KID-94 (one finish
 * moment): when a game sitting or a book ends, the child KEEPS something —
 * ONE souvenir sticker for that world / that book.
 *
 * - The sticker art is existing art only: the world's game card / the book's
 *   cover from the kid theme manifest (no image generation).
 * - Earned ONCE each and lifetime-monotonic: a souvenir is never removed,
 *   never decays, never counted as a score; there is no streak and no "come
 *   back tomorrow" (law 3). The ledger is a set of ids, not a number.
 * - Stored per child in the per-child store pattern (useChildCollection,
 *   collection `kidSouvenirs`, registered in lib/childData CHILD_SUBCOLLECTIONS
 *   for export + erase).
 *
 * Pure data + art lookups; the hook lives in useKidSouvenirs.ts.
 */
import { kidArt, storyCoverKey, worldTileKey, type KidArt, type KidThemeId, type KidWorldTileId } from "../../../lib/kidThemeManifest";
import { kidWorldByWorldId } from "../kidWorlds";

export const SOUVENIR_COLLECTION = "kidSouvenirs";

export type SouvenirKind = "world" | "book";

export interface KidSouvenir {
  /** `world:<worldId>` | `book:<storyId>` — one per world / book, ever. */
  id: string;
  kind: SouvenirKind;
  /** The world's routing id or the story id. */
  refId: string;
  /** When it was first earned (ISO). Never rewritten. */
  earnedAt: string;
}

export const souvenirId = (kind: SouvenirKind, refId: string): string => `${kind}:${refId}`;

/** The souvenir to store for this ending, or null when the child already has
 *  it (earned once; the ledger only ever grows). */
export function souvenirToAward(owned: readonly Pick<KidSouvenir, "id">[], kind: SouvenirKind, refId: string, now: Date): KidSouvenir | null {
  if (!refId) return null;
  if (kind === "world" && !kidWorldByWorldId(refId)) return null;
  const id = souvenirId(kind, refId);
  if (owned.some((s) => s.id === id)) return null;
  return { id, kind, refId, earnedAt: now.toISOString() };
}

/** The sticker's picture: the world's card / the book's cover in this theme;
 *  a book without a cover in this theme wears the Tonight card. Never another
 *  theme's art. */
export function souvenirArt(s: Pick<KidSouvenir, "kind" | "refId">, theme: KidThemeId): KidArt | null {
  if (s.kind === "world") {
    const w = kidWorldByWorldId(s.refId);
    return w ? kidArt(theme, worldTileKey(w.worldId as KidWorldTileId)) : null;
  }
  return kidArt(theme, storyCoverKey(s.refId)) ?? kidArt(theme, worldTileKey("kid-quest"));
}

/** The home strip: every earned souvenir once, newest first (unknown world
 *  ids from an older build are skipped, never shown broken). */
export function souvenirStrip<T extends KidSouvenir>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const s of [...items].sort((a, b) => (a.earnedAt < b.earnedAt ? 1 : a.earnedAt > b.earnedAt ? -1 : 0))) {
    if (seen.has(s.id)) continue;
    if (s.kind === "world" && !kidWorldByWorldId(s.refId)) continue;
    seen.add(s.id);
    out.push(s);
  }
  return out;
}
