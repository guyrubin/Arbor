/* B-ASKJB-34 — the Journal leads with the parent's words. The thread read
 * (hooks/useTimeline) passes through this module so that:
 *
 *   1. identical events are de-duplicated AT READ (same type + same minute):
 *      a raw child-activity record written twice, or a parent moment saved
 *      twice with the same words, is one event — nothing is deleted from the
 *      ledger;
 *   2. the child's play and stories fold to ONE quiet row per day (kind
 *      "practice", `folded` = that day's per-activity rows, shown on tap) —
 *      a practice game, a speech round and a hero story on the same Thursday
 *      are one line under the parent's own entries, never three.
 *
 * Pure, framework-free: the hook calls `readTimeline`, the guard
 * (hooks/useTimeline.fold.test.ts) calls the same function.
 *
 * CLINICAL FIREWALL: nothing here scores, ranks or compares; the folded row
 * keeps only what the per-type rows already said (a day's plain event counts).
 */
import { buildTimeline, type TimelineSignal, type TimelineSources } from "./signalTimeline";

/** UTC minute of a timestamp ("2026-09-17T08:41"), or null when undated. */
const minuteOf = (ts: string | null | undefined): string | null => {
  if (!ts) return null;
  const ms = new Date(ts).getTime();
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 16) : null;
};

/** UTC day — the same key groupByDay files a row under. */
const dayOf = (ts: string): string => new Date(ts).toISOString().slice(0, 10);

/** Keep the first record per `type + minute`; undated records are all kept. */
export function dedupeByMinute<T>(
  items: readonly T[] | undefined,
  stampOf: (x: T) => string | null | undefined,
  typeOf: (x: T) => string,
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items ?? []) {
    const minute = minuteOf(stampOf(item));
    if (minute === null) {
      out.push(item);
      continue;
    }
    const key = `${typeOf(item)}|${minute}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Signal-level identity: kind + type + words + minute. A parent row is only
 *  ever collapsed into an identical one (same words, same minute). */
const signalType = (s: TimelineSignal): string =>
  [s.kind, s.practiceType ?? "", s.refTitle ?? "", s.wordsLanguage ?? "", s.detail ?? ""].join("|");

export const dedupeSignals = (signals: readonly TimelineSignal[]): TimelineSignal[] =>
  dedupeByMinute(signals, (s) => s.at, signalType);

/** One quiet row per day for the child's play and stories. Signals arrive
 *  newest first, so the folded row takes the place of that day's newest
 *  activity. A day with a single activity row keeps it as it is. */
export function foldPlayDays(signals: readonly TimelineSignal[]): TimelineSignal[] {
  const byDay = new Map<string, TimelineSignal[]>();
  for (const s of signals) {
    if (s.kind !== "practice" || !s.at) continue;
    const day = dayOf(s.at);
    const list = byDay.get(day);
    if (list) list.push(s);
    else byDay.set(day, [s]);
  }
  const out: TimelineSignal[] = [];
  const emitted = new Set<string>();
  for (const s of signals) {
    if (s.kind !== "practice" || !s.at) {
      out.push(s);
      continue;
    }
    const day = dayOf(s.at);
    if (emitted.has(day)) continue;
    emitted.add(day);
    const rows = byDay.get(day) ?? [s];
    if (rows.length === 1) {
      out.push(rows[0]);
      continue;
    }
    const latest = rows.reduce((a, b) => (new Date(b.at as string).getTime() > new Date(a.at as string).getTime() ? b : a));
    out.push({ id: `child-day-${day}`, kind: "practice", at: latest.at, tone: "sky", folded: rows });
  }
  return out;
}

/** THE thread read: de-duplicate the raw child-activity ledgers, build the
 *  timeline, collapse identical rows, fold each day's play into one row. */
export function readTimeline(sources: TimelineSources): TimelineSignal[] {
  const deduped: TimelineSources = {
    ...sources,
    practiceEvents: dedupeByMinute(sources.practiceEvents, (e) => e.timestamp, (e) => `practice:${e.kind}`),
    speechAttempts: dedupeByMinute(sources.speechAttempts, (a) => a.timestamp, (a) => `speech:${a.sound}:${a.target}`),
    mimicSessions: dedupeByMinute(sources.mimicSessions, (m) => m.timestamp, (m) => `mimic:${m.packId}:${m.promptId}`),
    adventureResults: dedupeByMinute(sources.adventureResults, (r) => r.timestamp, (r) => `adventure:${r.scenarioId}:${r.sceneId}`),
    missionRecords: dedupeByMinute(sources.missionRecords, (m) => m.timestamp, (m) => `mission:${m.missionId}`),
    heroRuns: dedupeByMinute(sources.heroRuns, (r) => r.completedAt || r.startedAt, (r) => `hero:${r.storyId}`),
  };
  return foldPlayDays(dedupeSignals(buildTimeline(deduped)));
}
