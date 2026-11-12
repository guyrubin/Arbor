import type { DayPart } from "./rightNowModel";

/* v4.1 Now copy. Right now — the one line on Now that follows the time of day.
   Every sentence names the parent's own record (their routine's next step,
   the clock times of the hard moments they kept); none judges the child. */

export const RIGHT_NOW_COPY = {
  en: {
    label: (clock: string) => `Right now · ${clock}`,
    region: "Right now",
    hardHead: {
      morning: "Around now is often a hard part of the morning.",
      midday: "Around now is often a hard part of the day.",
      afternoon: "The hour before dinner is often the hard one.",
      evening: "Around now is often a hard part of the evening.",
    } satisfies Record<DayPart, string>,
    hardSub: (inWindow: number, recent: number, from: string, to: string) =>
      `${inWindow} of the last ${recent} hard moments you kept fell between ${from} and ${to}. The words are ready.`,
    hardCta: "Open the words",
    routineHead: (step: string) => `Next: ${step}`,
    routineSub: (title: string, done: number, total: number) =>
      done > 0 ? `${title} · ${done} of ${total} steps done today` : `${title} · ${total} steps, in your order`,
    routineStart: "Start the routine",
    routineContinue: "Continue",
    // Evening: tonight's questions, answered here (rightNowTonight.ts).
    tonightAsk: (n: number, total: number) => `Tonight · question ${n} of ${total}. One tap is enough.`,
    tonightNoticeQ: "Did you notice this today?",
    tonightWrite: "Write it down",
    tonightNothing: "Nothing today",
    tonightDoneHead: "That's the day. Tomorrow's step is ready when you are.",
    tonightDoneSub: (kept: number) =>
      kept === 0 ? "Nothing to keep tonight." : kept === 1 ? "Arbor kept your answer." : `Arbor kept your ${kept === 2 ? "two" : "three"} answers.`,
    tonightAll: "Open tonight in full",
    tonightFailed: "That answer didn't save. Try again.",
  },
  he: {
    label: (clock: string) => `עכשיו · ${clock}`,
    region: "עכשיו",
    hardHead: {
      morning: "סביב השעה הזאת מגיע לעיתים קרובות רגע קשה של הבוקר.",
      midday: "סביב השעה הזאת מגיע לעיתים קרובות רגע קשה של היום.",
      afternoon: "השעה שלפני ארוחת הערב היא לעיתים קרובות הקשה.",
      evening: "סביב השעה הזאת מגיע לעיתים קרובות רגע קשה של הערב.",
    } satisfies Record<DayPart, string>,
    hardSub: (inWindow: number, recent: number, from: string, to: string) =>
      `${inWindow} מתוך ${recent} הרגעים הקשים האחרונים ששמרתם היו בין ${from} ל-${to}. המילים מוכנות.`,
    hardCta: "לפתוח את המילים",
    routineHead: (step: string) => `הצעד הבא: ${step}`,
    routineSub: (title: string, done: number, total: number) =>
      done > 0 ? `${title} · ${done} מתוך ${total} צעדים היום` : `${title} · ${total} צעדים, בסדר שלכם`,
    routineStart: "להתחיל את השגרה",
    routineContinue: "להמשיך",
    tonightAsk: (n: number, total: number) => `הערב · שאלה ${n} מתוך ${total}. מספיקה נגיעה אחת.`,
    tonightNoticeQ: "שמתם לב לזה היום?",
    tonightWrite: "לכתוב את זה",
    tonightNothing: "שום דבר היום",
    tonightDoneHead: "זה היום. הצעד של מחר מחכה כשתהיו מוכנים.",
    tonightDoneSub: (kept: number) =>
      kept === 0 ? "אין מה לשמור הערב." : kept === 1 ? "התשובה שלכם נשמרה." : kept === 2 ? "שתי התשובות שלכם נשמרו." : "שלוש התשובות שלכם נשמרו.",
    tonightAll: "לפתוח את כל הערב",
    tonightFailed: "התשובה לא נשמרה. נסו שוב.",
  },
} as const;

/* v4.1 (12 Nov) — the visit summary is drafted. Care assembles the page from
   the record when it opens; nothing leaves until the parent sends it. The
   number is Care's own since-anchor count (visitDraft.ts). */
export const VISIT_DRAFT_COPY = {
  en: {
    head: "A quiet two minutes: the visit summary is drafted.",
    sub: (n: number, anchor: "visit" | "share" | "start") => {
      const since = anchor === "visit" ? "since the last visit" : anchor === "share" ? "since you last shared with them" : "since you started";
      return `${n === 1 ? "Built from the one moment" : `Built from the ${n} moments`} you kept ${since}. Nothing is shared until you send it.`;
    },
    cta: "Look it over",
    glance: (when: string) => `${when} · summary drafted, two minutes to check`,
  },
  he: {
    head: "שתי דקות שקטות: טיוטת סיכום הביקור מוכנה.",
    sub: (n: number, anchor: "visit" | "share" | "start") => {
      const since = anchor === "visit" ? "מאז הביקור הקודם" : anchor === "share" ? "מאז השיתוף האחרון איתם" : "מאז שהתחלתם";
      return `${n === 1 ? "נבנתה מהרגע ששמרתם" : `נבנתה מ-${n} הרגעים ששמרתם`} ${since}. שום דבר לא משותף עד שתשלחו.`;
    },
    cta: "לעבור עליה",
    glance: (when: string) => `${when} · הטיוטה מוכנה, שתי דקות לבדוק`,
  },
} as const;

/* v4.1 Arbor learned this week — the proposals of the last seven days, asked
   on Now. The same decision as About's notebook (handleMemoryDecision): only
   what the parent confirms is kept. Hebrew avoids a gendered verb for Arbor. */
export const LEARNED_COPY = {
  en: {
    title: "Arbor learned this week",
    sub: "Only what you confirm is kept.",
    right: "That's right",
    notQuite: "Not quite",
    kept: "Kept",
    removed: "Removed",
  },
  he: {
    title: "מה נלמד השבוע",
    sub: "רק מה שתאשרו נשמר.",
    right: "נכון",
    notQuite: "לא בדיוק",
    kept: "נשמר",
    removed: "הוסר",
  },
} as const;

/* v4.1 Then and now — My child. The parent's own words on one shelf, the
   newest note beside the newest one written at least a week before it.
   Arbor quotes and dates; it never says which sentence is better. */
export const THEN_NOW_COPY = {
  en: {
    title: "Then and now",
    sub: "Your own words, then and now, side by side. Never a score.",
    thisWeek: "This week",
  },
  he: {
    title: "אז ועכשיו",
    sub: "המילים שלכם, מאז ומעכשיו, זו לצד זו. אף פעם לא ציון.",
    thisWeek: "השבוע",
  },
} as const;

/* v4.1 Fits right now — Together's rhythm: the started routine of this part
   of the day with a step still open (rightNowModel.routineForPart). */
export const FITS_COPY = {
  en: { label: (clock: string) => `Fits right now · ${clock}`, start: "Start", continue: "Continue" },
  he: { label: (clock: string) => `מתאים עכשיו · ${clock}`, start: "להתחיל", continue: "להמשיך" },
} as const;
