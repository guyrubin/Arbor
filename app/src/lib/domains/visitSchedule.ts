/**
 * B-GROWTH-27 — the routine child-health visit schedules, as DATA ONLY
 * (spine §2: "the Tipat Halav and JGZ visit schedules overlaid so 'before your
 * next visit' is a real date").
 *
 * GATE (content row, B-GROWTH-27 "Tipat Halav/JGZ visit overlay data =
 * content"): these ages are a first draft from the public schedules and are
 * marked `reviewed: false`. Nothing renders them until a content reviewer
 * signs the table and flips the flag; no surface may print a visit date from
 * an unreviewed schedule.
 *
 * Ages are in months from birth (corrected age is the caller's job).
 */
import { fromMonths, type CanonicalBandId } from "./ageBands";

export type VisitProgramme = "il-tipat-halav" | "nl-jgz";

export interface VisitSchedule {
  programme: VisitProgramme;
  /** ISO country the programme runs in. */
  country: "IL" | "NL";
  /** Routine visit ages, months from birth, ascending. */
  visitAgesMonths: readonly number[];
  /** false until a content reviewer signs the table (see GATE above). */
  reviewed: boolean;
}

export const VISIT_SCHEDULES: Record<VisitProgramme, VisitSchedule> = {
  "il-tipat-halav": {
    programme: "il-tipat-halav",
    country: "IL",
    visitAgesMonths: [1, 2, 4, 6, 9, 12, 18, 36],
    reviewed: false,
  },
  "nl-jgz": {
    programme: "nl-jgz",
    country: "NL",
    visitAgesMonths: [1, 2, 3, 4, 6, 9, 11, 14, 18, 24, 36, 45, 66, 120],
    reviewed: false,
  },
};

/** The next routine visit age strictly after `ageMonths`, or null past the last. */
export function nextVisitMonths(programme: VisitProgramme, ageMonths: number): number | null {
  const s = VISIT_SCHEDULES[programme];
  return s.visitAgesMonths.find((m) => m > ageMonths) ?? null;
}

/** Each visit age → its canonical band (the overlay join). */
export function visitBands(programme: VisitProgramme): { months: number; band: CanonicalBandId }[] {
  return VISIT_SCHEDULES[programme].visitAgesMonths.map((months) => ({ months, band: fromMonths(months).id }));
}
