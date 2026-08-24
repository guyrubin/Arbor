import { useState } from "react";
import { useToast } from "../context/ToastContext";
import { useLanguage } from "../context/LanguageContext";
import { isNativePlatform } from "../lib/runtime";
import {
  defaultDeps,
  performCheckout,
  performOpenPortal,
  performRestore,
  type PaidPlan,
  type Cadence,
} from "../lib/checkoutActions";

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
  const [busy, setBusy] = useState(false);

  const startCheckout = async (plan: PaidPlan, cadence: Cadence) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await performCheckout(defaultDeps(), plan, cadence);
      // "redirected"/"purchased" need no toast (page navigates / plan updates);
      // "cancelled" is the parent closing the native sheet — silent by design.
      if (result === "unavailable" || result === "error") {
        // CARE-5: checkout being unavailable is information, not a success.
        toast(t("set.plan.checkoutSoon"), "info");
      }
    } finally {
      setBusy(false);
    }
  };

  const openPortal = async () => {
    if (busy) return;
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
      if (result === "restored") toast(t("set.plan.restoreDone"), "success");
      else toast(t("set.plan.checkoutSoon"), "info");
    } finally {
      setBusy(false);
    }
  };

  return { busy, startCheckout, openPortal, restorePurchases, isNative: isNativePlatform };
}
