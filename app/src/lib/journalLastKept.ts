import type { TimelineSignal } from "./signalTimeline";

/**
 * Critic r1 (W2-ASKJB journal) + B-ASKJB-NEW-1d — "Last kept".
 *
 * An empty WEEK is not an empty RECORD. When the week holds no moment but the
 * thread does, the page must not say "begin" or "the first moment": it names
 * the parent's last kept moment instead — its date and the parent's OWN words
 * (the row's text, never generated). Pure: the newest dated moment signal, or
 * null when the record holds none.
 */
export interface LastKept {
  id: string;
  at: string;
  /** The parent's own words from that row (`detail` = trigger, else notes);
   *  "" when the row has none. `refTitle` is the taxonomy key, not words. */
  words: string;
}

export function lastKeptMoment(signals: readonly TimelineSignal[]): LastKept | null {
  let best: TimelineSignal | null = null;
  for (const s of signals) {
    if (s.kind !== "moment" || !s.at) continue;
    if (!best || s.at > best.at!) best = s;
  }
  if (!best) return null;
  const words = (best.detail || "").trim();
  return { id: best.id, at: best.at!, words };
}

/** Which header copy the journal story line uses (record-aware, not week-only). */
export type JournalStoryState = "week" | "quiet-week" | "empty-record";

export function journalStoryState(weekCount: number, last: LastKept | null): JournalStoryState {
  if (weekCount > 0) return "week";
  return last ? "quiet-week" : "empty-record";
}
