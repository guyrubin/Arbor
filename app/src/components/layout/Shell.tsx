import React from "react";
import { AnimatePresence } from "motion/react";
import { Sparkles, AlertTriangle } from "lucide-react";
import { useArbor, ActiveTab } from "../../context/ArborContext";
import Sidebar from "./Sidebar";
import AiRail from "./AiRail";
import OverviewTab from "../tabs/OverviewTab";
import CoachTab from "../tabs/CoachTab";
import BehaviorsTab from "../tabs/BehaviorsTab";
import MilestonesTab from "../tabs/MilestonesTab";
import PlansTab from "../tabs/PlansTab";
import StoriesTab from "../tabs/StoriesTab";
import WeeklyTab from "../tabs/WeeklyTab";
import ScholarTab from "../tabs/ScholarTab";
import HandoffTab from "../tabs/HandoffTab";
import SafetyTab from "../tabs/SafetyTab";

const tabRegistry: Record<ActiveTab, React.ComponentType> = {
  overview: OverviewTab,
  coach: CoachTab,
  behaviors: BehaviorsTab,
  milestones: MilestonesTab,
  plans: PlansTab,
  stories: StoriesTab,
  weekly: WeeklyTab,
  scholar: ScholarTab,
  handoff: HandoffTab,
  safety: SafetyTab,
};

export default function Shell() {
  const { activeTab, showAiRail, setShowAiRail, showSandboxBanner } = useArbor();
  const ActiveTabComponent = tabRegistry[activeTab];

  return (
    <div className="arbor-app min-h-screen select-none text-sans antialiased overflow-x-hidden relative">
      <div
        className={`grid grid-cols-1 ${
          showAiRail
            ? "xl:grid-cols-[290px_1fr_340px] 2xl:grid-cols-[290px_1fr_365px]"
            : "xl:grid-cols-[290px_1fr]"
        } min-h-screen relative z-10 transition-all duration-300`}
      >
        <Sidebar />

        <main className="px-6 py-8 xl:px-12 xl:py-10 overflow-y-auto max-h-screen">
          {/* Top workspace accessories header row */}
          <div className="flex justify-between items-center mb-6 gap-4">
            <span className="text-xs text-[#a8a093] font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Active Care Platform: <strong className="text-white">Dylan · Age 5</strong> (English Transition)
            </span>
            {!showAiRail && (
              <button
                onClick={() => setShowAiRail(true)}
                className="hidden xl:flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/25 text-[#f4d991] px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#d7aa55]" /> Show AI Engines ➔
              </button>
            )}
          </div>

          {/* Sandbox banner if API key is missing */}
          {showSandboxBanner && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[#f4d991] text-xs flex items-center justify-between gap-4">
              <span className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>
                  <strong>Sandbox Demonstration Mode:</strong> `GEMINI_API_KEY` is not present. Local sample data remains available so you can click through the product. Add your key in `.env.local` to connect real Google AI models.
                </span>
              </span>
              <button
                onClick={() => alert("Create app/.env.local from app/.env.example and set GEMINI_API_KEY to enable live AI responses.")}
                className="bg-[#d7aa55] text-black font-extrabold px-3 py-1.5 rounded-xl flex-shrink-0"
              >
                Learn How
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            <ActiveTabComponent key={activeTab} />
          </AnimatePresence>
        </main>

        {showAiRail && <AiRail />}
      </div>
    </div>
  );
}
