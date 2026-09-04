/**
 * GP-11 — in-progress Development Check answers survive a refresh.
 *
 * The screener held its answers in component state only, so a phone call, a
 * background tab eviction or an accidental reload wiped 5–6 answers with no
 * warning. Parents run this surface when they are already anxious; making them
 * start over is the worst possible moment to lose their work.
 *
 * `sessionStorage`, not `localStorage`, on purpose: an abandoned half-check
 * should not greet the parent weeks later as if it were unfinished business.
 * Keyed by child AND band so a sibling switch or a birthday never restores
 * someone else's answers.
 *
 * Every storage call is wrapped: Safari private mode and "block site data"
 * settings throw on access, and losing a draft must never take the screener
 * down with it.
 */

import type { ScreenAnswer } from "./screening";

const PREFIX = "arbor.screen.draft";
const VALID: readonly ScreenAnswer[] = ["yes", "sometimes", "not_yet"];

export interface ScreeningDraft {
  readonly answers: Record<string, ScreenAnswer>;
  readonly savedAt: string;
}

export function screeningDraftKey(childId: string, bandId: string): string {
  return `${PREFIX}.${childId}.${bandId}`;
}

/** The session store, or null in a non-browser/blocked context. */
function store(explicit?: Storage | null): Storage | null {
  if (explicit !== undefined) return explicit;
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Restore answers for this child+band. Unknown item ids and unknown answer
 * values are dropped rather than trusted: a stale draft from an older item
 * bank must never inject an answer the current band cannot score.
 */
export function readScreeningDraft(
  childId: string,
  bandId: string,
  itemIds: readonly string[],
  explicit?: Storage | null,
): Record<string, ScreenAnswer> | null {
  const s = store(explicit);
  if (!s || !childId || !bandId) return null;
  let raw: string | null = null;
  try {
    raw = s.getItem(screeningDraftKey(childId, bandId));
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const answers = (parsed as ScreeningDraft | null)?.answers;
  if (!answers || typeof answers !== "object") return null;
  const allowed = new Set(itemIds);
  const clean: Record<string, ScreenAnswer> = {};
  for (const [id, value] of Object.entries(answers as Record<string, unknown>)) {
    if (allowed.has(id) && VALID.includes(value as ScreenAnswer)) clean[id] = value as ScreenAnswer;
  }
  return Object.keys(clean).length > 0 ? clean : null;
}

/** Persist (or clear, when empty) the in-progress answers. Never throws. */
export function writeScreeningDraft(
  childId: string,
  bandId: string,
  answers: Record<string, ScreenAnswer>,
  explicit?: Storage | null,
  now: Date = new Date(),
): void {
  const s = store(explicit);
  if (!s || !childId || !bandId) return;
  try {
    if (Object.keys(answers).length === 0) {
      s.removeItem(screeningDraftKey(childId, bandId));
      return;
    }
    const draft: ScreeningDraft = { answers, savedAt: now.toISOString() };
    s.setItem(screeningDraftKey(childId, bandId), JSON.stringify(draft));
  } catch {
    /* storage blocked — the check still works, it just will not survive a reload */
  }
}

/** Drop the draft. Called on submit and on an explicit "start over". */
export function clearScreeningDraft(childId: string, bandId: string, explicit?: Storage | null): void {
  const s = store(explicit);
  if (!s || !childId || !bandId) return;
  try {
    s.removeItem(screeningDraftKey(childId, bandId));
  } catch {
    /* no-op */
  }
}
