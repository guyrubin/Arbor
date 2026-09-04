import React, { useId } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

import { useDialog } from "../../hooks/useDialog";

/** Centered modal dialog with backdrop, focus trap, and focus restore (WCAG 2.4.3). */
export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const { ref: dialogRef, requestClose, onBackdropClick } = useDialog({ open, onClose });
  const titleId = useId();
  const { t } = useLanguage();

  // Render to document.body so the fixed overlay is positioned against the
  // viewport, not against a transformed ancestor (the page's motion.div applies
  // a CSS transform, which would otherwise clip/offset a `position: fixed` child).
  // The `arbor-app` class keeps the design tokens + focus-ring rules in scope
  // even though the portal escapes the app root.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="arbor-app fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onBackdropClick}
          data-arbor-dialog-layer
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            className={`w-full ${maxWidth} bg-white rounded-3xl p-6 max-h-[90vh] overflow-y-auto`}
            style={{ border: "1px solid var(--arbor-rule)", boxShadow: "0 24px 60px rgba(41,51,63,0.18)" }}
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              {title && <h3 id={titleId} className="text-lg font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{title}</h3>}
              <button
                onClick={requestClose}
                className="touch-target ms-auto p-1.5 rounded-lg transition"
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

export default Modal;
