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

  // ── Batch 1: coverage-gap fillers (≥2 per populated band×domain cell) ──

  // infant × regulation (was 0)
  {
    id: "swaddle-sway",
    title: "Sway-and-shush wind-down",
    bands: ["infant"], stages: ["0-3m", "3-6m"],
    domain: "regulation",
    skillTags: ["self-regulation", "soothing", "connection"],
    householdItems: ["just your arms", "a quiet room"],
    whatItBuilds: "An early, repeatable path from upset back to calm — co-regulation.",
    steps: [
      "Hold them close, chest to chest, when fussing starts.",
      "Sway slowly side to side and add a soft, steady 'shhh'.",
      "Match your breathing to a slow, even rhythm.",
      "Stay until the body softens — they borrow your calm.",
    ],
    durationMin: 6,
  },
  {
    id: "warm-bath-calm",
    title: "Slow warm-water calm",
    bands: ["infant", "toddler"], stages: ["3-6m", "6-9m", "9-12m"],
    domain: "regulation",
    skillTags: ["self-regulation", "routine", "soothing"],
    householdItems: ["a warm bath or basin", "a soft cloth"],
    whatItBuilds: "A predictable calming ritual that settles the nervous system before sleep.",
    steps: [
      "Run a comfortably warm, shallow bath.",
      "Pour water slowly over their back, narrating softly.",
      "Keep the lights low and your voice quiet.",
      "Wrap them straight into a warm towel afterward.",
    ],
    durationMin: 10,
  },

  // infant × cognitive (was 0)
  {
    id: "drop-and-find",
    title: "Drop, look, and find",
    bands: ["infant"], stages: ["9-12m"],
    domain: "cognitive",
    skillTags: ["object-permanence", "cause-and-effect", "attention"],
    householdItems: ["a soft toy", "a tray or high-chair"],
    whatItBuilds: "The first idea that things still exist after they vanish from view.",
    steps: [
      "Sit them in a safe seat and offer a soft toy.",
      "When they drop it, say 'uh-oh, where did it go?'",
      "Pick it up slowly so they track where it went.",
      "Hand it back and let the happy cycle repeat.",
    ],
    durationMin: 6,
  },
  {
    id: "texture-tray",
    title: "Touch-and-notice texture tray",
    bands: ["infant"], stages: ["6-9m", "9-12m"],
    domain: "cognitive",
    skillTags: ["attention", "sensory", "exploration"],
    householdItems: ["a tray", "two safe items with different textures"],
    whatItBuilds: "Focused attention and early 'these feel different' sorting of the world.",
    steps: [
      "Place one smooth and one bumpy safe item on a tray.",
      "Guide their hand to each and name it: 'soft… bumpy.'",
      "Pause and let them explore at their own pace.",
      "Notice which one holds their attention longer.",
    ],
    durationMin: 7,
  },

  // infant × language (was 1)
  {
    id: "sing-the-routine",
    title: "Sing the everyday routine",
    bands: ["infant"], stages: ["3-6m", "6-9m", "9-12m"],
    domain: "language",
    skillTags: ["early-language", "rhythm", "connection"],
    householdItems: ["just your voice"],
    whatItBuilds: "The melody and rhythm of language, long before first words.",
    steps: [
      "Pick one daily moment — nappy change or getting dressed.",
      "Sing what you're doing to any simple tune.",
      "Use the same little song each time so it becomes familiar.",
      "Pause and smile, leaving space for a coo back.",
    ],
    durationMin: 5,
  },
  {
    id: "copy-the-coo",
    title: "Copy the coo conversation",
    bands: ["infant"], stages: ["3-6m", "6-9m"],
    domain: "language",
    skillTags: ["back-and-forth", "early-language", "joint-attention"],
    householdItems: ["just you, face to face"],
    whatItBuilds: "The turn-taking heartbeat of conversation, using sounds not words.",
    steps: [
      "Get face to face and wait for a coo or babble.",
      "Copy their exact sound back, warmly.",
      "Pause and give them a turn to answer.",
      "Add one new gentle sound and see if they try it.",
    ],
    durationMin: 5,
  },

  // infant × motor (was 1)
  {
    id: "tummy-time-reach",
    title: "Tummy-time reach",
    bands: ["infant"], stages: ["3-6m", "6-9m"],
    domain: "motor",
    skillTags: ["gross-motor", "core-strength", "reaching"],
    householdItems: ["a soft mat", "a favourite toy"],
    whatItBuilds: "Neck, back, and arm strength — the base for sitting and crawling.",
    steps: [
      "Lay them on their tummy on a soft, safe surface.",
      "Get down to their level, face to face, and chat.",
      "Place a toy just out of reach to invite a stretch.",
      "Keep it short and happy; stop before it's a struggle.",
    ],
    durationMin: 5,
  },

  // toddler × cognitive (was 2 → add depth)
  {
    id: "shape-posting",
    title: "Post-it-through container play",
    bands: ["toddler"], stages: ["12-18m", "18-24m"],
    domain: "cognitive",
    skillTags: ["problem-solving", "fine-motor", "matching"],
    householdItems: ["a container with a lid", "safe objects that fit a cut slot"],
    whatItBuilds: "Matching size and shape to a gap — early problem-solving with the hands.",
    steps: [
      "Cut a hand-safe slot in a clean container lid.",
      "Show them posting one object through the slot.",
      "Cheer the 'plop' and tip them all out to start again.",
      "Let them work the angle out themselves — resist helping too fast.",
    ],
    durationMin: 8,
  },

  // preschool × motor (was 1)
  {
    id: "tape-line-walk",
    title: "Walk-the-tightrope tape line",
    bands: ["preschool", "early-school"], stages: ["3-4y", "4-5y", "5-7y"],
    domain: "motor",
    skillTags: ["balance", "gross-motor", "body-awareness"],
    householdItems: ["a strip of tape on the floor"],
    whatItBuilds: "Balance and body control through a playful 'don't fall in the lava' walk.",
    steps: [
      "Stick a straight line of tape along the floor.",
      "Walk it heel-to-toe together, arms out like wings.",
      "Try it backwards, then on tiptoes.",
      "Add a 'wobble and recover' game to practise balancing.",
    ],
    durationMin: 8,
  },

  // preschool × cognitive (was 2 → depth) + preschool × language
  {
    id: "what-comes-next",
    title: "What-comes-next pattern game",
    bands: ["preschool", "early-school"], stages: ["3-4y", "4-5y", "5-7y"],
    domain: "cognitive",
    skillTags: ["patterns", "prediction", "focus"],
    householdItems: ["small objects in two kinds (spoons and forks, coins, blocks)"],
    whatItBuilds: "Spotting and predicting patterns — a foundation for maths and reasoning.",
    steps: [
      "Lay a simple pattern: spoon, fork, spoon, fork…",
      "Ask 'what comes next?' and let them place it.",
      "Make the pattern a little longer each round.",
      "Let them invent a pattern for you to finish.",
    ],
    durationMin: 8,
  },
  {
    id: "i-spy-sounds",
    title: "I-spy with first sounds",
    bands: ["preschool", "early-school"], stages: ["4-5y", "5-7y"],
    domain: "language",
    skillTags: ["phonics", "vocabulary", "listening"],
    householdItems: ["whatever is in the room"],
    whatItBuilds: "Hearing the first sound in words — an early step toward reading.",
    steps: [
      "Say 'I spy something that starts with mmm…'",
      "Let them guess and hunt around the room.",
      "Stretch the sound out together when they find it.",
      "Swap roles and let them set the next clue.",
    ],
    durationMin: 7,
  },

  // early-school × language (was 1)
  {
    id: "two-truths-tale",
    title: "Two-true-things storytelling",
    bands: ["early-school"], stages: ["5-7y", "7-9y", "9-12y"],
    domain: "language",
    skillTags: ["storytelling", "vocabulary", "sequencing"],
    householdItems: ["nothing needed"],
    whatItBuilds: "Longer sentences, sequencing, and the confidence to tell a story aloud.",
    steps: [
      "Each share two true things that happened today.",
      "Pick one and stretch it into a three-part story: start, middle, end.",
      "Ask one curious question to grow their version.",
      "Swap and let them question yours.",
    ],
    durationMin: 9,
  },

  // early-school × motor (was 1)
  {
    id: "paper-toss-challenge",
    title: "Paper-ball target challenge",
    bands: ["early-school"], stages: ["5-7y", "7-9y", "9-12y"],
    domain: "motor",
    skillTags: ["coordination", "gross-motor", "perseverance"],
    householdItems: ["scrap paper", "a bin or bowl"],
    whatItBuilds: "Aim, hand-eye coordination, and sticking with a challenge to beat a score.",
    steps: [
      "Scrunch a few sheets of scrap paper into balls.",
      "Set a bin a few steps away and take turns aiming.",
      "Move back a step each time they sink one.",
      "Track today's best score and try to beat it tomorrow.",
    ],
    durationMin: 10,
  },

  // early-school × cognitive (was 1)
  {
    id: "twenty-questions",
    title: "Twenty questions",
    bands: ["early-school"], stages: ["5-7y", "7-9y", "9-12y"],
    domain: "cognitive",
    skillTags: ["reasoning", "deduction", "focus"],
    householdItems: ["nothing needed"],
    whatItBuilds: "Logical thinking and narrowing-down by asking smart yes/no questions.",
    steps: [
      "Think of an object and tell them the category.",
      "They ask yes/no questions to narrow it down.",
      "Nudge them toward grouping questions, not random guesses.",
      "Swap roles so they get to hold the secret too.",
    ],
    durationMin: 8,
  },

  // early-school × social (was 1)
  {
    id: "high-low-share",
    title: "High and low of the day",
    bands: ["early-school"], stages: ["5-7y", "7-9y", "9-12y"],
    domain: "social",
    skillTags: ["connection", "emotion-naming", "perspective-taking"],
    householdItems: ["nothing needed — works at the dinner table"],
    whatItBuilds: "Naming feelings, listening to others, and the habit of honest connection.",
    steps: [
      "Each share one high and one low from the day.",
      "Listen all the way through before responding.",
      "Ask one gentle follow-up about their low.",
      "End on what each of you is looking forward to.",
    ],
    durationMin: 8,
  },

  // early-school × regulation (was 2 → depth)
  {
    id: "five-senses-reset",
    title: "Five-senses reset",
    bands: ["preschool", "early-school"], stages: ["4-5y", "5-7y", "7-9y"],
    domain: "regulation",
    skillTags: ["self-regulation", "grounding", "big-feelings"],
    householdItems: ["wherever you are"],
    whatItBuilds: "A portable way to come back to calm by anchoring in the senses.",
    steps: [
      "When feelings run high, slow down together.",
      "Name five things you can see, four you can hear.",
      "Then three you can touch, two you can smell, one you can taste.",
      "Notice together how the body feels a little steadier.",
    ],
    durationMin: 6,
  },

  // ── Batch 2: depth across mid-bands ──
  {
    id: "freeze-dance",
    title: "Freeze-dance music game",
    bands: ["toddler", "preschool", "early-school"], stages: ["2-3y", "3-4y", "4-5y", "5-7y"],
    domain: "regulation",
    skillTags: ["self-regulation", "impulse-control", "gross-motor"],
    householdItems: ["any music"],
    whatItBuilds: "The brake pedal — stopping the body on cue, the root of self-control.",
    steps: [
      "Put on a favourite song and dance freely together.",
      "Pause the music — everyone freezes like a statue.",
      "Start it again and wiggle back to life.",
      "Let them be the one who stops the music sometimes.",
    ],
    durationMin: 8,
  },
  {
    id: "obstacle-cushions",
    title: "Cushion obstacle course",
    bands: ["toddler", "preschool"], stages: ["18-24m", "2-3y", "3-4y"],
    domain: "motor",
    skillTags: ["gross-motor", "planning", "coordination"],
    householdItems: ["cushions", "a blanket"],
    whatItBuilds: "Big-muscle coordination and planning a path with the whole body.",
    steps: [
      "Lay cushions as stepping stones across the floor.",
      "Show the path: over, around, under the blanket.",
      "Cheer each crossing and add one new step each round.",
      "Let them design the next course.",
    ],
    durationMin: 12,
  },
  {
    id: "kitchen-helper-pour",
    title: "Pour-and-measure kitchen helper",
    bands: ["preschool", "early-school"], stages: ["3-4y", "4-5y", "5-7y"],
    domain: "cognitive",
    skillTags: ["measuring", "following-directions", "competence"],
    householdItems: ["a cup", "dry rice or water", "two bowls"],
    whatItBuilds: "Counting, measuring, and the pride of doing a careful real-world job.",
    steps: [
      "Give a simple task: 'pour two cups into this bowl.'",
      "Count the pours out loud together.",
      "Let spills happen — they're part of learning the wrist.",
      "Thank them for the specific help.",
    ],
    durationMin: 10,
  },
  {
    id: "feelings-charades",
    title: "Feelings charades",
    bands: ["preschool", "early-school"], stages: ["3-4y", "4-5y", "5-7y"],
    domain: "social",
    skillTags: ["emotion-naming", "perspective-taking", "imitation"],
    householdItems: ["nothing needed"],
    whatItBuilds: "Reading faces and bodies, and naming what others might be feeling.",
    steps: [
      "Take turns acting out a feeling with face and body.",
      "The other guesses: happy, sad, cross, surprised?",
      "Talk about when you each last felt that way.",
      "Keep it warm and silly — no wrong guesses.",
    ],
    durationMin: 8,
  },
  {
    id: "rhyme-time",
    title: "Make-a-rhyme word game",
    bands: ["toddler", "preschool"], stages: ["2-3y", "3-4y", "4-5y"],
    domain: "language",
    skillTags: ["phonics", "vocabulary", "playfulness"],
    householdItems: ["nothing needed"],
    whatItBuilds: "Hearing the sounds inside words — playful groundwork for reading.",
    steps: [
      "Say a simple word like 'cat'.",
      "Take turns adding rhymes — hat, bat, even silly made-up ones.",
      "Laugh at the nonsense words; they still build the skill.",
      "Try a new starter word each round.",
    ],
    durationMin: 6,
  },
  {
    id: "memory-pairs",
    title: "Memory match with cards",
    bands: ["preschool", "early-school"], stages: ["4-5y", "5-7y", "7-9y"],
    domain: "cognitive",
    skillTags: ["memory", "focus", "turn-taking"],
    householdItems: ["a few pairs of matching cards or paper drawings"],
    whatItBuilds: "Working memory and patient focus, plus taking turns gracefully.",
    steps: [
      "Lay a few matching pairs face down in a grid.",
      "Take turns flipping two, hunting for a pair.",
      "Talk through where you remember each card being.",
      "Add more pairs as their memory stretches.",
    ],
    durationMin: 10,
  },
  {
    id: "soft-toy-comfort",
    title: "Comfort the upset teddy",
    bands: ["toddler", "preschool"], stages: ["2-3y", "3-4y"],
    domain: "regulation",
    skillTags: ["emotion-naming", "empathy", "self-regulation"],
    householdItems: ["a soft toy"],
    whatItBuilds: "Naming and soothing big feelings by practising it on a teddy first.",
    steps: [
      "Pretend the teddy is sad or cross.",
      "Ask 'what could help teddy feel better?'",
      "Let them rock, hug, or talk to the teddy.",
      "Notice out loud: 'you helped teddy calm down.'",
    ],
    durationMin: 7,
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
  "swaddle-sway": {
    title: "הרגעת נדנוד ושקט",
    whatItBuilds: "נתיב מוקדם וחוזר מהבכי בחזרה לרוגע — ויסות משותף.",
    steps: [
      "החזיקו אותם צמוד, חזה אל חזה, כשהבכי מתחיל.",
      "נדנדו לאט מצד לצד והוסיפו 'שששש' רך ויציב.",
      "התאימו את הנשימה שלכם לקצב איטי ואחיד.",
      "הישארו עד שהגוף מתרכך — הם שואלים מכם את הרוגע.",
    ],
    householdItems: ["רק הזרועות שלכם", "חדר שקט"],
  },
  "warm-bath-calm": {
    title: "רוגע איטי של מים חמימים",
    whatItBuilds: "טקס הרגעה צפוי שמרגיע את מערכת העצבים לפני השינה.",
    steps: [
      "הכינו אמבט רדוד בחום נעים.",
      "שפכו מים לאט על הגב שלהם, תוך תיאור רך.",
      "השאירו אור עמום וקול שקט.",
      "עטפו אותם ישר למגבת חמה אחר כך.",
    ],
    householdItems: ["אמבט חם או קערה", "מטלית רכה"],
  },
  "drop-and-find": {
    title: "להפיל, להסתכל ולמצוא",
    whatItBuilds: "הרעיון הראשון שדברים עדיין קיימים אחרי שהם נעלמים מהעין.",
    steps: [
      "הושיבו אותם במושב בטוח והציעו צעצוע רך.",
      "כשהם מפילים, אמרו 'אופס, לאן זה הלך?'",
      "הרימו לאט כדי שיעקבו לאן זה הלך.",
      "החזירו ותנו למעגל השמח לחזור.",
    ],
    householdItems: ["צעצוע רך", "מגש או כיסא אוכל"],
  },
  "texture-tray": {
    title: "מגש מרקמים למישוש ולשים לב",
    whatItBuilds: "קשב ממוקד ומיון מוקדם של 'אלה מרגישים שונה' בעולם.",
    steps: [
      "הניחו פריט חלק ופריט מחוספס ובטוחים על מגש.",
      "הובילו את ידם לכל אחד וקראו בשם: 'רך… מחוספס.'",
      "עצרו ותנו להם לחקור בקצב שלהם.",
      "שימו לב איזה מהם מחזיק את הקשב שלהם יותר.",
    ],
    householdItems: ["מגש", "שני פריטים בטוחים עם מרקמים שונים"],
  },
  "sing-the-routine": {
    title: "לשיר את שגרת היום",
    whatItBuilds: "המנגינה והקצב של השפה, הרבה לפני המילים הראשונות.",
    steps: [
      "בחרו רגע יומי אחד — החלפת חיתול או התלבשות.",
      "שירו את מה שאתם עושים לכל לחן פשוט.",
      "השתמשו באותו שיר קטן בכל פעם כדי שיהיה מוכר.",
      "עצרו וחייכו, השאירו מקום לגעגוע בחזרה.",
    ],
    householdItems: ["רק הקול שלכם"],
  },
  "copy-the-coo": {
    title: "שיחת חיקוי גרגורים",
    whatItBuilds: "פעימת הלב של תורות בשיחה, באמצעות צלילים ולא מילים.",
    steps: [
      "התמקמו פנים אל פנים וחכו לגרגור או מלמול.",
      "חזרו על הצליל המדויק שלהם, בחום.",
      "עצרו ותנו להם תור לענות.",
      "הוסיפו צליל רך חדש אחד וראו אם ינסו אותו.",
    ],
    householdItems: ["רק אתם, פנים אל פנים"],
  },
  "tummy-time-reach": {
    title: "הושטת יד בזמן שכיבה על הבטן",
    whatItBuilds: "חוזק צוואר, גב וזרועות — הבסיס לישיבה ולזחילה.",
    steps: [
      "השכיבו אותם על הבטן על משטח רך ובטוח.",
      "רדו לגובה שלהם, פנים אל פנים, ושוחחו.",
      "הניחו צעצוע מעט מחוץ להישג יד כדי להזמין מתיחה.",
      "שמרו על זמן קצר ושמח; הפסיקו לפני שזה מאבק.",
    ],
    householdItems: ["שטיחון רך", "צעצוע אהוב"],
  },
  "shape-posting": {
    title: "משחק הכנסה דרך מכל",
    whatItBuilds: "התאמת גודל וצורה לחור — פתרון בעיות מוקדם עם הידיים.",
    steps: [
      "חתכו חריץ בטוח לידיים במכסה של מכל נקי.",
      "הראו להם להכניס חפץ אחד דרך החריץ.",
      "הריעו ל'בלופ' ושפכו את הכל החוצה כדי להתחיל שוב.",
      "תנו להם לפתור את הזווית בעצמם — התאפקו מלעזור מהר מדי.",
    ],
    householdItems: ["מכל עם מכסה", "חפצים בטוחים שנכנסים בחריץ חתוך"],
  },
  "tape-line-walk": {
    title: "ללכת על חבל מתוח של נייר דבק",
    whatItBuilds: "שיווי משקל ושליטה בגוף דרך הליכת 'לא ליפול ללבה' משחקית.",
    steps: [
      "הדביקו קו ישר של נייר דבק לאורך הרצפה.",
      "לכו עליו עקב-אצבע יחד, ידיים פרושות כמו כנפיים.",
      "נסו לאחור, ואז על קצות האצבעות.",
      "הוסיפו משחק 'מתנדנד ומתאושש' לתרגול שיווי המשקל.",
    ],
    householdItems: ["רצועת נייר דבק על הרצפה"],
  },
  "what-comes-next": {
    title: "משחק 'מה בא אחר כך' של דפוסים",
    whatItBuilds: "זיהוי וניבוי דפוסים — בסיס לחשבון ולחשיבה.",
    steps: [
      "הניחו דפוס פשוט: כף, מזלג, כף, מזלג…",
      "שאלו 'מה בא אחר כך?' ותנו להם להניח.",
      "הארכו את הדפוס מעט בכל סיבוב.",
      "תנו להם להמציא דפוס שאתם תשלימו.",
    ],
    householdItems: ["חפצים קטנים משני סוגים (כפות ומזלגות, מטבעות, קוביות)"],
  },
  "i-spy-sounds": {
    title: "'אני רואה' עם צליל ראשון",
    whatItBuilds: "שמיעת הצליל הראשון במילים — צעד מוקדם לקראת קריאה.",
    steps: [
      "אמרו 'אני רואה משהו שמתחיל ב‑מממ…'",
      "תנו להם לנחש ולחפש בחדר.",
      "מתחו את הצליל יחד כשהם מוצאים.",
      "החליפו תפקידים ותנו להם להציב את הרמז הבא.",
    ],
    householdItems: ["מה שיש בחדר"],
  },
  "two-truths-tale": {
    title: "סיפור משני דברים אמיתיים",
    whatItBuilds: "משפטים ארוכים יותר, רצף, והביטחון לספר סיפור בקול.",
    steps: [
      "כל אחד משתף שני דברים אמיתיים שקרו היום.",
      "בחרו אחד ומתחו אותו לסיפור בן שלושה חלקים: התחלה, אמצע, סוף.",
      "שאלו שאלה סקרנית אחת כדי להצמיח את הגרסה שלהם.",
      "החליפו ותנו להם לשאול על שלכם.",
    ],
    householdItems: ["לא צריך כלום"],
  },
  "paper-toss-challenge": {
    title: "אתגר קליעת כדורי נייר",
    whatItBuilds: "כיוון, תיאום עין-יד, והתמדה באתגר כדי לשבור שיא.",
    steps: [
      "כדררו כמה דפי טיוטה לכדורים.",
      "הציבו פח כמה צעדים משם וכוונו בתורות.",
      "התרחקו צעד בכל פעם שקולעים.",
      "עקבו אחרי השיא של היום ונסו לשבור אותו מחר.",
    ],
    householdItems: ["דפי טיוטה", "פח או קערה"],
  },
  "twenty-questions": {
    title: "עשרים שאלות",
    whatItBuilds: "חשיבה לוגית וצמצום אפשרויות דרך שאלות חכמות של כן/לא.",
    steps: [
      "חשבו על חפץ וספרו להם את הקטגוריה.",
      "הם שואלים שאלות כן/לא כדי לצמצם.",
      "כוונו אותם לשאלות מקבצות, לא לניחושים אקראיים.",
      "החליפו תפקידים כדי שגם הם יחזיקו את הסוד.",
    ],
    householdItems: ["לא צריך כלום"],
  },
  "high-low-share": {
    title: "השיא והשפל של היום",
    whatItBuilds: "מתן שם לרגשות, הקשבה לאחרים, והרגל של חיבור כן.",
    steps: [
      "כל אחד משתף שיא אחד ושפל אחד מהיום.",
      "הקשיבו עד הסוף לפני שמגיבים.",
      "שאלו שאלת המשך עדינה על השפל שלהם.",
      "סיימו במה שכל אחד מצפה לו.",
    ],
    householdItems: ["לא צריך כלום — עובד ליד שולחן האוכל"],
  },
  "five-senses-reset": {
    title: "איפוס חמשת החושים",
    whatItBuilds: "דרך ניידת לחזור לרוגע דרך עיגון בחושים.",
    steps: [
      "כשהרגשות עולים, האטו יחד.",
      "מנו חמישה דברים שאפשר לראות, ארבעה לשמוע.",
      "ואז שלושה למישוש, שניים להריח, אחד לטעום.",
      "שימו לב יחד איך הגוף מרגיש קצת יותר יציב.",
    ],
    householdItems: ["איפה שאתם נמצאים"],
  },
  "freeze-dance": {
    title: "משחק ריקוד הקפאה",
    whatItBuilds: "דוושת הבלם — לעצור את הגוף לפי אות, השורש של שליטה עצמית.",
    steps: [
      "שימו שיר אהוב ורקדו יחד בחופשיות.",
      "עצרו את המוזיקה — כולם קופאים כמו פסל.",
      "הפעילו שוב והתנועעו בחזרה לחיים.",
      "תנו להם להיות מי שעוצר את המוזיקה לפעמים.",
    ],
    householdItems: ["כל מוזיקה"],
  },
  "obstacle-cushions": {
    title: "מסלול מכשולים מכריות",
    whatItBuilds: "תיאום שרירים גדולים ותכנון מסלול עם כל הגוף.",
    steps: [
      "הניחו כריות כאבני דריכה לרוחב הרצפה.",
      "הראו את המסלול: מעל, מסביב, מתחת לשמיכה.",
      "הריעו לכל מעבר והוסיפו שלב חדש בכל סיבוב.",
      "תנו להם לתכנן את המסלול הבא.",
    ],
    householdItems: ["כריות", "שמיכה"],
  },
  "kitchen-helper-pour": {
    title: "עוזר מטבח של מזיגה ומדידה",
    whatItBuilds: "ספירה, מדידה, והגאווה של ביצוע עבודה אמיתית בזהירות.",
    steps: [
      "תנו משימה פשוטה: 'מזוג שתי כוסות לקערה הזו.'",
      "ספרו את המזיגות בקול יחד.",
      "תנו לשפיכות לקרות — הן חלק מלימוד שליטת היד.",
      "הודו להם על העזרה הספציפית.",
    ],
    householdItems: ["כוס", "אורז יבש או מים", "שתי קערות"],
  },
  "feelings-charades": {
    title: "פנטומימה של רגשות",
    whatItBuilds: "קריאת פרצופים וגוף, ומתן שם למה שאחרים אולי מרגישים.",
    steps: [
      "בתורות, גלמו רגש עם הפנים והגוף.",
      "השני מנחש: שמח, עצוב, כועס, מופתע?",
      "דברו על מתי כל אחד הרגיש כך לאחרונה.",
      "שמרו על חום ושטות — אין ניחושים שגויים.",
    ],
    householdItems: ["לא צריך כלום"],
  },
  "rhyme-time": {
    title: "משחק מילים של חריזה",
    whatItBuilds: "שמיעת הצלילים שבתוך מילים — הכנה משחקית לקריאה.",
    steps: [
      "אמרו מילה פשוטה כמו 'גל'.",
      "בתורות הוסיפו חרוזים — תל, חל, ואפילו מומצאים מצחיקים.",
      "צחקו ממילות השטות; הן עדיין בונות את המיומנות.",
      "נסו מילת פתיחה חדשה בכל סיבוב.",
    ],
    householdItems: ["לא צריך כלום"],
  },
  "memory-pairs": {
    title: "משחק זיכרון של זוגות קלפים",
    whatItBuilds: "זיכרון עבודה וקשב סבלני, יחד עם לקיחת תורות בחן.",
    steps: [
      "הניחו כמה זוגות תואמים הפוכים ברשת.",
      "בתורות הפכו שניים, בחיפוש אחר זוג.",
      "דברו בקול על איפה אתם זוכרים שכל קלף היה.",
      "הוסיפו עוד זוגות ככל שהזיכרון שלהם נמתח.",
    ],
    householdItems: ["כמה זוגות קלפים תואמים או ציורי נייר"],
  },
  "soft-toy-comfort": {
    title: "לנחם את הדובי העצוב",
    whatItBuilds: "מתן שם והרגעה של רגשות גדולים דרך תרגול על דובי קודם.",
    steps: [
      "העמידו פנים שהדובי עצוב או כועס.",
      "שאלו 'מה יכול לעזור לדובי להרגיש טוב יותר?'",
      "תנו להם לנדנד, לחבק, או לדבר עם הדובי.",
      "שימו לב בקול: 'עזרת לדובי להירגע.'",
    ],
    householdItems: ["בובה רכה"],
  },
};

/** Parent-facing label for each developmental domain — used to name the
 *  "because…" driver on the Daily Play card ("settling big feelings"). */
export const PLAY_DOMAIN_LABEL: Record<PlayDomain, { en: string; he: string }> = {
  regulation: { en: "settling big feelings", he: "להירגע מרגשות גדולים" },
  language: { en: "talking and words", he: "דיבור ומילים" },
  motor: { en: "moving and coordination", he: "תנועה ותיאום" },
  cognitive: { en: "focus and problem-solving", he: "ריכוז ופתרון בעיות" },
  social: { en: "playing with others", he: "משחק עם אחרים" },
};

/** The localized domain label for the current UI language. */
export function playDomainLabel(domain: PlayDomain, lang: "en" | "he"): string {
  return PLAY_DOMAIN_LABEL[domain][lang === "he" ? "he" : "en"];
}

/** Return the activity with Hebrew content swapped in when lang is "he" and a
 *  translation exists; otherwise the canonical English activity unchanged. */
export function localizeActivity(activity: PlayActivity, lang: "en" | "he"): PlayActivity {
  if (lang !== "he") return activity;
  const he = PLAY_ACTIVITIES_HE[activity.id];
  if (!he) return activity;
  return { ...activity, title: he.title, whatItBuilds: he.whatItBuilds, steps: he.steps, householdItems: he.householdItems };
}
