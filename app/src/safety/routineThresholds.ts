import { screenModelOutputLexical } from "./outputScreenLexical.js";

/**
 * B-AI-14 (coach-core 1.5.1) — a ROUTINE answer is never routed to the
 * crisis surface by the model's own threshold line.
 *
 * Live coach-core-v1 on 1813b2e8 (6 Oct): "How do I handle the bedtime
 * standoff?" — input screen null, not seeded — came back as the SELF-HARM
 * crisis surface. The trigger was model-authored: an `escalateIf` threshold
 * that introduced a danger the parent never raised, which the VC-8 output
 * screen (safety/outputScreenLexical) then routed to crisis.
 *
 * Rule (ratified by the orchestrator 6 Oct, four conditions), applied by
 * /chat ONLY on a routine turn (the input screen did not trip — the route
 * returned before the model otherwise — and the turn is not hard-moment
 * seeded):
 *  - when the done-time output verdict is `crisis`, every `escalateIf` entry
 *    the crisis floor flags ON ITS OWN is dropped (the others are kept; if
 *    none remain, the neutral threshold line below fills the slot so the
 *    contract keeps its min-1 shape), the answer is re-rendered and the FULL
 *    output screen runs again;
 *  - the repair is adopted only if the re-screen no longer says `crisis`. A
 *    flagged PROSE span (harm-normalising language, an echo of a disclosure)
 *    still says `crisis` after the drop, so it routes to crisis exactly as
 *    before — this rule never touches a prose verdict;
 *  - every adopted drop is counted (`routineThresholdDropCount`) and logged.
 */

/** The neutral threshold for a routine answer whose only threshold was dropped. */
export const NEUTRAL_THRESHOLD_LINE: Readonly<Record<"en" | "he", string>> = {
  en: "If this keeps happening, gets harder, or disrupts daily life, talk it through with your pediatrician or another qualified professional.",
  he: "אם זה חוזר, נעשה קשה יותר או משבש את היום־יום, שוחחו על כך עם רופא הילדים או עם איש מקצוע מוסמך.",
};

let droppedTotal = 0;
/** How many model-authored crisis thresholds this process dropped from routine answers. */
export const routineThresholdDropCount = (): number => droppedTotal;

/** Record adopted drops (the route calls this only when the repair is adopted). */
export const recordRoutineThresholdDrop = (dropped: number): number => {
  droppedTotal += dropped;
  return droppedTotal;
};

/** Indices of the escalateIf entries the crisis floor flags on their own. */
export const crisisThresholdIndices = (escalateIf: readonly string[]): number[] =>
  escalateIf.flatMap((line, i) => (screenModelOutputLexical(line).category === "crisis" ? [i] : []));

/**
 * A copy of the contract without the crisis-flagged escalateIf entries (the
 * neutral line fills an emptied slot), and how many were dropped. Never
 * mutates the input; `dropped === 0` means the crisis came from elsewhere.
 */
export function withoutCrisisThresholds<T extends { escalateIf: string[] }>(contract: T, language: "en" | "he"): { contract: T; dropped: number } {
  const flagged = new Set(crisisThresholdIndices(contract.escalateIf));
  if (flagged.size === 0) return { contract, dropped: 0 };
  const kept = contract.escalateIf.filter((_, i) => !flagged.has(i));
  return { contract: { ...contract, escalateIf: kept.length > 0 ? kept : [NEUTRAL_THRESHOLD_LINE[language]] }, dropped: flagged.size };
}
