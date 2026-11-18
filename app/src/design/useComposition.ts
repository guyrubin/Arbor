import { useSyncExternalStore } from "react";

/**
 * Design system v10.1: desktop and phone are two compositions of the same
 * objects, not one layout squeezed. "desk" is the multi-column composition
 * (stage, rail, rows of tiles) and starts where the Shell's sidebar starts
 * (lg, 1024 px), so the two always agree; "phone" is its own thumb-order flow
 * (scene, the next tap, a sideways snap row, the main graphic, the note).
 *
 * One tree renders at a time (never both hidden by CSS), so a control exists
 * once in the DOM and the release sweep counts what a parent can actually tap.
 */
export type Composition = "desk" | "phone";

export const DESK_COMPOSITION_QUERY = "(min-width: 1024px)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const mql = window.matchMedia(DESK_COMPOSITION_QUERY);
  mql.addEventListener?.("change", onChange);
  return () => mql.removeEventListener?.("change", onChange);
}

function read(): Composition {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "phone";
  return window.matchMedia(DESK_COMPOSITION_QUERY).matches ? "desk" : "phone";
}

export function useComposition(): Composition {
  return useSyncExternalStore(subscribe, read, () => "phone");
}
