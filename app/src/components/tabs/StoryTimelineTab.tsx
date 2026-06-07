import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Activity, CheckCircle2, Sprout, BookMarked, MessageSquare,
  ArrowUpRight, ArrowDownRight, Minus, Sparkles, Camera, TrendingDown, TrendingUp, BarChart2,
} from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import {
  buildTimeline, computeMomentum, deriveNextStep, groupByDay,
  type SignalKind, type SignalTone, type TimelineSignal,
} from "../../lib/signalTimeline";
import { PageHeader, PASTEL, IconBadge, Chip, cardCls, type PastelKey } from "../ui/kit";

const KIND_ICON: Record<SignalKind, React.ComponentType<{ className?: string }>> = {
  moment: Activity,
  milestone: CheckCircle2,
  plan: Sprout,
  memory: BookMarked,
  coach: MessageSquare,
};

const KIND_LABEL: Record<SignalKind, string> = {
  moment: "Moment",
  milestone: "Milestone",
  plan: "Plan",
  memory: "Memory",
  coach: "Coach",
};

const FILTERS: { key: SignalKind | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "moment", label: "Moments" },
  { key: "milestone", label: "Milestones" },
  { key: "plan", label: "Plans" },
  { key: "memory", label: "Memory" },
  { key: "coach", label: "Coach" },
];

function StatTile({ tone, icon, value, label, foot }: {
  tone: PastelKey; icon: React.ReactNode; value: React.ReactNode; label: string; foot?: React.ReactNode;
}) {
  return (
    <div className={`${cardCls} p-4 flex items-center gap-3.5`}>
      <IconBadge tone={tone} size={42}>{icon}</IconBadge>
      <div className="min-w-0">
        <div className="text-[1.45rem] leading-none font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{value}</div>
        <div className="text-[11px] font-bold mt-1 truncate" style={{ color: "var(--arbor-muted)" }}>{label}</div>
        {foot && <div className="text-[10.5px] font-bold mt-0.5">{foot}</div>}
      </div>
    </div>
  );
}

function IntensityDots({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Intensity ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className="w-1.5 h-1.5 rounded-full" style={{ background: n <= value ? PASTEL.coral.ink : "var(--arbor-rule-strong)" }} />
      ))}
    </span>
  );
}

function SignalRow({ signal }: { signal: TimelineSignal }) {
  const Icon = KIND_ICON[signal.kind];
  const tone = signal.tone as SignalTone as PastelKey;
  return (
    <div className="relative pl-12">
      {/* node on the rail */}
      <span className="absolute left-[14px] top-1.5 -translate-x-1/2 w-3 h-3 rounded-full ring-4 ring-[var(--arbor-paper)]" style={{ background: PASTEL[tone].ink }} />
      <div className={`${cardCls} p-3.5`}>
        <div className="flex items-start gap-3">
          <IconBadge tone={tone} size={34}><Icon className="w-4 h-4" /></IconBadge>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: PASTEL[tone].ink }}>{KIND_LABEL[signal.kind]}</span>
              {typeof signal.intensity === "number" && <IntensityDots value={signal.intensity} />}
              {signal.at && <span className="text-[10.5px] font-semibold ml-auto" style={{ color: "var(--arbor-muted)" }}>{new Date(signal.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>}
            </div>
            <p className="text-sm font-extrabold mt-0.5" style={{ color: "var(--arbor-ink)" }}>{signal.title}</p>
            {signal.detail && <p className="text-[12.5px] mt-0.5 leading-snug line-clamp-2" style={{ color: "var(--arbor-muted)" }}>{signal.detail}</p>}
            {signal.meta && <div className="mt-2"><Chip tone={tone}>{signal.meta}</Chip></div>}
          </div>
          {signal.photo && (
            <img src={signal.photo} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border" style={{ borderColor: "var(--arbor-rule)" }} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function StoryTimelineTab() {
  const {
    behaviorLogs, milestones, actionPlans, conversations, memoryReviewItems,
    childProfile, setActiveTab, setChatInput,
  } = useArbor();
  const [filter, setFilter] = useState<SignalKind | "all">("all");

  const signals = useMemo(
    () => buildTimeline({ behaviorLogs, milestones, plans: actionPlans, memory: memoryReviewItems, conversations }),
    [behaviorLogs, milestones, actionPlans, memoryReviewItems, conversations],
  );
  const momentum = useMemo(
    () => computeMomentum(behaviorLogs, actionPlans, milestones),
    [behaviorLogs, actionPlans, milestones],
  );
  const nextStep = useMemo(() => deriveNextStep(momentum, childProfile.name), [momentum, childProfile.name]);

  const shown = filter === "all" ? signals : signals.filter((s) => s.kind === filter);
  const groups = useMemo(() => groupByDay(shown), [shown]);

  const firstName = childProfile.name?.split(" ")[0] || "Your child";

  const TrendArrow = momentum.momentTrend === "up" ? ArrowUpRight : momentum.momentTrend === "down" ? ArrowDownRight : Minus;
  const trendColor = momentum.momentTrend === "down" ? PASTEL.mint.ink : momentum.momentTrend === "up" ? PASTEL.coral.ink : "var(--arbor-muted)";

  const handleCoach = (prompt: string) => {
    setChatInput(prompt);
    setActiveTab("coach");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
      <PageHeader
        eyebrow="Child Intelligence"
        title={`${firstName}'s Story`}
        subtitle="Every moment, milestone, plan and insight — one living timeline. Each entry feeds the next step Arbor suggests."
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("weekly")}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold transition bg-white"
              style={{ color: "#1f8a5a", border: "1px solid rgba(52,178,119,0.30)" }}
            >
              <BarChart2 className="w-4 h-4" /> Weekly insight
            </button>
            <button
              onClick={() => setActiveTab("behaviors")}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-extrabold transition hover:-translate-y-0.5"
              style={{ background: PASTEL.coral.ink, color: "#fff" }}
            >
              <Camera className="w-4 h-4" /> Capture a moment
            </button>
          </div>
        }
      />

      {/* Momentum strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          tone="coral" icon={<Activity className="w-5 h-5" />}
          value={momentum.momentsThisWeek} label="Moments this week"
          foot={<span className="inline-flex items-center gap-0.5" style={{ color: trendColor }}>
            <TrendArrow className="w-3 h-3" />
            {momentum.momentsPrevWeek > 0 ? `vs ${momentum.momentsPrevWeek} last week` : "first week"}
          </span>}
        />
        <StatTile
          tone="mint" icon={momentum.intensityTrend === "rising" ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          value={momentum.avgIntensityThisWeek != null ? `${momentum.avgIntensityThisWeek}/5` : "—"}
          label="Avg intensity"
          foot={<span style={{ color: momentum.intensityTrend === "easing" ? PASTEL.mint.ink : momentum.intensityTrend === "rising" ? PASTEL.coral.ink : "var(--arbor-muted)" }}>
            {momentum.intensityTrend === "none" ? "no data yet" : momentum.intensityTrend}
          </span>}
        />
        <StatTile
          tone="sky" icon={<Sprout className="w-5 h-5" />}
          value={`${momentum.planSteps.done}/${momentum.planSteps.total || 0}`}
          label="Plan steps done"
          foot={<span style={{ color: "var(--arbor-muted)" }}>{momentum.winsThisWeek} win{momentum.winsThisWeek === 1 ? "" : "s"} this week</span>}
        />
        <StatTile
          tone="lav" icon={<CheckCircle2 className="w-5 h-5" />}
          value={`${momentum.milestones.observed}/${momentum.milestones.total || 0}`}
          label="Milestones observed"
        />
      </div>

      {/* Proactive next-best-step — the timeline feeding the coach */}
      {nextStep && (
        <div className="rounded-[22px] p-5 flex flex-col sm:flex-row sm:items-center gap-4" style={{ background: PASTEL.coral.soft }}>
          <IconBadge tone="coral" size={44}><Sparkles className="w-5 h-5" /></IconBadge>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: PASTEL.coral.ink }}>Arbor noticed</span>
            <p className="text-sm font-bold mt-0.5" style={{ color: "var(--arbor-ink)" }}>{nextStep.message}</p>
          </div>
          {nextStep.cta && (
            <button
              onClick={() => (nextStep.cta!.prompt ? handleCoach(nextStep.cta!.prompt) : setActiveTab("behaviors"))}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-extrabold flex-shrink-0 transition hover:-translate-y-0.5"
              style={{ background: PASTEL.coral.ink, color: "#fff" }}
            >
              {nextStep.cta.label} →
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      {signals.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          {FILTERS.map((f) => {
            const on = filter === f.key;
            const n = f.key === "all" ? signals.length : signals.filter((s) => s.kind === f.key).length;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold whitespace-nowrap transition flex-shrink-0"
                style={on ? { background: "#e4f4ec", color: "#1f8a5a" } : { background: "#fff", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
              >
                {f.label} <span className="opacity-60">{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Timeline */}
      {shown.length === 0 ? (
        <div className={`${cardCls} p-10 text-center`}>
          <IconBadge tone="coral" size={52}><Camera className="w-6 h-6" /></IconBadge>
          <h3 className="text-lg font-extrabold mt-3" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
            {firstName}'s story starts here
          </h3>
          <p className="text-sm mt-1.5 max-w-md mx-auto" style={{ color: "var(--arbor-muted)" }}>
            Capture a moment, ask Arbor a question, or track a milestone — everything you do flows into one living timeline.
          </p>
          <button
            onClick={() => setActiveTab("behaviors")}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-extrabold mt-4 transition hover:-translate-y-0.5"
            style={{ background: PASTEL.coral.ink, color: "#fff" }}
          >
            <Camera className="w-4 h-4" /> Capture the first moment
          </button>
        </div>
      ) : (
        <div className="space-y-7">
          {groups.map((group) => (
            <div key={group.key}>
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-[12px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-muted)" }}>{group.label}</h3>
                <span className="text-[11px] font-bold" style={{ color: "var(--arbor-rule-strong)" }}>{group.signals.length}</span>
                <span className="flex-1 h-px" style={{ background: "var(--arbor-rule)" }} />
              </div>
              <div className="relative space-y-2.5">
                {/* the connecting rail */}
                <span className="absolute left-[14px] top-1 bottom-1 w-px" style={{ background: "var(--arbor-rule)" }} aria-hidden />
                {group.signals.map((s) => <SignalRow key={s.id} signal={s} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
