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
  "truth",
];

export const METRIC_LABELS: Record<DevelopmentMetricId, string> = {
  courage: "Courage",
  responsibility: "Responsibility",
  resilience: "Resilience",
  empathy: "Empathy",
  wisdom: "Wisdom",
  truth: "Truth",
};

export const PACKS: { id: HeroPackId; title: string; titleHe: string; blurb: string }[] = [
  { id: "courage", title: "Courage", titleHe: "אומץ", blurb: "Standing tall when you feel small." },
  { id: "responsibility", title: "Responsibility", titleHe: "אחריות", blurb: "Doing what needs to be done." },
  { id: "growth", title: "Growth", titleHe: "צמיחה", blurb: "Becoming stronger through what's hard." },
  { id: "wisdom", title: "Wisdom", titleHe: "חוכמה", blurb: "Choosing well, and choosing kind." },
  { id: "truth", title: "Truth", titleHe: "אמת", blurb: "Saying what's real, even when it's hard." },
];

export const emptyMetrics = (): DevelopmentMetrics => ({
  courage: 0,
  responsibility: 0,
  resilience: 0,
  empathy: 0,
  wisdom: 0,
  truth: 0,
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
    parentInsight: {"en":"The archetype here is the small one who steps toward what the strong refuse to face. It forms the conviction that being little is not the same as being powerless — courage is one chosen step taken while the fear is still in the chest, not the absence of fear. What it builds in your child is agency: the sense that they are an actor, not a bystander. One thing to watch for: courage is acting in spite of fear, not recklessness — notice if the brave step is aimed at a real giant, or just at being loud.","he":"הארכיטיפ כאן הוא הקטן שצועד אל מול מה שהחזקים מסרבים להתמודד איתו. הסיפור מטפח את ההבנה שלהיות קטן זה לא להיות חסר אונים — אומץ הוא צעד אחד שבוחרים לעשות בזמן שהפחד עדיין בלב, ולא היעדר הפחד. מה שזה בונה אצל הילד הוא תחושת מסוגלות: שהוא שחקן ולא צופה מהצד. דבר אחד לשים לב אליו: אומץ הוא לפעול למרות הפחד, לא חוסר זהירות — שימו לב אם הצעד האמיץ מכוון לענק אמיתי, או רק לעשות רעש."},
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
          { id: "a", label: "Walk quietly away", outcomeHint: "The hero steps back and watches; the fear stays but so does a quiet wish to have tried.", metricDeltas: {} },
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
    parentInsight: {"en":"This is the archetype of speaking the true thing to the one who holds the power. It forms the courage to say what must be said even when your voice shakes and the cost is real. In your child it builds the backbone of honesty — that the truth is worth more than comfort, and that you can be afraid and still stand and speak. One thing to watch for: the bravery is in telling the truth to power, not in defiance for its own sake — help them tell which is which.","he":"זהו הארכיטיפ של אמירת הדבר האמיתי למי שמחזיק בכוח. הסיפור מטפח את האומץ לומר את מה שצריך להיאמר גם כשהקול רועד והמחיר אמיתי. אצל הילד זה בונה את עמוד השדרה של היושר — שהאמת שווה יותר מנוחות, ושאפשר לפחד ועדיין לעמוד ולדבר. דבר אחד לשים לב אליו: האומץ הוא באמירת האמת למי שיש לו כוח, ולא בהתרסה לשם ההתרסה — עזרו לילד להבחין בין השניים."},
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
          { id: "a", label: "Stay quiet and hope it changes", outcomeHint: "The hero waits, but the people stay tired, and the hero's heart aches to do more.", metricDeltas: {} },
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
    parentInsight: {"en":"The archetype is the one who looks strong but is frightened inside — and learns that the roar comes after the brave step, not before it. It forms the understanding that fear visits everyone, even the lion, and that strength is something you grow by doing the hard thing once. In your child it builds quiet self-belief and the willingness to try. One thing to watch for: waiting and hiding feels safe and is honest, but it grows nothing — gently name the difference between resting and avoiding.","he":"הארכיטיפ הוא זה שנראה חזק אך מפוחד בפנים — ולומד שהשאגה מגיעה אחרי הצעד האמיץ, לא לפניו. הסיפור מטפח את ההבנה שפחד מבקר את כולם, אפילו את האריה, ושכוח הוא דבר שמגדלים על ידי עשיית הדבר הקשה פעם אחת. אצל הילד זה בונה אמונה עצמית שקטה ואת הנכונות לנסות. דבר אחד לשים לב אליו: לחכות ולהתחבא מרגיש בטוח וזה כן כנה, אבל זה לא מגדל כלום — תנו שם בעדינות להבדל בין מנוחה לבין הימנעות."},
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
          { id: "a", label: "Wait for morning light", outcomeHint: "The lion waits, but the cub is alone and cold, and the lion wishes it had gone.", metricDeltas: {} },
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
    parentInsight: {"en":"Noah is the archetype of the one who heeds the warning and prepares while others mock — responsibility is quiet and unseen until the day it isn't. It forms the discipline of doing the unglamorous, necessary work before anyone claps, because it needs doing. In your child it builds foresight and follow-through: the willingness to keep building when it would be easier to stop. One thing to watch for: 'too much work, play now' is an honest feeling, but the boat doesn't build itself — let the task stay real even when it's hard.","he":"נח הוא הארכיטיפ של מי שמקשיב לאזהרה ומתכונן בזמן שאחרים לועגים — אחריות היא שקטה ובלתי נראית עד היום שבו היא כבר לא. הסיפור מטפח את המשמעת של עשיית העבודה הלא-זוהרת והנחוצה לפני שמישהו מוחא כפיים, פשוט כי צריך לעשות אותה. אצל הילד זה בונה ראיית הנולד והתמדה: הנכונות להמשיך לבנות כשהיה קל יותר לעצור. דבר אחד לשים לב אליו: 'יותר מדי עבודה, בוא נשחק עכשיו' זו תחושה כנה, אבל התיבה לא נבנית לבד — תנו למשימה להישאר אמיתית גם כשהיא קשה."},
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
          { id: "a", label: "Stop — it's too much work", outcomeHint: "The hero rests the tools, but a worried feeling stays that the animals aren't safe yet.", metricDeltas: {} },
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
    parentInsight: {"en":"Jonah is the archetype of the call you flee — and the truth that the depths are exactly where you finally face yourself. It forms the understanding that running from what you're meant to do only postpones it, and that turning back to face it is itself a kind of growth. In your child it builds responsibility-as-honesty: the courage to stop hiding and answer. One thing to watch for: 'keep hiding' is a real and honest feeling worth naming, but hiding solves nothing — it deserves no praise, only gentle understanding.","he":"יונה הוא הארכיטיפ של הקריאה שאתה בורח ממנה — והאמת שדווקא במעמקים אתה לבסוף פוגש את עצמך. הסיפור מטפח את ההבנה שבריחה ממה שנועדת לעשות רק דוחה אותו, ושהפנייה חזרה אל מול הדבר היא בעצמה סוג של צמיחה. אצל הילד זה בונה אחריות-כיושר: האומץ להפסיק להתחבא ולהשיב. דבר אחד לשים לב אליו: 'להמשיך להתחבא' היא תחושה אמיתית וכנה שראוי לתת לה שם, אבל מהתחבאות לא נפתר דבר — היא לא ראויה לשבח, רק להבנה עדינה."},
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
          { id: "a", label: "Keep hiding in the deep", outcomeHint: "The hero stays hidden, but the faraway city still waits and the hero's heart feels heavy.", metricDeltas: {} },
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
    parentInsight: {"en":"Here the dragon is the small duty you neglect — and watch grow larger the longer you leave it. The archetype teaches that the thing you tend early stays small, while the thing you avoid feeds on the delay. It forms in your child the habit of facing the small task now, voluntarily, before it becomes a monster. One thing to watch for: 'play now, feed the dragon later' is the most natural choice in the world — name it honestly, but don't dress procrastination up as resilience.","he":"כאן הדרקון הוא החובה הקטנה שאתה מזניח — ורואה אותו גדל ככל שאתה משאיר אותו. הארכיטיפ מלמד שהדבר שמטפלים בו מוקדם נשאר קטן, בעוד שהדבר שנמנעים ממנו ניזון מהדחייה. אצל הילד זה בונה את ההרגל להתמודד עם המשימה הקטנה עכשיו, מרצון, לפני שהיא הופכת למפלצת. דבר אחד לשים לב אליו: 'נשחק עכשיו, נאכיל את הדרקון אחר כך' היא הבחירה הכי טבעית בעולם — תנו לה שם בכנות, אבל אל תלבישו על הדחיינות מעטה של חוסן."},
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
          { id: "a", label: "Play now, feed the flame later", outcomeHint: "The hero plays first; the flame flickers low and the village lanterns grow dim and cold.", metricDeltas: {} },
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
    parentInsight: {"en":"Joseph is the archetype of the one who is wronged and yet chooses, in time, to forgive rather than to stay hardened. It forms resilience of the deepest kind: the strength to carry a hurt without letting it turn you bitter, and to integrate it into something stronger. In your child it builds the capacity to bend without breaking, and to choose the bigger heart over the long grudge. One thing to watch for: 'staying angry' is honest and allowed for a while, but it grows nothing on its own — resilience is what comes after the anger is felt and set down.","he":"יוסף הוא הארכיטיפ של מי שנעשה לו עוול ובכל זאת בוחר, בבוא העת, לסלוח במקום להישאר מקשיח. הסיפור מטפח חוסן מהסוג העמוק ביותר: הכוח לשאת פגיעה בלי לתת לה להפוך אותך למריר, ולשלב אותה אל תוך משהו חזק יותר. אצל הילד זה בונה את היכולת להתכופף בלי להישבר, ולבחור בלב הגדול על פני הטינה הארוכה. דבר אחד לשים לב אליו: 'להישאר כועס' זה כן ומותר לזמן מה, אבל לבדו זה לא מגדל כלום — החוסן הוא מה שבא אחרי שהכעס מורגש ומונח בצד."},
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
          { id: "a", label: "Stay angry and turn them away", outcomeHint: "The hero keeps the door closed, but the old hurt stays heavy and the heart stays tight.", metricDeltas: {} },
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
    parentInsight: {"en":"Jacob is the archetype of wrestling the hard thing all night and coming through changed — with a new name to prove it. It forms the truth that real growth has a cost: you do not get the blessing without the struggle, and you do not come out the same person who went in. In your child it builds perseverance and the dignity of earned transformation. One thing to watch for: 'let go and walk away' is the easy relief, but the gift is in holding on through the night — honor the wish to quit without rewarding it.","he":"יעקב הוא הארכיטיפ של ההיאבקות עם הדבר הקשה כל הלילה והיציאה ממנה כשאתה כבר אחר — עם שם חדש שמעיד על כך. הסיפור מטפח את האמת שלצמיחה אמיתית יש מחיר: לא מקבלים את הברכה בלי המאבק, ולא יוצאים בתור אותו אדם שנכנס. אצל הילד זה בונה התמדה ואת הכבוד שבטרנספורמציה שנקנתה ביושר. דבר אחד לשים לב אליו: 'לשחרר וללכת' זו ההקלה הקלה, אבל המתנה היא בלהחזיק לאורך הלילה — כבדו את הרצון לוותר בלי לתגמל אותו."},
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
          { id: "a", label: "Let go and walk away", outcomeHint: "The hero releases and rests, but never learns what holding on a little longer might have given.", metricDeltas: {} },
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
    parentInsight: {"en":"This is the archetype of patient tending — the seed you water again and again, long before anything shows above the soil. It forms resilience as steady faith in slow work: that effort repeated without immediate reward is exactly how things grow. In your child it builds patience and the trust that practice quietly accumulates. One thing to watch for: 'give up' is honest when nothing seems to be happening, but giving up grows nothing — gently distinguish a true rest from abandoning the seed.","he":"זהו הארכיטיפ של הטיפוח הסבלני — הזרע שאתה משקה שוב ושוב, הרבה לפני שמשהו מבצבץ מעל לאדמה. הסיפור מטפח חוסן כאמונה יציבה בעבודה איטית: שמאמץ שחוזר על עצמו בלי תגמול מיידי הוא בדיוק האופן שבו דברים צומחים. אצל הילד זה בונה סבלנות ואת הביטחון שתרגול נצבר בשקט. דבר אחד לשים לב אליו: 'לוותר' זה כן כשנדמה שכלום לא קורה, אבל מוויתור לא צומח דבר — הבחינו בעדינות בין מנוחה אמיתית לבין נטישת הזרע."},
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
          { id: "a", label: "Give up on the empty soil", outcomeHint: "The hero stops watering; the soil stays bare, and the hero never sees what might have grown.", metricDeltas: {} },
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
    parentInsight: {"en":"Solomon is the archetype of the wise judge who slows down, listens, and lets the truth reveal itself before deciding. It forms the understanding that wisdom is not the fastest answer but the right one — that pausing to see clearly is strength, not weakness. In your child it builds discernment and the patience to weigh before acting. One thing to watch for: deciding fast can feel brave, but speed is not courage and haste is not wisdom — praise the careful look, not the quick grab.","he":"שלמה הוא הארכיטיפ של השופט החכם שמאט, מקשיב, ונותן לאמת להתגלות לפני שהוא מחליט. הסיפור מטפח את ההבנה שחוכמה אינה התשובה המהירה ביותר אלא הנכונה — שלעצור כדי לראות בבירור זה כוח, לא חולשה. אצל הילד זה בונה שיקול דעת ואת הסבלנות לשקול לפני שפועלים. דבר אחד לשים לב אליו: להחליט מהר יכול להרגיש אמיץ, אבל מהירות אינה אומץ וחיפזון אינו חוכמה — שבחו את ההתבוננות הזהירה, לא את התפיסה המהירה."},
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
          { id: "a", label: "Decide fast to be done", outcomeHint: "The hero picks quickly, but a doubt lingers about whether it was truly fair.", metricDeltas: {} },
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
  {
    id: "the-broken-music-box",
    pack: "truth",
    title: "The Broken Music Box",
    titleHe: "תֵּבַת הַנְּגִינָה שֶׁנִּשְׁבְּרָה",
    theme: "Owning a mistake when no one saw — telling the truth restores order and the bond, even when a lie feels easier.",
    themeHe: "לְהוֹדוֹת בְּטָעוּת גַּם כְּשֶׁאַף אֶחָד לֹא רָאָה — הָאֱמֶת מַחְזִירָה סֵדֶר וְקִרְבָה, גַּם כְּשֶׁשֶּׁקֶר נִרְאֶה קַל יוֹתֵר.",
    origin: "original",
    ageRange: [4, 8],
    primaryMetric: "truth",
    dilemmaType: "truth",
    baseReward: {"truth":2,"courage":1},
    learningObjective: "The child learns that a hidden mistake grows into a heavy worry, and that telling the truth — even when no one saw and even when it costs something — sets things right and makes the relationship strong again.",
    learningObjectiveHe: "הַיֶּלֶד לוֹמֵד שֶׁטָּעוּת מֻסְתֶּרֶת הוֹפֶכֶת לִדְאָגָה כְּבֵדָה, וְשֶׁאֲמִירַת הָאֱמֶת — גַּם כְּשֶׁאַף אֶחָד לֹא רָאָה וְגַם כְּשֶׁזֶּה עוֹלֶה בְּמַשֶּׁהוּ — מְתַקֶּנֶת אֶת הַדְּבָרִים וּמְחַזֶּקֶת אֶת הַקֶּשֶׁר.",
    parentReflection: {
      practiced: ["Naming the truth out loud even when it was scary","Letting an honest mistake have a real but kind consequence","Choosing to make things right instead of hiding"],
      practicedHe: ["לוֹמַר אֶת הָאֱמֶת בְּקוֹל גַּם כְּשֶׁמְּפַחֵד","לָתֵת לְטָעוּת כֵּנָה תּוֹצָאָה אֲמִתִּית אֲבָל טוֹבָה","לִבְחֹר לְתַקֵּן בִּמְקוֹם לְהַסְתִּיר"],
      questions: ["When was a time you told the truth even though it was hard?","What does a worry feel like in your tummy when you keep a secret?","How did it feel after you told the truth and we fixed it together?"],
      questionsHe: ["מָתַי אָמַרְתָּ אֶת הָאֱמֶת גַּם כְּשֶׁזֶּה הָיָה קָשֶׁה?","אֵיךְ מַרְגִּישָׁה דְּאָגָה בַּבֶּטֶן כְּשֶׁשּׁוֹמְרִים סוֹד?","אֵיךְ הִרְגַּשְׁתָּ אַחֲרֵי שֶׁאָמַרְתָּ אֶת הָאֱמֶת וְתִקַּנּוּ אֶת זֶה בְּיַחַד?"],
    },
    parentInsight: {"en":"A mistake made in private is a child's first real meeting with the dragon — the small lie that promises safety and quietly grows. By letting your child carry the true weight of the admission, and then meeting that honesty with warmth rather than punishment, you teach the deepest rule: tell the truth, and the world becomes ordered and trustworthy again. The aim is not a child who never breaks the music box, but one who learns that speaking the truth is what makes them strong enough to face the next hard thing.","he":"טָעוּת שֶׁנַּעֲשְׂתָה בַּסֵּתֶר הִיא הַמִּפְגָּשׁ הָאֲמִתִּי הָרִאשׁוֹן שֶׁל הַיֶּלֶד עִם הַדְּרָקוֹן — הַשֶּׁקֶר הַקָּטָן שֶׁמַּבְטִיחַ בִּטָּחוֹן וְגָדֵל בְּשֶׁקֶט. כְּשֶׁאַתֶּם נוֹתְנִים לַיֶּלֶד לָשֵׂאת אֶת מִשְׁקַל הַהוֹדָאָה הָאֲמִתִּי, וְאָז פּוֹגְשִׁים אֶת הַכֵּנוּת בְּחֹם וְלֹא בְּעֹנֶשׁ, אַתֶּם מְלַמְּדִים אֶת הַכְּלָל הֶעָמֹק בְּיוֹתֵר: אֱמֹר אֶת הָאֱמֶת, וְהָעוֹלָם שׁוּב נַעֲשֶׂה מְסֻדָּר וְנֶאֱמָן. הַמַּטָּרָה אֵינָהּ יֶלֶד שֶׁלְּעוֹלָם לֹא יִשְׁבֹּר אֶת תֵּבַת הַנְּגִינָה, אֶלָּא יֶלֶד שֶׁלּוֹמֵד שֶׁאֲמִירַת הָאֱמֶת הִיא מָה שֶׁמְּחַזֵּק אוֹתוֹ דַּי כְּדֵי לְהִתְמוֹדֵד עִם הַדָּבָר הַקָּשֶׁה הַבָּא."},
    beats: [
      { id: "call", title: "Grandpa's Special Music Box", titleHe: "תֵּבַת הַנְּגִינָה הַמְּיֻחֶדֶת שֶׁל סַבָּא", spine: "On a sunny shelf sits Grandpa's old wooden music box that plays a tiny silver song he loves most.", spineHe: "עַל מַדָּף שָׁטוּף שֶׁמֶשׁ עוֹמֶדֶת תֵּבַת נְגִינָה עַתִּיקָה שֶׁל סַבָּא, שֶׁמְּנַגֶּנֶת שִׁיר כֶּסֶף קָטָן שֶׁהוּא הֲכִי אוֹהֵב." },
      { id: "challenge", title: "Just One Little Wind-Up", titleHe: "רַק סִבּוּב קָטָן אֶחָד", spine: "Alone in the room, the child reaches up to wind the box one more time — and it slips and clinks to the floor.", spineHe: "לְבַד בַּחֶדֶר, הַיֶּלֶד מוֹשֵׁךְ אֶת יָדוֹ לְסוֹבֵב אֶת הַתֵּבָה עוֹד פַּעַם — וְהִיא חוֹמֶקֶת וְנוֹפֶלֶת בִּצְלִיל אֶל הָרִצְפָּה." },
      { id: "fear", title: "The Silent Song", titleHe: "הַשִּׁיר שֶׁנֶּאֱלַם", spine: "The lid hangs loose and the silver song won't play — and a sneaky whisper says, 'Hide it, no one saw.'", spineHe: "הַמִּכְסֶה תָּלוּי רָפוּי וְשִׁיר הַכֶּסֶף לֹא מְנַגֵּן — וּלְחִישָׁה עַרְמוּמִית אוֹמֶרֶת: 'תַּסְתִּיר, אַף אֶחָד לֹא רָאָה.'" },
      { id: "decision", title: "What Will I Do?", titleHe: "מָה אֶעֱשֶׂה?", spine: "The child stands between the broken box and Grandpa's footsteps coming down the hall.", spineHe: "הַיֶּלֶד עוֹמֵד בֵּין הַתֵּבָה הַשְּׁבוּרָה לְבֵין צַעֲדֵי סַבָּא שֶׁמִּתְקָרְבִים בַּמִּסְדְּרוֹן.",
        choices: [
          { id: "a", label: "Push the box back and say nothing.", labelHe: "לִדְחֹף אֶת הַתֵּבָה חֲזָרָה וְלֹא לוֹמַר כְּלוּם.", outcomeHint: "Nobody finds out today — but the secret sits heavy and the worry grows bigger every hour.", outcomeHintHe: "אַף אֶחָד לֹא מְגַלֶּה הַיּוֹם — אֲבָל הַסּוֹד יוֹשֵׁב כָּבֵד וְהַדְּאָגָה גְּדֵלָה מִשָּׁעָה לְשָׁעָה.", metricDeltas: {} },
          { id: "b", label: "Ask Mom how to make it right.", labelHe: "לִשְׁאֹל אֶת אִמָּא אֵיךְ לְתַקֵּן אֶת זֶה.", outcomeHint: "Mom helps you find gentle words and a way to mend it — sharing the worry makes it lighter.", outcomeHintHe: "אִמָּא עוֹזֶרֶת לְךָ לִמְצֹא מִלִּים רַכּוֹת וְדֶרֶךְ לְתַקֵּן — לַחְלֹק אֶת הַדְּאָגָה מֵקֵל עָלֶיהָ.", metricDeltas: {"wisdom":1,"empathy":1} },
          { id: "c", label: "Walk to Grandpa and tell the truth.", labelHe: "לָלֶכֶת אֶל סַבָּא וְלוֹמַר אֶת הָאֱמֶת.", outcomeHint: "Your voice shakes and your cheeks go warm — telling him costs courage, and it sets everything right.", outcomeHintHe: "הַקּוֹל שֶׁלְּךָ רוֹעֵד וְהַלְּחָיַיִם מִתְחַמְּמוֹת — לְסַפֵּר לוֹ עוֹלֶה בְּאֹמֶץ, וְזֶה מְתַקֵּן הַכֹּל.", metricDeltas: {"truth":2,"courage":1} },
        ],
      },
      { id: "consequence", title: "The Heavy Truth", titleHe: "הָאֱמֶת הַכְּבֵדָה", spine: "The truth costs a wobbly voice and a sorry-sad moment — Grandpa's eyes are quiet, but he listens to every word.", spineHe: "הָאֱמֶת עוֹלָה בְּקוֹל רוֹעֵד וּבְרֶגַע שֶׁל צַעַר — עֵינָיו שֶׁל סַבָּא שְׁקֵטוֹת, אֲבָל הוּא מַקְשִׁיב לְכָל מִלָּה." },
      { id: "growth", title: "Mending It Together", titleHe: "מְתַקְּנִים בְּיַחַד", spine: "Side by side they fit the lid back and oil the little gears — honesty turned a scary moment into a shared one.", spineHe: "זֶה לְצַד זֶה הֵם מַחְזִירִים אֶת הַמִּכְסֶה וּמְשַׁמְּנִים אֶת הַגַּלְגַּלִּים הַקְּטַנִּים — הַכֵּנוּת הָפְכָה רֶגַע מַפְחִיד לְרֶגַע מְשֻׁתָּף." },
      { id: "victory", title: "The Song Returns", titleHe: "הַשִּׁיר חוֹזֵר", spine: "The silver song chimes again, and Grandpa hugs the child close: 'Thank you for telling me the truth.'", spineHe: "שִׁיר הַכֶּסֶף מְצַלְצֵל שׁוּב, וְסַבָּא מְחַבֵּק אֶת הַיֶּלֶד חָזָק: 'תּוֹדָה שֶׁאָמַרְתָּ לִי אֶת הָאֱמֶת.'" },
      { id: "reflection", title: "Lighter Than Before", titleHe: "קַל יוֹתֵר מִקֹּדֶם", spine: "That night the worry is gone, and the child knows: truth is heavy to say but light to carry.", spineHe: "בַּלַּיְלָה הַהוּא הַדְּאָגָה נֶעֶלְמָה, וְהַיֶּלֶד יוֹדֵעַ: אֱמֶת כְּבֵדָה לוֹמַר אֲבָל קַלָּה לָשֵׂאת." },
    ],
  },
  {
    id: "the-found-acorn-crown",
    pack: "truth",
    title: "The Found Crown",
    titleHe: "הכתר שנמצא",
    theme: "Returning what is not yours, and mending trust through honest repair",
    themeHe: "להחזיר את מה שאינו שלך, ולתקן את האמון דרך יושר",
    origin: "biblical",
    ageRange: [4, 8],
    primaryMetric: "truth",
    dilemmaType: "repair",
    baseReward: {"truth":2,"responsibility":1},
    learningObjective: "The child learns that keeping something that isn't theirs feels good for a moment but heavy forever; telling the truth and giving it back, even when it costs, is what restores trust and makes you whole.",
    learningObjectiveHe: "הילד לומד שלהחזיק במשהו שאינו שלו מרגיש טוב לרגע אך כבד לתמיד; לומר את האמת ולהחזיר, גם כשזה מחיר, הוא מה שמשיב את האמון ועושה אותך שלם.",
    parentReflection: {
      practiced: ["Naming the 'heavy, hiding feeling' that comes with keeping something that isn't ours","Choosing to return what was found even when it meant losing something they loved","Speaking the whole truth out loud to the person they had wronged"],
      practicedHe: ["לתת שם ל'תחושה הכבדה והמסתתרת' שמלווה החזקה במשהו שאינו שלנו","לבחור להחזיר את מה שנמצא גם כשזה אומר לוותר על משהו שאהבו","לומר בקול את כל האמת לאדם שכלפיו שגו"],
      questions: ["Has there ever been a time you found something and weren't sure whose it was? What did you do?","How did Tamar's tummy feel when she hid the crown, and how did it feel after she gave it back?","Why do you think Oz could trust Tamar more after she told the truth, even though she had taken his crown?"],
      questionsHe: ["האם היה פעם שמצאת משהו ולא היית בטוח של מי הוא? מה עשית?","איך הרגישה הבטן של תמר כשהחביאה את הכתר, ואיך הרגישה אחרי שהחזירה אותו?","למה לדעתך עוז יכול היה לבטוח בתמר יותר אחרי שאמרה את האמת, למרות שלקחה את הכתר שלו?"],
    },
    parentInsight: {"en":"This story gives your child a felt experience of the central rule: tell the truth. The crown is genuinely beautiful and the cost of returning it is real — we don't pretend honesty is free. What the child learns is that a gain held through a lie sits heavy, while truth voluntarily spoken restores something far more valuable: trust, and an unburdened heart. By letting Tamar feel the pull to keep it and choose return anyway, the story forms the inner muscle that lets a child later face bigger temptations and still aim at the good.","he":"הסיפור הזה מעניק לילדכם חוויה מורגשת של הכלל המרכזי: לומר את האמת. הכתר באמת יפה והמחיר של ההחזרה אמיתי — איננו מעמידים פנים שיושר הוא חינם. מה שהילד לומד הוא שרווח שמוחזק דרך שקר יושב כבד, בעוד אמת שנאמרת מרצון משיבה משהו יקר הרבה יותר: אמון ולב נקי מנטל. בכך שאנו נותנים לתמר להרגיש את המשיכה להשאיר ולבחור בכל זאת להחזיר, הסיפור מחשל את השריר הפנימי שיאפשר לילד בהמשך להתמודד עם פיתויים גדולים יותר ועדיין לכוון אל הטוב."},
    beats: [
      { id: "call", title: "A Glittering Find", titleHe: "מציאה נוצצת", spine: "Tamar the fox cub finds a beautiful woven crown of leaves and bright berries lying on the river path, sparkling just for her.", spineHe: "תָּמָר גורת השועל מוצאת על שביל הנהר כתר יפה קלוע מעלים ומגרגרי יער זוהרים, נוצץ בדיוק בשבילה." },
      { id: "challenge", title: "Whose Crown?", titleHe: "של מי הכתר?", spine: "She slips it on and feels like a queen, but she remembers the crown belongs to little Oz, who lost it crying yesterday.", spineHe: "היא חובשת אותו ומרגישה כמו מלכה, אך נזכרת שהכתר שייך לעוז הקטן, שאיבד אותו ובכה אתמול." },
      { id: "fear", title: "The Heavy Feeling", titleHe: "התחושה הכבדה", spine: "Keeping it would be easy and no one saw her, but a heavy, hiding feeling sits in her tummy and won't go away.", spineHe: "להשאיר אותו זה קל ואיש לא ראה אותה, אך תחושה כבדה ומסתתרת יושבת לה בבטן ולא עוזבת." },
      { id: "decision", title: "What Will Tamar Do?", titleHe: "מה תעשה תמר?", spine: "Hide the crown and stay quiet, ask a friend to help her decide, or walk straight to Oz and tell the whole truth.", spineHe: "להחביא את הכתר ולשתוק, לבקש מחבר עזרה בהחלטה, או ללכת ישר לעוז ולספר את כל האמת.",
        choices: [
          { id: "a", label: "Hide it and say nothing", labelHe: "להחביא אותו ולא לומר כלום", outcomeHint: "Tamar buries the crown under the leaves. No one will know — but the heavy feeling stays, and Oz is still searching by the river.", outcomeHintHe: "תמר טומנת את הכתר מתחת לעלים. איש לא יֵדע — אך התחושה הכבדה נשארת, ועוז עדיין מחפש ליד הנהר.", metricDeltas: {} },
          { id: "b", label: "Ask a friend what to do", labelHe: "לשאול חבר מה לעשות", outcomeHint: "Tamar asks wise old Hare, who listens kindly and helps her find the words. Sharing the worry makes it lighter, and together they think it through.", outcomeHintHe: "תמר שואלת את הארנב הזקן והחכם, שמקשיב בעדינות ועוזר לה למצוא את המילים. השיתוף מקל על הדאגה, וביחד הם חושבים על זה.", metricDeltas: {"empathy":1,"wisdom":1} },
          { id: "c", label: "Walk to Oz and tell the truth", labelHe: "ללכת לעוז ולספר את האמת", outcomeHint: "Tamar's paws shake as she gives back the crown she loved and says 'I found this and wanted to keep it — but it's yours.' It costs her the crown, but her chest feels light and clean.", outcomeHintHe: "כפות רגליה של תמר רועדות כשהיא מחזירה את הכתר שאהבה ואומרת 'מצאתי אותו ורציתי להשאיר — אבל הוא שלך.' זה עולה לה בכתר, אך ליבה מרגיש קל ונקי.", metricDeltas: {"truth":2,"empathy":1} },
        ],
      },
      { id: "consequence", title: "The Cost and the Light", titleHe: "המחיר והאור", spine: "Giving the crown back means Tamar's paws are empty now, and that is real — but the hiding-feeling lifts and she can breathe.", spineHe: "להחזיר את הכתר אומר שכפות רגליה של תמר ריקות עכשיו, וזה אמיתי — אך התחושה המסתתרת מתפוגגת והיא יכולה לנשום." },
      { id: "growth", title: "Oz Smiles Again", titleHe: "עוז מחייך שוב", spine: "Oz's sad face opens into a huge smile, and he sees Tamar not as someone who took, but as someone he can trust.", spineHe: "פניו העצובות של עוז נפתחות לחיוך ענק, והוא רואה בתמר לא מי שלקחה, אלא מישהי שאפשר לבטוח בה." },
      { id: "victory", title: "A Crown They Share", titleHe: "כתר שחולקים", spine: "Oz lets Tamar wear the crown for a turn and they weave a second one together, and trust given back is bigger than any treasure kept.", spineHe: "עוז נותן לתמר לחבוש את הכתר בתורה והם קולעים יחד כתר שני, והאמון שהושב גדול מכל אוצר ששמרת לעצמך." },
      { id: "reflection", title: "Light as a Feather", titleHe: "קלה כנוצה", spine: "Tamar learns the truth can cost you a treasure, but it gives you back something you can't see and never want to lose: a clean, light heart.", spineHe: "תמר לומדת שהאמת יכולה לעלות לך באוצר, אך היא מחזירה לך משהו שאי אפשר לראות ולעולם לא תרצה לאבד: לב נקי וקל." },
    ],
  },
  {
    id: "the-two-gifts",
    pack: "responsibility",
    title: "The Two Gifts",
    titleHe: "שתי המתנות",
    theme: "Owning your resentment when your gift isn't the one praised",
    themeHe: "לקחת אחריות על הקנאה כשהמתנה שלך לא זוכה לשבחים",
    origin: "biblical",
    ageRange: [4, 8],
    primaryMetric: "responsibility",
    dilemmaType: "truth",
    baseReward: {"responsibility":2,"truth":1},
    learningObjective: "The child learns that when someone else's effort is praised instead of theirs, the bitter feeling at the door is theirs to face. They can feed the grudge or take responsibility, tell the truth about how they feel, and choose to bring their genuine best anyway.",
    learningObjectiveHe: "הילד לומד שכאשר משבחים את המאמץ של מישהו אחר ולא את שלו, ההרגשה המרה שדופקת בדלת היא באחריותו. אפשר להאכיל את הטינה, או לקחת אחריות, לומר את האמת על מה שמרגישים, ולבחור בכל זאת להביא את המיטב האמיתי.",
    parentReflection: {
      practiced: ["Naming a hard feeling out loud instead of hiding it or blaming someone else","Taking responsibility for your own resentment rather than handing the blame to the person who was praised","Choosing to offer your genuine best even when it is not the gift everyone cheered for"],
      practicedHe: ["לתת שם בקול להרגשה קשה במקום להסתיר אותה או להאשים מישהו אחר","לקחת אחריות על הקנאה של עצמך במקום להעביר את האשמה למי שזכה לשבח","לבחור להציע את המיטב האמיתי שלך גם כשזו לא המתנה שכולם הריעו לה"],
      questions: ["Has there been a time someone else got the praise and you felt the hot, bitter feeling? Where did you feel it in your body?","Whose job is it to take care of that bitter feeling when it knocks at your door?","What is the very best thing you made with your own hands that you would be proud to share, even if no one clapped?"],
      questionsHe: ["היה פעם מצב שמישהו אחר קיבל את השבח ואתה הרגשת את ההרגשה החמה והמרה? איפה בגוף הרגשת אותה?","של מי התפקיד לטפל בהרגשה המרה הזאת כשהיא דופקת בדלת שלך?","מה הדבר הכי טוב שיצרת בידיים שלך, שתהיה גאה לחלוק גם אם אף אחד לא ימחא כפיים?"],
    },
    parentInsight: {"en":"This is the oldest story about resentment: when our offering is overlooked and another's is praised, a bitter thing crouches at the door, and the whole of a child's future character can turn on what they do with it. The story does not tell your child the feeling is wrong — it teaches that the feeling is theirs to face honestly and master, not to nurse or to aim at the person who was praised. Practiced young, this builds the rare strength of taking responsibility for one's own inner state, which is the quiet root of both humility and resilience.","he":"זהו הסיפור העתיק ביותר על טינה: כשהמנחה שלנו נעלמת מן העין ושל אחר זוכה לשבח, דבר מר רובץ לפתח, וכל אופיו העתידי של ילד עשוי להיחתך לפי מה שהוא עושה עם זה. הסיפור לא אומר לילד שההרגשה שגויה — הוא מלמד שההרגשה היא שלו לשאת ולהתמודד איתה ביושר, לא לטפח אותה ולא לכוון אותה אל מי שזכה לשבח. כשמתרגלים זאת מגיל צעיר, נבנה הכוח הנדיר של לקיחת אחריות על העולם הפנימי, שהוא השורש השקט של הענווה והחוסן כאחד."},
    beats: [
      { id: "call", title: "The Harvest Festival", titleHe: "חג היבול", spine: "Two young farmer brothers, Tan and Aval, each prepare a gift to bring to the village Harvest Festival, proud of what their own hands made.", spineHe: "שני אחים חקלאים צעירים, תן ואבל, מכינים כל אחד מתנה להביא לחג היבול בכפר, גאים במה שידיהם יצרו." },
      { id: "challenge", title: "Only One Is Praised", titleHe: "רק אחד זוכה לשבח", spine: "The whole village cheers warmly for Aval's basket of fruit, but barely glances at Tan's bundle of grain, and Tan feels his chest grow hot.", spineHe: "כל הכפר מריע בחום לסל הפירות של אבל, אך בקושי מעיף מבט באלומת התבואה של תן, ותן מרגיש את החזה שלו מתחמם." },
      { id: "fear", title: "The Knock at the Door", titleHe: "הדפיקה בדלת", spine: "That night a low grumbly Grudge-shadow scratches at Tan's door, whispering that Aval was loved more and that Tan should stay angry and small.", spineHe: "באותו לילה צל-טינה נמוך ורוטן מגרד בדלת של תן, ולוחש שאבל אהוב יותר ושעל תן להישאר כועס וקטן." },
      { id: "decision", title: "Feed It or Face It", titleHe: "להאכיל אותה או להתמודד איתה", spine: "Tan stands at the door with the shadow waiting outside and must decide what to do with the heavy, bitter feeling.", spineHe: "תן עומד ליד הדלת בזמן שהצל מחכה בחוץ, ועליו להחליט מה לעשות עם ההרגשה הכבדה והמרה.",
        choices: [
          { id: "a", label: "Pull the blanket over your head and pretend the feeling isn't there.", labelHe: "למשוך את השמיכה מעל הראש ולהעמיד פנים שההרגשה לא קיימת.", outcomeHint: "Tan hides and the shadow simply waits by the door all night; nothing changes and the bitter feeling is still there in the morning. He is honest with himself that he ran away.", outcomeHintHe: "תן מתחבא והצל פשוט מחכה ליד הדלת כל הלילה; כלום לא משתנה וההרגשה המרה עדיין שם בבוקר. הוא ישר עם עצמו שהוא ברח.", metricDeltas: {} },
          { id: "b", label: "Go wake your brother and ask him to help you understand the feeling.", labelHe: "ללכת להעיר את אחיך ולבקש ממנו לעזור לך להבין את ההרגשה.", outcomeHint: "Aval listens kindly, and together they name the feeling out loud; sharing it makes it smaller, though the door still rattles a little.", outcomeHintHe: "אבל מקשיב בחמלה, וביחד הם נותנים שם להרגשה בקול; השיתוף מקטין אותה, אם כי הדלת עדיין רועדת קצת.", metricDeltas: {"empathy":1,"wisdom":1} },
          { id: "c", label: "Open the door, look the shadow in the eye, and say 'This bitter feeling is mine to carry' — then choose to bring your very best grain to share.", labelHe: "לפתוח את הדלת, להביט לצל בעיניים ולומר 'ההרגשה המרה הזאת היא שלי לשאת' — ואז לבחור להביא את התבואה הכי טובה שלי לחלוק.", outcomeHint: "Owning the feeling costs Tan his comfortable anger and a long, hard night of work re-sorting his finest grain, but the shadow shrinks as he takes responsibility for what is his.", outcomeHintHe: "לקיחת האחריות על ההרגשה עולה לתן בכעס הנוח שלו ובלילה ארוך וקשה של עבודה במיון התבואה המשובחת ביותר, אך הצל מתכווץ ככל שהוא לוקח אחריות על מה ששייך לו.", metricDeltas: {"responsibility":2,"truth":1} },
        ],
      },
      { id: "consequence", title: "What the Choice Costs", titleHe: "מה הבחירה עולה", spine: "Naming the bitter feeling as his own is hard and tiring, and Tan must give up the easy comfort of blaming Aval before the shadow begins to fade.", spineHe: "לתת להרגשה המרה שם משלו זה קשה ומעייף, ותן צריך לוותר על הנוחות הקלה של להאשים את אבל לפני שהצל מתחיל להתעמעם." },
      { id: "growth", title: "Carrying What Is Mine", titleHe: "לשאת את מה ששלי", spine: "By morning Tan understands that the feeling was never Aval's fault, and that taking responsibility for it makes him stand taller than the grudge ever could.", spineHe: "עד הבוקר תן מבין שההרגשה מעולם לא הייתה אשמתו של אבל, ושלקיחת אחריות עליה גורמת לו לעמוד זקוף יותר משהטינה אי פעם יכלה." },
      { id: "victory", title: "The Best Grain, Freely Given", titleHe: "התבואה הטובה ביותר, ניתנת בלב שלם", spine: "Tan returns to the festival and offers his finest grain to share with everyone, smiling beside his brother, and the Grudge-shadow has nowhere left to hide.", spineHe: "תן חוזר לחג ומציע את התבואה המשובחת ביותר שלו לחלוק עם כולם, מחייך לצד אחיו, ולצל-הטינה לא נשאר מקום להסתתר." },
      { id: "reflection", title: "Who I Was Yesterday", titleHe: "מי שהייתי אתמול", spine: "Tan looks back and sees he is braver than the boy who almost let the bitter feeling rule him, proud not of beating his brother but of mastering himself.", spineHe: "תן מביט לאחור ורואה שהוא אמיץ יותר מהילד שכמעט נתן להרגשה המרה לשלוט בו, גאה לא בכך שניצח את אחיו אלא בכך שהשתלט על עצמו." },
    ],
  },
  {
    id: "leave-the-tent",
    pack: "courage",
    title: "Leave the Tent",
    titleHe: "לצאת מן האוהל",
    theme: "Stepping from safety into the unknown toward a promise bigger than yourself",
    themeHe: "יציאה מן המוּכר אל הלא־נודע, אל הבטחה גדולה ממך",
    origin: "biblical",
    ageRange: [4, 8],
    primaryMetric: "courage",
    dilemmaType: "courage",
    baseReward: {"courage":2,"wisdom":1},
    learningObjective: "Children learn that real courage means choosing to leave a safe, familiar place to follow a good and important calling, and that this choice costs something but leads to growth they could not reach by staying.",
    learningObjectiveHe: "הילדים לומדים שאומץ אמיתי הוא לבחור לעזוב מקום בטוח ומוכר כדי ללכת אחרי קריאה טובה וחשובה, ושהבחירה הזו עולה במשהו אך מובילה לצמיחה שאי אפשר היה להגיע אליה בהישארות.",
    parentReflection: {
      practiced: ["Choosing to leave comfort for a worthwhile aim","Carrying a worry along instead of waiting for it to vanish","Comparing who you are today to who you were yesterday"],
      practicedHe: ["לבחור לעזוב את הנוחות למען מטרה ראויה","לשאת דאגה בדרך במקום לחכות שהיא תיעלם","להשוות מי אתה היום למי שהיית אתמול"],
      questions: ["Was there a time you wanted something good but had to leave something cozy to reach it?","What helped Ari keep walking even when he missed his tent?","What is one small 'unknown' road you'd be brave enough to start this week?"],
      questionsHe: ["היה רגע שרצית משהו טוב אבל היית צריך לעזוב משהו נעים כדי להגיע אליו?","מה עזר לאֲרִי להמשיך ללכת גם כשהתגעגע לאוהל שלו?","מהי דרך 'לא־נודעת' קטנה אחת שתהיה אמיץ מספיק להתחיל בה השבוע?"],
    },
    parentInsight: {"en":"This is the oldest pattern of becoming: a person hears a call to something higher and must voluntarily leave the safety they know to answer it. The story lets your child rehearse that the brave path is the one that costs comfort — and that the cost is exactly what makes the growth real, not a punishment to be avoided. By honoring the 'stay' choice as honest rather than shaming it, you teach that courage is chosen, not coerced, and worth choosing because it aims at a genuine good.","he":"זוהי התבנית העתיקה ביותר של ההתבגרות: אדם שומע קריאה למשהו גבוה יותר ועליו לעזוב מרצונו את הביטחון המוכר כדי להיענות לה. הסיפור מאפשר לילדכם להתאמן בכך שהדרך האמיצה היא זו שעולה בנוחות — ושהמחיר הזה הוא בדיוק מה שהופך את הצמיחה לאמיתית, ולא עונש שיש להימנע ממנו. בכך שאנו מכבדים את בחירת 'ההישארות' כבחירה כנה ולא מביישים אותה, אנו מלמדים שאומץ נבחר ולא נכפה, וששווה לבחור בו כי הוא מכוון אל טוב אמיתי."},
    beats: [
      { id: "call", title: "A Voice Across the Hills", titleHe: "קול מעבר לגבעות", spine: "Young Ari hears a gentle, true voice on the wind: 'Leave your tent and walk toward a good land you have never seen.'", spineHe: "אֲרִי הקטן שומע ברוח קול עדין ואמיתי: 'צא מן האוהל שלך ולֵך אל ארץ טובה שמעולם לא ראית.'" },
      { id: "challenge", title: "Everything Loved Is Here", titleHe: "כל מה שאהוב נמצא כאן", spine: "Ari looks around the warm tent — the soft rug, the cooking fire, every friend he knows — and the good land lies somewhere far past the edge of the map.", spineHe: "אֲרִי מביט סביב באוהל החמים — השטיח הרך, אש הבישול, כל חבר שהוא מכיר — והארץ הטובה נמצאת אי־שם הרחק מעבר לקצה המפה." },
      { id: "fear", title: "What If the Road Is Empty", titleHe: "ומה אם הדרך ריקה", spine: "His tummy tightens: the unknown road feels big and dark, and a small worried voice whispers, 'What if you get lost and the promise isn't real?'", spineHe: "הבטן שלו מתכווצת: הדרך הלא־נודעת נראית גדולה וחשוכה, וקול קטן ומודאג לוחש: 'ומה אם תלך לאיבוד והבטחה איננה אמיתית?'" },
      { id: "decision", title: "Stay, Walk Together, or Step Out", titleHe: "להישאר, ללכת יחד, או לצעוד החוצה", spine: "Ari stands at the open tent flap with the wind on his face and must choose what to do with the voice he heard.", spineHe: "אֲרִי עומד בפתח האוהל הפתוח, הרוח על פניו, ועליו לבחור מה לעשות עם הקול ששמע.",
        choices: [
          { id: "a", label: "Close the flap and stay where it's warm.", labelHe: "לסגור את הפתח ולהישאר במקום החמים.", outcomeHint: "Ari tells himself the truth — he isn't ready today. The tent stays cozy, but the good land stays a faraway dream he didn't move toward. That's honest, not brave.", outcomeHintHe: "אֲרִי אומר לעצמו את האמת — הוא לא מוכן היום. האוהל נשאר נעים, אבל הארץ הטובה נשארת חלום רחוק שלא התקרב אליו. זה כֵּן, לא אמיץ.", metricDeltas: {} },
          { id: "b", label: "Wake a friend and ask them to come along.", labelHe: "להעיר חבר ולבקש שיבוא יחד.", outcomeHint: "Ari asks for company and a kind friend says yes. Walking together makes the first steps gentler — a wise, warm way to begin.", outcomeHintHe: "אֲרִי מבקש חברה וחבר טוב־לב מסכים. ללכת יחד הופך את הצעדים הראשונים לרכים יותר — דרך חכמה וחמה להתחיל.", metricDeltas: {"empathy":1,"courage":1} },
          { id: "c", label: "Pick up your little pack and step onto the road alone.", labelHe: "להרים את הצרור הקטן ולצעוד אל הדרך לבד.", outcomeHint: "Ari leaves the warm tent behind — he'll miss the soft rug and the fire — and walks into the unknown because the good land matters more than his comfort. That costs something, and that is real courage.", outcomeHintHe: "אֲרִי משאיר מאחור את האוהל החם — הוא יתגעגע לשטיח הרך ולאש — וצועד אל הלא־נודע כי הארץ הטובה חשובה יותר מהנוחות שלו. זה עולה במשהו, וזה אומץ אמיתי.", metricDeltas: {"courage":2,"responsibility":1} },
        ],
      },
      { id: "consequence", title: "The First Night Out", titleHe: "הלילה הראשון בחוץ", spine: "The road is long and the first night is chilly and strange; Ari misses his tent, yet he keeps the voice and the promise close like a small warm stone in his pocket.", spineHe: "הדרך ארוכה והלילה הראשון קריר וזר; אֲרִי מתגעגע לאוהל שלו, אך הוא שומר על הקול ועל ההבטחה קרובים כמו אבן קטנה וחמה בכיס." },
      { id: "growth", title: "Stronger With Every Step", titleHe: "חזק יותר עם כל צעד", spine: "Day by day Ari learns to find water, follow stars, and trust his own steady feet; the fear grows quieter as his courage grows taller.", spineHe: "יום אחר יום אֲרִי לומד למצוא מים, לעקוב אחר הכוכבים ולסמוך על רגליו היציבות; הפחד נעשה שקט יותר ככל שהאומץ שלו נעשה גבוה יותר." },
      { id: "victory", title: "The Good Land Opens", titleHe: "הארץ הטובה נפתחת", spine: "Over a final hill the good land spreads out — green, wide, and welcoming — and Ari knows he could only reach it because he dared to leave the tent.", spineHe: "מעבר לגבעה אחרונה נפרשת הארץ הטובה — ירוקה, רחבה ומזמינה — ואֲרִי יודע שהגיע אליה רק מפני שהעז לצאת מן האוהל." },
      { id: "reflection", title: "Braver Than Yesterday", titleHe: "אמיץ יותר מאתמול", spine: "Resting in the new land, Ari smiles: he is not the same cub who hid in the warm tent — he chose the unknown for something good, and he grew.", spineHe: "נח בארץ החדשה, אֲרִי מחייך: הוא כבר לא אותו גור שהתחבא באוהל החם — הוא בחר בלא־נודע למען משהו טוב, והוא צמח." },
    ],
  },
  {
    id: "the-two-paths-through-the-meadow",
    pack: "wisdom",
    title: "The Two Paths Through the Meadow",
    titleHe: "שני השבילים באחו",
    theme: "Stop and think at the fork: the fast shiny path versus the slower wise path",
    themeHe: "לעצור ולחשוב בהצטלבות: השביל המהיר והנוצץ מול השביל האיטי והחכם",
    origin: "original",
    ageRange: [4, 8],
    primaryMetric: "wisdom",
    dilemmaType: "prudence",
    baseReward: {"wisdom":2,"responsibility":1},
    learningObjective: "The child learns that the fastest, shiniest path is not always the right one, and that stopping to look, ask, and think before acting is a kind of strength.",
    learningObjectiveHe: "הילד לומד שהשביל המהיר והנוצץ ביותר הוא לא תמיד הנכון, ושעצירה כדי להסתכל, לשאול ולחשוב לפני שפועלים היא סוג של כוח.",
    parentReflection: {
      practiced: ["Pausing at a decision instead of grabbing the first option","Looking closely at what a choice really costs before acting","Trusting your own careful judgment after gathering the facts"],
      practicedHe: ["לעצור רגע לפני החלטה במקום לתפוס את האפשרות הראשונה","להתבונן היטב במחיר האמיתי של בחירה לפני שפועלים","לסמוך על שיקול הדעת הזהיר שלך אחרי שאספת את העובדות"],
      questions: ["Can you remember a time the fast way turned out to be the wrong way?","What helps you slow down when you really, really want to rush?","How can you tell the difference between a shiny choice and a wise choice?"],
      questionsHe: ["אתה זוכר פעם שהדרך המהירה התבררה כדרך הלא נכונה?","מה עוזר לך להאט כשאתה ממש ממש רוצה למהר?","איך אפשר להבדיל בין בחירה נוצצת לבחירה חכמה?"],
    },
    parentInsight: {"en":"Children are wired to chase the bright, fast reward, and the hardest discipline to form early is the pause before action — the small space where thinking happens. This story rewards that pause itself, not boldness, so your child learns that the wisest move sometimes looks like doing nothing for a moment. By letting the shortcut have a real cost, it teaches that prudence is not fear; it is aiming carefully at the good thing you actually want to reach.","he":"ילדים בנויים לרדוף אחרי התגמול הבהיר והמהיר, והמשמעת הקשה ביותר לפתח בגיל צעיר היא העצירה שלפני הפעולה — הרווח הקטן שבו מתרחשת המחשבה. הסיפור מתגמל את העצירה עצמה, לא את האומץ, כך שהילד לומד שלעיתים המהלך החכם ביותר נראה כמו לא לעשות דבר לרגע. בכך שהקיצור משלם מחיר אמיתי, הסיפור מלמד שזהירות אינה פחד; היא כיוון מדויק אל הדבר הטוב שאליו באמת רוצים להגיע."},
    beats: [
      { id: "call", title: "A Promise to Keep", titleHe: "הבטחה שצריך לקיים", spine: "Little Fennec the fox cub promises to bring Grandmother her warm honey-bread before the sun goes down behind the hills.", spineHe: "פנק השועלון הקטן מבטיח להביא לסבתא את לחם הדבש החם שלה לפני שהשמש שוקעת מאחורי הגבעות." },
      { id: "challenge", title: "The Fork in the Meadow", titleHe: "ההצטלבות באחו", spine: "Halfway across the meadow the trail splits in two, and Fennec must choose which way carries the bread safely home.", spineHe: "באמצע האחו השביל מתפצל לשניים, ופנק צריך לבחור באיזו דרך הלחם יגיע הביתה בשלום." },
      { id: "fear", title: "The Shiny Quick Way", titleHe: "הדרך המהירה והנוצצת", spine: "One path glitters short and golden but dips toward a muddy marsh; the other winds long and quiet around the safe high grass.", spineHe: "שביל אחד נוצץ, קצר וזהוב אך יורד אל ביצה בוצית; השני מתפתל ארוך ושקט סביב העשב הגבוה והבטוח." },
      { id: "decision", title: "Stop and Think", titleHe: "לעצור ולחשוב", spine: "Heart racing, Fennec stands at the fork and must decide: rush, ask, or stop and study the two paths.", spineHe: "הלב דופק, פנק עומד בהצטלבות וצריך להחליט: למהר, לשאול, או לעצור ולבחון את שני השבילים.",
        choices: [
          { id: "a", label: "Turn back home empty-pawed", labelHe: "לחזור הביתה בידיים ריקות", outcomeHint: "Fennec gives up and walks home; the bread never reaches Grandmother, and that is the honest truth of choosing not to try.", outcomeHintHe: "פנק מוותר וחוזר הביתה; הלחם לא מגיע לסבתא, וזו האמת הכנה של מי שבחר לא לנסות.", metricDeltas: {} },
          { id: "b", label: "Ask the old heron which way is best", labelHe: "לשאול את האנפה הזקנה איזו דרך הכי טובה", outcomeHint: "Fennec asks the wise heron, who points to the dry path; help from others is a good road too.", outcomeHintHe: "פנק שואל את האנפה החכמה, שמצביעה על השביל היבש; עזרה מאחרים היא גם דרך טובה.", metricDeltas: {"empathy":1,"wisdom":1} },
          { id: "c", label: "Stop, look closely, and choose the safe path yourself", labelHe: "לעצור, להתבונן היטב, ולבחור בעצמך בשביל הבטוח", outcomeHint: "Fennec waits, studies the mud and the dry grass, and chooses the longer safe path — losing the easy shortcut but keeping the bread dry.", outcomeHintHe: "פנק ממתין, בוחן את הבוץ ואת העשב היבש, ובוחר בשביל הארוך והבטוח — מוותר על הקיצור הקל אך שומר על הלחם יבש.", metricDeltas: {"wisdom":2,"resilience":1} },
        ],
      },
      { id: "consequence", title: "The Long Quiet Way", titleHe: "הדרך הארוכה והשקטה", spine: "The wise path is slower and Fennec's legs grow tired, but the honey-bread stays warm and clean above the marsh mud.", spineHe: "השביל החכם איטי יותר ורגליו של פנק מתעייפות, אך לחם הדבש נשאר חם ונקי מעל בוץ הביצה." },
      { id: "growth", title: "Trusting the Quiet Voice", titleHe: "להקשיב לקול השקט", spine: "Step by patient step Fennec learns that the small voice that says 'wait and look' is worth trusting more than the shiny one that says 'hurry'.", spineHe: "צעד אחר צעד סבלני פנק לומד שלקול הקטן שאומר 'חכה והסתכל' כדאי להאמין יותר מאשר לקול הנוצץ שאומר 'מהר'." },
      { id: "victory", title: "Bread Still Warm", titleHe: "הלחם עדיין חם", spine: "Fennec reaches Grandmother's door just as the sun touches the hills, the honey-bread still warm, and she hugs him close.", spineHe: "פנק מגיע לדלת של סבתא בדיוק כשהשמש נוגעת בגבעות, לחם הדבש עדיין חם, והיא מחבקת אותו חזק." },
      { id: "reflection", title: "Wiser Than Yesterday", titleHe: "חכם יותר מאתמול", spine: "Curled up warm, Fennec smiles knowing he is a little wiser than the cub who set out that morning.", spineHe: "מכורבל בחום, פנק מחייך כשהוא יודע שהוא קצת יותר חכם מהשועלון שיצא לדרך באותו בוקר." },
    ],
  },
  {
    id: "the-two-mothers-and-the-quiet-judge",
    pack: "wisdom",
    title: "The Quiet Judge of Two Mothers",
    titleHe: "השופט השקט ושתי האמהות",
    theme: "A young judge learns that real fairness means listening with the heart to both sides before deciding.",
    themeHe: "שופט צעיר לומד שצדק אמיתי הוא להקשיב בלב לשני הצדדים לפני שמחליטים.",
    origin: "biblical",
    ageRange: [4, 8],
    primaryMetric: "wisdom",
    dilemmaType: "prudence",
    baseReward: {"wisdom":2,"empathy":1},
    learningObjective: "The child learns that wise, fair decisions come from slowing down and truly listening to everyone, not from picking quickly.",
    learningObjectiveHe: "הילד לומד שהחלטות חכמות והוגנות נולדות מהאטה והקשבה אמיתית לכולם, ולא מבחירה מהירה.",
    parentReflection: {
      practiced: ["Slowing down before deciding instead of reacting fast","Listening fully to both sides of a disagreement","Letting a fair answer cost a little personal comfort"],
      practicedHe: ["להאט לפני שמחליטים במקום להגיב מהר","להקשיב עד הסוף לשני הצדדים במחלוקת","לתת לתשובה הוגנת לעלות קצת בנוחות אישית"],
      questions: ["When two people both feel sure they're right, how do you decide what's fair?","What helps you stay calm and listen when everyone is talking at once?","Can you tell me about a time you waited and listened before choosing?"],
      questionsHe: ["כששני אנשים בטוחים שהם צודקים, איך מחליטים מה הוגן?","מה עוזר לך להישאר רגוע ולהקשיב כשכולם מדברים בבת אחת?","תוכל לספר לי על פעם שחיכית והקשבת לפני שבחרת?"],
    },
    parentInsight: {"en":"This story trains the muscle of judgment that underlies all later integrity: the willingness to slow down, hold two competing claims in mind, and aim at the truth rather than the quickest exit. By making the brave choice the patient one, it teaches your child that wisdom has a cost in comfort, and that the person who listens carefully becomes someone others can trust. You are forming a child who, years from now, will pause before he judges.","he":"הסיפור מאמן את שריר השיפוט שעומד בבסיס היושרה לאורך החיים: הנכונות להאט, להחזיק שתי טענות מתחרות במחשבה ולכוון אל האמת ולא אל הדרך הקצרה. בכך שהבחירה האמיצה היא הבחירה הסבלנית, הילד לומד שלחוכמה יש מחיר בנוחות, ושמי שמקשיב בקפידה הופך לאדם שאפשר לבטוח בו. אתם מעצבים ילד שבעוד שנים יעצור רגע לפני שישפוט."},
    beats: [
      { id: "call", title: "The Little Judge Is Called", titleHe: "קוראים לשופט הקטן", spine: "In a sunny town square, young Noam is asked to sit on the listening-stool and help settle a quarrel, because everyone trusts him to be fair.", spineHe: "בכיכר העיר המוארת בשמש, מבקשים מנֹעם הצעיר לשבת על שרפרף ההקשבה ולעזור לפתור ריב, כי כולם בוטחים שהוא יהיה הוגן." },
      { id: "challenge", title: "Two Mothers, One Blanket", titleHe: "שתי אמהות, שמיכה אחת", spine: "Two mothers each say the same soft yellow blanket belongs to their child, and both speak at once, sure they are right.", spineHe: "שתי אמהות טוענות שאותה שמיכה צהובה ורכה שייכת לילד שלהן, ושתיהן מדברות יחד, בטוחות שהן צודקות." },
      { id: "fear", title: "What If I Choose Wrong?", titleHe: "ומה אם אטעה?", spine: "Noam's tummy flutters; the voices are loud and the crowd is waiting, and he is afraid that whatever he says, someone will be hurt.", spineHe: "הבטן של נֹעם מתהפכת; הקולות רמים והקהל מחכה, והוא חושש שמה שלא יגיד, מישהו ייפגע." },
      { id: "decision", title: "How Will Noam Decide?", titleHe: "איך נֹעם יחליט?", spine: "Noam must choose how to handle the noisy, hard quarrel right now.", spineHe: "על נֹעם להחליט עכשיו איך להתמודד עם הריב הרועש והקשה.",
        choices: [
          { id: "a", label: "It's too hard. Tell them to come back another day.", labelHe: "זה קשה מדי. להגיד להן לחזור ביום אחר.", outcomeHint: "Honest: Noam knows he isn't ready, so he steps down. The quarrel stays unsolved and the mothers go home still sad. No fairness is found today, but he told the truth about himself.", outcomeHintHe: "כן: נֹעם יודע שהוא לא מוכן, אז הוא יורד מהשרפרף. הריב נשאר לא פתור והאמהות חוזרות הביתה עצובות. לא נמצא צדק היום, אבל הוא אמר את האמת על עצמו.", metricDeltas: {"truth":1} },
          { id: "b", label: "Ask a wise elder to help him understand.", labelHe: "לבקש מזקֵן חכם שיעזור לו להבין.", outcomeHint: "Noam invites a kind elder to sit beside him; together they hear both mothers and find a gentle answer. Asking for help was a smart, caring choice.", outcomeHintHe: "נֹעם מזמין זקֵן טוב לשבת לידו; יחד הם שומעים את שתי האמהות ומוצאים פתרון עדין. לבקש עזרה הייתה בחירה חכמה ואכפתית.", metricDeltas: {"empathy":1,"wisdom":1} },
          { id: "c", label: "Take a slow breath, quiet the square, and listen to each mother fully.", labelHe: "לנשום לאט, להשתיק את הכיכר ולהקשיב לכל אם עד הסוף.", outcomeHint: "Noam raises a hand for quiet and listens to one mother, then the other, all the way through, even though his cheeks burn and his heart pounds. The brave, patient listening costs him his comfort but reveals the truth.", outcomeHintHe: "נֹעם מרים יד לשקט ומקשיב לאם אחת, ואז לשנייה, עד הסוף, גם כשלחייו בוערות וליבו פועם. ההקשבה האמיצה והסבלנית עולה לו בנוחות שלו אך חושפת את האמת.", metricDeltas: {"wisdom":2,"empathy":1} },
        ],
      },
      { id: "consequence", title: "The Quiet After the Noise", titleHe: "השקט שאחרי הרעש", spine: "Because Noam listened slowly to both, he hears one mother whisper which corner of the blanket her baby always chews, a tiny true detail only the real owner would know.", spineHe: "מפני שנֹעם הקשיב לאט לשתיהן, הוא שומע אם אחת לוחשת איזו פינה של השמיכה התינוק שלה תמיד לועס, פרט קטן ואמיתי שרק הבעלים האמיתי יכול לדעת." },
      { id: "growth", title: "Listening With the Heart", titleHe: "להקשיב עם הלב", spine: "Noam understands that fairness was never about being fast or loud; it grew quietly inside him the moment he chose to truly hear each person.", spineHe: "נֹעם מבין שצדק מעולם לא היה עניין של מהירות או רעש; הוא גדל בשקט בתוכו ברגע שבחר להקשיב באמת לכל אדם." },
      { id: "victory", title: "The Blanket Goes Home", titleHe: "השמיכה חוזרת הביתה", spine: "Noam gently gives the blanket to its true owner, and both mothers nod, feeling heard, while the square fills with warm, calm clapping.", spineHe: "נֹעם נותן בעדינות את השמיכה לבעליה האמיתיים, ושתי האמהות מהנהנות בתחושה שהוקשבו, בעוד הכיכר מתמלאת מחיאות כפיים חמות ושקטות." },
      { id: "reflection", title: "Who I Was Yesterday", titleHe: "מי שהייתי אתמול", spine: "Noam sits quietly and notices he is a little braver and a little wiser than the boy who first climbed the stool, all because he slowed down to listen.", spineHe: "נֹעם יושב בשקט ושם לב שהוא קצת יותר אמיץ וקצת יותר חכם מהילד שעלה לראשונה על השרפרף, וכל זה כי האט כדי להקשיב." },
    ],
  },
];

/** Look up a story spec by id. Returns undefined for unknown ids. */
export const getStorySpec = (id: string): HeroStorySpec | undefined =>
  HERO_STORIES.find((s) => s.id === id);

/** Stories belonging to a pack, in catalog order. */
export const storiesInPack = (pack: HeroPackId): HeroStorySpec[] =>
  HERO_STORIES.filter((s) => s.pack === pack);
