/* ════════════════════════════════════════════════════════════════════════════
   lifecycle — ENG-09: the lifecycle spine Today never had.

   `onboardingCompletedAt` is stamped once by OnboardingFlow and, until this
   module, had ZERO readers (grep: the type, the writer, two tests). No code
   path keyed off account age, so Today was byte-identical on day 1 and day 40
   except for data volume, and a parent who came back after a hard fortnight
   met exactly the same screen as one who opened this morning.

   This module is the pure answer to "where in their life with Arbor is this
   parent, and what is the ONE lifecycle thing worth saying today?".

   PURE: no React, no storage, no clock of its own, no imports at all. Every
   input is passed in and `now` is explicit, so every branch is unit-testable.

   ONE MOMENT PER OPEN. The resolver returns at most a single moment — Today's
   Rule-A budget (components/overview/todayModules.ts) counts it as one module.
   Priority is deliberate and fixed:

     1. welcome-back  a parent returning after a lapse needs the warm re-entry
                      before anything else competes for the screen (ENG-L5).
     2. birthday      a once-a-year calendar fact about the child (ENG-20b).
     3. age-band      the child moved into a new age band (ENG-20c).
     4. first-month   the day-30 keepsake (ENG-L4). Above first-week on
                      purpose: when BOTH are still unshown — a parent whose
                      first open is week six — the truer thing to hand them is
                      the month they have actually had, not the week they had
                      five weeks ago. The week keepsake is not discarded; it
                      simply follows on a later open.
     5. first-week    the day-7 keepsake (ENG-L3).
     6. first-moment  the day-0/1 payoff for the very first capture (ENG-L0).
     7. interest-ask  the day-3 "tell Arbor one thing they love" (ENG-L2).
     8. day-one       the day-1 return (ENG-L1).

   Each moment carries an OCCURRENCE KEY. The caller keeps a ledger of keys it
   has already shown (lib/lifecycleState.ts) and passes it back in as `seen`,
   so a moment fires once per occurrence and then steps aside for the next one
   down the list. Nothing here re-asks a question the parent already answered.

   CLINICAL FIREWALL. Every moment is a COUNT or a plain calendar fact. There
   is no score, no percentage, no band/verdict word, no weakest-domain pointer,
   and no period-vs-period delta anywhere in this file or in the copy it keys.
   `daysAway` exists to CHOOSE the welcome-back moment; it is deliberately not
   part of any rendered string (see i18nElevation/lifecycle.ts).

   NO LOSS FRAME. The lapse moment is age-anchored ("{name} is {age} now"),
   never absence-anchored. There is no streak, no "you missed", no counter that
   can go down. `LIFECYCLE_LOSS_FRAME_BANS` below is the machine-readable statement of
   that rule and the guard test scans the shipped dictionary against it.
   ════════════════════════════════════════════════════════════════════════════ */

/** A lapse is fourteen days without an open — a hard fortnight, not a failure. */
export const LAPSE_DAYS = 14;

/** The day the "tell Arbor one thing they love" ask becomes useful (ENG-L2). */
export const INTEREST_ASK_DAY = 3;

/** The day the first-week keepsake unlocks (ENG-L3). */
export const FIRST_WEEK_DAY = 7;

/** A first-week keepsake needs something to be a keepsake OF. */
export const FIRST_WEEK_MIN_MOMENTS = 3;

/** The day the first-month keepsake unlocks (ENG-L4) — the first month is over. */
export const FIRST_MONTH_DAY = 30;

/**
 * A first-month keepsake needs something to be a keepsake OF — but the floor is
 * ONE, not three.
 *
 * The week card asks for three because a week with one entry is barely a week.
 * A month is different: a parent who wrote one line in thirty days still wrote
 * a line, and a keepsake of exactly that is honest. Below the floor there is
 * genuinely nothing to hand over, and the right answer is silence, never a card
 * that congratulates an empty record or notes that it is empty.
 */
export const FIRST_MONTH_MIN_MOMENTS = 1;

/** A birthday stays offerable for a few days, so a Tuesday open still lands. */
export const BIRTHDAY_WINDOW_DAYS = 3;

/**
 * Where the parent is in their life with Arbor. Coarse on purpose: the stage
 * is for instrumentation and for callers that want a cheap branch, while the
 * MOMENT is what actually renders.
 */
export type LifecycleStage =
  | "day-zero"
  | "first-week"
  | "first-month"
  | "established"
  | "lapsed";

/** The moments this spine can offer. One per open, at most. */
export type LifecycleMomentKind =
  | "welcome-back"
  | "birthday"
  | "age-band"
  /** ENG-L4. Distinct from the `first-month` STAGE below, which is days 7–29:
   *  the moment fires once the first month is COMPLETE. */
  | "first-month"
  | "first-week"
  | "first-moment"
  | "interest-ask"
  | "day-one";

export interface LifecycleMoment {
  kind: LifecycleMomentKind;
  /**
   * Stable identity of THIS occurrence. Shown once, then remembered:
   * "birthday.2027" is a different occurrence from "birthday.2026", while
   * "first-week" can only ever happen once.
   */
  key: string;
  /**
   * Counts the card may render, already resolved. Counts only — a caller can
   * put any of these on screen without a firewall review.
   */
  counts: {
    /** Everything the parent has captured: moments + activities. */
    total: number;
    /** Captured in the last seven days. */
    week: number;
    /** Milestones the parent has noticed. */
    noticed: number;
  };
  /** The child's age in whole months at `now`, when it is known. */
  ageMonths: number | null;
}

export interface LifecycleInput {
  /** `ChildProfile.onboardingCompletedAt` — the anchor. Absent on legacy accounts. */
  onboardingCompletedAt?: string | null;
  /** `useLastVisit().previousVisitAt` — null on a first-ever visit. */
  previousVisitAt?: string | null;
  /** `ChildProfile.birthDate` (YYYY-MM-DD), when the parent gave one. */
  birthDate?: string | null;
  /** Whole months, from lib/childAge.ageMonthsFromProfile. */
  ageMonths?: number | null;
  /** The child's current play band (playbank/content.bandForAge). */
  band?: string | null;
  /** The band recorded on the previous resolved open, from the ledger. */
  recordedBand?: string | null;
  /** How many interests the parent has recorded. Zero = never asked, or skipped. */
  interestCount: number;
  /** Total captured moments + activities. */
  totalMoments: number;
  /** Captured in the last seven days. */
  weekMoments: number;
  /** Milestones noticed. */
  noticedMilestones: number;
  /** Occurrence keys already shown on this device. */
  seen?: readonly string[];
  /** Explicit clock (ms since epoch). */
  now: number;
}

export interface LifecycleState {
  /**
   * Whole days since onboarding completed, or null when the account predates
   * the anchor. A null day is NOT day 0 — a legacy parent is established, and
   * conflating the two is how you show a five-year customer a welcome card.
   */
  day: number | null;
  stage: LifecycleStage;
  /** Whole days since the previous visit; null on a first-ever visit. */
  daysAway: number | null;
  /** The one lifecycle thing worth saying today, or null. */
  moment: LifecycleMoment | null;
  /** The band to write back to the ledger, so the NEXT change is detectable. */
  band: string | null;
}

/* ── Calendar helpers ─────────────────────────────────────────────────────── */

/**
 * Local-midnight day index. Elapsed-hours arithmetic would put a parent who
 * finished onboarding at 23:40 on "day 0" for the whole of the next morning,
 * so the spine counts calendar days the way the parent does.
 */
function dayIndex(ms: number): number {
  const d = new Date(ms);
  return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000);
}

/** Whole calendar days between two instants, or null when `from` is unusable. */
export function calendarDaysBetween(from: string | null | undefined, nowMs: number): number | null {
  if (!from) return null;
  const at = Date.parse(from);
  if (!Number.isFinite(at)) return null;
  return Math.max(0, dayIndex(nowMs) - dayIndex(at));
}

/**
 * Days since onboarding completed. Null when the anchor is missing or corrupt
 * (every account created before P0.4 stamped it).
 */
export function lifecycleDay(onboardingCompletedAt: string | null | undefined, nowMs: number): number | null {
  return calendarDaysBetween(onboardingCompletedAt, nowMs);
}

/**
 * `YYYY-MM-DD` split by hand. `new Date("2020-05-14")` parses as UTC midnight,
 * which is 13 May in every negative-offset timezone — a birthday card a day
 * early for a third of the planet.
 */
function isoDateParts(value: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/**
 * Days since this year's birthday, or null when there hasn't been one yet this
 * year (or the date is unusable). A 29 February child lands on the last day of
 * February in a common year — the alternative is skipping their birthday three
 * years in four.
 */
export function daysSinceBirthday(birthDate: string | null | undefined, nowMs: number): number | null {
  if (!birthDate) return null;
  const parts = isoDateParts(birthDate);
  if (!parts) return null;
  const now = new Date(nowMs);
  const thisYear = new Date(now.getFullYear(), parts.month - 1, parts.day);
  // Roll a 29 Feb (or any overflowing date) forward into the real month.
  if (thisYear.getMonth() !== parts.month - 1) thisYear.setDate(0);
  const born = new Date(parts.year, parts.month - 1, parts.day);
  if (dayIndex(thisYear.getTime()) < dayIndex(born.getTime())) return null;
  const delta = dayIndex(nowMs) - dayIndex(thisYear.getTime());
  return delta < 0 ? null : delta;
}

/** The calendar year the offered birthday belongs to — the occurrence key. */
function birthdayYear(nowMs: number): number {
  return new Date(nowMs).getFullYear();
}

function stageFor(day: number | null, daysAway: number | null): LifecycleStage {
  if (daysAway !== null && daysAway >= LAPSE_DAYS) return "lapsed";
  if (day === null) return "established";
  if (day <= 0) return "day-zero";
  if (day < FIRST_WEEK_DAY) return "first-week";
  if (day < 30) return "first-month";
  return "established";
}

/**
 * True when the account is at least `n` days old. A legacy account (null day)
 * counts as old enough — it has been around longer than any of these gates.
 */
function atLeastDay(day: number | null, n: number): boolean {
  return day === null || day >= n;
}

/* ── The resolver ─────────────────────────────────────────────────────────── */

export function resolveLifecycle(input: LifecycleInput): LifecycleState {
  const day = lifecycleDay(input.onboardingCompletedAt, input.now);
  const daysAway = calendarDaysBetween(input.previousVisitAt, input.now);
  const stage = stageFor(day, daysAway);
  const band = input.band ?? null;
  const seen = new Set(input.seen ?? []);
  const ageMonths = input.ageMonths ?? null;

  const counts = {
    total: Math.max(0, input.totalMoments),
    week: Math.max(0, input.weekMoments),
    noticed: Math.max(0, input.noticedMilestones),
  };

  const offer = (kind: LifecycleMomentKind, key: string): LifecycleMoment | null =>
    seen.has(key) ? null : { kind, key, counts, ageMonths };

  const candidates: Array<LifecycleMoment | null> = [];

  // 1 — ENG-L5 / ENG-20(a). Age-anchored, never absence-anchored. The key is
  // the return DATE, so one lapse produces one welcome, not one per open.
  if (daysAway !== null && daysAway >= LAPSE_DAYS) {
    candidates.push(offer("welcome-back", `welcome-back.${dayIndex(input.now)}`));
  }

  // 2 — ENG-20(b). A calendar fact about the child, offerable for a few days.
  const sinceBirthday = daysSinceBirthday(input.birthDate, input.now);
  if (sinceBirthday !== null && sinceBirthday <= BIRTHDAY_WINDOW_DAYS) {
    candidates.push(offer("birthday", `birthday.${birthdayYear(input.now)}`));
  }

  // 3 — ENG-20(c). Only when a PREVIOUS band was recorded: a first sighting is
  // not a transition, and treating it as one greets every new parent with a
  // "moved into a new age band" card about a child who has not moved.
  if (band && input.recordedBand && band !== input.recordedBand) {
    candidates.push(offer("age-band", `age-band.${band}`));
  }

  // 4 — ENG-L4. The first month is over. Once ever, and only when the parent
  // kept at least one thing: a keepsake of an empty record is not a keepsake.
  // `day !== null` matters — a legacy account (null day) has no knowable first
  // month, and handing a five-year customer "your first month" is a lie about
  // when they arrived. What the CARD may say about that month is derived
  // separately, inside the window, by lib/firstMonthKeepsake.ts.
  if (day !== null && day >= FIRST_MONTH_DAY && counts.total >= FIRST_MONTH_MIN_MOMENTS) {
    candidates.push(offer("first-month", "first-month"));
  }

  // 5 — ENG-L3. Once ever, and only with enough captured to be a keepsake of.
  if (day !== null && day >= FIRST_WEEK_DAY && counts.total >= FIRST_WEEK_MIN_MOMENTS) {
    candidates.push(offer("first-week", "first-week"));
  }

  // 6 — ENG-L0. The payoff for the very first capture: the record exists now,
  // and tonight's story can be read from it.
  if (day !== null && day <= 1 && counts.total >= 1) {
    candidates.push(offer("first-moment", "first-moment"));
  }

  // 7 — ENG-L2. Skipped for good once ANY interest is recorded (the profile is
  // server-side, so answering on one device silences the ask on every device).
  if (input.interestCount <= 0 && atLeastDay(day, INTEREST_ASK_DAY)) {
    candidates.push(offer("interest-ask", "interest-ask"));
  }

  // 8 — ENG-L1. Day one, framed forward: yesterday's moment is kept, today's
  // one thing is waiting. Never "you did not come back".
  if (day === 1) {
    candidates.push(offer("day-one", "day-one"));
  }

  const moment = candidates.find((c): c is LifecycleMoment => c !== null) ?? null;

  return { day, stage, daysAway, moment, band };
}

/* ── Copy law (machine-readable, scanned by the guard test) ───────────────── */

/**
 * The loss-frame ban, stated once so a test can enforce it.
 *
 * ENG-L5 is written for a parent who has had a hard fortnight. Habit apps
 * reach for guilt here because guilt converts; that is precisely the reflex
 * this list forbids. Nothing Arbor says on a return may reference the absence,
 * a broken streak, or a thing the parent failed to do.
 */
export const LIFECYCLE_LOSS_FRAME_BANS: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: "missed", re: /\bmissed\b|\byou missed\b/i },
  { id: "streak", re: /\bstreak\b/i },
  { id: "havent", re: /\bhaven'?t\b|\bhasn'?t\b|\bdidn'?t\b/i },
  { id: "been-a-while", re: /\bit'?s been a while\b|\blong time no\b/i },
  { id: "lost", re: /\blost\b|\bbroke\b|\bbroken\b/i },
  { id: "come-back", re: /\bwhy did you\b|\bwhere have you been\b/i },
  { id: "he-missed", re: /פספסת|החמצת/ },
  { id: "he-streak", re: /רצף/ },
  { id: "he-absence", re: /לא היית|נעלמת|הרבה זמן שלא/ },
];
