import React from "react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";

/**
 * TonightCard — ENG-10 (NL-4 as corrected by the critic's objection 2).
 *
 * From the wind-down hour (or 18:00 by clock) the Daily Play slot's tenant
 * becomes this ONE module: primary = read tonight's story grown from today's
 * moments (→ #/bedtime-stories, which pre-seeds from today's logs; nothing is
 * generated until the tap), secondary = the wind-down routine. Today itself
 * is never replaced — the anchor, capture bar and since-strip stay.
 *
 * Rule A: the anchor holds Today's single gradient primary; this card's
 * primary is an outline button. CLINICAL FIREWALL: the moment count is a
 * flat count of what the parent captured today — never a verdict.
 */
export default function TonightCard({
  childName,
  momentsToday,
  onStory,
  onRoutine,
}: {
  childName: string;
  /** Moments + activities the parent captured today (count only). */
  momentsToday: number;
  onStory: () => void;
  onRoutine: () => void;
}) {
  const { t } = useLanguage();
  const title =
    momentsToday <= 0
      ? t("today.tonight.title.zero", { name: childName })
      : momentsToday === 1
        ? t("today.tonight.title.one", { name: childName })
        : t("today.tonight.title.many", { name: childName, n: momentsToday });
  return (
    <section
      className="rounded-[20px] p-5 sm:p-6"
      style={{ background: "var(--arbor-lav-soft)", border: "1px solid var(--arbor-rule)" }}
      aria-labelledby="today-tonight-title"
      data-testid="today-tonight"
    >
      <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.13em]" style={{ color: "var(--arbor-lav-ink)" }}>
        <Icon name="bedtime" size={14} fill={1} /> {t("today.tonight.eyebrow")}
      </span>
      <h2 id="today-tonight-title" className="mt-1.5 text-[19px] font-extrabold leading-snug" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }} dir="auto">
        {title}
      </h2>
      <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("today.tonight.body")}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={onStory}
          data-testid="today-tonight-story"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-extrabold transition active:scale-[0.98]"
          style={{ border: "1px solid var(--arbor-lav-ink)", color: "var(--arbor-lav-ink)", background: "var(--arbor-paper-elevated)" }}
        >
          <Icon name="auto_stories" size={17} fill={1} /> {t("today.tonight.story")}
          <Icon name="arrow_forward" size={16} className="rtl:-scale-x-100" />
        </button>
        <button
          type="button"
          onClick={onRoutine}
          data-testid="today-tonight-routine"
          className="inline-flex min-h-[44px] items-center gap-1.5 px-2 text-[12.5px] font-extrabold"
          style={{ color: "var(--arbor-ink-soft)" }}
        >
          <Icon name="nightlight" size={16} /> {t("today.tonight.routine")}
        </button>
      </div>
    </section>
  );
}
