/**
 * sheetStripTargets — which sheet the parent's review strip (BookSheetStrip)
 * reviews: the library book's (the strip's default, built in the strip from
 * the book) or, B-BOOK-75 follow-up, the child's shared PLAN sheet. Pure: no
 * builder import, so a test that mocks the builder or the strip still reads it.
 */
import { planRoutePose, type HeroPoseId } from "../../lib/heroSheetContract";
import { PLAN_POSES, PLAN_SHEET_BOOK_ID, type PlanPose } from "../../lib/library/plans/planPoses";

export interface SheetStripTarget {
  bookId: string;
  /** The poses the sheet may hold (a book: its pages' poses; the plan sheet: the twelve). */
  poses: readonly string[];
  /** The string family: `elev.hero.sheet.book` or `elev.hero.sheet.plan`. */
  keyBase: string;
  /** The route's pose id of a stored pose (the plan sheet draws `plan-<pose>`). */
  routePose?: (pose: string) => HeroPoseId;
}

/** The plan sheet's row of the parent's likeness review. */
export const PLAN_SHEET_TARGET: SheetStripTarget = {
  bookId: PLAN_SHEET_BOOK_ID,
  poses: PLAN_POSES,
  keyBase: "elev.hero.sheet.plan",
  routePose: (pose) => planRoutePose(pose as PlanPose),
};
