/**
 * v10.1 — the words the Milestones screens add around production's own.
 * Production strings stay where they are (lib/i18nCompanion, lib/i18n); this
 * holds only the guide, the section names and the figure units the new
 * composition needs, in English and Hebrew.
 */
export interface MilestonesV10Copy {
  onThisPage: string;
  startHere: string;
  viewLabel: string;
  map: string;
  list: string;
  guideMap: string;
  guideMapSub: string;
  guideWords: string;
  guideWordsSub: string;
  guideArea: string;
  guideNext: string;
  guideNextSub: string;
  wordsTitle: string;
  wordsSub: string;
  areaKicker: string;
  allAreas: string;
  nextTitle: string;
  allMilestones: string;
  seenUnitOne: string;
  seenUnitMany: string;
  hubUnit: string;
  hubAreasOne: string;
  hubAreasMany: string;
  listGuideList: string;
  listGuideListSub: string;
  listGuideTools: string;
  listGuideToolsSub: string;
  listGuideCheck: string;
  listMapKicker: string;
  listGuideCheckSub: string;
}

export const MILESTONES_V10_COPY: Readonly<Record<"en" | "he", MilestonesV10Copy>> = {
  en: {
    onThisPage: "On this page",
    startHere: "Start here",
    viewLabel: "Milestones view",
    map: "Map",
    list: "List",
    guideMap: "The map",
    guideMapSub: "Eight areas",
    guideWords: "In your words",
    guideWordsSub: "A strength, a moment, your focus",
    guideArea: "One area, opened",
    guideNext: "Notice next",
    guideNextSub: "One tap each",
    wordsTitle: "In your words",
    wordsSub: "A strength, a moment you kept, what you are working on.",
    areaKicker: "One area, opened",
    allAreas: "All eight areas",
    nextTitle: "What to notice next",
    allMilestones: "All milestones",
    seenUnitOne: "thing seen",
    seenUnitMany: "things seen",
    hubUnit: "things you have seen",
    hubAreasOne: "in one area",
    hubAreasMany: "in {n} areas",
    listGuideList: "The list",
    listGuideListSub: "Every area, shelf by shelf",
    listGuideTools: "Latest, and tools",
    listGuideToolsSub: "Change, add, born early",
    listGuideCheck: "Development check",
    listMapKicker: "My child · Milestones",
    listGuideCheckSub: "Under 4 minutes",
  },
  he: {
    onThisPage: "בעמוד הזה",
    startHere: "מתחילים כאן",
    viewLabel: "תצוגת אבני הדרך",
    map: "מפה",
    list: "רשימה",
    guideMap: "המפה",
    guideMapSub: "שמונה תחומים",
    guideWords: "במילים שלכם",
    guideWordsSub: "חוזקה, רגע, המיקוד שלכם",
    guideArea: "תחום אחד, פתוח",
    guideNext: "מה לשים לב אליו",
    guideNextSub: "נגיעה אחת לכל אחד",
    wordsTitle: "במילים שלכם",
    wordsSub: "חוזקה, רגע ששמרתם, ומה שאתם עובדים עליו.",
    areaKicker: "תחום אחד, פתוח",
    allAreas: "כל שמונת התחומים",
    nextTitle: "מה לשים לב אליו עכשיו",
    allMilestones: "כל אבני הדרך",
    seenUnitOne: "דבר שראיתם",
    seenUnitMany: "דברים שראיתם",
    hubUnit: "דברים שראיתם",
    hubAreasOne: "בתחום אחד",
    hubAreasMany: "ב־{n} תחומים",
    listGuideList: "הרשימה",
    listGuideListSub: "כל תחום, מדף אחר מדף",
    listGuideTools: "האחרון, וכלים",
    listGuideToolsSub: "שינוי, הוספה, לידה מוקדמת",
    listGuideCheck: "בדיקת התפתחות",
    listMapKicker: "הילד שלי · אבני דרך",
    listGuideCheckSub: "פחות מ־4 דקות",
  },
};

export const milestonesV10Copy = (uiLang: string): MilestonesV10Copy => MILESTONES_V10_COPY[uiLang === "he" ? "he" : "en"];
