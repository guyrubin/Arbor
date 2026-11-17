/** Oops Button words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only. A jam is nobody's doing and is never counted; every line
 * after one says the next small step. Petal names follow the petal order,
 * clockwise from the top of the toy. Blanks are filled by `oopsLine`. */
export const OOPS_BUTTON_COPY = {
  en: {
    hear: 'Hear it again',
    title: 'Oops Button', description: 'Pause. Put back. Try again.', instruction: 'Copy the flower. If it gets stuck, press Oops, put the petals back and start again.',
    ready: 'A toy flower! Watch it open, then copy it.', readyNext: 'Press Start, then watch.', start: 'Start',
    watch: 'Watch the flower open.', watchAgain: 'Watch again. The order is the same.', watchNext: 'Just watch. Your turn comes next.', watchStep: '{0} of {1}: {2}.',
    copy: 'Your turn. Open the petals in the same order.', copyFirst: 'Press the petal that opened first.', copyNext: '{0} of {1} open. Press the next petal.',
    bloom: 'The flower is open!', bloomNext: 'Chock hops for joy. A new order is coming.', bloomLast: 'Chock hops for joy. The flower opened three times.',
    jamCue: 'That is okay. It can be fixed.', jam: 'Oops. The flower got stuck. Press Oops.', jamToy: 'Oops. The flower got stuck by itself. That happens. Press Oops.',
    undo: 'Put the petals back. The last one goes first.', undoFirst: 'Press number {0}.', undoNext: 'Good. Now number {0}.', undoWait: 'Not yet. Press number {0}.',
    resetCue: 'The flower is ready for another try.', reset: 'All back. Press Start again.',
    pause: 'Oops!', restart: 'Start again',
    finishTitle: 'It bloomed!', transfer: 'Away from the screen: when a block tower wobbles, say oops, stop, take the top block off first, then build again.',
    quiet: 'Sound is off. The numbers on the petals show the order.',
    toy: 'The toy flower', petals: ['Orange petal', 'Blue petal', 'Green petal', 'Pink petal', 'Purple petal'],
    petalOpen: '{0}, open', petalClosed: '{0}, closed', petalStuck: '{0}, stuck halfway',
  },
  he: {
    hear: 'לשמוע שוב',
    title: 'כפתור אופס', description: 'עוצרים. מחזירים. מנסים שוב.', instruction: 'חוזרים אחרי הפרח. אם הוא נתקע, לוחצים על אופס, מחזירים את העלים ומתחילים שוב.',
    ready: 'פרח צעצוע! מסתכלים איך הוא נפתח, ואז חוזרים אחריו.', readyNext: 'לוחצים על מתחילים ומסתכלים.', start: 'מתחילים',
    watch: 'מסתכלים איך הפרח נפתח.', watchAgain: 'מסתכלים שוב. הסדר נשאר אותו סדר.', watchNext: 'רק מסתכלים. התור לפתוח מגיע מיד.', watchStep: '{0} מתוך {1}: {2}.',
    copy: 'התור שלכם. פותחים את העלים באותו סדר.', copyFirst: 'לוחצים על העלה שנפתח ראשון.', copyNext: '{0} מתוך {1} פתוחים. לוחצים על הבא בתור.',
    bloom: 'הפרח פתוח!', bloomNext: 'קפיצת שמחה של צ׳וק. מיד מגיע סדר חדש.', bloomLast: 'קפיצת שמחה של צ׳וק. הפרח נפתח שלוש פעמים.',
    jamCue: 'זה בסדר. אפשר לתקן.', jam: 'אופס. הפרח נתקע. לוחצים על אופס.', jamToy: 'אופס. הפרח נתקע מעצמו. זה קורה. לוחצים על אופס.',
    undo: 'מחזירים את העלים. האחרון חוזר ראשון.', undoFirst: 'לוחצים על מספר {0}.', undoNext: 'יפה. עכשיו מספר {0}.', undoWait: 'עדיין לא. לוחצים על מספר {0}.',
    resetCue: 'הפרח מוכן לניסיון נוסף.', reset: 'הכול חזר למקום. לוחצים על מתחילים שוב.',
    pause: 'אופס!', restart: 'מתחילים שוב',
    finishTitle: 'הפרח פרח!', transfer: 'מחוץ למסך: כשמגדל קוביות מתנדנד, אומרים אופס, עוצרים, מורידים קודם את הקובייה העליונה ובונים שוב.',
    quiet: 'הצליל כבוי. המספרים על העלים מראים את הסדר.',
    toy: 'פרח הצעצוע', petals: ['עלה כתום', 'עלה כחול', 'עלה ירוק', 'עלה ורוד', 'עלה סגול'],
    petalOpen: '{0}, פתוח', petalClosed: '{0}, סגור', petalStuck: '{0}, תקוע באמצע',
  },
} as const;
export type OopsButtonWords = typeof OOPS_BUTTON_COPY['en'] | typeof OOPS_BUTTON_COPY['he'];

/** Fills the numbered blanks of a line: `{0}` is the first value, `{1}` the next. */
export function oopsLine(template: string, ...values: (string | number)[]): string {
  return template.replace(/\{(\d)\}/g, (_match, slot: string) => String(values[Number(slot)] ?? ''));
}
