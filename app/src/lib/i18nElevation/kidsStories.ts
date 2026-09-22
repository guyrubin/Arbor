export type KidsStoriesKey =
  | "shelf.title" | "shelf.subtitle" | "shelf.empty" | "shelf.emptyHint"
  | "shelf.loading" | "shelf.read" | "shelf.unavailable" | "shelf.unavailableShort" | "shelf.back"
  | "reader.page" | "reader.end" | "reader.endBody" | "reader.again" | "reader.back" | "reader.previous"
  | "journey.beat" | "journey.decision" | "journey.back" | "journey.next" | "journey.end"
  | "journey.cover" | "journey.coverAlt" | "journey.pageAlt" | "journey.heroAlt" | "journey.heroAltUnnamed"
  | "journey.childEndingTitle" | "journey.childEndingBody" | "journey.childReflection"
  | "journey.finish" | "journey.saved" | "journey.backStories"
  | "journey.comicSaved" | "page.smudged" | "page.redraw" | "page.drawing";

const EN: Record<KidsStoriesKey, string> = {
  "shelf.title": "Hero Comics",
  "shelf.subtitle": "Comics a grown-up saved for you",
  "shelf.empty": "Your comic shelf is waiting",
  "shelf.emptyHint": "A grown-up can prepare and save a comic for you.",
  "shelf.loading": "Opening the bookshelf…",
  "shelf.read": "Read",
  "shelf.unavailable": "This comic is not available on this device right now.",
  "shelf.unavailableShort": "Unavailable",
  "shelf.back": "Back home",
  "reader.page": "Page {current} of {total}",
  "reader.end": "The End!",
  "reader.endBody": "You reached the end of this comic.",
  "reader.again": "Read again",
  "reader.back": "Back to comics",
  "reader.previous": "Previous page",
  "journey.beat": "Beat {current} of {total}",
  "journey.cover": "Cover",
  "journey.coverAlt": "Cover: {title}",
  "journey.pageAlt": "Page {number}: {title}",
  "journey.heroAlt": "{name}, the hero of this story",
  "journey.heroAltUnnamed": "The hero of this story",
  "journey.decision": "What do you do, {name}?",
  "journey.back": "Back",
  "journey.next": "Next",
  "journey.end": "The End",
  "journey.childEndingTitle": "You found a way through!",
  "journey.childEndingBody": "Your choice helped the story move forward.",
  "journey.childReflection": "Want to think about one more thing?",
  "journey.finish": "Finish story",
  "journey.saved": "Story saved",
  "journey.backStories": "Back to stories",
  "journey.comicSaved": "Your comic is on your shelf",
  "page.smudged": "This page got a bit smudged.",
  "page.redraw": "Redraw page",
  "page.drawing": "Drawing the next page…",
};

const HE: Record<KidsStoriesKey, string> = {
  "shelf.title": "קומיקס הגיבורים",
  "shelf.subtitle": "קומיקסים שמבוגר שמר בשבילכם",
  "shelf.empty": "מדף הקומיקס שלכם מחכה",
  "shelf.emptyHint": "מבוגר יכול להכין ולשמור קומיקס בשבילכם.",
  "shelf.loading": "פותחים את מדף הספרים…",
  "shelf.read": "לקרוא",
  "shelf.unavailable": "הקומיקס הזה לא זמין במכשיר הזה כרגע.",
  "shelf.unavailableShort": "לא זמין",
  "shelf.back": "חזרה הביתה",
  "reader.page": "עמוד {current} מתוך {total}",
  "reader.end": "הסוף!",
  "reader.endBody": "הגעתם לסוף הקומיקס.",
  "reader.again": "לקרוא שוב",
  "reader.back": "חזרה לקומיקסים",
  "reader.previous": "לעמוד הקודם",
  "journey.beat": "קטע {current} מתוך {total}",
  "journey.cover": "עטיפה",
  "journey.coverAlt": "עטיפה: {title}",
  "journey.pageAlt": "עמוד {number}: {title}",
  "journey.heroAlt": "{name}, הגיבור/ה של הסיפור הזה",
  "journey.heroAltUnnamed": "הגיבור/ה של הסיפור הזה",
  "journey.decision": "מה עושים, {name}?",
  "journey.back": "חזרה",
  "journey.next": "הבא",
  "journey.end": "הסוף",
  "journey.childEndingTitle": "מצאתם דרך להמשיך!",
  "journey.childEndingBody": "הבחירה שלכם עזרה לסיפור להתקדם.",
  "journey.childReflection": "רוצים לחשוב על עוד דבר אחד?",
  "journey.finish": "לסיים את הסיפור",
  "journey.saved": "הסיפור נשמר",
  "journey.backStories": "חזרה לסיפורים",
  "journey.comicSaved": "הקומיקס שלכם על המדף",
  "page.smudged": "העמוד הזה קצת נמרח.",
  "page.redraw": "לצייר שוב",
  "page.drawing": "מציירים את העמוד הבא…",
};

/** Registry shape for the dictionary firewall (i18nElevation/index.ts MODULES). */
export const en: Record<string, string> = EN;
export const he: Record<string, string> = HE;

export function kidsStoriesText(key: KidsStoriesKey, lang: "en" | "he", vars: Record<string, string | number> = {}): string {
  return (lang === "he" ? HE[key] : EN[key]).replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ""));
}
