import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { Skeleton } from "../ui/Skeleton";
import { EmptyState, GhostBlock } from "../ui/EmptyState";
import { statesText } from "../../lib/i18nElevation/states";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  groupByDay, SIGNAL_PROVENANCE, signalDetail, signalTitle, weekWindow,
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
import { setCaptureCue } from "../../lib/captureCue";
import JournalEntrySheet from "../journal/JournalEntrySheet";
// AI-04 — the typed-turn proposals tray, and the ledger that records where a
// kept row came from. The tray is the ONLY new capture affordance here; both
// of its actions run existing seams (commitConversationProposal for the
// one-tap keep, requestCapture("ai-draft") for the edit-first route).
import CaptureProposalsTray from "../capture/CaptureProposalsTray";
import { provenanceForSignal, readCaptureProvenance, type KeptProvenance } from "../../lib/captureProvenance";

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
  // TJB-05 — Today's accepted/completed step, written back into the thread.
  action: "task_alt",
};

function JournalRow({
  signal,
  domain,
  prov,
  when,
  provLabel,
  domainLabel,
  title,
  detail,
  originLabel = "",
  focused = false,
  onOpen,
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
  /** AI-04: set only on a row the parent KEPT from an Arbor answer. The badge
   *  above still reads "You" — keeping it was the parent's act — but the words
   *  are Arbor's, and a row that does not say so is the defect AI-04 closes. */
  originLabel?: string;
  /** TODAY-6: true while this row is the target of an evidence deep-link —
   *  a brief calm highlight so the parent lands on the cited entry. */
  focused?: boolean;
  /** TJB-13: open this row's detail sheet. The row is the control. */
  onOpen: () => void;
}) {
  const tone: PastelKey = domain ? domainVisual(domain).tone : (signal.tone as PastelKey);
  const p = PASTEL[tone];
  const glyph = domain ? DOMAIN_MS[domain] : KIND_MS[signal.kind];
  return (
    /* TJB-13: the whole row is the affordance. It used to be an inert
       <article>: the feed showed a title and a two-line clamp and there was no
       way to read the rest, correct a typo, or even confirm what was saved —
       captured moments were write-only. `button` (not a click handler on a
       div) so keyboard and screen-reader users get the same door. */
    <button
      type="button"
      id={`journal-signal-${signal.id}`}
      onClick={onOpen}
      aria-label={title}
      className="flex w-full gap-3.5 border-b py-4 text-start last:border-b-0 rounded-xl transition-colors"
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
          {/* AI-04 provenance chip — this row's words came from an Arbor
              answer the parent chose to keep. Descriptive origin, never a
              verdict; omitted entirely on a row the parent wrote themselves. */}
          {originLabel && (
            <span
              data-testid="journal-row-origin"
              className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide rounded-md px-1.5 py-0.5"
              dir="auto"
              style={{ background: PASTEL.mint.soft, color: PASTEL.mint.ink }}
            >
              <Icon name="bookmark_added" size={11} fill={1} />
              {originLabel}
            </span>
          )}
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
      <Icon
        name="chevron_right"
        size={18}
        aria-hidden
        className="mt-1 flex-shrink-0 self-center rtl:-scale-x-100"
        style={{ color: "var(--arbor-faint)" }}
      />
    </button>
  );
}

export default function JournalTab() {
  const { setActiveTab, requestCapture, milestones, playLogs, behaviorLogs, logsLoaded, pendingJournalFocusId, consumeJournalFocus, childProfile, startEditLog } = useArbor();
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

  // AI-04 — the origin ledger for rows kept from an Arbor answer. Re-read when
  // the log ledger changes, which is exactly when a keep has just landed (the
  // tray writes the ledger row right after commitConversationProposal returns
  // the committed log id). Read-only here; the Journal never writes it.
  const [keptProvenance, setKeptProvenance] = useState<KeptProvenance[]>([]);
  useEffect(() => {
    setKeptProvenance(readCaptureProvenance(childProfile.id));
  }, [childProfile.id, behaviorLogs]);
  const originLabel = t("elev.waveR.provenance.chip");

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
    // TJB-12: carry the tapped writing prompt onto the capture form. It rides
    // its OWN channel, never the capture call — the sanctioned W1 rule is that
    // the question is a visible cue and never draft content, so the mode
    // handoff below stays mode-only.
    setCaptureCue(activePromptKey);
    requestCapture(mode);
    setActiveTab("behaviors");
  };

  // Masterplan 4.3 teach-empty: the empty feed's ONE CTA focuses the capture
  // bar (the compose card's modality tiles) instead of duplicating a second
  // capture path — the filled state is reached exactly where it always is.
  const composeRef = useRef<HTMLElement | null>(null);
  const focusCaptureBar = () => {
    try { track("empty_cta_tap", { surface: "journal" }); } catch { /* noop */ }
    const section = composeRef.current;
    if (!section) return;
    try { section.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* jsdom/SSR */ }
    section.querySelector<HTMLButtonElement>("[data-capture-bar] button")?.focus();
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

  // TJB-13: the tapped row. Journal rows were inert — a saved moment could be
  // seen (clamped to two lines) but never read in full or corrected. The sheet
  // is READ + ROUTE: for the parent's own moments it hands off to the ONE
  // existing editor (startEditLog + the Behaviors capture form), never a
  // second copy of the log form.
  const [openSignal, setOpenSignal] = useState<TimelineSignal | null>(null);
  const openMomentLogId = (s: TimelineSignal | null): string | null =>
    s && s.kind === "moment" && s.id.startsWith("moment-") ? s.id.slice("moment-".length) : null;
  const editOpenSignal = () => {
    const logId = openMomentLogId(openSignal);
    if (!logId) return;
    startEditLog(logId);
    setOpenSignal(null);
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

  // JRNL-7 + F-09: ONE counting source of truth — the shared weekWindow
  // selector. The header stat ("This week in the story") AND the story-copy
  // slice both derive from the SAME trailing-7-day list, so "connecting N
  // moments" can never exceed the adjacent week count (previously the slice
  // came from the all-time stream while the stat counted the week).
  const weekSignals = useMemo(() => weekWindow(signals, Date.now()), [signals]);
  const weekCount = weekSignals.length;

  const autoLabel = t("journal.auto");
  const manualLabel = t("journal.manual");
  const recentSignals = weekSignals.slice(0, 3);
  // JRNL-2: all header/compose copy lives in lib/i18n.ts (journal.* keys) so the
  // EN/HE parity guard covers it — no inline he-ternary strings on this surface.
  // Empty week → journal.story.empty ("One small moment is enough to begin…").
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
      <section ref={composeRef} className="rounded-[18px] p-4 sm:p-5" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-xs)" }}>
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

        <div className="grid grid-cols-3 gap-2" data-capture-bar>
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

      {/* AI-04 — the typed-turn proposals tray. A voice turn has had a review
          tray since Harbor; a typed turn produced nothing keepable at all, so
          the parent retyped what they had just read. Sits directly under the
          compose card because keeping a line IS a capture. Renders nothing
          when the last answer offers nothing keepable. */}
      <CaptureProposalsTray surface="journal" />

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
        /* Masterplan 4.3 — shared teach-empty: a ghosted miniature of a filled
           day-group teaches what saved moments become; the ONE CTA focuses the
           capture bar above. Copy = elev.states.journal.* (en+he, encouraging,
           never celebrating the zero). Replaces the bespoke card+IconBadge+
           editorial-font shape (one of the 3 competing EmptyState shapes). */
        <div className={`${cardCls} p-6 sm:p-8`} data-testid="journal-teach-empty">
          <EmptyState
            className="py-6"
            icon={<IconBadge tone="lav" size={48}><Icon name="edit_note" size={26} fill={1} /></IconBadge>}
            headline={statesText("elev.states.journal.head", uiLang === "he")}
            body={statesText("elev.states.journal.body", uiLang === "he", { name: childFirstName })}
            cta={statesText("elev.states.journal.cta", uiLang === "he")}
            onCta={focusCaptureBar}
            ctaTestId="journal-empty-cta"
            preview={
              /* Ghost of a filled day-group: day header rule + two moment rows
                 (icon tile, provenance line, text line) — same anatomy as
                 JournalRow so the promise matches the real filled state. */
              <div className="mx-auto w-full max-w-md space-y-4 text-start">
                <div className="flex items-center gap-3">
                  <GhostBlock className="h-3 w-16 rounded-full" />
                  <span className="h-px flex-1" style={{ background: "var(--arbor-rule)" }} />
                </div>
                {[0, 1].map((i) => (
                  <div key={i} className="flex gap-3.5">
                    <GhostBlock className="h-10 w-10 rounded-full flex-shrink-0" />
                    <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                      <div className="flex items-center gap-2">
                        <GhostBlock className="h-4 w-14 rounded-md" />
                        <GhostBlock className="h-4 w-20 rounded-full" />
                      </div>
                      <GhostBlock className={i === 0 ? "h-3 w-4/5" : "h-3 w-3/5"} />
                    </div>
                  </div>
                ))}
              </div>
            }
          />
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
                    originLabel={provenanceForSignal(keptProvenance, s.id) ? originLabel : ""}
                    focused={s.id === focusId}
                    onOpen={() => setOpenSignal(s)}
                  />
                );
              })}
            </div>
          ))}
        </section>
      )}

      {/* TJB-13 — the row's detail sheet. Rendered once for the whole feed;
          `signal === null` keeps it closed. */}
      <JournalEntrySheet
        signal={openSignal}
        domain={openSignal ? (domainOf.get(openSignal.id) ?? KIND_DOMAIN[openSignal.kind] ?? null) : null}
        domainLabel={(() => {
          const d = openSignal ? (domainOf.get(openSignal.id) ?? KIND_DOMAIN[openSignal.kind] ?? null) : null;
          return d ? t(`journal.domain.${d}`) : "";
        })()}
        prov={openSignal ? SIGNAL_PROVENANCE[openSignal.kind] : "manual"}
        provLabel={(() => {
          if (!openSignal) return manualLabel;
          const pv = SIGNAL_PROVENANCE[openSignal.kind];
          return pv === "auto" ? autoLabel : pv === "child" ? childFirstName : manualLabel;
        })()}
        when={openSignal?.at ? new Date(openSignal.at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : ""}
        title={openSignal ? signalTitle(openSignal, tt) : ""}
        detail={openSignal ? signalDetail(openSignal, tt) : ""}
        kept={openSignal ? provenanceForSignal(keptProvenance, openSignal.id) : null}
        onClose={() => setOpenSignal(null)}
        onEdit={openMomentLogId(openSignal) ? editOpenSignal : undefined}
      />
    </motion.div>
  );
}
