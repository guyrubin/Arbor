import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import DailyCheckinCard from "../overview/DailyCheckinCard";
import DailyPlayCard from "../overview/DailyPlayCard";
import QuickCaptureBar from "../overview/QuickCaptureBar";
import TodayRecommendation from "../overview/TodayRecommendation";
import TodayActionLoop from "../overview/TodayActionLoop";
import HardMomentTodayOffer from "../overview/HardMomentTodayOffer";
import ProgressNarrative from "../overview/ProgressNarrative";
import QuickLogModal from "../overview/QuickLogModal";
import SinceLastVisit, { svString } from "../overview/SinceLastVisit";
import PromptCaptureCard from "../overview/PromptCaptureCard";
import { ErrorState } from "../ui/ErrorState";
import ArborNoticedCard from "../sections/ArborNoticedCard";
import type { CaptureMode } from "../../context/ArborContext";
import { useTodaysFocus } from "../../hooks/useTodaysFocus";
import { useLastVisit } from "../../hooks/useLastVisit";
import { PASTEL } from "../ui/kit";
import { predictRhythm, hourLabel } from "../../rhythm/predict";
import { selectDailyPlay, concernDomainsFromLogs, daySeedFor, type ScoredActivity, type SessionLength } from "../../playbank/select";
import { useDevScore } from "../../hooks/useDevScore";
import { useMonitoring } from "../../hooks/useMonitoring";
import { pickHighestWatchSignal } from "../../lib/monitoring";
import { activeGoalDomains, type ActiveGoal } from "../../practice/goalBuilder";
import { playDomainLabel } from "../../playbank/content";
import { usePrideMoment } from "../../hooks/usePrideMoment";
import { focusHeadlineFrom } from "../../lib/todayFocus";
import { dailyPromptKeys } from "../../lib/promptBank";
import { buildSinceVisitRows, type SinceVisitRow } from "../overview/sinceVisitEvents";
import { chooseTodayAction } from "../overview/chooseTodayAction";
import { resolveTodayModules } from "../overview/todayModules";
import FirstStepsRail, { useFirstStepsRail } from "../onboarding/FirstStepsRail";
import { track } from "../../lib/analytics";

const DAY = 86_400_000;

// Token shorthands so the screen reads from one palette, not scattered literals.
const GREEN = "var(--arbor-green-ink)";
const GREEN_SOFT = "var(--arbor-green-soft)";

/**
 * TODAY — one integrated loop, not stacked widgets (TODAY-2/CODEX-1), now under
 * the W1 Rule-A budget (masterplan 2026-08-11): ≤5 visible modules and exactly
 * ONE primary action above the fold, on every open.
 *
 * What renders now (top → bottom):
 *   Quick Capture bar (W6.2/TODAY-4): ambient capture chrome — first in the
 *       DOM, pinned bottom on phones, inline on lg+.
 *   Row 1 (1.85fr / 0.85fr) — FIRST, so the day's action clears the fold: the
 *       GUARANTEED action in the left slot — the chooseTodayAction chain picks
 *       exactly one of:
 *         loop (accepted action) → focus hero (+why-line) → promptBank capture
 *         card (+why-line) → Daily Play promotion → bare capture card.
 *       · Development-Map count card (→ Growth) on the right.
 *   SinceLastVisit (W1 1.1): returning parents only — warm greeting + ≤3
 *       tappable EVENT rows since the previous visit (+N more in Journal),
 *       with the "Arbor remembers" count line as its footer. Continuity lines
 *       collapse INTO this strip (Rule A), incl. the ArborNoticed fold.
 *   FirstStepsRail (E11): the 4-step start path for genuinely new accounts.
 *   Arbor Noticed (DUX-011): the highest watch signal; never on day-0, and it
 *       FOLDS into a SinceLastVisit row when the budget is spent.
 *   Progress narrative: retrospective picture + the ONE evidence surface.
 *   More (collapsed disclosure): the activity feed, the Daily Play section
 *       when the budget displaces it, and the wellness check-in.
 *   Day-0 (no data, first visit): header + capture bar + primary action + the
 *       first-steps rail ONLY — no picture, no play, no watch signal.
 *
 * FOLD ORDER (P1-A, 2026-08-12 audit). The since-strip and the first-steps rail
 * both used to sit ABOVE the anchor row (the rail was even mounted by Shell,
 * outside this file's budget), which pushed the single primary CTA to y≈1224 on
 * a 1280×900 desktop open and y≈1697 on a 375×812 phone. Rule A is not "one
 * primary action somewhere on the page" — it is one primary action ABOVE THE
 * FOLD. Nothing may outrank the day's action, so continuity and onboarding both
 * moved below it. The "continuing where we left off" framing survives as the
 * anchor's own eyebrow.
 *
 * MODULE BUDGET: overview/todayModules.ts resolves which modules render from
 * their REAL render conditions. It must never be fed a content-governance gate
 * (see P1-B in that file) — a governed array going empty may change what a
 * module says, never how many modules Today shows.
 *
 * CLINICAL FIREWALL: every child-data surface here shows COUNTS ONLY — never a
 * %, 0–100 score, verdict/status tag, percentile or deficit pointer. The
 * since-visit strip is EVENT language only — never comparative/trend wording.
 */
export default function OverviewTab() {
  const {
    setActiveTab, milestones, milestonesPercent, checkedMilestones, totalMilestones,
    behaviorLogs, childProfile, seedCoach,
    donePlayIds, logPlayCompletion, playLogs, requestCapture, setShowAiRail, actionLoop,
    activeTodayAction, acceptTodayAction, requestJournalFocus, conversations,
  } = useArbor();

  const { t, uiLang } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  // The ONE shared dev-score derivation (hooks/useDevScore) — the same result
  // the Development hub and the other picture surfaces read. Hoisted here
  // because the dev-map card below renders it inside a JSX callback.
  const devScore = useDevScore();
  // Rule A: the disclosure is a SECONDARY drawer now (feed + displaced play +
  // wellness check-in) — collapsed by default so Today stays ≤5 modules.
  const [showTools, setShowTools] = useState(false);
  // W6.2 ambient capture — text mode opens the existing QuickLogModal inline
  // (the parent never leaves Today); voice/photo hand the mode to the SAME
  // requestCapture() seam JournalTab's compose tiles use (BehaviorsTab consumes
  // it once and opens the real mic/photo flow). No new capture path.
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const startCapture = (mode: CaptureMode) => {
    requestCapture(mode);
    setActiveTab("behaviors");
  };

  // Parent-expressed goals (not a child assessment). Feed Daily Play selection
  // and the dev-map "Focus" count; goal editing itself lives in Growth › Daily Play.
  const activeGoals: ActiveGoal[] = childProfile.activeGoals ?? [];
  const goalDomains = useMemo(() => activeGoalDomains(activeGoals), [activeGoals]);

  const firstName = (childProfile.name || "your child").split(" ")[0];
  const parentFirstName = (user?.displayName || t("nav.parent")).split(" ")[0];

  // ── W1 1.1: two-slot visit tracking (mounted ONCE, here) ──
  const { previousVisitAt, isReturning } = useLastVisit(childProfile);

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

  const latestCompletedAction = useMemo(
    () => actionLoop.find((entry) => entry.status === "completed" && entry.outcome),
    [actionLoop]
  );

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
      // W2.5: continuation weighting from the parent's own reported outcome.
      lastAction: latestCompletedAction?.outcome
        ? { recommendation: latestCompletedAction.recommendation, outcome: latestCompletedAction.outcome }
        : undefined,
    }, 1);
    return picks[0] ?? null;
  }, [behaviorLogs, childProfile.age, childProfile.id, donePlayIds, goalDomains, sessionLength, latestCompletedAction]);

  // AIX-S4: seeds go through i18n (seed.*) — HE parents see Hebrew in the chat box.
  const coachOnPlay = (p: ScoredActivity) => {
    seedCoach({ prompt: t("seed.play", { title: p.activity.title, name: firstName, domain: p.activity.domain }), source: "today-play" });
  };
  const markPlayDone = (p: ScoredActivity) => {
    logPlayCompletion(p, "today");
    toast(t("ov.toast.playDone", { name: firstName }), "success");
  };

  // ── Today's AI focus — "the one thing that matters today" (the hero title) ──
  const recentCount = useMemo(
    () => behaviorLogs.filter((l) => new Date(l.timestamp).getTime() >= Date.now() - 7 * DAY).length,
    [behaviorLogs]
  );

  // TODAY-6: the PREVIOUS 7-day window's logged-moment count (days 8–14),
  // derived here where behaviorLogs are in scope, for the narrative's ONE
  // comparative sentence. Counts only — never a trend adjective or score.
  const momentsLastWeek = useMemo(() => {
    const now = Date.now();
    return behaviorLogs.filter((l) => {
      const at = new Date(l.timestamp).getTime();
      return at >= now - 14 * DAY && at < now - 7 * DAY;
    }).length;
  }, [behaviorLogs]);

  const { weekAvg } = useMemo(() => {
    const now = Date.now();
    const inWindow = (start: number, end: number) =>
      behaviorLogs.filter((l) => { const ts = new Date(l.timestamp).getTime(); return ts >= start && ts < end; });
    const avg = (arr: typeof behaviorLogs) => (arr.length ? arr.reduce((s, l) => s + l.intensity, 0) / arr.length : 0);
    return { weekAvg: avg(inWindow(now - 7 * DAY, now + DAY)) };
  }, [behaviorLogs]);

  const topTrigger = useMemo(() => {
    const counts = new Map<string, number>();
    behaviorLogs.forEach((l) => counts.set(l.behaviorType, (counts.get(l.behaviorType) || 0) + 1));
    let top = ""; let max = 0;
    counts.forEach((v, k) => { if (v > max) { max = v; top = k; } });
    return top;
  }, [behaviorLogs]);

  const { focus, loading: focusLoading, error: focusError, regenerate: regenerateFocus } = useTodaysFocus(childProfile, {
    count: recentCount,
    avg: weekAvg,
    topTrigger,
    milestonesPercent,
    lastActionRecommendation: latestCompletedAction?.recommendation,
    lastActionOutcome: latestCompletedAction?.outcome,
  });

  // TODAY-1/CODEX-2: the headline is ALWAYS derived from the AI focus text
  // (pure scrub in lib/todayFocus — no keyword override, no canned copy).
  // null = no real focus (day-0 / failed fetch): W1 1.2 routes that case into
  // the guaranteed-action chain below — TodayActionLoop still gets null so the
  // fallback can never be persisted via acceptTodayAction nor injected into
  // the next focus prompt.
  const focusHeadline = useMemo(() => focusHeadlineFrom(focus?.text), [focus?.text]);

  // ── W1 1.2: the guaranteed action — deterministic fallback chain. A fetch
  //    in flight for a child WITH signals keeps the hero (skeleton) so the
  //    slot never flickers prompt→focus mid-load. ──
  const promptKeys = useMemo(
    () => dailyPromptKeys({ ageYears: childProfile.age, childId: childProfile.id, date: new Date() }),
    [childProfile.age, childProfile.id]
  );
  const todayChoice = useMemo(
    () => chooseTodayAction({
      hasActiveAction: !!activeTodayAction,
      focusHeadline,
      focusPending: focusLoading && !focus && recentCount > 0,
      promptKeys,
      hasDailyPlay: !!dailyPlay,
    }),
    [activeTodayAction, focusHeadline, focusLoading, focus, recentCount, promptKeys, dailyPlay]
  );
  // KPI 0.8: % opens ending in an offered action (target 100%).
  useEffect(() => {
    track("today_action_offered", { kind: todayChoice.kind });
  }, [todayChoice.kind]);

  // CODEX-2: time-of-day-aware greeting (was hardcoded to the morning copy).
  const hour = new Date().getHours();
  const greetingKey =
    hour < 12 ? "today.greeting.morning" : hour < 18 ? "today.greeting.afternoon" : "today.greeting.evening";

  const beginGuidance = () => {
    seedCoach({ prompt: focus ? t("seed.todayFocus", { focus: focus.text, name: firstName }) : undefined, source: "today-guidance" });
  };

  // ── Kid activity feed (Loops 1+3+5) — kid-originated + parent-logged events
  //    from the ONE shared child profile, unified into a single live feed. Every
  //    row is a neutral/positive fact — never a score, verdict, or trend. ──
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
        // triggered the crossing.
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
    const focusCount = activeGoals.length; // parent-expressed goals, never weakest-domain
    const domainsWithProgress = new Set(
      milestones.filter((m) => m.checked).map((m) => m.domain)
    ).size; // domains where a milestone has been noticed (count of 7)
    const weekActivity =
      behaviorLogs.filter((l) => new Date(l.timestamp).getTime() >= Date.now() - 7 * DAY).length +
      playLogs.filter((p) => new Date(p.timestamp).getTime() >= Date.now() - 7 * DAY).length;
    return { focus: focusCount, domains: domainsWithProgress, week: weekActivity };
  }, [activeGoals.length, milestones, behaviorLogs, playLogs]);

  // ── Rule A budget inputs: which conditional modules would ACTUALLY render? ──
  // P1-B: the previous implementation asked `todayHardMomentOffer(...)` here.
  // That resolves through publishedHardMomentCards, which governance (GD-10)
  // keeps empty, so the budget could never engage AND the hard-moment offer is
  // not even a sibling module — it renders inside the anchor's left column.
  // Every input below is now the module's own render condition.
  //
  // Mirrors ArborNoticedCard's render gate (monitor-level signal, not dismissed).
  const monitoring = useMonitoring();
  const noticedWould = useMemo(() => {
    const signal = pickHighestWatchSignal(monitoring);
    if (!signal || signal.level !== "monitor") return false;
    try {
      const raw = window.localStorage.getItem(`arbor.noticed.dismissed.${childProfile.id}`);
      const dismissed = raw ? (JSON.parse(raw) as unknown) : [];
      return !(Array.isArray(dismissed) && dismissed.includes(`${signal.domain}:${signal.level}`));
    } catch {
      return true;
    }
  }, [monitoring, childProfile.id]);

  // Would the first-steps rail render? The rail owns that answer (dismissed /
  // all-done / established account) — the budget asks it rather than guessing.
  const railWould = useFirstStepsRail().visible;

  // ── Day-0 (first visit, zero data): header + capture bar + primary action +
  //    the first-steps rail ONLY (Rule A day-0 shape). P1-C: the watch card is
  //    inside this guard too — a parent who has answered nothing has produced
  //    no signal, so Today has nothing to have "noticed". ──
  const dayZero =
    !isReturning && behaviorLogs.length === 0 && playLogs.length === 0 && checkedMilestones === 0;

  // ── W1 1.1: the since-visit EVENT rows (strictly newer than the previous
  //    visit). Built WITHOUT the fold row first, because whether the strip has
  //    anything to say is what decides if there is a fold target at all. ──
  const sinceBase = useMemo(
    () => buildSinceVisitRows({
      previousVisitAt: isReturning ? previousVisitAt : null,
      behaviorLogs,
      playLogs,
      milestones,
      conversations,
      includeNoticedRow: false,
    }),
    [isReturning, previousVisitAt, behaviorLogs, playLogs, milestones, conversations]
  );

  // ── Rule A: resolve the ≤5-module budget from the REAL render conditions. ──
  const modulePlan = useMemo(
    () => resolveTodayModules(
      {
        since: isReturning && sinceBase.rows.length > 0,
        rail: railWould,
        noticed: !dayZero && noticedWould,
        narrative: !dayZero,
        play: !dayZero && todayChoice.kind !== "play",
      },
      { noticedCanFold: isReturning && sinceBase.rows.length > 0 },
    ),
    [isReturning, sinceBase.rows.length, railWould, dayZero, noticedWould, todayChoice.kind]
  );

  // The watch signal degrades by FOLDING into a since-strip row ("Arbor noticed
  // something — look"), never by vanishing (todayModules.ts guarantees it is
  // only demotable while the strip is there to receive it).
  const foldNoticed = modulePlan.demoted.includes("noticed");
  const showSinceStrip = modulePlan.visible.has("since");

  const sinceVisit = useMemo(
    () => (foldNoticed
      ? buildSinceVisitRows({
        previousVisitAt: isReturning ? previousVisitAt : null,
        behaviorLogs,
        playLogs,
        milestones,
        conversations,
        includeNoticedRow: true,
      })
      : sinceBase),
    [foldNoticed, sinceBase, isReturning, previousVisitAt, behaviorLogs, playLogs, milestones, conversations]
  );

  const onSinceRowTap = (row: SinceVisitRow) => {
    if (row.kind === "milestone" || row.kind === "noticed") {
      setActiveTab("development");
      return;
    }
    if (row.kind === "conversations") {
      setActiveTab("coach");
      return;
    }
    // moments / plays deep-link to the exact journal timeline signal.
    requestJournalFocus(row.focusId);
    setActiveTab("journal");
  };

  // "Arbor remembers" footer counts (counts only — clinical firewall).
  const memoryCounts = useMemo(() => {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const s = dayStart.getTime();
    const capturedToday =
      behaviorLogs.filter((l) => new Date(l.timestamp).getTime() >= s).length +
      playLogs.filter((p) => new Date(p.timestamp).getTime() >= s).length;
    return { capturedToday, week: devStats.week, story: behaviorLogs.length + playLogs.length };
  }, [behaviorLogs, playLogs, devStats.week]);

  // The Daily Play "Try together" section — ONE JSX instance, placed either as
  // a visible module, in the left slot when it IS the primary action, or inside
  // the More disclosure when the module budget displaces it.
  const playSection = (
    <section className="border-y py-5" style={{ borderColor: "var(--arbor-rule)" }} aria-label={t("today.feed.title", { name: firstName })}>
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--arbor-clay)" }}>{t("today.feed.eyebrow")}</div>
          <h2 className="mt-1 text-[17px] font-extrabold" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>{t("today.feed.title", { name: firstName })}</h2>
        </div>
        {hasRecentActivity && <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold" style={{ color: "var(--arbor-clay)" }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--arbor-clay)" }} />{t("today.live")}</span>}
      </div>
      {dailyPlay ? (
        <DailyPlayCard pick={dailyPlay} childName={firstName} done={donePlayIds.includes(dailyPlay.activity.id)} onDid={markPlayDone} onCoach={coachOnPlay} concernLabel={dailyPlay.reason === "concern-match" ? playDomainLabel(dailyPlay.activity.domain, uiLang) : undefined} goalLabel={dailyPlay.reason === "goal-match" ? activeGoals.find((g) => g.domainId === dailyPlay.activity.domain)?.label : undefined} sessionLength={sessionLength} onSessionLengthChange={handleSessionLength} ageYears={childProfile.age} sessionTapped={sessionTapped} rhythmHintTime={rhythm.calmWindow ? hourLabel(rhythm.calmWindow.startHour) : undefined} />
      ) : (
        <div className="flex items-center gap-3 px-1 py-3"><Icon name="auto_awesome" size={20} fill={1} style={{ color: "var(--arbor-clay)" }} /><div><div className="text-[13px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("ov.recoLoading", { name: firstName })}</div><div className="text-[11px]" style={{ color: "var(--arbor-faint)" }}>{t("ov.play.desc")}</div></div></div>
      )}
      <button onClick={() => seedCoach({ prompt: focus ? t("seed.todayFocus", { focus: focus.text, name: firstName }) : undefined, source: "today-coach-row" })} className="mt-3 inline-flex min-h-[44px] items-center gap-2 px-1 text-[12px] font-extrabold" style={{ color: "var(--arbor-clay)" }}><Icon name="forum" size={18} />{t("today.coach.reply")}<Icon name="arrow_forward" size={16} className="rtl:-scale-x-100" /></button>
    </section>
  );
  // Visible only while it holds a slot in the ≤5 budget; otherwise it drops
  // into the More drawer below (never off the screen).
  const showPlayInline = modulePlan.visible.has("play");

  return (
    <motion.div
      /* Fade-only entrance (no `y`): a transform on this column would become
         the containing block for the < md position:fixed quick-capture pin
         (TODAY-4), gluing the bar to the column instead of the viewport. */
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-4 md:gap-5 relative max-w-[1180px] mx-auto max-md:pb-20"
    >
      <header className="flex items-start justify-between gap-4 px-1">
        <div>
          {/* P1-A headroom: the "TODAY'S GUIDANCE" eyebrow used to be repeated
              here AND ~90px below as the hero card's own eyebrow. On a 375px
              phone that duplicate cost 21px of the ~360px the greeting block
              leaves the primary CTA before the 812px fold. One eyebrow, on the
              card it labels. */}
          <h1 className="text-[30px] sm:text-[38px] leading-tight" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)", fontWeight: 700 }}>
            {t(greetingKey, { name: parentFirstName })}
          </h1>
          <p className="mt-2 text-[19px] font-bold" style={{ color: "var(--arbor-ink-soft)", fontFamily: "var(--font-display)" }}>{t("today.header.prompt")}</p>
          {/* P1-A headroom, phones only: this two-line explainer duplicates the
              pinned QuickCaptureBar's own label ("Capture a moment in …'s
              story" + mic/photo/text), which is permanently visible on < md.
              Dropping it below sm buys 47px, which is what makes the fold hold
              for ANY headline the 150-char focus clamp can produce — with it,
              a maximally long AI first sentence pushed the CTA past 812px. */}
          <p className="mt-1 text-[14px] hidden sm:block" style={{ color: "var(--arbor-muted)" }}>{t("today.header.sub")}</p>
        </div>
        <button onClick={() => setShowAiRail(true)} className="hidden sm:inline-flex items-center gap-2 min-h-[44px] rounded-2xl px-4 text-[12px] font-extrabold" style={{ color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule)", background: "var(--arbor-green-soft)" }}>
          <Icon name="verified_user" size={17} /> {t("airail.title")}
        </button>
      </header>

      {/* ── Quick Capture (W6.2/TODAY-4) — ambient voice/photo/text capture,
             ABOVE the forms in the hierarchy. First in the DOM (keyboard users
             reach capture first); on phones (< md) the wrapper pins it
             `fixed` above the MobileNav tab bar (--mobile-nav-h + safe-area
             offset) so the ≤20s capture affordance survives any scroll; on
             md+ it renders inline here above the hero. `fixed`, not `sticky`:
             every ancestor (main + both shell wrappers) is an overflow-x-hidden
             scroll container that grows with content on mobile, so a
             sticky-bottom pin can never engage against the real viewport.
             z-30 keeps it under MobileNav (z-40) and QuickLogModal (z-50).
             The max-md:pb-* on the column below reserves its floating slot.
             Capture-only surface: no metrics, no firewall exposure. ── */}
      <div className="max-md:fixed max-md:inset-x-4 max-md:z-30 max-md:bottom-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom)+8px)]">
        <QuickCaptureBar
          key="today-primary-capture"
          childName={firstName}
          onText={() => setQuickLogOpen(true)}
          onMode={startCapture}
        />
      </div>

      {/* ── Row 1 (1.85fr / 0.85fr): guaranteed action · Development-Map card.
             P1-A: this row is FIRST in the column — the day's action clears the
             fold before anything else competes for the viewport. ── */}

      <div className="grid grid-cols-1 lg:grid-cols-[1.85fr_0.85fr] gap-5">
        {/* ── Day anchor (left slot) — W1 1.2 guaranteed action. ONE slot, one
               primary: an accepted action owns it (TodayActionLoop); else the
               chooseTodayAction chain renders the AI focus hero, the promptBank
               capture card, the Daily Play promotion, or the bare capture
               floor. TODAY-1: `accept` is passed ONLY with a real AI focus
               headline — day-0/fallback copy can never reach acceptTodayAction,
               so it can never be persisted into actionLoops nor injected into
               the next focus prompt. */}
        <div className="min-w-0">
          {showSinceStrip && (
            /* Mockup frame 1: "ממשיכים מאיפה שהפסקנו" — the resume framing sits
               directly above the guaranteed-action card for returning parents. */
            <p className="mb-2 px-1 text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--arbor-clay)" }}>
              {svString(t, uiLang, "elev.sincevisit.resume")}
            </p>
          )}
          {activeTodayAction ? (
            <TodayActionLoop />
          ) : todayChoice.kind === "focus" ? (
            <TodayRecommendation
              eyebrow={t("today.guidance.tag")}
              headline={focusHeadline ?? t("ov.recoEmpty", { name: firstName })}
              meta={t("today.meta")}
              action={t("today.begin")}
              loading={focusLoading && !focus}
              onBegin={beginGuidance}
              accept={focusHeadline ? {
                label: t("today.action.make"),
                lengthAria: t("today.action.length"),
                minUnit: t("today.action.min"),
                onAccept: (capacity) => acceptTodayAction(focusHeadline, capacity),
              } : undefined}
              // W1 1.2 why-line + masterplan 3.1 chain: the copy rides the card's
              // own ContentWhyLine slot so the TrustLink lands AFTER the why text
              // (it used to sit between the CTA and a sibling <p>).
              why={t("today.intent.whyRhythm")}
            />
          ) : todayChoice.kind === "play" ? (
            playSection
          ) : (
            <PromptCaptureCard
              promptKey={todayChoice.kind === "prompt" ? todayChoice.promptKey : null}
              childName={firstName}
              onCapture={() => setQuickLogOpen(true)}
            />
          )}
          {/* N2-errfocus: a failed focus fetch used to degrade SILENTLY to the
              guaranteed-action fallback. The inline error renders ALONGSIDE the
              fallback (never instead of it — the anchor above always renders),
              so the day still has its action AND the parent can retry the AI
              focus. Hidden while a focus exists (cached text beats a banner)
              and while an accepted action owns the slot. */}
          {focusError && !focus && !activeTodayAction && (
            <ErrorState
              className="mt-2"
              surface="today-focus"
              headline={t("err.focus.title")}
              body={t("err.focus.body")}
              onRetry={() => void regenerateFocus()}
              retryLabel={t("err.retry")}
              retrying={focusLoading}
            />
          )}
          {/* CONT-2 — hard-moment offer (AR-CONT-01). Fail-closed on
              publishedHardMomentCards via selectCards; offers a matched card's
              doNow through the EXISTING acceptTodayAction seam (outline button
              — the anchor keeps the single gradient-primary CTA). Renders
              nothing until clinical review publishes cards (GD-10). */}
          <HardMomentTodayOffer />
        </div>
        {/* ── Development-Map card (right, 1fr) ─────────────────────────────────
            Clinical firewall: a milestone-count ring + a COUNT-based 3-stat
            footer (Focus / Domains / Week). NO 0–100 ring, no per-domain %, no
            on-track verdict, no weakest-domain pointer. Click → Growth. */}
        {(() => {
          if (dayZero) return null;
          const score = devScore;
          if (score.confidence === "none") return null;
          return (
            <section
              onClick={() => setActiveTab("development")}
              className="rounded-[22px] p-5 flex flex-col transition motion-safe:hover:-translate-y-0.5 cursor-pointer"
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
                  <div className="text-[14px] font-extrabold leading-tight" style={{ color: "var(--arbor-ink)" }}>
                    {t("devscore.noticed", { reached: checkedMilestones, total: totalMilestones })}
                  </div>
                  <div className="text-[11.5px] mt-1.5 leading-relaxed" style={{ color: "var(--arbor-faint)" }}>
                    {t("devscore.mechanism.short")}
                  </div>
                </div>
              </div>
              {/* Empty state (no milestones noticed yet): a 3-zero footer is
                  meaningless, so teach where the picture comes from instead. */}
              {checkedMilestones === 0 ? (
                <div className="mt-auto pt-4">
                  <div className="rounded-xl px-3.5 py-3 text-[11.5px] font-semibold leading-relaxed" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-faint)" }}>
                    {t("today.devmap.empty")}
                  </div>
                </div>
              ) : (
                /* COUNT-based 3-stat footer. Focus = parent-expressed goals;
                   Domains = domains with a noticed milestone (of 7); Week = moments
                   noticed in 7d. */
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
              )}
            </section>
          );
        })()}
      </div>

      {/* ── W1 1.1: "Since your last visit" — returning parents only. It sits
             BELOW the anchor row (P1-A): continuity is warm, but it is not the
             day's action, and above the fold it was costing ~450px and burying
             the one CTA. The "continuing where we left off" framing stays on the
             anchor itself, so the narrative order still reads greeting → resume
             → what's new. ── */}
      {showSinceStrip && (
        <SinceLastVisit
          rows={sinceVisit.rows}
          hiddenCount={sinceVisit.hiddenCount}
          capturedToday={memoryCounts.capturedToday}
          weekCount={memoryCounts.week}
          storyCount={memoryCounts.story}
          onRowTap={onSinceRowTap}
          onMore={() => setActiveTab("journal")}
        />
      )}

      {/* ── E11 first-steps rail — a Today module now, not Shell chrome. It is
             the day-0 start path, so it renders in every state where it still
             has steps left, but it can never outrank the day's action again. ── */}
      {modulePlan.visible.has("rail") && <FirstStepsRail />}

      {/* ── "Arbor Noticed" (DUX-011) — the single highest watch signal from the
             child's own logged data, below the anchor row. Renders NOTHING with
             zero detections and self-hides per-detection once dismissed; copy is
             counts/patterns only (non-diagnostic, monitoring.ts framing).
             P1-C: it is inside the day-0 guard — a parent who has answered
             nothing has produced no signal, so a "worth keeping an eye on" card
             on a brand-new account would be manufactured from ABSENT data.
             Rule A: when the budget is spent it FOLDS into a SinceLastVisit row
             instead of rendering as a sibling card (foldNoticed above). ── */}
      {modulePlan.visible.has("noticed") && <ArborNoticedCard />}

      {/* ── Progress narrative — retrospective picture. Its "Your evidence" cell
             is the ONE recent-moments surface on Today (CODEX-1). Skipped on
             day-0 (Rule A: day-0 = capture bar + primary action only). ── */}
      {/* TODAY-6: evidence ids are the JOURNAL TIMELINE SIGNAL ids (the same
             `moment-`/`play-` prefixes buildTimeline assigns), so a tapped row
             deep-links to exactly that entry via the requestJournalFocus seam.
             The deep-link carries only the id — never a derived score. */}
      {modulePlan.visible.has("narrative") && (
        <ProgressNarrative
          childName={firstName}
          behaviorLogs={behaviorLogs.map((item) => ({ id: `moment-${item.id}`, timestamp: item.timestamp, label: item.context || item.notes || t("today.feed.logged") }))}
          playLogs={playLogs.map((item) => ({ id: `play-${item.id}`, timestamp: item.timestamp, label: item.title }))}
          noticedMilestones={checkedMilestones}
          momentsLastWeek={momentsLastWeek}
          actions={actionLoop}
          onOpenEvidence={(evidenceId) => {
            if (evidenceId) requestJournalFocus(evidenceId); setActiveTab("journal");
          }}
        />
      )}

      {/* ── Daily Play "Try together" — visible only while it holds a budget
             slot; the primary-slot chain renders it when it IS the action;
             otherwise the budget displaces it into the disclosure below. ── */}
      {showPlayInline && playSection}

      {/* ── More (secondary, collapsed — Rule A): the activity feed, the Daily
             Play section when displaced, and the wellness check-in. This
             disclosure is the drawer that RECEIVES demoted modules, so it is
             deliberately NOT counted by the budget (todayModules.ts) — counting
             the overflow container against its own overflow is incoherent. It
             is a 34px collapsed row, not a module. ── */}
      {!dayZero && (
        <section className="pt-1">
          <button
            onClick={() => setShowTools((v) => !v)}
            className="w-full flex items-center justify-between mb-3"
            aria-expanded={showTools}
          >
            <h2 className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-faint)" }}>{t("ov.dailyTools")}</h2>
            <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: GREEN }}>
              {showTools ? t("ov.tools.hide") : t("ov.tools.show")}
              <Icon name="chevron_right" size={18} className={`transition-transform rtl:-scale-x-100 ${showTools ? "rotate-90" : ""}`} />
            </span>
          </button>
          {showTools && (
            <div className="space-y-4">
              {/* The unified activity feed (parent-logged + kid-side events). */}
              {activityFeed.length > 0 ? (
                <ul className="space-y-2.5" aria-label={t("today.feed.title", { name: firstName })}>
                  {activityFeed.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 px-1">
                      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full" style={{ background: r.tone.soft, color: r.tone.ink }}>{r.icon}</span>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{r.title}</div>
                        <div className="truncate text-[11px]" style={{ color: "var(--arbor-faint)" }}>{r.sub}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-1 text-[12px]" style={{ color: "var(--arbor-faint)" }}>{t("today.feed.empty", { name: firstName })}</p>
              )}
              {/* Daily Play displaced here by the hard-moment offer (budget). */}
              {!showPlayInline && todayChoice.kind !== "play" && playSection}
              <div className="max-w-[520px]">
                <DailyCheckinCard />
              </div>
            </div>
          )}
        </section>
      )}

      {/* Text-mode quick capture — the orphaned-but-working QuickLogModal, revived.
          Portals to document.body, so it contributes no box to the flex column. */}
      <QuickLogModal open={quickLogOpen} onClose={() => setQuickLogOpen(false)} />
    </motion.div>
  );
}
