import React, { useMemo, useState } from "react";
import { ListChecks, Plus, Check, Trash2, RotateCcw } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { cardCls } from "../ui/kit";

type Step = { text: string; done: boolean };
type Routine = { id: string; name: string; steps: Step[] };

/** Reusable co-regulation routines (e.g. morning, bedtime) as resettable checklists. */
export default function RoutinesCard() {
  const { childProfile } = useArbor();
  const col = useChildCollection<Routine>(childProfile.id, "routines");
  const routines = useMemo(() => [...col.items].sort((a, b) => (a.id < b.id ? -1 : 1)), [col.items]);
  const [newName, setNewName] = useState("");
  const [stepText, setStepText] = useState<Record<string, string>>({});

  const addRoutine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    void col.upsert({ id: `routine-${Date.now()}`, name: newName.trim(), steps: [] });
    setNewName("");
  };

  const addStep = (r: Routine) => {
    const t = (stepText[r.id] || "").trim();
    if (!t) return;
    void col.upsert({ ...r, steps: [...r.steps, { text: t, done: false }] });
    setStepText((s) => ({ ...s, [r.id]: "" }));
  };

  const toggle = (r: Routine, i: number) =>
    void col.upsert({ ...r, steps: r.steps.map((s, idx) => (idx === i ? { ...s, done: !s.done } : s)) });

  const reset = (r: Routine) => void col.upsert({ ...r, steps: r.steps.map((s) => ({ ...s, done: false })) });

  return (
    <div className={`${cardCls} p-6 space-y-4`}>
      <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--arbor-green-ink)" }}>
        <ListChecks className="w-3.5 h-3.5" /> Routines
      </span>

      {routines.length === 0 && <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>Build reusable routines like “Morning” or “Bedtime” with calm, predictable steps.</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {routines.map((r) => {
          const done = r.steps.filter((s) => s.done).length;
          return (
            <div key={r.id} className="rounded-xl p-3 space-y-2" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
              <div className="flex items-center justify-between">
                <strong className="text-sm" style={{ color: "var(--arbor-ink)" }}>{r.name}</strong>
                <div className="flex items-center gap-2">
                  <span className="text-[10px]" style={{ color: "var(--arbor-muted)" }}>{done}/{r.steps.length}</span>
                  <button onClick={() => reset(r)} aria-label="Reset routine" style={{ color: "var(--arbor-muted)" }}><RotateCcw className="w-3 h-3" /></button>
                  <button onClick={() => void col.remove(r.id)} aria-label="Delete routine" style={{ color: "var(--arbor-muted)" }}><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
              <div className="space-y-1">
                {r.steps.map((s, i) => (
                  <button key={i} onClick={() => toggle(r, i)} className="w-full flex items-center gap-2 text-start text-[11px]">
                    <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0" style={s.done ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.40)" } : { border: "1px solid var(--arbor-rule-strong)", color: "transparent" }}>
                      <Check className="w-3 h-3" />
                    </span>
                    <span style={{ color: s.done ? "var(--arbor-muted)" : "var(--arbor-ink)", textDecoration: s.done ? "line-through" : "none" }}>{s.text}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  value={stepText[r.id] || ""}
                  onChange={(e) => setStepText((s) => ({ ...s, [r.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStep(r))}
                  placeholder="Add a step…"
                  className="flex-1 rounded-lg px-2 py-1 text-[11px] focus:outline-none bg-white"
                  style={{ border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
                />
                <button onClick={() => addStep(r)} aria-label="Add step" style={{ color: "var(--arbor-green-ink)" }}><Plus className="w-4 h-4" /></button>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={addRoutine} className="flex gap-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New routine name…" className="flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
        <button type="submit" className="text-white font-extrabold px-3 rounded-xl flex items-center" style={{ background: "var(--arbor-clay)" }}><Plus className="w-4 h-4" /></button>
      </form>
    </div>
  );
}
