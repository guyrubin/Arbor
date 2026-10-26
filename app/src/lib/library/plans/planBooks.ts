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
import { PLAN_POO_SIT } from "./patterns/planPooSit";
import type { PatternId, PlanBook } from "../types";

/** The patterns authored so far (B-BOOK-76 fills the eight in order). */
export const PATTERNS: Partial<Record<PatternId, PatternDef>> = {
  [PLAN_POO_SIT.id]: PLAN_POO_SIT,
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

/** The DEV route's default plan book. */
export const DEFAULT_REVIEW_PLAN_BOOK = "plan-poo-sit--demo";

export function getPlanFixtureBook(id: string): PlanBook | undefined {
  return own(PLAN_FIXTURE_BOOKS, id) ? PLAN_FIXTURE_BOOKS[id] : undefined;
}
