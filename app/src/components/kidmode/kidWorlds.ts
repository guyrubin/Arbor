/**
 * kidWorlds — B-KID-68 (lane-A KA-16): ONE registry of the kid worlds.
 *
 * Every kid world, in home slot order, with: the home tile id, the arcade /
 * routing id (`worldId`, also the art key `world.<worldId>.tile` in
 * kidThemeManifest), the kid name + sub keys (ONE name per world, EN + HE),
 * the parent door's name key for the same world (same value, parent
 * dictionary — law 2 keeps kid.* keys out of parent files), the accent, and
 * the unit the parent tile counts. Consumers read this module instead of
 * keeping their own map (the home grid, the in-world title, the parent
 * Practice door's kid name, the greeting). Pure data, no React.
 *
 * Presentation that belongs to one surface stays there (the home's lucide
 * glyphs and scene prompts; the parent tile's Material glyph and tone).
 *
 * This module imports nothing at runtime: the art manifest derives its world
 * tile ids FROM it (KID_WORLD_TILE_IDS = these worldIds + the home-only tiles),
 * so worldArtwork and every art lookup key off the same ids (B-KID-68 5/n).
 */

export type KidWorldAccent = "green" | "clay" | "lav" | "peach" | "sky" | "pink";
export type KidWorldUnit = "tries" | "rounds" | "stories";

export interface KidWorld {
  /** Home tile id (the `kid.game.<id>.*` key family). */
  id: string;
  /** Arcade world id = routing arg = art key (`world.<worldId>.tile`). */
  worldId: string;
  /** The ONE kid name (tile, in-world bar title, greeting). */
  nameKey: string;
  subKey: string;
  /** The parent Practice door's key for the same name (equal value). */
  doorNameKey: string;
  accent: KidWorldAccent;
  unit: KidWorldUnit;
}

/** Home slot order. Face Match and the archived virtue worlds are not kid
 *  worlds (G-C4: retired); Word World is parent-only (HeroArcade parentOnly). */
export const KID_WORLDS = [
  { id: "sound-lab", worldId: "speech", nameKey: "kid.game.sound-lab.title", subKey: "kid.game.sound-lab.sub", doorNameKey: "elev.practice.world.kid.speech", accent: "sky", unit: "tries" },
  { id: "mood-mountain", worldId: "feelings", nameKey: "kid.game.mood-mountain.title", subKey: "kid.game.mood-mountain.sub", doorNameKey: "elev.practice.world.kid.feelings", accent: "lav", unit: "rounds" },
  { id: "mind-vault", worldId: "memory", nameKey: "kid.game.mind-vault.title", subKey: "kid.game.mind-vault.sub", doorNameKey: "elev.practice.world.kid.memory", accent: "pink", unit: "rounds" },
  { id: "beat-keeper", worldId: "beat", nameKey: "kid.game.beat-keeper.title", subKey: "kid.game.beat-keeper.sub", doorNameKey: "elev.practice.world.kid.rhythm", accent: "clay", unit: "rounds" },
  { id: "hero-pose", worldId: "pose", nameKey: "kid.game.hero-pose.title", subKey: "kid.game.hero-pose.sub", doorNameKey: "elev.practice.world.kid.movement", accent: "sky", unit: "rounds" },
  { id: "pattern-power", worldId: "pattern", nameKey: "kid.game.pattern-power.title", subKey: "kid.game.pattern-power.sub", doorNameKey: "elev.practice.world.kid.logic", accent: "lav", unit: "rounds" },
  { id: "story-quest", worldId: "adventures", nameKey: "kid.game.story-quest.title", subKey: "kid.game.story-quest.sub", doorNameKey: "elev.practice.world.kid.adventures", accent: "peach", unit: "stories" },
  { id: "mimic-studio", worldId: "mimic", nameKey: "kid.game.mimic-studio.title", subKey: "kid.game.mimic-studio.sub", doorNameKey: "elev.practice.world.kid.mimic", accent: "clay", unit: "tries" },
  // Spell Forge keeps its ONE kid name (elev.kids.reading.title, kidHebrewCoverage).
  { id: "spell-forge", worldId: "reading", nameKey: "elev.kids.reading.title", subKey: "elev.kids.reading.sub", doorNameKey: "elev.practice.world.kid.reading", accent: "peach", unit: "tries" },
] as const satisfies readonly KidWorld[];

/** A kid world's routing id (= its art key id), from the entries above. */
export type KidWorldId = (typeof KID_WORLDS)[number]["worldId"];

/** The registry entry for an arcade / routing id, or undefined. */
export function kidWorldByWorldId(worldId: string): KidWorld | undefined {
  return (KID_WORLDS as readonly KidWorld[]).find((w) => w.worldId === worldId);
}

/** worldId → the ONE kid name key (the in-world bar title). */
export const KID_WORLD_NAME_KEY: Readonly<Record<string, string>> = Object.fromEntries(KID_WORLDS.map((w) => [w.worldId, w.nameKey]));

/**
 * B-GAME-07b — Sneak & Freeze / "דג מלוח", the G0 proof game, offered ONLY
 * behind a device flag: localStorage["arbor.flags.sneakFreeze"] === "1"
 * (read once, try/catch). It is NOT in KID_WORLDS, so with the flag off the
 * kid home, the registry-derived art keys and every existing consumer are
 * exactly as before. No parent door, no art key, no souvenir yet.
 */
export const SNEAK_FREEZE_FLAG_KEY = "arbor.flags.sneakFreeze";
export const SNEAK_FREEZE_WORLD = { worldId: "sneak", id: "sneak-freeze", nameKey: "kid.game.sneak-freeze.title", subKey: "kid.game.sneak-freeze.sub", accent: "green" } as const;
export type SneakFreezeWorldId = (typeof SNEAK_FREEZE_WORLD)["worldId"];

let sneakFlag: boolean | null = null;
/** True when the device flag offers Sneak & Freeze (read once per page load). */
export function sneakFreezeFlagOn(): boolean {
  if (sneakFlag !== null) return sneakFlag;
  try {
    sneakFlag = typeof localStorage !== "undefined" && localStorage.getItem(SNEAK_FREEZE_FLAG_KEY) === "1";
  } catch {
    sneakFlag = false;
  }
  return sneakFlag;
}

/** The flagged world's name key for an arcade id, only while the flag is on. */
export function flaggedWorldNameKey(worldId: string): string | undefined {
  return worldId === SNEAK_FREEZE_WORLD.worldId && sneakFreezeFlagOn() ? SNEAK_FREEZE_WORLD.nameKey : undefined;
}
