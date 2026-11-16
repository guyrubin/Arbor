/** Wind-up Racer words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only. `title`, `description` and `instruction` are the Studio
 * tile and intro card (studioCopy reads them); the rest is the game's own.
 * A short run is never "so close" or "not enough": it ends where it ends. */
export const WINDUP_RACE_COPY = {
  en: {
    title: 'Wind-up Racer', description: 'Wind it up. Let it go.', instruction: 'Turn the key to wind the spring. More turns, more go.',
    finish: 'Off it went!', transfer: 'Away from the screen: wind up a toy, or roll a toy car down a slope, and watch where it stops.', done: 'Park the racer',
    tracks: ['Bookshelf run', 'Ramp and ruler', 'The long table'],
    trackLines: ['A flat run past the books, to the flag.', 'Up a book, along the top, down the ruler.', 'A pencil, dominoes, a paper tunnel, then up to the flag.'],
    wind: 'Turn the key to wind the spring.', windMore: 'More turns, more go. Then press Go!', full: 'The spring is wound all the way.',
    noWind: 'The spring is loose. Turn the key first.',
    running: 'Off it goes!', flag: 'It reached the flag!', nextTrack: 'Here comes the next track.',
    stopped: 'It stopped here. The chalk mark shows how far it went.', rolledBack: 'Up the book, and back down again!', again: 'Back to the start. Wind it again.',
    windButton: 'Wind', go: 'Go!', reset: 'Back to start',
    key: 'The wind-up key. The spring is {0}.', tension: { loose: 'loose', little: 'wound a little', half: 'half wound', tight: 'wound tight', full: 'wound all the way' },
    scene: 'A tin wind-up car on a track across the table', map: 'Track map', progress: 'Track {0} of {1}',
    keys: 'Space winds the key. Enter lets the car go.',
    quiet: 'Sound is off. Watch the key, the spring window and the gauge.',
  },
  he: {
    title: 'מכונית קפיץ', description: 'מותחים את הקפיץ. משחררים.', instruction: 'מסובבים את המפתח ומותחים את הקפיץ. יותר סיבובים, יותר נסיעה.',
    finish: 'היא נסעה!', transfer: 'הרחק מהמסך: מותחים צעצוע עם קפיץ, או מגלגלים מכונית צעצוע במורד, ורואים איפה היא עוצרת.', done: 'מחנים את המכונית',
    tracks: ['מסלול מדף הספרים', 'ספר וסרגל', 'השולחן הארוך'],
    trackLines: ['נסיעה ישרה ליד הספרים, עד הדגל.', 'עולים על ספר, נוסעים למעלה, יורדים בסרגל.', 'עיפרון, אבני דומינו, מנהרת נייר, ואז עלייה אל הדגל.'],
    wind: 'מסובבים את המפתח ומותחים את הקפיץ.', windMore: 'יותר סיבובים, יותר נסיעה. ואז לוחצים על יוצאים!', full: 'הקפיץ מתוח עד הסוף.',
    noWind: 'הקפיץ רפוי. קודם מסובבים את המפתח.',
    running: 'הנה היא נוסעת!', flag: 'היא הגיעה לדגל!', nextTrack: 'הנה מגיע המסלול הבא.',
    stopped: 'היא עצרה כאן. סימן הגיר מראה עד לאן הגיעה.', rolledBack: 'למעלה על הספר, ובחזרה למטה!', again: 'חוזרים להתחלה. מותחים שוב.',
    windButton: 'מותחים', go: 'יוצאים!', reset: 'חזרה להתחלה',
    key: 'מפתח הקפיץ. הקפיץ {0}.', tension: { loose: 'רפוי', little: 'מתוח קצת', half: 'מתוח עד חצי', tight: 'מתוח חזק', full: 'מתוח עד הסוף' },
    scene: 'מכונית פח עם קפיץ על מסלול לאורך השולחן', map: 'מפת המסלול', progress: 'מסלול {0} מתוך {1}',
    keys: 'מקש הרווח מותח את המפתח. מקש אנטר משחרר את המכונית.',
    quiet: 'הצליל כבוי. מסתכלים על המפתח, על חלון הקפיץ ועל השעון.',
  },
} as const;
export type WindupRaceWords = typeof WINDUP_RACE_COPY['en'] | typeof WINDUP_RACE_COPY['he'];

