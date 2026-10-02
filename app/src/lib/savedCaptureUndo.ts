/**
 * savedCaptureUndo.ts — B-TODAY-20: Undo of a capture saved from the ONE
 * capture sheet (QuickLogModal reply panel).
 *
 * WHY NOT lib/captureUndo: that module reverses a KEEP from a conversation as
 * a status transition on its audit record, and its N1-08 guard forbids it any
 * delete seam. A moment saved straight from the sheet (addMoment /
 * handleAddLog) has no audit record — the parent wrote every word and the row
 * IS the record — so its reversal, offered a beat after the save in the same
 * frame, is the removal of that row. Same outcome contract as
 * undoKeptCapture: an outcome, never a throw; idempotent (a second press finds
 * no row and refuses with "not_found" without calling the writer).
 */

export interface SavedCaptureUndoDeps {
  /** Reads the CURRENT behaviour-log ids (a function — the reply panel's
   *  closure was created in the render that saved). */
  readLogIds: () => readonly string[];
  /** `ArborContext.deleteLog`. */
  removeLog: (id: string) => void | Promise<void>;
}

export type SavedUndoOutcome = { undone: true; id: string } | { undone: false; reason: "not_found" };

export async function undoSavedCapture(logId: string, deps: SavedCaptureUndoDeps): Promise<SavedUndoOutcome> {
  if (!logId || !deps.readLogIds().includes(logId)) return { undone: false, reason: "not_found" };
  await deps.removeLog(logId);
  return { undone: true, id: logId };
}
