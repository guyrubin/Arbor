import { MISSION_CYCLE, type MissionTemplate } from "./content";

/**
 * Day position in the 5-day mission cycle, anchored to the calendar date so the
 * whole family — and every Arbor surface (Today + Missions tab) — sees the same
 * mission. Pure and deterministic for a given ISO date (YYYY-MM-DD).
 */
export function cycleDayFor(dateISO: string): number {
  const d = new Date(`${dateISO}T12:00:00`);
  const start = new Date(d.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((d.getTime() - start.getTime()) / 86_400_000);
  return ((dayOfYear % MISSION_CYCLE.length) + MISSION_CYCLE.length) % MISSION_CYCLE.length;
}

/** The single current mission for the given calendar date. */
export function todaysMissionFor(dateISO: string): MissionTemplate {
  return MISSION_CYCLE[cycleDayFor(dateISO)];
}
