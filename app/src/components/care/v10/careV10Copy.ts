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
  stopInvite: string;
  stopInviteSub: string;
  stopCarry: string;
  stopCarrySub: string;
  stopShares: string;
  invitesHead: string;
  invitesSub: string;
  sharesHead: string;
  carryWeekTitle: (name: string) => string;
  carryWeekUnit: string;
  carryWeekSub: string;
  carryReadsWeekly: string;
  carryReadsStory: string;
  carryReadOnly: string;
  carryYouSend: string;
  carryCustomTitle: string;
  carryCustomUnit: string;
  carryCustomSub: string;
  carrySeesTicked: string;
  stopKinds: string;
  invitesAndShares: string;
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
    addToSummary: string;
    yourNote: string;
    teacherHint: string;
    reasonHint: string;
    onlyYou: string;
    staysTitle: string;
    staysBody: (name: string) => string;
    goesTitle: string;
    goesBody: string;
    nothingReaches: string;
    staysLine: (name: string) => string;
    previewHead: string;
    stopShort: { visit: string; summary: string; dates: string; note: string };
    packedPlan: (n: number) => string;
    packedPlanSub: string;
    summaryGroups: (n: number) => string;
    uncheckPrivate: string;
  };
  brief: {
    stopBrief: string;
    stopBriefSub: string;
    stopShare: string;
    stopShareSub: string;
    kicker: string;
    backSub: string;
    lede: string;
    stopShortBrief: string;
    stopShortPage: string;
    pageHead: string;
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
    ledgerHardSettled: (hard: number, settled: number) => string;
    lede: (name: string) => string;
    docsHead: string;
    stopKeptShort: string;
    doorTitle: string;
    doorSub: string;
    yourDataWhere: string;
    yourDataWhat: string;
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
      packedWordsSub: "you kept",
      lastNote: "Your note from the last visit",
      timelineLabel: "Your appointments by date",
      addToSummary: "Add to the visit summary",
      yourNote: "your note",
      teacherHint: "Teacher opens the Teacher brief.",
      reasonHint: "One line, in your words.",
      onlyYou: "Only you see this.",
      staysTitle: "Stays in Arbor",
      staysBody: (name) => `${isolate(name)}'s whole record`,
      goesTitle: "Goes only when you save, copy or send",
      goesBody: "One page with the lines you ticked",
      nothingReaches: "Nothing reaches your care team until you choose.",
      staysLine: (name) => `Stays in Arbor: ${isolate(name)}'s whole record. Leaves when you choose: one page, the lines you ticked.`,
      previewHead: "Preview the visit summary",
      stopShort: { visit: "Visit", summary: "Summary", dates: "Dates", note: "Note" },
      packedPlan: (n) => plural(n, "plan step done", "plan steps done"),
      packedPlanSub: "in the action plan",
      uncheckPrivate: "Uncheck to keep private",
      summaryGroups: (n) => (n === 8 ? "Eight groups, line by line" : `${n} ${plural(n, "group", "groups")}, line by line`),
    },
    brief: {
      stopBrief: "The brief",
      stopBriefSub: "one page, classroom words",
      stopShare: "Share and draft",
      stopShareSub: "save, copy, ask Arbor",
      kicker: "Teacher brief · one page, classroom words",
      backSub: "Change who it is for, or the template, in Visits",
      lede: "One page in classroom words: what helps and what to try. You review every line before it goes anywhere.",
      stopShortBrief: "Brief",
      stopShortPage: "The page",
      pageHead: "The brief",
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
      stopInvite: "Before you invite",
      stopInviteSub: "what it starts",
      stopCarry: "What a share carries",
      stopCarrySub: "the week, a custom share",
      stopShares: "Shares and your data",
      invitesHead: "Invites",
      invitesSub: "waiting for an answer",
      sharesHead: "Shared with you, your data and the record",
      carryWeekTitle: (name) => `${isolate(name)}'s week, to read`,
      carryWeekUnit: "things to read",
      carryWeekSub: "the weekly report and the story timeline",
      carryReadsWeekly: "reads the weekly report",
      carryReadsStory: "reads the story timeline",
      carryReadOnly: "read only",
      carryYouSend: "You send them the invite.",
      carryCustomTitle: "A custom share",
      carryCustomUnit: "person at a time",
      carryCustomSub: "you choose what, and for how long",
      carrySeesTicked: "sees only what you ticked",
      stopKinds: "Kinds",
      invitesAndShares: "Invites and shares",
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
      ledgerHardSettled: (h, settled) => (settled === 0 ? `${h} hard` : settled === h ? (h === 1 ? "1 hard, marked settled" : `${h} hard, each marked settled`) : `${h} hard, ${settled} marked settled`),
      lede: (name) => `Your own documents about ${isolate(name)}, built from what you've already logged.`,
      docsHead: "Documents you can save",
      stopKeptShort: "Kept",
      doorTitle: "Prepare a visit summary",
      doorSub: "In Visits",
      yourDataWhere: "Your data, in Settings",
      yourDataWhat: "Export or delete a child's data, or delete your account.",
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
      packedWordsSub: "ששמרתם",
      lastNote: "מה רשמתם אחרי הביקור הקודם",
      timelineLabel: "הפגישות שלכם לפי תאריך",
      addToSummary: "להוסיף לסיכום הביקור",
      yourNote: "הפתק שלכם",
      teacherHint: "גננת פותחת את התקציר לגן.",
      reasonHint: "שורה אחת, במילים שלכם.",
      onlyYou: "רק אתם רואים את זה.",
      staysTitle: "נשאר ב-Arbor",
      staysBody: (name) => `כל התיעוד של ${isolate(name)}`,
      goesTitle: "יוצא רק כשאתם שומרים, מעתיקים או שולחים",
      goesBody: "עמוד אחד עם השורות שסימנתם",
      nothingReaches: "שום דבר לא מגיע לצוות הטיפול עד שתבחרו.",
      staysLine: (name) => `נשאר ב-Arbor: כל התיעוד של ${isolate(name)}. יוצא כשאתם בוחרים: עמוד אחד, השורות שסימנתם.`,
      previewHead: "תצוגה מקדימה של סיכום הביקור",
      stopShort: { visit: "ביקור", summary: "סיכום", dates: "תאריכים", note: "לדעת" },
      packedPlan: (n) => (n === 1 ? "צעד בתוכנית שבוצע" : "צעדים בתוכנית שבוצעו"),
      packedPlanSub: "בתוכנית הפעולה",
      summaryGroups: (n) => `${n} קבוצות, שורה אחר שורה`,
      uncheckPrivate: "מורידים סימון כדי לשמור לעצמכם",
    },
    brief: {
      stopBrief: "התקציר",
      stopBriefSub: "עמוד אחד, בשפת הגן",
      stopShare: "שיתוף וטיוטה",
      stopShareSub: "שמירה, העתקה, בקשה מ-Arbor",
      kicker: "תקציר לגן · עמוד אחד, בשפת הגן",
      backSub: "משנים למי זה, או את התבנית, בביקורים",
      lede: "עמוד אחד בשפת הגן: מה עוזר ומה כדאי לנסות. אתם עוברים על כל שורה לפני שהיא יוצאת.",
      stopShortBrief: "תקציר",
      stopShortPage: "העמוד",
      pageHead: "התקציר",
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
      stopInvite: "לפני שמזמינים",
      stopInviteSub: "מה זה פותח",
      stopCarry: "מה שיתוף כולל",
      stopCarrySub: "השבוע, שיתוף מותאם",
      stopShares: "שיתופים והמידע שלכם",
      invitesHead: "הזמנות",
      invitesSub: "ממתינות לתשובה",
      sharesHead: "שותף איתכם, המידע שלכם והתיעוד",
      carryWeekTitle: (name) => `השבוע של ${isolate(name)}, לקריאה`,
      carryWeekUnit: "דברים לקריאה",
      carryWeekSub: "הדוח השבועי וציר הסיפור",
      carryReadsWeekly: "קוראים את הדוח השבועי",
      carryReadsStory: "קוראים את ציר הסיפור",
      carryReadOnly: "קריאה בלבד",
      carryYouSend: "אתם שולחים להם את ההזמנה.",
      carryCustomTitle: "שיתוף מותאם",
      carryCustomUnit: "אדם אחד בכל פעם",
      carryCustomSub: "אתם בוחרים מה, ולכמה זמן",
      carrySeesTicked: "רואים רק את מה שסימנתם",
      stopKinds: "סוגים",
      invitesAndShares: "הזמנות ושיתופים",
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
      ledgerHardSettled: (h, settled) => (settled === 0 ? `${h} קשים` : settled === h ? `${h} קשים, כולם סומנו שנרגעו` : `${h} קשים, ${settled} סומנו שנרגעו`),
      lede: (name) => `המסמכים שלכם על ${isolate(name)}, מתוך מה שכבר תיעדתם.`,
      docsHead: "מסמכים שאפשר לשמור",
      stopKeptShort: "נשמר",
      doorTitle: "הכנת סיכום ביקור",
      doorSub: "בביקורים",
      yourDataWhere: "המידע שלכם, בהגדרות",
      yourDataWhat: "ייצוא או מחיקה של המידע על ילד, או מחיקת החשבון.",
    },
  },
};

export function careCopy(uiLang: string): CareV10Copy {
  return careV10Copy[uiLang === "he" ? "he" : "en"];
}

/** Design V77 (N-Care "Worth knowing"): the words today's reviewed Learn pick is
 *  leaned toward on Visits — matched against reads' titles and shelves only,
 *  never shown (lib learnLibrary.topicBoost). Not a sentence the parent reads. */
export const CARE_WORTH_TOPIC = "when to ask a professional: speech, talking, doctor, therapist, teacher, gan, school";
