/**
 * B-GAME-11 — ONE practice record per Sneak & Freeze sitting.
 *
 * Written through the existing practice-event writer (usePracticeData →
 * the child's `practiceEvents` collection, already registered for export and
 * erase). What it says: which game, the skill it practises ("stop-on-signal",
 * ruling G14), the day, a duration bucket, how many rounds, the experiences
 * met (e.g. the cat's sunglasses trick) and the prizes. What it never says:
 * right/wrong (`correct`), a score, a level or a band (rulings G9, G10). The
 * play level stays in device storage (sneakStore.ts). Kind `stop-signal` is
 * read by no band, confidence or weekly-plan derivation.
 */
import type { PracticeEvent } from "../../../../types";
import { dayKey } from "../../../../practice/signals";
import type { SneakState } from "./rules";

export const SNEAK_GAME_ID = "sneak-freeze";
export const SNEAK_SKILL = "stop-on-signal";

export type DurationBucket = "under-1m" | "1-3m" | "3-5m" | "5-10m" | "over-10m";

export function durationBucket(ms: number): DurationBucket {
  const m = Math.max(0, ms) / 60000;
  if (m < 1) return "under-1m";
  if (m < 3) return "1-3m";
  if (m < 5) return "3-5m";
  if (m < 10) return "5-10m";
  return "over-10m";
}

/** The record for a finished sitting (pure). */
export function sittingRecord(s: Pick<SneakState, "seed" | "tags" | "experiences" | "prizes">, durationMs: number, now: Date): PracticeEvent {
  return {
    id: `${SNEAK_GAME_ID}-${now.getTime()}-${s.seed.slice(-6).replace(/[^a-z0-9]/gi, "")}`,
    kind: "stop-signal",
    domain: "cognition",
    game: SNEAK_GAME_ID,
    skill: SNEAK_SKILL,
    day: dayKey(now),
    durationBucket: durationBucket(durationMs),
    rounds: s.tags,
    experiences: [...s.experiences],
    prizes: [...s.prizes],
    timestamp: now.toISOString(),
  };
}
