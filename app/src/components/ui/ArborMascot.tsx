import React from "react";

export type MascotMood = "happy" | "cheer" | "think" | "proud" | "wave" | "calm";

/**
 * "Sprout" — Arbor's mascot. A friendly seedling character (growth, gentle
 * guidance). Default mood is the calm smile used on coach cards and empty
 * states. The extra moods (cheer / proud / think / wave / calm) power the
 * child-facing Practice Studio: Sprout reacts to wins, retries, and thinking.
 *
 * Deliberately a sprout, not a robot: Arbor is about a child growing, not a
 * chatbot. The `animate` flag adds a gentle, reduced-motion-aware idle bob
 * (see `.arbor-play` keyframes in index.css).
 */
export function ArborMascot({
  size = 120,
  mood = "happy",
  animate = false,
  className = "",
}: {
  size?: number;
  mood?: MascotMood;
  animate?: boolean;
  className?: string;
}) {
  // Eyes: most moods share the round eyes; "proud" closes them into happy arcs.
  const eyesClosed = mood === "proud";
  // Mouth path per mood.
  const mouth =
    mood === "cheer"
      ? null // open "O" mouth rendered as an ellipse below
      : mood === "think"
        ? "M65 43 Q70 45 75 43" // small, slightly pursed
        : mood === "proud"
          ? "M62 41 Q70 50 78 41" // big grin
          : "M64 42 Q70 47 76 42"; // gentle smile (happy/wave/calm)

  // Eye vertical offset for "think" (looking up).
  const eyeY = mood === "think" ? 32 : 34;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 140 140"
      fill="none"
      role="img"
      aria-label="Sprout, Arbor's guide"
      className={`${animate ? "sprout-bob" : ""} ${className}`.trim()}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* shadow */}
      <ellipse cx="70" cy="126" rx="34" ry="6" fill="var(--arbor-clay-deep)" opacity="0.10" />

      {/* pot */}
      <path d="M48 96 H92 L86 124 Q85 128 81 128 H59 Q55 128 54 124 Z" fill="#f3a886" />
      <rect x="45" y="90" width="50" height="12" rx="6" fill="#ef8a52" />

      {/* stem */}
      <path d="M70 92 V58" stroke="var(--arbor-clay-deep)" strokeWidth="5" strokeLinecap="round" />

      {/* side leaves (little arms) — raised on cheer/wave */}
      {mood === "cheer" ? (
        <>
          <path d="M70 74 C58 70 51 58 51 46 C63 47 71 58 70 74 Z" fill="#5fce97" />
          <path d="M70 74 C82 70 89 58 89 46 C77 47 69 58 70 74 Z" fill="#5fce97" />
        </>
      ) : mood === "wave" ? (
        <>
          <path d="M70 78 C58 80 49 73 47 62 C59 60 69 67 70 78 Z" fill="#5fce97" />
          <path d="M70 72 C83 70 91 60 92 48 C80 48 70 58 70 72 Z" fill="#5fce97" />
        </>
      ) : (
        <>
          <path d="M70 78 C58 80 49 73 47 62 C59 60 69 67 70 78 Z" fill="#5fce97" />
          <path d="M70 72 C82 74 91 67 93 56 C81 54 71 61 70 72 Z" fill="#5fce97" />
        </>
      )}

      {/* sprout head — a rounded bud */}
      <path
        d="M70 60 C50 60 40 46 42 30 C44 16 56 8 70 8 C84 8 96 16 98 30 C100 46 90 60 70 60 Z"
        fill="var(--arbor-clay)"
      />
      {/* leaf crease on head */}
      <path d="M70 12 V52" stroke="var(--arbor-clay-deep)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />

      {/* face — eyes */}
      {eyesClosed ? (
        <>
          <path d="M56 34 Q61 30 66 34" stroke="#16352a" strokeWidth="2.6" strokeLinecap="round" fill="none" />
          <path d="M74 34 Q79 30 84 34" stroke="#16352a" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <circle cx="61" cy={eyeY} r="3.4" fill="#16352a" />
          <circle cx="79" cy={eyeY} r="3.4" fill="#16352a" />
          <circle cx="62.4" cy={eyeY - 1.2} r="1.1" fill="#fff" />
          <circle cx="80.4" cy={eyeY - 1.2} r="1.1" fill="#fff" />
        </>
      )}
      {/* cheeks */}
      <circle cx="54" cy="40" r="3.2" fill="#ffffff" opacity="0.30" />
      <circle cx="86" cy="40" r="3.2" fill="#ffffff" opacity="0.30" />

      {/* mouth */}
      {mouth ? (
        <path d={mouth} stroke="#16352a" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      ) : (
        <ellipse cx="70" cy="44" rx="4.2" ry="5" fill="#16352a" />
      )}

      {/* sparkle for celebratory moods */}
      {(mood === "cheer" || mood === "proud") && (
        <g className={animate ? "sprout-sparkle" : ""}>
          <path d="M104 24 l2.2 5.4 5.4 2.2 -5.4 2.2 -2.2 5.4 -2.2 -5.4 -5.4 -2.2 5.4 -2.2 Z" fill="var(--arbor-yellow)" />
        </g>
      )}
    </svg>
  );
}

export default ArborMascot;
