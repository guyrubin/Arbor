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
  // Resolution order: prefer the generated stylized comic hero, then any uploaded
  // photo. `avatar` is metadata; `comicAvatarUrl` (when present) is the AI-generated
  // privacy-safe hero. Return shape is unchanged so existing consumers keep working.
  const url = (childProfile as { comicAvatarUrl?: string }).comicAvatarUrl || childProfile.photoUrl || null;
  // `isGenerated` = a stylized, privacy-safe hero (descriptor) — safe to embed in
  // shareable/clinical documents; a real `photo` avatar is never auto-embedded.
  const isGenerated = childProfile.avatar?.source === "descriptor";
  return { url, isGenerated, hasHero: !!url, name: childProfile.name?.split(" ")[0] || "your child" };
}

export function HeroAvatar({
  size = 84,
  mood = "wave",
  animate = true,
  ring = true,
  decorative = false,
  className = "",
}: {
  size?: number;
  mood?: MascotMood;
  animate?: boolean;
  ring?: boolean;
  /** When true the portrait is purely decorative (the child's name is already
   *  adjacent) — `alt=""` + `aria-hidden` so screen readers don't double-announce. */
  decorative?: boolean;
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
            ? "conic-gradient(from 210deg, var(--arbor-primary), var(--arbor-sky), var(--arbor-lav), var(--arbor-peach), var(--arbor-primary))"
            : "transparent",
          boxShadow: ring ? "0 6px 18px rgba(41,51,63,0.18)" : "none",
        }}
      >
        <img
          src={url}
          alt={decorative ? "" : `${name}, the hero`}
          aria-hidden={decorative || undefined}
          referrerPolicy="no-referrer"
          className="w-full h-full rounded-full object-cover"
          style={{ background: "#fff" }}
        />
      </div>
      {/* Little hero star badge. */}
      <span
        className="absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full text-white"
        style={{ width: badge, height: badge, background: "var(--arbor-primary)", boxShadow: "0 2px 6px rgba(41,51,63,0.25)", fontSize: badge * 0.6 }}
        aria-hidden="true"
      >
        ★
      </span>
    </div>
  );
}

export default HeroAvatar;
