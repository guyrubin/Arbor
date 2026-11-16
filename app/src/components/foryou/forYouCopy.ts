/**
 * Surface-owned copy for For you, the parent (v10): the guide, the pick's
 * thread, Courses by area, Your programs and More to read. Production strings
 * (the pick's why-lines, course labels, the age switch, the family door) stay
 * in lib/i18n*; this module holds only what the v10 composition adds.
 */
export const FOR_YOU_COPY = {
  en: {
    onThisPage: "On this page",
    guideToday: "For today",
    guideTodaySub: (min: number) => `1 pick, ${min} min to read`,
    guideTodayNone: "Today's pick",
    guideCourses: "Courses by area",
    guideCoursesSub: (n: number, name: string) => (name ? `${n} for ${name}'s age` : `${n} for your child's age`),
    guidePrograms: "Your programs",
    guideProgramsSub: "This week's step",
    guideProgramsNone: "Two to choose from",
    guideMore: "More to read",
    guideMoreSub: "The Library, a family ritual",
    pickKicker: (min: number) => `Today's pick · ${min} min to read`,
    pickKickerCourse: (min: number) => `Next course · ${min} min`,
    startHere: "Start here",
    arborSuggests: "Arbor suggests",
    thisWeeksPractice: "This week's practice",
    practiceLine: (program: string, n: number, title: string) => `${program}, week ${n}: ${title}`,
    coursesForAge: (n: number, name: string) => (name ? `${n} courses for ${name}'s age` : `${n} courses for your child's age`),
    coursesAll: (n: number) => `${n} courses`,
    allCourses: (n: number) => `All ${n} courses`,
    fewerCourses: "Fewer courses",
    lessonsMin: (lessons: number, min: number) => `${lessons} lessons · ${min} min`,
    programWeeks: (total: number) => `of ${total} weeks`,
    programThisWeek: (title: string) => `This week: ${title}`,
    programPin: "This week",
    programPaused: "Paused",
    weekDone: (n: number) => `Week ${n}, done`,
    weekNow: (n: number) => `Week ${n}, this week`,
    weekAhead: (n: number) => `Week ${n}, ahead`,
    weekOf: (n: number, total: number) => `Week ${n} of ${total}`,
    openThisWeek: "Open this week",
    openProgram: (name: string) => `Open ${name}`,
    programsRunningSub: "One small practice a week",
    seeProgram: "See the program",
    programWeeksTotal: (n: number) => `${n} weeks`,
    libraryTitle: "All reads, in the Library",
    librarySub: (n: number, name: string) =>
      name ? `${n} short reads for ${name}'s age, by area, with search and Saved.` : `${n} short reads for your child's age, by area, with search and Saved.`,
  },
  he: {
    onThisPage: "בעמוד הזה",
    guideToday: "להיום",
    guideTodaySub: (min: number) => `בחירה אחת, ${min} דק׳ קריאה`,
    guideTodayNone: "הבחירה של היום",
    guideCourses: "קורסים לפי תחום",
    guideCoursesSub: (n: number, name: string) => (name ? `${n} לגיל של ${name}` : `${n} לגיל של הילד`),
    guidePrograms: "התוכניות שלכם",
    guideProgramsSub: "הצעד של השבוע",
    guideProgramsNone: "שתיים לבחירה",
    guideMore: "עוד לקרוא",
    guideMoreSub: "הספרייה, טקס משפחתי",
    pickKicker: (min: number) => `הבחירה של היום · ${min} דק׳ קריאה`,
    pickKickerCourse: (min: number) => `הקורס הבא · ${min} דק׳`,
    startHere: "מתחילים כאן",
    arborSuggests: "הצעה של Arbor",
    thisWeeksPractice: "התרגול של השבוע",
    practiceLine: (program: string, n: number, title: string) => `${program}, שבוע ${n}: ${title}`,
    coursesForAge: (n: number, name: string) => (name ? `${n} קורסים לגיל של ${name}` : `${n} קורסים לגיל של הילד`),
    coursesAll: (n: number) => `${n} קורסים`,
    allCourses: (n: number) => `כל ${n} הקורסים`,
    fewerCourses: "פחות קורסים",
    lessonsMin: (lessons: number, min: number) => `${lessons} שיעורים · ${min} דק׳`,
    programWeeks: (total: number) => `מתוך ${total} שבועות`,
    programThisWeek: (title: string) => `השבוע: ${title}`,
    programPin: "השבוע",
    programPaused: "בהשהיה",
    weekDone: (n: number) => `שבוע ${n}, הושלם`,
    weekNow: (n: number) => `שבוע ${n}, השבוע`,
    weekAhead: (n: number) => `שבוע ${n}, בהמשך`,
    weekOf: (n: number, total: number) => `שבוע ${n} מתוך ${total}`,
    openThisWeek: "לפתוח את השבוע",
    openProgram: (name: string) => `לפתוח את ${name}`,
    programsRunningSub: "תרגול קטן אחד בשבוע",
    seeProgram: "לפרטי התוכנית",
    programWeeksTotal: (n: number) => `${n} שבועות`,
    libraryTitle: "כל הקריאות, בספרייה",
    librarySub: (n: number, name: string) =>
      name ? `${n} קריאות קצרות לגיל של ${name}, לפי תחום, עם חיפוש ושמורים.` : `${n} קריאות קצרות לגיל של הילד, לפי תחום, עם חיפוש ושמורים.`,
  },
} as const;

export type ForYouCopy = (typeof FOR_YOU_COPY)["en"];

export function forYouCopy(uiLang: string): ForYouCopy {
  return (uiLang === "he" ? FOR_YOU_COPY.he : FOR_YOU_COPY.en) as ForYouCopy;
}
