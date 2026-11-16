/** The Paper Boat words. Hebrew is gender-free towards the child: nouns,
 * plural verbs and infinitives only (the crew keep their own genders).
 * `title`, `description` and `instruction` are the Studio tile and intro card
 * (studioCopy reads them); the rest is the game's own. Each spread's text is
 * two short lines on its label; the bar's hear-it reads the current spread's
 * two lines. `toys` is every thing that answers a tap: its name (the button's
 * label) and what it does (the status line). */
export const PAPER_BOAT_COPY = {
  en: {
    title: 'The Paper Boat', description: 'A pop-up book of Horizon Valley.',
    instruction: 'Turn the pages of a pop-up book of Horizon Valley and steer a paper boat home with its wheel.',
    finish: 'The paper boat is home.', transfer: 'Away from the screen: fold a paper boat and tell where it sails.', done: 'The end',
    spreads: [
      ['A paper boat. A stream.', 'Sky Gardens. Off we go.'],
      ['Glass Grove. Turn the wheel.', 'Under the skybridge we go.'],
      ['Wind over Reflection Basin.', 'Hold steady, like Chock.'],
      ['Home, at Wonderworks.', 'The valley lights waited.'],
    ],
    /** What to do now, for screen readers (the page shows it with a ring and a hand, not words). */
    hints: [
      ['Tap the paper boat, or pull it into the stream.', 'The boat is floating. Turn the page.'],
      ['Turn the wheel to steer the boat through the knit arches.', 'Through all three arches. Turn the page.'],
      ['Turn the wheel back to the middle and hold it steady.', 'The storm is calm. Turn the page.'],
      ['Steer the boat to the quay.', 'The boat is home. The end tab is ready.'],
    ],
    book: 'The pop-up book', page: 'Page {0} of {1}', met: 'On the CrewLink so far: {0}', nobody: 'nobody yet',
    next: 'Turn the page', back: 'Back a page', end: 'The end',
    boatLaunch: 'The paper boat, on the bank. Put it in the stream.',
    wheel: 'Boat wheel', steerLeft: 'Turn the wheel left', steerRight: 'Turn the wheel right',
    lanes: ['towards the far bank', 'down the middle', 'towards the near bank'], steady: 'steady', windy: 'the wind is pulling',
    arch: 'Through an arch.', nudge: 'Bump. A soft stone. The boat slides back.', calm: 'The wind drops. The water is a mirror again.', docked: 'Alongside the quay. The crew is here.',
    homecoming: 'Every light in the valley comes on.',
    crew: { aya: 'Aya', bebe: 'Bebe', pep: 'Pep', chock: 'Chock', gobgob: 'GobGob' },
    toys: {
      aya: ['Aya', 'Aya hops.'], pep: ['Pep', 'Pep peeks through the ScoutCam.'], chock: ['Chock', 'Chock wags. Steady.'],
      bebe: ['Bebe', 'Bebe reads the river with the RouteScope.'], gobgob: ['GobGob', 'GobGob bounces.'],
      dome: ['The glass dome on the hill', 'The dome glints.'], bell: ['The bell tower', 'Ding.'], fountain: ['The fountain', 'The fountain leaps.'],
      bridge: ['The stone bridge', 'The stones play a tune.'], cascade: ['The little waterfall', 'Splash.'], echo: ['The far hills', 'The hills answer back.'],
      boat: ['The paper boat', 'A little hop.'], knitArch: ['A knit arch', 'The arch rings.'], stone: ['A stepping stone', 'Soft as felt.'],
      lily: ['A water flower', 'The flower opens and closes.'], skybridge: ['The skybridge', 'The glass sings.'], glasshouse: ['The glass house', 'The glass glints.'],
      lamp: ['The lamp', 'The lamp shines over the water.'], cloud: ['A rain cloud', 'Drip, drop.'], lantern: ['The lanterns in the tree', 'The lanterns sway.'],
      buggy: ['The workshop buggy', 'Beep beep.'], moored: ['A little boat', 'It rocks.'],
    },
  },
  he: {
    title: 'סירת הנייר', description: 'ספר קופץ של עמק האופק.',
    instruction: 'מדפדפים בספר קופץ של עמק האופק ומנווטים סירת נייר הביתה בעזרת ההגה.',
    finish: 'סירת הנייר הגיעה הביתה.', transfer: 'הרחק מהמסך: מקפלים סירת נייר ומספרים לאן היא שטה.', done: 'הסוף',
    spreads: [
      ['סירת נייר. פלג קטן.', 'גני השמיים. יוצאים לדרך.'],
      ['חורשת הזכוכית. מסובבים הגה.', 'שטים מתחת לגשר השמיים.'],
      ['רוח מעל אגן ההשתקפות.', 'מחזיקים יציב, כמו צ׳וק.'],
      ['הביתה, לוונדרוורקס.', 'אורות העמק חיכו.'],
    ],
    hints: [
      ['נוגעים בסירת הנייר, או מושכים אותה אל הפלג.', 'הסירה צפה. אפשר להפוך את הדף.'],
      ['מסובבים את ההגה כדי לעבור עם הסירה בקשתות הסרוגות.', 'עברנו בכל שלוש הקשתות. אפשר להפוך את הדף.'],
      ['מחזירים את ההגה לאמצע ומחזיקים אותו יציב.', 'הסערה נרגעה. אפשר להפוך את הדף.'],
      ['מנווטים את הסירה אל המזח.', 'הסירה בבית. לשונית הסוף מחכה.'],
    ],
    book: 'הספר הקופץ', page: 'עמוד {0} מתוך {1}', met: 'בקשר הצוות עד עכשיו: {0}', nobody: 'עוד אף אחד',
    next: 'להפוך את הדף', back: 'דף אחורה', end: 'הסוף',
    boatLaunch: 'סירת הנייר על הגדה. מכניסים אותה לפלג.',
    wheel: 'ההגה של הסירה', steerLeft: 'לסובב את ההגה שמאלה', steerRight: 'לסובב את ההגה ימינה',
    lanes: ['אל הגדה הרחוקה', 'באמצע הנהר', 'אל הגדה הקרובה'], steady: 'יציב', windy: 'הרוח מושכת',
    arch: 'עוברים בקשת.', nudge: 'בום קטן. אבן רכה. הסירה מחליקה בחזרה.', calm: 'הרוח נחלשת. המים שוב כמו מראה.', docked: 'ליד המזח. כל הצוות כאן.',
    homecoming: 'כל האורות בעמק נדלקים.',
    crew: { aya: 'איה', bebe: 'בבה', pep: 'פפ', chock: 'צ׳וק', gobgob: 'גובגוב' },
    toys: {
      aya: ['איה', 'איה קופצת.'], pep: ['פפ', 'פפ מציץ במצלמת הסיור.'], chock: ['צ׳וק', 'צ׳וק מכשכש בזנב. יציב.'],
      bebe: ['בבה', 'בבה בודק את הנהר במד המסלול.'], gobgob: ['גובגוב', 'גובגוב מקפץ.'],
      dome: ['כיפת הזכוכית שעל הגבעה', 'הכיפה נוצצת.'], bell: ['מגדל הפעמון', 'דינג.'], fountain: ['המזרקה', 'המזרקה מקפצת.'],
      bridge: ['גשר האבן', 'האבנים מנגנות.'], cascade: ['המפל הקטן', 'שפריץ.'], echo: ['הגבעות הרחוקות', 'הגבעות עונות בהד.'],
      boat: ['סירת הנייר', 'קפיצה קטנה.'], knitArch: ['קשת סרוגה', 'הקשת מצלצלת.'], stone: ['אבן מדרך', 'רכה כמו לבד.'],
      lily: ['פרח מים', 'הפרח נפתח ונסגר.'], skybridge: ['גשר השמיים', 'הזכוכית מזמרת.'], glasshouse: ['בית הזכוכית', 'הזכוכית נוצצת.'],
      lamp: ['המנורה', 'המנורה מאירה על המים.'], cloud: ['ענן גשם', 'טיף, טף.'], lantern: ['הפנסים שעל העץ', 'הפנסים מתנדנדים.'],
      buggy: ['רכב הסדנה', 'ביפ ביפ.'], moored: ['סירה קטנה', 'הסירה מתנדנדת.'],
    },
  },
} as const;
export type PaperBoatWords = typeof PAPER_BOAT_COPY['en'] | typeof PAPER_BOAT_COPY['he'];
