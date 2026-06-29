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
  text: string;            // {name} templated
  emoji: string;
  answer: string;          // emotion id
  distractors: [string, string];
}

export const EMOTION_SCENARIOS: EmotionScenario[] = [
  { id: "tower-fell", emoji: "🧱", text: "Maya built a tall tower and her little brother knocked it down. How does Maya feel?", answer: "angry", distractors: ["happy", "excited"] },
  { id: "dog-moved", emoji: "🐕", text: "Tom's best friend moved far away with his dog. How does Tom feel?", answer: "sad", distractors: ["excited", "angry"] },
  { id: "birthday-soon", emoji: "🎂", text: "Tomorrow is Lily's birthday party with a bouncy castle! How does Lily feel tonight?", answer: "excited", distractors: ["sad", "afraid"] },
  { id: "dark-room", emoji: "🌙", text: "Sam hears a strange noise in his dark room at night. How does Sam feel?", answer: "afraid", distractors: ["happy", "frustrated"] },
  { id: "zipper-stuck", emoji: "🧥", text: "Noa tries to zip her jacket five times and it keeps getting stuck. How does Noa feel?", answer: "frustrated", distractors: ["excited", "sad"] },
  { id: "grandma-visit", emoji: "👵", text: "Grandma surprised Ben with a visit and his favorite cookies. How does Ben feel?", answer: "happy", distractors: ["afraid", "angry"] },
  { id: "turn-skipped", emoji: "🎲", text: "Everyone got a turn on the slide except Dana — they skipped her. How does Dana feel?", answer: "angry", distractors: ["happy", "excited"] },
  { id: "new-school", emoji: "🏫", text: "It's Omar's first day at a brand-new school where he knows nobody. How does Omar feel?", answer: "afraid", distractors: ["angry", "happy"] },
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

export const MEMORY_EMOJI_SETS: { id: string; title: string; emojis: string[] }[] = [
  { id: "animals", title: "Animals", emojis: ["🐶", "🐱", "🦊", "🐼", "🦁", "🐸", "🐧", "🦋"] },
  { id: "food", title: "Yummy things", emojis: ["🍎", "🍌", "🍪", "🍕", "🍓", "🧁", "🥑", "🍉"] },
  { id: "space", title: "Space", emojis: ["🚀", "🪐", "⭐", "🌙", "☄️", "👩‍🚀", "🛸", "🌍"] },
];
