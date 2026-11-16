/** Weather Maker words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only. `title`, `description` and `instruction` are the Studio
 * tile and intro card (studioCopy reads them); the rest is the game's own.
 * It is a make-believe machine and says so: nothing suggests that a real dial
 * changes the seasons. `phases` follow seasonDialRules `phaseAt`, in order.
 * Blanks are filled by `seasonLine` (seasonDialRules). */
export const SEASON_DIAL_COPY = {
  en: {
    title: 'Weather Maker', description: 'A pretend machine that turns the year.',
    instruction: 'Turn the big dial and watch the old apple tree go through the year: blossom, sunshine, falling leaves and snow.',
    seasons: ['Spring', 'Summer', 'Autumn', 'Winter'],
    phases: [
      'Late winter. Buds on the branches.', 'Spring. The apple tree is in blossom.', 'Spring rain. New leaves are growing.',
      'Summer. Green leaves and little apples.', 'Late summer. The leaves begin to change.', 'Autumn. Gold and red leaves.',
      'Autumn wind. The leaves are falling.', 'Winter. Snow on the bare branches.',
    ],
    dial: 'The season dial', scene: 'The old apple tree on its hill',
    goTo: 'Turn to {0}', back: 'Turn back a little', on: 'Turn on a little', pause: 'Hold still', play: 'Let it move',
    lit: '{0} glows on the dial.', full: 'A whole year!', fullLine: 'The dial goes round the whole year by itself.',
    done: 'Done', doneLine: 'Keep turning, or press Done.',
    finish: 'A whole year on the dial!', transfer: 'Away from the screen: look out of a window. Which season is it outside today?',
  },
  he: {
    title: 'מכונת מזג האוויר', description: 'מכונת דמיון שמסובבת את השנה.',
    instruction: 'מסובבים את החוגה הגדולה ומסתכלים איך עץ התפוח הזקן עובר את כל השנה: פריחה, שמש, עלים נושרים ושלג.',
    seasons: ['אביב', 'קיץ', 'סתיו', 'חורף'],
    phases: [
      'סוף החורף. ניצנים על הענפים.', 'אביב. עץ התפוח פורח.', 'גשם של אביב. עלים חדשים צומחים.',
      'קיץ. עלים ירוקים ותפוחים קטנים.', 'סוף הקיץ. העלים מתחילים להחליף צבע.', 'סתיו. עלים בצבעי זהב ואדום.',
      'רוח של סתיו. העלים נושרים.', 'חורף. שלג על הענפים החשופים.',
    ],
    dial: 'חוגת העונות', scene: 'עץ התפוח הזקן על הגבעה',
    goTo: 'מסובבים אל {0}', back: 'מסובבים קצת אחורה', on: 'מסובבים קצת קדימה', pause: 'עוצרים רגע', play: 'ממשיכים לזוז',
    lit: '{0} מאיר על החוגה.', full: 'שנה שלמה!', fullLine: 'החוגה מסתובבת לבד סביב כל השנה.',
    done: 'סיימנו', doneLine: 'אפשר להמשיך לסובב, או ללחוץ על סיימנו.',
    finish: 'שנה שלמה על החוגה!', transfer: 'הרחק מהמסך: מסתכלים מהחלון. איזו עונה יש בחוץ היום?',
  },
} as const;
export type SeasonDialWords = typeof SEASON_DIAL_COPY['en'] | typeof SEASON_DIAL_COPY['he'];

