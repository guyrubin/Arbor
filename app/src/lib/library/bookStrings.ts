/**
 * lib/library/bookStrings — B-BOOK-04/12: the reader's chrome strings, EN + HE,
 * in the elevation-dictionary pattern (lib/i18nElevation/*: one typed key set,
 * two Records, one accessor), kept beside the library so the new reader adds
 * no line to the shared lib/i18n.ts. No number, no score, no "right/wrong".
 * HE: native review owed (lane A §3.10); infinitives for actions, so one
 * string serves both genders. The parent-panel headings are the parent
 * register (shown only behind "For the grown-up").
 */
export type BookStringKey =
  | "reader.aria"
  | "open"
  | "next"
  | "back"
  | "close"
  | "go"
  | "choose"
  | "theEnd"
  | "readAgain"
  | "choices.aria"
  | "repair.tap"
  | "picture"
  | "hearTitle"
  | "sound.on"
  | "sound.off"
  | "grownUp"
  | "grownUp.builds"
  | "grownUp.why"
  | "grownUp.ask"
  | "grownUp.askMore"
  | "grownUp.source"
  | "name.fallback.m"
  | "name.fallback.f";

const EN: Record<BookStringKey, string> = {
  "reader.aria": "{title}",
  open: "Open the book",
  next: "Next page",
  back: "Previous page",
  close: "Close the book",
  go: "This one!",
  choose: "Choose",
  theEnd: "The End",
  readAgain: "Read again",
  "choices.aria": "What will happen next?",
  "repair.tap": "Tap",
  picture: "The picture",
  hearTitle: "Hear the title",
  "sound.on": "Sound is on",
  "sound.off": "Sound is off",
  grownUp: "For the grown-up",
  "grownUp.builds": "What it builds",
  "grownUp.why": "Why it is built this way",
  "grownUp.ask": "Ask after",
  "grownUp.askMore": "For an older child",
  "grownUp.source": "Source",
  "name.fallback.m": "the hero",
  "name.fallback.f": "the hero",
};

const HE: Record<BookStringKey, string> = {
  "reader.aria": "{title}",
  open: "לפתוח את הספר",
  next: "לעמוד הבא",
  back: "לעמוד הקודם",
  close: "לסגור את הספר",
  go: "את זה!",
  choose: "לבחור",
  theEnd: "הסוף",
  readAgain: "לקרוא שוב",
  "choices.aria": "מה יקרה עכשיו?",
  "repair.tap": "להקיש",
  picture: "התמונה",
  hearTitle: "לשמוע את השם",
  "sound.on": "הצליל פועל",
  "sound.off": "הצליל כבוי",
  grownUp: "להורים",
  "grownUp.builds": "מה הסיפור בונה",
  "grownUp.why": "למה הוא בנוי כך",
  "grownUp.ask": "שאלה אחרי הקריאה",
  "grownUp.askMore": "לילד גדול יותר",
  "grownUp.source": "מקור",
  "name.fallback.m": "הגיבור",
  "name.fallback.f": "הגיבורה",
};

export function bookString(key: BookStringKey, lang: "en" | "he", vars: Record<string, string> = {}): string {
  return (lang === "he" ? HE[key] : EN[key]).replace(/\{(\w+)\}/g, (_m, k: string) => vars[k] ?? "");
}

/** Test seam: both dictionaries. */
export const BOOK_STRINGS = { en: EN, he: HE } as const;
