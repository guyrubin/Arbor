/** The Paper Boat words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only. `title`, `description` and `instruction` are the Studio
 * tile and intro card (studioCopy reads them); the rest is the game's own. */
export const PAPER_BOAT_COPY = {
  en: { title: 'The Paper Boat', description: 'A pop-up book to unfold.', instruction: 'Open each page and pull the tabs to help the paper boat find its way home.', finish: 'The paper boat is home.', transfer: 'Away from the screen: fold a paper boat and tell its story.', done: 'The end' },
  he: { title: 'סירת הנייר', description: 'ספר קופץ שנפתח ומתגלה.', instruction: 'פותחים כל עמוד ומושכים את הלשוניות כדי לעזור לסירת הנייר למצוא את הדרך הביתה.', finish: 'סירת הנייר הגיעה הביתה.', transfer: 'הרחק מהמסך: מקפלים סירת נייר ומספרים את הסיפור שלה.', done: 'הסוף' },
} as const;
