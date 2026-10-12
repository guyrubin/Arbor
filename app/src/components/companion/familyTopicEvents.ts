/**
 * FEAT-05 — the ONE way into "What we're exploring" (FamilyTopicSheet) from
 * anywhere in the parent app.
 *
 * The sheet's open state lives in Shell, which owns the single listener for
 * this event (and the Kid Mode gate in front of it). Callers — the question
 * chip in the conversation header, the line on Together, and later doors —
 * dispatch; none of them adds a listener of its own, and nothing reaches the
 * sheet through a new ArborContext field.
 */
export const FAMILY_TOPIC_SHEET_EVENT = "arbor:open-family-topic-sheet";

/** Optional: open straight into a new question, carrying the parent's words. */
export type FamilyTopicSheetRequest = {
  startNew?: boolean;
  draft?: string;
  observationIds?: string[];
};

/** A plain open carries no detail (the event's detail reads null). */
export function openFamilyTopicSheet(request?: FamilyTopicSheetRequest): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<FamilyTopicSheetRequest | null>(FAMILY_TOPIC_SHEET_EVENT, { detail: request ?? null }));
}

/**
 * v3 F-NOW-1: the question chip's edit glyph opens the sheet on THAT
 * question. Shell's single listener opens the sheet without a payload, so
 * the chip leaves the id here first and the sheet reads it as it mounts
 * (a pure read, so a double render reads it twice) and clears it once
 * mounted. A request the sheet never picks up (the open was dropped) goes
 * stale on its own and never opens a later sheet in edit mode.
 */
const EDIT_TTL_MS = 10_000;
let pendingEdit: { id: string; at: number } | null = null;

export function requestFamilyTopicEdit(id: string): void {
  pendingEdit = { id, at: Date.now() };
}

/** The question the next sheet should open on, while the request is fresh. */
export function pendingFamilyTopicEdit(now: number = Date.now()): string | null {
  return pendingEdit && now - pendingEdit.at >= 0 && now - pendingEdit.at < EDIT_TTL_MS ? pendingEdit.id : null;
}

export function clearFamilyTopicEdit(): void {
  pendingEdit = null;
}
