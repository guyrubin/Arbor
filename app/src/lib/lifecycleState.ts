/* ════════════════════════════════════════════════════════════════════════════
   lifecycleState — the "already said that" ledger behind lib/lifecycle.ts.

   The spine is pure and stateless: it will happily offer the first-week
   keepsake on every open of day 8, 9 and 10. What stops that is this ledger —
   the set of occurrence keys already shown, plus the age band recorded on the
   last resolved open (so a band CHANGE is detectable at all).

   STORAGE: device-local, through the `arbor.<namespace>.<childId>` convention
   that lib/childLocalState.ts sweeps when a child is deleted. Keeping the
   convention is what makes this store disappear with the child without
   childLocalState having to name it.

   KNOWN LIMIT (deliberate, honest): the deep-analysis plan asks for a
   server-anchored ledger on the child doc so the state survives a device
   switch. The ANCHOR itself already is server-side — `onboardingCompletedAt`
   on the child profile — so lifecycle DAY is identical on every device. Only
   the already-shown ledger is local, which means a parent who switches devices
   in week two can meet the first-week keepsake once more. That is a repeated
   keepsake, not a wrong one, and it is the failure mode worth having while the
   child-doc schema is owned elsewhere.

   The ENG-L2 ask is the exception that does not need the server: it is
   suppressed by `interests[]` on the profile itself, so answering on one
   device silences it everywhere.

   Never throws. A private window, a full quota or a disabled store degrades to
   "nothing remembered" — a repeated card, never a crash.
   ════════════════════════════════════════════════════════════════════════════ */

import { childScopedKey } from "./childLocalState";

/** Namespace under the sweepable `arbor.<ns>.<childId>` convention. */
export const LIFECYCLE_NAMESPACE = "lifecycle";

/** Keys are cheap; a cap stops an unbounded array on a very long-lived account. */
const MAX_SEEN = 40;

export interface LifecycleLedger {
  /** Occurrence keys already shown on this device. */
  seen: string[];
  /** The child's play band as of the last resolved open. */
  band: string | null;
}

const EMPTY: LifecycleLedger = { seen: [], band: null };

function storageKey(childId: string): string {
  return childScopedKey(LIFECYCLE_NAMESPACE, childId);
}

/**
 * The store, injectable. The vitest environment is node-only, so `localStorage`
 * genuinely does not exist there — the tests pass a Storage double exactly the
 * way childLocalState.test.ts does, rather than asserting against a no-op.
 */
function store(injected?: Storage | null): Storage | null {
  if (injected !== undefined) return injected;
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readLifecycleLedger(childId: string, storage?: Storage | null): LifecycleLedger {
  if (!childId) return { ...EMPTY };
  const s = store(storage);
  if (!s) return { ...EMPTY };
  try {
    const raw = s.getItem(storageKey(childId));
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return { ...EMPTY };
    const rec = parsed as Partial<LifecycleLedger>;
    const seen = Array.isArray(rec.seen) ? rec.seen.filter((k): k is string => typeof k === "string") : [];
    const band = typeof rec.band === "string" && rec.band ? rec.band : null;
    return { seen: seen.slice(-MAX_SEEN), band };
  } catch {
    return { ...EMPTY };
  }
}

function write(childId: string, next: LifecycleLedger, storage?: Storage | null): void {
  const s = store(storage);
  if (!s) return;
  try {
    s.setItem(storageKey(childId), JSON.stringify({ seen: next.seen.slice(-MAX_SEEN), band: next.band }));
  } catch {
    /* a full or disabled store must never break the screen */
  }
}

/** Record that an occurrence has been shown. Idempotent. */
export function markLifecycleSeen(childId: string, key: string, storage?: Storage | null): LifecycleLedger {
  const current = readLifecycleLedger(childId, storage);
  if (!childId || !key || current.seen.includes(key)) return current;
  const next: LifecycleLedger = { seen: [...current.seen, key], band: current.band };
  write(childId, next, storage);
  return next;
}

/**
 * Record the band seen on this open, so the NEXT open can detect a change.
 * Returns the ledger as it now stands.
 */
export function recordLifecycleBand(
  childId: string,
  band: string | null,
  storage?: Storage | null,
): LifecycleLedger {
  const current = readLifecycleLedger(childId, storage);
  if (!childId || !band || current.band === band) return current;
  const next: LifecycleLedger = { seen: current.seen, band };
  write(childId, next, storage);
  return next;
}
