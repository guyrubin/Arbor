import React from "react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import type { ActionOutcome } from "../../actionLoop/model";

/**
 * DayCloseCard — TJB-28 (the critic's "day-close card": the after-bedtime
 * parent is the largest logging hour and gets a close, not a story).
 *
 * After the rhythm's bedtime (21:30 default) the play slot's tenant becomes
 * this card: what you kept today (counts), tomorrow's reason (deterministic
 * from the parent's OWN outcome report — never a score), and one "good
 * night" that RECORDS NOTHING ABOUT THE CHILD: it dismisses the card for
 * the day on this device and emits a payload-free event. No story CTA — the
 * child is asleep.
 *
 * CLINICAL FIREWALL: counts and the parent's report only; the tomorrow line
 * is about the STEP ("a lighter step"), never about the child.
 */
export default function DayCloseCard({
  childName,
  keptToday,
  outcome,
  onGoodNight,
}: {
  childName: string;
  /** Moments + activities kept today (count only). */
  keptToday: number;
  /** Today's parent-reported outcome, if any (shapes tomorrow's line). */
  outcome?: ActionOutcome | null;
  onGoodNight: () => void;
}) {
  const { t } = useLanguage();
  const kept =
    keptToday <= 0
      ? t("today.dayclose.kept.zero", { name: childName })
      : keptToday === 1
        ? t("today.dayclose.kept.one", { name: childName })
        : t("today.dayclose.kept.many", { name: childName, n: keptToday });
  const tomorrowKey =
    outcome === "helped" ? "today.dayclose.tomorrow.helped"
      : outcome === "somewhat" ? "today.dayclose.tomorrow.somewhat"
        : outcome === "not_today" ? "today.dayclose.tomorrow.notToday"
          : "today.dayclose.tomorrow.none";
  return (
    <section
      className="rounded-[20px] p-5 sm:p-6"
      style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-xs)" }}
      aria-labelledby="today-dayclose-title"
      data-testid="today-dayclose"
    >
      <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.13em]" style={{ color: "var(--arbor-green-ink)" }}>
        <Icon name="nights_stay" size={14} fill={1} /> {t("today.dayclose.eyebrow")}
      </span>
      <h2 id="today-dayclose-title" className="mt-1.5 text-[19px] font-extrabold leading-snug" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }} dir="auto">
        {kept}
      </h2>
      <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: "var(--arbor-muted)" }} data-testid="today-dayclose-tomorrow">
        {t(tomorrowKey)}
      </p>
      <button
        type="button"
        onClick={onGoodNight}
        data-testid="today-dayclose-goodnight"
        className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-extrabold transition active:scale-[0.98]"
        style={{ border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-green-ink)", background: "transparent" }}
      >
        <Icon name="dark_mode" size={16} /> {t("today.dayclose.goodnight")}
      </button>
    </section>
  );
}
