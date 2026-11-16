/** Fox Trail words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only. `title`, `description` and `instruction` are the Studio
 * tile and intro card (studioCopy reads them); the rest is the game's own. */
export const FOX_TRAIL_COPY = {
  en: { title: 'Fox Trail', description: 'Follow the tracks.', instruction: 'Follow the fox’s footprints through the woods and find what it left behind.', finish: 'The fox’s den!', transfer: 'Away from the screen: look for footprints in sand, mud or snow.', done: 'End of the trail' },
  he: { title: 'שביל השועל', description: 'הולכים בעקבות.', instruction: 'הולכים בעקבות השועל ביער ומגלים מה הוא השאיר אחריו.', finish: 'מצאנו את המאורה של השועל!', transfer: 'הרחק מהמסך: מחפשים עקבות בחול, בבוץ או בשלג.', done: 'סוף השביל' },
} as const;
