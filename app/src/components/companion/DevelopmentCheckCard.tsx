import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import { fmtDay } from "../../lib/formatDate";
import { Icon } from "../ui/Icon";

/**
 * v10.1 — the 5-minute Development check as one object on the milestone map
 * (production's v4 check row, recomposed): its name, the day of the latest
 * saved check or that none is saved yet (and that its answers write into these
 * same areas), the saved re-check day when there is one, and Start / Check
 * again, the page's one primary move (the page stamps it through
 * `primaryMoveProps`). No result, no number about the child.
 */
export interface DevelopmentCheckCardProps {
  onCheck: () => void;
  primaryMoveProps?: Record<string, string>;
  recheckDueAt?: string | null;
  lastCheckAt?: string | null;
}

export default function DevelopmentCheckCard({ onCheck, primaryMoveProps, recheckDueAt = null, lastCheckAt = null }: DevelopmentCheckCardProps) {
  const { t, uiLang } = useLanguage();
  return (
    <div className="mcrow-btn ms-check" data-testid="dev-map-checkrow">
      <span className="tg" aria-hidden="true"><Icon name="fact_check" size={18} /></span>
      <span className="mcrow-text">
        <h3 className="ok">{t("companion.milestones.checkTitle")}</h3>
        <span className="ms-obj-src" data-testid="dev-map-checkrow-sub">
          {lastCheckAt ? t("companion.milestones.checkLast", { date: fmtDay(lastCheckAt, uiLang) }) : t("companion.milestones.checkNever")}
        </span>
        {recheckDueAt && <span className="ms-obj-src ms-check-recheck" data-testid="dev-map-recheck">{t("elev.growth.recheck.date", { date: fmtDay(recheckDueAt, uiLang) })}</span>}
      </span>
      <button type="button" className="btn primary sm ms-check-go" data-testid="dev-map-check" onClick={onCheck} {...(primaryMoveProps ?? {})}>
        {t(lastCheckAt ? "companion.milestones.checkAgain" : "companion.milestones.checkStart")}
      </button>
    </div>
  );
}
