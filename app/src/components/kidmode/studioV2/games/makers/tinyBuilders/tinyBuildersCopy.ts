/** Tiny Structures words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only. `title`, `description` and `instruction` are the Studio
 * tile and intro card (studioCopy reads them); the rest is the game's own. */
export const TINY_BUILDERS_COPY = {
  en: { title: 'Tiny Structures', description: 'Build it. Test it. Build again.', instruction: 'Stack beams and blocks to build a bridge or a tower, then see if it holds.', finish: 'It stands!', transfer: 'Away from the screen: build a tower with cups or books.', done: 'Finished building' },
  he: { title: 'מבנים קטנים', description: 'בונים. בודקים. בונים שוב.', instruction: 'מערימים קורות וקוביות כדי לבנות גשר או מגדל, ואז בודקים אם הוא מחזיק.', finish: 'זה עומד!', transfer: 'הרחק מהמסך: בונים מגדל מכוסות או מספרים.', done: 'סיימנו לבנות' },
} as const;
