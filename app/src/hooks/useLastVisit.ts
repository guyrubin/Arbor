/* ════════════════════════════════════════════════════════════════════════════
   useLastVisit — W1 1.1 two-slot per-child visit tracking (masterplan
   ARBOR-UI-MASTERPLAN-2026-08-11 §3, Maytal Row-1 #1).

   On app open (the hook is mounted ONCE, from OverviewTab) it reads the child
   profile's PRIOR `lastVisitAt`, then stamps the current open — with two slots
   so the stamp never overwrites the timestamp the "Since your last visit"
   strip needs to read:

     lastVisitAt          = most recent open (bumped within a session)
     lastVisitPreviousAt  = the visit BEFORE it (rotated only on a 30+ min gap)

   Debounce: a tab refresh is not a new visit. Slots rotate only when the gap
   since `lastVisitAt` is ≥ VISIT_GAP_MS (30 min); smaller gaps at most bump
   `lastVisitAt` (and only after 60s, so React StrictMode's double-mount and
   rapid refreshes write nothing).

   STORAGE: fields on the child profile document, written through the existing
   ProfileContext.updateChild path — the same seam MilestonesTab / WowOnboarding
   use. They therefore ride the existing profile sync + GDPR export/erase
   surface; NO new Firestore subcollection is created (the CHILD_SUBCOLLECTIONS
   guard stays sighted). In the local sandbox ProfileContext mirrors profiles
   to localStorage, so the same call works offline.

   CLINICAL FIREWALL: timestamps only — never compared into a trend, never a
   score. Consumers render EVENT language ("2 moments captured"), enforced by
   sinceLastVisit.test.ts.
   ════════════════════════════════════════════════════════════════════════════ */
import { useEffect, useRef, useState } from "react";
import { useProfile } from "../context/ProfileContext";
import type { ChildProfile } from "../types";

/** A gap of 30+ minutes between opens counts as a NEW visit (slots rotate). */
export const VISIT_GAP_MS = 30 * 60_000;

/** Within a session, bump the current slot at most once per minute. */
export const VISIT_BUMP_MIN_MS = 60_000;

export type VisitTransition = {
  /** The visit the "since" strip should anchor on — null means first visit. */
  previousVisitAt: string | null;
  /**
   * Profile patch to persist, or null when nothing should be written.
   * NOTE: `lastVisitPreviousAt` is present ONLY on rotation — an `undefined`
   * field value would make Firestore's updateDoc throw.
   */
  patch: { lastVisitAt: string; lastVisitPreviousAt?: string } | null;
};

/**
 * Pure two-slot transition (unit-tested without React):
 *  - no/unreadable current slot → first visit: stamp current, previous = null.
 *  - gap ≥ 30 min → NEW visit: rotate (previous ← current, current ← now).
 *  - gap < 30 min → same visit: keep slots; bump current only after 60s.
 */
export function computeVisitTransition(
  prevSlot: string | undefined,
  currSlot: string | undefined,
  nowMs: number
): VisitTransition {
  const nowIso = new Date(nowMs).toISOString();
  const currMs = currSlot ? Date.parse(currSlot) : NaN;
  if (!Number.isFinite(currMs)) {
    // First-ever open (or corrupt slot): establish the current slot only.
    return { previousVisitAt: null, patch: { lastVisitAt: nowIso } };
  }
  const gap = nowMs - currMs;
  if (gap >= VISIT_GAP_MS) {
    // A new visit: the old current slot becomes the previous visit.
    return {
      previousVisitAt: currSlot!,
      patch: { lastVisitAt: nowIso, lastVisitPreviousAt: currSlot! },
    };
  }
  // Same visit (refresh / quick reopen / clock skew): the strip keeps anchoring
  // on the visit BEFORE this session — that is exactly the previous slot.
  const prevMs = prevSlot ? Date.parse(prevSlot) : NaN;
  const previousVisitAt = Number.isFinite(prevMs) ? prevSlot! : null;
  if (gap >= VISIT_BUMP_MIN_MS) {
    return { previousVisitAt, patch: { lastVisitAt: nowIso } };
  }
  return { previousVisitAt, patch: null };
}

export type LastVisitResult = {
  /** ISO timestamp of the visit before this one, or null on a first visit. */
  previousVisitAt: string | null;
  /** True when there IS a prior visit to tell the parent about. */
  isReturning: boolean;
};

/**
 * Mount ONCE per screen (OverviewTab). Reads the prior slot(s) for the active
 * child, resolves `previousVisitAt`, and persists the current open through the
 * existing profile-update seam. Runs once per child per mount cycle.
 */
export function useLastVisit(child: ChildProfile): LastVisitResult {
  const { updateChild, loading } = useProfile();
  const [previousVisitAt, setPreviousVisitAt] = useState<string | null>(null);
  // One stamp per child id per mount cycle — a profile-state update after our
  // own write must not re-trigger the transition.
  const stampedFor = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !child.id) return;
    if (stampedFor.current === child.id) return;
    stampedFor.current = child.id;
    const { previousVisitAt: prev, patch } = computeVisitTransition(
      child.lastVisitPreviousAt,
      child.lastVisitAt,
      Date.now()
    );
    setPreviousVisitAt(prev);
    if (patch) void updateChild(child.id, patch);
    // Intentionally keyed on load-completion + child identity only: the slots
    // we read are inputs to a once-per-visit transition, not live bindings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, child.id]);

  return { previousVisitAt, isReturning: previousVisitAt !== null };
}
