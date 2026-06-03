import React from "react";

/**
 * "Sprout" — Arbor's mascot. A friendly seedling character (growth, gentle
 * guidance), used on the coach card and empty states. Deliberately a sprout,
 * not a robot: Arbor is about a child growing, not a chatbot.
 */
export function ArborMascot({ size = 120, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 140 140"
      fill="none"
      role="img"
      aria-label="Sprout, Arbor's guide"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* shadow */}
      <ellipse cx="70" cy="126" rx="34" ry="6" fill="#2a9c66" opacity="0.10" />

      {/* pot */}
      <path d="M48 96 H92 L86 124 Q85 128 81 128 H59 Q55 128 54 124 Z" fill="#f3a886" />
      <rect x="45" y="90" width="50" height="12" rx="6" fill="#ef8a52" />

      {/* stem */}
      <path d="M70 92 V58" stroke="#2a9c66" strokeWidth="5" strokeLinecap="round" />

      {/* lower side leaves (little arms) */}
      <path d="M70 78 C58 80 49 73 47 62 C59 60 69 67 70 78 Z" fill="#5fce97" />
      <path d="M70 72 C82 74 91 67 93 56 C81 54 71 61 70 72 Z" fill="#5fce97" />

      {/* sprout head — a rounded bud */}
      <path
        d="M70 60 C50 60 40 46 42 30 C44 16 56 8 70 8 C84 8 96 16 98 30 C100 46 90 60 70 60 Z"
        fill="#34b277"
      />
      {/* leaf crease on head */}
      <path d="M70 12 V52" stroke="#2a9c66" strokeWidth="2" strokeLinecap="round" opacity="0.5" />

      {/* face */}
      <circle cx="61" cy="34" r="3.4" fill="#16352a" />
      <circle cx="79" cy="34" r="3.4" fill="#16352a" />
      <circle cx="62.4" cy="32.8" r="1.1" fill="#fff" />
      <circle cx="80.4" cy="32.8" r="1.1" fill="#fff" />
      {/* cheeks */}
      <circle cx="54" cy="40" r="3.2" fill="#ffffff" opacity="0.30" />
      <circle cx="86" cy="40" r="3.2" fill="#ffffff" opacity="0.30" />
      {/* smile */}
      <path d="M64 42 Q70 47 76 42" stroke="#16352a" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export default ArborMascot;
