import React, { useMemo } from "react";
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { ProgressRing } from "../ui/ProgressRing";
import { useArbor } from "../../context/ArborContext";
import { ActionPlan, StepStatus } from "../../types";

type Item = { id: string; phaseIdx: number; stepIdx: number; text: string; status: StepStatus; phaseName: string };

const COLUMNS: { status: StepStatus; label: string; tint: string }[] = [
  { status: "todo", label: "Not Started", tint: "text-[#a8a093]" },
  { status: "doing", label: "In Progress", tint: "text-[#f4d991]" },
  { status: "done", label: "Completed", tint: "text-emerald-400" },
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
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white/[0.03] border border-white/10 rounded-xl p-2.5 text-[11px] text-gray-200 flex items-start gap-2 ${isDragging ? "opacity-60 ring-1 ring-[#d7aa55]/50" : ""}`}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-[#a8a093] hover:text-white mt-0.5" aria-label="Drag step">
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <span className={item.status === "done" ? "line-through text-gray-500" : ""}>{item.text}</span>
    </div>
  );
}

function Column({ planId, status, label, tint, items }: { planId: string; status: StepStatus; label: string; tint: string; items: Item[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col::${planId}::${status}` });
  return (
    <div ref={setNodeRef} className={`flex-1 min-w-0 bg-[#08090c]/60 border rounded-2xl p-3 space-y-2 transition ${isOver ? "border-[#d7aa55]/50" : "border-white/5"}`}>
      <div className="flex items-center justify-between px-1">
        <span className={`text-[10px] font-black uppercase tracking-widest ${tint}`}>{label}</span>
        <span className="text-[10px] text-[#a8a093]">{items.length}</span>
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
  const { setPlanStepStatus } = useArbor();
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
    <div className="bg-[#141821] border border-white/10 rounded-3xl p-6 space-y-5">
      <div className="flex justify-between items-start border-b border-white/5 pb-4 gap-4">
        <div>
          <h3 className="text-xl font-black text-white">{plan.title}</h3>
          <p className="text-xs text-[#a8a093] mt-1 italic">Focus Issue: {plan.issue}</p>
          {days !== null && <p className="text-[10px] text-[#a8a093] mt-1">{days} {days === 1 ? "day" : "days"} active</p>}
        </div>
        <ProgressRing value={pct} size={56}>
          <span className="text-[11px] font-black text-[#f4d991]">{pct}%</span>
        </ProgressRing>
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

      <p className="text-[10px] text-[#a8a093]">Drag steps between columns — completion saves automatically.</p>
    </div>
  );
}
