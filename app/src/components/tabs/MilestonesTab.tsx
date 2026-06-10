import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { Check, Sparkles, RefreshCw, Brain, Eye, Plus, ExternalLink, PartyPopper, BookOpen, Trash2, Pencil } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { MarkdownBlock } from "../ui/MarkdownBlock";
import { ProgressRing } from "../ui/ProgressRing";
import { cardCls } from "../ui/kit";
import { authHeaders, getAiLanguage } from "../../lib/api";
import { DOMAIN_REFERENCES } from "../../lib/milestoneReferences";
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
    updateMilestoneTitle,
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
          message: `Briefly explain the developmental milestone "${item.title}" for a ${childProfile.age}-year-old. Cover: typical age range, what it looks like in everyday life, and 2 concrete ways a parent can support it. Non-diagnostic, warm, short. Use the headings ### Typical age, ### What it looks like, ### How to support.`,
          childProfile,
          scholarLens: "Integrated Balanced",
          language: getAiLanguage(),
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
          <span className="text-xs font-extrabold uppercase tracking-wider" style={{ color: "#1f8a5a" }}>My Child</span>
          <h2 className="text-2xl md:text-[2rem] font-extrabold leading-[1.12] mt-1" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>Development Snapshot</h2>
          <p className="text-sm mt-1.5 max-w-2xl" style={{ color: "var(--arbor-muted)" }}>Notice what you&apos;ve seen so far across developmental domains. This is a parent observation tracker — not a diagnostic score, and children develop at their own pace.</p>
        </div>
        <div className={`${cardCls} p-4 text-center`}>
          <span className="text-[10px] uppercase font-extrabold tracking-wider" style={{ color: "var(--arbor-muted)" }}>Observed so far</span>
          <div className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)", color: "#1f8a5a" }}>{checkedMilestones} <span className="text-lg font-bold" style={{ color: "var(--arbor-muted)" }}>of</span> {totalMilestones}</div>
          <span className="text-[9px] block mt-0.5" style={{ color: "var(--arbor-muted)" }}>A snapshot, not a score</span>
        </div>
      </div>

      {/* Domain filter tabs with progress rings */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveDomain("all")}
          className="px-4 py-2 rounded-xl text-xs font-bold transition"
          style={activeDomain === "all" ? { background: "#e4f4ec", color: "#1f8a5a", border: "1px solid rgba(52,178,119,0.30)" } : { background: "#fff", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
        >
          All · {milestonesPercent}%
        </button>
        {domainOptions.map((dom) => {
          const s = domainStats[dom.id] || { total: 0, checked: 0 };
          const pct = s.total ? Math.round((s.checked / s.total) * 100) : 0;
          const on = activeDomain === dom.id;
          return (
            <button
              key={dom.id}
              onClick={() => setActiveDomain(dom.id)}
              className="px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2"
              style={on ? { background: "#e4f4ec", color: "#1f8a5a", border: "1px solid rgba(52,178,119,0.30)" } : { background: "#fff", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
            >
              <ProgressRing value={pct} size={22} stroke={3} />
              {dom.label.split(" ")[0]}
              <span className="text-[10px]" style={{ color: "var(--arbor-muted)" }}>{s.checked}/{s.total}</span>
            </button>
          );
        })}
      </div>

      {/* Checklist domains */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
        {visibleDomains.map((dom) => {
          const itemsInDom = milestones.filter((m) => m.domain === dom.id);
          return (
            <div key={dom.id} className={`${cardCls} p-5 space-y-3`}>
              <h3 className="text-sm font-extrabold flex items-center gap-2" style={{ color: "#1f8a5a" }}>
                <span className="p-1.5 rounded-lg flex items-center justify-center" style={{ background: "#e4f4ec", color: "#1f8a5a" }}><Check className="w-4 h-4" /></span>
                {dom.label}
              </h3>

              <div className="space-y-2">
                {itemsInDom.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl transition"
                    style={item.checked ? { background: "var(--arbor-paper-deep)", border: "1px solid rgba(52,178,119,0.30)" } : { background: "#fff", border: "1px solid var(--arbor-rule)" }}
                  >
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" checked={item.checked} onChange={() => onToggle(item.id, item.checked)} className="mt-1" style={{ accentColor: "#34b277" }} />
                      <div className="space-y-0.5 flex-1">
                        <span className="font-bold block" style={{ color: item.checked ? "#1f8a5a" : "var(--arbor-ink)" }}>{item.title}</span>
                        <span className="text-[10px] block leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{item.description}</span>
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          {item.checked && <span className="text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ color: "#1f8a5a", background: "#e4f4ec" }}>Observed</span>}
                          {item.ageGroup && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: "var(--arbor-muted)", background: "var(--arbor-paper-deep)" }}>Age: {item.ageGroup}</span>}
                          {item.custom && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: "#cf6f37", background: "#fdeada" }}>Custom</span>}
                          {item.custom && (
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); const t = window.prompt("Rename milestone", item.title); if (t) updateMilestoneTitle(item.id, t); }}
                              aria-label="Rename custom milestone"
                              className="text-[9px] transition"
                              style={{ color: "var(--arbor-muted)" }}
                            >
                              <Pencil className="w-2.5 h-2.5" />
                            </button>
                          )}
                          {item.custom && (
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); if (window.confirm("Delete this custom milestone?")) deleteMilestone(item.id); }}
                              aria-label="Delete custom milestone"
                              className="text-[9px] transition"
                              style={{ color: "var(--arbor-muted)" }}
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          )}
                          {item.references?.map((r, i) => (
                            <a key={i} href={r.url} target="_blank" rel="noreferrer" className="text-[9px] font-bold flex items-center gap-0.5" style={{ color: "#2f7bbf" }}>
                              {r.label} <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ))}
                          {!item.custom && DOMAIN_REFERENCES[item.domain] && (
                            <a
                              href={DOMAIN_REFERENCES[item.domain].url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[9px] font-bold flex items-center gap-0.5"
                              style={{ color: "#2f7bbf" }}
                            >
                              {DOMAIN_REFERENCES[item.domain].label} <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); void explain(item); }}
                            disabled={explaining[item.id]}
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 transition"
                            style={{ color: "#1f8a5a", background: "#e4f4ec" }}
                          >
                            {explaining[item.id] ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <BookOpen className="w-2.5 h-2.5" />}
                            {explanations[item.id] ? "Hide" : "Explain"}
                          </button>
                        </div>
                      </div>
                      {item.checked && (
                        <button type="button" onClick={(e) => { e.preventDefault(); celebrate(); }} title="Celebrate" className="transition" style={{ color: "#cf6f37" }}>
                          <PartyPopper className="w-4 h-4" />
                        </button>
                      )}
                    </label>
                    <AnimatePresence initial={false}>
                      {explanations[item.id] && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="mt-2 p-3 rounded-xl text-[11px] leading-relaxed select-text" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
                            <MarkdownBlock text={explanations[item.id]} className="space-y-1.5" />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
                {itemsInDom.length === 0 && <p className="text-[10px] italic" style={{ color: "var(--arbor-muted)" }}>No milestones in this domain yet.</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add custom milestone */}
      <div className={`${cardCls} p-5`}>
        {!showAdd ? (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 text-sm font-bold transition" style={{ color: "#1f8a5a" }}>
            <Plus className="w-4 h-4" /> Add milestone
          </button>
        ) : (
          <form onSubmit={submitCustom} className="flex flex-col sm:flex-row gap-2 items-stretch">
            <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="New milestone…" className="flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
            <select value={newDomain} onChange={(e) => setNewDomain(e.target.value as DevelopmentalDomainId)} className="rounded-xl px-3 py-2 text-xs" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}>
              {domainOptions.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
            <button type="submit" className="text-white font-extrabold text-xs px-4 py-2 rounded-xl transition" style={{ background: "#34b277" }}>Add</button>
            <button type="button" onClick={() => setShowAdd(false)} className="text-xs px-2" style={{ color: "var(--arbor-muted)" }}>Cancel</button>
          </form>
        )}
      </div>

      {/* Interactive AI scaffolding gap analyzer */}
      <div className="rounded-2xl p-6 space-y-4" style={{ background: "linear-gradient(120deg,#eef6f1,#ece9fb)", border: "1px solid var(--arbor-rule)" }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-base font-extrabold flex items-center gap-1.5" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
              <Sparkles className="w-4 h-4" style={{ color: "#1f8a5a" }} /> Vygotskian AI Scaffolding Analyzer
            </h4>
            <p className="text-xs mt-0.5" style={{ color: "var(--arbor-muted)" }}>Maps supportive next steps from what you&apos;ve observed and not yet observed — a next-best-challenge view, never a deficit list.</p>
          </div>
          <button type="button" onClick={handleGenerateMilestoneScaffold} disabled={isAnalyzingMilestones} className="text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ml-auto sm:ml-0 disabled:opacity-60" style={{ background: "linear-gradient(135deg,#3cc081,#2a9c66)" }}>
            {isAnalyzingMilestones ? (<><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Analyzing Gaps...</>) : (<><Brain className="w-3.5 h-3.5" /> Run AI Gap Review</>)}
          </button>
        </div>

        {milestoneAnalysisOfGaps ? (
          <div className="p-4 rounded-xl text-xs leading-relaxed space-y-3 select-text bg-white" style={{ border: "1px solid var(--arbor-rule)" }}>
            <MarkdownBlock text={milestoneAnalysisOfGaps} className="space-y-2" />
            <div className="pt-2.5 flex justify-end" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
              <button type="button" onClick={() => { setChatInput(`Regarding the scaffolding gap analysis on milestones:\n\n${milestoneAnalysisOfGaps}\n\nHow do we evaluate sensory resilience relative to these milestone hurdles?`); setSelectedLens("Vygotsky's Scaffolding"); setActiveTab("coach"); }} className="text-[10px] font-bold transition flex items-center gap-1" style={{ color: "#1f8a5a" }}>
                Adjust Scaffolding in Coach Chat ➔
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl text-center text-xs bg-white" style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}>
            Click "Run AI Gap Review" above to map progress and formulate custom, co-active routine play exercises.
          </div>
        )}
      </div>

      <div className="p-5 rounded-2xl flex items-start gap-4 text-xs" style={{ background: "#fbf1d4" }}>
        <Eye className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#a9780f" }} />
        <div className="space-y-1 leading-relaxed">
          <strong className="text-sm block" style={{ color: "var(--arbor-ink)" }}>Gentle watch points</strong>
          <p style={{ color: "var(--arbor-muted)" }}>
            A few areas are still in the &ldquo;not seen yet&rdquo; column for this age — including comfort code-switching between {childProfile.languages.join(" and ") || "home and school languages"}. That&apos;s common and rarely a concern on its own. Keep noticing, keep playing, and revisit in a few weeks. If something feels persistent, or you&apos;d simply like reassurance, you can ask Arbor or share a development snapshot with your pediatrician or teacher.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
