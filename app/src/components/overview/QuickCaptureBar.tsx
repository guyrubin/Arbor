import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import type { CaptureMode } from "../../context/ArborContext";

/* Quick Capture — the ambient door into logging a moment, above the forms in
   the capture hierarchy. First in Today's DOM so keyboard users reach capture
   first; on phones `order-last` gives it a real flow slot at the END of the
   column so the sticky-bottom pin genuinely engages (a sticky-bottom FIRST
   child never sticks), with a bottom offset that clears the fixed MobileNav
   tab bar (< md) + the home indicator. Inline at the top of the spine on lg+.
   Three modality affordances, ZERO new capture paths: the primary CTA opens
   the existing QuickLogModal inline (text), and the mic / photo tiles hand the
   mode to the EXISTING requestCapture() seam — the same one JournalTab's
   compose tiles use (BehaviorsTab consumes it once and opens the real
   voice/photo flow). Convenience, not a nag. */

const GREEN = "var(--arbor-green-ink)";
const RULE = "var(--arbor-rule)";

/** Ambient aux modes — Material Symbols glyphs shared with JournalTab's compose tiles. */
const AUX_MODES: { ms: string; key: Exclude<CaptureMode, "text">; label: string }[] = [
  { ms: "mic", key: "voice", label: "today.capture.voice" },
  { ms: "photo_camera", key: "photo", label: "today.capture.photo" },
];

export default function QuickCaptureBar({
  childName,
  onText,
  onMode,
}: {
  childName: string;
  /** Open the existing QuickLogModal (text capture, inline on Today). */
  onText: () => void;
  /** Hand voice/photo to the existing requestCapture() seam. */
  onMode: (mode: CaptureMode) => void;
}) {
  const reduce = useReducedMotion();
  const { t } = useLanguage();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.16 }}
      className="sticky z-20 order-last bottom-[calc(var(--safe-bottom,env(safe-area-inset-bottom,0px))_+_64px)] md:bottom-[var(--safe-bottom,env(safe-area-inset-bottom,0px))] lg:static lg:order-none grid grid-cols-[1fr_auto_auto] lg:grid-cols-[1.1fr_1fr_1fr_1fr] items-stretch overflow-hidden rounded-[20px] bg-white"
      style={{ border: `1px solid ${RULE}`, boxShadow: "var(--shadow-sm)" }}
    >
      <div className="hidden lg:flex flex-col justify-center px-6 py-4">
        <span className="text-[17px] font-extrabold" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>{t("today.capture.cta")}</span>
        <span className="mt-0.5 text-[11.5px]" style={{ color: "var(--arbor-muted)" }}>{t("today.capture.aria", { name: childName })}</span>
      </div>
      <button
        type="button"
        onClick={onText}
        aria-label={t("today.capture.aria", { name: childName })}
        className="inline-flex items-center justify-center gap-3 px-5 py-3.5 text-[14px] font-bold transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset lg:border-s"
        style={{
          minHeight: 48,
          color: "var(--arbor-ink)",
          borderColor: RULE,
          ["--tw-ring-color" as string]: GREEN,
        } as React.CSSProperties}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--arbor-tint)", color: "var(--arbor-clay)" }}><Icon name="edit_note" size={20} /></span>
        <span className="hidden sm:inline">{t("today.capture.text")}</span>
      </button>
      {AUX_MODES.map(({ ms, key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onMode(key)}
          aria-label={t(label)}
          title={t(label)}
          className="min-w-[52px] inline-flex items-center justify-center gap-3 px-3 py-3.5 transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset lg:border-s"
          style={{
            minHeight: 48,
            borderColor: RULE,
            color: GREEN,
            ["--tw-ring-color" as string]: GREEN,
          } as React.CSSProperties}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: key === "voice" ? "var(--arbor-lav-soft)" : "var(--arbor-green-soft)", color: key === "voice" ? "var(--arbor-lav-ink)" : GREEN }}><Icon name={ms} size={21} fill={1} /></span>
          <span className="hidden lg:inline text-[14px] font-bold" style={{ color: "var(--arbor-ink)" }}>{t(label)}</span>
        </button>
      ))}
    </motion.div>
  );
}
