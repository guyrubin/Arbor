import type { Observation } from "../../../lib/observations";
import { PARENT_SOURCES } from "../../../lib/weekGlance";

/**
 * The day arc (Objects-Graphic › Day arc): today from 06:00 to 21:00 drawn as
 * an arc. It carries ONLY real things (N-Now brief): the clock now, the
 * evening band when the family's own moments fall in it, and the quiet hours
 * the parent set on Gentle reminders. No invented clock times, no events.
 * Pure: geometry and one count, no React.
 */

export const ARC_START_HOUR = 6;
export const ARC_END_HOUR = 21;
const ARC_MINUTES = (ARC_END_HOUR - ARC_START_HOUR) * 60;
/** The evening band's window and the four weeks its count reads. */
/** lib/timeOfDay EVENING_START_HOUR (the evening door), pinned equal by dayArcModel.test. */
export const EVENING_FROM_HOUR = 18;
export const EVENING_TO_HOUR = ARC_END_HOUR;
const EVENING_WINDOW_DAYS = 28;

export interface ArcGeometry { w: number; h: number; cx: number; cy: number; rx: number; ry: number }

/** The two board sizes: the stage (desktop) and the phone scene. */
export const ARC_DESK: ArcGeometry = { w: 735, h: 436, cx: 360, cy: 400, rx: 280, ry: 336 };
export const ARC_PHONE: ArcGeometry = { w: 342, h: 214, cx: 171, cy: 190, rx: 138, ry: 146 };

/** Where a minute of the day sits along the arc, 0 (06:00) to 1 (21:00), clamped. */
export function arcFraction(minuteOfDay: number): number {
  return Math.min(1, Math.max(0, (minuteOfDay - ARC_START_HOUR * 60) / ARC_MINUTES));
}

export function arcPoint(g: ArcGeometry, f: number): { x: number; y: number } {
  return { x: g.cx - g.rx * Math.cos(Math.PI * f), y: g.cy - g.ry * Math.sin(Math.PI * f) };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** The SVG path of the arc between two fractions (left to right over the top). */
export function arcPath(g: ArcGeometry, f0: number, f1: number): string {
  const a = arcPoint(g, f0);
  const b = arcPoint(g, f1);
  return `M${r1(a.x)} ${r1(a.y)} A${g.rx} ${g.ry} 0 0 1 ${r1(b.x)} ${r1(b.y)}`;
}

/** The quiet-hours stretches that fall on the arc: the morning before quietEnd, the evening after quietStart. */
export function quietSegments(quietStart: number, quietEnd: number): Array<{ from: number; to: number; edge: "start" | "end" }> {
  const out: Array<{ from: number; to: number; edge: "start" | "end" }> = [];
  // A window that wraps midnight (21 → 8) covers the arc's morning up to quietEnd and its evening from quietStart.
  const wraps = quietStart > quietEnd;
  if (wraps || quietStart <= ARC_START_HOUR) {
    if (quietEnd > ARC_START_HOUR) out.push({ from: 0, to: arcFraction(Math.min(quietEnd, ARC_END_HOUR) * 60), edge: "start" });
  }
  if (wraps || quietEnd >= ARC_END_HOUR) {
    if (quietStart < ARC_END_HOUR) out.push({ from: arcFraction(Math.max(quietStart, ARC_START_HOUR) * 60), to: 1, edge: "end" });
  }
  return out.filter((s) => s.to > s.from);
}

/**
 * The evening band's count: of the parent's own moments in the last four
 * weeks (the same "moment" Weekly report counts: written, said or confirmed
 * by the parent), how many fell between 18:00 and 21:00. A count of what the
 * parent recorded, never a judgement of the child or the evening.
 */
export function eveningMoments(observations: readonly Observation[], now: Date): { inBand: number; total: number } {
  const since = now.getTime() - EVENING_WINDOW_DAYS * 86_400_000;
  let total = 0;
  let inBand = 0;
  for (const item of observations) {
    if (item.kind !== "moment" || !PARENT_SOURCES.has(item.source)) continue;
    const at = Date.parse(item.at);
    if (!Number.isFinite(at) || at < since || at > now.getTime()) continue;
    total += 1;
    const hour = new Date(at).getHours();
    if (hour >= EVENING_FROM_HOUR && hour < EVENING_TO_HOUR) inBand += 1;
  }
  return { inBand, total };
}

/** "17:40": the 24-hour clock the arc labels use in both languages. */
export function clock24(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60) % 24;
  const m = minuteOfDay % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
