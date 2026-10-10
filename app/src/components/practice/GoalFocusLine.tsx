import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import { toDomains } from "../../lib/domains/registry";
import { SHELVES } from "../../lib/shelves/registry";
import { focusGoal, goalLabel, type ActiveGoal } from "../../practice/goalBuilder";
import { Icon } from "../ui/Icon";

/** Existing domain mapping and glyphs, without an area-coloured verdict. */
export function goalGlyph(goal: Pick<ActiveGoal, "domainId">): string {
  const domain = toDomains("play", goal.domainId)[0];
  return SHELVES.find(shelf => shelf.domain === domain)?.glyph ?? "edit_note";
}

/** One quiet read line. Its parent owns the existing navigation or picker. */
export function GoalFocusLine({ goals, onClick, testId, navigate = false }: {
  goals: readonly ActiveGoal[]; onClick: () => void; testId: string; navigate?: boolean;
}) {
  const { t } = useLanguage();
  const goal = focusGoal(goals);
  return <button type="button" data-testid={testId} onClick={onClick}
    className="flex w-full min-w-0 min-h-11 items-start gap-2 py-2 text-start text-sm"
    style={{ color: "var(--arbor-ink)" }}>
    <Icon name={goal ? goalGlyph(goal) : "add"} size={18} className="shrink-0 mt-0.5" />
    <span className="min-w-0 flex-1 break-words">{goal ? <>{t("elev.goal.profile.title")}: <bdi>{goalLabel(goal, t)}</bdi></> : t("elev.goal.profile.empty")}</span>
    {navigate ? <Icon name="chevron_right" size={18} className="shrink-0 mt-0.5 rtl:-scale-x-100" /> : goal && <span className="shrink-0 font-semibold" style={{ color: "var(--arbor-clay)" }}>{t("elev.goal.profile.edit")}</span>}
  </button>;
}
