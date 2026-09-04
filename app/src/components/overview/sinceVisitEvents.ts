/* ════════════════════════════════════════════════════════════════════════════
   sinceVisitEvents — W1 1.1 pure row builder for the SinceLastVisit strip.

   Turns the data OverviewTab already holds (behaviorLogs, playLogs, milestone
   crossings, coach conversations) into ≤ maxRows EVENT rows strictly newer
   than the previous visit, plus a "+N more in Journal" overflow count.

   CLINICAL FIREWALL: rows are events and counts ONLY ("2 moments captured",
   "milestone crossed: first steps") — never comparative/trend wording. This
   module emits numbers and ids; the component maps them onto the
   elev.sincevisit.* strings (both guarded by sinceLastVisit.test.ts).

   Pure functions — unit-testable without React or context.
   ════════════════════════════════════════════════════════════════════════════ */

export type SinceVisitRow =
  | { kind: "milestone"; at: number; title: string }
  | { kind: "noticed"; at: number }
  /**
   * TJB-05 — the day's step, as an EVENT. `done` distinguishes "you set a
   * step" from "you said how it went"; `focusId` is the JOURNAL TIMELINE
   * SIGNAL id buildTimeline assigns the same record (`action-<entry id>`), so
   * the tap deep-links to the row the step wrote in the thread.
   */
  | { kind: "action"; at: number; done: boolean; focusId: string }
  | { kind: "moments"; at: number; count: number; focusId: string }
  | { kind: "plays"; at: number; count: number; focusId: string }
  | { kind: "conversations"; at: number; count: number };

export type SinceVisitRows = {
  /** ≤ maxRows rows, priority order: milestones -> noticed -> ACTION -> moments -> plays -> chats
 *  (action rows were inserted ahead of moments with TJB-05; with
 *  SINCE_VISIT_MAX_ROWS = 3 that can push plays into hiddenCount). */
  rows: SinceVisitRow[];
  /** Underlying events NOT conveyed by the visible rows (drives "+N more in Journal"). */
  hiddenCount: number;
  /** Total underlying events since the previous visit. */
  totalEvents: number;
};

export const SINCE_VISIT_MAX_ROWS = 3;

/**
 * W2 2.3: the timestamps feeding the cumulative continuity counter ("{n} days
 * of moments together"). A "moment" = a behavior log or a Daily Play
 * completion — the same definition lib/streak documents. Consumers may render
 * computeStreak(...).totalDays ONLY; the resettable walk on that result is a
 * streak and banned from parent surfaces (masterplan 2.3).
 */
export function collectMomentTimestamps(
  behaviorLogs: ReadonlyArray<{ timestamp: string }>,
  playLogs: ReadonlyArray<{ timestamp: string }>
): string[] {
  return [...behaviorLogs, ...playLogs].map((x) => x.timestamp);
}

const parseMs = (iso: string | undefined): number => {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? ms : NaN;
};

export function buildSinceVisitRows(input: {
  previousVisitAt: string | null;
  behaviorLogs: ReadonlyArray<{ id: string; timestamp: string }>;
  playLogs: ReadonlyArray<{ id: string; timestamp: string }>;
  milestones: ReadonlyArray<{ title: string; checked: boolean; observationUpdatedAt?: string }>;
  conversations: ReadonlyArray<{ id: string; updatedAt: string }>;
  /** TJB-05: the actionLoops ledger. Optional so existing callers compile. */
  actions?: ReadonlyArray<{
    id: string;
    status: "accepted" | "completed";
    acceptedAt: string;
    outcomeAt?: string;
  }>;
  /** Rule A fold: carry the ArborNoticed card as a strip row instead of a sibling card. */
  includeNoticedRow?: boolean;
  maxRows?: number;
}): SinceVisitRows {
  const sinceMs = parseMs(input.previousVisitAt ?? undefined);
  if (!Number.isFinite(sinceMs)) return { rows: [], hiddenCount: 0, totalEvents: 0 };
  const maxRows = input.maxRows ?? SINCE_VISIT_MAX_ROWS;
  const isNew = (iso: string | undefined) => {
    const ms = parseMs(iso);
    return Number.isFinite(ms) && ms > sinceMs;
  };

  // Milestone crossings: parent marked "yes" since the previous visit. Rare and
  // title-specific → one row each, newest first.
  const crossings = input.milestones
    .filter((m) => m.checked && isNew(m.observationUpdatedAt))
    .map((m) => ({ kind: "milestone" as const, at: parseMs(m.observationUpdatedAt), title: m.title }))
    .sort((a, b) => b.at - a.at);

  // Captured moments / completed activities / coach chats: aggregated to ONE
  // row each (a count is an event fact; a list of ten rows is noise).
  const newest = <T extends { at: number }>(arr: T[]): T | undefined =>
    arr.reduce<T | undefined>((top, x) => (top && top.at >= x.at ? top : x), undefined);

  const moments = input.behaviorLogs
    .map((l) => ({ id: l.id, at: parseMs(l.timestamp) }))
    .filter((l) => l.at > sinceMs);
  const plays = input.playLogs
    .map((p) => ({ id: p.id, at: parseMs(p.timestamp) }))
    .filter((p) => p.at > sinceMs);
  const convos = input.conversations
    .map((c) => ({ id: c.id, at: parseMs(c.updatedAt) }))
    .filter((c) => c.at > sinceMs);

  const candidates: SinceVisitRow[] = [...crossings];
  if (input.includeNoticedRow) candidates.push({ kind: "noticed", at: Date.now() });

  // TJB-05: the day's step, newest first. One row per action record — an
  // accepted-then-completed step within one visit gap is ONE act with a
  // later stamp, not two events, so the completion's timestamp wins.
  const actionRows = (input.actions ?? [])
    .map((a) => {
      const done = a.status === "completed";
      const at = parseMs(done ? (a.outcomeAt ?? a.acceptedAt) : a.acceptedAt);
      return { kind: "action" as const, at, done, focusId: `action-${a.id}` };
    })
    .filter((r) => Number.isFinite(r.at) && r.at > sinceMs)
    .sort((a, b) => b.at - a.at);
  candidates.push(...actionRows);

  if (moments.length > 0) {
    const top = newest(moments)!;
    // The JOURNAL TIMELINE SIGNAL id prefix (`moment-`) — the same ids
    // buildTimeline assigns, so the tap deep-links via requestJournalFocus.
    candidates.push({ kind: "moments", at: top.at, count: moments.length, focusId: `moment-${top.id}` });
  }
  if (plays.length > 0) {
    const top = newest(plays)!;
    candidates.push({ kind: "plays", at: top.at, count: plays.length, focusId: `play-${top.id}` });
  }
  if (convos.length > 0) {
    const top = newest(convos)!;
    candidates.push({ kind: "conversations", at: top.at, count: convos.length });
  }

  const rows = candidates.slice(0, maxRows);
  const eventsIn = (row: SinceVisitRow): number =>
    row.kind === "moments" || row.kind === "plays" || row.kind === "conversations" ? row.count : 1;
  const totalEvents = candidates.reduce((s, r) => s + eventsIn(r), 0);
  const shownEvents = rows.reduce((s, r) => s + eventsIn(r), 0);

  return { rows, hiddenCount: totalEvents - shownEvents, totalEvents };
}
