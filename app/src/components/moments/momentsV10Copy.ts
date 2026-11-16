/**
 * Design system v10.3 — the new words on the My child frame (Moments, Hard
 * moments, Things <name> said), in both languages. Production strings stay in
 * their i18n modules (companion.moments.*, kept.*, elev.shelfJournal.*, beh.*,
 * lang.*); only what the frame adds lives here.
 * Pattern: components/companion/nowViewCopy.ts (one object, `en` and `he`).
 */
export type MomentsV10Copy = {
  onThisPage: string;
  startHere: string;
  kicker: string;
  /** The page's h1, per view. */
  headline: { areas: string; time: string; places: string; reader: string };
  sub: { areas: string; time: string; places: string; reader: string };
  guide: { kinds: string; kindsSub: string; stage: (view: string) => string; stageSub: string; kindsShort: string };
  /** The band's figure: marks across areas on the moments in view. */
  marksUnit: (moments: number) => string;
  momentsUnit: (moments: number) => string;
  since: (date: string, range: string) => string;
  kindMeta: { all: (range: string) => string; kept: string; hardSettled: string; hardSome: (n: number) => string; said: (name: string) => string };
  allMoments: string;
  howToRead: string;
  steps: { pick: string; read: string; newest: string };
  keyMoment: string;
  keyNone: string;
  keptTitle: string;
  keptSub: string;
  newest: string;
  youWrote: (when: string) => string;
  shelfIs: (shelf: string) => string;
  arborSuggests: string;
  canMove: string;
  onTheMap: string;
  seeOnMap: string;
  moveShelf: string;
  moved: string;
  moveFailed: string;
  nothingNewest: string;
  tokenMoment: string;
  tokenHard: string;
  links: string;
  area: string;
  total: string;
  noRecordAria: (area: string, month: string) => string;
  logHard: string;
};

export const MOMENTS_V10_COPY: Readonly<Record<"en" | "he", MomentsV10Copy>> = {
  en: {
    onThisPage: "On this page",
    startHere: "Start here",
    kicker: "My child · Moments",
    headline: {
      areas: "What you kept, area by area.",
      time: "What you kept, month by month.",
      places: "What you kept, place by place.",
      reader: "Everything you kept, month by month.",
    },
    sub: {
      areas: "A moment can sit in more than one area.",
      time: "Newest month first. Open a moment to see where it came from.",
      places: "Only the places you recorded.",
      reader: "The Year book, with every page you can print or send.",
    },
    guide: { kinds: "The kinds", kindsSub: "Pick one", stage: (view) => view, stageSub: "Then the newest", kindsShort: "Kinds" },
    marksUnit: (moments) => `marks on your ${moments} ${moments === 1 ? "moment" : "moments"}`,
    momentsUnit: (moments) => (moments === 1 ? "moment you kept" : "moments you kept"),
    since: (date, range) => `since ${date}, ${range.toLowerCase()}`,
    kindMeta: {
      all: (range) => `Area by month, ${range.toLowerCase()}`,
      kept: "The Year book and your journal",
      hardSettled: "You marked each one settled",
      hardSome: (n) => (n === 1 ? "1 you marked settled" : `${n} you marked settled`),
      said: (name) => `All of ${name}'s words`,
    },
    allMoments: "All moments",
    howToRead: "How to read this page",
    steps: { pick: "Pick a kind", read: "Read area by month", newest: "Open the newest" },
    keyMoment: "A moment you kept",
    keyNone: "No record",
    keptTitle: "Kept things and the Year book",
    keptSub: "One reader for everything you kept.",
    newest: "The newest moment",
    youWrote: (when) => `You wrote · ${when}`,
    shelfIs: (shelf) => `Shelf: ${shelf}`,
    arborSuggests: "Arbor suggests",
    canMove: "you can move it",
    onTheMap: "Shows on the milestone map under",
    seeOnMap: "See it on the map",
    moveShelf: "Move shelf",
    moved: "Moved. It sits on the new shelf now.",
    moveFailed: "That didn't save. Try again in a moment.",
    nothingNewest: "Nothing kept yet.",
    tokenMoment: "moment you kept",
    tokenHard: "hard moment",
    links: "More ways to read the record",
    area: "Area",
    total: "Total",
    noRecordAria: (area, month) => `${area}, ${month}: no record`,
    logHard: "Log a hard moment",
  },
  he: {
    onThisPage: "בעמוד הזה",
    startHere: "מתחילים כאן",
    kicker: "הילד שלי · רגעים",
    headline: {
      areas: "מה ששמרתם, תחום אחר תחום.",
      time: "מה ששמרתם, חודש אחר חודש.",
      places: "מה ששמרתם, מקום אחר מקום.",
      reader: "כל מה ששמרתם, חודש אחר חודש.",
    },
    sub: {
      areas: "רגע אחד יכול להופיע ביותר מתחום אחד.",
      time: "החודש האחרון קודם. פותחים רגע כדי לראות מאיפה הגיע.",
      places: "רק המקומות שציינתם.",
      reader: "ספר השנה, עם כל עמוד שאפשר להדפיס או לשלוח.",
    },
    guide: { kinds: "הסוגים", kindsSub: "בוחרים אחד", stage: (view) => view, stageSub: "ואז האחרון", kindsShort: "סוגים" },
    marksUnit: (moments) => (moments === 1 ? "סימונים על הרגע ששמרתם" : `סימונים על ${moments} הרגעים ששמרתם`),
    momentsUnit: (moments) => (moments === 1 ? "רגע ששמרתם" : "רגעים ששמרתם"),
    since: (date, range) => `מאז ${date}, ${range}`,
    kindMeta: {
      all: (range) => `תחום לפי חודש, ${range}`,
      kept: "ספר השנה והיומן שלכם",
      hardSettled: "סימנתם שכל אחד נרגע",
      hardSome: (n) => (n === 1 ? "אחד שסימנתם שנרגע" : `${n} שסימנתם שנרגעו`),
      said: (name) => `כל המילים של ${name}`,
    },
    allMoments: "כל הרגעים",
    howToRead: "איך לקרוא את העמוד",
    steps: { pick: "בוחרים סוג", read: "קוראים תחום לפי חודש", newest: "פותחים את האחרון" },
    keyMoment: "רגע ששמרתם",
    keyNone: "אין תיעוד",
    keptTitle: "דברים ששמרתם וספר השנה",
    keptSub: "מקום אחד לקרוא בו את כל מה ששמרתם.",
    newest: "הרגע האחרון",
    youWrote: (when) => `כתבתם · ${when}`,
    shelfIs: (shelf) => `מדף: ${shelf}`,
    arborSuggests: "ארבור מציעה",
    canMove: "אפשר להעביר",
    onTheMap: "מופיע במפת אבני הדרך תחת",
    seeOnMap: "לראות במפה",
    moveShelf: "להעביר מדף",
    moved: "הועבר. עכשיו הוא על המדף החדש.",
    moveFailed: "זה לא נשמר. נסו שוב בעוד רגע.",
    nothingNewest: "עדיין לא נשמר כלום.",
    tokenMoment: "רגע ששמרתם",
    tokenHard: "רגע קשה",
    links: "דרכים נוספות לקרוא את התיעוד",
    area: "תחום",
    total: "סך הכול",
    noRecordAria: (area, month) => `${area}, ${month}: אין תיעוד`,
    logHard: "לתעד רגע קשה",
  },
};
