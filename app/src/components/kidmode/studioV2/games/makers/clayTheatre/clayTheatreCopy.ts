/** Clay Theatre words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only. `title`, `description` and `instruction` are the Studio
 * tile and intro card (studioCopy reads them); the rest is the game's own.
 * Blanks are filled by `clayLine` (rules). The frog puzzle is asked, never answered
 * with a false claim: in the pond, the frog simply reaches out. */
export const CLAY_THEATRE_COPY = {
  en: {
    title: 'Clay Theatre', description: 'Run three tiny clay films, forwards and backwards.',
    instruction: 'Pick a film can. Play it, pause it, drag the film strip, or run it backwards.',
    reels: { rocket: 'Whale into Rocket', jump: 'The Whale’s Jump', frog: 'Halfway Frog' },
    cans: 'The film cans', canWatched: '{0}, watched to the end', canNew: '{0}',
    pick: 'Choose the clay for the whale.', bodyClay: 'Body', trimClay: 'Trim',
    clays: { red: 'Red clay', orange: 'Orange clay', yellow: 'Yellow clay', green: 'Green clay', blue: 'Blue clay', purple: 'Purple clay' },
    roll: 'Roll the film', recolour: 'Change the clay', clayButton: 'Clay',
    play: 'Play', pause: 'Pause', toStart: 'Back to the start', frameBack: 'One frame back', frameOn: 'One frame on', hopBack: 'One hop back', hopOn: 'One hop on',
    backwards: 'Backwards', forwards: 'Forwards', direction: 'Run the film backwards',
    strip: 'Film strip', moment: 'moment {0} of {1}', hop: 'hop {0} of {1}', atStart: 'the start', reaching: 'the frog reaches out',
    captions: {
      swim: 'A clay whale swims along…', squash: 'Squish! Back into a lump.', stretch: 'Stretch, pinch, press…', count: 'Puff… puff… puff…', lift: 'Lift-off!',
      deep: 'Deep under the sea…', rise: 'Up, up, up…', fly: 'Out of the water!', splash: 'Splash! The rings spread out…', wave: 'A tail wave. Bye!',
      want: 'The frog wants to reach the flower.', half: 'Each hop is half of what is left.', closer: 'Closer and closer… will it ever arrive?', reach: 'In the pond, the frog just reaches out.',
    },
    backwardsNote: 'Running backwards: the clay un-does itself.',
    curtainReady: 'Every film has played to its end.', curtain: 'Curtain',
    finish: 'That’s a wrap!', transfer: 'Away from the screen: roll a clay animal, then squish it into something new.',
    quiet: 'Sound is off. The pictures tell the story.', stillNote: 'Motion is reduced: press Play, or step and drag the strip frame by frame.',
    stage: 'The clay stage',
  },
  he: {
    title: 'תיאטרון חימר', description: 'מקרינים שלושה סרטוני חימר קטנים, קדימה ואחורה.',
    instruction: 'בוחרים קופסת סרט. מפעילים, עוצרים, גוררים את פס הסרט או מריצים אחורה.',
    reels: { rocket: 'הלווייתן שהפך לטיל', jump: 'הקפיצה של הלווייתן', frog: 'צפרדע חצי הדרך' },
    cans: 'קופסאות הסרטים', canWatched: '{0}, נצפה עד הסוף', canNew: '{0}',
    pick: 'בוחרים חימר ללווייתן.', bodyClay: 'גוף', trimClay: 'עיטור',
    clays: { red: 'חימר אדום', orange: 'חימר כתום', yellow: 'חימר צהוב', green: 'חימר ירוק', blue: 'חימר כחול', purple: 'חימר סגול' },
    roll: 'מקרינים את הסרט', recolour: 'מחליפים חימר', clayButton: 'חימר',
    play: 'הפעלה', pause: 'עצירה', toStart: 'חזרה להתחלה', frameBack: 'תמונה אחת אחורה', frameOn: 'תמונה אחת קדימה', hopBack: 'קפיצה אחת אחורה', hopOn: 'קפיצה אחת קדימה',
    backwards: 'אחורה', forwards: 'קדימה', direction: 'להריץ את הסרט אחורה',
    strip: 'פס הסרט', moment: 'רגע {0} מתוך {1}', hop: 'קפיצה {0} מתוך {1}', atStart: 'ההתחלה', reaching: 'הצפרדע מושיטה יד',
    captions: {
      swim: 'לווייתן חימר שוחה לו…', squash: 'מעיכה! חוזרים לגוש.', stretch: 'מותחים, צובטים, לוחצים…', count: 'פוף… פוף… פוף…', lift: 'המראה!',
      deep: 'עמוק מתחת לים…', rise: 'למעלה, למעלה, למעלה…', fly: 'החוצה מהמים!', splash: 'שפריץ! העיגולים מתרחבים…', wave: 'נפנוף שלום בזנב.',
      want: 'הצפרדע רוצה להגיע אל הפרח.', half: 'כל קפיצה היא חצי ממה שנשאר.', closer: 'קרוב יותר ויותר… האם היא תגיע אי פעם?', reach: 'בבריכה, הצפרדע פשוט מושיטה יד.',
    },
    backwardsNote: 'רצים אחורה: החימר חוזר על עקבותיו.',
    curtainReady: 'כל הסרטים הוקרנו עד הסוף.', curtain: 'מורידים מסך',
    finish: 'סוף ההצגה!', transfer: 'הרחק מהמסך: מגלגלים חיה מחימר, ואז מועכים אותה והופכים אותה למשהו חדש.',
    quiet: 'הצליל כבוי. התמונות מספרות את הסיפור.', stillNote: 'התנועה מופחתת: לוחצים על הפעלה, או מתקדמים וגוררים את הפס תמונה אחר תמונה.',
    stage: 'במת החימר',
  },
} as const;
export type ClayTheatreWords = typeof CLAY_THEATRE_COPY['en'] | typeof CLAY_THEATRE_COPY['he'];

