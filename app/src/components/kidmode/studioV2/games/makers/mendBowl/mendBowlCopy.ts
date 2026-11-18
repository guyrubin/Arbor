/** Mend the Bowl words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only, written for the child rather than translated line by
 * line. `title`, `description` and `instruction` are the Studio tile and intro
 * card (studioCopy reads them); the rest is the game's own. No line judges:
 * a piece that does not fit simply drifts back, with no words at all.
 * The story is the valley's own, told by what happens and never as a lesson:
 * a bowl slips in Chock's workshop, it is put right, and the mend is left
 * showing. Every cue is eight words or fewer. Blanks (`{0}`) are filled in
 * by the game.
 *
 * The Game Cut: the cues are spoken by the host in the HUD (Chock, whose
 * table it is; Bebe when his ClearPatch roller comes out). `where` and the
 * `quest*` names are the opening lockup and the three chapters. */
export const MEND_BOWL_COPY = {
  en: {
    title: 'Mend the Bowl', description: 'Gold fills the cracks.',
    instruction: 'At the Wonderworks table with Bebe and Chock: choose a glaze, fit the pieces together, then roll gold along the cracks.',
    where: 'Wonderworks · Chock’s table', welcome: 'A tea bowl, fresh from the kiln.',
    questName: 'Three jobs', questGlaze: 'Glaze', questFit: 'Fit', questGold: 'Gold',
    choose: 'Touch a dish. Pick its glaze.', chooseThen: 'Lovely. Now lift it to the light.', chooseNext: 'Touch a dish of glaze. Then lift the bowl.', ready: 'Lift it up',
    glazes: 'Glaze', glazeNames: { celadon: 'Celadon', indigo: 'Indigo', rose: 'Rose', cream: 'Cream' },
    broke: 'Oh — it slipped. We can mend it.', brokeNext: 'Chock kept every piece.',
    fit: 'Every piece has its place.', fitFirst: 'Drag a piece to its place.',
    fitTurn: 'Turn it until it fits.', fitPlace: 'Now put it in its place.', fitMore: 'Click. Now the next piece.',
    whole: 'Whole again. Now for the cracks.', wholeToast: 'Whole again',
    gold: 'Roll my ClearPatch along a crack.', goldFirst: 'Run Bebe’s ClearPatch roller along a crack.', goldFlow: 'ClearPatch leaves a seam that shows.', goldMore: 'Now another crack.',
    goldToast: 'Gold in every crack',
    admire: 'Mended. The seams are meant to show.', admireNext: 'A ClearPatch mend always shows.',
    tea: 'Now it can hold tea again.', lit: 'Look how the gold catches the light.',
    secret: 'A petal for the tea', hostPat: 'Chock is watching every piece.',
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
    where: 'וונדרוורקס · השולחן של צ׳וק', welcome: 'קערת תה, ישר מהתנור.',
    questName: 'שלוש משימות', questGlaze: 'זיגוג', questFit: 'חיבור', questGold: 'זהב',
    choose: 'נוגעים בצלוחית. בוחרים זיגוג.', chooseThen: 'יפה. עכשיו מרימים אותה אל האור.', chooseNext: 'נוגעים בצלוחית של זיגוג. ואז מרימים את הקערה.', ready: 'מרימים',
    glazes: 'זיגוג', glazeNames: { celadon: 'ירוק סלדון', indigo: 'כחול אינדיגו', rose: 'ורוד', cream: 'שמנת' },
    broke: 'אוי, היא החליקה. אפשר לתקן אותה.', brokeNext: 'צ׳וק שמר על כל השברים.',
    fit: 'לכל שבר יש מקום משלו.', fitFirst: 'גוררים שבר למקום שלו.',
    fitTurn: 'מסובבים עד שהוא מתאים.', fitPlace: 'עכשיו מניחים אותו במקום שלו.', fitMore: 'קליק. עכשיו השבר הבא.',
    whole: 'שוב שלמה. עכשיו הסדקים.', wholeToast: 'שוב שלמה',
    gold: 'מגלגלים את גלגלת התיקון שלי לאורך סדק.', goldFirst: 'מעבירים את גלגלת התיקון של בבה לאורך סדק.', goldFlow: 'התפר נשאר גלוי, וזה בכוונה.', goldMore: 'עכשיו סדק נוסף.',
    goldToast: 'זהב בכל סדק',
    admire: 'מתוקנת. התפרים נועדו להיראות.', admireNext: 'תיקון כזה תמיד רואים.',
    tea: 'עכשיו שוב אפשר למזוג בה תה.', lit: 'איך הזהב תופס את האור.',
    secret: 'עלה כותרת לתה', hostPat: 'צ׳וק שומר על כל שבר.',
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
