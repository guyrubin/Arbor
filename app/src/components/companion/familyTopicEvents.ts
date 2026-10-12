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
