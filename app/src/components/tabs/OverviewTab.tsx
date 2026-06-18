import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  MessageSquare, Plus, RefreshCw, Sun, Sunrise, Moon, ArrowRight,
  Heart, BookOpen, Smile, Phone, ChevronRight, BookMarked,
  Share2, Waypoints, ClipboardCheck, Sparkles,
} from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import { ProgressRing } from "../ui/ProgressRing";
import { Skeleton } from "../ui/Skeleton";
import { ParentChildIllustration } from "../ui/ParentChildIllustration";
import { HeroAvatar, useHeroAvatar } from "../ui/HeroAvatar";
import { downloadHeroCard } from "../../lib/heroCard";
import { nextNudge } from "../../lib/jitai";
import { useTodaysFocus } from "../../hooks/useTodaysFocus";
import QuickLogModal from "../overview/QuickLogModal";
import RemindersCard from "../overview/RemindersCard";
import TrendsChart from "../overview/TrendsChart";
import GoalsCard from "../overview/GoalsCard";
import DailyCheckinCard from "../overview/DailyCheckinCard";
import RhythmStrip from "../overview/RhythmStrip";
import DailyPlayCard from "../overview/DailyPlayCard";
import { PASTEL, PastelKey, cardCls } from "../ui/kit";
import { predictRhythm, hourLabel } from "../../rhythm/predict";
import { selectDailyPlay, concernDomainsFromLogs, daySeedFor, type ScoredActivity } from "../../playbank/select";

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
    setActiveTab, milestonesPercent, checkedMilestones, totalMilestones,
    behaviorLogs, childProfile, setChatInput,
    pendingMemoryItems, approvedMemoryItems,
  } = useArbor();

  const { t } = useLanguage();
  const { toast } = useToast();
  const [quickLog, setQuickLog] = useState(false);
  // iOS-adaptable Today: the heavy "daily tools" dashboard (check-in, goals,
  // reminders, trends chart) is collapsed on phones by default and revealed on
  // tap; desktop (lg+) always shows it. Keeps Today scannable, not a wall.
  const [showTools, setShowTools] = useState(false);
  const firstName = (childProfile.name || "your child").split(" ")[0];
  const photoUrl = childProfile.photoUrl;
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
  const [donePlayIds, setDonePlayIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(`arbor.play.done.${childProfile.id}`) || "[]"); }
    catch { return []; }
  });
  const dailyPlay: ScoredActivity | null = useMemo(() => {
    const concernDomains = concernDomainsFromLogs(
      behaviorLogs.map((l) => ({ behaviorType: l.behaviorType, timestamp: l.timestamp })),
      Date.now()
    );
    const picks = selectDailyPlay({
      ageYears: childProfile.age,
      concernDomains,
      recentlyDoneIds: donePlayIds,
      daySeed: daySeedFor(Date.now()),
    }, 1);
    return picks[0] ?? null;
  }, [behaviorLogs, childProfile.age, childProfile.id, donePlayIds]);

  const prepWindow = (hour: number) => {
    setChatInput(`${firstName} tends to have a harder time around ${hourLabel(hour)}. Give me one short, calm script I can use to get ahead of it today.`);
    setActiveTab("coach");
  };
  const coachOnPlay = (p: ScoredActivity) => {
    setChatInput(`We're going to try "${p.activity.title}" with ${firstName} today (it builds ${p.activity.domain}). How can I get the most out of it, and what should I watch for?`);
    setActiveTab("coach");
  };
  const markPlayDone = (p: ScoredActivity) => {
    setDonePlayIds((prev) => {
      const next = prev.includes(p.activity.id) ? prev : [p.activity.id, ...prev].slice(0, 30);
      try { localStorage.setItem(`arbor.play.done.${childProfile.id}`, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    toast(`Nice. Added to ${firstName}'s day.`, "success");
  };

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? { text: t("ov.greeting.morning"), icon: <Sunrise className="w-4 h-4" /> }
    : hour < 18 ? { text: t("ov.greeting.afternoon"), icon: <Sun className="w-4 h-4" /> }
    : { text: t("ov.greeting.evening"), icon: <Moon className="w-4 h-4" /> };

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
  const trendTone: PastelKey = trend === "up" ? "yellow" : "mint";

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5 md:space-y-7 relative max-w-[1080px]"
    >
      {/* ── Decision hero: status → recommendation → one primary action ──── */}
      <section
        className="rounded-[24px] overflow-hidden"
        style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}`, boxShadow: "var(--shadow-md)" }}
      >
        {/* Status band */}
        <div className="p-6 md:p-7 flex items-start gap-4 md:gap-5">
          <div className="w-[60px] h-[60px] md:w-[68px] md:h-[68px] rounded-full p-[3px] flex-shrink-0" style={{ background: "linear-gradient(135deg,#5fce97,var(--arbor-clay))" }}>
            <div className="w-full h-full rounded-full p-[3px]" style={{ background: "var(--arbor-paper-elevated)" }}>
              {photoUrl ? (
                <img src={photoUrl} alt={firstName} className="w-full h-full rounded-full object-cover" />
              ) : (
                <div className="w-full h-full rounded-full flex items-center justify-center text-2xl font-extrabold" style={{ background: GREEN_SOFT, color: GREEN, fontFamily: "var(--font-display)" }}>
                  {firstName.charAt(0)}
                </div>
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: GREEN }}>{greeting.icon} {greeting.text}</span>
            <h1 className="text-[1.5rem] md:text-[1.85rem] font-extrabold leading-[1.12] mt-0.5" style={{ fontFamily: "var(--font-display)", color: INK, textWrap: "balance" } as React.CSSProperties}>
              {pulse}
            </h1>
            <p className="text-sm mt-1.5" style={{ color: MUTED }}>
              {firstName}, age {childProfile.age}{childProfile.schoolContext ? ` · ${childProfile.schoolContext}` : ""}
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold flex-shrink-0" style={{ background: PASTEL[trendTone].soft, color: PASTEL[trendTone].ink }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: PASTEL[trendTone].ink }} /> {trendWord}
          </span>
        </div>

        {/* Recommendation well — the single most important thing today */}
        <div className="px-6 md:px-7 pb-6 md:pb-7">
          <div className="rounded-2xl p-5 md:p-6" style={{ background: "var(--arbor-paper-deep)", border: `1px solid ${RULE}` }}>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: GREEN }}>
              <Sparkles className="w-3.5 h-3.5" /> {t("ov.todayFor", { name: firstName })}
            </span>
            <div className="mt-2 min-h-[2.25rem]">
              {focusLoading && !focus ? (
                <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>
              ) : focus ? (
                <p className="text-[17px] leading-relaxed font-medium" style={{ color: INK, textWrap: "pretty" } as React.CSSProperties}>{focus.text}</p>
              ) : recentCount > 0 ? (
                <p className="text-[17px] leading-relaxed" style={{ color: MUTED }}>{t("ov.recoLoading", { name: firstName })}</p>
              ) : (
                <p className="text-[16px] leading-relaxed" style={{ color: INK }}>
                  {t("ov.recoEmpty", { name: firstName })}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 mt-5">
              <button
                onClick={() => setQuickLog(true)}
                className="inline-flex items-center justify-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3 transition active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg,#3cc081,var(--arbor-clay) 60%,var(--arbor-clay-deep))", boxShadow: "var(--shadow-green)" }}
              >
                <Plus className="w-4 h-4" /> {t("ov.logMoment")}
              </button>
              <button
                onClick={() => { if (focus) setChatInput(`About today: ${focus.text} What is one concrete thing I can do for ${firstName} today?`); setActiveTab("coach"); }}
                className="inline-flex items-center justify-center gap-2 font-bold text-sm rounded-2xl px-5 py-3 transition"
                style={{ background: GREEN_SOFT, color: GREEN }}
              >
                <MessageSquare className="w-4 h-4" /> {t("ov.askArbor")}
              </button>
              {focus && (
                <button
                  onClick={() => void regenerate()}
                  disabled={focusLoading}
                  title="Suggest another focus"
                  aria-label="Suggest another focus"
                  className="inline-flex items-center justify-center w-10 h-10 rounded-2xl transition disabled:opacity-50"
                  style={{ background: "var(--arbor-paper-sunk)", color: GREEN }}
                >
                  <RefreshCw className={`w-4 h-4 ${focusLoading ? "animate-spin" : ""}`} />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── JITAI nudge — one well-timed cue off the child's logged rhythm ─── */}
      {nudge && (
        <section className="rounded-2xl p-4 flex flex-wrap items-center gap-3" style={{ background: PASTEL[nudge.tone].soft, border: `1px solid ${RULE}` }}>
          <span className="w-10 h-10 rounded-xl grid place-items-center flex-shrink-0" style={{ background: "var(--arbor-paper-elevated)", color: PASTEL[nudge.tone].ink }}>
            {nudge.kind === "calm" ? <Moon className="w-5 h-5" /> : nudge.kind === "log" ? <Plus className="w-5 h-5" /> : nudge.kind === "practice" ? <Heart className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
          </span>
          <div className="flex-1 min-w-[200px]">
            <p className="text-[15px] font-extrabold" style={{ color: INK }}>{nudge.headline}</p>
            <p className="text-[13px] mt-0.5 leading-snug" style={{ color: MUTED }}>{nudge.body}</p>
          </div>
          <button onClick={onNudge} className="inline-flex items-center justify-center gap-1.5 font-bold text-sm rounded-full px-4 min-h-[44px] flex-shrink-0 text-white transition active:scale-[0.98]" style={{ background: PASTEL[nudge.tone].ink }}>
            {nudge.cta} <ArrowRight className="w-4 h-4" />
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
              style={{ background: "linear-gradient(135deg, #7a6bd8, #5a4cc0)", boxShadow: "0 8px 20px rgba(90,76,192,0.28)" }}
            >
              <Sparkles className="w-5 h-5" /> {t("ov.play.cta")}
            </button>
            <button
              onClick={() => { void downloadHeroCard({ imageUrl: childProfile.photoUrl!, name: firstName, age: childProfile.age }); }}
              className="inline-flex items-center justify-center gap-1.5 font-bold text-[13px] rounded-full px-4 min-h-[40px] transition"
              style={{ background: "var(--arbor-paper-elevated)", color: GREEN, border: `1px solid ${RULE}` }}
            >
              ★ {t("ov.hero.card")}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setActiveTab("profile")}
            className="inline-flex items-center justify-center gap-2 text-white font-extrabold text-[15px] rounded-full px-6 min-h-[52px] transition active:scale-[0.97] hover:-translate-y-0.5 flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #3cc081, var(--arbor-clay) 60%, var(--arbor-clay-deep))", boxShadow: "var(--shadow-green)" }}
          >
            <Sparkles className="w-5 h-5" /> {t("ov.hero.cta", { name: firstName })}
          </button>
        )}
      </section>

      {/* ── Today: predicted rhythm + a play idea (the daily-return surface) ─ */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <RhythmStrip prediction={rhythm} childName={firstName} onPrepWindow={prepWindow} />
        {dailyPlay && (
          <DailyPlayCard
            pick={dailyPlay}
            childName={firstName}
            done={donePlayIds.includes(dailyPlay.activity.id)}
            onDid={markPlayDone}
            onCoach={coachOnPlay}
          />
        )}
      </section>

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
          <button onClick={() => setActiveTab("milestones")} className="text-left p-5 flex items-center gap-4 transition hover:bg-[var(--arbor-paper-deep)]" style={{ borderRight: `1px solid ${RULE}` }}>
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
          <button onClick={() => setActiveTab("memory")} className="text-left p-5 flex items-center gap-4 transition hover:bg-[var(--arbor-paper-deep)]" style={{ borderRight: `1px solid ${RULE}` }}>
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
        <button onClick={() => setActiveTab("sharing")} className={`${card} p-5 text-left flex items-center gap-4 transition hover:-translate-y-0.5`}>
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
    </motion.div>
  );
}
