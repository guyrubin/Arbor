/**
 * MOB-16 / IA-05 — the hardware-back stack.
 *
 * Android parents press Back reflexively. Before this module the only
 * `backButton` listener (lib/native.ts) popped the hash history or exited the
 * app — so Back with a modal, the More sheet or an onboarding step open
 * changed the tab UNDER the overlay, or quit the app mid-setup.
 *
 * Contract: any surface that owns a dismiss/step-back action registers a
 * handler while it is open; the native listener asks the TOP handler first
 * (LIFO — the most recently opened overlay is the one Back should close) and
 * only falls through to history / exit when nothing is registered. Kid Mode
 * is checked BEFORE this stack in native.ts (the parent gate is the only way
 * out of Kid Mode; Back must never pop anything there).
 *
 * Pure module (no DOM) so it is unit-tested in lib/backStack.test.ts; the
 * React binding `useBackHandler` lives here too so a component registers
 * with ONE line:
 *
 *   useBackHandler(open, onClose);                       // overlays
 *   useBackHandler(step > 1, goBack);                    // OnboardingFlow (exit only on step 1)
 *   useBackHandler(true, () => setDismissed(true));      // WowOnboarding / AvatarCreator
 */
import { useEffect, useRef } from "react";

export type BackHandler = () => void;

const stack: BackHandler[] = [];

/** Register `handler` as the current top-of-stack Back action. Returns a dispose fn (idempotent). */
export function pushBackHandler(handler: BackHandler): () => void {
  stack.push(handler);
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    const i = stack.lastIndexOf(handler);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** Run the top handler. True when a handler consumed the press; false = fall through to history/exit. */
export function handleBack(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top();
  return true;
}

/** Number of registered handlers (tests + diagnostics). */
export function backHandlerDepth(): number {
  return stack.length;
}

/** Test-only: drop every handler. */
export function resetBackStack(): void {
  stack.length = 0;
}

/**
 * React binding: while `active`, the latest `handler` is the top Back action.
 * The handler is read through a ref, so an inline closure never re-registers
 * (which would reorder the stack under sibling overlays).
 */
export function useBackHandler(active: boolean, handler: BackHandler): void {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    if (!active) return;
    return pushBackHandler(() => latest.current());
  }, [active]);
}
