import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { BarChart2, RefreshCw, Sparkles, Trophy, ClipboardList, GraduationCap, Send } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { MarkdownBlock } from "../ui/MarkdownBlock";
import { scholarsInfo } from "../../initialData";

const DAY = 86_400_000;

function weekId(d = new Date()): string {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / DAY + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export default function WeeklyTab() {
  const { behaviorLogs, milestones, actionPlans, childProfile, setActiveTab, handleGenerateBrief } = useArbor();

  const [insight, setInsight] = useState<string>("");
  const [loadingInsight, setLoadingInsight] = useState(false);

  // Behavior summary for the last 7 days.
  const summary = useMemo(() => {
    const cutoff = Date.now() - 7 * DAY;
    const recent = behaviorLogs.filter((l) => new Date(l.timestamp).getTime() >= cutoff);
    const avg = recent.length ? recent.reduce((s, l) => s + l.intensity, 0) / recent.length : 0;
    const counts = new Map<string, number>();
    recent.forEach((l) => counts.set(l.trigger || l.behaviorType, (counts.get(l.trigger || l.behaviorType) || 0) + 1));
    let topTrigger = "—";
    let max = 0;
    counts.forEach((v, k) => {
      if (v > max) {
        max = v;
        topTrigger = k;
      }
    });
    return { count: recent.length, avg, topTrigger };
  }, [behaviorLogs]);

  const milestoneWins = useMemo(() => milestones.filter((m) => m.checked), [milestones]);

  const planProgress = useMemo(() => {
    let done = 0;
    let total = 0;
    actionPlans.forEach((p) => p.phases.forEach((ph) => ph.steps.forEach((s) => {
      total += 1;
      if (s.completed) done += 1;
    })));
    return { done, total };
  }, [actionPlans]);

  const spotlight = useMemo(() => {
    const idx = new Date().getDate() % scholarsInfo.length;
    return scholarsInfo[idx];
  }, []);

  const id = weekId();

  const generateInsight = async () => {
    setLoadingInsight(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Write a single concise paragraph (3-4 sentences) analyzing this week's parenting patterns for ${childProfile.name} (age ${childProfile.age}). Data: ${summary.count} behavior events, average intensity ${summary.avg.toFixed(1)}/5, top trigger "${summary.topTrigger}", ${milestoneWins.length} milestones achieved, ${planProgress.done}/${planProgress.total} action steps complete. Be warm, non-diagnostic, and end with one concrete focus for next week.`,
          childProfile,
          scholarLens: "Integrated Balanced",
        }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setInsight(data.text || "");
    } catch {
      setInsight("### Insight unavailable\nCould not reach the AI service. Add your `GEMINI_API_KEY` in `.env.local` to generate live weekly insights.");
    } finally {
      setLoadingInsight(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <BarChart2 className="w-7 h-7 text-[#d7aa55]" /> Weekly Report
          </h2>
          <p className="text-sm text-[#a8a093] mt-1">Week of {new Date().toLocaleDateString(undefined, { month: "long", day: "numeric" })} · {id}</p>
        </div>
        <button onClick={generateInsight} disabled={loadingInsight} className="bg-[#d7aa55] hover:bg-[#c39947] disabled:bg-white/5 text-black font-extrabold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-2">
          {loadingInsight ? (<><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating…</>) : (<><Sparkles className="w-3.5 h-3.5" /> Generate AI insight</>)}
        </button>
      </div>

      {/* Behavior summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#141821] border border-white/10 rounded-2xl p-5">
          <span className="text-[10px] uppercase font-black tracking-wider text-[#a8a093]">📊 Behavior events</span>
          <div className="text-3xl font-black text-white mt-1">{summary.count}</div>
          <p className="text-[11px] text-[#a8a093] mt-1">avg intensity {summary.avg.toFixed(1)}/5</p>
        </div>
        <div className="bg-[#141821] border border-white/10 rounded-2xl p-5">
          <span className="text-[10px] uppercase font-black tracking-wider text-[#a8a093]">🎯 Top trigger</span>
          <div className="text-sm font-bold text-white mt-2 leading-snug">{summary.topTrigger}</div>
        </div>
        <div className="bg-[#141821] border border-white/10 rounded-2xl p-5">
          <span className="text-[10px] uppercase font-black tracking-wider text-[#a8a093]">📋 Action steps</span>
          <div className="text-3xl font-black text-white mt-1">{planProgress.done}<span className="text-lg text-[#a8a093]">/{planProgress.total}</span></div>
          <p className="text-[11px] text-[#a8a093] mt-1">steps complete</p>
        </div>
      </div>

      {/* AI insight */}
      <div className="bg-gradient-to-br from-[#d7aa55]/8 to-transparent border border-[#d7aa55]/15 rounded-2xl p-6 space-y-3">
        <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#d7aa55]" /> AI insight
        </span>
        {insight ? (
          <MarkdownBlock text={insight} className="space-y-2 text-sm" />
        ) : (
          <p className="text-sm text-[#a8a093]">Tap “Generate AI insight” to analyze this week&apos;s patterns.</p>
        )}
      </div>

      {/* Milestone wins + scholar spotlight */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#141821] border border-white/10 rounded-2xl p-6 space-y-3">
          <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-[#d7aa55]" /> Milestone wins ({milestoneWins.length})
          </span>
          {milestoneWins.length ? (
            <ul className="space-y-1.5 text-xs text-gray-200">
              {milestoneWins.slice(0, 6).map((m) => (
                <li key={m.id} className="flex items-center gap-2"><span className="text-emerald-400">✓</span> {m.title}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[#a8a093]">No milestones checked yet.</p>
          )}
          <button onClick={() => setActiveTab("milestones")} className="text-[11px] text-[#f4d991] hover:underline flex items-center gap-1">
            <ClipboardList className="w-3 h-3" /> Review milestones ➔
          </button>
        </div>

        <div className="bg-[#141821] border border-white/10 rounded-2xl p-6 space-y-3">
          <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5 text-[#d7aa55]" /> Scholar spotlight
          </span>
          <div>
            <strong className="text-white text-sm">{spotlight.name}</strong>
            <span className="text-[10px] text-[#a8a093] uppercase font-bold ml-2">{spotlight.concept}</span>
          </div>
          <p className="text-xs text-[#a8a093] leading-relaxed">{spotlight.value}</p>
          <button onClick={() => setActiveTab("scholar")} className="text-[11px] text-[#f4d991] hover:underline">Explore Scholar Academy ➔</button>
        </div>
      </div>

      {/* Ready to share */}
      <div className="bg-[#141821] border border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider">📬 Ready to share</span>
          <p className="text-sm text-[#a8a093] mt-1">Compile a professional brief from this week for school or clinicians.</p>
        </div>
        <button
          onClick={() => {
            handleGenerateBrief();
            setActiveTab("handoff");
          }}
          className="bg-[#d7aa55] hover:bg-[#c39947] text-black font-extrabold text-xs px-5 py-3 rounded-2xl transition flex items-center gap-2 active:scale-[0.98]"
        >
          <Send className="w-3.5 h-3.5" /> Generate school brief
        </button>
      </div>
    </motion.div>
  );
}
