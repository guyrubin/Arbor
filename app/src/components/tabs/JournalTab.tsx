import React, { useMemo } from "react";
import { motion } from "motion/react";
import {
  Mic, Camera, Keyboard, Sparkles, PencilLine,
  type LucideIcon,
} from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { buildTimeline, type SignalKind, type TimelineSignal } from "../../lib/signalTimeline";
import { PageHeader, PASTEL, IconBadge, Chip, cardCls, domainVisual } from "../ui/kit";
import type { DevelopmentalDomainId } from "../../types";
import type { PlayDomain } from "../../playbank/content";

/**
 * UC-1 Journal (Wave 2) — the action-forward log surface.
 *
 * ADDITIVE: StoryTimelineTab/ChildMemory stay fully intact. This view reuses the
 * SAME shared engine (buildTimeline) and the MemoryRow ledger READ-only — it
 * never forks memory-approval logic and never writes a new event type.
 *
 * Anatomy:
 *  - a persistent COMPOSE card at top: Voice / Photo / Text tiles that trigger the
 *    EXISTING capture flow (setActiveTab('behaviors')) — no invented capture logic.
 *  - a flat single-column feed (~840px) of moment rows. Each row carries an
 *    AUTO(Arbor)-vs-MANUAL(You) provenance badge, a per-entry 7-domain chip, and a
 *    right-aligned relative time. Auto entries include kid-side moments
 *    (auto-detected milestones, coach-derived facts, approved memory, play).
 *
 * CLINICAL FIREWALL: domain chips are DESCRIPTIVE, never evaluative; no 0–100
 * score, verdict tag, intensity-trend coloring, or weakest-domain pointer.
 */

const MODE_TILES: { icon: LucideIcon; key: "voice" | "photo" | "text" }[] = [
  { icon: Mic, key: "voice" },
  { icon: Camera, key: "photo" },
  { icon: Keyboard, key: "text" },
];

/** PlayDomain (5) → the canonical 7-domain taxonomy for the per-entry chip. */
const PLAY_TO_DOMAIN: Record<PlayDomain, DevelopmentalDomainId> = {
  regulation: "attachment_regulation",
  language: "language_communication",
  motor: "sensory_motor_patterns",
  cognitive: "cognition_executive_function",
  social: "social_development",
};

/** Fallback domain by signal kind for sources that carry no explicit domain. */
const KIND_DOMAIN: Record<SignalKind, DevelopmentalDomainId> = {
  moment: "attachment_regulation",
  milestone: "cognition_executive_function",
  plan: "independence_adaptive_skills",
  memory: "cognition_executive_function",
  coach: "ecosystem_stressors",
  play: "cognition_executive_function",
};

/** Parent-logged moments are hand-written (manual). Everything Arbor derives —
 *  auto-detected milestones, coach-session facts, approved memory, logged play —
 *  is AUTO. Mirrors the design's j.auto provenance flag. */
const isAuto = (kind: SignalKind): boolean => kind !== "moment";

/** A locale-aware, human relative-time label for the right-aligned timestamp:
 *  "Today 8:05 AM" / "Yesterday" / weekday. Undated signals fall back to a
 *  plain "Ongoing" label. */
function relativeWhen(at: string | null, locale: string | undefined, ongoing: string): string {
  if (!at) return ongoing;
  const d = new Date(at);
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / dayMs);
  const time = d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  if (diffDays === 0) return `${relDay(0, locale)} ${time}`;
  if (diffDays === 1) return relDay(1, locale);
  if (diffDays > 1 && diffDays < 7) return d.toLocaleDateString(locale, { weekday: "long" });
  return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

/** "Today" / "Yesterday" via Intl.RelativeTimeFormat so He/En localize natively. */
function relDay(daysAgo: 0 | 1, locale: string | undefined): string {
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    // -0 / -1 day → "today" / "yesterday" in the active locale.
    return rtf.format(-daysAgo, "day");
  } catch {
    return daysAgo === 0 ? "Today" : "Yesterday";
  }
}

function JournalRow({
  signal,
  domain,
  auto,
  when,
  autoLabel,
  domainLabel,
}: {
  signal: TimelineSignal;
  domain: DevelopmentalDomainId;
  auto: boolean;
  when: string;
  autoLabel: string;
  domainLabel: string;
}) {
  const dv = domainVisual(domain);
  const DomainIcon = dv.icon;
  // Auto entries lead with the Sparkles "Arbor noticed" glyph; manual entries
  // lead with a hand-written PencilLine. The icon tone follows the entry's domain.
  const LeadIcon = auto ? Sparkles : PencilLine;
  const tone = dv.tone;
  const p = PASTEL[tone];
  return (
    <div className={`${cardCls} p-4 flex gap-3.5`}>
      <span
        className="inline-flex items-center justify-center rounded-[13px] flex-shrink-0"
        style={{ width: 42, height: 42, background: p.soft, color: p.ink }}
      >
        <LeadIcon className="w-5 h-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {auto && (
            <span
              className="text-[var(--t-xs)] font-extrabold uppercase tracking-wide rounded-md px-2 py-0.5"
              style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
            >
              {autoLabel}
            </span>
          )}
          <Chip tone={tone} icon={<DomainIcon className="w-3 h-3" />}>{domainLabel}</Chip>
          <span className="text-[11px] font-bold ms-auto" style={{ color: "var(--arbor-muted)" }}>{when}</span>
        </div>
        <p className="text-[13.5px] font-semibold mt-2 leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }} dir="auto">
          {signal.title}
        </p>
        {signal.detail && (
          <p className="text-[12.5px] mt-1 leading-snug line-clamp-2" style={{ color: "var(--arbor-muted)" }} dir="auto">
            {signal.detail}
          </p>
        )}
      </div>
      {signal.photo && (
        <img
          src={signal.photo}
          alt=""
          className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border"
          style={{ borderColor: "var(--arbor-rule)" }}
        />
      )}
    </div>
  );
}

export default function JournalTab() {
  const {
    childProfile, setActiveTab,
    behaviorLogs, milestones, actionPlans, memoryReviewItems, conversations, playLogs,
  } = useArbor();
  const { t, uiLang } = useLanguage();
  const locale = uiLang === "he" ? "he" : "en";

  // Reuse the shared timeline engine — the journal reads the SAME real data as
  // StoryTimelineTab. No new fetch, no new write path.
  const signals = useMemo(
    () => buildTimeline({ behaviorLogs, milestones, plans: actionPlans, memory: memoryReviewItems, conversations, play: playLogs }),
    [behaviorLogs, milestones, actionPlans, memoryReviewItems, conversations, playLogs],
  );

  // Per-signal domain: milestones + play carry an explicit domain; everything
  // else falls back to a sensible per-kind domain (descriptive, never a verdict).
  const domainOf = useMemo(() => {
    const map = new Map<string, DevelopmentalDomainId>();
    for (const m of milestones || []) {
      if (m.checked) map.set(`milestone-${m.id}`, m.domain);
    }
    for (const pl of playLogs || []) {
      map.set(`play-${pl.id}`, PLAY_TO_DOMAIN[pl.domain] ?? "cognition_executive_function");
    }
    return map;
  }, [milestones, playLogs]);

  const ongoingLabel = t("journal.ongoing");
  const autoLabel = t("journal.auto");

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[840px] mx-auto flex flex-col gap-[18px]">
      <PageHeader
        title={t("nav.title.journal")}
        subtitle={t("nav.sub.journal", { name: childProfile.name })}
      />

      {/* Compose card — three modality tiles. All three trigger the EXISTING
          capture flow (BehaviorsTab) since there is no modality-hint capability
          to pre-select; the Voice/Photo/Text split is an entry affordance, not a
          new capture path. */}
      <div className={`${cardCls} p-[18px]`}>
        <div className="flex items-center gap-2.5 mb-3.5">
          <IconBadge tone="lav" size={32}><PencilLine className="w-4 h-4" /></IconBadge>
          <h2 className="text-[15px] font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
            {t("journal.compose.title")}
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {MODE_TILES.map(({ icon: Icon, key }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab("behaviors")}
              className="flex items-center justify-center gap-2 rounded-[13px] py-3.5 text-[12.5px] font-extrabold transition hover:-translate-y-0.5"
              style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
            >
              <Icon className="w-5 h-5" style={{ color: "var(--arbor-green-ink)" }} />
              {t(`journal.mode.${key}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Flat single-column feed */}
      {signals.length === 0 ? (
        <div className={`${cardCls} p-10 text-center`}>
          <IconBadge tone="lav" size={48}><PencilLine className="w-6 h-6" /></IconBadge>
          <p className="text-[var(--t-sm)] mt-3 max-w-md mx-auto" style={{ color: "var(--arbor-muted)" }}>
            {t("journal.empty")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {signals.map((s) => {
            const kind = s.kind;
            const domain = domainOf.get(s.id) ?? KIND_DOMAIN[kind];
            const auto = isAuto(kind);
            return (
              <JournalRow
                key={s.id}
                signal={s}
                domain={domain}
                auto={auto}
                when={relativeWhen(s.at, locale, ongoingLabel)}
                autoLabel={autoLabel}
                domainLabel={t(`journal.domain.${domain}`)}
              />
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
