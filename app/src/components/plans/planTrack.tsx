import React from "react";
import type { UiLang } from "../../lib/i18n";
import { translate } from "../../lib/i18n";

/* The plan card's shared pieces. The card itself is the v10 stage
   (plans/v10/ActionPlanStage: today's step, "I'll try it", the weekly
   check-in, the echo and "Adjust the plan", B-ASKJB-26). */

/**
 * Critic r1 (W2-ASKJB plans): the eyebrow interpolates the plan's own title —
 * parent/AI content in either script — so it renders inside <bdi> (no period
 * flip in RTL) and is never upper-cased. Template split on a sentinel so the
 * keyed copy stays the one source of word order in both locales.
 */
export function PlanEyebrow({ template, title }: { template: string; title: string }) {
  const [before, after = ""] = template.split("\u0000");
  return <>{before}<bdi dir="auto">{title}</bdi>{after}</>;
}

/** The Ask seed for "Adjust the plan": the plan title and its last step
 *  outcomes (plan text + outcome enum) — never a logged moment's text. */
export function planAdjustSeed(lang: UiLang, title: string, outcomes: { step: string; outcome: "helped" | "somewhat" | "not_today" }[]): string {
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const list = outcomes.map((o) => `"${o.step}" (${t(`elev.plans.outcome.${o.outcome}`)})`).join(", ");
  return t("elev.plans.adjust.seed", { title, outcomes: list ? t("elev.plans.adjust.outcomes", { list }) : "" });
}
