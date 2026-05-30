import React from "react";
import { motion } from "motion/react";
import { RefreshCw, Sparkles, MessageSquare } from "lucide-react";
import { useArbor } from "../../context/ArborContext";

export default function PlansTab() {
  const {
    planChallengeTopic,
    setPlanChallengeTopic,
    handleGenerateActionPlan,
    isPlanGenerating,
    actionPlans,
    handleTogglePlanStep,
    setChatInput,
    setSelectedLens,
    setActiveTab,
  } = useArbor();

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight">Personalized Action Plans</h2>
        <p className="text-sm text-[#a8a093] mt-1">Generate multi-stage developmental action plans containing tasks, daily dialogue scripts, and progress thresholds.</p>
      </div>

      <div className="bg-[#141821] border border-white/10 rounded-2xl p-6 space-y-4">
        <span className="text-xs font-bold text-[#f4d991] tracking-wider uppercase block">Weave Custom Child Action Blueprint</span>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={planChallengeTopic}
            onChange={(e) => setPlanChallengeTopic(e.target.value)}
            placeholder="Describe behavioral dispute (e.g., throwing cutlery during dinner)..."
            className="flex-1 bg-[#08090c] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
          />
          <button
            onClick={handleGenerateActionPlan}
            disabled={isPlanGenerating}
            className="bg-[#d7aa55] hover:bg-[#c39947] disabled:bg-white/5 disabled:text-[#a8a093] text-black font-extrabold text-sm px-6 py-3.5 rounded-xl transition flex items-center justify-center gap-2"
          >
            {isPlanGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Structuring guidelines...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Generate AI Blueprint
              </>
            )}
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {actionPlans.map((plan) => (
          <div key={plan.id} className="bg-[#141821] border border-white/10 rounded-3xl p-6 space-y-6">
            <div className="flex justify-between items-start border-b border-white/5 pb-4">
              <div>
                <h3 className="text-xl font-black text-white">{plan.title}</h3>
                <p className="text-xs text-[#a8a093] mt-1 italic">Focus Issue: {plan.issue}</p>
              </div>
              <span className="text-[10px] bg-[#d7aa55]/15 text-[#f4d991] font-bold px-3 py-1 rounded-full border border-[#d7aa55]/20">
                Blueprints Frame
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
              {plan.phases.map((ph, phIdx) => (
                <div key={phIdx} className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div>
                      <span className="text-[9px] font-black uppercase text-[#f4d991] tracking-widest block">Phase {phIdx + 1}</span>
                      <strong className="text-white font-bold block mt-0.5">{ph.name}</strong>
                    </div>
                    <p className="text-gray-400 leading-relaxed text-[11px]">{ph.description}</p>

                    <div className="space-y-2 mt-3">
                      {ph.steps.map((st, stIdx) => (
                        <label key={stIdx} className="flex items-start gap-3 p-2 border border-white/5 bg-white/[0.015] hover:bg-white/[0.04] transition rounded-xl cursor-pointer">
                          <input type="checkbox" checked={st.completed} onChange={() => handleTogglePlanStep(plan.id, phIdx, stIdx)} className="mt-0.5 accent-[#d7aa55]" />
                          <span className={st.completed ? "line-through text-gray-500" : "text-gray-250"}>{st.text}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 bg-[#08090c] p-4 border border-white/5 rounded-2xl">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-amber-200" />
                Attachment Co-Regulation Parent Scripts
              </h4>
              <div className="space-y-3 text-xs">
                {plan.scripts.map((sc, scIdx) => (
                  <div key={scIdx} className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-3 bg-white/[0.01] p-3 rounded-xl border border-white/5">
                    <div>
                      <strong className="text-[#f4d991] block">{sc.scenario}</strong>
                    </div>
                    <div className="space-y-1.5 leading-relaxed text-[#a8a093]">
                      <p>🗣️ <b className="text-white">What to Say:</b> “{sc.say}”</p>
                      {sc.avoid && <p>❌ <b className="text-red-400">What to Avoid:</b> {sc.avoid}</p>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setChatInput(`Regarding the Action Plan: "${plan.title}". Let's formulate two additional specific co-regulation dialogue scripts dealing with Dylan's preoperational language-switching triggers.`);
                    setSelectedLens("Bowlby's Attachment Model");
                    setActiveTab("coach");
                  }}
                  className="text-[10px] font-black uppercase tracking-wider text-[#f4d991] hover:text-white bg-[#d7aa55]/15 hover:bg-[#d7aa55]/25 border border-[#d7aa55]/25 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-[#d7aa55]" />
                  Refine these scripts with AI Coach ➔
                </button>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <span className="font-bold text-white block">Woven success completion flags:</span>
              <ul className="list-disc pl-5 text-[#a8a093] space-y-1 leading-relaxed">
                {plan.successIndicators.map((sc, scIdx) => (
                  <li key={scIdx}>{sc}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
