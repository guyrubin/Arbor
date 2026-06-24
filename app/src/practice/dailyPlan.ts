/**
 * CI-30 — Daily Plan Generator data model and selection logic.
 *
 * Clinical-gate compliance (verdict: build-ready-narrowed):
 *
 * SCREEN HOOK (screenHookRequired=true per gate):
 *   The why-line interpolates the CI-28 goal label and CI-29 interest token —
 *   both parent-supplied strings that could contain unexpected content. Even
 *   though the label catalogue is curated, the assembled string is treated as
 *   "model-/template-composed" per CLI-06/CI-22/CI-24/Blueprint precedent.
 *   Every assembled why-line passes through screenModelOutputLexical (the fast
 *   lexical floor from safety/outputScreen.ts) before it is stored on DailyPlan.
 *   If the lexical screen flags the string, it is replaced with the safe sparse
 *   fallback (gate §0 / requiredFixes #1).
 *
 * BANNED STRINGS (from clinical gate bannedStrings + requiredFixes):
 *   - Effect-verbs on child capacity (improves/builds/boosts/trains/strengthens/
 *     develops/reduces) — the why-line uses provenance language, never causal claims.
 *   - Progress score / % / "on track" / "goal achieved" — no aggregation.
 *   - Condition names in the why-line — goal label is screened at build time
 *     (CI-28 lint) and again by screenModelOutputLexical at runtime.
 *   - "clinically validated / clinician-reviewed / clinically proven" — firewall §0.
 *   - Comprehension/expressive-language verdicts in observation prompts.
 *
 * POST-ACTIVITY OBSERVATION:
 *   - Parent-attributed descriptive note only. Never aggregated into a progress
 *     score / % / ring / "on track" / "goal achieved" verdict (requiredFix #3).
 *   - COPPA/GDPR: observation write path uses useChildCollection ("goalObservations"
 *     sub-collection per child, arbor-safety COPPA review gates prod deploy per
 *     requiredFix #4 — reusing CI-23/CI-24/CI-28 write-path precedent).
 *
 * COMMUNICATION-GOAL RAIL:
 *   - If a goal touches the "language" domain, the DailyPlanCard emits no
 *     communication-specific copy and does NOT auto-fire the CI-25/CI-23 referral
 *     rail. That rail (ASHA/CDC-windowed, source-verified, non-auto-firing) is
 *     invoked by the parent component only when appropriate (requiredFix #7).
 */

import { screenModelOutputLexical } from "../safety/outputScreen";
import type { ActiveGoal } from "./goalBuilder";
import type { ScoredActivity, SessionLength } from "../playbank/select";

// ── Types ─────────────────────────────────────────────────────────────────────

/** One daily plan record — computed once per daySeed, stable within a day. */
export interface DailyPlan {
  /** The scored activity driving this plan. */
  scoredActivity: ScoredActivity;
  /** CI-28 goal that linked this plan (first active goal matching the activity's domain). */
  goal: ActiveGoal | null;
  /** CI-29 sanitized interest token used in the why-line (null = not used). */
  matchedInterest: string | null;
  /** Provenance why-line, assembled and screened. Always safe to render. */
  whyLine: string;
  /** True when why-line fell back to sparse because the screen was triggered
   *  or data was insufficient (fewer than 5 logged days). */
  sparse: boolean;
  /** True when today is Saturday or Sunday (drives weekend variant in the UI). */
  isWeekend: boolean;
  /**
   * CI-31: initial session length for this plan (derived from date: weekend = extended,
   * weekday = standard). The parent can override via the chip row.
   */
  defaultSessionLength: SessionLength;
}

/** One post-activity observation — stored in the child's goalObservations sub-collection. */
export interface GoalObservation {
  id: string;
  /** The CI-28 goal this observation feeds (never aggregated into a progress score). */
  goalId: string;
  /** The capability node the activity maps to. */
  capabilityNodeId: string;
  /** Parent-authored free-text, max 200 chars. Never interpreted as clinical output. */
  observationText: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
}

// ── Build-time lint: effect-verb + comprehension-leak ban (requiredFix #5) ────
//
// These are checked against the why-line template strings at module load time.
// Any template containing a banned token throws at startup and in `npm run build`.

const EFFECT_VERBS_RE =
  /\b(improves?|builds?|boosts?|trains?|strengthens?|develops?|reduces?|calms?|fixes?|assesses?|screens?|evaluates?|measures?)\b/i;

const COMPREHENSION_TOKENS_RE =
  /\b(understands?|comprehends?|follows?\s+directions?|articulates?\s+better|speech\s+is\s+improving)\b/i;

/** Safe why-line templates (provenance language — never causal claims on child capacity). */
const WHY_LINE_TEMPLATES = {
  withGoalAndInterest:
    "Matched to your goal — {goal} — and {name}'s interest in {interest}. Developmentally informed, grounded in CDC/AAP/ASHA/WHO.",
  withGoalOnly:
    "Picked because you're working on {goal} with {name}. Developmentally informed, grounded in CDC/AAP/ASHA/WHO.",
  withInterestOnly:
    "Chosen because {name} loves {interest} — and because it fits this stage. Developmentally informed, grounded in CDC/AAP/ASHA/WHO.",
  stage:
    "A good fit for where {name} is right now. Developmentally informed, grounded in CDC/AAP/ASHA/WHO.",
  weekend:
    "A weekend plan — a little more time today. Matched to your goal — {goal}. Developmentally informed, grounded in CDC/AAP/ASHA/WHO.",
  weekendNoGoal:
    "A weekend plan — a little more time today. A good fit for where {name} is right now. Developmentally informed, grounded in CDC/AAP/ASHA/WHO.",
  sparse:
    "Gets more personalized as you log more days. Developmentally informed, grounded in CDC/AAP/ASHA/WHO.",
};

// Assert templates are clean at module load time.
for (const [key, tmpl] of Object.entries(WHY_LINE_TEMPLATES)) {
  if (key === "sparse") continue; // sparse line is a single fixed string — no interpolation
  if (EFFECT_VERBS_RE.test(tmpl)) {
    throw new Error(`[CI-30 lint] Why-line template "${key}" contains a banned effect-verb.`);
  }
  if (COMPREHENSION_TOKENS_RE.test(tmpl)) {
    throw new Error(`[CI-30 lint] Why-line template "${key}" contains a banned comprehension token.`);
  }
}

// ── Why-line assembly + screen ─────────────────────────────────────────────────

/**
 * Assemble and screen the why-line for a daily plan.
 *
 * screenHookRequired=true: after interpolation, every assembled string is run
 * through screenModelOutputLexical (the CONDITIONS regex + diagnosis/medication/
 * treatment patterns from safety/outputScreen.ts). If flagged, we fall back to
 * the sparse-data line — never render a flagged string (requiredFix #1).
 */
export function assembleWhyLine(opts: {
  goalLabel: string | null;
  childName: string;
  matchedInterest: string | null;
  isWeekend: boolean;
  sparse: boolean;
}): { whyLine: string; wasFlagged: boolean } {
  const { goalLabel, childName, matchedInterest, isWeekend, sparse } = opts;

  if (sparse) {
    return { whyLine: WHY_LINE_TEMPLATES.sparse, wasFlagged: false };
  }

  // Pick the appropriate template.
  let raw: string;
  if (isWeekend && goalLabel) {
    raw = WHY_LINE_TEMPLATES.weekend
      .replace("{goal}", goalLabel)
      .replace("{name}", childName);
  } else if (isWeekend) {
    raw = WHY_LINE_TEMPLATES.weekendNoGoal.replace("{name}", childName);
  } else if (goalLabel && matchedInterest) {
    raw = WHY_LINE_TEMPLATES.withGoalAndInterest
      .replace("{goal}", goalLabel)
      .replace("{name}", childName)
      .replace("{interest}", matchedInterest);
  } else if (goalLabel) {
    raw = WHY_LINE_TEMPLATES.withGoalOnly
      .replace("{goal}", goalLabel)
      .replace("{name}", childName);
  } else if (matchedInterest) {
    raw = WHY_LINE_TEMPLATES.withInterestOnly
      .replace("{name}", childName)
      .replace("{interest}", matchedInterest);
  } else {
    raw = WHY_LINE_TEMPLATES.stage.replace("{name}", childName);
  }

  // Screen the assembled string (requiredFix #1 — screenHookRequired gate).
  const verdict = screenModelOutputLexical(raw);
  if (verdict.flagged) {
    // Fall back to the sparse line — never render a flagged string.
    return { whyLine: WHY_LINE_TEMPLATES.sparse, wasFlagged: true };
  }

  return { whyLine: raw, wasFlagged: false };
}

// ── Day seed helpers ───────────────────────────────────────────────────────────

/** Returns true if the given timestamp falls on Saturday (6) or Sunday (0). */
export function isWeekendDate(nowMs: number): boolean {
  return [0, 6].includes(new Date(nowMs).getDay());
}

// ── Daily plan selector ────────────────────────────────────────────────────────

const MIN_LOGGED_DAYS_FOR_PERSONALIZED_LINE = 5;

/**
 * Derive a DailyPlan from the ranked activity picks + active context.
 *
 * Precondition B (sparse): if loggedDayCount < 5, the why-line degrades to
 * the sparse fallback but an activity IS still suggested (no cold-start failure).
 * Precondition A (no goal): when goals is empty, goal is null and the plan falls
 * back to the concern / stage match.
 */
export function buildDailyPlan(opts: {
  picks: ScoredActivity[];
  activeGoals: ActiveGoal[];
  childName: string;
  loggedDayCount: number;
  nowMs: number;
}): DailyPlan | null {
  const { picks, activeGoals, childName, loggedDayCount, nowMs } = opts;
  if (!picks.length) return null;

  const top = picks[0];
  const isWeekend = isWeekendDate(nowMs);
  const sparse = loggedDayCount < MIN_LOGGED_DAYS_FOR_PERSONALIZED_LINE;

  // Find the first active goal whose domain matches the top pick's activity domain.
  const matchingGoal =
    activeGoals.find((g) => g.domainId === top.activity.domain) ?? null;

  // The interest used in the why-line — only from an interest-match reason.
  const matchedInterest =
    top.reason === "interest-match" ? (top.matchedInterest ?? null) : null;

  // Assemble + screen the why-line.
  const { whyLine, wasFlagged } = assembleWhyLine({
    goalLabel: matchingGoal?.label ?? null,
    childName,
    matchedInterest,
    isWeekend,
    sparse,
  });

  const defaultSessionLength: SessionLength = isWeekend ? "extended" : "standard";

  return {
    scoredActivity: top,
    goal: matchingGoal,
    matchedInterest,
    whyLine,
    sparse: sparse || wasFlagged,
    isWeekend,
    defaultSessionLength,
  };
}

// ── Observation write helpers ─────────────────────────────────────────────────

/**
 * Build a GoalObservation document for the child's goalObservations sub-collection.
 *
 * COPPA note: this is child-attributed data. arbor-safety COPPA review gates
 * prod deploy (requiredFix #4 — reusing CI-23/CI-24/CI-28 write-path precedent).
 * The observation is parent-authored text; it is NEVER aggregated into a progress
 * score / % / ring / "on track" / "goal achieved" verdict (requiredFix #3).
 */
export function buildGoalObservation(opts: {
  plan: DailyPlan;
  observationText: string;
}): GoalObservation {
  const { plan, observationText } = opts;
  const sanitized = observationText.slice(0, 200);
  return {
    id: `obs-${Date.now()}`,
    goalId: plan.goal?.goalId ?? "no-goal",
    capabilityNodeId: plan.scoredActivity.activity.domain,
    observationText: sanitized,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Estimate the number of distinct calendar days that have logged behavior events.
 * Used to determine whether the plan can show a personalized why-line (sparse < 5).
 * Pure function — no I/O.
 */
export function estimateLoggedDayCount(
  logs: { timestamp: string | number }[]
): number {
  const days = new Set<string>();
  for (const log of logs) {
    try {
      const d = new Date(typeof log.timestamp === "number" ? log.timestamp : log.timestamp);
      if (!isNaN(d.getTime())) {
        days.add(d.toISOString().slice(0, 10));
      }
    } catch {
      // ignore
    }
  }
  return days.size;
}
