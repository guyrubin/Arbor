import { useSyncExternalStore } from "react";

/**
 * Below the boards' height (900 px), Together's header band goes compact so the
 * page's first real action is fully above the floating Ask bar at first load
 * (W2-SHELLPLAY SHIP-FIX). At board size the band is drawn as designed.
 */
export const SHORT_VIEWPORT_QUERY = "(max-height: 899px)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const mql = window.matchMedia(SHORT_VIEWPORT_QUERY);
  mql.addEventListener?.("change", onChange);
  return () => mql.removeEventListener?.("change", onChange);
}

function read(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(SHORT_VIEWPORT_QUERY).matches;
}

export function useShortViewport(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
