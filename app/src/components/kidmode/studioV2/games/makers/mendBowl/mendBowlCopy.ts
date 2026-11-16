/** Mend the Bowl words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only, written for the child rather than translated line by
 * line. `title`, `description` and `instruction` are the Studio tile and intro
 * card (studioCopy reads them); the rest is the game's own. No line judges:
 * a piece that does not fit simply drifts back, with no words at all.
 * The story is the valley's own, told by what happens and never as a lesson:
 * a bowl slips in Chock's workshop, it is put right, and the mend is left
 * showing. Every cue is eight words or fewer. Blanks (`{0}`) are filled in
 * by the game. */
export const MEND_BOWL_COPY = {
  en: {
    title: 'Mend the Bowl', description: 'Gold fills the cracks.',
    instruction: 'At the Wonderworks table with Bebe and Chock: choose a glaze, fit the pieces together, then roll gold along the cracks.',
    choose: 'Choose a glaze for the bowl.', chooseNext: 'Tap a dish of glaze. Then press Ready.', ready: 'Ready',
    glazes: 'Glaze', glazeNames: { celadon: 'Celadon', indigo: 'Indigo', rose: 'Rose', cream: 'Cream' },
    broke: 'Oh — it slipped. Let’s mend it.', brokeNext: 'Chock kept every piece.',
    fit: 'Find where each piece belongs.', fitFirst: 'Drag a piece to its place.',
    fitTurn: 'Turn it until it fits.', fitPlace: 'Now put it in its place.', fitMore: 'Click. Now the next piece.',
    gold: 'Now roll gold along each crack.', goldFirst: 'Run Bebe’s ClearPatch roller along a crack.', goldFlow: 'ClearPatch leaves a seam that shows.', goldMore: 'Now another crack.',
    admire: 'Mended. The seams are meant to show.', admireNext: 'A ClearPatch mend always shows.',
    finish: 'Mended. The seams are meant to show.', transfer: 'Away from the screen: look for something that was mended once — a patched sleeve, a glued cup, a sewn-up toy.',
    keep: 'Your mended bowl',
    stage: 'The bowl on the workshop table', piece: 'Piece {0}', upright: 'upright', tilted: 'tilted', placed: 'in place', chosen: 'chosen',
    turnLeft: 'Turn left', turnRight: 'Turn right', place: 'Place {0}', crack: 'Crack {0}', golden: 'gold',
    piecesDone: '{0} of {1} pieces in place', seamsDone: '{0} of {1} cracks painted gold',
    chock: 'Chock', bebe: 'Bebe', lamp: 'Glass sun lamp', fern: 'Fern', bloom: 'Knit flower', goldDish: 'Dish of gold', roller: 'ClearPatch roller',
    keys: 'Arrow keys move the chosen piece and Enter puts it down. Or choose a place from the list.',
  },
  he: {
    title: 'מתקנים את הקערה', description: 'זהב ממלא את הסדקים.',
    instruction: 'ליד שולחן הסדנה, יחד עם בבה וצ׳וק: בוחרים זיגוג, מחברים את השברים, ואז מגלגלים זהב לאורך הסדקים.',
    choose: 'בוחרים זיגוג לקערה.', chooseNext: 'נוגעים בצלוחית של זיגוג. ואז לוחצים על מוכנים.', ready: 'מוכנים',
    glazes: 'זיגוג', glazeNames: { celadon: 'ירוק סלדון', indigo: 'כחול אינדיגו', rose: 'ורוד', cream: 'שמנת' },
    broke: 'אוי, היא החליקה. בואו נתקן אותה.', brokeNext: 'צ׳וק שמר על כל השברים.',
    fit: 'מחפשים לכל שבר את המקום שלו.', fitFirst: 'גוררים שבר למקום שלו.',
    fitTurn: 'מסובבים עד שהוא מתאים.', fitPlace: 'עכשיו מניחים אותו במקום שלו.', fitMore: 'קליק. עכשיו השבר הבא.',
    gold: 'עכשיו מגלגלים זהב לאורך כל סדק.', goldFirst: 'מעבירים את גלגלת התיקון של בבה לאורך סדק.', goldFlow: 'התפר נשאר גלוי, וזה בכוונה.', goldMore: 'עכשיו סדק נוסף.',
    admire: 'מתוקנת. התפרים נועדו להיראות.', admireNext: 'תיקון כזה תמיד רואים.',
    finish: 'מתוקנת. התפרים נועדו להיראות.', transfer: 'הרחק מהמסך: מחפשים משהו שתוקן פעם — שרוול עם טלאי, ספל שהודבק, בובה שנתפרה.',
    keep: 'הקערה שתיקנת',
    stage: 'הקערה על שולחן הסדנה', piece: 'שבר {0}', upright: 'ישר', tilted: 'עקום', placed: 'במקום', chosen: 'נבחר',
    turnLeft: 'לסובב שמאלה', turnRight: 'לסובב ימינה', place: 'מקום {0}', crack: 'סדק {0}', golden: 'בזהב',
    piecesDone: '{0} מתוך {1} שברים במקום', seamsDone: '{0} מתוך {1} סדקים נצבעו בזהב',
    chock: 'צ׳וק', bebe: 'בבה', lamp: 'מנורת שמש מזכוכית', fern: 'שרך', bloom: 'פרח סרוג', goldDish: 'צלוחית זהב', roller: 'גלגלת התיקון',
    keys: 'מקשי החיצים מזיזים את השבר שנבחר, ו־Enter מניח אותו. אפשר גם לבחור מקום מהרשימה.',
  },
} as const;
export type MendBowlWords = typeof MEND_BOWL_COPY['en'] | typeof MEND_BOWL_COPY['he'];
