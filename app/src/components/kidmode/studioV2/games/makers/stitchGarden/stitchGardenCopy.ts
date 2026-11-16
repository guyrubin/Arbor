/** Stitch Garden words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only. `title`, `description` and `instruction` are the Studio
 * tile and intro card (studioCopy reads them); the rest is the game's own.
 * `story` is the poem sewn along the hem, one line per flower, in order. Each
 * language is written for itself; the Hebrew does not translate the English
 * word for word. `{flower}` is filled in by `sgLine`. */
export const STITCH_GARDEN_COPY = {
  en: {
    title: 'Stitch Garden', description: 'Sew a garden of flowers.', instruction: 'Choose a cloth and a thread, then stitch flowers wherever you like.',
    finish: 'Your garden is stitched.', transfer: 'Away from the screen: look for flowers on clothes, cushions and curtains.', done: "I'm finished", keep: 'Your stitched garden',
    cueStart: 'Pick a flower and a thread. Then tap a cross on the cloth.',
    cueStitching: 'The needle is stitching your {flower}.',
    cueMore: 'Plant another flower, or say you are finished.',
    cueFull: 'The hoop is full of flowers. Unpick one, or say you are finished.',
    cueLifting: 'Lifting the cloth out of the hoop…',
    stitching: 'Stitch by stitch…', unpicked: 'Unpicked. The thread is back on the spool.',
    unpick: 'Unpick', reopen: 'Keep stitching my garden',
    clothLabel: 'Cloth', flowerLabel: 'Flowers', threadLabel: 'Threads', storyLabel: 'The story on the hem', hoopLabel: 'The cloth in the hoop',
    cloths: { linen: 'Linen', indigo: 'Indigo', sage: 'Sage green' },
    flowers: { daisy: 'daisy', tulip: 'tulip', poppy: 'poppy', bluebell: 'bluebell', sunflower: 'sunflower' },
    flowerNames: { daisy: 'Daisy', tulip: 'Tulip', poppy: 'Poppy', bluebell: 'Bluebell', sunflower: 'Sunflower' },
    threads: ['Poppy red', 'Golden yellow', 'Raspberry pink', 'Cornflower blue', 'Snow white'],
    spot: 'Stitch a {flower} here', spotPlace: ['top row', 'middle row', 'bottom row'],
    story: [
      'One seed woke up.',
      'A friend grew beside it.',
      'The sun came out to look.',
      'A bee buzzed hello.',
      'Rain made every leaf shine.',
      'Roots met under the soil.',
      'The wind came to dance.',
      'Now the whole garden is awake.',
    ],
  },
  he: {
    title: 'גינה רקומה', description: 'רוקמים גינה של פרחים.', instruction: 'בוחרים בד וחוט, ואז רוקמים פרחים איפה שרוצים.',
    finish: 'הגינה רקומה.', transfer: 'הרחק מהמסך: מחפשים פרחים על בגדים, כריות ווילונות.', done: 'סיימתי', keep: 'הגינה שרקמת',
    cueStart: 'בוחרים פרח וחוט, ואז נוגעים באחד האיקסים שעל הבד.',
    cueStitching: 'המחט רוקמת {flower}.',
    cueMore: 'אפשר לשתול עוד פרח, או לגמור כאן.',
    cueFull: 'החישוק מלא פרחים. אפשר לפרום אחד, או לגמור כאן.',
    cueLifting: 'מוציאים את הבד מהחישוק…',
    stitching: 'תפר אחרי תפר…', unpicked: 'נפרם. החוט חזר לסליל.',
    unpick: 'לפרום', reopen: 'להמשיך לרקום את הגינה',
    clothLabel: 'בד', flowerLabel: 'פרחים', threadLabel: 'חוטים', storyLabel: 'הסיפור שעל שולי הבד', hoopLabel: 'הבד שבחישוק',
    cloths: { linen: 'פשתן', indigo: 'כחול לילה', sage: 'ירוק מרווה' },
    flowers: { daisy: 'חיננית', tulip: 'צבעוני', poppy: 'פרג', bluebell: 'פעמונית', sunflower: 'חמנייה' },
    flowerNames: { daisy: 'חיננית', tulip: 'צבעוני', poppy: 'פרג', bluebell: 'פעמונית', sunflower: 'חמנייה' },
    threads: ['אדום פרג', 'צהוב זהב', 'ורוד פטל', 'כחול שמיים', 'לבן שלג'],
    spot: 'לרקום כאן {flower}', spotPlace: ['שורה עליונה', 'שורה אמצעית', 'שורה תחתונה'],
    story: [
      'זרע קטן התעורר.',
      'פרח נוסף צמח לידו.',
      'השמש יצאה להציץ.',
      'דבורה זמזמה שלום.',
      'טיפות גשם נצצו על העלים.',
      'השורשים נפגשו באדמה.',
      'הרוח באה לרקוד איתם.',
      'עכשיו כל הגינה ערה.',
    ],
  },
} as const;
export type StitchGardenWords = typeof STITCH_GARDEN_COPY['en'] | typeof STITCH_GARDEN_COPY['he'];
export const sgLine = (template: string, flower = '') => template.replace('{flower}', flower);
