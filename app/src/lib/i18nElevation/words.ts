/* i18nElevation/words — P2 WORDS: "Things {name} said" end to end.
 *
 * B-GROWTH-36: the Language page by age (the quote add box, the say-back,
 * the honest line, the "Act now if…" drafts), Today's say-back question.
 * Keys that name the child carry `.boy` / `.girl` variants (lib/today/
 * fromRecord `genderedKey`); the neutral key uses the Hebrew slash form.
 *
 * The say-back LINES (`elev.words.sayBack.line.*`) are resolved in the
 * language the family is keeping, not the UI language (lib/language/
 * sayBack.ts) — so each one exists in EN and HE with the same meaning.
 * Every line here is a deterministic template, never model output; the
 * templates and the "Act now if…" lines are DRAFTS pending the clinical
 * review line (execution/2026-10-06--milestone-loop/REVIEW-SHEET.md). */

type Dict = Record<string, string>;

/** One key + its gendered variants (boy / girl default to the neutral text). */
function g(key: string, neutral: string, boy: string = neutral, girl: string = neutral): Dict {
  return { [key]: neutral, [`${key}.boy`]: boy, [`${key}.girl`]: girl };
}

export const en: Dict = {
  ...g("elev.words.said.title", "Things {name} said"),
  ...g("elev.words.said.label", "What did {name} say today?", "What did he say today?", "What did she say today?"),
  "elev.words.said.placeholder": "A word, a question, a story, in the language it was said",
  "elev.words.said.langLabel": "Language",
  "elev.words.said.langAuto": "Language of the words",
  "elev.words.said.save": "Keep it",
  ...g("elev.words.said.emptyHint", "Write what {name} said, then keep it."),
  ...g("elev.words.said.empty", "Nothing kept yet. A word, a question or a story {name} told goes here, with its day."),
  "elev.words.said.kept": "What you kept",

  ...g("elev.words.sayBack.head.cross", "{name} said it in {said}. Say it back in {kept} and add one:", "He said it in {said}. Say it back in {kept} and add one:", "She said it in {said}. Say it back in {kept} and add one:"),
  ...g("elev.words.sayBack.head.crossOther", "{name} said it in {said}. Say it back in {kept} and add one word or one question.", "He said it in {said}. Say it back in {kept} and add one word or one question.", "She said it in {said}. Say it back in {kept} and add one word or one question."),
  ...g("elev.words.sayBack.head.same", "Say it back and add one:"),
  ...g("elev.words.sayBack.head.sameOther", "Say it back in {said} and add one word or one question."),
  ...g("elev.words.sayBack.line.word.same", "Yes, {word}! What a lovely {word}."),
  ...g("elev.words.sayBack.line.word.cross", "Yes! How lovely. And what else?"),
  ...g("elev.words.sayBack.line.echo", "Yes, {word}! And more?"),
  ...g("elev.words.sayBack.line.sentence.talk", "And then what?"),
  ...g("elev.words.sayBack.line.sentence.school", "What else?"),
  ...g("elev.words.sayBack.line.question", "Good question. What do you think?"),
  ...g("elev.words.sayBack.why.cross", "Answering in {kept}, warmly and without asking {name} to switch, keeps {kept} in your talk together. It is a habit for you, not a test for {name}."),
  ...g("elev.words.sayBack.why.same", "Saying back what {name} said and adding one more keeps the talk going. It is a habit for you, not a test for {name}."),

  "elev.words.actNow.label": "When to ask someone",
  // the #/language disclosure — the month list is gone (B-GROWTH-36)
  "elev.words.more.title": "Practice ideas",
  "elev.words.more.sub": "Optional — four short routines, and when to ask someone.",
  ...g("elev.words.actNow.words", "Ask your doctor if {name} is not saying any words by 18 months, or stops saying words {name} used to say."),
  ...g("elev.words.actNow.talk", "Ask your doctor if, from age 4, people outside the family find {name} hard to understand most of the time."),
  ...g("elev.words.actNow.school", "Ask your doctor or the school's speech therapist if {name}'s teacher raises talking or understanding with you."),

  "elev.words.today.q.cross": "Did you get to say it back in {kept}?",
  "elev.words.today.q.same": "Did you get to say it back and add one?",
  "elev.words.today.a.yes": "Yes",
  "elev.words.today.a.not_today": "Not today",
  "elev.words.today.meta": "Said on {date}",

  ...g("elev.words.ledger.add", "Keep something {name} said"),

  // B-GROWTH-37 — the month page (#/language?view=said)
  "elev.words.page.door": "This month's page — print or send",
  "elev.words.page.posterDoor": "The first-words page — print or send",
  "elev.words.page.back": "Back",
  "elev.words.page.months": "Month",
  "elev.words.page.posterTitle": "{name}'s first words",
  "elev.words.page.empty": "Nothing kept this month yet.",
  "elev.words.page.print": "Print",
  "elev.words.page.send": "Send these words",
  "elev.words.page.copied": "Copied — paste it into a message.",
  "elev.words.page.closing": "From Arbor — {parent}'s notes about {name}",

  // B-SHELL-29 — the one send sheet + the invite card on the weekly letter
  "elev.words.send.edit": "What will be sent — you can change it",
  "elev.words.send.onlyText": "Only these words are sent. No photo, no link.",
  "elev.words.send.send": "Send",
  "elev.words.send.error": "Sharing did not open. Copy the words above instead.",
  "elev.words.send.closingNoName": "From Arbor — {parent}'s notes",
  "elev.words.invite.title": "Know a parent who'd like this?",
  "elev.words.invite.sub": "Send them a free month of Arbor, and you get one too. The link carries nothing about {name}.",
};

export const he: Dict = {
  ...g("elev.words.said.title", "דברים ש{name} אמר/ה", "דברים ש{name} אמר", "דברים ש{name} אמרה"),
  ...g("elev.words.said.label", "מה {name} אמר/ה היום?", "מה הוא אמר היום?", "מה היא אמרה היום?"),
  "elev.words.said.placeholder": "מילה, שאלה, סיפור — בשפה שבה זה נאמר",
  "elev.words.said.langLabel": "שפה",
  "elev.words.said.langAuto": "לפי המילים",
  "elev.words.said.save": "לשמור",
  ...g("elev.words.said.emptyHint", "כתבו מה {name} אמר/ה, ואז שמרו.", "כתבו מה {name} אמר, ואז שמרו.", "כתבו מה {name} אמרה, ואז שמרו."),
  ...g("elev.words.said.empty", "עוד לא נשמר כלום. מילה, שאלה או סיפור ש{name} סיפר/ה יישמרו כאן, עם התאריך.", "עוד לא נשמר כלום. מילה, שאלה או סיפור ש{name} סיפר יישמרו כאן, עם התאריך.", "עוד לא נשמר כלום. מילה, שאלה או סיפור ש{name} סיפרה יישמרו כאן, עם התאריך."),
  "elev.words.said.kept": "מה ששמרתם",

  ...g("elev.words.sayBack.head.cross", "{name} אמר/ה את זה ב{said}. אמרו את זה בחזרה ב{kept} והוסיפו עוד משהו:", "הוא אמר את זה ב{said}. אמרו את זה בחזרה ב{kept} והוסיפו עוד משהו:", "היא אמרה את זה ב{said}. אמרו את זה בחזרה ב{kept} והוסיפו עוד משהו:"),
  ...g("elev.words.sayBack.head.crossOther", "{name} אמר/ה את זה ב{said}. אמרו את זה בחזרה ב{kept} והוסיפו מילה אחת או שאלה אחת.", "הוא אמר את זה ב{said}. אמרו את זה בחזרה ב{kept} והוסיפו מילה אחת או שאלה אחת.", "היא אמרה את זה ב{said}. אמרו את זה בחזרה ב{kept} והוסיפו מילה אחת או שאלה אחת."),
  ...g("elev.words.sayBack.head.same", "אמרו את זה בחזרה והוסיפו עוד משהו:"),
  ...g("elev.words.sayBack.head.sameOther", "אמרו את זה בחזרה ב{said} והוסיפו מילה אחת או שאלה אחת."),
  ...g("elev.words.sayBack.line.word.same", "כן, {word}! איזה {word} יפה."),
  ...g("elev.words.sayBack.line.word.cross", "כן! איזה יופי. ומה עוד?"),
  ...g("elev.words.sayBack.line.echo", "כן, {word}! ועוד?"),
  ...g("elev.words.sayBack.line.sentence.talk", "ואז מה?"),
  ...g("elev.words.sayBack.line.sentence.school", "ומה עוד?"),
  ...g("elev.words.sayBack.line.question", "שאלה טובה. מה את/ה חושב/ת?", "שאלה טובה. מה אתה חושב?", "שאלה טובה. מה את חושבת?"),
  ...g("elev.words.sayBack.why.cross", "כשעונים ב{kept}, בחום ובלי לבקש מ{name} להחליף שפה, ה{kept} נשארת בשיחה ביניכם. זה הרגל שלכם, לא מבחן ל{name}."),
  ...g("elev.words.sayBack.why.same", "כשחוזרים על מה ש{name} אמר/ה ומוסיפים עוד משהו, השיחה ממשיכה. זה הרגל שלכם, לא מבחן ל{name}.", "כשחוזרים על מה ש{name} אמר ומוסיפים עוד משהו, השיחה ממשיכה. זה הרגל שלכם, לא מבחן ל{name}.", "כשחוזרים על מה ש{name} אמרה ומוסיפים עוד משהו, השיחה ממשיכה. זה הרגל שלכם, לא מבחן ל{name}."),

  "elev.words.actNow.label": "מתי לשאול איש מקצוע",
  "elev.words.more.title": "רעיונות תרגול",
  "elev.words.more.sub": "רשות — ארבע שגרות קצרות, ומתי לשאול איש מקצוע.",
  ...g("elev.words.actNow.words", "פנו לרופא/ת הילדים אם {name} לא אומר/ת אף מילה עד גיל 18 חודשים, או מפסיק/ה להגיד מילים שכבר אמר/ה.", "פנו לרופא/ת הילדים אם {name} לא אומר אף מילה עד גיל 18 חודשים, או מפסיק להגיד מילים שכבר אמר.", "פנו לרופא/ת הילדים אם {name} לא אומרת אף מילה עד גיל 18 חודשים, או מפסיקה להגיד מילים שכבר אמרה."),
  ...g("elev.words.actNow.talk", "פנו לרופא/ת הילדים אם מגיל 4 אנשים מחוץ למשפחה מתקשים להבין את {name} רוב הזמן."),
  ...g("elev.words.actNow.school", "פנו לרופא/ת הילדים או לקלינאית התקשורת של בית הספר אם הגננת או המורה של {name} מעלה איתכם משהו לגבי דיבור או הבנה."),

  "elev.words.today.q.cross": "הספקתם להגיד את זה בחזרה ב{kept}?",
  "elev.words.today.q.same": "הספקתם להגיד את זה בחזרה ולהוסיף עוד משהו?",
  "elev.words.today.a.yes": "כן",
  "elev.words.today.a.not_today": "לא היום",
  "elev.words.today.meta": "נאמר ב-{date}",

  ...g("elev.words.ledger.add", "לשמור משהו ש{name} אמר/ה", "לשמור משהו ש{name} אמר", "לשמור משהו ש{name} אמרה"),

  "elev.words.page.door": "הדף של החודש — להדפסה או לשליחה",
  "elev.words.page.posterDoor": "דף המילים הראשונות — להדפסה או לשליחה",
  "elev.words.page.back": "חזרה",
  "elev.words.page.months": "חודש",
  "elev.words.page.posterTitle": "המילים הראשונות של {name}",
  "elev.words.page.empty": "החודש עוד לא נשמר כלום.",
  "elev.words.page.print": "להדפסה",
  "elev.words.page.send": "לשלוח את המילים",
  "elev.words.page.copied": "הועתק — אפשר להדביק בהודעה.",
  "elev.words.page.closing": "מתוך ארבור — הרשימות של {parent} על {name}",

  "elev.words.send.edit": "מה יישלח — אפשר לשנות",
  "elev.words.send.onlyText": "נשלחות רק המילים האלה. בלי תמונה ובלי קישור.",
  "elev.words.send.send": "לשלוח",
  "elev.words.send.error": "השיתוף לא נפתח. אפשר להעתיק את המילים למעלה.",
  "elev.words.send.closingNoName": "מתוך ארבור — הרשימות של {parent}",
  "elev.words.invite.title": "מכירים הורה שזה יתאים לו?",
  "elev.words.invite.sub": "שלחו לו חודש חינם בארבור, וגם אתם תקבלו חודש. בקישור אין שום דבר על {name}.",
};
