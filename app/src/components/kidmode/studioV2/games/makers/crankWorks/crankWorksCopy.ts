/** How Things Move words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only. `title`, `description` and `instruction` are the Studio
 * tile and intro card (studioCopy reads them); the rest is the game's own. */
export const CRANK_WORKS_COPY = {
  en: { title: 'How Things Move', description: 'Turn the crank. See it go.', instruction: 'Turn the crank and join the gears to see how one turn moves another.', finish: 'Everything is moving!', transfer: 'Away from the screen: find something at home that turns, like a tap or a whisk.', done: 'It all moves' },
  he: { title: 'איך דברים זזים', description: 'מסובבים את הידית. רואים מה זז.', instruction: 'מסובבים את הידית ומחברים את גלגלי השיניים כדי לראות איך סיבוב אחד מזיז את השני.', finish: 'הכול זז!', transfer: 'הרחק מהמסך: מחפשים בבית משהו שמסתובב, כמו ברז או מטרפה.', done: 'הכול זז' },
} as const;
