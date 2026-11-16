import React, { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import type { ActionPlan } from "../../types";

/**
 * The plan's two keyed dialogs, shared by every view of a plan's steps
 * (PlanSteps, the v10 whole-plan section): edit one step's words, and delete
 * the plan. window.prompt / window.confirm cannot be styled, translated or
 * mirrored in RTL, so both are Modals.
 */

export type StepTarget = { phaseIdx: number; stepIdx: number; text: string };

export function PlanStepEditModal({ plan, editing, onClose }: { plan: ActionPlan; editing: StepTarget | null; onClose: () => void }) {
  const { updatePlanStepText } = useArbor();
  const { t } = useLanguage();
  const [draft, setDraft] = useState(editing?.text ?? "");
  useEffect(() => { setDraft(editing?.text ?? ""); }, [editing]);
  const saveEdit = () => {
    if (editing && draft.trim()) updatePlanStepText(plan.id, editing.phaseIdx, editing.stepIdx, draft.trim());
    onClose();
  };
  return (
    <Modal open={editing !== null} onClose={onClose} title={t("elev.plans.edit.title")} maxWidth="max-w-md">
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
          onClick={onClose}
          className="touch-target rounded-xl px-4 t-sm font-bold"
          style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)", minHeight: "var(--touch-min)" }}
        >
          {t("elev.plans.edit.cancel")}
        </button>
      </div>
    </Modal>
  );
}

export function PlanDeleteModal({ plan, open, onClose }: { plan: ActionPlan; open: boolean; onClose: () => void }) {
  const { deletePlan } = useArbor();
  const { t } = useLanguage();
  return (
    <Modal open={open} onClose={onClose} title={t("elev.plans.delete.title")} maxWidth="max-w-md">
      <p className="text-sm" style={{ color: "var(--arbor-ink)" }}>{t("confirm.deletePlan", { title: plan.title })}</p>
      <div className="flex gap-2 mt-4">
        <button
          type="button"
          onClick={() => { deletePlan(plan.id); onClose(); }}
          className="touch-target flex-1 rounded-xl t-sm font-bold"
          style={{ background: "var(--arbor-peach-ink)", color: "var(--arbor-on-accent)", minHeight: "var(--touch-min)" }}
        >
          {t("elev.plans.delete.cta")}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="touch-target rounded-xl px-4 t-sm font-bold"
          style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)", minHeight: "var(--touch-min)" }}
        >
          {t("elev.plans.edit.cancel")}
        </button>
      </div>
    </Modal>
  );
}
