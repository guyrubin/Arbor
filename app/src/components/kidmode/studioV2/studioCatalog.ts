import { offersForChild } from "../../../lib/age/playGate";
import type { AgedChild } from "../../../lib/age/forChild";
import { KID_WORLDS, SNEAK_FREEZE_WORLD } from "../kidWorlds";
import { studioNextFlagOn } from "./studioNextFlag";

export type StudioWorldId = "playbank" | "stories" | "feelings" | "studio";
/** The makers wave: hand-built activities with their own homes under
 * games/makers/. Within a world they follow today's games, in this order. Offered only on a device that opted in to the next Studio
 * games; elsewhere they resolve (titles, keepsakes) but never fit a child. */
export const STUDIO_MAKERS = [
  { id: "mend-bowl", worldId: "studio" }, { id: "stitch-garden", worldId: "studio" },
  { id: "paper-boat", worldId: "stories" },
  { id: "season-dial", worldId: "playbank" }, { id: "crank-works", worldId: "playbank" }, { id: "windup-race", worldId: "playbank" },
  { id: "clay-theatre", worldId: "stories" }, { id: "bottle-lab", worldId: "studio" },
  { id: "ice-age-friend", worldId: "playbank" }, { id: "tiny-builders", worldId: "playbank" }, { id: "fox-trail", worldId: "playbank" },
  { id: "maker-desk", worldId: "studio" },
] as const;
export type StudioMakerId = typeof STUDIO_MAKERS[number]["id"];
/** The one authority for "is this a maker". */
export const STUDIO_MAKER_IDS: readonly StudioMakerId[] = STUDIO_MAKERS.map(m => m.id);
export function isStudioMakerId(id: string): id is StudioMakerId { return (STUDIO_MAKER_IDS as readonly string[]).includes(id); }
export type StudioActivityId = StudioMakerId | "river-rescue" | "feelings-forest" | "rhythm-garden" | "memory" | "feelings" | "mimic" | "sound-explorer" | "pattern" | "calm-builder" | "beat" | "puzzle" | "sneak" | "reading" | "adventures" | "pose" | "speech";
export type StudioLanguage = "en" | "he";
export interface StudioActivity { id: StudioActivityId; worldId: StudioWorldId; legacyWorldId?: string; ageBands: readonly string[]; languages: readonly StudioLanguage[] }
export const STUDIO_V2_WORLDS: readonly StudioWorldId[] = ["playbank", "stories", "studio", "feelings"];
const both: readonly StudioLanguage[] = ["en", "he"];
const legacy = (id: StudioActivityId, worldId: StudioWorldId): StudioActivity => {
  const entry = KID_WORLDS.find(w => w.worldId === id);
  if (!entry) throw new Error(`Missing legacy Studio activity: ${id}`);
  return { id, worldId, legacyWorldId: id, ageBands: entry.ageBands, languages: id === "speech" ? ["en"] : both };
};
export const STUDIO_V2_ACTIVITIES: readonly StudioActivity[] = [
  { id: "river-rescue", worldId: "playbank", ageBands: SNEAK_FREEZE_WORLD.ageBands, languages: both },
  { id: "feelings-forest", worldId: "feelings", ageBands: SNEAK_FREEZE_WORLD.ageBands, languages: both },
  { id: "rhythm-garden", worldId: "studio", ageBands: SNEAK_FREEZE_WORLD.ageBands, languages: both },
  legacy("memory", "playbank"), legacy("pattern", "playbank"),
  { id: "puzzle", worldId: "playbank", ageBands: SNEAK_FREEZE_WORLD.ageBands, languages: both },
  { id: "sneak", worldId: "playbank", legacyWorldId: "sneak", ageBands: SNEAK_FREEZE_WORLD.ageBands, languages: both },
  legacy("reading", "playbank"), legacy("adventures", "playbank"),
  legacy("feelings", "feelings"), legacy("mimic", "feelings"),
  { id: "calm-builder", worldId: "feelings", ageBands: SNEAK_FREEZE_WORLD.ageBands, languages: both },
  legacy("beat", "studio"),
  { id: "sound-explorer", worldId: "studio", ageBands: SNEAK_FREEZE_WORLD.ageBands, languages: both },
  legacy("pose", "studio"), legacy("speech", "studio"),
  ...STUDIO_MAKERS.map(m => ({ id: m.id, worldId: m.worldId, ageBands: SNEAK_FREEZE_WORLD.ageBands, languages: both })),
];
/** The child menu is intentionally curated. Legacy routes and keepsakes remain
 * resolvable; overlapping practice tools are not additional game promises. */
export const STUDIO_GAME_SELECTION: readonly StudioActivityId[] = [
  "river-rescue", "memory", "pattern", "puzzle", "sneak",
  "feelings-forest", "calm-builder", "rhythm-garden",
];
export function studioMenuActivities(...args: Parameters<typeof studioActivitiesForChild>): StudioActivity[] {
  const eligible = studioActivitiesForChild(...args);
  const offered = studioNextFlagOn() ? [...STUDIO_GAME_SELECTION, ...STUDIO_MAKER_IDS] : STUDIO_GAME_SELECTION;
  return offered.flatMap(id => eligible.filter(activity => activity.id === id));
}
export function studioActivity(id: string): StudioActivity | undefined { return STUDIO_V2_ACTIVITIES.find(a => a.id === id); }
export function studioActivityFromLegacy(refId: string): StudioActivity | undefined { return STUDIO_V2_ACTIVITIES.find(a => a.legacyWorldId === refId || a.id === refId); }
export function studioLegacyRoute(id: StudioActivityId): { surface: "arcade"; worldId: string } | null {
  const worldId = studioActivity(id)?.legacyWorldId;
  return worldId ? { surface: "arcade", worldId } : null;
}
export function studioActivitiesForChild(worldId: StudioWorldId, child: AgedChild | null | undefined, lang: StudioLanguage, now?: Date, options: { sneakEnabled?: boolean } = {}): StudioActivity[] {
  return offersForChild(STUDIO_V2_ACTIVITIES, child, now).filter(a => a.worldId === worldId && a.languages.includes(lang) && (a.id !== "sneak" || options.sneakEnabled !== false) && (!isStudioMakerId(a.id) || studioNextFlagOn()));
}
export function studioActivityFits(id: string, child: AgedChild | null | undefined, lang: StudioLanguage, now?: Date, options: { sneakEnabled?: boolean } = {}): boolean {
  const a = studioActivity(id);
  return !!a && studioActivitiesForChild(a.worldId, child, lang, now, options).some(item => item.id === id);
}
