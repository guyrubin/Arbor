import { keptDay, type KeptThing } from "./kept/keptThings";

export interface MonthPage {
  monthKey: string;
  items: KeptThing[];
}

/** One calendar month, oldest first. No count, delta, score or generated
 * quote input exists. The parent's own dated words are already kept items. */
export function buildMonthPage({ monthKey, kept }: { monthKey: string; kept: readonly KeptThing[] }): MonthPage | null {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(monthKey)) return null;
  const items = kept.filter(item => keptDay(item.at)?.slice(0, 7) === monthKey)
    .slice().sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));
  return items.length ? { monthKey, items } : null;
}

/** UTC month of an instant, retained for existing non-UI date callers. */
export function monthKeyOf(at: string | number | Date): string | null {
  const ms = at instanceof Date ? at.getTime() : typeof at === "number" ? at : Date.parse(at);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 7) : null;
}
