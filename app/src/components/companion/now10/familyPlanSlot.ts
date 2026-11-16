/**
 * Coming up's Family plan slot. The Family plan (its dates, who has each one)
 * is built in parallel by another slice; until it is wired, this hook is the
 * one named seam Now reads, and it returns nothing, so no line is drawn.
 *
 * WIRING (at merge): return the next dated things from `useFamilyPlanDates`,
 * each with its own `onOpen` (to #/family-plan). Words for "nobody yet" are
 * NOW_V10_COPY.familyPlanNobody.
 */
export interface FamilyPlanDateLine {
  id: string;
  /** The date tile: short weekday and the day of the month. */
  weekday: string;
  day: number;
  /** Nobody has this date yet: the tile is dashed. */
  nobody: boolean;
  title: string;
  sub?: string;
  /** Marked New since the parent last looked. */
  isNew?: boolean;
  onOpen: () => void;
}

export function useFamilyPlanDatesForNow(): FamilyPlanDateLine[] {
  return [];
}
