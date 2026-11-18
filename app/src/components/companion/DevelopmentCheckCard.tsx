import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import { fmtDayV10 } from "../../lib/formatDate";
import { milestonesV10Copy } from "./milestonesV10Copy";
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
  /** How many questions the check asks at this child's age (its band's items). */
  questions?: number | null;
}

export default function DevelopmentCheckCard({ onCheck, primaryMoveProps, recheckDueAt = null, lastCheckAt = null, questions = null }: DevelopmentCheckCardProps) {
  const { t, uiLang } = useLanguage();
  const v10 = milestonesV10Copy(uiLang);
  return (
    <div className="mcrow-btn ms-check" data-testid="dev-map-checkrow">
      <span className="tg" aria-hidden="true"><Icon name="fact_check" size={18} /></span>
      <span className="mcrow-text">
        <h3 className="ok">{v10.checkName}</h3>
        {questions ? <span className="ms-check-line" data-testid="dev-map-check-line">{v10.checkLine.replace("{n}", String(questions))}</span> : null}
        <span className="ms-obj-src" data-testid="dev-map-checkrow-sub">
          {lastCheckAt ? t("companion.milestones.checkLast", { date: fmtDayV10(lastCheckAt, uiLang) }) : v10.checkNotYet}
        </span>
        {recheckDueAt && <span className="ms-obj-src ms-check-recheck" data-testid="dev-map-recheck">{t("elev.growth.recheck.date", { date: fmtDayV10(recheckDueAt, uiLang) })}</span>}
      </span>
      <button type="button" className="btn sm ms-check-go" data-testid="dev-map-check" onClick={onCheck} {...(primaryMoveProps ?? {})}>
        {t(lastCheckAt ? "companion.milestones.checkAgain" : "companion.milestones.checkStart")}
      </button>
    </div>
  );
}
