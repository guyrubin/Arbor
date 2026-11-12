import { HIGH_INTENSITY, MIN_HARD_DAYS, MIN_HARD_LOGS, RHYTHM_WINDOW_DAYS, rhythmDayKey } from "../../rhythm/predict";
import type { RhythmCard, RhythmSlot } from "./togetherRhythm";

/* ════════════════════════════════════════════════════════════════════════════
   v4.1 — Right now: ONE line on Now that follows the time of day.

   Pure and record-backed. Each state is drawn from something the family
   already has: a routine they started (its next step today), the hard moments
   they kept (their own clock times), the upcoming visit, tonight's questions.
   With nothing to say for this part of the day the card is not drawn — never
   a filler line, never an invented time, person or pattern.

   The hard-moment state is the strictest: it needs the rhythm read's own
   evidence floor (MIN_HARD_LOGS hard moments on MIN_HARD_DAYS days inside the
   RHYTHM_WINDOW_DAYS window), and then a strict majority of the last four to
   fall near this time of day. The window it names is the earliest and latest
   of THOSE moments, widened to the five minutes, so the sentence stays true.
   Counts of the parent's own records, never a judgement of the child.
   ════════════════════════════════════════════════════════════════════════════ */

export type DayPart = "morning" | "midday" | "afternoon" | "evening";

/** 05–11 morning, 11–15 midday, 15–19 before dinner, else evening. */
export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 15) return "midday";
  if (hour >= 15 && hour < 19) return "afternoon";
  return "evening";
}

/** The routine slots that belong to each part of the day (the meal and tidy-up sit before dinner). */
const PART_SLOTS: Readonly<Record<DayPart, readonly RhythmSlot[]>> = {
  morning: ["morning"],
  midday: ["midday"],
  afternoon: ["afternoon", "evening"],
  evening: ["evening", "night"],
};

/** The first started routine of this part of the day with a step still open today. */
export function routineForPart(rhythm: readonly RhythmCard[], part: DayPart): RhythmCard | null {
  return rhythm.find((card) => !card.complete && !!card.nextStep && PART_SLOTS[part].includes(card.slot)) ?? null;
}

export interface HardWindow {
  /** The last hard moments read (at most four). */
  recent: number;
  /** How many of them fell near this time of day. */
  inWindow: number;
  /** Minutes after midnight, widened outward to five minutes. */
  fromMinute: number;
  toMinute: number;
}

const DAY_MS = 86_400_000;
const RECENT = 4;
/** "Near this time": from half an hour ago to an hour and a half ahead. */
const BEFORE_MIN = 30;
const AHEAD_MIN = 90;

type HardLog = { timestamp: string | number; intensity?: number };

/** The hard-moment window around `now`, or null below the evidence floor or without a strict majority. */
export function hardWindowNow(logs: readonly HardLog[], now: Date): HardWindow | null {
  const nowMs = now.getTime();
  const since = nowMs - RHYTHM_WINDOW_DAYS * DAY_MS;
  const hard = logs
    .map((log) => ({ ms: typeof log.timestamp === "number" ? log.timestamp : new Date(log.timestamp).getTime(), intensity: log.intensity }))
    .filter((log) => Number.isFinite(log.ms) && log.ms >= since && log.ms <= nowMs && typeof log.intensity === "number" && log.intensity >= HIGH_INTENSITY)
    .sort((a, b) => b.ms - a.ms);
  if (hard.length < MIN_HARD_LOGS || new Set(hard.map((log) => rhythmDayKey(log.ms))).size < MIN_HARD_DAYS) return null;
  const recent = hard.slice(0, RECENT);
  const nowMinute = now.getHours() * 60 + now.getMinutes();
  const inside = recent
    .map((log) => { const at = new Date(log.ms); return at.getHours() * 60 + at.getMinutes(); })
    .filter((minute) => minute >= nowMinute - BEFORE_MIN && minute <= nowMinute + AHEAD_MIN);
  if (inside.length < 2 || inside.length * 2 <= recent.length) return null;
  const fromMinute = Math.floor(Math.min(...inside) / 5) * 5;
  const ceiling = Math.min(Math.ceil(Math.max(...inside) / 5) * 5, 24 * 60 - 1);
  return { recent: recent.length, inWindow: inside.length, fromMinute, toMinute: ceiling > fromMinute ? ceiling : Math.min(fromMinute + 5, 24 * 60 - 1) };
}

/** "16:45" for minutes after midnight. */
export function clockOf(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

export type RightNow =
  | { kind: "hard"; part: DayPart; window: HardWindow }
  | { kind: "routine"; part: DayPart; card: RhythmCard }
  | { kind: "visit"; part: DayPart }
  | { kind: "tonight"; part: DayPart };

/**
 * The one state this part of the day earns, or null. Morning: the routine,
 * then a hard window. Midday: the visit, a hard window, the routine. Before
 * dinner: a hard window, then the routine. Evening: tonight's questions (when
 * they are not already Now's lead), then the bedtime routine.
 */
export function selectRightNow(input: {
  part: DayPart;
  hard: HardWindow | null;
  /** The hard-moment sheet has a card for this child today. */
  hardDoor: boolean;
  routine: RhythmCard | null;
  /** An upcoming visit that is not already Now's lead. */
  visit: boolean;
  /** Tonight's questions are ready and not already Now's lead. */
  tonight: boolean;
}): RightNow | null {
  const { part } = input;
  const hard: RightNow | null = input.hard && input.hardDoor && part !== "evening" ? { kind: "hard", part, window: input.hard } : null;
  const routine: RightNow | null = input.routine ? { kind: "routine", part, card: input.routine } : null;
  const visit: RightNow | null = input.visit ? { kind: "visit", part } : null;
  const tonight: RightNow | null = input.tonight ? { kind: "tonight", part } : null;
  const order = part === "morning" ? [routine, hard]
    : part === "midday" ? [visit, hard, routine]
      : part === "afternoon" ? [hard, routine]
        : [tonight, routine];
  return order.find((state): state is RightNow => state !== null) ?? null;
}
