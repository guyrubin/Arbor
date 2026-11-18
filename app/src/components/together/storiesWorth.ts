import { milestonesV10Copy } from "../companion/milestonesV10Copy";

/**
 * Stories › "Worth knowing" (N-Stories-D/M): one reviewed Learn read about
 * reading and stories, picked by the child's whole years. No new sentences:
 * the card shows the read's own hook and title. Up to six: reading aloud
 * (ages 0–6); seven to ten: how children learn to tell a story (ages 3–10).
 * Outside both, or with no age on the profile, there is no card.
 */
export function storiesWorthCardId(ageMonths: number | null): string | null {
  if (ageMonths === null || !Number.isFinite(ageMonths) || ageMonths < 0) return null;
  const years = Math.floor(ageMonths / 12);
  if (years <= 6) return "reading-aloud";
  if (years <= 10) return "storytelling-development";
  return null;
}

/** "Worth knowing at three" in words (1–6), as My child writes it; else the plain kicker. */
export function storiesWorthKicker(ageMonths: number | null, uiLang: string): string {
  const v10 = milestonesV10Copy(uiLang);
  const years = ageMonths === null ? 0 : Math.floor(ageMonths / 12);
  return years >= 1 && years < v10.ageWords.length ? v10.worthKnowingAt.replace("{age}", v10.ageWords[years]) : v10.worthKnowing;
}
