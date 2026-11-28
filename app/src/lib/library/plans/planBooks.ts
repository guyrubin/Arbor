/**
 * lib/library/plans/planBooks — B-BOOK-75: the pattern registry and the
 * composed FIXTURE plan books (a synthetic family: the DEV review route, the
 * tests and the sandbox read these; no real child is in them).
 *
 * The real per-child plan books are documents (./planBookDoc) composed on the
 * device from the same registry; nothing here is stored.
 */
import { composePlanBook, defaultPlanComposition } from "./composePlanBook";
import type { PatternDef } from "./patterns";
import { PLAN_BIG_FEELINGS } from "./patterns/planBigFeelings";
import { PLAN_DROPOFF } from "./patterns/planDropoff";
import { PLAN_NEW_FOOD } from "./patterns/planNewFood";
import { PLAN_POO_SIT } from "./patterns/planPooSit";
import { PLAN_SCREEN_END } from "./patterns/planScreenEnd";
import { PLAN_STAY_IN_BED } from "./patterns/planStayInBed";
import { PLAN_TOILET_START } from "./patterns/planToiletStart";
import { PLAN_SLEEP_ALONE } from "./patterns/planSleepAlone";
import type { PatternId, PlanBook } from "../types";

/** The patterns authored so far (B-BOOK-76 fills the eight in order). */
export const PATTERNS: Partial<Record<PatternId, PatternDef>> = {
  [PLAN_POO_SIT.id]: PLAN_POO_SIT,
  [PLAN_SLEEP_ALONE.id]: PLAN_SLEEP_ALONE,
  [PLAN_DROPOFF.id]: PLAN_DROPOFF,
  [PLAN_BIG_FEELINGS.id]: PLAN_BIG_FEELINGS,
  [PLAN_SCREEN_END.id]: PLAN_SCREEN_END,
  [PLAN_NEW_FOOD.id]: PLAN_NEW_FOOD,
  [PLAN_TOILET_START.id]: PLAN_TOILET_START,
  [PLAN_STAY_IN_BED.id]: PLAN_STAY_IN_BED,
};

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

export function getPattern(id: string): PatternDef | undefined {
  return own(PATTERNS, id) ? PATTERNS[id as PatternId] : undefined;
}

export function authoredPatterns(): PatternDef[] {
  return Object.values(PATTERNS).filter((p): p is PatternDef => !!p);
}

/** The synthetic family's composed books, one per authored pattern, keyed
 *  `<patternId>--demo` (the DEV route: `?book=plan-poo-sit--demo`). */
export const PLAN_FIXTURE_BOOKS: Readonly<Record<string, PlanBook>> = Object.fromEntries(
  authoredPatterns().map((def) => {
    const id = `${def.id}--demo`;
    return [id, composePlanBook(def, defaultPlanComposition(def, { bookId: id, approvedAt: "2026-10-25T18:00:00.000Z", approvedBy: "demo-parent" }))];
  }),
);

/**
 * B-BOOK-27: the composed books that reach the rest of each pattern's menu.
 * The `--demo` books read the DEFAULT steps only, so a menu item a parent may
 * pick instead (its own plate, hero slot and phone window) would escape the
 * plate-slot, zero-call and offline checks. One synthetic book per
 * non-default menu item: the default composition with that item in its slot
 * (`<patternId>--menu-<itemId>`). Derived from the live registry, so a new
 * pattern or menu item is covered with no list to update. Test-only use.
 */
export function planMenuCoverageBooks(defs: readonly PatternDef[] = authoredPatterns()): PlanBook[] {
  const out: PlanBook[] = [];
  for (const def of defs) {
    for (const item of def.menu) {
      const at = item.slot - 1;
      if (def.defaultSteps[at] === item.id) continue;
      const id = `${def.id}--menu-${item.id}`;
      const base = defaultPlanComposition(def, { bookId: id, approvedAt: "2026-10-25T18:00:00.000Z", approvedBy: "demo-parent" });
      const stepMenuIds = [...base.stepMenuIds] as [string, string, string];
      stepMenuIds[at] = item.id;
      const slotOne = at === 0 ? { minutes: item.defaultMinutes ?? base.minutes, time: item.defaultTime ?? base.time } : {};
      out.push(composePlanBook(def, { ...base, stepMenuIds, ...slotOne }));
    }
  }
  return out;
}

/** The DEV route's default plan book. */
export const DEFAULT_REVIEW_PLAN_BOOK = "plan-poo-sit--demo";

export function getPlanFixtureBook(id: string): PlanBook | undefined {
  return own(PLAN_FIXTURE_BOOKS, id) ? PLAN_FIXTURE_BOOKS[id] : undefined;
}
