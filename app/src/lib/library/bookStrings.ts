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
  | "grownUp.knows"
  | "grownUp.builds"
  | "grownUp.whyNow"
  | "grownUp.why"
  | "grownUp.tomorrow"
  | "grownUp.ask"
  | "grownUp.askMore"
  | "grownUp.together"
  | "grownUp.source"
  | "grownUp.planSteps"
  | "grownUp.watchFor"
  | "grownUp.sources"
  | "grownUp.firstWeek"
  | "name.fallback.m"
  | "name.fallback.f"
  // B-BOOK-45: the bedtime ending (kid register: no count, no streak)
  | "goodnight"
  // B-BOOK-46: reading together — the PARENT register, shown only in Together
  | "together.label"
  | "together.cover"
  | "together.decision"
  | "together.branch"
  | "together.rejoin";

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
  "grownUp.knows": "What the story knows",
  "grownUp.builds": "What it builds",
  "grownUp.whyNow": "Why it matters at five, this week",
  "grownUp.why": "Why it is built this way",
  "grownUp.tomorrow": "One thing to do tomorrow",
  "grownUp.ask": "Ask after",
  "grownUp.askMore": "Ask after, optional (5–7)",
  "grownUp.together": "Reading together",
  "grownUp.source": "Source note",
  "grownUp.planSteps": "The plan, as you will do it",
  "grownUp.watchFor": "When this plan is not the answer: talk to your doctor if",
  "grownUp.sources": "Where the steps come from",
  "grownUp.firstWeek": "The first week",
  "name.fallback.m": "the hero",
  "name.fallback.f": "the hero",
  goodnight: "Goodnight",
  "together.label": "Ask together",
  "together.cover": "Before you open it: what do you think this story is about?",
  "together.decision": "Pause here. Which one would you choose, and why?",
  "together.branch": "What happened because of that choice?",
  "together.rejoin": "What will they remember from today?",
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
  "grownUp.knows": "מה הסיפור יודע",
  "grownUp.builds": "מה הסיפור בונה",
  "grownUp.whyNow": "למה זה חשוב בגיל חמש, השבוע",
  "grownUp.why": "למה הוא בנוי כך",
  "grownUp.tomorrow": "דבר אחד לעשות מחר",
  "grownUp.ask": "שאלה אחרי הקריאה",
  "grownUp.askMore": "שאלה נוספת, לבחירה (5–7)",
  "grownUp.together": "כשקוראים יחד",
  "grownUp.source": "הערת מקור",
  "grownUp.planSteps": "התוכנית, כמו שתעשו אותה",
  "grownUp.watchFor": "כשהתוכנית הזאת היא לא התשובה: דברו עם הרופא אם",
  "grownUp.sources": "מאיפה השלבים מגיעים",
  "grownUp.firstWeek": "השבוע הראשון",
  "name.fallback.m": "הגיבור",
  "name.fallback.f": "הגיבורה",
  goodnight: "לילה טוב",
  "together.label": "לשאול יחד",
  "together.cover": "לפני שפותחים: על מה הסיפור, לדעתך?",
  "together.decision": "עוצרים כאן. מה היית עושה, ולמה?",
  "together.branch": "מה קרה בגלל הבחירה הזאת?",
  "together.rejoin": "מה יזכרו מהיום הזה?",
};

export function bookString(key: BookStringKey, lang: "en" | "he", vars: Record<string, string> = {}): string {
  return (lang === "he" ? HE[key] : EN[key]).replace(/\{(\w+)\}/g, (_m, k: string) => vars[k] ?? "");
}

/** Test seam: both dictionaries. */
export const BOOK_STRINGS = { en: EN, he: HE } as const;
