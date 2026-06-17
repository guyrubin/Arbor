import { useState } from "react";
import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";
import { useLanguage } from "../context/LanguageContext";

/**
 * MON-2: shared checkout/manage actions used by both the Account panel and the
 * paywall. Starts a hosted checkout (RevenueCat Web Billing / Stripe link) or
 * opens the self-service portal; falls back to a friendly toast when billing
 * links aren't configured yet (pre-launch).
 */
export function useCheckout() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);

  const startCheckout = async (plan: "plus" | "family", cadence: "monthly" | "annual") => {
    if (busy) return;
    setBusy(true);
    try {
      const { url } = await api.billingCheckout(plan, cadence);
      window.location.href = url;
    } catch {
      toast(t("set.plan.checkoutSoon"), "success");
    } finally {
      setBusy(false);
    }
  };

  const openPortal = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { url } = await api.billingPortal();
      if (url) window.location.href = url;
      else toast(t("set.plan.manageStore"), "success");
    } catch {
      toast(t("set.plan.manageStore"), "success");
    } finally {
      setBusy(false);
    }
  };

  return { busy, startCheckout, openPortal };
}
