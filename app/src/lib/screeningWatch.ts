/**
 * GP-34 — close the screening loop: "watch for it this week".
 *
 * A "sometimes" / "not yet" answer used to end at "Retake". The parent had
 * just told Arbor something specific about their child and the app did nothing
 * with it. Meanwhile the Development hub already had everything needed: a
 * weekly focus with a `watch` mode (`selectWeeklyFocus`) and a re-check
 * reminder seam. This module is the missing join.
 *
 * The mapping is a real one, not a guess: screening item domains and milestone
 * domains are THE SAME id space (`framework.json` domains == `ScreenDomainId`),
 * so an item maps to open milestones in that domain inside the child's own age
 * window — the shared `selectNextMilestones` ordering, filtered by domain. If
 * the domain has no open in-window milestone, the offer is simply not made;
 * inventing one would be worse than staying quiet.
 *
 * CLINICAL FIREWALL: nothing here scores, ranks or flags. It carries the
 * parent's own "watch this" choice from one surface to another.
 */

import type { Milestone } from "../types";
import { selectNextMilestones } from "./milestoneData";
import type { ScreenAnswer, ScreenItem } from "./screening";

/** Answers that mean "I am not sure yet" — never a verdict, just uncertainty. */
export const WATCH_ANSWERS: readonly ScreenAnswer[] = ["sometimes", "not_yet"];

const PREFIX = "arbor.screen.watch";

export interface WatchFocus {
  readonly milestoneId: string;
  readonly screenItemId: string;
  readonly chosenAt: string;
}

/** Items the parent did NOT answer a clean "yes" to, in band order. */
export function watchableScreenItems(
  items: readonly ScreenItem[],
  answers: Record<string, ScreenAnswer>,
): ScreenItem[] {
  return items.filter((item) => WATCH_ANSWERS.includes(answers[item.id]));
}

/**
 * The one milestone this screening item points at: same domain, open, inside
 * the child's corrected age window, using the shared "worth watching next"
 * ordering. `null` when the domain has nothing open to watch for.
 */
export function milestoneForScreenItem(
  item: ScreenItem,
  milestones: Milestone[],
  comparisonMonths: number,
): Milestone | null {
  const sameDomain = milestones.filter((m) => m.domain === item.domain);
  // Ask for the whole ordered list, not the head: the head of the unfiltered
  // list may well be another domain entirely.
  const [next] = selectNextMilestones(sameDomain, comparisonMonths, 1);
  return next ?? null;
}

/**
 * Every offer worth making from one completed check: the parent's uncertain
 * items that map to something concrete, de-duplicated by milestone (two items
 * in one domain must not offer the same milestone twice).
 */
export function watchOffersForScreening(
  items: readonly ScreenItem[],
  answers: Record<string, ScreenAnswer>,
  milestones: Milestone[],
  comparisonMonths: number,
): { item: ScreenItem; milestone: Milestone }[] {
  const seen = new Set<string>();
  const offers: { item: ScreenItem; milestone: Milestone }[] = [];
  for (const item of watchableScreenItems(items, answers)) {
    const milestone = milestoneForScreenItem(item, milestones, comparisonMonths);
    if (!milestone || seen.has(milestone.id)) continue;
    seen.add(milestone.id);
    offers.push({ item, milestone });
  }
  return offers;
}

/* ── The parent's choice, carried across surfaces ─────────────────────────── */

export function watchFocusKey(childId: string): string {
  return `${PREFIX}.${childId}`;
}

function store(explicit?: Storage | null): Storage | null {
  if (explicit !== undefined) return explicit;
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readWatchFocus(childId: string, explicit?: Storage | null): WatchFocus | null {
  const s = store(explicit);
  if (!s || !childId) return null;
  try {
    const raw = s.getItem(watchFocusKey(childId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WatchFocus> | null;
    if (!parsed || typeof parsed.milestoneId !== "string" || !parsed.milestoneId) return null;
    return {
      milestoneId: parsed.milestoneId,
      screenItemId: typeof parsed.screenItemId === "string" ? parsed.screenItemId : "",
      chosenAt: typeof parsed.chosenAt === "string" ? parsed.chosenAt : "",
    };
  } catch {
    return null;
  }
}

export function writeWatchFocus(childId: string, focus: WatchFocus, explicit?: Storage | null): void {
  const s = store(explicit);
  if (!s || !childId || !focus.milestoneId) return;
  try {
    s.setItem(watchFocusKey(childId), JSON.stringify(focus));
  } catch {
    /* storage blocked — the choice just does not persist */
  }
}

export function clearWatchFocus(childId: string, explicit?: Storage | null): void {
  const s = store(explicit);
  if (!s || !childId) return;
  try {
    s.removeItem(watchFocusKey(childId));
  } catch {
    /* no-op */
  }
}

/**
 * Resolve the stored choice against the live record. A milestone that has
 * since been NOTICED is no longer something to watch for — the choice retires
 * itself rather than lingering as a stale instruction.
 */
export function resolveWatchFocus(
  childId: string,
  milestones: Milestone[],
  explicit?: Storage | null,
): Milestone | null {
  const focus = readWatchFocus(childId, explicit);
  if (!focus) return null;
  const milestone = milestones.find((m) => m.id === focus.milestoneId);
  if (!milestone || milestone.checked) return null;
  return milestone;
}
