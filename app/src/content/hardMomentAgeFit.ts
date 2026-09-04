/**
 * WAVE-G · THE AGE GAP — why a family sees no hard-moment guides, said out loud.
 *
 * `fitsHardMomentAge` is fail-CLOSED by design (unknown metadata never opts a
 * family into the pilot), and the published pack is age-banded: the toddler
 * register covers 2–5, three school-age cards cover 6–12. A child UNDER 24
 * months or 13+ therefore matches NOTHING — and `HardMomentsSection` returned
 * `null`, so the parent got a permanently blank feature with no explanation.
 *
 * This module answers one question honestly: "is this child outside the ages
 * these guides were written for, and what ages ARE they written for?"
 *
 * Two rules keep the answer true rather than reassuring:
 *  1. Coverage is derived from the cards that WOULD ACTUALLY PUBLISH at some
 *     age under the caller's own release + locale + clock — never from the
 *     authored catalogue. If the pilot is withdrawn, expired, or the locale is
 *     unsupported, coverage is `null` and the surface promises NOTHING.
 *  2. The band parser is imported from `pilotRelease`, not re-implemented, so
 *     the range a parent reads cannot drift from the gate that filters them.
 *
 * NOTE: nothing here widens an age band. Bands are digest-pinned (a changed
 * band changes `computePilotDigest` and drops the card from the pilot), and
 * widening one is content authorship, not a wiring fix.
 */

import { hardMomentCards, type HardMomentCard } from "./hardMomentCards";
import {
  hardMomentPublication,
  parseHardMomentAgeBand,
  type HardMomentContext,
} from "./pilotRelease";

/** Month range the available guides span, plus the whole years to SAY. */
export interface HardMomentAgeCoverage {
  /** Inclusive lower bound in months. */
  readonly startMonths: number;
  /** Exclusive upper bound in months; `Infinity` if any band is open-ended. */
  readonly endMonths: number;
  /** Lower bound as whole years, for display ("2"). */
  readonly startYears: number;
  /** Last fully covered whole year, for display ("12"); `null` when open-ended. */
  readonly endYears: number | null;
}

/**
 * Where this child sits relative to the guides that exist.
 *  - `covered`  — in range (the section renders guides as usual)
 *  - `younger`  — below the youngest guide
 *  - `older`    — at or beyond the oldest guide
 *  - `gap`      — inside the overall range but no band contains this month
 *  - `unknown`  — no usable age on the profile
 *  - `none`     — no guide would publish at ANY age (withdrawn/expired/locale):
 *                 promise nothing, explain nothing, render nothing
 */
export type HardMomentAgeFit = "covered" | "younger" | "older" | "gap" | "unknown" | "none";

export interface HardMomentAgeVerdict {
  readonly fit: HardMomentAgeFit;
  readonly coverage: HardMomentAgeCoverage | null;
}

/** A card's bands as ranges. An unparseable band closes the card entirely —
 *  the same rule `fitsHardMomentAge` applies, kept in lockstep on purpose. */
function cardRanges(card: HardMomentCard) {
  if (!Array.isArray(card.ageBands) || card.ageBands.length === 0) return null;
  const ranges = card.ageBands.map(parseHardMomentAgeBand);
  return ranges.every((range) => range !== null) ? (ranges as NonNullable<(typeof ranges)[number]>[]) : null;
}

/**
 * Cards that publish for at least one age under this context. Each card is
 * probed at the start of its OWN band, so the probe is never a guess about
 * what "a typical child" looks like — it asks the real gate.
 */
function publishableRanges(context: HardMomentContext, cards: readonly HardMomentCard[]) {
  const out: { startMonths: number; endMonths: number }[] = [];
  for (const card of cards) {
    const ranges = cardRanges(card);
    if (!ranges) continue;
    for (const range of ranges) {
      if (hardMomentPublication(card, { ...context, ageMonths: range.startMonths }) !== null) {
        out.push(range);
      }
    }
  }
  return out;
}

/**
 * The age span the parent can honestly be told about, or `null` when nothing
 * would publish at any age.
 */
export function hardMomentAgeCoverage(
  context: HardMomentContext,
  cards: readonly HardMomentCard[] = hardMomentCards,
): HardMomentAgeCoverage | null {
  const ranges = publishableRanges(context, cards);
  if (ranges.length === 0) return null;
  const startMonths = Math.min(...ranges.map((r) => r.startMonths));
  const endMonths = Math.max(...ranges.map((r) => r.endMonths));
  return {
    startMonths,
    endMonths,
    startYears: Math.floor(startMonths / 12),
    // "2-5" parses to [24, 72): the last whole year actually covered is 5.
    endYears: Number.isFinite(endMonths) ? Math.floor(endMonths / 12) - 1 : null,
  };
}

/**
 * Classify this child against the guides that exist. `fit` drives the copy;
 * `coverage` supplies the numbers, so the sentence a parent reads is generated
 * from the shipped pack rather than hand-written and left to rot.
 */
export function hardMomentAgeFit(
  context: HardMomentContext,
  cards: readonly HardMomentCard[] = hardMomentCards,
): HardMomentAgeVerdict {
  const coverage = hardMomentAgeCoverage(context, cards);
  if (!coverage) return { fit: "none", coverage: null };

  const months = context.ageMonths;
  if (typeof months !== "number" || !Number.isFinite(months) || months < 0) {
    return { fit: "unknown", coverage };
  }
  if (months < coverage.startMonths) return { fit: "younger", coverage };
  if (months >= coverage.endMonths) return { fit: "older", coverage };

  const inSomeBand = publishableRanges(context, cards).some(
    (range) => months >= range.startMonths && months < range.endMonths,
  );
  return { fit: inSomeBand ? "covered" : "gap", coverage };
}

/** The notice is worth rendering only when the emptiness is about AGE. */
export function explainsEmptyHardMoments(fit: HardMomentAgeFit): boolean {
  return fit === "younger" || fit === "older" || fit === "gap" || fit === "unknown";
}
