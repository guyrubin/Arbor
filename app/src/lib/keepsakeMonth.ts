/* keepsakeMonth — ENG-14(b): the month keepsake that did not exist.
 *
 * THE DEFECT THIS CLOSES
 * ──────────────────────
 * A grep for month-in-review across the app returned nothing but billing
 * ("monthly"). lib/signalTimeline.ts already builds MonthNodes for the story
 * timeline, so the data was there and the keepsake simply had never been made:
 * the parent could scroll a timeline but was never HANDED the month.
 *
 * WHAT IT BUILDS
 * ──────────────
 * Three or four cards for "{name}'s {Month}": moments kept, milestones
 * noticed, stories made, and — when there is one — a single quote in the
 * parent's OWN words, verbatim.
 *
 * CLINICAL FIREWALL
 * ─────────────────
 * Counts only. No comparison with last month, no delta, no percentage, no
 * trend word, no "best month", no domain ranking, no colour meaning good or
 * bad. `buildMonthKeepsake` deliberately takes ONE month and has no way to see
 * a previous one, so a delta cannot be computed even by accident. A month with
 * two moments is a real month and is rendered with the same warmth as a month
 * with twenty.
 *
 * The parent quote is the parent's own text and is passed through VERBATIM
 * (trimmed only). It is never sent to analytics and never rewritten.
 */

/** The card ids, in render order. Copy lives in i18nElevation/firsts.ts. */
export const MONTH_CARD_IDS = ["moments", "milestones", "stories", "quote"] as const;
export type MonthCardId = (typeof MONTH_CARD_IDS)[number];

export interface MonthKeepsakeInput {
  /** "YYYY-MM" — the month being kept. */
  monthKey: string;
  moments: number;
  milestones: number;
  stories: number;
  /** The parent's own words, verbatim. Optional. */
  parentQuote?: string;
}

export interface MonthKeepsakeCard {
  id: MonthCardId;
  /** Present on the three count cards. */
  count?: number;
  /** Present on the quote card only — the parent's words, unedited. */
  quote?: string;
}

export interface MonthKeepsake {
  monthKey: string;
  /** 1-12, for a localized month name at the render surface. */
  month: number;
  year: number;
  cards: MonthKeepsakeCard[];
}

const clamp = (n: number) => Math.max(0, Math.trunc(n) || 0);

/** "YYYY-MM" for an instant (UTC-stable, like lib/retention's day keys). */
export function monthKeyOf(at: string | number | Date): string | null {
  const ms = at instanceof Date ? at.getTime() : typeof at === "number" ? at : new Date(at).getTime();
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Build the keepsake, or null when the month holds nothing — an empty month
 * gets no card at all rather than three zeros, which would read as a report
 * card on a family that had a hard month.
 */
export function buildMonthKeepsake(input: MonthKeepsakeInput): MonthKeepsake | null {
  const [yearStr, monthStr] = String(input.monthKey || "").split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;

  const counts: Array<{ id: MonthCardId; count: number }> = [
    { id: "moments", count: clamp(input.moments) },
    { id: "milestones", count: clamp(input.milestones) },
    { id: "stories", count: clamp(input.stories) },
  ];
  const cards: MonthKeepsakeCard[] = counts.filter((c) => c.count > 0).map((c) => ({ id: c.id, count: c.count }));

  const quote = (input.parentQuote ?? "").trim();
  if (quote) cards.push({ id: "quote", quote });

  if (!cards.length) return null;
  return { monthKey: input.monthKey, month, year, cards };
}

/**
 * Offer the keepsake once, on the first open of a NEW month, and only when the
 * month that just ended actually held something. Never nags: the caller
 * persists `lastOfferedMonthKey` after showing it.
 */
export function shouldOfferMonthKeepsake(args: {
  lastOfferedMonthKey: string | null | undefined;
  keepsake: MonthKeepsake | null;
  currentMonthKey: string;
}): boolean {
  if (!args.keepsake) return false;
  // The month being kept must be over — never hand a parent a half month.
  if (args.keepsake.monthKey >= args.currentMonthKey) return false;
  return args.lastOfferedMonthKey !== args.keepsake.monthKey;
}

/** localStorage key for the per-child "already offered" marker. */
export const monthKeepsakeStorageKey = (childId: string) => `arbor.keepsake.month.${childId}`;
