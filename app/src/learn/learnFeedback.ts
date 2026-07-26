/**
 * Per-device "was this helpful" pulse for Learn cards (LL-A11).
 *
 * Deliberately a device-local preference, not a child collection: it carries
 * no child data (card id → 1|-1) and exists only to tune this device's
 * ranking. Counts only; no free text.
 */
const KEY = "arbor.learnFeedback";

export type LearnFeedback = Record<string, 1 | -1>;

export function readLearnFeedback(): LearnFeedback {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: LearnFeedback = {};
    for (const [id, v] of Object.entries(parsed)) {
      if (v === 1 || v === -1) out[id] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Set (or clear, with null) the pulse for one card; returns the new map. */
export function setLearnFeedback(cardId: string, value: 1 | -1 | null): LearnFeedback {
  const next = readLearnFeedback();
  if (value === null) delete next[cardId];
  else next[cardId] = value;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — pulse is best-effort */
  }
  return next;
}
