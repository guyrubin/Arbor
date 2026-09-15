/**
 * captureUndo.ts — N1-08: the reversal of a Keep, in the frame where the
 * judgement was made.
 *
 * WHY THIS IS A FIREWALL DEFENCE, NOT A CONVENIENCE
 * ─────────────────────────────────────────────────
 * Every count Arbor renders to a parent is honest only because the parent chose
 * each row it counts. A choice that cannot be unmade in the frame where it was
 * made is not a choice; it is a tap. Undo is the cheapest defence of every
 * count on every surface.
 *
 * WHAT IT REUSES — nothing here is new machinery
 * ──────────────────────────────────────────────
 *  · `ConversationProposalStatus` already carried `"undone"`
 *    (lib/conversationProposals.ts:5) and `conversationChanges` is a registered
 *    child sub-collection (lib/childData.ts:31) whose whole purpose is
 *    reversible audit metadata. Both were written and neither had a caller.
 *  · `ArborContext.undoConversationChange` (ArborContext.tsx:1428) is the
 *    existing reversal seam — also written, also with zero callers until now.
 *    It restores a milestone's `previousValue`, drops the DERIVED behaviourLogs
 *    row, and upserts the change record with `status: "undone"`. This module
 *    wraps it; it does not replace it.
 *  · `context/ToastContext.tsx` `ToastAction` has carried a single-action slot
 *    since CR-09, and a toast WITH an action is deliberately never
 *    auto-dismissed. The undo IS that action — no new component, no new surface,
 *    and no silent expiry window.
 *
 * WHAT IS NEVER DELETED
 * ─────────────────────
 * The audit record. A reversal is a STATUS TRANSITION on the
 * ConversationChangeRecord — `committed` → `undone` — so the trail survives:
 * the parent kept this, then unkept it, and both facts are on the record. This
 * module never removes a `conversationChanges` document, and the guard asserts
 * it (`undoKeptCapture` is handed no delete seam at all, so it could not).
 *
 * MILESTONES ARE EXCLUDED — critic-vision BLOCK #1
 * ────────────────────────────────────────────────
 * Milestone confirmations stay one-at-a-time and age-banded, and a milestone's
 * reversal path is the milestone surface's own, not a toast on another screen.
 * The exclusion is enforced HERE, at the reversal, as well as at the two call
 * sites — so a future surface that wires an undo toast to a milestone keep
 * still cannot reverse one through this module.
 */
import type { ConversationChangeRecord } from "./conversationProposals";

export type UndoRefusal =
  /** No committed audit record with that id — nothing to reverse. */
  | "not_found"
  /** Already reversed. The second press of a two-press Undo lands here. */
  | "already_undone"
  /** A milestone confirmation. BLOCK #1 — not reversible from here, ever. */
  | "milestone_excluded";

export type UndoOutcome =
  | { undone: true; record: ConversationChangeRecord }
  | { undone: false; reason: UndoRefusal };

/**
 * The refusal behind an outcome, or null when the reversal landed.
 *
 * NOT ceremony: `app/tsconfig.json` does not set `strict`, so
 * `strictNullChecks` is off, and without it TypeScript will not narrow a union
 * on a BOOLEAN-literal discriminant — `outcome.undone ? … : outcome.reason` is
 * a compile error (TS2339). Callers read the refusal through this accessor.
 */
export function undoRefusalOf(outcome: UndoOutcome): UndoRefusal | null {
  return outcome.undone === true ? null : (outcome as { reason: UndoRefusal }).reason;
}

export interface CaptureUndoDeps {
  /**
   * Reads the CURRENT audit collection. A FUNCTION, not an array, and that is
   * load-bearing: the Undo is pressed from a toast whose closure was created
   * in the render BEFORE the commit landed, so a captured array would be stale
   * and every undo would refuse with `not_found`.
   */
  readChanges: () => readonly ConversationChangeRecord[];
  /** `ArborContext.undoConversationChange`. The only writer this module has. */
  undoChange: (id: string) => void | Promise<void>;
}

/** Is this record reversible from a Keep toast at all? */
export function isUndoableCapture(
  record: ConversationChangeRecord | undefined,
): record is ConversationChangeRecord {
  if (!record) return false;
  if (record.target === "milestone") return false;
  return record.status === "committed";
}

/** Why a record cannot be reversed — the refusal a caller reports. */
function refusalFor(record: ConversationChangeRecord | undefined): UndoRefusal {
  if (!record) return "not_found";
  if (record.target === "milestone") return "milestone_excluded";
  return "already_undone";
}

/**
 * Reverse one kept capture. Idempotent: a second call finds the record already
 * `"undone"` and returns without touching the writer, so a double-press is a
 * no-op rather than a second audit row.
 *
 * Returns an outcome rather than throwing — the caller is a toast action, and a
 * rejected promise inside a toast handler is an unhandled rejection.
 */
export async function undoKeptCapture(
  changeId: string,
  deps: CaptureUndoDeps,
): Promise<UndoOutcome> {
  const record = deps.readChanges().find((item) => item.id === changeId);
  if (!isUndoableCapture(record)) {
    return { undone: false, reason: refusalFor(record) };
  }
  await deps.undoChange(changeId);
  return { undone: true, record: { ...record, status: "undone" } };
}
