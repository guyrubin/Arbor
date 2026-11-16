import React from "react";

/**
 * The road under a plan (Objects-Graphic "trail"): a smooth curve through the
 * stops, drawn in stretches (one per phase, alternating tone). The stops
 * themselves are positioned by the caller with the same percentages, so a
 * token always sits on the road. Pure geometry; decorative SVG (the stops
 * carry the words).
 */

export type RoadPoint = { x: number; y: number };

/** Evenly spaced stops on a gentle wave, as percentages of the box. */
export function wavePoints(n: number, opts: { padX?: number; mid?: number; amp?: number; freq?: number } = {}): RoadPoint[] {
  const { padX = 4.7, mid = 54, amp = 22, freq = 1.15 } = opts;
  if (n <= 0) return [];
  if (n === 1) return [{ x: 50, y: mid }];
  return Array.from({ length: n }, (_, i) => ({
    x: padX + (i * (100 - 2 * padX)) / (n - 1),
    y: mid + amp * Math.cos(i * freq),
  }));
}

/** Alternating stops (low, high, low…), the journey road's shape. */
export function zigzagPoints(n: number, opts: { padX?: number; low?: number; high?: number } = {}): RoadPoint[] {
  const { padX = 4, low = 80, high = 20 } = opts;
  if (n <= 1) return [{ x: 50, y: low }];
  return Array.from({ length: n }, (_, i) => ({ x: padX + (i * (100 - 2 * padX)) / (n - 1), y: i % 2 === 0 ? low : high }));
}

/** Mirror stops for a right-to-left reader: the road starts at the reading start. */
export const mirrorPoints = (pts: RoadPoint[], rtl: boolean): RoadPoint[] => (rtl ? pts.map((p) => ({ x: 100 - p.x, y: p.y })) : pts);

/** Catmull-Rom → cubic Bézier between consecutive points, in viewBox units. */
function segment(pts: RoadPoint[], i: number): string {
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(pts.length - 1, i + 2)];
  const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
  const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
  const f = (n: number) => Math.round(n * 10) / 10;
  return `C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`;
}

/**
 * The road SVG. `stretches` lists, per stretch, the index of its first stop;
 * a stretch runs to the next stretch's first stop (the last one to the end).
 */
export function Road({ points, stretches = [0], width, height, strokeWidth = 26 }: { points: RoadPoint[]; stretches?: number[]; width: number; height: number; strokeWidth?: number }) {
  if (points.length < 2) return <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false" />;
  const pts = points.map((p) => ({ x: (p.x / 100) * width, y: (p.y / 100) * height }));
  const starts = [...new Set(stretches.filter((s) => s >= 0 && s < pts.length - 1))].sort((a, b) => a - b);
  if (!starts.length || starts[0] !== 0) starts.unshift(0);
  const paths = starts.map((from, k) => {
    const to = k + 1 < starts.length ? starts[k + 1] : pts.length - 1;
    let d = `M${Math.round(pts[from].x * 10) / 10} ${Math.round(pts[from].y * 10) / 10}`;
    for (let i = from; i < to; i++) d += ` ${segment(pts, i)}`;
    return { d, b: k % 2 === 1 };
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
      {paths.map((p, i) => (
        <path key={i} className={p.b ? "g-road b" : "g-road"} d={p.d} style={{ strokeWidth }} />
      ))}
    </svg>
  );
}
