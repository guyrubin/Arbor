import React, { lazy, Suspense, useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles, AlertTriangle, LogOut, Search } from "lucide-react";
import { useArbor, ActiveTab } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { sectionForTab } from "../../lib/navigation";
import Sidebar from "./Sidebar";
import AiRail from "./AiRail";
import MobileNav from "./MobileNav";
import { ErrorBoundary } from "../ErrorBoundary";
import { ArborMark } from "../ui/ArborMark";
import { TabSkeleton } from "../ui/Skeleton";
import SearchModal from "../search/SearchModal";

// Existing leaf views (preserved).
const OverviewTab = lazy(() => import("../tabs/OverviewTab"));
const CoachTab = lazy(() => import("../tabs/CoachTab"));
const BehaviorsTab = lazy(() => import("../tabs/BehaviorsTab"));
const MilestonesTab = lazy(() => import("../tabs/MilestonesTab"));
const PlansTab = lazy(() => import("../tabs/PlansTab"));
const HeroJourneyTab = lazy(() => import("../tabs/HeroJourneyTab"));
const WeeklyTab = lazy(() => import("../tabs/WeeklyTab"));
const ScholarTab = lazy(() => import("../tabs/ScholarTab"));
const LanguageLabTab = lazy(() => import("../tabs/LanguageLabTab"));
const HandoffTab = lazy(() => import("../tabs/HandoffTab"));
const SafetyTab = lazy(() => import("../tabs/SafetyTab"));

// New capability views (IA refactor).
const ChildProfile = lazy(() => import("../sections/ChildProfile"));
const ChildMemory = lazy(() => import("../sections/ChildMemory"));
const Strengths = lazy(() => import("../sections/Strengths"));
const StoryTimelineTab = lazy(() => import("../tabs/StoryTimelineTab"));
const FindProfessional = lazy(() => import("../sections/FindProfessional"));
const CareTeam = lazy(() => import("../sections/CareTeam"));
const Appointments = lazy(() => import("../sections/Appointments"));
const TrustedSharing = lazy(() => import("../sections/TrustedSharing"));
const Reports = lazy(() => import("../sections/Reports"));
const Masterclasses = lazy(() => import("../sections/Masterclasses"));
const FamilyFormation = lazy(() => import("../sections/FamilyFormation"));

const tabRegistry: Record<ActiveTab, React.ComponentType> = {
  overview: OverviewTab,
  coach: CoachTab,
  behaviors: BehaviorsTab,
  milestones: MilestonesTab,
  plans: PlansTab,
  stories: HeroJourneyTab,
  weekly: WeeklyTab,
  scholar: ScholarTab,
  language: LanguageLabTab,
  handoff: HandoffTab,
  safety: SafetyTab,
  profile: ChildProfile,
  memory: ChildMemory,
  strengths: Strengths,
  timeline: StoryTimelineTab,
  "find-pro": FindProfessional,
  "care-team": CareTeam,
  appointments: Appointments,
  sharing: TrustedSharing,
  reports: Reports,
  masterclasses: Masterclasses,
  family: FamilyFormation,
};

export default function Shell() {
  const { activeTab, setActiveTab, showAiRail, setShowAiRail, showSandboxBanner, childProfile } = useArbor();
  const { user, signOut, firebaseEnabled } = useAuth();
  const ActiveTabComponent = tabRegistry[activeTab];
  const section = sectionForTab(activeTab);
  const focusLabel = childProfile.languages.length > 1
    ? "Language transition"
    : (childProfile.challenges?.[0]?.replace(/\s*\(.*\)/, "").trim() || "");

  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
          {/* Mobile brand header (sidebar is hidden below md, so the logo lives here) */}
          <div className="flex md:hidden items-center gap-2.5 mb-5">
            <ArborMark size={34} />
            <span className="text-xl font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>Arbor</span>
          </div>

          {/* Top workspace accessories header row */}
          <div className="flex justify-between items-center mb-5 gap-4">
            <span className="text-xs font-medium flex items-center gap-1.5 min-w-0" style={{ color: "var(--arbor-muted)" }}>
              <span className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ background: "#34b277" }} />
              <span className="truncate">Caring for <strong style={{ color: "var(--arbor-ink)" }}>{childProfile.name} · Age {childProfile.age}</strong>
              {focusLabel && <span className="hidden sm:inline"> · Focus: <strong style={{ color: "#1f8a5a" }}>{focusLabel}</strong></span>}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
                title="Search (Ctrl/Cmd+K)"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition bg-white"
                style={{ color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
              >
                <Search className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Search</span>
              </button>
              {!showAiRail && (
                <button
                  onClick={() => setShowAiRail(true)}
                  className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition cursor-pointer"
                  style={{ background: "#fdeada", color: "#cf6f37" }}
                >
                  <Sparkles className="w-3.5 h-3.5" /> AI Engines
                </button>
              )}
              {firebaseEnabled && user && (
                <button
                  onClick={() => void signOut()}
                  aria-label="Sign out"
                  title="Sign out"
                  className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition bg-white"
                  style={{ color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign out
                </button>
              )}
            </div>
          </div>

          {/* Secondary sub-navigation for multi-capability sections */}
          {section.items.length > 1 && (
            <div role="tablist" aria-label={`${section.label} sections`} className="flex gap-2 overflow-x-auto mb-6 -mx-1 px-1 pb-1 no-scrollbar">
              {section.items.map((it) => {
                const on = it.tab === activeTab;
                const Icon = it.icon;
                return (
                  <button
                    key={it.tab}
                    role="tab"
                    aria-selected={on}
                    onClick={() => setActiveTab(it.tab)}
                    className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold whitespace-nowrap transition flex-shrink-0"
                    style={on ? { background: "#e4f4ec", color: "#1f8a5a" } : { background: "#fff", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
                  >
                    <Icon className="w-3.5 h-3.5" /> {it.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Sandbox banner if API key is missing */}
          {showSandboxBanner && (
            <div className="mb-6 p-4 rounded-2xl text-xs flex items-center justify-between gap-4" style={{ background: "#fdeada", color: "#9a5a2a" }}>
              <span className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>
                  <strong>Sandbox mode:</strong> live AI is off. Sample data lets you explore the product. Add a key in <code>.env.local</code> to connect real models.
                </span>
              </span>
              <button
                onClick={() => alert("Create app/.env.local from app/.env.example and set GEMINI_API_KEY to enable live AI responses.")}
                className="text-white font-extrabold px-3 py-1.5 rounded-xl flex-shrink-0"
                style={{ background: "#cf6f37" }}
              >
                Learn how
              </button>
            </div>
          )}

          <Suspense fallback={<TabSkeleton />}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
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
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
