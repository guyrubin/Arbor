/* Daily Play selector — pure ranking, no I/O.
 *
 * The differentiator vs age-only competitors (Kinedu/Lovevery): the pick is
 * matched to the child's band AND the domains they've actually been struggling
 * with in their log. Deterministic given a daySeed, so "today's pick" is stable
 * across a day and varies day to day. Falls back to band-only when logs are
 * sparse — never a cold-start failure.
 *
 * CI-29: adds a deterministic interest-boost (1.3×) for activities whose
 * themeableContextSlot=true when the parent has recorded interests. The
 * interest framing is a relevance re-rank only — developmental content
 * (whatItBuilds/steps/items) is byte-identical. LLM theme-rewrite is fenced
 * OUT of this phase (separate clinical+cost gate per CIL para 2).
 */

import {
  PLAY_ACTIVITIES, bandForAge, type PlayActivity, type PlayBand, type PlayDomain,
} from "./content";
import type { ActionOutcome } from "../actionLoop/model";

// CI-29 / FIX 3: sanitize a parent-typed interest token before it surfaces in
// card copy. Runs the CONDITIONS lexicon from outputScreen.ts (same source of
// truth). If the token matches, it is neutralized to empty-string — the
// interest is silently dropped from the why-line so a condition word
// (e.g. "autism", "speech delay") can never appear as "[name]'s love of autism".
// This is a deterministic regex lint, not an LLM call (screenHookRequired=false
// for Phase 1 per clinical gate).
const CONDITIONS_RE =
  /autism|autistic|adhd|add\b|asperger|ocd|odd\b|bipolar|depress(?:ion|ive)|anxiety disorder|dyslexia|dyspraxia|apraxia|intellectual disability|developmental delay|sensory processing disorder|attachment disorder|conduct disorder|ptsd|tourette/i;

/** Banned interest-display strings from the CI-29 clinical gate. */
const BANNED_INTEREST_TOKENS_RE =
  /restricted interests?|repetitive interests?|narrow(?:ing)? interests?|intense interest|fixat(?:ion|ed)|obsess(?:ion|ive|ed)|perseverat(?:ion|ive)|hyperfocus|special interest|stim(?:ming|s)?\b|hyper-?fixat(?:ion|ed)|preoccupation/i;

/**
 * Sanitize a raw parent-typed interest token for use in card copy.
 * Returns the trimmed token if safe, or an empty string if the token contains
 * a CONDITIONS word or a banned clinical noun (FIX 3 + FIX 1).
 */
export function sanitizeInterestToken(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (CONDITIONS_RE.test(trimmed)) return "";
  if (BANNED_INTEREST_TOKENS_RE.test(trimmed)) return "";
  return trimmed;
}

/**
 * CI-31: Session-length preference — the parent's declared time budget.
 * "short"    → 8–10 min activities (durationMin ≤ 10)
 * "standard" → 15 min activities   (durationMin 11–20)
 * "extended" → 25–30 min activities (durationMin > 20)
 * Default: "standard".
 */
export type SessionLength = "short" | "standard" | "extended";

/** durationMin range (inclusive) for each session-length bucket. */
export const SESSION_LENGTH_RANGES: Record<SessionLength, [number, number]> = {
  short:    [0, 10],
  standard: [11, 20],
  extended: [21, Infinity],
};

/** All session lengths, in chip-row order. */
export const SESSION_LENGTHS: readonly SessionLength[] = ["short", "standard", "extended"];

/**
 * KID-3: minimum number of in-band activities a session-length bucket must
 * hold before the UI may offer it as a chip. Below this, ranking quality
 * collapses to near-random off-band picks — and an empty bucket would
 * silently fall back to the full pool, badging an 8-minute activity as
 * "25-30 min". Offering only honest buckets removes that path.
 */
export const MIN_SESSION_BUCKET = 3;

/**
 * KID-3: the session lengths that may honestly be offered for a child of
 * this age — a bucket qualifies only when it holds at least
 * MIN_SESSION_BUCKET activities matching the child's band. The AR-CONT-02
 * content wave stocked the extended (21–30 min) bucket for toddler /
 * preschool / early-school and the standard bucket for infants; infants
 * deliberately have NO extended activities (a 25–30 minute guided session is
 * not an honest ask of that band), so the extended chip stays hidden there.
 */
export function availableSessionLengths(ageYears: number): SessionLength[] {
  const band = bandForAge(ageYears);
  return SESSION_LENGTHS.filter((s) => {
    const [minDur, maxDur] = SESSION_LENGTH_RANGES[s];
    let n = 0;
    for (const a of PLAY_ACTIVITIES) {
      if (a.durationMin >= minDur && a.durationMin <= maxDur && a.bands.includes(band)) {
        n += 1;
        if (n >= MIN_SESSION_BUCKET) return true;
      }
    }
    return false;
  });
}

/* ── W2 masterplan 2.5: recommendation continuation (Maytal frame 5) ─────────
 * The parent's LAST reported outcome on a recommendation feeds the ranking:
 *  - "helped"     → prefer a next step in the SAME domain (×1.35 — above the
 *                   interest nudge at 1.3, below goal 1.6 / top-concern 1.8,
 *                   so parent-explicit intent still wins);
 *  - "not_today"  → prefer a DIFFERENT domain (same-domain ×0.75) and nudge
 *                   lower-effort picks (durationMin ≤ 10 → ×1.15);
 *  - "somewhat"   → neutral: ranking is byte-identical to no input.
 * Deterministic: weights only — never randomness; the day seed stays the sole
 * rotation source. No lastAction → byte-identical selection (test-pinned).
 *
 * CLINICAL FIREWALL / attribution rule: the `continuation` flag below may be
 * set ONLY from a parent-reported "helped" outcome — the UI line it gates is
 * an echo of the parent's own report ("you said this helped"), never an AI
 * efficacy claim and never a grade. */

/** Continuation same-domain boost after a parent-reported "helped". */
export const CONTINUATION_NEXT_STEP_BOOST = 1.35;
/** Same-domain damping after a parent-reported "not_today". */
export const CONTINUATION_SWITCH_DAMP = 0.75;
/** Lower-effort (durationMin ≤ 10) nudge after "not_today". */
export const CONTINUATION_LOW_EFFORT_BOOST = 1.15;
/** durationMin ceiling considered "lower effort" for the not_today nudge. */
export const CONTINUATION_LOW_EFFORT_MAX_MIN = 10;

/** The parent's last recommendation + their own reported outcome on it. */
export interface LastPlayAction {
  /** The recommendation text the parent acted on (actionLoops record). */
  recommendation: string;
  /** Parent-reported outcome — the ONLY source of continuation framing. */
  outcome: ActionOutcome;
}

/**
 * Best-effort domain read of a free-text recommendation (AI focus text /
 * digest step / learn tryToday). Reuses the behaviour-type lexicon first,
 * then a small activity-verb lexicon. Deterministic regex only — returns
 * null when nothing matches (continuation then adjusts nothing except the
 * not_today low-effort nudge).
 */
export function domainForRecommendation(text: string): PlayDomain | null {
  const viaBehavior = domainForBehaviorType(text);
  if (viaBehavior) return viaBehavior;
  const t = text.toLowerCase();
  if (/(breath|calm|sooth|feeling|emotion|wind.?down|relax)/.test(t)) return "regulation";
  if (/(story|book|read|sing|rhyme|narrat|vocabul)/.test(t)) return "language";
  if (/(puzzle|count|sort|match|memory|build|stack)/.test(t)) return "cognitive";
  if (/(together|turn.?tak|pretend|role.?play|greet)/.test(t)) return "social";
  if (/(jump|run|climb|ball|dance|draw|scissor|crawl)/.test(t)) return "motor";
  return null;
}

export interface PlaySelectContext {
  ageYears: number;
  /** Domains the child has recently struggled with (from their log). */
  concernDomains?: PlayDomain[];
  /**
   * CI-28: Domains derived from the parent's explicitly selected active goals
   * (from ChildProfile.activeGoals). Applied at 1.6× weight — higher than the
   * concern-log boost — so goal-linked activities surface first. These are
   * injected by OverviewTab and DailyPlayTab when goals are active.
   */
  goalDomains?: PlayDomain[];
  /** Activity ids done recently — deprioritised for novelty. */
  recentlyDoneIds?: string[];
  /** Stable per-day seed so the pick doesn't churn within a day. */
  daySeed?: number;
  /**
   * CI-29: Parent-recorded interests (from ChildProfile.interests).
   * When non-empty, activities with themeableContextSlot=true receive a 1.3×
   * interest-boost — a relevance re-rank, not a developmental claim.
   * Tokens are pre-sanitized via sanitizeInterestToken before this context
   * is constructed (FIX 3: no condition word reaches card copy).
   */
  interests?: string[];
  /**
   * CI-31: Parent-declared session length — filters the ranked list to
   * activities within the matching durationMin range. Falls back to
   * "standard" when undefined or when the filtered result is empty (so there
   * is never a cold-start failure from an empty bucket). No child-data write.
   */
  sessionLength?: SessionLength;
  /**
   * W2 2.5: the last recommendation + the parent's own reported outcome
   * (actionLoops). Adjusts ranking WEIGHTS only (see constants above) —
   * never randomness. Absent → selection is byte-identical to today.
   */
  lastAction?: LastPlayAction;
}

export interface ScoredActivity {
  activity: PlayActivity;
  score: number;
  /**
   * Why it surfaced, for an honest "because…" line in the UI.
   * CI-28 adds "goal-match": the parent explicitly set a focus for this domain.
   * CI-29 adds "interest-match": the activity has themeableContextSlot=true and
   * the child has recorded interests. The why-line references interests[0].
   * Reason precedence: goal-match > concern-match > interest-match > stage-match.
   */
  reason: "concern-match" | "stage-match" | "goal-match" | "interest-match";
  /**
   * CI-29: The sanitized interest token that drove an interest-match reason.
   * Only set when reason === "interest-match". Used by DailyPlayCard to render
   * "Matched to [name]'s love of [interest]" without any further processing.
   */
  matchedInterest?: string;
  /**
   * W2 2.5: true ONLY when the parent reported "helped" on their last
   * recommendation AND this activity is the same-domain next step that the
   * continuation boost surfaced. Gates the DailyPlayCard continuation line
   * ("You said this helped — the next step:") — an echo of the parent's own
   * report, never an AI efficacy claim. Absent lastAction → never set.
   */
  continuation?: boolean;
}

/** Map a logged behaviour type to the developmental domain it stresses. */
export function domainForBehaviorType(type: string): PlayDomain | null {
  const t = type.toLowerCase();
  if (/(transition|screen|tantrum|melt|refus|sleep|bedtime|frustrat)/.test(t)) return "regulation";
  if (/(sibling|share|conflict|friend|social|hit|bite)/.test(t)) return "social";
  if (/(speech|word|talk|language|stutter|articul)/.test(t)) return "language";
  if (/(focus|attention|task|listen)/.test(t)) return "cognitive";
  if (/(motor|clumsy|coordination|balance)/.test(t)) return "motor";
  return null;
}

/** Derive the concern domains from recent logs (most-frequent first). */
export function concernDomainsFromLogs(
  logs: { behaviorType: string; timestamp: string | number }[],
  nowMs: number,
  windowDays = 21
): PlayDomain[] {
  const since = nowMs - windowDays * 86_400_000;
  const counts = new Map<PlayDomain, number>();
  for (const l of logs) {
    const t = typeof l.timestamp === "number" ? l.timestamp : new Date(l.timestamp).getTime();
    if (!Number.isFinite(t) || t < since) continue;
    const d = domainForBehaviorType(l.behaviorType);
    if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d);
}

/** Small deterministic 0–1 jitter so equal-scoring picks rotate by day. */
function jitter(id: string, daySeed: number): number {
  let h = daySeed | 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
}

function matchesBand(activity: PlayActivity, band: PlayBand): boolean {
  return activity.bands.includes(band);
}

export function rankDailyPlay(ctx: PlaySelectContext): ScoredActivity[] {
  const band = bandForAge(ctx.ageYears);
  const concerns = ctx.concernDomains ?? [];
  const goals = ctx.goalDomains ?? [];
  const done = new Set(ctx.recentlyDoneIds ?? []);
  const daySeed = ctx.daySeed ?? 0;
  // CI-29: sanitize interest tokens at ranking time so no condition word
  // can survive into card copy (FIX 3). Stable first element = deterministic
  // "love of [interest]" display within a day.
  const interests = (ctx.interests ?? []).map(sanitizeInterestToken).filter(Boolean);
  const hasInterests = interests.length > 0;

  // W2 2.5: continuation weights from the parent's own last report. "somewhat"
  // is deliberately neutral — the spec defines re-ranking for "helped" and
  // "not_today" only, and anything else must stay byte-identical.
  const lastOutcome = ctx.lastAction?.outcome;
  const lastDomain =
    ctx.lastAction && (lastOutcome === "helped" || lastOutcome === "not_today")
      ? domainForRecommendation(ctx.lastAction.recommendation)
      : null;

  // CI-31: apply session-length filter only when explicitly provided.
  // When the filtered pool is empty (e.g. no activities yet in the extended
  // bucket) fall back to the full pool so there is never a cold-start failure.
  // When sessionLength is undefined the full pool is used unchanged — this
  // preserves backward compatibility for callers that don't know about CI-31.
  let activities = PLAY_ACTIVITIES;
  if (ctx.sessionLength) {
    const [minDur, maxDur] = SESSION_LENGTH_RANGES[ctx.sessionLength];
    const pool = PLAY_ACTIVITIES.filter(
      (a) => a.durationMin >= minDur && a.durationMin <= maxDur
    );
    activities = pool.length > 0 ? pool : PLAY_ACTIVITIES;
  }

  return activities
    .map((activity) => {
      const bandScore = matchesBand(activity, band) ? 1 : 0.35;

      // CI-28: goal domains apply at 1.6x weight — parent-explicit intent ranks
      // above the inferred concern-log boost (1.8 max). Both can compound on the
      // same activity if the activity's domain matches both.
      const goalMatch = goals.includes(activity.domain);
      const goalBoost = goalMatch ? 1.6 : 1;
      // Concern domains decay by rank: the top struggle weighs most.
      const concernIdx = concerns.indexOf(activity.domain);
      const concernBoost = concernIdx === -1 ? 1 : 1.8 - concernIdx * 0.25;
      const novelty = done.has(activity.id) ? 0.4 : 1;
      // CI-29: interest-boost (1.3×) applies to themeable activities when
      // interests are recorded. Lower than goal (1.6×) and top concern (1.8×)
      // so it nudges without overriding explicit parent intent.
      const interestBoost = hasInterests && activity.themeableContextSlot ? 1.3 : 1;
      // W2 2.5: continuation weights — helped → same-domain next step up
      // (1.35×); not_today → same-domain damped (0.75×) + lower-effort nudge
      // (1.15× for durationMin ≤ 10). No lastAction → all three stay 1.
      const sameDomainAsLast = lastDomain !== null && activity.domain === lastDomain;
      const continuationBoost =
        lastOutcome === "helped" && sameDomainAsLast ? CONTINUATION_NEXT_STEP_BOOST
        : lastOutcome === "not_today" && sameDomainAsLast ? CONTINUATION_SWITCH_DAMP
        : 1;
      const lowEffortBoost =
        lastOutcome === "not_today" && activity.durationMin <= CONTINUATION_LOW_EFFORT_MAX_MIN
          ? CONTINUATION_LOW_EFFORT_BOOST
          : 1;
      const score =
        bandScore * goalBoost * concernBoost * interestBoost * novelty *
          continuationBoost * lowEffortBoost +
        jitter(activity.id, daySeed) * 0.05;
      // Reason precedence: goal-match > concern-match > interest-match > stage-match.
      const isInterestMatch = hasInterests && !!activity.themeableContextSlot && matchesBand(activity, band);
      const reason: ScoredActivity["reason"] =
        goalMatch && matchesBand(activity, band)
          ? "goal-match"
          : concernIdx !== -1 && matchesBand(activity, band)
          ? "concern-match"
          : isInterestMatch
          ? "interest-match"
          : "stage-match";
      const matchedInterest = reason === "interest-match" ? interests[0] : undefined;
      // ATTRIBUTION PIN: `continuation` derives ONLY from the parent-reported
      // "helped" outcome (never "somewhat"/"not_today", never absent input).
      const continuation =
        lastOutcome === "helped" && sameDomainAsLast && matchesBand(activity, band)
          ? true
          : undefined;
      return { activity, score, reason, matchedInterest, continuation };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Top N picks; the first is "today's pick".
 *
 * CI-28 guarantee: when the parent has active goalDomains, at least one
 * goal-match activity must appear in the returned picks — even when the
 * concern-domain boost (up to 1.8×) outranks the goal boost (1.6×) for
 * every slot. If no goal-match activity is present in the top `count` picks
 * after pure score-ranking, the highest-scoring goal-match from the full
 * ranked list replaces the lowest-ranked pick in the top N.
 *
 * This guarantee lives in selectDailyPlay (the UI slice), not in
 * rankDailyPlay, so raw score tests remain unaffected and the concern/stage
 * ranking is preserved for all other slots.
 */
export function selectDailyPlay(ctx: PlaySelectContext, count = 3): ScoredActivity[] {
  const ranked = rankDailyPlay(ctx);
  const picks = ranked.slice(0, count);

  const goals = ctx.goalDomains ?? [];
  if (goals.length === 0) return picks;

  const hasGoalMatch = picks.some((p) => p.reason === "goal-match");
  if (hasGoalMatch) return picks;

  // No goal-match made the cut — inject the highest-scoring goal-match from
  // the remainder of the ranked list. Replace the last pick (lowest-ranked
  // of the top N) to keep the result exactly `count` items.
  const topGoalMatch = ranked.slice(count).find((p) => p.reason === "goal-match");
  if (topGoalMatch) {
    return [...picks.slice(0, count - 1), topGoalMatch];
  }

  return picks;
}

/** A stable day seed (days since epoch) from a timestamp. */
export function daySeedFor(nowMs: number): number {
  return Math.floor(nowMs / 86_400_000);
}
