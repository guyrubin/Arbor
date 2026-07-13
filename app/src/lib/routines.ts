/* ════════════════════════════════════════════════════════════════════════════
   routines.ts — the "Ready-made Routines" library (data module).

   Seven research-backed, parent-run daily routines. Bilingual and data-driven,
   like the app's other content modules (playbank/content, milestoneData, …) —
   the routine CONTENT lives here as data, NOT in i18n.ts. Only the surrounding
   UI-chrome strings (title, sub, buttons, toasts) go through t("routines.*").

   CLINICAL FIREWALL: this is parent-run activity guidance. A routine is a
   checklist of steps a family runs together — never a score, verdict, or
   assessment of the child. Consumers render progress as COUNTS / bar-widths
   only, never a percentage number.

   Tones are drawn from the layout-kit PASTEL set ONLY
   (mint|coral|lav|yellow|pink|sky) — never a PlayKit tone (clay/peach), which
   would render blank on these parent surfaces.
   ════════════════════════════════════════════════════════════════════════════ */

import type { UiLang } from "./i18n";
import type { PastelKey } from "./tokens";

/** A string localized to the two supported UI languages. */
export interface Localized {
  en: string;
  he: string;
}

/** One step within a routine — an icon-tiled row the parent toggles done. */
export interface RoutineStep {
  /** Stable key, unique within the routine (persisted in localStorage). */
  key: string;
  /** Material Symbol ligature for the step's icon tile. */
  ms: string;
  label: Localized;
}

/** A ready-made routine: a titled, research-backed sequence of steps. */
export interface Routine {
  id: string;
  /** Material Symbol ligature for the routine's colored icon tile. */
  ms: string;
  /** Layout-kit PASTEL tone driving the tile / board / progress colors. */
  tone: PastelKey;
  /** Developmental domains this routine feeds (display chip; not a verdict). */
  domains: Localized;
  title: Localized;
  /** Rough duration label (e.g. "20 min"). */
  time: Localized;
  /** One-line "why it works" note; use {name} for the child's first name. */
  why: Localized;
  steps: RoutineStep[];
}

/** The seven routines, in display order. `morning` is the default selection. */
export const ROUTINES: Routine[] = [
  {
    id: "morning",
    ms: "wb_sunny",
    tone: "yellow",
    domains: { en: "Self-Care + Regulation", he: "עצמאות + ויסות" },
    title: { en: "Calm morning", he: "בוקר רגוע" },
    time: { en: "20 min", he: "20 דק׳" },
    why: {
      en: "A fixed sequence gives {name} a sense of control, fewer morning power struggles.",
      he: "רצף קבוע נותן ל{name} תחושת שליטה — פחות מאבקי כוח בבוקר.",
    },
    steps: [
      { key: "m1", ms: "light_mode", label: { en: "Wake up with our morning song", he: "להתעורר עם שיר הבוקר" } },
      { key: "m2", ms: "checkroom", label: { en: "Get dressed by myself", he: "להתלבש לבד" } },
      { key: "m3", ms: "restaurant", label: { en: "Eat breakfast", he: "ארוחת בוקר" } },
      { key: "m4", ms: "dentistry", label: { en: "Brush teeth", he: "לצחצח שיניים" } },
      { key: "m5", ms: "backpack", label: { en: "Shoes + bag by the door", he: "נעליים ותיק ליד הדלת" } },
    ],
  },
  {
    id: "goodbye",
    ms: "waving_hand",
    tone: "sky",
    domains: { en: "Self-Regulation", he: "ויסות עצמי" },
    title: { en: "Goodbye ritual", he: "טקס פרידה" },
    time: { en: "2 min", he: "2 דק׳" },
    why: {
      en: "Same words, same hug, every morning: a predictable goodbye builds security.",
      he: "אותן מילים, אותו חיבוק, כל בוקר — פרידה צפויה בונה ביטחון.",
    },
    steps: [
      { key: "g1", ms: "favorite", label: { en: "Our special hug", he: "החיבוק המיוחד שלנו" } },
      { key: "g2", ms: "record_voice_over", label: { en: "Our three magic words", he: "שלוש מילות הקסם" } },
      { key: "g3", ms: "waving_hand", label: { en: "Wave at the window", he: "נפנוף בחלון" } },
    ],
  },
  {
    id: "reconnect",
    ms: "cookie",
    tone: "coral",
    domains: { en: "Social + Language", he: "חברתי + שפה" },
    title: { en: "After-preschool reconnect", he: "חיבור אחרי הגן" },
    time: { en: "25 min", he: "25 דק׳" },
    why: {
      en: "Decompress first, talk after: connection comes once the day settles.",
      he: "קודם עיכול של היום, אחר כך שיחה — החיבור מגיע כשנרגעים.",
    },
    steps: [
      { key: "a1", ms: "cookie", label: { en: "Snack + water", he: "חטיף ומים" } },
      { key: "a2", ms: "toys", label: { en: "10 min of quiet play together", he: "10 דקות משחק שקט יחד" } },
      { key: "a3", ms: "forum", label: { en: "One question about today", he: "שאלה אחת על היום" } },
    ],
  },
  {
    id: "meal",
    ms: "restaurant_menu",
    tone: "lav",
    domains: { en: "Language + Self-Care", he: "שפה + עצמאות" },
    title: { en: "Mealtime together", he: "ארוחה יחד" },
    time: { en: "30 min", he: "30 דק׳" },
    why: {
      en: "Regular family meals feed language, connection and eating habits.",
      he: "ארוחות משפחתיות קבועות מזינות שפה, חיבור והרגלי אכילה.",
    },
    steps: [
      { key: "e1", ms: "soap", label: { en: "Wash hands", he: "לשטוף ידיים" } },
      { key: "e2", ms: "flatware", label: { en: "Help set the table", he: "לעזור לערוך שולחן" } },
      { key: "e3", ms: "forum", label: { en: "Today's family question", he: "שאלת המשפחה של היום" } },
      { key: "e4", ms: "delete_sweep", label: { en: "Clear my own plate", he: "לפנות את הצלחת שלי" } },
    ],
  },
  {
    id: "tidy",
    ms: "cleaning_services",
    tone: "mint",
    domains: { en: "Self-Care + Thinking", he: "עצמאות + חשיבה" },
    title: { en: "Tidy-up time", he: "סידור צעצועים" },
    time: { en: "10 min", he: "10 דק׳" },
    why: {
      en: "Sorting into bins is thinking practice; the song turns a chore into a game.",
      he: "מיון לקופסאות הוא תרגול חשיבה — והשיר הופך מטלה למשחק.",
    },
    steps: [
      { key: "t1", ms: "music_note", label: { en: "Play the tidy-up song", he: "מפעילים את שיר הסידור" } },
      { key: "t2", ms: "category", label: { en: "Sort toys into bins", he: "ממיינים צעצועים לקופסאות" } },
      { key: "t3", ms: "front_hand", label: { en: "High-five to finish", he: "כיף חמש לסיום" } },
    ],
  },
  {
    id: "screens",
    ms: "timer",
    tone: "sky",
    domains: { en: "Self-Regulation", he: "ויסות עצמי" },
    title: { en: "Screen wind-down", he: "סיום מסכים" },
    time: { en: "5 min", he: "5 דק׳" },
    why: {
      en: "A heads-up plus a timer that plays the villain: a transition without a fight.",
      he: "אזהרה מראש + טיימר שהוא ״הרע״ — מעבר בלי ריב.",
    },
    steps: [
      { key: "s1", ms: "campaign", label: { en: "5-minute warning", he: "אזהרת 5 דקות" } },
      { key: "s2", ms: "timer", label: { en: "Timer rings, screen off", he: "הטיימר מצלצל — מכבים" } },
      { key: "s3", ms: "checklist", label: { en: "Choose what's next", he: "בוחרים מה עושים עכשיו" } },
    ],
  },
  {
    id: "bedtime",
    ms: "bedtime",
    tone: "lav",
    domains: { en: "Regulation + Language", he: "ויסות + שפה" },
    title: { en: "Calm bedtime", he: "שינה רגועה" },
    time: { en: "30 min", he: "30 דק׳" },
    why: {
      en: "The most researched routine of all: a consistent bedtime sequence improves sleep, mood and behavior.",
      he: "השגרה הנחקרת ביותר: רצף שינה קבוע משפר שינה, מצב רוח והתנהגות.",
    },
    steps: [
      { key: "b1", ms: "bathtub", label: { en: "Bath", he: "אמבטיה" } },
      { key: "b2", ms: "dentistry", label: { en: "Pajamas + teeth", he: "פיג׳מה ושיניים" } },
      { key: "b3", ms: "menu_book", label: { en: "Story in bed", he: "סיפור במיטה" } },
      { key: "b4", ms: "nightlight", label: { en: "Cuddle + lights out", he: "חיבוק וכיבוי אור" } },
    ],
  },
];

/** Read the right language off a Localized value. `uiLang` comes from
 *  useLanguage() (he/en); anything non-Hebrew falls back to English. */
export function localized(value: Localized, uiLang: UiLang): string {
  return uiLang === "he" ? value.he : value.en;
}

/** Look up a routine by id (safe: returns the default `morning` routine when
 *  the id is unknown, so consumers never render blank). */
export function routineById(id: string): Routine {
  return ROUTINES.find((r) => r.id === id) ?? ROUTINES[0];
}
