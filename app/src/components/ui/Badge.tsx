import React from "react";

type Tone = "amber" | "blue" | "green" | "red" | "neutral";

const tones: Record<Tone, string> = {
  amber: "bg-[#fbf1d4] text-[#a9780f] border-[#fbf1d4]",
  blue: "bg-[#e5f0fb] text-[#2f7bbf] border-[#e5f0fb]",
  green: "bg-[#e4f4ec] text-[#1f8a5a] border-[#e4f4ec]",
  red: "bg-[#fce2ec] text-[#bd4f74] border-[#fce2ec]",
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
