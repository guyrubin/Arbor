import { dayKey } from "../practice/signals";

export type ActionCapacity = "tiny" | "standard" | "roomy";
export type ActionOutcome = "helped" | "somewhat" | "not_today";

/** Provenance of an accepted action. AIX-S6: `digest` marks a step accepted
 *  from the weekly digest's AI-generated tryThisWeek text — only `generated:
 *  "ai"` digests may reach the accept seam (TODAY-1: actionLoops carry only
 *  model-generated focus text, never fallback copy). */
/** LC-22 adds `family-ritual`: the first step of a Family Formation ritual,
 *  accepted by the parent from that surface. Same class as `learn-read` —
 *  authored curriculum the parent chose, not fallback copy TODAY-1 bans. */
/** B-AI-05 adds the companion sources: `coach` (an Ask answer card),
 *  `plan` (a plan step), `vision` (a vision result) and `hard-moment` (the
 *  hard-moment offer on Today and the "Hard moment now" sheet). The controls
 *  live in the screen lanes (B-ASKJB-04 / -26 / -31); this module owns the
 *  ledger they write through. */
export type ActionSource =
  | "today-guidance"
  | "digest"
  | "learn-read"
  | "family-ritual"
  | "coach"
  | "plan"
  | "vision"
  | "hard-moment"
  | "from-record";

/** Runtime registry of every ActionSource. The mapped type fails to compile
 *  when a source is added to the union and not listed here (exhaustiveness
 *  guard: signalTimeline.actionThread.test.ts). */
const ACTION_SOURCE_MAP: { [K in ActionSource]: true } = {
  "today-guidance": true,
  digest: true,
  "learn-read": true,
  "family-ritual": true,
  coach: true,
  plan: true,
  vision: true,
  "hard-moment": true,
  "from-record": true,
};
export const ACTION_SOURCES = Object.keys(ACTION_SOURCE_MAP) as readonly ActionSource[];

/** `superseded` (B-AI-05): an unrated step the parent replaced with a newer
 *  accept. The row stays in the ledger (history), it just stops asking. */
export type ActionStatus = "accepted" | "completed" | "superseded";

export interface ActionLoopEntry {
  id: string;
  recommendation: string;
  source: ActionSource;
  capacity: ActionCapacity;
  status: ActionStatus;
  acceptedAt: string;
  outcome?: ActionOutcome;
  outcomeAt?: string;
  /** B-ASKJB-26: a `plan`-sourced row names the step it came from, so its
   *  outcome can move that step (helped → done; somewhat → in progress). */
  planId?: string;
  phaseIdx?: number;
  stepIdx?: number;
  /** B-TODAY-28: a `from-record` row names what Today asked about
   *  (`plan:<id>` · `note:<id>` · `fact:<id>`) and the parent's answer.
   *  The reflection is the parent's read, never a score; `outcome` stays unset. */
  recordKey?: string;
  reflection?: "easier" | "hard_again" | "other";
  /** B-ASKJB-33: a `hard-moment` row's two-tap ask — did the adult hold the
   *  plan calmly (feeds "Last time, this helped"), and how the child was
   *  (kept for the visit packet). The parent's own read, never a score. */
  held?: HeldAnswer;
  childResponse?: ChildResponse;
}

export type HeldAnswer = "yes" | "no";
export type ChildResponse = "calmer" | "same" | "harder";
/** "Held the plan" → the ledger's outcome enum, so every existing reader
 *  (plan steps, What changed, the focus loop) keeps working. */
export function heldOutcome(held: HeldAnswer): ActionOutcome {
  return held === "yes" ? "helped" : "not_today";
}

/** B-ASKJB-26: the plan step an accept came from. */
export interface PlanStepRef {
  planId: string;
  phaseIdx: number;
  stepIdx: number;
}

export const capacityMinutes: Record<ActionCapacity, number> = { tiny: 2, standard: 5, roomy: 10 };

/** The one accepted-step id for a child's LOCAL calendar day. OBJ-TODAY-03: the
 *  id used to derive from `toISOString()` (UTC) while Today's greeting and
 *  `dayPartFor` read the local hour — so between local and UTC midnight an
 *  accepted step belonged to "yesterday" and the carry-over strip never
 *  rendered. Same local key helper as the practice lane (practice/signals.ts). */
export function todayActionId(childId: string, at = new Date()): string {
  return `today.${childId}.${dayKey(at)}`;
}

/** True for the day's base id and its `.{n}` history suffixes (B-AI-05). */
export function isTodayActionId(id: string, todayId: string): boolean {
  return id === todayId || id.startsWith(`${todayId}.`);
}

/** The first free id for a new accept today: the base id while it is unused,
 *  else `{base}.{n}` (n ≥ 2). B-AI-05: a second accept the same day used to
 *  overwrite the first — including a step whose outcome was already recorded. */
export function nextTodayActionId(items: readonly ActionLoopEntry[], todayId: string): string {
  const taken = new Set(items.map((item) => item.id));
  if (!taken.has(todayId)) return todayId;
  let n = 2;
  while (taken.has(`${todayId}.${n}`)) n += 1;
  return `${todayId}.${n}`;
}

/** B-AI-05 — what an accept writes. Never overwrites an existing row (so a
 *  completed outcome survives). Framer ruling (1 Oct, applied with B-TODAY-18's
 *  carry-over slot): accepting a new step does NOT retire an older unrated
 *  step from a PREVIOUS day — that step is the carry-over question, and it
 *  keeps asking until the parent rates it or MAX_CARRY_DAYS (3) pass, then
 *  expires silently (selectCarryOverAction stops asking; no write). Only
 *  TODAY's still-unrated rows become `superseded` — the live card holds one
 *  step per day. Pure: the caller persists `entry` and each row in
 *  `superseded`. */
export function planAcceptedAction(
  items: readonly ActionLoopEntry[],
  input: { recommendation: string; source: ActionSource; capacity: ActionCapacity; planStep?: PlanStepRef },
  todayId: string,
  at: Date = new Date(),
): { entry: ActionLoopEntry; superseded: ActionLoopEntry[] } {
  const entry: ActionLoopEntry = {
    id: nextTodayActionId(items, todayId),
    recommendation: input.recommendation.trim(),
    source: input.source,
    capacity: input.capacity,
    status: "accepted",
    acceptedAt: at.toISOString(),
    ...(input.planStep ? { planId: input.planStep.planId, phaseIdx: input.planStep.phaseIdx, stepIdx: input.planStep.stepIdx } : {}),
  };
  const superseded = items
    .filter((item) => item.status === "accepted" && !item.outcome && isTodayActionId(item.id, todayId))
    .map((item) => ({ ...item, status: "superseded" as const }));
  return { entry, superseded };
}

/** Today's live step: the newest non-superseded row of today's day key. */
export function activeActionFor(items: readonly ActionLoopEntry[], todayId: string): ActionLoopEntry | null {
  return (
    sortActionLoop(items.filter((item) => item.status !== "superseded" && isTodayActionId(item.id, todayId)))[0] ?? null
  );
}

export function sortActionLoop(items: readonly ActionLoopEntry[]): ActionLoopEntry[] {
  return [...items].sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt));
}

export function latestAction(items: ActionLoopEntry[]): ActionLoopEntry | null {
  return sortActionLoop(items)[0] ?? null;
}
