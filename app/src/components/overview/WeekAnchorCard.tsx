import React from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { track } from "../../lib/analytics";
import { markWeekAnchorSeen } from "./weekAnchor";

/* ════════════════════════════════════════════════════════════════════════════
   WeekAnchorCard — ENG-24: the Monday anchor for the weekly ritual.

   Rendered in Today's ONE primary-action slot when chooseTodayAction returns
   kind "recap" (Rule A: exactly one primary action above the fold — this card
   replaces the day's other offer, it never stacks on top of it).

   The card is a door, not a report: no counts, no narrative and nothing about
   the child is rendered here. The recap surface itself owns all of that, and
   is already firewall-scanned (components/weekly/recapStoryCards.test.ts).
   ════════════════════════════════════════════════════════════════════════════ */
export default function WeekAnchorCard({
  weekId,
  onDismiss,
}: {
  /** The recapWeekId this anchor is offering. */
  weekId: string;
  /** Called after the device-local marker is written, so the parent's slot
   *  falls through to the next choice in the same frame. */
  onDismiss?: () => void;
}) {
  const { childProfile, setActiveTab } = useArbor();
  const { t } = useLanguage();
  const firstName = (childProfile.name || "").split(" ")[0];

  const dismiss = () => {
    markWeekAnchorSeen(childProfile.id, weekId);
    onDismiss?.();
  };

  const open = () => {
    markWeekAnchorSeen(childProfile.id, weekId);
    try {
      track("week_anchor_opened", { weekId });
    } catch {
      /* analytics is never load-bearing */
    }
    setActiveTab("weekly");
  };

  return (
    <section
      data-testid="today-week-anchor"
      aria-labelledby="today-week-anchor-title"
      className="overflow-hidden rounded-[24px] p-4 sm:p-6"
      style={{
        background: "var(--arbor-paper-elevated)",
        border: "1px solid var(--arbor-rule)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <span
        className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em]"
        style={{ color: "var(--arbor-sky-ink)" }}
      >
        <Icon name="calendar_month" size={16} />
        {t("elev.waveR.recap.eyebrow")}
      </span>
      <h2
        id="today-week-anchor-title"
        className="mt-2 break-words text-xl font-semibold leading-tight sm:text-2xl"
        style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
      >
        {firstName
          ? t("elev.waveR.recap.title", { name: firstName })
          : t("elev.waveR.recap.titleGeneric")}
      </h2>
      <p className="mt-2 max-w-2xl break-words text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
        {t("elev.waveR.recap.body")}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={open}
          data-testid="today-week-anchor-open"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold text-white transition active:scale-[0.98]"
          style={{ background: "var(--arbor-clay)" }}
        >
          <Icon name="auto_stories" size={18} /> {t("elev.waveR.recap.cta")}
        </button>
        <button
          type="button"
          onClick={dismiss}
          data-testid="today-week-anchor-later"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition"
          style={{ color: "var(--arbor-muted)" }}
        >
          {t("elev.waveR.recap.later")}
        </button>
      </div>
    </section>
  );
}
