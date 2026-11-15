/** Oops Button words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only. A jam is nobody's doing and is never counted; every line
 * after one says the next small step. Petal names follow the petal order,
 * clockwise from the top of the toy. Blanks are filled by `oopsLine`. */
export const OOPS_BUTTON_COPY = {
  en: {
    title: 'Oops Button', description: 'Pause. Put back. Try again.', instruction: 'Copy the flower. If it jams, pause, put the petals back and restart.',
    ready: 'A toy flower! Watch it open, then copy it.', readyNext: 'Press Start, then watch.', start: 'Start',
    watch: 'Watch the flower open.', watchAgain: 'Watch again. The order is the same.', watchNext: 'Just watch. Your turn comes next.', watchStep: '{0} of {1}: {2}.',
    copy: 'Your turn. Open the petals in the same order.', copyFirst: 'Press the petal that opened first.', copyNext: '{0} of {1} open. Press the next petal.',
    bloom: 'The flower is open!', bloomNext: 'Chock’s tail thumps. A new order is coming.', bloomLast: 'Chock’s tail thumps. The flower opened three times.',
    jamCue: 'That is okay. It can be fixed.', jam: 'Oops. It jammed. Press pause.', jamToy: 'Oops. The flower got stuck. That happens. Press pause.',
    undo: 'Put the petals back. Last one first.', undoFirst: 'Press the petal that opened last.', undoNext: 'Good. Now the one before it.', undoWait: 'Not yet. Start with the last one.',
    resetCue: 'The flower is ready for another try.', reset: 'All back. Press restart.',
    pause: 'Pause', restart: 'Restart',
    finishTitle: 'It bloomed!', transfer: 'Try it for real: when something goes wrong, say oops, stop, and put one thing right.',
    quiet: 'Sound is off. The numbers on the petals show the order.',
    toy: 'The toy flower', petals: ['Amber petal', 'Blue petal', 'Teal petal', 'Coral petal', 'Violet petal'],
    petalOpen: '{0}, open', petalClosed: '{0}, closed', petalStuck: '{0}, stuck halfway',
  },
  he: {
    title: 'כפתור אופס', description: 'עוצרים. מחזירים. מנסים שוב.', instruction: 'חוזרים אחרי הפרח. אם הוא נתקע, עוצרים, מחזירים את עלי הכותרת ומפעילים מחדש.',
    ready: 'פרח צעצוע! מסתכלים איך הוא נפתח, ואז חוזרים אחריו.', readyNext: 'לוחצים על מתחילים ומסתכלים.', start: 'מתחילים',
    watch: 'מסתכלים איך הפרח נפתח.', watchAgain: 'מסתכלים שוב. הסדר נשאר אותו סדר.', watchNext: 'רק מסתכלים. התור לפתוח מגיע מיד.', watchStep: '{0} מתוך {1}: {2}.',
    copy: 'עכשיו פותחים את עלי הכותרת באותו סדר.', copyFirst: 'לוחצים על עלה הכותרת שנפתח ראשון.', copyNext: '{0} מתוך {1} פתוחים. לוחצים על הבא בתור.',
    bloom: 'הפרח פתוח!', bloomNext: 'הזנב של צ׳וק מתופף. מיד מגיע סדר חדש.', bloomLast: 'הזנב של צ׳וק מתופף. הפרח נפתח שלוש פעמים.',
    jamCue: 'זה בסדר. אפשר לתקן.', jam: 'אופס. הפרח נתקע. לוחצים על עצירה.', jamToy: 'אופס. הפרח נתקע מעצמו. זה קורה. לוחצים על עצירה.',
    undo: 'מחזירים את עלי הכותרת. האחרון חוזר ראשון.', undoFirst: 'לוחצים על עלה הכותרת שנפתח אחרון.', undoNext: 'יפה. עכשיו זה שנפתח לפניו.', undoWait: 'עדיין לא. מתחילים מהאחרון.',
    resetCue: 'הפרח מוכן לניסיון נוסף.', reset: 'הכול חזר למקום. לוחצים על הפעלה מחדש.',
    pause: 'עצירה', restart: 'הפעלה מחדש',
    finishTitle: 'הפרח פורח!', transfer: 'מנסים באמת: כשמשהו משתבש, אומרים אופס, עוצרים, ומתקנים דבר אחד.',
    quiet: 'הצליל כבוי. המספרים על עלי הכותרת מראים את הסדר.',
    toy: 'פרח הצעצוע', petals: ['עלה כותרת בצבע ענבר', 'עלה כותרת כחול', 'עלה כותרת טורקיז', 'עלה כותרת בצבע אלמוג', 'עלה כותרת סגול'],
    petalOpen: '{0}, פתוח', petalClosed: '{0}, סגור', petalStuck: '{0}, תקוע באמצע',
  },
} as const;
export type OopsButtonWords = typeof OOPS_BUTTON_COPY['en'] | typeof OOPS_BUTTON_COPY['he'];

/** Fills the numbered blanks of a line: `{0}` is the first value, `{1}` the next. */
export function oopsLine(template: string, ...values: (string | number)[]): string {
  return template.replace(/\{(\d)\}/g, (_match, slot: string) => String(values[Number(slot)] ?? ''));
}
