import { api } from "./api";
import { isNativePlatform } from "./runtime";
import { refreshEntitlement } from "../hooks/useEntitlement";

/**
 * STORE-2 — the ONE platform gate for every purchase/portal surface.
 *
 * Apple 3.1.1 / Play Payments: a web checkout reachable inside the native
 * binary is an automatic store rejection. The native shell bundles the same
 * `dist/` as the web app, so the gate must live in code, not in packaging:
 * every purchase surface routes through these actions, and on native they
 * NEVER call `/api/billing/*` and NEVER navigate to a hosted checkout —
 * they hand off to the RevenueCat native SDK (StoreKit / Play Billing).
 *
 * Structure (kept testable in the node-only vitest harness):
 *   - `performCheckout` / `performOpenPortal` / `performRestore` are pure
 *     functions over an injected `CheckoutDeps`, unit-tested native AND web
 *     (the web negative control proves the guard measures the gate, not a
 *     broken mock — see checkoutActions.test.ts).
 *   - `useCheckout` (hooks/useCheckout.ts) is the thin React wrapper that
 *     supplies `defaultDeps()` and maps outcomes to toasts.
 *
 * Guard tests (storeCheckoutGuard.test.ts) enforce structurally that
 * `api.billingCheckout` / `api.billingPortal` are referenced nowhere else.
 */

export type PaidPlan = "plus" | "family";
export type Cadence = "monthly" | "annual";

/** Outcome of a native purchase attempt (see lib/nativeBilling.ts). */
export type NativePurchaseOutcome = "purchased" | "cancelled" | "unavailable" | "error";
/** Outcome of a native restore attempt. */
export type NativeRestoreOutcome = "restored" | "unavailable" | "error";

export type CheckoutDeps = {
  /** Platform flag — the single fact the gate branches on. */
  isNative: boolean;
  /** Web path: server-issued hosted checkout URL. NEVER called on native. */
  billingCheckout: (plan: PaidPlan, cadence: Cadence) => Promise<{ url: string }>;
  /** Web path: server-issued self-service portal URL. NEVER called on native. */
  billingPortal: () => Promise<{ url: string | null }>;
  /** Web path: full-page redirect to the hosted checkout/portal. */
  navigate: (url: string) => void;
  /** Native path: RevenueCat purchase sheet (StoreKit / Play Billing). */
  nativePurchase: (plan: PaidPlan, cadence: Cadence) => Promise<NativePurchaseOutcome>;
  /** Native path: platform subscription-management surface. */
  nativeManage: () => Promise<boolean>;
  /** Native path: RevenueCat restorePurchases (Apple-required control). */
  nativeRestore: () => Promise<NativeRestoreOutcome>;
  /** Invalidate the cached entitlement after a successful purchase/restore. */
  refresh: () => Promise<unknown>;
};

/** Production wiring. The native functions dynamic-import the RC SDK module so
 *  none of it lands in the web bundle's initial graph (native.ts pattern). */
export const defaultDeps = (): CheckoutDeps => ({
  isNative: isNativePlatform,
  billingCheckout: api.billingCheckout,
  billingPortal: api.billingPortal,
  navigate: (url) => { window.location.href = url; },
  nativePurchase: (plan, cadence) => import("./nativeBilling").then((m) => m.purchaseNative(plan, cadence)),
  nativeManage: () => import("./nativeBilling").then((m) => m.openNativeManage()),
  nativeRestore: () => import("./nativeBilling").then((m) => m.restoreNativePurchases()),
  refresh: refreshEntitlement,
});

export type CheckoutResult =
  | "redirected"        // web: navigated to the hosted checkout
  | "purchased"         // native: StoreKit/Play purchase completed
  | "cancelled"         // native: parent closed the sheet — silent, not an error
  | "unavailable"       // billing not configured yet (either platform)
  | "error";            // real failure — surface the neutral toast

export async function performCheckout(deps: CheckoutDeps, plan: PaidPlan, cadence: Cadence): Promise<CheckoutResult> {
  if (deps.isNative) {
    // Native binary: the web checkout must be unreachable (Apple 3.1.1 /
    // Play Payments). No billing-checkout API call, no redirect — ever.
    const outcome = await deps.nativePurchase(plan, cadence).catch((): NativePurchaseOutcome => "error");
    if (outcome === "purchased") await deps.refresh();
    return outcome;
  }
  try {
    const { url } = await deps.billingCheckout(plan, cadence);
    deps.navigate(url);
    return "redirected";
  } catch {
    // CARE-5: checkout being unavailable is information, not a success.
    return "unavailable";
  }
}

export type PortalResult =
  | "redirected"        // web: navigated to the Stripe/RC self-service portal
  | "managed"           // native: platform subscription surface opened
  | "unavailable";      // no portal configured / native surface failed to open

export async function performOpenPortal(deps: CheckoutDeps): Promise<PortalResult> {
  if (deps.isNative) {
    // Native binary: subscriptions bought via StoreKit/Play are managed in the
    // platform's own surface; the Stripe/RC web portal must stay unreachable.
    const opened = await deps.nativeManage().catch(() => false);
    return opened ? "managed" : "unavailable";
  }
  try {
    const { url } = await deps.billingPortal();
    if (url) { deps.navigate(url); return "redirected"; }
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

/** Apple-required Restore Purchases. Native-only; on web it is a no-op that
 *  reports "unavailable" (the control itself never renders on web). */
export async function performRestore(deps: CheckoutDeps): Promise<NativeRestoreOutcome> {
  if (!deps.isNative) return "unavailable";
  const outcome = await deps.nativeRestore().catch((): NativeRestoreOutcome => "error");
  if (outcome === "restored") await deps.refresh();
  return outcome;
}
