import { useState } from "react";
import { useToast } from "../context/ToastContext";
import { useLanguage } from "../context/LanguageContext";
import { useArborOptional } from "../context/ArborContext";
import { isNativePlatform } from "../lib/runtime";
import { commerceAllowed } from "../components/kidmode/parentGate";
import {
  defaultDeps,
  performCheckout,
  performOpenPortal,
  performRestore,
  type CheckoutResult,
  type NativeRestoreOutcome,
  type PaidPlan,
  type Cadence,
} from "../lib/checkoutActions";

type ToastTone = "info" | "success" | "error";
export type OutcomeEffects = { toastKey: string | null; tone: ToastTone; close: boolean };

/**
 * MOB-08 — outcome → effects, pure (hooks/checkoutActions.test.ts).
 *  - purchased   → the entitlement was already refreshed by performCheckout;
 *                  CLOSE the paywall and confirm ("You're all set").
 *  - redirected  → the page navigates; nothing to say.
 *  - cancelled   → the parent closed the store sheet; silent by design.
 *  - unavailable → honest "not available right now" (never the pre-launch
 *                  "we'll email you" copy — nobody sends that email).
 *  - error       → a dedicated purchase-failed line: nothing was charged.
 */
export function resolveCheckoutOutcome(result: CheckoutResult): OutcomeEffects {
  switch (result) {
    case "purchased":
      return { toastKey: "pw.activated", tone: "success", close: true };
    case "unavailable":
      return { toastKey: "elev.storeshell.pw.checkoutUnavailable", tone: "info", close: false };
    case "error":
      return { toastKey: "elev.storeshell.pw.purchaseFailed", tone: "error", close: false };
    default:
      return { toastKey: null, tone: "info", close: false };
  }
}

export function resolveRestoreOutcome(result: NativeRestoreOutcome): OutcomeEffects {
  switch (result) {
    case "restored":
      return { toastKey: "set.plan.restoreDone", tone: "success", close: true };
    case "error":
      return { toastKey: "elev.storeshell.pw.restoreFailed", tone: "error", close: false };
    default:
      return { toastKey: "elev.storeshell.pw.checkoutUnavailable", tone: "info", close: false };
  }
}

/**
 * MON-2 / STORE-2: shared checkout/manage/restore actions used by both the
 * Account panel and the paywall — the ONLY React entry to billing actions.
 * The platform gate lives in lib/checkoutActions.ts: web → hosted checkout /
 * self-service portal; native → RevenueCat StoreKit/Play purchase sheet and
 * the platform's own subscription management (the web checkout is unreachable
 * inside the native binary — Apple 3.1.1 / Play Payments).
 *
 * Any new purchase surface MUST call this hook; storeCheckoutGuard.test.ts
 * fails the build on any other caller of the billing checkout/portal API.
 */
export function useCheckout() {
  const { toast } = useToast();
  const { t } = useLanguage();
  // Optional: the paywall lives in ArborContext; the hook also serves Settings,
  // and must stay usable if a future surface mounts outside the provider.
  const arbor = useArborOptional();
  const [busy, setBusy] = useState(false);

  const applyEffects = (fx: OutcomeEffects) => {
    if (fx.close) arbor?.closePaywall();
    if (fx.toastKey) toast(t(fx.toastKey), fx.tone);
  };

  const startCheckout = async (plan: PaidPlan, cadence: Cadence) => {
    if (busy) return;
    // STORE-3 age-hard gate: a session whose parent area was reached via the
    // kid-exit MATH question (no PIN on this device) cannot start a purchase.
    if (!commerceAllowed()) {
      toast(t("elev.gate.blocked"), "info");
      return;
    }
    setBusy(true);
    try {
      const result = await performCheckout(defaultDeps(), plan, cadence);
      applyEffects(resolveCheckoutOutcome(result));
    } finally {
      setBusy(false);
    }
  };

  const openPortal = async () => {
    if (busy) return;
    // STORE-3: subscription management is commerce — same math-exit gate.
    if (!commerceAllowed()) {
      toast(t("elev.gate.blocked"), "info");
      return;
    }
    setBusy(true);
    try {
      const result = await performOpenPortal(defaultDeps());
      if (result === "unavailable") toast(t("set.plan.manageStore"), "success");
    } finally {
      setBusy(false);
    }
  };

  /** Apple-required Restore Purchases — render its control on native only
   *  (`isNative` below); performRestore is a no-op on web. */
  const restorePurchases = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await performRestore(defaultDeps());
      applyEffects(resolveRestoreOutcome(result));
    } finally {
      setBusy(false);
    }
  };

  return { busy, startCheckout, openPortal, restorePurchases, isNative: isNativePlatform };
}
