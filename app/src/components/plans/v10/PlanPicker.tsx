import React from "react";
import { Icon } from "../../ui/Icon";
import { LivingForm } from "../../../design/primitives";
import type { Composition } from "../../../design/useComposition";
import { translate, type UiLang } from "../../../lib/i18n";
import { planString } from "../../../lib/plans/planStrings";
import { tonightStepForParent, type ActivePlan } from "../../../lib/plans/planWeek";
import { EMPTY_ART } from "../../../lib/parentArt";
import type { ActionPlan } from "../../../types";
import { ChallengeBook } from "./ChallengeBook";
import { flatSteps } from "./ActionPlanStage";
import { plansCopy } from "./plansCopy";

/**
 * Stop 1's picker: every plan the family runs, one card each with one
 * anatomy — the action plan(s) named by their title, the Challenge plan(s) by
 * their book title. An action plan opens below (this screen); a Challenge plan
 * opens its own page (#/plans?challenge=<id>). Counts only.
 */

/** A template with one {n} number made big: "Night <b>9</b> of 14". */
function BigNumber({ template, n }: { template: string; n: number }) {
  const [before, after = ""] = template.split("\u0000");
  return <>{before}<b>{n}</b>{after}</>;
}

export function PlanPicker({ actionPlans, selectedId, todaySteps, challenges, lang, composition, onSelect, onOpenChallenge }: {
  actionPlans: ActionPlan[];
  selectedId: string | null;
  /** Today's step text per action plan id (null when the plan is complete). */
  todaySteps: Record<string, string | null>;
  challenges: ActivePlan[];
  lang: UiLang;
  composition: Composition;
  onSelect: (planId: string) => void;
  onOpenChallenge: (plan: ActivePlan) => void;
}) {
  const l = lang === "he" ? "he" : "en";
  const c = plansCopy(l);
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const desk = composition === "desk";
  const cards: React.ReactNode[] = [];
  for (const plan of actionPlans) {
    const steps = flatSteps(plan);
    const done = steps.filter((s) => s.status === "done").length;
    const on = plan.id === selectedId;
    const step = todaySteps[plan.id];
    const progress = t("plan.stepsCount", { done, total: steps.length });
    cards.push(
      <button key={plan.id} type="button" className={`pk${desk ? " x6" : " m"}${on ? " on" : ""}`} aria-pressed={on} onClick={() => onSelect(plan.id)} data-plan-pick={plan.id}>
        <span className="pf"><LivingForm src={EMPTY_ART.plans.src} srcSet={EMPTY_ART.plans.srcSet} width={desk ? 64 : 44} height={desk ? 46 : 32} /></span>
        <span className="pt">
          <small>{c.actionPlan}</small>
          <b dir="auto">{plan.title}</b>
          <span dir="auto">{desk ? step ?? t("plan.complete") : `${progress} · ${step ?? t("plan.complete")}`}</span>
        </span>
        {desk ? (
          <span className="pr">
            <span className="pg"><b>{done}</b>{c.ofSteps(steps.length)}</span>
            <span className="ps">{on ? c.openBelow : c.open}</span>
          </span>
        ) : (
          <span className="ps">{on ? c.openBelow : c.open}</span>
        )}
      </button>,
    );
  }
  for (const p of challenges) {
    const title = p.def.title[l];
    const total = p.doc.durationDays;
    const night = Math.min(p.day, total);
    const step = tonightStepForParent(p.doc, l);
    const nightLine = planString("card.night", l, { n: night, total });
    cards.push(
      <a key={p.doc.id} className={`pk${desk ? " x6" : " m"}`} href={`#/plans?challenge=${p.def.id}`} onClick={(e) => { e.preventDefault(); onOpenChallenge(p); }} data-plan-pick={p.def.id} aria-label={c.openPlan(title)}>
        <span className="pf"><ChallengeBook title={title} size="sm" width={desk ? 46 : 34} label={c.book(title)} /></span>
        <span className="pt">
          <small>{c.challengePlan}</small>
          <b dir="auto">{title}</b>
          <span dir="auto">{desk ? (step ? planString("card.tonight", l, { step }) : p.def.parentWords[l]) : `${nightLine}${step ? ` · ${planString("card.tonight", l, { step })}` : ""}`}</span>
        </span>
        {desk ? (
          <span className="pr">
            <span className="pg"><BigNumber template={planString("card.night", l, { n: "\u0000", total })} n={night} /></span>
            <span className="ps">{c.open}</span>
          </span>
        ) : (
          <span className="ps"><Icon name="chevron_right" size={18} className="rtl:-scale-x-100" /></span>
        )}
      </a>,
    );
  }
  if (!cards.length) return null;
  return desk ? (
    <div className="g12" style={{ marginBottom: 16 }} role="group" aria-label={c.yourPlans}>
      {cards}
    </div>
  ) : (
    <div className="stack ds-col" style={{ gap: 8 }} role="group" aria-label={c.yourPlans}>
      {cards}
    </div>
  );
}
