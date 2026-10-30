import { keptDay, type KeptThing } from "./kept/keptThings";
import { buildMonthPage, type MonthPage } from "./keepsakeMonth";

export interface YearBook {
  yearKey: string;
  months: MonthPage[];
}

/** One calendar year of parent-kept words and firsts, oldest month first.
 * No count, score, or generated sentence. An empty or malformed year is null. */
export function buildYearBook({ yearKey, kept }: { yearKey: string; kept: readonly KeptThing[] }): YearBook | null {
  if (!/^\d{4}$/.test(yearKey)) return null;
  const months: MonthPage[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const page = buildMonthPage({ monthKey: `${yearKey}-${String(month).padStart(2, "0")}`, kept });
    if (page) months.push(page);
  }
  return months.length ? { yearKey, months } : null;
}

/** Calendar years that hold at least one kept thing, newest first. */
export function yearKeysOf(kept: readonly KeptThing[]): string[] {
  const years = new Set<string>();
  for (const item of kept) {
    const year = keptDay(item.at)?.slice(0, 4);
    if (year) years.add(year);
  }
  return [...years].sort((a, b) => b.localeCompare(a));
}
