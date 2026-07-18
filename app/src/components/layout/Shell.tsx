import React, { lazy, Suspense, useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor, ActiveTab } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import { sectionForTab, hubTabsForSection } from "../../lib/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import KidModeButton from "./KidModeButton";
import AskArborButton from "./AskArborButton";
import AiRail from "./AiRail";
import ChildContextHeader from "./ChildContextHeader";
import MobileNav from "./MobileNav";
import { ErrorBoundary } from "../ErrorBoundary";
import { ArborMark } from "../ui/ArborMark";
import { TabSkeleton } from "../ui/Skeleton";
import SearchModal from "../search/SearchModal";
import SettingsModal from "./SettingsModal";
import PaywallModal from "../billing/PaywallModal";
import { refreshEntitlement } from "../../hooks/useEntitlement";
import { selectionHaptic } from "../../lib/native";
// AP-048: Kid Mode overlay + context provider
import { KidModeProvider } from "../kidmode/KidModeContext";
import KidModeOverlay from "../kidmode/KidModeOverlay";
// E11: first-steps rail for new accounts (parent register only, dismissible)
import FirstStepsRail from "../onboarding/FirstStepsRail";
// E0: hero-comic wow onboarding — the front door for brand-new accounts only
// (children.length === 0 or localStorage "arbor.wowPending"); self-gating,
// existing accounts are marked seen on first render and never see it.
import WowOnboarding from "../onboarding/WowOnboarding";

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
const SafetyTab = lazy(() => import("../tabs/SafetyTab"));

// New capability views (IA refactor).
const ChildProfile = lazy(() => import("../sections/ChildProfile"));
const ChildMemory = lazy(() => import("../sections/ChildMemory"));
const Strengths = lazy(() => import("../sections/Strengths"));
const Screening = lazy(() => import("../sections/Screening"));
// One timeline surface, two densities (Feed #/journal · Story #/timeline).
const TimelineTab = lazy(() => import("../tabs/TimelineTab"));
const FindProfessional = lazy(() => import("../sections/FindProfessional"));
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
const JourneyTab = lazy(() => import("../practice/JourneyTab"));
const AdventuresTab = lazy(() => import("../practice/AdventuresTab"));
const DevelopmentCopilot = lazy(() => import("../practice/DevelopmentCopilot"));

// IA v3: consolidation hubs (merge confusable/duplicate leaves).
const DevelopmentTab = lazy(() => import("../tabs/DevelopmentTab"));
const DailyPlayTab = lazy(() => import("../tabs/DailyPlayTab"));
const PracticeHubTab = lazy(() => import("../practice/PracticeHubTab"));
const ConsultTab = lazy(() => import("../tabs/ConsultTab"));

// P0-5: internal attribution + UTM funnel dashboard (admin-gated inside the view).
const AttributionTab = lazy(() => import("../tabs/AttributionTab"));

// AP-051: Day Windows detail panel — calm/trickier visualization over existing JITAI (read-only).
const DayWindowsPanel = lazy(() => import("../sections/DayWindowsPanel"));

// AP-058: Smart Reminders settings dashboard — parent preferences over existing JITAI.
const SmartRemindersPanel = lazy(() => import("../sections/SmartRemindersPanel"));

// AP-060: The Science — parent-facing trust/source-transparency page (static editorial, no child data).
const SciencePage = lazy(() => import("../tabs/SciencePage"));
const SchoolBriefSection = lazy(() => import("../sections/SchoolBrief")); // AP-056

// AP-057: Bedtime Stories — day-rooted, generate-and-discard, escalation-gated.
const BedtimeStoriesTab = lazy(() => import("../tabs/BedtimeStoriesTab"));

// Wireframe: Ready-made Routines — the research-backed routine library (Growth).
const RoutinesTab = lazy(() => import("../tabs/RoutinesTab"));

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
  // b3: the standalone handoff door is retired — deep-links to #/handoff now
  // resolve into the single Consult flow (its AI-brief job is covered by the
  // teacher/therapist/pediatrician report types in the Consult export menu).
  handoff: ConsultTab,
  safety: SafetyTab,
  profile: ChildProfile,
  memory: ChildMemory,
  strengths: Strengths,
  screening: Screening,
  timeline: TimelineTab,
  journal: TimelineTab,
  "find-pro": FindProfessional,
  // W4.4: My Care Team merged into Trusted Sharing (both rendered the same
  // listShares + sharedWithMe grants) — deep-links to #/care-team resolve into
  // the one roster surface.
  "care-team": TrustedSharing,
  appointments: Appointments,
  sharing: TrustedSharing,
  reports: Reports,
  masterclasses: Masterclasses,
  family: FamilyFormation,
  comics: HeroComicsTab,
  speech: SpeechCoachTab,
  mimic: MimicStudioTab,
  feelings: FeelingsLabTab,
  journey: JourneyTab,
  adventures: AdventuresTab,
  copilot: DevelopmentCopilot,
  development: DevelopmentTab,
  "daily-play": DailyPlayTab,
  practice: PracticeHubTab,
  consult: ConsultTab,
  attribution: AttributionTab,
  "day-windows": DayWindowsPanel,   // AP-051: Day Windows (read-only, from Today)
  "smart-reminders": SmartRemindersPanel, // AP-058: Smart Reminders parent settings
  science: SciencePage,              // AP-060: The Science trust page (static editorial, no child data)
  "school-brief": SchoolBriefSection, // AP-056: School Handoff Brief (parent-controlled, teacher-facing, curated)
  "bedtime-stories": BedtimeStoriesTab, // AP-057: Bedtime Stories (day-rooted, generate-and-discard, escalation-gated)
  routines: RoutinesTab, // Wireframe: Ready-made Routines library (Growth › Routines)
};

export default function Shell() {
  const { activeTab, setActiveTab, showAiRail, setShowAiRail, showSandboxBanner, childProfile } = useArbor();
  const { user, signOut, firebaseEnabled } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
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
    // AP-048: KidModeProvider wraps the shell so Topbar and KidModeOverlay share the same flag.
    // KidModeProvider is pure UI state — no Firestore write, no child-data mutation.
    <KidModeProvider>
    {/* select-none removed: parents must be able to select/copy scripts and guidance (a11y + core utility) */}
    <div className="arbor-app min-h-screen text-sans antialiased overflow-x-hidden relative">
      <div
        className={`page-shell grid grid-cols-1 md:grid-cols-[248px_minmax(0,1fr)] ${
          showAiRail
            ? "xl:grid-cols-[270px_minmax(0,1fr)_minmax(300px,340px)] 2xl:grid-cols-[280px_minmax(0,1fr)_minmax(320px,360px)]"
            : "xl:grid-cols-[280px_minmax(0,1fr)]"
        } min-h-screen relative z-10 transition-all duration-300 max-w-full overflow-x-hidden`}
      >
        <Sidebar />

        {/* AP-044: Right column — topbar placeholder (desktop) + scrollable content area */}
        <div className="flex flex-col min-h-0 min-w-0 md:h-screen overflow-hidden">
          <Topbar />
        {/* arbor-parent: scopes the flat-white clinical token overrides to the parent
            dashboard content area ONLY. KidModeOverlay renders at position:fixed z-70
            as a sibling of the grid — it carries its own .arbor-play scope and does
            NOT inherit from this <main>. See index.css .arbor-parent block. */}
        <main className="arbor-parent w-full min-w-0 px-4 py-5 pb-24 sm:px-5 md:px-6 md:py-8 md:pb-10 xl:px-8 2xl:px-10 overflow-y-auto overflow-x-hidden flex-1 min-h-0">
          {/* Mobile brand header (sidebar is hidden below md, so the logo lives here) */}
          <div className="flex md:hidden items-center gap-2.5 mb-5">
            <ArborMark size={34} />
            <span className="text-xl font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>Arbor</span>
          </div>

          {/* Mobile-only workspace accessories strip. On md+ the topbar is the
              self-sufficient control band (search · Kid Mode · rail toggle · bell ·
              child switcher), so this row would duplicate it — it is hidden there.
              On mobile (topbar is md:flex, hidden) this remains the control surface. */}
          <ChildContextHeader
            className="md:hidden"
            identity={<span className="text-xs font-medium flex items-center gap-1.5 min-w-0" style={{ color: "var(--arbor-muted)" }}>
              <span className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ background: "var(--arbor-clay)" }} />
              <span className="truncate">{t("top.caringFor")} <strong style={{ color: "var(--arbor-ink)" }}>{childProfile.name} · {t("top.age")} {childProfile.age}</strong>
              {focusLabel && <span className="hidden sm:inline"> · {t("top.focus")}: <strong style={{ color: "var(--arbor-clay-deep)" }}>{focusLabel}</strong></span>}</span>
            </span>}
            actions={<div className="flex w-full sm:w-auto items-center gap-2 overflow-x-auto no-scrollbar">
              <AskArborButton compact />
              {/* Capture ("log a moment") is NOT a global chrome button — it has
                  two canonical homes: the Behaviors hub composer and the Journal
                  compose card, both one tap away in the bottom nav. Duplicating it
                  here put the same action on every screen; removed. */}
              {/* UC-1 + main consolidation: the whole-app language switch is canonical
                  inside Settings ONLY (see languageSettingsCanonical guard test). On
                  desktop it lives in the sidebar account-row popover; on mobile the
                  md:hidden Settings button below opens the same SettingsModal language
                  panel — so the mobile language path is preserved without a duplicate
                  in-content toggle. */}
              <button
                onClick={() => setSearchOpen(true)}
                aria-label={t("top.search")}
                title="Search (Ctrl/Cmd+K)"
                className="flex flex-shrink-0 items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] min-w-[44px] rounded-xl text-[11px] font-bold transition bg-white"
                style={{ color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
              >
                <Icon name="search" size={16} /> <span className="hidden sm:inline">{t("top.search")}</span>
              </button>
              <KidModeButton compact />
              <button
                onClick={() => setSettingsOpen(true)}
                aria-label={t("aria.settings")}
                title="Settings"
                className="md:hidden flex flex-shrink-0 items-center justify-center w-11 h-11 rounded-xl transition bg-white"
                style={{ color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
              >
                <Icon name="settings" size={18} />
              </button>
              {firebaseEnabled && user && (
                <button
                  onClick={() => void signOut()}
                  aria-label={t("aria.signout")}
                  title={t("nav.signout")}
                  className="md:hidden flex flex-shrink-0 items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl text-[11px] font-bold transition bg-white"
                  style={{ color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
                >
                  <Icon name="logout" size={16} /> {t("nav.signout")}
                </button>
              )}
            </div>
          }/>

          {/* UC-6 hub contextual pill row — the hub's FULL capability set: its
              primary/hub view + sub-tabs + its own folded tools (no global TOOLS
              drawer any more). Navy active fill / white inactive with a hairline
              border, sticky to the top of the scroll region. The first pill of
              each section is its Overview/hub. Renders only when there is more
              than one capability. */}
          {hubTabsForSection(section).length > 1 && (
            <div
              role="tablist"
              aria-label={`${section.label} sections`}
              className="sticky top-0 z-20 flex gap-2 overflow-x-auto mb-6 -mx-1 px-1 py-2 no-scrollbar"
              style={{ background: "var(--arbor-paper)" }}
            >
              {hubTabsForSection(section).map((it) => {
                const on = it.tab === activeTab;
                const PillIcon = it.icon;
                return (
                  <button
                    key={it.tab}
                    role="tab"
                    aria-selected={on}
                    onClick={() => { void selectionHaptic(); setActiveTab(it.tab); }}
                    className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 min-h-[44px] text-[var(--t-sm)] font-bold whitespace-nowrap transition flex-shrink-0"
                    style={on
                      ? { background: "var(--arbor-subtab-active)", color: "var(--arbor-subtab-on-ink)" }
                      : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
                  >
                    <PillIcon className="w-3.5 h-3.5" /> {t("nav.tab." + it.tab)}
                  </button>
                );
              })}
            </div>
          )}

          {/* Sandbox banner if API key is missing */}
          {showSandboxBanner && (
            <div className="mb-6 p-4 rounded-2xl text-xs flex items-center justify-between gap-4" style={{ background: "var(--arbor-peach-soft)", color: "#8a5326" }}>
              <span className="flex items-center gap-3">
                <Icon name="warning" size={20} className="flex-shrink-0" />
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

          {/* E11: first-steps rail — above the tab content, parent register only
              (inside .arbor-parent <main>); self-hides when done/dismissed. */}
          <FirstStepsRail />

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
        </div>{/* end right column (AP-044: topbar + main) */}

        {showAiRail && <AiRail />}
      </div>

      <MobileNav />
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <PaywallModal />
      {/* AP-048: Kid Mode full-screen overlay — rendered at z-70, above everything.
          Desktop-only entry point (Topbar button is hidden md:flex). The overlay
          itself is responsive; MobileNav is byte-unchanged. */}
      <KidModeOverlay />
      {/* E0: full-screen wow-onboarding overlay (z-45 — under the reused
          Modal/AvatarCreator it drives, over the app chrome). Renders null for
          every account that has seen it or already has children. */}
      <WowOnboarding />
    </div>
    </KidModeProvider>
  );
}
