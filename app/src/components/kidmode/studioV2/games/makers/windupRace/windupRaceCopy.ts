/** Wind-up Racer words. The racer is Rover, the kit's toy car, on a felt track
 * laid through a Wonderworks pavilion and out onto its terrace; Pep runs with
 * it. Hebrew is gender-free toward the child: plural verbs and infinitives
 * only. `title`, `description` and `instruction` are the Studio tile and
 * intro card (studioCopy reads them); the rest is the game's own. Pep's lines
 * are eight words or fewer. A run is never "so close" or "not enough": it
 * ends at a place with a name, and the next wind starts from there. */
export const WINDUP_RACE_COPY = {
  en: {
    title: 'Wind-up Racer', description: 'Wind Rover up. Let it go.', instruction: 'Turn the key to wind Rover’s spring. More turns, more go.',
    finish: 'Rover raced all the way!', transfer: 'Away from the screen: wind up a toy, or roll a toy car down a slope, and watch where it stops.',
    place: 'Wonderworks · the pavilion floor',
    chapters: { straight: 'The straight', gustAlley: 'Gust alley', longCourse: 'The long course', sunArches: 'The Sun Arches' },
    hello: 'Wind Rover up!', wind: 'Turn the key round and round.', windMore: 'More turns, more go!', full: 'Wound all the way!', noWind: 'Turn the key first.',
    go: 'Go, Rover, go!', gustHead: 'Wind in its face. Hold to lean in!', gustTail: 'Wind at its back. Let it sail!', leaning: 'Rover leans in!',
    ramp: 'Up and over!', air: 'Rover is flying!', rollback: 'A steep one. It wants more wind.',
    fork: 'Plank or rug road? Tap the arrow.', lineHigh: 'Over the plank!', lineLow: 'Along the rug road!',
    stopped: 'Rover reached {0}. Wind again!', goal: 'The flower opened for Rover!',
    intro: { straight: 'A straight run to the flower.', gustAlley: 'Out on the terrace the wind blows.', longCourse: 'A long way, and a fork.', sunArches: 'One last run, into the light!' },
    allTheWay: 'Wind it all the way!', finale: 'Every flower is open!', caption: 'Through the light of the arches', woof: 'Woof!', secret: 'The key sings!',
    places: {
      startLine: 'the start line', firstArch: 'the first arch', lightPool: 'the pool of light', fernRow: 'the fern row', flagRow: 'the flags', ramp: 'the ramp',
      signpost: 'the arrow', plank: 'the plank', knitRug: 'the knit rug', woolBall: 'the wool ball', lastArch: 'the last arch', flower: 'the flower',
    },
    windButton: 'Wind', goButton: 'Go!', lean: 'Lean in', linePlank: 'Plank', lineRug: 'Rug road', horn: 'Beep!',
    key: 'The wind-up key. The spring is {0}.', tension: { loose: 'loose', little: 'wound a little', half: 'half wound', tight: 'wound tight', full: 'wound all the way' },
    scene: 'Rover, a toy car with a brass wind-up key, on a felt track across the pavilion floor. Pep the dog runs with it.', quest: 'Rover’s four runs', pep: 'Pep',
    keys: 'Space winds the key. Enter lets Rover go. Hold the down arrow to lean into the wind. The up and down arrows pick the plank or the rug road. The H key sounds the horn.',
    quiet: 'Sound is off. Watch the key, the flags and the grass.',
  },
  he: {
    title: 'מכונית קפיץ', description: 'מותחים את הקפיץ של רובר. משחררים.', instruction: 'מסובבים את המפתח ומותחים את הקפיץ של רובר. יותר סיבובים, יותר נסיעה.',
    finish: 'רובר דהר עד הסוף!', transfer: 'הרחק מהמסך: מותחים צעצוע עם קפיץ, או מגלגלים מכונית צעצוע במורד, ורואים איפה היא עוצרת.',
    place: 'וונדרוורקס · רצפת הביתן',
    chapters: { straight: 'הישורת', gustAlley: 'שביל המשבים', longCourse: 'המסלול הארוך', sunArches: 'קשתות השמש' },
    hello: 'מותחים את רובר!', wind: 'מסובבים את המפתח, שוב ושוב.', windMore: 'יותר סיבובים, יותר נסיעה!', full: 'מתוח עד הסוף!', noWind: 'קודם מסובבים את המפתח.',
    go: 'קדימה, רובר!', gustHead: 'רוח בפנים. לוחצים ונשענים קדימה!', gustTail: 'רוח בגב. נותנים לה לשאת!', leaning: 'רובר נשען לתוך הרוח!',
    ramp: 'למעלה ומעבר!', air: 'רובר עף!', rollback: 'עלייה תלולה. צריך עוד מתיחה.',
    fork: 'קרש או שטיח? נוגעים בחץ.', lineHigh: 'מעל הקרש!', lineLow: 'לאורך השטיח!',
    stopped: 'רובר הגיע עד {0}. מותחים שוב!', goal: 'הפרח נפתח לכבוד רובר!',
    intro: { straight: 'ישר עד הפרח.', gustAlley: 'במרפסת נושבת רוח.', longCourse: 'דרך ארוכה, ופיצול.', sunArches: 'ריצה אחרונה, אל תוך האור!' },
    allTheWay: 'מותחים עד הסוף!', finale: 'כל הפרחים פתוחים!', caption: 'דרך האור של הקשתות', woof: 'הב!', secret: 'המפתח מנגן!',
    places: {
      startLine: 'קו הזינוק', firstArch: 'הקשת הראשונה', lightPool: 'שלולית האור', fernRow: 'שורת השרכים', flagRow: 'הדגלים', ramp: 'הרמפה',
      signpost: 'החץ', plank: 'הקרש', knitRug: 'השטיח הסרוג', woolBall: 'כדור הצמר', lastArch: 'הקשת האחרונה', flower: 'הפרח',
    },
    windButton: 'מותחים', goButton: 'יוצאים!', lean: 'נשענים', linePlank: 'קרש', lineRug: 'שטיח', horn: 'ביפ!',
    key: 'מפתח הקפיץ. הקפיץ {0}.', tension: { loose: 'רפוי', little: 'מתוח קצת', half: 'מתוח עד חצי', tight: 'מתוח חזק', full: 'מתוח עד הסוף' },
    scene: 'רובר, מכונית צעצוע עם מפתח קפיץ מפליז, על מסלול לבד ברצפת הביתן. הכלב פפ רץ איתו.', quest: 'ארבע הריצות של רובר', pep: 'פפ',
    keys: 'מקש הרווח מותח את המפתח. מקש אנטר משחרר את רובר. מחזיקים את החץ למטה ונשענים לתוך הרוח. החצים למעלה ולמטה בוחרים קרש או שטיח. המקש H מפעיל את הצופר.',
    quiet: 'הצליל כבוי. מסתכלים על המפתח, על הדגלים ועל העשב.',
  },
} as const;
export type WindupRaceWords = typeof WINDUP_RACE_COPY['en'] | typeof WINDUP_RACE_COPY['he'];
