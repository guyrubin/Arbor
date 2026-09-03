import React from "react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { TrustLink } from "../trust/TrustLink";

/**
 * RecapAnchorCard — ENG-24: the weekly ritual's Monday anchor on Today.
 *
 * Renders in the guaranteed-action slot when chooseTodayAction yields kind
 * "recap": the first open of a new week with an unopened weekly recap. ONE
 * primary move — open the 3–5 story cards (the last card's step is what gets
 * accepted into Today). Mutually exclusive with the focus hero / prompt card
 * (Rule A: one gradient primary above the fold); once the recap is opened
 * the chain resumes and the AI focus returns.
 *
 * CLINICAL FIREWALL: an invitation only — no counts, no verdicts here.
 */
export default function RecapAnchorCard({ childName, onOpen }: { childName: string; onOpen: () => void }) {
  const { t } = useLanguage();
  return (
    <section
      className="rounded-[20px] p-5 sm:p-6"
      style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
      data-testid="today-recap-anchor"
    >
      <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.13em]" style={{ color: "var(--arbor-lav-ink)" }}>
        <Icon name="auto_awesome" size={14} fill={1} /> {t("today.recap.eyebrow")}
      </span>
      <h2
        className="mt-1.5 text-[21px] font-extrabold leading-[1.15] sm:text-[23px]"
        style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)", textWrap: "balance" } as React.CSSProperties}
        dir="auto"
      >
        {t("today.recap.title", { name: childName })}
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("today.recap.body")}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onOpen}
          data-testid="today-recap-cta"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-extrabold text-white transition active:scale-[0.98]"
          style={{ background: "var(--arbor-gradient-primary)" }}
        >
          {t("today.recap.cta")}
          <Icon name="arrow_forward" size={17} className="rtl:-scale-x-100" />
        </button>
      </div>
      <div className="mt-3">
        <TrustLink surface="today-recap" />
      </div>
    </section>
  );
}
