import React, { useMemo, useState } from "react";
import { Target, Plus, Check, Trash2 } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { cardCls } from "../ui/kit";

type Goal = { id: string; title: string; achieved: boolean; createdAt: string };

/** Parent-set focus goals, tracked to "achieved". */
export default function GoalsCard() {
  const { childProfile } = useArbor();
  const { t } = useLanguage();
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
    <div className={`${cardCls} p-6 space-y-4`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--arbor-green-ink)" }}>
          <Target className="w-3.5 h-3.5" /> Focus goals
        </span>
        {goals.length > 0 && <span className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>{achievedCount}/{goals.length} achieved</span>}
      </div>

      <div className="space-y-2">
        {goals.map((g) => (
          <div key={g.id} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
            <button
              onClick={() => void goalsCol.upsert({ ...g, achieved: !g.achieved })}
              aria-label={g.achieved ? "Mark not achieved" : "Mark achieved"}
              className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition"
              style={g.achieved ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.40)" } : { border: "1px solid var(--arbor-rule-strong)", color: "transparent" }}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <span className="flex-1 text-sm" style={{ color: g.achieved ? "var(--arbor-muted)" : "var(--arbor-ink)", textDecoration: g.achieved ? "line-through" : "none" }}>{g.title}</span>
            <button onClick={() => void goalsCol.remove(g.id)} aria-label={t("aria.deleteGoal")} className="transition" style={{ color: "var(--arbor-muted)" }}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {goals.length === 0 && <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>Set a focus, like “calm morning departures,” and track it to achieved.</p>}
      </div>

      <form onSubmit={add} className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a focus goal…"
          className="flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none"
          style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
        />
        <button type="submit" className="text-white font-extrabold px-3 rounded-xl flex items-center" style={{ background: "var(--arbor-clay)" }}><Plus className="w-4 h-4" /></button>
      </form>
    </div>
  );
}
