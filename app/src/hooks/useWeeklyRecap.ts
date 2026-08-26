/* ════════════════════════════════════════════════════════════════════════════
   useWeeklyRecap — W2 2.1 (masterplan ARBOR-UI-MASTERPLAN-2026-08-11 §4 ·
   Maytal Row-1 #2/#4): the weekly digest generation path, HOISTED out of
   WeeklyTab so the recap exists BEFORE the parent finds the buried Weekly pill.

   Mounted from TWO places:
     · WeeklyTab (the report surface itself — day-0 users still generate on
       tab entry, exactly as before this hoist), and
     · SinceLastVisit on Today (returning parents — the app-open mount that
       makes the recap a ritual instead of a pull).
   The two surfaces never render simultaneously (tabs are exclusive), so at
   most one live listener exists at a time.

   RACES: generation is guarded twice —
     · in-session: a module-level Set keyed `${childId}:${weekId}` (one auto
       attempt per child-week per session, shared across BOTH mounts), and
     · cross-device: the report id IS the weekId, so the Firestore upsert is
       last-write-wins — two devices generating the same week converge on one
       document (same stats window, equivalent content).

   WEEK IDENTITY: recapWeekId keeps the EXACT algorithm WeeklyTab has always
   used (Jan-1-anchored week number). It is not strict ISO-8601 week
   numbering, but stored report ids are keyed by it — changing the algorithm
   mid-history would fork every existing week id and re-generate duplicate
   reports. Stability wins; the id only needs to be monotonic + season-unique.

   LANGUAGE IDENTITY (P1 fix 2026-08-12): a weekly report is a PERSISTED
   per-week document whose narrative (`insight` + `digest`) is frozen at
   generation time — so the language it was written in is part of its
   identity, not a render-time detail. Two rules follow:
     · the generation language is STORED on the record (`lang`), and the
       week's report is regenerated when the active AI language differs
       (week ids never fork — the id algorithm is pinned by tests), and
     · the week LABEL is never trusted from the payload across a language
       change: it is re-derived at render time from the stored date anchor
       (`weekStart`, falling back to digest.stats.weekOf / generatedAt).
   The active language is read from the LanguageContext value the render
   already uses — NOT from lib/api's module-level getAiLanguage(), which a
   cold load can read before LanguageProvider's sync effect has run (that
   race is exactly how a Hebrew session generated an English report).

   CLINICAL FIREWALL: the digest payload is counts-only (server/digest.ts
   JRNL-1 header); nothing here derives scores or trends. The resettable
   streak value from lib/streak is BANNED on every recap/strip surface —
   consumers may render totalDays ONLY (masterplan 2.3), pinned by the
   source-scan in components/weekly/recapStoryCards.test.ts.
   ════════════════════════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useState } from "react";
import { useArbor } from "../context/ArborContext";
import { useLanguage, type AiLang } from "../context/LanguageContext";
import { useChildCollection } from "./useChildCollection";
import { api, type WeeklyDigest } from "../lib/api";
import { rcString } from "../components/weekly/recapStrings";
import { CANONICAL_BEHAVIOR_TYPES } from "../content/behaviorTaxonomy";
import { scholarsInfo } from "../initialData";

const DAY = 86_400_000;

/** One report id per calendar week — the id WeeklyTab has always written. */
export function recapWeekId(d = new Date()): string {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / DAY + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export type WeeklyReport = {
  id: string; // = recapWeekId
  /** Legacy/back-compat display label, frozen in `lang` at generation time.
   *  NEVER rendered when `lang` differs from the active language — the label
   *  is re-derived from `weekStart` instead (see resolveWeekLabel). Optional:
   *  reports stored before the language fix may not carry a usable one. */
  weekLabel?: string;
  /** AI language this report's narrative was written in ("en" | "he").
   *  Absent on pre-fix documents → treated as unknown, i.e. stale. */
  lang?: AiLang;
  /** yyyy-mm-dd anchor the week label is derived from at RENDER time. */
  weekStart?: string;
  generatedAt: string;
  /** Counts only (clinical firewall): no derived intensity score is stored or
   *  rendered — parent surfaces show counts, never scores. Legacy docs may
   *  still carry an `avg` field in Firestore; it is never read.
   *
   *  F-11: `topTrigger` is the parent's own free-typed trigger words, stored
   *  verbatim — renderers must present it visibly AS parent words (quoted +
   *  truncated via topMomentDisplay), never as a computed-looking stat.
   *  `topBehaviorType` is the schema axis (canonical taxonomy / legacy select
   *  value), localized through behaviorTypeLabel at render time. Legacy docs
   *  stored `trigger || behaviorType` conflated into topTrigger and carry no
   *  topBehaviorType — topMomentDisplay untangles them. */
  summary: { count: number; resolved?: number; topTrigger: string; topBehaviorType?: string };
  milestoneWins: string[];
  planProgress: { done: number; total: number };
  spotlight: { name: string; concept: string; value: string };
  insight: string;
  /** RET-1: the structured "{child}'s week" digest (email/push-ready payload). */
  digest?: WeeklyDigest;
};

/**
 * Pure auto-generate decision (unit-tested in useWeeklyRecap.test.ts):
 * generate exactly when the collection has loaded, the week's report does not
 * exist yet (OR exists in the WRONG language), there is at least one logged
 * moment to summarize (day-0 with an empty log has nothing truthful to say),
 * and this session has not tried yet for this child/week/language.
 */
export function shouldAutoGenerateRecap(input: {
  loaded: boolean;
  hasCurrentWeek: boolean;
  weekMomentCount: number;
  alreadyTried: boolean;
  generating: boolean;
  /** The stored report is in a different AI language than the live session. */
  languageStale?: boolean;
}): boolean {
  return (
    input.loaded &&
    (!input.hasCurrentWeek || !!input.languageStale) &&
    !input.alreadyTried &&
    !input.generating &&
    input.weekMomentCount > 0
  );
}

/**
 * A stored report is language-stale when its generation language is not the
 * language we are rendering in. Pre-fix documents carry no `lang` at all —
 * their narrative language is unknowable, so they count as stale and get
 * rewritten once (per session) in the active language.
 */
export function isReportLanguageStale(
  report: { lang?: string } | null | undefined,
  activeLang: string
): boolean {
  return !!report && report.lang !== activeLang;
}

/** The date a week label is derived from, most specific source first. */
export function weekAnchorDate(
  report: { weekStart?: string; generatedAt?: string; digest?: { stats?: { weekOf?: string } } } | null | undefined
): Date | null {
  const raw = report?.weekStart || report?.digest?.stats?.weekOf || report?.generatedAt;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** yyyy-mm-dd (local) — the stored anchor written at generation time. */
export function weekStartKey(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Localized week label, built at RENDER time. The locale is the app's active
 * language (not the browser's): an English UI on a Hebrew machine must still
 * read "Week of August 12".
 */
export function formatWeekLabel(date: Date, lang: string, weekOf: string): string {
  const locale = lang === "he" ? "he-IL" : "en-US";
  let day: string;
  try {
    day = date.toLocaleDateString(locale, { month: "long", day: "numeric" });
  } catch {
    day = date.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  }
  return `${weekOf} ${day}`;
}

/**
 * Back-compat label resolution: a stored label is displayed ONLY when it was
 * written in the language we are rendering in; otherwise it is re-derived
 * from the stored date anchor (never translated, never shown as-is).
 */
export function resolveWeekLabel(
  report: (Parameters<typeof weekAnchorDate>[0] & { weekLabel?: string; lang?: string }) | null | undefined,
  opts: { lang: string; weekOf: string; fallbackDate?: Date }
): string {
  if (report?.weekLabel && report.lang === opts.lang) return report.weekLabel;
  const anchor = weekAnchorDate(report) ?? opts.fallbackDate ?? new Date();
  return formatWeekLabel(anchor, opts.lang, opts.weekOf);
}

/** Max characters of parent free text promoted into the top-trigger stat card. */
export const TRIGGER_QUOTE_MAX = 40;

/**
 * F-11 render model for the "Top trigger" stat card (pure, unit-tested).
 * The two axes never blur:
 *   · `type`  — a behaviorType (schema vocabulary) — safe to render as a
 *     computed stat, localized through behaviorTypeLabel;
 *   · `quote` — the parent's free-typed trigger words — rendered quoted and
 *     truncated (~40 chars), so parent words are VISIBLY parent words and
 *     never dress up as an analytics headline.
 * Legacy reports stored `trigger || behaviorType` conflated into topTrigger;
 * a canonical taxonomy value found there still renders as a type, anything
 * else is treated as the parent's words.
 */
export function topMomentDisplay(
  summary: { topTrigger?: string; topBehaviorType?: string } | null | undefined
): { type: string | null; quote: string | null } {
  const storedType = (summary?.topBehaviorType || "").trim();
  const raw = (summary?.topTrigger || "").trim();
  const rawIsType = !storedType && (CANONICAL_BEHAVIOR_TYPES as string[]).includes(raw);
  const type = storedType || (rawIsType ? raw : "") || null;
  const free = rawIsType || raw === "—" ? "" : raw;
  const quote = free
    ? free.length > TRIGGER_QUOTE_MAX
      ? `${free.slice(0, TRIGGER_QUOTE_MAX).trimEnd()}…`
      : free
    : null;
  return { type, quote };
}

/** Pure "new recap waiting" decision for the Since-strip entry line. */
export function isRecapUnopened(
  hasCurrentReport: boolean,
  currentId: string,
  lastOpenedWeekId: string | null
): boolean {
  return hasCurrentReport && lastOpenedWeekId !== currentId;
}

/** localStorage marker: the last weekId whose recap this child's parent opened. */
const openedKey = (childId: string) => `arbor.recap.opened.${childId}`;

function readOpenedWeek(childId: string): string | null {
  try {
    return window.localStorage.getItem(openedKey(childId));
  } catch {
    return null;
  }
}

/* Session-scoped auto-attempt guard, shared by every mount of this hook
   (`${childId}:${weekId}`). Module-level on purpose: WeeklyTab and the
   Since-strip must never both fire generation in one session. */
const autoAttempted = new Set<string>();

export function useWeeklyRecap() {
  const { behaviorLogs, milestones, actionPlans, childProfile } = useArbor();
  // The SAME language value the render uses — settled synchronously by the
  // provider's state initializer, so there is no cold-load race here.
  const { t, aiLang, uiLang } = useLanguage();
  const reportsCol = useChildCollection<WeeklyReport>(childProfile.id, "weeklyReports");
  const rc = (key: string, vars?: Record<string, string | number>) => rcString(t, uiLang, key, vars);

  const [generating, setGenerating] = useState(false);
  const [openedWeek, setOpenedWeek] = useState<string | null>(() => readOpenedWeek(childProfile.id));

  // Child switches re-read the opened marker (state initializer runs once).
  useEffect(() => {
    setOpenedWeek(readOpenedWeek(childProfile.id));
  }, [childProfile.id]);

  const currentId = recapWeekId();
  const currentLabel = formatWeekLabel(new Date(), uiLang, t("wk.weekOf"));
  /** Render-time label for ANY report (history included) — see resolveWeekLabel. */
  const labelFor = (report: WeeklyReport | null | undefined) =>
    resolveWeekLabel(report, { lang: uiLang, weekOf: t("wk.weekOf"), fallbackDate: new Date() });

  const reports = useMemo(
    () => [...reportsCol.items].sort((a, b) => (a.id < b.id ? 1 : -1)),
    [reportsCol.items]
  );

  // Live snapshot of the trailing week (used at generation time) — moved
  // verbatim from WeeklyTab. Counts only.
  const snapshot = useMemo(() => {
    const cutoff = Date.now() - 7 * DAY;
    const recent = behaviorLogs.filter((l) => new Date(l.timestamp).getTime() >= cutoff);
    const resolved = recent.filter((l) => l.resolved).length;
    // F-11: two separate axes, never conflated. behaviorType is schema
    // vocabulary (localized through the taxonomy label map at render time);
    // the trigger box is parent free-typed text and is stored verbatim so
    // renderers can show it quoted AS the parent's words — raw free text is
    // never promoted into a computed-looking analytics headline.
    const typeCounts = new Map<string, number>();
    const triggerCounts = new Map<string, number>();
    recent.forEach((l) => {
      const type = (l.behaviorType || "").trim();
      if (type) typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
      const trig = (l.trigger || "").trim();
      if (trig) triggerCounts.set(trig, (triggerCounts.get(trig) || 0) + 1);
    });
    const modeOf = (m: Map<string, number>) => {
      let top = "";
      let max = 0;
      m.forEach((v, k) => {
        if (v > max) {
          max = v;
          top = k;
        }
      });
      return top;
    };
    const topBehaviorType = modeOf(typeCounts);
    const topTrigger = modeOf(triggerCounts) || "—";
    const wins = milestones.filter((m) => m.checked).map((m) => m.title);
    let done = 0;
    let total = 0;
    actionPlans.forEach((p) => p.phases.forEach((ph) => ph.steps.forEach((s) => {
      total += 1;
      if (s.completed) done += 1;
    })));
    const spotlight = scholarsInfo[new Date().getDate() % scholarsInfo.length];
    return {
      summary: {
        count: recent.length,
        resolved,
        topTrigger,
        // Firestore rejects undefined fields — omit the key on an empty week.
        ...(topBehaviorType ? { topBehaviorType } : {}),
      },
      milestoneWins: wins,
      planProgress: { done, total },
      spotlight: { name: spotlight.name, concept: spotlight.concept, value: spotlight.value },
    };
  }, [behaviorLogs, milestones, actionPlans]);

  const generate = async () => {
    setGenerating(true);
    try {
      // RET-1: the digest endpoint computes truthful stats server-side and
      // writes the warm narrative on top (deterministic fallback when AI is off).
      let digest: WeeklyDigest | undefined;
      try {
        digest = await api.digest({
          childProfile,
          logs: behaviorLogs,
          milestones,
          language: aiLang,
        });
      } catch {
        digest = undefined;
      }
      const insight = digest
        ? [digest.summary, digest.tryThisWeek && `**${rc("elev.recap.try.title")}:** ${digest.tryThisWeek}`].filter(Boolean).join("\n\n")
        // The deterministic fallback narrative is UI copy, so it localizes too
        // — an English apology inside a Hebrew card is the same defect.
        : rc("elev.recap.insight.unavailable");
      const report: WeeklyReport = {
        id: currentId,
        // Written for older clients that still read the payload label, and
        // ONLY when the label's language IS the record's language; live
        // rendering re-derives from weekStart whenever `lang` differs.
        ...(aiLang === uiLang ? { weekLabel: currentLabel } : {}),
        lang: aiLang,
        weekStart: weekStartKey(),
        generatedAt: new Date().toISOString(),
        ...snapshot,
        insight,
        ...(digest ? { digest } : {}),
      };
      // weekId-keyed upsert: the two-device race stays last-write-wins.
      await reportsCol.upsert(report);
      return report;
    } finally {
      setGenerating(false);
    }
  };

  const currentReport = reports.find((r) => r.id === currentId) ?? null;
  /** This week's stored narrative was written in another language. */
  const languageStale = isReportLanguageStale(currentReport, aiLang);
  // One attempt per child/week/LANGUAGE: a language switch earns exactly one
  // regeneration, and a failed attempt never spins forever.
  const attemptKey = `${childProfile.id}:${currentId}:${aiLang}`;
  /**
   * A language-correct narrative is on its way (or has not been tried yet):
   * consumers hide the cross-language text instead of rendering it. Once the
   * attempt is spent this flips false and the stored text is shown again —
   * honest degradation beats a permanent spinner.
   */
  const languageRefreshPending = languageStale && (generating || !autoAttempted.has(attemptKey));

  // Auto-generate the week's report on the FIRST app-open of a new week —
  // moved from WeeklyTab's tab-entry effect to this app-level hook (W2 2.1) —
  // and re-generate when the live AI language no longer matches the stored one.
  useEffect(() => {
    const decision = shouldAutoGenerateRecap({
      loaded: reportsCol.loaded,
      hasCurrentWeek: reportsCol.items.some((r) => r.id === currentId),
      weekMomentCount: snapshot.summary.count,
      alreadyTried: autoAttempted.has(attemptKey),
      generating,
      languageStale,
    });
    if (decision) {
      autoAttempted.add(attemptKey);
      void generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportsCol.loaded, reportsCol.items, snapshot.summary.count, childProfile.id, aiLang, languageStale]);

  const recapUnopened = isRecapUnopened(!!currentReport, currentId, openedWeek);

  const markRecapOpened = () => {
    try {
      window.localStorage.setItem(openedKey(childProfile.id), currentId);
    } catch {
      /* marker is best-effort */
    }
    setOpenedWeek(currentId);
  };

  return {
    /** Newest-first weekly reports (the WeeklyTab history strip). */
    reports,
    loaded: reportsCol.loaded,
    generating,
    generate,
    currentId,
    currentLabel,
    /** Localized week label for any report, derived at render time. */
    labelFor,
    /** This week's report, if it exists yet. */
    currentReport,
    /** This week's stored narrative is in a different language than the session. */
    languageStale,
    /** …and a language-correct regeneration is still expected. */
    languageRefreshPending,
    /** True when a report exists for this week and it has not been opened. */
    recapUnopened,
    markRecapOpened,
    snapshot,
  };
}
