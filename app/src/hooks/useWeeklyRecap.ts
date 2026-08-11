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

   CLINICAL FIREWALL: the digest payload is counts-only (server/digest.ts
   JRNL-1 header); nothing here derives scores or trends. The resettable
   streak value from lib/streak is BANNED on every recap/strip surface —
   consumers may render totalDays ONLY (masterplan 2.3), pinned by the
   source-scan in components/weekly/recapStoryCards.test.ts.
   ════════════════════════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useState } from "react";
import { useArbor } from "../context/ArborContext";
import { useLanguage } from "../context/LanguageContext";
import { useChildCollection } from "./useChildCollection";
import { api, getAiLanguage, type WeeklyDigest } from "../lib/api";
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
  weekLabel: string;
  generatedAt: string;
  /** Counts only (clinical firewall): no derived intensity score is stored or
   *  rendered — parent surfaces show counts, never scores. Legacy docs may
   *  still carry an `avg` field in Firestore; it is never read. */
  summary: { count: number; resolved?: number; topTrigger: string };
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
 * exist yet, there is at least one logged moment to summarize (day-0 with an
 * empty log has nothing truthful to say), and this session has not tried yet.
 */
export function shouldAutoGenerateRecap(input: {
  loaded: boolean;
  hasCurrentWeek: boolean;
  weekMomentCount: number;
  alreadyTried: boolean;
  generating: boolean;
}): boolean {
  return (
    input.loaded &&
    !input.hasCurrentWeek &&
    !input.alreadyTried &&
    !input.generating &&
    input.weekMomentCount > 0
  );
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
  const { t } = useLanguage();
  const reportsCol = useChildCollection<WeeklyReport>(childProfile.id, "weeklyReports");

  const [generating, setGenerating] = useState(false);
  const [openedWeek, setOpenedWeek] = useState<string | null>(() => readOpenedWeek(childProfile.id));

  // Child switches re-read the opened marker (state initializer runs once).
  useEffect(() => {
    setOpenedWeek(readOpenedWeek(childProfile.id));
  }, [childProfile.id]);

  const currentId = recapWeekId();
  const currentLabel = `${t("wk.weekOf")} ${new Date().toLocaleDateString(undefined, { month: "long", day: "numeric" })}`;

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
    const counts = new Map<string, number>();
    recent.forEach((l) => counts.set(l.trigger || l.behaviorType, (counts.get(l.trigger || l.behaviorType) || 0) + 1));
    let topTrigger = "—";
    let max = 0;
    counts.forEach((v, k) => {
      if (v > max) {
        max = v;
        topTrigger = k;
      }
    });
    const wins = milestones.filter((m) => m.checked).map((m) => m.title);
    let done = 0;
    let total = 0;
    actionPlans.forEach((p) => p.phases.forEach((ph) => ph.steps.forEach((s) => {
      total += 1;
      if (s.completed) done += 1;
    })));
    const spotlight = scholarsInfo[new Date().getDate() % scholarsInfo.length];
    return {
      summary: { count: recent.length, resolved, topTrigger },
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
          language: getAiLanguage(),
        });
      } catch {
        digest = undefined;
      }
      const insight = digest
        ? [digest.summary, digest.tryThisWeek && `**Try this week:** ${digest.tryThisWeek}`].filter(Boolean).join("\n\n")
        : "AI insight unavailable right now — the structured summary below still reflects this week. Add your model key/credentials to enable live weekly insights.";
      const report: WeeklyReport = {
        id: currentId,
        weekLabel: currentLabel,
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

  // Auto-generate the week's report on the FIRST app-open of a new week —
  // moved from WeeklyTab's tab-entry effect to this app-level hook (W2 2.1).
  useEffect(() => {
    const attemptKey = `${childProfile.id}:${currentId}`;
    const decision = shouldAutoGenerateRecap({
      loaded: reportsCol.loaded,
      hasCurrentWeek: reportsCol.items.some((r) => r.id === currentId),
      weekMomentCount: snapshot.summary.count,
      alreadyTried: autoAttempted.has(attemptKey),
      generating,
    });
    if (decision) {
      autoAttempted.add(attemptKey);
      void generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportsCol.loaded, reportsCol.items, snapshot.summary.count, childProfile.id]);

  const currentReport = reports.find((r) => r.id === currentId) ?? null;
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
    /** This week's report, if it exists yet. */
    currentReport,
    /** True when a report exists for this week and it has not been opened. */
    recapUnopened,
    markRecapOpened,
    snapshot,
  };
}
