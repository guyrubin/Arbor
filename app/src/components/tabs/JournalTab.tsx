import React, { useMemo, useRef } from "react";
import { motion } from "motion/react";
import { BookHeart } from "lucide-react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { buildTimeline, type SignalKind, type TimelineSignal } from "../../lib/signalTimeline";
import { PASTEL, IconBadge, Chip, cardCls, domainVisual } from "../ui/kit";
import { HubHero } from "../ui/HubHero";
import { SpineRibbon } from "../ui/SpineRibbon";
import { WEEK_MS, tsMs } from "../../lib/pulse";
import { dailyPromptKeys } from "../../lib/promptBank";
import { weekStartKey } from "../../lib/behaviorUtils";
import { prefersReducedMotion } from "../../lib/devscore";
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

/** Compose modality tiles — Material Symbols glyphs matched to the Claude Design
 *  mock's behLogModes (mic / photo_camera / keyboard). */
const MODE_TILES: { ms: string; key: "voice" | "photo" | "text" }[] = [
  { ms: "mic", key: "voice" },
  { ms: "photo_camera", key: "photo" },
  { ms: "keyboard", key: "text" },
];

/** Per-domain Material Symbols glyph for the descriptive entry chip. Mirrors the
 *  kit's lucide DOMAIN_VISUALS one-for-one (Heart→favorite, Languages→translate,
 *  Brain→psychology, Users→group, Sprout→eco, Hand→sign_language, Globe→public)
 *  so the journal chip re-skins without forking the domain taxonomy. Descriptive
 *  only — no verdict, score, or trend is ever attached. */
const DOMAIN_MS: Record<DevelopmentalDomainId, string> = {
  attachment_regulation: "favorite",
  language_communication: "translate",
  cognition_executive_function: "psychology",
  social_development: "group",
  independence_adaptive_skills: "eco",
  sensory_motor_patterns: "sign_language",
  ecosystem_stressors: "public",
};

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
  const tone = dv.tone;
  const p = PASTEL[tone];
  // Auto entries lead with the "auto_awesome" (Arbor noticed) glyph; manual
  // entries lead with the hand-written "edit_note" glyph — matching the mock's
  // j.icon provenance. Filled to read as a confident, rounded tile mark; tone
  // follows the entry's domain.
  const leadMs = auto ? "auto_awesome" : "edit_note";
  return (
    <div className={`${cardCls} p-4 flex gap-3.5`}>
      <span
        className="inline-flex items-center justify-center rounded-[13px] flex-shrink-0"
        style={{ width: 42, height: 42, background: p.soft, color: p.ink }}
      >
        <Icon name={leadMs} size={22} fill={1} />
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
          <Chip tone={tone} icon={<Icon name={DOMAIN_MS[domain]} size={13} fill={1} />}>{domainLabel}</Chip>
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
    childProfile, setActiveTab, setNewLogNotes,
    behaviorLogs, milestones, actionPlans, memoryReviewItems, conversations, playLogs,
  } = useArbor();
  const { t, uiLang } = useLanguage();
  const locale = uiLang === "he" ? "he" : "en";
  const firstName = (childProfile.name || "").split(" ")[0];

  // E2 hero CTA target — scroll the composer into view and focus its first tile.
  const composeRef = useRef<HTMLDivElement | null>(null);
  const firstTileRef = useRef<HTMLButtonElement | null>(null);
  const focusComposer = () => {
    composeRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    firstTileRef.current?.focus({ preventScroll: true });
  };

  // E9 — today's 3 guiding-question keys: deterministic per child + local day
  // (promptBank derives everything from the passed date; no clock reads inside).
  const promptKeys = useMemo(
    () => dailyPromptKeys({ ageYears: childProfile.age, childId: childProfile.id, date: new Date() }),
    [childProfile.age, childProfile.id],
  );

  // Tapping a prompt pre-seeds the EXISTING capture flow (the Behaviors composer
  // note field) with the question, then routes there — same path as the tiles.
  const startFromPrompt = (key: string) => {
    setNewLogNotes(t(key));
    setActiveTab("behaviors");
  };

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

  // E2 hero stat trio — COUNTS ONLY (clinical firewall): moments this week,
  // total moments in the story, and distinct calendar weeks holding ≥1 moment.
  // No %, no verdicts, no deltas.
  const heroStats = useMemo(() => {
    const nowMs = Date.now();
    let week = 0;
    const weekKeys = new Set<string>();
    for (const s of signals) {
      if (!s.at) continue;
      const at = tsMs(s.at);
      if (nowMs - at < WEEK_MS && at <= nowMs) week++;
      weekKeys.add(weekStartKey(s.at));
    }
    return { week, total: signals.length, weeks: weekKeys.size };
  }, [signals]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-[840px] mx-auto flex flex-col gap-[18px]">
      {/* E2 — the shared hub-hero grammar (replaces PageHeader; same info, one kit) */}
      <HubHero
        tone="lav"
        icon={BookHeart}
        eyebrow={t("elev.hero.journal.eyebrow")}
        title={t("elev.hero.journal.title", { name: firstName })}
        subtitle={t("elev.hero.journal.sub")}
        cta={{ label: t("elev.hero.journal.cta"), onClick: focusComposer, testId: "journal-hero-cta" }}
        stats={[
          { value: heroStats.week, label: t("elev.stat.journal.week") },
          { value: heroStats.total, label: t("elev.stat.journal.total") },
          { value: heroStats.weeks, label: t("elev.stat.journal.weeks") },
        ]}
        testId="journal-hub-hero"
      />

      {/* Compose card — three modality tiles. All three trigger the EXISTING
          capture flow (BehaviorsTab) since there is no modality-hint capability
          to pre-select; the Voice/Photo/Text split is an entry affordance, not a
          new capture path. */}
      <div ref={composeRef} className={`${cardCls} p-[18px]`}>
        <div className="flex items-center gap-2.5 mb-3.5">
          <IconBadge tone="lav" size={32}><Icon name="edit_note" size={18} fill={1} /></IconBadge>
          <h2 className="text-[16px] font-extrabold tracking-[-0.01em]" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
            {t("journal.compose.title")}
          </h2>
        </div>

        {/* E9 — today's 3 guiding-question chips (deterministic rotation).
            Tapping pre-seeds the capture flow with the question. Chips are
            plain invitations — never assessments (clinical firewall). */}
        <div className="mb-3.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-lav-ink)" }}>
            {t("elev.prompt.lead")}
          </span>
          <div className="flex flex-wrap gap-2 mt-2">
            {promptKeys.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => startFromPrompt(k)}
                className="min-h-[44px] rounded-2xl px-4 py-2 text-[12.5px] font-bold text-start transition active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none"
                style={{ background: PASTEL.lav.soft, color: PASTEL.lav.ink, border: "1px solid var(--arbor-rule)" }}
                dir="auto"
              >
                {t(k)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {MODE_TILES.map(({ ms, key }, i) => (
            <button
              key={key}
              ref={i === 0 ? firstTileRef : undefined}
              type="button"
              onClick={() => setActiveTab("behaviors")}
              className="flex items-center justify-center gap-2 rounded-[13px] py-3.5 min-h-[44px] text-[12.5px] font-extrabold transition hover:-translate-y-0.5"
              style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
            >
              <Icon name={ms} size={21} fill={1} style={{ color: "var(--arbor-green-ink)" }} />
              {t(`journal.mode.${key}`)}
            </button>
          ))}
        </div>
      </div>

      {/* E3 — spine ribbon: what a saved moment feeds (one direction: → Story). */}
      <SpineRibbon
        tone="lav"
        icon="auto_stories"
        text={t("elev.spine.journal", { name: firstName })}
        onFollow={() => setActiveTab("timeline")}
        testId="journal-spine-ribbon"
      />

      <section className={`${cardCls} p-4 flex flex-col sm:flex-row sm:items-center gap-3`}>
        <IconBadge tone="sky" size={42}><Icon name="auto_stories" size={22} fill={1} /></IconBadge>
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
            {t("journal.storyDraft.title")}
          </h2>
          <p className="text-[12.5px] leading-relaxed mt-0.5" style={{ color: "var(--arbor-muted)" }}>
            {t("journal.storyDraft.body", { name: firstName, week: heroStats.week, total: heroStats.total })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveTab("timeline")}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 min-h-[44px] text-[12px] font-extrabold"
          style={{ background: PASTEL.sky.soft, color: PASTEL.sky.ink, border: "1px solid var(--arbor-rule)" }}
        >
          {t("journal.storyDraft.cta")} <Icon name="arrow_forward" size={14} className="rtl:-scale-x-100" />
        </button>
      </section>

      {/* Flat single-column feed */}
      {signals.length === 0 ? (
        <div className={`${cardCls} p-10 text-center`}>
          <div className="inline-flex"><IconBadge tone="lav" size={48}><Icon name="edit_note" size={26} fill={1} /></IconBadge></div>
          <p
            className="text-[17px] mt-4 max-w-md mx-auto leading-snug"
            style={{ fontFamily: "var(--font-editorial)", color: "var(--arbor-ink-soft)" }}
          >
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
