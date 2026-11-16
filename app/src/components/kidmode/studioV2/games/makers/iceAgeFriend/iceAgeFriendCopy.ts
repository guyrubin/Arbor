/** Woolly Mammoth words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only. `title`, `description` and `instruction` are the Studio
 * tile and intro card (studioCopy reads them); the rest is the game's own.
 * Facts are kept plain and true: nothing more precise than "thousands of
 * years ago", and "probably" where scientists are not sure. */
export const ICE_AGE_FRIEND_COPY = {
  en: {
    title: 'Woolly Mammoth', description: 'Meet a giant from the Ice Age.',
    instruction: 'Look closely at a woolly mammoth. Zoom into its fur, stroke it, and find five things that kept it warm.',
    cueStart: 'Stroke the shaggy fur, or zoom right in. Five glowing rings hide five secrets.',
    cueMore: 'Look for another glowing ring.',
    cueCall: 'Listen! The mammoth lifts its trunk and calls.',
    cueFree: 'Stroke the fur a little longer, or say goodbye.',
    finish: 'All five found. The mammoth calls hello.',
    transfer: 'Away from the screen: how do animals near you keep warm in winter?',
    done: 'Goodbye, mammoth',
    stage: 'A woolly mammoth on the snowy steppe. Drag on its fur to stroke it, drag around it to look around, pinch to zoom.',
    keys: 'Arrow keys look around, plus and minus zoom, Enter strokes the fur.',
    zoomIn: 'Zoom in', zoomOut: 'Zoom out', whole: 'Whole mammoth', turn: 'Turn around', close: 'Close',
    flakes: 'Snowflakes for the secrets found', found: 'found', notYet: 'not found yet',
    ring: 'Glowing ring on {0}',
    places: { coats: 'the thick coat', ears: 'the ear', tusks: 'the tusks', trunk: 'the trunk', hump: 'the hump' },
    facts: {
      coats: { title: 'Two coats', text: 'Long, shaggy outer hair lay over a short, woolly undercoat. Together the two coats kept the cold out.' },
      ears: { title: 'Small ears', text: 'Its ears were much smaller than an elephant’s ears today, so less of its body warmth escaped.' },
      tusks: { title: 'Curved tusks', text: 'Long, curving tusks. Mammoths probably used them to sweep snow off the grass, and to show off and push rivals.' },
      trunk: { title: 'A clever trunk', text: 'The tip of its trunk had two parts like fingers, a long one on top and a wide one below, for plucking grass.' },
      hump: { title: 'Hump and fat', text: 'A thick layer of fat under the skin, and a fatty hump on its shoulders, helped it through the long winter.' },
    },
    finalTitle: 'All five secrets',
    extinct: 'Woolly mammoths lived in the Ice Age, thousands of years ago. They are extinct now, and elephants are their living relatives.',
  },
  he: {
    title: 'הממותה השעירה', description: 'פוגשים ענק מתקופת הקרח.',
    instruction: 'מסתכלים מקרוב על ממותה שעירה. מתקרבים אל הפרווה, מלטפים אותה ומוצאים חמישה דברים ששמרו עליה חמימה.',
    cueStart: 'מלטפים את הפרווה הסבוכה או מתקרבים ממש קרוב. חמש טבעות זוהרות מסתירות חמישה סודות.',
    cueMore: 'מחפשים עוד טבעת זוהרת.',
    cueCall: 'מקשיבים! הממותה מרימה את החדק וקוראת.',
    cueFree: 'אפשר ללטף עוד קצת את הפרווה, או להיפרד.',
    finish: 'כל החמישה נמצאו. הממותה קוראת שלום.',
    transfer: 'הרחק מהמסך: איך בעלי חיים שגרים לידנו מתחממים בחורף?',
    done: 'להתראות, ממותה',
    stage: 'ממותה שעירה בערבה המושלגת. גוררים על הפרווה כדי ללטף, גוררים מסביב כדי להסתכל, וצובטים כדי להתקרב.',
    keys: 'מקשי החצים מזיזים את המבט, פלוס ומינוס מקרבים ומרחיקים, ואנטר מלטף את הפרווה.',
    zoomIn: 'להתקרב', zoomOut: 'להתרחק', whole: 'כל הממותה', turn: 'להסתובב', close: 'סגירה',
    flakes: 'פתיתי שלג לסודות שנמצאו', found: 'נמצא', notYet: 'עוד לא נמצא',
    ring: 'טבעת זוהרת על {0}',
    places: { coats: 'הפרווה העבה', ears: 'האוזן', tusks: 'החטים', trunk: 'החדק', hump: 'הדבשת' },
    facts: {
      coats: { title: 'שתי שכבות פרווה', text: 'שיער חיצוני ארוך ופרוע כיסה פרווה פנימית קצרה וצמרית. יחד, שתי השכבות השאירו את הקור בחוץ.' },
      ears: { title: 'אוזניים קטנות', text: 'האוזניים שלה היו קטנות בהרבה מהאוזניים של הפילים היום, כך שפחות חום ברח מהגוף.' },
      tusks: { title: 'חטים מעוקלים', text: 'חטים ארוכים ומעוקלים. כנראה שהממותות השתמשו בהם כדי לגרוף שלג מעל העשב, וגם כדי להרשים ולדחוף יריבים.' },
      trunk: { title: 'חדק חכם', text: 'בקצה החדק היו שני חלקים כמו אצבעות, אחד ארוך למעלה ואחד רחב למטה, כדי לתלוש עשב.' },
      hump: { title: 'דבשת ושומן', text: 'שכבה עבה של שומן מתחת לעור, ודבשת של שומן על הכתפיים, עזרו לה לעבור את החורף הארוך.' },
    },
    finalTitle: 'כל חמשת הסודות',
    extinct: 'ממותות שעירות חיו בתקופת הקרח, לפני אלפי שנים. היום הן כבר נכחדו, והפילים הם קרובי המשפחה החיים שלהן.',
  },
} as const;
export type IceAgeFriendWords = typeof ICE_AGE_FRIEND_COPY['en'] | typeof ICE_AGE_FRIEND_COPY['he'];

