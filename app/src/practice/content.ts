import type { AdventureSkill, PracticeDomain } from "../types";

/* Practice Studio content banks (Fall release).
   Curated, deterministic, sandbox-safe: every module works with no API key.
   Age guidance follows typical English acquisition norms (McLeod & Crowe 2018
   cross-linguistic review) and is always framed as "typical range", never as
   a diagnostic threshold. */

/* ---------------- Module A · Speech Coach (Articulation Station port) ---------------- */

export interface SoundEntry {
  id: string;            // display sound, e.g. "s"
  label: string;         // "S as in Sun"
  ipa: string;
  typicalAge: string;    // typical acquisition range, e.g. "by 3–4"
  band: "early" | "middle" | "late";
  cue: string;           // how a parent models the sound
  words: string[];
  sentences: string[];
  storyPrompt: string;   // story-level practice prompt for parent+child
}

export const SOUND_LIBRARY: SoundEntry[] = [
  // Early sounds (typically by ~2–3)
  { id: "p", label: "P as in Pig", ipa: "/p/", typicalAge: "by 2–3", band: "early", cue: "Lips together, then a little puff of air — like blowing out a tiny candle.", words: ["pig", "pan", "pop", "puppy", "apple", "cup"], sentences: ["The pig has a purple cup.", "Pop the puppy's bubbles."], storyPrompt: "Tell a story about a puppy who finds a pot of popcorn." },
  { id: "b", label: "B as in Ball", ipa: "/b/", typicalAge: "by 2–3", band: "early", cue: "Lips together and switch your voice on — feel the buzz on your lips.", words: ["ball", "bear", "bus", "baby", "bubble", "web"], sentences: ["The bear bounces a big ball.", "The baby blows bubbles on the bus."], storyPrompt: "Tell a story about a bear who loses his blue ball." },
  { id: "m", label: "M as in Moon", ipa: "/m/", typicalAge: "by 2–3", band: "early", cue: "Lips closed, hum through your nose — mmm like something yummy.", words: ["moon", "mama", "milk", "mouse", "hammer", "drum"], sentences: ["The mouse drinks warm milk.", "Mama hums to the moon."], storyPrompt: "Tell a story about a mouse who wants to touch the moon." },
  { id: "n", label: "N as in Nose", ipa: "/n/", typicalAge: "by 2–3", band: "early", cue: "Tongue tip up behind your teeth, hum through your nose.", words: ["nose", "net", "nine", "banana", "bunny", "sun"], sentences: ["Nine bunnies eat one banana.", "The sun shines on my nose."], storyPrompt: "Tell a story about a bunny with a very nosy nose." },
  { id: "h", label: "H as in Hat", ipa: "/h/", typicalAge: "by 2–3", band: "early", cue: "Just breathe out softly — like fogging up a window.", words: ["hat", "house", "horse", "hand", "hello", "hop"], sentences: ["The horse hops to the house.", "Say hello with your hand."], storyPrompt: "Tell a story about a horse who wears a huge hat." },
  { id: "w", label: "W as in Water", ipa: "/w/", typicalAge: "by 2–3", band: "early", cue: "Round your lips like a little kiss, then open — wuh.", words: ["water", "wave", "worm", "window", "wagon", "cow"], sentences: ["The worm waves from the wagon.", "Wash the window with water."], storyPrompt: "Tell a story about a worm who rides a wagon in the rain." },
  { id: "d", label: "D as in Dog", ipa: "/d/", typicalAge: "by 2–3", band: "early", cue: "Tongue tip taps behind your top teeth with your voice on.", words: ["dog", "duck", "door", "daddy", "ladder", "bed"], sentences: ["The dog digs by the door.", "The duck naps on daddy's bed."], storyPrompt: "Tell a story about a dog and a duck who share a bed." },
  { id: "t", label: "T as in Top", ipa: "/t/", typicalAge: "by 2–3", band: "early", cue: "Tongue tip taps behind your top teeth — a quiet tick.", words: ["top", "toe", "two", "turtle", "button", "cat"], sentences: ["Two turtles tap their toes.", "The cat sits on top."], storyPrompt: "Tell a story about a turtle who is always late." },
  // Middle sounds (typically by ~3–5)
  { id: "k", label: "K as in Kite", ipa: "/k/", typicalAge: "by 3–4", band: "middle", cue: "Back of the tongue pops up at the back of your mouth — like a tiny cough.", words: ["kite", "key", "car", "cookie", "monkey", "book"], sentences: ["The monkey keeps a cookie in the car.", "My key can fly like a kite."], storyPrompt: "Tell a story about a monkey who bakes cookies." },
  { id: "g", label: "G as in Go", ipa: "/g/", typicalAge: "by 3–4", band: "middle", cue: "Same back-of-tongue pop, but switch your voice on — guh.", words: ["go", "goat", "game", "girl", "wagon", "frog"], sentences: ["The goat plays a game in the garden.", "Go get the green frog."], storyPrompt: "Tell a story about a goat who wins every game." },
  { id: "f", label: "F as in Fish", ipa: "/f/", typicalAge: "by 3–4", band: "middle", cue: "Top teeth gently on your bottom lip, blow soft air — ffff.", words: ["fish", "fan", "foot", "phone", "muffin", "leaf"], sentences: ["The fish fans a fluffy muffin.", "Four feet, one leaf."], storyPrompt: "Tell a story about a fish who answers the phone." },
  { id: "y", label: "Y as in Yes", ipa: "/j/", typicalAge: "by 3–4", band: "middle", cue: "Smile, tongue ready, then glide — yuh like the start of 'you'.", words: ["yes", "you", "yellow", "yo-yo", "yummy", "yard"], sentences: ["Your yellow yo-yo is yummy? No!", "Yes, you can play in the yard."], storyPrompt: "Tell a story about a yellow yo-yo that says yes." },
  { id: "ng", label: "NG as in Ring", ipa: "/ŋ/", typicalAge: "by 3–4", band: "middle", cue: "Back of the tongue up, hum through your nose — the end of 'sing'.", words: ["ring", "king", "song", "swing", "wing", "long"], sentences: ["The king sings a long song.", "Swing your wings, little bird."], storyPrompt: "Tell a story about a king who can't stop singing." },
  // Later sounds (typically by ~4–7)
  { id: "l", label: "L as in Lion", ipa: "/l/", typicalAge: "by 4–5", band: "late", cue: "Tongue tip up to the bumpy ridge behind your top teeth, voice on — llll.", words: ["lion", "leg", "light", "lemon", "balloon", "ball"], sentences: ["The lion licks a lemon lollipop.", "Look at the yellow balloon."], storyPrompt: "Tell a story about a lion who is scared of balloons." },
  { id: "sh", label: "SH as in Ship", ipa: "/ʃ/", typicalAge: "by 4–5", band: "late", cue: "Round your lips, quiet air — the 'be quiet' sound, shhh.", words: ["ship", "shoe", "sheep", "shark", "fishing", "brush"], sentences: ["The sheep wears shiny shoes on the ship.", "Shhh — the shark is sleeping."], storyPrompt: "Tell a story about a sheep who sails a ship." },
  { id: "ch", label: "CH as in Chair", ipa: "/tʃ/", typicalAge: "by 4–5", band: "late", cue: "Tongue tip up, then release like a tiny sneeze — chuh, like a train: ch-ch-ch.", words: ["chair", "cheese", "chicken", "chin", "peach", "lunch"], sentences: ["The chicken eats cheese for lunch.", "A peach rolled under the chair."], storyPrompt: "Tell a story about a chicken who opens a cheese shop." },
  { id: "s", label: "S as in Sun", ipa: "/s/", typicalAge: "by 4–5", band: "late", cue: "Teeth almost together, smile, thin stream of air — like a quiet snake, ssss.", words: ["sun", "sock", "soap", "seal", "dinosaur", "bus"], sentences: ["The seal sees the sun.", "Six socks sit on the bus."], storyPrompt: "Tell a story about a seal who collects silly socks." },
  { id: "z", label: "Z as in Zoo", ipa: "/z/", typicalAge: "by 4–6", band: "late", cue: "Same as S but switch your voice on — a buzzing bee, zzzz.", words: ["zoo", "zebra", "zip", "zero", "puzzle", "buzz"], sentences: ["The zebra zips to the zoo.", "Bees buzz over the puzzle."], storyPrompt: "Tell a story about a zebra who works at the zoo." },
  { id: "r", label: "R as in Rocket", ipa: "/r/", typicalAge: "by 5–7", band: "late", cue: "Tongue pulled back and up, lips slightly round — a growly rrrr like a race car.", words: ["rocket", "rain", "red", "rabbit", "carrot", "star"], sentences: ["The rabbit rides a red rocket.", "Rain falls on the carrot."], storyPrompt: "Tell a story about a rabbit who flies a rocket to a star. Roar the R like a dragon — rrrr!" },
  { id: "th", label: "TH as in Thumb", ipa: "/θ/", typicalAge: "by 5–7", band: "late", cue: "Tongue tip peeks between your teeth, blow soft air — think 'thank you'.", words: ["thumb", "three", "throw", "bath", "tooth", "mouth"], sentences: ["Three thumbs up for the bath!", "My tooth thinks it's Thursday."], storyPrompt: "Tell a story about a tooth that loves bath time." },
];

export const BAND_LABEL: Record<SoundEntry["band"], string> = {
  early: "Early sounds · typically by 2–3",
  middle: "Growing sounds · typically by 3–4",
  late: "Later sounds · typically by 4–7",
};

/* ---------------- Module B · Mimic Studio (Speech Blubs port) ---------------- */

export interface MimicPrompt {
  id: string;
  emoji: string;
  title: string;
  instruction: string;  // what the parent models, the child mirrors
  focus: string;        // what it builds
}

export interface MimicPack {
  id: string;
  title: string;
  emoji: string;
  blurb: string;
  prompts: MimicPrompt[];
}

export const MIMIC_PACKS: MimicPack[] = [
  {
    id: "animal-sounds", title: "Animal Sounds", emoji: "🦁", blurb: "Big easy sounds that wake up the voice — the classic first step.",
    prompts: [
      { id: "lion", emoji: "🦁", title: "Lion roar", instruction: "Open wide and roar from your belly: ROAAAR!", focus: "Voice power · open jaw" },
      { id: "snake", emoji: "🐍", title: "Snake hiss", instruction: "Smile, teeth close, long sssssss.", focus: "S sound · air control" },
      { id: "cow", emoji: "🐮", title: "Cow moo", instruction: "Round lips, long mmmooooo.", focus: "M + OO · lip rounding" },
      { id: "bee", emoji: "🐝", title: "Bee buzz", instruction: "Buzz with your voice on: zzzzzz. Feel the tickle!", focus: "Z sound · voicing" },
      { id: "horse", emoji: "🐴", title: "Horse lips", instruction: "Blow air through loose lips — brrrrr!", focus: "Lip strength · airflow" },
      { id: "owl", emoji: "🦉", title: "Owl hoo", instruction: "Tiny round lips: hoo-hoo, hoo-hoo.", focus: "H + OO · breath rhythm" },
    ],
  },
  {
    id: "silly-faces", title: "Silly Faces", emoji: "😜", blurb: "Mouth gymnastics — tongue, lips and cheeks get strong by being silly.",
    prompts: [
      { id: "tongue-out", emoji: "😛", title: "Tongue says hello", instruction: "Stick your tongue way out, hold it, then back in. Three times!", focus: "Tongue extension" },
      { id: "tongue-up", emoji: "👆", title: "Tongue to the nose", instruction: "Try to touch your nose with your tongue tip.", focus: "Tongue elevation (L, T, D)" },
      { id: "fish-lips", emoji: "🐠", title: "Fish lips", instruction: "Suck your cheeks in and make fish lips. Can you pop them?", focus: "Lip + cheek control" },
      { id: "big-smile", emoji: "😁", title: "Giant smile, tiny kiss", instruction: "Biggest smile… now tiny kiss lips. Switch fast: smile, kiss, smile, kiss!", focus: "Lip rounding ↔ spreading (EE/OO)" },
      { id: "puffy-cheeks", emoji: "🐹", title: "Hamster cheeks", instruction: "Puff your cheeks with air, hold… then pop them with your hands!", focus: "Air pressure (P, B)" },
      { id: "licky-lips", emoji: "🍦", title: "Ice-cream lips", instruction: "Pretend there's ice cream on your lips — lick all the way around.", focus: "Tongue circling" },
    ],
  },
  {
    id: "power-syllables", title: "Power Syllables", emoji: "🥁", blurb: "Drum-beat syllables that build speech-motor speed and rhythm.",
    prompts: [
      { id: "bababa", emoji: "🥁", title: "Ba-ba-ba", instruction: "Drum it out: ba-ba-ba, BA-BA-BA. Slow, then fast.", focus: "Lip sounds · rhythm" },
      { id: "mamama", emoji: "🎵", title: "Ma-ma-ma", instruction: "Sing it up and down: ma-ma-ma like a little song.", focus: "Nasal + vowel shifts" },
      { id: "dadada", emoji: "🚂", title: "Da-da-da", instruction: "Train wheels: da-da-da-da getting faster!", focus: "Tongue-tip speed" },
      { id: "pataka", emoji: "⚡", title: "Pa-ta-ka", instruction: "The champion round: pa-ta-ka, pa-ta-ka. Front, middle, back!", focus: "Full-mouth sequencing" },
      { id: "weewoo", emoji: "🚒", title: "Wee-woo siren", instruction: "Fire truck! Wee-woo wee-woo, big lip moves.", focus: "Vowel glides (EE/OO)" },
      { id: "lalala", emoji: "🎤", title: "La-la-la", instruction: "Opera time: la-la-la-laaaa with your tongue tapping up.", focus: "L sound · tongue tap" },
    ],
  },
  {
    id: "first-words", title: "First Words", emoji: "🍪", blurb: "High-power early words — the ones that get things done.",
    prompts: [
      { id: "more", emoji: "➕", title: "More!", instruction: "Say 'more' with hands together — mmm-ore. Use it at snack time.", focus: "Requesting · M" },
      { id: "up", emoji: "🙌", title: "Up!", instruction: "Arms up high and say 'UP!'", focus: "Requesting · vowel + P" },
      { id: "go", emoji: "🟢", title: "Go!", instruction: "Ready… set… GO! Make it explode.", focus: "G · anticipation play" },
      { id: "bye", emoji: "👋", title: "Bye-bye", instruction: "Wave big: bye-bye! To toys, to the bath water, to socks.", focus: "B · social routine" },
      { id: "uhoh", emoji: "🫢", title: "Uh-oh!", instruction: "Drop a soft toy and say 'uh-oh!' — the funniest first word.", focus: "Vowel play · cause-effect" },
      { id: "no", emoji: "🙅", title: "No-no-no", instruction: "Shake your head: no-no-no (the silly game version).", focus: "N · head + voice together" },
    ],
  },
];

/* ---------------- Module C · Development Missions (Otsimo port) ---------------- */

export interface MissionTemplate {
  id: string;
  day: number;            // position in the 5-day cycle
  domain: PracticeDomain;
  title: string;
  emoji: string;
  /** 3-step parent script; {name} and {lang} are templated to the child. */
  steps: [string, string, string];
  coachPrompt: string;    // sent to Ask Arbor on "Coach me"
}

export const MISSION_CYCLE: MissionTemplate[] = [
  {
    id: "new-words", day: 0, domain: "language", title: "Five new words", emoji: "🗣️",
    steps: [
      "Pick 5 things around the house {name} doesn't name yet (whisk, hinge, shadow…).",
      "Hunt for them together — touch each one, name it, and use it in one silly sentence.",
      "At dinner, see how many {name} can remember. Celebrate 2+ — that's a win.",
    ],
    coachPrompt: "Give me 5 fresh, slightly-challenging words to teach {name} (age {age}) today around the house, with one playful way to anchor each word.",
  },
  {
    id: "emotion-spotting", day: 1, domain: "emotional", title: "Emotion detective", emoji: "🕵️",
    steps: [
      "During a book or show, pause on a face and ask: \"How does she feel? How do you know?\"",
      "Make the feeling face together in a mirror — exaggerate it.",
      "Name one moment {name} felt that feeling this week. \"Remember when you were so proud…\"",
    ],
    coachPrompt: "Give me a 5-minute emotion-recognition game for {name} (age {age}) using faces in books or a mirror, plus the exact words to label 4 core feelings.",
  },
  {
    id: "story-retell", day: 2, domain: "cognition", title: "Story retell", emoji: "📖",
    steps: [
      "Read or tell a short story {name} knows well.",
      "Ask {name} to tell it BACK to you — to a stuffed animal works even better.",
      "Prompt only with \"and then what happened?\" Order matters more than detail.",
    ],
    coachPrompt: "How do I scaffold story retelling for {name} (age {age})? Give me a 3-question ladder from easiest to hardest and what a typical retell looks like at this age.",
  },
  {
    id: "sound-safari", day: 3, domain: "speech", title: "Sound safari", emoji: "🦜",
    steps: [
      "Pick one sound {name} is working on (or open Speech Coach for today's sound).",
      "Go on a 5-minute hunt for 5 things that start with it. Say each one twice, playfully.",
      "Finish with the silliest sentence you can build from your finds.",
    ],
    coachPrompt: "Plan a playful 5-minute articulation hunt at home for {name} (age {age}) on one target sound, with what to do when a word comes out wrong (model, don't correct).",
  },
  {
    id: "social-play", day: 4, domain: "social", title: "Turn-taking game", emoji: "🎲",
    steps: [
      "Pick any turn-based game (rolling a ball counts). You go, {name} goes.",
      "Narrate the social moves out loud: \"My turn… your turn… you waited — that was kind.\"",
      "Lose at least once, dramatically. Practicing losing is the secret skill.",
    ],
    coachPrompt: "Give me one turn-taking game for {name} (age {age}) that practices waiting and losing gracefully, with scripts for the moment frustration shows up.",
  },
];

export const DOMAIN_META: Record<PracticeDomain, { label: string; color: string; soft: string }> = {
  language:  { label: "Language",             color: "#2f7bbf", soft: "#e5f0fb" },
  speech:    { label: "Speech sounds",        color: "#1f8a5a", soft: "#e4f4ec" },
  cognition: { label: "Thinking & logic",     color: "#6354c4", soft: "#ece9fb" },
  social:    { label: "Social skills",        color: "#a9780f", soft: "#fbf1d4" },
  emotional: { label: "Emotional regulation", color: "#bd4f74", soft: "#fce2ec" },
};

/* ---------------- Module D · Cognitive Adventures (MITA port) ---------------- */

export interface AdventureChoice {
  id: string;
  emoji: string;
  text: string;
  correct: boolean;
  feedback: string;       // warm feedback either way — the child never "fails"
}

export interface AdventureScene {
  id: string;
  skill: AdventureSkill;
  prompt: string;          // {name} templated
  choices: AdventureChoice[];
}

export interface AdventureScenario {
  id: string;
  title: string;
  emoji: string;
  ageBand: [number, number];
  intro: string;
  scenes: AdventureScene[];
}

export const ADVENTURE_SCENARIOS: AdventureScenario[] = [
  {
    id: "hungry-lion", title: "The Hungry Lion", emoji: "🦁", ageBand: [2, 4],
    intro: "Leo the lion woke up with a big rumbly tummy. Can you help him, {name}?",
    scenes: [
      {
        id: "food", skill: "logic", prompt: "Leo the lion is SO hungry. What does he need?",
        choices: [
          { id: "meat", emoji: "🍖", text: "Some food", correct: true, feedback: "Yes! Hungry tummies need food. Leo says THANK YOU, {name}!" },
          { id: "hat", emoji: "🎩", text: "A fancy hat", correct: false, feedback: "A hat is fun — but it won't fill a rumbly tummy! What fills a tummy?" },
          { id: "nap", emoji: "😴", text: "A nap", correct: false, feedback: "Sleepy lions nap — but HUNGRY lions need something else first…" },
        ],
      },
      {
        id: "thirsty", skill: "vocabulary", prompt: "After eating, Leo feels thirsty. What does thirsty mean he wants?",
        choices: [
          { id: "water", emoji: "💧", text: "A drink of water", correct: true, feedback: "Exactly — thirsty means your body wants a drink. Gulp gulp gulp!" },
          { id: "ball", emoji: "⚽", text: "A ball to play", correct: false, feedback: "Playing is great — but thirsty is about wanting a… drink!" },
          { id: "blanket", emoji: "🛏️", text: "A cozy blanket", correct: false, feedback: "Blankets are for cold and sleepy — thirsty is about a drink." },
        ],
      },
      {
        id: "sequence", skill: "sequencing", prompt: "What did Leo do FIRST today?",
        choices: [
          { id: "ate", emoji: "🍖", text: "He ate food", correct: true, feedback: "Right! First he ate, THEN he drank water. You remembered the order!" },
          { id: "drank", emoji: "💧", text: "He drank water", correct: false, feedback: "Close — the water came after. What did his rumbly tummy get FIRST?" },
          { id: "flew", emoji: "✈️", text: "He flew a plane", correct: false, feedback: "Ha! No planes today — think about his rumbly tummy…" },
        ],
      },
    ],
  },
  {
    id: "lost-mitten", title: "The Lost Mitten", emoji: "🧤", ageBand: [3, 5],
    intro: "Mia the fox lost one red mitten in the snow. Help her think it through, {name}.",
    scenes: [
      {
        id: "where", skill: "logic", prompt: "Mia's hands were warm at home. Outside in the snow, one hand got cold. Where should she look for the mitten?",
        choices: [
          { id: "path", emoji: "👣", text: "Along the snowy path she walked", correct: true, feedback: "Smart thinking! It must have dropped somewhere along the way." },
          { id: "fridge", emoji: "🧊", text: "Inside the fridge", correct: false, feedback: "Brrr, the fridge is cold but the mitten never went there. Where DID she walk?" },
          { id: "sky", emoji: "☁️", text: "Up in the clouds", correct: false, feedback: "Mittens can't fly! Think about where Mia's feet went." },
        ],
      },
      {
        id: "instruction", skill: "instructions", prompt: "Mia says: \"First look under the bench, THEN behind the tree.\" Where do we look first?",
        choices: [
          { id: "bench", emoji: "🪑", text: "Under the bench", correct: true, feedback: "You followed the instruction perfectly — FIRST the bench!" },
          { id: "tree", emoji: "🌳", text: "Behind the tree", correct: false, feedback: "The tree comes second. What did Mia say to do FIRST?" },
          { id: "pond", emoji: "🦆", text: "In the duck pond", correct: false, feedback: "The ducks haven't seen it! Listen again: first under the… bench!" },
        ],
      },
      {
        id: "feeling", skill: "abstract", prompt: "Mia found her mitten! Her eyes went wide and she jumped up and down. How does she feel?",
        choices: [
          { id: "happy", emoji: "😄", text: "Happy and excited", correct: true, feedback: "Yes! Jumping and wide eyes — that's what excited looks like!" },
          { id: "angry", emoji: "😠", text: "Angry", correct: false, feedback: "Angry looks like a frowny face and stomping. Jumping with wide eyes means…" },
          { id: "sleepy", emoji: "🥱", text: "Sleepy", correct: false, feedback: "Sleepy is yawns and slow blinks — this fox is bouncing!" },
        ],
      },
    ],
  },
  {
    id: "rocket-picnic", title: "Picnic on the Moon", emoji: "🚀", ageBand: [4, 7],
    intro: "Astronaut Zoe is packing a rocket picnic, {name}. She needs a sharp thinker like you.",
    scenes: [
      {
        id: "packing", skill: "logic", prompt: "Zoe can bring ONE thing to eat on the moon. Which one makes sense?",
        choices: [
          { id: "sandwich", emoji: "🥪", text: "A sandwich", correct: true, feedback: "Good call — a sandwich travels well, even to the moon!" },
          { id: "icecream-cone", emoji: "🍦", text: "An ice cream cone in her pocket", correct: false, feedback: "A pocket ice cream would be a melty disaster before liftoff! What travels better?" },
          { id: "soup-bowl", emoji: "🥣", text: "An open bowl of soup", correct: false, feedback: "Whoosh — floating soup everywhere! Something that doesn't spill…" },
        ],
      },
      {
        id: "order", skill: "sequencing", prompt: "To fly: put on the suit, climb in the rocket, then press the button. Zoe pressed the button first. What went wrong?",
        choices: [
          { id: "skipped", emoji: "👩‍🚀", text: "She skipped the suit and the climbing in!", correct: true, feedback: "Exactly — the rocket left without her! Steps have an order for a reason." },
          { id: "fine", emoji: "👍", text: "Nothing — any order works", correct: false, feedback: "Hmm — the rocket flew away while she stood there! Why does order matter?" },
          { id: "button", emoji: "🔴", text: "The button was the wrong color", correct: false, feedback: "The button was fine — the problem was WHEN she pressed it." },
        ],
      },
      {
        id: "opposite", skill: "abstract", prompt: "On the moon everything floats UP. On Earth, things fall…",
        choices: [
          { id: "down", emoji: "⬇️", text: "Down", correct: true, feedback: "Up and down — opposites! You're thinking like a scientist." },
          { id: "sideways", emoji: "➡️", text: "Sideways", correct: false, feedback: "Drop a spoon at home — which way does it go? Not sideways…" },
          { id: "up-too", emoji: "⬆️", text: "Up too", correct: false, feedback: "If Earth things floated up, your breakfast would be on the ceiling!" },
        ],
      },
      {
        id: "word", skill: "vocabulary", prompt: "Zoe looks at Earth from the moon and says it looks 'enormous'. What does enormous mean?",
        choices: [
          { id: "big", emoji: "🌍", text: "Really, really big", correct: true, feedback: "Yes — enormous is a power word for HUGE!" },
          { id: "small", emoji: "🐜", text: "Tiny like an ant", correct: false, feedback: "That would be 'tiny' — enormous is the opposite!" },
          { id: "green", emoji: "🟢", text: "Very green", correct: false, feedback: "Enormous isn't a color — it's about SIZE. A whale is enormous…" },
        ],
      },
    ],
  },
  {
    id: "bedtime-bear", title: "Bear Can't Sleep", emoji: "🐻", ageBand: [2, 5],
    intro: "Bruno the bear can't fall asleep. Figure out what he needs, {name}.",
    scenes: [
      {
        id: "need", skill: "logic", prompt: "Bruno is rubbing his eyes and yawning, but the light is bright and music is LOUD. What should change?",
        choices: [
          { id: "quiet-dark", emoji: "🌙", text: "Turn the light off and the music down", correct: true, feedback: "Perfect — sleepy bears need dark and quiet. Shhh…" },
          { id: "more-music", emoji: "📣", text: "Turn the music UP", correct: false, feedback: "Louder would wake him even more! What helps eyes close?" },
          { id: "candy", emoji: "🍬", text: "Give him candy", correct: false, feedback: "Candy makes bears bouncy, not sleepy! Think dark and quiet…" },
        ],
      },
      {
        id: "routine", skill: "sequencing", prompt: "Bruno's bedtime steps: bath, then pajamas, then story. He just finished his bath. What's next?",
        choices: [
          { id: "pajamas", emoji: "🩳", text: "Pajamas", correct: true, feedback: "Right! Bath → pajamas → story. You know the routine!" },
          { id: "story", emoji: "📖", text: "Story first", correct: false, feedback: "A wet bear on the storybook? Pajamas come before the story!" },
          { id: "bath-again", emoji: "🛁", text: "Another bath", correct: false, feedback: "He's already squeaky clean! What comes after the bath?" },
        ],
      },
      {
        id: "kind", skill: "abstract", prompt: "Bruno's little sister is scared of the dark. Bruno gives her his teddy. Was that kind or unkind?",
        choices: [
          { id: "kind", emoji: "💛", text: "Kind", correct: true, feedback: "Very kind — he gave up his teddy to help her feel brave." },
          { id: "unkind", emoji: "💢", text: "Unkind", correct: false, feedback: "Hmm — he GAVE her something to help. Helping someone feel safe is…" },
          { id: "silly", emoji: "🤪", text: "Just silly", correct: false, feedback: "Maybe a little silly — but mostly it helped her feel safe. That's called…" },
        ],
      },
    ],
  },
];

/** Scenarios appropriate for the child's age (with a one-year grace each way). */
export function scenariosForAge(age: number): AdventureScenario[] {
  const fits = ADVENTURE_SCENARIOS.filter((s) => age >= s.ageBand[0] - 1 && age <= s.ageBand[1] + 1);
  return fits.length > 0 ? fits : ADVENTURE_SCENARIOS;
}

/** Template {name}/{age}/{lang} placeholders in content strings. */
export function fillTemplate(text: string, vars: { name: string; age?: number; lang?: string }): string {
  return text
    .replace(/\{name\}/g, vars.name)
    .replace(/\{age\}/g, String(vars.age ?? ""))
    .replace(/\{lang\}/g, vars.lang ?? "");
}
