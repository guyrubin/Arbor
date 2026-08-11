import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  buildMonthsLayer, computeMomentum, deriveNextStep, groupByDay,
  SIGNAL_PROVENANCE, signalDetail, signalMeta, signalTitle,
  type MonthNode, type SignalKind, type SignalTone, type TimelineSignal, type TranslateFn,
} from "../../lib/signalTimeline";
import { withChildSignals } from "../../lib/i18nElevation/childsignals";
import { useTimeline } from "../../hooks/useTimeline";
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
  practice: "rocket_launch",
};

/** JRNL-3: kind + filter labels resolve through i18n (timeline.* keys) at
 *  render so the HE/EN parity guard covers them — no baked English here. */
const KIND_LABEL_KEY: Record<SignalKind, string> = {
  moment: "timeline.kind.moment",
  milestone: "timeline.kind.milestone",
  plan: "timeline.kind.plan",
  memory: "timeline.kind.memory",
  coach: "timeline.kind.coach",
  play: "timeline.kind.play",
  // Resolves via withChildSignals until childsignals registers in i18nElevation/index.ts.
  practice: "elev.childsignals.kind",
};

const FILTERS: { key: SignalKind | "all"; labelKey: string }[] = [
  { key: "all", labelKey: "timeline.filter.all" },
  { key: "moment", labelKey: "timeline.filter.moment" },
  { key: "milestone", labelKey: "timeline.filter.milestone" },
  { key: "plan", labelKey: "timeline.filter.plan" },
  { key: "play", labelKey: "timeline.filter.play" },
  { key: "practice", labelKey: "elev.childsignals.filter" },
  { key: "memory", labelKey: "timeline.filter.memory" },
  { key: "coach", labelKey: "timeline.filter.coach" },
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

function SignalRow({ signal, childName }: { signal: TimelineSignal; childName?: string }) {
  const { t, uiLang } = useLanguage();
  const locale = uiLang === "he" ? "he" : "en";
  // elev.childsignals.* keys resolve from the module until index.ts registration.
  const tt = withChildSignals(t, uiLang === "he");
  const ms = KIND_ICON[signal.kind];
  const tone = signal.tone as SignalTone as PastelKey;
  // JRNL-3: labels/templates applied at render — the signal itself stays structured.
  const detail = signalDetail(signal, tt);
  const meta = signalMeta(signal, tt);
  const isChild = SIGNAL_PROVENANCE[signal.kind] === "child";
  return (
    <div className="relative ps-12">
      {/* node on the rail */}
      <span className="absolute start-[14px] top-1.5 -translate-x-1/2 w-3 h-3 rounded-full ring-4 ring-[var(--arbor-paper)]" style={{ background: PASTEL[tone].ink }} />
      <div className={`${cardCls} p-3.5`}>
        <div className="flex items-start gap-3">
          <IconBadge tone={tone} size={34}><Icon name={ms} size={18} fill={1} /></IconBadge>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: PASTEL[tone].ink }}>{tt(KIND_LABEL_KEY[signal.kind])}</span>
              {/* Child-provenance chip — the CHILD did this (vs You/Arbor). */}
              {isChild && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide rounded-md px-2 py-0.5"
                  style={{ background: PASTEL.lav.soft, color: PASTEL.lav.ink }}
                  dir="auto"
                >
                  <Icon name="child_care" size={12} fill={1} />
                  {childName || tt("elev.childsignals.prov.fallback")}
                </span>
              )}
              {typeof signal.intensity === "number" && <IntensityDots value={signal.intensity} />}
              {signal.at && <span className="text-[10.5px] font-semibold ms-auto" style={{ color: "var(--arbor-muted)" }}>{new Date(signal.at).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}</span>}
            </div>
            <p className="text-sm font-extrabold mt-0.5" style={{ color: "var(--arbor-ink)" }} dir="auto">{signalTitle(signal, tt)}</p>
            {detail && <p className="text-[12.5px] mt-0.5 leading-snug line-clamp-2" style={{ color: "var(--arbor-muted)" }} dir="auto">{detail}</p>}
            {meta && <div className="mt-2"><Chip tone={tone}>{meta}</Chip></div>}
          </div>
          {signal.photo && (
            <img src={signal.photo} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border" style={{ borderColor: "var(--arbor-rule)" }} />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Masterplan 1.8 — "Over the months / לאורך החודשים": the mockup's vertical
 * spine grouped by month (soft lav accents, single tone). Each month node =
 * that month's milestone crossings (an event list) + the CUMULATIVE
 * moments-captured total by that month ("by March: 89 moments" — monotonic).
 * FIREWALL: no month-vs-month comparison, no rate framing, no per-month
 * series; buildMonthsLayer exposes only events + a cumulative count.
 * Collapsed by default beyond the last 3 months.
 */
function MonthsSpine({ nodes, locale, tt }: { nodes: MonthNode[]; locale: string; tt: TranslateFn }) {
  const [showAll, setShowAll] = useState(false);
  if (nodes.length === 0) return null;
  const visible = showAll ? nodes : nodes.slice(0, 3);
  const earlier = nodes.length - 3;
  const monthLabel = (key: string) =>
    new Date(`${key}-01T12:00:00Z`).toLocaleDateString(locale, { month: "long", year: "numeric" });
  return (
    <SectionCard
      title={tt("elev.childsignals.months.title")}
      icon={<Icon name="calendar_month" size={20} fill={1} />}
      tone="lav"
    >
      <div className="relative space-y-5">
        {/* the connecting spine */}
        <span className="absolute start-[9px] top-1.5 bottom-1.5 w-px" style={{ background: "var(--arbor-rule)" }} aria-hidden />
        {visible.map((node) => (
          <div key={node.key} className="relative ps-8">
            {/* month node on the spine */}
            <span
              className="absolute start-[9px] top-1 -translate-x-1/2 w-3 h-3 rounded-full ring-4 ring-[var(--arbor-paper)]"
              style={{ background: PASTEL.lav.ink }}
            />
            <h4 className="text-[12px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-ink)" }}>
              {monthLabel(node.key)}
            </h4>
            {node.milestones.map((m) => (
              <div key={m.id} className="flex items-center gap-1.5 mt-1.5 min-w-0">
                <Icon name="check_circle" size={15} fill={1} style={{ color: PASTEL.lav.ink, flexShrink: 0 }} />
                <span className="text-[13px] font-bold truncate" style={{ color: "var(--arbor-ink)" }} dir="auto">
                  {tt("timeline.title.observed", { title: m.refTitle ?? "" })}
                </span>
              </div>
            ))}
            <p className="text-[11.5px] font-semibold mt-1.5" style={{ color: "var(--arbor-muted)" }} dir="auto">
              {tt("elev.childsignals.months.by", { month: monthLabel(node.key), count: node.cumulativeMoments })}
            </p>
          </div>
        ))}
      </div>
      {nodes.length > 3 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-4 text-xs font-bold"
          style={{ color: "var(--arbor-lav-ink)" }}
        >
          {showAll
            ? tt("elev.childsignals.months.hideEarlier")
            : tt("elev.childsignals.months.showEarlier", { n: earlier })}
        </button>
      )}
    </SectionCard>
  );
}

export default function StoryTimelineTab() {
  const {
    behaviorLogs, milestones, actionPlans, conversations, memoryReviewItems,
    childProfile, setActiveTab, seedCoach,
    pendingMemoryItems, handleMemoryDecision, isMemoryUpdating,
    playLogs,
  } = useArbor();
  const { t, uiLang } = useLanguage();
  const locale = uiLang === "he" ? "he" : "en";
  const [filter, setFilter] = useState<SignalKind | "all">("all");
  const [checkOpen, setCheckOpen] = useState(false);

  const signals = useTimeline();
  // elev.childsignals.* labels resolve from the module until index.ts registration.
  const tt = useMemo(() => withChildSignals(t, uiLang === "he"), [t, uiLang]);
  // Masterplan 1.8 — month nodes for the "Over the months" spine.
  const months = useMemo(() => buildMonthsLayer(signals), [signals]);
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
  // JRNL-3: day-group labels localize via Intl; "Ongoing" comes from i18n.
  const groups = useMemo(
    () => groupByDay(shown, Date.now(), { locale, ongoingLabel: t("timeline.ongoing") }),
    [shown, locale, t],
  );

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

      {/* Masterplan 1.8 — the months spine: milestone crossings + cumulative
          moments-captured totals, collapsed beyond the last 3 months. */}
      <MonthsSpine nodes={months} locale={locale} tt={tt} />

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
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-extrabold flex-shrink-0 transition motion-safe:hover:-translate-y-0.5"
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
                {tt(f.labelKey)} <span className="opacity-60">{n}</span>
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
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-extrabold mt-4 transition motion-safe:hover:-translate-y-0.5"
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
                {group.signals.map((s) => <SignalRow key={s.id} signal={s} childName={childProfile.name?.split(" ")[0]} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      <ScreeningSheet open={checkOpen} onClose={() => setCheckOpen(false)} />
    </motion.div>
  );
}
