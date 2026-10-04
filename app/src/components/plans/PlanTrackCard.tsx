import React from "react";
import { Icon } from "../ui/Icon";
import type { ActionPlan, PlanCheckAnswer } from "../../types";
import type { UiLang } from "../../lib/i18n";
import { translate } from "../../lib/i18n";
import { CoachTryIt, type CoachTodayStep, type TryItButtonProps } from "../coach/CoachAnswerCards";
import { PLAN_CHECK_ANSWERS, offerPlanAdjust, planEyebrowKey, weeklyCheckDue, type TodaysPlanStep } from "../../lib/plans";
import type { PlanStepRef } from "../../actionLoop/model";
import { cardCls } from "../ui/kit";

/**
 * B-ASKJB-26 — the plan card: TODAY's step and the weekly check-in.
 *
 *  - "Day {n} of {plan}" + the step + "I'll try it" — the same control the Ask
 *    answer uses (B-ASKJB-04's CoachTryIt), so the one-step-per-day law and its
 *    replace-confirm hold here too. Accepting writes an action-loop row with
 *    `source: "plan"` and the step's PlanStepRef; its outcome moves the step.
 *  - After a "somewhat", the next step is offered beside the kept one.
 *  - Weekly (7 days after creation, then 7 days after the last answer):
 *    "Signs it's working?" Yes / A little / Not yet, with the plan's own signs
 *    listed as what to look for. "Not yet" twice → "Adjust the plan in Ask".
 *
 * Pure props (no context) so the card renders in the node test harness.
 */
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

export default function PlanTrackCard({ plan, step, today, lang, now, onTryIt, onUndo, onCheck, onAdjust, primary }: {
  plan: ActionPlan;
  step: TodaysPlanStep | null;
  today: CoachTodayStep | null | undefined;
  lang: UiLang;
  now: number;
  onTryIt: (text: string, ref: PlanStepRef) => void;
  onUndo: (id: string) => void;
  onCheck: (answer: PlanCheckAnswer) => void;
  onAdjust: () => void;
  /** The host's contract stamp + primary fill for today's "I'll try it". */
  primary?: TryItButtonProps;
}) {
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const due = weeklyCheckDue(plan, now);
  const adjust = offerPlanAdjust(plan);
  const lastCheck = plan.weeklyChecks?.[plan.weeklyChecks.length - 1];
  const ref = (s: PlanStepRef) => ({ planId: s.planId, phaseIdx: s.phaseIdx, stepIdx: s.stepIdx });

  return (
    <div data-testid="plan-track-card" className={`${cardCls} p-5 space-y-4`}>
      {step ? (
        <div data-testid="plan-today-step" className="space-y-1.5">
          <p data-testid="plan-today-eyebrow" className="t-xs font-bold" style={{ color: "var(--arbor-green-ink)" }}>
            <PlanEyebrow template={t(planEyebrowKey(step.day), { n: step.day, plan: "\u0000" })} title={plan.title} />
          </p>
          <p dir="auto" className="t-md font-bold leading-snug" style={{ color: "var(--arbor-ink)" }}>{step.text}</p>
          <CoachTryIt step={step.text} today={today} lang={lang} onTryIt={(text) => onTryIt(text, ref(step))} onUndo={onUndo} buttonProps={primary} />
          {step.offerNext && step.next && (
            <div data-testid="plan-offer-next" className="pt-1 space-y-1">
              <p className="t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.plans.today.next")}</p>
              <p dir="auto" className="t-sm font-bold" style={{ color: "var(--arbor-ink)" }}>{step.next.text}</p>
              <CoachTryIt step={step.next.text} today={today} lang={lang} onTryIt={(text) => onTryIt(text, ref(step.next!))} onUndo={onUndo} />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-sm font-extrabold flex items-center gap-2" style={{ color: "var(--arbor-ink)" }}>
            <Icon name="check_circle" size={16} style={{ color: "var(--arbor-green-ink)" }} /> {t("plan.complete")}
          </p>
          <p className="t-xs" style={{ color: "var(--arbor-muted)" }}>{t("plan.completeHint")}</p>
        </div>
      )}

      {due && (
        <div data-testid="plan-weekly-check" className="space-y-2 pt-3" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
          <p className="t-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("elev.plans.check.q")}</p>
          {plan.successIndicators?.length > 0 && (
            <div className="t-sm" style={{ color: "var(--arbor-muted)" }}>
              <span className="font-bold">{t("elev.plans.check.signs")}</span>
              <ul className="list-disc ps-5 space-y-0.5 mt-1 leading-relaxed">
                {plan.successIndicators.map((s, i) => <li key={i} dir="auto">{s}</li>)}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("elev.plans.check.q")}>
            {PLAN_CHECK_ANSWERS.map((a) => (
              <button
                key={a}
                type="button"
                data-check-answer={a}
                onClick={() => onCheck(a)}
                className="inline-flex min-h-11 items-center rounded-full px-4 t-sm font-bold"
                style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule-strong)" }}
              >
                {t(`elev.plans.check.${a}`)}
              </button>
            ))}
          </div>
        </div>
      )}
      {!due && lastCheck && (
        <p className="t-xs pt-3" style={{ color: "var(--arbor-muted)", borderTop: "1px solid var(--arbor-rule)" }}>{t("elev.plans.check.saved")}</p>
      )}
      {adjust && (
        <button
          type="button"
          data-testid="plan-adjust"
          onClick={onAdjust}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 t-sm font-bold"
          style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
        >
          <Icon name="auto_awesome" size={14} /> {t("elev.plans.adjust")}
        </button>
      )}
    </div>
  );
}

/** The Ask seed for "Adjust the plan": the plan title and its last step
 *  outcomes (plan text + outcome enum) — never a logged moment's text. */
export function planAdjustSeed(lang: UiLang, title: string, outcomes: { step: string; outcome: "helped" | "somewhat" | "not_today" }[]): string {
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const list = outcomes.map((o) => `"${o.step}" (${t(`elev.plans.outcome.${o.outcome}`)})`).join(", ");
  return t("elev.plans.adjust.seed", { title, outcomes: list ? t("elev.plans.adjust.outcomes", { list }) : "" });
}
