/** Wind-up Racer words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only. `title`, `description` and `instruction` are the Studio
 * tile and intro card (studioCopy reads them); the rest is the game's own. */
export const WINDUP_RACE_COPY = {
  en: { title: 'Wind-up Racer', description: 'Wind it up. Let it go.', instruction: 'Wind up your racer, shape the track, then let it go and see where it rolls.', finish: 'Off it went!', transfer: 'Away from the screen: roll a toy car down a slope and watch where it stops.', done: 'Park the racer' },
  he: { title: 'מכונית קפיץ', description: 'מותחים את הקפיץ. משחררים.', instruction: 'מותחים את הקפיץ, בונים את המסלול, ואז משחררים ורואים לאן המכונית מתגלגלת.', finish: 'היא נסעה!', transfer: 'הרחק מהמסך: מגלגלים מכונית צעצוע במורד ורואים איפה היא עוצרת.', done: 'מחנים את המכונית' },
} as const;
