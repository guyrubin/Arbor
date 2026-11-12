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
    tonightHead: "Tonight's three questions are ready.",
    tonightSub: "About a minute. One tap an answer is enough.",
    tonightCta: "Answer now",
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
    tonightHead: "שלוש השאלות של הערב מוכנות.",
    tonightSub: "בערך דקה. מספיקה נגיעה אחת לכל תשובה.",
    tonightCta: "לענות עכשיו",
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
