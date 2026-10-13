import type { KidWorld } from "./kidWorlds";
/** New studio mechanics: old Parent arcade destinations remain unchanged. */
export const STUDIO_V2_GAME_WORLDS = [
  { id: "sound-explorer", worldId: "sound-explorer", nameKey: "kid.game.sound-explorer.title", subKey: "kid.game.sound-explorer.sub", doorNameKey: "kid.game.sound-explorer.title", accent: "sky", unit: "rounds", ageBands: ["36m", "48m", "60m", "6-8y"] },
  { id: "calm-builder", worldId: "calm-builder", nameKey: "kid.game.calm-builder.title", subKey: "kid.game.calm-builder.sub", doorNameKey: "kid.game.calm-builder.title", accent: "green", unit: "rounds", ageBands: ["36m", "48m", "60m", "6-8y"] },
  { id: "puzzle", worldId: "puzzle", nameKey: "kid.game.puzzle.title", subKey: "kid.game.puzzle.sub", doorNameKey: "kid.game.puzzle.title", accent: "lav", unit: "rounds", ageBands: ["36m", "48m", "60m", "6-8y"] },
] as const satisfies readonly KidWorld[];
