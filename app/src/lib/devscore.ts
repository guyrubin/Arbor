/* Small view-side helpers for the Longitudinal Development Score (PRD C4).
   Kept out of growth/devScore.ts so that module stays pure + dependency-free. */

/** ISO-8601 week key for a timestamp, e.g. "2026-W24". Used as the per-week
 *  snapshot id so weekly writes are idempotent (no duplicate moat artifacts). */
export function isoWeekKey(ms: number): string {
  const d = new Date(ms);
  // Shift to Thursday of the current week (ISO weeks belong to the year of their Thursday).
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7; // Mon=1 … Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** True when the OS requests reduced motion. Safe in non-browser/test envs. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
