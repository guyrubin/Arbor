import React, { useMemo } from "react";
import { motion } from "motion/react";
import { RefreshCw, Sparkles, MessageSquare, Sliders, ListChecks, CheckCircle2 } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { Skeleton } from "../ui/Skeleton";
import { EmptyState } from "../ui/EmptyState";
import { PageHeader, cardCls } from "../ui/kit";
import PlanKanban from "../plans/PlanKanban";
import RoutinesCard from "../plans/RoutinesCard";
import { planProgress, suggestedChallenges } from "../../lib/plans";

export default function PlansTab() {
  const {
    childProfile,
    behaviorLogs,
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
  const { t } = useLanguage();
  const first = childProfile.name.split(" ")[0];

  // Closed loop: plan topics suggested from {name}'s own recent logged behavior.
  const suggestions = useMemo(
    () => suggestedChallenges(behaviorLogs, new Date().toISOString().slice(0, 10)),
    [behaviorLogs]
  );

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
      <PageHeader
        eyebrow="Growth Plans"
        title={t("plan.title")}
        subtitle={t("plan.subtitle")}
      />

      <div className={`${cardCls} p-6 space-y-4`}>
        <span className="text-xs font-extrabold tracking-wider uppercase block" style={{ color: "var(--arbor-green-ink)" }}>{t("plan.create")}</span>

        {/* Templates — start from a common challenge */}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] font-bold self-center mr-1" style={{ color: "var(--arbor-muted)" }}>{t("plan.templates")}</span>
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
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition"
              style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}
            >
              {tpl.split(" ").slice(0, 3).join(" ")}…
            </button>
          ))}
        </div>

        {/* Data-driven: suggestions from {name}'s recent logged behavior */}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] font-bold self-center mr-1" style={{ color: "var(--arbor-green-ink)" }}>Suggested for {first}</span>
            {suggestions.map((s) => (
              <button
                key={s.topic}
                type="button"
                onClick={() => setPlanChallengeTopic(s.topic)}
                title={s.reason}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition inline-flex items-center gap-1.5"
                style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.30)" }}
              >
                <Sparkles className="w-3 h-3" /> {s.topic.split("—")[0].trim()}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={planChallengeTopic}
            onChange={(e) => setPlanChallengeTopic(e.target.value)}
            placeholder={t("plan.placeholder")}
            className="flex-1 rounded-xl px-4 py-3 text-sm focus:outline-none"
            style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
          />
          <button
            onClick={handleGenerateActionPlan}
            disabled={isPlanGenerating}
            className="text-white font-extrabold text-sm px-6 py-3.5 rounded-xl transition flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#3cc081,var(--arbor-clay) 60%,var(--arbor-clay-deep))" }}
          >
            {isPlanGenerating ? (<><RefreshCw className="w-4 h-4 animate-spin" /> {t("plan.creating")}</>) : (<><Sparkles className="w-4 h-4" /> {t("plan.createBtn")}</>)}
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
          headline={t("plan.empty.head")}
          body={t("plan.empty.body")}
        />
      )}

      <div className="space-y-8">
        {actionPlans.map((plan) => {
          const prog = planProgress(plan);
          return (
          <div key={plan.id} className="space-y-3">
            {/* Closed loop: where you are + what to focus on this week */}
            {prog.totalSteps > 0 && (
              <div className={`${cardCls} p-5`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-extrabold flex items-center gap-2" style={{ color: "var(--arbor-ink)" }}>
                    {prog.planComplete
                      ? <><CheckCircle2 className="w-4 h-4" style={{ color: "var(--arbor-green-ink)" }} /> Plan complete</>
                      : <><ListChecks className="w-4 h-4" style={{ color: "var(--arbor-green-ink)" }} /> Focus this week</>}
                  </p>
                  <span className="text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>{prog.doneSteps}/{prog.totalSteps} steps · {prog.pct}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: "var(--arbor-paper-deep)" }}>
                  <div className="h-full rounded-full" style={{ width: `${prog.pct}%`, background: "var(--arbor-clay)" }} />
                </div>
                {prog.planComplete ? (
                  <p className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>
                    Every step is done — nice work. Watch for the success signs below; if the challenge has shifted, start a fresh plan above.
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] mb-2" style={{ color: "var(--arbor-muted)" }}>
                      You&apos;re in <b style={{ color: "var(--arbor-ink)" }}>{prog.currentPhaseName || `phase ${prog.currentPhaseIndex + 1}`}</b> (phase {prog.currentPhaseIndex + 1} of {prog.totalPhases}). Next small steps:
                    </p>
                    <ul className="space-y-1.5">
                      {prog.nextSteps.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--arbor-ink)" }}>
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--arbor-clay)" }} />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            <PlanKanban plan={plan} />

            <div className={`${cardCls} p-6 space-y-5`}>
              <div className="space-y-3 p-4 rounded-2xl" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
                <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--arbor-ink)" }}>
                  <MessageSquare className="w-3.5 h-3.5" style={{ color: "var(--arbor-peach-ink)" }} /> {t("plan.whatToSay")}
                </h4>
                <div className="space-y-3 text-xs">
                  {plan.scripts.map((sc, scIdx) => (
                    <div key={scIdx} className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-3 p-3 rounded-xl bg-white" style={{ border: "1px solid var(--arbor-rule)" }}>
                      <div><strong className="block" style={{ color: "var(--arbor-green-ink)" }}>{sc.scenario}</strong></div>
                      <div className="space-y-1.5 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
                        <p><b style={{ color: "var(--arbor-ink)" }}>{t("plan.say")}</b> “{sc.say}”</p>
                        {sc.avoid && <p><b style={{ color: "var(--arbor-pink-ink)" }}>{t("plan.avoid")}</b> {sc.avoid}</p>}
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
                    style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
                  >
                    <Sparkles className="w-3 h-3" /> {t("plan.refine")}
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <span className="font-bold block" style={{ color: "var(--arbor-ink)" }}>{t("plan.signs")}</span>
                <ul className="list-disc pl-5 space-y-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
                  {plan.successIndicators.map((sc, scIdx) => <li key={scIdx}>{sc}</li>)}
                </ul>
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </motion.div>
  );
}
