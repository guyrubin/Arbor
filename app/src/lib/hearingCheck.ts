/**
 * B-NEXT-01 — hearing first: a parent worried about words is asked when the
 * child's hearing was last checked, the first thing a speech therapist asks.
 *
 * The answer is ONE bounded choice kept on the child's profile with the day it
 * was given (a dated fact, like `factsAsOf`), read back on the Words shelf and
 * printed in the speech therapist's intake packet. "Not sure" points to a
 * nurse or the paediatrician; nothing here is a verdict, a score or a risk.
 * Never sent to a model (`promptProfile` reads an allow-list without it).
 *
 * DARK until the clinical wording is reviewed (GA B-GA-02): the question and
 * the packet line show only with the pilot's device flag,
 * localStorage["arbor.flags.hearingQuestion"] = "1" (the house device-flag
 * pattern, cf. lib/entitlementsGuided). Off, nothing renders and nothing is
 * written. Pure: no React, no Firebase.
 */

export const HEARING_QUESTION_FLAG_KEY = "arbor.flags.hearingQuestion";

export const HEARING_CHECK_ANSWERS = ["recent", "year", "older", "notSince", "notSure"] as const;
export type HearingCheckAnswer = (typeof HEARING_CHECK_ANSWERS)[number];

/** `ChildProfile.hearingCheck`: the parent's answer and the day it was given. */
export interface HearingCheck {
  answer: HearingCheckAnswer;
  /** ISO timestamp of the answer (the fact's date). */
  answeredAt: string;
}

type StorageLike = Pick<Storage, "getItem"> | null | undefined;
const deviceStorage = (): StorageLike => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

/** Is the hearing question on for this device? Off unless the pilot flag says "1". Fails closed. */
export function hearingQuestionOn(storage?: StorageLike): boolean {
  const store = storage === undefined ? deviceStorage() : storage;
  try {
    return store?.getItem(HEARING_QUESTION_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export const isHearingCheckAnswer = (v: unknown): v is HearingCheckAnswer =>
  typeof v === "string" && (HEARING_CHECK_ANSWERS as readonly string[]).includes(v);

/** The stored answer, validated (a malformed record reads as unanswered). */
export function hearingCheckOf(profile: unknown): HearingCheck | null {
  const raw = (profile as { hearingCheck?: unknown } | null | undefined)?.hearingCheck as Partial<HearingCheck> | undefined;
  if (!raw || !isHearingCheckAnswer(raw.answer) || typeof raw.answeredAt !== "string" || !Number.isFinite(Date.parse(raw.answeredAt))) return null;
  return { answer: raw.answer, answeredAt: raw.answeredAt };
}

/** The profile patch an answer writes: the choice and today's date. */
export function hearingCheckPatch(answer: HearingCheckAnswer, now: Date = new Date()): { hearingCheck: HearingCheck } {
  return { hearingCheck: { answer, answeredAt: now.toISOString() } };
}

/** i18n key of an answer's words. */
export const hearingAnswerKey = (answer: HearingCheckAnswer): string => `elev.hearing.answer.${answer}`;
