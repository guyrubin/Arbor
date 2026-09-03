import React, { lazy, Suspense, useState, useEffect, useRef, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor, ActiveTab } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import { sectionForTab, hubTabsForSection } from "../../lib/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import KidModeButton from "./KidModeButton";
// IA-01 / IA-18: the Safety life-ring takes the strip slot the duplicate Ask
// door used to hold (Ask is already a primary MobileNav tab 8mm below).
import SafetyRing from "./SafetyRing";
import AiRail from "./AiRail";
import ChildContextHeader from "./ChildContextHeader";
import MobileNav from "./MobileNav";
import { ErrorBoundary } from "../ErrorBoundary";
import { ArborMark } from "../ui/ArborMark";
import { TabSkeleton } from "../ui/Skeleton";
import SearchModal, { SEARCH_OPEN_EVENT, requestOpenSearch, type SearchOpenSurface } from "../search/SearchModal";
import { track } from "../../lib/analytics";
import SettingsModal from "./SettingsModal";
import PaywallModal from "../billing/PaywallModal";
import { refreshEntitlement, takeBillingReturn, startBillingReturnPoll } from "../../hooks/useEntitlement";
import { selectionHaptic } from "../../lib/native";
// AP-048: Kid Mode overlay + context provider
import { KidModeProvider } from "../kidmode/KidModeContext";
import KidModeOverlay from "../kidmode/KidModeOverlay";
// KID-LOCK (W0.9): Shell's own hooks run OUTSIDE the KidModeProvider it
// renders, so the lock state comes from the module gate singleton instead.
import { isKidModeActive, subscribeKidMode } from "../../lib/kidModeGate";
// E11: the first-steps rail is mounted by OverviewTab (inside Today's own
// module order, below the primary action) — Shell no longer owns it.
// E0: hero-comic wow onboarding — fires exactly once, right after OnboardingFlow
// completes (journey.wow === "pending" in lib/onboardingJourney); self-gating,
// legacy devices migrate to done and never see it.
import WowOnboarding from "../onboarding/WowOnboarding";
// AI-CAP-7: post-confirm coach handoff — ONE global dismissible strip shared by
// every gated capture confirm (BehaviorsTab review + QuickLogModal); prefills
// Ask Arbor via seedCoach(source 'post-capture'), never auto-sends.
import PostCaptureCoachStrip from "../overview/PostCaptureCoachStrip";
// W0.5+W0.6: ONE global data-freshness banner (offline / couldn't-refresh).
import SyncStatusBanner from "../ui/SyncStatusBanner";
// GP-01: the months-precise age label is THE parent-facing age render.
import { ageLabel } from "../../lib/childAge";

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
// Learn Library — Academy's browsable developmental-education shelf.
const LearnLibrary = lazy(() => import("../sections/LearnLibrary"));
const FamilyFormation = lazy(() => import("../sections/FamilyFormation"));
// W5.3: the comics route mounts the bookshelf host (multi-page ComicReader
// books); it replaces the single-panel hero-comics grid (retired in W5.5).
const ComicsTab = lazy(() => import("../tabs/ComicsTab"));

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
// IA fix (AR-IA): the parent #/practice route hosts the PARENT-register
// Practice Studio launcher; the kid-register Hero Arcade (PracticeHubTab)
// now lives exclusively inside Kid Mode.
const PracticeStudioTab = lazy(() => import("../practice/PracticeStudioTab"));
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
  learn: LearnLibrary,
  family: FamilyFormation,
  comics: ComicsTab,
  speech: SpeechCoachTab,
  mimic: MimicStudioTab,
  feelings: FeelingsLabTab,
  journey: JourneyTab,
  adventures: AdventuresTab,
  copilot: DevelopmentCopilot,
  development: DevelopmentTab,
  "daily-play": DailyPlayTab,
  practice: PracticeStudioTab,
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
  const { toast } = useToast();
  const { t } = useLanguage();
  const ActiveTabComponent = tabRegistry[activeTab];
  const section = sectionForTab(activeTab);
  const focusLabel = childProfile.languages.length > 1
    ? "Language transition"
    : (childProfile.challenges?.[0]?.replace(/\s*\(.*\)/, "").trim() || "");

  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // F-02: <main> is the desktop scrollport (overflow-y-auto below), so a tab
  // switch kept the previous tab's scroll offset and showed the new tab
  // mid-page (plus a ghost frame of clipped old content during the exit).
  // The reset lives on AnimatePresence onExitComplete — exactly the tab-swap
  // moment, after the old tab has faded out and before the new one enters —
  // NOT in ArborContext.setActiveTab (which would also fire for non-visual
  // state churn and would scroll-jump under the still-visible outgoing tab).
  const mainRef = useRef<HTMLElement>(null);
  // W2.4 analytics: mirror of searchOpen for the deps-free hotkey listener,
  // so search_open fires only on the closed→open transition.
  const searchOpenRef = useRef(false);
  useEffect(() => { searchOpenRef.current = searchOpen; }, [searchOpen]);
  // KID-LOCK (W0.9, LEAK 5): live gate value for render-time modal gating.
  const kidLocked = useSyncExternalStore(subscribeKidMode, isKidModeActive);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        // KID-LOCK (W0.9, LEAK 5): SearchModal portals to document.body,
        // outside the inert shield, steals focus, and Enter navigates parent
        // tabs — the hotkey is a no-op while Kid Mode is open.
        if (isKidModeActive()) return;
        if (!searchOpenRef.current) track("search_open", { surface: "desktop" });
        setSearchOpen((s) => !s);
      }
    };
    // W1.9 mobile entry points (accessories strip + MobileNav More sheet)
    // signal via requestOpenSearch(); the gate is re-checked here so every
    // path into SearchModal passes the same KID-LOCK guard as the hotkey.
    const onOpenRequest = (e: Event) => {
      if (isKidModeActive()) return;
      const surface = ((e as CustomEvent).detail?.surface ?? "mobile") as SearchOpenSurface;
      if (!searchOpenRef.current) track("search_open", { surface });
      setSearchOpen(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(SEARCH_OPEN_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(SEARCH_OPEN_EVENT, onOpenRequest);
    };
  }, []);

  // KID-LOCK (W0.9, LEAK 5): a modal left open when Kid Mode engages must not
  // reappear beneath/over the kid surface — drop the local open flags.
  useEffect(() => {
    if (!kidLocked) return;
    setSearchOpen(false);
    setSettingsOpen(false);
  }, [kidLocked]);

  // MON-2: returning from hosted checkout (success URL carries ?billing=success).
  // The RevenueCat webhook writes the entitlement async, so poll a few times until
  // the plan flips, then confirm. Strip the param so a refresh doesn't re-trigger.
  // MOB-07 / IA-15: App.tsx's BillingReturnWatcher mounts first and strips the
  // param, leaving the sessionStorage flag; keying off the flag (read-once)
  // OR the raw param (if this ever mounts first) makes the sequence fire
  // exactly once. The poll + toasts live in hooks/useEntitlement
  // (startBillingReturnPoll), guarded by useEntitlement.test.ts.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get("billing") === "success";
    if (fromParam) {
      params.delete("billing");
      const clean = window.location.pathname + (params.toString() ? `?${params}` : "") + window.location.hash;
      try { window.history.replaceState(null, "", clean); } catch { /* noop */ }
    }
    if (!takeBillingReturn() && !fromParam) return;
    return startBillingReturnPoll({ toast, t, refresh: refreshEntitlement });
  }, [toast, t]);

  return (
    // AP-048: KidModeProvider wraps the shell so Topbar and KidModeOverlay share the same flag.
    // KidModeProvider is pure UI state — no Firestore write, no child-data mutation.
    <KidModeProvider>
    {/* select-none removed: parents must be able to select/copy scripts and guidance (a11y + core utility) */}
    <div className="arbor-app min-h-screen text-sans antialiased overflow-x-hidden relative">
      <div
        className={`page-shell grid grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)] ${
          showAiRail
            ? "xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[280px_minmax(0,1fr)_320px]"
            : "xl:grid-cols-[280px_minmax(0,1fr)]"
        } min-h-screen relative z-10 transition-all duration-300 max-w-full overflow-x-hidden`}
      >
        <Sidebar />

        {/* AP-044: Right column — topbar placeholder (desktop) + scrollable content area */}
        <div className="flex flex-col min-h-0 min-w-0 lg:h-screen overflow-hidden">
          <Topbar />
        {/* arbor-parent: scopes the flat-white clinical token overrides to the parent
            dashboard content area ONLY. KidModeOverlay renders at position:fixed z-70
            as a sibling of the grid — it carries its own .arbor-play scope and does
            NOT inherit from this <main>. See index.css .arbor-parent block. */}
        <main ref={mainRef} className="arbor-parent w-full min-w-0 px-4 py-5 pb-24 sm:px-5 md:px-6 md:py-8 lg:pb-10 xl:px-8 2xl:px-10 overflow-y-auto overflow-x-hidden flex-1 min-h-0">
          {/* Compact header (sidebar is hidden below lg, so the logo lives here) */}
          <div className="flex lg:hidden items-center gap-2.5 mb-5">
            <ArborMark size={34} />
            <span className="text-xl font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>Arbor</span>
          </div>

          {/* Mobile/tablet workspace accessories strip. On lg+ the topbar is the
              self-sufficient control band (search · Kid Mode · rail toggle · bell ·
              child switcher), so this row would duplicate it — it is hidden there.
              On mobile/tablet (topbar starts at lg) this remains the control surface. */}
          <ChildContextHeader
            className="lg:hidden"
            identity={<span className="text-xs font-medium flex items-center gap-1.5 min-w-0" style={{ color: "var(--arbor-muted)" }}>
              {/* IA-25: no pulsing "live" dot — nothing here is live, and a
                  pulse reads as presence (law 4). The child avatar is the mark. */}
              <span className="truncate">{t("top.caringFor")} <strong style={{ color: "var(--arbor-ink)" }}>{childProfile.name} · {ageLabel(childProfile, t)}</strong>
              {focusLabel && <span className="hidden sm:inline"> · {t("top.focus")}: <strong style={{ color: "var(--arbor-clay-deep)" }}>{focusLabel}</strong></span>}</span>
            </span>}
            actions={<div className="flex w-full sm:w-auto items-center gap-2 overflow-x-auto no-scrollbar">
              {/* IA-01: Safety life-ring — first accessory, one tap from every hub. */}
              <SafetyRing />
              {/* Capture ("log a moment") is NOT a global chrome button — it has
                  two canonical homes: the Behaviors hub composer and the Journal
                  compose card, both one tap away in the bottom nav. Duplicating it
                  here put the same action on every screen; removed. */}
              {/* UC-1 + main consolidation: the whole-app language switch is canonical
                  inside Settings ONLY (see languageSettingsCanonical guard test). On
                  desktop it lives in the sidebar account-row popover; on mobile the
                  lg:hidden Settings button below opens the same SettingsModal language
                  panel — so the mobile language path is preserved without a duplicate
                  in-content toggle. */}
              <button
                onClick={() => requestOpenSearch("mobile")}
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
                className="lg:hidden flex flex-shrink-0 items-center justify-center w-11 h-11 rounded-xl transition bg-white"
                style={{ color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
              >
                <Icon name="settings" size={18} />
              </button>
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
              className="sticky z-20 flex gap-2 overflow-x-auto mb-6 -mx-1 px-1 pb-2 no-scrollbar"
              style={{
                background: "var(--arbor-paper)",
                /* <main> is the scrollport and carries a top padding, so a plain
                   `top: 0` parked this band one padding-height below the
                   scrollport edge — leaving a live 32px sliver where content
                   scrolled through and got clipped by the opaque band. Pulling
                   the sticky inset (and the box) up by that padding makes the
                   stuck band flush with the scrollport top; the matching
                   padding-block-start keeps the pills exactly where they were
                   at rest. See --arbor-main-pt in index.css. */
                top: "calc(-1 * var(--arbor-main-pt))",
                marginBlockStart: "calc(-1 * var(--arbor-main-pt))",
                paddingBlockStart: "calc(var(--arbor-main-pt) + 0.5rem)",
              }}
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

          {/* W0.5+W0.6: global freshness banner — offline / sync-error, mounted
              ONCE here so 18 useChildCollection screens don't each grow one.
              Additive: cached/local data keeps rendering below, never a wall. */}
          <SyncStatusBanner />

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

          {/* E11: the first-steps rail is NO LONGER mounted here. Shell rendered
              it ABOVE the tab content, so on Today it outranked the day's action
              and pushed the single primary CTA below the fold (Rule A violation,
              masterplan §1). It now lives inside OverviewTab's own module order,
              BELOW the primary-action anchor row, where it counts against the
              ≤5-module budget like every other Today module. Parent register
              only (inside .arbor-parent <main>); self-hides when done/dismissed. */}

          <Suspense fallback={<TabSkeleton />}>
            <AnimatePresence
              mode="wait"
              /* F-02: reset BOTH scroll owners at the tab-swap moment — the
                 desktop <main> scrollport and the mobile window scroll (below
                 lg the page itself scrolls). Guarded by shellScrollReset.test.ts. */
              onExitComplete={() => {
                mainRef.current?.scrollTo({ top: 0, left: 0 });
                window.scrollTo(0, 0);
              }}
            >
              {/* W4.5: THE single tab entrance — the redundant CSS nth-child
                  stagger in index.css was removed (it double-fired with this
                  and capped at 6 children). Respects MotionConfig
                  reducedMotion="user" (App.tsx). */}
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
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
      {/* AI-CAP-7: fixed above MobileNav (z-30 < nav z-40) — non-blocking,
          dismissible, appears only right after a confirmed capture. */}
      <PostCaptureCoachStrip />
      {/* KID-LOCK (W0.9, LEAK 5): these three portal to document.body — outside
          the inert shield — so they are not MOUNTED while Kid Mode is open.
          PaywallModal's open state lives in ArborContext (openPaywall on 402s
          from kid-surface AI calls) and stays queued there; the modal renders
          after exit. Parent-mode rendering is byte-identical when the gate is
          off. */}
      {!kidLocked && <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />}
      {!kidLocked && <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />}
      {!kidLocked && <PaywallModal />}
      {/* AP-048: Kid Mode full-screen overlay — rendered at z-70, above everything.
          Desktop-only entry point (Topbar button starts at lg). The overlay
          itself is responsive; MobileNav is byte-unchanged. */}
      <KidModeOverlay />
      {/* E0: full-screen wow-onboarding overlay (z-45 — under the reused
          AvatarCreator it drives, over the app chrome). Renders null unless
          the journey store says the wow is pending (set by OnboardingFlow's
          real submit — so it fires exactly once, post-onboarding). */}
      <WowOnboarding />
    </div>
    </KidModeProvider>
  );
}
