import { useEffect, useRef, useSyncExternalStore } from "react";
import { useArbor } from "../../context/ArborContext";
import { useEntitlement } from "../../hooks/useEntitlement";
import { clearPurchaseIntent, readPurchaseIntent } from "../../lib/purchaseIntent";
import { isKidModeActive, subscribeKidMode } from "../../lib/kidModeGate";

/** Mounted after authentication and child setup, alongside the paywall. */
export default function PurchaseIntentGate() {
  const { openPaywall } = useArbor();
  const { entitlement, loading, isFallback } = useEntitlement();
  const handled = useRef(false);
  const kidLocked = useSyncExternalStore(subscribeKidMode, isKidModeActive);
  useEffect(() => {
    if (handled.current || loading || isFallback || kidLocked) return;
    const intent = readPurchaseIntent();
    if (!intent) return;
    handled.current = true;
    if (entitlement.plan === "free") openPaywall(undefined, "plus");
    clearPurchaseIntent();
  }, [loading, isFallback, entitlement.plan, kidLocked, openPaywall]);
  return null;
}
