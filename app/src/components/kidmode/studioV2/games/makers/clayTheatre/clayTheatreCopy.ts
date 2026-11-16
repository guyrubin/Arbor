/** Clay Theatre words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only. `title`, `description` and `instruction` are the Studio
 * tile and intro card (studioCopy reads them); the rest is the game's own. */
export const CLAY_THEATRE_COPY = {
  en: { title: 'Clay Theatre', description: 'Put on a little clay show.', instruction: 'Choose the clay puppets, set the stage, and act out the story your way.', finish: 'Take a bow!', transfer: 'Away from the screen: act out a little story with your toys.', done: 'The end of the show' },
  he: { title: 'תיאטרון חימר', description: 'מעלים הצגה קטנה מחימר.', instruction: 'בוחרים בובות חימר, מכינים את הבמה ומציגים את הסיפור בדרך שלך.', finish: 'משתחווים!', transfer: 'הרחק מהמסך: מציגים סיפור קטן עם הצעצועים.', done: 'סוף ההצגה' },
} as const;
