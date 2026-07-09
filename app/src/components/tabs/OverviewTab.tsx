import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Gamepad2, NotebookPen } from "lucide-react";
import Icon from "../ui/Icon";
import { HubHero } from "../ui/HubHero";
import { usePulses, pickCountKey } from "../../lib/pulse";
import { useKidMode } from "../kidmode/KidModeContext";
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
import { PASTEL, type PastelKey } from "../ui/kit";
import { predictRhythm, hourLabel } from "../../rhythm/predict";
import { selectDailyPlay, concernDomainsFromLogs, daySeedFor, type ScoredActivity, type SessionLength } from "../../playbank/select";
import { computeDevScore } from "../../growth/devScore";
import { activeGoalDomains, type ActiveGoal } from "../../practice/goalBuilder";
import { playDomainLabel } from "../../playbank/content";
import { dayPartFor, type DayPart } from "../../lib/timeOfDay";
import { usePrideMoment } from "../../hooks/usePrideMoment";

const DAY = 86_400_000;

// Token shorthands so the screen reads from one palette, not scattered literals.
const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const GREEN = "var(--arbor-green-ink)";
const GREEN_SOFT = "var(--arbor-green-soft)";
const RULE = "var(--arbor-rule)";

/**
 * TODAY — reconciled to the "Arbor Web App" prototype (claude.ai/design 6ddac523),
 * then choreographed by the Elevation Wave (E4 "Today as conductor", 2026-07-09).
 *
 * Conductor order (NOTHING dropped — grammar added around what exists):
 *   1. ONE time-aware HubHero — the rhythm engine picks the daily answer
 *      (calm/morning → today's play quest; wind-down/evening → 1-tap capture).
 *   2. Coach card.
 *   3. "The whole picture" — live mini-cards, one per remaining hub
 *      (behaviors · growth · academy · care · profile · kid mode), each showing
 *      its usePulses() line and deep-linking into the hub.
 *   4. Everything that was already here keeps rendering below, unchanged:
 *      guidance hero + dev-map count card, kid-activity sync feed, JITAI nudge,
 *      goal-builder prompt, and the YOUR-DAILY-TOOLS disclosure.
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
    dayPart === "morning" ? { text: t("ov.greeting.morning"), icon: <Icon name="wb_twilight" size={16} /> }
    : dayPart === "afternoon" ? { text: t("ov.greeting.afternoon"), icon: <Icon name="light_mode" size={16} /> }
    : { text: t("ov.greeting.evening"), icon: <Icon name="bedtime" size={16} /> };
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

  // ── Loops 1+3+5 — kid-originated + parent-logged events from the ONE shared
  //    child profile, unified into a single live activity feed. These are real
  //    timestamped reads of the same profile the kid app writes to:
  //    · playLogs        = quest / Daily Play completions (the kid's stars/streak window)
  //    · behaviorLogs    = parent-logged moments
  //    · milestone cross  = a freshly-noticed milestone (Loop-5 growth story)
  //    Every row is a neutral/positive fact — never a score, verdict, or trend. */
  const { crossing: milestoneCrossing } = usePrideMoment();

  type FeedRow = {
    id: string;
    at: number;
    icon: React.ReactNode;
    tone: { soft: string; ink: string };
    title: string;
    sub: string;
  };

  const activityFeed: FeedRow[] = useMemo(() => {
    const rows: FeedRow[] = [];
    const fmtTime = (ms: number) =>
      new Date(ms).toLocaleTimeString(uiLang === "he" ? "he-IL" : "en-US", { hour: "numeric", minute: "2-digit" });

    // Kid-side quest / play completions (Loop 3 — stars/streak window)
    for (const p of playLogs) {
      const at = new Date(p.timestamp).getTime();
      rows.push({
        id: `play.${p.id}`,
        at,
        icon: <Icon name="sports_esports" size={21} />,
        tone: { soft: "var(--arbor-tint)", ink: "var(--arbor-clay)" },
        title: t("today.feed.played", { title: p.title }),
        sub: t("today.feed.playedSub", { domain: playDomainLabel(p.domain, uiLang === "he" ? "he" : "en") }),
      });
    }
    // Parent-logged moments (Loop 1 window — emotional/behavioral signal)
    for (const l of behaviorLogs) {
      const at = new Date(l.timestamp).getTime();
      rows.push({
        id: `beh.${l.id}`,
        at,
        icon: <Icon name="edit_note" size={21} />,
        tone: { soft: PASTEL.lav.soft, ink: PASTEL.lav.ink },
        title: t("today.feed.logged"),
        sub: t("today.feed.loggedSub", { context: l.context ?? t("ov.logMoment"), time: fmtTime(at) }),
      });
    }
    // A freshly-noticed milestone (Loop 5 — growth story). No timestamp on
    // milestones, so it floats to the top when present.
    if (milestoneCrossing) {
      rows.push({
        id: "milestone.crossing",
        at: Date.now(),
        icon: <Icon name="workspace_premium" size={21} fill={1} />,
        tone: { soft: GREEN_SOFT, ink: GREEN },
        title: t("today.feed.noticed"),
        // Firewall-safe: a calm factual sub, never the threshold/score that
        // triggered the crossing. The crossing object intentionally carries no
        // verdict text — we surface only the parent-observation framing.
        sub: t("devscore.mechanism.short"),
      });
    }
    return rows.sort((a, b) => b.at - a.at).slice(0, 4);
  }, [playLogs, behaviorLogs, milestoneCrossing, t, uiLang]);

  // The "Live" pill reflects REAL recent activity (last 48h), not a static label.
  const hasRecentActivity = useMemo(
    () => activityFeed.some((r) => r.at >= Date.now() - 2 * DAY),
    [activityFeed]
  );

  // ── Dev-footer COUNT stats (clinical firewall: counts only, never a %/verdict) ──
  const devStats = useMemo(() => {
    const focus = activeGoals.length; // parent-expressed goals, never weakest-domain
    const domainsWithProgress = new Set(
      milestones.filter((m) => m.checked).map((m) => m.domain)
    ).size; // domains where a milestone has been noticed (count of 7)
    const weekActivity =
      behaviorLogs.filter((l) => new Date(l.timestamp).getTime() >= Date.now() - 7 * DAY).length +
      playLogs.filter((p) => new Date(p.timestamp).getTime() >= Date.now() - 7 * DAY).length;
    return { focus, domains: domainsWithProgress, week: weekActivity };
  }, [activeGoals.length, milestones, behaviorLogs, playLogs]);

  // ── E4 · Today as conductor — time-aware hero + family-system mini-cards ──
  const pulses = usePulses();
  const { openKidMode } = useKidMode();

  // The daily answer, picked off the signals this file ALREADY computes:
  // evening (dayPart) or a rhythm-known wind-down that has started → capture;
  // otherwise (morning / calm window) → today's play quest.
  const heroMode: "play" | "capture" = useMemo(() => {
    const nowHour = new Date().getHours();
    const windDownStarted =
      rhythm.confidence !== "none" && rhythm.windDownHour != null && nowHour >= rhythm.windDownHour;
    return dayPart === "evening" || windDownStarted ? "capture" : "play";
  }, [rhythm, dayPart]);

  const playsToday = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return playLogs.filter((p) => new Date(p.timestamp).getTime() >= start.getTime()).length;
  }, [playLogs]);
  // Counts only (clinical firewall): captured today / this week / story total.
  // Brand rule: no streak framing on the hero — a "0 day streak" is a guilt
  // mechanic, the opposite of Arbor's no-pressure positioning. The trio's third
  // number is the monotonic album size (only ever grows).
  const capturedToday = loggedTodayCount + playsToday;
  const momentsTotal = behaviorLogs.length + playLogs.length;

  // Kid Mode pulse: quest completions today (playLogs is the kid's quest log).
  const kidPulse =
    playsToday > 0
      ? t(pickCountKey("elev.pulse.kidmode.quests", playsToday), { count: playsToday })
      : t("elev.pulse.kidmode.empty");

  // One live mini-card per remaining hub — pulse line + deep link (kid mode
  // opens the overlay; every other card lands on the hub's primary tab).
  const familyCards: Array<{
    id: string; glyph: string; tone: PastelKey; label: string; pulse: string; onOpen: () => void;
  }> = [
    { id: "behaviors", glyph: "monitoring", tone: "sky", label: t("elev.today.hub.behaviors"), pulse: t(pulses.behaviors.key, pulses.behaviors.params), onOpen: () => setActiveTab("behaviors") },
    { id: "growth", glyph: "eco", tone: "mint", label: t("elev.today.hub.growth"), pulse: t(pulses.growth.key, pulses.growth.params), onOpen: () => setActiveTab("development") },
    { id: "academy", glyph: "school", tone: "yellow", label: t("elev.today.hub.academy"), pulse: t(pulses.academy.key, pulses.academy.params), onOpen: () => setActiveTab("masterclasses") },
    { id: "care", glyph: "diversity_1", tone: "pink", label: t("elev.today.hub.care"), pulse: t(pulses.care.key, pulses.care.params), onOpen: () => setActiveTab("consult") },
    { id: "profile", glyph: "person", tone: "lav", label: t("elev.today.hub.profile"), pulse: t(pulses.profile.key, pulses.profile.params), onOpen: () => setActiveTab("profile") },
    { id: "kidmode", glyph: "sports_esports", tone: "coral", label: t("elev.today.hub.kidmode"), pulse: kidPulse, onOpen: openKidMode },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5 md:space-y-7 relative max-w-[1080px]"
    >
      {/* ── E4 zone 1 — ONE time-aware hero: the rhythm engine's daily answer.
             Counts only in the stat trio (clinical firewall). HubHero gates its
             own entrance on prefers-reduced-motion. ── */}
      {heroMode === "play" ? (
        <HubHero
          tone="mint"
          icon={Gamepad2}
          eyebrow={t("elev.hero.today.play.eyebrow")}
          title={t("elev.hero.today.play.title", { name: firstName })}
          subtitle={t(pulses.today.key, pulses.today.params)}
          cta={{
            label: t("elev.hero.today.play.cta"),
            onClick: () => setActiveTab("daily-play"),
            icon: <Icon name="sports_esports" size={18} />,
            testId: "today-hero-cta",
          }}
          stats={[
            { value: capturedToday, label: t("elev.hero.today.stat.captured") },
            { value: devStats.week, label: t("elev.hero.today.stat.week") },
            { value: momentsTotal, label: t("elev.hero.today.stat.story") },
          ]}
          testId="today-hero"
        />
      ) : (
        <HubHero
          tone="lav"
          icon={NotebookPen}
          eyebrow={t("elev.hero.today.capture.eyebrow")}
          title={t("elev.hero.today.capture.title")}
          subtitle={t(pulses.today.key, pulses.today.params)}
          cta={{
            label: t("elev.hero.today.capture.cta"),
            onClick: () => setActiveTab("journal"),
            icon: <Icon name="edit_note" size={18} />,
            testId: "today-hero-cta",
          }}
          stats={[
            { value: capturedToday, label: t("elev.hero.today.stat.captured") },
            { value: devStats.week, label: t("elev.hero.today.stat.week") },
            { value: momentsTotal, label: t("elev.hero.today.stat.story") },
          ]}
          testId="today-hero"
        />
      )}

      {/* ── R3 — Milestone pride moment: a calm celebration on a new crossing
             (renders nothing when there is none) ── */}
      <PrideMomentCard />

      {/* ── E4 zone 2 — Coach card (moved up from the old Row-2 grid, unchanged) ── */}
      <section
        onClick={() => { if (focus) setChatInput(`About today: ${focus.text} What is one concrete thing I can do for ${firstName} today?`); setActiveTab("coach"); }}
        className="rounded-[22px] p-5 flex flex-col transition motion-safe:hover:-translate-y-0.5 cursor-pointer"
        style={{ background: "var(--arbor-coach-grad)", boxShadow: "var(--shadow-sm)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-[46px] h-[46px] rounded-full flex items-center justify-center text-[16px] font-extrabold" style={{ background: "var(--arbor-avatar-grad)", color: "#fff" }}>
            {firstName.charAt(0)}
          </div>
          <div>
            <div className="text-[14px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("coach.title")}</div>
            <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold" style={{ color: "var(--arbor-clay)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--arbor-success)" }} /> {t("coach.online")}
            </div>
          </div>
        </div>
        <div className="text-[13px] leading-relaxed mt-3 flex-1" style={{ color: "var(--arbor-ink-soft)" }}>
          {t("coach.ready", { name: firstName })}
        </div>
        <button className="mt-4 bg-white text-center rounded-xl py-3 min-h-[44px] text-[13px] font-extrabold flex items-center justify-center gap-2" style={{ color: "var(--arbor-clay)" }}>
          <Icon name="forum" size={18} /> {t("today.coach.reply")}
        </button>
      </section>

      {/* ── E4 zone 3 — "The whole picture": live mini-cards, one per remaining
             hub, each carrying its usePulses() line (counts / plain activity
             facts only) and deep-linking into the hub. ── */}
      <section aria-labelledby="ov-family-heading">
        <div className="mb-3">
          <h2 id="ov-family-heading" className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-faint)" }}>
            {t("elev.today.family.title")}
          </h2>
          <p className="text-[12px] mt-0.5" style={{ color: MUTED }}>{t("elev.today.family.sub")}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {familyCards.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={c.onOpen}
              className="flex items-center gap-3 rounded-[22px] p-4 text-start transition motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.99]"
              style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}`, boxShadow: "var(--shadow-sm)", minHeight: 72 }}
            >
              <span className="w-11 h-11 rounded-xl flex items-center justify-center flex-none" style={{ background: PASTEL[c.tone].soft, color: PASTEL[c.tone].ink }}>
                <Icon name={c.glyph} size={22} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-extrabold" style={{ color: INK }}>{c.label}</span>
                <span className="block text-[12px] mt-0.5 leading-snug truncate" style={{ color: MUTED }}>{c.pulse}</span>
              </span>
              <Icon name="chevron_right" size={18} className="flex-none rtl:-scale-x-100" style={{ color: PASTEL[c.tone].ink }} />
            </button>
          ))}
        </div>
      </section>

      {/* ── PROTOTYPE GRID LAYOUT: Row 1 (2-col, 1.6fr + 1fr) ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
        {/* ── Guidance hero card (left, 1.6fr) — prototype gradient band carrying
               the FULL capability set: greeting, streak, trend, AI focus (expand +
               regenerate), Log Moment, Ask Arbor. */}
        <section
          className="rounded-[22px] overflow-hidden"
          style={{ background: "var(--arbor-paper-elevated)", boxShadow: "var(--shadow-lg)" }}
        >
          {/* Gradient hero band — 188px guidance-briefing band with a top-down
              legibility scrim so the title reads on a calm base over the gradient. */}
          <div className="relative h-[188px]" style={{ background: "var(--arbor-hero-grad)" }}>
            <div className="absolute inset-0" style={{ background: "radial-gradient(60% 80% at 86% 4%, rgba(255,255,255,0.34), transparent 60%)" }}></div>
            <Icon name="self_improvement" size={92} fill={1} className="absolute bottom-[14px]" style={{ color: "rgba(255,255,255,0.16)", insetInlineEnd: 22 }} />
            {/* Legibility scrim: darken from the bottom up so text sits on a readable base */}
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(13,28,52,0.5), transparent 64%)" }} aria-hidden="true"></div>
            <div className="relative h-full flex flex-col justify-between" style={{ padding: "20px" }}>
            {/* Top row: eyebrow tag + trend chip */}
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center text-[10px] font-extrabold uppercase tracking-wider" style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(4px)", color: "#fff", padding: "6px 12px", borderRadius: "20px", letterSpacing: "1.4px" }}>
                {heroEyebrow}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold flex-shrink-0" style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--arbor-paper-elevated)" }} /> {trendWord}
              </span>
            </div>
            {/* Greeting + pulse */}
            <div>
              <span className="inline-flex items-center gap-1.5 text-[12px] font-bold" style={{ color: "rgba(255,255,255,0.92)" }}>
                {greeting.icon} {greeting.text}
              </span>
              <h1 className="text-[27px] leading-[1.12] mt-1" style={{ color: "#fff", maxWidth: "88%", letterSpacing: "-0.4px", fontFamily: "var(--font-display)", fontWeight: 700, textWrap: "balance" } as React.CSSProperties}>
                {pulse}
              </h1>
            </div>
            </div>
          </div>
          {/* Meta footer row — reads as a guidance briefing: duration/one-action
              microcopy + a single dark "Begin" CTA that drops into today's focus. */}
          <div className="flex items-center justify-between gap-3 px-5 py-[14px]" style={{ borderBottom: `1px solid ${RULE}` }}>
            <span className="inline-flex items-center gap-2 text-[13px] font-bold" style={{ color: "var(--arbor-faint)" }}>
              <Icon name="schedule" size={18} /> {t("today.meta")}
            </span>
            <button
              onClick={() => { if (focus) setChatInput(`About today: ${focus.text} What is one concrete thing I can do for ${firstName} today?`); setActiveTab("coach"); }}
              className="inline-flex items-center gap-1.5 text-white font-extrabold text-[13px] rounded-xl px-5 py-2.5 transition active:scale-[0.98]"
              style={{ background: "var(--arbor-ink)", boxShadow: "0 8px 18px -6px rgba(20,34,90,0.5)" }}
            >
              {t("today.begin")} <Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" />
            </button>
          </div>
          {/* Action band: streak + name row → AI focus recommendation → primary CTAs */}
          <div className="px-5 pb-5 pt-4">
            <div className="flex items-center justify-between gap-3">
              <StreakChip days={streak.current} lang={uiLang === "he" ? "he" : "en"} />
              <span className="text-[12px] font-medium text-end" style={{ color: "var(--arbor-muted)" }}>
                {firstName}, {t("ov.ageWord")} {childProfile.age}{childProfile.schoolContext ? ` · ${childProfile.schoolContext}` : ""}
              </span>
            </div>
            {/* AI focus recommendation well */}
            <div className="mt-3 min-h-[2.5rem]">
              {focusLoading && !focus ? (
                <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>
              ) : focus ? (
                <div>
                  <p className={`text-[16.5px] leading-relaxed ${focusOpen ? "" : "line-clamp-3"}`} style={{ color: "var(--arbor-ink)", textWrap: "pretty", fontFamily: uiLang === "he" ? undefined : "var(--font-editorial)", fontWeight: uiLang === "he" ? 500 : 400 } as React.CSSProperties}>{focus.text}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {focus.text.length > 160 && (
                      <button onClick={() => setFocusOpen((v) => !v)} className="text-[12px] font-bold inline-flex items-center min-h-[36px] px-1 transition" style={{ color: "var(--arbor-clay)" }}>
                        {focusOpen ? t("ov.focus.less") : t("ov.focus.more")}
                      </button>
                    )}
                    <button onClick={() => void regenerate()} disabled={focusLoading} title={t("ov.focus.regenerate")} aria-label={t("ov.focus.regenerate")} className="inline-flex items-center justify-center w-9 h-9 rounded-xl transition disabled:opacity-50" style={{ background: "var(--arbor-tint)", color: "var(--arbor-clay)" }}>
                      <Icon name="refresh" size={18} className={focusLoading ? "animate-spin" : undefined} />
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
                <Icon name="add" size={18} /> {t("ov.logMoment")}
              </button>
              <button onClick={() => { if (focus) setChatInput(`About today: ${focus.text} What is one concrete thing I can do for ${firstName} today?`); setActiveTab("coach"); }} className="inline-flex items-center gap-2 font-bold text-[13px] rounded-xl px-4 py-3 transition" style={{ background: "var(--arbor-tint)", color: "var(--arbor-clay)" }}>
                <Icon name="forum" size={18} /> {t("ov.askArbor")}
              </button>
            </div>
          </div>
        </section>

        {/* ── Dev map card (right, 1fr) ────────────────────────────────────────
            Wave-3 clinical subtraction (2026-06-26): the prior conic-gradient
            ring + `score.overall`% + "Worth nurturing next: {focusDomain}"
            rendered a 0–100 per-child verdict + a deficit pointer (the lowest-
            scoring domain). Both are forbidden by the CI-22/23/24 firewall. The
            card now shows a flat parent-checked milestone count + a developmental
            mechanism line + provenance — same surface, no verdict. */}
        {(() => {
          const score = computeDevScore(milestones.map((m) => ({ domain: m.domain, checked: m.checked })));
          if (score.confidence === "none") return null;
          return (
            <section
              onClick={() => setActiveTab("development")}
              className="rounded-[22px] p-5 flex flex-col transition hover:-translate-y-0.5 cursor-pointer"
              style={{ background: "var(--arbor-paper-elevated)", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-clay)" }}>
                {t("devscore.eyebrow")}
              </div>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex-none w-[72px] h-[72px] rounded-full flex flex-col items-center justify-center" style={{ background: "var(--arbor-green-soft)" }}>
                  <span className="text-[18px] font-extrabold leading-none" style={{ color: "var(--arbor-green-ink)" }}>{checkedMilestones}</span>
                  <span className="text-[10px] font-bold mt-1" style={{ color: "var(--arbor-green-ink)" }}>{t("devscore.noticed.short")}</span>
                </div>
                <div className="flex-1 min-w-0">
                  {/* Bold lead + one muted sub (scans like the design's summary). */}
                  <div className="text-[14px] font-extrabold leading-tight" style={{ color: "var(--arbor-ink)" }}>
                    {t("devscore.noticed", { reached: checkedMilestones, total: totalMilestones })}
                  </div>
                  <div className="text-[11.5px] mt-1.5 leading-relaxed" style={{ color: "var(--arbor-faint)" }}>
                    {t("devscore.mechanism.short")}
                  </div>
                </div>
              </div>
              {/* COUNT-based 3-stat footer (clinical firewall: counts only — no
                  0–100 ring, no per-domain %, no on-track verdict, no weakest-domain
                  pointer). Focus = parent-expressed goals; Domains = domains with a
                  noticed milestone (of 7); This week = moments noticed in 7d. */}
              <div className="flex gap-2 mt-auto pt-4">
                {([
                  { v: devStats.focus, label: t("devscore.stat.focus"), ink: "var(--arbor-clay)" },
                  { v: devStats.domains, label: t("devscore.stat.domains"), ink: "var(--arbor-green-ink)" },
                  { v: devStats.week, label: t("devscore.stat.week"), ink: "var(--arbor-clay-deep)" },
                ] as const).map((s) => (
                  <div key={s.label} className="flex-1 rounded-xl py-2.5 text-center" style={{ background: "var(--arbor-paper-deep)" }}>
                    <div className="text-[17px] font-extrabold leading-none" style={{ color: s.ink }}>{s.v}</div>
                    <div className="text-[9.5px] font-bold mt-1.5" style={{ color: "var(--arbor-faint)" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </section>
          );
        })()}
      </div>

      {/* ── Kid activity sync card (full width — its old Row-2 neighbor, the
             coach card, now renders in E4 zone 2 above) ─────────────────────── */}
        <section className="rounded-[22px] p-5" style={{ background: "var(--arbor-paper-elevated)", boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Icon name="sync_alt" size={20} fill={1} style={{ color: "var(--arbor-clay)" }} />
            <span className="text-[15px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("ov.reco.play.title")}</span>
            {/* Live pill reflects REAL recent activity (kid + parent events in 48h). */}
            {hasRecentActivity && (
              <span className="ms-auto inline-flex items-center gap-1.5 text-[10px] font-extrabold rounded-full px-2.5 py-1" style={{ color: "var(--arbor-clay)", background: "var(--arbor-tint-2)" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--arbor-clay)" }} /> {t("today.live")}
              </span>
            )}
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
                  <Icon name="auto_awesome" size={20} fill={1} />
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
                  <Icon name="calendar_month" size={20} fill={1} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("dw.cta")}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: "var(--arbor-faint)" }}>{rhythm.frictionPeak ? t("rhythm.peak", { hour: hourLabel(rhythm.frictionPeak.hour) }) : t("rhythm.steady")}</div>
                </div>
                <Icon name="check_circle" size={20} fill={1} style={{ color: "var(--arbor-success)" }} />
              </div>
            )}
            {/* ── Unified ActivityRow feed (Loops 1+3+5) — kid quest/play
                  completions, parent-logged moments and a noticed milestone, all
                  in one row grammar: icon-tile + title/sub + trailing status. */}
            {activityFeed.map((row) => (
              <div key={row.id} className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-none" style={{ background: row.tone.soft, color: row.tone.ink }}>
                  {row.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-extrabold truncate" style={{ color: "var(--arbor-ink)" }}>{row.title}</div>
                  <div className="text-[11px] mt-0.5 truncate" style={{ color: "var(--arbor-faint)" }}>{row.sub}</div>
                </div>
                <Icon name="check_circle" size={20} fill={1} className="flex-none" style={{ color: "var(--arbor-success)" }} />
              </div>
            ))}
          </div>
        </section>

      {/* ── JITAI nudge — one well-timed nudge off the child's rhythm ──────── */}
      {nudge && (
        <section className="rounded-2xl p-4 flex flex-wrap items-center gap-3" style={{ background: PASTEL[nudge.tone].soft, border: `1px solid ${RULE}` }}>
          <span className="w-10 h-10 rounded-xl grid place-items-center flex-shrink-0" style={{ background: "var(--arbor-paper-elevated)", color: PASTEL[nudge.tone].ink }}>
            {nudge.kind === "calm" ? <Icon name="bedtime" size={20} fill={1} /> : nudge.kind === "log" ? <Icon name="add" size={20} /> : <Icon name="auto_awesome" size={20} fill={1} />}
          </span>
          <div className="flex-1 min-w-[200px]">
            <p className="text-[15px] font-extrabold" style={{ color: INK }}>{t(nudge.headlineKey, nudge.vars)}</p>
            <p className="text-[13px] mt-0.5 leading-snug" style={{ color: MUTED }}>{t(nudge.bodyKey, nudge.vars)}</p>
          </div>
          <button onClick={onNudge} className="inline-flex items-center justify-center gap-1.5 font-bold text-sm rounded-full px-4 min-h-[44px] flex-shrink-0 text-white transition active:scale-[0.98]" style={{ background: PASTEL[nudge.tone].ink }}>
            {t(nudge.ctaKey, nudge.vars)} <Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" />
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
            <Icon name="chevron_right" size={18} className={`transition-transform rtl:-scale-x-100 ${showTools ? "rotate-90" : ""}`} />
          </span>
        </button>
        <div className={`${showTools ? "" : "hidden"} lg:block`}>
          {/* UC-4: Day Windows + Reminders surfaced as Today dashboard cards —
              quick doors into the same routes the Today hub's contextual pills expose. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {([
              { tab: "day-windows" as const, glyph: "calendar_month", title: t("today.card.windows.title"), desc: t("today.card.windows.desc") },
              { tab: "smart-reminders" as const, glyph: "notifications", title: t("today.card.reminders.title"), desc: t("today.card.reminders.desc") },
            ]).map((c) => (
              <button
                key={c.tab}
                type="button"
                onClick={() => setActiveTab(c.tab)}
                className="flex items-center gap-3 rounded-[22px] p-5 text-start transition hover:-translate-y-0.5"
                style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}`, boxShadow: "var(--shadow-sm)", minHeight: 72 }}
              >
                <span className="w-11 h-11 rounded-xl flex items-center justify-center flex-none" style={{ background: GREEN_SOFT, color: GREEN }}>
                  <Icon name={c.glyph} size={22} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-extrabold" style={{ color: INK }}>{c.title}</span>
                  <span className="block text-[12px] mt-0.5 leading-snug" style={{ color: MUTED }}>{c.desc}</span>
                </span>
                <Icon name="chevron_right" size={18} className="flex-none rtl:-scale-x-100" style={{ color: GREEN }} />
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DailyCheckinCard />
            <GoalsCard />
          </div>
          <div className="mt-4 space-y-4">
            <RemindersCard />
            <TrendsChart logs={behaviorLogs} />
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
