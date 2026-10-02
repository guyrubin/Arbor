/* ════════════════════════════════════════════════════════════════════════════
   whatChanged — B-TODAY-21: ONE "What changed since you left" composer.

   Today used to say the same thing four times: the SinceLastVisit rows + its
   "Arbor remembers" footer, ProgressNarrative's "What changed for {name}"
   ("{moments} and {plays} were saved this week"), the dev-map card's
   "{reached} of {total}" + "Areas (of 7)", and the drawer feed — over three
   different "week" definitions. This module is the one composer: it extends
   `buildSinceVisitRows` (the same previous-visit window, the same journal
   signal ids) and returns ≤ WHAT_CHANGED_MAX_LINES EVENT lines, in order:

     1. a first (lib/firsts detectFirsts — an event-staged first not yet seen);
     2. a milestone noticed, by its title (never "of total");
     3. a step outcome ("You tried {step} — it helped"), the parent's report;
     4. "{n} new things you approved about {name}";
     5. "{n} moments kept", with the latest one quoted and tappable;
   plus the folded `noticed` row (law 6: the watch signal folds INTO this card
   exactly as it folded into the since-strip) when Today's budget is spent.

   ONE MOMENT DEFINITION on Today: a moment = a behaviour log or a Daily Play
   completion (the definition lib/streak and collectMomentTimestamps already
   use for the days-together counter, which renders beside these lines).

   CLINICAL FIREWALL: events and counts only. No delta, comparison, total or
   verdict ("of {total}", "vs", "%", "more than", "fewer", "up", "down", HE
   "מתוך" / "יותר" / "פחות") — pinned in EN and HE by whatChanged.firewall.test.
   No streak walk (totalDays only, rendered by the component).

   Pure — no React, no I/O; the caller injects every input.
   ════════════════════════════════════════════════════════════════════════════ */
import { buildSinceVisitRows } from "./sinceVisitEvents";
import { detectFirsts, type FirstKind, type FirstsState } from "../../lib/firsts";
import type { ActionOutcome } from "../../actionLoop/model";

export const WHAT_CHANGED_MAX_LINES = 4;
/** The quoted latest moment is a cue, not the record — clipped for one line. */
export const WHAT_CHANGED_QUOTE_MAX = 60;

export type WhatChangedLine =
  | { kind: "first"; first: FirstKind; title?: string }
  | { kind: "milestone"; title: string; at: number }
  | { kind: "step"; step: string; outcome: ActionOutcome; focusId: string; at: number }
  | { kind: "facts"; count: number }
  | { kind: "moments"; count: number; quote: string; focusId: string }
  | { kind: "noticed" };

export type WhatChanged = {
  lines: WhatChangedLine[];
  /** Events not shown (drives "+N more in Journal"). */
  hiddenCount: number;
};

const parseMs = (iso: string | undefined): number => {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? ms : NaN;
};

const clip = (s: string): string => {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > WHAT_CHANGED_QUOTE_MAX ? `${clean.slice(0, WHAT_CHANGED_QUOTE_MAX - 1).trimEnd()}…` : clean;
};

export function composeWhatChanged(input: {
  previousVisitAt: string | null;
  behaviorLogs: ReadonlyArray<{ id: string; timestamp: string; trigger?: string; notes?: string }>;
  playLogs: ReadonlyArray<{ id: string; timestamp: string; title?: string }>;
  milestones: ReadonlyArray<{ title: string; checked: boolean; observationUpdatedAt?: string }>;
  actionLoop: ReadonlyArray<{
    id: string;
    recommendation: string;
    status: "accepted" | "completed" | "superseded";
    acceptedAt: string;
    outcomeAt?: string;
    outcome?: ActionOutcome;
  }>;
  /** Parent-approved memory facts whose record is newer than the previous visit. */
  approvedFactsSince: number;
  /** The first-moment ledger (lib/firsts) — read only here; FirstsMoment owns writes. */
  firstsState: FirstsState;
  /** Counts detectFirsts needs (milestones noticed). */
  firstsCounts?: { milestoneCount: number };
  /** Rule A / law 6: the watch signal folds in as a line. */
  includeNoticed?: boolean;
  maxLines?: number;
}): WhatChanged {
  const sinceMs = parseMs(input.previousVisitAt ?? undefined);
  if (!Number.isFinite(sinceMs)) return { lines: [], hiddenCount: 0 };
  const maxLines = input.maxLines ?? WHAT_CHANGED_MAX_LINES;

  // The SAME window and journal ids as the since-strip (one composer; Growth's
  // "new since" consumes this with its own filter — framer ruling).
  const base = buildSinceVisitRows({
    previousVisitAt: input.previousVisitAt,
    behaviorLogs: input.behaviorLogs,
    playLogs: input.playLogs,
    milestones: input.milestones,
    conversations: [],
    actions: input.actionLoop,
    maxRows: Number.MAX_SAFE_INTEGER,
  });

  const lines: WhatChangedLine[] = [];
  let events = 0;

  // 1. a first — only when its triggering record is new since the last visit.
  //    The event-staged first Today can date is the first milestone noticed
  //    (lib/firsts: first_week / first_moment belong to the lifecycle card;
  //    a story carries no timestamp here, so it is never claimed as "since").
  //    It absorbs that milestone's own line (one event, one line).
  const crossings = base.rows.filter((r): r is Extract<typeof r, { kind: "milestone" }> => r.kind === "milestone");
  let firstAbsorbed = false;
  const counts = input.firstsCounts;
  if (counts && crossings.length > 0) {
    const firsts = detectFirsts(
      { momentCount: 0, milestoneCount: counts.milestoneCount, storyCount: 0, momentDays: [], daysSinceStart: 0 },
      input.firstsState,
    );
    if (firsts.some((f) => f.kind === "first_milestone") && counts.milestoneCount === crossings.length) {
      lines.push({ kind: "first", first: "first_milestone", title: crossings[crossings.length - 1].title });
      events += 1;
      firstAbsorbed = true;
    }
  }

  // 2. milestones noticed, by title (newest first).
  crossings.forEach((r, i) => {
    if (firstAbsorbed && i === crossings.length - 1) return;
    lines.push({ kind: "milestone", title: r.title, at: r.at });
    events += 1;
  });

  // 3. a step outcome — the parent's own report on a step (never an
  //    unrated step: that one lives in the continuation slot above the step).
  const outcomes = input.actionLoop
    .filter((a) => a.status === "completed" && a.outcome && parseMs(a.outcomeAt) > sinceMs)
    .sort((a, b) => parseMs(b.outcomeAt) - parseMs(a.outcomeAt));
  for (const a of outcomes) {
    lines.push({ kind: "step", step: a.recommendation, outcome: a.outcome!, focusId: `action-${a.id}`, at: parseMs(a.outcomeAt) });
    events += 1;
  }

  // 4. facts the parent approved since the last visit.
  const facts = Math.max(0, Math.floor(input.approvedFactsSince || 0));
  if (facts > 0) {
    lines.push({ kind: "facts", count: facts });
    events += facts;
  }

  // 5. moments kept (behaviour logs + plays), the latest one quoted.
  const kept = [
    ...input.behaviorLogs.map((l) => ({ at: parseMs(l.timestamp), quote: l.trigger || l.notes || "", focusId: `moment-${l.id}` })),
    ...input.playLogs.map((p) => ({ at: parseMs(p.timestamp), quote: p.title || "", focusId: `play-${p.id}` })),
  ].filter((m) => Number.isFinite(m.at) && m.at > sinceMs);
  if (kept.length > 0) {
    const latest = kept.reduce((top, m) => (m.at > top.at ? m : top));
    lines.push({ kind: "moments", count: kept.length, quote: clip(latest.quote), focusId: latest.focusId });
    events += kept.length;
  }

  // Law 6: the folded watch signal (neutral ink, B-TODAY-05 copy).
  if (input.includeNoticed) {
    lines.splice(Math.min(lines.length, maxLines - 1), 0, { kind: "noticed" });
    events += 1;
  }

  const shown = lines.slice(0, maxLines);
  const eventsIn = (l: WhatChangedLine) => (l.kind === "moments" || l.kind === "facts" ? l.count : 1);
  const shownEvents = shown.reduce((s, l) => s + eventsIn(l), 0);
  return { lines: shown, hiddenCount: Math.max(0, events - shownEvents) };
}

/**
 * ENG-18 — the cold-start line ("3 more days and Arbor can read her rhythm"),
 * moved here from ProgressNarrative with the card it rode on. Returns the
 * i18n key, or null when there is nothing honest to say (no countdown once
 * the rhythm reads; never a zero-day promise). FIREWALL: it states what ARBOR
 * needs, never anything about the child.
 */
export function coldStartLineKey(daysNeeded: number | undefined): string | null {
  if (typeof daysNeeded !== "number" || !Number.isFinite(daysNeeded)) return null;
  if (daysNeeded <= 0) return null;
  return daysNeeded === 1 ? "elev.closeloop.coldstart.one" : "elev.closeloop.coldstart.many";
}
