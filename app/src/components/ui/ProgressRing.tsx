import React from "react";

/** SVG progress ring. `value` is 0-100. */
export function ProgressRing({
  value,
  size = 56,
  stroke = 6,
  className = "",
  trackColor = "rgba(41,51,63,0.08)",
  color = "var(--arbor-primary)",
  animate = true,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
  trackColor?: string;
  color?: string;
  /** Sweep the ring to its value (default). Pass false to snap (e.g. reduced motion). */
  animate?: boolean;
  children?: React.ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={animate ? "transition-[stroke-dashoffset] duration-700 ease-out" : ""}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}

export default ProgressRing;
