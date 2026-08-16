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

/** The six --arbor accent token families (see HeroArcade's COLOR map). */
export type KidThemeAccent = "sky" | "lav" | "pink" | "peach" | "yellow" | "clay";

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
  title: string;
  /** Hebrew title. EN placeholder for worlds until GD-6 clears. */
  titleHe: string;
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

/* ── Arcade world themes — lifted 1:1 from HeroArcade.tsx WORLDS[] ──────────
   id, title (= world name), accent (= world color) are verbatim; blurb is the
   world's tag line. Every world is reachable today, so every unlock is
   "default" (zero behavior change). */
const WORLD_THEMES: KidTheme[] = [
  { id: "speech", title: "Sound Lab", titleHe: "Sound Lab", blurb: "Speech", blurbHe: "Speech", accent: "sky", backdropTemplate: "practice_stamp", scenePromptSlug: "speech", surface: "arcade", unlock: { kind: "default" }, collectible: false },
  { id: "feelings", title: "Mood Mountain", titleHe: "Mood Mountain", blurb: "Feelings", blurbHe: "Feelings", accent: "lav", backdropTemplate: "practice_stamp", scenePromptSlug: "feelings", surface: "arcade", unlock: { kind: "default" }, collectible: false },
  { id: "adventures", title: "Story Quest", titleHe: "Story Quest", blurb: "Adventure", blurbHe: "Adventure", accent: "peach", backdropTemplate: "practice_stamp", scenePromptSlug: "adventures", surface: "arcade", unlock: { kind: "default" }, collectible: false },
  { id: "mimic", title: "Mimic Studio", titleHe: "Mimic Studio", blurb: "Mimic", blurbHe: "Mimic", accent: "clay", backdropTemplate: "practice_stamp", scenePromptSlug: "mimic", surface: "arcade", unlock: { kind: "default" }, collectible: false },
  { id: "memory", title: "Mind Vault", titleHe: "Mind Vault", blurb: "Memory", blurbHe: "Memory", accent: "pink", backdropTemplate: "practice_stamp", scenePromptSlug: "memory", surface: "arcade", unlock: { kind: "default" }, collectible: false },
  { id: "reading", title: "Spell Forge", titleHe: "Spell Forge", blurb: "Reading", blurbHe: "Reading", accent: "yellow", backdropTemplate: "practice_stamp", scenePromptSlug: "reading", surface: "arcade", unlock: { kind: "default" }, collectible: false },
  { id: "beat", title: "Beat Keeper", titleHe: "Beat Keeper", blurb: "Rhythm", blurbHe: "Rhythm", accent: "clay", backdropTemplate: "practice_stamp", scenePromptSlug: "beat", surface: "arcade", unlock: { kind: "default" }, collectible: false },
  { id: "pose", title: "Hero Pose", titleHe: "Hero Pose", blurb: "Move", blurbHe: "Move", accent: "sky", backdropTemplate: "practice_stamp", scenePromptSlug: "pose", surface: "arcade", unlock: { kind: "default" }, collectible: false },
  { id: "pattern", title: "Pattern Power", titleHe: "Pattern Power", blurb: "Logic", blurbHe: "Logic", accent: "lav", backdropTemplate: "practice_stamp", scenePromptSlug: "pattern", surface: "arcade", unlock: { kind: "default" }, collectible: false },
  { id: "word-world", title: "Word World", titleHe: "Word World", blurb: "Language", blurbHe: "Language", accent: "sky", backdropTemplate: "practice_stamp", scenePromptSlug: "word-world", surface: "arcade", unlock: { kind: "default" }, collectible: false },
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
