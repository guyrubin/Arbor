/**
 * Physical growth entries — append-only longitudinal record (C4).
 *
 * Each entry is a parent-logged measurement at a point in time: height,
 * weight, and/or head circumference. At least one measurement is required.
 * All three are optional so parents can log whatever their pediatrician
 * measured that day.
 *
 * Stance:
 *  - NO percentile computation. We do not embed a WHO/CDC reference table
 *    here, so we show only the raw longitudinal trajectory and invite the
 *    parent to discuss it with their pediatrician. Fabricating reference
 *    curves would be worse than showing none.
 *  - Non-diagnostic: the trajectory is context for a conversation, not
 *    a clinical verdict. Framing is always parent-facing and non-alarming.
 *  - Parent-controlled data about their own child. No new consent surface —
 *    this is parent-initiated optional logging, equivalent to a notebook.
 */

export interface GrowthEntry {
  /** UUID — callers use `crypto.randomUUID()` or a uuid library. */
  id: string;
  childId: string;
  /** ISO-8601 date the measurement was taken, e.g. "2026-06-21". */
  date: string;
  heightCm?: number;
  weightKg?: number;
  headCircumferenceCm?: number;
  /** Optional free-text note (e.g. "at 18-month check-up"). */
  note?: string;
}

/** Validation: at least one numeric measurement must be present and positive. */
export function isValidEntry(
  e: Pick<GrowthEntry, "heightCm" | "weightKg" | "headCircumferenceCm">
): boolean {
  const pos = (v: number | undefined): boolean =>
    typeof v === "number" && v > 0 && Number.isFinite(v);
  return pos(e.heightCm) || pos(e.weightKg) || pos(e.headCircumferenceCm);
}

/**
 * Sort entries chronologically ascending (oldest first).
 * The store is append-only — ordering is a view concern, not a store concern.
 */
export function sortEntriesAsc(entries: GrowthEntry[]): GrowthEntry[] {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Return the most-recently-dated entry, or null when the list is empty.
 * When two entries share the same date, the one inserted later (higher in the
 * original array, since upsert prepends) is preferred.
 */
export function latestEntry(entries: GrowthEntry[]): GrowthEntry | null {
  if (entries.length === 0) return null;
  return [...entries].sort((a, b) => b.date.localeCompare(a.date))[0];
}

/**
 * Extract the height trajectory as (date, cm) pairs for SVG charting.
 * Returns entries sorted ascending; entries without a heightCm are excluded.
 */
export function heightTrajectory(
  entries: GrowthEntry[]
): { date: string; value: number }[] {
  return sortEntriesAsc(entries)
    .filter((e): e is GrowthEntry & { heightCm: number } => typeof e.heightCm === "number")
    .map((e) => ({ date: e.date, value: e.heightCm }));
}

/**
 * Extract the weight trajectory as (date, kg) pairs for SVG charting.
 */
export function weightTrajectory(
  entries: GrowthEntry[]
): { date: string; value: number }[] {
  return sortEntriesAsc(entries)
    .filter((e): e is GrowthEntry & { weightKg: number } => typeof e.weightKg === "number")
    .map((e) => ({ date: e.date, value: e.weightKg }));
}
