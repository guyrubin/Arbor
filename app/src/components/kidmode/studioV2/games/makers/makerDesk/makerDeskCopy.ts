/** Maker Desk words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only. `title`, `description` and `instruction` are the Studio
 * tile and intro card (studioCopy reads them); the rest is the game's own.
 * The pretend computer's commands stay in English letters in both languages
 * (that is how terminals are); every answer is in the UI language. Blanks
 * (`{0}`) are filled by `deskLine`. */
export const MAKER_DESK_COPY = {
  en: {
    title: 'Maker Desk', description: 'A little computer on your own desk.', instruction: 'Tap things on the desk. Switch on the computer, play Bounce, look at your things and ask the computer a word.',
    finish: 'Your desk is all yours.', transfer: 'Away from the screen: show someone one thing you made.', done: 'Done',
    // The room
    roomCue: 'Your Maker Desk. Tap things to see what they do.', roomEvening: 'Evening at the desk. The lamp is on.',
    computer: 'The computer. Switch it on', computerWarm: 'The computer is switching on',
    shelf: 'The shelf of things you made', shelfOpen: 'The shelf, with name tags showing', shelfEmpty: 'The shelf. Empty stands, waiting',
    shelfTag: 'Things you make in the Studio live here.',
    lampDay: 'The desk lamp. Make it evening', lampEvening: 'The desk lamp. Make it day',
    windowClosed: 'The window. Open the blind', windowOpen: 'The window. Close the blind',
    bird: 'A bird is sitting outside the window.', birdGone: 'The bird flew away.',
    switching: 'Switching on…',
    // The way back
    toDesk: 'Desk', toDesktop: 'Desktop', backTo: 'Back to the {0}',
    // The desktop
    desktopCue: 'The computer is on. Pick a program.', programs: 'Programs',
    bounce: 'Bounce', things: 'My Things', ask: 'Ask the computer',
    skyDay: 'Daytime', skyNight: 'Night-time',
    // Bounce
    bounceCue: 'Light every lantern with the ball.', bounceField: 'Bounce. Drag or use the arrows to move the paddle. The ball always comes back.',
    left: 'Move the paddle left', right: 'Move the paddle right',
    lit: 'A lantern lights up.', cloud: 'Boop! A cloud floats the ball back up.', allLit: 'Every lantern is glowing!', again: 'New lanterns',
    // My Things
    thingsCue: 'Your things, from the Studio.', thingsEmpty: 'Make something in the Studio and it will appear here.',
    thingOpen: 'Look at {0}', thingClose: 'Back to all things', thingsList: 'Things you made',
    kinds: { corner: 'Your little world', melody: 'Your tune', dance: 'Your dance', bowl: 'Your mended bowl', textile: 'Your stitched garden', bottle: 'Your bottle' },
    // Ask the computer
    welcome: 'Maker Desk computer. Ready!', terminalCue: 'Press a word, or type one, and the computer answers.', screen: 'The computer’s answers',
    input: 'Type a word for the computer', enter: 'Enter', tryWords: 'Words to try', complete: 'Finish the word',
    helpTitle: 'Words I know:',
    help: { help: 'this list', ls: 'show my files', about: 'read about me', secret: 'a little secret', things: 'the things you made', hello: 'say hello', beep: 'make a beep', clear: 'clean the screen' },
    about: ['This is the Maker Desk computer. It lives in your Studio.', 'It knows a few words, plays one game and keeps your things safe.', 'It never goes on the internet. Everything stays right here.'],
    riddles: [
      ['What has a mouse but never a cat?', 'A computer!'],
      ['What did the ball say to the paddle?', 'Thanks for the lift!'],
      ['What is a computer’s favourite snack?', 'Microchips!'],
    ],
    things_: { bowl: 'A bowl, mended with gold.', textile: 'A cloth with flowers stitched on it.', bottle: 'A bottle with its own shape and colour.', corner: 'A cosy little world, built just so.', melody: 'A tune that plays in shapes.', dance: 'A dance for your hero, step by step.' },
    thingsEmptyTerm: 'The things folder is empty for now. Make something in the Studio!',
    helloMore: 'Nice to see you at the desk.',
    unknown: 'I don’t know that word yet. Try: help',
    noFile: 'There is no file with that name here. Try: ls',
    catNeeds: 'cat needs a file name. Try: cat about.txt',
    isFolder: 'things is a folder. Try: ls things',
    beep: 'Beep! Boop!',
    keyboard: 'Your keyboard is typing Hebrew letters, so I read it as:',
    // Stickers and the end
    stickers: 'Desk stickers', stickerLit: '{0}: glowing', stickerDim: '{0}: not yet',
    stickerNames: { lanterns: 'Light every lantern', things: 'Open My Things', commands: 'Ask the computer two words' },
    allStickers: 'All three stickers glow! Tap Done when you are ready, or keep playing.', doneWaiting: 'All three stickers glow! Done is waiting on the desk.',
  },
  he: {
    title: 'שולחן היוצרים', description: 'מחשב קטן על שולחן משלך.', instruction: 'נוגעים בדברים שעל השולחן. מדליקים את המחשב, משחקים בקפיצות, מסתכלים על הדברים שלך ושואלים את המחשב מילה.',
    finish: 'השולחן כולו שלך.', transfer: 'הרחק מהמסך: מראים למישהו דבר אחד שיצרת.', done: 'סיימנו',
    roomCue: 'שולחן היוצרים שלך. נוגעים בדברים ורואים מה הם עושים.', roomEvening: 'ערב ליד השולחן. המנורה דולקת.',
    computer: 'המחשב. להדליק אותו', computerWarm: 'המחשב נדלק',
    shelf: 'מדף הדברים שיצרת', shelfOpen: 'המדף, עם תוויות שמות', shelfEmpty: 'המדף. מעמדים ריקים מחכים',
    shelfTag: 'הדברים שיוצרים בסטודיו גרים כאן.',
    lampDay: 'מנורת השולחן. להפוך לערב', lampEvening: 'מנורת השולחן. להפוך ליום',
    windowClosed: 'החלון. לפתוח את הווילון', windowOpen: 'החלון. לסגור את הווילון',
    bird: 'ציפור יושבת מחוץ לחלון.', birdGone: 'הציפור עפה.',
    switching: 'נדלק…',
    toDesk: 'שולחן', toDesktop: 'שולחן העבודה', backTo: 'חזרה אל {0}',
    desktopCue: 'המחשב דולק. בוחרים תוכנה.', programs: 'תוכנות',
    bounce: 'קפיצות', things: 'הדברים שלי', ask: 'שואלים את המחשב',
    skyDay: 'יום', skyNight: 'לילה',
    bounceCue: 'מדליקים את כל הפנסים בעזרת הכדור.', bounceField: 'קפיצות. גוררים או לוחצים על החצים כדי להזיז את המחבט. הכדור תמיד חוזר.',
    left: 'להזיז את המחבט שמאלה', right: 'להזיז את המחבט ימינה',
    lit: 'פנס נדלק.', cloud: 'בופ! ענן מרים את הכדור בחזרה למעלה.', allLit: 'כל הפנסים זוהרים!', again: 'פנסים חדשים',
    thingsCue: 'הדברים שלך, מהסטודיו.', thingsEmpty: 'יוצרים משהו בסטודיו, והוא יופיע כאן.',
    thingOpen: 'להסתכל על {0}', thingClose: 'חזרה לכל הדברים', thingsList: 'דברים שיצרת',
    kinds: { corner: 'העולם הקטן שלך', melody: 'המנגינה שלך', dance: 'הריקוד שלך', bowl: 'הקערה שתיקנת', textile: 'הגינה שרקמת', bottle: 'הבקבוק שעיצבת' },
    welcome: 'המחשב של שולחן היוצרים. מוכן!', terminalCue: 'לוחצים על מילה, או מקלידים אחת, והמחשב עונה.', screen: 'התשובות של המחשב',
    input: 'מקלידים מילה למחשב', enter: 'אישור', tryWords: 'מילים לנסות', complete: 'להשלים את המילה',
    helpTitle: 'המילים שאני מכיר:',
    help: { help: 'הרשימה הזאת', ls: 'להראות את הקבצים שלי', about: 'לקרוא עליי', secret: 'סוד קטן', things: 'הדברים שיצרת', hello: 'להגיד שלום', beep: 'להשמיע צפצוף', clear: 'לנקות את המסך' },
    about: ['זה המחשב של שולחן היוצרים. הוא גר בסטודיו שלך.', 'הוא מכיר כמה מילים, יש בו משחק אחד, והוא שומר על הדברים שלך.', 'הוא אף פעם לא מתחבר לאינטרנט. הכול נשאר כאן.'],
    riddles: [
      ['למי יש עכבר, אבל אף פעם אין חתול?', 'למחשב!'],
      ['מה אמר הכדור למחבט?', 'תודה על ההקפצה!'],
      ['מה החטיף האהוב על המחשב?', 'צ׳יפס! כמו השבבים הקטנים שבתוכו.'],
    ],
    things_: { bowl: 'קערה שתוקנה בזהב.', textile: 'בד עם פרחים רקומים.', bottle: 'בקבוק עם צורה וצבע משלו.', corner: 'עולם קטן ונעים, בנוי בדיוק ככה.', melody: 'מנגינה שמתנגנת בצורות.', dance: 'ריקוד לגיבור שלך, צעד אחרי צעד.' },
    thingsEmptyTerm: 'תיקיית הדברים ריקה בינתיים. יוצרים משהו בסטודיו!',
    helloMore: 'כיף לראות אותך ליד השולחן.',
    unknown: 'את המילה הזאת אני עוד לא מכיר. אפשר לנסות: help',
    noFile: 'אין כאן קובץ בשם הזה. אפשר לנסות: ls',
    catNeeds: 'למילה cat צריך שם של קובץ. אפשר לנסות: cat about.txt',
    isFolder: 'things היא תיקייה. אפשר לנסות: ls things',
    beep: 'ביפ! בופ!',
    keyboard: 'המקלדת כותבת באותיות עבריות, אז קראתי את זה כך:',
    stickers: 'מדבקות השולחן', stickerLit: '{0}: זוהרת', stickerDim: '{0}: עוד לא',
    stickerNames: { lanterns: 'להדליק את כל הפנסים', things: 'לפתוח את הדברים שלי', commands: 'לשאול את המחשב שתי מילים' },
    allStickers: 'שלוש המדבקות זוהרות! לוחצים על סיימנו כשמוכנים, או ממשיכים לשחק.', doneWaiting: 'שלוש המדבקות זוהרות! סיימנו מחכה על השולחן.',
  },
} as const;
export type MakerDeskWords = typeof MAKER_DESK_COPY['en'] | typeof MAKER_DESK_COPY['he'];

/** Fills the numbered blanks of a line: `{0}` is the first value. */
export function deskLine(template: string, ...values: (string | number)[]): string {
  return template.replace(/\{(\d)\}/g, (_match, slot: string) => String(values[Number(slot)] ?? ''));
}
