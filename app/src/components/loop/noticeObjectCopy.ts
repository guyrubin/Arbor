/** Parent UI only. Source guidance and the milestone's age line stay unchanged. */
export const NOTICE_OBJECT_COPY = {
  en: {
    prompt: "What have you noticed?", response: "Your answer", change: "Change",
    words: "Your words", kept: "Kept with this observation", editWords: "Update your words",
    open: "Open observation", home: "Part of your child's story", context: "Meaning, moments and what comes next",
    undone: "Previous answer restored.", saving: "Saving…", unconfirmed: "Waiting to confirm this record. Reconnect, then try again.",
    chooseDate: "Add words with the date you noticed them in the observation.",
    errors: {
      answer: "Your answer has not been confirmed. Please try the same answer again.",
      when: "The date change has not been confirmed. Please choose it again.",
      note: "Your answer is saved. Your words have not been confirmed yet; they are still here to try again.",
      undo: "The undo has not been confirmed. Please try again.",
    },
  },
  he: {
    prompt: "מה שמתם לב שקורה?", response: "התשובה שלכם", change: "שינוי",
    words: "המילים שלכם", kept: "נשמר עם התצפית הזאת", editWords: "עדכון המילים שלכם",
    open: "פתיחת התצפית", home: "חלק מהסיפור של הילד", context: "המשמעות, הרגעים ומה אפשר לעשות בהמשך",
    undone: "התשובה הקודמת הוחזרה.", saving: "שומרים…", unconfirmed: "ממתינים לאישור השמירה. אחרי חידוש החיבור אפשר לנסות שוב.",
    chooseDate: "בתצפית אפשר להוסיף מילים עם התאריך שבו שמתם לב אליהן.",
    errors: {
      answer: "שמירת התשובה עדיין לא אושרה. אפשר לבחור שוב באותה תשובה.",
      when: "שינוי התאריך עדיין לא אושר. אפשר לבחור בו שוב.",
      note: "התשובה נשמרה. שמירת המילים עדיין לא אושרה; הן נשארות כאן ואפשר לנסות שוב.",
      undo: "הביטול עדיין לא אושר. אפשר לנסות שוב.",
    },
  },
} as const;
