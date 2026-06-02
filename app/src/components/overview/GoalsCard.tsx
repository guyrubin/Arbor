import React, { useMemo, useState } from "react";
import { Target, Plus, Check, Trash2 } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useChildCollection } from "../../hooks/useChildCollection";

type Goal = { id: string; title: string; achieved: boolean; createdAt: string };

/** Parent-set focus goals, tracked to "achieved". */
export default function GoalsCard() {
  const { childProfile } = useArbor();
  const goalsCol = useChildCollection<Goal>(childProfile.id, "goals");
  const goals = useMemo(
    () => [...goalsCol.items].sort((a, b) => Number(a.achieved) - Number(b.achieved) || (a.createdAt < b.createdAt ? 1 : -1)),
    [goalsCol.items]
  );
  const [title, setTitle] = useState("");

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    void goalsCol.upsert({ id: `goal-${Date.now()}`, title: title.trim(), achieved: false, createdAt: new Date().toISOString() });
    setTitle("");
  };

  const achievedCount = goals.filter((g) => g.achieved).length;

  return (
    <div className="bg-[#141821] border border-white/10 rounded-3xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-[#d7aa55]" /> Focus goals
        </span>
        {goals.length > 0 && <span className="text-[11px] text-[#a8a093]">{achievedCount}/{goals.length} achieved</span>}
      </div>

      <div className="space-y-2">
        {goals.map((g) => (
          <div key={g.id} className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2">
            <button
              onClick={() => void goalsCol.upsert({ ...g, achieved: !g.achieved })}
              aria-label={g.achieved ? "Mark not achieved" : "Mark achieved"}
              className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border transition ${g.achieved ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "border-white/15 text-transparent hover:border-[#d7aa55]/40"}`}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <span className={`flex-1 text-sm ${g.achieved ? "line-through text-[#a8a093]" : "text-gray-200"}`}>{g.title}</span>
            <button onClick={() => void goalsCol.remove(g.id)} aria-label="Delete goal" className="text-[#a8a093] hover:text-red-400 transition">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {goals.length === 0 && <p className="text-xs text-[#a8a093]">Set a focus, like “calm morning departures,” and track it to achieved.</p>}
      </div>

      <form onSubmit={add} className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a focus goal…"
          className="flex-1 bg-[#08090c] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d7aa55]/50"
        />
        <button type="submit" className="bg-[#d7aa55] hover:bg-[#c39947] text-black font-extrabold px-3 rounded-xl flex items-center"><Plus className="w-4 h-4" /></button>
      </form>
    </div>
  );
}
