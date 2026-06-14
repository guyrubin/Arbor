import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { Check, Sparkles, RefreshCw, Brain, Eye, Plus, ExternalLink, PartyPopper, BookOpen, Trash2, Pencil } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
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
    colors: ["#34b277", "#5fce97", "#d9763f", "#3f8cc9"],
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

  const { t } = useLanguage();
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
          <h2 className="text-2xl md:text-[2rem] leading-[1.1]" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("ms.title")}</h2>
          <p className="text-sm mt-1.5 max-w-2xl" style={{ color: "var(--arbor-muted)" }}>{t("ms.subtitle")}</p>
        </div>
        <div className={`${cardCls} p-4 text-center`}>
          <span className="text-[10px] uppercase font-extrabold tracking-wider" style={{ color: "var(--arbor-muted)" }}>{t("ms.observedSoFar")}</span>
          <div className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-green-ink)" }}>{checkedMilestones} <span className="text-lg font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ms.of")}</span> {totalMilestones}</div>
          <span className="text-[9px] block mt-0.5" style={{ color: "var(--arbor-muted)" }}>{t("ms.snapshotNotScore")}</span>
        </div>
      </div>

      {/* Domain filter tabs with progress rings */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveDomain("all")}
          className="px-4 py-2 rounded-xl text-xs font-bold transition"
          style={activeDomain === "all" ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.30)" } : { background: "#fff", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
        >
          {t("ms.all")} · {milestonesPercent}%
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
              style={on ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.30)" } : { background: "#fff", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
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
              <h3 className="text-sm font-extrabold flex items-center gap-2" style={{ color: "var(--arbor-green-ink)" }}>
                <span className="p-1.5 rounded-lg flex items-center justify-center" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}><Check className="w-4 h-4" /></span>
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
                      <input type="checkbox" checked={item.checked} onChange={() => onToggle(item.id, item.checked)} className="mt-1" style={{ accentColor: "var(--arbor-clay)" }} />
                      <div className="space-y-0.5 flex-1">
                        <span className="font-bold block" style={{ color: item.checked ? "var(--arbor-green-ink)" : "var(--arbor-ink)" }}>{item.title}</span>
                        <span className="text-[10px] block leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{item.description}</span>
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          {item.checked && <span className="text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ color: "var(--arbor-green-ink)", background: "var(--arbor-green-soft)" }}>{t("ms.observed")}</span>}
                          {item.ageGroup && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: "var(--arbor-muted)", background: "var(--arbor-paper-deep)" }}>{t("ms.age")} {item.ageGroup}</span>}
                          {item.custom && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: "var(--arbor-peach-ink)", background: "var(--arbor-peach-soft)" }}>{t("ms.custom")}</span>}
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
                            <a key={i} href={r.url} target="_blank" rel="noreferrer" className="text-[9px] font-bold flex items-center gap-0.5" style={{ color: "var(--arbor-sky-ink)" }}>
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
                              style={{ color: "var(--arbor-sky-ink)" }}
                            >
                              {DOMAIN_REFERENCES[item.domain].label} <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); void explain(item); }}
                            disabled={explaining[item.id]}
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 transition"
                            style={{ color: "var(--arbor-green-ink)", background: "var(--arbor-green-soft)" }}
                          >
                            {explaining[item.id] ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <BookOpen className="w-2.5 h-2.5" />}
                            {explanations[item.id] ? t("ms.hide") : t("ms.explain")}
                          </button>
                        </div>
                      </div>
                      {item.checked && (
                        <button type="button" onClick={(e) => { e.preventDefault(); celebrate(); }} title="Celebrate" className="transition" style={{ color: "var(--arbor-peach-ink)" }}>
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
                {itemsInDom.length === 0 && <p className="text-[10px] italic" style={{ color: "var(--arbor-muted)" }}>{t("ms.noMilestones")}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add custom milestone */}
      <div className={`${cardCls} p-5`}>
        {!showAdd ? (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 text-sm font-bold transition" style={{ color: "var(--arbor-green-ink)" }}>
            <Plus className="w-4 h-4" /> {t("ms.addMilestone")}
          </button>
        ) : (
          <form onSubmit={submitCustom} className="flex flex-col sm:flex-row gap-2 items-stretch">
            <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t("ms.newPlaceholder")} className="flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
            <select value={newDomain} onChange={(e) => setNewDomain(e.target.value as DevelopmentalDomainId)} className="rounded-xl px-3 py-2 text-xs" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}>
              {domainOptions.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
            <button type="submit" className="text-white font-extrabold text-xs px-4 py-2 rounded-xl transition" style={{ background: "var(--arbor-clay)" }}>{t("ms.add")}</button>
            <button type="button" onClick={() => setShowAdd(false)} className="text-xs px-2" style={{ color: "var(--arbor-muted)" }}>{t("ms.cancel")}</button>
          </form>
        )}
      </div>

      {/* Interactive AI scaffolding gap analyzer */}
      <div className="rounded-2xl p-6 space-y-4" style={{ background: "linear-gradient(120deg,#eef6f1,var(--arbor-lav-soft))", border: "1px solid var(--arbor-rule)" }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-base font-extrabold flex items-center gap-1.5" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
              <Sparkles className="w-4 h-4" style={{ color: "var(--arbor-green-ink)" }} /> {t("ms.nurtureNext")}
            </h4>
            <p className="text-xs mt-0.5" style={{ color: "var(--arbor-muted)" }}>{t("ms.nurtureDesc")}</p>
          </div>
          <button type="button" onClick={handleGenerateMilestoneScaffold} disabled={isAnalyzingMilestones} className="text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ml-auto sm:ml-0 disabled:opacity-60" style={{ background: "linear-gradient(135deg,#3cc081,var(--arbor-clay-deep))" }}>
            {isAnalyzingMilestones ? (<><RefreshCw className="w-3.5 h-3.5 animate-spin" /> {t("ms.findingSteps")}</>) : (<><Brain className="w-3.5 h-3.5" /> {t("ms.findSteps")}</>)}
          </button>
        </div>

        {milestoneAnalysisOfGaps ? (
          <div className="p-4 rounded-xl text-xs leading-relaxed space-y-3 select-text bg-white" style={{ border: "1px solid var(--arbor-rule)" }}>
            <MarkdownBlock text={milestoneAnalysisOfGaps} className="space-y-2" />
            <div className="pt-2.5 flex justify-end" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
              <button type="button" onClick={() => { setChatInput(`Regarding the scaffolding gap analysis on milestones:\n\n${milestoneAnalysisOfGaps}\n\nHow do we evaluate sensory resilience relative to these milestone hurdles?`); setSelectedLens("Vygotsky's Scaffolding"); setActiveTab("coach"); }} className="text-[10px] font-bold transition flex items-center gap-1" style={{ color: "var(--arbor-green-ink)" }}>
                {t("ms.discussCoach")}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl text-center text-xs bg-white" style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}>
            {t("ms.runHint")}
          </div>
        )}
      </div>

      <div className="p-5 rounded-2xl flex items-start gap-4 text-xs" style={{ background: "var(--arbor-yellow-soft)" }}>
        <Eye className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "var(--arbor-yellow-ink)" }} />
        <div className="space-y-1 leading-relaxed">
          <strong className="text-sm block" style={{ color: "var(--arbor-ink)" }}>{t("ms.watchPoints")}</strong>
          <p style={{ color: "var(--arbor-muted)" }}>
            A few areas are still in the &ldquo;not seen yet&rdquo; column for this age — including comfort code-switching between {childProfile.languages.join(" and ") || "home and school languages"}. That&apos;s common and rarely a concern on its own. Keep noticing, keep playing, and revisit in a few weeks. If something feels persistent, or you&apos;d simply like reassurance, you can ask Arbor or share a development snapshot with your pediatrician or teacher.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
