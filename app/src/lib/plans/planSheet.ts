/**
 * lib/plans/planSheet — B-BOOK-75 follow-up: the poses the child's ONE shared
 * plan sheet must hold = the union of the plan poses every approved (active)
 * plan book shows, from the stored `books` rows. Pure; at most the twelve
 * shared plan poses (standard §0). A row that no longer composes adds nothing.
 */
import { bookPoseIds } from "../library/bookPoses";
import { isPlanPose, PLAN_POSES } from "../library/plans/planPoses";
import { planBookFromDoc, readPlanBookDoc } from "../library/plans/planBookDoc";

export function planSheetPoses(rows: readonly unknown[]): string[] {
  const out = new Set<string>();
  for (const raw of rows) {
    const doc = readPlanBookDoc(raw);
    if (!doc || doc.status !== "active") continue;
    const book = planBookFromDoc(doc);
    if (!book) continue;
    for (const pose of bookPoseIds(book)) if (isPlanPose(pose)) out.add(pose);
  }
  return PLAN_POSES.filter((p) => out.has(p));
}
