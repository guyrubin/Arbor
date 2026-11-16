import React, { useState } from "react";
import { Icon } from "../../ui/Icon";
import { RouteHead, Snap, SnapDots } from "../../../design/primitives";
import type { Composition } from "../../../design/useComposition";
import { useArbor } from "../../../context/ArborContext";
import { translate, type UiLang } from "../../../lib/i18n";
import { demoteObservationSteps } from "../../../lib/plans/stepOrder";
import { NEXT_STATUS } from "../PlanSteps";
import { PlanDeleteModal, PlanStepEditModal, type StepTarget } from "../PlanStepModals";
import type { ActionPlan } from "../../../types";
import type { TodaysPlanStep } from "../../../lib/plans";
import { flatSteps, type FlatStep } from "./ActionPlanStage";
import { plansCopy } from "./plansCopy";

/**
 * Stop 3, the whole plan (the plan's only home): production's "Working on:"
 * sentence, each phase as a stretch of the trail (one token per step) over its
 * step list. A step's token is its 44 px status button — one tap moves it on
 * (not started → in progress → done, TJB-16) — and each row keeps its edit
 * pencil; "Delete plan" sits with the plan. Desktop: the phases side by side.
 * Phone: one phase per card in a snap row, with Delete plan below.
 */

/** "Phase 1 · Safe home departure", unless the plan's own name already says "Phase 1: …". */
export function phaseLabel(numbered: string, name?: string): string {
  if (!name) return numbered;
  return /^\s*(phase|stage|שלב)\s*\d+/i.test(name) ? name : `${numbered} · ${name}`;
}

function StepToken({ s, today, planId, lang, size }: { s: FlatStep; today: boolean; planId: string; lang: UiLang; size?: "sm" }) {
  const { setPlanStepStatus } = useArbor();
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const status = t(`elev.plans.col.${s.status}`);
  const state = s.status === "done" ? "" : today ? " here" : " open";
  return (
    <button
      type="button"
      className="ds-plans-tokbtn"
      onClick={() => setPlanStepStatus(planId, s.phaseIdx, s.stepIdx, NEXT_STATUS[s.status])}
      aria-label={t("elev.plans.step.advance", { step: s.text, status })}
      data-step-status={s.status}
    >
      <i className={`tok plan${state}${size ? ` ${size}` : ""}`} aria-hidden="true" />
    </button>
  );
}

function Phase({ plan, phaseIdx, steps, todayStep, lang, onEdit }: { plan: ActionPlan; phaseIdx: number; steps: FlatStep[]; todayStep: TodaysPlanStep | null; lang: UiLang; onEdit: (s: StepTarget) => void }) {
  const c = plansCopy(lang === "he" ? "he" : "en");
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const name = plan.phases[phaseIdx]?.name;
  const isToday = (s: FlatStep) => !!todayStep && todayStep.phaseIdx === s.phaseIdx && todayStep.stepIdx === s.stepIdx && s.status !== "done";
  // B-ASKJB-35 (b): act-first display order inside the phase.
  const rows = demoteObservationSteps(steps.map((s) => ({ ...s, id: `${s.phaseIdx}:${s.stepIdx}` })));
  const done = steps.filter((s) => s.status === "done").length;
  return (
    <>
      <div className="stack ds-col" style={{ gap: 2 }}>
        <b className="ds-plans-phase" dir="auto">{phaseLabel(c.phaseN(phaseIdx + 1), name)}</b>
        <span className="small" style={{ fontVariantNumeric: "lining-nums" }}>{c.phaseDone(done, steps.length)}</span>
      </div>
      <div className="nx-road" aria-hidden="true">
        {steps.map((s, i) => (
          <React.Fragment key={s.n}>
            {i > 0 && <span className={steps[i - 1].status === "done" ? "seg done" : "seg"} />}
            <span className="ds-plans-roadstop">
              <i className={`tok plan${s.status === "done" ? "" : isToday(s) ? " here" : " open"}`} />
              <small>{c.stepN(s.n)}</small>
            </span>
          </React.Fragment>
        ))}
      </div>
      <ol className="nx-steps" aria-label={t("elev.plans.steps.title")}>
        {rows.map((s) => {
          const today = isToday(s);
          return (
            <li key={s.id} className={s.status === "done" ? "done" : today ? "here" : "open"} data-plan-step={s.id} data-today-step={today ? "true" : undefined}>
              <StepToken s={s} today={today} planId={plan.id} lang={lang} size="sm" />
              <span dir="auto">
                {s.text}
                <span className="sx" data-step-chip={today ? "today" : s.status}>{today ? t("elev.plans.today.chip") : t(`elev.plans.col.${s.status}`)}</span>
              </span>
              <button type="button" className="ed" aria-label={t("aria.editStep")} onClick={() => onEdit({ phaseIdx: s.phaseIdx, stepIdx: s.stepIdx, text: s.text })}>
                <Icon name="edit" size={16} />
              </button>
            </li>
          );
        })}
      </ol>
    </>
  );
}

export function PlanWhole({ plan, todayStep, lang, composition }: { plan: ActionPlan; todayStep: TodaysPlanStep | null; lang: UiLang; composition: Composition }) {
  const c = plansCopy(lang === "he" ? "he" : "en");
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const [editing, setEditing] = useState<StepTarget | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const steps = flatSteps(plan);
  const phases = plan.phases.map((_, i) => i).filter((i) => steps.some((s) => s.phaseIdx === i));
  const working = plan.issue ? t("elev.plans.focusIssue", { issue: plan.issue }) : null;
  const del = (
    <button type="button" className="sq" aria-label={t("aria.deletePlan")} onClick={() => setConfirmDelete(true)} style={{ width: 44, height: 44 }}>
      <Icon name="delete" size={18} />
    </button>
  );
  const modals = (
    <>
      <PlanStepEditModal plan={plan} editing={editing} onClose={() => setEditing(null)} />
      <PlanDeleteModal plan={plan} open={confirmDelete} onClose={() => setConfirmDelete(false)} />
    </>
  );

  if (composition === "desk") {
    return (
      <>
        <RouteHead title={<bdi dir="auto">{plan.title}</bdi>} />
        <section className="vt x12" style={{ gap: 12 }} data-testid="plan-header" aria-label={plan.title}>
          <div className="line between" style={{ gap: 20, alignItems: "flex-start" }}>
            <div className="stack ds-col" style={{ gap: 4, maxWidth: 800 }}>
              {working && <p dir="auto" style={{ fontSize: 14, lineHeight: 1.4, color: "var(--ink)" }}>{working}</p>}
              <p className="small" style={{ color: "var(--ink-soft)" }}>{t("elev.plans.hint")}</p>
            </div>
            <span className="line" style={{ gap: 8, flex: "none" }}>{del}</span>
          </div>
          <div className="ds-plans-phases" style={{ gridTemplateColumns: phases.length > 1 ? `1.32fr ${"1fr ".repeat(phases.length - 1)}` : "1fr" }}>
            {phases.map((i) => (
              <div key={i} className="nx-col">
                <Phase plan={plan} phaseIdx={i} steps={steps.filter((s) => s.phaseIdx === i)} todayStep={todayStep} lang={lang} onEdit={setEditing} />
              </div>
            ))}
          </div>
        </section>
        {modals}
      </>
    );
  }
  return (
    <div className="stack ds-col" style={{ gap: 10 }} data-testid="plan-header">
      <RouteHead title={c.wholePlan} />
      <p style={{ fontSize: 13.5, lineHeight: 1.4, margin: 0 }} dir="auto">
        <b style={{ fontWeight: 600 }}>{plan.title}.</b>
        {working && <> {working}</>}
      </p>
      <Snap label={c.wholePlan}>
        {phases.map((i) => (
          <article key={i} className="nx-phc">
            <Phase plan={plan} phaseIdx={i} steps={steps.filter((s) => s.phaseIdx === i)} todayStep={todayStep} lang={lang} onEdit={setEditing} />
          </article>
        ))}
      </Snap>
      {phases.length > 1 && <SnapDots count={phases.length} caption={c.phaseOf(1, phases.length)} />}
      <p className="small" style={{ color: "var(--ink-soft)", margin: 0 }}>{t("elev.plans.hint")}</p>
      <div className="line" style={{ gap: 8 }}>
        <button type="button" className="btn ghost sm grow" style={{ background: "var(--card)" }} onClick={() => setConfirmDelete(true)}>
          <Icon name="delete" size={16} />
          {t("elev.plans.delete.cta")}
        </button>
      </div>
      {modals}
    </div>
  );
}
