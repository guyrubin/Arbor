/**
 * v10.1 — the words the Milestones screens add around production's own.
 * Production strings stay where they are (lib/i18nCompanion, lib/i18n); this
 * holds only the guide, the section names, the reading key and the figure
 * units the new composition needs, in English and Hebrew.
 */
export interface MilestonesV10Copy {
  onThisPage: string;
  startHere: string;
  viewLabel: string;
  map: string;
  list: string;
  indexLabel: string;
  guideAreas: string;
  guideAreasSub: string;
  guideArea: string;
  guideAreaSub: string;
  guideWords: string;
  guideWordsSub: string;
  guideNext: string;
  guideNextSub: string;
  wordsTitle: string;
  everyItem: string;
  nextTitle: string;
  allMilestones: string;
  seenUnitOne: string;
  seenUnitMany: string;
  hubUnit: string;
  hubAreasOne: string;
  hubAreasMany: string;
  readTitle: string;
  readPick: string;
  readDates: string;
  readMark: string;
  arborSuggests: string;
  today: string;
  timelineLabel: string;
  seenHere: string;
  first: string;
  latest: string;
  daysAgo: string;
  firstOne: string;
  daysAfter: string;
  dayOne: string;
  daysMany: string;
  newest: string;
  kicker: string;
  since: string;
  lastShort: string;
  guideAreasShort: string;
  guideAreaShort: string;
  guideWordsShort: string;
  guideNextShort: string;
  tilesHint: string;
  nextToNotice: string;
  earlierLater: string;
  earlier: string;
  later: string;
  byAge: string;
  nothingYet: string;
  markSeen: string;
  leafSub: string;
  checkName: string;
  checkLine: string;
  checkNotYet: string;
  inYourWords: string;
  onShelf: string;
  openAbout: string;
  worthKnowing: string;
  worthKnowingAt: string;
  ageWords: readonly string[];
  readMarkEach: string;
  readCheckWhole: string;
  latestTitle: string;
  notOnList: string;
  notOnListSub: string;
  checkSection: string;
  listShort: string;
  toolsShort: string;
  checkShort: string;
  listGuideList: string;
  listGuideListSub: string;
  listGuideTools: string;
  listGuideToolsSub: string;
  listGuideCheck: string;
  listGuideCheckSub: string;
}

export const MILESTONES_V10_COPY: Readonly<Record<"en" | "he", MilestonesV10Copy>> = {
  en: {
    onThisPage: "On this page",
    startHere: "Start here",
    viewLabel: "Milestones view",
    map: "Map",
    list: "List",
    indexLabel: "Pick an area",
    guideAreas: "The areas",
    guideAreasSub: "Pick one",
    guideArea: "That area",
    guideAreaSub: "Its dates, what is next",
    guideWords: "In your words",
    guideWordsSub: "Strength, moment",
    guideNext: "Notice next",
    guideNextSub: "The other areas",
    wordsTitle: "In your words",
    everyItem: "Every item",
    nextTitle: "What to notice next",
    allMilestones: "All milestones",
    seenUnitOne: "thing seen",
    seenUnitMany: "things seen",
    hubUnit: "things you have seen",
    hubAreasOne: "in one area",
    hubAreasMany: "in {n} areas",
    readTitle: "How to read this page",
    readPick: "Pick an area",
    readDates: "Read its dates",
    readMark: "Mark the next",
    arborSuggests: "Arbor suggests",
    today: "Today",
    timelineLabel: "What you marked Seen it in this area, by date",
    seenHere: "seen here",
    first: "First",
    latest: "Latest",
    daysAgo: "{n} ago",
    firstOne: "first one",
    daysAfter: "{n} after",
    dayOne: "1 day",
    daysMany: "{n} days",
    newest: "Newest",
    kicker: "My child · Milestones",
    since: "since {date}",
    lastShort: "Last",
    guideAreasShort: "Areas",
    guideAreaShort: "Area",
    guideWordsShort: "Words",
    guideNextShort: "Next",
    tilesHint: "Tap an area to open it and mark what you have seen. A blank means no record, not a missing ability.",
    nextToNotice: "Next to notice",
    earlierLater: "Earlier and later",
    earlier: "Earlier",
    later: "Later",
    byAge: "by {age}",
    nothingYet: "Nothing recorded yet",
    markSeen: "Mark what you have seen",
    leafSub: "Each thing you mark Seen it puts a leaf here, on its date.",
    checkName: "5-minute development check",
    checkLine: "{n} quick questions · under 4 minutes",
    checkNotYet: "Not done yet. Results write into these same areas.",
    inYourWords: "in your words",
    onShelf: "on the {shelf} shelf",
    openAbout: "Open About {name}",
    worthKnowing: "Worth knowing",
    worthKnowingAt: "Worth knowing at {age}",
    ageWords: ["", "one", "two", "three", "four", "five", "six"],
    readMarkEach: "Mark each one",
    readCheckWhole: "Check the whole",
    latestTitle: "{name}'s latest milestone",
    notOnList: "Not on the list?",
    notOnListSub: "Add something you saw. It joins the area you choose.",
    checkSection: "The Development Check",
    listShort: "List",
    toolsShort: "Tools",
    checkShort: "Check",
    listGuideList: "The list",
    listGuideListSub: "Mark each item",
    listGuideTools: "Latest, and tools",
    listGuideToolsSub: "Change, add, born early",
    listGuideCheck: "Development check",
    listGuideCheckSub: "Under 4 minutes",
  },
  he: {
    onThisPage: "בעמוד הזה",
    startHere: "מתחילים כאן",
    viewLabel: "תצוגת אבני הדרך",
    map: "מפה",
    list: "רשימה",
    indexLabel: "בחירת תחום",
    guideAreas: "התחומים",
    guideAreasSub: "בוחרים אחד",
    guideArea: "התחום הזה",
    guideAreaSub: "התאריכים שלו, ומה הלאה",
    guideWords: "במילים שלכם",
    guideWordsSub: "חוזקה, רגע",
    guideNext: "מה לשים לב אליו",
    guideNextSub: "שאר התחומים",
    wordsTitle: "במילים שלכם",
    everyItem: "כל הפריטים",
    nextTitle: "מה לשים לב אליו עכשיו",
    allMilestones: "כל אבני הדרך",
    seenUnitOne: "דבר שראיתם",
    seenUnitMany: "דברים שראיתם",
    hubUnit: "דברים שראיתם",
    hubAreasOne: "בתחום אחד",
    hubAreasMany: "ב־{n} תחומים",
    readTitle: "איך לקרוא את העמוד",
    readPick: "בוחרים תחום",
    readDates: "קוראים את התאריכים",
    readMark: "מסמנים את הבא",
    arborSuggests: "ארבור מציע",
    today: "היום",
    timelineLabel: "מה שסימנתם ״ראיתי״ בתחום הזה, לפי תאריך",
    seenHere: "ראיתם כאן",
    first: "ראשון",
    latest: "אחרון",
    daysAgo: "לפני {n}",
    firstOne: "הראשון",
    daysAfter: "{n} אחרי",
    dayOne: "יום אחד",
    daysMany: "{n} ימים",
    newest: "החדש ביותר",
    kicker: "הילד שלי · אבני דרך",
    since: "מאז {date}",
    lastShort: "אחרון",
    guideAreasShort: "תחומים",
    guideAreaShort: "תחום",
    guideWordsShort: "מילים",
    guideNextShort: "הבא",
    tilesHint: "לחיצה על תחום פותחת אותו, ושם מסמנים מה ראיתם. ריק = אין תיעוד, לא יכולת חסרה.",
    nextToNotice: "הבא לשים לב",
    earlierLater: "מוקדם יותר ומאוחר יותר",
    earlier: "מוקדם יותר",
    later: "מאוחר יותר",
    byAge: "עד גיל {age}",
    nothingYet: "עוד לא תועד דבר",
    markSeen: "סמנו מה ראיתם",
    leafSub: "כל דבר שתסמנו 'ראיתי' מוסיף כאן עלה, בתאריך שלו.",
    checkName: "בדיקת התפתחות של 5 דקות",
    checkLine: "{n} שאלות קצרות · פחות מ-4 דקות",
    checkNotYet: "עוד לא נעשתה. התוצאות נכתבות לאותם תחומים.",
    inYourWords: "במילים שלכם",
    onShelf: "במדף {shelf}",
    openAbout: "לפתוח את על {name}",
    worthKnowing: "כדאי לדעת",
    worthKnowingAt: "כדאי לדעת בגיל {age}",
    ageWords: ["", "שנה", "שנתיים", "שלוש", "ארבע", "חמש", "שש"],
    readMarkEach: "מסמנים כל אחד",
    readCheckWhole: "בודקים את התמונה כולה",
    latestTitle: "אבן הדרך האחרונה של {name}",
    notOnList: "לא ברשימה?",
    notOnListSub: "הוסיפו משהו שראיתם. הוא מצטרף לתחום שתבחרו.",
    checkSection: "בדיקת ההתפתחות",
    listShort: "רשימה",
    toolsShort: "כלים",
    checkShort: "בדיקה",
    listGuideList: "הרשימה",
    listGuideListSub: "מסמנים כל פריט",
    listGuideTools: "האחרון, וכלים",
    listGuideToolsSub: "שינוי, הוספה, לידה מוקדמת",
    listGuideCheck: "בדיקת התפתחות",
    listGuideCheckSub: "פחות מ־4 דקות",
  },
};

export const milestonesV10Copy = (uiLang: string): MilestonesV10Copy => MILESTONES_V10_COPY[uiLang === "he" ? "he" : "en"];
