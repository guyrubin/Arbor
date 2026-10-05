/**
 * kidThemes.ts — unified kid theme registry (P2, data lift only).
 *
 * WHAT THIS IS
 * One registry describing every kid "theme": the ten HeroArcade worlds and the
 * five hero-journey packs. This wave is a PURE DATA LIFT — nothing consumes
 * this module yet. HeroArcade.tsx keeps its own WORLDS[] and heroJourneys.ts
 * keeps PACKS[]; rewiring them to read from here is the next wave. Divergence
 * between this registry and the live sources is locked down by
 * kidThemes.test.ts (ids, titles, and accents are cross-checked verbatim).
 *
 * FIREWALL INVARIANTS (kid register)
 * - Unlocks are DETERMINISTIC and EARNED-ONLY. The unlock type admits exactly
 *   two kinds: "default" (available from the start) and "pack-progress"
 *   (earned by completing stories in a pack). There is no random-drop kind,
 *   no paid kind, and no expiry field — by construction, not by convention.
 * - Accents come only from the existing --arbor token families (the same six
 *   families HeroArcade's COLOR map resolves to CSS custom properties).
 * - Hebrew: pack titles carry the live Hebrew from heroJourneys.PACKS. World
 *   titles and all blurbs stay EN placeholders until the GD-6 native
 *   transcreation gate clears (same discipline as the he kid.* dictionary
 *   block in lib/i18n.ts).
 * - `collectible` is false everywhere in this wave: collectibles arrive with
 *   the P4 parent-mediated share loop, never as loot.
 */
import type { HeroTemplate } from "./heroAvatarCanvas";
import type { HeroPackId } from "../types";
import { KID_WORLDS, type KidWorldAccent } from "../components/kidmode/kidWorlds";

/** The --arbor accent token families: the kid world registry's accents
 *  (B-KID-68) plus yellow, which only journey packs use. */
export type KidThemeAccent = KidWorldAccent | "yellow";

/** The kid surfaces a theme can belong to. */
export type KidThemeSurface = "journeys" | "arcade" | "feelings" | "studio";

/**
 * Deterministic, earned-only unlock. Exactly two kinds exist — adding a
 * random, purchase, or expiring kind is a type change that the cosmetics
 * firewall test rejects.
 */
export type KidThemeUnlock =
  | { kind: "default" }
  | { kind: "pack-progress"; packId: HeroPackId; threshold: number };

export interface KidTheme {
  /** Stable id — for worlds this is the HeroArcade world id, VERBATIM. */
  id: string;
  /** B-KID-68: a world names itself with the kid world registry's key (its
   *  ONE name; t() resolves EN + HE at render). Packs carry literal titles. */
  titleKey?: string;
  title?: string;
  /** Hebrew title (packs). */
  titleHe?: string;
  blurb: string;
  /** Hebrew blurb. EN placeholder until GD-6 clears. */
  blurbHe: string;
  /** --arbor token family, never a raw color. */
  accent: KidThemeAccent;
  /** Which share-card template composes this theme's backdrop. */
  backdropTemplate: HeroTemplate;
  /** Key into the scene pipeline (worlds: the live WorldScene key = world id). */
  scenePromptSlug: string;
  surface: KidThemeSurface;
  unlock: KidThemeUnlock;
  /** Collectible backdrop? False everywhere until the P4 share loop lands. */
  collectible: boolean;
}

/* ── Arcade world themes — B-KID-68: derived from the ONE kid world registry
   (components/kidmode/kidWorlds.ts): id, slot order, titleKey (the world's ONE
   name key, EN + HE — no EN placeholder in HE any more) and accent are the
   registry's; blurb is the arcade's tag line. Word World is
   parent-only (not a kid world) and keeps its own row. Every world is
   reachable today, so every unlock is "default". */
const WORLD_BLURB: Readonly<Record<string, string>> = {
  speech: "Speech", feelings: "Feelings", memory: "Memory", beat: "Rhythm", pose: "Move",
  pattern: "Logic", adventures: "Adventure", mimic: "Mimic", reading: "Reading",
};
const worldTheme = (id: string, titleKey: string, blurb: string, accent: KidThemeAccent): KidTheme => ({
  id, titleKey, blurb, blurbHe: blurb, accent, backdropTemplate: "practice_stamp", scenePromptSlug: id, surface: "arcade", unlock: { kind: "default" }, collectible: false,
});
const WORLD_THEMES: KidTheme[] = [
  ...KID_WORLDS.map((w) => worldTheme(w.worldId, w.doorNameKey, WORLD_BLURB[w.worldId] ?? "", w.accent)),
  worldTheme("word-world", "elev.practice.world.kid.words", "Language", "sky"),
];

/* ── Journey pack themes — lifted 1:1 from heroJourneys.ts PACKS[] ──────────
   id, title, titleHe, blurb are verbatim. All five packs are selectable today,
   so every unlock is "default" (zero behavior change; "pack-progress" is the
   earned kind reserved for the next wave). Accents are assigned here (packs
   carry no color today) from the same six token families. */
const PACK_THEMES: KidTheme[] = [
  { id: "courage", title: "Courage", titleHe: "אומץ", blurb: "Standing tall when you feel small.", blurbHe: "Standing tall when you feel small.", accent: "clay", backdropTemplate: "story", scenePromptSlug: "pack-courage", surface: "journeys", unlock: { kind: "default" }, collectible: false },
  { id: "responsibility", title: "Responsibility", titleHe: "אחריות", blurb: "Doing what needs to be done.", blurbHe: "Doing what needs to be done.", accent: "sky", backdropTemplate: "story", scenePromptSlug: "pack-responsibility", surface: "journeys", unlock: { kind: "default" }, collectible: false },
  { id: "growth", title: "Growth", titleHe: "צמיחה", blurb: "Becoming stronger through what's hard.", blurbHe: "Becoming stronger through what's hard.", accent: "yellow", backdropTemplate: "story", scenePromptSlug: "pack-growth", surface: "journeys", unlock: { kind: "default" }, collectible: false },
  { id: "wisdom", title: "Wisdom", titleHe: "חוכמה", blurb: "Choosing well, and choosing kind.", blurbHe: "Choosing well, and choosing kind.", accent: "lav", backdropTemplate: "story", scenePromptSlug: "pack-wisdom", surface: "journeys", unlock: { kind: "default" }, collectible: false },
  { id: "truth", title: "Truth", titleHe: "אמת", blurb: "Saying what's real, even when it's hard.", blurbHe: "Saying what's real, even when it's hard.", accent: "pink", backdropTemplate: "story", scenePromptSlug: "pack-truth", surface: "journeys", unlock: { kind: "default" }, collectible: false },
];

/** The unified registry: 10 arcade worlds + 5 journey packs. */
export const KID_THEMES: KidTheme[] = [...WORLD_THEMES, ...PACK_THEMES];

/** Lookup by id. Returns undefined for unknown ids — never throws. */
export function getKidTheme(id: string): KidTheme | undefined {
  return KID_THEMES.find((t) => t.id === id);
}
