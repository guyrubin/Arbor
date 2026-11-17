import type { StudioActivityId, StudioLanguage } from "./studioCatalog";
import { studioNextFlagOn } from "./studioNextFlag";
import { heroBandFlagOn } from "./heroBandFlag";
import { FIVE_FRIEND_SUN_COPY } from "./games/adventures/fiveFriendSunCopy";
import { WOBBLY_DELIVERY_COPY } from "./games/adventures/wobblyDeliveryCopy";
import { OOPS_BUTTON_COPY } from "./games/adventures/oopsButtonCopy";
import { ROVER_DELIVERY_COPY } from "./games/adventures/roverDeliveryCopy";
import { HERO_BAND_COPY } from "./games/adventures/heroBandCopy";
import { MEND_BOWL_COPY } from "./games/makers/mendBowl/mendBowlCopy";
import { STITCH_GARDEN_COPY } from "./games/makers/stitchGarden/stitchGardenCopy";
import { PAPER_BOAT_COPY } from "./games/makers/paperBoat/paperBoatCopy";
import { SEASON_DIAL_COPY } from "./games/makers/seasonDial/seasonDialCopy";
import { CRANK_WORKS_COPY } from "./games/makers/crankWorks/crankWorksCopy";
import { WINDUP_RACE_COPY } from "./games/makers/windupRace/windupRaceCopy";
import { CLAY_THEATRE_COPY } from "./games/makers/clayTheatre/clayTheatreCopy";
import { BOTTLE_LAB_COPY } from "./games/makers/bottleLab/bottleLabCopy";
import { ICE_AGE_FRIEND_COPY } from "./games/makers/iceAgeFriend/iceAgeFriendCopy";
import { TINY_BUILDERS_COPY } from "./games/makers/tinyBuilders/tinyBuildersCopy";
import { FOX_TRAIL_COPY } from "./games/makers/foxTrail/foxTrailCopy";
import { MAKER_DESK_COPY } from "./games/makers/makerDesk/makerDeskCopy";

/** B-GAME-42: who introduces each game, what the child's hands will do, and what
 *  the finish names. Every line is checked against the game's own code (what is on
 *  screen, what is tapped, how a sitting ends), not against its tile.
 *
 *  Canon (Kids Studio film): Sprout and the child speak; Pep and Chock bark; Aya has
 *  her own sounds. So an animal guide never "says" a sentence: its bubble is the
 *  narrator, and the animal shows feeling with ears, tail and posture only, as in the
 *  Bop games. Sprout speaks in first person only in the games Sprout is in.
 *  Kid register: counts never, verdicts never, no "good job", gender-free Hebrew for
 *  the child (plural or impersonal forms; an animal's body part carries the verb). */
export type StudioGuideId = "sprout" | "pep" | "chock" | "aya";
interface VoiceLines { intro: string; beats: readonly string[]; finish: string; finishLine: string }
interface GameVoice { guide: StudioGuideId; en: VoiceLines; he: VoiceLines }
export interface StudioGameVoice extends VoiceLines { guide: StudioGuideId; name: string; beatsLabel: string; /** The game's own "try it for real" line, when it has one. */ transfer?: string }

const NAMES: Record<StudioGuideId, { en: string; he: string }> = {
  sprout: { en: "Sprout", he: "נבט" }, pep: { en: "Pep", he: "פפ" }, chock: { en: "Chock", he: "צ׳וק" }, aya: { en: "Aya", he: "איה" },
};
const BEATS_LABEL = { en: "How to play", he: "איך משחקים" } as const;
type Lines = Record<"en" | "he", { transfer?: string; finish?: string }>;
/** Each game's own carry-over line ("Away from the screen: …"), from its copy. */
const TRANSFER: Partial<Record<StudioActivityId, Lines>> = { pattern: FIVE_FRIEND_SUN_COPY, memory: WOBBLY_DELIVERY_COPY, puzzle: OOPS_BUTTON_COPY, "river-rescue": ROVER_DELIVERY_COPY, "rhythm-garden": HERO_BAND_COPY };
/** The makers open on their own shot and finish with their own line; the shell adds
 *  the crew member each maker's copy names as its host (world host where none is). */
const MAKERS: Partial<Record<StudioActivityId, { guide: StudioGuideId; copy: Lines }>> = {
  "mend-bowl": { guide: "chock", copy: MEND_BOWL_COPY }, "stitch-garden": { guide: "aya", copy: STITCH_GARDEN_COPY }, "paper-boat": { guide: "aya", copy: PAPER_BOAT_COPY },
  "season-dial": { guide: "aya", copy: SEASON_DIAL_COPY }, "crank-works": { guide: "chock", copy: CRANK_WORKS_COPY }, "windup-race": { guide: "pep", copy: WINDUP_RACE_COPY },
  "clay-theatre": { guide: "aya", copy: CLAY_THEATRE_COPY }, "bottle-lab": { guide: "aya", copy: BOTTLE_LAB_COPY }, "ice-age-friend": { guide: "pep", copy: ICE_AGE_FRIEND_COPY },
  "tiny-builders": { guide: "aya", copy: TINY_BUILDERS_COPY }, "fox-trail": { guide: "pep", copy: FOX_TRAIL_COPY }, "maker-desk": { guide: "chock", copy: MAKER_DESK_COPY },
};
/** How each animal guide shows it is glad: ears, tail, posture. */
const GLAD: Record<StudioGuideId, { en: string; he: string }> = {
  sprout: { en: "I saw the whole thing. Again, or something new?", he: "ראיתי הכול. עוד פעם, או משהו חדש?" },
  pep: { en: "Pep's tail hasn't stopped going.", he: "הזנב של פפ לא מפסיק לכשכש." },
  chock: { en: "Chock's tail is drumming the floor.", he: "הזנב של צ׳וק מתופף על הרצפה." },
  aya: { en: "Aya's ears are straight up.", he: "האוזניים של איה זקופות." },
};

/** The Bop games that the Next Studio switch puts on the host tiles. */
const NEXT: Partial<Record<StudioActivityId, GameVoice>> = {
  pattern: { guide: "sprout",
    en: { intro: "Five empty seats around the sun. Every friend who sits down lights a petal.", beats: ["Spin the dial", "Count the dots and hop that far", "Bring Chock in"], finish: "Everyone is here!", finishLine: "Five friends in the circle, five petals lit. Every hop counted, all the way to ten." },
    he: { intro: "חמישה מקומות ריקים סביב השמש. כל חבר שמתיישב מדליק עלה כותרת.", beats: ["מסובבים את החץ", "סופרים את הנקודות וקופצים", "מביאים את צ׳וק"], finish: "כולם כאן!", finishLine: "חמישה חברים במעגל, חמישה עלי כותרת דולקים. כל קפיצה נספרה, עד עשר." } },
  memory: { guide: "aya",
    en: { intro: "Aya's ears are up and turned your way. Three friends are about to ask for things.", beats: ["Listen to the order", "Pick up each thing", "Carry them in that order"], finish: "Delivered!", finishLine: "Three rugs, everything on them in the order it was asked for." },
    he: { intro: "האוזניים של איה זקופות ומופנות אליכם. שלושה חברים עומדים לבקש דברים.", beats: ["מקשיבים לבקשה", "מרימים כל דבר", "מביאים לפי הסדר"], finish: "המשלוח הגיע!", finishLine: "שלושה שטיחים, ועליהם כל דבר לפי הסדר שבו ביקשו." } },
  puzzle: { guide: "chock",
    en: { intro: "Chock sits right by the toy flower, nose an inch from the petals.", beats: ["Watch it open", "Copy the petals", "Jammed? Pause, put back, restart"], finish: "It bloomed!", finishLine: "When it jammed, the petals went back and it opened. Chock's tail is drumming the floor." },
    he: { intro: "האף של צ׳וק כמעט נוגע בעלי הכותרת של פרח הצעצוע.", beats: ["מסתכלים איך הוא נפתח", "חוזרים על עלי הכותרת", "נתקע? עוצרים, מחזירים, מתחילים"], finish: "הפרח פורח!", finishLine: "כשהוא נתקע, עלי הכותרת חזרו למקום והוא נפתח. הזנב של צ׳וק מתופף על הרצפה." } },
  "river-rescue": { guide: "pep",
    en: { intro: "Pep waits at the far end of the road. The rover has a delivery for Pep.", beats: ["Turn the signs", "Press start", "Stuck? Change one sign"], finish: "Delivered!", finishLine: "The rover rolled all the way to Pep. One sign at a time, the road opened up." },
    he: { intro: "בקצה השני של הדרך, השטיח של פפ. לרובר יש משלוח בשביל פפ.", beats: ["מסובבים את השלטים", "יוצאים לדרך", "נתקע? משנים שלט אחד"], finish: "המשלוח הגיע!", finishLine: "הרובר נסע עד פפ. שלט אחרי שלט, הדרך נפתחה." } },
  "rhythm-garden": { guide: "sprout",
    en: { intro: "I'll keep the beat. Your hero has the moves.", beats: ["Watch the dance", "Tap the move pads", "Dance it back"], finish: "A dance of its own", finishLine: "Two dances copied move by move, then one made up from scratch." },
    he: { intro: "אני שומר על הקצב. לדמות שלך יש את התנועות.", beats: ["מסתכלים בריקוד", "נוגעים בכפתורי התנועה", "רוקדים אותו בחזרה"], finish: "ריקוד משלה", finishLine: "שני ריקודים, תנועה אחרי תנועה, ואחר כך אחד חדש לגמרי." } },
};

/** The games every child plays today. Each guide is the crew member on that game's own
 *  cover (memory: Pep; pattern: Aya; puzzle: Chock; sneak: Aya behind the fern). */
const BASE: Partial<Record<StudioActivityId, GameVoice>> = {
  "river-rescue": { guide: "sprout",
    en: { intro: "Three canals, parcels to pick up, rocks in the way. You build the water path, I'll ride along.", beats: ["Tap water squares into a path", "Pass the parcels, go around rocks", "Set sail for the dock"], finish: "Three canals sailed", finishLine: "Three paths built, every parcel picked up, all the way to the dock." },
    he: { intro: "שלוש תעלות, חבילות לאסוף וסלעים בדרך. אתם בונים את מסלול המים, ואני מפליג איתכם.", beats: ["נוגעים במשבצות מים ובונים מסלול", "עוברים בחבילות, עוקפים סלעים", "מפליגים אל המזח"], finish: "שלוש תעלות מאחורינו", finishLine: "שלושה מסלולים, כל החבילות נאספו, עד המזח." } },
  memory: { guide: "pep",
    en: { intro: "Pep lies down by the cards, nose on paws, eyes on every card you turn.", beats: ["Turn over two cards", "Same picture? They stay up", "Find every pair"], finish: "All pairs found!", finishLine: "Every card is face up. Pep's tail thumps the floor." },
    he: { intro: "פפ שוכב ליד הקלפים, האף על הכפות, העיניים על כל קלף שהופכים.", beats: ["הופכים שני קלפים", "אותה תמונה? נשארים גלויים", "מוצאים את כל הזוגות"], finish: "כל הזוגות נמצאו!", finishLine: "כל הקלפים גלויים. הזנב של פפ מתופף על הרצפה." } },
  pattern: { guide: "aya",
    en: { intro: "A row of pictures with one gap at the end. Aya's ears tip toward it.", beats: ["Look along the row", "Tap the one that comes next", "Six rows in a set"], finish: "Six patterns, finished", finishLine: "Six rows, every gap filled. Aya's ears are straight up." },
    he: { intro: "שורה של תמונות, ובסופה מקום ריק. האוזניים של איה נוטות אליו.", beats: ["מביטים לאורך השורה", "נוגעים במה שבא אחר כך", "שש שורות בסט"], finish: "שישה דפוסים, הושלמו", finishLine: "שש שורות, כל מקום ריק התמלא. האוזניים של איה זקופות." } },
  puzzle: { guide: "chock",
    en: { intro: "One picture, cut into pieces. Chock's nose pushes the first piece toward you.", beats: ["Pick a piece", "Tap where it belongs", "Fill the whole picture"], finish: "Your picture is complete!", finishLine: "Every piece found its place. The whole picture is back together." },
    he: { intro: "תמונה אחת, חתוכה לחלקים. האף של צ׳וק דוחף אליכם את החלק הראשון.", beats: ["בוחרים חלק", "נוגעים במקום שלו", "משלימים את כל התמונה"], finish: "התמונה שלך שלמה!", finishLine: "כל חלק מצא את המקום שלו. התמונה חזרה להיות שלמה." } },
  sneak: { guide: "aya",
    en: { intro: "The cat counts with its back to you. Aya crouches behind the fern, completely still.", beats: ["Hold to tiptoe", "Let go to freeze", "Reach the cat three times"], finish: "Three tags!", finishLine: "Three times all the way to the cat, one tiptoe at a time." },
    he: { intro: "החתול סופר עם הגב אליכם. איה מתכופפת מאחורי השרך, בלי לזוז.", beats: ["מחזיקים כדי להתגנב", "משחררים כדי לקפוא", "מגיעים לחתול שלוש פעמים"], finish: "שלוש נגיעות!", finishLine: "שלוש פעמים עד החתול, צעד שקט אחרי צעד." } },
  "feelings-forest": { guide: "sprout",
    en: { intro: "I have three little stories. In each one somebody feels something big.", beats: ["Listen to the story", "Name the feeling", "Choose a way to help"], finish: "You made room for feelings", finishLine: "Three stories, three feelings named, three ways to help." },
    he: { intro: "יש לי שלושה סיפורים קטנים. בכל אחד מישהו מרגיש משהו גדול.", beats: ["מקשיבים לסיפור", "נותנים שם לרגש", "בוחרים איך לעזור"], finish: "פיניתם מקום לרגשות", finishLine: "שלושה סיפורים, שלושה רגשות עם שם, שלוש דרכים לעזור." } },
  "calm-builder": { guide: "aya",
    en: { intro: "An empty corner, just for you. Aya hops over to see what goes in it.", beats: ["Pick a place", "Put in things you like", "Choose the light"], finish: "A corner of your own", finishLine: "Aya settles in, ears soft. The corner is ready whenever you need it." },
    he: { intro: "פינה ריקה, רק בשבילכם. איה קופצת לראות מה ייכנס אליה.", beats: ["בוחרים מקום", "מכניסים דברים שאוהבים", "בוחרים תאורה"], finish: "פינה משלך", finishLine: "איה מתיישבת, האוזניים רכות. הפינה מוכנה בכל פעם שצריך." } },
  "rhythm-garden": { guide: "sprout",
    en: { intro: "Three sound pods: a star bell, a bubble and a drum. I'll play a tune first.", beats: ["Listen to the pods", "Play the tune back", "Make a tune of your own"], finish: "Your orbit has its own song", finishLine: "Three tunes played back, then one of your own." },
    he: { intro: "שלושה כלי צליל: פעמון כוכב, בועה ותוף. קודם אני מנגן מנגינה.", beats: ["מקשיבים לכלי הצליל", "מנגנים את המנגינה בחזרה", "יוצרים מנגינה משלכם"], finish: "למסלול שלך יש שיר משלו", finishLine: "שלוש מנגינות בחזרה, ואחר כך אחת משלכם." } },
};

/** A world's own host: the companion who stands in that world's door. */
const WORLD_GUIDE = { playbank: "pep", stories: "aya", studio: "chock", feelings: "aya" } as const;
const FALLBACK: Record<StudioGuideId, { en: VoiceLines; he: VoiceLines }> = {
  sprout: { en: { intro: "I'm right here if you want a hint.", beats: [], finish: "That's the whole game", finishLine: "Play it again, or pick another one." }, he: { intro: "אני כאן אם צריך רמז.", beats: [], finish: "זה כל המשחק", finishLine: "אפשר לשחק שוב, או לבחור משחק אחר." } },
  pep: { en: { intro: "Pep is up on all four paws, tail going.", beats: [], finish: "That's the whole game", finishLine: "Pep's tail hasn't stopped. Play it again, or pick another one." }, he: { intro: "הזנב של פפ כבר מכשכש.", beats: [], finish: "זה כל המשחק", finishLine: "הזנב של פפ לא מפסיק לכשכש. אפשר לשחק שוב, או לבחור משחק אחר." } },
  chock: { en: { intro: "Chock settles in close, ears up.", beats: [], finish: "That's the whole game", finishLine: "Chock's tail is drumming the floor. Play it again, or pick another one." }, he: { intro: "האוזניים של צ׳וק זקופות.", beats: [], finish: "זה כל המשחק", finishLine: "הזנב של צ׳וק מתופף על הרצפה. אפשר לשחק שוב, או לבחור משחק אחר." } },
  aya: { en: { intro: "Aya's ears turn your way.", beats: [], finish: "That's the whole game", finishLine: "Aya's ears are straight up. Play it again, or pick another one." }, he: { intro: "האוזניים של איה פונות אליכם.", beats: [], finish: "זה כל המשחק", finishLine: "האוזניים של איה זקופות. אפשר לשחק שוב, או לבחור משחק אחר." } },
};

function voiceFor(id: StudioActivityId): GameVoice | null {
  if (id === "rhythm-garden" && (studioNextFlagOn() || heroBandFlagOn())) return NEXT[id] ?? null;
  if (studioNextFlagOn() && NEXT[id]) return NEXT[id]!;
  return BASE[id] ?? null;
}

export function studioGameVoice(id: StudioActivityId, lang: StudioLanguage, worldId?: keyof typeof WORLD_GUIDE): StudioGameVoice {
  const key = lang === "he" ? "he" : "en";
  const shared = { beatsLabel: BEATS_LABEL[key] };
  const maker = MAKERS[id];
  if (maker) {
    const own = maker.copy[key];
    return { ...shared, guide: maker.guide, name: NAMES[maker.guide][key], intro: FALLBACK[maker.guide][key].intro, beats: [], finish: own.finish ?? FALLBACK[maker.guide][key].finish, finishLine: GLAD[maker.guide][key], transfer: own.transfer };
  }
  const voice = voiceFor(id);
  const guide: StudioGuideId = voice?.guide ?? (worldId ? WORLD_GUIDE[worldId] : "sprout");
  const lines = voice ? voice[key] : FALLBACK[guide][key];
  const transfer = voice && voice === NEXT[id] ? TRANSFER[id]?.[key].transfer : undefined;
  return { ...shared, guide, name: NAMES[guide][key], ...lines, transfer };
}

/** For tests: every authored game and its guide. */
export const STUDIO_GAME_VOICES = { next: NEXT, base: BASE } as const;
