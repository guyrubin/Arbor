import React from "react";
import { ArrowRight, Target } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { DOMAIN_META } from "../../practice/content";
import { todaysMissionFor } from "../../practice/missionToday";

/* Folded mission — the single current mission from the 5-day cycle, surfaced on
   Today so the daily loop and the Missions tab never disagree (both import
   todaysMissionFor). Read-only summary + deep link; the completion toggle stays
   in the Missions tab. */

const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const GREEN = "var(--arbor-green-ink)";
const RULE = "var(--arbor-rule)";

export default function TodaysMissionCard({
  childName,
  dateISO,
  onOpen,
}: {
  childName: string;
  /** Calendar date (YYYY-MM-DD); shared helper makes this deterministic. */
  dateISO: string;
  /** Deep-link to the Missions tab. */
  onOpen: () => void;
}) {
  const { t } = useLanguage();
  const mission = todaysMissionFor(dateISO);
  const meta = DOMAIN_META[mission.domain];

  return (
    <section
      className="rounded-[22px] p-5 md:p-6 flex flex-wrap items-center gap-x-4 gap-y-3"
      style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}`, boxShadow: "var(--shadow-sm)" }}
    >
      <span
        className="w-12 h-12 rounded-2xl grid place-items-center text-2xl flex-shrink-0"
        style={{ background: meta.soft }}
        aria-hidden="true"
      >
        {mission.emoji}
      </span>
      <div className="flex-1 min-w-[200px]">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: GREEN }}>
          <Target className="w-3.5 h-3.5" aria-hidden="true" /> {t("today.mission.eyebrow")}
        </span>
        <h2 className="text-[1.15rem] font-extrabold leading-tight mt-0.5" style={{ fontFamily: "var(--font-display)", color: INK }}>
          {mission.title}
        </h2>
        <p className="text-[13px] mt-1 leading-snug" style={{ color: MUTED }}>
          {t("today.mission.sub", { domain: meta.label.toLowerCase(), name: childName })}
        </p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center justify-center gap-1.5 font-bold text-sm rounded-full px-4 min-h-[44px] flex-shrink-0 transition active:scale-[0.98]"
        style={{ background: "var(--arbor-green-soft)", color: GREEN }}
      >
        {t("today.mission.cta")} <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </section>
  );
}
