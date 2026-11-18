/**
 * Challenge Plans — the parent-facing names (product copy, not clinical
 * content). Each pattern has a short plan name ("Saying goodbye at drop-off")
 * and each menu item a short step name ("Our goodbye"); every name summarises
 * its own entry's existing text in the pattern registry, with no new claim, no
 * pronoun for the child and no AI wording (planNames.test pins it). The
 * registry itself (lib/library/plans/patterns, reviewed as written, B-GA-37)
 * is unchanged; the book's own title stays the book's.
 *
 * Used where the boards name a plan or a step: the Challenge list's cards, the
 * breadcrumb's last level, the Today rail's step, "What do we do?" and the
 * composer's step cards. HE: native review owed.
 */
import type { BookLabel, PatternId } from "../library/types";

export interface PatternNames {
  /** The plan, in the parent's words (N-Challenge-D: "Saying goodbye at drop-off"). */
  plan: BookLabel;
  /** Each menu item's step name, by menu id (N-Challenge-D: "Our goodbye"). */
  steps: Record<string, BookLabel>;
}

export const PLAN_NAMES: Record<string, PatternNames> = {
  "plan-poo-sit": {
    plan: { en: "Feeling comfortable on the toilet", he: "להרגיש בנוח על האסלה" },
    steps: {
      "sit-after-meal": { en: "Sitting after the meal", he: "לשבת אחרי הארוחה" },
      "sit-same-time": { en: "Sitting at the same time", he: "לשבת בשעה קבועה" },
      "the-box": { en: "The sitting box", he: "קופסת הישיבה" },
      "blow-bubbles": { en: "Bubbles and a long breath out", he: "בועות ונשיפה ארוכה" },
      "just-try": { en: "Just trying", he: "רק לנסות" },
    },
  },
  "plan-sleep-alone": {
    plan: { en: "Falling asleep alone in bed", he: "להירדם לבד במיטה" },
    steps: {
      "four-steps": { en: "The same four bedtime steps", he: "ארבעת צעדי השינה הקבועים" },
      "sit-further": { en: "The chair moves toward the door", he: "הכיסא מתקרב לדלת" },
      "check-back": { en: "Goodnight, then short check-ins", he: "לילה טוב, ואז בדיקות קצרות" },
      "morning-check-in": { en: "A short morning check-in", he: "שיחת בוקר קצרה" },
    },
  },
  "plan-dropoff": {
    plan: { en: "Saying goodbye at drop-off", he: "להיפרד בבוקר בדלת" },
    steps: {
      "goodbye-ritual": { en: "Our goodbye", he: "הפרידה שלנו" },
      "kiss-in-the-hand": { en: "A kiss in the palm", he: "נשיקה בכף היד" },
      "thing-from-home": { en: "A thing from home", he: "משהו מהבית" },
      "door-opens-again": { en: "When the door opens again", he: "כשהדלת נפתחת שוב" },
    },
  },
  "plan-big-feelings": {
    plan: { en: "Making room for big feelings", he: "לפנות מקום לרגשות גדולים" },
    steps: {
      "notice-the-hot": { en: "One word for the signal", he: "מילה אחת לסימן" },
      "calm-place": { en: "The calm place", he: "המקום הרגוע" },
      "hold-and-wait": { en: "Staying near and waiting", he: "להישאר קרוב ולחכות" },
      "fix-and-start-again": { en: "Fixing it and starting again", he: "לתקן ולהתחיל מחדש" },
    },
  },
  "plan-screen-end": {
    plan: { en: "When screen time ends", he: "כשזמן המסך נגמר" },
    steps: {
      "warning-in-my-units": { en: "The warning before the end", he: "אזהרה לפני הסוף" },
      "timer-i-can-see": { en: "A timer to watch", he: "שעון שאפשר לראות" },
      "my-job-at-the-end": { en: "Pressing the button at the end", he: "ללחוץ על הכפתור בסוף" },
      "next-thing-pictured": { en: "Showing the next thing", he: "להראות מה בא אחר כך" },
    },
  },
  "plan-new-food": {
    plan: { en: "Getting to know a new food", he: "להכיר מאכל חדש" },
    steps: {
      "sits-on-my-plate": { en: "A new food beside a familiar one", he: "מאכל חדש ליד מאכל מוכר" },
      "tiny-taste": { en: "A tiny taste, by choice", he: "טעימה קטנטנה, מבחירה" },
      "we-cook-it": { en: "Handling it before the meal", he: "לגעת בו לפני הארוחה" },
      "comes-back-many-times": { en: "It comes back many times", he: "חוזר לצלחת הרבה פעמים" },
    },
  },
  "plan-toilet-start": {
    plan: { en: "Starting toilet learning", he: "מתחילים להתרגל לסיר" },
    steps: {
      "sit-same-times": { en: "Short sits at the same times", he: "ישיבות קצרות בשעות קבועות" },
      "the-box": { en: "The potty box", he: "קופסת הסיר" },
      "still-learning": { en: "Still learning", he: "עדיין לומדים" },
    },
  },
  "plan-stay-in-bed": {
    plan: { en: "Staying in bed at night", he: "להישאר במיטה בלילה" },
    steps: {
      "my-place-at-night": { en: "The same goodnight", he: "לילה טוב קבוע" },
      "one-trip-card": { en: "The one-trip card", he: "כרטיס יציאה אחת" },
      "walk-back": { en: "Walking back to bed", he: "ללוות חזרה למיטה" },
      "morning-check-in": { en: "A short morning check-in", he: "שיחת בוקר קצרה" },
    },
  },
};

/** The plan's parent-facing name; null for a pattern without one (callers fall back to the book title). */
export function planName(pattern: PatternId | string, lang: "en" | "he"): string | null {
  return PLAN_NAMES[pattern]?.plan[lang] ?? null;
}

/** A step's name by its menu id; null for an own-words step or an unnamed item. */
export function stepName(pattern: PatternId | string, menuId: string | undefined, lang: "en" | "he"): string | null {
  if (!menuId) return null;
  return PLAN_NAMES[pattern]?.steps[menuId]?.[lang] ?? null;
}
