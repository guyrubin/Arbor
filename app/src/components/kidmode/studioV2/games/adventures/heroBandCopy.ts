import { ArrowUp, Footprints, RotateCw, Waves, Wind, Zap } from 'lucide-react';

/** One glyph per move, in MoveId order. Colour is never the only cue. */
export const BAND_GLYPHS = [ArrowUp, Wind, Zap, Waves, Footprints, RotateCw] as const;

/** Hero Band words. Hebrew is gender-free: nouns and plural verbs only. */
export const HERO_BAND_COPY = {
  en: {
    title: 'Hero Band', description: 'Make your hero dance.', instruction: 'Tap a move pad. Your hero dances to the beat.',
    ready: 'Watch your hero dance. Then dance it back.', showMe: 'Show me the dance', showAgain: 'Show it again', watching: 'Watch the moves',
    yourTurn: 'Your turn. Tap the same moves.', retry: 'Nearly! The moves are showing now. Try again.', matched: 'You danced it!', next: 'Next dance',
    own: 'Make my own dance', open: 'Open my dance',
    jam: 'Make your own dance.', jamRunning: 'Tap a move. It lands on the glowing step.', jamPaused: 'Tap moves to fill the steps. Then start the beat.',
    startBeat: 'Start the beat', pause: 'Pause', clear: 'Start over', showTime: 'Show time!', stage: 'Show time! Here is your dance.', back: 'Change my dance',
    full: 'Every step has a move. Tap a step to take its move out.',
    finish: 'Your hero has a dance of its own.', transfer: 'Away from the screen: teach someone your dance, one move at a time.',
    quiet: 'Sound is off. Follow the lights and your hero.', unavailable: 'Follow the lights and your hero; sound is unavailable here.',
    moves: ['Jump', 'Zoom', 'Snap', 'Wobble', 'Hop', 'Spin'],
    pads: 'Move pads', track: 'Your dance', pattern: 'The dance to copy', step: 'Step', empty: 'no move', hidden: 'waiting for a move', takeOut: 'take it out',
    speed: 'Dance speed', memory: 'Show the moves', hideMemory: 'Hide the moves',
    keep: 'Your own dance', play: 'Play my dance', stop: 'Pause',
  },
  he: {
    title: 'להקת הגיבורים', description: 'הדמות שלך רוקדת.', instruction: 'נוגעים בכפתור תנועה. הדמות שלך רוקדת לפי הקצב.',
    ready: 'מביטים בריקוד של הדמות שלך. אחר כך רוקדים אותו בחזרה.', showMe: 'להראות את הריקוד', showAgain: 'להראות שוב', watching: 'מביטים בתנועות',
    yourTurn: 'תורך. נוגעים באותן תנועות.', retry: 'כמעט! התנועות מוצגות עכשיו. מנסים שוב.', matched: 'הריקוד הצליח!', next: 'הריקוד הבא',
    own: 'ליצור ריקוד משלי', open: 'לפתוח את הריקוד שלי',
    jam: 'יוצרים ריקוד משלך.', jamRunning: 'נוגעים בתנועה. היא נוחתת על הצעד הזוהר.', jamPaused: 'נוגעים בתנועות כדי למלא את הצעדים. אחר כך מפעילים את הקצב.',
    startBeat: 'להפעיל את הקצב', pause: 'הפסקה', clear: 'להתחיל מחדש', showTime: 'מופע!', stage: 'מופע! הנה הריקוד שלך.', back: 'לשנות את הריקוד',
    full: 'בכל צעד יש תנועה. נוגעים בצעד כדי להוציא ממנו את התנועה.',
    finish: 'לדמות שלך יש ריקוד משלה.', transfer: 'מחוץ למסך: מלמדים מישהו את הריקוד שלך, תנועה אחרי תנועה.',
    quiet: 'הצליל כבוי. עוקבים אחרי האורות והדמות שלך.', unavailable: 'עוקבים אחרי האורות והדמות שלך; הצליל לא זמין כאן.',
    moves: ['קפיצה', 'זינוק', 'פוזה', 'נדנוד', 'דילוג', 'סיבוב'],
    pads: 'כפתורי התנועות', track: 'הריקוד שלך', pattern: 'הריקוד לחזור עליו', step: 'צעד', empty: 'בלי תנועה', hidden: 'מחכים לתנועה', takeOut: 'להוציא',
    speed: 'מהירות הריקוד', memory: 'להראות את התנועות', hideMemory: 'להסתיר את התנועות',
    keep: 'הריקוד שלך', play: 'להפעיל את הריקוד שלי', stop: 'הפסקה',
  },
} as const;
export type HeroBandWords = typeof HERO_BAND_COPY['en'] | typeof HERO_BAND_COPY['he'];
