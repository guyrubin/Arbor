/** Stitch Garden words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only. `title`, `description` and `instruction` are the Studio
 * tile and intro card (studioCopy reads them); the rest is the game's own. */
export const STITCH_GARDEN_COPY = {
  en: { title: 'Stitch Garden', description: 'Sew a garden of flowers.', instruction: 'Choose a cloth and a thread, then stitch flowers wherever you like.', finish: 'Your garden is stitched.', transfer: 'Away from the screen: look for flowers on clothes, cushions and curtains.', done: 'All stitched', keep: 'Your stitched garden' },
  he: { title: 'גינה רקומה', description: 'רוקמים גינה של פרחים.', instruction: 'בוחרים בד וחוט, ואז רוקמים פרחים איפה שרוצים.', finish: 'הגינה רקומה.', transfer: 'הרחק מהמסך: מחפשים פרחים על בגדים, כריות ווילונות.', done: 'סיימנו לרקום', keep: 'הגינה שרקמת' },
} as const;
