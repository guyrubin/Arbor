import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { ProgressRing } from "../ui/ProgressRing";
import framework from "../../framework.json";
import { prefersReducedMotion } from "../../lib/devscore";
import { computeDevScore } from "../../growth/devScore";

/* Today — a compact, read-only glance at the Development picture (PRD C4).
   A pointer, not a panel: overall number + ring + one focus line, tapping it
   opens the full DevScoreCard on My Child › Development. It NEVER writes a
   snapshot (only DevScoreCard owns the weekly write). When there is not enough
   to say anything honest (confidence "none"), it renders nothing — the full
   card owns the empty teaching state. */

const DOMAIN_LABEL: Record<string, string> = Object.fromEntries(
  (framework.domains as { id: string; label: string }[]).map((d) => [d.id, d.label])
);
const labelFor = (id: string) => DOMAIN_LABEL[id] ?? id;

const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const GREEN = "var(--arbor-green-ink)";
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

  const focusLabel = score.focusDomain ? labelFor(score.focusDomain) : null;
  const line = focusLabel
    ? t("devscore.todayLine", { focus: focusLabel })
    : t("devscore.todayLineSteady");
  const Chevron = rtl ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={() => setActiveTab("development")}
      aria-label={t("devscore.today.aria", { score: score.overall, focus: focusLabel ?? "" })}
      className="w-full flex items-center gap-4 rounded-[22px] px-5 text-left transition active:scale-[0.99] hover:-translate-y-0.5"
      style={{ minHeight: 64, background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}`, boxShadow: "var(--shadow-sm)" }}
    >
      <ProgressRing value={score.overall} size={44} stroke={6} animate={!prefersReducedMotion()}>
        <span className="text-[13px] font-extrabold" style={{ color: GREEN }}>{score.overall}</span>
      </ProgressRing>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-extrabold" style={{ color: INK }}>{t("devscore.overall")}</span>
        <span className="block text-[12.5px] mt-0.5 truncate" style={{ color: MUTED }}>{line}</span>
      </span>
      <Chevron className="w-4 h-4 flex-shrink-0" style={{ color: GREEN }} aria-hidden="true" />
    </button>
  );
}
