/* Daily Play — household-item activity bank.
 *
 * Authored, expert-reviewable activities (NOT a 2,000-item generic dump). Each
 * is tagged to the developmental skill it builds and the household items it
 * needs, so the selector can match an activity to a child's band AND their
 * recently-logged concerns. Quality + the longitudinal match is the moat, so
 * this stays small and hand-written; AI-generated activities are a fast-follow.
 */

import type { Stage } from "./stages";

export type PlayDomain = "regulation" | "language" | "motor" | "cognitive" | "social";

/** Coarse developmental bands (avoid "developmental age" numbers per the clinical stance). */
export type PlayBand = "infant" | "toddler" | "preschool" | "early-school";

export interface PlayActivity {
  id: string;
  title: string;
  bands: PlayBand[];
  /** Optional finer-grained targeting; falls back to the bands' micro-stages. */
  stages?: Stage[];
  domain: PlayDomain;
  skillTags: string[];
  householdItems: string[];
  whatItBuilds: string;
  steps: string[];
  durationMin: number;
  /**
   * CI-29: When true, the activity's framing can be contextualised with the
   * child's recorded interests (e.g. "Make a calm-down jar" can reference
   * trains, dinosaurs, etc.). The developmental content (whatItBuilds, steps,
   * householdItems) is byte-identical regardless of interest match.
   * The LLM theme-rewrite is fenced out of Phase 1 — only the chip + why-line
   * are touched here. Default: false (undefined = false).
   */
  themeableContextSlot?: boolean;
}

export const PLAY_BANDS: { band: PlayBand; label: string; minYears: number; maxYears: number }[] = [
  { band: "infant", label: "Baby", minYears: 0, maxYears: 1 },
  { band: "toddler", label: "Toddler", minYears: 1, maxYears: 3 },
  { band: "preschool", label: "Preschooler", minYears: 3, maxYears: 5 },
  { band: "early-school", label: "School-age", minYears: 5, maxYears: 12 },
];

export function bandForAge(ageYears: number): PlayBand {
  const hit = PLAY_BANDS.find((b) => ageYears >= b.minYears && ageYears < b.maxYears);
  return hit?.band ?? (ageYears >= 5 ? "early-school" : "toddler");
}

export const PLAY_ACTIVITIES: PlayActivity[] = [
  {
    id: "calm-down-jar",
    title: "Make a calm-down jar",
    bands: ["preschool", "early-school"],
    domain: "regulation",
    skillTags: ["self-regulation", "transitions", "big-feelings"],
    householdItems: ["a clear jar with a lid", "water", "glitter or small beads"],
    whatItBuilds: "A shared tool for riding out big feelings instead of fighting them.",
    steps: [
      "Fill a jar most of the way with water and add a spoon of glitter.",
      "Shake it together and watch the glitter swirl, then settle.",
      "Name it: 'When we feel stormy, we watch it settle and breathe.'",
      "Leave it somewhere reachable so they can choose it next meltdown.",
    ],
    durationMin: 10,
    themeableContextSlot: true,
  },
  {
    id: "feelings-weather",
    title: "Today's feelings weather report",
    bands: ["preschool", "early-school"],
    domain: "regulation",
    skillTags: ["emotion-naming", "self-regulation", "connection"],
    householdItems: ["paper", "crayons or pens"],
    whatItBuilds: "Words for feelings, so they can name a storm before it lands.",
    steps: [
      "Ask: 'Is your inside weather sunny, cloudy, rainy, or stormy right now?'",
      "Draw it together, no wrong answers.",
      "Share yours too, in the same simple words.",
      "Check again at bedtime and notice if the weather changed.",
    ],
    durationMin: 8,
    themeableContextSlot: true,
  },
  {
    id: "transition-countdown",
    title: "Five-minute transition game",
    bands: ["toddler", "preschool"],
    domain: "regulation",
    skillTags: ["transitions", "self-regulation", "screen-time"],
    householdItems: ["a kitchen timer or phone timer"],
    whatItBuilds: "Smoother stops and switches, with fewer leaving-the-park battles.",
    steps: [
      "Before the next switch, set a timer for five minutes together.",
      "Give the job a name: 'When it beeps, we're shoe-detectives.'",
      "Do a slow countdown from five as it ends.",
      "Celebrate the smooth switch, even a small one.",
    ],
    durationMin: 6,
  },
  {
    id: "sock-basketball",
    title: "Sock-ball basketball",
    bands: ["toddler", "preschool", "early-school"],
    domain: "motor",
    skillTags: ["gross-motor", "coordination", "turn-taking"],
    householdItems: ["rolled-up socks", "a laundry basket"],
    whatItBuilds: "Aiming, throwing, and waiting for a turn, all while burning energy.",
    steps: [
      "Roll a few pairs of socks into balls.",
      "Set the basket a few steps away and take turns tossing.",
      "Step back one pace each time they score.",
      "Cheer for the throw, not just the basket.",
    ],
    durationMin: 12,
  },
  {
    id: "kitchen-band",
    title: "Pots-and-pans kitchen band",
    bands: ["infant", "toddler"],
    domain: "motor",
    skillTags: ["cause-and-effect", "gross-motor", "rhythm"],
    householdItems: ["a pot or pan", "a wooden spoon"],
    whatItBuilds: "Cause and effect and steady rhythm through banging with purpose.",
    steps: [
      "Hand over a pot and a wooden spoon.",
      "Copy their beat back to them, then add one of your own.",
      "Go loud, then whisper-quiet, and back to loud.",
      "Follow their lead more than you lead.",
    ],
    durationMin: 7,
  },
  {
    id: "narrate-the-day",
    title: "Sportscaster of snack time",
    bands: ["infant", "toddler"],
    domain: "language",
    skillTags: ["vocabulary", "back-and-forth", "early-language"],
    householdItems: ["whatever you're already doing"],
    whatItBuilds: "More words and the rhythm of conversation, woven into a normal moment.",
    steps: [
      "Narrate snack or getting dressed out loud, slowly.",
      "Name what they look at: 'You see the red cup.'",
      "Pause after you speak, leaving room for a sound or word back.",
      "Answer whatever they offer as if it were a full sentence.",
    ],
    durationMin: 5,
  },
  {
    id: "story-swap",
    title: "Make up a story, one line each",
    bands: ["preschool", "early-school"],
    domain: "language",
    skillTags: ["storytelling", "vocabulary", "imagination"],
    householdItems: ["nothing, or a favourite toy as a character"],
    whatItBuilds: "Sentence-building and imagination through a back-and-forth tale.",
    steps: [
      "Start with 'Once there was a very sleepy dragon...'",
      "Take turns adding one line each.",
      "Say yes to their wild turns, then build on them.",
      "End it together with 'and that's how...'.",
    ],
    durationMin: 10,
    themeableContextSlot: true,
  },
  {
    id: "sort-the-laundry",
    title: "Colour-sort the laundry",
    bands: ["toddler", "preschool"],
    domain: "cognitive",
    skillTags: ["sorting", "colours", "focus"],
    householdItems: ["a basket of clean laundry"],
    whatItBuilds: "Sorting, matching, and sticking with a task to the end.",
    steps: [
      "Tip clean laundry into a pile together.",
      "Make piles by colour, or by who it belongs to.",
      "Race to find all the socks and match the pairs.",
      "Let them carry their own pile to put away.",
    ],
    durationMin: 12,
  },
  {
    id: "treasure-hunt",
    title: "Five-things treasure hunt",
    bands: ["preschool", "early-school"],
    domain: "cognitive",
    skillTags: ["focus", "following-directions", "memory"],
    householdItems: ["five small household objects"],
    whatItBuilds: "Listening, holding a plan in mind, and seeing it through.",
    steps: [
      "Give a list of five things to find around one room.",
      "Start with two, add more as they get the hang of it.",
      "Let them give you a list to find too.",
      "Count the treasures together at the end.",
    ],
    durationMin: 10,
    themeableContextSlot: true,
  },
  {
    id: "turn-taking-tower",
    title: "One-block-each tower",
    bands: ["toddler", "preschool"],
    domain: "social",
    skillTags: ["turn-taking", "sharing", "patience"],
    householdItems: ["building blocks, cups, or books"],
    whatItBuilds: "Taking turns and handling the wobble when things fall.",
    steps: [
      "Stack one block each, taking strict turns.",
      "Name the wait: 'My turn, then your turn.'",
      "When it topples, cheer the crash instead of fixing it.",
      "Build it taller the next round.",
    ],
    durationMin: 8,
    themeableContextSlot: true,
  },
  {
    id: "helper-of-the-day",
    title: "Real-job helper",
    bands: ["preschool", "early-school"],
    domain: "social",
    skillTags: ["responsibility", "competence", "connection"],
    householdItems: ["a simple real chore"],
    whatItBuilds: "A sense of being capable and needed by doing a real job well.",
    steps: [
      "Offer one real job: setting forks, feeding the pet, watering a plant.",
      "Show it once, slowly, then hand it over fully.",
      "Resist redoing it, let their version stand.",
      "Thank them for the specific help, not just 'good job'.",
    ],
    durationMin: 8,
  },
  {
    id: "mirror-faces",
    title: "Copy-my-face game",
    bands: ["infant", "toddler"],
    domain: "social",
    skillTags: ["connection", "emotion-naming", "imitation"],
    householdItems: ["just your faces, or a mirror"],
    whatItBuilds: "Reading faces and the warm loop of back-and-forth attention.",
    steps: [
      "Make a big happy face and wait for them to copy.",
      "Try surprised, sleepy, and silly faces.",
      "Name each one as you make it.",
      "Let them lead a face for you to copy.",
    ],
    durationMin: 5,
  },

  // ── 12–30 month window (the thin band) + early infant ──────────────────
  {
    id: "ball-roll",
    title: "Roll the ball back and forth",
    bands: ["toddler"], stages: ["12-18m", "18-24m"],
    domain: "social",
    skillTags: ["turn-taking", "gross-motor", "connection"],
    householdItems: ["any soft ball"],
    whatItBuilds: "Early turn-taking and the joy of back-and-forth, with big-muscle play.",
    steps: [
      "Sit on the floor facing each other, legs apart.",
      "Roll the ball to them and say 'your turn'.",
      "Wait, then cheer when they push it back.",
      "Name it each time: 'my turn... your turn'.",
    ],
    durationMin: 6,
  },
  {
    id: "point-and-name",
    title: "Point and name around the room",
    bands: ["toddler"], stages: ["12-18m", "18-24m"],
    domain: "language",
    skillTags: ["vocabulary", "joint-attention", "early-language"],
    householdItems: ["a picture book, or just the room"],
    whatItBuilds: "First words and shared attention by naming what they look at.",
    steps: [
      "Follow their gaze and point to what they see.",
      "Name it slowly and clearly: 'dog. that's a dog.'",
      "Pause and give them a turn to point.",
      "Repeat their sound or word back, a little fuller.",
    ],
    durationMin: 5,
  },
  {
    id: "in-and-out",
    title: "In-and-out treasure box",
    bands: ["toddler"], stages: ["12-18m"],
    domain: "cognitive",
    skillTags: ["cause-and-effect", "object-permanence", "fine-motor"],
    householdItems: ["a box or bowl", "a few safe objects"],
    whatItBuilds: "Cause and effect and 'where did it go' — the roots of problem-solving.",
    steps: [
      "Put a few safe objects next to an empty box.",
      "Show them dropping one in, then tipping it out.",
      "Let them fill and empty it over and over.",
      "Hide one under a cloth and find it together.",
    ],
    durationMin: 8,
  },
  {
    id: "name-the-feeling-toddler",
    title: "Name the wobble",
    bands: ["toddler"], stages: ["18-24m", "2-3y"],
    domain: "regulation",
    skillTags: ["emotion-naming", "self-regulation", "connection"],
    householdItems: ["nothing — just you"],
    whatItBuilds: "The first link between a big feeling and a word for it.",
    steps: [
      "Get low to their level when a meltdown starts.",
      "Put the feeling into one short word: 'you're mad.'",
      "Stay calm and close; you are the anchor.",
      "Once it passes, name what helped: 'a hug helped.'",
    ],
    durationMin: 5,
  },
  {
    id: "bubble-chase",
    title: "Blow and chase bubbles",
    bands: ["toddler"], stages: ["18-24m", "2-3y"],
    domain: "motor",
    skillTags: ["gross-motor", "joint-attention", "cause-and-effect"],
    householdItems: ["bubble mix, or dish soap and water"],
    whatItBuilds: "Big-muscle movement and shared delight, plus tracking with the eyes.",
    steps: [
      "Blow a few bubbles up high.",
      "Chase and pop them together.",
      "Pause with the wand and wait for 'more'.",
      "Let them try to blow, even if nothing comes out.",
    ],
    durationMin: 8,
  },
  {
    id: "two-step-helper",
    title: "Two-step helper",
    bands: ["toddler", "preschool"], stages: ["18-24m", "2-3y"],
    domain: "language",
    skillTags: ["following-directions", "listening", "competence"],
    householdItems: ["everyday objects"],
    whatItBuilds: "Listening and holding two things in mind: 'get your shoes, bring them here.'",
    steps: [
      "Give one clear instruction first and celebrate it.",
      "When ready, try two steps: 'pick up the cup, put it in the sink.'",
      "Use gestures alongside your words.",
      "Thank them for the help, specifically.",
    ],
    durationMin: 6,
  },
  {
    id: "pretend-snack",
    title: "Pretend tea for teddy",
    bands: ["toddler", "preschool"], stages: ["2-3y", "3-4y"],
    domain: "social",
    skillTags: ["pretend-play", "empathy", "early-language"],
    householdItems: ["a cup, a spoon, a soft toy"],
    whatItBuilds: "Imagination and caring-for-others through simple pretend.",
    steps: [
      "Offer teddy a 'drink' and a 'snack'.",
      "Narrate: 'teddy is thirsty. teddy says thank you.'",
      "Let them take over feeding and caring.",
      "Follow their story wherever it goes.",
    ],
    durationMin: 8,
  },
  {
    id: "peekaboo",
    title: "Peekaboo and hide-the-toy",
    bands: ["infant"], stages: ["6-9m", "9-12m"],
    domain: "social",
    skillTags: ["object-permanence", "connection", "anticipation"],
    householdItems: ["a small cloth or your hands"],
    whatItBuilds: "That people and things still exist when hidden, and the warm surprise of reunion.",
    steps: [
      "Cover your face with your hands, then 'peekaboo!'",
      "Watch for their smile and do it again.",
      "Hide a toy under a cloth and reveal it.",
      "Let them pull the cloth off themselves.",
    ],
    durationMin: 5,
  },
];

/* Hebrew translations of the activity CONTENT, keyed by activity id. Skill tags,
   bands and domain stay language-neutral (the selector matches on those), so only
   the parent-facing prose is localized. First draft — native review recommended
   for a child-health product. */
export interface PlayActivityHe {
  title: string;
  whatItBuilds: string;
  steps: string[];
  householdItems: string[];
}

export const PLAY_ACTIVITIES_HE: Record<string, PlayActivityHe> = {
  "calm-down-jar": {
    title: "להכין צנצנת הרגעה",
    whatItBuilds: "כלי משותף לעבור דרך רגשות גדולים במקום להילחם בהם.",
    steps: [
      "מלאו צנצנת כמעט עד הסוף במים והוסיפו כפית נצנצים.",
      "נערו יחד והתבוננו בנצנצים מסתחררים ואז שוקעים.",
      "תנו לזה שם: 'כשאנחנו מרגישים סערה, אנחנו מתבוננים בה נרגעת ונושמים'.",
      "השאירו אותה במקום נגיש כדי שיוכלו לבחור בה בהתפרצות הבאה.",
    ],
    householdItems: ["צנצנת שקופה עם מכסה", "מים", "נצנצים או חרוזים קטנים"],
  },
  "feelings-weather": {
    title: "תחזית מזג האוויר של הרגשות היום",
    whatItBuilds: "מילים לרגשות, כדי שיוכלו לקרוא בשם לסערה לפני שהיא נוחתת.",
    steps: [
      "שאלו: 'מזג האוויר הפנימי שלך עכשיו שמשי, מעונן, גשום או סוער?'",
      "ציירו יחד, אין תשובות נכונות או שגויות.",
      "שתפו גם אתם, באותן מילים פשוטות.",
      "בדקו שוב לפני השינה ושימו לב אם מזג האוויר השתנה.",
    ],
    householdItems: ["נייר", "צבעים או טושים"],
  },
  "transition-countdown": {
    title: "משחק המעבר של חמש דקות",
    whatItBuilds: "מעברים והפסקות חלקים יותר, עם פחות מאבקים ביציאה מהפארק.",
    steps: [
      "לפני המעבר הבא, כווננו יחד טיימר לחמש דקות.",
      "תנו למשימה שם: 'כשזה יצפצף, אנחנו בלשי נעליים'.",
      "ספרו לאחור לאט מחמש כשהזמן נגמר.",
      "חגגו את המעבר החלק, אפילו קטן.",
    ],
    householdItems: ["טיימר מטבח או טיימר בטלפון"],
  },
  "sock-basketball": {
    title: "כדורסל גרביים",
    whatItBuilds: "כיוון, זריקה והמתנה לתור, תוך כדי שריפת אנרגיה.",
    steps: [
      "גלגלו כמה זוגות גרביים לכדורים.",
      "הציבו את הסל כמה צעדים משם וזרקו בתורות.",
      "התרחקו צעד אחד בכל פעם שהם קולעים.",
      "הריעו לזריקה, לא רק לקליעה.",
    ],
    householdItems: ["גרביים מגולגלים", "סל כביסה"],
  },
  "kitchen-band": {
    title: "תזמורת המטבח של סירים ומחבתות",
    whatItBuilds: "סיבה ותוצאה וקצב יציב, דרך הקשה עם כוונה.",
    steps: [
      "תנו להם סיר וכף עץ.",
      "החזירו להם את הקצב שלהם, ואז הוסיפו קצב משלכם.",
      "לכו חזק, אחר כך בלחישה, וחזרה לחזק.",
      "עקבו אחריהם יותר מאשר תובילו.",
    ],
    householdItems: ["סיר או מחבת", "כף עץ"],
  },
  "narrate-the-day": {
    title: "שדרן הספורט של ארוחת הביניים",
    whatItBuilds: "יותר מילים והקצב של שיחה, שזורים ברגע רגיל.",
    steps: [
      "תארו בקול את ארוחת הביניים או ההתלבשות, לאט.",
      "קראו בשם למה שהם מסתכלים עליו: 'אתה רואה את הכוס האדומה'.",
      "עצרו אחרי שדיברתם, ותנו מקום לצליל או מילה בחזרה.",
      "הגיבו לכל מה שהם מציעים כאילו זה משפט שלם.",
    ],
    householdItems: ["מה שאתם כבר עושים"],
  },
  "story-swap": {
    title: "ממציאים סיפור, שורה לכל אחד",
    whatItBuilds: "בניית משפטים ודמיון דרך סיפור הלוך ושוב.",
    steps: [
      "התחילו ב'פעם היה דרקון מאוד מנומנם...'",
      "הוסיפו בתורות שורה אחת כל אחד.",
      "אמרו כן לפניות הפראיות שלהם, ואז בנו עליהן.",
      "סיימו יחד ב'וככה זה...'.",
    ],
    householdItems: ["כלום, או צעצוע אהוב כדמות"],
  },
  "sort-the-laundry": {
    title: "מיון הכביסה לפי צבע",
    whatItBuilds: "מיון, התאמה והתמדה במשימה עד הסוף.",
    steps: [
      "שפכו יחד כביסה נקייה לערימה.",
      "עשו ערימות לפי צבע, או לפי למי זה שייך.",
      "התחרו במציאת כל הגרביים והתאמת הזוגות.",
      "תנו להם לשאת את הערימה שלהם לסידור.",
    ],
    householdItems: ["סל כביסה נקייה"],
  },
  "treasure-hunt": {
    title: "ציד אוצרות של חמישה דברים",
    whatItBuilds: "הקשבה, החזקת תוכנית בראש, וביצוע עד הסוף.",
    steps: [
      "תנו רשימה של חמישה דברים למצוא בחדר אחד.",
      "התחילו בשניים, הוסיפו עוד כשהם תופסים את העניין.",
      "תנו להם להכין גם לכם רשימה למצוא.",
      "ספרו יחד את האוצרות בסוף.",
    ],
    householdItems: ["חמישה חפצים קטנים מהבית"],
  },
  "turn-taking-tower": {
    title: "מגדל של קובייה לכל אחד",
    whatItBuilds: "לקיחת תורות והתמודדות עם הרעידה כשהדברים נופלים.",
    steps: [
      "הניחו קובייה אחת כל אחד, בתורות מדויקים.",
      "תנו שם להמתנה: 'התור שלי, אחר כך התור שלך'.",
      "כשזה מתמוטט, הריעו למפולת במקום לתקן.",
      "בנו אותו גבוה יותר בסיבוב הבא.",
    ],
    householdItems: ["קוביות בנייה, כוסות או ספרים"],
  },
  "helper-of-the-day": {
    title: "עוזר עם עבודה אמיתית",
    whatItBuilds: "תחושת מסוגלות וצורך, דרך עשיית עבודה אמיתית היטב.",
    steps: [
      "הציעו עבודה אמיתית אחת: לסדר מזלגות, להאכיל את החיה, להשקות צמח.",
      "הראו פעם אחת, לאט, ואז מסרו את זה לגמרי.",
      "התאפקו מלתקן, תנו לגרסה שלהם לעמוד.",
      "הודו להם על העזרה הספציפית, לא רק 'כל הכבוד'.",
    ],
    householdItems: ["מטלת בית פשוטה אחת"],
  },
  "mirror-faces": {
    title: "משחק חיקוי הפרצופים",
    whatItBuilds: "קריאת פרצופים והלולאה החמה של תשומת לב הדדית.",
    steps: [
      "עשו פרצוף שמח גדול וחכו שיחקו אתכם.",
      "נסו פרצופים מופתעים, מנומנמים ומצחיקים.",
      "קראו בשם לכל אחד כשאתם עושים אותו.",
      "תנו להם להוביל פרצוף שאתם תחקו.",
    ],
    householdItems: ["רק הפרצופים שלכם, או מראה"],
  },
  "ball-roll": {
    title: "לגלגל את הכדור הלוך ושוב",
    whatItBuilds: "לקיחת תורות מוקדמת והכיף של הלוך ושוב, עם משחק של שרירים גדולים.",
    steps: [
      "שבו על הרצפה זה מול זה, רגליים פתוחות.",
      "גלגלו אליהם את הכדור ואמרו 'התור שלך'.",
      "חכו, ואז הריעו כשהם דוחפים אותו בחזרה.",
      "תנו לזה שם בכל פעם: 'התור שלי... התור שלך'.",
    ],
    householdItems: ["כדור רך כלשהו"],
  },
  "point-and-name": {
    title: "להצביע ולקרוא בשם בחדר",
    whatItBuilds: "מילים ראשונות וקשב משותף דרך קריאת שם למה שהם מסתכלים עליו.",
    steps: [
      "עקבו אחרי המבט שלהם והצביעו על מה שהם רואים.",
      "קראו בשם לאט וברור: 'כלב. זה כלב.'",
      "עצרו ותנו להם תור להצביע.",
      "חזרו על הצליל או המילה שלהם, קצת יותר מלאים.",
    ],
    householdItems: ["ספר תמונות, או פשוט החדר"],
  },
  "in-and-out": {
    title: "קופסת אוצר של פנימה והחוצה",
    whatItBuilds: "סיבה ותוצאה ו'לאן זה נעלם' — השורשים של פתרון בעיות.",
    steps: [
      "הניחו כמה חפצים בטוחים ליד קופסה ריקה.",
      "הראו להם להפיל אחד פנימה, ואז לשפוך החוצה.",
      "תנו להם למלא ולרוקן שוב ושוב.",
      "הסתירו אחד מתחת לבד ומצאו יחד.",
    ],
    householdItems: ["קופסה או קערה", "כמה חפצים בטוחים"],
  },
  "name-the-feeling-toddler": {
    title: "לתת שם לסערה",
    whatItBuilds: "החיבור הראשון בין רגש גדול למילה עבורו.",
    steps: [
      "התכופפו לגובה שלהם כשמתחילה התפרצות.",
      "הכניסו את הרגש למילה אחת קצרה: 'אתה כועס.'",
      "הישארו רגועים וקרובים; אתם העוגן.",
      "כשזה עובר, תנו שם למה שעזר: 'חיבוק עזר.'",
    ],
    householdItems: ["כלום — רק אתם"],
  },
  "bubble-chase": {
    title: "לנשוף ולרדוף אחרי בועות",
    whatItBuilds: "תנועה של שרירים גדולים והנאה משותפת, ומעקב עם העיניים.",
    steps: [
      "נשפו כמה בועות גבוה למעלה.",
      "רדפו ופוצצו אותן יחד.",
      "עצרו עם המקל וחכו ל'עוד'.",
      "תנו להם לנסות לנשוף, גם אם כלום לא יוצא.",
    ],
    householdItems: ["תמיסת בועות, או סבון כלים ומים"],
  },
  "two-step-helper": {
    title: "עוזר בשני שלבים",
    whatItBuilds: "הקשבה והחזקת שני דברים בראש: 'קח את הנעליים, תביא אותן לכאן.'",
    steps: [
      "תנו קודם הוראה אחת ברורה וחגגו אותה.",
      "כשמוכנים, נסו שני שלבים: 'הרם את הכוס, שים אותה בכיור.'",
      "השתמשו בתנועות יחד עם המילים.",
      "הודו להם על העזרה, באופן ספציפי.",
    ],
    householdItems: ["חפצים יומיומיים"],
  },
  "pretend-snack": {
    title: "תה מדומה לדובי",
    whatItBuilds: "דמיון ודאגה לאחר דרך משחק 'כאילו' פשוט.",
    steps: [
      "הציעו לדובי 'שתייה' ו'חטיף'.",
      "ספרו: 'דובי צמא. דובי אומר תודה.'",
      "תנו להם להשתלט על ההאכלה והדאגה.",
      "עקבו אחרי הסיפור שלהם לאן שהוא הולך.",
    ],
    householdItems: ["כוס, כף, בובה רכה"],
  },
  "peekaboo": {
    title: "קוקו ומחבואים לצעצוע",
    whatItBuilds: "שאנשים ודברים עדיין קיימים כשהם מוסתרים, וההפתעה החמה של המפגש מחדש.",
    steps: [
      "כסו את הפנים בידיים, ואז 'קוקו!'",
      "חכו לחיוך שלהם ועשו את זה שוב.",
      "הסתירו צעצוע מתחת לבד וחשפו אותו.",
      "תנו להם למשוך את הבד בעצמם.",
    ],
    householdItems: ["בד קטן או הידיים שלכם"],
  },
};

/** Return the activity with Hebrew content swapped in when lang is "he" and a
 *  translation exists; otherwise the canonical English activity unchanged. */
export function localizeActivity(activity: PlayActivity, lang: "en" | "he"): PlayActivity {
  if (lang !== "he") return activity;
  const he = PLAY_ACTIVITIES_HE[activity.id];
  if (!he) return activity;
  return { ...activity, title: he.title, whatItBuilds: he.whatItBuilds, steps: he.steps, householdItems: he.householdItems };
}
