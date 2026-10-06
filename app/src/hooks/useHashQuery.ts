import { useEffect, useState } from "react";
import { hashQuery, routeHash, type ActiveTab } from "../lib/routes";

const readHash = (): string => {
  try {
    return typeof window === "undefined" ? "" : window.location.hash;
  } catch {
    return "";
  }
};

/**
 * B-LOOP-11 — the current hash's query (`#/journal?shelf=sleep` → shelf=sleep),
 * re-read on every hashchange so Back and Forward move between the journal's
 * grid, a shelf page and the professional view. Read-only; navigation goes
 * through `goToRoute`, which pushes a history entry (Back returns).
 */
export function useHashQuery(): URLSearchParams {
  const [raw, setRaw] = useState<string>(readHash);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const on = () => setRaw(readHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hashQuery(raw);
}

/** Navigate to a route with parameters (a new history entry, so Back returns). */
export function goToRoute(route: ActiveTab, params: Record<string, string | null | undefined> = {}): void {
  try {
    window.location.hash = routeHash(route, params);
  } catch {
    /* SSR / tests */
  }
}
