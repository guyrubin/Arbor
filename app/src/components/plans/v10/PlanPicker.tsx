import React from "react";
import { GlyphChip, LivingForm } from "../../../design/primitives";
import type { Composition } from "../../../design/useComposition";
import type { UiLang } from "../../../lib/i18n";
import { planString } from "../../../lib/plans/planStrings";
import type { ActivePlan } from "../../../lib/plans/planWeek";
import { EMPTY_ART } from "../../../lib/parentArt";
import type { ActionPlan } from "../../../types";
import { ChallengeBook } from "./ChallengeBook";
import { plansCopy } from "./plansCopy";

/**
 * Stop 1's picker (V77: "your plans as tabs"): every plan the family runs is
 * one compact tab — its kind and one line (the action plan's title; the
 * Challenge plan's night). Each plan is drawn once, at its home: an action plan
 * opens below (this screen); a Challenge plan opens its own page
 * (#/plans?challenge=<id>). With no Challenge plan running, one tab opens the
 * Challenge Plans list, so they stay one tap away. Counts only.
 */

export function PlanPicker({ actionPlans, selectedId, challenges, lang, composition, onSelect, onOpenChallenge, onAllChallenges, challengeCount = 0 }: {
  actionPlans: ActionPlan[];
  selectedId: string | null;
  challenges: ActivePlan[];
  lang: UiLang;
  composition: Composition;
  onSelect: (planId: string) => void;
  onOpenChallenge: (plan: ActivePlan) => void;
  /** The Challenge Plans list (shown as a tab when none runs). */
  onAllChallenges?: () => void;
  /** Patterns this family may start; 0 hides the list tab. */
  challengeCount?: number;
}) {
  const l = lang === "he" ? "he" : "en";
  const c = plansCopy(l);
  const desk = composition === "desk";
  const tabs: React.ReactNode[] = [];
  const line = (text: string) => <span className="ds-plans-tabline" dir="auto">{text}</span>;
  for (const plan of actionPlans) {
    const on = plan.id === selectedId;
    tabs.push(
      <button key={plan.id} type="button" className={`pk tabk${desk ? "" : " m"}${on ? " on" : ""}`} aria-pressed={on} onClick={() => onSelect(plan.id)} data-plan-pick={plan.id}>
        <span className="pf"><LivingForm src={EMPTY_ART.plans.src} srcSet={EMPTY_ART.plans.srcSet} width={36} height={26} /></span>
        <span className="pt">
          <small>{c.actionPlan}</small>
          {line(plan.title)}
        </span>
        {desk && <span className="ps">{on ? c.openBelow : c.open}</span>}
      </button>,
    );
  }
  for (const p of challenges) {
    const title = p.def.title[l];
    const total = p.doc.durationDays;
    const night = Math.min(p.day, total);
    tabs.push(
      <a key={p.doc.id} className={`pk tabk${desk ? "" : " m"}`} href={`#/plans?challenge=${p.def.id}`} onClick={(e) => { e.preventDefault(); onOpenChallenge(p); }} data-plan-pick={p.def.id} aria-label={c.openPlan(title)}>
        <span className="pf"><ChallengeBook title={title} size="sm" width={28} label={c.book(title)} /></span>
        <span className="pt">
          <small>{c.challengePlan}</small>
          {line(planString("card.night", l, { n: night, total }))}
        </span>
        {desk && <span className="ps">{c.open}</span>}
      </a>,
    );
  }
  if (!challenges.length && challengeCount > 0 && onAllChallenges) {
    tabs.push(
      <a key="challenge-all" className={`pk tabk${desk ? "" : " m"}`} href="#/plans?challenge=all" onClick={(e) => { e.preventDefault(); onAllChallenges(); }} data-plan-pick="challenge-all">
        <span className="pf"><GlyphChip icon="auto_stories" kind="plan" /></span>
        <span className="pt">
          <small>{planString("section.title", l)}</small>
          {line(planString("section.hard", l))}
        </span>
        {desk && <span className="ps">{c.open}</span>}
      </a>,
    );
  }
  if (!tabs.length) return null;
  return (
    <div className="ds-plans-tabs" role="group" aria-label={c.yourPlans}>
      {tabs}
    </div>
  );
}
