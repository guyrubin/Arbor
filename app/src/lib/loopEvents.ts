/**
 * Canonical growth-loop events (P0-4). One typed surface for the funnel the
 * marketing plan optimizes: install → activation (profile + first plan) →
 * habit → refer → pay. Every helper goes through lib/analytics `track()`, so
 * first-touch attribution (market/source/referral_code/utm_*) is attached
 * automatically. Keep event names stable — dashboards depend on them.
 *
 * See PAI/projects/parenting-os-plugin/marketing/arbor-loop-eng-spec.md.
 */
import { track } from "./analytics";

export const LoopEvent = {
  Install: "install",
  AppOpen: "app_open",
  ProfileCreated: "profile_created",
  FirstPlan: "first_plan",
  ShareInitiated: "share_initiated",
  ShareCompleted: "share_completed",
  InviteSent: "invite_sent",
  InviteActivated: "invite_activated",
  TrialStart: "trial_start",
  Paid: "paid",
} as const;

export type LoopArtifact = "avatar" | "story" | "answer_card" | "growth_card";

const LS_INSTALLED = "arbor.installed";
const LS_FIRST_PLAN = "arbor.firstPlanTracked";

/** Returns true the first time it's called for `key`, then false forever (per device). */
function once(key: string): boolean {
  try {
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, new Date().toISOString());
    return true;
  } catch {
    return true; // storage blocked → don't suppress the event
  }
}

/** Emit `install` (first ever open on this device) + `app_open` (every boot). Call once at startup. */
export function trackAppStart(): void {
  if (once(LS_INSTALLED)) track(LoopEvent.Install);
  track(LoopEvent.AppOpen);
}

export function trackProfileCreated(childCount: number, band?: string): void {
  track(LoopEvent.ProfileCreated, { child_count: childCount, ...(band ? { band } : {}) });
}

/** Activation signal — fires only on the family's FIRST generated plan (deduped per device). */
export function trackFirstPlan(props: Record<string, unknown> = {}): void {
  if (once(LS_FIRST_PLAN)) track(LoopEvent.FirstPlan, props);
}

// wired by: CoachAnswerCards.copy() ("answer_card"/"coach") + AskSpecialist.copy()
// ("story"/"ask_specialist"). Future surfaces: mk-p0-3 (avatar), mk-p2-6 (growth_card).
export const trackShareInitiated = (artifact: LoopArtifact, surface?: string): void =>
  track(LoopEvent.ShareInitiated, { artifact, ...(surface ? { surface } : {}) });

// wired by: CoachAnswerCards.copy() + AskSpecialist.copy() on clipboard success.
export const trackShareCompleted = (artifact: LoopArtifact, channel?: string): void =>
  track(LoopEvent.ShareCompleted, { artifact, ...(channel ? { channel } : {}) });

// wired by: mk-p0-2-referral-loop (invite UI owner). Signature frozen here; do
// not add a placeholder call-site — that mission calls it at "invite sent".
export const trackInviteSent = (channel?: string): void =>
  track(LoopEvent.InviteSent, channel ? { channel } : {});

// wired by: mk-p0-2-referral-loop. Fired on the REFERRED side after
// /api/referral/activate succeeds (role:"referred"); the referrer's grant is a
// server-side event. Reuses the stable LoopEvent.InviteActivated name.
export const trackInviteActivated = (role: "referrer" | "referred"): void =>
  track(LoopEvent.InviteActivated, { role });

// wired by: lib/billingTransition.recordBillingTransition() (App BillingReturnWatcher),
// on the free/beta → in_trial entitlement transition. Beta/comp excluded.
export const trackTrialStart = (tier: string): void => track(LoopEvent.TrialStart, { tier });

// wired by: lib/billingTransition.recordBillingTransition() (App BillingReturnWatcher),
// on the transition into active on a real paid plan (provider ≠ comp/none, enforced).
export const trackPaid = (tier: string): void => track(LoopEvent.Paid, { tier });
