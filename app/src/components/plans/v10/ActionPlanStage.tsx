import React from "react";
import { Icon } from "../../ui/Icon";
import { Fig, LivingForm, Scene, StartHere } from "../../../design/primitives";
import type { Composition } from "../../../design/useComposition";
import { CoachTryIt, type CoachTodayStep, type TryItButtonProps } from "../../coach/CoachAnswerCards";
import { translate, type UiLang } from "../../../lib/i18n";
import { PLAN_CHECK_ANSWERS, offerPlanAdjust, planEchoKey, planEyebrowKey, planStepStatus, weeklyCheckDue, type PlanEcho, type TodaysPlanStep } from "../../../lib/plans";
import type { PlanStepRef } from "../../../actionLoop/model";
import type { ActionPlan, PlanCheckAnswer, StepStatus } from "../../../types";
import { EMPTY_ART } from "../../../lib/parentArt";
import { mirrorPoints, Road, wavePoints } from "./Road";
import { PlanEyebrow } from "../planTrack";
import { plansCopy } from "./plansCopy";

/**
 * Stop 1's stage for an action plan (N-Plans): today's step leads (the screen's
 * one <h1>), the plan as a trail (one token per step, brackets for phases),
 * then today's "I'll try it" — the same CoachTryIt control the Ask answer uses,
 * carrying the route's primary-move stamp. The weekly check-in, the echo of
 * the last outcome, the "next step" offer and "Adjust the plan" keep
 * PlanTrackCard's behaviour (B-ASKJB-26 / NEW-1g/1h); only the presentation moved.
 *
 * FIREWALL: counts of steps an adult planned and did; no outcome colour.
 */

export type FlatStep = { n: number; phaseIdx: number; stepIdx: number; text: string; status: StepStatus };

export function flatSteps(plan: ActionPlan): FlatStep[] {
  const out: FlatStep[] = [];
  plan.phases.forEach((ph, phaseIdx) => ph.steps.forEach((st, stepIdx) => out.push({ n: out.length + 1, phaseIdx, stepIdx, text: st.text, status: planStepStatus(st) })));
  return out;
}

/** The plan as a trail: a token per step on the road, phase brackets beneath. */
export function PlanTrail({ plan, todayStep, lang, composition }: { plan: ActionPlan; todayStep: TodaysPlanStep | null; lang: UiLang; composition: Composition }) {
  const c = plansCopy(lang === "he" ? "he" : "en");
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const steps = flatSteps(plan);
  if (steps.length === 0) return null;
  const pts = mirrorPoints(wavePoints(steps.length, { padX: 4.8 }), lang === "he");
  const firstOfPhase: number[] = [];
  steps.forEach((s, i) => { if (i === 0 || steps[i - 1].phaseIdx !== s.phaseIdx) firstOfPhase.push(i); });
  const isToday = (s: FlatStep) => !!todayStep && todayStep.phaseIdx === s.phaseIdx && todayStep.stepIdx === s.stepIdx && s.status !== "done";
  const gap = steps.length > 1 ? Math.abs(pts[1].x - pts[0].x) : 100;
  const desk = composition === "desk";
  const W = desk ? 656 : 340;
  const H = desk ? 156 : 120;
  return (
    <div className="trailbox">
      <div className="gfx trail">
        <Road points={pts} stretches={firstOfPhase} width={W} height={H} strokeWidth={desk ? 26 : 22} />
        {steps.map((s, i) => {
          const here = isToday(s);
          const state = s.status === "done" ? "" : here ? " here" : " open";
          const status = here ? t("elev.plans.today.chip") : t(`elev.plans.col.${s.status}`);
          const above = pts[i].y > 50;
          return (
            <React.Fragment key={`${s.phaseIdx}:${s.stepIdx}`}>
              <i className={`at tok plan${state}${desk ? " lg" : ""}`} style={{ left: `${pts[i].x}%`, top: `${pts[i].y}%` }} role="img" aria-label={c.stepToken(s.n, s.text, status)} />
              {here && (
                <span className="at pin" style={{ left: `${pts[i].x}%`, top: `calc(${pts[i].y}% - 44px)` }} aria-hidden="true">
                  <b>{t("elev.plans.today.chip")}</b>
                  <i />
                </span>
              )}
              {!here && (
                <span className="cl c" style={{ left: `${pts[i].x}%`, top: above ? `calc(${pts[i].y}% - ${desk ? 42 : 36}px)` : `calc(${pts[i].y}% + ${desk ? 22 : 18}px)`, color: "var(--muted)" }} aria-hidden="true">
                  {s.n}
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>
      {plan.phases.length > 1 && (
        <div className="phs" aria-hidden="true">
          {firstOfPhase.map((from, k) => {
            const to = (k + 1 < firstOfPhase.length ? firstOfPhase[k + 1] : steps.length) - 1;
            const lo = Math.min(pts[from].x, pts[to].x);
            const hi = Math.max(pts[from].x, pts[to].x);
            const left = Math.max(0, lo - gap / 2 + 0.8);
            const right = Math.min(100, hi + gap / 2 - 0.8);
            return (
              <span key={from} style={{ left: `${left}%`, width: `${right - left}%` }}>
                {c.phaseN(k + 1)}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export interface ActionPlanStageProps {
  plan: ActionPlan;
  step: TodaysPlanStep | null;
  today: CoachTodayStep | null | undefined;
  lang: UiLang;
  now: number;
  composition: Composition;
  echo?: PlanEcho;
  childName?: string;
  primary?: TryItButtonProps;
  onTryIt: (text: string, ref: PlanStepRef) => void;
  onUndo: (id: string) => void;
  onCheck: (answer: PlanCheckAnswer) => void;
  onAdjust: () => void;
}

export function ActionPlanStage({ plan, step, today, lang, now, composition, echo = null, childName = "", primary, onTryIt, onUndo, onCheck, onAdjust }: ActionPlanStageProps) {
  const c = plansCopy(lang === "he" ? "he" : "en");
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const desk = composition === "desk";
  const steps = flatSteps(plan);
  const done = steps.filter((s) => s.status === "done");
  const todayFlat = step ? steps.find((s) => s.phaseIdx === step.phaseIdx && s.stepIdx === step.stepIdx) : undefined;
  const due = weeklyCheckDue(plan, now);
  const adjust = offerPlanAdjust(plan);
  const lastCheck = plan.weeklyChecks?.[plan.weeklyChecks.length - 1];
  const ref = (s: PlanStepRef) => ({ planId: s.planId, phaseIdx: s.phaseIdx, stepIdx: s.stepIdx });
  const orbs = desk
    ? [{ size: 420, left: -240, bottom: -260, opacity: 0.6 }, { size: 360, right: -170, top: -230, opacity: 0.8, b: true }]
    : [{ size: 240, left: -150, bottom: -150, opacity: 0.55 }, { size: 220, right: -120, top: -130, opacity: 0.75, b: true }];
  const pad = desk ? "0 28px" : "0 16px";

  const echoLine = echo && echo.kind === "not-yet-twice" ? (
    <button type="button" data-testid="plan-echo" data-echo={echo.kind} onClick={onAdjust} className="ds-link min-h-11" style={{ paddingInline: 0 }}>
      {t(planEchoKey(echo))}
    </button>
  ) : echo ? (
    <p data-testid="plan-echo" data-echo={echo.kind} dir="auto"
      className={echo.kind === "progress" ? "t-base leading-relaxed" : "t-sm leading-snug"}
      style={{ fontFamily: echo.kind === "progress" ? "var(--font-sans)" : "var(--font-editorial)", color: "var(--arbor-ink-soft)" }}>
      <span className="min-w-0 line-clamp-2">{t(planEchoKey(echo), { step: "step" in echo ? echo.step : "", n: "done" in echo ? echo.done : 0, name: childName })}</span>
    </p>
  ) : null;

  return (
    <Scene field="plan" orbs={orbs} style={{ padding: 0, gap: 0, flex: desk ? 1 : undefined }} data-testid="plan-track-card">
      <div className="line between" style={{ padding: desk ? "22px 28px 0" : "16px 16px 0", alignItems: "flex-start" }}>
        <span className="gsec">
          <span className="kicker">
            {todayFlat ? `${c.actionPlan} · ${c.stepOf(todayFlat.n, steps.length)}` : c.actionPlan}
          </span>
          {step && <StartHere>{t("elev.plans.today.chip")}</StartHere>}
        </span>
        {desk && <Fig n={done.length} unit={c.ofSteps(steps.length)} sub={plan.phases.length > 1 ? c.inPhases(plan.phases.length) : undefined} size="md" />}
      </div>

      <div data-testid={step ? "plan-today-step" : undefined} style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: desk ? 20 : 12, alignItems: "center", padding: desk ? "6px 28px 0" : "10px 16px 0" }}>
        <LivingForm src={EMPTY_ART.plans.src} srcSet={EMPTY_ART.plans.srcSet} width={desk ? 116 : 84} height={desk ? 83 : 60} />
        <div className="stack ds-col" style={{ gap: desk ? 8 : 4 }}>
          {step ? (
            <>
              {/* "Today's step · {plan}" on day 1, "Day {n} of {plan}" after: the
                  plan title isolated in <bdi>, never upper-cased (critic r1). */}
              <p data-testid="plan-today-eyebrow" className="small" style={{ fontWeight: 600, color: "var(--k-plan)" }}>
                <PlanEyebrow template={t(planEyebrowKey(step.day), { n: step.day, plan: "\u0000" })} title={plan.title} />
              </p>
              {echoLine}
              <h1 className="hero" dir="auto" style={{ fontSize: desk ? 30 : 22, lineHeight: 1.12 }}>{step.text}</h1>
            </>
          ) : (
            <>
              <h1 className="hero" dir="auto" style={{ fontSize: desk ? 30 : 22, lineHeight: 1.12 }}>{plan.title}</h1>
              <p className="line" style={{ gap: 8, fontSize: 15, color: "var(--ink)" }}>
                <Icon name="check_circle" size={18} style={{ color: "var(--k-plan)" }} />
                {t("plan.complete")}
              </p>
              <p className="small">{t("plan.completeHint")}</p>
            </>
          )}
          {!step && echoLine}
          {!desk && <Fig n={done.length} unit={c.ofSteps(steps.length)} size="sm" />}
        </div>
      </div>

      <div style={{ padding: desk ? "40px 28px 0" : "36px 12px 0" }}>
        <PlanTrail plan={plan} todayStep={step} lang={lang} composition={composition} />
      </div>

      <div className="stack ds-col" style={{ gap: 10, padding: desk ? "16px 28px 22px" : "10px 16px 16px", marginTop: desk ? "auto" : undefined }}>
        {step && (
          <div className="ds-plans-try">
            <CoachTryIt step={step.text} today={today} lang={lang} onTryIt={(text) => onTryIt(text, ref(step))} onUndo={onUndo} buttonProps={primary} />
          </div>
        )}
        <span className="small" style={{ color: "var(--ink-soft)" }} data-testid="plan-done-so-far">
          {done.length === steps.length && steps.length > 0 ? c.allDone : done.length > 0 ? c.doneSoFar(done.map((s) => s.n)) : t("plan.stepsCount", { done: 0, total: steps.length })}
        </span>
        {step?.offerNext && step.next && (
          <div data-testid="plan-offer-next" className="stack ds-col" style={{ gap: 4 }}>
            <p className="small">{t("elev.plans.today.next")}</p>
            <p dir="auto" style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)" }}>{step.next.text}</p>
            <CoachTryIt step={step.next.text} today={today} lang={lang} onTryIt={(text) => onTryIt(text, ref(step.next!))} onUndo={onUndo} />
          </div>
        )}
        {due && (
          <div data-testid="plan-weekly-check" className="stack ds-col" style={{ gap: 8, paddingTop: 12, borderTop: "1px solid var(--rule)" }}>
            <p style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)" }}>{t("elev.plans.check.q")}</p>
            <p data-testid="plan-will-ask" className="small">{t("elev.words.plans.willAsk")}</p>
            <div className="line" style={{ gap: 8, flexWrap: "wrap" }} role="group" aria-label={t("elev.plans.check.q")}>
              {PLAN_CHECK_ANSWERS.map((a) => (
                <button key={a} type="button" data-check-answer={a} onClick={() => onCheck(a)} className="btn ghost sm min-h-11" style={{ background: "var(--card)" }}>
                  {t(`elev.plans.check.${a}`)}
                </button>
              ))}
            </div>
          </div>
        )}
        {!due && lastCheck && <p className="small">{t("elev.plans.check.saved")}</p>}
        {adjust && (
          <button type="button" data-testid="plan-adjust" onClick={onAdjust} className="btn ghost sm min-h-11" style={{ background: "var(--card)", alignSelf: "flex-start" }}>
            <Icon name="auto_awesome" size={14} /> {t("elev.plans.adjust")}
          </button>
        )}
      </div>
    </Scene>
  );
}
