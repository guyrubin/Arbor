import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { RefreshCw, Sparkles, Trophy, ClipboardList, GraduationCap, Send, History, ArrowLeft } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { MarkdownBlock } from "../ui/MarkdownBlock";
import { Skeleton } from "../ui/Skeleton";
import { scholarsInfo } from "../../initialData";
import { useChildCollection } from "../../hooks/useChildCollection";
import { authHeaders, getAiLanguage } from "../../lib/api";
import { PageHeader, SectionCard, cardCls, IconBadge } from "../ui/kit";

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
  const first = childProfile.name.split(" ")[0];

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      <button onClick={() => setActiveTab("timeline")} className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: "var(--arbor-muted)" }}>
        <ArrowLeft className="w-4 h-4" /> {first}'s Story
      </button>
      <PageHeader
        eyebrow="Child Intelligence"
        title="Weekly Insight"
        subtitle={selected ? `${selected.weekLabel} · ${selected.id}` : `${currentLabel} · ${currentId}`}
        action={
          <button
            onClick={() => void generate()}
            disabled={generating}
            className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#3cc081,#34b277 60%,#2a9c66)" }}
          >
            {generating ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</>) : (<><Sparkles className="w-4 h-4" /> {reports.some((r) => r.id === currentId) ? "Regenerate this week" : "Generate this week"}</>)}
          </button>
        }
      />

      {/* History strip */}
      {reports.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <History className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--arbor-muted)" }} />
          {reports.map((r) => {
            const on = r.id === selected?.id;
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className="text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap transition flex-shrink-0"
                style={on ? { background: "#e4f4ec", color: "#1f8a5a" } : { background: "#fff", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
              >
                {r.id}
              </button>
            );
          })}
        </div>
      )}

      {generating && !selected ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
        </div>
      ) : !selected ? (
        <div className={`${cardCls} p-8 text-center text-sm`} style={{ color: "var(--arbor-muted)" }}>
          No reports yet. Log a few moments this week, then generate your first report.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`${cardCls} p-5`}>
              <span className="text-[10px] uppercase font-extrabold tracking-wider" style={{ color: "var(--arbor-muted)" }}>Behavior events</span>
              <div className="text-3xl font-extrabold mt-1" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{selected.summary.count}</div>
              <p className="text-[11px] mt-1" style={{ color: "var(--arbor-muted)" }}>avg intensity {selected.summary.avg.toFixed(1)}/5</p>
            </div>
            <div className={`${cardCls} p-5`}>
              <span className="text-[10px] uppercase font-extrabold tracking-wider" style={{ color: "var(--arbor-muted)" }}>Top trigger</span>
              <div className="text-sm font-bold mt-2 leading-snug" style={{ color: "var(--arbor-ink)" }}>{selected.summary.topTrigger}</div>
            </div>
            <div className={`${cardCls} p-5`}>
              <span className="text-[10px] uppercase font-extrabold tracking-wider" style={{ color: "var(--arbor-muted)" }}>Action steps</span>
              <div className="text-3xl font-extrabold mt-1" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{selected.planProgress.done}<span className="text-lg" style={{ color: "var(--arbor-muted)" }}>/{selected.planProgress.total}</span></div>
              <p className="text-[11px] mt-1" style={{ color: "var(--arbor-muted)" }}>steps complete</p>
            </div>
          </div>

          <div className="rounded-[22px] p-6 space-y-3" style={{ background: "#e4f4ec" }}>
            <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "#1f8a5a" }}>
              <Sparkles className="w-3.5 h-3.5" /> AI insight
            </span>
            <MarkdownBlock text={selected.insight} className="space-y-2 text-sm" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <SectionCard title={`Milestone wins (${selected.milestoneWins.length})`} icon={<Trophy className="w-5 h-5" />} tone="mint">
              {selected.milestoneWins.length ? (
                <ul className="space-y-1.5 text-sm" style={{ color: "var(--arbor-ink)" }}>
                  {selected.milestoneWins.slice(0, 8).map((m, i) => (
                    <li key={i} className="flex items-center gap-2"><span style={{ color: "#1f8a5a" }}>✓</span> {m}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>No milestones checked in this report.</p>
              )}
              <button onClick={() => setActiveTab("milestones")} className="text-[11px] font-bold flex items-center gap-1 mt-3" style={{ color: "#1f8a5a" }}>
                <ClipboardList className="w-3 h-3" /> Review milestones →
              </button>
            </SectionCard>

            <SectionCard title="Scholar spotlight" icon={<GraduationCap className="w-5 h-5" />} tone="lav">
              <div className="flex items-baseline gap-2">
                <strong className="text-sm" style={{ color: "var(--arbor-ink)" }}>{selected.spotlight.name}</strong>
                <span className="text-[10px] uppercase font-bold" style={{ color: "var(--arbor-muted)" }}>{selected.spotlight.concept}</span>
              </div>
              <p className="text-xs leading-relaxed mt-2" style={{ color: "var(--arbor-muted)" }}>{selected.spotlight.value}</p>
              <button onClick={() => setActiveTab("scholar")} className="text-[11px] font-bold mt-3" style={{ color: "#6354c4" }}>Explore Scholar Frameworks →</button>
            </SectionCard>
          </div>

          <div className={`${cardCls} p-6 flex flex-col sm:flex-row items-center justify-between gap-4`}>
            <div className="flex items-center gap-3">
              <IconBadge tone="sky"><Send className="w-5 h-5" /></IconBadge>
              <div>
                <h3 className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>Ready to share</h3>
                <p className="text-sm mt-0.5" style={{ color: "var(--arbor-muted)" }}>Compile a professional brief from this week for school or clinicians.</p>
              </div>
            </div>
            <button
              onClick={() => {
                handleGenerateBrief();
                setActiveTab("handoff");
              }}
              className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3 transition active:scale-[0.98] flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#3cc081,#2a9c66)" }}
            >
              <Send className="w-4 h-4" /> Generate school brief for {first}
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}
