/** Pure helpers shared across the behavior/overview/pattern views. */

/** Map an intensity (1-5) to the sage → clay scale. */
export function intensityColor(intensity: number): string {
  if (intensity <= 1) return "#6f9e6f";
  if (intensity <= 2) return "#9bbf5a";
  if (intensity <= 3) return "#d7aa55";
  if (intensity <= 4) return "#e08a3c";
  return "#e2562d";
}

export type TimeBand = "Morning" | "Afternoon" | "Evening" | "Night";

/** Bucket an hour (0-23) into a part of day; 21:00–05:00 is Night. */
export function timeBand(hour: number): TimeBand {
  const h = hour < 5 ? hour + 24 : hour;
  if (h >= 5 && h < 12) return "Morning";
  if (h >= 12 && h < 17) return "Afternoon";
  if (h >= 17 && h < 21) return "Evening";
  return "Night";
}

/**
 * ISO date (YYYY-MM-DD) of the Monday that starts the week containing `iso`.
 * Computed in UTC so grouping is deterministic regardless of the runner's
 * timezone (the previous local-time version drifted across day boundaries).
 */
export function weekStartKey(iso: string): string {
  const d = new Date(iso);
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (utc.getUTCDay() + 6) % 7; // Monday = 0
  utc.setUTCDate(utc.getUTCDate() - dow);
  return utc.toISOString().slice(0, 10);
}

/** Escape a string for safe inclusion in generated HTML (e.g. PDF export). */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}
