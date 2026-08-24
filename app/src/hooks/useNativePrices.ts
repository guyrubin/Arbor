import { useEffect, useState } from "react";
import { isNativePlatform } from "../lib/runtime";
import type { NativePriceMap } from "../lib/nativeBilling";

// Module-level cache: one offering fetch per session (undefined = never asked).
let cached: NativePriceMap | null | undefined;

/**
 * STORE-2 §2.4 — on native, displayed prices MUST come from the store product
 * (StoreKit/Play localized), never from the web EUR constants. Returns null on
 * web, and null while loading / when billing isn't configured — callers render
 * nothing rather than a stale price.
 */
export function useNativePrices(): NativePriceMap | null {
  const [map, setMap] = useState<NativePriceMap | null>(cached ?? null);

  useEffect(() => {
    if (!isNativePlatform || cached !== undefined) return;
    let alive = true;
    void import("../lib/nativeBilling")
      .then((m) => m.getNativePriceMap())
      .then((res) => {
        cached = res;
        if (alive && res) setMap(res);
      })
      .catch(() => { cached = null; });
    return () => { alive = false; };
  }, []);

  return isNativePlatform ? map : null;
}
