import React, { useMemo, useState } from "react";
import { ListChecks, Plus, Check, Trash2, RotateCcw } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useChildCollection } from "../../hooks/useChildCollection";

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
    <div className="bg-[#141821] border border-white/10 rounded-2xl p-6 space-y-4">
      <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider flex items-center gap-1.5">
        <ListChecks className="w-3.5 h-3.5 text-[#d7aa55]" /> Routines
      </span>

      {routines.length === 0 && <p className="text-xs text-[#a8a093]">Build reusable routines like “Morning” or “Bedtime” with calm, predictable steps.</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {routines.map((r) => {
          const done = r.steps.filter((s) => s.done).length;
          return (
            <div key={r.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <strong className="text-sm text-white">{r.name}</strong>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#a8a093]">{done}/{r.steps.length}</span>
                  <button onClick={() => reset(r)} aria-label="Reset routine" className="text-[#a8a093] hover:text-[#f4d991]"><RotateCcw className="w-3 h-3" /></button>
                  <button onClick={() => void col.remove(r.id)} aria-label="Delete routine" className="text-[#a8a093] hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
              <div className="space-y-1">
                {r.steps.map((s, i) => (
                  <button key={i} onClick={() => toggle(r, i)} className="w-full flex items-center gap-2 text-left text-[11px]">
                    <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${s.done ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "border-white/15 text-transparent"}`}>
                      <Check className="w-3 h-3" />
                    </span>
                    <span className={s.done ? "line-through text-[#a8a093]" : "text-gray-200"}>{s.text}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  value={stepText[r.id] || ""}
                  onChange={(e) => setStepText((s) => ({ ...s, [r.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStep(r))}
                  placeholder="Add a step…"
                  className="flex-1 bg-[#08090c] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-[#d7aa55]/50"
                />
                <button onClick={() => addStep(r)} aria-label="Add step" className="text-[#a8a093] hover:text-[#f4d991]"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={addRoutine} className="flex gap-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New routine name…" className="flex-1 bg-[#08090c] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d7aa55]/50" />
        <button type="submit" className="bg-[#d7aa55] hover:bg-[#c39947] text-black font-extrabold px-3 rounded-xl flex items-center"><Plus className="w-4 h-4" /></button>
      </form>
    </div>
  );
}
