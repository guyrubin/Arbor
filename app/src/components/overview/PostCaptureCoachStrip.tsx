import React from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";

/** AI-CAP-7 — the post-confirm coach handoff strip.
 *
 *  After a gated capture confirm (BehaviorsTab confirmReview / QuickLogModal
 *  confirm) the captured moment no longer dead-ends in a toast: ONE dismissible,
 *  non-blocking strip offers "Want a next step for this moment? Ask Arbor".
 *  Accepting routes through the existing seedCoach seam with source
 *  'post-capture' — the composer is PREFILLED, never auto-sent. Dismiss clears
 *  the offer with no residue. Rendered once, globally, in Shell (fixed above
 *  MobileNav, z-30 — under MobileNav z-40 and every modal), so both confirm
 *  surfaces share the exact same strip. Calm parent register, green primary
 *  CTA, no new capture path, zero change to the behavior-log write path. */
export default function PostCaptureCoachStrip() {
  const { postCaptureCoachPrompt, acceptPostCaptureCoach, dismissPostCaptureCoach } = useArbor();
  const { t } = useLanguage();
  if (!postCaptureCoachPrompt) return null;
  return (
    <div
      role="status"
      dir="auto"
      data-testid="post-capture-coach-strip"
      className="fixed inset-x-3 bottom-20 z-30 mx-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl lg:bottom-6"
      style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule-strong)" }}
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
        <Icon name="forum" size={17} />
      </span>
      <p className="min-w-0 flex-1 text-xs leading-snug" style={{ color: "var(--arbor-ink)" }}>
        {t("beh.postCapture.body")}
      </p>
      <button
        type="button"
        onClick={acceptPostCaptureCoach}
        className="min-h-9 flex-shrink-0 rounded-xl px-3 py-2 text-xs font-extrabold text-white transition active:scale-[0.98]"
        style={{ background: "var(--arbor-gradient-primary)" }}
      >
        {t("beh.postCapture.cta")}
      </button>
      <button
        type="button"
        onClick={dismissPostCaptureCoach}
        aria-label={t("beh.postCapture.dismiss")}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ color: "var(--arbor-muted)" }}
      >
        <Icon name="close" size={15} />
      </button>
    </div>
  );
}
