import type {
  DevelopmentMetricId,
  DevelopmentMetrics,
  HeroPackId,
  HeroStorySpec,
} from "../types";

/**
 * The Arbor Hero Journey catalog.
 *
 * Each story is a FIXED, vetted spine authored here as data — never invented by
 * the model. The server (routes/api.ts) sends the spine to the AI and asks it
 * only to personalize the narration to the child. This keeps every journey
 * safe, on-message, bilingual, and low-hallucination.
 *
 * Shared by both the client (catalog browser, choices, metrics) and the server
 * (spine grounding). Must stay free of server-only imports so esbuild can bundle
 * it into dist/server.cjs.
 *
 * Story structure — every story follows the same 8 beats:
 *   Call → Challenge → Fear → Decision → Consequence → Growth → Victory → Reflection
 * Only the `decision` beat carries the 3 choices.
 */

export const METRIC_IDS: DevelopmentMetricId[] = [
  "courage",
  "responsibility",
  "resilience",
  "empathy",
  "wisdom",
];

export const METRIC_LABELS: Record<DevelopmentMetricId, string> = {
  courage: "Courage",
  responsibility: "Responsibility",
  resilience: "Resilience",
  empathy: "Empathy",
  wisdom: "Wisdom",
};

export const PACKS: { id: HeroPackId; title: string; titleHe: string; blurb: string }[] = [
  { id: "courage", title: "Courage", titleHe: "אומץ", blurb: "Standing tall when you feel small." },
  { id: "responsibility", title: "Responsibility", titleHe: "אחריות", blurb: "Doing what needs to be done." },
  { id: "growth", title: "Growth", titleHe: "צמיחה", blurb: "Becoming stronger through what's hard." },
  { id: "wisdom", title: "Wisdom", titleHe: "חוכמה", blurb: "Choosing well, and choosing kind." },
];

export const emptyMetrics = (): DevelopmentMetrics => ({
  courage: 0,
  responsibility: 0,
  resilience: 0,
  empathy: 0,
  wisdom: 0,
});

/** Add two (partial) metric maps into a full metrics object. */
export const addMetrics = (
  base: DevelopmentMetrics,
  delta: Partial<DevelopmentMetrics>
): DevelopmentMetrics => {
  const next = { ...base };
  for (const key of METRIC_IDS) {
    next[key] += delta[key] ?? 0;
  }
  return next;
};

/**
 * The points a completed journey awards: the story's baseReward plus the deltas
 * of the chosen Decision-beat option.
 */
export const applyChoice = (
  story: HeroStorySpec,
  choiceId: string | undefined
): Partial<DevelopmentMetrics> => {
  const earned: DevelopmentMetrics = addMetrics(emptyMetrics(), story.baseReward);
  const decision = story.beats.find((b) => b.id === "decision");
  const choice = decision?.choices?.find((c) => c.id === choiceId);
  if (choice) return addMetrics(earned, choice.metricDeltas);
  return earned;
};

export const HERO_STORIES: HeroStorySpec[] = [
  // ── Pack 1 · Courage ───────────────────────────────────────────────────────
  {
    id: "david-and-goliath",
    pack: "courage",
    title: "David and Goliath",
    titleHe: "דוד וגוליית",
    theme: "Courage in the face of fear",
    origin: "biblical",
    ageRange: [4, 8],
    primaryMetric: "courage",
    baseReward: { courage: 2, resilience: 1 },
    learningObjective: "Being small doesn't mean being powerless — courage is acting even while afraid.",
    parentReflection: {
      practiced: ["Courage", "Self-belief", "Facing fear"],
      questions: [
        "When did you feel small today, like David did?",
        "What helped the hero be brave even though the giant was big?",
        "What is one giant-sized thing you want to try tomorrow?",
      ],
    },
    beats: [
      { id: "call", title: "The Call", spine: "The hero is a small shepherd who hears that a giant named Goliath is frightening everyone in the valley." },
      { id: "challenge", title: "The Challenge", spine: "The giant towers over the whole army; no grown-up is brave enough to face him." },
      { id: "fear", title: "The Fear", spine: "The hero's heart pounds — Goliath is enormous and the hero is so small. Fear says 'you can't'." },
      {
        id: "decision",
        title: "The Decision",
        spine: "The hero must decide what to do about the giant.",
        choices: [
          { id: "a", label: "Walk quietly away", outcomeHint: "The hero steps back and watches; the fear stays but so does a quiet wish to have tried.", metricDeltas: { wisdom: 1 } },
          { id: "b", label: "Ask a friend for help first", outcomeHint: "The hero gathers courage by asking a trusted friend, then steps forward together-in-spirit.", metricDeltas: { empathy: 1, courage: 1 } },
          { id: "c", label: "Face the giant with my sling", outcomeHint: "The hero breathes deep, picks up a small smooth stone, and walks toward the giant.", metricDeltas: { courage: 2, resilience: 1 } },
        ],
      },
      { id: "consequence", title: "What Happened", spine: "Because of the choice, the valley goes quiet and everyone watches what the small hero does next." },
      { id: "growth", title: "Growing", spine: "The hero learns that courage isn't being un-afraid — it's taking one brave step while the fear is still there." },
      { id: "victory", title: "Victory", spine: "The giant problem becomes small; the people cheer the small hero who dared." },
      { id: "reflection", title: "Reflection", spine: "The hero rests, proud, and remembers: I am braver than I knew." },
    ],
  },
  {
    id: "moses-and-pharaoh",
    pack: "courage",
    title: "Moses and Pharaoh",
    titleHe: "משה ופרעה",
    theme: "Standing up to great power",
    origin: "biblical",
    ageRange: [4, 8],
    primaryMetric: "courage",
    baseReward: { courage: 2, responsibility: 1 },
    learningObjective: "You can speak up for what's right even to someone powerful — your voice matters.",
    parentReflection: {
      practiced: ["Courage", "Speaking up", "Standing for others"],
      questions: [
        "Was it scary for the hero to speak to the king? Why did they do it anyway?",
        "When is it important to use your voice, even when it's hard?",
        "Who is someone you would be brave for?",
      ],
    },
    beats: [
      { id: "call", title: "The Call", spine: "The hero sees that many people are tired and treated unfairly, and feels a tug to help them." },
      { id: "challenge", title: "The Challenge", spine: "Only the most powerful king in the land can set the people free — and he says no." },
      { id: "fear", title: "The Fear", spine: "The hero's voice shakes; the king is mighty and the palace is huge. What if no one listens?" },
      {
        id: "decision",
        title: "The Decision",
        spine: "The hero must decide whether to speak up to the king.",
        choices: [
          { id: "a", label: "Stay quiet and hope it changes", outcomeHint: "The hero waits, but the people stay tired, and the hero's heart aches to do more.", metricDeltas: { wisdom: 1 } },
          { id: "b", label: "Find others to stand with me", outcomeHint: "The hero gathers brave helpers so they can speak together with stronger voices.", metricDeltas: { empathy: 1, responsibility: 1 } },
          { id: "c", label: "Stand tall and say 'Let them go'", outcomeHint: "The hero steps before the king, steadies their breath, and speaks the brave true words.", metricDeltas: { courage: 2, responsibility: 1 } },
        ],
      },
      { id: "consequence", title: "What Happened", spine: "The hero's words ripple through the palace; the king must finally reckon with what is right." },
      { id: "growth", title: "Growing", spine: "The hero learns that one steady, truthful voice can move even the mightiest." },
      { id: "victory", title: "Victory", spine: "The people walk free toward a new beginning, led by the hero who dared to speak." },
      { id: "reflection", title: "Reflection", spine: "The hero looks back at the long road and knows: speaking up was worth it." },
    ],
  },
  {
    id: "the-lion-who-was-afraid",
    pack: "courage",
    title: "The Lion Who Was Afraid",
    titleHe: "האריה שפחד",
    theme: "Courage despite fear",
    origin: "original",
    ageRange: [4, 8],
    primaryMetric: "courage",
    baseReward: { courage: 2, resilience: 1 },
    learningObjective: "Even the strong feel fear — bravery is moving forward gently anyway.",
    parentReflection: {
      practiced: ["Courage", "Naming feelings", "Self-kindness"],
      questions: [
        "What was the lion afraid of? Is it okay for strong ones to be scared?",
        "What helped the lion feel a little braver?",
        "What helps YOU feel brave when you're scared?",
      ],
    },
    beats: [
      { id: "call", title: "The Call", spine: "A young lion with a big soft mane lives in the tall grass but is afraid of the dark beyond the hill." },
      { id: "challenge", title: "The Challenge", spine: "A little cub is lost on the far side of the dark hill and needs someone brave to find them." },
      { id: "fear", title: "The Fear", spine: "The lion's paws feel wobbly; the dark looks enormous and full of unknown sounds." },
      {
        id: "decision",
        title: "The Decision",
        spine: "The lion must decide what to do about the dark hill and the lost cub.",
        choices: [
          { id: "a", label: "Wait for morning light", outcomeHint: "The lion waits, but the cub is alone and cold, and the lion wishes it had gone.", metricDeltas: { wisdom: 1 } },
          { id: "b", label: "Bring a friend and a lantern", outcomeHint: "The lion finds a firefly friend whose glow makes the dark feel smaller, and they go together.", metricDeltas: { empathy: 1, courage: 1 } },
          { id: "c", label: "Take one brave step into the dark", outcomeHint: "The lion takes a slow breath, lifts one paw, and steps into the dark to find the cub.", metricDeltas: { courage: 2, resilience: 1 } },
        ],
      },
      { id: "consequence", title: "What Happened", spine: "Each step the lion takes, the dark turns out to be smaller and kinder than the fear had said." },
      { id: "growth", title: "Growing", spine: "The lion learns that fear shrinks when you walk toward it with a kind, steady heart." },
      { id: "victory", title: "Victory", spine: "The lost cub is found and carried home, snuggled safe in the lion's warm mane." },
      { id: "reflection", title: "Reflection", spine: "The lion curls up under the stars, no longer afraid of the dark it crossed." },
    ],
  },

  // ── Pack 2 · Responsibility ─────────────────────────────────────────────────
  {
    id: "noahs-ark",
    pack: "responsibility",
    title: "Noah's Ark",
    titleHe: "תיבת נח",
    theme: "Preparing for the future",
    origin: "biblical",
    ageRange: [4, 8],
    primaryMetric: "responsibility",
    baseReward: { responsibility: 2, resilience: 1 },
    learningObjective: "Doing the steady work of preparing — even when others don't understand — keeps everyone safe.",
    parentReflection: {
      practiced: ["Responsibility", "Planning ahead", "Caring for others"],
      questions: [
        "Why did the hero keep building even when people laughed?",
        "What's something you can prepare for before it's needed?",
        "Who did the hero take care of on the ark?",
      ],
    },
    beats: [
      { id: "call", title: "The Call", spine: "The hero senses a great rain is coming and feels responsible to keep the animals safe." },
      { id: "challenge", title: "The Challenge", spine: "Building a giant ark is enormous, slow work, and others laugh and say it's silly." },
      { id: "fear", title: "The Fear", spine: "The hero worries: what if it's too hard, takes too long, or everyone is right that it's pointless?" },
      {
        id: "decision",
        title: "The Decision",
        spine: "The hero must decide whether to keep building the ark.",
        choices: [
          { id: "a", label: "Stop — it's too much work", outcomeHint: "The hero rests the tools, but a worried feeling stays that the animals aren't safe yet.", metricDeltas: { wisdom: 1 } },
          { id: "b", label: "Ask the animals to help", outcomeHint: "The hero invites the animals to carry and gather, and the work becomes lighter together.", metricDeltas: { empathy: 1, responsibility: 1 } },
          { id: "c", label: "Keep building, plank by plank", outcomeHint: "The hero keeps going, one steady plank at a time, until the ark is strong and ready.", metricDeltas: { responsibility: 2, resilience: 1 } },
        ],
      },
      { id: "consequence", title: "What Happened", spine: "When the first drops fall, the ark is ready and the animals climb aboard two by two." },
      { id: "growth", title: "Growing", spine: "The hero learns that quiet, steady preparing is a kind of strength others only see later." },
      { id: "victory", title: "Victory", spine: "The rains pass, a rainbow arches the sky, and every creature is safe because the hero prepared." },
      { id: "reflection", title: "Reflection", spine: "The hero stands on the deck, tired and proud, watching the world begin fresh." },
    ],
  },
  {
    id: "jonah-and-the-great-fish",
    pack: "responsibility",
    title: "Jonah and the Great Fish",
    titleHe: "יונה והדג הגדול",
    theme: "Running from responsibility — and coming back",
    origin: "biblical",
    ageRange: [4, 8],
    primaryMetric: "responsibility",
    baseReward: { responsibility: 2, wisdom: 1 },
    learningObjective: "We sometimes run from what we should do — and it's never too late to turn back and do it.",
    parentReflection: {
      practiced: ["Responsibility", "Owning mistakes", "Turning back"],
      questions: [
        "Why did the hero try to run away at first?",
        "What helped the hero decide to go back and do the right thing?",
        "Is there something you've been putting off that you could turn back to?",
      ],
    },
    beats: [
      { id: "call", title: "The Call", spine: "The hero is asked to go help a faraway city, but it feels hard and the hero doesn't want to." },
      { id: "challenge", title: "The Challenge", spine: "Instead of going, the hero sails the opposite way — and a great storm rises over the sea." },
      { id: "fear", title: "The Fear", spine: "Tossed by waves, the hero realizes that running away didn't make the task disappear." },
      {
        id: "decision",
        title: "The Decision",
        spine: "Inside the calm belly of a great gentle fish, the hero must decide what to do.",
        choices: [
          { id: "a", label: "Keep hiding in the deep", outcomeHint: "The hero stays hidden, but the faraway city still waits and the hero's heart feels heavy.", metricDeltas: { resilience: 1 } },
          { id: "b", label: "Say sorry and ask for another chance", outcomeHint: "The hero quietly says sorry and asks to try again, and feels lighter right away.", metricDeltas: { empathy: 1, wisdom: 1 } },
          { id: "c", label: "Turn back and do what I was asked", outcomeHint: "The hero decides to go to the city after all, ready to do the job this time.", metricDeltas: { responsibility: 2, courage: 1 } },
        ],
      },
      { id: "consequence", title: "What Happened", spine: "The gentle fish carries the hero back to shore, and the path to the city lies open again." },
      { id: "growth", title: "Growing", spine: "The hero learns that turning back to do the right thing is braver than running ever was." },
      { id: "victory", title: "Victory", spine: "The hero reaches the city and helps it, and a warm, settled feeling replaces the running one." },
      { id: "reflection", title: "Reflection", spine: "The hero rests by the shore, glad to have turned around in time." },
    ],
  },
  {
    id: "the-dragon-of-responsibility",
    pack: "responsibility",
    title: "The Dragon of Responsibility",
    titleHe: "דרקון האחריות",
    theme: "Everyday responsibility",
    origin: "original",
    ageRange: [4, 8],
    primaryMetric: "responsibility",
    baseReward: { responsibility: 2, empathy: 1 },
    learningObjective: "Small daily jobs — done with care — keep the people and creatures we love safe and warm.",
    parentReflection: {
      practiced: ["Responsibility", "Daily routines", "Following through"],
      questions: [
        "What job did the hero have to do every single day?",
        "What happens when we forget our small jobs?",
        "What's one job you can take care of all by yourself?",
      ],
    },
    beats: [
      { id: "call", title: "The Call", spine: "The hero befriends a small, friendly dragon whose tiny flame keeps the village lanterns lit each night." },
      { id: "challenge", title: "The Challenge", spine: "The dragon's flame needs feeding every evening — a small but never-skippable job — and playtime is so tempting." },
      { id: "fear", title: "The Fear", spine: "One evening the hero would rather play; a worry whispers that skipping 'just once' might be okay." },
      {
        id: "decision",
        title: "The Decision",
        spine: "The hero must decide what to do about the dragon's evening flame.",
        choices: [
          { id: "a", label: "Play now, feed the flame later", outcomeHint: "The hero plays first; the flame flickers low and the village lanterns grow dim and cold.", metricDeltas: { resilience: 1 } },
          { id: "b", label: "Ask a friend to remind me", outcomeHint: "The hero asks a friend to ring a little bell at flame-time so the job is never forgotten.", metricDeltas: { empathy: 1, responsibility: 1 } },
          { id: "c", label: "Feed the flame first, then play", outcomeHint: "The hero tends the dragon's flame first; the lanterns glow warm, and play feels even better after.", metricDeltas: { responsibility: 2, wisdom: 1 } },
        ],
      },
      { id: "consequence", title: "What Happened", spine: "The village either glows warm and safe or sits dim and chilly — all because of one small evening choice." },
      { id: "growth", title: "Growing", spine: "The hero learns that being trusted with a small job, done every day, is a quiet superpower." },
      { id: "victory", title: "Victory", spine: "The dragon purrs, the lanterns shine, and the villagers thank the dependable little hero." },
      { id: "reflection", title: "Reflection", spine: "The hero and dragon watch the warm lights together, proud of a job well kept." },
    ],
  },

  // ── Pack 3 · Growth ──────────────────────────────────────────────────────────
  {
    id: "joseph-and-his-brothers",
    pack: "growth",
    title: "Joseph and His Brothers",
    titleHe: "יוסף ואחיו",
    theme: "Resilience and forgiveness",
    origin: "biblical",
    ageRange: [4, 8],
    primaryMetric: "resilience",
    baseReward: { resilience: 2, empathy: 1 },
    learningObjective: "Hard times can grow us, and choosing forgiveness sets our own hearts free.",
    parentReflection: {
      practiced: ["Resilience", "Forgiveness", "Hope"],
      questions: [
        "The hero had some very hard days — what helped them keep hoping?",
        "Was it easy or hard for the hero to forgive? Why did they choose to?",
        "Is there someone you'd feel lighter if you forgave?",
      ],
    },
    beats: [
      { id: "call", title: "The Call", spine: "The hero is a dreamer with a colorful coat who loves their family, even when the brothers feel jealous." },
      { id: "challenge", title: "The Challenge", spine: "The brothers send the hero far away, and the hero must start over alone in a strange land." },
      { id: "fear", title: "The Fear", spine: "Far from home and treated unfairly, the hero wonders if things will ever feel good again." },
      {
        id: "decision",
        title: "The Decision",
        spine: "Years later, when the hero is strong and the brothers come needing help, the hero must decide.",
        choices: [
          { id: "a", label: "Stay angry and turn them away", outcomeHint: "The hero keeps the door closed, but the old hurt stays heavy and the heart stays tight.", metricDeltas: { resilience: 1 } },
          { id: "b", label: "Listen to their sorry first", outcomeHint: "The hero lets the brothers speak and truly listens, and the room grows softer.", metricDeltas: { wisdom: 1, empathy: 1 } },
          { id: "c", label: "Forgive them and share my bread", outcomeHint: "The hero opens both arms and shares food and home, and a great weight lifts away.", metricDeltas: { empathy: 2, resilience: 1 } },
        ],
      },
      { id: "consequence", title: "What Happened", spine: "The family is either left apart and aching, or knit back together at one warm table." },
      { id: "growth", title: "Growing", spine: "The hero learns that the hard years made them wise and strong, and forgiveness made them free." },
      { id: "victory", title: "Victory", spine: "The whole family is reunited, and the hero's old dream of togetherness finally comes true." },
      { id: "reflection", title: "Reflection", spine: "The hero watches the family laugh again, grateful for how far they've all come." },
    ],
  },
  {
    id: "jacob-wrestling-the-angel",
    pack: "growth",
    title: "Jacob and the Night Visitor",
    titleHe: "יעקב והמלאך",
    theme: "Struggling through hardship",
    origin: "biblical",
    ageRange: [4, 8],
    primaryMetric: "resilience",
    baseReward: { resilience: 2, courage: 1 },
    learningObjective: "Holding on through a hard struggle can change us — we come through with a new name and new strength.",
    parentReflection: {
      practiced: ["Resilience", "Perseverance", "Not giving up"],
      questions: [
        "The struggle lasted all night — what helped the hero hold on?",
        "What's something hard you kept trying at until morning came?",
        "How did the hero feel when the sun finally rose?",
      ],
    },
    beats: [
      { id: "call", title: "The Call", spine: "The hero camps alone by a river the night before a big, worrying day, with much on their mind." },
      { id: "challenge", title: "The Challenge", spine: "In the dark, a mysterious gentle visitor appears, and they begin a long, all-night wrestle of wills." },
      { id: "fear", title: "The Fear", spine: "Hour after hour the hero grows tired; a voice says 'let go, give up, it's too long'." },
      {
        id: "decision",
        title: "The Decision",
        spine: "As the night wears on and the hero tires, they must decide whether to hold on.",
        choices: [
          { id: "a", label: "Let go and walk away", outcomeHint: "The hero releases and rests, but never learns what holding on a little longer might have given.", metricDeltas: { wisdom: 1 } },
          { id: "b", label: "Pause, breathe, then keep going", outcomeHint: "The hero catches their breath, steadies, and returns to the struggle with calmer strength.", metricDeltas: { wisdom: 1, resilience: 1 } },
          { id: "c", label: "Hold on until the sunrise", outcomeHint: "The hero grips tight and stays in the struggle all the way until the first light of dawn.", metricDeltas: { resilience: 2, courage: 1 } },
        ],
      },
      { id: "consequence", title: "What Happened", spine: "As the sky pinkens, the visitor blesses the hero — changed, marked, and stronger for the night." },
      { id: "growth", title: "Growing", spine: "The hero learns that some good things only come to those who hold on through the long dark." },
      { id: "victory", title: "Victory", spine: "The sun rises on a hero with a new name and a steady, hard-won peace." },
      { id: "reflection", title: "Reflection", spine: "The hero walks into the new day, sore but proud, ready for what waits across the river." },
    ],
  },
  {
    id: "the-garden-of-forgotten-seeds",
    pack: "growth",
    title: "The Garden of Forgotten Seeds",
    titleHe: "גן הזרעים הנשכחים",
    theme: "Potential and patient work",
    origin: "original",
    ageRange: [4, 8],
    primaryMetric: "resilience",
    baseReward: { resilience: 2, responsibility: 1 },
    learningObjective: "Good things grow slowly — patient care today becomes a blooming garden tomorrow.",
    parentReflection: {
      practiced: ["Patience", "Effort over time", "Hope"],
      questions: [
        "The garden didn't bloom right away — how did the hero keep caring for it?",
        "What's something you're growing slowly, like a new skill?",
        "How does it feel to see something bloom that you helped grow?",
      ],
    },
    beats: [
      { id: "call", title: "The Call", spine: "The hero discovers a dusty packet of forgotten seeds and a patch of bare, hopeful earth." },
      { id: "challenge", title: "The Challenge", spine: "The seeds need watering and sunlight every day for a long time before anything green appears." },
      { id: "fear", title: "The Fear", spine: "Days pass with only brown soil; the hero worries the seeds are dead and the work is wasted." },
      {
        id: "decision",
        title: "The Decision",
        spine: "When nothing has sprouted yet, the hero must decide what to do about the garden.",
        choices: [
          { id: "a", label: "Give up on the empty soil", outcomeHint: "The hero stops watering; the soil stays bare, and the hero never sees what might have grown.", metricDeltas: { wisdom: 1 } },
          { id: "b", label: "Ask a gardener what to try", outcomeHint: "The hero asks a wise old gardener, learns to be patient, and tends the bed with new care.", metricDeltas: { wisdom: 1, empathy: 1 } },
          { id: "c", label: "Keep watering, day after day", outcomeHint: "The hero waters faithfully each morning, trusting the quiet work beneath the soil.", metricDeltas: { resilience: 2, responsibility: 1 } },
        ],
      },
      { id: "consequence", title: "What Happened", spine: "One morning a tiny green shoot appears — then another — where the hero kept up the patient care." },
      { id: "growth", title: "Growing", spine: "The hero learns that effort you can't see yet is still working, deep down, getting ready to bloom." },
      { id: "victory", title: "Victory", spine: "The bare patch becomes a garden bursting with color, grown from forgotten seeds and steady hands." },
      { id: "reflection", title: "Reflection", spine: "The hero sits among the flowers, breathing their scent, proud of the slow and lovely work." },
    ],
  },

  // ── Pack 4 · Wisdom ──────────────────────────────────────────────────────────
  {
    id: "king-solomons-choice",
    pack: "wisdom",
    title: "King Solomon's Choice",
    titleHe: "בחירתו של שלמה",
    theme: "Wisdom and good decisions",
    origin: "biblical",
    ageRange: [4, 8],
    primaryMetric: "wisdom",
    baseReward: { wisdom: 2, empathy: 1 },
    learningObjective: "Wisdom is stopping to think, listening with the heart, and choosing what is fair and kind.",
    parentReflection: {
      practiced: ["Wisdom", "Fairness", "Thinking before acting"],
      questions: [
        "How did the hero figure out the fair answer?",
        "Why is it good to stop and think before we decide?",
        "When did you make a really thoughtful choice today?",
      ],
    },
    beats: [
      { id: "call", title: "The Call", spine: "The hero is a young, kind ruler whom people come to whenever they need a fair decision." },
      { id: "challenge", title: "The Challenge", spine: "Two people both claim the same little treasure, and each insists with all their heart that it's theirs." },
      { id: "fear", title: "The Fear", spine: "The hero worries about getting it wrong — what if a fair-seeming answer actually hurts someone?" },
      {
        id: "decision",
        title: "The Decision",
        spine: "The hero must decide how to find out the truth and choose fairly.",
        choices: [
          { id: "a", label: "Decide fast to be done", outcomeHint: "The hero picks quickly, but a doubt lingers about whether it was truly fair.", metricDeltas: { courage: 1 } },
          { id: "b", label: "Split it right down the middle", outcomeHint: "The hero offers to halve it — and watches closely to see who cares more about keeping it whole.", metricDeltas: { wisdom: 1, empathy: 1 } },
          { id: "c", label: "Listen closely to both hearts", outcomeHint: "The hero asks gentle questions and watches kindly until the true owner's love makes the answer clear.", metricDeltas: { wisdom: 2, empathy: 1 } },
        ],
      },
      { id: "consequence", title: "What Happened", spine: "By listening with patience and heart, the hero sees who truly loves the treasure, and the truth shines out." },
      { id: "growth", title: "Growing", spine: "The hero learns that the wisest choices come from slowing down and listening, not rushing." },
      { id: "victory", title: "Victory", spine: "The fair decision makes both the people and the whole kingdom trust the hero's gentle wisdom." },
      { id: "reflection", title: "Reflection", spine: "The hero sits quietly, glad to have taken the time to choose what was truly right." },
    ],
  },
];

/** Look up a story spec by id. Returns undefined for unknown ids. */
export const getStorySpec = (id: string): HeroStorySpec | undefined =>
  HERO_STORIES.find((s) => s.id === id);

/** Stories belonging to a pack, in catalog order. */
export const storiesInPack = (pack: HeroPackId): HeroStorySpec[] =>
  HERO_STORIES.filter((s) => s.pack === pack);
