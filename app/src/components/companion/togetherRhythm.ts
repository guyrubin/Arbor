import { localized, type Routine } from "../../lib/routines";
import type { UiLang } from "../../lib/i18n";
import type { PastelKey } from "../../lib/tokens";
import { routineRunToday, routineStepCount } from "../../lib/routineTemplates";
import type { ActionPlan } from "../../types";
import type { BrandChipTone } from "../ui/BrandChip";

/* ════════════════════════════════════════════════════════════════════════════
   v4 — Today's rhythm: the routines a family started, in the order of the day.

   Pure and descriptive. A routine template has no clock time in the record,
   so the order comes from the part of the day the routine belongs to (a
   morning routine before the goodbye, the reconnect after school, the meal
   before tidying, bedtime last), then the library's own order. Nothing here
   invents a time or a person: a card says the part of the day and the
   routine's own duration, never "7:00" or "Dad".

   Counts only: the steps ticked today and the steps there are, per routine
   (the run board's own ticks, routineRunToday). Never a share or a score.
   ════════════════════════════════════════════════════════════════════════════ */

export type RhythmSlot = "morning" | "midday" | "afternoon" | "evening" | "night" | "anytime";
export const RHYTHM_SLOTS: readonly RhythmSlot[] = ["morning", "midday", "afternoon", "evening", "night", "anytime"];

/** The part of the day each library routine belongs to; one not listed is "anytime". */
export const ROUTINE_SLOT: Readonly<Record<string, RhythmSlot>> = {
  morning: "morning",
  goodbye: "morning",
  nap: "midday",
  reconnect: "afternoon",
  screens: "afternoon",
  meal: "evening",
  tidy: "evening",
  gratitude: "evening",
  bedtime: "night",
  calm: "anytime",
  potty: "anytime",
  checkup: "anytime",
};

export function routineSlot(routineId: string): RhythmSlot {
  return ROUTINE_SLOT[routineId] ?? "anytime";
}

/** The routine's own pastel as a brand chip tone (one icon object in v4). */
const TONE: Readonly<Record<PastelKey, BrandChipTone>> = {
  yellow: "amber",
  sky: "sky",
  coral: "peach",
  lav: "lav",
  mint: "green",
  pink: "pink",
};
export function routineChipTone(routine: Pick<Routine, "tone">): BrandChipTone {
  return TONE[routine.tone] ?? "sapphire";
}

export interface RhythmCard {
  routine: Routine;
  plan: ActionPlan;
  slot: RhythmSlot;
  /** Steps on the board. */
  total: number;
  /** Indices ticked today. */
  done: readonly number[];
  /** Every step ticked today. */
  complete: boolean;
  /** The index of the first step not ticked today (-1 when complete). */
  nextIndex: number;
  /** That step, in the reader's language (null when complete). */
  nextStep: string | null;
  /** That step's glyph from the template, when the template still lines up with the plan. */
  nextIcon: string | null;
  /** The first routine of the day not finished yet. */
  nextUp: boolean;
}

/**
 * The started routines, in the order of the day. `planFor` returns a routine's
 * stored plan (or null when the family has not started it). Templates not
 * started are not part of the rhythm — they stay in the library.
 */
export function todaysRhythm(
  templates: readonly Routine[],
  planFor: (routineId: string) => ActionPlan | null,
  dayKey: string,
  lang: UiLang,
): RhythmCard[] {
  const started = templates
    .map((routine, index) => ({ routine, index, plan: planFor(routine.id) }))
    .filter((row): row is { routine: Routine; index: number; plan: ActionPlan } => row.plan !== null)
    .sort((a, b) => RHYTHM_SLOTS.indexOf(routineSlot(a.routine.id)) - RHYTHM_SLOTS.indexOf(routineSlot(b.routine.id)) || a.index - b.index);
  let nextFound = false;
  return started.map(({ routine, plan }) => {
    const total = routineStepCount(plan);
    const done = routineRunToday(plan, dayKey);
    const complete = total > 0 && done.length >= total;
    const nextIndex = complete ? -1 : Array.from({ length: total }, (_, i) => i).find((i) => !done.includes(i)) ?? -1;
    // A template step and its plan step share an index (routineToPlan keeps the
    // order); the template reads in the parent's current language, the plan in
    // the language it was started in, so the template wins while they line up.
    const planSteps = (plan.phases ?? []).flatMap((phase) => phase.steps ?? []);
    const aligned = routine.steps.length === total;
    const nextStep = nextIndex < 0 ? null
      : aligned ? localized(routine.steps[nextIndex].label, lang)
      : planSteps[nextIndex]?.text ?? null;
    const nextIcon = nextIndex >= 0 && aligned ? routine.steps[nextIndex].ms : null;
    const nextUp = !complete && !nextFound;
    if (nextUp) nextFound = true;
    return { routine, plan, slot: routineSlot(routine.id), total, done, complete, nextIndex, nextStep, nextIcon, nextUp };
  });
}
