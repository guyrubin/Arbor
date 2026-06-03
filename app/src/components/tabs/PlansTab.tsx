import React from "react";
import { motion } from "motion/react";
import { RefreshCw, Sparkles, MessageSquare, Sliders } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { Skeleton } from "../ui/Skeleton";
import { EmptyState } from "../ui/EmptyState";
import PlanKanban from "../plans/PlanKanban";
import RoutinesCard from "../plans/RoutinesCard";

export default function PlansTab() {
  const {
    planChallengeTopic,
    setPlanChallengeTopic,
    handleGenerateActionPlan,
    isPlanGenerating,
    actionPlans,
    plansLoaded,
    setChatInput,
    setSelectedLens,
    setActiveTab,
  } = useArbor();

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight">Active Growth Plans</h2>
        <p className="text-sm text-[#a8a093] mt-1">Track multi-stage developmental plans as a board — drag steps from Not Started to Completed.</p>
      </div>

      <div className="bg-[#141821] border border-white/10 rounded-2xl p-6 space-y-4">
        <span className="text-xs font-bold text-[#f4d991] tracking-wider uppercase block">Weave Custom Child Action Blueprint</span>

        {/* Templates — start from a common challenge */}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] text-[#a8a093] font-bold self-center mr-1">Templates:</span>
          {[
            "Morning departure refusal and tantrums when leaving for school",
            "Screen-time shut-off meltdowns at night",
            "Sibling sharing conflicts and hitting",
            "Bedtime resistance and stalling",
            "Refusing new or non-preferred foods",
            "Separation anxiety at drop-off",
            "Build a responsibility ladder of age-appropriate chores and ownership",
            "School adaptation plan for a smooth transition into kindergarten",
            "Behavior reset plan to re-establish calm routines after a hard week",
          ].map((tpl) => (
            <button
              key={tpl}
              type="button"
              onClick={() => setPlanChallengeTopic(tpl)}
              className="bg-white/5 hover:bg-[#d7aa55]/15 hover:text-[#f4d991] text-[#a8a093] px-2.5 py-1 rounded-lg text-[10px] font-bold transition"
            >
              {tpl.split(" ").slice(0, 3).join(" ")}…
            </button>
          ))}
        </div>

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
            className="bg-[#d7aa55] hover:bg-[#c39947] disabled:bg-white/5 disabled:text-[#a8a093] text-black font-extrabold text-sm px-6 py-3.5 rounded-xl transition flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {isPlanGenerating ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Structuring guidelines...</>) : (<><Sparkles className="w-4 h-4" /> Generate AI Blueprint</>)}
          </button>
        </div>
      </div>

      <RoutinesCard />

      {!plansLoaded && (
        <div className="space-y-4"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
      )}
      {plansLoaded && actionPlans.length === 0 && (
        <EmptyState
          icon={<Sliders className="w-8 h-8" />}
          headline="No action plans yet"
          body="Describe a challenge above (or pick a template) and generate your first AI blueprint."
        />
      )}

      <div className="space-y-8">
        {actionPlans.map((plan) => (
          <div key={plan.id} className="space-y-3">
            <PlanKanban plan={plan} />

            <div className="bg-[#141821] border border-white/10 rounded-3xl p-6 space-y-5">
              <div className="space-y-3 bg-[#08090c] p-4 border border-white/5 rounded-2xl">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-200" /> Attachment Co-Regulation Parent Scripts
                </h4>
                <div className="space-y-3 text-xs">
                  {plan.scripts.map((sc, scIdx) => (
                    <div key={scIdx} className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-3 bg-white/[0.01] p-3 rounded-xl border border-white/5">
                      <div><strong className="text-[#f4d991] block">{sc.scenario}</strong></div>
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
                      setChatInput(`Regarding the Action Plan: "${plan.title}". Let's formulate two additional specific co-regulation dialogue scripts dealing with the child's preoperational language-switching triggers.`);
                      setSelectedLens("Bowlby's Attachment Model");
                      setActiveTab("coach");
                    }}
                    className="text-[10px] font-black uppercase tracking-wider text-[#f4d991] hover:text-white bg-[#d7aa55]/15 hover:bg-[#d7aa55]/25 border border-[#d7aa55]/25 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-[#d7aa55]" /> Refine these scripts with AI Coach ➔
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <span className="font-bold text-white block">Woven success completion flags:</span>
                <ul className="list-disc pl-5 text-[#a8a093] space-y-1 leading-relaxed">
                  {plan.successIndicators.map((sc, scIdx) => <li key={scIdx}>{sc}</li>)}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
