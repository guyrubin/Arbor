/* ════════════════════════════════════════════════════════════════════════════
   firstMonthKeepsake — ENG-L4: what the day-30 keepsake is allowed to say.

   WHAT THIS IS, AND WHAT IT IS NOT
   ───────────────────────────────
   The lifecycle spine (lib/lifecycle.ts) decides WHETHER the first-month
   moment is offered. It cannot decide what the card says, because the counts
   it carries are the wrong counts for a month card:

     · `counts.week` is a rolling seven-day figure. On a card headed "your
       first month" it reads as a verdict on the last week, and it goes DOWN
       whenever a parent has a quiet week — the exact loss frame ENG-L5 spent a
       whole ban list removing.
     · `counts.noticed` is windowed to the child's CDC band plus one earlier
       (ArborContext.windowedMilestones). It FALLS when the child ages into a
       new band, and thirty days is easily long enough for an infant to cross
       one. A number that drops because the CHILD got older is not a count of
       what the parent noticed; it is a verdict wearing a count's clothes.
     · `counts.total` is every capture ever. On day 30 that happens to equal
       the first month — but the moment can fire later (a parent whose first
       open is week six), and then "your first month" would be counting weeks
       five and six too.

   So this module derives the month's own numbers, from the month's own window,
   and nothing else uses them.

   THE WINDOW IS CLOSED BY CONSTRUCTION
   ────────────────────────────────────
   Days 0 … FIRST_MONTH_DAYS-1 counted from `onboardingCompletedAt`. A card
   rendered on day 45 reports the same first thirty days as one rendered on day
   30. The window cannot grow, so the card's claim cannot drift.

   HONEST AT ZERO
   ──────────────
   `momentsKept` may legitimately be 0 (the parent kept their first thing on day
   31, or during onboarding only). `tone` names that case so the card can pick
   copy that is warm and true rather than a congratulation nobody earned. There
   is deliberately no "you could have", no target, no comparison with other
   families, and no arithmetic that turns a small number into a shortfall.

   CLINICAL FIREWALL. Two numbers, both counts of what the PARENT did: things
   they kept, and days they wrote something down. Both are monotone inside a
   fixed window — neither can fall on a later render. There is no ratio, no
   percentage, no per-domain split, no month-on-month delta, and nothing here
   is a statement about the child.

   PURE: no React, no storage, no clock of its own.
   ════════════════════════════════════════════════════════════════════════════ */
import { calendarDaysBetween, FIRST_MONTH_DAY } from "./lifecycle";

/** The length of the window, in whole days: day 0 through day 29 inclusive. */
export const FIRST_MONTH_DAYS = FIRST_MONTH_DAY;

/**
 * Which register the card should speak in. Not a score and not a tier — the
 * card renders the SAME warmth either way; this only decides whether there is
 * a count worth putting on screen at all.
 */
export type FirstMonthTone = "kept" | "quiet";

export interface FirstMonthKeepsake {
  /** Moments + activities kept inside the window. A count, never a rate. */
  momentsKept: number;
  /** Distinct days inside the window on which the parent kept something. */
  daysWritten: number;
  /** "kept" when there is at least one thing to show; "quiet" when there is not. */
  tone: FirstMonthTone;
  /**
   * False when the anchor is missing or unparseable, so no window exists and
   * the caller must not claim one. A legacy account has no knowable first
   * month; the honest output is not a zero, it is "unknown".
   */
  hasWindow: boolean;
}

const EMPTY: FirstMonthKeepsake = {
  momentsKept: 0,
  daysWritten: 0,
  tone: "quiet",
  hasWindow: false,
};

const toMs = (t: string | number): number => (typeof t === "number" ? t : Date.parse(t));

/**
 * Build the first-month counts.
 *
 * `timestamps` is the caller's flattened list of behaviour + play log stamps —
 * this module never reaches into the store, so a test, the card and any later
 * surface all produce identical numbers from identical rows.
 *
 * Day bucketing is `lifecycle.calendarDaysBetween`, deliberately: the window
 * has to be measured the same way the spine measures the day it fires on, or a
 * parent could meet a "first month" card whose window disagreed with the reason
 * it appeared. A stamp from BEFORE the anchor (kept during onboarding itself)
 * clamps to day 0 and counts — it is part of their first month by any reading a
 * parent would recognise.
 */
export function buildFirstMonthKeepsake(input: {
  onboardingCompletedAt?: string | null;
  timestamps: readonly (string | number)[];
}): FirstMonthKeepsake {
  const anchor = input.onboardingCompletedAt;
  if (!anchor || !Number.isFinite(Date.parse(anchor))) return { ...EMPTY };

  const days = new Set<number>();
  let momentsKept = 0;
  for (const stamp of input.timestamps) {
    const ms = toMs(stamp);
    if (!Number.isFinite(ms)) continue;
    const day = calendarDaysBetween(anchor, ms);
    if (day === null || day >= FIRST_MONTH_DAYS) continue;
    momentsKept++;
    days.add(day);
  }

  return {
    momentsKept,
    daysWritten: days.size,
    tone: momentsKept > 0 ? "kept" : "quiet",
    hasWindow: true,
  };
}
