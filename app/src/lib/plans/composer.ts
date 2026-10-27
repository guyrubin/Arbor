/**
 * lib/plans/composer — B-BOOK-77: the parent composes the plan in minutes.
 * The flow of kid-everyday-plans-standard §6 as ONE pure state machine (no
 * React, no I/O), so the component only renders a stage and the tests pin
 * every rule:
 *
 *   door → redLines → steps → box → preview → approved
 *                └─ care (a ticked red line: no plan, the care line)
 *
 *  - The red lines run FIRST; one ticked sign routes to `care` and no stage
 *    beyond it exists (lib/plans/redLines).
 *  - Steps: the pattern's default three, each swappable within its slot's
 *    sourced menu; the slot-1 minutes are bounded (3–10) and the time of day
 *    is one of the composer's keys. An own-words step (B-GA-11) is phrased
 *    elsewhere (the server); here it is held as `pending` until the parent
 *    approves the exact line, and the composition is invalid until then.
 *  - "This is {name}'s plan" is the explicit approval: `approve` returns the
 *    request body for POST /api/children/:childId/plan-books, never written
 *    here.
 *  - Nothing here is AI; nothing here describes the child.
 */
import { DURATION_DAYS_RANGE, OWN_STEP, PLAN_TIMES, validatePlanComposition, type CompositionProblem, type OwnStep, type PlanComposition, type PlanTime } from "../library/plans/composePlanBook";
import type { PatternDef, PlanMenuItem } from "../library/plans/patterns";
import type { BookLang, PatternId } from "../library/types";
import { redLineOutcome, type RedLineOutcome } from "./redLines";

export type ComposerStage = "door" | "redLines" | "care" | "steps" | "the-box" | "preview" | "approved";

export interface ComposerState {
  pattern: PatternId;
  lang: BookLang;
  stage: ComposerStage;
  /** The red-line ids the parent ticked. */
  ticked: string[];
  stepMenuIds: [string, string, string];
  minutes: number;
  time: PlanTime;
  boxItemIds: string[];
  durationDays: number;
  /** The own-words step, once phrased; `approvedAt` set by `approveOwnStep`. */
  ownStep?: OwnStep;
}

export type ComposerAction =
  | { type: "open" }
  | { type: "tick"; id: string; on: boolean }
  | { type: "redLinesDone" }
  | { type: "swap"; slot: 1 | 2 | 3; menuId: string }
  | { type: "minutes"; minutes: number }
  | { type: "time"; time: PlanTime }
  | { type: "stepsDone" }
  | { type: "the-box"; itemId: string; on: boolean }
  | { type: "duration"; durationDays: number }
  | { type: "boxDone" }
  | { type: "ownStepPhrased"; step: Omit<OwnStep, "approvedAt"> }
  | { type: "ownStepApproved"; at: string }
  | { type: "ownStepDropped" }
  | { type: "back" }
  | { type: "approved" };

/** The first state: the door, with the pattern's defaults proposed. */
export function initialComposer(def: PatternDef, lang: BookLang): ComposerState {
  const first = def.menu.find((m) => m.id === def.defaultSteps[0]);
  return {
    pattern: def.id,
    lang,
    stage: "door",
    ticked: [],
    stepMenuIds: [...def.defaultSteps],
    minutes: first?.defaultMinutes ?? 5,
    time: (first?.defaultTime as PlanTime | undefined) ?? "evening",
    boxItemIds: def.boxItems.slice(0, 3).map((b) => b.id),
    durationDays: def.defaultDurationDays,
  };
}

/** The menu items a slot may hold (its sourced alternatives). */
export function slotMenu(def: PatternDef, slot: 1 | 2 | 3): PlanMenuItem[] {
  return def.menu.filter((m) => m.slot === slot);
}

/** The composition the state describes (the POST body minus the server's stamps). */
export function compositionOf(s: ComposerState, bookId = "pending"): PlanComposition {
  return {
    bookId,
    stepMenuIds: s.stepMenuIds,
    ...(s.ownStep ? { ownStep: s.ownStep } : {}),
    minutes: s.minutes,
    time: s.time,
    boxItemIds: s.boxItemIds,
    durationDays: s.durationDays,
    approvedAt: "",
    approvedBy: "",
  };
}

/** Every problem the current steps have against the pattern ([] = may go on). */
export function composerProblems(def: PatternDef, s: ComposerState): CompositionProblem[] {
  return validatePlanComposition(def, compositionOf(s));
}

export function redLinesOf(def: PatternDef, s: ComposerState): RedLineOutcome {
  return redLineOutcome(def, s.ticked);
}

const PREV: Partial<Record<ComposerStage, ComposerStage>> = { redLines: "door", care: "redLines", steps: "redLines", "the-box": "steps", preview: "the-box" };

export function composerReducer(def: PatternDef, s: ComposerState, a: ComposerAction): ComposerState {
  switch (a.type) {
    case "open":
      return s.stage === "door" ? { ...s, stage: "redLines" } : s;
    case "tick": {
      if (s.stage !== "redLines") return s;
      if (!def.watchFor.some((w) => w.id === a.id)) return s;
      const ticked = a.on ? [...new Set([...s.ticked, a.id])] : s.ticked.filter((id) => id !== a.id);
      return { ...s, ticked };
    }
    case "redLinesDone":
      if (s.stage !== "redLines") return s;
      // the red lines run first: one ticked sign offers no plan
      return { ...s, stage: redLineOutcome(def, s.ticked).offer === "care" ? "care" : "steps" };
    case "swap": {
      if (s.stage !== "steps") return s;
      const item = def.menu.find((m) => m.id === a.menuId && m.slot === a.slot);
      if (!item) return s;
      const stepMenuIds = [...s.stepMenuIds] as [string, string, string];
      stepMenuIds[a.slot - 1] = item.id;
      // swapping away from the own step drops it
      const ownStep = s.ownStep?.slot === a.slot ? undefined : s.ownStep;
      return { ...s, stepMenuIds, ...(ownStep ? { ownStep } : {}), ...(ownStep ? {} : { ownStep: undefined }) };
    }
    case "minutes": {
      if (s.stage !== "steps") return s;
      const [min, max] = def.minutesRange;
      if (!Number.isInteger(a.minutes) || a.minutes < min || a.minutes > max) return s;
      return { ...s, minutes: a.minutes };
    }
    case "time":
      return s.stage === "steps" && (PLAN_TIMES as readonly string[]).includes(a.time) ? { ...s, time: a.time } : s;
    case "ownStepPhrased": {
      if (s.stage !== "steps") return s;
      const stepMenuIds = [...s.stepMenuIds] as [string, string, string];
      stepMenuIds[a.step.slot - 1] = OWN_STEP;
      // phrased, NOT approved: the composition stays invalid until the parent approves the exact line
      return { ...s, stepMenuIds, ownStep: { ...a.step, aiPhrased: true } };
    }
    case "ownStepApproved":
      return s.stage === "steps" && s.ownStep && !s.ownStep.approvedAt ? { ...s, ownStep: { ...s.ownStep, approvedAt: a.at } } : s;
    case "ownStepDropped": {
      if (s.stage !== "steps" || !s.ownStep) return s;
      const stepMenuIds = [...s.stepMenuIds] as [string, string, string];
      stepMenuIds[s.ownStep.slot - 1] = def.defaultSteps[s.ownStep.slot - 1];
      return { ...s, stepMenuIds, ownStep: undefined };
    }
    case "stepsDone":
      // an unapproved own step, a bad swap or a bad bound holds the stage
      return s.stage === "steps" && composerProblems(def, s).length === 0 ? { ...s, stage: "the-box" } : s;
    case "the-box": {
      if (s.stage !== "the-box") return s;
      if (!def.boxItems.some((b) => b.id === a.itemId)) return s;
      const boxItemIds = a.on ? [...new Set([...s.boxItemIds, a.itemId])] : s.boxItemIds.filter((id) => id !== a.itemId);
      return { ...s, boxItemIds };
    }
    case "duration": {
      if (s.stage !== "the-box") return s;
      const [min, max] = DURATION_DAYS_RANGE;
      return Number.isInteger(a.durationDays) && a.durationDays >= min && a.durationDays <= max ? { ...s, durationDays: a.durationDays } : s;
    }
    case "boxDone":
      return s.stage === "the-box" ? { ...s, stage: "preview" } : s;
    case "approved":
      return s.stage === "preview" && composerProblems(def, s).length === 0 ? { ...s, stage: "approved" } : s;
    case "back": {
      const prev = PREV[s.stage];
      return prev ? { ...s, stage: prev } : s;
    }
    default:
      return s;
  }
}

/** The POST body of "This is {name}'s plan" (the server stamps the approval). */
export interface ComposeRequest {
  pattern: PatternId;
  lang: BookLang;
  stepMenuIds: [string, string, string];
  ownStep?: OwnStep;
  minutes: number;
  time: PlanTime;
  boxItemIds: string[];
  durationDays: number;
}

export function composeRequestOf(s: ComposerState): ComposeRequest {
  return {
    pattern: s.pattern,
    lang: s.lang,
    stepMenuIds: s.stepMenuIds,
    ...(s.ownStep ? { ownStep: s.ownStep } : {}),
    minutes: s.minutes,
    time: s.time,
    boxItemIds: s.boxItemIds,
    durationDays: s.durationDays,
  };
}
