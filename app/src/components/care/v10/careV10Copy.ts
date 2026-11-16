/* Care, together (design v10.1): the words the new composition adds — the
   guide stops, section heads and the scene's units. Production's own labels
   stay in the i18n tables and are read through t(); nothing here renames a
   production thing. Both locales are first-class (pattern: nowViewCopy). */

import { isolate } from "../../../lib/i18n";

export type CarePeopleCopy = {
  stopWho: string;
  stopWhoSub: string;
  stopMoreSub: string;
  stopWhoNone: string;
  adults: (n: number) => string;
  adultsSub: string;
  adultsSee: (name: string) => string;
  youAnd: (n: number) => string;
  lanesLabel: (name: string) => string;
  col: Record<"activity" | "moments" | "week" | "custom" | "visit", { title: string; sub: string }>;
  you: string;
  youSees: string;
  joined: string;
  invited: string;
  weekNobody: string;
  careTeam: string;
  careTeamSub: string;
  notInvited: string;
  seesNow: string;
  wouldSee: string;
};

export type CareV10Copy = {
  onThisPage: string;
  visits: {
    stopVisit: string;
    stopVisitSub: string;
    stopReady: string;
    stopReadySub: string;
    stopSummary: string;
    stopSummarySub: string;
    stopAppointments: string;
    stopAppointmentsSub: string;
    readyHead: string;
    moreChips: (n: number) => string;
    stepBooked: string;
    stepChoose: string;
    stepReview: string;
    stepShare: string;
    stepsLabel: string;
    heading: (profession: string) => string;
    readySub: string;
    summaryHead: string;
    summarySub: string;
    appointmentsSub: (upcoming: number, past: number) => string;
    daysToGo: (n: number) => string;
    today: (date: string) => string;
    runwayLabel: (n: number, today: string, date: string) => string;
    packed: string;
    packedMoments: (n: number) => string;
    packedMomentsSub: string;
    packedMilestones: (n: number) => string;
    packedMilestonesSub: string;
    packedWords: (n: number) => string;
    packedWordsSub: string;
    lastNote: string;
    timelineLabel: string;
  };
  brief: {
    stopBrief: string;
    stopBriefSub: string;
    stopShare: string;
    stopShareSub: string;
    kicker: string;
    backSub: string;
    nextVisit: (who: string, date: string) => string;
  };
  people: CarePeopleCopy;
  records: {
    stopRecord: string;
    stopRecordSub: (date: string) => string;
    stopDocs: string;
    stopDocsSub: string;
    stopKept: string;
    stopKeptSub: string;
    since: (date: string) => string;
    moments: (n: number) => string;
    milestonesSub: (n: number) => string;
    keeps: (name: string) => string;
    ledgerSince: (date: string) => string;
    ledgerName: Record<"moments" | "milestones" | "plan" | "notebook" | "visits", string>;
    ledgerNone: string;
    ledgerMomentsSub: string;
    ledgerHard: (n: number) => string;
    ledgerBranches: (n: number) => string;
    ledgerStillOpen: (n: number) => string;
    ledgerNotebookSub: (waiting: number) => string;
    ledgerVisitsSub: (past: number, ahead: number) => string;
    ledgerLatest: (date: string) => string;
    ledgerNext: (date: string) => string;
    ledgerOpen: string;
    ledgerMarksNote: string;
  };
};

const plural = (n: number, one: string, other: string) => (n === 1 ? one : other);

export const careV10Copy: Record<"en" | "he", CareV10Copy> = {
  en: {
    onThisPage: "On this page",
    visits: {
      stopVisit: "Your next visit",
      stopVisitSub: "prepare and share",
      stopReady: "Getting ready",
      stopReadySub: "who it is for",
      stopSummary: "The visit summary",
      stopSummarySub: "choose, preview, share",
      stopAppointments: "Appointments",
      stopAppointmentsSub: "add, remove, past",
      readyHead: "Getting ready",
      moreChips: (n) => `${n} more`,
      stepBooked: "Booked",
      stepChoose: "Choose",
      stepReview: "Review",
      stepShare: "Share",
      stepsLabel: "Where the visit summary is",
      heading: (profession) => `Prepare for the ${profession}`,
      readySub: "who it is for, and your one line",
      summaryHead: "The visit summary",
      summarySub: "you review every line",
      appointmentsSub: (u, p) => `${u} ahead, ${p} past`,
      daysToGo: (n) => (n === 0 ? "today" : plural(n, "day to go", "days to go")),
      today: (date) => `Today, ${date}`,
      runwayLabel: (n, today, date) => `${n} ${plural(n, "day", "days")} from today, ${today}, to ${date}`,
      packed: "Packed so far",
      packedMoments: (n) => plural(n, "moment", "moments"),
      packedMomentsSub: "in your words",
      packedMilestones: (n) => plural(n, "milestone", "milestones"),
      packedMilestonesSub: "you marked seen",
      packedWords: (n) => plural(n, "word or saying", "words and sayings"),
      packedWordsSub: "you wrote down",
      lastNote: "Your note from the last visit",
      timelineLabel: "Your appointments by date",
    },
    brief: {
      stopBrief: "The brief",
      stopBriefSub: "one page, classroom words",
      stopShare: "Share and draft",
      stopShareSub: "save, copy, ask Arbor",
      kicker: "Teacher brief · one page, classroom words",
      backSub: "Change who it is for, or the template, in Visits",
      nextVisit: (who, date) => `Next visit: ${who}, ${date}`,
    },
    people: {
      stopWho: "Who sees what",
      stopWhoSub: "adults and invites",
      stopMoreSub: "who, until when",
      stopWhoNone: "only you so far",
      adults: (n) => (n === 1 ? "person you share with" : "people you share with"),
      adultsSub: "Every share is one you chose, and you can stop it.",
      adultsSee: (name) => `adults see ${isolate(name)}'s record`,
      youAnd: (n) => (n === 1 ? "you and one more" : `you and ${n} more`),
      lanesLabel: (name) => `Who sees what about ${name}`,
      col: {
        activity: { title: "The activity you chose", sub: "and can mark it done" },
        moments: { title: "20 most recent moments", sub: "and can add a note" },
        week: { title: "The week, to read", sub: "weekly report, story timeline" },
        custom: { title: "A custom share", sub: "what you chose" },
        visit: { title: "One page for a visit", sub: "only when you send it" },
      },
      you: "You",
      youSees: "everything, always",
      joined: "joined",
      invited: "invited, not joined yet",
      weekNobody: "Someone who reads the week",
      careTeam: "A teacher or your care team",
      careTeamSub: "one page at a time, from Visits",
      notInvited: "not invited yet",
      seesNow: "sees it now",
      wouldSee: "would see it once you invite",
    },
    records: {
      stopRecord: "The record",
      stopRecordSub: (date) => `since ${date}`,
      stopDocs: "Documents",
      stopDocsSub: "save as PDF",
      stopKept: "Shared and kept",
      stopKeptSub: "exports and your data",
      since: (date) => `Your full record · since ${date}`,
      moments: (n) => plural(n, "moment", "moments"),
      milestonesSub: (n) => `${n} ${plural(n, "milestone", "milestones")} noticed`,
      keeps: (name) => `Everything Arbor keeps about ${name}`,
      ledgerSince: (date) => `Since ${date}`,
      ledgerName: { moments: "Moments", milestones: "Milestones seen", plan: "Plan steps done", notebook: "Notebook", visits: "Visits" },
      ledgerNone: "none yet",
      ledgerMomentsSub: "in your words",
      ledgerHard: (n) => `${n} hard`,
      ledgerBranches: (n) => `on ${n} ${plural(n, "branch", "branches")}`,
      ledgerStillOpen: (n) => (n === 0 ? "all done" : `${n} still open`),
      ledgerNotebookSub: (w) => (w === 0 ? "remembered" : `remembered, ${w} waiting`),
      ledgerVisitsSub: (p, a) => `${p} past, ${a} ahead`,
      ledgerLatest: (date) => `latest ${date}`,
      ledgerNext: (date) => `next ${date}`,
      ledgerOpen: "open where they live",
      ledgerMarksNote: "Each mark is one thing you recorded.",
    },
  },
  he: {
    onThisPage: "בעמוד הזה",
    visits: {
      stopVisit: "הביקור הבא",
      stopVisitSub: "מתכוננים ומשתפים",
      stopReady: "מתכוננים",
      stopReadySub: "למי זה",
      stopSummary: "סיכום הביקור",
      stopSummarySub: "בוחרים, מעיינים, משתפים",
      stopAppointments: "פגישות",
      stopAppointmentsSub: "הוספה, הסרה, מה שעבר",
      readyHead: "מתכוננים",
      moreChips: (n) => `עוד ${n}`,
      stepBooked: "נקבע",
      stepChoose: "בוחרים",
      stepReview: "בודקים",
      stepShare: "משתפים",
      stepsLabel: "איפה סיכום הביקור עומד",
      heading: (profession) => `מתכוננים לפגישה עם ${profession}`,
      readySub: "למי זה, ומשפט אחד שלכם",
      summaryHead: "סיכום הביקור",
      summarySub: "אתם עוברים על כל שורה",
      appointmentsSub: (u, p) => `${u} קדימה, ${p} שעברו`,
      daysToGo: (n) => (n === 0 ? "היום" : n === 1 ? "יום אחד" : "ימים עד הביקור"),
      today: (date) => `היום, ${date}`,
      runwayLabel: (n, today, date) => `${n} ימים מהיום, ${today}, עד ${date}`,
      packed: "מה כבר מוכן",
      packedMoments: (n) => (n === 1 ? "רגע" : "רגעים"),
      packedMomentsSub: "במילים שלכם",
      packedMilestones: (n) => (n === 1 ? "אבן דרך" : "אבני דרך"),
      packedMilestonesSub: "שסימנתם שראיתם",
      packedWords: (n) => (n === 1 ? "מילה או משפט" : "מילים ומשפטים"),
      packedWordsSub: "שרשמתם",
      lastNote: "מה רשמתם אחרי הביקור הקודם",
      timelineLabel: "הפגישות שלכם לפי תאריך",
    },
    brief: {
      stopBrief: "התקציר",
      stopBriefSub: "עמוד אחד, בשפת הגן",
      stopShare: "שיתוף וטיוטה",
      stopShareSub: "שמירה, העתקה, בקשה מ-Arbor",
      kicker: "תקציר לגן · עמוד אחד, בשפת הגן",
      backSub: "משנים למי זה, או את התבנית, בביקורים",
      nextVisit: (who, date) => `הביקור הבא: ${who}, ${date}`,
    },
    people: {
      stopWho: "מי רואה מה",
      stopWhoSub: "מבוגרים והזמנות",
      stopMoreSub: "מי, ועד מתי",
      stopWhoNone: "בינתיים רק אתם",
      adults: (n) => (n === 1 ? "אדם שאתם משתפים איתו" : "אנשים שאתם משתפים איתם"),
      adultsSub: "כל שיתוף הוא בבחירתכם, ואפשר לעצור אותו.",
      adultsSee: (name) => `מבוגרים רואים את התיעוד של ${name}`,
      youAnd: (n) => (n === 1 ? "אתם ועוד אחד" : `אתם ועוד ${n}`),
      lanesLabel: (name) => `מי רואה מה על ${name}`,
      col: {
        activity: { title: "הפעילות שבחרתם", sub: "ויכולים לסמן שבוצעה" },
        moments: { title: "20 הרגעים האחרונים", sub: "ויכולים להוסיף הערה" },
        week: { title: "השבוע, לקריאה", sub: "דוח שבועי, ציר הסיפור" },
        custom: { title: "שיתוף מותאם", sub: "מה שבחרתם" },
        visit: { title: "עמוד אחד לביקור", sub: "רק כשאתם שולחים" },
      },
      you: "אתם",
      youSees: "הכול, תמיד",
      joined: "הצטרפו",
      invited: "הוזמנו, עוד לא הצטרפו",
      weekNobody: "מישהו שקורא את השבוע",
      careTeam: "גננת או צוות הטיפול",
      careTeamSub: "עמוד אחד בכל פעם, מהביקורים",
      notInvited: "עוד לא הוזמנו",
      seesNow: "רואים עכשיו",
      wouldSee: "יראו אחרי שתזמינו",
    },
    records: {
      stopRecord: "התיעוד",
      stopRecordSub: (date) => `מאז ${date}`,
      stopDocs: "מסמכים",
      stopDocsSub: "שמירה כ-PDF",
      stopKept: "מה שותף ונשמר",
      stopKeptSub: "ייצוא והמידע שלכם",
      since: (date) => `התיעוד המלא שלכם · מאז ${date}`,
      moments: (n) => (n === 1 ? "רגע" : "רגעים"),
      milestonesSub: (n) => `${n} אבני דרך שסומנו`,
      keeps: (name) => `כל מה ש-Arbor שומר על ${name}`,
      ledgerSince: (date) => `מאז ${date}`,
      ledgerName: { moments: "רגעים", milestones: "אבני דרך שראיתם", plan: "צעדי תוכנית שבוצעו", notebook: "המחברת", visits: "ביקורים" },
      ledgerNone: "עדיין אין",
      ledgerMomentsSub: "במילים שלכם",
      ledgerHard: (n) => `${n} קשים`,
      ledgerBranches: (n) => (n === 1 ? "בתחום אחד" : `ב-${n} תחומים`),
      ledgerStillOpen: (n) => (n === 0 ? "הכול בוצע" : `${n} עוד פתוחים`),
      ledgerNotebookSub: (w) => (w === 0 ? "נשמרו" : `נשמרו, ${w} ממתינים`),
      ledgerVisitsSub: (p, a) => `${p} שעברו, ${a} קדימה`,
      ledgerLatest: (date) => `לאחרונה ${date}`,
      ledgerNext: (date) => `הבא ${date}`,
      ledgerOpen: "לפתוח במקום שבו הם נשמרים",
      ledgerMarksNote: "כל סימן הוא דבר אחד שרשמתם.",
    },
  },
};

export function careCopy(uiLang: string): CareV10Copy {
  return careV10Copy[uiLang === "he" ? "he" : "en"];
}
