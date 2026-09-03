import React, { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useDialog } from "../../hooks/useDialog";

/** Below Tailwind `lg` the dialog presents as a bottom sheet (MOB-28). */
const WIDE_QUERY = "(min-width: 1024px)";

function useWideViewport(): boolean {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia?.(WIDE_QUERY).matches === true);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(WIDE_QUERY);
    const onChange = () => setWide(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return wide;
}

export type ModalPresentation = "sheet" | "center" | "auto";

/**
 * Modal dialog with backdrop, focus trap, focus restore, body scroll lock and
 * hardware-Back dismissal — all from hooks/useDialog (WCAG 2.4.3, MOB-16).
 *
 * Presentation (MOB-28): `auto` (default) is a bottom-anchored SHEET under
 * `lg` — the native idiom for tall content on a phone: anchored to the bottom
 * edge, `max-h-[92dvh]` (dvh, so the iOS URL bar / keyboard math holds), a
 * drag handle, safe-area bottom padding — and a centered card at `lg` and up.
 * `sheet` / `center` force one. Surfaces use tokens only.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
  presentation = "auto",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
  presentation?: ModalPresentation;
}) {
  const titleId = useId();
  const { t } = useLanguage();
  const wide = useWideViewport();
  const sheet = presentation === "sheet" || (presentation === "auto" && !wide);
  const { ref: dialogRef } = useDialog<HTMLDivElement>({ open, onClose });

  // Render to document.body so the fixed overlay is positioned against the
  // viewport, not against a transformed ancestor (the page's motion.div applies
  // a CSS transform, which would otherwise clip/offset a `position: fixed` child).
  // The `arbor-app` class keeps the design tokens + focus-ring rules in scope
  // even though the portal escapes the app root. `arbor-modal-host` lets the
  // native safe-area rules (index.css) hand the bottom inset to the sheet.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={`arbor-app arbor-modal-host fixed inset-0 z-50 flex justify-center backdrop-blur-sm ${sheet ? "items-end p-0" : "items-center p-4"}`}
          style={{ background: "color-mix(in srgb, var(--arbor-ink) 55%, transparent)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            className={`w-full ${maxWidth} overflow-y-auto p-6 ${sheet ? "rounded-t-3xl max-h-[92dvh]" : "rounded-3xl max-h-[90vh]"}`}
            style={{
              background: "var(--arbor-paper-elevated)",
              border: "1px solid var(--arbor-rule)",
              boxShadow: "var(--shadow-lg, 0 24px 60px rgba(41,51,63,0.18))",
              ...(sheet ? { borderBottom: "none", paddingBottom: "calc(1.5rem + var(--arbor-safe-bottom, 0px))" } : {}),
            }}
            initial={sheet ? { opacity: 0, y: 48 } : { opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={sheet ? { opacity: 0, y: 48 } : { opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            onClick={(e) => e.stopPropagation()}
          >
            {sheet && (
              // Drag handle: a real control (≥44px hit area) — tap or pull down to close.
              <motion.button
                type="button"
                aria-label={t("elev.nativeshell.sheet.handle")}
                onClick={onClose}
                drag="y"
                dragSnapToOrigin
                dragConstraints={{ top: 0, bottom: 80 }}
                dragElastic={{ top: 0, bottom: 0.4 }}
                onDragEnd={(_, info) => { if (info.offset.y > 48 || info.velocity.y > 500) onClose(); }}
                className="mx-auto -mt-3 mb-2 flex h-11 w-20 cursor-grab touch-none items-center justify-center rounded-full"
                style={{ color: "var(--arbor-muted)" }}
              >
                <span aria-hidden className="block h-1.5 w-10 rounded-full" style={{ background: "var(--arbor-rule)" }} />
              </motion.button>
            )}
            <div className="flex items-center justify-between mb-4">
              {title && <h3 id={titleId} className="text-lg font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{title}</h3>}
              <button
                onClick={onClose}
                className="ms-auto flex h-11 w-11 items-center justify-center rounded-xl transition"
                style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}
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

export default Modal;
