import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { Check, Sparkles, RefreshCw, Brain, AlertTriangle, Plus, ExternalLink, PartyPopper, BookOpen, Trash2 } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { MarkdownBlock } from "../ui/MarkdownBlock";
import { ProgressRing } from "../ui/ProgressRing";
import { authHeaders, aiLanguageInstruction } from "../../lib/api";
import framework from "../../framework.json";
import { DevelopmentalDomainId, Milestone } from "../../types";

function celebrate() {
  confetti({
    particleCount: 90,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#d7aa55", "#f4d991", "#e2562d", "#6f9e6f"],
  });
}

export default function MilestonesTab() {
  const {
    milestones,
    handleToggleMilestone,
    addCustomMilestone,
    checkedMilestones,
    totalMilestones,
    milestonesPercent,
    handleGenerateMilestoneScaffold,
    isAnalyzingMilestones,
    milestoneAnalysisOfGaps,
    setChatInput,
    setSelectedLens,
    setActiveTab,
    childProfile,
    deleteMilestone,
  } = useArbor();

  const domainOptions = framework.domains;
  const [activeDomain, setActiveDomain] = useState<string>("all");
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [explaining, setExplaining] = useState<Record<string, boolean>>({});

  const explain = async (item: Milestone) => {
    if (explanations[item.id]) {
      setExplanations((p) => {
        const n = { ...p };
        delete n[item.id];
        return n;
      });
      return;
    }
    setExplaining((p) => ({ ...p, [item.id]: true }));
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          message: `Briefly explain the developmental milestone "${item.title}" for a ${childProfile.age}-year-old. Cover: typical age range, what it looks like in everyday life, and 2 concrete ways a parent can support it. Non-diagnostic, warm, short. Use the headings ### Typical age, ### What it looks like, ### How to support.` + aiLanguageInstruction(),
          childProfile,
          scholarLens: "Integrated Balanced",
        }),
      });
      if (!res.ok) throw new Error("fail");
      const data = await res.json();
      setExplanations((p) => ({ ...p, [item.id]: String(data.text || "") }));
    } catch {
      setExplanations((p) => ({ ...p, [item.id]: "### Unavailable\nCould not load guidance right now." }));
    } finally {
      setExplaining((p) => ({ ...p, [item.id]: false }));
    }
  };
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDomain, setNewDomain] = useState<DevelopmentalDomainId>(domainOptions[0].id as DevelopmentalDomainId);

  const domainStats = useMemo(() => {
    const map: Record<string, { total: number; checked: number }> = {};
    for (const dom of domainOptions) map[dom.id] = { total: 0, checked: 0 };
    for (const m of milestones) {
      if (!map[m.domain]) map[m.domain] = { total: 0, checked: 0 };
      map[m.domain].total += 1;
      if (m.checked) map[m.domain].checked += 1;
    }
    return map;
  }, [milestones, domainOptions]);

  const visibleDomains = activeDomain === "all" ? domainOptions : domainOptions.filter((d) => d.id === activeDomain);

  const onToggle = (id: string, wasChecked: boolean) => {
    handleToggleMilestone(id);
    if (!wasChecked) celebrate();
  };

  const submitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    addCustomMilestone(newTitle.trim(), newDomain);
    setNewTitle("");
    setShowAdd(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Developmental Milestones Checklist</h2>
          <p className="text-sm text-[#a8a093] mt-1">Track milestones by developmental domain. Celebrate each win.</p>
        </div>
        <div className="bg-[#141821] border border-white/10 p-4 rounded-2xl text-center">
          <span className="text-[10px] uppercase font-black tracking-wider text-[#a8a093]">Total Mastery</span>
          <div className="text-2xl font-black text-[#f4d991]">{checkedMilestones} / {totalMilestones}</div>
        </div>
      </div>

      {/* Domain filter tabs with progress rings */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveDomain("all")}
          className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${activeDomain === "all" ? "bg-[#d7aa55]/15 text-[#f4d991] border-[#d7aa55]/40" : "bg-white/[0.02] text-[#a8a093] border-white/5 hover:bg-white/5"}`}
        >
          All · {milestonesPercent}%
        </button>
        {domainOptions.map((dom) => {
          const s = domainStats[dom.id] || { total: 0, checked: 0 };
          const pct = s.total ? Math.round((s.checked / s.total) * 100) : 0;
          return (
            <button
              key={dom.id}
              onClick={() => setActiveDomain(dom.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-2 ${activeDomain === dom.id ? "bg-[#d7aa55]/15 text-[#f4d991] border-[#d7aa55]/40" : "bg-white/[0.02] text-[#a8a093] border-white/5 hover:bg-white/5"}`}
            >
              <ProgressRing value={pct} size={22} stroke={3} />
              {dom.label.split(" ")[0]}
              <span className="text-[10px] text-[#a8a093]">{s.checked}/{s.total}</span>
            </button>
          );
        })}
      </div>

      {/* Checklist domains */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
        {visibleDomains.map((dom) => {
          const itemsInDom = milestones.filter((m) => m.domain === dom.id);
          return (
            <div key={dom.id} className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-extrabold text-[#f4d991] flex items-center gap-2">
                <span className="p-1.5 bg-[#d7aa55]/10 rounded-lg text-[#f4d991] flex items-center justify-center"><Check className="w-4 h-4" /></span>
                {dom.label}
              </h3>

              <div className="space-y-2">
                {itemsInDom.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border transition ${item.checked ? "bg-white/[0.02] border-[#d7aa55]/30" : "bg-white/[0.005] border-white/5 hover:border-white/15"}`}
                  >
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" checked={item.checked} onChange={() => onToggle(item.id, item.checked)} className="mt-1 accent-[#d7aa55]" />
                      <div className="space-y-0.5 flex-1">
                        <span className={`font-bold block ${item.checked ? "line-through text-gray-500" : "text-white"}`}>{item.title}</span>
                        <span className="text-[10px] block leading-relaxed text-[#a8a093]">{item.description}</span>
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          {item.ageGroup && <span className="text-[9px] font-bold text-[#a8a093] bg-white/5 px-1.5 py-0.5 rounded">Age: {item.ageGroup}</span>}
                          {item.custom && <span className="text-[9px] font-bold text-[#f4d991] bg-[#d7aa55]/10 px-1.5 py-0.5 rounded">Custom</span>}
                          {item.custom && (
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); if (window.confirm("Delete this custom milestone?")) deleteMilestone(item.id); }}
                              aria-label="Delete custom milestone"
                              className="text-[9px] text-[#a8a093] hover:text-red-400 transition"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          )}
                          {item.references?.map((r, i) => (
                            <a key={i} href={r.url} target="_blank" rel="noreferrer" className="text-[9px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-0.5">
                              {r.label} <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ))}
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); void explain(item); }}
                            disabled={explaining[item.id]}
                            className="text-[9px] font-bold text-[#f4d991] hover:text-white bg-[#d7aa55]/10 hover:bg-[#d7aa55]/20 px-1.5 py-0.5 rounded flex items-center gap-1 transition"
                          >
                            {explaining[item.id] ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <BookOpen className="w-2.5 h-2.5" />}
                            {explanations[item.id] ? "Hide" : "Explain"}
                          </button>
                        </div>
                      </div>
                      {item.checked && (
                        <button type="button" onClick={(e) => { e.preventDefault(); celebrate(); }} title="Celebrate" className="text-[#f4d991] hover:text-white transition">
                          <PartyPopper className="w-4 h-4" />
                        </button>
                      )}
                    </label>
                    <AnimatePresence initial={false}>
                      {explanations[item.id] && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="mt-2 p-3 bg-[#08090c]/40 border border-[#d7aa55]/15 rounded-xl text-[11px] leading-relaxed select-text">
                            <MarkdownBlock text={explanations[item.id]} className="space-y-1.5" />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
                {itemsInDom.length === 0 && <p className="text-[10px] text-[#a8a093] italic">No milestones in this domain yet.</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add custom milestone */}
      <div className="bg-[#141821] border border-white/10 rounded-2xl p-5">
        {!showAdd ? (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 text-sm font-bold text-[#f4d991] hover:text-white transition">
            <Plus className="w-4 h-4" /> Add milestone
          </button>
        ) : (
          <form onSubmit={submitCustom} className="flex flex-col sm:flex-row gap-2 items-stretch">
            <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="New milestone…" className="flex-1 bg-[#08090c] border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#d7aa55]/50" />
            <select value={newDomain} onChange={(e) => setNewDomain(e.target.value as DevelopmentalDomainId)} className="bg-[#08090c] border border-white/10 rounded-xl px-3 py-2 text-white text-xs">
              {domainOptions.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
            <button type="submit" className="bg-[#d7aa55] hover:bg-[#c39947] text-black font-extrabold text-xs px-4 py-2 rounded-xl transition">Add</button>
            <button type="button" onClick={() => setShowAdd(false)} className="text-[#a8a093] hover:text-white text-xs px-2">Cancel</button>
          </form>
        )}
      </div>

      {/* Interactive AI scaffolding gap analyzer */}
      <div className="bg-gradient-to-br from-[#d7aa55]/5 to-transparent border border-[#d7aa55]/20 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-base font-extrabold text-[#f7f1e7] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#d7aa55]" /> Vygotskian AI Scaffolding Analyzer
            </h4>
            <p className="text-xs text-[#a8a093] mt-0.5">Maps active gaps dynamically based on the child&apos;s checked/unchecked milestones list.</p>
          </div>
          <button type="button" onClick={handleGenerateMilestoneScaffold} disabled={isAnalyzingMilestones} className="bg-[#d7aa55] hover:bg-[#c39947] disabled:bg-white/5 text-black text-xs font-black px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ml-auto sm:ml-0">
            {isAnalyzingMilestones ? (<><RefreshCw className="w-3.5 h-3.5 animate-spin text-black" /> Analyzing Gaps...</>) : (<><Brain className="w-3.5 h-3.5 text-black" /> Run AI Gap Review</>)}
          </button>
        </div>

        {milestoneAnalysisOfGaps ? (
          <div className="p-4 bg-[#08090c]/40 border border-[#d7aa55]/15 rounded-xl text-xs leading-relaxed text-gray-300 space-y-3 shadow-inner select-text">
            <MarkdownBlock text={milestoneAnalysisOfGaps} className="space-y-2" />
            <div className="pt-2.5 border-t border-white/5 flex justify-end">
              <button type="button" onClick={() => { setChatInput(`Regarding the scaffolding gap analysis on milestones:\n\n${milestoneAnalysisOfGaps}\n\nHow do we evaluate sensory resilience relative to these milestone hurdles?`); setSelectedLens("Vygotsky's Scaffolding"); setActiveTab("coach"); }} className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition flex items-center gap-1">
                Adjust Scaffolding in Coach Chat ➔
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl text-center text-xs text-gray-500">
            Click "Run AI Gap Review" above to map progress and formulate custom, co-active routine play exercises.
          </div>
        )}
      </div>

      <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-4 text-xs text-[#f4d991]">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" />
        <div className="space-y-1 leading-relaxed">
          <strong className="text-white text-sm block">System Watch/Wait delay checklist check:</strong>
          <p className="text-[#a8a093]">
            Two key social and language-switching delay thresholds remain unchecked for target age (5-6). If verbal comfort code-switching between Hebrew and English is not acquired within 3 months, consider running the visual dropoff routing, or hand school notes for evaluation.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
