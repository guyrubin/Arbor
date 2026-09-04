import { capacityMinutes, type ActionLoopEntry } from "../actionLoop/model";
import type {
  ActionPlan,
  AdventureResult,
  BehaviorLog,
  HeroJourneyRun,
  MemoryReviewItem,
  Milestone,
  MimicSession,
  MissionRecord,
  PlayLog,
  PracticeEvent,
  SpeechAttempt,
} from "../types";
import { isolate } from "./i18n";

/**
 * The Signal Timeline — Arbor's unified developmental activity stream.
 *
 * Every capability writes its own data (behavior logs, milestones, growth plans,
 * approved child memory). This module folds all of those sources
 * into ONE chronological stream plus a derived "momentum" read, so the parent can
 * see the whole story in one place and each feature visibly feeds the next.
 *
 * Pure + framework-free so it is fully unit-testable. The tone union mirrors the
 * Soft-Daylight PASTEL keys in `ui/kit` without importing React.
 */

/**
 * Wave L TJB-05 — "action" is Today's primary move written back into the
 * thread. Until this kind existed, accepting or completing the day's step
 * wrote `actionLoops` and nothing downstream read it: the one move Today
 * exists to produce left no trace in the parent's own story, and
 * surfaceContract declared the overview's threadWrite honestly as "none".
 */
/**
 * AI-04 (consent gate) — there is no "coach" kind any more. A raw Ask thread
 * used to fold itself into the child's stream the moment it was updated; it
 * now stays where the parent had it, and the ONLY way an answer reaches this
 * stream is the parent tapping "Keep this", which files a behaviorLog and so
 * arrives here as kind "moment" like any other thing the parent chose to keep.
 * A kind nothing can produce is a dead filter chip and four dead render
 * branches, so it was removed with its source rather than left standing.
 */
export type SignalKind = "moment" | "milestone" | "plan" | "memory" | "play" | "practice" | "action";
export type SignalTone = "mint" | "coral" | "lav" | "yellow" | "pink" | "sky";

/**
 * Masterplan 1.4 — the six child-activity ledgers folded into the timeline as
 * kind "practice". The type distinguishes the source for the warm event copy;
 * all six share the third provenance class "child" (the CHILD did this in
 * kid-mode/practice, not the parent and not Arbor).
 */
export type ChildActivityType = "practice" | "speech" | "mimic" | "adventure" | "mission" | "hero";

/**
 * JRNL-3: signals are STRUCTURED — this module never bakes display English.
 * `refTitle`/`detail` carry raw source-record content (a behavior type the
 * parent typed, a milestone title, a plan title…); every UI label around them
 * ("Observed: …", "Played: …", kind names, day groups) is applied at render
 * via the `timeline.*` i18n keys through `signalTitle`/`signalDetail`/
 * `signalMeta` below, so HE/EN parity holds on both timeline densities.
 */
export interface TimelineSignal {
  id: string;
  kind: SignalKind;
  /** ISO timestamp, or null for sources that carry no date (grouped as "Ongoing"). */
  at: string | null;
  /** Raw source-record title (user/content data, never UI copy). */
  refTitle?: string;
  /** Raw source-record detail (user/content data, never UI copy). */
  detail?: string;
  tone: SignalTone;
  /** Optional render metadata — structured, labeled at render. */
  intensity?: number;
  context?: string;
  photo?: string;
  durationMinutes?: number;
  ageGroup?: string;
  steps?: { done: number; total: number };
  memorySource?: string;
  playDomain?: PlayLog["domain"];
  concernMatch?: boolean;
  /** Which child-activity ledger a kind:"practice" signal came from. */
  practiceType?: ChildActivityType;
  /**
   * TJB-05 (kind "action" only) — the step's lifecycle as the parent left it.
   * "accepted" = made today's step and not yet reported on; the three outcome
   * values are the parent's own read of the SUGGESTION they tried.
   * FIREWALL: this describes the step, never the child — which is also why
   * every action signal carries the SAME tone (see buildTimeline): colouring
   * "helped" green and "not_today" coral would make the row a verdict strip.
   */
  actionStatus?: "accepted" | "helped" | "somewhat" | "not_today" | "done";
  /**
   * Same-day same-type aggregation count (kind:"practice" only) — one warm
   * signal per day per activity type, never one row per raw event.
   * FIREWALL: a flat event count, never a rate or a period-vs-period delta.
   */
  count?: number;
}

/**
 * JRNL-4: provenance is DERIVED read-only from who authored the entry.
 * MANUAL ("You") = the parent acted: logged a moment, confirmed a milestone
 * observation, played an activity. AUTO ("Arbor") = Arbor derived it: an
 * approved memory fact, a generated growth plan. No new flag is
 * written to the ledger; this maps the existing signal kind at render time.
 * CHILD (the child's first name at render) = the child acted in a practice/
 * play surface: a speech round, a mimic session, an adventure scene, a daily
 * mission, a hero journey, a practice game.
 */
export type SignalProvenance = "manual" | "auto" | "child";

export const SIGNAL_PROVENANCE: Record<SignalKind, SignalProvenance> = {
  moment: "manual",
  milestone: "manual",
  play: "manual",
  plan: "auto",
  memory: "auto",
  practice: "child",
  // TJB-05: Arbor OFFERED the step, but accepting it and saying how it went
  // are both the parent's own acts — the badge must read "You".
  action: "manual",
};

export const isAutoSignal = (kind: SignalKind): boolean => SIGNAL_PROVENANCE[kind] === "auto";

/** Shape of the app's `t()` — kept structural so this module stays framework-free. */
export type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

/** Localized display title for a signal — all templates live in i18n. */
export const signalTitle = (s: TimelineSignal, t: TranslateFn): string => {
  switch (s.kind) {
    case "moment":
      return s.refTitle || t("timeline.title.moment");
    case "milestone":
      return t("timeline.title.observed", { title: s.refTitle ?? "" });
    case "plan":
      return s.refTitle || t("timeline.title.plan");
    case "memory":
      return t("timeline.title.memory");
    case "play":
      return t("timeline.title.played", { title: s.refTitle ?? "" });
    case "practice": {
      // Warm aggregated child-activity copy — keys live in the childsignals
      // i18n module (i18nElevation/childsignals.ts); callers wrap t via
      // withChildSignals until the module is registered in index.ts.
      const n = s.count ?? 1;
      const type = s.practiceType ?? "practice";
      return t(`elev.childsignals.title.${type}.${n === 1 ? "one" : "many"}`, { count: n });
    }
    case "action":
      // TJB-05: the lifecycle is the TITLE ("You made this today's step" →
      // "You tried today's step — it helped"); the step text itself is the
      // detail line, so one row visibly evolves rather than two rows racing.
      return t(`elev.closeloop.thread.title.${s.actionStatus ?? "accepted"}`);
  }
};

/** Localized secondary line — raw source detail except where it was UI copy. */
export const signalDetail = (s: TimelineSignal, t: TranslateFn): string => {
  if (s.kind === "play") {
    return s.playDomain
      ? t("timeline.detail.builds", { domain: t(`timeline.playdomain.${s.playDomain}`) })
      : "";
  }
  // TJB-05: the accepted step's own words — raw record content, never UI copy.
  if (s.kind === "action") return s.refTitle ?? "";
  return s.detail || "";
};

/** Localized meta chip text (steps, duration, pattern match) or undefined. */
export const signalMeta = (s: TimelineSignal, t: TranslateFn): string | undefined => {
  switch (s.kind) {
    case "moment": {
      const parts = [
        s.context,
        s.durationMinutes ? t("timeline.meta.minutes", { n: s.durationMinutes }) : "",
      ].filter(Boolean);
      return parts.length ? parts.join(" · ") : undefined;
    }
    case "milestone":
      return s.ageGroup || undefined;
    case "plan":
      return s.steps?.total ? t("timeline.meta.steps", { done: s.steps.done, total: s.steps.total }) : undefined;
    case "memory":
      return s.memorySource || undefined;
    case "play":
      return s.concernMatch ? t("timeline.meta.match") : undefined;
    case "practice":
      // The title already carries the count; no extra meta chip.
      return undefined;
    case "action":
      // The capacity the parent chose, in minutes — a plain duration fact
      // (same key the moment rows use), never a score.
      return s.durationMinutes ? t("timeline.meta.minutes", { n: s.durationMinutes }) : undefined;
  }
};

export interface TimelineSources {
  behaviorLogs?: BehaviorLog[];
  milestones?: Milestone[];
  plans?: ActionPlan[];
  memory?: MemoryReviewItem[];
  /**
   * AI-04 (consent gate) — `conversations` USED TO BE A SOURCE HERE, and is
   * deliberately not one any more. Every Ask thread folded itself into the
   * child's stream as soon as it was updated: the parent never chose that, and
   * a thread they opened to think out loud became part of the child's record
   * by the act of opening it.
   *
   * The consented path is the one AI-04 shipped first: "Keep this" runs
   * ArborContext.commitConversationProposal, which files a behaviorLogs row
   * (plus a conversationChanges audit row) — so a kept line arrives through
   * `behaviorLogs` above, as kind "moment", with recorded provenance. Nothing
   * is deleted: the `conversations` subcollection is untouched, still a
   * registered CHILD_SUBCOLLECTION, still read by CoachTab's own history, and
   * still on the GDPR export and erase sweeps. It simply stops being an ingest
   * source for the child's timeline.
   *
   * The key is gone from the interface on purpose rather than left unread:
   * SignalSource is `keyof TimelineSources` and surfaceContract's SC-4 guard
   * resolves every declared `threadWrite` against it, so a key nothing ingests
   * would let a future surface declare a thread write into a void and pass.
   */
  play?: PlayLog[];
  /**
   * TJB-05 — the `actionLoops` ledger: Today's accepted/completed step.
   * This is the ingest source `surfaceContract`'s `overview` contract names
   * as its `threadWrite`; without it the day's ONE primary move wrote a
   * subcollection nobody read.
   */
  actionOutcomes?: ActionLoopEntry[];
  // Masterplan 1.4 — the six child-activity ledgers (all registered in
  // CHILD_SUBCOLLECTIONS; read directly via useChildCollection, no derived
  // sink). Folded as kind "practice", provenance "child".
  practiceEvents?: PracticeEvent[];
  speechAttempts?: SpeechAttempt[];
  mimicSessions?: MimicSession[];
  adventureResults?: AdventureResult[];
  missionRecords?: MissionRecord[];
  heroRuns?: HeroJourneyRun[];
}

/**
 * Heartwood Law 3 — the runtime registry of buildTimeline ingest sources.
 * `SignalSource` is exactly `keyof TimelineSources`; the mapped-object shape
 * below forces the runtime array to list EVERY source key (add a source to the
 * interface and this object fails to compile until it is registered here).
 * surfaceContract.ts SC-4 imports this so a contract's `threadWrite` resolves
 * against the REAL ingest list, never a strings-only copy. Pure addition —
 * nothing in this module reads it.
 */
export type SignalSource = keyof TimelineSources;

const TIMELINE_SOURCE_ID_MAP: { [K in keyof Required<TimelineSources>]: true } = {
  behaviorLogs: true,
  milestones: true,
  plans: true,
  memory: true,
  play: true,
  actionOutcomes: true,
  practiceEvents: true,
  speechAttempts: true,
  mimicSessions: true,
  adventureResults: true,
  missionRecords: true,
  heroRuns: true,
};

export const TIMELINE_SOURCE_IDS = Object.keys(TIMELINE_SOURCE_ID_MAP) as readonly SignalSource[];

const DAY = 24 * 60 * 60 * 1000;

const planStepDone = (s: { completed: boolean; status?: string }) => s.completed || s.status === "done";

const countPlanSteps = (plans: ActionPlan[] = []) => {
  let done = 0;
  let total = 0;
  for (const plan of plans) {
    for (const phase of plan.phases || []) {
      for (const step of phase.steps || []) {
        total += 1;
        if (planStepDone(step)) done += 1;
      }
    }
  }
  return { done, total };
};

const topOf = (values: (string | undefined | null)[]): string | null => {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
};

/**
 * Fold one child-activity ledger into same-day aggregate signals: one signal
 * per UTC day per activity type, `count` = events that day, `at` = the latest
 * event timestamp (so recency ordering holds). Aggregation keeps the feed calm
 * — 14 speech rounds are one warm row, never fourteen.
 * FIREWALL: only the count and the day survive; correctness/ratings/scores on
 * the raw records are deliberately dropped, never surfaced.
 */
const foldChildActivity = (
  signals: TimelineSignal[],
  type: ChildActivityType,
  stamps: (string | undefined | null)[],
): void => {
  const days = new Map<string, { count: number; latest: string; latestMs: number }>();
  for (const ts of stamps) {
    if (!ts) continue;
    const ms = new Date(ts).getTime();
    if (!Number.isFinite(ms)) continue;
    const day = new Date(ms).toISOString().slice(0, 10);
    const entry = days.get(day);
    if (!entry) {
      days.set(day, { count: 1, latest: ts, latestMs: ms });
    } else {
      entry.count += 1;
      if (ms > entry.latestMs) {
        entry.latest = ts;
        entry.latestMs = ms;
      }
    }
  }
  for (const [day, entry] of days) {
    signals.push({
      id: `child-${type}-${day}`,
      kind: "practice",
      at: entry.latest,
      tone: "sky",
      practiceType: type,
      count: entry.count,
    });
  }
};

/** Fold every source into one stream, newest first; undated signals sort last. */
export const buildTimeline = (sources: TimelineSources): TimelineSignal[] => {
  const signals: TimelineSignal[] = [];

  for (const log of sources.behaviorLogs || []) {
    signals.push({
      id: `moment-${log.id}`,
      kind: "moment",
      at: log.timestamp || null,
      refTitle: log.behaviorType || undefined,
      detail: log.trigger || log.notes || "",
      tone: log.resolved ? "mint" : "coral",
      intensity: log.intensity,
      context: log.context,
      photo: log.photoAttachment,
      durationMinutes: log.durationMinutes || undefined,
    });
  }

  for (const m of sources.milestones || []) {
    if (!m.checked) continue;
    signals.push({
      id: `milestone-${m.id}`,
      kind: "milestone",
      // JRNL-5: a confirmed observation carries the day the parent noticed it,
      // so first words / first steps land in the chronology. Undated legacy
      // milestones still fall back to the "Ongoing" group.
      at: m.observationUpdatedAt || null,
      refTitle: m.title,
      detail: m.description || "",
      tone: "lav",
      ageGroup: m.ageGroup,
    });
  }

  for (const plan of sources.plans || []) {
    signals.push({
      id: `plan-${plan.id}`,
      kind: "plan",
      at: null,
      refTitle: plan.title || undefined,
      detail: plan.issue || "",
      tone: "sky",
      steps: countPlanSteps([plan]),
    });
  }

  for (const item of sources.memory || []) {
    if (item.status !== "approved") continue;
    signals.push({
      id: `memory-${item.memoryId}`,
      kind: "memory",
      at: item.createdAt || null,
      detail: item.fact,
      tone: "yellow",
      memorySource: item.source,
    });
  }

  // AI-04 (consent gate): the unconditional Ask-thread ingest that used to sit
  // here is GONE, not disabled behind a flag. An answer reaches this stream
  // only when the parent keeps a line from it, and that arrives above through
  // `behaviorLogs`. See the note on TimelineSources for what happens to the
  // threads themselves (nothing — they stay in Ask, and in the export).

  for (const p of sources.play || []) {
    signals.push({
      id: `play-${p.id}`,
      kind: "play",
      at: p.timestamp || null,
      refTitle: p.title,
      tone: "mint",
      playDomain: p.domain,
      concernMatch: p.reason === "concern-match",
    });
  }

  // TJB-05 — Today's step. ONE signal per accepted step, keyed by the entry
  // id, so accepting writes the row and recording the outcome REPLACES that
  // same row's title in the same frame (never a second racing row).
  // `at` walks forward to the outcome moment so the updated row re-sorts to
  // the top of the day it was closed out on.
  for (const entry of sources.actionOutcomes || []) {
    const status: TimelineSignal["actionStatus"] =
      entry.status === "completed" ? (entry.outcome ?? "done") : "accepted";
    signals.push({
      id: `action-${entry.id}`,
      kind: "action",
      at: (entry.status === "completed" ? entry.outcomeAt : null) || entry.acceptedAt || null,
      refTitle: entry.recommendation || undefined,
      // FIREWALL: ONE tone for every lifecycle state. Tone-coding the outcome
      // (green "helped" vs coral "not_today") would turn the parent's read of
      // a suggestion into a coloured verdict sitting in the child's story.
      tone: "sky",
      actionStatus: status,
      durationMinutes: capacityMinutes[entry.capacity] ?? undefined,
    });
  }

  // Masterplan 1.4 — child-activity ledgers, aggregated same-day same-type.
  foldChildActivity(signals, "practice", (sources.practiceEvents || []).map((e) => e.timestamp));
  foldChildActivity(signals, "speech", (sources.speechAttempts || []).map((a) => a.timestamp));
  foldChildActivity(signals, "mimic", (sources.mimicSessions || []).map((m) => m.timestamp));
  foldChildActivity(signals, "adventure", (sources.adventureResults || []).map((r) => r.timestamp));
  // Missions: only completions are events; an uncompleted record is not a story beat.
  foldChildActivity(signals, "mission", (sources.missionRecords || []).filter((m) => m.completed).map((m) => m.timestamp));
  // Hero runs: prefer the completion moment, fall back to the start of the run.
  foldChildActivity(signals, "hero", (sources.heroRuns || []).map((r) => r.completedAt || r.startedAt));

  return signals.sort((a, b) => {
    if (a.at && b.at) return a.at < b.at ? 1 : a.at > b.at ? -1 : 0;
    if (a.at) return -1;
    if (b.at) return 1;
    return 0;
  });
};

/**
 * F-09 — the ONE trailing-7-day selector for "this week" surfaces.
 * Returns the dated signals whose timestamp falls in (now − 7d, now],
 * preserving the input order (newest-first from buildTimeline). JournalTab
 * derives BOTH the week-stat count (length) AND the "connecting N recent
 * moments" story slice from THIS list, so the story count can never exceed
 * the adjacent stat. Undated and future-dated signals are excluded.
 */
export const weekWindow = (signals: TimelineSignal[], now: number = Date.now()): TimelineSignal[] =>
  signals.filter((s) => {
    if (!s.at) return false;
    const t = new Date(s.at).getTime();
    return Number.isFinite(t) && t > now - 7 * DAY && t <= now;
  });

export type Trend = "up" | "down" | "flat";

export interface Momentum {
  momentsThisWeek: number;
  momentsPrevWeek: number;
  momentTrend: Trend;
  /**
   * CI-22/23/24 firewall (Wave-3 clinical subtraction, 2026-06-26): the per-week
   * average behavior-intensity + the easing/rising trend are behavior-intensity
   * metrics on a child = verdict-shaped. They are KEPT on the type only for
   * back-compat with existing callers/tests; NOTHING in the product renders them
   * as a verdict anymore. Do NOT wire these to any UI/text/code path that emits a
   * child verdict. Verified-rendered-safe by `clinicalFirewall.test.ts`.
   * @deprecated for any verdict use.
   */
  avgIntensityThisWeek: number | null;
  avgIntensityPrevWeek: number | null;
  intensityTrend: "easing" | "rising" | "flat" | "none";
  topPattern: string | null;
  topContext: string | null;
  planSteps: { done: number; total: number };
  milestones: { observed: number; total: number };
  winsThisWeek: number;
}

const avg = (nums: number[]): number | null =>
  nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;

/** Derive this-week-vs-last momentum from the dated signals. `now` is injectable for tests. */
export const computeMomentum = (
  behaviorLogs: BehaviorLog[] = [],
  plans: ActionPlan[] = [],
  milestones: Milestone[] = [],
  now: number = Date.now(),
): Momentum => {
  const inWindow = (ts: string, fromDaysAgo: number, toDaysAgo: number) => {
    const t = new Date(ts).getTime();
    return t > now - fromDaysAgo * DAY && t <= now - toDaysAgo * DAY;
  };

  const thisWeek = behaviorLogs.filter((l) => l.timestamp && inWindow(l.timestamp, 7, 0));
  const prevWeek = behaviorLogs.filter((l) => l.timestamp && inWindow(l.timestamp, 14, 7));

  const momentTrend: Trend =
    thisWeek.length > prevWeek.length ? "up" : thisWeek.length < prevWeek.length ? "down" : "flat";

  const avgThis = avg(thisWeek.map((l) => l.intensity).filter((n) => typeof n === "number"));
  const avgPrev = avg(prevWeek.map((l) => l.intensity).filter((n) => typeof n === "number"));

  let intensityTrend: Momentum["intensityTrend"] = "none";
  if (avgThis != null && avgPrev != null) {
    intensityTrend = avgThis < avgPrev ? "easing" : avgThis > avgPrev ? "rising" : "flat";
  } else if (avgThis != null) {
    intensityTrend = "flat";
  }

  return {
    momentsThisWeek: thisWeek.length,
    momentsPrevWeek: prevWeek.length,
    momentTrend,
    avgIntensityThisWeek: avgThis,
    avgIntensityPrevWeek: avgPrev,
    intensityTrend,
    topPattern: topOf(thisWeek.map((l) => l.behaviorType)),
    topContext: topOf(thisWeek.map((l) => l.context)),
    planSteps: countPlanSteps(plans),
    milestones: {
      observed: milestones.filter((m) => m.checked).length,
      total: milestones.length,
    },
    winsThisWeek: thisWeek.filter((l) => l.resolved).length,
  };
};

export interface NextStep {
  message: string;
  cta?: { label: string; prompt: string };
}

/**
 * A client-side proactive nudge: read the week's signals and surface ONE next
 * best step that routes the parent into the right capability. No AI call — this
 * is the timeline visibly feeding the coach.
 */
export const deriveNextStep = (momentum: Momentum, childName: string): NextStep | null => {
  // E8/F-10: the messages below are display-time copy (message + chat seed) —
  // each interpolation of the name is bidi-isolated so a Hebrew name can't
  // reorder the surrounding English sentence.
  const name = childName || "your child";

  if (momentum.momentsThisWeek === 0 && momentum.planSteps.total === 0) {
    return {
      message: `${isolate(name)}'s story starts with a single moment. Capture what happened today and Arbor takes it from there.`,
      cta: { label: "Capture a moment", prompt: "" },
    };
  }

  if (momentum.topPattern && momentum.momentsThisWeek >= 2) {
    // CI-22/23/24 firewall (Wave-3 clinical subtraction): the intensity-trend
    // verdict ("easing — whatever you're doing is helping" / "rising — worth a
    // closer look") was a behavior-intensity trend on a child metric = a verdict.
    // Removed. The flat moment count + top pattern + route-to-coach (mechanism)
    // remain — they emit nothing about the child as a verdict.
    const where = momentum.topContext ? `, usually at ${momentum.topContext.toLowerCase()}` : "";
    return {
      message: `You logged ${momentum.momentsThisWeek} moments for ${isolate(name)} this week — most often "${momentum.topPattern}"${where}.`,
      cta: {
        label: `Ask Arbor about ${momentum.topPattern.toLowerCase()}`,
        prompt: `This week ${isolate(name)} had several "${momentum.topPattern}" moments${
          momentum.topContext ? ` (mostly at ${momentum.topContext.toLowerCase()})` : ""
        }. What may be happening and what's one thing to try this week?`,
      },
    };
  }

  if (momentum.milestones.total > 0 && momentum.milestones.observed > 0) {
    return {
      message: `You've observed ${momentum.milestones.observed} of ${momentum.milestones.total} milestones for ${isolate(name)}. Keep noticing — small wins compound.`,
    };
  }

  return null;
};

export type TimelineGroup = { key: string; label: string; signals: TimelineSignal[] };

const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);

/** First-letter capitalize — Intl.RelativeTimeFormat yields lowercase "today". */
const capFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** "Today" / "Yesterday" via Intl so He/En (and any locale) localize natively. */
const relDayLabel = (daysAgo: 0 | 1, locale: string | undefined): string => {
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    return capFirst(rtf.format(-daysAgo, "day"));
  } catch {
    return daysAgo === 0 ? "Today" : "Yesterday";
  }
};

export interface GroupByDayOptions {
  /** BCP-47 locale for the day labels (JRNL-3); browser default when omitted. */
  locale?: string;
  /** Localized label for the undated bucket — pass t("timeline.ongoing"). */
  ongoingLabel?: string;
}

/** Group dated signals by day with localized labels; undated land in "Ongoing". */
export const groupByDay = (
  signals: TimelineSignal[],
  now: number = Date.now(),
  opts: GroupByDayOptions = {},
): TimelineGroup[] => {
  const { locale, ongoingLabel = "Ongoing" } = opts;
  const todayKey = new Date(now).toISOString().slice(0, 10);
  const yesterdayKey = new Date(now - DAY).toISOString().slice(0, 10);
  const groups: TimelineGroup[] = [];
  const index = new Map<string, TimelineGroup>();

  const ensure = (key: string, label: string) => {
    let g = index.get(key);
    if (!g) {
      g = { key, label, signals: [] };
      index.set(key, g);
      groups.push(g);
    }
    return g;
  };

  for (const s of signals) {
    if (!s.at) {
      ensure("ongoing", ongoingLabel).signals.push(s);
      continue;
    }
    const k = dayKey(s.at);
    const label =
      k === todayKey
        ? relDayLabel(0, locale)
        : k === yesterdayKey
          ? relDayLabel(1, locale)
          : new Date(s.at).toLocaleDateString(locale, { weekday: "long", month: "short", day: "numeric" });
    ensure(k, label).signals.push(s);
  }

  // Dated groups first (already newest-first from buildTimeline), Ongoing last.
  return groups.sort((a, b) => {
    if (a.key === "ongoing") return 1;
    if (b.key === "ongoing") return -1;
    return a.key < b.key ? 1 : -1;
  });
};

/**
 * Masterplan 1.8 — the "Over the months" spine layer (mockup Row-1 #3:
 * vertical spine, event nodes by recency).
 *
 * One node per calendar month (UTC, matching dayKey/groupByDay) that holds:
 *  - the milestone crossings observed that month (an EVENT list), and
 *  - the CUMULATIVE moments-captured total by the end of that month.
 *
 * CLINICAL FIREWALL: the cumulative total is monotonic by construction —
 * "by March: 89 moments". A per-month count is deliberately NOT exposed on
 * this type: rendering monthly counts side-by-side is a period-vs-period
 * series (verdict-shaped on a child). No rate, no delta, no comparison.
 */
export interface MonthNode {
  /** "YYYY-MM" (UTC). */
  key: string;
  /** Milestone signals whose observation date fell in this month, feed order. */
  milestones: TimelineSignal[];
  /** Total dated signals captured from the beginning of the story through this month. */
  cumulativeMoments: number;
}

/** Group dated signals into month nodes, newest month first. Undated signals are excluded. */
export const buildMonthsLayer = (signals: TimelineSignal[]): MonthNode[] => {
  const byMonth = new Map<string, { milestones: TimelineSignal[]; count: number }>();
  for (const s of signals) {
    if (!s.at) continue;
    const ms = new Date(s.at).getTime();
    if (!Number.isFinite(ms)) continue;
    const key = new Date(ms).toISOString().slice(0, 7);
    let entry = byMonth.get(key);
    if (!entry) {
      entry = { milestones: [], count: 0 };
      byMonth.set(key, entry);
    }
    entry.count += 1;
    if (s.kind === "milestone") entry.milestones.push(s);
  }

  const keys = Array.from(byMonth.keys()).sort(); // oldest → newest
  let cumulative = 0;
  const nodes: MonthNode[] = keys.map((key) => {
    const entry = byMonth.get(key)!;
    cumulative += entry.count;
    return { key, milestones: entry.milestones, cumulativeMoments: cumulative };
  });
  return nodes.reverse(); // newest month first — spine ordered by recency
};
