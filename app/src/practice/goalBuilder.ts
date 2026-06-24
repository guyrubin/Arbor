/**
 * CI-28 — Goal Builder data model.
 *
 * Clinical-gate compliance (verdict: build-ready-narrowed):
 * - All goal labels are behaviour/situation/competency nouns — never condition
 *   names (no autism/ADHD/anxiety/SPD etc.) and never effect-verb claims on a
 *   child capacity (no "builds", "trains", "develops", "reduces" etc.).
 * - The concern->goal mapping is 100% static curated strings; no model-authored
 *   output, so screenModelOutput is not triggered by this module itself (gate §C
 *   conditional). Any future dynamic mapping must pass screenModelOutputLexical.
 * - Observation link = flat count only; no score, %, bar, ring, streak, or trend.
 * - Goal cap: 1–3 active goals (product constraint, not clinical).
 * - Non-diagnostic: the label list receives a build-time lint check (see bottom)
 *   against condition-name and effect-verb token lists (gate §A).
 * - "developmentally informed, grounded in CDC/AAP/ASHA/WHO" — copy authority.
 */

import type { PlayDomain } from "../playbank/content";
import { BRAND_HEX } from "../lib/tokens";

/**
 * Domain color map — single source of truth for the domain colour dot rendered
 * in GoalBuilderModal status view. Uses BRAND_HEX constants from tokens.ts so
 * values stay in sync with the design token palette.
 * Social domain uses --arbor-peach (#d9763f) — the nearest brand token to the
 * previous hardcoded #e07b5a (a warm coral with no token counterpart).
 */
export const DOMAIN_COLOR: Record<PlayDomain, string> = {
  cognitive:  BRAND_HEX.lav,    // #7a6bd8
  regulation: BRAND_HEX.green,  // #34b277 (was #3cc081 — corrected to canonical)
  social:     BRAND_HEX.peach,  // #d9763f (nearest brand token to #e07b5a)
  language:   BRAND_HEX.sky,    // #3f8cc9
  motor:      BRAND_HEX.ochre,  // #c2882a (warm yellow — closest brand token)
};

// ── Types ────────────────────────────────────────────────────────────────────

/** A single curated goal the parent can select. */
export interface GoalTile {
  /** Stable id — stored on ChildProfile.activeGoals[].goalId */
  id: string;
  /** Plain-language behaviour/situation/competency label. Approved by gate §A. */
  label: string;
  /** Which PlayDomain this goal maps to for Daily Play weighting (1.6x). */
  domainId: PlayDomain;
  /** Emoji/label shorthand for the domain colour dot in the status view. */
  domainColor: string;
  /** Icon name from lucide-react, rendered in the tile grid. */
  icon: string;
}

/** One active goal stored on ChildProfile. */
export interface ActiveGoal {
  goalId: string;
  label: string;
  domainId: PlayDomain;
  addedAt: string; // ISO-8601
}

// ── Curated goal tile catalogue (gate §A: clinical-lead reviewed) ────────────
//
// Labels are behaviour/situation/competency nouns only. They are the ONLY strings
// a parent can select — no free text, no auto-assignment.

export const GOAL_TILES: GoalTile[] = [
  {
    id: "following-instructions",
    label: "Following multi-step instructions",
    domainId: "cognitive",
    domainColor: DOMAIN_COLOR.cognitive,
    icon: "ListChecks",
  },
  {
    id: "separation-settling",
    label: "Settling at drop-off / easing separations",
    domainId: "regulation",
    domainColor: DOMAIN_COLOR.regulation,
    icon: "DoorOpen",
  },
  {
    id: "taking-turns",
    label: "Taking turns and sharing",
    domainId: "social",
    domainColor: DOMAIN_COLOR.social,
    icon: "Users",
  },
  {
    id: "trying-new-foods",
    label: "Trying new foods",
    domainId: "regulation",
    domainColor: DOMAIN_COLOR.regulation,
    icon: "Utensils",
  },
  {
    id: "bedtime-wind-down",
    label: "Winding down at bedtime",
    domainId: "regulation",
    domainColor: DOMAIN_COLOR.regulation,
    icon: "Moon",
  },
  {
    id: "big-feelings",
    label: "Naming and managing big feelings",
    domainId: "regulation",
    domainColor: DOMAIN_COLOR.regulation,
    icon: "Heart",
  },
  {
    id: "early-talking",
    label: "Building early talking / back-and-forth",
    domainId: "language",
    domainColor: DOMAIN_COLOR.language,
    icon: "MessageCircle",
  },
  {
    id: "transitions",
    label: "Moving between activities more smoothly",
    domainId: "regulation",
    domainColor: DOMAIN_COLOR.regulation,
    icon: "RefreshCw",
  },
];

// ── Build-time lint: no condition names, no effect-verb claims ───────────────
//
// Gate §A requires a build-time lint on the label list. This runs as a pure
// assertion at module load time (zero runtime cost after the first import).
// Any label that matches the banned token lists will throw at startup in dev
// and during `npm run build`, surfacing the violation before it ships.

/** Condition names banned from goal labels (from the clinical-gate bannedStrings). */
const BANNED_CONDITION_TOKENS =
  /\b(autism|autistic|adhd|add\b|anxiety|separation anxiety|spd|sensory processing|arfid|dyslexia|speech delay|language delay|dysregulation|processing disorder|executive dysfunction|asperger|ocd|bipolar|conduct disorder|ptsd|tourette)\b/i;

/** Effect-verb claims banned from goal labels (child-capacity causal claims). */
const BANNED_EFFECT_VERBS =
  /\b(improves|builds|boosts|trains|strengthens|develops|reduces|assesses|screens|evaluates|measures)\b/i;

/** Clinical verdict strings banned anywhere in labels. */
const BANNED_VERDICT_STRINGS =
  /\b(goal progress score|% to goal|goal complete|goal achieved|behind|delayed|at-risk|on-track|clinically validated|clinician-reviewed|sounds like autism|sounds like adhd)\b/i;

// Assert every label at module-load time (gate §A lint).
for (const tile of GOAL_TILES) {
  if (BANNED_CONDITION_TOKENS.test(tile.label)) {
    throw new Error(`[CI-28 lint] Goal label contains a banned condition name: "${tile.label}"`);
  }
  if (BANNED_EFFECT_VERBS.test(tile.label)) {
    throw new Error(`[CI-28 lint] Goal label contains a banned effect-verb: "${tile.label}"`);
  }
  if (BANNED_VERDICT_STRINGS.test(tile.label)) {
    throw new Error(`[CI-28 lint] Goal label contains a banned verdict string: "${tile.label}"`);
  }
}

// ── Concern -> Goal pre-fill mapping ────────────────────────────────────────
//
// Maps an onboarding concern id (from OnboardingFlow CONCERNS array) to zero or
// more goal tile ids that the parent's concern loosely corresponds to.
// Pre-fill = tile is HIGHLIGHTED (visual cue), never pre-selected.
// The parent must tap the tile explicitly to confirm. Gate §D compliance.
//
// All strings here are static. No model-authored output. Gate §C is conditional
// (not triggered) because this mapping is fully curated.

export const CONCERN_TO_GOAL_PREFILL: Record<string, string[]> = {
  sleep: ["bedtime-wind-down"],
  behavior: ["big-feelings", "transitions"],
  speech: ["early-talking"],
  eating: ["trying-new-foods"],
  start: [],   // "Just getting started" — no pre-fill
  other: [],   // "Something specific" — no pre-fill
};

/**
 * Returns goal tile ids to pre-highlight (not pre-select) given a concern id
 * from the onboarding flow. Returns empty array when no mapping exists.
 * Gate §D: concern pre-fill highlights a tile, never selects it.
 */
export function prefillGoalIdsForConcern(concernId: string): string[] {
  return CONCERN_TO_GOAL_PREFILL[concernId] ?? [];
}

/** Look up a goal tile by id. Returns undefined if not found. */
export function goalTileById(id: string): GoalTile | undefined {
  return GOAL_TILES.find((t) => t.id === id);
}

/** Return the set of active PlayDomains from the active goals list. */
export function activeGoalDomains(activeGoals: ActiveGoal[]): PlayDomain[] {
  return [...new Set(activeGoals.map((g) => g.domainId))];
}

/** Maximum goals a parent can set concurrently (product constraint, not clinical). */
export const MAX_ACTIVE_GOALS = 3;
