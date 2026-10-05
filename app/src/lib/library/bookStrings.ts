/**
 * lib/library/bookStrings — B-BOOK-04: the reader's chrome strings, EN + HE,
 * in the elevation-dictionary pattern (lib/i18nElevation/*: one typed key set,
 * two Records, one accessor), kept beside the library so the new reader adds
 * no line to the shared lib/i18n.ts. No number, no score, no "right/wrong".
 * HE: native review owed (lane A §3.10); infinitives for actions, so one
 * string serves both genders.
 */
export type BookStringKey =
  | "reader.aria"
  | "open"
  | "next"
  | "back"
  | "close"
  | "go"
  | "theEnd"
  | "choices.aria"
  | "repair.tap"
  | "picture"
  | "name.fallback.m"
  | "name.fallback.f";

const EN: Record<BookStringKey, string> = {
  "reader.aria": "{title}",
  open: "Open the book",
  next: "Next page",
  back: "Previous page",
  close: "Close the book",
  go: "This one!",
  theEnd: "The End",
  "choices.aria": "What will happen next?",
  "repair.tap": "Tap",
  picture: "The picture",
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
  theEnd: "הסוף",
  "choices.aria": "מה יקרה עכשיו?",
  "repair.tap": "להקיש",
  picture: "התמונה",
  "name.fallback.m": "הגיבור",
  "name.fallback.f": "הגיבורה",
};

export function bookString(key: BookStringKey, lang: "en" | "he", vars: Record<string, string> = {}): string {
  return (lang === "he" ? HE[key] : EN[key]).replace(/\{(\w+)\}/g, (_m, k: string) => vars[k] ?? "");
}

/** Test seam: both dictionaries. */
export const BOOK_STRINGS = { en: EN, he: HE } as const;
