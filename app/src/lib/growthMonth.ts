/* ════════════════════════════════════════════════════════════════════════════
   growthMonth — GP-32: the month-in-review derivation for Growth.

   THE RULE THIS FILE EXISTS TO KEEP: a "month in review" must never become a
   progress report on the child. Everything below counts what the PARENT did —
   milestones they noticed, areas their noticing touched, moments they kept —
   and nothing else. There is deliberately no:
     · percentage, ratio or "x of y" of the catalogue,
     · comparison against the previous month (a delta is a trend by
       inspection, and a trend about a child is a verdict),
     · ranking of domains, "weakest area" pointer, or per-domain breakdown,
     · derived level, band, score or colour meaning good/bad.
   The shape is three COUNTS plus one milestone to watch for next. If a future
   caller wants "up 2 on last month", the answer is no.

   Pure and side-effect free (the mount decision and its localStorage marker are
   the component's business) so the whole derivation is unit-testable in the
   node environment the suite runs in.
   ════════════════════════════════════════════════════════════════════════════ */

/** The month a Date falls in, as a stable "YYYY-MM" key in LOCAL time. */
export function growthMonthKey(d: Date | number | string = new Date()): string {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** The month BEFORE the one `now` falls in — the month a review reviews.
 *  A family is never handed a review of the month they are still living in. */
export function previousMonthKey(now: Date | number = new Date()): string {
  const date = now instanceof Date ? new Date(now.getTime()) : new Date(now);
  if (Number.isNaN(date.getTime())) return "";
  return growthMonthKey(new Date(date.getFullYear(), date.getMonth() - 1, 1));
}

export interface GrowthMonthMilestone {
  id: string;
  title: string;
  domain: string;
  checked?: boolean;
  observationUpdatedAt?: string;
}

export interface GrowthMonthReview {
  /** "YYYY-MM" of the month under review. */
  monthKey: string;
  /** Milestones the parent marked noticed inside that month. */
  noticedCount: number;
  /** Distinct developmental areas those marks landed in. */
  areasTouchedCount: number;
  /** Moments (behaviour + play entries) kept inside that month. */
  momentsKeptCount: number;
  /** False when nothing at all was written that month — the card says so
   *  plainly instead of rendering "0 · 0 · 0". */
  hasEntries: boolean;
}

const inMonth = (iso: string | undefined, monthKey: string): boolean =>
  typeof iso === "string" && iso.length > 0 && growthMonthKey(iso) === monthKey;

/**
 * Build the counts for one month. `momentTimestamps` is the caller's flattened
 * list of behaviour + play log timestamps — this module never reaches into the
 * store itself, so the same function serves the hub, a test, and any later
 * share surface with identical numbers.
 */
export function buildGrowthMonthReview(input: {
  monthKey: string;
  milestones: readonly GrowthMonthMilestone[];
  momentTimestamps: readonly string[];
}): GrowthMonthReview {
  const { monthKey } = input;
  const noticed = input.milestones.filter(
    (m) => m.checked === true && inMonth(m.observationUpdatedAt, monthKey),
  );
  const areas = new Set(noticed.map((m) => m.domain).filter(Boolean));
  const momentsKeptCount = input.momentTimestamps.filter((ts) => inMonth(ts, monthKey)).length;
  const noticedCount = noticed.length;
  return {
    monthKey,
    noticedCount,
    areasTouchedCount: areas.size,
    momentsKeptCount,
    hasEntries: noticedCount > 0 || momentsKeptCount > 0,
  };
}

/** localStorage marker: this child's parent has already seen this month's card.
 *  Keyed by child AND month so a new month re-offers it exactly once.
 *
 *  THE CHILD ID GOES LAST, and that ordering is load-bearing, not cosmetic.
 *  `lib/childLocalState.isChildScopedKey` is the sweep that runs when ONE child
 *  of several is deleted, and it recognises a key by its `arbor.`-prefix plus
 *  the child id as a dot-delimited segment. This key was written
 *  `…seen.${childId}.${monthKey}` and therefore ended in `.2026-09`, so it
 *  survived the deletion of the child it was about — and it is written once per
 *  month per child, forever, so a deleted child left a trail that only grew.
 *  `components/overview/weekAnchor.weekAnchorSeenKey` is the convention this
 *  now follows. If you add a variant suffix here, put the child id last again.
 */
export function monthReviewSeenKey(childId: string, monthKey: string): string {
  return `arbor.growth.month.seen.${monthKey}.${childId}`;
}

/** The month label a card renders, in the viewer's language. Derived from the
 *  key (never a stored label) so a language switch re-renders correctly. */
export function growthMonthLabel(monthKey: string, uiLang: string): string {
  const [y, m] = monthKey.split("-").map((n) => Number(n));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return monthKey;
  const date = new Date(y, m - 1, 1);
  try {
    return new Intl.DateTimeFormat(uiLang === "he" ? "he-IL" : "en-GB", {
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return monthKey;
  }
}
