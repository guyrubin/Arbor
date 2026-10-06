import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { FreeText } from "../ui/FreeText";
import { Skeleton } from "../ui/Skeleton";
import { EmptyState, GhostBlock } from "../ui/EmptyState";
import { statesText } from "../../lib/i18nElevation/states";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  groupByDay, journalFeedCountKey, SIGNAL_PROVENANCE, signalDetail, signalTitle, weekMomentCount,
  type SignalKind, type SignalProvenance, type TimelineSignal,
} from "../../lib/signalTimeline";
import { withChildSignals } from "../../lib/i18nElevation/childsignals";
import { classifyBehaviorDomain } from "../../lib/monitoring";
import { useTimeline } from "../../hooks/useTimeline";
import type { CaptureMode } from "../../context/ArborContext";
import { PASTEL, IconBadge, Chip, cardCls, domainVisual, type PastelKey } from "../ui/kit";
import type { DevelopmentalDomainId } from "../../types";
import { bandForAge, type PlayDomain } from "../../playbank/content";
import { dailyPromptKeys } from "../../lib/promptBank";
import { track } from "../../lib/analytics";
import JournalEntrySheet from "../journal/JournalEntrySheet";
import QuickLogModal from "../overview/QuickLogModal";
// AI-04 — the typed-turn proposals tray, and the ledger that records where a
// kept row came from. The tray is the ONLY new capture affordance here; both
// of its actions run existing seams (commitConversationProposal for the
// one-tap keep, requestCapture("ai-draft") for the edit-first route).
import { provenanceForSignal, readCaptureProvenance, type KeptProvenance } from "../../lib/captureProvenance";
import { JOURNAL_FILTERS, firstGroupOfMonth, isHardMomentSignal, journalMonthKeys, matchesJournalFilter, momentLogId, monthLabel, type JournalFilter } from "../../lib/journalFilters";
import { exportBehaviorPdf } from "../../lib/behaviorExport";
import { journalStoryState, lastKeptMoment } from "../../lib/journalLastKept";
import { fmtDay } from "../../lib/formatDate";
import { isIncidentType } from "../../content/behaviorTaxonomy";
import { ageYearsOf } from "../../lib/age/forChild";

/**
 * UC-1 Journal (wireframe-reconciled) — a single calm column of logged moments.
 *
 * ADDITIVE + READ-ONLY: StoryTimelineTab/ChildMemory stay fully intact. This view
 * reuses the SAME shared engine (buildTimeline) and reads the ledger READ-only —
 * it never forks memory-approval logic and never writes a new event type.
 *
 * Anatomy (top → bottom), reconciled to the wireframe's "Journal" screen:
 *  1. a COMPOSE card — "Log a moment" with three capture-mode tiles
 *     (Voice / Photo / Text) that open the ONE capture sheet (QuickLogModal)
 *     in place, IN THE CHOSEN MODE (B-TODAY-19); the split is an entry
 *     affordance, not a new capture path.
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
  health_sleep_feeding: "bedtime", // B-GROWTH-26: the 8th domain (body, sleep & eating)
};

/** PlayDomain (5) → the canonical 7-domain taxonomy for the per-entry chip. */
const PLAY_TO_DOMAIN: Record<PlayDomain, DevelopmentalDomainId> = {
  regulation: "attachment_regulation",
  language: "language_communication",
  motor: "sensory_motor_patterns",
  cognitive: "cognition_executive_function",
  social: "social_development",
};

/* B-ASKJB-13: no kind→domain fallback. A plan or memory row carries no
 * domain of its own, so it shows its kind icon (KIND_MS), never a guessed
 * domain chip. Only explicit data (milestone domain, PLAY_TO_DOMAIN, the
 * moment classifier) produces a chip. */

/** Fallback glyph when a row has no domain (unclassifiable moment). */
const KIND_MS: Record<SignalKind, string> = {
  moment: "bolt",
  milestone: "check_circle",
  plan: "eco",
  memory: "bookmark",
  play: "toys",
  practice: "rocket_launch",
  // TJB-05 — Today's accepted/completed step, written back into the thread.
  action: "task_alt",
  // B-AI-04 — a suggestion line the parent kept.
  kept: "bookmark_added",
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
  resolvedLabel = "",
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
  /** B-DATA-10: the "Resolved" label (beh.resolved), shown only on a resolved moment. */
  resolvedLabel?: string;
  /** TODAY-6: true while this row is the target of an evidence deep-link —
   *  a brief calm highlight so the parent lands on the cited entry. */
  focused?: boolean;
  /** TJB-13: open this row's detail sheet. The row is the control. */
  onOpen: () => void;
}) {
  const tone: PastelKey = domain ? domainVisual(domain).tone : (signal.tone as PastelKey);
  const p = PASTEL[tone];
  const glyph = domain ? DOMAIN_MS[domain] : KIND_MS[signal.kind];
  // NEXTLEVEL critic r1 (B-ASKJB-34, P0): on a row the parent wrote, the
  // parent's words ARE the row — verbatim, in the editorial serif — and the
  // machine type label ("A moment", "Departure Refusal") plus the time drop to
  // one quiet caption. Parent rows carry no provenance chip; Arbor and child
  // rows keep theirs, in sentence case.
  // P1-NEXTLEVEL critic r2: a kept memory fact is the parent's too — the fact
  // leads in the serif, captioned "Kept · time" (no machine title, no chip).
  const parentLead = prov === "manual" && (signal.kind === "moment" || signal.kind === "memory") && !!detail.trim();
  // P1-NEXTLEVEL critic r2: an Arbor row (prov auto) never leads the day at
  // full weight — t-sm secondary ink, no 40 px disc, no chip, "Arbor" a word
  // in the caption.
  const arborQuiet = prov === "auto";
  // B-ASKJB-34: the child's play and stories (one folded row a day) are the
  // quiet line under the parent's entries — regular weight, secondary ink.
  const quiet = prov === "child";
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
      aria-label={signal.resolved ? `${title} — ${resolvedLabel}` : title}
      className="flex w-full gap-3.5 border-b py-4 text-start last:border-b-0 rounded-xl transition-colors"
      style={{ borderColor: "var(--arbor-rule)", background: focused ? "var(--arbor-green-soft)" : undefined }}
    >
      {/* Colored icon tile — tone + glyph follow the entry's domain (kind fallback). */}
      {!arborQuiet && (
      <span
        className="inline-flex items-center justify-center rounded-full flex-shrink-0"
        style={{ width: 40, height: 40, background: p.soft, color: p.ink }}
      >
        <Icon name={glyph} size={22} fill={1} />
      </span>
      )}
      {arborQuiet ? (
      <div className="min-w-0 flex-1">
        <p data-testid="journal-row-arbor" className="t-sm leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>
          <bdi dir="auto">{title}</bdi>
        </p>
        <p className="mt-0.5 t-sm" style={{ color: "var(--arbor-muted)" }}>
          {provLabel}
          {when && <>{" · "}<bdi>{when}</bdi></>}
        </p>
      </div>
      ) : parentLead ? (
      <div className="min-w-0 flex-1">
        <p data-testid="journal-row-words" className="leading-snug line-clamp-3" style={{ fontFamily: "var(--font-editorial)", fontSize: "var(--t-lg)", color: "var(--arbor-ink)" }}>
          <FreeText text={detail} />
        </p>
        <p data-testid="journal-row-caption" className="mt-1 t-sm" style={{ color: "var(--arbor-muted)" }}>
          <bdi>{title}</bdi>
          {when && <>{" · "}<bdi>{when}</bdi></>}
          {signal.resolved && <>{" · "}<span data-testid="journal-row-resolved">{resolvedLabel}</span></>}
        </p>
      </div>
      ) : (
      <div className="min-w-0 flex-1">
        {/* W2: the parent-visible entry meaning leads; provenance/time remain readable metadata. */}
        <p data-testid={quiet ? "journal-row-quiet" : undefined} className={quiet ? "t-sm leading-relaxed" : "t-base font-semibold leading-relaxed"} style={{ color: quiet ? "var(--arbor-ink-soft)" : "var(--arbor-ink)" }} dir="auto">
          {title}
        </p>
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          {/* Provenance badge — AUTO gets the accent "Arbor" mark, CHILD a soft
              lav chip with the child's name, MANUAL a neutral "You" one. */}
          <span
            className="inline-flex items-center gap-1 t-sm font-semibold rounded-md px-2 py-0.5"
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
              className="inline-flex items-center gap-1 t-sm font-bold rounded-md px-1.5 py-0.5"
              style={{ background: PASTEL.mint.soft, color: PASTEL.mint.ink }}
            >
              <Icon name="bookmark_added" size={11} fill={1} />
              {originLabel}
            </span>
          )}
          {/* B-DATA-10: a resolved moment carries a glyph + label, never a colour. */}
          {signal.resolved && (
            <span data-testid="journal-row-resolved" className="inline-flex items-center gap-1 t-sm font-bold" style={{ color: "var(--arbor-ink-soft)" }}>
              <Icon name="check" size={13} />
              {resolvedLabel}
            </span>
          )}
          {/* Domain chip — omitted when the entry can't be classified (JRNL-6). */}
          {domain && (
            <Chip tone={tone} icon={<Icon name={DOMAIN_MS[domain]} size={13} fill={1} />}>{domainLabel}</Chip>
          )}
          {when && (
            <span className="t-sm ms-auto" style={{ color: "var(--arbor-muted)" }}>{when}</span>
          )}
        </div>
        {detail && (
          <p className="t-sm mt-1 leading-snug line-clamp-2" style={{ color: "var(--arbor-muted)" }} dir="auto">
            {detail}
          </p>
        )}
      </div>
      )}
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

/** `primaryMoveProps`: TimelineTab's contract stamp (capture-moment), spread on
 *  the capture tiles — the control that performs the move, not the wrapper. */
export default function JournalTab({ primaryMoveProps, densityToggle }: { primaryMoveProps?: Record<string, string>; densityToggle?: ReactNode } = {}) {
  const { milestones, playLogs, behaviorLogs, logsLoaded, pendingJournalFocusId, consumeJournalFocus, requestJournalFocus, childProfile, openCaptureSheet, toggleLogResolved, deleteLog } = useArbor();
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

  // TJB-08 + B-TODAY-19: the Journal's capture, in place, in every mode.
  // Text, voice and photo all open QuickLogModal — the ONE capture sheet
  // Today mounts the same way — which portals to document.body, so it opens
  // over the Journal with the hash untouched. The tapped writing prompt rides
  // in as the sheet's visible cue and is stored with the log (never as draft
  // text — the sanctioned W1 rule).
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [quickLogMode, setQuickLogMode] = useState<CaptureMode>("text");
  const [quickLogPromptKey, setQuickLogPromptKey] = useState<string | null>(null);

  /** Open the one capture sheet in the requested modality. */
  const startCapture = (mode: CaptureMode) => {
    setQuickLogMode(mode);
    setQuickLogPromptKey(activePromptKey);
    setQuickLogOpen(true);
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
    () => dailyPromptKeys({ ageYears: ageYearsOf(childProfile), childId: childProfile.id, date: new Date() }),
    [ageYearsOf(childProfile), childProfile.id],
  );
  const [activePromptKey, setActivePromptKey] = useState<string | null>(null);
  const onPromptTap = (key: string) => {
    setActivePromptKey((cur) => (cur === key ? null : key));
    try { track("journal_prompt_tap", { band: bandForAge(ageYearsOf(childProfile)) }); } catch { /* noop */ }
  };

  // TJB-13: the tapped row. Journal rows were inert — a saved moment could be
  // seen (clamped to two lines) but never read in full or corrected. The sheet
  // is READ + ROUTE: for the parent's own moments it hands off to the ONE
  // existing editor (startEditLog + the Behaviors capture form), never a
  // second copy of the log form.
  const [openSignal, setOpenSignal] = useState<TimelineSignal | null>(null);
  const openMomentLogId = (s: TimelineSignal | null): string | null =>
    s && s.kind === "moment" && s.id.startsWith("moment-") ? s.id.slice("moment-".length) : null;
  // B-ASKJB-30: Edit opens the ONE capture sheet in place (prefilled through
  // startEditLog inside openCaptureSheet) — the route stays #/journal.
  const editOpenSignal = () => {
    const logId = openMomentLogId(openSignal);
    if (!logId) return;
    setOpenSignal(null);
    openCaptureSheet({ editLogId: logId });
  };
  // Hard moments resolve and delete from the entry sheet (delete behind a
  // keyed confirm modal there, never window.confirm).
  const openLog = (() => {
    const id = openMomentLogId(openSignal);
    return id ? (behaviorLogs || []).find((l) => l.id === id) ?? null : null;
  })();

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
  // B-ASKJB-14 — Journal finds things. One filter row above the thread: All ·
  // Hard moments (isIncidentType) · Kept from Arbor (captureProvenance) · an
  // on-device search over trigger, response, notes and the localized type
  // label (never sent anywhere, never stored — session state only) · a month
  // jump built from groupByDay keys. The filtered list feeds the SAME
  // groupByDay, so a filter narrows rows within the render that typed it.
  const [journalFilter, setJournalFilter] = useState<JournalFilter>("all");
  const [journalQuery, setJournalQuery] = useState("");
  const logsById = useMemo(() => new Map((behaviorLogs || []).map((l) => [l.id, l])), [behaviorLogs]);
  const keptIds = useMemo(
    () => new Set(signals.filter((s) => provenanceForSignal(keptProvenance, s.id)).map((s) => s.id)),
    [signals, keptProvenance],
  );
  const filtering = journalFilter !== "all" || journalQuery.trim() !== "";
  const visibleSignals = useMemo(
    () => filtering
      ? signals.filter((s) => matchesJournalFilter(s, { filter: journalFilter, query: journalQuery, logsById, keptIds, labelOf: (x) => signalTitle(x, tt) }))
      : signals,
    [filtering, signals, journalFilter, journalQuery, logsById, keptIds, tt],
  );
  const groups = useMemo(
    () => groupByDay(visibleSignals, Date.now(), { locale, ongoingLabel: t("timeline.ongoing") }),
    [visibleSignals, locale, t],
  );
  const monthKeys = useMemo(() => journalMonthKeys(groups.map((g) => g.key)), [groups]);
  const jumpToMonth = (month: string) => {
    const key = firstGroupOfMonth(groups.map((g) => g.key), month);
    if (!key) return;
    try { document.getElementById(`journal-day-${key}`)?.scrollIntoView({ block: "start", behavior: "smooth" }); } catch { /* jsdom/SSR */ }
  };
  const clearJournalFilters = () => { setJournalFilter("all"); setJournalQuery(""); };
  // The Hard moments view prints the SAME PDF Behaviors prints (lib/behaviorExport).
  const exportHardMoments = () => {
    const rows = visibleSignals
      .filter((s) => isHardMomentSignal(s, logsById))
      .map((s) => logsById.get(momentLogId(s)!)!)
      .filter(Boolean);
    exportBehaviorPdf(rows, { t, lang: uiLang });
  };

  // JRNL-7 + F-09 + RUN-08/TJB-27: ONE counting source of truth. The header
  // stat ("This week in the story") and the story copy now read the SAME
  // `weekMomentCount` selector (lib/signalTimeline) that the Story density's
  // stat grid reads — one phrase, one definition, one number per screen. The
  // selector is the only week read this surface needs.
  const weekCount = useMemo(() => weekMomentCount(signals, Date.now()), [signals]);

  const autoLabel = t("journal.auto");
  const manualLabel = t("journal.manual");
  // JRNL-2: all header/compose copy lives in lib/i18n.ts (journal.* keys) so the
  // EN/HE parity guard covers it — no inline he-ternary strings on this surface.
  // Empty week → journal.story.empty ("One small moment is enough to begin…").
  // RUN-08: the count here is the SAME weekCount the stat beside it shows; it
  // used to be `recentSignals.length` (capped at 3), which is how one screen
  // came to carry "0 · 3 · 5 · 10".
  // B-ASKJB-13: the line says what it counts (moments this week) and claims
  // nothing Arbor does not do — no "Arbor is connecting".
  // Critic r1 (journal P1 G1): an empty week is not an empty record. A
  // returning parent with kept moments never reads "begin" / "the first
  // moment"; the line names the last moment and its date instead.
  const lastKept = useMemo(() => lastKeptMoment(signals), [signals]);
  const lastKeptSignal = lastKept ? signals.find((s) => s.id === lastKept.id) : undefined;
  const lastKeptDate = lastKept ? fmtDay(lastKept.at, uiLang === "he" ? "he" : "en") : "";
  const storyState = journalStoryState(weekCount, lastKept);
  const storyCopy = weekCount
    ? t(weekCount === 1 ? "journal.story.body.one" : "journal.story.body", { count: weekCount })
    : storyState === "quiet-week" && lastKeptSignal
      ? t("elev.journal.story.quietWeek", { title: signalTitle(lastKeptSignal, tt), date: lastKeptDate })
      : t("journal.story.empty");
  const feedCount = journalFeedCountKey(signals);
  // Critic r2: the quiet week quotes the parent at every width when the row
  // has words; the type label stays the fallback for a row without words.
  // NEXTLEVEL critic r1 (B-NEXTLEVEL-NEW-1f): the parent's last words lead
  // the header on EVERY week, not only a quiet one; a populated week keeps its
  // count as one quiet line under the quote (said once). No words → the count
  // line alone; never a machine entry.
  const quotedLastKept = !!lastKept?.words;
  const lastKeptDoor = (testId: string) => (
    <button
      type="button"
      data-testid={testId}
      onClick={() => composeRef.current?.querySelector<HTMLButtonElement>("[data-capture-bar] button")?.focus()}
      className="inline-flex min-h-11 items-center t-sm font-bold underline underline-offset-2"
      style={{ color: "var(--arbor-clay)" }}
    >
      {t("elev.journal.lastKept.next", { name: childFirstName })}
    </button>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto flex w-full min-w-0 max-w-[1080px] flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,42rem)_20rem] lg:items-start lg:justify-between lg:gap-x-10">
      {/* NEXTLEVEL critic r1 (journal · design · P1): at lg the page is a
          reading column (≤ 42rem: header + thread, so a row's time sits next
          to its words) and a sticky inline-end rail (20rem) holding the
          compose card — not a stretched phone column. Placement by
          col/row-start only; the DOM order is unchanged. */}
      <header data-module="journal-header" className="border-b pb-5 lg:col-start-1 lg:row-start-1" style={{ borderColor: "var(--arbor-rule)" }}>
        <div className="grid min-w-0 items-end gap-5 md:grid-cols-[minmax(0,1.25fr)_minmax(220px,.75fr)]">
          <div>
            {/* Critic r2: TimelineTab's density toggle rides in the header on
                #/journal (one module with the H1, not a stamp of its own). */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* NEXTLEVEL critic r1: the "Catch the moment before it's gone"
                  eyebrow is gone — it repeated the topbar subtitle and competed
                  with the H1. */}
              <span aria-hidden="true" />
              {densityToggle}
            </div>
            <h1 className="mt-2 t-2xl leading-[1.08] tracking-[-0.03em]" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
              {t("journal.title")}
            </h1>
            {quotedLastKept ? (
              /* Critic r2 (journal design P1 G2 + B-ASKJB-NEW-2d): the parent's
                 own words are the story line at EVERY width — the date as the
                 fact, the quote in the editorial face, then one door to the
                 tiles (below md; at md+ the door sits in the aside). Real row
                 text only, never generated; no new colour, gradient or chip. */
              <div data-testid="journal-story-line" data-story="quoted" className="mt-3 max-w-2xl space-y-1">
                <p className="t-sm font-semibold" style={{ color: "var(--arbor-muted)" }}>
                  {t("elev.journal.lastWrote.caption", { name: childFirstName, date: lastKeptDate })}
                </p>
                {/* Tapping the words opens that entry in place (the thread's focus seam). */}
                <button
                  type="button"
                  data-testid="journal-last-words"
                  onClick={() => requestJournalFocus(lastKept!.id)}
                  className="flex min-h-11 w-full items-center py-1 text-start"
                >
                  {/* P1-NEXTLEVEL critic r2 (G0): the quote is a 44 px target;
                      the clay rule stays at the text height on the inner span. */}
                  <span dir="auto" className="block border-s-2 ps-3 t-lg leading-snug line-clamp-2" style={{ borderColor: "var(--arbor-clay-dim)", fontFamily: "var(--font-editorial)", lineHeight: 1.35, color: "var(--arbor-ink)" }}>
                    {"“"}<bdi dir="auto">{lastKept!.words}</bdi>{"”"}
                  </span>
                </button>
                {weekCount > 0 && <p data-testid="journal-week-line" className="t-sm" style={{ color: "var(--arbor-muted)" }}>{storyCopy}</p>}
                <div className="md:hidden">{lastKeptDoor("journal-story-door")}</div>
              </div>
            ) : (
              <p data-testid="journal-story-line" dir="auto" className="mt-3 max-w-2xl t-base leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>{storyCopy}</p>
            )}
          </div>
          {/* Critic r1: below md the week aside steps out — the story line
              above already carries the week count or the last moment, and
              the capture tiles move up into the first viewport.
              NEXTLEVEL critic r1 (P1, Law 9): the aside never prints a
              numeral — the week count is said ONCE, in the story line; the
              old lavender "6 · moments and insights" tile repeated it 600 px
              away and did not say what it counted. The aside keeps only the
              door to the parent's last kept words, or the day-0 teach line. */}
          {(lastKept || weekCount === 0) && (
          <div data-testid="journal-week-aside" className="hidden border-t pt-4 md:block md:border-s md:border-t-0 md:ps-5 md:pt-0" style={{ borderColor: "var(--arbor-rule-strong)" }}>
            {lastKept ? (
              /* B-ASKJB-NEW-1d — "Last kept": the date, the parent's own words
                 (real row text, never generated), and one door to the compose
                 card. No new colour, gradient or stat. */
              <div data-testid="journal-last-kept" className="space-y-1.5">
                <p data-testid="journal-aside-title" className="t-sm font-bold" style={{ color: "var(--arbor-muted)" }}>
                  {t("elev.journal.lastKept.title")}
                </p>
                {/* The quote now leads the story line at every width; the
                    aside keeps the date only when the line could not quote. */}
                {!quotedLastKept && (
                  <p className="t-sm" style={{ color: "var(--arbor-muted)" }}>
                    {t("elev.journal.lastKept.caption", { date: lastKeptDate })}
                  </p>
                )}
                {lastKeptDoor("journal-last-kept-next")}
              </div>
            ) : (
              <p
                data-testid="journal-week-zero-line"
                className="t-sm leading-snug"
                style={{ color: "var(--arbor-ink-soft)" }}
                dir="auto"
              >
                {t("elev.journal.week.zero")}
              </p>
            )}
          </div>
          )}
        </div>
      </header>
      {/* W2 2.6 — active writing cue: the tapped guiding question, visible
          ABOVE the compose card while the parent captures. Display only —
          the question text never enters the draft body. */}
      {activePromptKey && (
        <div
          data-testid="journal-prompt-cue"
          className="flex items-start gap-2.5 rounded-[var(--r)] px-4 py-3 lg:col-start-1"
          style={{ background: PASTEL.lav.soft, color: PASTEL.lav.ink }}
          aria-live="polite"
        >
          <Icon name="lightbulb" size={18} fill={1} className="flex-shrink-0 mt-0.5" />
          <p className="t-base font-bold leading-snug" style={{ fontFamily: "var(--font-display)" }}>
            {t(activePromptKey)}
          </p>
        </div>
      )}

      {/* Compose card — "Log a moment" + three modality tiles. All three trigger the
          EXISTING capture flow (BehaviorsTab); the Voice/Photo/Text split is an
          entry affordance, not a new capture path. */}
      <section ref={composeRef} data-module="journal-compose" className="rounded-[var(--r-lg)] p-4 sm:p-5 lg:sticky lg:top-4 lg:col-start-2 lg:row-span-3 lg:row-start-1" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-xs)" }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          {/* P1-NEXTLEVEL critic r2 (B-NEXTLEVEL-NEW-2f): the "New moment"
              eyebrow and the "Log a moment" title go; the H2 is the question
              the tiles answer, naming the child. */}
          <h2 data-testid="journal-compose-ask" className="t-lg font-extrabold tracking-[-0.01em]" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
            {t("elev.journal.compose.ask", { name: childFirstName })}
          </h2>
          <IconBadge tone="lav" size={34}><Icon name="edit_note" size={19} fill={1} /></IconBadge>
        </div>

        {/* Critic r1 (journal P1 G0/G1): the tiles come FIRST (the primary
            move above the fold at 375) and carry TimelineTab's contract stamp;
            Text — the in-place default — is the ONE primary fill; Voice and
            Photo are neutral. */}
        <div className="grid grid-cols-3 gap-2" data-capture-bar {...primaryMoveProps}>
          {MODE_TILES.map(({ ms, key }) => (
            <button
              key={key}
              type="button"
              data-capture-tile={key}
              onClick={() => startCapture(key)}
              className="flex min-h-[48px] items-center justify-center gap-2 px-3 py-3 t-sm font-extrabold transition motion-safe:hover:-translate-y-0.5"
              style={key === "text"
                ? { borderRadius: "var(--r)", background: "var(--arbor-clay)", border: "1px solid transparent", color: "var(--arbor-on-accent)" }
                : { borderRadius: "var(--r)", background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
            >
              <Icon name={ms} size={21} fill={1} style={{ color: key === "text" ? "var(--arbor-on-accent)" : "var(--arbor-ink)" }} />
              {t(`journal.mode.${key}`)}
            </button>
          ))}
        </div>
        {/* W2 2.6 — three rotating promptBank chips above the capture triad
            (deterministic per child+day; elev.prompt.* strings, registered in
            i18nElevation/journal.ts). Tap toggles the writing cue above. */}
        <div className="mt-3">
          <p className="t-sm font-semibold mb-1.5" style={{ color: "var(--arbor-muted)" }}>
            {t("elev.prompt.lead")}
          </p>
          {/* Critic r1: below sm the chips are ONE horizontal snap row, not
              three stacked rows. */}
          <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible" data-testid="journal-prompt-chips">
            {promptKeys.map((key) => {
              const active = key === activePromptKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onPromptTap(key)}
                  aria-pressed={active}
                  dir="auto"
                  className="min-h-[44px] flex-shrink-0 snap-start rounded-full px-3.5 py-1.5 t-sm font-bold text-start transition active:scale-[0.98] sm:max-w-full sm:flex-shrink"
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

      </section>

      {/* B-ASKJB-03: the typed-turn proposals tray moved to Ask, under the
          answer it keeps from (CoachTab). Journal keeps every kept row in the
          feed below. */}

      {/* B-ASKJB-16: the spine ribbon to #/timeline is cut — the density
          toggle at the top of this page (TimelineTab) is the one door to
          Story. */}

      {/* Flat single-column feed — day-grouped, gated on the ledger load (JRNL-7)
          so a returning parent never sees a false "No moments yet" flash.
          B-ASKJB-16: ONE stamp for the thread, whichever branch renders
          (display: contents — no layout change). */}
      <div data-module="journal-thread" style={{ display: "contents" }}>
      {!logsLoaded ? (
        <div className="flex flex-col gap-3 lg:col-start-1" aria-hidden>
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
        <div className={`${cardCls} p-6 sm:p-8 lg:col-start-1`} data-testid="journal-teach-empty">
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
        <section aria-labelledby="journal-timeline-title" className="min-w-0 lg:col-start-1">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 id="journal-timeline-title" className="t-lg font-extrabold" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>{t("journal.timeline.title")}</h2>
            {/* NEXTLEVEL critic r1 (Law 9): under a filter or a search the
                count says what is ON SCREEN ("3 matches"), never the
                unfiltered total; a count only, never "x of y". */}
            <span data-testid="journal-feed-count" className="t-sm" style={{ color: "var(--arbor-muted)" }}>
              {filtering
                ? t(visibleSignals.length === 1 ? "journal.timeline.matches.one" : "journal.timeline.matches", { n: visibleSignals.length })
                : t(feedCount.key, { n: feedCount.n })}
            </span>
          </div>
          <div data-testid="journal-filters" className="mb-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("journal.filter.aria")}>
              {JOURNAL_FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  data-testid={`journal-filter-${f}`}
                  aria-pressed={journalFilter === f}
                  onClick={() => setJournalFilter(f)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3.5 t-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  style={journalFilter === f
                    ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-green-ink)" }
                    : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink-soft)", border: "1px solid var(--arbor-rule)" }}
                >
                  {t(`journal.filter.${f}`)}
                </button>
              ))}
              {journalFilter === "hard" && visibleSignals.some((sig) => isHardMomentSignal(sig, logsById)) && (
                <button
                  type="button"
                  data-testid="journal-export-pdf"
                  onClick={exportHardMoments}
                  className="ms-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 t-sm font-bold"
                  style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)", background: "var(--arbor-paper-elevated)" }}
                >
                  <Icon name="download" size={15} style={{ color: "var(--arbor-green-ink)" }} /> {t("beh.exportPdf")}
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Critic r2 (journal design P1): one surface — the global
                  `.arbor-app input` paper-deep fill drew a field inside the
                  pill; field-bare (index.css) keeps the input transparent and
                  field-pill gives the pill and the month select one token. */}
              <label className="field-pill flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl ps-3 pe-2">
                <Icon name="search" size={16} style={{ color: "var(--arbor-muted)" }} />
                <input
                  type="search"
                  data-testid="journal-search"
                  value={journalQuery}
                  onChange={(e) => setJournalQuery(e.target.value)}
                  placeholder={t("journal.filter.search")}
                  aria-label={t("journal.filter.search")}
                  dir="auto"
                  className="field-bare min-h-11 min-w-0 flex-1 t-sm focus:outline-none"
                  style={{ color: "var(--arbor-ink)" }}
                />
              </label>
              {monthKeys.length > 1 && (
                <select
                  data-testid="journal-month"
                  aria-label={t("journal.filter.month")}
                  value=""
                  onChange={(e) => { if (e.target.value) jumpToMonth(e.target.value); }}
                  className="field-pill min-h-11 rounded-xl px-3 t-sm font-bold"
                  style={{ color: "var(--arbor-ink)" }}
                >
                  <option value="">{t("journal.filter.month")}</option>
                  {monthKeys.map((m) => <option key={m} value={m}>{monthLabel(m, locale)}</option>)}
                </select>
              )}
            </div>
          </div>
          {filtering && visibleSignals.length === 0 && (
            <div data-testid="journal-filter-empty" role="status" className="flex flex-wrap items-center gap-2 py-4">
              <p className="text-sm" style={{ color: "var(--arbor-ink-soft)" }}>{t("journal.filter.empty")}</p>
              <button
                type="button"
                onClick={clearJournalFilters}
                className="inline-flex min-h-11 items-center px-2 text-sm font-bold underline underline-offset-2"
                style={{ color: "var(--arbor-green-ink)" }}
              >
                {t("journal.filter.clear")}
              </button>
            </div>
          )}
          {groups.map((group) => (
            <div key={group.key}>
              {/* Slim sticky day header — localized (Intl), start-aligned so it
                  mirrors correctly under RTL. */}
              <div
                id={`journal-day-${group.key}`}
                className="sticky top-0 z-[5] -mx-1 flex items-center gap-3 px-1 py-1.5"
                style={{ background: "var(--arbor-paper)" }}
              >
                {/* B-ASKJB-34: sentence case as Intl writes it ("Thursday, September 17"), 12 px, no shout. */}
                <h3 className="t-sm font-semibold text-start" style={{ color: "var(--arbor-muted)" }}>
                  {group.label}
                </h3>
                <span className="h-px flex-1" style={{ background: "var(--arbor-rule)" }} aria-hidden />
              </div>
              {group.signals.map((s) => {
                const domain = domainOf.get(s.id) ?? null;
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
                    resolvedLabel={t("beh.resolved")}
                    focused={s.id === focusId}
                    onOpen={() => setOpenSignal(s)}
                  />
                );
              })}
            </div>
          ))}
        </section>
      )}
      </div>

      {/* TJB-08 — the Journal's text capture, in place. Rendered once; it
          portals to document.body, so it sits over the feed rather than
          replacing it, and the route never changes. */}
      <QuickLogModal open={quickLogOpen} mode={quickLogMode} promptKey={quickLogPromptKey} onClose={() => setQuickLogOpen(false)} />

      {/* TJB-13 — the row's detail sheet. Rendered once for the whole feed;
          `signal === null` keeps it closed. */}
      <JournalEntrySheet
        signal={openSignal}
        domain={openSignal ? (domainOf.get(openSignal.id) ?? null) : null}
        domainLabel={(() => {
          const d = openSignal ? (domainOf.get(openSignal.id) ?? null) : null;
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
        hardMoment={openLog && isIncidentType(openLog.behaviorType) ? { resolved: !!openLog.resolved } : undefined}
        onToggleResolved={openLog ? () => toggleLogResolved(openLog.id) : undefined}
        onDelete={openLog ? () => { deleteLog(openLog.id); setOpenSignal(null); } : undefined}
      />
    </motion.div>
  );
}
