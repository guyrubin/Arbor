/**
 * lib/plans/redLines — B-KID-167 (kid-everyday-plans-standard §4): the red
 * lines run FIRST at the pattern's door. A parent who recognises one of the
 * pattern's `watchFor` signs is routed to care and offered NO plan: the
 * existing hard-moment care line (content/hardMomentCards sharedEscalation —
 * the family's own doctor, no diagnosis, no urgency grade) is what they see.
 * The signs are never a checklist with a score, never "signs of X", never
 * shown to the child. Pure; the composer (B-BOOK-77) renders the outcome.
 */
import { sharedEscalation } from "../../content/hardMomentCards";
import type { LocalizedText } from "../../content/governance";
import type { PatternDef, RedLine } from "../library/plans/patterns";

export type RedLineOutcome =
  | { offer: "plan" }
  | { offer: "care"; matched: RedLine[]; careLine: LocalizedText };

/** The door's answer for the signs the parent ticked (ids of `def.watchFor`).
 *  An id the pattern does not know is ignored; ONE known match routes to care. */
export function redLineOutcome(def: Pick<PatternDef, "watchFor">, tickedIds: readonly string[]): RedLineOutcome {
  const matched = def.watchFor.filter((w) => tickedIds.includes(w.id));
  if (matched.length === 0) return { offer: "plan" };
  return { offer: "care", matched, careLine: sharedEscalation };
}

/** The questions the door asks, in parent words: the pattern's red lines as
 *  tick-able statements (never a score, never a count of ticks). */
export function redLineQuestions(def: Pick<PatternDef, "watchFor">): RedLine[] {
  return def.watchFor.slice();
}
