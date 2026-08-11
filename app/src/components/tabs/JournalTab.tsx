import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { Skeleton } from "../ui/Skeleton";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  groupByDay, SIGNAL_PROVENANCE, signalDetail, signalTitle,
  type SignalKind, type SignalProvenance, type TimelineSignal,
} from "../../lib/signalTimeline";
import { withChildSignals } from "../../lib/i18nElevation/childsignals";
import { classifyBehaviorDomain } from "../../lib/monitoring";
import { useTimeline } from "../../hooks/useTimeline";
import type { CaptureMode } from "../../context/ArborContext";
import { PASTEL, IconBadge, Chip, cardCls, domainVisual, type PastelKey } from "../ui/kit";
import { SpineRibbon } from "../ui/SpineRibbon";
import type { DevelopmentalDomainId } from "../../types";
import { bandForAge, type PlayDomain } from "../../playbank/content";
import { dailyPromptKeys } from "../../lib/promptBank";
import { track } from "../../lib/analytics";

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
 * Removed vs. the old dashboard-y Journal: the stat-trio hero, the "story
 * draft" CTA card, and the guiding-prompt strip — all duplicated capabilities
 * that live elsewhere (Story lives behind the timeline tab). The spine ribbon
 * returned in masterplan 1.5 as ONE quiet strip under the compose card (what a
 * saved moment feeds → the weekly story), not the old hero clutter.
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
  practice: "rocket_launch",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function JournalRow({
  signal,
  domain,
  prov,
  when,
  provLabel,
  domainLabel,
  title,
  detail,
  focused = false,
}: {
  signal: TimelineSignal;
  domain: DevelopmentalDomainId | null;
  /** JRNL-4 + masterplan 1.4: manual = the parent, auto = Arbor, child = the child. */
  prov: SignalProvenance;
  when: string;
  provLabel: string;
  domainLabel: string;
  title: string;
  detail: string;
  /** TODAY-6: true while this row is the target of an evidence deep-link —
   *  a brief calm highlight so the parent lands on the cited entry. */
  focused?: boolean;
}) {
  const tone: PastelKey = domain ? domainVisual(domain).tone : (signal.tone as PastelKey);
  const p = PASTEL[tone];
  const glyph = domain ? DOMAIN_MS[domain] : KIND_MS[signal.kind];
  return (
    <article
      id={`journal-signal-${signal.id}`}
      className="flex gap-3.5 border-b py-4 last:border-b-0 rounded-xl transition-colors"
      style={{ borderColor: "var(--arbor-rule)", background: focused ? "var(--arbor-green-soft)" : undefined }}
    >
      {/* Colored icon tile — tone + glyph follow the entry's domain (kind fallback). */}
      <span
        className="inline-flex items-center justify-center rounded-full flex-shrink-0"
        style={{ width: 40, height: 40, background: p.soft, color: p.ink }}
      >
        <Icon name={glyph} size={22} fill={1} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Provenance badge — AUTO gets the accent "Arbor" mark, CHILD a soft
              lav chip with the child's name, MANUAL a neutral "You" one. */}
          <span
            className="inline-flex items-center gap-1 text-[var(--t-xs)] font-extrabold uppercase tracking-wide rounded-md px-2 py-0.5"
            dir="auto"
            style={
              prov === "auto"
                ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }
                : prov === "child"
                  ? { background: PASTEL.lav.soft, color: PASTEL.lav.ink }
                  : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }
            }
          >
            {prov === "auto" && <Icon name="auto_awesome" size={12} fill={1} />}
            {prov === "child" && <Icon name="child_care" size={12} fill={1} />}
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
  const { setActiveTab, requestCapture, milestones, playLogs, behaviorLogs, logsLoaded, pendingJournalFocusId, consumeJournalFocus, childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const locale = uiLang === "he" ? "he" : "en";
  // elev.childsignals.* keys (practice-kind titles) resolve from the module
  // until it registers in i18nElevation/index.ts (owned elsewhere this wave).
  const tt = useMemo(() => withChildSignals(t, uiLang === "he"), [t, uiLang]);
  // Fallback via the registered i18n key (inline he-ternaries are banned in
  // components/ by the i18nInlineCopy guard).
  const childFirstName = (childProfile.name || "").split(" ")[0] || t("learn.yourChild");

  // The ONE timeline read (hooks/useTimeline) — the same stream the Story
  // density renders. No second read, no new write path.
  const signals = useTimeline();

  // TODAY-6 evidence deep-link: when a citing surface (ProgressNarrative)
  // named a signal id, scroll to + briefly highlight exactly that row, then
  // clear the request (same consume-once contract as the capture seam).
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => {
    if (!pendingJournalFocusId) return;
    setFocusId(pendingJournalFocusId);
    consumeJournalFocus();
    // consumeJournalFocus is a stable context setter; depending on the id alone
    // keeps the consume-once contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingJournalFocusId]);
  useEffect(() => {
    if (!focusId || !logsLoaded) return;
    try {
      document.getElementById(`journal-signal-${focusId}`)?.scrollIntoView({ block: "center" });
    } catch { /* noop — jsdom/SSR safety */ }
    const timer = setTimeout(() => setFocusId(null), 4000);
    return () => clearTimeout(timer);
  }, [focusId, logsLoaded]);

  /** Open the real capture flow in the requested modality. Previously these
   *  tiles were decoys: all three ran a bare setActiveTab("behaviors"), so
   *  "Voice" and "Photo" promised a mode they never opened. `requestCapture`
   *  hands the mode to the capture surface, which acts on it and clears it. */
  const startCapture = (mode: CaptureMode) => {
    requestCapture(mode);
    setActiveTab("behaviors");
  };

  // W2 2.6 (Maytal's empty-journal ask): 3 rotating promptBank guiding
  // questions as tappable chips ABOVE the capture triad. Same deterministic
  // rotation + elev.prompt.* strings PromptCaptureCard mounts on Today (W1).
  // Tap = the question becomes the visible writing cue above the compose
  // card — NEVER injected into the draft body (the sanctioned W1 pattern:
  // the answer belongs in the log, not the question). Toggle-off on re-tap.
  const promptKeys = useMemo(
    () => dailyPromptKeys({ ageYears: childProfile.age, childId: childProfile.id, date: new Date() }),
    [childProfile.age, childProfile.id],
  );
  const [activePromptKey, setActivePromptKey] = useState<string | null>(null);
  const onPromptTap = (key: string) => {
    setActivePromptKey((cur) => (cur === key ? null : key));
    try { track("journal_prompt_tap", { band: bandForAge(childProfile.age) }); } catch { /* noop */ }
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
      {/* W2 2.6 — active writing cue: the tapped guiding question, visible
          ABOVE the compose card while the parent captures. Display only —
          the question text never enters the draft body. */}
      {activePromptKey && (
        <div
          data-testid="journal-prompt-cue"
          className="flex items-start gap-2.5 rounded-[14px] px-4 py-3"
          style={{ background: PASTEL.lav.soft, color: PASTEL.lav.ink }}
          dir="auto"
          aria-live="polite"
        >
          <Icon name="lightbulb" size={18} fill={1} className="flex-shrink-0 mt-0.5" />
          <p className="text-[14px] font-bold leading-snug" style={{ fontFamily: "var(--font-display)" }}>
            {t(activePromptKey)}
          </p>
        </div>
      )}

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

        {/* W2 2.6 — three rotating promptBank chips above the capture triad
            (deterministic per child+day; elev.prompt.* strings, registered in
            i18nElevation/journal.ts). Tap toggles the writing cue above. */}
        <div className="mb-3">
          <p className="text-[11px] font-extrabold uppercase tracking-wider mb-1.5" style={{ color: "var(--arbor-muted)" }}>
            {t("elev.prompt.lead")}
          </p>
          <div className="flex flex-wrap gap-2" data-testid="journal-prompt-chips">
            {promptKeys.map((key) => {
              const active = key === activePromptKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onPromptTap(key)}
                  aria-pressed={active}
                  dir="auto"
                  className="min-h-[36px] rounded-full px-3.5 py-1.5 text-[12.5px] font-bold text-start transition active:scale-[0.98]"
                  style={
                    active
                      ? { background: PASTEL.lav.soft, color: PASTEL.lav.ink, border: `1px solid ${PASTEL.lav.ink}` }
                      : { background: "var(--arbor-paper-deep)", color: "var(--arbor-ink-soft)", border: "1px solid var(--arbor-rule)" }
                  }
                >
                  {t(key)}
                </button>
              );
            })}
          </div>
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

      {/* Masterplan 1.5 — spine ribbon: what a saved moment feeds (ONE direction:
          → the weekly story behind the timeline tab). Quiet strip below the
          header + compose region, never above them (Rule A keeps it off Today).
          Plain activity fact — no %, verdicts, or deltas (clinical firewall). */}
      <SpineRibbon
        tone="lav"
        icon="auto_stories"
        text={t("elev.spine.journal", { name: childFirstName })}
        onFollow={() => setActiveTab("timeline")}
        testId="journal-spine-ribbon"
      />

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
                // Masterplan 1.4: third provenance class — the CHILD's own
                // practice/play activity gets the child's name as its badge.
                const prov = SIGNAL_PROVENANCE[s.kind];
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
                    prov={prov}
                    when={when}
                    provLabel={prov === "auto" ? autoLabel : prov === "child" ? childFirstName : manualLabel}
                    domainLabel={domain ? t(`journal.domain.${domain}`) : ""}
                    title={signalTitle(s, tt)}
                    detail={signalDetail(s, tt)}
                    focused={s.id === focusId}
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
