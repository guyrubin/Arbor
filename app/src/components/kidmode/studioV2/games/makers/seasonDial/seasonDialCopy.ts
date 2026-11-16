/** Weather Maker words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only. `title`, `description` and `instruction` are the Studio
 * tile and intro card (studioCopy reads them); the rest is the game's own. */
export const SEASON_DIAL_COPY = {
  en: { title: 'Weather Maker', description: 'Turn the dial. Change the sky.', instruction: 'Turn the dial to bring sun, rain, wind or snow, and watch the little world change.', finish: 'What a sky!', transfer: 'Away from the screen: look outside. What is the weather doing now?', done: 'That is my weather' },
  he: { title: 'יוצרים מזג אוויר', description: 'מסובבים את החוגה. משנים את השמיים.', instruction: 'מסובבים את החוגה כדי להביא שמש, גשם, רוח או שלג, ומסתכלים איך העולם הקטן משתנה.', finish: 'איזה שמיים!', transfer: 'הרחק מהמסך: מסתכלים החוצה. איזה מזג אוויר יש עכשיו?', done: 'זה מזג האוויר שלי' },
} as const;
