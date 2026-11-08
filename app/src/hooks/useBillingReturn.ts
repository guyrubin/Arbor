import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useToast } from "../context/ToastContext";
import { BILLING_PENDING_KEY, refreshEntitlement, startBillingReturnPoll, takeBillingReturn } from "./useEntitlement";

/** Own one account's web-checkout verification until it settles or unmounts.
 *  Locale/callback changes update the next message without canceling the poll.
 *  A pending Retry starts another bounded poll; a late webhook remains recoverable. */
export function useBillingReturn(): void {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const callbacks = useRef({ toast, t });
  const uid = user?.uid;

  useEffect(() => { callbacks.current = { toast, t }; }, [toast, t]);

  useEffect(() => {
    if (!uid) return;
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get("billing") === "success";
    if (fromParam) {
      params.delete("billing");
      params.delete("app_user_id"); // ownership comes only from Firebase auth
      const clean = window.location.pathname + (params.toString() ? `?${params}` : "") + window.location.hash;
      try { window.history.replaceState(null, "", clean); } catch { /* noop */ }
    }
    if (!takeBillingReturn() && !fromParam) return;

    let alive = true;
    let stop: () => void = () => undefined;
    const start = () => {
      if (!alive) return;
      stop();
      stop = startBillingReturnPoll({
        refresh: refreshEntitlement,
        t: (key) => callbacks.current.t(key),
        toast: (message, type) => {
          const current = callbacks.current;
          current.toast(message, type, message === current.t(BILLING_PENDING_KEY)
            ? { label: current.t("elev.storeshell.plan.retry"), onClick: start }
            : undefined);
        },
      });
    };
    start();
    return () => { alive = false; stop(); };
  }, [uid]);
}
