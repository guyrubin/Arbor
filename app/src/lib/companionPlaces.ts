import type { ActiveTab } from "./routes";
import { sectionForTab } from "./navigation";

export const COMPANION_PLACES = [
  { id: "now", tab: "overview", icon: "home", en: "Now", he: "עכשיו", detailEn: "A little clarity for today", detailHe: "בהירות לרגע הזה" },
  { id: "child", tab: "development", icon: "person", en: "My child", he: "הילד שלי", detailEn: "The whole picture, over time", detailHe: "התמונה השלמה, לאורך זמן" },
  { id: "together", tab: "practice", icon: "interests", en: "Together", he: "ביחד", detailEn: "Small moments. Shared discoveries.", detailHe: "רגעים קטנים, גילויים משותפים" },
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
