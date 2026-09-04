/**
 * LC-21 — which Learn reads this parent has already opened, on this device.
 *
 * The Learn Library shipped with a save (server, per-child) and a helpfulness
 * pulse (device, per-device) but nothing that remembered an OPEN. A parent who
 * had worked through a dozen reads came back to a shelf that looked untouched,
 * and the only way to tell was to recognise a title.
 *
 * SCOPE — per child, deliberately. Everything the parent sees on this shelf is
 * already scoped to the active child: the age window that decides which cards
 * are visible at all, the focus-domain ranking, and `savedLearn` (a per-child
 * server collection). A device-wide read marker would be the one row in that
 * surface that ignored the child switcher — a card opened for a seven-year-old
 * would come back marked while browsing for the toddler, next to a saved list
 * that had correctly reset. Per child also gives deletion the right answer: a
 * removed child's shelf goes back to untouched.
 *
 * The key is minted by `lib/childLocalState.childScopedKey`, so the id lands in
 * its own dot-delimited segment (`arbor.learn.read.<childId>`) and
 * `clearChildLocalState` sweeps it when that child is deleted. Never glue a
 * suffix onto the id — four keys have escaped that sweep exactly that way.
 *
 * CLINICAL FIREWALL: this records what the PARENT did — opened a read. It is
 * card ids and nothing else: no timestamps about the child, no completion
 * fraction, no streak, no score. Consumers may show a marker and a COUNT of
 * what the parent read. A percentage, a ring, or any framing that reads as a
 * verdict on the child is out of bounds.
 *
 * DEGRADES SILENTLY: a private window, a disabled store, a cleared device or a
 * corrupt value all mean "no reads yet" — the library renders correctly and
 * unmarked. Nothing here ever throws.
 */
import { childScopedKey } from "../lib/childLocalState";

/** Namespace half of `arbor.learn.read.<childId>`. */
const NAMESPACE = "learn.read";

/** The device-local key holding one child's opened-read ids. */
export const learnReadKey = (childId: string): string => childScopedKey(NAMESPACE, childId);

/**
 * Ceiling on remembered ids. The catalogue is 75 cards today; the cap exists so
 * a store fed junk (or a catalogue that grows for years) cannot become an
 * unbounded row on the parent's device. Most-recently-opened is kept.
 */
export const MAX_TRACKED_READS = 400;

/** The slice of `Storage` this module uses — so tests can inject a store. */
export type ReadStateStore = Pick<Storage, "getItem" | "setItem">;

const getStore = (): ReadStateStore | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Some browsers throw on the ACCESS, not the call, when storage is blocked.
    return null;
  }
};

/**
 * The card ids this parent has opened for this child, most recent first.
 * Returns `[]` for every failure mode — that is the unmarked library.
 */
export function readLearnReadIds(
  childId: string,
  store: ReadStateStore | null = getStore(),
): string[] {
  if (!childId || !store) return [];
  try {
    const raw = store.getItem(learnReadKey(childId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const entry of parsed) {
      if (typeof entry !== "string") continue;
      const id = entry.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
      if (out.length >= MAX_TRACKED_READS) break;
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Record that this parent opened `cardId` for this child. Returns the new list
 * (most recent first) so a caller can render immediately.
 *
 * A failed write still returns the updated list: the tap the parent just made
 * stays true for this session and is simply not remembered after a reload. That
 * is the silent degrade — never an error, never a blocked open.
 */
export function markLearnCardRead(
  childId: string,
  cardId: string,
  store: ReadStateStore | null = getStore(),
): string[] {
  const id = (cardId ?? "").trim();
  const current = readLearnReadIds(childId, store);
  if (!childId || !id) return current;
  const next = [id, ...current.filter((c) => c !== id)].slice(0, MAX_TRACKED_READS);
  if (store) {
    try {
      store.setItem(learnReadKey(childId), JSON.stringify(next));
    } catch {
      /* private window or a full store — the shelf just forgets on reload */
    }
  }
  return next;
}

/** True when this card is one the parent has already opened. */
export const isLearnCardRead = (readIds: readonly string[], cardId: string): boolean =>
  readIds.includes(cardId);

/**
 * How many of `cardIds` the parent has opened.
 *
 * Intersected with the catalogue on purpose: an id left over from a card that
 * has since gone dark (a withdrawn pilot read, a retired card) must not inflate
 * the number the parent is shown. A COUNT of the parent's own reading — never a
 * fraction, never a verdict.
 */
export function learnReadCount(
  readIds: readonly string[],
  cardIds: readonly string[],
): number {
  const seen = new Set(readIds);
  let n = 0;
  for (const id of cardIds) if (seen.has(id)) n += 1;
  return n;
}
