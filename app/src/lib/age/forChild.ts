/**
 * B-INF-10 — ONE age band per child drives every surface that chooses content.
 *
 * The canonical scheme is lib/domains/ageBands.ts (B-GROWTH-27: the CDC
 * checkpoints + two school-age bands). This module is the only place a
 * chooser asks "how old is this child?" and "does this content fit her?":
 *
 *   · `ageMonthsOf(child)`        — chronological months (the age a parent reads)
 *   · `comparisonMonthsOf(child)` — the months content is chosen by: corrected
 *                                   age under 24 months for a preterm baby (AAP)
 *   · `bandFor(child)`            — the canonical band of the comparison months
 *   · `fits(content, band)`       — does an item carrying `ageBands` (any legacy
 *                                   notation) overlap the band?
 *
 * No chooser does its own age arithmetic (lib/age/noLocalAgeMath.guard.test.ts
 * pins it). Switching child re-runs every chooser because every memo keys on
 * the child (id + band), never on the family.
 *
 * CLINICAL FIREWALL: a band is a catalogue fact about CONTENT, never a verdict
 * about the child. The only age statement a parent sees is the child's own age
 * (lib/age/format.ts); content is filtered by band silently.
 */
import type { ChildProfile } from "../../types";
import { ageMonthsFromProfile, correctedAgeMonths, type ChildAgeProfile } from "../childAge";
import {
  CANONICAL_BANDS,
  SCHEME_RANGES,
  fromMonths,
  type AgeScheme,
  type CanonicalBand,
  type CanonicalBandId,
} from "../domains/ageBands";

export type { CanonicalBand, CanonicalBandId } from "../domains/ageBands";

/** Anything with an age the helpers can read (a full profile or an export-minimal one). */
export type AgedChild = ChildAgeProfile & Partial<Pick<ChildProfile, "id" | "preterm">>;

/** Chronological months, or null when the profile carries no age at all. */
export function knownAgeMonthsOf(child: AgedChild | null | undefined, now?: Date): number | null {
  if (!child) return null;
  return ageMonthsFromProfile(child, now);
}

/** Chronological months (0 when the profile carries no age). */
export function ageMonthsOf(child: AgedChild | null | undefined, now?: Date): number {
  return knownAgeMonthsOf(child, now) ?? 0;
}

/** Whole years (floor of the months) — for the legacy year-keyed selectors. */
export function ageYearsOf(child: AgedChild | null | undefined, now?: Date): number {
  return Math.floor(ageMonthsOf(child, now) / 12);
}

/**
 * The months content is chosen by: corrected age while a preterm child is
 * under 24 months chronological (AAP), else chronological. Null = no age.
 */
export function comparisonMonthsOf(child: AgedChild | null | undefined, now?: Date): number | null {
  if (!child) return null;
  const chrono = ageMonthsFromProfile(child, now);
  if (chrono === null) return null;
  if (!child.preterm) return chrono;
  return correctedAgeMonths(child as ChildProfile, now) ?? chrono;
}

/** Months → the canonical band. */
export function bandForMonths(months: number): CanonicalBand {
  return fromMonths(months);
}

/** THE band for a child (corrected age under 2 if preterm). A child with no age reads as the first band. */
export function bandFor(child: AgedChild | null | undefined, now?: Date): CanonicalBand {
  return fromMonths(comparisonMonthsOf(child, now) ?? 0);
}

/** The memo key every per-child chooser keys on: child id + band (never the family). */
export function ageKeyOf(child: AgedChild | null | undefined, now?: Date): string {
  return `${child?.id ?? "-"}@${bandFor(child, now).id}`;
}

/** Coarse stage for the parent-led tables (Today starters, Practice "together" cards). */
export type AgeStage = "baby" | "toddler" | "preschool" | "school";
export function stageOfBand(band: CanonicalBand): AgeStage {
  if (band.minMonths < 12) return "baby";
  if (band.minMonths < 36) return "toddler";
  if (band.minMonths < 72) return "preschool";
  return "school";
}
export function stageFor(child: AgedChild | null | undefined, now?: Date): AgeStage {
  return stageOfBand(bandFor(child, now));
}

/** Under three years (the band, so a corrected preterm age counts). */
export function isUnderThree(child: AgedChild | null | undefined, now?: Date): boolean {
  return bandFor(child, now).maxMonths <= 36;
}

/* ── Notations ───────────────────────────────────────────────────────────────
   Content in the repo carries its age in six legacy notations. Each resolves
   to a half-open month range [min, max):
     1. canonical ids            "18m" · "60m" · "6-8y" · "9-12y"
     2. inclusive whole years    "2-5" · "6-9" · "10+"   (hard-moment cards)
     3. stage / knowledge ids    "12-18m" · "2-3y" · "12-36m" · "3-5y"
     4. play bands               "infant" · "toddler" · "preschool" · "early-school"
     5. milestone thresholds     "24" (months)
     6. any scheme, explicitly   "screening:1-2" · "milestone:24" · "play:toddler"
   The scheme tables are lib/domains/ageBands SCHEME_RANGES — no second copy. */

export type MonthRange = readonly [number, number];

const OPEN = Number.POSITIVE_INFINITY;
const SCHEMES = Object.keys(SCHEME_RANGES) as AgeScheme[];
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** One notation → its month range, or null when it cannot be read (never a guess). */
export function rangeOfNotation(raw: string): MonthRange | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  const scoped = /^([a-z]+):(.+)$/.exec(s);
  if (scoped) {
    const scheme = scoped[1] as AgeScheme;
    if (!SCHEMES.includes(scheme) || !has(SCHEME_RANGES[scheme], scoped[2])) return null;
    return SCHEME_RANGES[scheme][scoped[2]];
  }
  const canon = CANONICAL_BANDS.find((b) => b.id === s);
  if (canon) return [canon.minMonths, canon.maxMonths];
  if (/[a-z]/.test(s)) {
    for (const scheme of ["stage", "knowledge", "language", "play"] as const) {
      if (has(SCHEME_RANGES[scheme], s)) return SCHEME_RANGES[scheme][s];
    }
    return null;
  }
  const years = /^(\d{1,2})\s*[-–]\s*(\d{1,2})$/.exec(s);
  if (years && Number(years[1]) <= Number(years[2])) return [Number(years[1]) * 12, (Number(years[2]) + 1) * 12];
  const open = /^(\d{1,2})\+$/.exec(s);
  if (open) return [Number(open[1]) * 12, OPEN];
  if (/^\d{1,3}$/.test(s) && has(SCHEME_RANGES.milestone, s)) return SCHEME_RANGES.milestone[s];
  return null;
}

/** Content carries its age as `ageBands`; a bare list is accepted too. */
export type AgeTagged = { readonly ageBands?: readonly string[] | null } | readonly string[] | null | undefined;

function notationsOf(content: AgeTagged): readonly string[] {
  if (!content) return [];
  if (Array.isArray(content)) return content as readonly string[];
  return (content as { ageBands?: readonly string[] | null }).ageBands ?? [];
}

/** The ranges of every notation, or null when there are none or any is unreadable (fail-closed). */
export function rangesOf(content: AgeTagged): MonthRange[] | null {
  const list = notationsOf(content);
  if (!list.length) return null;
  const ranges = list.map(rangeOfNotation);
  return ranges.every(Boolean) ? (ranges as MonthRange[]) : null;
}

/**
 * Does this content fit the band? True when one of its ranges overlaps the
 * band. No bands, or an unreadable one → false (unknown never opts content in;
 * a caller that wants "unknown = shown" says so itself).
 */
export function fits(content: AgeTagged, band: CanonicalBand | CanonicalBandId): boolean {
  const b = typeof band === "string" ? CANONICAL_BANDS.find((x) => x.id === band) : band;
  if (!b) return false;
  const ranges = rangesOf(content);
  if (!ranges) return false;
  return ranges.some(([min, max]) => min < b.maxMonths && max > b.minMonths);
}

/** `fits` for a known months value (the band of those months). Unknown months → false. */
export function fitsMonths(content: AgeTagged, months: number | null | undefined): boolean {
  if (typeof months !== "number" || !Number.isFinite(months) || months < 0) return false;
  // Past the last canonical band (12 y+) fromMonths clamps to 9–12 y; a
  // teenager is not a 9-year-old, so content must contain the months itself.
  const last = CANONICAL_BANDS[CANONICAL_BANDS.length - 1];
  if (months >= last.maxMonths) {
    const ranges = rangesOf(content);
    return !!ranges && ranges.some(([min, max]) => months >= min && months < max);
  }
  return fits(content, fromMonths(months));
}

/** `fits` for a child (her band). */
export function fitsChild(content: AgeTagged, child: AgedChild | null | undefined, now?: Date): boolean {
  return fits(content, bandFor(child, now));
}

/**
 * `fits` for a legacy whole-years age against inclusive whole-year bounds
 * (LearnCard `ageMin`/`ageMax`). A year-keyed age is only known to the year,
 * so the child's span is that whole year [Y·12, Y·12+12) — read through the
 * same notation table as `fits` (a school-age canonical band spans three
 * years and would widen a year window). `slackYears` widens the content
 * window (a ranking's "near" ring). Null age → false.
 */
export function fitsYears(ageYears: number | null | undefined, minYears: number, maxYears: number, slackYears = 0): boolean {
  if (typeof ageYears !== "number" || !Number.isFinite(ageYears)) return false;
  const ranges = rangesOf([yearsNotation(Math.max(0, minYears - slackYears), maxYears + slackYears)]);
  if (!ranges) return false;
  const from = Math.max(0, Math.floor(ageYears)) * 12;
  return ranges.some(([min, max]) => min < from + 12 && max > from);
}

/** Inclusive whole-year bounds (LearnCard `ageMin`/`ageMax`, story `ageRange`) as a notation. */
export function yearsNotation(minYears: number, maxYears?: number | null): string {
  return typeof maxYears === "number" && Number.isFinite(maxYears) ? `${minYears}-${maxYears}` : `${minYears}+`;
}
