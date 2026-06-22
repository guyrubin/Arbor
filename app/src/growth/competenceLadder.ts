/* CI-07 / Competence Ladder — scaffolding that deliberately retires itself as
 * the parent succeeds.
 *
 * The rubric this encodes (competence over dependence): guidance should fade as
 * the parent demonstrates they no longer need it, NOT as they spend more time in
 * the app. The advisor's guardrails are load-bearing and are asserted in the
 * test, because a silent / irreversible / engagement-triggered fade inverts this
 * from a competence mechanic into a covert churn mechanic:
 *
 *   1. The fade advances ONLY on a real capability signal — the parent resolving
 *      a situation before opening the prompt, or an explicit, override-able
 *      self-report of competence. Never on app-opens, streaks, or time-in-app.
 *   2. It is REVERSIBLE and parent-visible: whenever guidance has stepped back we
 *      surface "we've stepped back — tap to bring guidance back", and one call
 *      restores full guidance and PINS it so it will not silently re-fade.
 *   3. It is never silent: `steppedBack` + `parentNotice` make the current state
 *      legible to the parent at all times.
 *
 * This module is pure (no I/O); the coaching/nudge surface owns persistence and
 * rendering. Keeping the ladder logic here + tested means a future caller cannot
 * quietly wire an engagement counter into the fade.
 */

export type GuidanceLevel = "full" | "stepped-back" | "minimal";

/** Signals the ladder may receive. Only the capability signals can advance the
 * fade; the engagement signals are accepted but MUST be inert (they exist so a
 * caller can route everything through one chokepoint without leaking). */
export type LadderSignal =
  // capability signals — these (and only these) can fade guidance
  | "resolved-before-prompt" // parent handled it before opening guidance
  | "self-report-competent" // explicit, override-able parent self-report
  // capability signal in the other direction — always steps guidance back up
  | "needed-guidance"
  | "self-report-struggling"
  // engagement signals — MUST NOT advance the fade (kept inert on purpose)
  | "app-opened"
  | "streak-incremented"
  | "time-in-app"
  | "session-started";

/** The capability signals that are allowed to *retire* guidance. */
export const FADE_CAPABILITY_SIGNALS = [
  "resolved-before-prompt",
  "self-report-competent",
] as const;

/** Engagement signals that must never move the ladder. */
export const INERT_ENGAGEMENT_SIGNALS = [
  "app-opened",
  "streak-incremented",
  "time-in-app",
  "session-started",
] as const;

/** Consecutive capability demonstrations required to step down one level. */
export const STEP_DOWN_THRESHOLD = 3;

export interface CompetenceLadderState {
  level: GuidanceLevel;
  /** consecutive capability demonstrations since the last level change */
  consecutiveCapability: number;
  /** parent explicitly asked for guidance back → never auto-fade until cleared */
  pinnedFull: boolean;
}

export function initialLadder(): CompetenceLadderState {
  return { level: "full", consecutiveCapability: 0, pinnedFull: false };
}

const ORDER: GuidanceLevel[] = ["full", "stepped-back", "minimal"];

function stepDown(level: GuidanceLevel): GuidanceLevel {
  const i = ORDER.indexOf(level);
  return ORDER[Math.min(i + 1, ORDER.length - 1)];
}
function stepUp(level: GuidanceLevel): GuidanceLevel {
  const i = ORDER.indexOf(level);
  return ORDER[Math.max(i - 1, 0)];
}

function isFadeSignal(s: LadderSignal): boolean {
  return (FADE_CAPABILITY_SIGNALS as readonly string[]).includes(s);
}
function isReStepUpSignal(s: LadderSignal): boolean {
  return s === "needed-guidance" || s === "self-report-struggling";
}

/**
 * Advance the ladder for one signal. Pure: returns a new state.
 *
 * - Capability signals accumulate; every STEP_DOWN_THRESHOLD in a row steps
 *   guidance down one level — UNLESS the parent has pinned full guidance.
 * - A "needed-guidance" / "self-report-struggling" signal immediately steps
 *   guidance back UP and resets the counter (the scaffold returns the moment
 *   it's needed — competence is not assumed permanent).
 * - Engagement signals are inert: they never change the level or the counter.
 */
export function recordSignal(
  state: CompetenceLadderState,
  signal: LadderSignal,
): CompetenceLadderState {
  if (isReStepUpSignal(signal)) {
    // capability dropped — bring guidance back up, never silently leave it faded
    return {
      level: stepUp(state.level),
      consecutiveCapability: 0,
      pinnedFull: state.pinnedFull,
    };
  }

  if (isFadeSignal(signal)) {
    if (state.pinnedFull) {
      // parent asked to keep full guidance — accumulate nothing, never fade
      return state;
    }
    const next = state.consecutiveCapability + 1;
    if (next >= STEP_DOWN_THRESHOLD && state.level !== "minimal") {
      return { level: stepDown(state.level), consecutiveCapability: 0, pinnedFull: false };
    }
    return { ...state, consecutiveCapability: next };
  }

  // engagement signal → inert by contract
  return state;
}

/** True whenever guidance has been reduced — drives the parent-visible notice. */
export function steppedBack(state: CompetenceLadderState): boolean {
  return state.level !== "full";
}

/** The always-available, parent-visible reversal. Restores full guidance AND
 * pins it so the ladder will not silently re-fade until the parent clears the
 * pin. Reversibility is the guardrail that keeps this a competence mechanic. */
export function bringGuidanceBack(state: CompetenceLadderState): CompetenceLadderState {
  return { level: "full", consecutiveCapability: 0, pinnedFull: true };
}

/** Parent clears the pin (e.g. "let Arbor step back again when I'm ready"). */
export function allowFadeAgain(state: CompetenceLadderState): CompetenceLadderState {
  return { ...state, pinnedFull: false };
}

/** Parent-facing copy contract — never let the fade be silent. EN; HE flagged
 * for human clinical translation (machine translation unsafe for register). */
export const LADDER_COPY = {
  steppedBackNotice: "We've stepped back — you've got this. Tap to bring guidance back.",
  pinnedNotice: "Full guidance is on. Arbor won't step back until you say so.",
} as const;

/** The single read a UI needs: level + whether to show the reversal notice. */
export function ladderView(state: CompetenceLadderState): {
  level: GuidanceLevel;
  showBringBack: boolean;
  notice: string | null;
} {
  if (state.pinnedFull) {
    return { level: "full", showBringBack: false, notice: LADDER_COPY.pinnedNotice };
  }
  return {
    level: state.level,
    showBringBack: steppedBack(state),
    notice: steppedBack(state) ? LADDER_COPY.steppedBackNotice : null,
  };
}
