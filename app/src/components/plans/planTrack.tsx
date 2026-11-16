import type { UiLang } from "../../lib/i18n";
import { translate } from "../../lib/i18n";

/* The plan card's shared pieces. The card itself is the v10 stage
   (plans/v10/ActionPlanStage: today's step, "I'll try it", the weekly
   check-in, the echo and "Adjust the plan", B-ASKJB-26). */

/** The Ask seed for "Adjust the plan": the plan title and its last step
 *  outcomes (plan text + outcome enum) — never a logged moment's text. */
export function planAdjustSeed(lang: UiLang, title: string, outcomes: { step: string; outcome: "helped" | "somewhat" | "not_today" }[]): string {
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const list = outcomes.map((o) => `"${o.step}" (${t(`elev.plans.outcome.${o.outcome}`)})`).join(", ");
  return t("elev.plans.adjust.seed", { title, outcomes: list ? t("elev.plans.adjust.outcomes", { list }) : "" });
}
