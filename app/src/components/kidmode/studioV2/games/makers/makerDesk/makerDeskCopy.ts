/** Maker Desk words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only. `title`, `description` and `instruction` are the Studio
 * tile and intro card (studioCopy reads them); the rest is the game's own. */
export const MAKER_DESK_COPY = {
  en: { title: 'Maker Desk', description: 'Your things, on your desk.', instruction: 'Open the little computer on your desk and look through the things you made.', finish: 'Your desk is all tidy.', transfer: 'Away from the screen: show someone one thing you made.', done: 'Close the desk' },
  he: { title: 'שולחן היוצרים', description: 'הדברים שלך על השולחן.', instruction: 'פותחים את המחשב הקטן על השולחן ומעיינים בדברים שיצרת.', finish: 'השולחן מסודר.', transfer: 'הרחק מהמסך: מראים למישהו דבר אחד שיצרת.', done: 'סוגרים את השולחן' },
} as const;
