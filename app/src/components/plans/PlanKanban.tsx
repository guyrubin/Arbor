import React, { useMemo } from "react";
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { GripVertical, Trash2, Pencil } from "lucide-react";
import { ProgressRing } from "../ui/ProgressRing";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { ActionPlan, StepStatus } from "../../types";

type Item = { id: string; phaseIdx: number; stepIdx: number; text: string; status: StepStatus; phaseName: string };

const COLUMNS: { status: StepStatus; label: string; tint: string }[] = [
  { status: "todo", label: "Not Started", tint: "text-[#69747f]" },
  { status: "doing", label: "In Progress", tint: "text-[var(--arbor-peach-ink)]" },
  { status: "done", label: "Completed", tint: "text-[var(--arbor-green-ink)]" },
];

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

function StepCard({ item }: { item: Item }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  const { updatePlanStepText } = useArbor();
  const { t } = useLanguage();
  const planId = item.id.split("::")[0];
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={{ ...style, background: "#fff", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
      className={`group rounded-xl p-2.5 text-[11px] flex items-start gap-2 ${isDragging ? "opacity-60 ring-1 ring-[var(--arbor-primary)]/50" : ""}`}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing mt-0.5" style={{ color: "var(--arbor-muted)" }} aria-label={t("aria.dragStep")}>
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <span className="flex-1" style={item.status === "done" ? { textDecoration: "line-through", color: "var(--arbor-muted)" } : undefined}>{item.text}</span>
      <button
        onClick={() => {
          const t = window.prompt("Edit step", item.text);
          if (t) updatePlanStepText(planId, item.phaseIdx, item.stepIdx, t);
        }}
        aria-label={t("aria.editStep")}
        className="opacity-0 group-hover:opacity-100 transition mt-0.5"
        style={{ color: "var(--arbor-muted)" }}
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  );
}

function Column({ planId, status, label, tint, items }: { planId: string; status: StepStatus; label: string; tint: string; items: Item[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col::${planId}::${status}` });
  return (
    <div ref={setNodeRef} className="flex-1 min-w-0 rounded-2xl p-3 space-y-2 transition" style={{ background: "var(--arbor-paper-deep)", border: isOver ? "1px solid rgba(52,178,119,0.50)" : "1px solid var(--arbor-rule)" }}>
      <div className="flex items-center justify-between px-1">
        <span className={`text-[10px] font-black uppercase tracking-widest ${tint}`}>{label}</span>
        <span className="text-[10px]" style={{ color: "var(--arbor-muted)" }}>{items.length}</span>
      </div>
      <div className="space-y-2 min-h-[40px]">
        {items.map((it) => (
          <React.Fragment key={it.id}>
            <StepCard item={it} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export default function PlanKanban({ plan }: { plan: ActionPlan }) {
  const { setPlanStepStatus, deletePlan } = useArbor();
  const { t } = useLanguage();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

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
  const pct = total ? Math.round((done / total) * 100) : 0;
  const days = daysActive(plan.id);

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const [planId, phaseStr, stepStr] = String(e.active.id).split("::");
    const overParts = String(e.over.id).split("::");
    if (overParts[0] !== "col" || overParts[1] !== planId) return;
    const status = overParts[2] as StepStatus;
    setPlanStepStatus(planId, Number(phaseStr), Number(stepStr), status);
  };

  return (
    <div className="bg-white rounded-3xl p-6 space-y-5" style={{ border: "1px solid var(--arbor-rule)", boxShadow: "0 2px 10px rgba(41,51,63,0.05)" }}>
      <div className="flex justify-between items-start pb-4 gap-4" style={{ borderBottom: "1px solid var(--arbor-rule)" }}>
        <div>
          <h3 className="text-xl font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{plan.title}</h3>
          <p className="text-xs mt-1 italic" style={{ color: "var(--arbor-muted)" }}>Focus Issue: {plan.issue}</p>
          {days !== null && <p className="text-[10px] mt-1" style={{ color: "var(--arbor-muted)" }}>{days} {days === 1 ? "day" : "days"} active</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <ProgressRing value={pct} size={56}>
            <span className="text-[11px] font-black" style={{ color: "var(--arbor-green-ink)" }}>{pct}%</span>
          </ProgressRing>
          <button
            onClick={() => { if (window.confirm(`Delete the plan "${plan.title}"?`)) deletePlan(plan.id); }}
            aria-label={t("aria.deletePlan")}
            className="p-1.5 rounded-lg transition self-start"
            style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}
          >
            <Trash2 className="w-3.5 h-3.5" />
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
                label={col.label}
                tint={col.tint}
                items={items.filter((i) => i.status === col.status)}
              />
            </React.Fragment>
          ))}
        </div>
      </DndContext>

      <p className="text-[10px]" style={{ color: "var(--arbor-muted)" }}>Drag steps between columns — completion saves automatically.</p>
    </div>
  );
}
