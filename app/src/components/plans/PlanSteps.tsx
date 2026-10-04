import React, { useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { ActionPlan, StepStatus } from "../../types";
import { planStartedDays, planStepStatus } from "../../lib/plans";

/**
 * B-ASKJB-26 — the plan as a track: ONE step list replaces the three Kanban
 * columns. Each row keeps TJB-16's 44 px tap-cycle (the primary move works on
 * a phone) and states its status as a quiet text chip; drag is gone (the
 * one-tap cycle covers every move it made). Edit and delete stay keyed Modals.
 * The header reports "Started {n} days ago" — days since creation, said as
 * such — and a count of steps done, never a share.
 */

type Item = { id: string; phaseIdx: number; stepIdx: number; text: string; status: StepStatus; phaseName: string };

const STATUS_LABEL: Record<StepStatus, string> = {
  todo: "elev.plans.col.todo",
  doing: "elev.plans.col.doing",
  done: "elev.plans.col.done",
};

/** TJB-16: one tap moves a step on by one status, and wraps. */
export const NEXT_STATUS: Record<StepStatus, StepStatus> = { todo: "doing", doing: "done", done: "todo" };

/** Critic r1: one icon family per surface (Material Symbols, as the track card). */
const STATUS_GLYPH: Record<StepStatus, string> = {
  todo: "radio_button_unchecked",
  doing: "pending",
  done: "check_circle",
};

function StepRow({ item, planId, isToday, onEdit }: { item: Item; planId: string; isToday: boolean; onEdit: (item: Item) => void }) {
  const { setPlanStepStatus } = useArbor();
  const { t } = useLanguage();
  const glyph = STATUS_GLYPH[item.status];
  const statusLabel = t(STATUS_LABEL[item.status]);
  // Critic r1: today's step is marked "Today" (clay chip + clay start border),
  // never "Not started" beside the track card's "I'll try it".
  const showToday = isToday && item.status !== "done";
  return (
    <li
      data-plan-step={`${item.phaseIdx}:${item.stepIdx}`}
      data-today-step={isToday ? "true" : undefined}
      className="rounded-xl p-2 t-sm flex items-center gap-1.5"
      style={{
        background: "var(--arbor-paper-elevated)",
        border: "1px solid var(--arbor-rule)",
        borderInlineStart: showToday ? "3px solid var(--arbor-clay)" : "1px solid var(--arbor-rule)",
        color: "var(--arbor-ink)",
      }}
    >
      {/* The primary move. 44 px, always visible, cycles on tap. */}
      <button
        type="button"
        onClick={() => setPlanStepStatus(planId, item.phaseIdx, item.stepIdx, NEXT_STATUS[item.status])}
        className="touch-target inline-flex items-center justify-center rounded-xl flex-shrink-0"
        style={{ minWidth: "var(--touch-min)", minHeight: "var(--touch-min)", color: item.status === "done" ? "var(--arbor-green-ink)" : "var(--arbor-clay)" }}
        aria-label={t("elev.plans.step.advance", { step: item.text, status: statusLabel })}
        data-step-status={item.status}
      >
        <Icon name={glyph} size={20} />
      </button>
      <span dir="auto" className="flex-1 min-w-0" style={item.status === "done" ? { textDecoration: "line-through", color: "var(--arbor-muted)" } : undefined}>{item.text}</span>
      <span
        data-step-chip={showToday ? "today" : item.status}
        className="t-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
        style={showToday
          ? { background: "var(--arbor-clay-dim)", color: "var(--arbor-clay-ink)" }
          : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}
      >
        {showToday ? t("elev.plans.today.chip") : statusLabel}
      </span>
      <button
        type="button"
        onClick={() => onEdit(item)}
        aria-label={t("aria.editStep")}
        className="touch-target inline-flex items-center justify-center rounded-xl flex-shrink-0"
        style={{ minWidth: "var(--touch-min)", minHeight: "var(--touch-min)", color: "var(--arbor-muted)" }}
      >
        <Icon name="edit" size={16} />
      </button>
    </li>
  );
}

export default function PlanSteps({ plan, todayStep, now = Date.now() }: {
  plan: ActionPlan;
  /** The step the plan card names as today's (B-ASKJB-26), outlined in the list. */
  todayStep?: { phaseIdx: number; stepIdx: number } | null;
  now?: number;
}) {
  const { deletePlan, updatePlanStepText } = useArbor();
  const { t } = useLanguage();
  const [editing, setEditing] = useState<Item | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    plan.phases.forEach((ph, phaseIdx) =>
      ph.steps.forEach((st, stepIdx) =>
        out.push({ id: `${plan.id}::${phaseIdx}::${stepIdx}`, phaseIdx, stepIdx, text: st.text, status: planStepStatus(st), phaseName: ph.name })
      )
    );
    return out;
  }, [plan]);

  const total = items.length;
  const done = items.filter((i) => i.status === "done").length;
  const days = planStartedDays(plan, now);

  const openEdit = (item: Item) => { setEditing(item); setDraft(item.text); };
  const saveEdit = () => {
    if (editing && draft.trim()) updatePlanStepText(plan.id, editing.phaseIdx, editing.stepIdx, draft.trim());
    setEditing(null);
  };

  return (
    <div className="rounded-3xl p-6 space-y-4" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-sm)" }}>
      {/* Critic r1: below sm the header stacks — the title takes the full
          width, the count + delete sit on one row beneath it, Focus clamps to
          2 lines (it was 4–5 lines in a ~150 px column at 375). */}
      <div data-testid="plan-header" className="flex flex-col gap-2 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4" style={{ borderBottom: "1px solid var(--arbor-rule)" }}>
        <div className="min-w-0">
          <h3 dir="auto" className="t-lg font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{plan.title}</h3>
          <p dir="auto" className="t-xs mt-1 line-clamp-2" style={{ color: "var(--arbor-muted)" }}>{t("elev.plans.focusIssue", { issue: plan.issue })}</p>
          {days !== null && (
            <p className="t-xs mt-1" style={{ color: "var(--arbor-muted)" }}>
              {days === 0 ? t("elev.plans.startedToday") : t("elev.plans.startedAgo", { n: days })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* TJB-16: a count of steps done, never a completion share. */}
          <span className="t-xs font-bold" style={{ color: "var(--arbor-green-ink)" }}>
            {t("plan.stepsCount", { done, total })}
          </span>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label={t("aria.deletePlan")}
            className="touch-target inline-flex items-center justify-center rounded-xl self-start"
            style={{ minWidth: "var(--touch-min)", minHeight: "var(--touch-min)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}
          >
            <Icon name="delete" size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {plan.phases.map((ph, phaseIdx) => {
          const rows = items.filter((i) => i.phaseIdx === phaseIdx);
          if (rows.length === 0) return null;
          return (
            <div key={phaseIdx} className="space-y-2">
              {ph.name && <p dir="auto" className="t-xs font-extrabold" style={{ color: "var(--arbor-muted)" }}>{ph.name}</p>}
              <ol className="space-y-2" aria-label={t("elev.plans.steps.title")}>
                {rows.map((it) => (
                  <React.Fragment key={it.id}>
                    <StepRow
                      item={it}
                      planId={plan.id}
                      isToday={!!todayStep && todayStep.phaseIdx === it.phaseIdx && todayStep.stepIdx === it.stepIdx}
                      onEdit={openEdit}
                    />
                  </React.Fragment>
                ))}
              </ol>
            </div>
          );
        })}
      </div>

      <p className="t-xs" style={{ color: "var(--arbor-muted)" }}>{t("elev.plans.hint")}</p>

      {/* window.prompt cannot be styled, translated, or mirrored in RTL. */}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={t("elev.plans.edit.title")} maxWidth="max-w-md">
        <label className="block text-xs font-bold mb-2" style={{ color: "var(--arbor-ink)" }} htmlFor="plan-step-text">
          {t("elev.plans.edit.label")}
        </label>
        <textarea
          id="plan-step-text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          className="w-full rounded-xl p-3 text-sm"
          style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
        />
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={saveEdit}
            className="touch-target flex-1 rounded-xl t-sm font-bold"
            style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)", minHeight: "var(--touch-min)" }}
          >
            {t("elev.plans.edit.save")}
          </button>
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="touch-target rounded-xl px-4 t-sm font-bold"
            style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)", minHeight: "var(--touch-min)" }}
          >
            {t("elev.plans.edit.cancel")}
          </button>
        </div>
      </Modal>

      {/* window.confirm, same problem: an English browser dialog in a Hebrew app. */}
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title={t("elev.plans.delete.title")} maxWidth="max-w-md">
        <p className="text-sm" style={{ color: "var(--arbor-ink)" }}>{t("confirm.deletePlan", { title: plan.title })}</p>
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={() => { deletePlan(plan.id); setConfirmDelete(false); }}
            className="touch-target flex-1 rounded-xl t-sm font-bold"
            style={{ background: "var(--arbor-peach-ink)", color: "var(--arbor-on-accent)", minHeight: "var(--touch-min)" }}
          >
            {t("elev.plans.delete.cta")}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="touch-target rounded-xl px-4 t-sm font-bold"
            style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)", minHeight: "var(--touch-min)" }}
          >
            {t("elev.plans.edit.cancel")}
          </button>
        </div>
      </Modal>
    </div>
  );
}
