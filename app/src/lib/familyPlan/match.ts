/**
 * Family plan v1: the duplicate check before anything joins the plan.
 *
 * A drafted date (from a reviewed school message or typed by hand) is compared
 * with the dates already in the plan:
 *  - duplicate: the same thing on the same day and time is already there, so
 *    adding it again would make two of one date;
 *  - change: the same thing is in the plan on another day or time, so this is
 *    probably a newer version of the message (the parent decides: apply the
 *    change, or keep both);
 *  - new: nothing like it is in the plan.
 * "The same thing" = the names share most of their words (EN and HE), never a
 * guess from the day alone.
 */
import type { FamilyPlanDate } from "./model";

export type MatchResult =
  | { kind: "new" }
  | { kind: "duplicate"; existing: FamilyPlanDate }
  | { kind: "change"; existing: FamilyPlanDate };

const STOP = new Set([
  "the", "a", "an", "to", "of", "for", "and", "in", "on", "at", "by", "with", "your", "our", "is", "be",
  "של", "את", "עם", "על", "אל", "לכל", "כל", "ו", "ה",
]);

/** The content words of a name, lowercased, Hebrew prefixes (ה/ו/ל/ב) kept as written. */
export function nameWords(title: string): Set<string> {
  const words = title
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
  return new Set(words);
}

/** Share of words in common (Jaccard), 0..1. */
export function nameOverlap(a: string, b: string): number {
  const A = nameWords(a);
  const B = nameWords(b);
  if (!A.size || !B.size) return 0;
  let both = 0;
  for (const w of A) if (B.has(w)) both += 1;
  return both / (A.size + B.size - both);
}

export const SAME_THING = 0.5;

export function matchDraft(draft: { title: string; date: string; time?: string }, existing: readonly FamilyPlanDate[]): MatchResult {
  let best: { item: FamilyPlanDate; score: number } | null = null;
  for (const item of existing) {
    if (item.status === "cancelled") continue;
    const score = nameOverlap(draft.title, item.title);
    if (score >= SAME_THING && (!best || score > best.score)) best = { item, score };
  }
  if (!best) return { kind: "new" };
  const sameWhen = best.item.date === draft.date && (best.item.time ?? "") === (draft.time ?? "");
  if (sameWhen) return { kind: "duplicate", existing: best.item };
  if (best.item.status === "done") return { kind: "new" };
  return { kind: "change", existing: best.item };
}
