/**
 * Device-local per-child state — swept when that child is deleted.
 *
 * `eraseEverything` (childData.ts) sweeps the SERVER: Firestore subcollections,
 * shares, consent, and (since 2026-09-04) that child's Storage prefix. It knows
 * nothing about the browser. Full ACCOUNT deletion separately removes every
 * `arbor`-prefixed key, so account-level erasure was always complete — but
 * deleting ONE child of several left that child's device-local rows behind on
 * the parent's own device, which is the copy they can actually see.
 *
 * Rather than name today's stores and drift, this sweeps by shape: any key that
 * is `arbor`-prefixed AND carries this child's id. New per-child stores are
 * covered the day they are written, provided they keep that convention (see
 * `childScopedKey`). Best-effort by design — a private window or a disabled
 * storage must never block a deletion the parent asked for.
 */

/** The convention every per-child local store must follow to be sweepable. */
export const childScopedKey = (namespace: string, childId: string): string =>
  `arbor.${namespace}.${childId}`;

/**
 * True when `key` is an arbor key scoped to `childId`.
 *
 * The child id must appear as a whole DOT-DELIMITED SEGMENT — either the last
 * one (`arbor.<ns>.<childId>`, the convention `childScopedKey` mints) or an
 * interior one (`arbor.<ns>.<childId>.<variant>`). Requiring the id to be the
 * LAST segment was the original rule, and it leaked twice: keys that append a
 * per-variant suffix after the id — `arbor.growth.month.seen.<childId>.2026-09`
 * (one row per month, forever) and `arbor.todaysFocus.<childId>.<aiLang>` —
 * were `arbor.`-prefixed, unmistakably about one child, and swept by nothing.
 *
 * Matching an interior segment is a WIDENING of the sweep, never a weakening:
 * the dots on both sides keep it a segment match, so a sibling whose id merely
 * shares a prefix (`kid-abc` vs `kid-a`) still cannot be caught. The mint-side
 * convention below is unchanged and remains what new stores should follow —
 * this side simply stops depending on every author remembering it.
 */
export const isChildScopedKey = (key: string, childId: string): boolean =>
  key.startsWith("arbor.") &&
  childId.length > 0 &&
  (key.endsWith(`.${childId}`) || key.includes(`.${childId}.`));

/** The count is useful even if another key could not be checked or removed. */
export type ChildLocalSweep = { removed: number; complete: boolean };

function sweep(storage: Storage | null | undefined, childId: string): ChildLocalSweep {
  const result: ChildLocalSweep = { removed: 0, complete: true };
  if (!storage) return result;
  // Collect before removing: Storage reindexes after removeItem. A failed
  // enumeration must not strand reachable keys or be reported as complete.
  let length: number;
  try {
    length = storage.length;
    if (!Number.isSafeInteger(length) || length < 0) throw new Error("Invalid storage length");
  } catch {
    return { removed: 0, complete: false };
  }
  const doomed: string[] = [];
  for (let i = 0; i < length; i++) {
    try {
      const key = storage.key(i);
      if (key === null) result.complete = false;
      else if (isChildScopedKey(key, childId)) doomed.push(key);
    } catch {
      result.complete = false;
    }
  }
  for (const key of doomed) {
    try {
      storage.removeItem(key);
      if (storage.getItem(key) === null) result.removed++;
      else result.complete = false;
    } catch {
      result.complete = false;
    }
  }
  return result;
}

/** Detailed, best-effort sweep for the deletion receipt. Accessing a browser's
 * Storage property can itself throw (e.g. denied access); the other store
 * must still be swept and the receipt must say the first was not reached. */
export function sweepChildLocalState(
  childId: string,
  stores?: { local?: Storage | null; session?: Storage | null },
): ChildLocalSweep {
  if (!childId) return { removed: 0, complete: false };
  const run = (provided: Storage | null | undefined, name: "localStorage" | "sessionStorage"): ChildLocalSweep => {
    try {
      return sweep(provided === undefined ? globalThis[name] : provided, childId);
    } catch {
      return { removed: 0, complete: false };
    }
  };
  const local = run(stores?.local, "localStorage");
  const session = run(stores?.session, "sessionStorage");
  return { removed: local.removed + session.removed, complete: local.complete && session.complete };
}

/** Retain the count-only, never-throw contract for existing callers. */
export function clearChildLocalState(
  childId: string,
  stores?: { local?: Storage | null; session?: Storage | null },
): number {
  return sweepChildLocalState(childId, stores).removed;
}
