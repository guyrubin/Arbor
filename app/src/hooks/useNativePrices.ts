import { useEffect, useState } from "react";
import { isNativePlatform } from "../lib/runtime";
import type { NativePriceMap, OfferingStatus } from "../lib/nativeBilling";

// Module-level cache: one offering fetch per session (undefined = never asked;
// null = asked and the store had no usable offering, retried on the next mount
// so a transient failure does not pin "unavailable" for the whole session).
let cached: NativePriceMap | null | undefined;

export type NativeOffering = { prices: NativePriceMap | null; status: OfferingStatus };

/**
 * STORE-2 §2.4 / B-GA-12 — on native, displayed prices MUST come from the
 * store product (StoreKit/Play localized), never from the web EUR constants.
 * Returns the price map plus a resolved status so both purchase surfaces can
 * tell "still loading" from "the store has no offering" (failed/missing).
 * On web: prices null, status "web".
 */
export function useNativeOffering(): NativeOffering {
  const [state, setState] = useState<NativeOffering>(() =>
    !isNativePlatform ? { prices: null, status: "web" } : cached ? { prices: cached, status: "ready" } : { prices: null, status: "loading" });

  useEffect(() => {
    if (!isNativePlatform || cached) return;
    let alive = true;
    void import("../lib/nativeBilling")
      .then((m) => m.getNativePriceMap())
      .then((res) => {
        cached = res;
        if (alive) setState(res ? { prices: res, status: "ready" } : { prices: null, status: "unavailable" });
      })
      .catch(() => { cached = null; if (alive) setState({ prices: null, status: "unavailable" }); });
    return () => { alive = false; };
  }, []);

  return state;
}

/** The price map alone (null on web, while loading, or when unavailable). */
export function useNativePrices(): NativePriceMap | null {
  return useNativeOffering().prices;
}
