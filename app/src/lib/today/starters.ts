/**
 * B-TODAY-35 — Today for a toddler: the openers a 12–36-month child's age
 * actually needs, per band (lib/age/forChild `stageFor`).
 *
 * When the record has nothing to say back (lib/today/fromRecord returns null
 * and nothing was answered today), Today opens with ONE band starter:
 *   1. checkup — "{name}'s check-up at {age} is coming" → Care › appointments.
 *      Rendered ONLY when the visit schedule is marked reviewed
 *      (lib/domains/visitSchedule `reviewed`; the content gate stands) and the
 *      next routine visit is within CHECKUP_WINDOW_MONTHS.
 *   2. words   — a word was written down in the last WORDS_DAYS days →
 *      "What did she say today?" leads capture.
 *   3. bedtime — day 0, or no bedtime note in the last BEDTIME_DAYS days →
 *      "Same bedtime, every night", the four-step routine as the first focus.
 *   4. tastes  — otherwise: one new food, no pressure.
 * Preschool (3–5) and school-age (6–8) children get no starter: their Today
 * keeps the record openers and the existing chain. Babies (<12 m) none yet.
 *
 * Pure and on-device; zero model calls. CLINICAL FIREWALL: never a milestone
 * count, never "behind", no number about the child — the only age a parent
 * reads is the visit's own age on the check-up line.
 */
import { knownAgeMonthsOf, stageFor, type AgedChild, type AgeStage } from "../age/forChild";
import { VISIT_SCHEDULES, type VisitProgramme, type VisitSchedule } from "../domains/visitSchedule";
import { recordTopic } from "./fromRecord";

export type StarterKind = "checkup" | "words" | "bedtime" | "tastes";

/** The starter kinds each stage may open with, in priority order. */
export const STARTERS_BY_STAGE: Readonly<Record<AgeStage, readonly StarterKind[]>> = {
  baby: [],
  toddler: ["checkup", "words", "bedtime", "tastes"],
  preschool: [],
  school: [],
};

export interface TodayStarter {
  kind: StarterKind;
  /** i18n base key; `.title` · `.body` · `.action` (+ `.girl` / `.boy` on HE-gendered titles). */
  key: string;
  /** The routine visit's age in months (checkup only). */
  visitMonths?: number;
}

export interface StarterInput {
  child: AgedChild;
  now: Date;
  /** The child's own logs (newest first or any order). */
  logs: ReadonlyArray<{ timestamp: string; trigger?: string; notes?: string; behaviorType?: string }>;
  /** Words the parent wrote down (`langObs`). */
  words: ReadonlyArray<{ timestamp: string }>;
  /** Which routine-visit programme the family is in (default: Tipat Halav). */
  programme?: VisitProgramme;
  /** Injectable for tests; defaults to the shipped (unreviewed) table. */
  schedules?: Readonly<Record<VisitProgramme, VisitSchedule>>;
}

export const WORDS_DAYS = 14;
export const BEDTIME_DAYS = 14;
export const CHECKUP_WINDOW_MONTHS = 2;

const DAY_MS = 86_400_000;
const within = (iso: string, now: Date, days: number) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) && now.getTime() - t >= 0 && now.getTime() - t < days * DAY_MS;
};

/** Today's band starter, or null (no starter for this band, or none applies). */
export function selectStarter(input: StarterInput): TodayStarter | null {
  const kinds = STARTERS_BY_STAGE[stageFor(input.child, input.now)];
  if (!kinds.length) return null;
  for (const kind of kinds) {
    if (kind === "checkup") {
      const programme = input.programme ?? "il-tipat-halav";
      const schedule = (input.schedules ?? VISIT_SCHEDULES)[programme];
      if (!schedule?.reviewed) continue; // the content gate: an unreviewed table never renders
      // Visit schedules are in months from birth (chronological).
      const months = knownAgeMonthsOf(input.child, input.now);
      if (months === null) continue;
      const next = schedule.visitAgesMonths.find((m) => m > months) ?? null;
      if (next !== null && next - months <= CHECKUP_WINDOW_MONTHS) return { kind, key: "elev.ages.starter.checkup", visitMonths: next };
      continue;
    }
    if (kind === "words") {
      if (input.words.some((w) => within(w.timestamp, input.now, WORDS_DAYS))) return { kind, key: "elev.ages.starter.words" };
      continue;
    }
    if (kind === "bedtime") {
      const bedtimeNoted = input.logs.some(
        (l) => within(l.timestamp, input.now, BEDTIME_DAYS) && recordTopic(`${l.trigger ?? ""} ${l.notes ?? ""}`) === "bedtime",
      );
      if (!bedtimeNoted) return { kind, key: "elev.ages.starter.bedtime" };
      continue;
    }
    return { kind, key: "elev.ages.starter.tastes" };
  }
  return null;
}
