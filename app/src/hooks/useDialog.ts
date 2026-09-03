/**
 * useDialog — the ONE dialog behaviour seam (MOB-28 / IA-23 / CR-03 / MOB-16).
 *
 * Extracted from ui/Modal.tsx so every overlay that says `role="dialog"` gets
 * the same contract from one hook instead of re-implementing (or, as the
 * More sheet, goal builder, avatar creator and voice overlay did, skipping):
 *   · Escape closes;
 *   · Tab / Shift+Tab cycle INSIDE the dialog (WCAG 2.4.3 focus trap);
 *   · focus moves into the dialog on open and RETURNS to the opener on close;
 *   · body scroll is locked while open (iOS scrolled the page under sheets);
 *   · the Android hardware Back closes the dialog (lib/backStack) instead of
 *     popping the tab underneath or exiting the app.
 *
 * Usage:
 *   const { ref } = useDialog<HTMLDivElement>({ open, onClose });
 *   <div ref={ref} role="dialog" aria-modal="true" …>
 *
 * `onClose` is read through a ref: callers may pass inline closures without
 * re-running the effect (which would re-focus and re-order the back stack).
 * Guarded by components/ui/overlays.test.ts.
 */
import { useEffect, useRef, type RefObject } from "react";
import { pushBackHandler } from "../lib/backStack";

export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* Body scroll lock is reference-counted so nested dialogs (a confirm inside
 * Settings) release the lock only when the LAST one closes. */
let lockCount = 0;
let previousOverflow = "";
function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};
  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;
  return () => {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) document.body.style.overflow = previousOverflow;
  };
}

export function useDialog<T extends HTMLElement = HTMLDivElement>({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): { ref: RefObject<T | null> } {
  const ref = useRef<T | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key === "Tab" && ref.current) {
        const focusables = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (el) => el.offsetParent !== null,
        );
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }
        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === firstEl || !ref.current.contains(active))) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && (active === lastEl || !ref.current.contains(active))) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);

    // Move focus into the dialog once it mounts.
    const focusTimer = window.setTimeout(() => {
      const focusables = ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      (focusables && focusables.length > 0 ? focusables[0] : ref.current)?.focus();
    }, 0);

    const unlockScroll = lockBodyScroll();
    // MOB-16: Android hardware Back closes THIS dialog (LIFO across overlays).
    const disposeBack = pushBackHandler(() => closeRef.current());

    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(focusTimer);
      disposeBack();
      unlockScroll();
      // WCAG: return focus to the control that opened the dialog.
      previouslyFocused?.focus?.();
    };
  }, [open]);

  return { ref };
}

export default useDialog;
