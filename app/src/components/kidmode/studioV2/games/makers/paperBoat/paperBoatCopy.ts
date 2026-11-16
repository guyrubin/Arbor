/** The Paper Boat words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only. `title`, `description` and `instruction` are the Studio
 * tile and intro card (studioCopy reads them); the rest is the game's own.
 * Each spread's text is two short lines on its paper label; the bar's hear-it
 * reads the current spread's two lines. */
export const PAPER_BOAT_COPY = {
  en: {
    title: 'The Paper Boat', description: 'A pop-up book to unfold.',
    instruction: 'Turn the pages of a pop-up book and steer a paper boat home with its paper wheel.',
    finish: 'The paper boat is home.', transfer: 'Away from the screen: fold a paper boat and tell its story.', done: 'The end',
    spreads: [
      ['A paper boat. A small stream.', 'Off we go.'],
      ['Turn the wheel.', 'Left… right… this way.'],
      ['The wind grows.', 'Hold steady, little boat.'],
      ['Home.', 'The harbour lights were waiting.'],
    ],
    /** What to do now, for screen readers (the page shows it with a glow, not words). */
    hints: [
      ['Tap the paper boat, or pull it into the water.', 'The boat is floating. Turn the page.'],
      ['Turn the wheel to steer the boat through the reed arches.', 'Through all three arches. Turn the page.'],
      ['Turn the wheel back to the middle and hold it steady.', 'The storm is calm. Turn the page.'],
      ['Steer the boat to the quay by the lighthouse.', 'The boat is home. The end tab is ready.'],
    ],
    book: 'The pop-up book', page: 'Page {0} of {1}',
    next: 'Turn the page', back: 'Back a page', end: 'The end',
    boat: 'The paper boat', boatLaunch: 'The paper boat, on the bank. Put it in the water.', boatAfloat: 'The paper boat, floating',
    wheel: 'Boat wheel', steerLeft: 'Turn the wheel left', steerRight: 'Turn the wheel right',
    lanes: ['towards the far bank', 'down the middle', 'towards the near bank'], steady: 'steady', windy: 'the wind is pulling',
    arch: 'Through an arch.', nudge: 'Bump. The boat slides back into the water.', calm: 'The wind drops. The waves settle.', docked: 'Alongside the quay. The rope is on.',
  },
  he: {
    title: 'סירת הנייר', description: 'ספר קופץ שנפתח ומתגלה.',
    instruction: 'מדפדפים בספר קופץ ומנווטים סירת נייר הביתה בעזרת הגה מנייר.',
    finish: 'סירת הנייר הגיעה הביתה.', transfer: 'הרחק מהמסך: מקפלים סירת נייר ומספרים את הסיפור שלה.', done: 'הסוף',
    spreads: [
      ['סירת נייר. פלג קטן.', 'יוצאים לדרך.'],
      ['מסובבים את ההגה.', 'שמאלה… ימינה… לכאן.'],
      ['הרוח מתחזקת.', 'מחזיקים יציב, סירה קטנה.'],
      ['הביתה.', 'אורות הנמל כבר חיכו.'],
    ],
    hints: [
      ['נוגעים בסירת הנייר, או מושכים אותה למים.', 'הסירה צפה. אפשר להפוך את הדף.'],
      ['מסובבים את ההגה כדי לעבור עם הסירה בקשתות הקנים.', 'עברנו בכל שלוש הקשתות. אפשר להפוך את הדף.'],
      ['מחזירים את ההגה לאמצע ומחזיקים אותו יציב.', 'הסערה נרגעה. אפשר להפוך את הדף.'],
      ['מנווטים את הסירה אל המזח ליד המגדלור.', 'הסירה בבית. לשונית הסוף מחכה.'],
    ],
    book: 'הספר הקופץ', page: 'עמוד {0} מתוך {1}',
    next: 'להפוך את הדף', back: 'דף אחורה', end: 'הסוף',
    boat: 'סירת הנייר', boatLaunch: 'סירת הנייר על הגדה. מכניסים אותה למים.', boatAfloat: 'סירת הנייר צפה',
    wheel: 'ההגה של הסירה', steerLeft: 'לסובב את ההגה שמאלה', steerRight: 'לסובב את ההגה ימינה',
    lanes: ['אל הגדה הרחוקה', 'באמצע הנהר', 'אל הגדה הקרובה'], steady: 'יציב', windy: 'הרוח מושכת',
    arch: 'עוברים בקשת.', nudge: 'בום קטן. הסירה מחליקה בחזרה למים.', calm: 'הרוח נחלשת. הגלים נרגעים.', docked: 'ליד המזח. החבל קשור.',
  },
} as const;
export type PaperBoatWords = typeof PAPER_BOAT_COPY['en'] | typeof PAPER_BOAT_COPY['he'];

