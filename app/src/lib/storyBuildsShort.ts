/**
 * W2-SHELLPLAY critic r2 (stories design) — "what this story builds", at a
 * glance. The Tonight cover used to print the story's whole third-person
 * curriculum sentence ("The child learns that…" / "הילד לומד…", a generic
 * masculine) as its Builds row: four lines at 375 that pushed Play under the
 * bottom nav and never read as a glance. Each curated story gets ONE phrase of
 * at most six words, EN + HE, written gender-neutral (infinitive / noun, never
 * a slash form). The full sentence stays on the story record.
 *
 * A story missing here falls back to the full sentence, line-clamped below sm.
 */
export const STORY_BUILDS_SHORT: Readonly<Record<string, { en: string; he: string }>> = {
  "david-and-goliath": { en: "Courage while still afraid", he: "אומץ גם כשמפחדים" },
  "moses-and-pharaoh": { en: "Speaking up for what's right", he: "לדבר בשביל מה שנכון" },
  "the-lion-who-was-afraid": { en: "Moving gently through fear", he: "להתקדם בעדינות למרות הפחד" },
  "noahs-ark": { en: "Steady preparing keeps everyone safe", he: "הכנה סבלנית שומרת על כולם" },
  "jonah-and-the-great-fish": { en: "Turning back to do right", he: "לחזור ולעשות את הנכון" },
  "the-dragon-of-responsibility": { en: "Small daily jobs, done with care", he: "משימות קטנות, באכפתיות, כל יום" },
  "joseph-and-his-brothers": { en: "Forgiving after hard times", he: "לסלוח אחרי זמנים קשים" },
  "jacob-wrestling-the-angel": { en: "Holding on through a struggle", he: "להחזיק מעמד במאבק קשה" },
  "the-garden-of-forgotten-seeds": { en: "Good things grow slowly", he: "דברים טובים צומחים לאט" },
  "king-solomons-choice": { en: "Stopping to think, choosing fairly", he: "לעצור, לחשוב ולבחור בהגינות" },
  "the-broken-music-box": { en: "Telling the truth about mistakes", he: "לספר את האמת על טעות" },
  "the-found-acorn-crown": { en: "Giving back what isn't ours", he: "להחזיר את מה שלא שלנו" },
  "the-two-gifts": { en: "Meeting a jealous feeling kindly", he: "לפגוש קנאה בעדינות" },
  "leave-the-tent": { en: "Courage to leave the familiar", he: "אומץ לצאת ממה שמוכר" },
  "the-two-paths-through-the-meadow": { en: "Waiting before choosing", he: "לעצור לפני שבוחרים" },
  "the-two-mothers-and-the-quiet-judge": { en: "Listening to everyone before deciding", he: "להקשיב לכולם לפני שמחליטים" },
  "the-tyrant-and-the-town": { en: "Saying the truth out loud, together", he: "לומר את האמת בקול, יחד" },
  "the-friendly-monster": { en: "Big power, gently controlled", he: "כוח גדול בשליטה עדינה" },
  "the-lantern-path": { en: "Naming fear, choosing trusted company", he: "לקרוא לפחד בשם ולבחור במי לבטוח" },
  "the-cloud-orchestra": { en: "Every voice gets room", he: "לכל קול יש מקום" },
  "the-little-bridge-builders": { en: "One useful piece at a time", he: "חלק מועיל אחד בכל פעם" },
};

/** The glanceable Builds phrase for a story in the UI language, or null. */
export function storyBuildsShort(storyId: string | undefined, lang: "en" | "he"): string | null {
  if (!storyId) return null;
  const row = STORY_BUILDS_SHORT[storyId];
  return row ? row[lang] : null;
}
