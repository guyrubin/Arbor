/** Clay Theatre words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only. `title`, `description` and `instruction` are the Studio
 * tile and intro card (studioCopy reads them); the rest is the game's own.
 * Blanks are filled by `clayLine` (rules). The story: film night in the
 * Mirror Quarter's glass rotunda. Bebe's ProofLens (a camera that records an
 * actual view) filmed the clay, so the strip shows exactly what happened,
 * forwards or backwards. The frog puzzle is asked, never answered with a
 * false claim: in the pond, the frog simply reaches out. Cue lines are eight
 * words or fewer. */
export const CLAY_THEATRE_COPY = {
  en: {
    title: 'Clay Theatre', description: 'Film night in the Mirror Quarter: run tiny clay films, forwards and backwards.',
    instruction: 'ProofLens filmed the clay. Play it, drag the film strip, or run it backwards. Press the clay too!',
    reels: { rocket: 'Whale into Rocket', jump: 'The Whale’s Jump', ayaSeed: 'Aya’s Flower', frog: 'Halfway Frog' },
    cans: 'The film reels', canWatched: '{0}, watched to the end', canNew: '{0}',
    pick: 'Choose the clay. Press the whale!', bodyClay: 'Body', trimClay: 'Trim',
    clays: { red: 'Red clay', orange: 'Orange clay', yellow: 'Yellow clay', green: 'Green clay', blue: 'Blue clay', purple: 'Purple clay' },
    roll: 'Roll the film', recolour: 'Change the clay', clayButton: 'Clay',
    play: 'Play', pause: 'Pause', toStart: 'Back to the start', frameBack: 'One frame back', frameOn: 'One frame on', hopBack: 'One hop back', hopOn: 'One hop on',
    backwards: 'Backwards', forwards: 'Forwards', direction: 'Run the film backwards',
    strip: 'Film strip', moment: 'moment {0} of {1}', hop: 'hop {0} of {1}', atStart: 'the start', reaching: 'the frog reaches out',
    captions: {
      swim: 'A clay whale swims along…', squash: 'Squish! Back into a lump.', stretch: 'Stretch, pinch, press…', count: 'Puff… puff… puff…', lift: 'Lift-off!',
      deep: 'Deep in the valley lake…', rise: 'Up, up, up…', fly: 'Out of the water!', splash: 'Splash! The rings spread out…', wave: 'A tail wave. Bye!',
      hopIn: 'Aya hops into the Sky Gardens.', plant: 'One seed, pressed into the soil.', wait: 'Now the hard part: waiting.', grow: 'Up it comes, leaf by leaf…', bloomed: 'A flower! Worth the wait.',
      want: 'The frog wants to reach the flower.', half: 'Each hop is half of what is left.', closer: 'Closer and closer… will it ever arrive?', reach: 'In the pond, the frog just reaches out.',
    },
    backwardsNote: 'Backwards: everything that happened, undone.',
    curtainReady: 'Every film has played to its end.', curtain: 'Curtain call',
    finish: 'That’s a wrap!', transfer: 'Away from the screen: roll a clay animal, then squish it into something new.',
    quiet: 'Sound is off. The pictures tell the story.', stillNote: 'Motion is reduced: press Play, or step and drag the strip frame by frame.',
    stage: 'The clay stage', room: 'The Mirror Quarter rotunda', callStage: 'The clay cast takes a bow', skipCall: 'Skip the curtain call',
    toys: {
      clayHero: 'Press the clay', wireStar: 'Flick a star', nightMoon: 'Spin the moon', daySun: 'Tap the sun', padLeaf: 'Tap a lily pad', puffCloud: 'Squish a cloud',
      lotusBloom: 'Tap the flower', gardenBloom: 'Tap the planter', porthole: 'Move the porthole here',
    },
    friends: { gobgob: 'GobGob', bebe: 'Bebe', aya: 'Aya', chock: 'Chock', pep: 'Pep' }, friendWatching: '{0} is watching. Say hello',
    lens: 'ProofLens, the camera that filmed the clay', posters: ['A poster of a picnic in the valley', 'A poster of the crew in the valley'],
  },
  he: {
    title: 'תיאטרון חימר', description: 'ערב סרטים ברובע המראות: מקרינים סרטוני חימר קטנים, קדימה ואחורה.',
    instruction: 'המצלמה צילמה את החימר. מפעילים, גוררים את פס הסרט או מריצים אחורה. אפשר גם ללחוץ על החימר!',
    reels: { rocket: 'הלווייתן שהפך לטיל', jump: 'הקפיצה של הלווייתן', ayaSeed: 'הפרח של איה', frog: 'צפרדע חצי הדרך' },
    cans: 'סלילי הסרטים', canWatched: '{0}, נצפה עד הסוף', canNew: '{0}',
    pick: 'בוחרים חימר. לוחצים על הלווייתן!', bodyClay: 'גוף', trimClay: 'עיטור',
    clays: { red: 'חימר אדום', orange: 'חימר כתום', yellow: 'חימר צהוב', green: 'חימר ירוק', blue: 'חימר כחול', purple: 'חימר סגול' },
    roll: 'מקרינים את הסרט', recolour: 'מחליפים חימר', clayButton: 'חימר',
    play: 'הפעלה', pause: 'עצירה', toStart: 'חזרה להתחלה', frameBack: 'תמונה אחת אחורה', frameOn: 'תמונה אחת קדימה', hopBack: 'קפיצה אחת אחורה', hopOn: 'קפיצה אחת קדימה',
    backwards: 'אחורה', forwards: 'קדימה', direction: 'להריץ את הסרט אחורה',
    strip: 'פס הסרט', moment: 'רגע {0} מתוך {1}', hop: 'קפיצה {0} מתוך {1}', atStart: 'ההתחלה', reaching: 'הצפרדע מושיטה יד',
    captions: {
      swim: 'לווייתן חימר שוחה לו…', squash: 'מעיכה! חוזרים לגוש.', stretch: 'מותחים, צובטים, לוחצים…', count: 'פוף… פוף… פוף…', lift: 'המראה!',
      deep: 'עמוק באגם של העמק…', rise: 'למעלה, למעלה, למעלה…', fly: 'החוצה מהמים!', splash: 'שפריץ! העיגולים מתרחבים…', wave: 'נפנוף שלום בזנב.',
      hopIn: 'איה מקפצת אל גני השמיים.', plant: 'זרע אחד, לחוץ אל תוך האדמה.', wait: 'ועכשיו החלק הקשה: לחכות.', grow: 'הנה זה צומח, עלה אחר עלה…', bloomed: 'פרח! היה שווה לחכות.',
      want: 'הצפרדע רוצה להגיע אל הפרח.', half: 'כל קפיצה היא חצי ממה שנשאר.', closer: 'קרוב יותר ויותר… האם היא תגיע אי פעם?', reach: 'בבריכה, הצפרדע פשוט מושיטה יד.',
    },
    backwardsNote: 'אחורה: כל מה שקרה, חוזר על עקבותיו.',
    curtainReady: 'כל הסרטים הוקרנו עד הסוף.', curtain: 'קידה אחרונה',
    finish: 'סוף ההצגה!', transfer: 'הרחק מהמסך: מגלגלים חיה מחימר, ואז מועכים אותה והופכים אותה למשהו חדש.',
    quiet: 'הצליל כבוי. התמונות מספרות את הסיפור.', stillNote: 'התנועה מופחתת: לוחצים על הפעלה, או מתקדמים וגוררים את הפס תמונה אחר תמונה.',
    stage: 'במת החימר', room: 'הרוטונדה ברובע המראות', callStage: 'שחקני החימר קדים קידה', skipCall: 'לדלג על הקידה',
    toys: {
      clayHero: 'לוחצים על החימר', wireStar: 'מנדנדים כוכב', nightMoon: 'מסובבים את הירח', daySun: 'נוגעים בשמש', padLeaf: 'נוגעים בעלה', puffCloud: 'מועכים ענן',
      lotusBloom: 'נוגעים בפרח', gardenBloom: 'נוגעים בעציץ', porthole: 'מזיזים את החלון לכאן',
    },
    friends: { gobgob: 'גובגוב', bebe: 'בבה', aya: 'איה', chock: 'צ׳וק', pep: 'פפ' }, friendWatching: '{0} בקהל. אומרים שלום',
    lens: 'המצלמה שצילמה את החימר', posters: ['כרזה של פיקניק בעמק', 'כרזה של החבורה בעמק'],
  },
} as const;
export type ClayTheatreWords = typeof CLAY_THEATRE_COPY['en'] | typeof CLAY_THEATRE_COPY['he'];
