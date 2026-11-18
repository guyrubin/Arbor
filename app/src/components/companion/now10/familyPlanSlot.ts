/**
 * Coming up's Family plan slot: the next dates in the family plan, each with
 * who has it ("nobody yet" when no adult has taken it; the tile is dashed), and
 * a tap that opens Now › Family plan. The dates come from the plan's own read
 * (`useFamilyPlanDates`, one cached child-collection listener shared with the
 * Family plan screen); Now lists at most NOW_FAMILY_PLAN_ROWS, the rest live on
 * the Family plan page. A family with no dates draws no line.
 */
import { useMemo } from "react";
import { useArbor } from "../../../context/ArborContext";
import { useAuth } from "../../../context/AuthContext";
import { useLanguage } from "../../../context/LanguageContext";
import { goToRoute } from "../../../hooks/useHashQuery";
import { useFamilyPlanDates } from "../../../hooks/useFamilyPlan";
import type { FamilyPlanDate } from "../../../lib/familyPlan/model";
import { adultLabel, dayNum, weekdayShort, type Lang } from "../../familyPlan/format";
import { familyPlanCopy } from "../../familyPlan/familyPlanCopy";
import { NOW_V10_COPY } from "./nowV10Copy";

export interface FamilyPlanDateLine {
  id: string;
  /** The date tile: short weekday and the day of the month. */
  weekday: string;
  day: number;
  /** Nobody has this date yet: the tile is dashed. */
  nobody: boolean;
  title: string;
  sub?: string;
  /** Marked New since the parent last looked. */
  isNew?: boolean;
  onOpen: () => void;
}

/** How many upcoming dates Coming up lists; the rest are on Family plan. */
export const NOW_FAMILY_PLAN_ROWS = 3;

/** The lines Now draws for the plan's dates: open dates from today on,
 *  soonest first, at most NOW_FAMILY_PLAN_ROWS. Pure, so it is tested alone. */
export function familyPlanLinesForNow(
  dates: readonly FamilyPlanDate[],
  today: string,
  lang: Lang,
  meUid: string,
  onOpen: () => void,
): FamilyPlanDateLine[] {
  const c = familyPlanCopy[lang];
  return dates
    .filter((d) => d.status === "open" && d.date >= today)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""))
    .slice(0, NOW_FAMILY_PLAN_ROWS)
    .map((d) => {
      const who = d.holder ? adultLabel(d.holder, meUid, c) : NOW_V10_COPY[lang].familyPlanNobody;
      return {
        id: d.id,
        weekday: weekdayShort(d.date, lang),
        day: Number(dayNum(d.date)),
        nobody: !d.holder,
        // Board N-Now: the time rides the title ("Thursday's group visit, 10:00"); the sub says whose it is.
        title: d.time ? NOW_V10_COPY[lang].familyPlanAt(d.title, d.time) : d.title,
        sub: NOW_V10_COPY[lang].familyPlanWho(who),
        onOpen,
      };
    });
}

export function useFamilyPlanDatesForNow(): FamilyPlanDateLine[] {
  const { childProfile } = useArbor();
  const { user } = useAuth();
  const { uiLang } = useLanguage();
  const lang: Lang = uiLang === "he" ? "he" : "en";
  const plan = useFamilyPlanDates(childProfile.id);
  const meUid = user?.uid ?? "local-sandbox";
  return useMemo(
    () => familyPlanLinesForNow(plan.dates, plan.window.today, lang, meUid, () => goToRoute("family-plan")),
    [plan.dates, plan.window.today, lang, meUid],
  );
}
