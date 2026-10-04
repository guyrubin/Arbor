/* ════════════════════════════════════════════════════════════════════════════
   companionOffer — B-AI-06: ONE proactive offer per open, with a reason line.

   THE DEFECT THIS CLOSES
   ──────────────────────
   Today mounted five proactive cards independently (the carry-over question,
   the rhythm cue, the hard-moment offer, the lifecycle moment …) and Ask
   mounted the rhythm cue again. Each decided for itself whether to speak, so a
   parent could open Today to three asks at once — and nothing said WHY any of
   them was there. This module is the coordinator: it ranks every candidate
   against the 23 Sep precedence and returns at most ONE offer, with a reason
   key that names what the offer was built from.

   PRECEDENCE (23 Sep §4 "Proactive offer arbitration"; pinned by
   companionOffer.test.ts — the table IS the contract):
     1. follow-up          — a step the parent chose and never rated (carry-over)
     1a. tomorrow-reason   — B-TODAY-18 (framer, 1 Oct): the one thing the parent
                             left themselves at the close of a previous day
                             (lib/tomorrowReason). The continuation slot reads
                             carry-over first, then tomorrow's reason.
     2. what-changed       — the lifecycle re-entry moment (Today only)
     3. appointment        — an appointment ≤2 days ahead, or yesterday's
     4. screening-recheck  — a Development Check re-look that has come due
     5. rhythm             — the PREP / CALM rhythm cue (engine requires medium+)
     6. grounded-step      — one hard-moment step matched to a logged moment
     7. tonight            — the evening (bedtime) door
     8. engagement         — the parent's own engagement reminders (log /
                             practice), kept last so no existing cue is lost

   WHAT IT REUSES (never re-implements)
   ────────────────────────────────────
   · `lib/jitai.ts nextNudge` stays the candidate generator for 5/7/8 — the
     caller passes its result in.
   · Quiet hours and the max-2/day ceiling are `growth/jitaiPrefs` — the SAME
     helpers `growth/nudgeSchedule.planNudge` calls; one shown-ledger for every
     offer kind, so the ceiling binds across the whole proactive slot.

   SUPPRESSION (per child, per device, best-effort localStorage)
   ─────────────────────────────────────────────────────────────
   · "Later" snoozes a kind for SNOOZE_HOURS, no strike.
   · "Not today" dismisses a kind for the rest of the day and counts a strike;
     DISMISS_STRIKES strikes inside the window = SUPPRESS_DAYS of silence for
     that kind.
   · Undo reverses the last snooze/dismissal of a kind.

   CLINICAL FIREWALL: reason keys carry the parent's own words (the step they
   chose) or plain facts (an appointment date, a re-check that came due). No
   count about the child, no score, no verdict, no comparison.
   ════════════════════════════════════════════════════════════════════════════ */
import type { Nudge } from "./jitai";
import type { ActiveTab } from "./routes";
import { isInQuietHours, isUnderDailyCeiling, nudgeDayKey, type JitaiPrefs } from "../growth/jitaiPrefs";

export const OFFER_PRECEDENCE = [
  "follow-up",
  "tomorrow-reason",
  "what-changed",
  "appointment",
  "screening-recheck",
  "rhythm",
  "grounded-step",
  "tonight",
  "engagement",
] as const;
export type OfferKind = (typeof OFFER_PRECEDENCE)[number];

export type OfferSurface = "today" | "coach";

/**
 * Critic r1 (W2-ASKJB coach, P1 G1): Ask's first state is the continuation
 * object only — the carried-over step (follow-up) or tomorrow's reason. Every
 * other offer (reminders, bedtime doors, capture nudges, appointments) sends
 * the parent to another hub and stays on Today, never a second pinned card on
 * "Help me right now".
 */
export const COACH_OFFER_KINDS: readonly OfferKind[] = ["follow-up", "tomorrow-reason"];

/** Why a candidate in hand did not render (offer_suppressed). */
export const OFFER_SUPPRESS_REASONS = ["quiet_hours", "ceiling", "snoozed", "dismissed", "suppressed_7d"] as const;
export type OfferSuppressReason = (typeof OFFER_SUPPRESS_REASONS)[number];

export interface OfferState {
  nowMs: number;
  surface: OfferSurface;
  /** The single unrated step from a previous day (carryOverAction selector). */
  pendingFollowUp: { id: string; recommendation: string } | null;
  /** B-TODAY-18: the reason left at a previous day's close (reasonForThisOpen). */
  tomorrowReason?: { kind: string } | null;
  /** The lifecycle re-entry moment, when Today has one to show. */
  whatChanged: { id: string } | null;
  /** The nearest appointment in the window: dayOffset 0..2 ahead, or -1 (yesterday). */
  appointment: { id: string; dayOffset: number } | null;
  /** True when the latest screening's re-check date has arrived. */
  screeningRecheckDue: boolean;
  /** The jitai engine's candidate (already prefs/quiet/ceiling-filtered). */
  nudge: Nudge | null;
  /** A hard-moment step is available for a logged moment. */
  groundedStep: { id: string } | null;
  prefs: JitaiPrefs;
  /** Distinct proactive kinds already shown today (jitaiPrefs shownNudgesToday). */
  shownToday: readonly string[];
  /** The child's suppression ledger (readOfferLedger). */
  ledger: OfferLedger;
}

export interface CompanionOffer {
  kind: OfferKind;
  /** i18n key of the reason line (elev.offer.reason.*). */
  reasonKey: string;
  reasonVars?: Record<string, string | number>;
  /** Where the offer leads. Renderers with their own controls may ignore it. */
  cta: { labelKey: string; action: ActiveTab };
  /** The kind spent on the shared shown-ledger (a nudge spends its own kind). */
  ledgerKind: string;
  /** The jitai nudge for rhythm / tonight / engagement offers. */
  nudge?: Nudge;
}

export interface OfferDecision {
  offer: CompanionOffer | null;
  /** Candidates that were in hand but did not render, with the reason. */
  suppressed: { kind: OfferKind; reason: OfferSuppressReason }[];
}

/* ── Suppression ledger ────────────────────────────────────────────────────── */

export const SNOOZE_HOURS = 3;
export const DISMISS_STRIKES = 3;
export const SUPPRESS_DAYS = 7;
const DAY = 86_400_000;

export interface OfferLedgerEntry {
  /** Snoozed until (ms). */
  snoozeUntil?: number;
  /** The local day key a "Not today" applies to. */
  dismissedDay?: string;
  /** Strike timestamps (ms) inside the suppression window. */
  strikes?: number[];
  /** Silenced until (ms) after DISMISS_STRIKES strikes. */
  suppressedUntil?: number;
  /** The entry before the last action — what Undo restores. */
  prev?: Omit<OfferLedgerEntry, "prev"> | null;
}
export type OfferLedger = Partial<Record<OfferKind, OfferLedgerEntry>>;

const ledgerKey = (childId: string) => `arbor.offer.ledger.${childId}`;

export function readOfferLedger(childId: string): OfferLedger {
  try {
    const raw = window.localStorage.getItem(ledgerKey(childId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as OfferLedger) : {};
  } catch {
    return {};
  }
}

function writeOfferLedger(childId: string, ledger: OfferLedger): OfferLedger {
  try {
    window.localStorage.setItem(ledgerKey(childId), JSON.stringify(ledger));
  } catch {
    /* best-effort: a blocked store means the offer may reappear next open */
  }
  return ledger;
}

const snapshot = (entry: OfferLedgerEntry | undefined): Omit<OfferLedgerEntry, "prev"> | null => {
  if (!entry) return null;
  const { prev: _prev, ...rest } = entry;
  return rest;
};

/** Pure: the ledger after a snooze of `kind`. */
export function snoozeOfferIn(ledger: OfferLedger, kind: OfferKind, now: number): OfferLedger {
  const cur = ledger[kind];
  return { ...ledger, [kind]: { ...snapshot(cur), snoozeUntil: now + SNOOZE_HOURS * 3_600_000, prev: snapshot(cur) } };
}

/** Pure: the ledger after a "Not today" of `kind` (a strike; 3 strikes = 7 days). */
export function dismissOfferIn(ledger: OfferLedger, kind: OfferKind, now: number): OfferLedger {
  const cur = ledger[kind];
  const strikes = [...(cur?.strikes ?? []).filter((t) => now - t < SUPPRESS_DAYS * DAY), now];
  const next: OfferLedgerEntry = { ...snapshot(cur), dismissedDay: nudgeDayKey(now), strikes, prev: snapshot(cur) };
  if (strikes.length >= DISMISS_STRIKES) {
    next.suppressedUntil = now + SUPPRESS_DAYS * DAY;
    next.strikes = [];
  }
  return { ...ledger, [kind]: next };
}

/** Pure: the ledger after Undo of the last action on `kind`. */
export function undoOfferIn(ledger: OfferLedger, kind: OfferKind): OfferLedger {
  const cur = ledger[kind];
  if (!cur) return ledger;
  const next = { ...ledger };
  if (cur.prev) next[kind] = cur.prev;
  else delete next[kind];
  return next;
}

export const snoozeOffer = (childId: string, kind: OfferKind, now = Date.now()) =>
  writeOfferLedger(childId, snoozeOfferIn(readOfferLedger(childId), kind, now));
export const dismissOffer = (childId: string, kind: OfferKind, now = Date.now()) =>
  writeOfferLedger(childId, dismissOfferIn(readOfferLedger(childId), kind, now));
export const undoOffer = (childId: string, kind: OfferKind) =>
  writeOfferLedger(childId, undoOfferIn(readOfferLedger(childId), kind));

/** Why the ledger silences `kind` now, or null. */
export function ledgerSilence(ledger: OfferLedger, kind: OfferKind, now: number): OfferSuppressReason | null {
  const e = ledger[kind];
  if (!e) return null;
  if (e.suppressedUntil && now < e.suppressedUntil) return "suppressed_7d";
  if (e.dismissedDay && e.dismissedDay === nudgeDayKey(now)) return "dismissed";
  if (e.snoozeUntil && now < e.snoozeUntil) return "snoozed";
  return null;
}

/* ── Candidate builders ────────────────────────────────────────────────────── */

const localDayStart = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** The nearest appointment due in [yesterday, +2 days] (local days), not done. */
export function appointmentInWindow(
  items: readonly { id: string; whenIso?: string; status?: string }[],
  now: number,
): { id: string; dayOffset: number } | null {
  const today = localDayStart(now);
  let best: { id: string; dayOffset: number; at: number } | null = null;
  for (const a of items) {
    if (a.status === "done" || !a.whenIso) continue;
    const at = Date.parse(a.whenIso);
    if (!Number.isFinite(at)) continue;
    const dayOffset = Math.round((localDayStart(at) - today) / DAY);
    if (dayOffset < -1 || dayOffset > 2) continue;
    // Upcoming beats yesterday; nearer upcoming beats later.
    const rank = dayOffset >= 0 ? dayOffset : 10;
    const bestRank = best ? (best.dayOffset >= 0 ? best.dayOffset : 10) : Infinity;
    if (rank < bestRank) best = { id: a.id, dayOffset, at };
  }
  return best ? { id: best.id, dayOffset: best.dayOffset } : null;
}

const firstWords = (text: string, max = 80) => {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
};

/** Every candidate in hand, in precedence order (unfiltered). */
export function offerCandidates(state: OfferState): CompanionOffer[] {
  const out: CompanionOffer[] = [];
  if (state.pendingFollowUp) {
    out.push({
      kind: "follow-up",
      reasonKey: "elev.offer.reason.followUp",
      reasonVars: { step: firstWords(state.pendingFollowUp.recommendation) },
      cta: { labelKey: "elev.offer.cta.followUp", action: "overview" },
      ledgerKind: "follow-up",
    });
  }
  if (state.tomorrowReason) {
    out.push({
      kind: "tomorrow-reason",
      reasonKey: "elev.offer.reason.tomorrow",
      cta: { labelKey: "elev.rh.tomorrow.eyebrow", action: "overview" },
      ledgerKind: "tomorrow-reason",
    });
  }
  if (state.whatChanged && state.surface === "today") {
    out.push({
      kind: "what-changed",
      reasonKey: "elev.offer.reason.whatChanged",
      cta: { labelKey: "elev.offer.cta.whatChanged", action: "overview" },
      ledgerKind: "what-changed",
    });
  }
  if (state.appointment) {
    const d = state.appointment.dayOffset;
    out.push({
      kind: "appointment",
      reasonKey: d < 0 ? "elev.offer.reason.apptYesterday" : d === 0 ? "elev.offer.reason.apptToday" : d === 1 ? "elev.offer.reason.apptTomorrow" : "elev.offer.reason.apptSoon",
      reasonVars: { days: Math.max(0, d) },
      cta: { labelKey: d < 0 ? "elev.offer.cta.apptNote" : "elev.offer.cta.apptPrep", action: "appointments" },
      ledgerKind: "appointment",
    });
  }
  if (state.screeningRecheckDue) {
    out.push({
      kind: "screening-recheck",
      reasonKey: "elev.offer.reason.recheck",
      cta: { labelKey: "elev.offer.cta.recheck", action: "screening" },
      ledgerKind: "screening-recheck",
    });
  }
  const n = state.nudge;
  if (n && (n.kind === "prep" || n.kind === "calm")) {
    out.push({ kind: "rhythm", reasonKey: `elev.offer.reason.${n.kind}`, cta: { labelKey: n.ctaKey, action: n.action }, ledgerKind: n.kind, nudge: n });
  }
  if (state.groundedStep) {
    out.push({
      kind: "grounded-step",
      reasonKey: "elev.offer.reason.grounded",
      cta: { labelKey: "today.action.make", action: "overview" },
      ledgerKind: "grounded-step",
    });
  }
  if (n && n.kind === "bedtime") {
    out.push({ kind: "tonight", reasonKey: "elev.offer.reason.tonight", cta: { labelKey: n.ctaKey, action: n.action }, ledgerKind: n.kind, nudge: n });
  }
  if (n && (n.kind === "log" || n.kind === "practice")) {
    out.push({ kind: "engagement", reasonKey: "elev.offer.reason.reminder", cta: { labelKey: n.ctaKey, action: n.action }, ledgerKind: n.kind, nudge: n });
  }
  return state.surface === "coach" ? out.filter((c) => COACH_OFFER_KINDS.includes(c.kind)) : out;
}

/**
 * THE decision: at most one offer for this open, plus the audit trail of what
 * was in hand and why it did not render. Pure — the caller spends the ledger
 * slot (recordNudgeShown(offer.ledgerKind)) and emits the telemetry.
 */
export function decideOffer(state: OfferState): OfferDecision {
  const candidates = offerCandidates(state);
  const suppressed: OfferDecision["suppressed"] = [];
  // Quiet hours — the parent's boundary — silence the whole slot.
  if (isInQuietHours(state.prefs, state.nowMs)) {
    for (const c of candidates) suppressed.push({ kind: c.kind, reason: "quiet_hours" });
    return { offer: null, suppressed };
  }
  for (const c of candidates) {
    const silence = ledgerSilence(state.ledger, c.kind, state.nowMs);
    if (silence) {
      suppressed.push({ kind: c.kind, reason: silence });
      continue;
    }
    // Max-2 distinct kinds a day: a kind already shown keeps its slot.
    if (!state.shownToday.includes(c.ledgerKind) && !isUnderDailyCeiling(state.shownToday.length)) {
      suppressed.push({ kind: c.kind, reason: "ceiling" });
      continue;
    }
    return { offer: c, suppressed };
  }
  return { offer: null, suppressed };
}

export const chooseOffer = (state: OfferState): CompanionOffer | null => decideOffer(state).offer;

/**
 * Multi-child: ONE family line per child, each built from THAT child's state
 * only (its own ledger, follow-up, appointments …). A child's state object is
 * never merged with a sibling's.
 */
export function familyOfferLines(
  children: readonly { childId: string; state: OfferState }[],
): { childId: string; offer: CompanionOffer | null }[] {
  return children.map(({ childId, state }) => ({ childId, offer: chooseOffer(state) }));
}
