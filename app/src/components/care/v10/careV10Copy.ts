/* Care, together (design v10.1): the words the new composition adds — the
   guide stops, section heads and the scene's units. Production's own labels
   stay in the i18n tables and are read through t(); nothing here renames a
   production thing. Both locales are first-class (pattern: nowViewCopy). */

export type CareV10Copy = {
  onThisPage: string;
  visits: {
    stopVisit: string;
    stopVisitSub: (n: number) => string;
    stopVisitNone: string;
    stopReady: string;
    stopReadySub: string;
    stopSummary: string;
    stopSummarySub: string;
    stopAppointments: string;
    stopAppointmentsSub: (upcoming: number, past: number) => string;
    readyHead: string;
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
    stopWho: string;
    stopWhoSub: string;
    stopIn: string;
    stopInSub: string;
    kicker: string;
    nextVisit: (who: string, date: string) => string;
  };
  people: {
    stopWho: string;
    stopWhoSub: (n: number) => string;
    stopWhoNone: string;
    adults: (n: number) => string;
    adultsSub: string;
  };
  records: {
    stopRecord: string;
    stopRecordSub: (moments: number, milestones: number) => string;
    stopDocs: string;
    stopDocsSub: string;
    stopKept: string;
    stopKeptSub: string;
    since: (date: string) => string;
    moments: (n: number) => string;
    milestonesSub: (n: number) => string;
    keeps: (name: string) => string;
  };
};

const plural = (n: number, one: string, other: string) => (n === 1 ? one : other);

export const careV10Copy: Record<"en" | "he", CareV10Copy> = {
  en: {
    onThisPage: "On this page",
    visits: {
      stopVisit: "Your next visit",
      stopVisitSub: (n) => (n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`),
      stopVisitNone: "nothing booked yet",
      stopReady: "Getting ready",
      stopReadySub: "who it is for, your one line",
      stopSummary: "The visit summary",
      stopSummarySub: "choose, preview, share",
      stopAppointments: "Appointments",
      stopAppointmentsSub: (u, p) => `${u} ahead, ${p} past`,
      readyHead: "Getting ready",
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
      stopWho: "Who it is for",
      stopWhoSub: "teacher, one template",
      stopIn: "What goes in",
      stopInSub: "you review every line",
      kicker: "Teacher brief · one page, classroom words",
      nextVisit: (who, date) => `Next visit: ${who}, ${date}`,
    },
    people: {
      stopWho: "Who sees what",
      stopWhoSub: (n) => (n === 1 ? "1 person you share with" : `${n} people you share with`),
      stopWhoNone: "only you so far",
      adults: (n) => (n === 1 ? "person you share with" : "people you share with"),
      adultsSub: "Every share is one you chose, and you can stop it.",
    },
    records: {
      stopRecord: "The record",
      stopRecordSub: (m, s) => `${m} ${plural(m, "moment", "moments")}, ${s} ${plural(s, "milestone", "milestones")}`,
      stopDocs: "Documents",
      stopDocsSub: "you can save",
      stopKept: "Shared and kept",
      stopKeptSub: "on this device",
      since: (date) => `Your full record · since ${date}`,
      moments: (n) => plural(n, "moment", "moments"),
      milestonesSub: (n) => `${n} ${plural(n, "milestone", "milestones")} noticed`,
      keeps: (name) => `Everything Arbor keeps about ${name}`,
    },
  },
  he: {
    onThisPage: "בעמוד הזה",
    visits: {
      stopVisit: "הביקור הבא",
      stopVisitSub: (n) => (n === 0 ? "היום" : n === 1 ? "מחר" : `בעוד ${n} ימים`),
      stopVisitNone: "עוד לא נקבע ביקור",
      stopReady: "מתכוננים",
      stopReadySub: "למי זה, ומשפט אחד שלכם",
      stopSummary: "סיכום הביקור",
      stopSummarySub: "בוחרים, מעיינים, משתפים",
      stopAppointments: "פגישות",
      stopAppointmentsSub: (u, p) => `${u} קדימה, ${p} שעברו`,
      readyHead: "מתכוננים",
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
      stopWho: "למי זה",
      stopWhoSub: "גננת או מורה, תבנית אחת",
      stopIn: "מה נכנס",
      stopInSub: "אתם עוברים על כל שורה",
      kicker: "תקציר לגן · עמוד אחד, בשפת הגן",
      nextVisit: (who, date) => `הביקור הבא: ${who}, ${date}`,
    },
    people: {
      stopWho: "מי רואה מה",
      stopWhoSub: (n) => (n === 1 ? "אדם אחד שאתם משתפים איתו" : `${n} אנשים שאתם משתפים איתם`),
      stopWhoNone: "בינתיים רק אתם",
      adults: (n) => (n === 1 ? "אדם שאתם משתפים איתו" : "אנשים שאתם משתפים איתם"),
      adultsSub: "כל שיתוף הוא בבחירתכם, ואפשר לעצור אותו.",
    },
    records: {
      stopRecord: "התיעוד",
      stopRecordSub: (m, s) => `${m} רגעים, ${s} אבני דרך`,
      stopDocs: "מסמכים",
      stopDocsSub: "שאפשר לשמור",
      stopKept: "מה שותף ונשמר",
      stopKeptSub: "במכשיר הזה",
      since: (date) => `התיעוד המלא שלכם · מאז ${date}`,
      moments: (n) => (n === 1 ? "רגע" : "רגעים"),
      milestonesSub: (n) => `${n} אבני דרך שסומנו`,
      keeps: (name) => `כל מה ש-Arbor שומר על ${name}`,
    },
  },
};

export function careCopy(uiLang: string): CareV10Copy {
  return careV10Copy[uiLang === "he" ? "he" : "en"];
}
