/** Mend the Bowl words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only. `title`, `description` and `instruction` are the Studio
 * tile and intro card (studioCopy reads them); the rest is the game's own. */
export const MEND_BOWL_COPY = {
  en: { title: 'Mend the Bowl', description: 'Gold fills the cracks.', instruction: 'Fit the pieces together, then trace the gold seams to mend the bowl.', finish: 'Your bowl is whole again.', transfer: 'Away from the screen: when something breaks, look at how it could be mended.', done: 'All mended', keep: 'Your mended bowl' },
  he: { title: 'מתקנים את הקערה', description: 'זהב ממלא את הסדקים.', instruction: 'מחברים את החלקים, ואז מעבירים זהב בתפרים כדי לתקן את הקערה.', finish: 'הקערה שלמה שוב.', transfer: 'הרחק מהמסך: כשמשהו נשבר, מסתכלים איך אפשר לתקן אותו.', done: 'סיימנו לתקן', keep: 'הקערה שתיקנת' },
} as const;
