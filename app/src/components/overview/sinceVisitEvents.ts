/* ════════════════════════════════════════════════════════════════════════════
   sinceVisitEvents — W1 1.1 pure row builder for the SinceLastVisit strip.

   Turns the data OverviewTab already holds (behaviorLogs, playLogs, milestone
   crossings, coach conversations, and — TJB-05 / ENG-12 — the action loop)
   into ≤ maxRows EVENT rows strictly newer than the previous visit, plus a
   "+N more in Journal" overflow count.

   CLINICAL FIREWALL: rows are events and counts ONLY ("2 moments captured",
   "milestone crossed: first steps") — never comparative/trend wording. This
   module emits numbers and ids; the component maps them onto the
   elev.sincevisit.* / today.since.* strings (both guarded by
   sinceLastVisit.test.ts).

   Pure functions — unit-testable without React or context.
   ════════════════════════════════════════════════════════════════════════════ */

import type { ActionLoopEntry, ActionOutcome } from "../../actionLoop/model";

/**
 * TJB-05 / ENG-12 — the action row's three shapes:
 *   planned — the parent accepted a step since the previous visit and has not
 *             reported on it yet, and it is still today's step;
 *   ask     — YESTERDAY's (≤ 48 h) accepted step is still unreported: the row
 *             asks once, with the three outcome chips inline. Zero guilt —
 *             an unanswered row simply expires after 48 h;
 *   done    — the parent reported an outcome since the previous visit.
 */
export type ActionRowState = "planned" | "ask" | "done";

export type SinceVisitRow =
  | { kind: "milestone"; at: number; title: string }
  | { kind: "noticed"; at: number }
  | { kind: "action"; at: number; actionId: string; recommendation: string; state: ActionRowState; outcome?: ActionOutcome; focusId: string }
  | { kind: "moments"; at: number; count: number; focusId: string }
  | { kind: "plays"; at: number; count: number; focusId: string }
  | { kind: "conversations"; at: number; count: number };

export type SinceVisitRows = {
  /** ≤ maxRows rows, priority order: milestones → noticed → action → moments → plays → chats. */
  rows: SinceVisitRow[];
  /** Underlying events NOT conveyed by the visible rows (drives "+N more in Journal"). */
  hiddenCount: number;
  /** Total underlying events since the previous visit. */
  totalEvents: number;
};

export const SINCE_VISIT_MAX_ROWS = 3;

/** ENG-12: how long an unreported step keeps asking (from its accept). */
export const ACTION_ASK_WINDOW_MS = 48 * 60 * 60 * 1000;

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

type ActionLike = Pick<ActionLoopEntry, "id" | "recommendation" | "status" | "acceptedAt" | "outcome" | "outcomeAt">;

/**
 * TJB-05 / ENG-12 — pure: the ONE action row for the strip, or null.
 * Priority: a fresh report (done) > yesterday's open step (ask) > today's
 * accepted step (planned). `todayActionId` is actionLoop/model todayActionId
 * for the child; `nowMs` is injected for testability.
 */
export function actionRowFor(input: {
  actionLoops: ReadonlyArray<ActionLike>;
  todayActionId: string;
  sinceMs: number;
  nowMs: number;
}): Extract<SinceVisitRow, { kind: "action" }> | null {
  const { actionLoops, todayActionId, sinceMs, nowMs } = input;
  const row = (a: ActionLike, at: number, state: ActionRowState): Extract<SinceVisitRow, { kind: "action" }> => ({
    kind: "action",
    at,
    actionId: a.id,
    recommendation: a.recommendation,
    state,
    ...(a.outcome ? { outcome: a.outcome } : {}),
    // The JOURNAL TIMELINE SIGNAL id buildTimeline assigns (`action-`).
    focusId: `action-${a.id}`,
  });

  // 1) done — reported since the previous visit (newest first).
  const done = actionLoops
    .filter((a) => a.outcome && Number.isFinite(parseMs(a.outcomeAt)) && parseMs(a.outcomeAt) > sinceMs)
    .sort((a, b) => parseMs(b.outcomeAt) - parseMs(a.outcomeAt))[0];
  if (done) return row(done, parseMs(done.outcomeAt), "done");

  // 2) ask — an earlier day's step, unreported, accepted within the window.
  const ask = actionLoops
    .filter((a) => a.status === "accepted" && !a.outcome && a.id !== todayActionId)
    .filter((a) => {
      const acc = parseMs(a.acceptedAt);
      return Number.isFinite(acc) && nowMs - acc <= ACTION_ASK_WINDOW_MS && acc <= nowMs;
    })
    .sort((a, b) => parseMs(b.acceptedAt) - parseMs(a.acceptedAt))[0];
  if (ask) return row(ask, parseMs(ask.acceptedAt), "ask");

  // 3) planned — today's step, accepted since the previous visit, still open.
  const planned = actionLoops.find(
    (a) => a.id === todayActionId && a.status === "accepted" && !a.outcome && parseMs(a.acceptedAt) > sinceMs,
  );
  if (planned) return row(planned, parseMs(planned.acceptedAt), "planned");

  return null;
}

export function buildSinceVisitRows(input: {
  previousVisitAt: string | null;
  behaviorLogs: ReadonlyArray<{ id: string; timestamp: string }>;
  playLogs: ReadonlyArray<{ id: string; timestamp: string }>;
  milestones: ReadonlyArray<{ title: string; checked: boolean; observationUpdatedAt?: string }>;
  conversations: ReadonlyArray<{ id: string; updatedAt: string }>;
  /** TJB-05 / ENG-12: the child's action loop + today's action id. Optional so
   *  callers that carry no loop (tests, other strips) are unchanged. */
  actionLoops?: ReadonlyArray<ActionLike>;
  todayActionId?: string;
  nowMs?: number;
  /** Rule A fold: carry the ArborNoticed card as a strip row instead of a sibling card. */
  includeNoticedRow?: boolean;
  maxRows?: number;
}): SinceVisitRows {
  const sinceMs = parseMs(input.previousVisitAt ?? undefined);
  if (!Number.isFinite(sinceMs)) return { rows: [], hiddenCount: 0, totalEvents: 0 };
  const maxRows = input.maxRows ?? SINCE_VISIT_MAX_ROWS;
  const nowMs = input.nowMs ?? Date.now();
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
  if (input.includeNoticedRow) candidates.push({ kind: "noticed", at: nowMs });
  // TJB-05 / ENG-12: the loop's consequence sits right under the crossings —
  // the parent's own step is the day's thread, so it outranks the aggregates.
  if (input.actionLoops && input.todayActionId) {
    const actionRow = actionRowFor({ actionLoops: input.actionLoops, todayActionId: input.todayActionId, sinceMs, nowMs });
    if (actionRow) candidates.push(actionRow);
  }
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
