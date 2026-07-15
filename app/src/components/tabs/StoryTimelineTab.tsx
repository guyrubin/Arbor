import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  buildTimeline, computeMomentum, deriveNextStep, groupByDay,
  type SignalKind, type SignalTone, type TimelineSignal,
} from "../../lib/signalTimeline";
import { PageHeader, PASTEL, IconBadge, Chip, SectionCard, cardCls, type PastelKey } from "../ui/kit";
import { MemoryRow } from "../sections/ChildMemory";
import ScreeningSheet from "../sections/ScreeningSheet";
import { composeChildStory, childStoryToText } from "../../lib/childStory";
import { track } from "../../lib/analytics";

/** Per-kind Material Symbols ligature — mirrors JournalTab's domain glyphs so the
 *  unified timeline re-skins onto the shared <Icon> system (no lucide). */
const KIND_ICON: Record<SignalKind, string> = {
  moment: "bolt",
  milestone: "check_circle",
  plan: "eco",
  memory: "bookmark",
  coach: "chat_bubble",
  play: "eco",
};

const KIND_LABEL: Record<SignalKind, string> = {
  moment: "Moment",
  milestone: "Milestone",
  plan: "Plan",
  memory: "Memory",
  coach: "Coach",
  play: "Play",
};

const FILTERS: { key: SignalKind | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "moment", label: "Moments" },
  { key: "milestone", label: "Milestones" },
  { key: "plan", label: "Plans" },
  { key: "play", label: "Play" },
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
  const ms = KIND_ICON[signal.kind];
  const tone = signal.tone as SignalTone as PastelKey;
  return (
    <div className="relative ps-12">
      {/* node on the rail */}
      <span className="absolute start-[14px] top-1.5 -translate-x-1/2 w-3 h-3 rounded-full ring-4 ring-[var(--arbor-paper)]" style={{ background: PASTEL[tone].ink }} />
      <div className={`${cardCls} p-3.5`}>
        <div className="flex items-start gap-3">
          <IconBadge tone={tone} size={34}><Icon name={ms} size={18} fill={1} /></IconBadge>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: PASTEL[tone].ink }}>{KIND_LABEL[signal.kind]}</span>
              {typeof signal.intensity === "number" && <IntensityDots value={signal.intensity} />}
              {signal.at && <span className="text-[10.5px] font-semibold ms-auto" style={{ color: "var(--arbor-muted)" }}>{new Date(signal.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>}
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
    childProfile, setActiveTab, seedCoach,
    pendingMemoryItems, handleMemoryDecision, isMemoryUpdating,
    playLogs,
  } = useArbor();
  const { t } = useLanguage();
  const [filter, setFilter] = useState<SignalKind | "all">("all");
  const [checkOpen, setCheckOpen] = useState(false);

  const signals = useMemo(
    () => buildTimeline({ behaviorLogs, milestones, plans: actionPlans, memory: memoryReviewItems, conversations, play: playLogs }),
    [behaviorLogs, milestones, actionPlans, memoryReviewItems, conversations, playLogs],
  );
  const momentum = useMemo(
    () => computeMomentum(behaviorLogs, actionPlans, milestones),
    [behaviorLogs, actionPlans, milestones],
  );
  const nextStep = useMemo(() => deriveNextStep(momentum, childProfile.name), [momentum, childProfile.name]);

  // T4: narrate the moat into "The Story of {child}" — deterministic + grounded
  // only in parent-approved facts + the momentum signals (no model call, G2-safe).
  const story = useMemo(
    () => composeChildStory({
      name: childProfile.name,
      ageYears: childProfile.age,
      approvedFacts: memoryReviewItems
        .filter((m) => m.status === "approved")
        .map((m) => ({ fact: m.fact, source: m.source })),
      milestonesObserved: momentum.milestones.observed,
      milestonesTotal: momentum.milestones.total,
      momentsThisWeek: momentum.momentsThisWeek,
      momentsPrevWeek: momentum.momentsPrevWeek,
      // Wave-3 clinical subtraction: never pass the intensity trend into the
      // story narrative (a behavior-intensity verdict rendered as prose is the
      // same firewall leak as a chart). The story now stays observational-only.
      intensityTrend: "none",
      planWins: momentum.winsThisWeek,
    }),
    [childProfile.name, childProfile.age, memoryReviewItems, momentum],
  );

  const saveStory = () => {
    try {
      const blob = new Blob([childStoryToText(story)], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${firstName.toLowerCase()}-story.txt`;
      a.click();
      URL.revokeObjectURL(url);
      track("child_story_saved", { facts: story.factCount });
    } catch {
      /* export is best-effort; never break the page */
    }
  };

  const shown = filter === "all" ? signals : signals.filter((s) => s.kind === filter);
  const groups = useMemo(() => groupByDay(shown), [shown]);

  const firstName = childProfile.name?.split(" ")[0] || "Your child";

  // Wave-3 clinical subtraction: the prior momentTrend arrow was color-coded
  // (coral = "more moments this week = bad", mint = "fewer = good") — a behavior
  // trend on a child metric = verdict-shaped. Removed. The flat momentsThisWeek
  // count renders with a neutral "vs N last week" comparison (descriptive only).

  const handleCoach = (prompt: string) => {
    seedCoach({ prompt, source: "story-timeline" });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
      <PageHeader
        eyebrow="My Child"
        title={`${firstName}'s Story`}
        subtitle="Every moment, milestone, plan and insight — one living timeline. Each entry feeds the next step Arbor suggests."
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setCheckOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold transition bg-white"
              style={{ color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.30)" }}
            >
              <Icon name="fact_check" size={18} /> {t("mychild.quickcheck.short")}
            </button>
            <button
              onClick={() => setActiveTab("weekly")}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold transition bg-white"
              style={{ color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.30)" }}
            >
              <Icon name="monitoring" size={18} /> Weekly insight
            </button>
          </div>
        }
      />

      {/* T4 — "The Story of {child}": the moat, narrated. Reads only approved
          facts + momentum; parent-owned, exportable as plain text. */}
      <SectionCard
        title={story.title}
        icon={<Icon name="edit_note" size={20} fill={1} />}
        tone="lav"
        action={!story.empty && (
          <button
            onClick={saveStory}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold transition bg-white"
            style={{ color: "var(--arbor-lav-ink)", border: "1px solid var(--arbor-rule)" }}
          >
            <Icon name="download" size={18} /> Save story
          </button>
        )}
      >
        <div className="space-y-3">
          {story.paragraphs.map((p, idx) => (
            <p
              key={idx}
              dir="auto"
              className="text-[14.5px] leading-relaxed"
              style={{ color: "var(--arbor-ink-soft)", ...(idx === 0 ? { fontFamily: "var(--font-display), Georgia, serif" } : {}) }}
            >
              {p}
            </p>
          ))}
          {!story.empty && (
            <p className="text-[11px] font-semibold pt-1" style={{ color: "var(--arbor-muted)" }}>
              Built from {story.factCount} approved {story.factCount === 1 ? "memory" : "memories"} — only what you chose to keep.
            </p>
          )}
        </div>
      </SectionCard>

      {/* Momentum strip — Wave-3 clinical subtraction (2026-06-26): the prior
          4-tile grid included an "Avg intensity X/5" tile with rising/easing
          TrendingUp/Down glyphs color-coded coral/mint = a behavior-intensity
          verdict on a child metric. Removed. The flat parent-log moment count +
          the plan-steps + milestones counts stay (all are flat parent-owned
          counts, no verdict). */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatTile
          tone="coral" icon={<Icon name="bolt" size={20} fill={1} />}
          value={momentum.momentsThisWeek} label="Moments this week"
          foot={<span style={{ color: "var(--arbor-muted)" }}>
            {momentum.momentsPrevWeek > 0 ? `vs ${momentum.momentsPrevWeek} last week` : "first week"}
          </span>}
        />
        <StatTile
          tone="sky" icon={<Icon name="eco" size={20} fill={1} />}
          value={`${momentum.planSteps.done}/${momentum.planSteps.total || 0}`}
          label="Plan steps done"
          foot={<span style={{ color: "var(--arbor-muted)" }}>{momentum.winsThisWeek} win{momentum.winsThisWeek === 1 ? "" : "s"} this week</span>}
        />
        <StatTile
          tone="lav" icon={<Icon name="check_circle" size={20} fill={1} />}
          value={`${momentum.milestones.observed}/${momentum.milestones.total || 0}`}
          label="Milestones observed"
        />
      </div>

      {/* Proactive next-best-step — the timeline feeding the coach */}
      {nextStep && (
        <div className="rounded-[22px] p-5 flex flex-col sm:flex-row sm:items-center gap-4" style={{ background: PASTEL.coral.soft }}>
          <IconBadge tone="coral" size={44}><Icon name="auto_awesome" size={20} fill={1} /></IconBadge>
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

      {/* Inline Memory review (b2): a contextual action queue, present only when
          there are pending facts. Reuses MemoryRow verbatim — single source of
          truth with the full ChildMemory page (deep-link "manage all" survives).
          Reads + writes the memory moat: provenance chips are preserved. */}
      {pendingMemoryItems.length > 0 && (
        <SectionCard
          title={t("mychild.memoryreview.title", { count: pendingMemoryItems.length })}
          icon={<Icon name="verified_user" size={20} fill={1} />}
          tone="yellow"
        >
          <div className="space-y-3">
            {pendingMemoryItems.slice(0, 3).map((m) => (
              <MemoryRow
                key={m.memoryId}
                m={m}
                busy={isMemoryUpdating === m.memoryId}
                onApprove={() => handleMemoryDecision(m.memoryId, "approved")}
                onReject={() => handleMemoryDecision(m.memoryId, "rejected")}
              />
            ))}
          </div>
          {pendingMemoryItems.length > 3 && (
            <button
              onClick={() => setActiveTab("memory")}
              className="mt-3 text-xs font-bold"
              style={{ color: "var(--arbor-green-ink)" }}
            >
              {t("mychild.memoryreview.all", { count: pendingMemoryItems.length })}
            </button>
          )}
        </SectionCard>
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
                style={on ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" } : { background: "#fff", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
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
          <IconBadge tone="coral" size={52}><Icon name="photo_camera" size={24} fill={1} /></IconBadge>
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
            <Icon name="photo_camera" size={18} /> Capture the first moment
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

      <ScreeningSheet open={checkOpen} onClose={() => setCheckOpen(false)} />
    </motion.div>
  );
}
