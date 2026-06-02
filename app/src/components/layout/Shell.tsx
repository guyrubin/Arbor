import React, { lazy, Suspense, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles, AlertTriangle, LogOut } from "lucide-react";
import { useArbor, ActiveTab } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "./Sidebar";
import AiRail from "./AiRail";
import MobileNav from "./MobileNav";
import { ErrorBoundary } from "../ErrorBoundary";
import { TabSkeleton } from "../ui/Skeleton";

// Code-split each tab so the initial bundle stays lean.
const OverviewTab = lazy(() => import("../tabs/OverviewTab"));
const CoachTab = lazy(() => import("../tabs/CoachTab"));
const BehaviorsTab = lazy(() => import("../tabs/BehaviorsTab"));
const MilestonesTab = lazy(() => import("../tabs/MilestonesTab"));
const PlansTab = lazy(() => import("../tabs/PlansTab"));
const StoriesTab = lazy(() => import("../tabs/StoriesTab"));
const WeeklyTab = lazy(() => import("../tabs/WeeklyTab"));
const ScholarTab = lazy(() => import("../tabs/ScholarTab"));
const HandoffTab = lazy(() => import("../tabs/HandoffTab"));
const SafetyTab = lazy(() => import("../tabs/SafetyTab"));

const TAB_ORDER: ActiveTab[] = [
  "overview",
  "coach",
  "behaviors",
  "milestones",
  "plans",
  "stories",
  "weekly",
  "scholar",
  "handoff",
  "safety",
];

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
  const { user, signOut, firebaseEnabled } = useAuth();
  const ActiveTabComponent = tabRegistry[activeTab];

  // Slide direction based on tab order (later tab → slide in from the right).
  const prevIndexRef = useRef(TAB_ORDER.indexOf(activeTab));
  const curIndex = TAB_ORDER.indexOf(activeTab);
  const direction = curIndex >= prevIndexRef.current ? 1 : -1;
  prevIndexRef.current = curIndex;

  return (
    <div className="arbor-app min-h-screen select-none text-sans antialiased overflow-x-hidden relative">
      <div
        className={`grid grid-cols-1 md:grid-cols-[260px_1fr] ${
          showAiRail
            ? "xl:grid-cols-[290px_1fr_340px] 2xl:grid-cols-[290px_1fr_365px]"
            : "xl:grid-cols-[290px_1fr]"
        } min-h-screen relative z-10 transition-all duration-300`}
      >
        <Sidebar />

        <main className="px-5 py-6 pb-24 md:px-6 md:py-8 md:pb-10 xl:px-12 xl:py-10 overflow-y-auto max-h-screen">
          {/* Top workspace accessories header row */}
          <div className="flex justify-between items-center mb-6 gap-4">
            <span className="text-xs text-[#a8a093] font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Active Care Platform: <strong className="text-white">Dylan · Age 5</strong> (English Transition)
            </span>
            <div className="flex items-center gap-2">
              {!showAiRail && (
                <button
                  onClick={() => setShowAiRail(true)}
                  className="hidden xl:flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/25 text-[#f4d991] px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#d7aa55]" /> Show AI Engines ➔
                </button>
              )}
              {firebaseEnabled && user && (
                <button
                  onClick={() => void signOut()}
                  aria-label="Sign out"
                  title="Sign out"
                  className="md:hidden flex items-center gap-1.5 border border-white/10 text-[#a8a093] hover:text-[#ffb59c] px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign out
                </button>
              )}
            </div>
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

          <Suspense fallback={<TabSkeleton />}>
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={activeTab}
                custom={direction}
                initial={{ opacity: 0, x: 24 * direction }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 * direction }}
                transition={{ duration: 0.18 }}
              >
                <ErrorBoundary>
                  <ActiveTabComponent />
                </ErrorBoundary>
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </main>

        {showAiRail && <AiRail />}
      </div>

      <MobileNav />
    </div>
  );
}
