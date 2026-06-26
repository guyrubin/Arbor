import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import framework from "../../framework.json";
import { computeDevScore } from "../../growth/devScore";

/* Today — a compact, read-only glance at the Development picture (PRD C4).
   A pointer, not a panel. Wave-3 clinical subtraction (2026-06-26): the prior
   version rendered a ProgressRing + `score.overall` 0–100 + a "Worth nurturing
   next: {focusDomain}" deficit pointer — both verdicts on a child metric
   (forbidden by CI-22/23/24). The strip now shows a flat parent-checked
   milestone count + a developmental mechanism line; tapping opens the full
   DevScoreCard. It NEVER writes a snapshot. When there is not enough to say
   anything honest (confidence "none"), it renders nothing. */

const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const GREEN = "var(--arbor-green-ink)";
const GREEN_SOFT = "var(--arbor-green-soft)";
const RULE = "var(--arbor-rule)";

export default function DevScoreStrip() {
  const { milestones, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const rtl = uiLang === "he";

  const score = useMemo(
    () => computeDevScore(milestones.map((m) => ({ domain: m.domain, checked: m.checked }))),
    [milestones]
  );

  // Today stays uncluttered until there is something honest to glance at.
  if (score.confidence === "none") return null;

  const reached = score.domains.reduce((n, d) => n + d.reached, 0);
  const total = score.domains.reduce((n, d) => n + d.total, 0);
  const Chevron = rtl ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={() => setActiveTab("development")}
      aria-label={t("devscore.noticed.aria.striptoday", { reached, total })}
      className="w-full flex items-center gap-4 rounded-[22px] px-5 text-start transition active:scale-[0.99] hover:-translate-y-0.5"
      style={{ minHeight: 64, background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}`, boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex-none w-[44px] h-[44px] rounded-full flex flex-col items-center justify-center" style={{ background: GREEN_SOFT }}>
        <span className="text-[14px] font-extrabold leading-none" style={{ color: GREEN }}>{reached}</span>
      </div>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-extrabold" style={{ color: INK }}>
          {t("devscore.noticed", { reached, total })}
        </span>
        <span className="block text-[12.5px] mt-0.5 truncate" style={{ color: MUTED }}>{t("devscore.mechanism.short")}</span>
      </span>
      <Chevron className="w-4 h-4 flex-shrink-0" style={{ color: GREEN }} aria-hidden="true" />
    </button>
  );
}
