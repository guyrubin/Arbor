import type { ActiveTab } from "./routes";
import { homeIdForTab, type HomeId } from "./navigation";
import { companionEn, companionHe } from "./i18nCompanion";

/** The three companion places — the ONE source of their glyphs (Now `home`,
 *  My child `eco`, Together `interests`). The desktop Sidebar and the mobile
 *  dock both render `icon` from here; components/ui/iconFamily.guard.test.ts
 *  fails if either hardcodes another glyph for a place. */
export const COMPANION_PLACES = [
  { id: "now", tab: "overview", icon: "home", en: companionEn["companion.place.now"], he: companionHe["companion.place.now"], detailEn: companionEn["companion.place.now.detail"], detailHe: companionHe["companion.place.now.detail"] },
  { id: "child", tab: "development", icon: "eco", en: companionEn["companion.place.child"], he: companionHe["companion.place.child"], detailEn: companionEn["companion.place.child.detail"], detailHe: companionHe["companion.place.child.detail"] },
  { id: "together", tab: "practice", icon: "interests", en: companionEn["companion.place.together"], he: companionHe["companion.place.together"], detailEn: companionEn["companion.place.together.detail"], detailHe: companionHe["companion.place.together.detail"] },
] as const;
export type CompanionPlace = typeof COMPANION_PLACES[number];

/** v3 IA-04 — the three doors (Talk with Arbor `forum`, For you, the parent
 *  `school`, Care, together `diversity_1`): destinations a parent opens, not
 *  places they stand in. `tab` is the route the door opens on. */
export const COMPANION_DOORS = [
  { id: "talk", tab: "coach", icon: "forum", en: companionEn["companion.door.talk"], he: companionHe["companion.door.talk"] },
  { id: "learn", tab: "masterclasses", icon: "school", en: companionEn["companion.door.learn"], he: companionHe["companion.door.learn"] },
  { id: "care", tab: "consult", icon: "diversity_1", en: companionEn["companion.door.care"], he: companionHe["companion.door.care"] },
] as const;
export type CompanionDoor = typeof COMPANION_DOORS[number];
export type CompanionHome = { kind: "place"; place: CompanionPlace } | { kind: "door"; door: CompanionDoor };

/** Each home id as its place or door; a Record, so a seventh home id or a
 *  missing one fails the type check rather than resolving to nothing. */
const HOMES: Record<HomeId, CompanionHome> = {
  now: { kind: "place", place: COMPANION_PLACES[0] },
  child: { kind: "place", place: COMPANION_PLACES[1] },
  together: { kind: "place", place: COMPANION_PLACES[2] },
  talk: { kind: "door", door: COMPANION_DOORS[0] },
  learn: { kind: "door", door: COMPANION_DOORS[1] },
  care: { kind: "door", door: COMPANION_DOORS[2] },
};

/** The ONE home resolver (table A): the place or door every route belongs to.
 *  Callers read this; none re-derives a home from hub ids. */
export function homeForTab(tab: ActiveTab): CompanionHome {
  return HOMES[homeIdForTab(tab)];
}

/** The place a door's routes return to: talking and the parent's own learning
 *  start from Now; care is about the child. */
const DOOR_RETURN: Record<CompanionDoor["id"], CompanionPlace> = {
  talk: COMPANION_PLACES[0],
  learn: COMPANION_PLACES[0],
  care: COMPANION_PLACES[1],
};

/** The place a route sits in: its home when that is a place, otherwise the
 *  place its door returns to. The search subtitle and the active place in the
 *  dock read it; the Sidebar and Back read the home itself (homeForTab). */
export function placeForTab(tab: ActiveTab): CompanionPlace {
  const home = homeForTab(tab);
  return home.kind === "place" ? home.place : DOOR_RETURN[home.door.id];
}
export function isCompanionHome(tab: ActiveTab): boolean {
  return COMPANION_PLACES.some(place => place.tab === tab);
}

/** v3 IA-01 — where Back goes: the route's home, a place or a door (#/learn
 *  returns to For you, the parent; #/milestones to My child). A home's own
 *  route (the three places, and coach, masterclasses and consult) has no Back:
 *  null. Shell's Back reads only this. */
export function backTargetFor(tab: ActiveTab): CompanionPlace | CompanionDoor | null {
  const home = homeForTab(tab);
  const target = home.kind === "place" ? home.place : home.door;
  return target.tab === tab ? null : target;
}
