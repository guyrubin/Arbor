import React from "react";
import { useArbor } from "../../context/ArborContext";
import { ArborMascot, type MascotMood } from "./ArborMascot";

/**
 * HeroAvatar — the child rendered as the hero of the platform, the SAME identity
 * everywhere (Practice, Academy, Today, stories). One avatar, generated once
 * (see AvatarCreator → /api/generate-avatar), surfaced cross-domain here.
 *
 * Reads the active child from context so any call site shows the right hero with
 * no prop threading. When the child has no generated avatar yet, it falls back
 * to Sprout (the mascot) so the surface is never empty — and `hasHero` lets the
 * caller offer a "Create {name}'s hero" affordance.
 */
export function useHeroAvatar() {
  const { childProfile } = useArbor();
  // The generated/uploaded avatar image lives in `photoUrl`; `avatar` is metadata.
  const url = childProfile.photoUrl || null;
  const isGenerated = childProfile.avatar?.source != null;
  return { url, isGenerated, hasHero: !!url, name: childProfile.name?.split(" ")[0] || "your child" };
}

export function HeroAvatar({
  size = 84,
  mood = "wave",
  animate = true,
  ring = true,
  className = "",
}: {
  size?: number;
  mood?: MascotMood;
  animate?: boolean;
  ring?: boolean;
  className?: string;
}) {
  const { url, name } = useHeroAvatar();

  // No generated hero yet → Sprout keeps the surface warm.
  if (!url) {
    return <ArborMascot size={size} mood={mood} animate={animate} className={className} />;
  }

  const badge = Math.max(16, Math.round(size * 0.3));
  return (
    <div className={`relative flex-shrink-0 ${animate ? "sprout-bob" : ""} ${className}`} style={{ width: size, height: size }}>
      {/* Comic-hero frame: bold gradient ring around the child's character. */}
      <div
        className="rounded-full p-[3px]"
        style={{
          width: size,
          height: size,
          background: ring
            ? "conic-gradient(from 210deg, var(--arbor-clay), var(--arbor-sky), var(--arbor-lav), var(--arbor-peach), var(--arbor-clay))"
            : "transparent",
          boxShadow: ring ? "0 6px 18px rgba(41,51,63,0.18)" : "none",
        }}
      >
        <img
          src={url}
          alt={`${name}, the hero`}
          referrerPolicy="no-referrer"
          className="w-full h-full rounded-full object-cover"
          style={{ background: "#fff" }}
        />
      </div>
      {/* Little hero star badge. */}
      <span
        className="absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full text-white"
        style={{ width: badge, height: badge, background: "var(--arbor-clay)", boxShadow: "0 2px 6px rgba(41,51,63,0.25)", fontSize: badge * 0.6 }}
        aria-hidden="true"
      >
        ★
      </span>
    </div>
  );
}

export default HeroAvatar;
