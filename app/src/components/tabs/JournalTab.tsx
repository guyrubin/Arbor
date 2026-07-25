import { useMemo } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { Skeleton } from "../ui/Skeleton";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  groupByDay, isAutoSignal, signalDetail, signalTitle,
  type SignalKind, type TimelineSignal,
} from "../../lib/signalTimeline";
import { classifyBehaviorDomain } from "../../lib/monitoring";
import { useTimeline } from "../../hooks/useTimeline";
import type { CaptureMode } from "../../context/ArborContext";
import { PASTEL, IconBadge, Chip, cardCls, domainVisual, type PastelKey } from "../ui/kit";
import type { DevelopmentalDomainId } from "../../types";
import type { PlayDomain } from "../../playbank/content";

/**
 * UC-1 Journal (wireframe-reconciled) — a single calm column of logged moments.
 *
 * ADDITIVE + READ-ONLY: StoryTimelineTab/ChildMemory stay fully intact. This view
 * reuses the SAME shared engine (buildTimeline) and reads the ledger READ-only —
 * it never forks memory-approval logic and never writes a new event type.
 *
 * Anatomy (top → bottom), reconciled to the wireframe's "Journal" screen:
 *  1. a COMPOSE card — "Log a moment" with three capture-mode tiles
 *     (Voice / Photo / Text) that open the EXISTING capture flow IN THE CHOSEN
 *     MODE via requestCapture(); the split is an entry affordance, not a new
 *     capture path.
 *  2. a flat single-column FEED (~840px) of moment rows, grouped by day with a
 *     slim sticky localized day header (JRNL-8 — the flat column is a validated
 *     call; do NOT restore the 2-col grid). Each row carries a colored domain
 *     icon tile, an AUTO(Arbor)-vs-MANUAL(You) provenance badge, a per-entry
 *     domain chip (omitted when the source can't be classified — never guessed,
 *     JRNL-6), and a right-aligned time within its day group.
 *
 * Removed vs. the old dashboard-y Journal: the stat-trio hero, the spine ribbon,
 * the "story draft" CTA card, and the guiding-prompt strip — all duplicated
 * capabilities that live elsewhere (Story lives behind the timeline tab).
 *
 * CLINICAL FIREWALL: domain chips are DESCRIPTIVE, never evaluative; no 0–100
 * score, verdict tag, intensity-trend coloring, or weakest-domain pointer.
 */

/** Compose modality tiles — Material Symbols glyphs (mic / photo_camera / keyboard). */
const MODE_TILES: { ms: string; key: CaptureMode }[] = [
  { ms: "mic", key: "voice" },
  { ms: "photo_camera", key: "photo" },
  { ms: "keyboard", key: "text" },
];

/** Per-domain Material Symbols glyph for the colored icon tile + descriptive chip.
 *  Mirrors the kit's lucide DOMAIN_VISUALS one-for-one so the journal re-skins
 *  without forking the domain taxonomy. Descriptive only — never a verdict. */
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

/** Fallback domain for derived kinds that carry no explicit domain. Moments are
 *  NOT here (JRNL-6): they classify via classifyBehaviorDomain, and when that
 *  returns null the chip is omitted rather than guessed. */
const KIND_DOMAIN: Partial<Record<SignalKind, DevelopmentalDomainId>> = {
  plan: "independence_adaptive_skills",
  memory: "cognition_executive_function",
  coach: "ecosystem_stressors",
};

/** Fallback glyph when a row has no domain (unclassifiable moment). */
const KIND_MS: Record<SignalKind, string> = {
  moment: "bolt",
  milestone: "check_circle",
  plan: "eco",
  memory: "bookmark",
  coach: "chat_bubble",
  play: "toys",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function JournalRow({
  signal,
  domain,
  auto,
  when,
  provLabel,
  domainLabel,
  title,
  detail,
}: {
  signal: TimelineSignal;
  domain: DevelopmentalDomainId | null;
  auto: boolean;
  when: string;
  provLabel: string;
  domainLabel: string;
  title: string;
  detail: string;
}) {
  const tone: PastelKey = domain ? domainVisual(domain).tone : (signal.tone as PastelKey);
  const p = PASTEL[tone];
  const glyph = domain ? DOMAIN_MS[domain] : KIND_MS[signal.kind];
  return (
    <article className="flex gap-3.5 border-b py-4 last:border-b-0" style={{ borderColor: "var(--arbor-rule)" }}>
      {/* Colored icon tile — tone + glyph follow the entry's domain (kind fallback). */}
      <span
        className="inline-flex items-center justify-center rounded-full flex-shrink-0"
        style={{ width: 40, height: 40, background: p.soft, color: p.ink }}
      >
        <Icon name={glyph} size={22} fill={1} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Provenance badge — AUTO gets the accent "Arbor" mark, MANUAL a neutral one. */}
          <span
            className="inline-flex items-center gap-1 text-[var(--t-xs)] font-extrabold uppercase tracking-wide rounded-md px-2 py-0.5"
            style={
              auto
                ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }
                : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }
            }
          >
            {auto && <Icon name="auto_awesome" size={12} fill={1} />}
            {provLabel}
          </span>
          {/* Domain chip — omitted when the entry can't be classified (JRNL-6). */}
          {domain && (
            <Chip tone={tone} icon={<Icon name={DOMAIN_MS[domain]} size={13} fill={1} />}>{domainLabel}</Chip>
          )}
          {when && (
            <span className="text-[11px] font-bold ms-auto" style={{ color: "var(--arbor-muted)" }}>{when}</span>
          )}
        </div>
        <p className="text-[13.5px] font-semibold mt-2 leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }} dir="auto">
          {title}
        </p>
        {detail && (
          <p className="text-[12.5px] mt-1 leading-snug line-clamp-2" style={{ color: "var(--arbor-muted)" }} dir="auto">
            {detail}
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
    </article>
  );
}

export default function JournalTab() {
  const { setActiveTab, requestCapture, milestones, playLogs, behaviorLogs, logsLoaded } = useArbor();
  const { t, uiLang } = useLanguage();
  const locale = uiLang === "he" ? "he" : "en";

  // The ONE timeline read (hooks/useTimeline) — the same stream the Story
  // density renders. No second read, no new write path.
  const signals = useTimeline();

  /** Open the real capture flow in the requested modality. Previously these
   *  tiles were decoys: all three ran a bare setActiveTab("behaviors"), so
   *  "Voice" and "Photo" promised a mode they never opened. `requestCapture`
   *  hands the mode to the capture surface, which acts on it and clears it. */
  const startCapture = (mode: CaptureMode) => {
    requestCapture(mode);
    setActiveTab("behaviors");
  };

  // Per-signal domain: milestones + play carry an explicit domain; moments
  // classify from their own text via classifyBehaviorDomain (JRNL-6) — when
  // that returns null the row simply carries no domain chip. Never guessed.
  const domainOf = useMemo(() => {
    const map = new Map<string, DevelopmentalDomainId>();
    for (const m of milestones || []) {
      if (m.checked) map.set(`milestone-${m.id}`, m.domain);
    }
    for (const pl of playLogs || []) {
      map.set(`play-${pl.id}`, PLAY_TO_DOMAIN[pl.domain] ?? "cognition_executive_function");
    }
    for (const log of behaviorLogs || []) {
      const d = classifyBehaviorDomain(log);
      if (d) map.set(`moment-${log.id}`, d);
    }
    return map;
  }, [milestones, playLogs, behaviorLogs]);

  // JRNL-8: the feed renders through the SAME groupByDay the Story density
  // uses — slim sticky localized day headers, time-only inside a group,
  // "Ongoing" last. The flat single column stays (validated call).
  const groups = useMemo(
    () => groupByDay(signals, Date.now(), { locale, ongoingLabel: t("timeline.ongoing") }),
    [signals, locale, t],
  );

  // JRNL-7: the header stat is labeled "This week in the story", so count the
  // dated signals inside the trailing 7-day window — not the all-time total.
  const weekCount = useMemo(() => {
    const now = Date.now();
    return signals.filter((s) => {
      if (!s.at) return false;
      const at = new Date(s.at).getTime();
      return at > now - 7 * DAY_MS && at <= now;
    }).length;
  }, [signals]);

  const autoLabel = t("journal.auto");
  const manualLabel = t("journal.manual");
  const recentSignals = signals.slice(0, 3);
  // JRNL-2: all header/compose copy lives in lib/i18n.ts (journal.* keys) so the
  // EN/HE parity guard covers it — no inline he-ternary strings on this surface.
  const storyCopy = recentSignals.length
    ? t("journal.story.body", { count: recentSignals.length })
    : t("journal.story.empty");

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto flex w-full min-w-0 max-w-[1080px] flex-col gap-5">
      <header className="border-b pb-5" style={{ borderColor: "var(--arbor-rule)" }}>
        <div className="grid min-w-0 items-end gap-5 md:grid-cols-[minmax(0,1.25fr)_minmax(220px,.75fr)]">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--arbor-lav-ink)" }}>
              <Icon name="auto_stories" size={16} fill={1} /> {t("journal.eyebrow")}
            </span>
            <h1 className="mt-2 text-[28px] sm:text-[34px] leading-[1.08] tracking-[-0.03em]" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
              {t("journal.title")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm sm:text-[15px] leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>{storyCopy}</p>
          </div>
          <div className="border-t pt-4 md:border-s md:border-t-0 md:ps-5 md:pt-0" style={{ borderColor: "var(--arbor-rule-strong)" }}>
            <p className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-muted)" }}>{t("journal.week.title")}</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-3xl font-black" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-lav-ink)" }}>{weekCount}</span>
              <span className="text-xs leading-snug" style={{ color: "var(--arbor-muted)" }}>{t("journal.week.sub")}</span>
            </div>
          </div>
        </div>
      </header>
      {/* Compose card — "Log a moment" + three modality tiles. All three trigger the
          EXISTING capture flow (BehaviorsTab); the Voice/Photo/Text split is an
          entry affordance, not a new capture path. */}
      <section className="rounded-[18px] p-4 sm:p-5" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-xs)" }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--arbor-lav-ink)" }}>{t("journal.compose.eyebrow")}</p>
          <h2 className="mt-1 text-[18px] font-extrabold tracking-[-0.01em]" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
            {t("journal.compose.title")}
          </h2>
          </div>
          <IconBadge tone="lav" size={34}><Icon name="edit_note" size={19} fill={1} /></IconBadge>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {MODE_TILES.map(({ ms, key }) => (
            <button
              key={key}
              type="button"
              onClick={() => startCapture(key)}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-[13px] px-3 py-3 text-[12px] font-extrabold transition motion-safe:hover:-translate-y-0.5"
              style={{ background: key === "voice" ? "var(--arbor-green-soft)" : "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
            >
              <Icon name={ms} size={21} fill={1} style={{ color: "var(--arbor-green-ink)" }} />
              {t(`journal.mode.${key}`)}
            </button>
          ))}
        </div>
      </section>

      {/* Flat single-column feed — day-grouped, gated on the ledger load (JRNL-7)
          so a returning parent never sees a false "No moments yet" flash. */}
      {!logsLoaded ? (
        <div className="flex flex-col gap-3" aria-hidden>
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : signals.length === 0 ? (
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
        <section aria-labelledby="journal-timeline-title">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 id="journal-timeline-title" className="text-[18px] font-extrabold" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>{t("journal.timeline.title")}</h2>
            <span className="text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>{signals.length} {t("journal.timeline.count")}</span>
          </div>
          {groups.map((group) => (
            <div key={group.key}>
              {/* Slim sticky day header — localized (Intl), start-aligned so it
                  mirrors correctly under RTL. */}
              <div
                className="sticky top-0 z-[5] -mx-1 flex items-center gap-3 px-1 py-1.5"
                style={{ background: "var(--arbor-paper)" }}
              >
                <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-start" style={{ color: "var(--arbor-muted)" }}>
                  {group.label}
                </h3>
                <span className="h-px flex-1" style={{ background: "var(--arbor-rule)" }} aria-hidden />
              </div>
              {group.signals.map((s) => {
                const domain = domainOf.get(s.id) ?? KIND_DOMAIN[s.kind] ?? null;
                const auto = isAutoSignal(s.kind);
                // Time-only inside a day group (the header carries the date);
                // undated rows sit under "Ongoing" and show no time.
                const when = s.at
                  ? new Date(s.at).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
                  : "";
                return (
                  <JournalRow
                    key={s.id}
                    signal={s}
                    domain={domain}
                    auto={auto}
                    when={when}
                    provLabel={auto ? autoLabel : manualLabel}
                    domainLabel={domain ? t(`journal.domain.${domain}`) : ""}
                    title={signalTitle(s, t)}
                    detail={signalDetail(s, t)}
                  />
                );
              })}
            </div>
          ))}
        </section>
      )}
    </motion.div>
  );
}
