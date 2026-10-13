import { offersForChild } from "../../../lib/age/playGate";
import type { AgedChild } from "../../../lib/age/forChild";
import { KID_WORLDS, SNEAK_FREEZE_WORLD } from "../kidWorlds";

export type StudioWorldId = "playbank" | "stories" | "feelings" | "studio";
export type StudioActivityId = "memory" | "feelings" | "mimic" | "sound-explorer" | "pattern" | "calm-builder" | "beat" | "puzzle" | "sneak" | "reading" | "adventures" | "pose" | "speech";
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
  legacy("memory", "playbank"), legacy("pattern", "playbank"),
  { id: "puzzle", worldId: "playbank", ageBands: SNEAK_FREEZE_WORLD.ageBands, languages: both },
  { id: "sneak", worldId: "playbank", legacyWorldId: "sneak", ageBands: SNEAK_FREEZE_WORLD.ageBands, languages: both },
  legacy("reading", "playbank"), legacy("adventures", "playbank"),
  legacy("feelings", "feelings"), legacy("mimic", "feelings"),
  { id: "calm-builder", worldId: "feelings", ageBands: SNEAK_FREEZE_WORLD.ageBands, languages: both },
  legacy("beat", "studio"),
  { id: "sound-explorer", worldId: "studio", ageBands: SNEAK_FREEZE_WORLD.ageBands, languages: both },
  legacy("pose", "studio"), legacy("speech", "studio"),
];
export function studioActivity(id: string): StudioActivity | undefined { return STUDIO_V2_ACTIVITIES.find(a => a.id === id); }
export function studioActivityFromLegacy(refId: string): StudioActivity | undefined { return STUDIO_V2_ACTIVITIES.find(a => a.legacyWorldId === refId || a.id === refId); }
export function studioLegacyRoute(id: StudioActivityId): { surface: "arcade"; worldId: string } | null {
  const worldId = studioActivity(id)?.legacyWorldId;
  return worldId ? { surface: "arcade", worldId } : null;
}
export function studioActivitiesForChild(worldId: StudioWorldId, child: AgedChild | null | undefined, lang: StudioLanguage, now?: Date, options: { sneakEnabled?: boolean } = {}): StudioActivity[] {
  return offersForChild(STUDIO_V2_ACTIVITIES, child, now).filter(a => a.worldId === worldId && a.languages.includes(lang) && (a.id !== "sneak" || options.sneakEnabled !== false));
}
export function studioActivityFits(id: string, child: AgedChild | null | undefined, lang: StudioLanguage, now?: Date, options: { sneakEnabled?: boolean } = {}): boolean {
  const a = studioActivity(id);
  return !!a && studioActivitiesForChild(a.worldId, child, lang, now, options).some(item => item.id === id);
}
