/**
 * Pay-funnel instrumentation (P0-4). Fires `trial_start` / `paid` on the
 * ENTITLEMENT TRANSITION — not on a web `?billing=success` redirect alone — so
 * it works identically for the web Stripe redirect-back and for native
 * RevenueCat (app_store/play_store), which never sees the web query param.
 *
 * The "last billed state" is persisted in localStorage so each transition fires
 * exactly once per device, mirroring the once() dedup in loopEvents.ts. Beta /
 * comp entitlements (everyone resolves to Plus in beta) are explicitly excluded
 * so they never pollute the paid count.
 */
import type { EntitlementInfo } from "./api";
import { trackTrialStart, trackPaid } from "./loopEvents";

const LS_LAST_BILLED = "arbor.lastBilledPlan";

/** Stable signature of the billing state we dedup against. */
function stateKey(plan: string, status: string): string {
  return `${plan}:${status}`;
}

/**
 * Returns true when this entitlement reflects a genuine, payable subscription —
 * i.e. NOT free, and NOT a beta/comp grant. `enforced === false` on a paid plan
 * is the beta signal (mirrors SettingsModal's `isBeta`). `provider` of `comp` /
 * `none` is a complimentary or unbacked grant.
 */
function isRealPaid(e: EntitlementInfo): boolean {
  if (e.plan === "free") return false;
  if (e.enforced === false) return false; // beta Plus-for-everyone
  if (e.provider === "comp" || e.provider === "none" || !e.provider) return false;
  return true;
}

/**
 * Evaluate the freshly-fetched entitlement against the persisted previous state
 * and fire the appropriate pay event once per transition.
 *
 * - free/beta/comp → in_trial on a real paid plan  ⇒ `trial_start`
 * - any non-active  → active on a real paid plan     ⇒ `paid`
 *
 * Persists the new state so reloading the billing-return URL never re-fires.
 * Pure aside from localStorage + the track() side-effect, so it is unit-tested
 * directly in loopEvents.test.ts.
 */
export function recordBillingTransition(e: EntitlementInfo): void {
  const status = e.status || "active";
  const key = stateKey(e.plan, status);

  let prev: string | null = null;
  try {
    prev = localStorage.getItem(LS_LAST_BILLED);
  } catch {
    /* storage blocked — treat as no prior state */
  }

  // Already recorded this exact state → nothing changed, do not re-fire.
  if (prev === key) return;

  const real = isRealPaid(e);
  if (real && status === "in_trial") {
    trackTrialStart(e.plan);
  } else if (real && status === "active") {
    trackPaid(e.plan);
  }

  // Always persist the latest state (even non-paid) so a later upgrade is seen
  // as a transition and a downgrade-then-re-upgrade fires again correctly.
  try {
    localStorage.setItem(LS_LAST_BILLED, key);
  } catch {
    /* ignore */
  }
}
