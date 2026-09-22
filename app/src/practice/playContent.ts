/* Content banks for the ten-epics gap modules: Feelings Lab (Epic 7),
   Words & Express modes (Epic 3), Memory Match (Epic 8).
   Curated and deterministic — every module is sandbox-safe. */

/* ---------------- Feelings Lab ---------------- */

export interface Emotion {
  id: string;
  label: string;
  emoji: string;
  color: string;
  /** Why this feeling happens — the "emotional understanding" card. */
  why: string;
  /** What it can look like in the body (recognition cue). */
  looksLike: string;
  /** What usually helps (consequence/strategy). */
  helps: string;
}

export const EMOTIONS: Emotion[] = [
  { id: "happy", label: "Happy", emoji: "😄", color: "#a9780f", why: "Happy comes when something good happens — playing, hugging, getting something we hoped for.", looksLike: "Big smile, sparkly eyes, bouncy body.", helps: "Share it! Telling someone doubles the happy." },
  { id: "sad", label: "Sad", emoji: "😢", color: "#2f7bbf", why: "Sad comes when we lose something or miss someone we care about.", looksLike: "Droopy face, tears, quiet voice, wanting a hug.", helps: "A hug, a cuddle, and naming it: 'I feel sad.'" },
  { id: "angry", label: "Angry", emoji: "😠", color: "#bd4f74", why: "Angry comes when something feels unfair or someone blocks what we want.", looksLike: "Hot face, tight fists, loud voice, stompy feet.", helps: "Big dragon breaths and stomping it out — anger needs to MOVE." },
  { id: "frustrated", label: "Frustrated", emoji: "😤", why: "Frustrated comes when we try and try and it still doesn't work.", color: "#cf6f37", looksLike: "Groaning, throwing the toy, saying 'I can't!'", helps: "A break, a breath, and trying one smaller piece of the hard thing." },
  { id: "afraid", label: "Afraid", emoji: "😨", color: "#6354c4", why: "Afraid comes when something seems dangerous or unknown — even if it isn't.", looksLike: "Wide eyes, hiding, holding on tight, fast heart.", helps: "Staying close to a safe grown-up and looking at the scary thing together, slowly." },
  { id: "excited", label: "Excited", emoji: "🤩", color: "#1f8a5a", why: "Excited comes when something wonderful is about to happen and the waiting is fizzy.", looksLike: "Jumping, fast talking, can't sit still.", helps: "Wiggle it out! And counting down makes the waiting easier." },
];

/** Scenario → feeling rounds: the child picks how the character feels. */
export interface EmotionScenario {
  id: string;
  text: string;
  textHe: string;
  emoji: string;
  /** Authored character feeling, retained for existing consumers and analytics compatibility. */
  answer: string;
  /** Other offered emotion IDs. The recognition game has one named answer. */
  distractors: [string, string];
  /** Hebrew label for the same named answer in `textHe`. */
  answerLabelHe: string;
}

export const EMOTION_SCENARIOS: EmotionScenario[] = [
  { id: "tower-fell", emoji: "🧱", text: "Maya says, 'I feel angry when my tower is knocked down.' Which feeling did Maya name?", textHe: "מאיה אומרת: 'אני מרגישה כעס כשהמגדל שלי נופל.' איזה רגש מאיה אמרה?", answer: "angry", answerLabelHe: "כעס", distractors: ["sad", "frustrated"] },
  { id: "dog-moved", emoji: "🐕", text: "Tom says, 'I feel sad because my friend and their dog moved far away.' Which feeling did Tom name?", textHe: "טום אומר: 'אני מרגיש עצב כי החבר שלי והכלב עברו רחוק.' איזה רגש טום אמר?", answer: "sad", answerLabelHe: "עצב", distractors: ["afraid", "excited"] },
  { id: "birthday-soon", emoji: "🎂", text: "Lily says, 'I feel excited because my birthday party is tomorrow.' Which feeling did Lily name?", textHe: "לילי אומרת: 'אני מרגישה התרגשות כי מסיבת יום ההולדת שלי מחר.' איזה רגש לילי אמרה?", answer: "excited", answerLabelHe: "התרגשות", distractors: ["happy", "afraid"] },
  { id: "dark-room", emoji: "🌙", text: "Sam says, 'I feel afraid after hearing a strange sound in the dark room.' Which feeling did Sam name?", textHe: "סם אומר: 'אני מרגיש פחד אחרי ששמעתי צליל מוזר בחדר חשוך.' איזה רגש סם אמר?", answer: "afraid", answerLabelHe: "פחד", distractors: ["sad", "frustrated"] },
  { id: "zipper-stuck", emoji: "🧥", text: "Noa says, 'I feel frustrated because my jacket zipper keeps getting stuck.' Which feeling did Noa name?", textHe: "נועה אומרת: 'אני מרגישה תסכול כי הרוכסן במעיל שלי נתקע שוב ושוב.' איזה רגש נועה אמרה?", answer: "frustrated", answerLabelHe: "תסכול", distractors: ["angry", "sad"] },
  { id: "grandma-visit", emoji: "🍪", text: "Ben says, 'I feel happy when Grandma visits with my favorite cookies.' Which feeling did Ben name?", textHe: "בן אומר: 'אני מרגיש שמחה כשסבתא באה עם העוגיות האהובות עליי.' איזה רגש בן אמר?", answer: "happy", answerLabelHe: "שמחה", distractors: ["excited", "sad"] },
  { id: "turn-skipped", emoji: "🎲", text: "Dana says, 'I feel angry after my turn on the slide is skipped.' Which feeling did Dana name?", textHe: "דנה אומרת: 'אני מרגישה כעס אחרי שדילגו על התור שלי במגלשה.' איזה רגש דנה אמרה?", answer: "angry", answerLabelHe: "כעס", distractors: ["frustrated", "sad"] },
  { id: "new-school", emoji: "🏫", text: "Omar says, 'I feel afraid on my first day at a new school.' Which feeling did Omar name?", textHe: "עומר אומר: 'אני מרגיש פחד ביום הראשון שלי בבית ספר חדש.' איזה רגש עומר אמר?", answer: "afraid", answerLabelHe: "פחד", distractors: ["excited", "sad"] },
  { id: "building-interrupted", emoji: "🧩", text: "Rin says, 'I feel sad when it is time to put away my building project.' Which feeling did Rin name?", textHe: "רין אומר: 'אני מרגיש עצב כשמגיע הזמן לאסוף את פרויקט הבנייה שלי.' איזה רגש רין אמר?", answer: "sad", answerLabelHe: "עצב", distractors: ["frustrated", "angry"] },
  { id: "waiting-turn", emoji: "🛝", text: "Eli says, 'I feel frustrated while I wait for a turn on the swing.' Which feeling did Eli name?", textHe: "אלי אומר: 'אני מרגיש תסכול בזמן שאני מחכה לתור בנדנדה.' איזה רגש אלי אמר?", answer: "frustrated", answerLabelHe: "תסכול", distractors: ["excited", "angry"] },
  { id: "joining-play", emoji: "⚽", text: "Ari says, 'I feel afraid about asking to join a game already in progress.' Which feeling did Ari name?", textHe: "ארי אומר: 'אני מרגיש פחד לפני שאני מבקש להצטרף למשחק שכבר התחיל.' איזה רגש ארי אמר?", answer: "afraid", answerLabelHe: "פחד", distractors: ["excited", "sad"] },
  { id: "surprising-sound", emoji: "🎈", text: "Jo says, 'I feel afraid when a balloon pops nearby.' Which feeling did Jo name?", textHe: "ג׳ו אומר: 'אני מרגיש פחד כשבלון מתפוצץ בקרבת מקום.' איזה רגש ג׳ו אמר?", answer: "afraid", answerLabelHe: "פחד", distractors: ["excited", "frustrated"] },
  { id: "trying-again", emoji: "🛩️", text: "Kai says, 'I feel frustrated when my paper airplane keeps falling, then I try a new fold.' Which feeling did Kai name?", textHe: "קאי אומר: 'אני מרגיש תסכול כשמטוס הנייר שלי נופל שוב ושוב, ואז אני מנסה קיפול חדש.' איזה רגש קאי אמר?", answer: "frustrated", answerLabelHe: "תסכול", distractors: ["sad", "excited"] },
  { id: "welcome", emoji: "👋", text: "Tali says, 'I feel happy when new neighbors say welcome and invite a wave.' Which feeling did Tali name?", textHe: "טלי אומרת: 'אני מרגישה שמחה כששכנים חדשים אומרים ברוכים הבאים ומזמינים לנופף.' איזה רגש טלי אמרה?", answer: "happy", answerLabelHe: "שמחה", distractors: ["excited", "afraid"] },
];

/** Guided breathing patterns for the calm-down practice. */
export interface BreathingPattern {
  id: string;
  title: string;
  emoji: string;
  inhale: number;   // seconds
  hold: number;
  exhale: number;
  rounds: number;
  script: string;
}

export const BREATHING_PATTERNS: BreathingPattern[] = [
  { id: "flower-candle", title: "Flower & Candle", emoji: "🌸", inhale: 3, hold: 1, exhale: 4, rounds: 4, script: "Smell the flower… now slowly blow out the candle." },
  { id: "dragon", title: "Dragon Breaths", emoji: "🐉", inhale: 3, hold: 2, exhale: 5, rounds: 3, script: "Fill your dragon belly… now breathe out the fire, long and slow." },
  { id: "starfish", title: "Starfish Trace", emoji: "⭐", inhale: 4, hold: 1, exhale: 4, rounds: 5, script: "Trace one finger up — breathe in. Trace it down — breathe out." },
];

/** Calm-down toolkit cards (beyond breathing). */
export const CALM_TOOLS: { id: string; emoji: string; title: string; how: string }[] = [
  { id: "squeeze", emoji: "🍋", title: "Lemon squeeze", how: "Squeeze your fists like squishing lemons… hold… and let go floppy. Three times." },
  { id: "turtle", emoji: "🐢", title: "Turtle shell", how: "Curl up small like a turtle in its shell, count 5 slow breaths, then peek out." },
  { id: "push-wall", emoji: "🧱", title: "Push the wall", how: "Push the wall as hard as you can for 10 seconds — big feelings need big muscles." },
  { id: "five-senses", emoji: "👀", title: "5-4-3-2-1", how: "Find 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste." },
];

/* ---------------- Words & Express modes (Speech Coach) ---------------- */

export interface VocabSet {
  id: string;
  category: string;
  emoji: string;
  items: { emoji: string; word: string }[];
}

export const VOCAB_SETS: VocabSet[] = [
  { id: "animals", category: "Animals", emoji: "🦁", items: [
    { emoji: "🐘", word: "elephant" }, { emoji: "🦒", word: "giraffe" }, { emoji: "🐧", word: "penguin" },
    { emoji: "🦋", word: "butterfly" }, { emoji: "🐢", word: "turtle" }, { emoji: "🦉", word: "owl" },
  ]},
  { id: "food", category: "Food", emoji: "🍎", items: [
    { emoji: "🍓", word: "strawberry" }, { emoji: "🥦", word: "broccoli" }, { emoji: "🧀", word: "cheese" },
    { emoji: "🥨", word: "pretzel" }, { emoji: "🍉", word: "watermelon" }, { emoji: "🥕", word: "carrot" },
  ]},
  { id: "home", category: "Around the house", emoji: "🏠", items: [
    { emoji: "🪜", word: "ladder" }, { emoji: "🧹", word: "broom" }, { emoji: "🔦", word: "flashlight" },
    { emoji: "🧺", word: "basket" }, { emoji: "⏰", word: "alarm clock" }, { emoji: "🪞", word: "mirror" },
  ]},
  { id: "vehicles", category: "Things that go", emoji: "🚀", items: [
    { emoji: "🚜", word: "tractor" }, { emoji: "🚁", word: "helicopter" }, { emoji: "⛵", word: "sailboat" },
    { emoji: "🚂", word: "train" }, { emoji: "🛴", word: "scooter" }, { emoji: "🚒", word: "fire truck" },
  ]},
];

/** Category rounds: "which one belongs?" — builds categorization, not just labels. */
export interface CategoryRound {
  id: string;
  question: string;
  options: { emoji: string; word: string; correct: boolean }[];
}

export const CATEGORY_ROUNDS: CategoryRound[] = [
  { id: "cat-fruit", question: "Which one is a fruit?", options: [
    { emoji: "🍌", word: "banana", correct: true }, { emoji: "🚗", word: "car", correct: false }, { emoji: "🧦", word: "sock", correct: false } ]},
  { id: "cat-animal", question: "Which one is an animal?", options: [
    { emoji: "🪑", word: "chair", correct: false }, { emoji: "🐸", word: "frog", correct: true }, { emoji: "🍕", word: "pizza", correct: false } ]},
  { id: "cat-wear", question: "Which one do you wear?", options: [
    { emoji: "🥾", word: "boots", correct: true }, { emoji: "🌳", word: "tree", correct: false }, { emoji: "🥄", word: "spoon", correct: false } ]},
  { id: "cat-cold", question: "Which one is cold?", options: [
    { emoji: "🔥", word: "fire", correct: false }, { emoji: "🍦", word: "ice cream", correct: true }, { emoji: "☀️", word: "sun", correct: false } ]},
  { id: "cat-fly", question: "Which one can fly?", options: [
    { emoji: "🐠", word: "fish", correct: false }, { emoji: "🦅", word: "eagle", correct: true }, { emoji: "🐌", word: "snail", correct: false } ]},
  { id: "cat-kitchen", question: "Which one belongs in the kitchen?", options: [
    { emoji: "🍳", word: "frying pan", correct: true }, { emoji: "🛏️", word: "bed", correct: false }, { emoji: "⚽", word: "ball", correct: false } ]},
];

/** Express mode: open-ended prompts. No right answers — effort is the win. */
export interface ExpressPrompt {
  id: string;
  kind: "question" | "scene" | "story-starter";
  emoji: string;
  prompt: string;          // {name} templated
  parentTip: string;
}

export const EXPRESS_PROMPTS: ExpressPrompt[] = [
  { id: "q-superpower", kind: "question", emoji: "🦸", prompt: "If you had one superpower for a whole day, what would you do with it?", parentTip: "Wait 5 full seconds after asking. Then ask one 'and then what?'" },
  { id: "q-animal-talk", kind: "question", emoji: "🐾", prompt: "If your pet (or a cat) could talk, what would it complain about?", parentTip: "Silly answers are perfect — expand them: 'The cat hates Mondays? Why?'" },
  { id: "q-best-part", kind: "question", emoji: "🌟", prompt: "What was the best part and the trickiest part of your day?", parentTip: "Answer it yourself first — modeling beats prompting." },
  { id: "scene-park", kind: "scene", emoji: "🎡", prompt: "🌳🎡🍦 A park with a ferris wheel and an ice-cream cart. Tell me everything happening in this place.", parentTip: "Prompt for detail: who is there? what do you hear? what happens next?" },
  { id: "scene-space", kind: "scene", emoji: "🪐", prompt: "🚀👩‍🚀🪐 A rocket, an astronaut, and a ringed planet. Describe this adventure.", parentTip: "Ask 'why' once: why did she fly there?" },
  { id: "scene-beach", kind: "scene", emoji: "🏖️", prompt: "🏖️🦀⛱️ A beach with a crab under an umbrella. What's the story here?", parentTip: "If they give one word, repeat it inside a full sentence and pause." },
  { id: "story-door", kind: "story-starter", emoji: "🚪", prompt: "Once there was a tiny door behind the bookshelf that nobody had ever noticed, until one day…", parentTip: "Take turns: one sentence each. You go second." },
  { id: "story-shrunk", kind: "story-starter", emoji: "🔍", prompt: "One morning I woke up as small as a spoon, and the first thing I saw was…", parentTip: "Keep your sentences shorter than theirs — leave the room to them." },
  { id: "story-dragon", kind: "story-starter", emoji: "🐲", prompt: "The dragon knocked on our door and asked, very politely, to borrow…", parentTip: "Accept ANY direction the story goes. Coherence comes later; flow comes first." },
];

/* ---------------- Memory Match (Epic 8) ---------------- */

export interface MemoryTheme {
  id: string;
  title: string;
  titleHe: string;
  emojis: string[];
}

export const MEMORY_THEMES: MemoryTheme[] = [
  { id: "animals", title: "Animals", titleHe: "חיות", emojis: ["🐶", "🐱", "🦊", "🐼", "🦁", "🐸", "🐧", "🦋"] },
  { id: "food", title: "Yummy things", titleHe: "דברים טעימים", emojis: ["🍎", "🍌", "🍪", "🍕", "🍓", "🧁", "🥑", "🍉"] },
  { id: "space", title: "Space", titleHe: "חלל", emojis: ["🚀", "🪐", "⭐", "🌙", "☄️", "👩‍🚀", "🛸", "🌍"] },
  { id: "garden", title: "Garden", titleHe: "גינה", emojis: ["🌻", "🌷", "🐞", "🐝", "🪴", "🌿", "🦔", "🍄"] },
  { id: "ocean", title: "Ocean", titleHe: "אוקיינוס", emojis: ["🐳", "🐙", "🦀", "🐠", "🪸", "🐚", "🦭", "🌊"] },
];

/** Backward-compatible name used by the existing matching-board consumer. */
export const MEMORY_EMOJI_SETS = MEMORY_THEMES;
