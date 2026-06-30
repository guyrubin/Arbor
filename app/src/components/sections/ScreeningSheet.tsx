import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { TrustSafetyBar } from "../ui/kit";
import { ScreeningFlow } from "./Screening";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Inline Development-check sheet (b2 My Child story spine). Wraps the extracted
 * `ScreeningFlow` in a focus-trapped, Esc-/scrim-dismissible dialog so a parent
 * can run a quick check in context (from Story or Development) without leaving
 * the page. The non-diagnostic TrustSafetyBar disclaimer is preserved verbatim.
 *
 * Open/exit motion is gated globally by the `.arbor-app` prefers-reduced-motion
 * rule in index.css; the portal carries that class.
 */
export default function ScreeningSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
          .filter((el) => el.offsetParent !== null);
        if (focusables.length === 0) return;
        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === firstEl || !dialogRef.current.contains(active))) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && active === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);

    const focusTimer = window.setTimeout(() => {
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      (focusables && focusables.length > 0 ? focusables[0] : dialogRef.current)?.focus();
    }, 0);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(focusTimer);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="arbor-app fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-label={t("mychild.screening.sheettitle")}
            tabIndex={-1}
            className="w-full max-w-[640px] bg-white rounded-3xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto"
            style={{ border: "1px solid var(--arbor-rule)", boxShadow: "0 24px 60px rgba(41,51,63,0.18)", paddingBottom: "max(env(safe-area-inset-bottom),1.25rem)" }}
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 id={titleId} className="text-lg font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
                {t("mychild.screening.sheettitle")}
              </h3>
              <button
                onClick={onClose}
                className="ms-auto inline-flex items-center justify-center rounded-xl shrink-0"
                style={{ width: 44, height: 44, border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}
                aria-label={t("aria.close")}
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            <TrustSafetyBar note="Arbor is not a medical device and does not diagnose. This is a parent-awareness check — a conversation with a professional never hurts." />

            <div className="mt-4">
              <ScreeningFlow onClose={onClose} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
