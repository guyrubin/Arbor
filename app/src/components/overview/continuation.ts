/* ════════════════════════════════════════════════════════════════════════════
   continuation — B-TODAY-18: the continuation slot ABOVE Today's step card.

   Today opens on exactly one of: the carry-over outcome ask (a step the
   parent chose on a previous day and never rated), tomorrow's reason (the one
   thing they left themselves at a previous day's close), or nothing.

   NOT A SECOND ARBITER (framer ruling, VALIDATION §4 / REJECTIONS B-AI-06):
   the single-offer coordinator (lib/companionOffer decideOffer) already ranks
   follow-up → tomorrow-reason → … and returns ONE offer per open. This module
   is that decision's Today consumer: it only maps the coordinator's winner to
   a PLACEMENT — the two continuation kinds sit above the step, every other
   kind keeps its place under it. The carry-over-over-reason precedence is the
   coordinator's OFFER_PRECEDENCE, pinned by continuation.test.ts through
   decideOffer, never re-implemented here.

   Pure — no React, no I/O.
   ════════════════════════════════════════════════════════════════════════════ */
import type { OfferKind } from "../../lib/companionOffer";

export type ContinuationChoice = "carry" | "reason" | "dayClose" | "none";

/** B-TODAY-26: the hour the day-close line appears — rhythm/predict's default
 *  sleepHour (21), local time. */
export const DAY_CLOSE_LINE_HOUR = 21;

export function chooseContinuation(input: {
  /** The coordinator's offer for this open (useCompanionOffer("today")). */
  offerKind: OfferKind | null | undefined;
  /** B-TODAY-26: dayCloseDue(...) — only fills a slot the coordinator left
   *  empty; a carry-over or tomorrow's reason always wins. */
  dayClose?: boolean;
}): ContinuationChoice {
  if (input.offerKind === "follow-up") return "carry";
  if (input.offerKind === "tomorrow-reason") return "reason";
  if (input.dayClose) return "dayClose";
  return "none";
}

/**
 * B-TODAY-26 — the day-close line ("Kept today: {n} moments" · "Good night")
 * is due after the sleep hour, until the parent dismisses it for that local
 * day. No timer, no streak: it says what the day kept and lets go.
 */
export function dayCloseDue(input: { hour: number; dismissedDay: string | null; today: string }): boolean {
  return input.hour >= DAY_CLOSE_LINE_HOUR && input.dismissedDay !== input.today;
}

/** Sweepable per-child key (`arbor.<ns>.<childId>`, lib/childLocalState). */
export const dayCloseKey = (childId: string) => `arbor.dayClose.${childId}`;

/** Kinds that render in the continuation slot rather than under the step. */
export const isContinuationKind = (kind: OfferKind | null | undefined): boolean =>
  chooseContinuation({ offerKind: kind }) !== "none";
