import React from "react";

/** Tiny inline SVG sparkline for a numeric series. */
export function Sparkline({
  data,
  width = 96,
  height = 24,
  color = "var(--arbor-clay)",
  max = 5,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  max?: number;
}) {
  if (data.length === 0) {
    return <svg width={width} height={height} aria-hidden="true" />;
  }
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const points = data
    .map((v, i) => {
      const x = i * step;
      const y = height - (Math.max(0, Math.min(max, v)) / max) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} aria-hidden="true" className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default Sparkline;
