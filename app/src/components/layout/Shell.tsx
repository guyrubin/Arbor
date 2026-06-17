import React, { lazy, Suspense, useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles, AlertTriangle, LogOut, Search, ShieldCheck, Settings as SettingsIcon } from "lucide-react";
import { useArbor, ActiveTab } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import { sectionForTab } from "../../lib/navigation";
import Sidebar from "./Sidebar";
import AiRail from "./AiRail";
import MobileNav from "./MobileNav";
import { ErrorBoundary } from "../ErrorBoundary";
import { ArborMark } from "../ui/ArborMark";
import { TabSkeleton } from "../ui/Skeleton";
import SearchModal from "../search/SearchModal";
import SettingsModal from "./SettingsModal";
import PaywallModal from "../billing/PaywallModal";
import { refreshEntitlement } from "../../hooks/useEntitlement";

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
const Screening = lazy(() => import("../sections/Screening"));
const StoryTimelineTab = lazy(() => import("../tabs/StoryTimelineTab"));
const FindProfessional = lazy(() => import("../sections/FindProfessional"));
const CareTeam = lazy(() => import("../sections/CareTeam"));
const Appointments = lazy(() => import("../sections/Appointments"));
const TrustedSharing = lazy(() => import("../sections/TrustedSharing"));
const Reports = lazy(() => import("../sections/Reports"));
const Masterclasses = lazy(() => import("../sections/Masterclasses"));
const FamilyFormation = lazy(() => import("../sections/FamilyFormation"));
const HeroComicsTab = lazy(() => import("../tabs/HeroComicsTab"));

// Practice Studio (Fall release: speech & language suite).
const SpeechCoachTab = lazy(() => import("../practice/SpeechCoachTab"));
const MimicStudioTab = lazy(() => import("../practice/MimicStudioTab"));
const FeelingsLabTab = lazy(() => import("../practice/FeelingsLabTab"));
const MissionsTab = lazy(() => import("../practice/MissionsTab"));
const JourneyTab = lazy(() => import("../practice/JourneyTab"));
const AdventuresTab = lazy(() => import("../practice/AdventuresTab"));
const DevelopmentCopilot = lazy(() => import("../practice/DevelopmentCopilot"));

// IA v3: consolidation hubs (merge confusable/duplicate leaves).
const DevelopmentTab = lazy(() => import("../tabs/DevelopmentTab"));
const DailyPlayTab = lazy(() => import("../tabs/DailyPlayTab"));
const PracticeHubTab = lazy(() => import("../practice/PracticeHubTab"));
const ConsultTab = lazy(() => import("../tabs/ConsultTab"));

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
  screening: Screening,
  timeline: StoryTimelineTab,
  "find-pro": FindProfessional,
  "care-team": CareTeam,
  appointments: Appointments,
  sharing: TrustedSharing,
  reports: Reports,
  masterclasses: Masterclasses,
  family: FamilyFormation,
  comics: HeroComicsTab,
  speech: SpeechCoachTab,
  mimic: MimicStudioTab,
  feelings: FeelingsLabTab,
  missions: MissionsTab,
  journey: JourneyTab,
  adventures: AdventuresTab,
  copilot: DevelopmentCopilot,
  development: DevelopmentTab,
  "daily-play": DailyPlayTab,
  practice: PracticeHubTab,
  consult: ConsultTab,
};

export default function Shell() {
  const { activeTab, setActiveTab, showAiRail, setShowAiRail, showSandboxBanner, childProfile } = useArbor();
  const { user, signOut, firebaseEnabled } = useAuth();
  const { toast } = useToast();
  const { t, uiLang, setUiLang } = useLanguage();
  const ActiveTabComponent = tabRegistry[activeTab];
  const section = sectionForTab(activeTab);
  const focusLabel = childProfile.languages.length > 1
    ? "Language transition"
    : (childProfile.challenges?.[0]?.replace(/\s*\(.*\)/, "").trim() || "");

  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  // MON-2: returning from hosted checkout (success URL carries ?billing=success).
  // The RevenueCat webhook writes the entitlement async, so poll a few times until
  // the plan flips, then confirm. Strip the param so a refresh doesn't re-trigger.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("billing") !== "success") return;
    params.delete("billing");
    const clean = window.location.pathname + (params.toString() ? `?${params}` : "") + window.location.hash;
    try { window.history.replaceState(null, "", clean); } catch { /* noop */ }
    toast(t("pw.activating"), "info");
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      tries += 1;
      const ent = await refreshEntitlement();
      if (ent.plan !== "free") { toast(t("pw.activated"), "success"); return; }
      if (tries < 6) timer = setTimeout(() => void poll(), 2500);
    };
    void poll();
    return () => clearTimeout(timer);
  }, [toast, t]);

  return (
    // select-none removed: parents must be able to select/copy scripts and guidance (a11y + core utility)
    <div className="arbor-app min-h-screen text-sans antialiased overflow-x-hidden relative">
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
              <span className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ background: "var(--arbor-clay)" }} />
              <span className="truncate">{t("top.caringFor")} <strong style={{ color: "var(--arbor-ink)" }}>{childProfile.name} · {t("top.age")} {childProfile.age}</strong>
              {focusLabel && <span className="hidden sm:inline"> · {t("top.focus")}: <strong style={{ color: "var(--arbor-green-ink)" }}>{focusLabel}</strong></span>}</span>
            </span>
            <div className="flex items-center gap-2">
              {/* Whole-app language switch (UI + AI). Hebrew flips the app to RTL. */}
              <div className="flex items-center rounded-xl p-0.5" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }} title={t("top.language")}>
                {(["en", "he"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setUiLang(l)}
                    className="px-2 py-1 rounded-lg text-[11px] font-extrabold transition"
                    style={uiLang === l ? { background: "var(--arbor-clay)", color: "#fff" } : { color: "var(--arbor-muted)" }}
                  >
                    {l === "en" ? "EN" : "עב"}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setSearchOpen(true)}
                aria-label={t("top.search")}
                title="Search (Ctrl/Cmd+K)"
                className="flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl text-[11px] font-bold transition bg-white"
                style={{ color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
              >
                <Search className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t("top.search")}</span>
              </button>
              {!showAiRail && (
                <button
                  onClick={() => setShowAiRail(true)}
                  className="hidden xl:flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl text-[11px] font-extrabold transition cursor-pointer"
                  style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> {t("top.howHelps")}
                </button>
              )}
              <button
                onClick={() => setSettingsOpen(true)}
                aria-label="Settings"
                title="Settings"
                className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl transition bg-white"
                style={{ color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
              >
                <SettingsIcon className="w-4 h-4" />
              </button>
              {firebaseEnabled && user && (
                <button
                  onClick={() => void signOut()}
                  aria-label="Sign out"
                  title="Sign out"
                  className="md:hidden flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl text-[11px] font-bold transition bg-white"
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
                    style={on ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", boxShadow: "inset 0 0 0 1px rgba(52,178,119,0.18)" } : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
                  >
                    <Icon className="w-3.5 h-3.5" /> {t("nav.tab." + it.tab)}
                  </button>
                );
              })}
            </div>
          )}

          {/* Sandbox banner if API key is missing */}
          {showSandboxBanner && (
            <div className="mb-6 p-4 rounded-2xl text-xs flex items-center justify-between gap-4" style={{ background: "var(--arbor-peach-soft)", color: "#8a5326" }}>
              <span className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>
                  <strong>Sandbox mode:</strong> live AI is off. Sample data lets you explore the product. Add a key in <code>.env.local</code> to connect real models.
                </span>
              </span>
              <button
                onClick={() => toast("Add GEMINI_API_KEY to app/.env.local (copy from app/.env.example) to enable live AI responses.", "info")}
                className="text-white font-extrabold px-3 py-1.5 rounded-xl flex-shrink-0"
                style={{ background: "var(--arbor-peach)" }}
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
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <PaywallModal />
    </div>
  );
}
