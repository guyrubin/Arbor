import React from "react";
import { motion } from "motion/react";
import { RefreshCw, Sparkles, MessageSquare, Sliders } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { Skeleton } from "../ui/Skeleton";
import { EmptyState } from "../ui/EmptyState";
import { PageHeader, cardCls } from "../ui/kit";
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
      <PageHeader
        eyebrow="Growth Plans"
        title="Active Growth Plans"
        subtitle="Track multi-stage developmental plans as a board — drag steps from Not Started to Completed."
      />

      <div className={`${cardCls} p-6 space-y-4`}>
        <span className="text-xs font-extrabold tracking-wider uppercase block" style={{ color: "#1f8a5a" }}>Weave a custom child action blueprint</span>

        {/* Templates — start from a common challenge */}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] font-bold self-center mr-1" style={{ color: "var(--arbor-muted)" }}>Templates:</span>
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
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition"
              style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}
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
            className="flex-1 rounded-xl px-4 py-3 text-sm focus:outline-none"
            style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
          />
          <button
            onClick={handleGenerateActionPlan}
            disabled={isPlanGenerating}
            className="text-white font-extrabold text-sm px-6 py-3.5 rounded-xl transition flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#3cc081,#34b277 60%,#2a9c66)" }}
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

            <div className={`${cardCls} p-6 space-y-5`}>
              <div className="space-y-3 p-4 rounded-2xl" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
                <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--arbor-ink)" }}>
                  <MessageSquare className="w-3.5 h-3.5" style={{ color: "#cf6f37" }} /> Attachment co-regulation parent scripts
                </h4>
                <div className="space-y-3 text-xs">
                  {plan.scripts.map((sc, scIdx) => (
                    <div key={scIdx} className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-3 p-3 rounded-xl bg-white" style={{ border: "1px solid var(--arbor-rule)" }}>
                      <div><strong className="block" style={{ color: "#1f8a5a" }}>{sc.scenario}</strong></div>
                      <div className="space-y-1.5 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
                        <p>🗣️ <b style={{ color: "var(--arbor-ink)" }}>What to Say:</b> “{sc.say}”</p>
                        {sc.avoid && <p>❌ <b style={{ color: "#bd4f74" }}>What to Avoid:</b> {sc.avoid}</p>}
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
                    className="text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                    style={{ background: "#e4f4ec", color: "#1f8a5a" }}
                  >
                    <Sparkles className="w-3 h-3" /> Refine these scripts with AI Coach ➔
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <span className="font-bold block" style={{ color: "var(--arbor-ink)" }}>Woven success completion flags:</span>
                <ul className="list-disc pl-5 space-y-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
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
