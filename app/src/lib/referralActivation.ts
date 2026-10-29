/**
 * mk-p0-2 referral loop, referred side (moved from ArborContext for
 * B-RESID-05 so the share → activation chain is tested through this real
 * handler). Fired with the family's first generated plan: if a referral code
 * was captured first-touch (or typed in Settings before the first plan and
 * held in the same record, lib/attribution holdTypedReferralCode) and this
 * device has not redeemed yet, POST it once. A first-time activation ("granted", or "maxed": the referrer is past
 * the cap but this family still got its month) fires invite_activated, the
 * tail of server/cohortMetrics FUNNEL_CHAINS.share, and refreshes the
 * entitlement. Best-effort and fully guarded: it never blocks plan creation.
 */
import type { ReferralActivateResult } from "./api";
import { consumeReferralCode, consumeReferralVia, releaseTypedReferralCode } from "./attribution";
import { trackInviteActivated } from "./loopEvents";

export const LS_REFERRAL_ACTIVATED = "arbor.referralActivated";

export type ReferralActivationOutcome = "no_code" | "already_here" | "activated" | "not_activated" | "failed";

export async function activateCapturedReferral(deps: {
  activate: (code: string, via?: "link" | "typed") => Promise<ReferralActivateResult>;
  onActivated?: () => void;
}): Promise<ReferralActivationOutcome> {
  const code = consumeReferralCode();
  if (!code) return "no_code";
  try {
    if (localStorage.getItem(LS_REFERRAL_ACTIVATED)) return "already_here";
    localStorage.setItem(LS_REFERRAL_ACTIVATED, new Date().toISOString());
  } catch {
    /* storage blocked — proceed (the server still dedupes per uid) */
  }
  try {
    // B-GROWTH-43: a code typed in Settings before the first plan is held in
    // the same record and redeems here, marked as typed.
    const via = consumeReferralVia();
    const result = via === "typed" ? await deps.activate(code, "typed") : await deps.activate(code);
    if (result.ok && (result.status === "granted" || result.status === "maxed")) {
      trackInviteActivated("referred");
      deps.onActivated?.();
      return "activated";
    }
    // B-GROWTH-43: a held TYPED code the server refused (a typo, the parent's
    // own code, a family that already redeemed) is dropped with its reason, for
    // the Plan card to say once, and the device marker is cleared so a
    // corrected code can be typed. A refused link code keeps its old behaviour.
    if (via === "typed") {
      releaseTypedReferralCode(!result.ok ? (result.status === "self_referral" ? "self" : "unknown") : "already");
      try { localStorage.removeItem(LS_REFERRAL_ACTIVATED); } catch { /* ignore */ }
    }
    return "not_activated";
  } catch {
    // Roll back the device guard so a transient failure can retry next time.
    try { localStorage.removeItem(LS_REFERRAL_ACTIVATED); } catch { /* ignore */ }
    return "failed";
  }
}
