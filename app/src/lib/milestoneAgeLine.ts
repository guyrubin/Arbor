/**
 * B-LOOP-01 [VETO-FIRST clinical] — THE parent-facing age sentence for a
 * milestone. One pure builder; every surface that prints an age line on a
 * watch-for card (B-LOOP-04, B-LOOP-10) prints THIS, never its own words.
 *
 *  - "most_children_by" (CDC 2022)  → "Most children do this by {age}"
 *                                     "רוב הילדים עושים זאת עד גיל {age}"
 *  - "range"                        → "Usually between {from} and {to}"
 *                                     "בדרך כלל בין {from} ל-{to}"
 *                                     ONLY when the source cites the page
 *                                     (`url`) and the range it PRINTS
 *                                     (`printedRange`); otherwise null.
 *  - "average_onset"                → null. Never rendered: an average invites
 *                                     comparison.
 *  - "unstated"                     → null. The source is named but the age it
 *                                     prints could not be cited (the six ASHA
 *                                     rows, orchestrator ruling 6 Oct).
 *
 * FIREWALL (pack non-negotiable "Firewall on age"):
 *  - The sentence is the SOURCE's own semantics and nothing else. It never
 *    reads `observationStatus` / `checked`: "not yet" and "not sure" print the
 *    exact same sentence as "yes" — no "late" variant exists to be chosen.
 *  - Ages print as the band label (`ms.band.<months>` through
 *    `milestoneBandLabel`), never as raw months; a bound that is not a band
 *    threshold fails closed (null) rather than print a number nobody cited.
 *  - The source is resolved from the CATALOGUE by stable id, never from the
 *    stored doc (stored docs predate B-LOOP-01 and carry no source); a
 *    parent-added or retired row has no catalogue source → null.
 */
import type { Milestone, MilestoneSource } from "../types";
import { ALL_MILESTONES, MILESTONE_AGE_BANDS, isCatalogueMilestone, milestoneBandLabel } from "./milestoneData";

/** Structural `t()` — keeps this module free of the i18n import. */
type MilestoneT = (key: string, vars?: Record<string, string | number>) => string;

const CATALOGUE_BY_ID: ReadonlyMap<string, Milestone> = new Map(ALL_MILESTONES.map((m) => [m.id, m]));
const BAND_MONTHS: ReadonlySet<number> = new Set(MILESTONE_AGE_BANDS.map((b) => b.months));

/** The catalogue source for a row (by stable id), or null for a parent-added / unknown row. */
export function milestoneSource(m: { id: string; custom?: boolean }): MilestoneSource | null {
  if (!isCatalogueMilestone(m)) return null;
  return CATALOGUE_BY_ID.get(m.id)?.source ?? null;
}

/** A band threshold's label in the page language; null if `months` is not a band. */
function bandLabel(months: number | undefined, t: MilestoneT): string | null {
  if (typeof months !== "number" || !BAND_MONTHS.has(months)) return null;
  const label = milestoneBandLabel(months, t);
  return label ? label : null;
}

/** Hebrew writes the maqaf only before a numeral ("ל-12 חודשים"); before a
 *  word the prefix joins it ("לשנה", "לשנתיים וחצי"). No-op for English. */
const joinHebrewPrefix = (s: string): string => s.replace(/ל-(?=\u2068?[\u05D0-\u05EA])/g, "ל");

/**
 * The one age sentence for a milestone, in the page language — or null when
 * nothing may be said (no catalogue source, average onset, or an age that is
 * not a band).
 */
export function milestoneAgeLine(
  m: Pick<Milestone, "id"> & { custom?: boolean },
  t: MilestoneT,
): string | null {
  const source = milestoneSource(m);
  if (!source) return null;
  switch (source.ageSemantics) {
    case "most_children_by": {
      const age = bandLabel(CATALOGUE_BY_ID.get(m.id)?.ageMonths, t);
      return age ? t("ms.age.mostBy", { age }) : null;
    }
    case "range": {
      // Never "ASHA" over a number ASHA did not print: no cited page + printed
      // bracket → no sentence.
      if (!source.url || !source.printedRange?.trim()) return null;
      const [fromMonths, toMonths] = source.rangeMonths ?? [];
      const from = bandLabel(fromMonths, t);
      const to = bandLabel(toMonths, t);
      return from && to ? joinHebrewPrefix(t("ms.age.between", { from, to })) : null;
    }
    case "average_onset":
    case "unstated":
    default:
      return null;
  }
}
