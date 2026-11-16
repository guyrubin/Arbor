/** Woolly Mammoth words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only. `title`, `description` and `instruction` are the Studio
 * tile and intro card (studioCopy reads them); the rest is the game's own.
 * The five facts are kept plain and true: nothing more precise than
 * "thousands of years ago", and "probably" where scientists are not sure.
 * The story around them is the valley's own: the great glass hall of Horizon
 * Dome, where one wall of glass looks out on the Ice Age, and the crew's
 * tools, each used for what it really does. Cues are eight words or fewer. */
export const ICE_AGE_FRIEND_COPY = {
  en: {
    title: 'Woolly Mammoth', description: 'Meet the giant behind the glass.',
    instruction: 'In the glass hall of Horizon Dome, a woolly mammoth waits behind the glass. Say hello, stroke its shaggy fur, and find five things that kept it warm.',
    cueMeet: 'Touch the glass. Say hello.',
    cueEnter: 'Here it comes!',
    cueStart: 'Stroke its fur. Find five rings.',
    cueMore: 'Find another ring.',
    cueCall: 'Listen! The mammoth is calling.',
    cueFree: 'Stay a while, or say goodbye.',
    cueLeave: 'Goodbye, mammoth!',
    finish: 'All five found. The herd called back.',
    transfer: 'Away from the screen: how do animals near you keep warm in winter?',
    done: 'Goodbye, mammoth',
    stage: 'The glass hall of Horizon Dome. A woolly mammoth stands beyond the glass, on the snowy steppe. Touch the glass to say hello. When it comes in, drag on its fur to stroke it and brush off the snow, pinch to zoom.',
    keys: 'Enter touches the glass, then strokes the fur. Arrow keys look around, plus and minus zoom.',
    zoomIn: 'Zoom in', zoomOut: 'Zoom out', whole: 'Whole mammoth', turn: 'Turn around', close: 'Close',
    grass: 'Give it grass',
    photos: 'Photos of the secrets found', found: 'photographed', notYet: 'not found yet',
    ring: 'Ring on {0}',
    friends: { bebe: 'Bebe', gobgob: 'GobGob', pep: 'Pep', chock: 'Chock', aya: 'Aya' },
    places: { coats: 'the thick coat', ears: 'the ear', tusks: 'the tusks', trunk: 'the trunk', hump: 'the hump' },
    /** The crew's tool that finds each one, named for what it does. */
    tools: {
      coats: 'ProofLens: a true photo, close up.', ears: 'ProofLens: a true photo, close up.', tusks: 'RouteScope: it measures the curve.',
      trunk: 'Pep’s ScoutCam: the close view.', hump: 'ViewCheck: the view from low down.',
    },
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
    title: 'הממותה השעירה', description: 'פוגשים את הענקית שמאחורי הזכוכית.',
    instruction: 'באולם הזכוכית של כיפת האופק מחכה ממותה שעירה מאחורי הזכוכית. אומרים שלום, מלטפים את הפרווה הסבוכה ומוצאים חמישה דברים ששמרו עליה חמימה.',
    cueMeet: 'נוגעים בזכוכית ואומרים שלום.',
    cueEnter: 'הנה היא באה!',
    cueStart: 'מלטפים את הפרווה. מוצאים חמש טבעות.',
    cueMore: 'מחפשים עוד טבעת.',
    cueCall: 'מקשיבים! הממותה קוראת.',
    cueFree: 'אפשר להישאר עוד קצת, או להיפרד.',
    cueLeave: 'להתראות, ממותה!',
    finish: 'כל החמישה נמצאו. העדר ענה בקריאה.',
    transfer: 'הרחק מהמסך: איך בעלי חיים שגרים לידנו מתחממים בחורף?',
    done: 'להתראות, ממותה',
    stage: 'אולם הזכוכית של כיפת האופק. ממותה שעירה עומדת מעבר לזכוכית, בערבה המושלגת. נוגעים בזכוכית כדי לומר שלום. כשהיא נכנסת, גוררים על הפרווה כדי ללטף ולנער את השלג, וצובטים כדי להתקרב.',
    keys: 'אנטר נוגע בזכוכית, ואחר כך מלטף את הפרווה. מקשי החצים מזיזים את המבט, פלוס ומינוס מקרבים ומרחיקים.',
    zoomIn: 'להתקרב', zoomOut: 'להתרחק', whole: 'כל הממותה', turn: 'להסתובב', close: 'סגירה',
    grass: 'לתת לה עשב',
    photos: 'תמונות של הסודות שנמצאו', found: 'צולם', notYet: 'עוד לא נמצא',
    ring: 'טבעת על {0}',
    friends: { bebe: 'בבה', gobgob: 'גובגוב', pep: 'פפ', chock: 'צ׳וק', aya: 'איה' },
    places: { coats: 'הפרווה העבה', ears: 'האוזן', tusks: 'החטים', trunk: 'החדק', hump: 'הדבשת' },
    tools: {
      coats: 'עדשת ההוכחה: תמונה אמיתית מקרוב.', ears: 'עדשת ההוכחה: תמונה אמיתית מקרוב.', tusks: 'מודד המסלול: מודדים את העיקול.',
      trunk: 'מצלמת הסיור של פפ: המבט הקרוב.', hump: 'בודק המבט: המבט מלמטה.',
    },
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
