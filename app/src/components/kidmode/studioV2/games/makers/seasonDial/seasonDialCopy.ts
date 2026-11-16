/** Weather Maker words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only (the friends are told through their things, never a
 * gendered verb). `title`, `description` and `instruction` are the Studio
 * tile and intro card (studioCopy reads them); the rest is the game's own.
 * It is a make-believe machine and says so: nothing suggests that a real dial
 * changes the seasons. `phases` follow seasonDialRules `phaseAt`, in order.
 * Blanks are filled by `seasonLine` (seasonDialRules). */
export const SEASON_DIAL_COPY = {
  en: {
    title: 'Weather Maker', description: 'A pretend machine that turns the year over Horizon Valley.',
    instruction: 'On the Sky Gardens terrace, turn the big brass dial and watch the valley and the old apple tree go through the year: blossom, sunshine, falling leaves and snow.',
    seasons: ['Spring', 'Summer', 'Autumn', 'Winter'],
    phases: [
      'Late winter. Buds on the branches.', 'Spring. The apple tree is in blossom. Aya has her watering can.', 'Spring rain. New leaves are growing. GobGob is out in the yellow jacket.',
      'Summer. Green leaves and little apples. Chock sits in the shade.', 'Late summer. The leaves begin to change.', 'Autumn. Gold and red leaves. Pep is after them.',
      'Autumn wind. The leaves are falling.', 'Winter. Snow on the branches and on the valley. Bebe stands by the snow friend.',
    ],
    dial: 'The season dial', scene: 'The apple tree on the Sky Gardens terrace', cue: 'Turn the dial', shake: 'Shake the tree',
    lab: 'Aya’s LeafLab',
    labMoisture: ['dry soil', 'damp soil', 'wet soil'], labLight: ['dim light', 'soft light', 'bright light'], labWarmth: ['cold air', 'mild air', 'warm air'],
    goTo: 'Turn to {0}', back: 'Turn back a little', on: 'Turn on a little', pause: 'Hold still', play: 'Let it move',
    lit: '{0} glows on the dial.', full: 'A whole year!', fullLine: 'The dial goes round the whole year by itself.',
    done: 'Done', doneLine: 'Keep turning, or press Done.',
    finish: 'A whole year on the dial!', transfer: 'Away from the screen: look out of a window. Which season is it outside today?',
  },
  he: {
    title: 'מכונת מזג האוויר', description: 'מכונת דמיון שמסובבת את השנה מעל עמק האופק.',
    instruction: 'במרפסת של גני השמיים מסובבים את חוגת הפליז הגדולה ורואים איך העמק ועץ התפוח הזקן עוברים את כל השנה: פריחה, שמש, עלים נושרים ושלג.',
    seasons: ['אביב', 'קיץ', 'סתיו', 'חורף'],
    phases: [
      'סוף החורף. ניצנים על הענפים.', 'אביב. עץ התפוח פורח. המשפך של איה מוכן.', 'גשם של אביב. עלים חדשים צומחים. המעיל הצהוב של גובגוב בחוץ.',
      'קיץ. עלים ירוקים ותפוחים קטנים. המקום של צ׳וק בצל.', 'סוף הקיץ. העלים מתחילים להחליף צבע.', 'סתיו. עלים בצבעי זהב ואדום. הזנב של פפ מכשכש.',
      'רוח של סתיו. העלים נושרים.', 'חורף. שלג על הענפים ועל העמק. המקום של בבה ליד בובת השלג.',
    ],
    dial: 'חוגת העונות', scene: 'עץ התפוח במרפסת של גני השמיים', cue: 'מסובבים את החוגה', shake: 'מנערים את העץ',
    lab: 'מעבדת העלים של איה',
    labMoisture: ['אדמה יבשה', 'אדמה לחה', 'אדמה רטובה'], labLight: ['אור עמום', 'אור רך', 'אור חזק'], labWarmth: ['אוויר קר', 'אוויר נעים', 'אוויר חם'],
    goTo: 'מסובבים אל {0}', back: 'מסובבים קצת אחורה', on: 'מסובבים קצת קדימה', pause: 'עוצרים רגע', play: 'ממשיכים לזוז',
    lit: '{0} מאיר על החוגה.', full: 'שנה שלמה!', fullLine: 'החוגה מסתובבת לבד סביב כל השנה.',
    done: 'סיימנו', doneLine: 'אפשר להמשיך לסובב, או ללחוץ על סיימנו.',
    finish: 'שנה שלמה על החוגה!', transfer: 'הרחק מהמסך: מסתכלים מהחלון. איזו עונה יש בחוץ היום?',
  },
} as const;
export type SeasonDialWords = typeof SEASON_DIAL_COPY['en'] | typeof SEASON_DIAL_COPY['he'];
