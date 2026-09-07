import React, { useMemo, useState } from "react";
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { GripVertical, Trash2, Pencil, Circle, CircleDot, CircleCheckBig } from "lucide-react";
import { Modal } from "../ui/Modal";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { ActionPlan, StepStatus } from "../../types";

type Item = { id: string; phaseIdx: number; stepIdx: number; text: string; status: StepStatus; phaseName: string };

const COLUMNS: { status: StepStatus; labelKey: string; tint: string }[] = [
  { status: "todo", labelKey: "elev.plans.col.todo", tint: "var(--arbor-muted)" },
  { status: "doing", labelKey: "elev.plans.col.doing", tint: "var(--arbor-peach-ink)" },
  { status: "done", labelKey: "elev.plans.col.done", tint: "var(--arbor-green-ink)" },
];

/** TJB-16: one tap moves a step on by one status, and wraps. The board's
 *  primary move used to require a 4 px drag, which no phone parent can do. */
export const NEXT_STATUS: Record<StepStatus, StepStatus> = { todo: "doing", doing: "done", done: "todo" };

const STATUS_GLYPH: Record<StepStatus, typeof Circle> = {
  todo: Circle,
  doing: CircleDot,
  done: CircleCheckBig,
};

function deriveStatus(step: { completed: boolean; status?: StepStatus }): StepStatus {
  return step.status || (step.completed ? "done" : "todo");
}

function daysActive(planId: string): number | null {
  const m = /(\d{10,})/.exec(planId);
  if (!m) return null;
  const ms = Number(m[1]);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor((Date.now() - ms) / 86_400_000));
}

function StepCard({ item, onEdit }: { item: Item; onEdit: (item: Item) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  const { setPlanStepStatus } = useArbor();
  const { t } = useLanguage();
  const planId = item.id.split("::")[0];
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const Glyph = STATUS_GLYPH[item.status];
  const statusLabel = t(COLUMNS.find((c) => c.status === item.status)!.labelKey);
  return (
    <div
      ref={setNodeRef}
      style={{ ...style, background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
      className={`rounded-xl p-2 text-[11px] flex items-center gap-1.5 ${isDragging ? "opacity-60 ring-1 ring-[var(--arbor-clay)]/50" : ""}`}
    >
      {/* The primary move. 44 px, always visible, cycles on tap; the drag
          handle beside it stays as a desktop enhancement. */}
      <button
        type="button"
        onClick={() => setPlanStepStatus(planId, item.phaseIdx, item.stepIdx, NEXT_STATUS[item.status])}
        className="touch-target inline-flex items-center justify-center rounded-xl flex-shrink-0"
        style={{ minWidth: "var(--touch-min)", minHeight: "var(--touch-min)", color: item.status === "done" ? "var(--arbor-green-ink)" : "var(--arbor-clay)" }}
        aria-label={t("elev.plans.step.advance", { step: item.text, status: statusLabel })}
        data-step-status={item.status}
      >
        <Glyph className="w-5 h-5" />
      </button>
      <span className="flex-1" style={item.status === "done" ? { textDecoration: "line-through", color: "var(--arbor-muted)" } : undefined}>{item.text}</span>
      <button
        type="button"
        onClick={() => onEdit(item)}
        aria-label={t("aria.editStep")}
        className="touch-target inline-flex items-center justify-center rounded-xl flex-shrink-0"
        style={{ minWidth: "var(--touch-min)", minHeight: "var(--touch-min)", color: "var(--arbor-muted)" }}
      >
        <Pencil className="w-4 h-4" />
      </button>
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing hidden md:inline-flex flex-shrink-0" style={{ color: "var(--arbor-muted)" }} aria-label={t("aria.dragStep")}>
        <GripVertical className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function Column({ planId, status, label, tint, items, onEdit }: { planId: string; status: StepStatus; label: string; tint: string; items: Item[]; onEdit: (item: Item) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col::${planId}::${status}` });
  return (
    <div ref={setNodeRef} className="flex-1 min-w-0 rounded-2xl p-3 space-y-2 transition" style={{ background: "var(--arbor-paper-deep)", border: isOver ? "1px solid var(--arbor-green-ink)" : "1px solid var(--arbor-rule)" }}>
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: tint }}>{label}</span>
        <span className="text-[10px]" style={{ color: "var(--arbor-muted)" }}>{items.length}</span>
      </div>
      <div className="space-y-2 min-h-[40px]">
        {items.map((it) => (
          <React.Fragment key={it.id}>
            <StepCard item={it} onEdit={onEdit} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export default function PlanKanban({ plan }: { plan: ActionPlan }) {
  const { setPlanStepStatus, deletePlan, updatePlanStepText } = useArbor();
  const { t } = useLanguage();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [editing, setEditing] = useState<Item | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    plan.phases.forEach((ph, phaseIdx) =>
      ph.steps.forEach((st, stepIdx) =>
        out.push({ id: `${plan.id}::${phaseIdx}::${stepIdx}`, phaseIdx, stepIdx, text: st.text, status: deriveStatus(st), phaseName: ph.name })
      )
    );
    return out;
  }, [plan]);

  const total = items.length;
  const done = items.filter((i) => i.status === "done").length;
  const days = daysActive(plan.id);

  const openEdit = (item: Item) => { setEditing(item); setDraft(item.text); };
  const saveEdit = () => {
    if (editing && draft.trim()) updatePlanStepText(plan.id, editing.phaseIdx, editing.stepIdx, draft.trim());
    setEditing(null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const [planId, phaseStr, stepStr] = String(e.active.id).split("::");
    const overParts = String(e.over.id).split("::");
    if (overParts[0] !== "col" || overParts[1] !== planId) return;
    const status = overParts[2] as StepStatus;
    setPlanStepStatus(planId, Number(phaseStr), Number(stepStr), status);
  };

  return (
    <div className="rounded-3xl p-6 space-y-5" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-sm)" }}>
      <div className="flex justify-between items-start pb-4 gap-4" style={{ borderBottom: "1px solid var(--arbor-rule)" }}>
        <div>
          <h3 className="text-xl font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{plan.title}</h3>
          <p className="text-xs mt-1" style={{ color: "var(--arbor-muted)" }}>{t("elev.plans.focusIssue", { issue: plan.issue })}</p>
          {days !== null && <p className="text-[10px] mt-1" style={{ color: "var(--arbor-muted)" }}>{t("elev.plans.daysActive", { n: days })}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* TJB-16: the 43 % ring is gone. A plan the parent is running is
              reported as a count of steps done, never a completion share. */}
          <span className="text-[11px] font-bold" style={{ color: "var(--arbor-green-ink)" }}>
            {t("plan.stepsCount", { done, total })}
          </span>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label={t("aria.deletePlan")}
            className="touch-target inline-flex items-center justify-center rounded-xl self-start"
            style={{ minWidth: "var(--touch-min)", minHeight: "var(--touch-min)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex flex-col md:flex-row gap-3">
          {COLUMNS.map((col) => (
            <React.Fragment key={col.status}>
              <Column
                planId={plan.id}
                status={col.status}
                label={t(col.labelKey)}
                tint={col.tint}
                items={items.filter((i) => i.status === col.status)}
                onEdit={openEdit}
              />
            </React.Fragment>
          ))}
        </div>
      </DndContext>

      <p className="text-[10px]" style={{ color: "var(--arbor-muted)" }}>{t("elev.plans.hint")}</p>

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
            className="touch-target flex-1 rounded-xl text-[13px] font-bold"
            style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)", minHeight: "var(--touch-min)" }}
          >
            {t("elev.plans.edit.save")}
          </button>
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="touch-target rounded-xl px-4 text-[13px] font-bold"
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
            className="touch-target flex-1 rounded-xl text-[13px] font-bold"
            style={{ background: "var(--arbor-peach-ink)", color: "var(--arbor-on-accent)", minHeight: "var(--touch-min)" }}
          >
            {t("elev.plans.delete.cta")}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="touch-target rounded-xl px-4 text-[13px] font-bold"
            style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)", minHeight: "var(--touch-min)" }}
          >
            {t("elev.plans.edit.cancel")}
          </button>
        </div>
      </Modal>
    </div>
  );
}
