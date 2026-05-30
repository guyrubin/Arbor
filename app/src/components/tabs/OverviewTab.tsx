import React from "react";
import { motion } from "motion/react";
import { Brain, ChevronRight, AlertTriangle, Sparkles, Play } from "lucide-react";
import { useArbor } from "../../context/ArborContext";

export default function OverviewTab() {
  const {
    setActiveTab,
    actionPlans,
    milestonesPercent,
    childProfile,
    behaviorLogs,
    currentStory,
    setActiveStoryPage,
    setSelectedLens,
    setChatInput,
    handleTogglePlanStep,
  } = useArbor();

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
      {/* Giant Banner/Hero Block */}
      <div className="border border-white/10 rounded-3xl p-6 md:p-10 bg-gradient-to-br from-white/[0.08] to-white/[0.025] from-amber-500/[0.03] to-transparent bg-[#141821] shadow-xl relative overflow-hidden grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8 items-center">
        <div className="space-y-4 relative z-10">
          <span className="text-xs font-black uppercase tracking-wider text-[#f4d991]">Parenting Intelligence Cockpit</span>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
            Not a parenting chatbot.<br />A development intelligence operating system.
          </h2>
          <p className="text-sm md:text-base text-[#a8a093] leading-relaxed max-w-lg">
            Welcome back. Arbor turns today&apos;s parenting signal into a safety-aware plan, parent script, approved memory, and handoff note without diagnosing the child.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => setActiveTab("coach")}
              className="bg-[#d7aa55] hover:bg-[#c39947] text-black font-extrabold text-sm px-5 py-3 rounded-2xl transition shadow-lg shadow-[#d7aa55]/10 flex items-center gap-2"
            >
              <Brain className="w-4 h-4" /> Ask Parent Coach
            </button>
            <button
              onClick={() => setActiveTab("plans")}
              className="bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-sm px-5 py-3 rounded-2xl transition"
            >
              View Active Plans ({actionPlans.length})
            </button>
          </div>
        </div>

        {/* Handheld Live HUD preview */}
        <div className="bg-[#08090c] border border-white/15 rounded-[36px] p-5 shadow-2xl w-full max-w-[340px] mx-auto text-sm space-y-4">
          <div className="bg-gradient-to-br from-[#d7aa55]/20 to-transparent border border-[#d7aa55]/20 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[#f4d991]">Dylan · Age 5</h3>
              <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold">Stable</span>
            </div>
            <p className="text-[11px] text-gray-300 mt-1">Kindergarten readiness timeline</p>
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-3">
              <div className="bg-[#d7aa55] h-full" style={{ width: `${milestonesPercent}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white/[0.03] border border-white/5 p-2 rounded-xl text-center">
              <b className="block text-lg font-black text-white">{milestonesPercent}%</b>
              <span className="text-[9px] text-[#a8a093] tracking-wide uppercase">Readiness Score</span>
            </div>
            <div className="bg-white/[0.03] border border-white/5 p-2 rounded-xl text-center">
              <b className="block text-lg font-black text-white">{actionPlans.length}</b>
              <span className="text-[9px] text-[#a8a093] tracking-wide uppercase">Active Plans</span>
            </div>
            <div className="bg-white/[0.03] border border-white/5 p-2 rounded-xl text-center">
              <b className="block text-lg font-black text-white">{childProfile.riskLevel}</b>
              <span className="text-[9px] text-[#a8a093] tracking-wide uppercase">Safety Tier</span>
            </div>
            <div className="bg-white/[0.03] border border-white/5 p-2 rounded-xl text-center">
              <b className="block text-lg font-black text-white">8m</b>
              <span className="text-[9px] text-[#a8a093] tracking-wide uppercase">Story Readtime</span>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 p-3 rounded-2xl space-y-1">
            <span className="text-[9px] font-black uppercase text-[#f4d991] tracking-wider block">Co-Regulation Script</span>
            <p className="text-xs text-gray-200">“You are upset. The rule remains. We try again together.”</p>
          </div>
        </div>
      </div>

      {/* Sub cockpit panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#141821] border border-white/10 p-6 rounded-3xl space-y-6">
          <div>
            <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider block">Behavior Time analysis</span>
            <h3 className="text-xl font-bold text-white mt-1">Longitudinal Insights Map</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-gray-300">
              <span>Total logged incidents: <b>{behaviorLogs.length} entries</b></span>
              <button onClick={() => setActiveTab("behaviors")} className="text-[#f4d991] hover:underline">
                Adjust logs +
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 h-16 items-end mt-4">
              {[
                { d: "Mon", h: "40%" },
                { d: "Tue", h: "80%" },
                { d: "Wed", h: "20%" },
                { d: "Thu", h: "60%" },
              ].map((bar) => (
                <div key={bar.d} className="bg-blue-500/10 rounded-lg p-2 flex flex-col items-center justify-end h-full">
                  <div className="bg-blue-500 w-full rounded-md" style={{ height: bar.h }}></div>
                  <span className="text-[9px] text-gray-400 mt-1">{bar.d}</span>
                </div>
              ))}
            </div>

            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-[#d7aa55]" />
                Attachment Co-Regulation Pattern:
              </span>
              <p className="text-xs text-[#a8a093] leading-relaxed">
                Transition refusal on morning departure accounts for 75% of high-intensity outbursts this week. Note: Dylan calming duration falls from 25 mins to 10 mins when presented with controlled boundaries and a dual-language school prep card.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[#141821] border border-white/10 p-6 rounded-3xl flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider block">In-Progress Strategy</span>
              <h3 className="text-xl font-bold text-white mt-1">Action Plan Practice</h3>
            </div>

            {actionPlans.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#f4d991]">{actionPlans[0].title}</span>
                  <span className="text-[10px] bg-amber-500/15 text-[#f4d991] px-2 py-0.5 rounded-full font-bold">Active Plan</span>
                </div>
                <p className="text-xs text-gray-400">{actionPlans[0].issue}</p>

                <div className="space-y-2 mt-2">
                  {actionPlans[0].phases[0].steps.map((st, i) => (
                    <label
                      key={i}
                      className="flex items-start gap-2.5 p-2 bg-white/[0.01] hover:bg-white/[0.04] transition rounded-xl cursor-copy text-xs text-gray-300"
                    >
                      <input
                        type="checkbox"
                        checked={st.completed}
                        onChange={() => handleTogglePlanStep(actionPlans[0].id, 0, i)}
                        className="mt-0.5 accent-[#d7aa55]"
                      />
                      <span className={st.completed ? "line-through text-gray-500" : ""}>{st.text}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setActiveTab("plans")}
            className="w-full py-3 bg-white/5 border border-white/10 hover:bg-white/10 transition font-bold text-xs rounded-2xl flex items-center justify-center gap-2"
          >
            Manage action worksheets <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bedtime Stories quick card */}
      <div className="bg-[#141821] border border-white/10 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-[#d7aa55]/10 rounded-2xl flex items-center justify-center text-3xl">📚</div>
          <div>
            <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider block">Co-Regulated Story Teller</span>
            <h3 className="text-xl font-extrabold text-white mt-0.5">{currentStory.title}</h3>
            <p className="text-xs text-[#a8a093] leading-relaxed mt-1 max-w-md">{currentStory.summary}</p>
          </div>
        </div>
        <button
          onClick={() => {
            setActiveStoryPage(0);
            setActiveTab("stories");
          }}
          className="bg-[#d7aa55] hover:bg-[#c39947] text-black font-extrabold text-xs px-5 py-3.5 rounded-2xl transition shadow-lg shadow-[#d7aa55]/10 flex items-center gap-2 w-full md:w-auto justify-center"
        >
          Open Reading Book <Play className="w-3 px-0.5" />
        </button>
      </div>

      {/* Contextual Interactive AI Widget */}
      <div className="bg-gradient-to-br from-[#d7aa55]/5 to-transparent border border-[#d7aa55]/15 rounded-3xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#d7aa55]/10 text-[#f4d991] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[#d7aa55]" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-white flex items-center gap-1.5">
              Contextual AI Co-Regulation Guide
              <span className="animate-pulse w-2 h-2 rounded-full bg-emerald-400" />
            </h4>
            <p className="text-xs text-[#a8a093]">Generate prompt guidelines instantly tailored to Dylan's current developmental stage and active logs.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => {
              setSelectedLens("Bowlby's Attachment Model");
              setChatInput("Dylan screamed and threw toys. Give me an immediate relational rupture-repair script.");
              setActiveTab("coach");
            }}
            className="p-4 bg-white/[0.01] border border-white/5 hover:border-[#d7aa55]/30 hover:bg-[#d7aa55]/5 text-left rounded-2xl transition group focus:outline-none cursor-pointer"
          >
            <b className="text-xs text-[#f4d991] block group-hover:text-white transition">Rupture-Repair Script ➔</b>
            <p className="text-[10px] text-gray-400 mt-1 lines-clamp-2 leading-relaxed">Get an attachment-based script to soothe frustration and repair relational warmth.</p>
          </button>
          <button
            onClick={() => {
              setSelectedLens("Piaget's Cognitive Stages");
              setChatInput("Dylan is refusing transitions. Explain his mindset through Piaget's Preoperational cognitive perspective and suggest a boundary strategy.");
              setActiveTab("coach");
            }}
            className="p-4 bg-white/[0.01] border border-white/5 hover:border-[#d7aa55]/30 hover:bg-[#d7aa55]/5 text-left rounded-2xl transition group focus:outline-none cursor-pointer"
          >
            <b className="text-xs text-[#f4d991] block group-hover:text-white transition">Piaget Mindset Scaffold ➔</b>
            <p className="text-[10px] text-gray-400 mt-1 lines-clamp-2 leading-relaxed">Translate preschool self-centered cognitive schema into calm transition boundaries.</p>
          </button>
          <button
            onClick={() => {
              setSelectedLens("Vygotsky's Scaffolding");
              setChatInput("Dylan is learning bilingual English/Hebrew co-regulation phrases. Give me a 10-minute game to build code-switching confidence.");
              setActiveTab("coach");
            }}
            className="p-4 bg-white/[0.01] border border-white/5 hover:border-[#d7aa55]/30 hover:bg-[#d7aa55]/5 text-left rounded-2xl transition group focus:outline-none cursor-pointer"
          >
            <b className="text-xs text-[#f4d991] block group-hover:text-white transition">Bilingual Scaffolding ➔</b>
            <p className="text-[10px] text-gray-400 mt-1 lines-clamp-2 leading-relaxed">Construct parent guidance words to scaffold shifting between English and Hebrew transitions.</p>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
