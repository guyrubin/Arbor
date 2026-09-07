import React, { useId, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

import { useDialog } from "../../hooks/useDialog";

/**
 * MOB-28 / CR-22 — the bottom sheet, extracted from the one place Arbor had it.
 *
 * MEASURED at 390 (ledger-SHELL Screens D and E): SettingsModal and
 * PaywallModal rendered as a centred 358×760 card — a desktop dialog scaled to
 * a phone, floating with its close button in the top-right corner, furthest
 * from the thumb, over a page it had already scrolled away from. MobileNav's
 * More sheet, on the same device, is what a phone dialog should be: anchored to
 * the bottom edge, rounded at the top only, reachable.
 *
 * That presentation lived inline inside MobileNav. This is it as a component,
 * on the SAME contract as `ui/Modal` — `useDialog` (so Escape, the focus trap,
 * focus restore and dismissal all belong to lib/dialogStack, exactly as they do
 * for every other dialog in the app), one `data-arbor-dialog-layer`, one
 * `role="dialog"`, one 44 px close — so a caller swaps Modal for Sheet and
 * changes nothing but where the box sits.
 *
 * Modal is still right above `lg`, where there is a mouse and a wide viewport.
 * `useCompactSurface()` is the seam; it is a media QUERY, not a device sniff.
 */

/** The breakpoint below which a dialog is a sheet: Tailwind's `lg` (1024). */
const COMPACT_QUERY = "(max-width: 1023.98px)";

const subscribeCompact = (onChange: () => void) => {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(COMPACT_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const readCompact = () =>
  typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(COMPACT_QUERY).matches;

/**
 * True below `lg`. Server/SSR and any environment without matchMedia read
 * false — i.e. they fall back to the centred Modal, which is what shipped, so a
 * missing matchMedia degrades to the old behaviour rather than to nothing.
 */
export function useCompactSurface(): boolean {
  return useSyncExternalStore(subscribeCompact, readCompact, () => false);
}

/** Bottom-anchored dialog with backdrop, focus trap and focus restore. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Accepted so a caller can swap Sheet for Modal without editing props; a
   *  sheet is always full-bleed, so it is deliberately unused. */
  maxWidth?: string;
}) {
  const { ref: dialogRef, requestClose, onBackdropClick } = useDialog({ open, onClose });
  const titleId = useId();
  const { t } = useLanguage();

  // Portals to document.body for the same reason Modal does: the page's
  // motion.div applies a CSS transform, which would make `position: fixed`
  // resolve against it. `arbor-app` keeps tokens and focus rings in scope.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="arbor-app fixed inset-0 z-50 flex flex-col justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onBackdropClick}
          data-arbor-dialog-layer
          style={{ background: "color-mix(in srgb, var(--arbor-ink) 28%, transparent)" }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            className="w-full rounded-t-3xl px-4 pt-4 max-h-[88vh] overflow-y-auto bg-white"
            style={{
              // The home indicator eats the last ~34 px of an iPhone screen;
              // a plain pb- put the final control underneath it.
              paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)",
              boxShadow: "0 -8px 32px color-mix(in srgb, var(--arbor-ink) 18%, transparent)",
            }}
            initial={{ y: "6%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "6%", opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle — the affordance that says "this drags down to go
                away". Decorative; dismissal is the close button and the
                backdrop, both real controls. */}
            <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: "var(--arbor-rule-strong)" }} />
            <div className="flex items-center justify-between gap-3 mb-4">
              {title && (
                <h3 id={titleId} className="text-lg font-extrabold tracking-tight min-w-0 truncate" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
                  {title}
                </h3>
              )}
              <button
                onClick={requestClose}
                className="touch-target ms-auto flex flex-shrink-0 items-center justify-center rounded-lg transition"
                style={{ minWidth: "var(--touch-min)", minHeight: "var(--touch-min)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}
                aria-label={t("aria.close")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default Sheet;
