import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { BarChart2, RefreshCw, Sparkles, Trophy, ClipboardList, GraduationCap, Send, History } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { MarkdownBlock } from "../ui/MarkdownBlock";
import { Skeleton } from "../ui/Skeleton";
import { scholarsInfo } from "../../initialData";
import { useChildCollection } from "../../hooks/useChildCollection";
import { authHeaders, getAiLanguage } from "../../lib/api";

const DAY = 86_400_000;

function weekId(d = new Date()): string {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / DAY + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

type WeeklyReport = {
  id: string; // = weekId
  weekLabel: string;
  generatedAt: string;
  summary: { count: number; avg: number; topTrigger: string };
  milestoneWins: string[];
  planProgress: { done: number; total: number };
  spotlight: { name: string; concept: string; value: string };
  insight: string;
};

export default function WeeklyTab() {
  const { behaviorLogs, milestones, actionPlans, childProfile, setActiveTab, handleGenerateBrief } = useArbor();
  const reportsCol = useChildCollection<WeeklyReport>(childProfile.id, "weeklyReports");

  const [generating, setGenerating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const triedAuto = useRef<string | null>(null);

  const currentId = weekId();
  const currentLabel = `Week of ${new Date().toLocaleDateString(undefined, { month: "long", day: "numeric" })}`;

  const reports = useMemo(
    () => [...reportsCol.items].sort((a, b) => (a.id < b.id ? 1 : -1)),
    [reportsCol.items]
  );

  // Live snapshot of the current week (used at generation time).
  const snapshot = useMemo(() => {
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
    const wins = milestones.filter((m) => m.checked).map((m) => m.title);
    let done = 0;
    let total = 0;
    actionPlans.forEach((p) => p.phases.forEach((ph) => ph.steps.forEach((s) => {
      total += 1;
      if (s.completed) done += 1;
    })));
    const spotlight = scholarsInfo[new Date().getDate() % scholarsInfo.length];
    return {
      summary: { count: recent.length, avg, topTrigger },
      milestoneWins: wins,
      planProgress: { done, total },
      spotlight: { name: spotlight.name, concept: spotlight.concept, value: spotlight.value },
    };
  }, [behaviorLogs, milestones, actionPlans]);

  const generate = async () => {
    setGenerating(true);
    try {
      let insight = "";
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: await authHeaders(),
          body: JSON.stringify({
            message: `Write a single concise paragraph (3-4 sentences) analyzing this week's parenting patterns for ${childProfile.name} (age ${childProfile.age}). Data: ${snapshot.summary.count} behavior events, average intensity ${snapshot.summary.avg.toFixed(1)}/5, top trigger "${snapshot.summary.topTrigger}", ${snapshot.milestoneWins.length} milestones achieved, ${snapshot.planProgress.done}/${snapshot.planProgress.total} action steps complete. Warm, non-diagnostic, end with one concrete focus for next week. No headings.`,
            childProfile,
            scholarLens: "Integrated Balanced",
            language: getAiLanguage(),
          }),
        });
        if (res.ok) insight = String((await res.json()).text || "");
      } catch {
        insight = "";
      }
      if (!insight) {
        insight = "AI insight unavailable right now — the structured summary below still reflects this week. Add your model key/credentials to enable live weekly insights.";
      }
      const report: WeeklyReport = {
        id: currentId,
        weekLabel: currentLabel,
        generatedAt: new Date().toISOString(),
        ...snapshot,
        insight,
      };
      await reportsCol.upsert(report);
      setSelectedId(currentId);
    } finally {
      setGenerating(false);
    }
  };

  // Auto-generate the current week once if missing and there is data.
  useEffect(() => {
    if (!reportsCol.loaded) return;
    const hasCurrent = reportsCol.items.some((r) => r.id === currentId);
    if (!hasCurrent && triedAuto.current !== currentId && snapshot.summary.count > 0 && !generating) {
      triedAuto.current = currentId;
      void generate();
    }
    if (!selectedId) setSelectedId(reports[0]?.id ?? currentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportsCol.loaded, reportsCol.items, snapshot.summary.count]);

  const selected = reports.find((r) => r.id === selectedId) || reports[0] || null;

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <BarChart2 className="w-7 h-7 text-[#d7aa55]" /> Weekly Report
          </h2>
          <p className="text-sm text-[#a8a093] mt-1">{selected ? `${selected.weekLabel} · ${selected.id}` : `${currentLabel} · ${currentId}`}</p>
        </div>
        <button onClick={() => void generate()} disabled={generating} className="bg-[#d7aa55] hover:bg-[#c39947] disabled:bg-white/5 text-black font-extrabold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-2">
          {generating ? (<><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating…</>) : (<><Sparkles className="w-3.5 h-3.5" /> {reports.some((r) => r.id === currentId) ? "Regenerate this week" : "Generate this week"}</>)}
        </button>
      </div>

      {/* History strip */}
      {reports.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <History className="w-3.5 h-3.5 text-[#a8a093] flex-shrink-0" />
          {reports.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-full border whitespace-nowrap transition ${
                r.id === selected?.id ? "bg-[#d7aa55]/15 text-[#f4d991] border-[#d7aa55]/40" : "bg-white/[0.02] text-[#a8a093] border-white/5 hover:bg-white/5"
              }`}
            >
              {r.id}
            </button>
          ))}
        </div>
      )}

      {generating && !selected ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
        </div>
      ) : !selected ? (
        <div className="bg-[#141821] border border-white/10 rounded-2xl p-8 text-center text-sm text-[#a8a093]">
          No reports yet. Log a few moments this week, then generate your first report.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#141821] border border-white/10 rounded-2xl p-5">
              <span className="text-[10px] uppercase font-black tracking-wider text-[#a8a093]">📊 Behavior events</span>
              <div className="text-3xl font-black text-white mt-1">{selected.summary.count}</div>
              <p className="text-[11px] text-[#a8a093] mt-1">avg intensity {selected.summary.avg.toFixed(1)}/5</p>
            </div>
            <div className="bg-[#141821] border border-white/10 rounded-2xl p-5">
              <span className="text-[10px] uppercase font-black tracking-wider text-[#a8a093]">🎯 Top trigger</span>
              <div className="text-sm font-bold text-white mt-2 leading-snug">{selected.summary.topTrigger}</div>
            </div>
            <div className="bg-[#141821] border border-white/10 rounded-2xl p-5">
              <span className="text-[10px] uppercase font-black tracking-wider text-[#a8a093]">📋 Action steps</span>
              <div className="text-3xl font-black text-white mt-1">{selected.planProgress.done}<span className="text-lg text-[#a8a093]">/{selected.planProgress.total}</span></div>
              <p className="text-[11px] text-[#a8a093] mt-1">steps complete</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#d7aa55]/8 to-transparent border border-[#d7aa55]/15 rounded-2xl p-6 space-y-3">
            <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#d7aa55]" /> AI insight
            </span>
            <MarkdownBlock text={selected.insight} className="space-y-2 text-sm" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#141821] border border-white/10 rounded-2xl p-6 space-y-3">
              <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-[#d7aa55]" /> Milestone wins ({selected.milestoneWins.length})
              </span>
              {selected.milestoneWins.length ? (
                <ul className="space-y-1.5 text-xs text-gray-200">
                  {selected.milestoneWins.slice(0, 8).map((m, i) => (
                    <li key={i} className="flex items-center gap-2"><span className="text-emerald-400">✓</span> {m}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[#a8a093]">No milestones checked in this report.</p>
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
                <strong className="text-white text-sm">{selected.spotlight.name}</strong>
                <span className="text-[10px] text-[#a8a093] uppercase font-bold ml-2">{selected.spotlight.concept}</span>
              </div>
              <p className="text-xs text-[#a8a093] leading-relaxed">{selected.spotlight.value}</p>
              <button onClick={() => setActiveTab("scholar")} className="text-[11px] text-[#f4d991] hover:underline">Explore Scholar Academy ➔</button>
            </div>
          </div>

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
        </>
      )}
    </motion.div>
  );
}
