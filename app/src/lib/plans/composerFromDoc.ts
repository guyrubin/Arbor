/**
 * lib/plans/composerFromDoc — B-BOOK-78 "change a step": the composer opens
 * on a saved plan's own choices (at the steps stage, the red lines already
 * passed when the plan was first approved), so the parent changes one thing
 * and re-approves; the same row is overwritten. Without a saved plan the
 * composer starts at the door. Pure.
 */
import { initialComposer, type ComposerState } from "./composer";
import type { PatternDef } from "../library/plans/patterns";
import type { PlanBookDoc } from "../library/plans/planBookDoc";
import { PLAN_TIMES, type PlanTime } from "../library/plans/composePlanBook";
import type { BookLang } from "../library/types";

export function composerFromDoc(def: PatternDef, doc: PlanBookDoc | undefined, lang: BookLang): ComposerState | undefined {
  if (!doc || doc.pattern !== def.id) return undefined;
  const base = initialComposer(def, lang);
  return {
    ...base,
    stage: "steps",
    stepMenuIds: [...doc.stepMenuIds] as [string, string, string],
    ...(doc.ownStep ? { ownStep: doc.ownStep } : {}),
    minutes: doc.minutes,
    time: (PLAN_TIMES as readonly string[]).includes(doc.time) ? (doc.time as PlanTime) : base.time,
    boxItemIds: doc.boxItemIds,
    durationDays: doc.durationDays,
  };
}
