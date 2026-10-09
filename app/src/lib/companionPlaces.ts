import type { ActiveTab } from "./routes";
import { sectionForTab } from "./navigation";
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
export function placeForTab(tab: ActiveTab): CompanionPlace {
  const section = sectionForTab(tab).id;
  if (section === "practice" || section === "stories" || tab === "daily-play") return COMPANION_PLACES[2];
  if (["growth", "journal", "profile", "care"].includes(section)) return COMPANION_PLACES[1];
  return COMPANION_PLACES[0];
}
export function isCompanionHome(tab: ActiveTab): boolean {
  return COMPANION_PLACES.some(place => place.tab === tab);
}
