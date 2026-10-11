import type { BandSnapshot, PracticeDomain } from "../../types";
import { VOCAB_IDS } from "../domains/registry";

const DOMAINS = new Set(VOCAB_IDS.practice);
export interface SavedMilestoneSnapshot {
  id: string;
  date: string;
  counts: { domain: PracticeDomain; reached: number | null }[];
}
/** Read only the saved numerator. A current denominator/clamp would change
 * the historical fact, and absent legacy counts must never use today's data.
 * Internal grade, signal, and old all-ages total fields are never read. */
export function savedMilestoneHistory(snapshots: readonly BandSnapshot[]): SavedMilestoneSnapshot[] {
  return [...snapshots].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map(snapshot => ({
    id: snapshot.id,
    date: snapshot.date,
    counts: snapshot.bands.filter(row => DOMAINS.has(row.domain)).map(row => ({
      domain: row.domain,
      reached: typeof row.reached === "number" && Number.isSafeInteger(row.reached) && row.reached >= 0 ? row.reached : null,
    })),
  }));
}
