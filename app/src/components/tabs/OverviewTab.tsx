import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  MessageSquare, Plus, RefreshCw, Sun, Sunrise, Moon, ArrowRight,
  Heart, BookOpen, Smile, Phone, ChevronRight, BookMarked,
  Share2, Waypoints, ClipboardCheck, Sparkles, CalendarDays, RotateCw, CheckCircle,
} from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import { ProgressRing } from "../ui/ProgressRing";
import { Skeleton } from "../ui/Skeleton";
import { ParentChildIllustration } from "../ui/ParentChildIllustration";
import { HeroAvatar, useHeroAvatar } from "../ui/HeroAvatar";
import { ShareButton } from "../ui/ShareButton";
import { nextNudge } from "../../lib/jitai";
import { useTodaysFocus } from "../../hooks/useTodaysFocus";
import QuickLogModal from "../overview/QuickLogModal";
import RemindersCard from "../overview/RemindersCard";
import TrendsChart from "../overview/TrendsChart";
import GoalsCard from "../overview/GoalsCard";
import DailyCheckinCard from "../overview/DailyCheckinCard";
import RhythmStrip from "../overview/RhythmStrip";
import DailyPlayCard from "../overview/DailyPlayCard";
import PrideMomentCard from "../overview/PrideMomentCard";
import QuickCaptureBar from "../overview/QuickCaptureBar";
import { StreakChip } from "../overview/StreakChip";
import { computeStreak } from "../../lib/streak";
import { trackInviteSent } from "../../lib/loopEvents";
import { MissionsPanel } from "../practice/MissionsTab";
import GoalBuilderPromptCard from "../practice/GoalBuilderPromptCard";
import GoalBuilderModal from "../practice/GoalBuilderModal";
import { PASTEL, PastelKey, cardCls } from "../ui/kit";
import framework from "../../framework.json";
import { predictRhythm, hourLabel } from "../../rhythm/predict";
import { selectDailyPlay, concernDomainsFromLogs, daySeedFor, type ScoredActivity, type SessionLength } from "../../playbank/select";
import { computeDevScore } from "../../growth/devScore";
import { activeGoalDomains, type ActiveGoal } from "../../practice/goalBuilder";
import { playDomainLabel } from "../../playbank/content";
import { dayPartFor, type DayPart } from "../../lib/timeOfDay";
import { track } from "../../lib/analytics";

const card = cardCls;
const DAY = 86_400_000;

// Token shorthands so the screen reads from one palette, not scattered literals.
const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const GREEN = "var(--arbor-green-ink)";
const GREEN_SOFT = "var(--arbor-green-soft)";
const RULE = "var(--arbor-rule)";

export default function OverviewTab() {
  const {
    setActiveTab, milestones, milestonesPercent, checkedMilestones, totalMilestones,
    behaviorLogs, childProfile, setChatInput,
    pendingMemoryItems, approvedMemoryItems,
    proposeMemory,
    donePlayIds, logPlayCompletion, playLogs,
    updateChild,
  } = useArbor();

  const { t, uiLang } = useLanguage();
  const { toast } = useToast();
  const [quickLog, setQuickLog] = useState(false);
  // iOS-adaptable Today: the heavy "daily tools" dashboard (check-in, goals,
  // reminders, trends chart) is collapsed on phones by default and revealed on
  // tap; desktop (lg+) always shows it. Keeps Today scannable, not a wall.
  const [showTools, setShowTools] = useState(false);
  // Today's focus can come back long; keep it to a glance with a Read-more.
  const [focusOpen, setFocusOpen] = useState(false);

  // CI-28: Goal Builder state.
  // activeGoals is stored on ChildProfile (COPPA note: parent-expressed intent,
  // not child assessment — gate §E arbor-safety review required before prod).
  const activeGoals: ActiveGoal[] = childProfile.activeGoals ?? [];
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  // Dismissible once-per-session (sessionStorage, not localStorage, so it
  // returns on next app open to encourage goal-setting on subsequent visits
  // within the D3-D14 activation window).
  const [goalPromptDismissed, setGoalPromptDismissed] = useState(() => {
    try { return sessionStorage.getItem("arbor.ci28.promptDismissed") === "1"; }
    catch { return false; }
  });

  const dismissGoalPrompt = () => {
    setGoalPromptDismissed(true);
    try { sessionStorage.setItem("arbor.ci28.promptDismissed", "1"); } catch { /* ignore */ }
  };

  const handleSaveGoals = async (goals: ActiveGoal[]) => {
    // Gate §E: write activeGoals to ChildProfile via updateChild.
    // This uses the same updateChild path used for avatars/profile — Firestore
    // when authed, localStorage in sandbox. COPPA review gates prod deploy.
    await updateChild(childProfile.id, { activeGoals: goals });
    const n = goals.length;
    toast(`Focus set. Daily Play is now matched to what you're working on.`, "success");
    if (n > 0) {
      // Ensure the prompt stays dismissed after saving.
      setGoalPromptDismissed(true);
      try { sessionStorage.setItem("arbor.ci28.promptDismissed", "1"); } catch { /* ignore */ }
    }
  };

  // Derive the PlayDomains from active goals to inject 1.6x weighting.
  const goalDomains = useMemo(() => activeGoalDomains(activeGoals), [activeGoals]);

  // Onboarding concern id — used for tile pre-fill highlight (gate §D).
  // The value is the concern id stored during onboarding (not the challenge text).
  const onboardingConcernId = useMemo(() => {
    try { return localStorage.getItem("arbor.ci28.concernId") ?? undefined; }
    catch { return undefined; }
  }, []);

  const firstName = (childProfile.name || "your child").split(" ")[0];
  const { hasHero } = useHeroAvatar();

  // ── Today surface: Rhythm prediction + Daily Play pick (memory-driven) ──
  const rhythm = useMemo(
    () => predictRhythm(
      behaviorLogs.map((l) => ({ timestamp: l.timestamp, intensity: l.intensity })),
      Date.now(),
      { ageYears: childProfile.age }
    ),
    [behaviorLogs, childProfile.age]
  );

  // CI-31: session-length chip state — persisted per-child, mirrors done-ids pattern.
  const [sessionLength, setSessionLength] = useState<SessionLength>(() => {
    try { return (localStorage.getItem(`arbor.play.sessionLength.${childProfile.id}`) as SessionLength) || "standard"; }
    catch { return "standard"; }
  });
  const [sessionTapped, setSessionTapped] = useState(false);

  const handleSessionLength = (v: SessionLength) => {
    setSessionLength(v);
    setSessionTapped(true);
    try { localStorage.setItem(`arbor.play.sessionLength.${childProfile.id}`, v); } catch { /* ignore */ }
  };

  const dailyPlay: ScoredActivity | null = useMemo(() => {
    const concernDomains = concernDomainsFromLogs(
      behaviorLogs.map((l) => ({ behaviorType: l.behaviorType, timestamp: l.timestamp })),
      Date.now()
    );
    const picks = selectDailyPlay({
      ageYears: childProfile.age,
      concernDomains,
      // CI-28: inject goal domains at 1.6x weight so goal-linked activities
      // surface first when the parent has set a focus.
      goalDomains,
      recentlyDoneIds: donePlayIds,
      daySeed: daySeedFor(Date.now()),
      // CI-29: pass sanitized interests so themeable activities get the 1.3x boost.
      interests: childProfile.interests,
      // CI-31: filter by the parent's declared session length.
      sessionLength,
    }, 1);
    return picks[0] ?? null;
  }, [behaviorLogs, childProfile.age, childProfile.id, donePlayIds, goalDomains, sessionLength]);

  // V4: gentle "days of moments" streak off any logged moment (a behaviour log
  // or a Daily Play completion). AADC-hardened in lib/streak — no loss/guilt,
  // one-day grace; the chip only shows once a calm rhythm exists (>= 2 days).
  const streak = useMemo(
    () => computeStreak(
      [...behaviorLogs.map((l) => l.timestamp), ...playLogs.map((p) => p.timestamp)],
      Date.now(),
    ),
    [behaviorLogs, playLogs],
  );

  const prepWindow = (hour: number) => {
    track("rhythm_prep_opened", { hour });
    setChatInput(`${firstName} tends to have a harder time around ${hourLabel(hour)}. Give me one short, calm script I can use to get ahead of it today.`);
    setActiveTab("coach");
  };
  // Wind-down: no dedicated reminder store on Today yet — fall back to a Coach
  // prompt prepping a one-tap wind-down routine (honest, ships-visible).
  const setWindDownReminder = (hour: number) => {
    setChatInput(`Help me set up a calm wind-down for ${firstName} starting around ${hourLabel(hour)}. Give me one short routine and a gentle reminder I can use today.`);
    setActiveTab("coach");
  };
  // Calm window: route to today's play (Daily Play lives on this same Today tab,
  // below the strip) and nudge the parent to use the calm window for it.
  const useCalmWindow = (startHour: number, endHour: number) => {
    toast(`Good time to play with ${firstName}: ${hourLabel(startHour)}–${hourLabel(endHour)}.`, "success");
  };
  // c1 moat-write: per child+hour dismiss so the confirm row never nags.
  const rhythmDismissKey = (hour: number) => `arbor.rhythm.remember.${childProfile.id}.${hour}`;
  const peakHour = rhythm.frictionPeak?.hour;
  const [rhythmRemembered, setRhythmRemembered] = useState<boolean>(() => {
    if (peakHour == null) return false;
    try { return localStorage.getItem(rhythmDismissKey(peakHour)) === "1"; }
    catch { return false; }
  });
  const rememberPattern = async (hour: number) => {
    track("rhythm_remember_proposed", { hour });
    try {
      await proposeMemory(`${firstName} often has a harder time around ${hourLabel(hour)}.`, {
        source: "rhythm",
        retention: "3 months",
        prompt: "rhythm:pattern",
      });
      try { localStorage.setItem(rhythmDismissKey(hour), "1"); } catch { /* ignore */ }
      setRhythmRemembered(true);
      toast(t("rhythm.remembered", { name: firstName }), "success");
    } catch {
      toast(t("rhythm.rememberError"), "error");
    }
  };
  const coachOnPlay = (p: ScoredActivity) => {
    setChatInput(`We're going to try "${p.activity.title}" with ${firstName} today (it builds ${p.activity.domain}). How can I get the most out of it, and what should I watch for?`);
    setActiveTab("coach");
  };
  const markPlayDone = (p: ScoredActivity) => {
    logPlayCompletion(p, "today"); // writes to the moat (synced) — single source of truth
    toast(`Nice. Added to ${firstName}'s day.`, "success");
  };
  // V0: the second-guardian invite loop routes to the existing Trusted-Sharing
  // flow; instrument it so the loop is measurable (installs-per-sharing-parent).
  const inviteGuardian = (channel: string) => {
    trackInviteSent(channel);
    setActiveTab("sharing");
  };

  // ── Living, time-aware Today: the device-local day-part drives the greeting,
  //    the hero eyebrow, and the order of spine slots 2–5 (never hides anything;
  //    everything stays reachable by scrolling — no dark pattern). ──
  const dayPart: DayPart = dayPartFor(new Date().getHours());
  const greeting =
    dayPart === "morning" ? { text: t("ov.greeting.morning"), icon: <Sunrise className="w-4 h-4" /> }
    : dayPart === "afternoon" ? { text: t("ov.greeting.afternoon"), icon: <Sun className="w-4 h-4" /> }
    : { text: t("ov.greeting.evening"), icon: <Moon className="w-4 h-4" /> };
  const heroEyebrow = t(`today.part.${dayPart}.eyebrow`, { name: firstName });

  const recentCount = useMemo(
    () => behaviorLogs.filter((l) => new Date(l.timestamp).getTime() >= Date.now() - 7 * DAY).length,
    [behaviorLogs]
  );

  const { weekAvg, trend } = useMemo(() => {
    const now = Date.now();
    const inWindow = (start: number, end: number) =>
      behaviorLogs.filter((l) => { const t = new Date(l.timestamp).getTime(); return t >= start && t < end; });
    const avg = (arr: typeof behaviorLogs) => (arr.length ? arr.reduce((s, l) => s + l.intensity, 0) / arr.length : 0);
    const r = avg(inWindow(now - 7 * DAY, now + DAY));
    const p = avg(inWindow(now - 14 * DAY, now - 7 * DAY));
    const t: "up" | "down" | "flat" = r > p + 0.1 ? "up" : r < p - 0.1 ? "down" : "flat";
    return { weekAvg: r, trend: t };
  }, [behaviorLogs]);

  const topTrigger = useMemo(() => {
    const counts = new Map<string, number>();
    behaviorLogs.forEach((l) => counts.set(l.behaviorType, (counts.get(l.behaviorType) || 0) + 1));
    let top = ""; let max = 0;
    counts.forEach((v, k) => { if (v > max) { max = v; top = k; } });
    return top;
  }, [behaviorLogs]);

  // TODO(m5): wire ErrorState into the Today-focus well once useTodaysFocus surfaces an error field
  // (deferred to p4-operational-hardening — must not mutate the hook in this mission).
  const { focus, loading: focusLoading, regenerate } = useTodaysFocus(childProfile, {
    count: recentCount, avg: weekAvg, topTrigger, milestonesPercent,
  });

  // One-line pulse: how the week is going, in plain words.
  const pulse =
    recentCount === 0 ? t("ov.pulse.start", { name: firstName })
    : trend === "down" ? t("ov.pulse.calmer", { name: firstName })
    : trend === "up" ? t("ov.pulse.harder", { name: firstName })
    : t("ov.pulse.steady", { name: firstName });

  const trendWord =
    recentCount === 0 ? t("ov.trend.gettingStarted")
    : trend === "down" ? t("ov.trend.easing") : trend === "up" ? t("ov.trend.attention") : t("ov.trend.steady");

  // JITAI: one well-timed nudge off the child's logged rhythm + today's state.
  const loggedTodayCount = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return behaviorLogs.filter((l) => new Date(l.timestamp).getTime() >= start.getTime()).length;
  }, [behaviorLogs]);
  const nudge = useMemo(
    () => nextNudge({ nowMs: Date.now(), rhythm, loggedToday: loggedTodayCount, recent7d: recentCount, childName: firstName }),
    [rhythm, loggedTodayCount, recentCount, firstName]
  );
  const onNudge = () => {
    if (!nudge) return;
    if (nudge.action === "log") setQuickLog(true);
    else setActiveTab(nudge.action as Parameters<typeof setActiveTab>[0]);
  };

  const recommendations: { tone: PastelKey; icon: React.ReactNode; title: string; desc: string; tab: any }[] = [
    { tone: "mint", icon: <Heart className="w-5 h-5" />, title: t("ov.reco.play.title"), desc: t("ov.reco.play.desc"), tab: "plans" },
    { tone: "coral", icon: <Smile className="w-5 h-5" />, title: t("ov.reco.feeling.title"), desc: t("ov.reco.feeling.desc", { name: firstName }), tab: "coach" },
    { tone: "lav", icon: <BookOpen className="w-5 h-5" />, title: t("ov.reco.story.title"), desc: t("ov.reco.story.desc"), tab: "stories" },
  ];

  // ── Time-aware spine (slots 2–5) ──────────────────────────────────────────
  // The host owns ORDER only. Tenants (rhythm = c1, daily-play = c2) keep their
  // existing prop contracts unchanged; b1 just relocates them. The memory nudge
  // is a read of the moat (promoted in the evening), the mission is a folded,
  // read-only deep link. Same set of slots in every day-part — only re-ranked.
  const hasPendingMemory = pendingMemoryItems.length > 0;
  type SlotKey = "rhythm" | "play" | "memory" | "mission";
  // Lower number = higher on the screen. Slots not rendered (e.g. no play pick)
  // are simply filtered out; nothing is hidden by the ordering itself.
  const SLOT_ORDER: Record<DayPart, Record<SlotKey, number>> = {
    morning:   { rhythm: 1, play: 2, memory: 3, mission: 4 },
    afternoon: { rhythm: 2, play: 1, memory: 3, mission: 4 },
    // evening: review the day — memory nudge promoted above play.
    evening:   { rhythm: 1, memory: 2, play: 3, mission: 4 },
  };

  type Slot = { key: SlotKey; node: React.ReactNode };
  const spineSlots: Slot[] = ([
    {
      key: "rhythm" as SlotKey,
      // TENANT: rhythm (c1) — b1 owns placement only; do not change props here.
      node: (
        <RhythmStrip
          prediction={rhythm}
          childName={firstName}
          onPrepWindow={prepWindow}
          onSetWindDownReminder={setWindDownReminder}
          onUseCalmWindow={useCalmWindow}
          onRememberPattern={rememberPattern}
          alreadyRemembered={rhythmRemembered}
        />
      ),
    },
    dailyPlay
      ? {
          key: "play" as SlotKey,
          // TENANT: daily-play (c2) — b1 owns placement only; do not change props here.
          // CI-28: goalLabel surfaces the active goal that drove this pick.
          // CI-31: sessionLength + onSessionLengthChange + sessionTapped + rhythmHintTime
          //        enable the session-length chip row on the Today hero card.
          node: (
            <DailyPlayCard
              pick={dailyPlay}
              childName={firstName}
              done={donePlayIds.includes(dailyPlay.activity.id)}
              onDid={markPlayDone}
              onCoach={coachOnPlay}
              concernLabel={dailyPlay.reason === "concern-match" ? playDomainLabel(dailyPlay.activity.domain, uiLang) : undefined}
              goalLabel={
                dailyPlay.reason === "goal-match"
                  ? (activeGoals.find((g) => g.domainId === dailyPlay.activity.domain)?.label)
                  : undefined
              }
              sessionLength={sessionLength}
              onSessionLengthChange={handleSessionLength}
              sessionTapped={sessionTapped}
              rhythmHintTime={rhythm.calmWindow ? hourLabel(rhythm.calmWindow.startHour) : undefined}
            />
          ),
        }
      : null,
    hasPendingMemory
      ? {
          key: "memory" as SlotKey,
          // Memory nudge — moat READ only (write-back lives in the memory tab).
          node: (
            <button
              onClick={() => setActiveTab("memory")}
              className={`${card} w-full text-left p-5 md:p-6 flex items-center gap-4 transition hover:-translate-y-0.5`}
            >
              <span className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: PASTEL.yellow.soft, color: PASTEL.yellow.ink }}>
                <BookMarked className="w-6 h-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-extrabold" style={{ color: INK }}>{t("today.memory.evening.title")}</span>
                <span className="block text-[13px] mt-0.5 leading-snug" style={{ color: MUTED }}>{t("today.memory.evening.body", { n: pendingMemoryItems.length })}</span>
              </span>
              <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: PASTEL.yellow.ink }} />
            </button>
          ),
        }
      : null,
    {
      key: "mission" as SlotKey,
      // FOLDED: mission (ia-b1) — the real daily loop (today's mission card +
      // streak pill + completion toggle + moat write-back). The standalone
      // Missions tab was retired; Today is now the mission home. "See this
      // week's rotation" deep-links into My Child › Development.
      node: <MissionsPanel variant="today" />,
    },
  ] as (Slot | null)[]).filter((s): s is Slot => s !== null);

  const orderedSpine = [...spineSlots].sort(
    (a, b) => SLOT_ORDER[dayPart][a.key] - SLOT_ORDER[dayPart][b.key]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5 md:space-y-7 relative max-w-[1080px]"
    >
      {/* ── Quick Capture — first in tab order so capture is always reachable ─ */}
      <QuickCaptureBar childName={firstName} onCapture={() => setQuickLog(true)} />

      {/* ── R3 — Milestone pride moment: a calm celebration on a new crossing
             (renders nothing when there is none) ── */}
      <PrideMomentCard />

      {/* ── PROTOTYPE GRID LAYOUT: Row 1 (2-col, 1.6fr + 1fr) ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
        {/* ── Guidance hero card (left, 1.6fr) — prototype gradient band carrying
               the FULL capability set: greeting, streak, trend, AI focus (expand +
               regenerate), Log Moment, Ask Arbor. Supersedes the legacy decision-hero. */}
        <section
          className="rounded-[22px] overflow-hidden"
          style={{ background: "#fff", boxShadow: "var(--shadow-md)" }}
        >
          {/* Gradient hero band */}
          <div className="relative h-[176px] flex flex-col justify-between" style={{ background: "linear-gradient(140deg, #4a90e2 0%, #4a90e2 52%, #9b8cf0 105%)", padding: "20px" }}>
            <div className="absolute inset-0" style={{ background: "radial-gradient(60% 80% at 86% 4%, rgba(255,255,255,0.34), transparent 60%)" }}></div>
            <Sparkles className="absolute right-[22px] bottom-[14px] text-[88px] opacity-[0.16]" style={{ color: "#fff", fontVariationSettings: "'FILL' 1" }} aria-hidden="true" />
            {/* Top row: eyebrow tag + trend chip */}
            <div className="relative flex items-center justify-between gap-2">
              <span className="inline-flex items-center text-[10px] font-extrabold uppercase tracking-wider" style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(4px)", color: "#fff", padding: "6px 12px", borderRadius: "20px", letterSpacing: "1.4px" }}>
                {heroEyebrow}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold flex-shrink-0" style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#fff" }} /> {trendWord}
              </span>
            </div>
            {/* Greeting + pulse */}
            <div className="relative">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-bold" style={{ color: "rgba(255,255,255,0.92)" }}>
                {greeting.icon} {greeting.text}
              </span>
              <h1 className="text-[26px] font-extrabold leading-[1.12] mt-1" style={{ color: "#fff", maxWidth: "88%", letterSpacing: "-0.5px", fontFamily: "var(--font-display)", textWrap: "balance" } as React.CSSProperties}>
                {pulse}
              </h1>
            </div>
          </div>
          {/* Action band: streak + name row → AI focus recommendation → primary CTAs */}
          <div className="px-5 pb-5 pt-4">
            <div className="flex items-center justify-between gap-3">
              <StreakChip days={streak.current} lang={uiLang === "he" ? "he" : "en"} />
              <span className="text-[12px] font-medium text-right" style={{ color: "#7c8983" }}>
                {firstName}, age {childProfile.age}{childProfile.schoolContext ? ` · ${childProfile.schoolContext}` : ""}
              </span>
            </div>
            {/* AI focus recommendation well */}
            <div className="mt-3 min-h-[2.5rem]">
              {focusLoading && !focus ? (
                <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>
              ) : focus ? (
                <div>
                  <p className={`text-[15px] leading-relaxed font-medium ${focusOpen ? "" : "line-clamp-3"}`} style={{ color: "#14225a", textWrap: "pretty" } as React.CSSProperties}>{focus.text}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {focus.text.length > 160 && (
                      <button onClick={() => setFocusOpen((v) => !v)} className="text-[12px] font-bold inline-flex items-center min-h-[36px] px-1 transition" style={{ color: "var(--arbor-clay)" }}>
                        {focusOpen ? t("ov.focus.less") : t("ov.focus.more")}
                      </button>
                    )}
                    <button onClick={() => void regenerate()} disabled={focusLoading} title="Suggest another focus" aria-label="Suggest another focus" className="inline-flex items-center justify-center w-9 h-9 rounded-xl transition disabled:opacity-50" style={{ background: "#eef3fb", color: "var(--arbor-clay)" }}>
                      <RefreshCw className={`w-4 h-4 ${focusLoading ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>
              ) : recentCount > 0 ? (
                <p className="text-[15px] leading-relaxed" style={{ color: "#7c8983" }}>{t("ov.recoLoading", { name: firstName })}</p>
              ) : (
                <p className="text-[15px] leading-relaxed" style={{ color: "#14225a" }}>{t("ov.recoEmpty", { name: firstName })}</p>
              )}
            </div>
            {/* Primary actions */}
            <div className="flex flex-wrap items-center gap-2.5 mt-4">
              <button onClick={() => setQuickLog(true)} aria-label={t("ov.logMoment")} className="inline-flex items-center gap-2 text-white font-extrabold text-[13px] rounded-xl px-5 py-3 transition active:scale-[0.98]" style={{ background: "#14225a", boxShadow: "0 8px 18px -6px rgba(20,34,90,0.5)" }}>
                <Plus className="w-4 h-4" /> {t("ov.logMoment")}
              </button>
              <button onClick={() => { if (focus) setChatInput(`About today: ${focus.text} What is one concrete thing I can do for ${firstName} today?`); setActiveTab("coach"); }} className="inline-flex items-center gap-2 font-bold text-[13px] rounded-xl px-4 py-3 transition" style={{ background: "#eef3fb", color: "var(--arbor-clay)" }}>
                <MessageSquare className="w-4 h-4" /> {t("ov.askArbor")}
              </button>
            </div>
          </div>
        </section>

        {/* ── Dev map ring card (right, 1fr) ─────────────────────────────────── */}
        {(() => {
          const score = computeDevScore(milestones.map((m) => ({ domain: m.domain, checked: m.checked })));
          if (score.confidence === "none") return null;
          const focusLabel = score.focusDomain ? (framework.domains as { id: string; label: string }[]).find((d: { id: string; label: string }) => d.id === score.focusDomain)?.label : null;
          return (
            <section
              onClick={() => setActiveTab("development")}
              className="rounded-[22px] p-5 flex flex-col transition hover:-translate-y-0.5 cursor-pointer"
              style={{ background: "#fff", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-clay)" }}>
                {t("devscore.overall")}
              </div>
              <div className="flex items-center gap-4 mt-3">
                <div className="relative w-[72px] h-[72px] rounded-full flex-none" style={{ background: `conic-gradient(var(--arbor-clay) 0 ${score.overall}%, #e7eeea ${score.overall}% 100%)` }}>
                  <div className="absolute inset-1 m-auto w-[calc(100%-8px)] h-[calc(100%-8px)] rounded-full bg-white flex flex-col items-center justify-center">
                    <span className="text-[22px] font-extrabold" style={{ color: "#14225a" }}>{score.overall}%</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-extrabold leading-tight" style={{ color: "#14225a" }}>
                    {t("devscore.todayLine", { focus: focusLabel || t("devscore.todayLineSteady") })}
                  </div>
                  <div className="text-[11px] mt-1" style={{ color: "#8a958e" }}>
                    {t("devscore.reached", { reached: checkedMilestones, total: totalMilestones })}
                  </div>
                </div>
              </div>
            </section>
          );
        })()}
      </div>

      {/* ── PROTOTYPE GRID LAYOUT: Row 2 (3-col, 1fr + 1fr + 1fr) ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Kid activity sync card (spans 2 cols) ─────────────────────────── */}
        <section className="lg:col-span-2 rounded-[22px] p-5" style={{ background: "#fff", boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center gap-2 mb-4">
            <RotateCw className="w-5 h-5" style={{ color: "var(--arbor-clay)", fontVariationSettings: "'FILL' 1" }} />
            <span className="text-[15px] font-extrabold" style={{ color: "#14225a" }}>{t("ov.reco.play.title")}</span>
            <span className="ml-auto text-[10px] font-extrabold rounded-full px-2.5 py-1" style={{ color: "var(--arbor-clay)", background: "#eaf2ff" }}>
              {t("today.live")}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {/* Daily Play card if available */}
            {dailyPlay ? (
              <DailyPlayCard
                pick={dailyPlay}
                childName={firstName}
                done={donePlayIds.includes(dailyPlay.activity.id)}
                onDid={markPlayDone}
                onCoach={coachOnPlay}
                concernLabel={dailyPlay.reason === "concern-match" ? playDomainLabel(dailyPlay.activity.domain, uiLang) : undefined}
                goalLabel={
                  dailyPlay.reason === "goal-match"
                    ? (activeGoals.find((g) => g.domainId === dailyPlay.activity.domain)?.label)
                    : undefined
                }
                sessionLength={sessionLength}
                onSessionLengthChange={handleSessionLength}
                sessionTapped={sessionTapped}
                rhythmHintTime={rhythm.calmWindow ? hourLabel(rhythm.calmWindow.startHour) : undefined}
              />
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "#fbfdfc" }}>
                <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#eef3fb", color: "var(--arbor-clay)" }}>
                  <Sparkles className="w-5 h-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-extrabold" style={{ color: "#14225a" }}>{focus?.text || t("ov.recoLoading", { name: firstName })}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: "#8a958e" }}>{t("ov.play.desc")}</div>
                </div>
              </div>
            )}
            {/* Rhythm card */}
            {rhythm.confidence !== "none" && (
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "#fbfdfc" }}>
                <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#eef3fb", color: "#3f8cc9" }}>
                  <CalendarDays className="w-5 h-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-extrabold" style={{ color: "#14225a" }}>{t("dw.cta")}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: "#8a958e" }}>{rhythm.frictionPeak ? t("rhythm.peak", { hour: hourLabel(rhythm.frictionPeak.hour) }) : t("rhythm.steady")}</div>
                </div>
                <CheckCircle className="w-5 h-5" style={{ color: "#10b981" }} />
              </div>
            )}
          </div>
        </section>

        {/* ── Coach card (1 col) ──────────────────────────────────────────── */}
        <section
          onClick={() => { if (focus) setChatInput(`About today: ${focus.text} What is one concrete thing I can do for ${firstName} today?`); setActiveTab("coach"); }}
          className="rounded-[22px] p-5 flex flex-col transition hover:-translate-y-0.5 cursor-pointer"
          style={{ background: "linear-gradient(140deg, #eaf2ff, #e7f1fa)", boxShadow: "var(--shadow-sm)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-[46px] h-[46px] rounded-full flex items-center justify-center text-[16px] font-extrabold" style={{ background: "linear-gradient(135deg, #4a90e2, #2b7fd1)", color: "#fff" }}>
              {firstName.charAt(0)}
            </div>
            <div>
              <div className="text-[14px] font-extrabold" style={{ color: "#14225a" }}>Arbor Coach</div>
              <div className="text-[10px] font-extrabold" style={{ color: "var(--arbor-clay)" }}>{t("coach.online")}</div>
            </div>
          </div>
          <div className="text-[13px] leading-relaxed mt-3 flex-1" style={{ color: "#3a463f" }}>
            {focus?.text || t("coach.ready", { name: firstName })}
          </div>
          <button className="mt-4 bg-white text-center rounded-xl py-3 text-[13px] font-extrabold flex items-center justify-center gap-2" style={{ color: "var(--arbor-clay)" }}>
            <MessageSquare className="w-4 h-4" /> {t("ov.askArbor")}
          </button>
        </section>
      </div>

      {/* ── JITAI nudge ─────────────────────────────────────────────────────── */}
      {nudge && (
        <section className="rounded-2xl p-4 flex flex-wrap items-center gap-3" style={{ background: PASTEL[nudge.tone].soft, border: `1px solid ${RULE}` }}>
          <span className="w-10 h-10 rounded-xl grid place-items-center flex-shrink-0" style={{ background: "var(--arbor-paper-elevated)", color: PASTEL[nudge.tone].ink }}>
            {nudge.kind === "calm" ? <Moon className="w-5 h-5" /> : nudge.kind === "log" ? <Plus className="w-5 h-5" /> : nudge.kind === "practice" ? <Heart className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
          </span>
          <div className="flex-1 min-w-[200px]">
            <p className="text-[15px] font-extrabold" style={{ color: INK }}>{t(nudge.headlineKey, nudge.vars)}</p>
            <p className="text-[13px] mt-0.5 leading-snug" style={{ color: MUTED }}>{t(nudge.bodyKey, nudge.vars)}</p>
          </div>
          <button onClick={onNudge} className="inline-flex items-center justify-center gap-1.5 font-bold text-sm rounded-full px-4 min-h-[44px] flex-shrink-0 text-white transition active:scale-[0.98]" style={{ background: PASTEL[nudge.tone].ink }}>
            {t(nudge.ctaKey, nudge.vars)} <ArrowRight className="w-4 h-4" />
          </button>
        </section>
      )}

      {/* ── Practice & Play launcher — the bright door into the kids' games ─ */}
      <section
        className="relative overflow-hidden rounded-[24px] p-5 md:p-6 flex flex-wrap items-center gap-x-5 gap-y-4"
        style={{
          background:
            "radial-gradient(120% 140% at 8% 0%, var(--arbor-lav-soft), transparent 60%), radial-gradient(120% 140% at 100% 100%, var(--arbor-sky-soft), transparent 55%), linear-gradient(120deg, var(--arbor-green-soft), #ffffff 70%)",
          border: `1px solid ${RULE}`,
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <HeroAvatar size={76} mood="wave" animate className="flex-shrink-0 drop-shadow-sm" />
        <div className="flex-1 min-w-[200px]">
          <h2 className="text-[1.35rem] md:text-[1.6rem] font-extrabold leading-[1.1]" style={{ fontFamily: "var(--font-display)", color: INK, textWrap: "balance" } as React.CSSProperties}>
            {hasHero ? t("ov.play.title", { name: firstName }) : t("ov.hero.title", { name: firstName })}
          </h2>
          <p className="text-sm mt-1.5 max-w-md" style={{ color: MUTED }}>
            {hasHero ? t("ov.play.desc") : t("ov.hero.desc", { name: firstName })}
          </p>
        </div>
        {hasHero ? (
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={() => setActiveTab("practice")}
              className="inline-flex items-center justify-center gap-2 text-white font-extrabold text-[15px] rounded-full px-6 min-h-[52px] transition active:scale-[0.97] hover:-translate-y-0.5"
              style={{ background: "var(--arbor-gradient-lav)", boxShadow: "var(--shadow-lav)" }}
            >
              <Sparkles className="w-5 h-5" /> {t("ov.play.cta")}
            </button>
            <ShareButton
              artifact="avatar"
              surface="today"
              childName={firstName}
              getCardOpts={() => ({ imageUrl: childProfile.photoUrl!, name: firstName, age: childProfile.age })}
              label={t("share.cta.avatar")}
            />
          </div>
        ) : (
          <button
            onClick={() => setActiveTab("profile")}
            className="inline-flex items-center justify-center gap-2 text-white font-extrabold text-[15px] rounded-full px-6 min-h-[52px] transition active:scale-[0.97] hover:-translate-y-0.5 flex-shrink-0"
            style={{ background: "var(--arbor-gradient-primary)", boxShadow: "var(--shadow-green)" }}
          >
            <Sparkles className="w-5 h-5" /> {t("ov.hero.cta", { name: firstName })}
          </button>
        )}
      </section>

      {/* ── Time-aware spine: rhythm (c1) · daily-play (c2) · memory nudge ·
             folded mission — order re-ranks by day-part, computed once. ───── */}
      <div className="space-y-4">
        {orderedSpine.map((s) => (
          <React.Fragment key={s.key}>{s.node}</React.Fragment>
        ))}
      </div>

      {/* ── CI-28: Goal Builder prompt card (D3-D14 activation) ───────────── */}
      {activeGoals.length === 0 && !goalPromptDismissed && (
        <GoalBuilderPromptCard
          childName={firstName}
          onSetFocus={() => setGoalModalOpen(true)}
          onDismiss={dismissGoalPrompt}
        />
      )}

      {/* ── How your child is doing (the picture, with the moat folded in) ─ */}
      <section className={`${card} overflow-hidden`}>
        <div className="px-6 pt-5 pb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold" style={{ fontFamily: "var(--font-display)", color: INK }}>{t("ov.howDoing", { name: firstName })}</h2>
          <button onClick={() => setActiveTab("timeline")} className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: GREEN }}>
            {t("ov.openStory", { name: firstName })} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid sm:grid-cols-3" style={{ borderTop: `1px solid ${RULE}` }}>
          {/* Milestones */}
          <button onClick={() => setActiveTab("milestones")} className="text-left p-5 flex items-center gap-4 transition hover:bg-[var(--arbor-paper-deep)]" style={{ borderInlineEnd: `1px solid ${RULE}` }}>
            <ProgressRing value={milestonesPercent} size={52} stroke={6}>
              <span className="text-[12px] font-extrabold" style={{ color: GREEN }}>{milestonesPercent}%</span>
            </ProgressRing>
            <span className="min-w-0">
              <span className="block text-sm font-extrabold" style={{ color: INK }}>
                {t("ov.milestonesCount", { checked: checkedMilestones, total: totalMilestones })}
              </span>
              <span className="block text-xs mt-0.5" style={{ color: MUTED }}>{t("ov.noticedAge", { age: childProfile.age })}</span>
            </span>
          </button>

          {/* Memory (the moat) */}
          <button onClick={() => setActiveTab("memory")} className="text-left p-5 flex items-center gap-4 transition hover:bg-[var(--arbor-paper-deep)]" style={{ borderInlineEnd: `1px solid ${RULE}` }}>
            <span className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: pendingMemoryItems.length ? PASTEL.yellow.soft : PASTEL.lav.soft, color: pendingMemoryItems.length ? PASTEL.yellow.ink : PASTEL.lav.ink }}>
              <BookMarked className="w-6 h-6" />
            </span>
            <span className="min-w-0">
              {pendingMemoryItems.length > 0 ? (
                <>
                  <span className="block text-sm font-extrabold" style={{ color: PASTEL.yellow.ink }}>{t("ov.toReview", { n: pendingMemoryItems.length })}</span>
                  <span className="block text-xs mt-0.5" style={{ color: MUTED }}>{t("ov.factsWaiting")}</span>
                </>
              ) : (
                <>
                  <span className="block text-sm font-extrabold" style={{ color: INK }}>{t("ov.remembered", { n: approvedMemoryItems.length })}</span>
                  <span className="block text-xs mt-0.5" style={{ color: MUTED }}>{t("ov.approvedOnly")}</span>
                </>
              )}
            </span>
          </button>

          {/* Story / capture */}
          <button onClick={() => setActiveTab("timeline")} className="text-left p-5 flex items-center gap-4 transition hover:bg-[var(--arbor-paper-deep)]">
            <span className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: PASTEL.sky.soft, color: PASTEL.sky.ink }}>
              <Waypoints className="w-6 h-6" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-extrabold" style={{ color: INK }}>{t("ov.thisWeekCount", { n: recentCount })}</span>
              <span className="block text-xs mt-0.5" style={{ color: MUTED }}>{t("ov.momentsInStory", { name: firstName })}</span>
            </span>
          </button>
        </div>
      </section>

      {/* ── AP-051: Day Windows entry — additional detail view (does NOT replace
             the inline JITAI nudge above; that nudge remains unchanged). ─── */}
      {rhythm.confidence !== "none" && (
        <section>
          <button
            onClick={() => setActiveTab("day-windows")}
            className="w-full text-left flex items-center gap-4 rounded-2xl p-4 transition hover:-translate-y-0.5"
            style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}`, boxShadow: "var(--shadow-sm)" }}
            aria-label={t("dw.cta")}
          >
            <span
              className="rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ width: 44, height: 44, background: GREEN_SOFT, color: GREEN }}
            >
              <CalendarDays className="w-5 h-5" aria-hidden="true" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-extrabold" style={{ color: INK }}>{t("dw.cta")}</span>
              <span className="block text-[12px] mt-0.5" style={{ color: MUTED }}>
                {t("dw.subtitle")}
              </span>
            </span>
            <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: GREEN }} aria-hidden="true" />
          </button>
        </section>
      )}

      {/* ── A few things to try ─────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-extrabold" style={{ fontFamily: "var(--font-display)", color: INK }}>{t("ov.tryThisWeek")}</h2>
          <button onClick={() => setActiveTab("plans")} className="hidden sm:inline-flex items-center gap-1 text-sm font-bold" style={{ color: GREEN }}>
            {t("ov.allPlans")} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {recommendations.map((r) => (
            <button key={r.title} onClick={() => setActiveTab(r.tab)} className="group text-left rounded-2xl p-5 transition hover:-translate-y-0.5" style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}`, boxShadow: "var(--shadow-sm)" }}>
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3" style={{ background: PASTEL[r.tone].soft, color: PASTEL[r.tone].ink }}>{r.icon}</span>
              <h3 className="text-[15px] font-extrabold leading-snug" style={{ color: INK }}>{r.title}</h3>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: MUTED }}>{r.desc}</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold mt-2.5" style={{ color: PASTEL[r.tone].ink }}>
                {t("ov.start")} <ChevronRight className="w-3.5 h-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Loop in your circle + check-in (trust + B2B2C entry) ────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button onClick={() => inviteGuardian("circle")} className={`${card} p-5 text-left flex items-center gap-4 transition hover:-translate-y-0.5`}>
          <span className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: GREEN_SOFT, color: GREEN }}><Share2 className="w-5 h-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold" style={{ color: INK }}>{t("ov.share.title")}</span>
            <span className="block text-xs mt-0.5" style={{ color: MUTED }}>{t("ov.share.desc")}</span>
          </span>
          <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: GREEN }} />
        </button>
        <button onClick={() => setActiveTab("screening")} className={`${card} p-5 text-left flex items-center gap-4 transition hover:-translate-y-0.5`}>
          <span className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: PASTEL.sky.soft, color: PASTEL.sky.ink }}><ClipboardCheck className="w-5 h-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold" style={{ color: INK }}>{t("ov.track.title", { name: firstName })}</span>
            <span className="block text-xs mt-0.5" style={{ color: MUTED }}>{t("ov.track.desc")}</span>
          </span>
          <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: PASTEL.sky.ink }} />
        </button>
      </section>

      {/* ── Your daily tools (secondary) — collapsed on phones, open on desktop ── */}
      <section className="pt-1">
        <button
          onClick={() => setShowTools((v) => !v)}
          className="lg:pointer-events-none w-full flex items-center justify-between mb-3"
          aria-expanded={showTools}
        >
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-faint)" }}>{t("ov.dailyTools")}</h2>
          <span className="lg:hidden inline-flex items-center gap-1 text-xs font-bold" style={{ color: GREEN }}>
            {showTools ? t("ov.tools.hide") : t("ov.tools.show")}
            <ChevronRight className={`w-4 h-4 transition-transform ${showTools ? "rotate-90" : ""}`} />
          </span>
        </button>
        <div className={`${showTools ? "" : "hidden"} lg:block`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DailyCheckinCard />
            <GoalsCard />
          </div>
          <div className="mt-4 space-y-4">
            <RemindersCard />
            <TrendsChart logs={behaviorLogs} milestonesPercent={milestonesPercent} />
          </div>
        </div>
      </section>

      {/* ── Quiet safety footer ─────────────────────────────────────────── */}
      <section className="rounded-[22px] p-5 md:p-6 flex flex-col sm:flex-row items-center gap-5" style={{ background: `linear-gradient(120deg,${GREEN_SOFT},var(--arbor-paper-deep))`, border: `1px solid ${RULE}` }}>
        <ParentChildIllustration size={80} className="flex-shrink-0" />
        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-base font-extrabold" style={{ fontFamily: "var(--font-display)", color: INK }}>{t("ov.safety.title")}</h3>
          <p className="text-sm mt-1" style={{ color: MUTED }}>{t("ov.safety.body")}</p>
        </div>
        <button onClick={() => setActiveTab("safety")} className="inline-flex items-center justify-center gap-2 font-bold text-sm rounded-2xl px-5 py-3 transition flex-shrink-0" style={{ background: "var(--arbor-paper-elevated)", color: GREEN, border: "1px solid rgba(52,178,119,0.30)" }}>
          <Phone className="w-4 h-4" /> {t("ov.safety.cta")}
        </button>
      </section>

      <QuickLogModal open={quickLog} onClose={() => setQuickLog(false)} />

      {/* CI-28: Goal Builder modal — opened from prompt card or Goals chip */}
      <GoalBuilderModal
        open={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        childName={firstName}
        activeGoals={activeGoals}
        concernId={onboardingConcernId}
        onSave={handleSaveGoals}
        behaviorLogs={behaviorLogs}
      />
    </motion.div>
  );
}
