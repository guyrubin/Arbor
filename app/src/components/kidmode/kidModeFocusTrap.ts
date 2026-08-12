/**
 * KID-LOCK (W0.9, LEAK 6): real focus trap for the Kid Mode overlay.
 *
 * The inert shield covers .arbor-app siblings, but body portals (Modal,
 * toast container) and anything mounted outside the Shell mount node stay
 * tabbable. Instead of enumerating every portal class, this trap owns the
 * Tab key at document capture while Kid Mode is open: focus WRAPS within the
 * overlay subtree, and focus found OUTSIDE the overlay is recaptured to its
 * first focusable. Covers every present and future portal by construction.
 *
 * Pure logic over structural interfaces — no React, no I/O, no child-data
 * write — so it is unit-testable in the node vitest harness with stand-ins.
 */

/** Tabbable-element selector (kept intentionally conservative/standard). */
export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/** Structural subset of a focusable element (node-testable). */
export interface TrapFocusable {
  focus(): void;
}

/** Structural subset of the overlay root element (node-testable). */
export interface TrapRoot {
  contains(node: unknown): boolean;
  querySelectorAll(selectors: string): ArrayLike<TrapFocusable>;
}

/** Structural subset of the keydown event (node-testable). */
export interface TrapKeyEvent {
  key: string;
  shiftKey: boolean;
  preventDefault(): void;
}

/**
 * Handles one keydown for the trap. Returns true when the event was consumed
 * (focus wrapped or recaptured into the overlay); false = untouched (never
 * interferes with non-Tab keys or mid-list tabbing — zero regression).
 */
export function trapTabKey(e: TrapKeyEvent, root: TrapRoot, activeElement: unknown): boolean {
  if (e.key !== "Tab") return false;
  const focusables = root.querySelectorAll(FOCUSABLE_SELECTOR);
  if (focusables.length === 0) {
    // Nothing focusable inside the overlay — swallow Tab entirely so focus
    // can never walk into a portal behind it.
    e.preventDefault();
    return true;
  }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  // Focus escaped (portal, body) → recapture to the overlay's first control.
  if (!root.contains(activeElement)) {
    e.preventDefault();
    first.focus();
    return true;
  }
  if (!e.shiftKey && activeElement === last) {
    e.preventDefault();
    first.focus();
    return true;
  }
  if (e.shiftKey && activeElement === first) {
    e.preventDefault();
    last.focus();
    return true;
  }
  return false;
}
