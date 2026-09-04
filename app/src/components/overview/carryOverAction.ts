/* ════════════════════════════════════════════════════════════════════════════
   carryOverAction — ENG-12: an accepted step must not vanish at midnight.

   `activeTodayAction` resolves through `todayActionId(childId)`, whose id
   embeds TODAY's calendar date. So a step the parent accepted at 21:00 and
   never reported on is unreachable at 00:01: TodayActionLoop renders null, the
   outcome question is never asked again, and the loop the whole surface exists
   to close stays open forever. The record is still in `actionLoops` — nothing
   reads it.

   This module is the pure selector for that orphan. Rules:
     · only `status: "accepted"` (a completed step has already been answered),
     · never today's own step (that one is the active action),
     · a WINDOW: after `MAX_CARRY_DAYS` the memory of the evening is gone and
       asking is noise, not closure — the record stays in the ledger and in
       the journal thread, it just stops asking,
     · newest first, ONE at a time. A queue of stale questions is a chore list.

   No React, no Date.now() baked in (callers pass `now`) — unit-testable.
   ════════════════════════════════════════════════════════════════════════════ */

export type CarryOverEntry = {
  id: string;
  status: "accepted" | "completed";
  acceptedAt: string;
  recommendation: string;
};

/** How long a still-open step keeps asking. Beyond this it is history, not a question. */
export const MAX_CARRY_DAYS = 7;

const DAY = 86_400_000;

/**
 * The single still-open step from a PREVIOUS day, or null.
 * `todayId` is `todayActionId(childId)` — passed in so this stays pure.
 * `skippedIds` are steps the parent explicitly waved off (never re-asked).
 */
export function selectCarryOverAction<T extends CarryOverEntry>(
  entries: readonly T[],
  todayId: string,
  now: number = Date.now(),
  skippedIds: readonly string[] = [],
): T | null {
  const skipped = new Set(skippedIds);
  const cutoff = now - MAX_CARRY_DAYS * DAY;
  let best: T | null = null;
  let bestAt = -Infinity;
  for (const entry of entries) {
    if (entry.status !== "accepted") continue;
    if (entry.id === todayId) continue;
    if (skipped.has(entry.id)) continue;
    if (!entry.recommendation?.trim()) continue;
    const at = Date.parse(entry.acceptedAt);
    if (!Number.isFinite(at) || at < cutoff || at > now) continue;
    if (at > bestAt) {
      best = entry;
      bestAt = at;
    }
  }
  return best;
}

const SKIP_KEY = "arbor.actionLoop.carryOverSkipped";

/** Skipped-step ids, per device. Best-effort: storage failures never block the UI. */
export function readSkippedCarryOvers(): string[] {
  try {
    const raw = window.localStorage.getItem(SKIP_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Remember a waved-off step. Capped so the marker can't grow without bound. */
export function rememberSkippedCarryOver(id: string): string[] {
  const next = [id, ...readSkippedCarryOvers().filter((x) => x !== id)].slice(0, 50);
  try {
    window.localStorage.setItem(SKIP_KEY, JSON.stringify(next));
  } catch {
    /* marker is best-effort */
  }
  return next;
}
