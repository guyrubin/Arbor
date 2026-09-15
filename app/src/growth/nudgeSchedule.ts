/**
 * nudgeSchedule.ts — N1-06: THE delivery contract. One choke point, forever.
 *
 * THE LAW THIS FILE ENCODES
 * ─────────────────────────
 * Quiet hours and the max-2-per-day ceiling are the critic's stated
 * precondition for ANY proactive surface, and there must never be two
 * implementations of them. `growth/jitaiPrefs.ts` owns both — `isInQuietHours`
 * and `isUnderDailyCeiling` / `NUDGE_DAILY_CEILING` — and the per-day ledger
 * (`shownNudgesToday` / `recordNudgeShown`) stays there too. `planNudge` CALLS
 * those helpers. It does not reimplement, re-derive or second-guess them; a
 * locally-defined quiet-hours constant in this file is a guard failure
 * (nudgeSchedule.test.ts pins the import).
 *
 * WHAT IT DECIDES, AND WHAT IT DELIBERATELY DOES NOT
 * ──────────────────────────────────────────────────
 * `lib/jitai.ts` `nextNudge` stays the candidate generator — WHICH nudge, if
 * any, is right for this moment. `planNudge` decides only WHETHER it may be
 * delivered on a given channel, and hands back the name-free copy that channel
 * must use. It never picks a nudge, never writes the shown-ledger (the caller
 * spends the slot, exactly as `useNotifications` does today), and never sends
 * anything anywhere.
 *
 * THE COPY SWAP
 * ─────────────
 * A delivered plan carries BOTH the `candidate` (whose `vars` hold the child's
 * first name — fine in-app, behind auth, which is what the bell renders) and a
 * `template` from growth/nudgeTemplates.ts (name-free, no `vars` field at all).
 * The rule for callers is one line: an IN-APP surface may render the candidate;
 * anything that leaves the app renders the template and only the template.
 *
 * SUPPRESSION PRECEDENCE — deliberate, and pinned by the guard:
 *   1. quiet_hours  — the parent's boundary wins over everything, and is
 *                     answered even when there is no candidate, so a channel
 *                     can prove the boundary bound on real traffic.
 *   2. no_candidate — nothing to say. Silence is a feature, not a fault: this
 *                     is the day-0 answer and is not a contract breach.
 *   3. type_off     — the parent's explicit switch for this kind. It outranks
 *                     the ceiling as an EXPLANATION: a parent who turned a type
 *                     off should not be told the reason was a daily cap.
 *   4. ceiling      — the max-2 contract.
 */
import {
  isInQuietHours,
  isUnderDailyCeiling,
  NUDGE_DAILY_CEILING,
  type JitaiPrefs,
} from "./jitaiPrefs";
import { NUDGE_KIND_PREF, type Nudge, type NudgeKind } from "../lib/jitai";
import { templateFor, type NudgeTemplate } from "./nudgeTemplates";
import type { NudgeChannel, NudgeSuppressReason } from "../lib/kpiEvents";

export type { NudgeChannel, NudgeSuppressReason };

/** Re-exported so a caller never has to reach past this module for the cap. */
export { NUDGE_DAILY_CEILING };

export interface PlanNudgeInput {
  /** The parent's Smart Reminders preferences (growth/jitaiPrefs loadPrefs). */
  prefs: JitaiPrefs;
  /** Distinct nudge kinds already surfaced today (jitaiPrefs shownNudgesToday). */
  shownToday: readonly string[];
  /** Injected clock — this module is pure and deterministic. */
  now: number;
  /** The candidate from jitai `nextNudge`, or null when it stayed quiet. */
  candidate: Nudge | null;
  /** Where this plan would be delivered. */
  channel: NudgeChannel;
}

export interface NudgeDelivery {
  deliver: true;
  kind: NudgeKind;
  channel: NudgeChannel;
  /** In-app copy (carries `vars.name`). NEVER send this off-device. */
  candidate: Nudge;
  /** The name-free payload. The ONLY copy an out-of-app channel may use. */
  template: NudgeTemplate;
}

export interface NudgeSuppression {
  deliver: false;
  reason: NudgeSuppressReason;
  /** The kind that was declined, when one was even in hand. */
  kind: NudgeKind | null;
  channel: NudgeChannel;
}

export type NudgePlan = NudgeDelivery | NudgeSuppression;

/**
 * The ONE delivery decision. Every channel — the in-app bell today, a local
 * notification tomorrow, a server push after that — passes through here.
 *
 * Pure: no storage write, no analytics call, no send. The caller emits
 * `trackNudgeScheduled` / `trackNudgeSuppressed` from the result and spends the
 * ledger slot with `recordNudgeShown`, so this function stays testable and
 * callable from a preview surface without side effects.
 */
export function planNudge(input: PlanNudgeInput): NudgePlan {
  const { prefs, shownToday, now, candidate, channel } = input;
  const kind = candidate ? candidate.kind : null;

  // 1) Quiet hours — the parent's boundary, from jitaiPrefs. Answered first and
  //    without a candidate, so the contract is demonstrably binding.
  if (isInQuietHours(prefs, now)) {
    return { deliver: false, reason: "quiet_hours", kind, channel };
  }

  // 2) Nothing to say.
  if (!candidate) {
    return { deliver: false, reason: "no_candidate", kind: null, channel };
  }

  // 3) The parent switched this kind off. Not every kind has a switch
  //    (NUDGE_KIND_PREF is partial by design); the ones without are governed by
  //    quiet hours and the ceiling alone.
  const pref = NUDGE_KIND_PREF[candidate.kind];
  if (pref && prefs.types[pref] === false) {
    return { deliver: false, reason: "type_off", kind: candidate.kind, channel };
  }

  // 4) The max-2 contract, counted in DISTINCT kinds — a kind already surfaced
  //    today keeps its slot (re-showing it costs nothing new); a third distinct
  //    kind stays silent. The arithmetic belongs to jitaiPrefs.
  if (!shownToday.includes(candidate.kind) && !isUnderDailyCeiling(shownToday.length)) {
    return { deliver: false, reason: "ceiling", kind: candidate.kind, channel };
  }

  return {
    deliver: true,
    kind: candidate.kind,
    channel,
    candidate,
    template: templateFor(candidate.kind),
  };
}
