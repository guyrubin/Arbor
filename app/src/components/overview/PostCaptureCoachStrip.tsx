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
 *  the offer with no residue. Rendered once, globally, in Shell, so both
 *  confirm surfaces share the exact same strip. Calm parent register, green
 *  primary CTA, no new capture path, zero change to the behavior-log write path.
 *
 *  v3 F-SHELL-2 (shell-global-status-strips): Shell mounts it inside the
 *  CompanionWorkspace grid, and `grid-area: 1 / 1` makes the page's own cell
 *  (main's row and column) its containing block. So it rests 12 px above the
 *  launcher rail (row 2) at every width, is centred on the content column
 *  rather than the viewport (the sidebar and a docked conversation panel sit
 *  outside that cell), and never covers the launcher. z-30 stays under
 *  MobileNav (z-40) and every modal. */
export default function PostCaptureCoachStrip() {
  const { postCaptureCoachPrompt, acceptPostCaptureCoach, dismissPostCaptureCoach } = useArbor();
  const { t } = useLanguage();
  if (!postCaptureCoachPrompt) return null;
  return (
    <div
      role="status"
      dir="auto"
      data-testid="post-capture-coach-strip"
      className="absolute inset-x-3 bottom-3 z-30 mx-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl"
      style={{ gridArea: "1 / 1", background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule-strong)" }}
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
        className="min-h-11 flex-shrink-0 rounded-xl px-3 py-2 text-xs font-extrabold transition active:scale-[0.98]"
        /* OBJ-TODAY-01: mounted globally from Shell, so this strip can appear
           over any hub — including Today, where the anchor already owns the one
           gradient. An offer to keep talking is secondary: outline. */
        style={{ background: "transparent", border: "1px solid var(--arbor-green-ink)", color: "var(--arbor-green-ink)" }}
      >
        {t("beh.postCapture.cta")}
      </button>
      <button
        type="button"
        onClick={dismissPostCaptureCoach}
        aria-label={t("beh.postCapture.dismiss")}
        className="touch-target flex flex-shrink-0 items-center justify-center rounded-lg"
        style={{ color: "var(--arbor-muted)" }}
      >
        <Icon name="close" size={15} />
      </button>
    </div>
  );
}
