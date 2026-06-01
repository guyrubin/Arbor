import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { TrendingUp, TrendingDown, Minus, MessageSquare, Plus, Sparkles, RefreshCw } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { ProgressRing } from "../ui/ProgressRing";
import { Skeleton } from "../ui/Skeleton";
import { useTodaysFocus } from "../../hooks/useTodaysFocus";
import QuickLogModal from "../overview/QuickLogModal";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Map an intensity (1-5) to the sage → clay scale. */
function intensityColor(intensity: number): string {
  if (intensity <= 1) return "#6f9e6f";
  if (intensity <= 2) return "#9bbf5a";
  if (intensity <= 3) return "#d7aa55";
  if (intensity <= 4) return "#e08a3c";
  return "#e2562d";
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
    currentStory,
    setActiveStoryPage,
    childProfile,
  } = useArbor();

  const [quickLog, setQuickLog] = useState(false);

  const recentCount = useMemo(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    return behaviorLogs.filter((l) => new Date(l.timestamp).getTime() >= cutoff).length;
  }, [behaviorLogs]);

  // 7-day intensity trend vs the previous 7 days.
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

  // Behavior events grouped by weekday over the last 28 days.
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
    return buckets.map((b) => ({
      day: b.day,
      count: b.count,
      avgIntensity: b.count ? b.intensitySum / b.count : 0,
    }));
  }, [behaviorLogs]);

  const coachSessions = useMemo(
    () => chatMessages.filter((m) => m.sender === "user").length,
    [chatMessages]
  );

  const topTrigger = useMemo(() => {
    const counts = new Map<string, number>();
    behaviorLogs.forEach((l) => counts.set(l.behaviorType, (counts.get(l.behaviorType) || 0) + 1));
    let top = "";
    let max = 0;
    counts.forEach((v, k) => {
      if (v > max) {
        max = v;
        top = k;
      }
    });
    return top;
  }, [behaviorLogs]);

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-[#e2562d]" : trend === "down" ? "text-emerald-400" : "text-[#a8a093]";

  const { focus, loading: focusLoading, regenerate } = useTodaysFocus(childProfile, {
    count: recentCount,
    avg: weekAvg,
    topTrigger,
    milestonesPercent,
  });

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8 relative">
      <div>
        <span className="text-xs font-black uppercase tracking-wider text-[#f4d991]">Parenting Intelligence Cockpit</span>
        <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-tight mt-1">Today&apos;s development dashboard</h2>
      </div>

      {/* KPI ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Behavior intensity trend */}
        <div className="bg-[#141821] border border-white/10 rounded-3xl p-6 hover:-translate-y-0.5 hover:shadow-xl transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider">🔴 Behavior intensity</span>
            <TrendIcon className={`w-4 h-4 ${trendColor}`} />
          </div>
          <div className="mt-3 text-4xl font-black text-white">
            <AnimatedNumber value={weekAvg} decimals={1} />
            <span className="text-lg text-[#a8a093] font-bold"> / 5</span>
          </div>
          <p className="text-[11px] text-[#a8a093] mt-1">7-day rolling average ({trend === "up" ? "rising" : trend === "down" ? "easing" : "steady"})</p>
        </div>

        {/* Milestone progress */}
        <div className="bg-[#141821] border border-white/10 rounded-3xl p-6 hover:-translate-y-0.5 hover:shadow-xl transition flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider">✅ Milestones</span>
            <div className="mt-3 text-4xl font-black text-white">
              <AnimatedNumber value={checkedMilestones} /> <span className="text-lg text-[#a8a093] font-bold">/ {totalMilestones}</span>
            </div>
            <p className="text-[11px] text-[#a8a093] mt-1">{milestonesPercent}% readiness</p>
          </div>
          <ProgressRing value={milestonesPercent} size={64}>
            <span className="text-xs font-black text-[#f4d991]">{milestonesPercent}%</span>
          </ProgressRing>
        </div>

        {/* Coach sessions */}
        <div className="bg-[#141821] border border-white/10 rounded-3xl p-6 hover:-translate-y-0.5 hover:shadow-xl transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider">💬 Coach sessions</span>
            <MessageSquare className="w-4 h-4 text-[#a8a093]" />
          </div>
          <div className="mt-3 text-4xl font-black text-white">
            <AnimatedNumber value={coachSessions} />
          </div>
          <button onClick={() => setActiveTab("coach")} className="text-[11px] text-[#f4d991] hover:underline mt-1">Open Parent Coach ➔</button>
        </div>
      </div>

      {/* WEEKLY PATTERN CHART */}
      <div className="bg-[#141821] border border-white/10 rounded-3xl p-6 space-y-4">
        <div>
          <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider block">Weekly pattern</span>
          <h3 className="text-xl font-bold text-white mt-1">Behavior events by day (last 4 weeks)</h3>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} onClick={() => setActiveTab("behaviors")} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="day" stroke="#a8a093" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} stroke="#a8a093" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{ background: "#0c0e14", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: "#f4d991" }}
                formatter={(v: any, _n: any, item: any) => [`${v} events · avg ${item?.payload?.avgIntensity?.toFixed(1) || 0}/5`, "Behavior"]}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} cursor="pointer">
                {weeklyData.map((entry, i) => (
                  <Cell key={i} fill={entry.count ? intensityColor(entry.avgIntensity) : "rgba(255,255,255,0.08)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-[#a8a093]">Bar color reflects average intensity (sage → clay). Click a bar to review behavior logs.</p>
      </div>

      {/* BOTTOM ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's focus — AI-generated, cached 24h */}
        <div className="bg-gradient-to-br from-[#d7aa55]/8 to-transparent border border-[#d7aa55]/15 rounded-3xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#d7aa55]" /> Today&apos;s focus
            </span>
            <button
              onClick={() => void regenerate()}
              disabled={focusLoading}
              title="Regenerate"
              className="text-[#a8a093] hover:text-white transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${focusLoading ? "animate-spin text-[#d7aa55]" : ""}`} />
            </button>
          </div>
          {focusLoading && !focus ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : focus ? (
            <p className="text-sm text-gray-200 leading-relaxed">{focus.text}</p>
          ) : recentCount > 0 ? (
            <p className="text-sm text-[#a8a093]">Generating today&apos;s focus…</p>
          ) : (
            <p className="text-sm text-[#a8a093]">No logs yet. Capture your first moment to unlock tailored focus guidance.</p>
          )}
          <button onClick={() => setActiveTab("coach")} className="text-xs font-bold text-[#f4d991] hover:underline">Ask the coach about this ➔</button>
        </div>

        {/* Active action plans */}
        <div className="bg-[#141821] border border-white/10 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider">Active action plans</span>
            <button onClick={() => setActiveTab("plans")} className="text-[11px] text-[#a8a093] hover:text-white">Manage ➔</button>
          </div>
          <div className="space-y-3">
            {actionPlans.slice(0, 3).map((plan) => {
              const steps = plan.phases.flatMap((ph) => ph.steps);
              const done = steps.filter((s) => s.completed).length;
              const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
              return (
                <div key={plan.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white truncate pr-2">{plan.title}</span>
                    <span className="text-[#a8a093]">{done}/{steps.length}</span>
                  </div>
                  <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <div className="bg-[#d7aa55] h-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {actionPlans.length === 0 && <p className="text-xs text-[#a8a093]">No active plans yet.</p>}
          </div>
        </div>
      </div>

      {/* Bedtime story quick card */}
      <div className="bg-[#141821] border border-white/10 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-[#d7aa55]/10 rounded-2xl flex items-center justify-center text-2xl">📚</div>
          <div>
            <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider block">Tonight&apos;s story</span>
            <h3 className="text-lg font-extrabold text-white mt-0.5">{currentStory.title}</h3>
          </div>
        </div>
        <button
          onClick={() => {
            setActiveStoryPage(0);
            setActiveTab("stories");
          }}
          className="bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs px-5 py-3 rounded-2xl transition"
        >
          Open reading book
        </button>
      </div>

      {/* Floating quick-log button */}
      <button
        onClick={() => setQuickLog(true)}
        className="fixed bottom-6 right-6 z-30 bg-[#d7aa55] hover:bg-[#c39947] text-black font-extrabold rounded-2xl shadow-2xl shadow-[#d7aa55]/20 px-5 py-3.5 flex items-center gap-2 transition active:scale-[0.97]"
      >
        <Plus className="w-4 h-4" /> Quick log
      </button>

      <QuickLogModal open={quickLog} onClose={() => setQuickLog(false)} />
    </motion.div>
  );
}
