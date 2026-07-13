import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import { Skeleton } from "../ui/Skeleton";
import DailyCheckinCard from "../overview/DailyCheckinCard";
import DailyPlayCard from "../overview/DailyPlayCard";
import { useTodaysFocus } from "../../hooks/useTodaysFocus";
import { PASTEL } from "../ui/kit";
import { predictRhythm, hourLabel } from "../../rhythm/predict";
import { selectDailyPlay, concernDomainsFromLogs, daySeedFor, type ScoredActivity, type SessionLength } from "../../playbank/select";
import { computeDevScore } from "../../growth/devScore";
import { activeGoalDomains, type ActiveGoal } from "../../practice/goalBuilder";
import { playDomainLabel } from "../../playbank/content";
import { usePrideMoment } from "../../hooks/usePrideMoment";

const DAY = 86_400_000;

// Token shorthands so the screen reads from one palette, not scattered literals.
const GREEN = "var(--arbor-green-ink)";
const GREEN_SOFT = "var(--arbor-green-soft)";

/**
 * TODAY — reconciled to the "Arbor Web App" wireframe's simplicity: ONE guidance
 * hero + a few cards, nothing more. The old Today stacked TWO heroes, a 6-tile
 * "whole picture" hub grid, an intent trio, a JITAI nudge, a goal-builder prompt
 * and a heavy in-content "daily tools" dashboard on top of the real cards. Every
 * one of those routed to a capability that already has a home behind the sidebar
 * (Growth, Behaviors, Journal, Care, the Today sub-tab pills) — so they were
 * de-duplicated off the home screen, not deleted. See navigation.ts SECTIONS.
 *
 * What renders now (top → bottom):
 *   Row 1 (1.6fr / 1fr): Guidance hero (ONE gradient card, single "Begin" CTA)
 *                        · Development-Map count card (→ Growth).
 *   Row 2 (1.6fr / 1fr): Kid activity feed (live, multi-row) · Coach card.
 *   Below: a collapsed "daily tools" disclosure keeping the wellness check-in
 *          reachable (its only home) — demoted, not deleted.
 *
 * CLINICAL FIREWALL: every child-data surface here shows COUNTS ONLY — never a
 * %, 0–100 score, verdict/status tag, percentile or deficit pointer.
 */
export default function OverviewTab() {
  const {
    setActiveTab, milestones, milestonesPercent, checkedMilestones, totalMilestones,
    behaviorLogs, childProfile, setChatInput,
    donePlayIds, logPlayCompletion, playLogs,
  } = useArbor();

  const { t, uiLang } = useLanguage();
  const { toast } = useToast();
  // The wellness check-in is the only genuinely interactive daily card and its
  // only home, so it opens by default rather than hiding behind the disclosure.
  const [showTools, setShowTools] = useState(true);

  // Parent-expressed goals (not a child assessment). Feed Daily Play selection
  // and the dev-map "Focus" count; goal editing itself lives in Growth › Daily Play.
  const activeGoals: ActiveGoal[] = childProfile.activeGoals ?? [];
  const goalDomains = useMemo(() => activeGoalDomains(activeGoals), [activeGoals]);

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

  const coachOnPlay = (p: ScoredActivity) => {
    setChatInput(`We're going to try "${p.activity.title}" with ${firstName} today (it builds ${p.activity.domain}). How can I get the most out of it, and what should I watch for?`);
    setActiveTab("coach");
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

  const { focus, loading: focusLoading } = useTodaysFocus(childProfile, {
    count: recentCount, avg: weekAvg, topTrigger, milestonesPercent,
  });

  const beginGuidance = () => {
    if (focus) setChatInput(`About today: ${focus.text} What is one concrete thing I can do for ${firstName} today?`);
    setActiveTab("coach");
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5 md:space-y-7 relative max-w-[1080px]"
    >
      {/* ── Row 1 (1.6fr / 1fr): Guidance hero · Development-Map card ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
        {/* ── Guidance hero — ONE gradient card: "Today's guidance" tag → the one
               thing that matters today (the AI focus) → meta footer + single
               "Begin" CTA into the coach on today's focus. */}
        <section
          className="rounded-[22px] overflow-hidden"
          style={{ background: "var(--arbor-paper-elevated)", boxShadow: "var(--shadow-lg)" }}
        >
          <div className="relative min-h-[188px] flex flex-col justify-between" style={{ background: "var(--arbor-hero-grad)", padding: "22px" }}>
            <div className="absolute inset-0" style={{ background: "radial-gradient(60% 80% at 86% 4%, rgba(255,255,255,0.34), transparent 60%)" }} aria-hidden="true"></div>
            <Icon name="self_improvement" size={92} fill={1} className="absolute bottom-[14px]" style={{ color: "rgba(255,255,255,0.16)", insetInlineEnd: 22 }} />
            {/* Legibility scrim: darken from the bottom up so the title reads on the gradient */}
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(13,28,52,0.5), transparent 64%)" }} aria-hidden="true"></div>
            <div className="relative">
              <span className="inline-flex items-center text-[10px] font-extrabold uppercase tracking-wider" style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(4px)", color: "#fff", padding: "6px 12px", borderRadius: "20px", letterSpacing: "1.4px" }}>
                {t("today.guidance.tag")}
              </span>
            </div>
            <div className="relative mt-6">
              {focusLoading && !focus ? (
                <div className="space-y-2"><Skeleton className="h-6 w-3/4" /><Skeleton className="h-6 w-1/2" /></div>
              ) : (
                <h1
                  className="text-[27px] leading-[1.12] line-clamp-3"
                  style={{ color: "#fff", maxWidth: "92%", letterSpacing: "-0.4px", fontFamily: "var(--font-display)", fontWeight: 700, textWrap: "balance" } as React.CSSProperties}
                >
                  {focus ? focus.text : t("ov.recoEmpty", { name: firstName })}
                </h1>
              )}
            </div>
          </div>
          {/* Meta footer — guidance-briefing microcopy + the ONE primary CTA. */}
          <div className="flex items-center justify-between gap-3 px-5 py-[14px]">
            <span className="inline-flex items-center gap-2 text-[13px] font-bold" style={{ color: "var(--arbor-faint)" }}>
              <Icon name="schedule" size={18} /> {t("today.meta")}
            </span>
            <button
              onClick={beginGuidance}
              data-testid="today-guidance-cta"
              className="inline-flex items-center gap-1.5 text-white font-extrabold text-[13px] rounded-xl px-5 py-2.5 transition active:scale-[0.98]"
              style={{ background: "var(--arbor-ink)", boxShadow: "0 8px 18px -6px rgba(20,34,90,0.5)" }}
            >
              {t("today.begin")} <Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" />
            </button>
          </div>
        </section>

        {/* ── Development-Map card (right, 1fr) ─────────────────────────────────
            Clinical firewall: a milestone-count ring + a COUNT-based 3-stat
            footer (Focus / Domains / Week). NO 0–100 ring, no per-domain %, no
            on-track verdict, no weakest-domain pointer. Click → Growth. */}
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

      {/* ── Row 2 (1.6fr / 1fr): Kid activity feed · Coach card ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
        {/* ── Kid activity feed — live, multi-row: the child's play quest + a
               unified feed of kid quest/play completions, parent-logged moments
               and a noticed milestone, one row grammar (icon-tile + title/sub +
               trailing status). ── */}
        <section className="rounded-[22px] p-5" style={{ background: "var(--arbor-paper-elevated)", boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Icon name="sync_alt" size={20} fill={1} style={{ color: "var(--arbor-clay)" }} />
            <span className="text-[15px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("today.feed.title", { name: firstName })}</span>
            {/* Live pill reflects REAL recent activity (kid + parent events in 48h). */}
            {hasRecentActivity && (
              <span
                title="Activity in the last 48 hours"
                aria-label="Activity in the last 48 hours"
                className="ms-auto inline-flex items-center gap-1.5 text-[10px] font-extrabold rounded-full px-2.5 py-1"
                style={{ color: "var(--arbor-clay)", background: "var(--arbor-tint-2)" }}
              >
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
            {/* Empty state: no kid/parent events yet — one quiet teaching row so
                the feed reads as "waiting for your first log", not broken. */}
            {activityFeed.length === 0 && (
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-none" style={{ background: "var(--arbor-tint)", color: "var(--arbor-clay)" }}>
                  <Icon name="history" size={20} fill={1} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] leading-relaxed" style={{ color: "var(--arbor-faint)" }}>{t("today.feed.empty", { name: firstName })}</div>
                </div>
              </div>
            )}
            {/* Unified activity feed rows (Loops 1+3+5). */}
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

        {/* ── Coach card — the ONE coach entry: identity + one coaching line +
               single "Continue chat" CTA into Ask Arbor. ── */}
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
              {/* No live "online" dot — Arbor is guidance, not a live human on call.
                  A calm always-available label, no presence signal. */}
              <div className="text-[10.5px] font-extrabold" style={{ color: "var(--arbor-clay)" }}>
                {t("coach.online")}
              </div>
            </div>
          </div>
          <div className="text-[13px] leading-relaxed mt-3 flex-1" style={{ color: "var(--arbor-ink-soft)" }}>
            {focus?.text ? focus.text : t("coach.ready", { name: firstName })}
          </div>
          <button className="mt-4 bg-white text-center rounded-xl py-3 min-h-[44px] text-[13px] font-extrabold flex items-center justify-center gap-2" style={{ color: "var(--arbor-clay)" }}>
            <Icon name="forum" size={18} /> {t("today.coach.reply")}
          </button>
        </section>
      </div>

      {/* ── Daily tools (secondary, collapsed) — keeps the wellness check-in
             reachable (its only home). Day Windows + Reminders are NOT duplicated
             here; they are Today's sub-tab pills rendered by the Shell. ── */}
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
          <div className="max-w-[520px]">
            <DailyCheckinCard />
          </div>
        )}
      </section>
    </motion.div>
  );
}
