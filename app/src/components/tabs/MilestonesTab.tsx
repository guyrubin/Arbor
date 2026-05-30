import React from "react";
import { motion } from "motion/react";
import { Check, Sparkles, RefreshCw, Brain, AlertTriangle } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { MarkdownBlock } from "../ui/MarkdownBlock";
import framework from "../../framework.json";

export default function MilestonesTab() {
  const {
    milestones,
    handleToggleMilestone,
    checkedMilestones,
    totalMilestones,
    milestonesPercent,
    handleGenerateMilestoneScaffold,
    isAnalyzingMilestones,
    milestoneAnalysisOfGaps,
    setChatInput,
    setSelectedLens,
    setActiveTab,
  } = useArbor();

  const domainOptions = framework.domains;

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Developmental Milestones Checklist</h2>
          <p className="text-sm text-[#a8a093] mt-1">Check completed child milestones under different chronological age tiers.</p>
        </div>
        <div className="bg-[#141821] border border-white/10 p-4 rounded-2xl text-center">
          <span className="text-[10px] uppercase font-black tracking-wider text-[#a8a093]">Total Mastery</span>
          <div className="text-2xl font-black text-[#f4d991]">{checkedMilestones} / {totalMilestones}</div>
        </div>
      </div>

      <div className="w-full bg-[#141821] border border-white/10 rounded-2xl p-4 space-y-2">
        <div className="flex justify-between text-xs text-gray-300">
          <span>Development Readiness (Active Domain Score Archive)</span>
          <span className="font-bold">{milestonesPercent}% Complete</span>
        </div>
        <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden">
          <div className="bg-[#d7aa55] h-full transition-all duration-500" style={{ width: `${milestonesPercent}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
        {domainOptions.map((dom, domIdx) => {
          const itemsInDom = milestones.filter((m) => m.domain === dom.id);
          return (
            <div key={domIdx} className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-extrabold text-[#f4d991] flex items-center gap-2">
                <span className="p-1.5 bg-[#d7aa55]/10 rounded-lg text-[#f4d991] flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </span>
                {dom.label} Domain Checklist
              </h3>

              <div className="space-y-2">
                {itemsInDom.map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer ${
                      item.checked
                        ? "bg-white/[0.02] border-[#d7aa55]/30 text-[#f7f1e7]"
                        : "bg-white/[0.005] border-white/5 text-gray-400 hover:border-white/15"
                    }`}
                  >
                    <input type="checkbox" checked={item.checked} onChange={() => handleToggleMilestone(item.id)} className="mt-1 accent-[#d7aa55]" />
                    <div className="space-y-0.5">
                      <span className={`font-bold block ${item.checked ? "line-through text-gray-500" : "text-white"}`}>
                        {item.title}
                      </span>
                      <span className="text-[10px] block leading-relaxed text-[#a8a093]">{item.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive AI scaffolding gap analyzer */}
      <div className="bg-gradient-to-br from-[#d7aa55]/5 to-transparent border border-[#d7aa55]/20 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-base font-extrabold text-[#f7f1e7] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#d7aa55]" />
              Vygotskian AI Scaffolding Analyzer
            </h4>
            <p className="text-xs text-[#a8a093] mt-0.5">Maps active gaps dynamically based on Dylan&apos;s checked/unchecked milestones list.</p>
          </div>
          <button
            type="button"
            onClick={handleGenerateMilestoneScaffold}
            disabled={isAnalyzingMilestones}
            className="bg-[#d7aa55] hover:bg-[#c39947] disabled:bg-white/5 text-black text-xs font-black px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ml-auto sm:ml-0"
          >
            {isAnalyzingMilestones ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" /> Analyzing Gaps...
              </>
            ) : (
              <>
                <Brain className="w-3.5 h-3.5 text-black" /> Run AI Gap Review
              </>
            )}
          </button>
        </div>

        {milestoneAnalysisOfGaps ? (
          <div className="p-4 bg-[#08090c]/40 border border-[#d7aa55]/15 rounded-xl text-xs leading-relaxed text-gray-300 space-y-3 shadow-inner select-text">
            <MarkdownBlock text={milestoneAnalysisOfGaps} className="space-y-2" />
            <div className="pt-2.5 border-t border-white/5 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setChatInput(`Regarding Dylan's scaffolding gap analysis on milestones:\n\n${milestoneAnalysisOfGaps}\n\nHow do we evaluate his sensory resilience relative to these milestone hurdles?`);
                  setSelectedLens("Vygotsky's Scaffolding");
                  setActiveTab("coach");
                }}
                className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition flex items-center gap-1"
              >
                Adjust Scaffolding in Coach Chat ➔
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl text-center text-xs text-gray-500">
            Click "Run AI Gap Review" above to map Dylan&apos;s progress and formulate custom, co-active routine play exercises.
          </div>
        )}
      </div>

      <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-4 text-xs text-[#f4d991]">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" />
        <div className="space-y-1 leading-relaxed">
          <strong className="text-white text-sm block">System Watch/Wait delay checklist check:</strong>
          <p className="text-[#a8a093]">
            Two key social and language-switching delay thresholds remain unchecked for target age (5-6). If Dylan fails to acquire verbal comfort code-switching between Hebrew and English within 3 months, consider running the visual dropoff routing, or hand school notes for evaluation.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
