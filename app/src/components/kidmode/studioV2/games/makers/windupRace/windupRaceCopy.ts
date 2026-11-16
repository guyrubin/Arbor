/** Wind-up Racer words. The racer is Rover, the kit's toy car, on trails
 * across a Wonderworks pavilion floor; Pep scouts alongside. Hebrew is
 * gender-free toward the child: plural verbs and infinitives only. `title`,
 * `description` and `instruction` are the Studio tile and intro card
 * (studioCopy reads them); the rest is the game's own. Cues are eight words
 * or fewer. A short run is never "so close" or "not enough": it ends where
 * it ends. */
export const WINDUP_RACE_COPY = {
  en: {
    title: 'Wind-up Racer', description: 'Wind Rover up. Let it go.', instruction: 'Turn the key to wind Rover’s spring. More turns, more go.',
    finish: 'Rover ran every trail!', transfer: 'Away from the screen: wind up a toy, or roll a toy car down a slope, and watch where it stops.',
    tracks: { shelf: 'The pavilion floor', ramp: 'Ramp and plank', table: 'The long gallery', blockBridge: 'Block bridge', bookSlide: 'The slide', grandTour: 'The grand trail' },
    trackLines: {
      shelf: 'A flat run across the Wonderworks floor, to the flower.', ramp: 'Up the ramp, along the top, down the long plank.',
      table: 'A knit roll, glass petals, the arches, then up to the flower.', blockBridge: 'Up onto the bridge, past the petals, and down again.',
      bookSlide: 'A high start, a long slide down, then up to the flower.', grandTour: 'Everything at once: the roll, petals, arches, the knit ball and a climb.',
    },
    wind: 'Turn the key to wind Rover up.', windMore: 'More turns, more go. Then press Go!', full: 'The spring is wound all the way.',
    noWind: 'The spring is loose. Turn the key first.',
    running: 'Off Rover goes!', flag: 'The flower opened for Rover!', nextTrack: 'Pep found the next trail.', party: 'Every flower is open!',
    stopped: 'Rover stopped here. Chalk marks the spot.', rolledBack: 'Up the ramp, and back down again!', again: 'Back to the start. Wind it again.',
    windButton: 'Wind', go: 'Go!', reset: 'Back to start', horn: 'Beep!',
    key: 'The wind-up key. The spring is {0}.', tension: { loose: 'loose', little: 'wound a little', half: 'half wound', tight: 'wound tight', full: 'wound all the way' },
    scene: 'Rover, a toy car with a wind-up key, on a trail across the pavilion floor. Pep the dog scouts alongside.', map: 'Trail map', progress: 'Trail {0} of {1}',
    keys: 'Space winds the key. Enter lets Rover go. The H key sounds the horn.',
    ring: 'GobGob’s WaitRing is the ring of lights: it fills as the spring winds.', pod: 'When the ring is ready, press Go on the PulsePod.',
    quiet: 'Sound is off. Watch the key, the spring and the ring of lights.',
  },
  he: {
    title: 'מכונית קפיץ', description: 'מותחים את הקפיץ של רובר. משחררים.', instruction: 'מסובבים את המפתח ומותחים את הקפיץ של רובר. יותר סיבובים, יותר נסיעה.',
    finish: 'רובר עבר את כל המסלולים!', transfer: 'הרחק מהמסך: מותחים צעצוע עם קפיץ, או מגלגלים מכונית צעצוע במורד, ורואים איפה היא עוצרת.',
    tracks: { shelf: 'רצפת הביתן', ramp: 'רמפה וקרש', table: 'הגלריה הארוכה', blockBridge: 'גשר הקוביות', bookSlide: 'המגלשה', grandTour: 'המסלול הגדול' },
    trackLines: {
      shelf: 'נסיעה ישרה על רצפת הביתן, עד הפרח.', ramp: 'עולים ברמפה, נוסעים למעלה, יורדים בקרש הארוך.',
      table: 'גליל סרוג, עלי זכוכית, הקשתות, ואז עלייה אל הפרח.', blockBridge: 'עולים על הגשר, עוברים ליד העלים, ויורדים שוב.',
      bookSlide: 'התחלה גבוהה, גלישה ארוכה למטה, ואז עלייה אל הפרח.', grandTour: 'הכול ביחד: הגליל, העלים, הקשתות, כדור הצמר ועלייה.',
    },
    wind: 'מסובבים את המפתח ומותחים את הקפיץ.', windMore: 'יותר סיבובים, יותר נסיעה. ואז לוחצים על יוצאים!', full: 'הקפיץ מתוח עד הסוף.',
    noWind: 'הקפיץ רפוי. קודם מסובבים את המפתח.',
    running: 'רובר יוצא לדרך!', flag: 'הפרח נפתח לכבוד רובר!', nextTrack: 'פפ מצא את המסלול הבא.', party: 'כל הפרחים פתוחים!',
    stopped: 'רובר עצר כאן. סימן הגיר מראה איפה.', rolledBack: 'למעלה ברמפה, ובחזרה למטה!', again: 'חוזרים להתחלה. מותחים שוב.',
    windButton: 'מותחים', go: 'יוצאים!', reset: 'חזרה להתחלה', horn: 'ביפ!',
    key: 'מפתח הקפיץ. הקפיץ {0}.', tension: { loose: 'רפוי', little: 'מתוח קצת', half: 'מתוח עד חצי', tight: 'מתוח חזק', full: 'מתוח עד הסוף' },
    scene: 'רובר, מכונית צעצוע עם מפתח קפיץ, על מסלול ברצפת הביתן. הכלב פפ רץ לצידו.', map: 'מפת המסלול', progress: 'מסלול {0} מתוך {1}',
    keys: 'מקש הרווח מותח את המפתח. מקש אנטר משחרר את רובר. המקש H מפעיל את הצופר.',
    ring: 'טבעת ההמתנה של גובגוב היא טבעת האורות: היא מתמלאת כשמותחים את הקפיץ.', pod: 'כשהטבעת מוכנה, לוחצים על יוצאים בפולספוד.',
    quiet: 'הצליל כבוי. מסתכלים על המפתח, על הקפיץ ועל טבעת האורות.',
  },
} as const;
export type WindupRaceWords = typeof WINDUP_RACE_COPY['en'] | typeof WINDUP_RACE_COPY['he'];
