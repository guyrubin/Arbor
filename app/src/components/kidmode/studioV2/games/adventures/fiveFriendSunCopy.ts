import { countOn } from './fiveFriendSunRules';

/** Five-Friend Sun words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only, and it counts in the feminine counting forms. The friends
 * never speak. `{0}` and `{1}` are filled by `sunLine`; lists follow the
 * circle order: Sprout, Aya, Pep, Chock. */
export const FIVE_FRIEND_SUN_COPY = {
  en: {
    hear: 'Hear it again',
    title: 'Five-Friend Sun', description: 'Count on. Make room.', instruction: 'Hop along the number path and bring every friend into the circle.',
    ready: 'Hop along the number path. Every friend who comes lights a ray of the sun.', start: 'Start',
    spinFirst: 'Tap the spinner.', spinOn: 'You are on {0}. Tap the spinner.',
    hopFirst: ['Hop 1 pad.', 'Hop 2 pads.', 'Hop 3 pads.'], hopMore: 'You are on {0}. Hop {1} more.',
    countFirst: 'Count from the start: {0}.', countOn: 'Count on from {0}: {1}.',
    numbers: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
    listJoin: ', ', countPause: '… ', countMore: '…', countEnd: '.',
    arrived: ['Sprout hops into the circle!', 'Aya skips into the circle!', 'Pep bounces into the circle!', 'Chock has a place now.'],
    roomCue: 'Chock’s pad is far away. Bring it into the circle.',
    sun: 'All five rays are lit!', friendsHere: '{0} of 5 friends are here.',
    finishTitle: 'Everyone is here!', transfer: 'Away from the screen: count your steps from the door to your bed.',
    quiet: 'Sound is off. The pips and the numbers show every hop.',
    path: 'The number path', mat: 'Start mat', pad: 'Pad {0}', padHero: 'Pad {0}. Your hero is here.',
    spinner: 'Spinner. Tap to spin.', spinnerShows: 'The spinner shows {0}.',
    farPad: 'Chock’s pad, far away. Tap to bring it into the circle.',
  },
  he: {
    hear: 'לשמוע שוב',
    title: 'שמש חמשת החברים', description: 'סופרים הלאה. מפנים מקום.', instruction: 'קופצים לאורך שביל המספרים ומביאים את כל החברים למעגל.',
    ready: 'קופצים לאורך שביל המספרים. עם כל חבר שמגיע נדלקת עוד קרן של השמש.', start: 'מתחילים',
    spinFirst: 'מסובבים את הגלגל.', spinOn: 'עומדים על {0}. מסובבים את הגלגל.',
    hopFirst: ['קופצים 1 קדימה.', 'קופצים 2 קדימה.', 'קופצים 3 קדימה.'], hopMore: 'עומדים על {0}. קופצים עוד {1}.',
    countFirst: 'סופרים מההתחלה: {0}.', countOn: 'ממשיכים לספור מ־{0}: {1}.',
    numbers: ['אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע', 'עשר'],
    listJoin: ', ', countPause: '… ', countMore: '…', countEnd: '.',
    arrived: ['נבט קופץ למעגל!', 'איה מדלגת למעגל!', 'פפ מקפץ למעגל!', 'לצ׳וק יש מקום עכשיו.'],
    roomCue: 'הכרית של צ׳וק רחוקה. מביאים אותה למעגל.',
    sun: 'כל חמש הקרניים דולקות!', friendsHere: '{0} מתוך 5 חברים כאן.',
    finishTitle: 'כולם כאן!', transfer: 'מחוץ למסך: סופרים את הצעדים מהדלת עד המיטה.',
    quiet: 'הצליל כבוי. הנקודות והמספרים מראים כל קפיצה.',
    path: 'שביל המספרים', mat: 'שטיח ההתחלה', pad: 'כרית {0}', padHero: 'כרית {0}. הדמות שלך כאן.',
    spinner: 'גלגל. נוגעים כדי לסובב.', spinnerShows: 'הגלגל מראה {0}.',
    farPad: 'הכרית של צ׳וק, רחוקה. נוגעים כדי להביא אותה למעגל.',
  },
} as const;
export type FiveFriendSunWords = typeof FIVE_FRIEND_SUN_COPY['en'] | typeof FIVE_FRIEND_SUN_COPY['he'];

/** Fills `{0}`, `{1}` in a line from the words above. */
export function sunLine(template: string, ...values: readonly (string | number)[]): string {
  return template.replace(/\{(\d)\}/g, (_match, slot: string) => String(values[Number(slot)] ?? ''));
}
const said = (words: FiveFriendSunWords, numbers: readonly number[]) => numbers.map(value => words.numbers[value - 1] ?? String(value));

/** The heading of a turn: where the hero stands and how far to hop. */
export function turnLine(words: FiveFriendSunWords, position: number, spin: number): string {
  if (spin < 1) return position ? sunLine(words.spinOn, position) : words.spinFirst;
  return position ? sunLine(words.hopMore, position, spin) : words.hopFirst[Math.min(words.hopFirst.length, spin) - 1];
}
/** The next step after a tap on another pad: "Count on from 3: four, five." */
export function countOnLine(words: FiveFriendSunWords, position: number, spin: number): string {
  const count = said(words, countOn(position, spin)).join(words.listJoin);
  return position ? sunLine(words.countOn, position, count) : sunLine(words.countFirst, count);
}
/** The count shown while the hero hops: "four…", then "four… five." */
export function countAlong(words: FiveFriendSunWords, position: number, hops: number, spin: number): string {
  return `${said(words, countOn(position, hops)).join(words.countPause)}${hops >= spin ? words.countEnd : words.countMore}`;
}
