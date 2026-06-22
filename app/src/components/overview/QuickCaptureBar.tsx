import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Plus } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

/* Quick Capture — the always-present door into logging a moment. Pinned to the
   bottom of the Today scroll region on phones (clears the home indicator + tab
   bar via --safe-bottom) and inline at the top of the spine on desktop. It is
   the first interactive element in Today so keyboard users reach capture first.
   Convenience, not a nag: it opens the existing QuickLogModal, nothing more. */

const GREEN = "var(--arbor-green-ink)";
const RULE = "var(--arbor-rule)";

export default function QuickCaptureBar({
  childName,
  onCapture,
}: {
  childName: string;
  /** Open the existing QuickLogModal. */
  onCapture: () => void;
}) {
  const reduce = useReducedMotion();
  const { t } = useLanguage();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.16 }}
      className="sticky z-20 lg:static"
      style={{ bottom: "var(--safe-bottom, env(safe-area-inset-bottom, 0px))" }}
    >
      <button
        type="button"
        onClick={onCapture}
        aria-label={t("today.capture.aria", { name: childName })}
        className="w-full inline-flex items-center justify-center gap-2 text-white font-bold text-[15px] rounded-2xl px-5 transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{
          minHeight: 48,
          background: "var(--gradient-cta)",
          boxShadow: "var(--shadow-green)",
          border: `1px solid ${RULE}`,
          ["--tw-ring-color" as string]: GREEN,
        } as React.CSSProperties}
      >
        <Plus className="w-5 h-5" aria-hidden="true" /> {t("today.capture.cta")}
      </button>
    </motion.div>
  );
}
