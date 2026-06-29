import React from "react";
import { Avatar } from "./Avatar";

/**
 * EmotionAvatar (A4) — the child's avatar wearing a feeling: their photo/initials
 * with an expression badge and a soft aura in the emotion's colour. Pure
 * composition over <Avatar> (no per-emotion image generation), so the child's own
 * character can mirror the feeling being explored in the Feelings Lab.
 */
export function EmotionAvatar({
  name,
  photoURL,
  emotionEmoji,
  emotionLabel,
  color = "var(--arbor-clay)",
  size = 72,
}: {
  name?: string | null;
  photoURL?: string | null;
  emotionEmoji?: string;
  emotionLabel?: string;
  color?: string;
  size?: number;
}) {
  const badge = Math.round(size * 0.42);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <span
          className="absolute inset-0 rounded-full transition-all"
          style={{ boxShadow: `0 0 0 3px ${color}`, opacity: emotionEmoji ? 0.55 : 0.25 }}
          aria-hidden="true"
        />
        <Avatar name={name} photoURL={photoURL} size={size} />
        {emotionEmoji && (
          <span
            className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center bg-white"
            style={{ width: badge, height: badge, fontSize: Math.round(size * 0.26), boxShadow: "0 2px 8px rgba(41,51,63,0.18)" }}
            aria-hidden="true"
          >
            {emotionEmoji}
          </span>
        )}
      </div>
      {emotionLabel && <span className="text-[11px] font-extrabold" style={{ color }}>{emotionLabel}</span>}
    </div>
  );
}

export default EmotionAvatar;
