import React from "react";
import { DOMAIN_META } from "../../practice/content";
import type { DomainBand } from "../../practice/signals";

/**
 * Hand-rolled SVG radar of the five development domains (Epic 1 "visual
 * dashboard"). Self-contained — no chart dependency. Each axis is one domain's
 * 0–100 signal; the filled polygon is the child's current picture.
 */
export default function DomainRadar({ bands, size = 240 }: { bands: DomainBand[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 34;
  const n = bands.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (i: number, radius: number) => ({
    x: cx + radius * Math.cos(angle(i)),
    y: cy + radius * Math.sin(angle(i)),
  });

  const rings = [0.25, 0.5, 0.75, 1];
  const polygon = (radiusFor: (i: number) => number) =>
    bands.map((_, i) => { const p = point(i, radiusFor(i)); return `${p.x},${p.y}`; }).join(" ");

  const dataPolygon = polygon((i) => (Math.max(0, Math.min(100, bands[i].signal)) / 100) * r);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Domain radar">
      {/* grid rings */}
      {rings.map((ring, ri) => (
        <polygon key={ri} points={polygon(() => r * ring)} fill="none" stroke="rgba(41,51,63,0.10)" strokeWidth={1} />
      ))}
      {/* spokes */}
      {bands.map((_, i) => {
        const p = point(i, r);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(41,51,63,0.10)" strokeWidth={1} />;
      })}
      {/* data polygon */}
      <polygon points={dataPolygon} fill="rgba(52,178,119,0.22)" stroke="#34b277" strokeWidth={2} />
      {/* data points */}
      {bands.map((b, i) => {
        const p = point(i, (Math.max(0, Math.min(100, b.signal)) / 100) * r);
        return <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={DOMAIN_META[b.domain].color} />;
      })}
      {/* axis labels */}
      {bands.map((b, i) => {
        const p = point(i, r + 16);
        return (
          <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
            style={{ fontSize: 9, fontWeight: 700, fill: DOMAIN_META[b.domain].color }}>
            {DOMAIN_META[b.domain].label.split(" ")[0]}
          </text>
        );
      })}
    </svg>
  );
}
