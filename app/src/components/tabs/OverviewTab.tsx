import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  MessageSquare, Plus, RefreshCw, Sun, Sunrise, Moon, ArrowRight,
  Sparkles, RotateCw, CheckCircle, CalendarDays, ChevronRight,
} from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import { Skeleton } from "../ui/Skeleton";
import { StreakChip } from "../overview/StreakChip";
import { computeStreak } from "../../lib/streak";
import QuickLogModal from "../overview/QuickLogModal";
import RemindersCard from "../overview/RemindersCard";
import TrendsChart from "../overview/TrendsChart";
import GoalsCard from "../overview/GoalsCard";
import DailyCheckinCard from "../overview/DailyCheckinCard";
import DailyPlayCard from "../overview/DailyPlayCard";
import PrideMomentCard from "../overview/PrideMomentCard";
import { nextNudge } from "../../lib/jitai";
import { useTodaysFocus } from "../../hooks/useTodaysFocus";
import GoalBuilderPromptCard from "../practice/GoalBuilderPromptCard";
import GoalBuilderModal from "../practice/GoalBuilderModal";
import { PASTEL } from "../ui/kit";
import framework from "../../framework.json";
import { predictRhythm, hourLabel } from "../../rhythm/predict";
import { selectDailyPlay, concernDomainsFromLogs, daySeedFor, type ScoredActivity, type SessionLength } from "../../playbank/select";
import { computeDevScore } from "../../growth/devScore";
import { activeGoalDomains, type ActiveGoal } from "../../practice/goalBuilder";
import { playDomainLabel } from "../../playbank/content";
import { dayPartFor, type DayPart } from "../../lib/timeOfDay";

const DAY = 86_400_000;

// Token shorthands so the screen reads from one palette, not scattered literals.
const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const GREEN = "var(--arbor-green-ink)";
const GREEN_SOFT = "var(--arbor-green-soft)";
const RULE = "var(--arbor-rule)";

/**
 * TODAY — reconciled to the "Arbor Web App" prototype (claude.ai/design 6ddac523).
 *
 * The prototype's Today is four calm cards in two rows:
 *   Row 1 (1.6fr + 1fr): guidance hero · dev-map ring
 *   Row 2 (1fr+1fr+1fr) : kid-activity sync (span 2) · coach
 * Plus one well-timed JITAI nudge and the conditional goal-builder prompt.
 *
 * Everything else that used to live on Today (practice launcher, the duplicate
 * daily-play "spine", how-your-child-is-doing tiles, day-windows door, things-to-
 * try cards, loop-in-your-circle, safety footer) was REDUNDANT — each routes to a
 * capability that already has a home behind the sidebar (Growth, Care, Academy).
 * None was deleted; they were de-duplicated off the home screen so it reads as
 * deliberate, not scattered. See [[arbor-reskin-2035-webapp-branch]].
 */
export default function OverviewTab() {
  const {
    setActiveTab, milestones, milestonesPercent, checkedMilestones, totalMilestones,
    behaviorLogs, childProfile, setChatInput,
    donePlayIds, logPlayCompletion, playLogs,
    updateChild,
  } = useArbor();

  const { t, uiLang } = useLanguage();
  const { toast } = useToast();
  const [quickLog, setQuickLog] = useState(false);
  // The heavy "daily tools" dashboard (check-in, goals, reminders, trends) is
  // collapsed by default and revealed on tap; desktop (lg+) always shows it.
  const [showTools, setShowTools] = useState(false);
  // Today's focus can come back long; keep it to a glance with a Read-more.
  const [focusOpen, setFocusOpen] = useState(false);

  // CI-28: Goal Builder state. activeGoals lives on ChildProfile (parent-expressed
  // intent, not child assessment — gate §E arbor-safety review required before prod).
  const activeGoals: ActiveGoal[] = childProfile.activeGoals ?? [];
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalPromptDismissed, setGoalPromptDismissed] = useState(() => {
    try { return sessionStorage.getItem("arbor.ci28.promptDismissed") === "1"; }
    catch { return false; }
  });
  const dismissGoalPrompt = () => {
    setGoalPromptDismissed(true);
    try { sessionStorage.setItem("arbor.ci28.promptDismissed", "1"); } catch { /* ignore */ }
  };
  const handleSaveGoals = async (goals: ActiveGoal[]) => {
    await updateChild(childProfile.id, { activeGoals: goals });
    toast(t("ov.toast.focusSet"), "success");
    if (goals.length > 0) {
      setGoalPromptDismissed(true);
      try { sessionStorage.setItem("arbor.ci28.promptDismissed", "1"); } catch { /* ignore */ }
    }
  };
  const goalDomains = useMemo(() => activeGoalDomains(activeGoals), [activeGoals]);
  const onboardingConcernId = useMemo(() => {
    try { return localStorage.getItem("arbor.ci28.concernId") ?? undefined; }
    catch { return undefined; }
  }, []);

  const firstName = (childProfile.name || "your child").split(" ")[0];

  // ── Rhythm prediction + Daily Play pick (memory-driven) ──
  const rhythm = useMemo(
    () => predictRhythm(
      behaviorLogs.map((l) => ({ timestamp: l.timestamp, intensity: l.intensity })),
      Date.now(),
      { ageYears: childProfile.age }
    ),
    [behaviorLogs, childProfile.age]
  );

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
      goalDomains,
      recentlyDoneIds: donePlayIds,
      daySeed: daySeedFor(Date.now()),
      interests: childProfile.interests,
      sessionLength,
    }, 1);
    return picks[0] ?? null;
  }, [behaviorLogs, childProfile.age, childProfile.id, donePlayIds, goalDomains, sessionLength]);

  const streak = useMemo(
    () => computeStreak(
      [...behaviorLogs.map((l) => l.timestamp), ...playLogs.map((p) => p.timestamp)],
      Date.now(),
    ),
    [behaviorLogs, playLogs],
  );

  const coachOnPlay = (p: ScoredActivity) => {
    setChatInput(`We're going to try "${p.activity.title}" with ${firstName} today (it builds ${p.activity.domain}). How can I get the most out of it, and what should I watch for?`);
    setActiveTab("coach");
  };
  const markPlayDone = (p: ScoredActivity) => {
    logPlayCompletion(p, "today");
    toast(t("ov.toast.playDone", { name: firstName }), "success");
  };

  // ── Living, time-aware Today ──
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5 md:space-y-7 relative max-w-[1080px]"
    >
      {/* ── R3 — Milestone pride moment: a calm celebration on a new crossing
             (renders nothing when there is none) ── */}
      <PrideMomentCard />

      {/* ── PROTOTYPE GRID LAYOUT: Row 1 (2-col, 1.6fr + 1fr) ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
        {/* ── Guidance hero card (left, 1.6fr) — prototype gradient band carrying
               the FULL capability set: greeting, streak, trend, AI focus (expand +
               regenerate), Log Moment, Ask Arbor. */}
        <section
          className="rounded-[22px] overflow-hidden"
          style={{ background: "var(--arbor-paper-elevated)", boxShadow: "var(--shadow-lg)" }}
        >
          {/* Gradient hero band */}
          <div className="relative h-[176px] flex flex-col justify-between" style={{ background: "var(--arbor-hero-grad)", padding: "20px" }}>
            <div className="absolute inset-0" style={{ background: "radial-gradient(60% 80% at 86% 4%, rgba(255,255,255,0.34), transparent 60%)" }}></div>
            <Sparkles className="absolute right-[22px] bottom-[14px] text-[88px] opacity-[0.16]" style={{ color: "#fff", fontVariationSettings: "'FILL' 1" }} aria-hidden="true" />
            {/* Top row: eyebrow tag + trend chip */}
            <div className="relative flex items-center justify-between gap-2">
              <span className="inline-flex items-center text-[10px] font-extrabold uppercase tracking-wider" style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(4px)", color: "#fff", padding: "6px 12px", borderRadius: "20px", letterSpacing: "1.4px" }}>
                {heroEyebrow}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold flex-shrink-0" style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--arbor-paper-elevated)" }} /> {trendWord}
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
              <span className="text-[12px] font-medium text-right" style={{ color: "var(--arbor-muted)" }}>
                {firstName}, {t("ov.ageWord")} {childProfile.age}{childProfile.schoolContext ? ` · ${childProfile.schoolContext}` : ""}
              </span>
            </div>
            {/* AI focus recommendation well */}
            <div className="mt-3 min-h-[2.5rem]">
              {focusLoading && !focus ? (
                <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>
              ) : focus ? (
                <div>
                  <p className={`text-[15px] leading-relaxed font-medium ${focusOpen ? "" : "line-clamp-3"}`} style={{ color: "var(--arbor-ink)", textWrap: "pretty" } as React.CSSProperties}>{focus.text}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {focus.text.length > 160 && (
                      <button onClick={() => setFocusOpen((v) => !v)} className="text-[12px] font-bold inline-flex items-center min-h-[36px] px-1 transition" style={{ color: "var(--arbor-clay)" }}>
                        {focusOpen ? t("ov.focus.less") : t("ov.focus.more")}
                      </button>
                    )}
                    <button onClick={() => void regenerate()} disabled={focusLoading} title={t("ov.focus.regenerate")} aria-label={t("ov.focus.regenerate")} className="inline-flex items-center justify-center w-9 h-9 rounded-xl transition disabled:opacity-50" style={{ background: "var(--arbor-tint)", color: "var(--arbor-clay)" }}>
                      <RefreshCw className={`w-4 h-4 ${focusLoading ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>
              ) : recentCount > 0 ? (
                <p className="text-[15px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("ov.recoLoading", { name: firstName })}</p>
              ) : (
                <p className="text-[15px] leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{t("ov.recoEmpty", { name: firstName })}</p>
              )}
            </div>
            {/* Primary actions */}
            <div className="flex flex-wrap items-center gap-2.5 mt-4">
              <button onClick={() => setQuickLog(true)} aria-label={t("ov.logMoment")} className="inline-flex items-center gap-2 text-white font-extrabold text-[13px] rounded-xl px-5 py-3 transition active:scale-[0.98]" style={{ background: "var(--arbor-ink)", boxShadow: "0 8px 18px -6px rgba(20,34,90,0.5)" }}>
                <Plus className="w-4 h-4" /> {t("ov.logMoment")}
              </button>
              <button onClick={() => { if (focus) setChatInput(`About today: ${focus.text} What is one concrete thing I can do for ${firstName} today?`); setActiveTab("coach"); }} className="inline-flex items-center gap-2 font-bold text-[13px] rounded-xl px-4 py-3 transition" style={{ background: "var(--arbor-tint)", color: "var(--arbor-clay)" }}>
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
              style={{ background: "var(--arbor-paper-elevated)", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-clay)" }}>
                {t("devscore.overall")}
              </div>
              <div className="flex items-center gap-4 mt-3">
                <div className="relative w-[72px] h-[72px] rounded-full flex-none" style={{ background: `conic-gradient(var(--arbor-clay) 0 ${score.overall}%, var(--arbor-track) ${score.overall}% 100%)` }}>
                  <div className="absolute inset-1 m-auto w-[calc(100%-8px)] h-[calc(100%-8px)] rounded-full bg-white flex flex-col items-center justify-center">
                    <span className="text-[22px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{score.overall}%</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-extrabold leading-tight" style={{ color: "var(--arbor-ink)" }}>
                    {t("devscore.todayLine", { focus: focusLabel || t("devscore.todayLineSteady") })}
                  </div>
                  <div className="text-[11px] mt-1" style={{ color: "var(--arbor-faint)" }}>
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
        <section className="lg:col-span-2 rounded-[22px] p-5" style={{ background: "var(--arbor-paper-elevated)", boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center gap-2 mb-4">
            <RotateCw className="w-5 h-5" style={{ color: "var(--arbor-clay)", fontVariationSettings: "'FILL' 1" }} />
            <span className="text-[15px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("ov.reco.play.title")}</span>
            <span className="ml-auto text-[10px] font-extrabold rounded-full px-2.5 py-1" style={{ color: "var(--arbor-clay)", background: "var(--arbor-tint-2)" }}>
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
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--arbor-paper-deep)" }}>
                <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--arbor-tint)", color: "var(--arbor-clay)" }}>
                  <Sparkles className="w-5 h-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("ov.recoLoading", { name: firstName })}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: "var(--arbor-faint)" }}>{t("ov.play.desc")}</div>
                </div>
              </div>
            )}
            {/* Rhythm card */}
            {rhythm.confidence !== "none" && (
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--arbor-paper-deep)" }}>
                <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--arbor-tint)", color: "var(--arbor-clay-deep)" }}>
                  <CalendarDays className="w-5 h-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("dw.cta")}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: "var(--arbor-faint)" }}>{rhythm.frictionPeak ? t("rhythm.peak", { hour: hourLabel(rhythm.frictionPeak.hour) }) : t("rhythm.steady")}</div>
                </div>
                <CheckCircle className="w-5 h-5" style={{ color: "var(--arbor-success)" }} />
              </div>
            )}
          </div>
        </section>

        {/* ── Coach card (1 col) ──────────────────────────────────────────── */}
        <section
          onClick={() => { if (focus) setChatInput(`About today: ${focus.text} What is one concrete thing I can do for ${firstName} today?`); setActiveTab("coach"); }}
          className="rounded-[22px] p-5 flex flex-col transition hover:-translate-y-0.5 cursor-pointer"
          style={{ background: "var(--arbor-coach-grad)", boxShadow: "var(--shadow-sm)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-[46px] h-[46px] rounded-full flex items-center justify-center text-[16px] font-extrabold" style={{ background: "var(--arbor-avatar-grad)", color: "#fff" }}>
              {firstName.charAt(0)}
            </div>
            <div>
              <div className="text-[14px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("coach.title")}</div>
              <div className="text-[10px] font-extrabold" style={{ color: "var(--arbor-clay)" }}>{t("coach.online")}</div>
            </div>
          </div>
          <div className="text-[13px] leading-relaxed mt-3 flex-1" style={{ color: "var(--arbor-ink-soft)" }}>
            {t("coach.ready", { name: firstName })}
          </div>
          <button className="mt-4 bg-white text-center rounded-xl py-3 text-[13px] font-extrabold flex items-center justify-center gap-2" style={{ color: "var(--arbor-clay)" }}>
            <MessageSquare className="w-4 h-4" /> {t("ov.askArbor")}
          </button>
        </section>
      </div>

      {/* ── JITAI nudge — one well-timed nudge off the child's rhythm ──────── */}
      {nudge && (
        <section className="rounded-2xl p-4 flex flex-wrap items-center gap-3" style={{ background: PASTEL[nudge.tone].soft, border: `1px solid ${RULE}` }}>
          <span className="w-10 h-10 rounded-xl grid place-items-center flex-shrink-0" style={{ background: "var(--arbor-paper-elevated)", color: PASTEL[nudge.tone].ink }}>
            {nudge.kind === "calm" ? <Moon className="w-5 h-5" /> : nudge.kind === "log" ? <Plus className="w-5 h-5" /> : nudge.kind === "practice" ? <Sparkles className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
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

      {/* ── CI-28: Goal Builder prompt card (D3-D14 activation) ───────────── */}
      {activeGoals.length === 0 && !goalPromptDismissed && (
        <GoalBuilderPromptCard
          childName={firstName}
          onSetFocus={() => setGoalModalOpen(true)}
          onDismiss={dismissGoalPrompt}
        />
      )}

      {/* ── Your daily tools (secondary) — collapsed by default, open on desktop.
             Heavy dashboard (check-in, goals, reminders, trends) kept off the calm
             top of Today but one tap away. Each tool routes to a fuller home too. ── */}
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
