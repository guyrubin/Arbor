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
    listGuideList: "הרשימה",
    listGuideListSub: "מסמנים כל פריט",
    listGuideTools: "האחרון, וכלים",
    listGuideToolsSub: "שינוי, הוספה, לידה מוקדמת",
    listGuideCheck: "בדיקת התפתחות",
    listGuideCheckSub: "פחות מ־4 דקות",
  },
};

export const milestonesV10Copy = (uiLang: string): MilestonesV10Copy => MILESTONES_V10_COPY[uiLang === "he" ? "he" : "en"];
