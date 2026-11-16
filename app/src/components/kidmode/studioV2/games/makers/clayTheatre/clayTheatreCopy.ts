/** Clay Theatre words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only. `title`, `description` and `instruction` are the Studio
 * tile and intro card (studioCopy reads them); the rest is the game's own.
 * Blanks are filled by `clayLine` (rules). The story: film night in the
 * Mirror Quarter's glass rotunda. The child is the animator: shapes a clay
 * hero, shoots it pose by pose with Bebe's ProofLens (a camera that records
 * an actual view), directs the scene, and the crew come to the premiere.
 * Coach lines are eight words or fewer. Numbers appear only in accessible
 * names, never on the picture. */
export const CLAY_THEATRE_COPY = {
  en: {
    title: 'Clay Theatre', description: 'Film night in the Mirror Quarter: shape a clay hero, shoot it frame by frame, and hold a premiere.',
    instruction: 'Shape a clay hero. Move it a little, then press the camera. Six frames make a film!',
    place: 'Mirror Quarter · the rotunda', stage: 'The clay stage in the rotunda',
    stories: { whaleJump: 'The Whale’s Jump', moonRocket: 'Rocket to the Moon', frogPond: 'The Frog’s Pond', snailGarden: 'The Snail’s Garden' },
    can: 'Film can: {0}', cans: 'The film cans',
    clays: { red: 'red clay', orange: 'orange clay', yellow: 'yellow clay', green: 'green clay', blue: 'blue clay', purple: 'purple clay' },
    lump: 'Knead in the {0}', lumps: 'Lumps of clay on the rug',
    pulls: { front: 'Pull out the front of the clay', back: 'Pull out the back of the clay', top: 'Pull out the top of the clay' },
    hero: 'The clay hero. Press it, or move it with the arrow keys', set: 'The set. Tap where the clay should go',
    lens: 'ProofLens: take a frame', lensView: 'What the camera sees', strip: 'The film strip', frame: 'frame {0} of {1}', noFrames: 'no frames yet',
    crank: 'Crank the projector', undo: 'Take the last frame back',
    friends: { seaBird: 'the gull', starlet: 'the little star', dragonfly: 'the dragonfly', ladybird: 'the ladybird' },
    friendLump: 'Bring {0} onto the set', friendOn: 'Give {0} a new move', acts: { hopAct: 'hopping', spinAct: 'spinning', swayAct: 'swaying' },
    lamp: 'The stage lamp', gels: { roseGel: 'Rose light', blueGel: 'Blue light', goldGel: 'Golden light' },
    tunes: { tuneA: 'A rising tune', tuneB: 'A gentle tune', tuneC: 'A marching tune' }, tuneGroup: 'Tunes for the film',
    quest: { label: 'Three chapters', shape: 'Shape', animate: 'Animate', direct: 'Direct' },
    next: { animate: 'Lights, camera!', direct: 'Dress the scene', premiere: 'Premiere!' },
    coach: {
      welcome: 'Film night! Let’s make a clay film.', cans: 'Pick a film can.',
      body: 'Knead a colour into the clay.', trim: 'Now a second colour.', pull: 'Pull the clay into shape.', alive: 'It’s awake! Press it. It squishes.',
      first: 'Press my ProofLens. Click!', moveIt: 'Move the clay a little. Then click.', moveFirst: 'Move it first, then shoot.', nearly: 'Nearly a whole film!',
      film: 'A film! Drag the strip to run it.', friend: 'Bring a friend onto the set.', light: 'Try a colour on the lamp.', tune: 'Pick a tune for the film.', ready: 'Ready? Call the crew in!',
      poke: 'I’m filming. You’re the animator!', pokeLabel: 'Bebe, the camera keeper',
    },
    captions: { dim: 'Lights down…', roll: 'The premiere!', encore: 'Once more, up close!', applause: 'Bravo!' },
    skip: 'Skip to the applause', secret: 'A clay pancake! It springs right back.',
    crew: { bebe: 'Bebe', gobgob: 'GobGob', chock: 'Chock', aya: 'Aya', pep: 'Pep' }, crewRow: 'The crew at the premiere', screen: 'The film, on the big screen',
    finish: 'That’s a wrap!', transfer: 'Away from the screen: roll a clay animal, move it a little, and take a photo each time.',
  },
  he: {
    title: 'תיאטרון חימר', description: 'ערב סרטים ברובע המראות: מפסלים גיבור מחימר, מצלמים תמונה אחר תמונה ועורכים הקרנת בכורה.',
    instruction: 'מפסלים גיבור מחימר. מזיזים אותו קצת ולוחצים על המצלמה. שש תמונות הן סרט!',
    place: 'רובע המראות · הרוטונדה', stage: 'במת החימר ברוטונדה',
    stories: { whaleJump: 'הקפיצה של הלווייתן', moonRocket: 'טיל אל הירח', frogPond: 'הצפרדע בבריכה', snailGarden: 'החילזון בגינה' },
    can: 'קופסת סרט: {0}', cans: 'קופסאות הסרטים',
    clays: { red: 'חימר אדום', orange: 'חימר כתום', yellow: 'חימר צהוב', green: 'חימר ירוק', blue: 'חימר כחול', purple: 'חימר סגול' },
    lump: 'ללוש פנימה {0}', lumps: 'גושי חימר על השטיח',
    pulls: { front: 'למשוך החוצה את קדמת החימר', back: 'למשוך החוצה את גב החימר', top: 'למשוך החוצה את ראש החימר' },
    hero: 'גיבור החימר. לוחצים עליו, או מזיזים במקשי החיצים', set: 'הבמה. נוגעים במקום שאליו החימר צריך לזוז',
    lens: 'המצלמה: לצלם תמונה', lensView: 'מה שהמצלמה רואה', strip: 'פס הסרט', frame: 'תמונה {0} מתוך {1}', noFrames: 'אין עדיין תמונות',
    crank: 'לסובב את המקרן', undo: 'להחזיר את התמונה האחרונה',
    friends: { seaBird: 'השחף', starlet: 'הכוכב הקטן', dragonfly: 'השפירית', ladybird: 'פרת משה רבנו' },
    friendLump: 'להביא את {0} אל הבמה', friendOn: 'לתת תנועה חדשה: {0}', acts: { hopAct: 'קפיצות', spinAct: 'סיבובים', swayAct: 'נדנוד' },
    lamp: 'מנורת הבמה', gels: { roseGel: 'אור ורוד', blueGel: 'אור כחול', goldGel: 'אור זהוב' },
    tunes: { tuneA: 'מנגינה עולה', tuneB: 'מנגינה עדינה', tuneC: 'מנגינת צעידה' }, tuneGroup: 'מנגינות לסרט',
    quest: { label: 'שלושה פרקים', shape: 'מפסלים', animate: 'מצלמים', direct: 'מביימים' },
    next: { animate: 'אורות, מצלמה!', direct: 'מקשטים את הבמה', premiere: 'הקרנת בכורה!' },
    coach: {
      welcome: 'ערב סרטים! עושים סרט מחימר.', cans: 'בוחרים קופסת סרט.',
      body: 'לשים צבע אל תוך החימר.', trim: 'ועכשיו צבע שני.', pull: 'מושכים את החימר לצורה.', alive: 'זה מתעורר! לוחצים, וזה נמעך.',
      first: 'לוחצים על המצלמה. קליק!', moveIt: 'מזיזים קצת את החימר. ואז קליק.', moveFirst: 'קודם מזיזים, אחר כך מצלמים.', nearly: 'עוד מעט יש סרט שלם!',
      film: 'יש סרט! גוררים את הפס ומריצים.', friend: 'מביאים חבר אל הבמה.', light: 'מנסים צבע על המנורה.', tune: 'בוחרים מנגינה לסרט.', ready: 'מוכנים? קוראים לחבורה!',
      poke: 'המצלמה אצלי. האנימציה אצלכם!', pokeLabel: 'בבה, שומר המצלמה',
    },
    captions: { dim: 'האורות כבים…', roll: 'הקרנת הבכורה!', encore: 'ושוב, מקרוב!', applause: 'בראבו!' },
    skip: 'לדלג אל מחיאות הכפיים', secret: 'פנקייק מחימר! והוא קופץ בחזרה.',
    crew: { bebe: 'בבה', gobgob: 'גובגוב', chock: 'צ׳וק', aya: 'איה', pep: 'פפ' }, crewRow: 'החבורה בהקרנת הבכורה', screen: 'הסרט, על המסך הגדול',
    finish: 'סוף הצילומים!', transfer: 'הרחק מהמסך: מגלגלים חיה מחימר, מזיזים אותה קצת, ומצלמים תמונה בכל פעם.',
  },
} as const;
export type ClayTheatreWords = typeof CLAY_THEATRE_COPY['en'] | typeof CLAY_THEATRE_COPY['he'];
