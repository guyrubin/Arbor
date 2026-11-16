/** Mend the Bowl words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only, written for the child rather than translated line by
 * line. `title`, `description` and `instruction` are the Studio tile and intro
 * card (studioCopy reads them); the rest is the game's own. No line judges:
 * a piece that does not fit simply drifts back, with no words at all.
 * Blanks (`{0}`) are filled in by the game. */
export const MEND_BOWL_COPY = {
  en: {
    title: 'Mend the Bowl', description: 'Gold fills the cracks.',
    instruction: 'Choose a glaze, fit the pieces back together, then paint the cracks with gold.',
    choose: 'Choose a glaze for the bowl.', chooseNext: 'When it looks just right, tap the bowl.', ready: 'Ready',
    glazes: 'Glaze', glazeNames: { celadon: 'Celadon', indigo: 'Indigo', rose: 'Rose', cream: 'Cream' },
    broke: 'Oh — it slipped. Let’s mend it.', brokeNext: 'The pieces are all here.',
    fit: 'Find where each piece belongs.', fitFirst: 'Drag a piece to its place, or tap it and then tap its place.',
    fitTurn: 'Turn it with the round buttons, then tap its place.', fitPlace: 'Now tap its place, or drag it there.', fitIn: 'It fits.', fitMore: 'Click. Now the next piece.',
    gold: 'Now paint the cracks with gold.', goldFirst: 'Trace a crack with your finger, or tap it.', goldFlow: 'The gold flows into the crack.', goldMore: 'Now another crack.',
    admire: 'Mended. Look how it shines.', admireNext: 'The gold shows where it was mended.',
    finish: 'Mended. Look how it shines.', transfer: 'Away from the screen: look for something that was mended once — a patched sleeve, a glued cup, a sewn-up toy.',
    done: 'All mended', keep: 'Your mended bowl',
    stage: 'The bowl on its cloth', piece: 'Piece {0}', upright: 'upright', tilted: 'tilted', placed: 'in place', chosen: 'chosen',
    turnLeft: 'Turn left', turnRight: 'Turn right', place: 'Place {0}', crack: 'Crack {0}', golden: 'gold',
    keys: 'Arrow keys move the chosen piece and Enter puts it down. Or choose a place from the list.',
  },
  he: {
    title: 'מתקנים את הקערה', description: 'זהב ממלא את הסדקים.',
    instruction: 'בוחרים זיגוג, מחברים את השברים בחזרה, ואז צובעים את הסדקים בזהב.',
    choose: 'בוחרים זיגוג לקערה.', chooseNext: 'כשהיא נראית בדיוק כמו שרוצים, נוגעים בקערה.', ready: 'מוכנים',
    glazes: 'זיגוג', glazeNames: { celadon: 'ירוק סלדון', indigo: 'כחול אינדיגו', rose: 'ורוד', cream: 'שמנת' },
    broke: 'אוי, היא החליקה. בואו נתקן אותה.', brokeNext: 'כל השברים כאן.',
    fit: 'מחפשים לכל שבר את המקום שלו.', fitFirst: 'גוררים שבר למקום שלו, או נוגעים בשבר ואז במקום שלו.',
    fitTurn: 'מסובבים בכפתורים העגולים, ואז נוגעים במקום שלו.', fitPlace: 'עכשיו נוגעים במקום שלו, או גוררים אותו לשם.', fitIn: 'נכנס בדיוק.', fitMore: 'קליק. עכשיו השבר הבא.',
    gold: 'עכשיו צובעים את הסדקים בזהב.', goldFirst: 'מעבירים אצבע לאורך סדק, או נוגעים בו.', goldFlow: 'הזהב זורם לתוך הסדק.', goldMore: 'עכשיו סדק נוסף.',
    admire: 'מתוקנת. רואים איך היא מנצנצת?', admireNext: 'הזהב מראה איפה תיקנו.',
    finish: 'מתוקנת. רואים איך היא מנצנצת?', transfer: 'הרחק מהמסך: מחפשים משהו שתוקן פעם — שרוול עם טלאי, ספל שהודבק, בובה שנתפרה.',
    done: 'סיימנו לתקן', keep: 'הקערה שתיקנת',
    stage: 'הקערה על המפית', piece: 'שבר {0}', upright: 'ישר', tilted: 'עקום', placed: 'במקום', chosen: 'נבחר',
    turnLeft: 'לסובב שמאלה', turnRight: 'לסובב ימינה', place: 'מקום {0}', crack: 'סדק {0}', golden: 'בזהב',
    keys: 'מקשי החיצים מזיזים את השבר שנבחר, ו־Enter מניח אותו. אפשר גם לבחור מקום מהרשימה.',
  },
} as const;
export type MendBowlWords = typeof MEND_BOWL_COPY['en'] | typeof MEND_BOWL_COPY['he'];

