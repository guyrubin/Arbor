import React from "react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { TrustLink } from "../trust/TrustLink";

/**
 * PromptCaptureCard — W1 1.2, the guaranteed-action fallback when no AI focus
 * exists (day-0 / AI-miss / offline). One rotating promptBank guiding question
 * ("What made her laugh today?") with a single primary CTA that opens the
 * existing QuickLogModal text capture. The prompt stays visible ABOVE the
 * capture flow (the brief's sanctioned fallback: pre-seeding the question text
 * INTO the draft fields would corrupt the log body — the answer belongs there,
 * not the question).
 *
 * Renders in Today's left slot INSTEAD of TodayRecommendation (mutually
 * exclusive — Rule A: exactly one primary action above the fold, one
 * gradient-primary CTA). Mounts the authored today.intent.why/.whySimple
 * why-line (W1 1.2).
 *
 * CLINICAL FIREWALL: an open invitation to notice, never an assessment.
 */
export default function PromptCaptureCard({
  promptKey,
  childName,
  onCapture,
  whyLine,
}: {
  /** Today's promptBank i18n key (elev.prompt.<band>.<n>), or null for the bare floor. */
  promptKey: string | null;
  childName: string;
  /** Opens the existing QuickLogModal (no new capture path). */
  onCapture: () => void;
  /**
   * OBJ-TODAY-02 / ENG-07: the DERIVED why-line — `whyLineFor()` resolved by
   * the hub, the same function the focus hero already uses. The card used to
   * print the authored `today.intent.whySimple` ("Chosen from age, goals,
   * interests, and what you've captured so far") on a screen that was showing
   * zero goals and zero interests. Optional so a provider-less harness can
   * mount the card bare; absent, the card says nothing rather than a claim.
   */
  whyLine?: string;
}) {
  const { t } = useLanguage();

  return (
    <section
      className="rounded-[18px] p-4 sm:p-5"
      style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
      data-testid="today-prompt-card"
    >
      <h2
        className="text-[20px] font-extrabold leading-[1.15] sm:text-[22px]"
        style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)", textWrap: "balance" } as React.CSSProperties}
      >
        {t("today.intent.captureTitle")}
      </h2>
      <p dir="auto" className="mt-1.5 text-[14px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
        {promptKey ? t(promptKey) : t("elev.prompt.lead")}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onCapture}
          data-testid="today-prompt-cta"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-extrabold text-white transition active:scale-[0.98]"
          style={{ background: "var(--arbor-gradient-primary)" }}
        >
          {t("today.intent.captureTitle")}
          <Icon name="arrow_forward" size={17} className="rtl:-scale-x-100" />
        </button>
        <span className="text-[11px] font-semibold" style={{ color: "var(--arbor-faint)" }}>
          {t("today.capture.aria", { name: childName })}
        </span>
      </div>
      {/* W1 1.2 why-line: the authored "Why this fits" strings, mounted.
          Masterplan 3.1: the TrustLink chip closes the why → Trust Center
          chain, on the same wrapping row, AFTER the why text and visually
          quieter than the gradient capture CTA above. */}
      <div
        className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] leading-relaxed"
        style={{ color: "var(--arbor-faint)" }}
      >
        {whyLine && (
          <span dir="auto">
            <span className="font-extrabold" style={{ color: "var(--arbor-muted)" }}>{t("today.intent.why")}</span>{" "}
            {whyLine}
          </span>
        )}
        <TrustLink surface="today-prompt" />
      </div>
    </section>
  );
}
