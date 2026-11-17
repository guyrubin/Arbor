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
  /** The range as the band says it ("last 3 months"); null for everything. */
  rangeLast: { 3: string; 12: string; 0: string | null };
  /** The range control's words: "Time in view: 3 months". */
  timeInView: (label: string, range: string) => string;
  /** The areas caption under the index (what a cell and a blank mean). */
  capAreas: string;
  /** Stop 2 of the guide on the areas view (desk / phone). */
  guideAreas: string;
  guideAreasShort: string;
  /** The Things said tile: what it holds, in the family's languages. */
  saidMeta: (languages: string[]) => string;
  kindMeta: { all: (range: string) => string; kept: string; hardSettled: string; hardSome: (n: number) => string };
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
  said: {
    kicker: (name: string) => string;
    guideLangs: string; guideLangsSub: string; guideKept: string; guideKeptSub: string;
    figureUnit: (n: number) => string;
    allMeta: string;
    langMeta: (role: string) => string;
    cap: string;
    stage: string;
    steps: { pick: string; read: string; practise: string };
    keySaying: string;
    keyWord: string;
    /** The words row under one language's sayings (the vocabulary log, read only). */
    wordsIn: (language: string) => string;
    /** The sayings list is empty for the picked language. */
    noneIn: (language: string) => string;
    /** N-Said: the band's figure — the sayings kept, and the words beside them. */
    sayingsUnit: (n: number) => string;
    andWords: (n: number) => string;
    wordsAll: string;
    guideLangsShort: string;
    guideKeptShort: string;
    profile: string;
    /** N-SaidHe: under one language, the caption and the stage head say so. */
    capOne: (language: string) => string;
    onlyIn: (language: string) => string;
  };
  hard: {
    kicker: string;
    title: string;
    sub: string;
    guideEntries: string; guideEntriesSub: string; guideHour: string; guideHourSub: string;
    /** N-Hard: stop 1 names how many entries the index holds (desk / phone). */
    guideEntriesN: (n: number) => string;
    guideEntriesShort: (n: number) => string;
    guideHourShort: string;
    guideGuides: string; guideGuidesSub: string; guideGuidesShort: string;
    /** The stage's last-time card. */
    lastTime: string;
    lastUsed: string;
    wordsKept: string;
    /** Section 3's line under its heading. */
    guidesSub: string;
    figureUnit: (n: number) => string;
    allSettled: string;
    someSettled: (n: number) => string;
    settled: string;
    entriesLabel: string;
    cap: string;
    capFew: string;
    stage: string;
    selected: (when: string) => string;
    dialCenter: string;
    dialCaption: string;
    dialLabel: (hours: string) => string;
    noEntries: string;
    steps: { pick: string; read: string; use: string };
    keyHard: string;
    keyHelped: string;
    helped: string;
    helpedNone: string;
    helpedKey: string;
    dayAtAGlance: string;
    tokenHelped: string;
  };
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
    since: (date, range) => (range ? `since ${date}, ${range}` : `since ${date}`),
    rangeLast: { 3: "last 3 months", 12: "the last year", 0: null },
    timeInView: (label, range) => `${label}: ${range}`,
    capAreas: "Open a cell to see its moments. A blank means no record in that month, not a missing ability.",
    guideAreas: "Areas by month",
    guideAreasShort: "Months",
    saidMeta: (languages) => `Sayings and words, ${languages.length > 1 ? `${languages.slice(0, -1).join(", ")} and ${languages[languages.length - 1]}` : languages[0]}`,
    kindMeta: {
      all: (range) => (range ? `Area by month, ${range}` : "Area by month"),
      kept: "The Year book and your journal",
      hardSettled: "You marked each one settled",
      hardSome: (n) => (n === 1 ? "1 you marked settled" : `${n} you marked settled`),
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
    said: {
      kicker: (name) => `My child · Things ${name} said`,
      guideLangs: "The languages", guideLangsSub: "Pick one", guideKept: "What you kept", guideKeptSub: "Sayings, words, profile",
      figureUnit: (n) => (n === 1 ? "moment logged, by language" : "moments logged, by language"),
      allMeta: "Sayings and words together",
      langMeta: (role) => `${role} · moments logged`,
      cap: "Pick a language to see only its sayings. Each one is something you kept, in the words you wrote.",
      stage: "What you kept",
      steps: { pick: "Pick a language", read: "Read what you kept", practise: "Practise a little" },
      keySaying: "A saying",
      keyWord: "A word",
      wordsIn: (language) => `Words in ${language}`,
      noneIn: (language) => `No sayings kept in ${language} yet. Pick All to see every one.`,
      sayingsUnit: (n) => (n === 1 ? "saying" : "sayings"),
      andWords: (n) => (n === 1 ? "and 1 word, kept as said" : `and ${n} words, kept as said`),
      wordsAll: "Words, by language",
      guideLangsShort: "Languages",
      guideKeptShort: "Kept",
      profile: "Language profile",
      capOne: (language) => `Showing ${language} only. Each mark is one thing you kept.`,
      onlyIn: (language) => `${language} only`,
    },
    hard: {
      kicker: "My child · Hard moments",
      title: "Hard moments, in your words.",
      sub: "What you logged, and what helped.",
      guideEntries: "The newest", guideEntriesSub: "Pick an entry", guideHour: "Its hour", guideHourSub: "What helped, a step",
      guideEntriesN: (n) => (n === 3 ? "The three" : n === 2 ? "The two" : "The newest"),
      guideEntriesShort: (n) => (n === 3 ? "Three" : n === 2 ? "Two" : "Newest"),
      guideHourShort: "Hour",
      guideGuides: "Closest guides", guideGuidesSub: "Short reads", guideGuidesShort: "Guides",
      lastTime: "Last time, this helped",
      lastUsed: "Last time you used these words",
      wordsKept: "The words you used · kept with the moment",
      guidesSub: "Short guides, a pilot: adapt them to your child.",
      figureUnit: (n) => (n === 1 ? "hard moment" : "hard moments"),
      allSettled: "all settled, you marked each one",
      someSettled: (n) => (n === 1 ? "1 you marked settled" : `${n} you marked settled`),
      settled: "settled",
      entriesLabel: "Pick a hard moment",
      cap: "Pick an entry to see its hour.",
      capFew: "Pick an entry to see its hour. A few entries are very few: a rhythm needs more.",
      stage: "When they happened",
      selected: (when) => `${when} selected`,
      dialCenter: "hour of the day",
      dialCaption: "Hour of the day",
      dialLabel: (hours) => `Hour of the day of each hard moment you logged: ${hours}`,
      noEntries: "Nothing logged yet. When you log a hard moment, its hour shows here.",
      steps: { pick: "Pick an entry", read: "Read its hour", use: "Use what helped" },
      keyHard: "A hard moment you logged",
      keyHelped: "A time it helped",
      helped: "What helped, in your own log",
      helpedNone: "When you mark that a step helped, it shows here.",
      helpedKey: "One mark is one time you marked it helped.",
      dayAtAGlance: "Your day at a glance",
      tokenHelped: "step you marked helped",
    },
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
    since: (date, range) => (range ? `מאז ${date}, ${range}` : `מאז ${date}`),
    rangeLast: { 3: "שלושת החודשים האחרונים", 12: "השנה האחרונה", 0: null },
    timeInView: (label, range) => `${label}: ${range}`,
    capAreas: "פותחים משבצת כדי לראות את הרגעים שבה. משבצת ריקה פירושה שאין תיעוד באותו חודש, לא יכולת חסרה.",
    guideAreas: "תחומים לפי חודש",
    guideAreasShort: "חודשים",
    saidMeta: (languages) => `משפטים ומילים, ${languages.length > 1 ? `${languages.slice(0, -1).join(", ")} ו${languages[languages.length - 1]}` : languages[0]}`,
    kindMeta: {
      all: (range) => (range ? `תחום לפי חודש, ${range}` : "תחום לפי חודש"),
      kept: "ספר השנה והיומן שלכם",
      hardSettled: "סימנתם שכל אחד נרגע",
      hardSome: (n) => (n === 1 ? "אחד שסימנתם שנרגע" : `${n} שסימנתם שנרגעו`),
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
    said: {
      kicker: (name) => `הילד שלי · המילים של ${name}`,
      guideLangs: "השפות", guideLangsSub: "בוחרים אחת", guideKept: "מה ששמרתם", guideKeptSub: "משפטים, מילים, פרופיל",
      figureUnit: (n) => (n === 1 ? "רגע שתועד, לפי שפה" : "רגעים שתועדו, לפי שפה"),
      allMeta: "משפטים ומילים יחד",
      langMeta: (role) => `${role} · רגעים שתועדו`,
      cap: "בוחרים שפה כדי לראות רק את המשפטים בה. כל אחד הוא משהו ששמרתם, במילים שכתבתם.",
      stage: "מה ששמרתם",
      steps: { pick: "בוחרים שפה", read: "קוראים מה ששמרתם", practise: "מתרגלים קצת" },
      keySaying: "משפט",
      keyWord: "מילה",
      wordsIn: (language) => `מילים ב${language}`,
      noneIn: (language) => `עוד לא נשמרו משפטים ב${language}. בוחרים "הכול" כדי לראות את כולם.`,
      sayingsUnit: (n) => (n === 1 ? "משפט" : "משפטים"),
      andWords: (n) => (n === 1 ? "ומילה אחת, כפי שנאמרה" : `ו־${n} מילים, כפי שנאמרו`),
      wordsAll: "מילים, לפי שפה",
      guideLangsShort: "שפות",
      guideKeptShort: "נשמרו",
      profile: "פרופיל שפה",
      capOne: (language) => `מוצג רק ב${language}. כל סימן הוא דבר אחד ששמרתם.`,
      onlyIn: (language) => `רק ב${language}`,
    },
    hard: {
      kicker: "הילד שלי · רגעים קשים",
      title: "רגעים קשים, במילים שלכם.",
      sub: "מה שתיעדתם, ומה שעזר.",
      guideEntries: "האחרונים", guideEntriesSub: "בוחרים רשומה", guideHour: "השעה שלה", guideHourSub: "מה עזר, צעד",
      guideEntriesN: (n) => (n === 3 ? "שלושת האחרונים" : n === 2 ? "שני האחרונים" : "האחרונים"),
      guideEntriesShort: (n) => (n === 3 ? "שלושה" : n === 2 ? "שניים" : "אחרונים"),
      guideHourShort: "שעה",
      guideGuides: "המדריכים הקרובים", guideGuidesSub: "קריאה קצרה", guideGuidesShort: "מדריכים",
      lastTime: "בפעם הקודמת, זה עזר",
      lastUsed: "בפעם הקודמת השתמשתם במילים האלה",
      wordsKept: "המילים שבהן השתמשתם · נשמרו עם הרגע",
      guidesSub: "מדריכים קצרים, בפיילוט: התאימו לילד שלכם.",
      figureUnit: (n) => (n === 1 ? "רגע קשה" : "רגעים קשים"),
      allSettled: "כולם נרגעו, סימנתם כל אחד",
      someSettled: (n) => (n === 1 ? "אחד שסימנתם שנרגע" : `${n} שסימנתם שנרגעו`),
      settled: "נרגע",
      entriesLabel: "בוחרים רגע קשה",
      cap: "בוחרים רשומה כדי לראות את השעה שלה.",
      capFew: "בוחרים רשומה כדי לראות את השעה שלה. כמה רשומות הן מעט מאוד: קצב צריך יותר.",
      stage: "מתי זה קרה",
      selected: (when) => `${when} נבחר`,
      dialCenter: "שעה ביום",
      dialCaption: "שעה ביום",
      dialLabel: (hours) => `השעה ביום של כל רגע קשה שתיעדתם: ${hours}`,
      noEntries: "עדיין לא תועד כלום. כשמתעדים רגע קשה, השעה שלו מופיעה כאן.",
      steps: { pick: "בוחרים רשומה", read: "קוראים את השעה", use: "משתמשים במה שעזר" },
      keyHard: "רגע קשה שתיעדתם",
      keyHelped: "פעם שזה עזר",
      helped: "מה עזר, ביומן שלכם",
      helpedNone: "כשמסמנים שצעד עזר, הוא מופיע כאן.",
      helpedKey: "כל סימן הוא פעם אחת שסימנתם שזה עזר.",
      dayAtAGlance: "היום שלכם במבט אחד",
      tokenHelped: "צעד שסימנתם שעזר",
    },
  },
};
