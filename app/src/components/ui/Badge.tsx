import React from "react";

type Tone = "amber" | "blue" | "green" | "red" | "neutral";

const tones: Record<Tone, string> = {
  amber: "bg-[var(--arbor-yellow-soft)] text-[var(--arbor-yellow-ink)] border-[var(--arbor-yellow-soft)]",
  blue: "bg-[var(--arbor-sky-soft)] text-[var(--arbor-sky-ink)] border-[var(--arbor-sky-soft)]",
  green: "bg-[var(--arbor-green-soft)] text-[var(--arbor-green-ink)] border-[var(--arbor-green-soft)]",
  red: "bg-[var(--arbor-pink-soft)] text-[var(--arbor-pink-ink)] border-[var(--arbor-pink-soft)]",
  neutral: "bg-[#f4f8f5] text-[#69747f] border-[rgba(41,51,63,0.08)]",
};

export function Badge({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export default Badge;
