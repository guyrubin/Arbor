import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  buildMonthsLayer, computeMomentum, groupByDay,
  SIGNAL_PROVENANCE, signalDetail, signalMeta, signalTitle,
  type MonthNode, type SignalKind, type SignalTone, type TimelineSignal, type TranslateFn,
} from "../../lib/signalTimeline";
import { withChildSignals } from "../../lib/i18nElevation/childsignals";
import { useTimeline } from "../../hooks/useTimeline";
import { PageHeader, PASTEL, IconBadge, Chip, cardCls, type PastelKey } from "../ui/kit";
import { PARENT_RECORD_COPY } from "../companion/parentRecordCopy";
import { composeChildStory, childStoryToText } from "../../lib/childStory";
import { isolate } from "../../lib/i18n";
// OBJ-JOURNAL-05 (render half): the shared parent-words scrub. Pure and
// deterministic — its only dependency is lib/clinicalScan, no node builtins,
// no network — so the client can run the SAME rule the egress runs rather
// than trusting that the prompt held.
import { scrubMemoryProposals } from "../../server/parentWordsScrub";
import { track } from "../../lib/analytics";
import { ageYearsOf } from "../../lib/age/forChild";

/** Per-kind Material Symbols ligature — mirrors JournalTab's domain glyphs so the
 *  unified timeline re-skins onto the shared <Icon> system (no lucide). */
const KIND_ICON: Record<SignalKind, string> = {
  moment: "bolt",
  milestone: "check_circle",
  plan: "eco",
  memory: "bookmark",
  play: "eco",
  practice: "rocket_launch",
  // TJB-05 — Today's accepted/completed step.
  action: "task_alt",
  // B-AI-04 — a suggestion line the parent kept.
  kept: "bookmark_added",
};

/** JRNL-3: kind + filter labels resolve through i18n (timeline.* keys) at
 *  render so the HE/EN parity guard covers them — no baked English here. */
const KIND_LABEL_KEY: Record<SignalKind, string> = {
  moment: "timeline.kind.moment",
  milestone: "timeline.kind.milestone",
  plan: "timeline.kind.plan",
  memory: "timeline.kind.memory",
  play: "timeline.kind.play",
  // Resolves via withChildSignals until childsignals registers in i18nElevation/index.ts.
  practice: "elev.childsignals.kind",
  action: "elev.closeloop.thread.kind",
  kept: "elev.kept.thread.kind",
};

/* FU#62 (B-GROWTH-15) — the filter chips DERIVE from SignalKind: a Record
 * over the union, so a new kind is a compile error here until it has a chip
 * label (the list used to be a hand-kept array beside KIND_LABEL_KEY). Order
 * = insertion order. A chip still shows only when a row of its kind exists
 * (AI-04: a chip whose count can only read zero is a dead end). */
const FILTER_LABEL_KEY: Record<SignalKind, string> = {
  moment: "timeline.filter.moment",
  milestone: "timeline.filter.milestone",
  plan: "timeline.filter.plan",
  play: "timeline.filter.play",
  practice: "elev.childsignals.filter",
  action: "elev.closeloop.thread.filter",
  kept: "elev.kept.thread.filter",
  memory: "timeline.filter.memory",
};

const FILTERS: { key: SignalKind | "all"; labelKey: string }[] = [
  { key: "all", labelKey: "timeline.filter.all" },
  ...(Object.keys(FILTER_LABEL_KEY) as SignalKind[]).map((key) => ({ key, labelKey: FILTER_LABEL_KEY[key] })),
];

/* B-ASKJB-18: no intensity scale on a Story row. Five dots filled in coral
 * read as a severity grade on the child (law 1 — chromatic verdict), and the
 * row data carries `intensity` for every log, plain moments included. The
 * value stays in the record; the row never draws it. */

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
                >
                  <Icon name="child_care" size={12} fill={1} />
                  {childName || tt("elev.childsignals.prov.fallback")}
                </span>
              )}
              {/* B-DATA-10: resolved is a glyph + label, never a colour. */}
              {signal.resolved && (
                <span data-testid="signal-resolved" className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide" style={{ color: "var(--arbor-ink-soft)" }}>
                  <Icon name="check" size={12} />
                  {t("beh.resolved")}
                </span>
              )}
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
    <details className={`${cardCls} px-4 py-3`} data-testid="timeline-months-disclosure">
      <summary className="min-h-11 cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--arbor-clay)]" style={{ color: "var(--arbor-ink)" }}>
        {tt("elev.childsignals.months.title")}
      </summary>
      <div className="relative mt-4 space-y-5">
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
                  {signalTitle(m, tt)}
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
    </details>
  );
}

export default function StoryTimelineTab() {
  const {
    behaviorLogs, milestones, actionPlans, memoryReviewItems,
    childProfile, setActiveTab, openCaptureSheet,
    pendingMemoryItems,
    playLogs,
  } = useArbor();
  const { t, uiLang } = useLanguage();
  const locale = uiLang === "he" ? "he" : "en";
  const copy = PARENT_RECORD_COPY[uiLang === "he" ? "he" : "en"];
  const [filter, setFilter] = useState<SignalKind | "all">("all");

  const signals = useTimeline();
  // elev.childsignals.* labels resolve from the module until index.ts registration.
  const tt = useMemo(() => withChildSignals(t, uiLang === "he"), [t, uiLang]);
  // Masterplan 1.8 — month nodes for the "Over the months" spine.
  const months = useMemo(() => buildMonthsLayer(signals), [signals]);
  const momentum = useMemo(
    () => computeMomentum(behaviorLogs, actionPlans, milestones),
    [behaviorLogs, actionPlans, milestones],
  );

  // T4: narrate the moat into "The Story of {child}" — deterministic + grounded
  // only in parent-approved facts + the momentum signals (no model call, G2-safe).
  const story = useMemo(
    () => composeChildStory({
      name: childProfile.name,
      ageYears: ageYearsOf(childProfile),
      approvedFacts: memoryReviewItems
        .filter((m) => m.status === "approved")
        .map((m) => ({ fact: m.fact, source: m.source })),
      milestonesObserved: momentum.milestones.observed,
      // B-ASKJB-19 residue: no total — the story never prints a denominator.
      lang: uiLang,
      momentsThisWeek: momentum.momentsThisWeek,
      // momentsPrevWeek is deliberately NOT passed: composeChildStory no longer
      // renders a week-over-week clause (firewall), so feeding it the prior
      // window would only invite the comparison back.
      momentsPrevWeek: 0,
      // Wave-3 clinical subtraction → B-AI-02: the story input has no
      // intensity-trend field at all (a behavior-intensity verdict rendered as
      // prose is the same firewall leak as a chart).
      planWins: momentum.winsThisWeek,
    }),
    [childProfile.name, ageYearsOf(childProfile), memoryReviewItems, momentum, uiLang],
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

  /* OBJ-JOURNAL-05 — the memory queue proposed "Dylan experiences severe
     transition anxiety, which manifest as refusal": a severity adjective and a
     clinical noun, printed to a parent as a fact to approve. The prompt asks
     for plain words and the egress enforces them (server/parentWordsScrub);
     this is the same rule applied where it renders, so a proposal that
     predates the prompt change — or arrives from anywhere else — still cannot
     reach the parent in an assessment register. A fact that does not survive
     is DROPPED, never softened: a parent is not asked to approve a sentence
     Arbor cannot state in their words. */
  const memoryQueue = useMemo(() => scrubMemoryProposals(pendingMemoryItems), [pendingMemoryItems]);

  const shown = filter === "all" ? signals : signals.filter((s) => s.kind === filter);
  // JRNL-3: day-group labels localize via Intl; "Ongoing" comes from i18n.
  const groups = useMemo(
    () => groupByDay(shown, Date.now(), { locale, ongoingLabel: t("timeline.ongoing") }),
    [shown, locale, t],
  );

  const firstName = childProfile.name?.split(" ")[0] || tt("elev.childsignals.prov.fallback");

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
      <PageHeader
        title={tt("elev.childsignals.story.title", { name: isolate(firstName) })}
        flush
        action={!story.empty && (
          <button type="button" onClick={saveStory} data-testid="timeline-save-story"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 self-start rounded-full px-3.5 py-2 text-[13px] font-bold transition"
            style={{ color: "var(--arbor-lav-ink)", border: "1px solid var(--arbor-rule)" }}>
            <Icon name="download" size={18} /> {tt("elev.childsignals.story.save")}
          </button>
        )}
      />

      {/* The narrative stays available without repeating the title or delaying the ledger. */}
      <details className={`${cardCls} px-4 py-3`} data-testid="timeline-story-disclosure">
        <summary className="min-h-11 cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--arbor-clay)]" style={{ color: "var(--arbor-ink)" }}>{copy.storySummary}</summary>
        <div className="mt-3 space-y-3">
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
            <p className="text-[11px] font-semibold pt-1" style={{ color: "var(--arbor-muted)" }} dir="auto">
              {tt(`elev.childsignals.story.builtFrom.${story.factCount === 1 ? "one" : "many"}`, { count: story.factCount })}
            </p>
          )}
        </div>
      </details>

      <MonthsSpine nodes={months} locale={locale} tt={tt} />

      {/* Decisions live in Memory: one review door, with the same scrubbed queue count. */}
      {memoryQueue.length > 0 && (
        <button type="button" onClick={() => setActiveTab("memory")} data-testid="timeline-memory-review"
          className="flex min-h-11 w-full items-center gap-3 rounded-2xl px-4 py-3 text-start"
          style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}>
          <Icon name="verified_user" size={20} />
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{copy.reviewMemory}</span>
            <span className="block text-xs" style={{ color: "var(--arbor-muted)" }}>{tt(`elev.childsignals.story.memory.title.${memoryQueue.length === 1 ? "one" : "many"}`, { count: memoryQueue.length })}</span>
          </span>
          <Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" />
        </button>
      )}

      {/* Filters */}
      {signals.length > 0 && (
        /* OBJ-JOURNAL-04: five of the eight chips read zero on a real ledger.
           A filter whose count is zero is not a filter — it is a dead end that
           empties the timeline and tells the parent nothing. Only kinds the
           stream actually holds get a chip; "all" always stays. The active
           filter also stays even if its count drops to zero mid-session, so a
           chip never vanishes under the parent's own finger. */
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1" data-testid="timeline-filter-chips">
          {FILTERS.filter((f) => f.key === "all" || filter === f.key || signals.some((s) => s.kind === f.key)).map((f) => {
            const on = filter === f.key;
            const n = f.key === "all" ? signals.length : signals.filter((s) => s.kind === f.key).length;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="touch-target inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold whitespace-nowrap transition flex-shrink-0"
                style={on ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" } : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
              >
                {tt(f.labelKey)} <span>{n}</span>
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
            {tt("elev.childsignals.story.empty.head", { name: isolate(firstName) })}
          </h3>
          <p className="text-sm mt-1.5 max-w-md mx-auto" style={{ color: "var(--arbor-muted)" }} dir="auto">
            {tt("elev.childsignals.story.empty.body")}
          </p>
          <button
            // B-ASKJB-30: the capture sheet opens in place (photo mode).
            onClick={() => openCaptureSheet({ mode: "photo" })}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-extrabold mt-4 transition motion-safe:hover:-translate-y-0.5"
            style={{ background: PASTEL.coral.ink, color: "var(--arbor-on-accent)" }}
          >
            <Icon name="photo_camera" size={18} /> {tt("elev.childsignals.story.empty.cta")}
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

    </motion.div>
  );
}
