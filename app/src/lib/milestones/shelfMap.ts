/**
 * B-LOOP-05 — the catalogue as a SHELF MAP (#/milestones): every milestone on
 * its parent shelf (lib/shelves/registry `milestoneShelf`), the bands of one
 * shelf in ascending age, the one count a shelf may show ("{n} noticed") and
 * a client-side word search over the catalogue text in both languages.
 *
 * FIREWALL: the only number is the count of milestones the parent marked
 * "Seen it" on a shelf. No denominator, no per-band fraction, no "not yet"
 * count, never a comparison between shelves. Bands above the child's
 * current band are for reading, never for ticking (`later`).
 */
import type { Milestone } from "../../types";
import { bandForAgeMonths } from "../milestoneData";
import { milestonesNoticedSince } from "../record/counts";
import { SHELF_IDS, type ShelfId } from "../shelves/registry";
import { shelfOfMilestone } from "./selectByShelf";

const emptyShelves = <T>(make: () => T): Record<ShelfId, T> =>
  Object.fromEntries(SHELF_IDS.map((id) => [id, make()])) as Record<ShelfId, T>;

/** Every milestone on its shelf, catalogue order kept. A row the binding
 *  table cannot place (none today) is left out, never guessed. */
export function groupMilestonesByShelf(milestones: readonly Milestone[]): Record<ShelfId, Milestone[]> {
  const out = emptyShelves<Milestone[]>(() => []);
  for (const m of milestones) {
    const shelf = shelfOfMilestone(m);
    if (shelf) out[shelf].push(m);
  }
  return out;
}

/** "{n} noticed" per shelf: milestones the parent marked "Seen it", read
 *  through the ONE count reader (lib/record/counts, B-GROWTH-35), so the
 *  shelves add up to the number Care and Growth print. */
export function noticedByShelf(milestones: readonly Milestone[]): Record<ShelfId, number> {
  const by = groupMilestonesByShelf(milestones);
  const out = emptyShelves(() => 0);
  for (const id of SHELF_IDS) out[id] = milestonesNoticedSince({ milestones: by[id] }, null);
  return out;
}

export interface ShelfBand {
  /** Band threshold in months; -1 = parent-added rows with no age. */
  months: number;
  items: Milestone[];
  /** Above the child's current band: titles to read, no answers. */
  later: boolean;
  current: boolean;
}

/** One shelf's milestones by band, ascending (earlier bands first, then
 *  later); undated parent-added rows last. */
export function shelfBands(items: readonly Milestone[], currentBandMonths: number): ShelfBand[] {
  const byBand = new Map<number, Milestone[]>();
  for (const m of items) {
    const key = typeof m.ageMonths === "number" ? bandForAgeMonths(m.ageMonths).months : -1;
    const list = byBand.get(key) ?? [];
    list.push(m);
    byBand.set(key, list);
  }
  return [...byBand.entries()]
    .sort((a, b) => (a[0] === -1 ? 1 : b[0] === -1 ? -1 : a[0] - b[0]))
    .map(([months, list]) => ({
      months,
      items: list,
      later: months !== -1 && months > currentBandMonths,
      current: months === currentBandMonths,
    }));
}

/** Case-, accent- and niqqud-insensitive text for the word search. */
export function searchFold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-֑ͯ-ׇ]/g, "")
    .toLowerCase()
    .trim();
}

/** True when every word of the query occurs in one of the texts. */
export function matchesMilestoneQuery(texts: readonly string[], query: string): boolean {
  const words = searchFold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  const hay = texts.map(searchFold).join(" \u0001 ");
  return words.every((w) => hay.includes(w));
}
