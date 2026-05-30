import React from "react";

type Tone = "amber" | "blue" | "green" | "red" | "neutral";

const tones: Record<Tone, string> = {
  amber: "bg-[#d7aa55]/15 text-[#f4d991] border-[#d7aa55]/20",
  blue: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  green: "bg-green-500/15 text-green-400 border-green-500/20",
  red: "bg-red-500/10 text-red-500 border-red-500/20",
  neutral: "bg-white/5 text-[#a8a093] border-white/10",
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
