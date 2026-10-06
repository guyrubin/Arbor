/**
 * B-LOOP-01 (follow-up) — the ONE seam where a child's stored milestone rows
 * become the milestone list in state (ArborContext `milestones`).
 *
 * Children created before 6 Oct still carry the retired Arbor rows m-1…m-10
 * (`RETIRED_MILESTONE_IDS`, lib/milestoneData.ts) in Firestore. They have no
 * public source and no Hebrew text, so they are filtered out HERE, on read:
 * never on write, and the stored documents are never deleted (W4-P1 owns
 * deletion). A parent-added row (`custom: true`) is never filtered, whatever
 * its id. Every count derived from the list (windowed totals, Today, Growth)
 * excludes the retired rows because it reads this list.
 */
import type { Milestone } from "../types";
import { RETIRED_MILESTONE_IDS } from "../lib/milestoneData";

const RETIRED: ReadonlySet<string> = new Set(RETIRED_MILESTONE_IDS);

/** True when a row is a retired catalogue row (never a parent-added one). */
export const isRetiredMilestone = (m: Pick<Milestone, "id" | "custom">): boolean => !m.custom && RETIRED.has(m.id);

/**
 * The milestone list a child's state holds: the stored rows when the child
 * has any (else the catalogue seed), retired catalogue rows dropped, in
 * catalogue order (parent-added rows last, in stored order).
 */
export function hydrateMilestones(stored: readonly Milestone[], catalogue: readonly Milestone[]): Milestone[] {
  const order = new Map(catalogue.map((m, i) => [m.id, i]));
  const list = stored.length > 0 ? stored : catalogue;
  return list.filter((m) => !isRetiredMilestone(m)).sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
}
