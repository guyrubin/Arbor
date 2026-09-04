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

/** True when `key` is an arbor key scoped to `childId`. */
export const isChildScopedKey = (key: string, childId: string): boolean =>
  key.startsWith("arbor.") && childId.length > 0 && key.endsWith(`.${childId}`);

function sweep(storage: Storage | null | undefined, childId: string): number {
  if (!storage) return 0;
  let removed = 0;
  try {
    // Collect first: removing during iteration reindexes the store.
    const doomed: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && isChildScopedKey(key, childId)) doomed.push(key);
    }
    for (const key of doomed) {
      try {
        storage.removeItem(key);
        removed++;
      } catch {
        /* one stubborn key must not abandon the rest */
      }
    }
  } catch {
    /* storage unavailable — nothing to sweep */
  }
  return removed;
}

/**
 * Remove every device-local record scoped to one child. Returns how many keys
 * were removed, for the deletion receipt. Never throws.
 */
export function clearChildLocalState(
  childId: string,
  stores?: { local?: Storage | null; session?: Storage | null },
): number {
  if (!childId) return 0;
  const local = stores?.local ?? (typeof localStorage === "undefined" ? null : localStorage);
  const session = stores?.session ?? (typeof sessionStorage === "undefined" ? null : sessionStorage);
  return sweep(local, childId) + sweep(session, childId);
}
