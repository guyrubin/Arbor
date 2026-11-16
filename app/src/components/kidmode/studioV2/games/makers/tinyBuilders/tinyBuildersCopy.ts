/** Tiny Structures words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only. `title`, `description` and `instruction` are the Studio
 * tile and intro card (studioCopy reads them); the rest is the game's own.
 * The story: on the TrailBench in Wonderworks, with Aya watching, the child
 * snaps together a model of a phage; Bebe's ProofLens then falls through a
 * drop of pond water to a real one; the child helps it land, legs first.
 * Register: wonder. A phage "lands on", "visits" and "sends its instructions
 * inside" a bacterium; it never makes people ill and nothing here is medical.
 * Every part sentence is short and true of the real T4 phage; every size is a
 * round, typical figure (see tinyDive.ts). `say` lines are spoken by the
 * coach, one at a time; cues (what to do next) are eight words at most.
 * Blanks `{0}` are filled by `tinyLine` (in the rules). */
export const TINY_BUILDERS_COPY = {
  en: {
    title: 'Tiny Structures', description: 'Build a tiny lander. Dive to find a real one.',
    instruction: 'On the TrailBench, snap together a model of a phage: a tiny lander that visits only bacteria. Then dive into a drop of pond water, find a real one and help it land.',
    finish: 'You landed a phage!', transfer: 'Away from the screen: make one from a paper cup, a straw and six bendy pipe-cleaner legs.',
    place: 'Wonderworks · the TrailBench', openLine: 'Let’s build a tiny lander!',
    quest: { build: 'The model', dive: 'The dive', land: 'The landing' },
    steps: {
      spin: 'Spin it', flea: 'Water flea', cell: 'Single cell', bacterium: 'Bacterium', phage: 'Phage',
      legs: 'Legs hold on', pad: 'Pad settles', squeeze: 'Spring squeezes', thread: 'Thread slides in',
    },
    pieces: { head: 'Head', collar: 'Collar', tail: 'Tail', tailCollar: 'Tail and collar', baseplate: 'Baseplate', fibres: 'Six legs', fibrePair: 'Two legs' },
    picked: {
      head: 'The head keeps the instructions safe inside.', collar: 'The collar joins the head to the tail.', tail: 'The tail: a sleeve that squeezes like a spring.',
      tailCollar: 'The tail squeezes like a spring.', baseplate: 'The baseplate is the landing pad.', fibres: 'Six long legs, to feel and hold on.', fibrePair: 'Two long legs. Six in all.',
    },
    clicked: { head: 'Click! The head is on.', collar: 'Click! The collar is on.', tail: 'Click! The tail is on.', tailCollar: 'Click! The tail is on.', baseplate: 'Click! The landing pad is down.', fibres: 'Click! All six legs.', fibrePair: 'Click! Two more legs.' },
    say: {
      buildCue: 'Lift a part. Bring it to the stand.',
      closer: 'Bring it closer and the magnet takes it.',
      standing: 'It stands! Give it a spin.',
      spun: 'A model phage, all your own!',
      toyHead: 'Inside the head: a coil called DNA.', toyTail: 'A hollow tube inside a springy sleeve.', toyLegs: 'Bendy knees, like a tiny lander.',
      ayaPoke1: 'I fetched the pond water myself!', ayaPoke2: 'My LeafLab keeps the drop cool.',
      lensLine: 'My ProofLens can look inside the drop.',
      diveCue: 'Press and hold to dive.',
      'spot-flea': 'Something is swimming. Tap it!', 'spot-cell': 'A tiny swimmer. Tap it!', 'spot-bacterium': 'Tiny rods! Tap the nearest.', 'spot-phage': 'There, above it! Tap it!',
      'fact-flea': 'A water flea, about a millimetre long.',
      'fact-cell': 'A paramecium: one single living cell.',
      'fact-bacterium': 'A bacterium: a living cell, far smaller.',
      'fact-phage': 'A real phage! The same shape you built.',
      secretBear: 'A water bear! The toughest tiny animal.', secretWheel: 'A wheel animal! Its crown seems to spin.',
      tumble: 'The water tips it over!',
      landCue: 'Swirl to turn it. Drag it down.',
      headOff: 'The smooth head cannot hold on.', sideOff: 'Sideways, it slides off. Legs first!',
      legsOn: 'Legs first! Each tip takes hold.', padOn: 'The pad sits flat on the cell.',
      squeezeCue: 'Press and hold to squeeze the spring.',
      squeezed: 'The stiff tube reaches through the wall.', thread: 'The instructions slide down, into the cell.',
      landed: 'Landed, like a lunar lander!',
    },
    toast: {
      dance: 'The legs are dancing!', closer: '{0} times closer',
      beyond: 'No glass lens sees this far. This is drawn from electron microscope pictures.',
      only: 'Phages land only on bacteria, never on people.',
      },
    captions: ['One phage, on one bacterium…', '…beside one single cell…', '…in one drop of pond water…', '…on the TrailBench…', '…in Horizon Valley.'],
    find: 'Find a real one', diveDown: 'Dive', diveUp: 'Back up', record: 'Record it', landGo: 'Help it land',
    turnLeft: 'Turn left', turnRight: 'Turn right', lower: 'Lower it', squeeze: 'Squeeze',
    pieceReady: '{0}. Pick it up.', pieceChosen: '{0}, picked up. Press again to put it on.',
    model: 'The model. Arrow keys turn it.', aya: 'Aya', lens: 'The ProofLens. Look into the drop.',
    thing: '{0}. Record it.', secretThing: 'Something is hiding here.', realPhage: 'The phage. Hold it to move or squeeze it.',
    scene: 'The TrailBench in Wonderworks',
  },
  he: {
    title: 'מבנים זעירים', description: 'בונים נחתת זעירה. צוללים למצוא אמיתית.',
    instruction: 'על שולחן השטח מרכיבים דגם של פאג׳: נחתת זעירה שמבקרת רק אצל חיידקים. אחר כך צוללים לתוך טיפה של מי בריכה, מוצאים פאג׳ אמיתי ועוזרים לו לנחות.',
    finish: 'הפאג׳ נחת!', transfer: 'הרחק מהמסך: בונים אחד מכוס נייר, קשית ושש רגליים מחוטי ניקוי מתכופפים.',
    place: 'סדנאות הפלא · שולחן השטח', openLine: 'בונים נחתת זעירה!',
    quest: { build: 'הדגם', dive: 'הצלילה', land: 'הנחיתה' },
    steps: {
      spin: 'מסובבים', flea: 'דפניה', cell: 'תא יחיד', bacterium: 'חיידק', phage: 'פאג׳',
      legs: 'הרגליים נאחזות', pad: 'הלוחית מתיישבת', squeeze: 'הקפיץ מתכווץ', thread: 'החוט מחליק פנימה',
    },
    pieces: { head: 'ראש', collar: 'צווארון', tail: 'זנב', tailCollar: 'זנב וצווארון', baseplate: 'לוחית בסיס', fibres: 'שש רגליים', fibrePair: 'שתי רגליים' },
    picked: {
      head: 'הראש שומר על ההוראות שבפנים.', collar: 'הצווארון מחבר את הראש אל הזנב.', tail: 'הזנב: שרוול שמתכווץ כמו קפיץ.',
      tailCollar: 'הזנב מתכווץ כמו קפיץ.', baseplate: 'לוחית הבסיס היא משטח הנחיתה.', fibres: 'שש רגליים ארוכות, למשש ולהיאחז.', fibrePair: 'שתי רגליים ארוכות. שש בסך הכול.',
    },
    clicked: { head: 'קליק! הראש במקום.', collar: 'קליק! הצווארון במקום.', tail: 'קליק! הזנב במקום.', tailCollar: 'קליק! הזנב במקום.', baseplate: 'קליק! משטח הנחיתה מונח.', fibres: 'קליק! כל שש הרגליים.', fibrePair: 'קליק! עוד שתי רגליים.' },
    say: {
      buildCue: 'מרימים חלק. מביאים אותו אל המעמד.',
      closer: 'מקרבים עוד קצת, והמגנט תופס.',
      standing: 'הדגם עומד! עכשיו מסובבים אותו.',
      spun: 'דגם של פאג׳, כולו שלכם!',
      toyHead: 'בתוך הראש: סליל שנקרא דנ״א.', toyTail: 'צינור חלול בתוך שרוול קפיצי.', toyLegs: 'ברכיים מתכופפות, כמו נחתת זעירה.',
      ayaPoke1: 'את מי הבריכה הבאתי בעצמי!', ayaPoke2: 'מעבדת העלים שלי שומרת על הטיפה.',
      lensLine: 'עדשת ההוכחה שלי מציצה לתוך הטיפה.',
      diveCue: 'לוחצים ומחזיקים כדי לצלול.',
      'spot-flea': 'משהו שוחה שם. מקישים עליו!', 'spot-cell': 'שחיין זעיר. מקישים עליו!', 'spot-bacterium': 'מקלונים זעירים! מקישים על הקרוב.', 'spot-phage': 'הנה, מעליו! מקישים!',
      'fact-flea': 'דפניה, באורך של מילימטר בערך.',
      'fact-cell': 'סנדלית: תא חי אחד ויחיד.',
      'fact-bacterium': 'חיידק: תא חי, קטן בהרבה.',
      'fact-phage': 'פאג׳ אמיתי! בדיוק הצורה שבניתם.',
      secretBear: 'דוב מים! החיה הזעירה הכי עמידה.', secretWheel: 'גלגילון! הכתר שלו נראה מסתובב.',
      tumble: 'המים הופכים אותו!',
      landCue: 'מערבלים את המים כדי לסובב. גוררים למטה.',
      headOff: 'הראש החלק לא מצליח להיאחז.', sideOff: 'על הצד הוא מחליק. קודם הרגליים!',
      legsOn: 'קודם הרגליים! כל קצה נאחז.', padOn: 'הלוחית יושבת ישר על התא.',
      squeezeCue: 'לוחצים ומחזיקים כדי לכווץ את הקפיץ.',
      squeezed: 'הצינור הנוקשה עובר דרך הדופן.', thread: 'ההוראות מחליקות למטה, אל תוך התא.',
      landed: 'נחיתה, כמו נחתת על הירח!',
    },
    toast: {
      dance: 'הרגליים רוקדות!', closer: 'קרוב פי {0}',
      beyond: 'שום עדשת זכוכית לא רואה כל כך רחוק. הציור נעשה לפי תמונות ממיקרוסקופ אלקטרונים.',
      only: 'פאגים נוחתים רק על חיידקים, אף פעם לא על אנשים.',
      },
    captions: ['פאג׳ אחד, על חיידק אחד…', '…ליד תא יחיד אחד…', '…בטיפה אחת של מי בריכה…', '…על שולחן השטח…', '…בעמק האופק.'],
    find: 'לחפש פאג׳ אמיתי', diveDown: 'לצלול', diveUp: 'לעלות', record: 'לתעד', landGo: 'לעזור לו לנחות',
    turnLeft: 'לסובב שמאלה', turnRight: 'לסובב ימינה', lower: 'להוריד', squeeze: 'לכווץ',
    pieceReady: '{0}. מרימים.', pieceChosen: '{0}, ביד. לוחצים שוב כדי להרכיב.',
    model: 'הדגם. מקשי החצים מסובבים אותו.', aya: 'איה', lens: 'עדשת ההוכחה. מציצים לתוך הטיפה.',
    thing: '{0}. מתעדים.', secretThing: 'משהו מתחבא כאן.', realPhage: 'הפאג׳. מחזיקים כדי להזיז או לכווץ.',
    scene: 'שולחן השטח בסדנאות הפלא',
  },
} as const;
export type TinyBuildersWords = typeof TINY_BUILDERS_COPY['en'] | typeof TINY_BUILDERS_COPY['he'];
