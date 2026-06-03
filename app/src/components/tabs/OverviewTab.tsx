import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  TrendingUp, TrendingDown, Minus, MessageSquare, Plus, Sparkles, RefreshCw,
  Sun, Sunrise, Moon, ArrowRight, Heart, BookOpen, Smile, Target,
  ShieldCheck, Phone, Activity, CheckCircle2, ChevronRight,
  Brain, Sprout, HeartHandshake, GraduationCap,
} from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { ProgressRing } from "../ui/ProgressRing";
import { Skeleton } from "../ui/Skeleton";
import { ArborMascot } from "../ui/ArborMascot";
import { ParentChildIllustration } from "../ui/ParentChildIllustration";
import { useTodaysFocus } from "../../hooks/useTodaysFocus";
import { intensityColor } from "../../lib/behaviorUtils";
import QuickLogModal from "../overview/QuickLogModal";
import RemindersCard from "../overview/RemindersCard";
import TrendsChart from "../overview/TrendsChart";
import GoalsCard from "../overview/GoalsCard";
import DailyCheckinCard from "../overview/DailyCheckinCard";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* Pastel functional palette — soft tint + readable accent, one per category. */
const PASTEL = {
  mint:   { soft: "#e4f4ec", ink: "#1f8a5a" },
  peach:  { soft: "#fdeada", ink: "#cf6f37" },
  lav:    { soft: "#ece9fb", ink: "#6354c4" },
  yellow: { soft: "#fbf1d4", ink: "#a9780f" },
  pink:   { soft: "#fce2ec", ink: "#bd4f74" },
  sky:    { soft: "#e5f0fb", ink: "#2f7bbf" },
} as const;
type PastelKey = keyof typeof PASTEL;

const card = "bg-white rounded-[22px] border border-[rgba(41,51,63,0.06)] shadow-[0_2px_10px_rgba(41,51,63,0.05)]";

function Chip({ tone, icon, children }: { tone: PastelKey; icon: React.ReactNode; children: React.ReactNode }) {
  const p = PASTEL[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ background: p.soft, color: p.ink }}
    >
      {icon}
      {children}
    </span>
  );
}

function IconBadge({ tone, children, size = 44 }: { tone: PastelKey; children: React.ReactNode; size?: number }) {
  const p = PASTEL[tone];
  return (
    <span
      className="inline-flex items-center justify-center rounded-2xl flex-shrink-0"
      style={{ background: p.soft, color: p.ink, width: size, height: size }}
    >
      {children}
    </span>
  );
}

export default function OverviewTab() {
  const {
    setActiveTab,
    actionPlans,
    milestonesPercent,
    checkedMilestones,
    totalMilestones,
    behaviorLogs,
    chatMessages,
    childProfile,
  } = useArbor();

  const [quickLog, setQuickLog] = useState(false);
  const firstName = (childProfile.name || "your child").split(" ")[0];
  const photoUrl = (childProfile as unknown as { photoUrl?: string }).photoUrl;

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? { text: "Good morning", icon: <Sunrise className="w-4 h-4" /> }
    : hour < 18 ? { text: "Good afternoon", icon: <Sun className="w-4 h-4" /> }
    : { text: "Good evening", icon: <Moon className="w-4 h-4" /> };

  const recentCount = useMemo(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    return behaviorLogs.filter((l) => new Date(l.timestamp).getTime() >= cutoff).length;
  }, [behaviorLogs]);

  const { weekAvg, trend } = useMemo(() => {
    const now = Date.now();
    const day = 86_400_000;
    const window = (start: number, end: number) =>
      behaviorLogs.filter((l) => {
        const t = new Date(l.timestamp).getTime();
        return t >= start && t < end;
      });
    const recent = window(now - 7 * day, now + day);
    const prior = window(now - 14 * day, now - 7 * day);
    const avg = (arr: typeof behaviorLogs) =>
      arr.length ? arr.reduce((s, l) => s + l.intensity, 0) / arr.length : 0;
    const r = avg(recent);
    const p = avg(prior);
    const t: "up" | "down" | "flat" = r > p + 0.1 ? "up" : r < p - 0.1 ? "down" : "flat";
    return { weekAvg: r, trend: t };
  }, [behaviorLogs]);

  const weeklyData = useMemo(() => {
    const now = Date.now();
    const cutoff = now - 28 * 86_400_000;
    const buckets = DAYS.map((d) => ({ day: d, count: 0, intensitySum: 0 }));
    for (const log of behaviorLogs) {
      const t = new Date(log.timestamp).getTime();
      if (t < cutoff) continue;
      const idx = new Date(log.timestamp).getDay();
      buckets[idx].count += 1;
      buckets[idx].intensitySum += log.intensity;
    }
    return buckets.map((b) => ({ day: b.day, count: b.count, avgIntensity: b.count ? b.intensitySum / b.count : 0 }));
  }, [behaviorLogs]);

  const coachSessions = useMemo(() => chatMessages.filter((m) => m.sender === "user").length, [chatMessages]);

  const topTrigger = useMemo(() => {
    const counts = new Map<string, number>();
    behaviorLogs.forEach((l) => counts.set(l.behaviorType, (counts.get(l.behaviorType) || 0) + 1));
    let top = "";
    let max = 0;
    counts.forEach((v, k) => { if (v > max) { max = v; top = k; } });
    return top;
  }, [behaviorLogs]);

  const activePlanCount = actionPlans.length;
  const watching = (childProfile.challenges?.[0] || "")
    .replace(/\s*\(.*?\)\s*/g, "")
    .trim()
    .replace(/^(.{40}).*/, "$1…");

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendLabel = trend === "up" ? "rising" : trend === "down" ? "easing" : "steady";

  const { focus, loading: focusLoading, regenerate } = useTodaysFocus(childProfile, {
    count: recentCount, avg: weekAvg, topTrigger, milestonesPercent,
  });

  // Recommended-this-week tiles, tied to the child where possible.
  const recommendations: { tone: PastelKey; icon: React.ReactNode; title: string; desc: string; tab: any }[] = [
    { tone: "mint",   icon: <Heart className="w-5 h-5" />,    title: "Connect through play", desc: "10 minutes of child-led play to refill the tank.", tab: "plans" },
    { tone: "peach",  icon: <Smile className="w-5 h-5" />,    title: "Name the feeling",     desc: `Practice co-regulation for ${firstName}'s big moments.`, tab: "coach" },
    { tone: "lav",    icon: <BookOpen className="w-5 h-5" />, title: "Tonight's hero story", desc: "A short story that builds courage and resilience.", tab: "stories" },
    { tone: "sky",    icon: <Moon className="w-5 h-5" />,     title: "Wind-down routine",    desc: "A calmer path into sleep and smoother mornings.", tab: "behaviors" },
  ];

  // Data-derived insights.
  const insights: { tone: PastelKey; icon: React.ReactNode; title: string; desc: string }[] = [];
  if (trend === "down") insights.push({ tone: "mint", icon: <TrendingDown className="w-4 h-4" />, title: "A calmer week", desc: `${firstName}'s behavior intensity is easing versus last week.` });
  else if (trend === "up") insights.push({ tone: "peach", icon: <TrendingUp className="w-4 h-4" />, title: "Intensity is rising", desc: `Worth a gentle check-in. Tap the coach for a co-regulation script.` });
  else insights.push({ tone: "sky", icon: <Activity className="w-4 h-4" />, title: "Holding steady", desc: `${firstName}'s week looks consistent with the last one.` });
  if (topTrigger) insights.push({ tone: "yellow", icon: <Target className="w-4 h-4" />, title: `Watch: ${topTrigger}`, desc: "Your most-logged moment this period. A focus plan can help." });
  insights.push({ tone: "lav", icon: <CheckCircle2 className="w-4 h-4" />, title: `${milestonesPercent}% milestone readiness`, desc: `${checkedMilestones} of ${totalMilestones} on track for age ${childProfile.age}.` });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-7 relative max-w-[1180px]"
    >
      {/* ─── HERO GREETING ─────────────────────────────────────────────── */}
      <section className={`${card} p-6 md:p-7`}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Avatar */}
          <div className="flex items-center gap-5 flex-1 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="w-[84px] h-[84px] rounded-full p-[3px]" style={{ background: "linear-gradient(135deg,#5fce97,#34b277)" }}>
                <div className="w-full h-full rounded-full bg-white p-[3px]">
                  {photoUrl ? (
                    <img src={photoUrl} alt={firstName} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <div className="w-full h-full rounded-full flex items-center justify-center text-3xl font-extrabold" style={{ background: "#e4f4ec", color: "#1f8a5a", fontFamily: "var(--font-display)" }}>
                      {firstName.charAt(0)}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: "#1f8a5a" }}>
                {greeting.icon} {greeting.text}
              </span>
              <h1 className="text-2xl md:text-[2rem] font-extrabold leading-[1.1] mt-1" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
                Let&apos;s support {firstName} today
              </h1>
              <p className="text-sm mt-1.5" style={{ color: "var(--arbor-muted)" }}>
                Age {childProfile.age}
                {childProfile.schoolContext ? ` · ${childProfile.schoolContext}` : ""}
              </p>
              {watching && (
                <div className="mt-3">
                  <Chip tone="peach" icon={<ShieldCheck className="w-3.5 h-3.5" />}>Watching: {watching}</Chip>
                </div>
              )}
            </div>
          </div>

          {/* Hero action */}
          <div className="lg:w-[300px] lg:border-l lg:pl-6 flex flex-col gap-3" style={{ borderColor: "var(--arbor-rule)" }}>
            <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>
              Had a hard moment? Capture it now, Arbor turns it into a calm next step.
            </p>
            <button
              onClick={() => setQuickLog(true)}
              className="inline-flex items-center justify-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3 transition active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg,#3cc081,#34b277 60%,#2a9c66)", boxShadow: "0 8px 20px rgba(52,178,119,0.28)" }}
            >
              <Plus className="w-4 h-4" /> Log a moment
            </button>
            <button
              onClick={() => setActiveTab("coach")}
              className="inline-flex items-center justify-center gap-2 font-bold text-sm rounded-2xl px-5 py-2.5 transition"
              style={{ background: "#e4f4ec", color: "#1f8a5a" }}
            >
              <MessageSquare className="w-4 h-4" /> Ask Arbor
            </button>
          </div>
        </div>
      </section>

      {/* ─── AT A GLANCE ───────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${card} p-5 flex items-center gap-4`}>
          <ProgressRing value={milestonesPercent} size={56} stroke={6}>
            <span className="text-[13px] font-extrabold" style={{ color: "#1f8a5a" }}>{milestonesPercent}%</span>
          </ProgressRing>
          <div className="min-w-0">
            <div className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
              <AnimatedNumber value={checkedMilestones} /><span className="text-base" style={{ color: "var(--arbor-muted)" }}>/{totalMilestones}</span>
            </div>
            <p className="text-xs font-semibold" style={{ color: "var(--arbor-muted)" }}>Milestones</p>
          </div>
        </div>

        <div className={`${card} p-5 flex items-center gap-4`}>
          <IconBadge tone="peach"><Activity className="w-5 h-5" /></IconBadge>
          <div className="min-w-0">
            <div className="text-2xl font-extrabold flex items-center gap-1" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
              <AnimatedNumber value={weekAvg} decimals={1} /><span className="text-base" style={{ color: "var(--arbor-muted)" }}>/5</span>
              <TrendIcon className="w-4 h-4 ml-0.5" style={{ color: trend === "down" ? "#1f8a5a" : trend === "up" ? "#cf6f37" : "#69747f" }} />
            </div>
            <p className="text-xs font-semibold" style={{ color: "var(--arbor-muted)" }}>Intensity · {trendLabel}</p>
          </div>
        </div>

        <button onClick={() => setActiveTab("coach")} className={`${card} p-5 flex items-center gap-4 text-left transition hover:-translate-y-0.5`}>
          <IconBadge tone="lav"><MessageSquare className="w-5 h-5" /></IconBadge>
          <div className="min-w-0">
            <div className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
              <AnimatedNumber value={coachSessions} />
            </div>
            <p className="text-xs font-semibold" style={{ color: "var(--arbor-muted)" }}>Coach sessions</p>
          </div>
        </button>

        <button onClick={() => setActiveTab("plans")} className={`${card} p-5 flex items-center gap-4 text-left transition hover:-translate-y-0.5`}>
          <IconBadge tone="sky"><Target className="w-5 h-5" /></IconBadge>
          <div className="min-w-0">
            <div className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
              <AnimatedNumber value={activePlanCount} />
            </div>
            <p className="text-xs font-semibold" style={{ color: "var(--arbor-muted)" }}>Active plans</p>
          </div>
        </button>
      </section>

      {/* ─── THE ARBOR WAY (strategic capability model) ────────────────── */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-xl font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>The Arbor way</h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--arbor-muted)" }}>Understand {firstName}, guide yourself, build growth, coordinate care, and form your family over time.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { tab: "profile" as const, tone: "sky" as const, icon: <Brain className="w-5 h-5" />, title: "Understand", section: "Child Intelligence", copy: `Understand ${firstName}'s patterns, milestones, and progress.` },
            { tab: "coach" as const, tone: "peach" as const, icon: <Sparkles className="w-5 h-5" />, title: "Guide", section: "Ask Arbor", copy: "Get calm guidance and exact scripts." },
            { tab: "plans" as const, tone: "mint" as const, icon: <Sprout className="w-5 h-5" />, title: "Grow", section: "Growth Plans", copy: "Build routines, responsibility, and resilience." },
            { tab: "find-pro" as const, tone: "lav" as const, icon: <HeartHandshake className="w-5 h-5" />, title: "Connect", section: "Care Network", copy: "Find trusted professionals and coordinate support." },
            { tab: "stories" as const, tone: "yellow" as const, icon: <GraduationCap className="w-5 h-5" />, title: "Learn", section: "Arbor Academy", copy: "Stories and lessons for long-term formation." },
          ].map((c) => (
            <button key={c.title} onClick={() => setActiveTab(c.tab)} className={`${card} p-4 text-left flex flex-col gap-2.5 transition hover:-translate-y-0.5`}>
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl" style={{ background: PASTEL[c.tone].soft, color: PASTEL[c.tone].ink }}>{c.icon}</span>
              <div>
                <h3 className="text-[15px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{c.title}</h3>
                <p className="text-[11px] font-bold" style={{ color: PASTEL[c.tone].ink }}>{c.section}</p>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{c.copy}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ─── RECOMMENDED THIS WEEK ─────────────────────────────────────── */}
      <section className={`${card} p-6`}>
        <div className="flex items-end justify-between mb-5">
          <div>
            <h2 className="text-xl font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>Recommended this week</h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--arbor-muted)" }}>Small, doable steps chosen for {firstName}.</p>
          </div>
          <button onClick={() => setActiveTab("plans")} className="hidden sm:inline-flex items-center gap-1 text-sm font-bold" style={{ color: "#1f8a5a" }}>
            All plans <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {recommendations.map((r) => (
            <button
              key={r.title}
              onClick={() => setActiveTab(r.tab)}
              className="group text-left rounded-2xl p-4 transition hover:-translate-y-0.5"
              style={{ background: PASTEL[r.tone].soft }}
            >
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white mb-3" style={{ color: PASTEL[r.tone].ink }}>
                {r.icon}
              </span>
              <h3 className="text-[15px] font-extrabold leading-snug" style={{ color: "var(--arbor-ink)" }}>{r.title}</h3>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{r.desc}</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold mt-2.5" style={{ color: PASTEL[r.tone].ink }}>
                Start <ChevronRight className="w-3.5 h-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ─── INSIGHTS + WEEKLY PATTERN ─────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-5">
        {/* Insights */}
        <div className={`${card} p-6`}>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4" style={{ color: "#1f8a5a" }} />
            <h2 className="text-lg font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>This week&apos;s insights</h2>
          </div>
          <div className="space-y-1">
            {insights.map((it, i) => (
              <div key={i} className="flex items-start gap-3 py-3" style={{ borderTop: i ? "1px solid var(--arbor-rule)" : "none" }}>
                <IconBadge tone={it.tone} size={36}>{it.icon}</IconBadge>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{it.title}</h3>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{it.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* AI focus */}
          <div className="mt-4 rounded-2xl p-4" style={{ background: "#e4f4ec" }}>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold" style={{ color: "#1f8a5a" }}>
                <Sparkles className="w-3.5 h-3.5" /> Today&apos;s focus
              </span>
              <button onClick={() => void regenerate()} disabled={focusLoading} title="Regenerate" style={{ color: "#1f8a5a" }} className="disabled:opacity-50">
                <RefreshCw className={`w-3.5 h-3.5 ${focusLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
            {focusLoading && !focus ? (
              <div className="space-y-2 mt-2"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3" /></div>
            ) : focus ? (
              <p className="text-sm leading-relaxed mt-2" style={{ color: "var(--arbor-ink)" }}>{focus.text}</p>
            ) : (
              <p className="text-sm mt-2" style={{ color: "var(--arbor-muted)" }}>
                {recentCount > 0 ? "Generating today's focus…" : `Log a moment to unlock focus guidance for ${firstName}.`}
              </p>
            )}
          </div>
        </div>

        {/* Weekly pattern */}
        <div className={`${card} p-6`}>
          <h2 className="text-lg font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>Weekly pattern</h2>
          <p className="text-sm mt-0.5 mb-3" style={{ color: "var(--arbor-muted)" }}>Behavior events by weekday (last 4 weeks).</p>
          {weeklyData.every((d) => d.count === 0) ? (
            <div className="h-52 flex flex-col items-center justify-center text-center gap-2 rounded-2xl" style={{ border: "1px dashed var(--arbor-rule-strong)" }}>
              <span className="text-sm font-bold" style={{ color: "var(--arbor-ink)" }}>No events logged yet</span>
              <p className="text-xs max-w-xs" style={{ color: "var(--arbor-muted)" }}>Log a moment and the weekly pattern appears here.</p>
              <button onClick={() => setQuickLog(true)} className="text-xs font-bold mt-1" style={{ color: "#1f8a5a" }}>Log a moment →</button>
            </div>
          ) : (
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} onClick={() => setActiveTab("behaviors")} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                  <XAxis dataKey="day" stroke="#69747f" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} stroke="#69747f" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(41,51,63,0.04)" }}
                    contentStyle={{ background: "#fff", border: "1px solid rgba(41,51,63,0.12)", borderRadius: 12, fontSize: 12, boxShadow: "0 8px 24px rgba(41,51,63,0.10)" }}
                    labelStyle={{ color: "#2a9c66", fontWeight: 700 }}
                    formatter={(v: any, _n: any, item: any) => [`${v} events · avg ${item?.payload?.avgIntensity?.toFixed(1) || 0}/5`, "Behavior"]}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} cursor="pointer">
                    {weeklyData.map((entry, i) => (
                      <Cell key={i} fill={entry.count ? intensityColor(entry.avgIntensity) : "rgba(41,51,63,0.08)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* ─── ASK ARBOR (mascot) ────────────────────────────────────────── */}
      <section
        className="rounded-[22px] p-6 md:p-7 flex flex-col sm:flex-row items-center gap-6 overflow-hidden relative"
        style={{ background: "linear-gradient(120deg,#eef6f1 0%,#ece9fb 100%)", border: "1px solid var(--arbor-rule)" }}
      >
        <ArborMascot size={112} className="flex-shrink-0 drop-shadow-sm" />
        <div className="flex-1 text-center sm:text-left">
          <h2 className="text-xl font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>Ask Arbor anything</h2>
          <p className="text-sm mt-1 max-w-md mx-auto sm:mx-0" style={{ color: "var(--arbor-muted)" }}>
            Share a worry or a hard moment. Arbor gives you an age-aware, non-diagnostic next step, with a script you can use today.
          </p>
        </div>
        <button
          onClick={() => setActiveTab("coach")}
          className="inline-flex items-center justify-center gap-2 text-white font-bold text-sm rounded-2xl px-6 py-3 transition active:scale-[0.98] flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#3cc081,#34b277 60%,#2a9c66)", boxShadow: "0 8px 20px rgba(52,178,119,0.28)" }}
        >
          <MessageSquare className="w-4 h-4" /> Open the coach
        </button>
      </section>

      {/* ─── DAILY TOOLS (real features, kept) ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DailyCheckinCard />
        <GoalsCard />
      </div>
      <RemindersCard />
      <TrendsChart logs={behaviorLogs} milestonesPercent={milestonesPercent} />

      {/* ─── SAFETY / HANDOFF BAR ──────────────────────────────────────── */}
      <section
        className="rounded-[22px] p-5 md:p-6 flex flex-col sm:flex-row items-center gap-5"
        style={{ background: "linear-gradient(120deg,#e4f4ec,#eef6f1)", border: "1px solid var(--arbor-rule)" }}
      >
        <ParentChildIllustration size={88} className="flex-shrink-0" />
        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-base font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
            Not sure something&apos;s right? We&apos;re here to listen.
          </h3>
          <p className="text-sm mt-1" style={{ color: "var(--arbor-muted)" }}>
            Arbor is non-diagnostic. For anything urgent or that needs an expert, we&apos;ll help you reach a professional.
          </p>
        </div>
        <button
          onClick={() => setActiveTab("safety")}
          className="inline-flex items-center justify-center gap-2 font-bold text-sm rounded-2xl px-5 py-3 transition flex-shrink-0 bg-white"
          style={{ color: "#1f8a5a", border: "1px solid rgba(52,178,119,0.30)" }}
        >
          <Phone className="w-4 h-4" /> Talk to someone
        </button>
      </section>

      <QuickLogModal open={quickLog} onClose={() => setQuickLog(false)} />
    </motion.div>
  );
}
