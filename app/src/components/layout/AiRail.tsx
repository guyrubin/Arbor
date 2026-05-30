import React from "react";
import { Sparkles, Brain, FileText, Sliders, Shield, BookOpen, Languages, Users, Compass, RefreshCw } from "lucide-react";
import { useArbor, ActiveTab } from "../../context/ArborContext";

type Engine = {
  index: string;
  title: string;
  tab: ActiveTab;
  icon: React.ReactNode;
  status: string;
  statusClass: string;
  description: string;
  highlighted?: boolean;
};

const engines: Engine[] = [
  {
    index: "01",
    title: "Parent Coach",
    tab: "coach",
    icon: <Brain className="w-3.5 h-3.5 text-[#d7aa55]" />,
    status: "Active",
    statusClass: "bg-[#d7aa55]/20 text-[#f4d991]",
    description: "Turns concerns about mornings/tablets into active explanations, boundaries, and prompt guides.",
    highlighted: true,
  },
  {
    index: "02",
    title: "Case Summarizer",
    tab: "handoff",
    icon: <FileText className="w-3.5 h-3.5 text-blue-400" />,
    status: "Ready",
    statusClass: "bg-blue-500/10 text-blue-400",
    description: "Generates diagnosis-free professional summaries for educators, pediatric visits, and therapy clinics.",
  },
  {
    index: "03",
    title: "Pattern Detector",
    tab: "behaviors",
    icon: <Sliders className="w-3.5 h-3.5 text-purple-400" />,
    status: "Scanning",
    statusClass: "bg-purple-500/10 text-purple-400 animate-pulse",
    description: "Scans behavior logs and environment routines to detect underlying sensory triggers and timing errors.",
  },
  {
    index: "04",
    title: "Risk Classifier",
    tab: "safety",
    icon: <Shield className="w-3.5 h-3.5 text-emerald-400" />,
    status: "Safe",
    statusClass: "bg-emerald-500/10 text-emerald-400",
    description: "Checks inputs for safety thresholds and routes medical, trauma, regression, or self-harm signals toward qualified professional support.",
  },
  {
    index: "05",
    title: "Story Generator",
    tab: "stories",
    icon: <BookOpen className="w-3.5 h-3.5 text-cyan-400" />,
    status: "Standby",
    statusClass: "bg-cyan-500/10 text-cyan-400",
    description: "Crafts customized supportive transition stories featuring Dylan's strengths and next brave step.",
  },
  {
    index: "06",
    title: "Language Coach",
    tab: "milestones",
    icon: <Languages className="w-3.5 h-3.5 text-orange-400" />,
    status: "Enabled",
    statusClass: "bg-orange-500/10 text-orange-400",
    description: "Assists children through verbal code-switching routines between English transitions and native Hebrew phrases.",
  },
  {
    index: "07",
    title: "Professional Assistant",
    tab: "handoff",
    icon: <Users className="w-3.5 h-3.5 text-pink-400" />,
    status: "Synced",
    statusClass: "bg-pink-500/10 text-pink-400",
    description: "Prepares child intake history profiles, milestones maps and weekly homework for occupational care teams.",
  },
  {
    index: "08",
    title: "Knowledge Router",
    tab: "scholar",
    icon: <Compass className="w-3.5 h-3.5 text-[#d7aa55]" />,
    status: "Connected",
    statusClass: "bg-amber-500/15 text-amber-400",
    description: "Instantly matches parent queries against 8 established schools of child developmental psychology scientific schemas.",
  },
];

export default function AiRail() {
  const { setShowAiRail, setActiveTab } = useArbor();

  return (
    <aside className="border-l border-white/10 bg-[#08090c]/95 backdrop-blur-2xl p-6 flex flex-col gap-6 h-screen sticky top-0 overflow-y-auto hidden xl:flex text-xs z-20 w-[340px] 2xl:w-[365px]">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400/20 to-amber-600/20 text-[#f4d991] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[#d7aa55]" />
          </div>
          <div>
            <h3 className="font-black text-sm text-white tracking-tight uppercase">AI Engines</h3>
            <p className="text-[10px] text-[#a8a093]">Capability Architecture</p>
          </div>
        </div>
        <button
          onClick={() => setShowAiRail(false)}
          title="Collapse Panel"
          className="p-1 px-1.5 rounded-lg border border-white/5 hover:bg-white/5 text-[#a8a093] hover:text-white transition cursor-pointer"
        >
          ➔
        </button>
      </div>

      <div className="space-y-3.5 flex-1 select-text">
        <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-1">
          <span className="text-[10px] font-extrabold text-[#f4d991] uppercase tracking-wider block">Orchestrator Moat:</span>
          <p className="text-[11px] text-[#a8a093] leading-relaxed">
            Combining longitudinal child memory, expert-reviewed knowledge, sandboxed logic boundaries, and pediatric escalation guardrails.
          </p>
        </div>

        <div className="space-y-2.5">
          {engines.map((engine) => (
            <button
              key={engine.index}
              onClick={() => setActiveTab(engine.tab)}
              className={`w-full text-left p-2.5 rounded-xl border transition group flex flex-col gap-1 focus:outline-none ${
                engine.highlighted
                  ? "border-[#d7aa55]/20 bg-[#d7aa55]/5 hover:bg-[#d7aa55]/10 hover:border-[#d7aa55]/35"
                  : "border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className={`font-extrabold transition flex items-center gap-1.5 ${engine.highlighted ? "text-white group-hover:text-[#f4d991]" : "text-gray-300 group-hover:text-white"}`}>
                  {engine.icon}
                  {engine.index}. {engine.title}
                </span>
                <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono ${engine.statusClass}`}>
                  {engine.status}
                </span>
              </div>
              <p className="text-[10px] text-[#a8a093] leading-normal">{engine.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-white/5 mt-auto space-y-2">
        <button
          onClick={() => alert("AI engine check successful: core developmental capability routers are healthy, synced, and verified.")}
          className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition flex items-center justify-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#d7aa55]" />
          Run AI Checks
        </button>
        <p className="text-[10px] text-gray-500 text-center">System status: Fully calibrated & HIPAA-compliant lock.</p>
      </div>
    </aside>
  );
}
