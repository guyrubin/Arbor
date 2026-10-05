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
    ageRange: [3, 7],
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
      { id: "call", title: "On the Golden Hill", titleHe: "על הגבעה הזהובה", spine: "On a golden hill, the hero takes care of the sheep. Baa, baa! The hero is small, and so is the sling, but every sheep is safe.", spineHe: "על הגבעה הזהובה, הגיבור שומר על הכבשים. מההה, מההה! הגיבור קטן, וגם הקלע שלו קטן, אבל כל הכבשים בטוחות.", spineHeF: "על הגבעה הזהובה, הגיבורה שומרת על הכבשים. מההה, מההה! הגיבורה קטנה, וגם הקלע שלה קטן, אבל כל הכבשים בטוחות." },
      { id: "challenge", title: "A Giant Voice", titleHe: "קול של ענק", spine: "A giant voice booms across the valley: \"WHO WILL COME OUT AND FACE ME?\" It is Goliath, as tall as a tree. All the soldiers hide behind their shields.", spineHe: "קול ענק רועם מעבר לעמק: \"מי יעז לעמוד מולי?\" זה גוליית, גבוה כמו עץ. כל החיילים מתחבאים מאחורי המגינים שלהם." },
      { id: "fear", title: "Thump-Thump", titleHe: "בום־בום בלב", spine: "The hero's heart goes thump-thump, thump-thump. \"You're too small,\" say the big brothers. Bun hides inside the hero's coat.", spineHe: "הלב של הגיבור עושה בום־בום, בום־בום. \"אתה קטן מדי,\" אומרים האחים הגדולים. ארנבוני מתחבא בתוך המעיל של הגיבור.", spineHeF: "הלב של הגיבורה עושה בום־בום, בום־בום. \"את קטנה מדי,\" אומרים האחים הגדולים. ארנבוני מתחבא בתוך המעיל של הגיבורה." },
      {
        id: "decision",
        title: "Ha, Ha, Ha!",
        titleHe: "חה, חה, חה!",
        spine: "Goliath laughs a giant laugh: \"HA, HA, HA!\" The whole valley waits. What should the hero do?",
        spineHe: "גוליית צוחק צחוק של ענק: \"חה, חה, חה!\" כל העמק מחכה. מה הגיבור יעשה?",
        spineHeF: "גוליית צוחק צחוק של ענק: \"חה, חה, חה!\" כל העמק מחכה. מה הגיבורה תעשה?",
        choices: [
          { id: "a", label: "Sit by the brook and breathe", labelHe: "לשבת ליד הנחל ולנשום", outcomeHint: "The hero breathes in and out, slow and deep. The thump-thump slows down, down, down.", outcomeHintHe: "הגיבור נושם פנימה והחוצה, לאט ועמוק. הבום־בום בלב נרגע, לאט לאט.", outcomeHintHeF: "הגיבורה נושמת פנימה והחוצה, לאט ועמוק. הבום־בום בלב נרגע, לאט לאט.", metricDeltas: {} },
          { id: "b", label: "Ask a big brother to come", labelHe: "לבקש מאח גדול לבוא", outcomeHint: "Big brother nods: \"I'll stand right behind you.\" The hero feels a little taller.", outcomeHintHe: "האח הגדול מהנהן: \"אני אעמוד ממש מאחוריך.\" והגיבור מרגיש קצת יותר גבוה.", outcomeHintHeF: "האח הגדול מהנהן: \"אני אעמוד ממש מאחורייך.\" והגיבורה מרגישה קצת יותר גבוהה.", metricDeltas: { empathy: 1, courage: 1 } },
          { id: "c", label: "Pick up the sling and go", labelHe: "להרים את הקלע וללכת", outcomeHint: "The hero holds the sling tight and runs down to the brook for stones.", outcomeHintHe: "הגיבור מחזיק חזק את הקלע ורץ אל הנחל לאסוף אבנים.", outcomeHintHeF: "הגיבורה מחזיקה חזק את הקלע ורצה אל הנחל לאסוף אבנים.", metricDeltas: { courage: 2, resilience: 1 } },
        ],
      },
      { id: "consequence", title: "Five Smooth Stones", titleHe: "חמש אבנים חלקות", spine: "Down by the brook, the hero picks five smooth stones. One, two, three, four, five. Plink, plink, into the bag they go.", spineHe: "ליד הנחל, הגיבור בוחר חמש אבנים חלקות. אחת, שתיים, שלוש, ארבע, חמש. פלינק, פלינק, הן נכנסות לתרמיל.", spineHeF: "ליד הנחל, הגיבורה בוחרת חמש אבנים חלקות. אחת, שתיים, שלוש, ארבע, חמש. פלינק, פלינק, הן נכנסות לתרמיל." },
      { id: "growth", title: "Whoosh, Whoosh", titleHe: "ווש, ווש", spine: "The hero walks down into the valley. Goliath gets bigger, and bigger, and BIGGER. The hero plants both feet and swings the sling: whoosh, whoosh, whoosh!", spineHe: "הגיבור יורד אל העמק. גוליית נהיה גדול, וגדול, וגדול עוד יותר! הגיבור נעמד חזק על שתי הרגליים ומסובב את הקלע: ווש, ווש, ווש!", spineHeF: "הגיבורה יורדת אל העמק. גוליית נהיה גדול, וגדול, וגדול עוד יותר! הגיבורה נעמדת חזק על שתי הרגליים ומסובבת את הקלע: ווש, ווש, ווש!" },
      { id: "victory", title: "DONG!", titleHe: "דונג!", spine: "The hero's little stone flies. DONG! It rings on the giant's big helmet. Goliath wobbles and wobbles, then falls down, BOOM, in a big puff of dust. The whole valley cheers!", spineHe: "האבן הקטנה של הגיבור עפה. דונג! היא מצלצלת על הקסדה הגדולה של הענק. גוליית מתנדנד ומתנדנד, ואז נופל, בום, לתוך ענן גדול של אבק. כל העמק מריע!", spineHeF: "האבן הקטנה של הגיבורה עפה. דונג! היא מצלצלת על הקסדה הגדולה של הענק. גוליית מתנדנד ומתנדנד, ואז נופל, בום, לתוך ענן גדול של אבק. כל העמק מריע!" },
      { id: "reflection", title: "Back with the Sheep", titleHe: "בחזרה אל הכבשים", spine: "That evening, the hero is back on the golden hill with the sheep. Baa, baa. Still small. Still holding one smooth stone, warm from the sun. Bun leans close.", spineHe: "בערב, הגיבור חוזר לגבעה הזהובה, אל הכבשים. מההה, מההה. עדיין קטן. ועדיין מחזיק אבן חלקה אחת, חמימה מהשמש. ארנבוני נצמד אליו.", spineHeF: "בערב, הגיבורה חוזרת לגבעה הזהובה, אל הכבשים. מההה, מההה. עדיין קטנה. ועדיין מחזיקה אבן חלקה אחת, חמימה מהשמש. ארנבוני נצמד אליה." },
    ],
  },
  {
    id: "moses-and-pharaoh",
    pack: "courage",
    title: "Moses and Pharaoh",
    titleHe: "משה ופרעה",
    theme: "Standing up to great power",
    origin: "biblical",
    ageRange: [6, 8],
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
      { id: "call", title: "Bricks in the Sun", titleHe: "לבנים בשמש", spine: "In the land of Egypt, the hero sees people carrying heavy bricks in the hot sun. All day long. No rest, no water, no time to play. Bun's ears droop.", spineHe: "בארץ מצרים, הגיבור רואה אנשים סוחבים לבנים כבדות בשמש החמה. כל היום. בלי מנוחה, בלי מים, בלי זמן לשחק. האוזניים של ארנבוני נשמטות.", spineHeF: "בארץ מצרים, הגיבורה רואה אנשים סוחבים לבנים כבדות בשמש החמה. כל היום. בלי מנוחה, בלי מים, בלי זמן לשחק. האוזניים של ארנבוני נשמטות." },
      { id: "challenge", title: "Hand in Hand", titleHe: "יד ביד", spine: "Kind old Moses takes the hero's hand. \"Come with me to Pharaoh, the king,\" he says. \"We will ask him to let the people go free.\"", spineHe: "משה הזקן והטוב לוקח את היד של הגיבור. \"בוא איתי אל פרעה, המלך,\" הוא אומר. \"נבקש ממנו לשחרר את האנשים.\"", spineHeF: "משה הזקן והטוב לוקח את היד של הגיבורה. \"בואי איתי אל פרעה, המלך,\" הוא אומר. \"נבקש ממנו לשחרר את האנשים.\"" },
      { id: "fear", title: "Stuck Words", titleHe: "מילים תקועות", spine: "The palace is huge and shiny. Pharaoh sits on a golden chair and frowns. Moses opens his mouth, but his voice shakes, and the words get stuck. The hero holds on tight.", spineHe: "הארמון ענק ומבריק. פרעה יושב על כיסא זהב ומקמט את המצח. משה פותח את הפה, אבל הקול שלו רועד, והמילים נתקעות. הגיבור מחזיק חזק.", spineHeF: "הארמון ענק ומבריק. פרעה יושב על כיסא זהב ומקמט את המצח. משה פותח את הפה, אבל הקול שלו רועד, והמילים נתקעות. הגיבורה מחזיקה חזק." },
      {
        id: "decision",
        title: "Pharaoh Says No",
        titleHe: "פרעה אומר לא",
        spine: "Pharaoh folds his arms. \"NO,\" he says. Moses looks down at the hero. What should the hero do?",
        spineHe: "פרעה משלב ידיים. \"לא,\" הוא אומר. משה מסתכל על הגיבור. מה הגיבור יעשה?",
        spineHeF: "פרעה משלב ידיים. \"לא,\" הוא אומר. משה מסתכל על הגיבורה. מה הגיבורה תעשה?",
        choices: [
          { id: "a", label: "Squeeze Moses' hand tight", labelHe: "ללחוץ חזק את היד של משה", outcomeHint: "Moses feels the little squeeze. He takes a big breath, and his voice grows strong.", outcomeHintHe: "משה מרגיש את הלחיצה הקטנה. הוא לוקח נשימה גדולה, והקול שלו מתחזק.", metricDeltas: {} },
          { id: "b", label: "Call the people to come too", labelHe: "לקרוא לאנשים שיבואו גם הם", outcomeHint: "In they come, a hundred tired faces. Side by side, they all stand up straight.", outcomeHintHe: "הם נכנסים, מאה פרצופים עייפים. כתף אל כתף, כולם עומדים זקופים.", metricDeltas: { empathy: 1, responsibility: 1 } },
          { id: "c", label: "Say it: \"Let them go!\"", labelHe: "לומר: \"תן להם ללכת!\"", outcomeHint: "\"Please, let them go!\" says the hero, loud and clear. The whole palace goes quiet.", outcomeHintHe: "\"בבקשה, תן להם ללכת!\" אומר הגיבור, בקול ברור. כל הארמון משתתק.", outcomeHintHeF: "\"בבקשה, תן להם ללכת!\" אומרת הגיבורה, בקול ברור. כל הארמון משתתק.", metricDeltas: { courage: 2, responsibility: 1 } },
        ],
      },
      { id: "consequence", title: "Let My People Go", titleHe: "שלח את עמי", spine: "Moses stands tall: \"Let my people go!\" The hero says it too. They ask again and again, until at last Pharaoh says: \"Go!\"", spineHe: "משה נעמד זקוף: \"שלח את עמי!\" גם הגיבור אומר את זה. הם מבקשים שוב ושוב, עד שסוף סוף פרעה אומר: \"לכו!\"", spineHeF: "משה נעמד זקוף: \"שלח את עמי!\" גם הגיבורה אומרת את זה. הם מבקשים שוב ושוב, עד שסוף סוף פרעה אומר: \"לכו!\"" },
      { id: "growth", title: "A Long, Long Line", titleHe: "שורה ארוכה ארוכה", spine: "Out of Egypt they go, in a long, long line: mothers, fathers, babies, goats. The hero carries a little lamb. Bun rides on a donkey.", spineHe: "הם יוצאים ממצרים, בשורה ארוכה ארוכה: אמהות, אבות, תינוקות, עיזים. הגיבור סוחב טלה קטן. ארנבוני רוכב על חמור.", spineHeF: "הם יוצאים ממצרים, בשורה ארוכה ארוכה: אמהות, אבות, תינוקות, עיזים. הגיבורה סוחבת טלה קטן. ארנבוני רוכב על חמור." },
      { id: "victory", title: "Walls of Water", titleHe: "חומות של מים", spine: "They come to the sea. Moses lifts his staff, and WHOOSH! The water rolls back like two tall walls. The hero walks through on dry sand, and fish peek out to watch.", spineHe: "הם מגיעים אל הים. משה מרים את המטה, ו... וווש! המים נפתחים כמו שתי חומות גבוהות. הגיבור הולך על חול יבש, ודגים מציצים להסתכל.", spineHeF: "הם מגיעים אל הים. משה מרים את המטה, ו... וווש! המים נפתחים כמו שתי חומות גבוהות. הגיבורה הולכת על חול יבש, ודגים מציצים להסתכל." },
      { id: "reflection", title: "Tam, Tam, Tam", titleHe: "טם, טם, טם", spine: "On the other side, everyone sings and dances. Miriam shakes her drum: tam, tam, tam! The hero dances too, and Bun spins high in the air.", spineHe: "בצד השני, כולם שרים ורוקדים. מרים מכה בתוף: טם, טם, טם! גם הגיבור רוקד, וארנבוני מסתובב גבוה באוויר.", spineHeF: "בצד השני, כולם שרים ורוקדים. מרים מכה בתוף: טם, טם, טם! גם הגיבורה רוקדת, וארנבוני מסתובב גבוה באוויר." },
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
      { id: "call", title: "Big Lion, Soft Mane", titleHe: "אריה גדול, רעמה רכה", spine: "At the edge of the tall grass, the hero meets Lion. Lion is big, with a soft gold mane. But when the stars come out, Lion hides his nose in his paws.", spineHe: "בקצה העשב הגבוה, הגיבור פוגש את האריה. האריה גדול, עם רעמה זהובה ורכה. אבל כשהכוכבים יוצאים, האריה מחביא את האף בין הכפות.", spineHeF: "בקצה העשב הגבוה, הגיבורה פוגשת את האריה. האריה גדול, עם רעמה זהובה ורכה. אבל כשהכוכבים יוצאים, האריה מחביא את האף בין הכפות." },
      { id: "challenge", title: "Mew! Mew!", titleHe: "מיאו! מיאו!", spine: "From over the dark hill comes a small sound: \"Mew! Mew!\" The hero hears it first. It is Tiny, Lion's little brother, lost in the dark.", spineHe: "מעבר לגבעה החשוכה נשמע קול קטן: \"מיאו! מיאו!\" הגיבור שומע אותו ראשון. זה פיצי, האח הקטן של האריה, שהלך לאיבוד בחושך.", spineHeF: "מעבר לגבעה החשוכה נשמע קול קטן: \"מיאו! מיאו!\" הגיבורה שומעת אותו ראשונה. זה פיצי, האח הקטן של האריה, שהלך לאיבוד בחושך." },
      { id: "fear", title: "Wobble, Wobble", titleHe: "כפות רועדות", spine: "Lion looks at the dark hill. His big paws go wobble, wobble. \"I'm scared. The dark is so big,\" Lion whispers. Bun hides behind the hero's leg.", spineHe: "האריה מסתכל על הגבעה החשוכה. הכפות הגדולות שלו רועדות ורועדות. \"אני מפחד. החושך כל כך גדול,\" הוא לוחש. וארנבוני מתחבא מאחורי הרגל של הגיבור.", spineHeF: "האריה מסתכל על הגבעה החשוכה. הכפות הגדולות שלו רועדות ורועדות. \"אני מפחד. החושך כל כך גדול,\" הוא לוחש. וארנבוני מתחבא מאחורי הרגל של הגיבורה." },
      {
        id: "decision",
        title: "Into the Dark?",
        titleHe: "אל תוך החושך?",
        spine: "\"Mew!\" calls Tiny, far away. Lion looks at the hero with big, wet eyes. What should the hero do?",
        spineHe: "\"מיאו!\" קורא פיצי, רחוק רחוק. האריה מסתכל על הגיבור בעיניים גדולות ורטובות. מה הגיבור יעשה?",
        spineHeF: "\"מיאו!\" קורא פיצי, רחוק רחוק. האריה מסתכל על הגיבורה בעיניים גדולות ורטובות. מה הגיבורה תעשה?",
        choices: [
          { id: "a", label: "Sit close and call to Tiny", labelHe: "לשבת קרוב ולקרוא לפיצי", outcomeHint: "Side by side, they call, \"Tiny!\" A small \"mew\" answers, and Lion's ears pop up.", outcomeHintHe: "צמודים זה לזה, הם קוראים: \"פיצי!\" \"מיאו\" קטן עונה, והאוזניים של האריה מזדקפות.", metricDeltas: {} },
          { id: "b", label: "Call the fireflies to help", labelHe: "לקרוא לגחליליות שיעזרו", outcomeHint: "Blink, blink! A line of little fireflies lights the path, and the dark looks smaller.", outcomeHintHe: "הבהוב, הבהוב! שורה של גחליליות קטנות מאירה את השביל, והחושך נראה קטן יותר.", metricDeltas: { empathy: 1, courage: 1 } },
          { id: "c", label: "Take Lion's paw and step forward", labelHe: "לתת יד לאריה ולצעוד קדימה", outcomeHint: "The hero takes one step. Lion takes one step. Step, step, together into the dark.", outcomeHintHe: "הגיבור עושה צעד אחד. האריה עושה צעד אחד. צעד, צעד, ביחד אל תוך החושך.", outcomeHintHeF: "הגיבורה עושה צעד אחד. האריה עושה צעד אחד. צעד, צעד, ביחד אל תוך החושך.", metricDeltas: { courage: 2, resilience: 1 } },
        ],
      },
      { id: "consequence", title: "Step, Step, Swish", titleHe: "צעד, צעד, רשרוש", spine: "The hero leads the way. Step, step, swish through the tall grass. The dark is full of small, gentle things: a cricket singing, a cool breeze, the moon peeking out.", spineHe: "הגיבור מוביל את הדרך. צעד, צעד, רשרוש בעשב הגבוה. החושך מלא בדברים קטנים ונעימים: צרצר שר, רוח קרירה, והירח מציץ.", spineHeF: "הגיבורה מובילה את הדרך. צעד, צעד, רשרוש בעשב הגבוה. החושך מלא בדברים קטנים ונעימים: צרצר שר, רוח קרירה, והירח מציץ." },
      { id: "growth", title: "Not So Big", titleHe: "לא כל כך גדול", spine: "Lion lifts his head. \"The dark is not so big,\" Lion says, and his paws stop wobbling. Bun hops ahead of the hero, ears up high.", spineHe: "האריה מרים את הראש. \"החושך לא כל כך גדול,\" הוא אומר, והכפות שלו מפסיקות לרעוד. ארנבוני קופץ לפני הגיבור, עם אוזניים זקופות.", spineHeF: "האריה מרים את הראש. \"החושך לא כל כך גדול,\" הוא אומר, והכפות שלו מפסיקות לרעוד. ארנבוני קופץ לפני הגיבורה, עם אוזניים זקופות." },
      { id: "victory", title: "There's Tiny!", titleHe: "הנה פיצי!", spine: "Under a bush, the hero spots two little round ears. \"Tiny!\" Lion gives a big, happy ROAR, and Tiny tumbles into his soft mane.", spineHe: "מתחת לשיח, הגיבור מגלה שתי אוזניים קטנות ועגולות. \"פיצי!\" האריה שואג שאגה גדולה ושמחה, ופיצי מתגלגל אל תוך הרעמה הרכה שלו.", spineHeF: "מתחת לשיח, הגיבורה מגלה שתי אוזניים קטנות ועגולות. \"פיצי!\" האריה שואג שאגה גדולה ושמחה, ופיצי מתגלגל אל תוך הרעמה הרכה שלו." },
      { id: "reflection", title: "Goodnight, Stars", titleHe: "לילה טוב, כוכבים", spine: "Back in the tall grass, Lion curls around Tiny. The hero snuggles into the warm mane, with Bun tucked under one arm. Above them, the stars wink goodnight.", spineHe: "בחזרה בעשב הגבוה, האריה מתכרבל סביב פיצי. הגיבור נצמד אל הרעמה החמה, וארנבוני מחובק מתחת לזרוע. ולמעלה, הכוכבים קורצים: לילה טוב.", spineHeF: "בחזרה בעשב הגבוה, האריה מתכרבל סביב פיצי. הגיבורה נצמדת אל הרעמה החמה, וארנבוני מחובק מתחת לזרוע. ולמעלה, הכוכבים קורצים: לילה טוב." },
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
    ageRange: [3, 5],
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
      { id: "call", title: "A Big, Big Rain", titleHe: "גשם גדול גדול", spine: "Noah looks up at the sky. \"A big, big rain is coming,\" he says. \"Let's build a big, big boat.\" The hero picks up a long wooden plank.", spineHe: "נח מסתכל אל השמיים. \"גשם גדול גדול עומד לבוא,\" הוא אומר. \"בואו נבנה תיבה גדולה גדולה.\" הגיבור מרים קרש עץ ארוך.", spineHeF: "נח מסתכל אל השמיים. \"גשם גדול גדול עומד לבוא,\" הוא אומר. \"בואו נבנה תיבה גדולה גדולה.\" הגיבורה מרימה קרש עץ ארוך." },
      { id: "challenge", title: "Tok, Tok, Tok", titleHe: "טוק, טוק, טוק", spine: "Tok, tok, tok! The hero carries plank after plank, and the boat grows slowly, slowly. Some neighbors laugh: \"A boat? On top of a hill?\"", spineHe: "טוק, טוק, טוק! הגיבור סוחב עוד קרש ועוד קרש, והתיבה גדלה לאט לאט. כמה שכנים צוחקים: \"תיבה? על הגבעה?\"", spineHeF: "טוק, טוק, טוק! הגיבורה סוחבת עוד קרש ועוד קרש, והתיבה גדלה לאט לאט. כמה שכנים צוחקים: \"תיבה? על הגבעה?\"" },
      { id: "fear", title: "Tired Arms", titleHe: "ידיים עייפות", spine: "The hero's arms are tired. The sun is hot, and the boat still has a big hole in its side. Bun flops down in the sawdust: \"Phew!\"", spineHe: "הידיים של הגיבור עייפות. השמש חמה, ובדופן של התיבה עדיין יש חור גדול. ארנבוני נשכב בתוך הנסורת: \"פוף!\"", spineHeF: "הידיים של הגיבורה עייפות. השמש חמה, ובדופן של התיבה עדיין יש חור גדול. ארנבוני נשכב בתוך הנסורת: \"פוף!\"" },
      {
        id: "decision",
        title: "Grrrumble!",
        titleHe: "רעם רחוק",
        spine: "Far away, a gray cloud goes grrrumble. The boat is not finished yet. What should the hero do?",
        spineHe: "רחוק רחוק, ענן אפור רועם: \"ררררום.\" והתיבה עוד לא גמורה. מה הגיבור יעשה?",
        spineHeF: "רחוק רחוק, ענן אפור רועם: \"ררררום.\" והתיבה עוד לא גמורה. מה הגיבורה תעשה?",
        choices: [
          { id: "a", label: "Rest in the shade first", labelHe: "לנוח קצת בצל", outcomeHint: "The hero drinks cool water under a tree, then picks up the hammer again: tok, tok!", outcomeHintHe: "הגיבור שותה מים קרים מתחת לעץ, ואז מרים שוב את הפטיש: טוק, טוק!", outcomeHintHeF: "הגיבורה שותה מים קרים מתחת לעץ, ואז מרימה שוב את הפטיש: טוק, טוק!", metricDeltas: {} },
          { id: "b", label: "Ask the animals to help", labelHe: "לבקש מהחיות לעזור", outcomeHint: "The elephants lift planks, the monkeys pass the nails, and together the work goes fast.", outcomeHintHe: "הפילים מרימים קרשים, הקופים מעבירים מסמרים, וביחד העבודה הולכת מהר.", metricDeltas: { empathy: 1, responsibility: 1 } },
          { id: "c", label: "Keep going, plank by plank", labelHe: "להמשיך, קרש אחרי קרש", outcomeHint: "Tok, tok, tok! The hero keeps going, plank by plank, until the hole is gone.", outcomeHintHe: "טוק, טוק, טוק! הגיבור ממשיך, קרש אחד בכל פעם, עד שהחור נסגר.", outcomeHintHeF: "טוק, טוק, טוק! הגיבורה ממשיכה, קרש אחד בכל פעם, עד שהחור נסגר.", metricDeltas: { responsibility: 2, resilience: 1 } },
        ],
      },
      { id: "consequence", title: "Two by Two", titleHe: "זוג אחרי זוג", spine: "Two by two, the animals come. Two elephants: TOOT! Two lions: ROAR! Two little ducks: quack, quack! The hero leads them up into the boat.", spineHe: "זוג אחרי זוג, החיות מגיעות. שני פילים: טררו! שני אריות: גררר! שני ברווזונים: גע, גע! הגיבור מוביל אותם פנימה, אל התיבה.", spineHeF: "זוג אחרי זוג, החיות מגיעות. שני פילים: טררו! שני אריות: גררר! שני ברווזונים: גע, גע! הגיבורה מובילה אותם פנימה, אל התיבה." },
      { id: "growth", title: "Pitter, Patter", titleHe: "טיפ, טיפ, טיפ", spine: "Pitter, patter, the rain begins. Inside the boat, it is warm and dry. The hero tucks a sleepy lamb into the straw, and Bun yawns.", spineHe: "טיפ, טיפ, טיפ, הגשם מתחיל. בתוך התיבה חם ויבש. הגיבור משכיב טלה מנומנם על הקש, וארנבוני מפהק.", spineHeF: "טיפ, טיפ, טיפ, הגשם מתחיל. בתוך התיבה חם ויבש. הגיבורה משכיבה טלה מנומנם על הקש, וארנבוני מפהק." },
      { id: "victory", title: "A Rainbow!", titleHe: "קשת בענן!", spine: "The rain stops. The hero opens the window, and a white dove flies in with a green leaf. Look! A rainbow fills the whole sky.", spineHe: "הגשם נעצר. הגיבור פותח את החלון, ויונה לבנה עפה פנימה עם עלה ירוק. תראו! קשת בענן ממלאת את כל השמיים.", spineHeF: "הגשם נעצר. הגיבורה פותחת את החלון, ויונה לבנה עפה פנימה עם עלה ירוק. תראו! קשת בענן ממלאת את כל השמיים." },
      { id: "reflection", title: "Goodbye, Animals", titleHe: "להתראות, חיות", spine: "Two by two, the animals walk out onto fresh green grass. The elephants give one last TOOT! The hero and Noah wave goodbye, and Bun waves both ears.", spineHe: "זוג אחרי זוג, החיות יוצאות אל הדשא הירוק והרענן. הפילים משמיעים עוד \"טררו!\" אחרון. הגיבור ונח מנופפים לשלום, וארנבוני מנופף בשתי האוזניים.", spineHeF: "זוג אחרי זוג, החיות יוצאות אל הדשא הירוק והרענן. הפילים משמיעים עוד \"טררו!\" אחרון. הגיבורה ונח מנופפים לשלום, וארנבוני מנופף בשתי האוזניים." },
    ],
  },
  {
    id: "jonah-and-the-great-fish",
    pack: "responsibility",
    title: "Jonah and the Great Fish",
    titleHe: "יונה והדג הגדול",
    theme: "Running from responsibility — and coming back",
    origin: "biblical",
    ageRange: [4, 7],
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
      { id: "call", title: "A Quiet Voice", titleHe: "קול שקט", spine: "One morning, a quiet, kind voice calls to the hero: \"Get up and go to Nineveh, the big city. The people there have forgotten how to be kind. Go and tell them.\"", spineHe: "בוקר אחד, קול שקט וטוב קורא לגיבור: \"קום, לך אל נינוה, העיר הגדולה. האנשים שם שכחו איך להיות טובים. לך ותגיד להם.\"", spineHeF: "בוקר אחד, קול שקט וטוב קורא לגיבורה: \"קומי, לכי אל נינוה, העיר הגדולה. האנשים שם שכחו איך להיות טובים. לכי ותגידי להם.\"" },
      { id: "challenge", title: "No, No, No!", titleHe: "לא, לא, לא!", spine: "Nineveh is far, and big, and loud. \"No, no, no!\" says the hero, and runs the other way, onto a boat on the sea. Bun hops aboard too.", spineHe: "נינוה רחוקה, וגדולה, ורועשת. \"לא, לא, לא!\" אומר הגיבור, ורץ לכיוון ההפוך, אל סירה על הים. גם ארנבוני קופץ לסירה.", spineHeF: "נינוה רחוקה, וגדולה, ורועשת. \"לא, לא, לא!\" אומרת הגיבורה, ורצה לכיוון ההפוך, אל סירה על הים. גם ארנבוני קופץ לסירה." },
      { id: "fear", title: "Wind and Waves", titleHe: "רוח וגלים", spine: "Whoosh goes the wind. The waves grow tall, and the boat rocks up and down. Then one big wave, SPLASH! The hero tumbles into the sea, holding Bun tight.", spineHe: "וווש, נושבת הרוח. הגלים גדלים, והסירה מיטלטלת למעלה ולמטה. ואז גל אחד גדול, ו... שפלאש! הגיבור נופל לים, ומחזיק חזק את ארנבוני.", spineHeF: "וווש, נושבת הרוח. הגלים גדלים, והסירה מיטלטלת למעלה ולמטה. ואז גל אחד גדול, ו... שפלאש! הגיבורה נופלת לים, ומחזיקה חזק את ארנבוני." },
      {
        id: "decision",
        title: "Inside the Great Fish",
        titleHe: "בתוך הדג הגדול",
        spine: "GULP! A great, gentle fish swallows the hero. Inside, it is dark and quiet and warm, like a sleeping bag. What should the hero do?",
        spineHe: "האם! דג גדול ועדין בולע את הגיבור. בפנים חשוך ושקט וחמים, כמו בשק שינה. מה הגיבור יעשה?",
        spineHeF: "האם! דג גדול ועדין בולע את הגיבורה. בפנים חשוך ושקט וחמים, כמו בשק שינה. מה הגיבורה תעשה?",
        choices: [
          { id: "a", label: "Rest in the quiet a while", labelHe: "לנוח קצת בשקט", outcomeHint: "The hero curls up and hears the big heart: boom, boom. Then the fish swims.", outcomeHintHe: "הגיבור מתכרבל ושומע את הלב הגדול: בום, בום. ואז הדג מתחיל לשחות.", outcomeHintHeF: "הגיבורה מתכרבלת ושומעת את הלב הגדול: בום, בום. ואז הדג מתחיל לשחות.", metricDeltas: {} },
          { id: "b", label: "Say sorry, ask to try again", labelHe: "לומר סליחה ולבקש עוד הזדמנות", outcomeHint: "\"I'm sorry. Can I try again?\" whispers the hero. The fish's tummy rumbles, like a yes.", outcomeHintHe: "\"סליחה. אפשר לנסות שוב?\" לוחש הגיבור. הבטן של הדג מקרקרת, כמו \"כן\".", outcomeHintHeF: "\"סליחה. אפשר לנסות שוב?\" לוחשת הגיבורה. הבטן של הדג מקרקרת, כמו \"כן\".", metricDeltas: { empathy: 1, wisdom: 1 } },
          { id: "c", label: "Decide to go to Nineveh", labelHe: "להחליט ללכת לנינוה", outcomeHint: "\"Okay, I'll go!\" says the hero, loud and clear. The fish flips its tail: swoosh!", outcomeHintHe: "\"טוב, אני אלך!\" אומר הגיבור, בקול ברור. הדג מנפנף בזנב: ווש!", outcomeHintHeF: "\"טוב, אני אלך!\" אומרת הגיבורה, בקול ברור. הדג מנפנף בזנב: ווש!", metricDeltas: { responsibility: 2, courage: 1 } },
        ],
      },
      { id: "consequence", title: "Whee! Onto the Sand", titleHe: "וייי! אל החול", spine: "Swoosh! The fish swims to the shore and opens wide. Whee! The hero slides out onto soft, warm sand, with Bun. \"Thank you, fish!\"", spineHe: "ווש! הדג שוחה אל החוף ופותח את הפה. וייי! הגיבור מחליק החוצה, אל החול הרך והחמים, עם ארנבוני. \"תודה, דג!\"", spineHeF: "ווש! הדג שוחה אל החוף ופותח את הפה. וייי! הגיבורה מחליקה החוצה, אל החול הרך והחמים, עם ארנבוני. \"תודה, דג!\"" },
      { id: "growth", title: "The Big, Loud City", titleHe: "העיר הגדולה והרועשת", spine: "The hero walks and walks, all the way to Nineveh. Clang! Hee-haw! Shout! People are pushing and grumbling. The hero stands up tall and calls: \"Please, be kind to each other!\"", spineHe: "הגיבור הולך והולך, כל הדרך עד נינוה. קלנג! אי־אה! צעקות! אנשים נדחפים ורוטנים. הגיבור נעמד זקוף וקורא: \"בבקשה, תהיו טובים זה לזה!\"", spineHeF: "הגיבורה הולכת והולכת, כל הדרך עד נינוה. קלנג! אי־אה! צעקות! אנשים נדחפים ורוטנים. הגיבורה נעמדת זקופה וקוראת: \"בבקשה, תהיו טובים זה לזה!\"" },
      { id: "victory", title: "Sorry, Sorry", titleHe: "סליחה, סליחה", spine: "And the people listen. \"Sorry,\" they say to each other. A boy shares his bread, and a mother helps an old man carry his basket. The whole city smiles, and so does the hero.", spineHe: "והאנשים מקשיבים. \"סליחה,\" הם אומרים זה לזה. ילד חולק את הלחם שלו, ואמא עוזרת לסבא לסחוב את הסל. כל העיר מחייכת, וגם הגיבור.", spineHeF: "והאנשים מקשיבים. \"סליחה,\" הם אומרים זה לזה. ילד חולק את הלחם שלו, ואמא עוזרת לסבא לסחוב את הסל. כל העיר מחייכת, וגם הגיבורה." },
      { id: "reflection", title: "In the Cool Shade", titleHe: "בצל הקריר", spine: "Outside the city, a big green plant spreads its wide leaves. The hero lies in the cool shade with Bun, listening to the happy hum of Nineveh.", spineHe: "מחוץ לעיר, צמח ירוק וגדול פורש עלים רחבים. הגיבור שוכב בצל הקריר עם ארנבוני, ומקשיב לזמזום השמח של נינוה.", spineHeF: "מחוץ לעיר, צמח ירוק וגדול פורש עלים רחבים. הגיבורה שוכבת בצל הקריר עם ארנבוני, ומקשיבה לזמזום השמח של נינוה." },
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
      { id: "call", title: "A Dragon Named Spark", titleHe: "דרקון בשם ניצוץ", spine: "The hero has a friend: a little green dragon named Spark. Every evening, Spark breathes a tiny flame and lights the village lanterns. Puff, puff, puff!", spineHe: "לגיבור יש חבר: דרקון ירוק וקטן בשם ניצוץ. בכל ערב, ניצוץ נושף להבה קטנטנה ומדליק את הפנסים בכפר. פוף, פוף, פוף!", spineHeF: "לגיבורה יש חבר: דרקון ירוק וקטן בשם ניצוץ. בכל ערב, ניצוץ נושף להבה קטנטנה ומדליק את הפנסים בכפר. פוף, פוף, פוף!" },
      { id: "challenge", title: "Three Red Peppers", titleHe: "שלושה פלפלים אדומים", spine: "But a dragon's flame needs supper. Every evening, the hero brings a bowl of red peppers. One, two, three! Crunch, crunch, and Spark's flame burns bright.", spineHe: "אבל להבה של דרקון צריכה ארוחת ערב. בכל ערב, הגיבור מביא קערה של פלפלים אדומים. אחד, שניים, שלושה! קראנץ', קראנץ', והלהבה של ניצוץ בוערת חזק.", spineHeF: "אבל להבה של דרקון צריכה ארוחת ערב. בכל ערב, הגיבורה מביאה קערה של פלפלים אדומים. אחד, שניים, שלושה! קראנץ', קראנץ', והלהבה של ניצוץ בוערת חזק." },
      { id: "fear", title: "Come Play!", titleHe: "בואו לשחק!", spine: "The sun is going down. In the square, the friends are playing tag. \"Come play!\" they shout. The hero wants to play so, so much.", spineHe: "השמש שוקעת. בכיכר, החברים משחקים תופסת. \"בוא לשחק!\" הם קוראים. הגיבור כל כך, כל כך רוצה לשחק.", spineHeF: "השמש שוקעת. בכיכר, החברים משחקים תופסת. \"בואי לשחק!\" הם קוראים. הגיבורה כל כך, כל כך רוצה לשחק." },
      {
        id: "decision",
        title: "Grumble, Grumble",
        titleHe: "בטן מקרקרת",
        spine: "The lanterns are still dark. Spark's tummy goes grumble, grumble. Bun looks at the game, then at the bowl. What should the hero do?",
        spineHe: "הפנסים עדיין חשוכים. הבטן של ניצוץ מקרקרת: גררר, גררר. ארנבוני מסתכל על המשחק, ואז על הקערה. מה הגיבור יעשה?",
        spineHeF: "הפנסים עדיין חשוכים. הבטן של ניצוץ מקרקרת: גררר, גררר. ארנבוני מסתכל על המשחק, ואז על הקערה. מה הגיבורה תעשה?",
        choices: [
          { id: "a", label: "Play one game, then run back", labelHe: "לשחק משחק אחד, ואז לרוץ חזרה", outcomeHint: "One quick game of tag, then the hero runs home, puffing. Spark is waiting, tummy rumbling.", outcomeHintHe: "משחק תופסת אחד מהיר, ואז הגיבור רץ הביתה, מתנשף. ניצוץ מחכה, והבטן שלו מקרקרת.", outcomeHintHeF: "משחק תופסת אחד מהיר, ואז הגיבורה רצה הביתה, מתנשפת. ניצוץ מחכה, והבטן שלו מקרקרת.", metricDeltas: {} },
          { id: "b", label: "Bring the friends to feed Spark", labelHe: "להביא את החברים להאכיל את ניצוץ", outcomeHint: "Everyone comes along! Each friend holds out a pepper, and Spark hiccups happy sparks.", outcomeHintHe: "כולם באים! כל חבר מגיש פלפל, וניצוץ משהק ניצוצות שמחים.", metricDeltas: { empathy: 1, responsibility: 1 } },
          { id: "c", label: "Feed Spark first, then play", labelHe: "להאכיל קודם את ניצוץ, ואז לשחק", outcomeHint: "One, two, three peppers. Puff! Then the hero runs off to play, light as a feather.", outcomeHintHe: "אחד, שניים, שלושה פלפלים. פוף! ואז הגיבור רץ לשחק, קל כמו נוצה.", outcomeHintHeF: "אחד, שניים, שלושה פלפלים. פוף! ואז הגיבורה רצה לשחק, קלה כמו נוצה.", metricDeltas: { responsibility: 2, wisdom: 1 } },
        ],
      },
      { id: "consequence", title: "Puff, Puff, Puff", titleHe: "פוף, פוף, פוף", spine: "Crunch, crunch! Spark takes a big breath and goes puff, puff, puff! The hero runs ahead, and down the street the lanterns glow, one by one.", spineHe: "קראנץ', קראנץ'! ניצוץ לוקח נשימה גדולה ונושף: פוף, פוף, פוף! הגיבור רץ קדימה, ולאורך הרחוב הפנסים נדלקים, אחד אחרי השני.", spineHeF: "קראנץ', קראנץ'! ניצוץ לוקח נשימה גדולה ונושף: פוף, פוף, פוף! הגיבורה רצה קדימה, ולאורך הרחוב הפנסים נדלקים, אחד אחרי השני." },
      { id: "growth", title: "Up, Up, Up", titleHe: "למעלה, למעלה", spine: "The last lantern hangs high on the clock tower. The hero lifts Spark up, up, up, and... puff! It glows like a little moon.", spineHe: "הפנס האחרון תלוי גבוה על מגדל השעון. הגיבור מרים את ניצוץ למעלה, למעלה, למעלה, ו... פוף! הפנס זוהר כמו ירח קטן.", spineHeF: "הפנס האחרון תלוי גבוה על מגדל השעון. הגיבורה מרימה את ניצוץ למעלה, למעלה, למעלה, ו... פוף! הפנס זוהר כמו ירח קטן." },
      { id: "victory", title: "The Village Glows", titleHe: "הכפר זוהר", spine: "The whole village glows gold. Doors open, and the neighbors come out to see. \"Thank you!\" they call to the hero and Spark. Bun claps two soft paws.", spineHe: "כל הכפר זוהר בזהב. דלתות נפתחות, והשכנים יוצאים להסתכל. \"תודה!\" הם קוראים לגיבור ולניצוץ. ארנבוני מוחא כפיים בשתי כפות רכות.", spineHeF: "כל הכפר זוהר בזהב. דלתות נפתחות, והשכנים יוצאים להסתכל. \"תודה!\" הם קוראים לגיבורה ולניצוץ. ארנבוני מוחא כפיים בשתי כפות רכות." },
      { id: "reflection", title: "One Sleepy Puff", titleHe: "פוף אחד מנומנם", spine: "The hero sits on the doorstep, with Spark curled warm on one side and Bun on the other. Every lantern glows. Spark gives one sleepy puff: a tiny smoke ring.", spineHe: "הגיבור יושב על מפתן הבית, ניצוץ מכורבל וחמים מצד אחד וארנבוני מהצד השני. כל הפנסים זוהרים. ניצוץ נושף פוף אחד מנומנם: טבעת עשן קטנטנה.", spineHeF: "הגיבורה יושבת על מפתן הבית, ניצוץ מכורבל וחמים מצד אחד וארנבוני מהצד השני. כל הפנסים זוהרים. ניצוץ נושף פוף אחד מנומנם: טבעת עשן קטנטנה." },
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
    ageRange: [6, 8],
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
      { id: "call", title: "The Call", titleHe: "הקריאה", spine: "The hero is a dreamer with a colorful coat who loves their family, even when the brothers feel jealous.", spineHe: "הגיבור הוא חולם עם מעיל צבעוני. הוא אוהב את המשפחה שלו, גם כשהאחים מקנאים בו." },
      { id: "challenge", title: "The Challenge", titleHe: "האתגר", spine: "The brothers send the hero far away, and the hero must start over alone in a strange land.", spineHe: "האחים שולחים את הגיבור רחוק. עכשיו הוא צריך להתחיל מחדש, לבד, בארץ זרה." },
      { id: "fear", title: "The Fear", titleHe: "הפחד", spine: "Far from home and treated unfairly, the hero wonders if things will ever feel good again.", spineHe: "רחוק מהבית, ואחרי שנהגו בו לא בצדק, הגיבור תוהה אם אי פעם יהיה שוב טוב." },
      {
        id: "decision",
        title: "The Decision",
        titleHe: "ההחלטה",
        spine: "Years later, when the hero is strong and the brothers come needing help, the hero must decide.",
        spineHe: "אחרי שנים, כשהגיבור כבר חזק, האחים באים ומבקשים עזרה. עכשיו הגיבור צריך להחליט.",
        choices: [
          { id: "a", label: "Stay angry and turn them away", labelHe: "להמשיך לכעוס ולשלוח אותם מכאן", outcomeHint: "The hero keeps the door closed, but the old hurt stays heavy and the heart stays tight.", outcomeHintHe: "הגיבור משאיר את הדלת סגורה. אבל הכאב הישן נשאר כבד, והלב נשאר סגור.", metricDeltas: {} },
          { id: "b", label: "Listen to their sorry first", labelHe: "קודם להקשיב לסליחה שלהם", outcomeHint: "The hero lets the brothers speak and truly listens, and the room grows softer.", outcomeHintHe: "הגיבור נותן לאחים לדבר, ובאמת מקשיב. והחדר נעשה רך יותר.", metricDeltas: { wisdom: 1, empathy: 1 } },
          { id: "c", label: "Forgive them and share my bread", labelHe: "לסלוח להם ולחלוק איתם את הלחם", outcomeHint: "The hero opens both arms and shares food and home, and a great weight lifts away.", outcomeHintHe: "הגיבור פותח את הידיים, וחולק איתם אוכל ובית. ומשא כבד יורד מהלב.", metricDeltas: { empathy: 2, resilience: 1 } },
        ],
      },
      { id: "consequence", title: "What Happened", titleHe: "מה קרה", spine: "The family is either left apart and aching, or knit back together at one warm table.", spineHe: "המשפחה נשארת רחוקה וכואבת, או מתאחדת שוב סביב שולחן חם אחד." },
      { id: "growth", title: "Growing", titleHe: "צומחים", spine: "The hero learns that the hard years made them wise and strong, and forgiveness made them free.", spineHe: "הגיבור לומד שהשנים הקשות עשו אותו חכם וחזק, והסליחה עשתה אותו חופשי." },
      { id: "victory", title: "Victory", titleHe: "הניצחון", spine: "The whole family is reunited, and the hero's old dream of togetherness finally comes true.", spineHe: "כל המשפחה שוב ביחד. החלום הישן של הגיבור, להיות כולם יחד, סוף סוף מתגשם." },
      { id: "reflection", title: "Reflection", titleHe: "רגע לחשוב", spine: "The hero watches the family laugh again, grateful for how far they've all come.", spineHe: "הגיבור מסתכל על המשפחה צוחקת שוב, ושמח על הדרך הארוכה שכולם עשו." },
    ],
  },
  {
    id: "jacob-wrestling-the-angel",
    pack: "growth",
    title: "Jacob and the Night Visitor",
    titleHe: "יעקב והמלאך",
    theme: "Struggling through hardship",
    origin: "biblical",
    ageRange: [6, 8],
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
      { id: "call", title: "The Call", titleHe: "הקריאה", spine: "The hero camps alone by a river the night before a big, worrying day, with much on their mind.", spineHe: "הגיבור ישן לבד ליד נהר, בלילה שלפני יום גדול ומדאיג. הרבה מחשבות מסתובבות לו בראש." },
      { id: "challenge", title: "The Challenge", titleHe: "האתגר", spine: "In the dark, a mysterious gentle visitor appears, and they begin a long, all-night wrestle of wills.", spineHe: "בחושך מופיע אורח מסתורי ועדין. השניים מתחילים להיאבק, מאבק ארוך שנמשך כל הלילה." },
      { id: "fear", title: "The Fear", titleHe: "הפחד", spine: "Hour after hour the hero grows tired; a voice says 'let go, give up, it's too long'.", spineHe: "שעה אחרי שעה הגיבור מתעייף. קול אומר: 'די, תוותר, זה ארוך מדי.'" },
      {
        id: "decision",
        title: "The Decision",
        titleHe: "ההחלטה",
        spine: "As the night wears on and the hero tires, they must decide whether to hold on.",
        spineHe: "הלילה נמשך, והגיבור עייף. הוא צריך להחליט אם להמשיך להחזיק.",
        choices: [
          { id: "a", label: "Let go and walk away", labelHe: "לעזוב וללכת", outcomeHint: "The hero releases and rests, but never learns what holding on a little longer might have given.", outcomeHintHe: "הגיבור מרפה ונח. אבל הוא לא יידע מה היה קורה אילו החזיק עוד קצת.", metricDeltas: {} },
          { id: "b", label: "Pause, breathe, then keep going", labelHe: "לעצור, לנשום, ולהמשיך", outcomeHint: "The hero catches their breath, steadies, and returns to the struggle with calmer strength.", outcomeHintHe: "הגיבור עוצר לנשום, נרגע, וחוזר למאבק עם כוח שקט יותר.", metricDeltas: { wisdom: 1, resilience: 1 } },
          { id: "c", label: "Hold on until the sunrise", labelHe: "להחזיק חזק עד הזריחה", outcomeHint: "The hero grips tight and stays in the struggle all the way until the first light of dawn.", outcomeHintHe: "הגיבור מחזיק חזק ולא מרפה, עד שהאור הראשון של הבוקר עולה.", metricDeltas: { resilience: 2, courage: 1 } },
        ],
      },
      { id: "consequence", title: "What Happened", titleHe: "מה קרה", spine: "As the sky pinkens, the visitor blesses the hero — changed, marked, and stronger for the night.", spineHe: "כשהשמיים נצבעים בוורוד, האורח מברך את הגיבור. אחרי הלילה הזה הוא אחר, וחזק יותר." },
      { id: "growth", title: "Growing", titleHe: "צומחים", spine: "The hero learns that some good things only come to those who hold on through the long dark.", spineHe: "הגיבור לומד שיש דברים טובים שמגיעים רק למי שמחזיק מעמד בחושך הארוך." },
      { id: "victory", title: "Victory", titleHe: "הניצחון", spine: "The sun rises on a hero with a new name and a steady, hard-won peace.", spineHe: "השמש זורחת על גיבור עם שם חדש, ועם שקט פנימי שהוא הרוויח בעצמו." },
      { id: "reflection", title: "Reflection", titleHe: "רגע לחשוב", spine: "The hero walks into the new day, sore but proud, ready for what waits across the river.", spineHe: "הגיבור יוצא אל היום החדש, עייף אבל גאה, ומוכן למה שמחכה מעבר לנהר." },
    ],
  },
  {
    id: "the-garden-of-forgotten-seeds",
    pack: "growth",
    title: "The Garden of Forgotten Seeds",
    titleHe: "גן הזרעים הנשכחים",
    theme: "Potential and patient work",
    origin: "original",
    ageRange: [3, 5],
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
      { id: "call", title: "A Dusty Little Packet", titleHe: "שקית קטנה ומאובקת", spine: "Behind the old garden gate, the hero finds a dusty little packet. Inside are seeds, round and brown and very, very small. \"Hello, seeds,\" whispers the hero.", spineHe: "מאחורי שער הגינה הישן, הגיבור מוצא שקית קטנה ומאובקת. בפנים יש זרעים, עגולים וחומים וקטנים, קטנים מאוד. \"שלום, זרעים,\" לוחש הגיבור.", spineHeF: "מאחורי שער הגינה הישן, הגיבורה מוצאת שקית קטנה ומאובקת. בפנים יש זרעים, עגולים וחומים וקטנים, קטנים מאוד. \"שלום, זרעים,\" לוחשת הגיבורה." },
      { id: "challenge", title: "Pat, Pat, Splash", titleHe: "טפ, טפ, שפריץ", spine: "The hero digs small holes, drops in the seeds, and pats the soil: pat, pat. Bun brings the little watering can. Splish, splash! \"Sleep tight, little seeds.\"", spineHe: "הגיבור חופר גומות קטנות, מכניס את הזרעים וטופח על האדמה: טפ, טפ. ארנבוני מביא את המזלף הקטן. שפריץ, שפריץ! \"תישנו טוב, זרעים קטנים.\"", spineHeF: "הגיבורה חופרת גומות קטנות, מכניסה את הזרעים וטופחת על האדמה: טפ, טפ. ארנבוני מביא את המזלף הקטן. שפריץ, שפריץ! \"תישנו טוב, זרעים קטנים.\"" },
      { id: "fear", title: "Only Brown Soil", titleHe: "רק אדמה חומה", spine: "One day, two days, three days. The hero looks and looks. Only brown soil. \"Where are you, seeds?\" Bun's ears droop down low.", spineHe: "יום אחד, יומיים, שלושה ימים. הגיבור מסתכל ומסתכל. רק אדמה חומה. \"איפה אתם, זרעים?\" האוזניים של ארנבוני נשמטות למטה.", spineHeF: "יום אחד, יומיים, שלושה ימים. הגיבורה מסתכלת ומסתכלת. רק אדמה חומה. \"איפה אתם, זרעים?\" האוזניים של ארנבוני נשמטות למטה." },
      {
        id: "decision",
        title: "Still Nothing?",
        titleHe: "עדיין כלום?",
        spine: "Morning comes again. The little watering can waits by the gate. What should the hero do?",
        spineHe: "שוב בוקר. המזלף הקטן מחכה ליד השער. מה הגיבור יעשה?",
        spineHeF: "שוב בוקר. המזלף הקטן מחכה ליד השער. מה הגיבורה תעשה?",
        choices: [
          { id: "a", label: "Sing the seeds a song", labelHe: "לשיר לזרעים שיר", outcomeHint: "The hero sings, \"Wake up, seeds!\" and the warm sun shines down on the soil.", outcomeHintHe: "הגיבור שר: \"תתעוררו, זרעים!\" והשמש החמה זורחת על האדמה.", outcomeHintHeF: "הגיבורה שרה: \"תתעוררו, זרעים!\" והשמש החמה זורחת על האדמה.", metricDeltas: {} },
          { id: "b", label: "Ask Grandma what seeds need", labelHe: "לשאול את סבתא מה זרעים צריכים", outcomeHint: "\"Water, sun, and a little time,\" says Grandma, and she kneels down to help.", outcomeHintHe: "\"מים, שמש, וקצת זמן,\" אומרת סבתא, ומתכופפת לעזור.", metricDeltas: { wisdom: 1, empathy: 1 } },
          { id: "c", label: "Water them again, every day", labelHe: "להשקות שוב, כל יום", outcomeHint: "Splish, splash, every morning. \"Sleep tight, seeds,\" says the hero. \"See you tomorrow!\"", outcomeHintHe: "שפריץ, שפריץ, בכל בוקר. \"תישנו טוב, זרעים,\" אומר הגיבור. \"נתראה מחר!\"", outcomeHintHeF: "שפריץ, שפריץ, בכל בוקר. \"תישנו טוב, זרעים,\" אומרת הגיבורה. \"נתראה מחר!\"", metricDeltas: { resilience: 2, responsibility: 1 } },
        ],
      },
      { id: "consequence", title: "A Tiny Green Hello", titleHe: "שלום ירוק קטנטן", spine: "Then one morning, the hero sees it: a tiny green shoot, poking up from the soil. Then another. And another! Bun hops up and down.", spineHe: "ואז, בוקר אחד, הגיבור רואה: נבט ירוק קטנטן מציץ מתוך האדמה. ועוד אחד. ועוד אחד! ארנבוני קופץ למעלה ולמטה.", spineHeF: "ואז, בוקר אחד, הגיבורה רואה: נבט ירוק קטנטן מציץ מתוך האדמה. ועוד אחד. ועוד אחד! ארנבוני קופץ למעלה ולמטה." },
      { id: "growth", title: "Little Green Fists", titleHe: "אגרופים ירוקים קטנים", spine: "Every morning, splish, splash. The shoots grow leaves, then buds, round and tight like little fists. The hero counts them: one, two, three, four!", spineHe: "בכל בוקר, שפריץ, שפריץ. לנבטים צומחים עלים, ואחר כך ניצנים, עגולים וסגורים כמו אגרופים קטנים. הגיבור סופר אותם: אחד, שניים, שלושה, ארבעה!", spineHeF: "בכל בוקר, שפריץ, שפריץ. לנבטים צומחים עלים, ואחר כך ניצנים, עגולים וסגורים כמו אגרופים קטנים. הגיבורה סופרת אותם: אחד, שניים, שלושה, ארבעה!" },
      { id: "victory", title: "Pink, Orange, Purple!", titleHe: "ורוד, כתום, סגול!", spine: "One sunny day, the buds open: pink, orange, purple, red! The bare brown patch is a whole garden now, buzzing with bees. The hero laughs and spins around.", spineHe: "ביום שמשי אחד, הניצנים נפתחים: ורוד, כתום, סגול, אדום! החלקה החומה והריקה היא עכשיו גינה שלמה, מזמזמת בדבורים. הגיבור צוחק ומסתובב סביב עצמו.", spineHeF: "ביום שמשי אחד, הניצנים נפתחים: ורוד, כתום, סגול, אדום! החלקה החומה והריקה היא עכשיו גינה שלמה, מזמזמת בדבורים. הגיבורה צוחקת ומסתובבת סביב עצמה." },
      { id: "reflection", title: "New Little Seeds", titleHe: "זרעים קטנים חדשים", spine: "The hero sits among the flowers, with Bun on one knee. In the middle of the biggest flower are new seeds, round and brown and very, very small.", spineHe: "הגיבור יושב בין הפרחים, וארנבוני על הברך. באמצע הפרח הכי גדול יש זרעים חדשים, עגולים וחומים וקטנים, קטנים מאוד.", spineHeF: "הגיבורה יושבת בין הפרחים, וארנבוני על הברך. באמצע הפרח הכי גדול יש זרעים חדשים, עגולים וחומים וקטנים, קטנים מאוד." },
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
      { id: "call", title: "The Golden Crown", titleHe: "כתר הזהב", spine: "The hero wears a golden crown and sits on a big, tall chair. Whenever people can't agree, they come to the hero for help.", spineHe: "הגיבור חובש כתר זהב ויושב על כיסא גבוה גבוה. בכל פעם שאנשים לא מסכימים, הם באים אל הגיבור לבקש עזרה.", spineHeF: "הגיבורה חובשת כתר זהב ויושבת על כיסא גבוה גבוה. בכל פעם שאנשים לא מסכימים, הם באים אל הגיבורה לבקש עזרה." },
      { id: "challenge", title: "Mine! Mine!", titleHe: "שלי! שלי!", spine: "One morning, two children run in, both holding one little wooden horse. \"He's mine!\" says Noa. \"No, he's MINE!\" says Eli. Jingle, jingle goes his little bell.", spineHe: "בוקר אחד, שני ילדים נכנסים בריצה, ושניהם מחזיקים סוס עץ קטן אחד. \"הוא שלי!\" אומרת נועה. \"לא, הוא שלי!\" אומר אלי. דינג, דינג, מצלצל הפעמון הקטן שלו." },
      { id: "fear", title: "Who Is Right?", titleHe: "מי צודק?", spine: "The hero looks at Noa, then at Eli. Both faces are red. Both voices are loud. Who is right? Bun peeks out from behind the big chair.", spineHe: "הגיבור מסתכל על נועה, ואז על אלי. שני הפרצופים אדומים. שני הקולות רועשים. מי צודק? ארנבוני מציץ מאחורי הכיסא הגדול.", spineHeF: "הגיבורה מסתכלת על נועה, ואז על אלי. שני הפרצופים אדומים. שני הקולות רועשים. מי צודק? ארנבוני מציץ מאחורי הכיסא הגדול." },
      {
        id: "decision",
        title: "Hmm, Hmm, Hmm",
        titleHe: "הממ, הממ, הממ",
        spine: "The hero taps the crown and thinks: hmm, hmm, hmm. Jingle, jingle goes the little bell. What should the hero do?",
        spineHe: "הגיבור נוגע בכתר וחושב: הממ, הממ, הממ. דינג, דינג, מצלצל הפעמון הקטן. מה הגיבור יעשה?",
        spineHeF: "הגיבורה נוגעת בכתר וחושבת: הממ, הממ, הממ. דינג, דינג, מצלצל הפעמון הקטן. מה הגיבורה תעשה?",
        choices: [
          { id: "a", label: "Let each child hold him", labelHe: "לתת לכל ילד להחזיק אותו", outcomeHint: "Eli tugs and pulls. Noa holds the horse softly, close to her heart.", outcomeHintHe: "אלי מושך וגורר. נועה מחזיקה את הסוס בעדינות, קרוב ללב.", metricDeltas: {} },
          { id: "b", label: "Say, \"Let's cut him in two\"", labelHe: "לומר: \"בואו נחתוך אותו לשניים\"", outcomeHint: "\"No! Don't break him!\" cries Noa. \"Eli can have him. Just don't break him!\"", outcomeHintHe: "\"לא! אל תשברו אותו!\" קוראת נועה. \"תנו אותו לאלי, רק אל תשברו אותו!\"", metricDeltas: { wisdom: 1, empathy: 1 } },
          { id: "c", label: "Ask each one a question", labelHe: "לשאול כל אחד שאלה", outcomeHint: "\"Does he have a secret?\" asks the hero. \"Yes! Look under his tummy!\" says Noa.", outcomeHintHe: "\"יש לו סוד?\" שואל הגיבור. \"כן! תסתכל מתחת לבטן שלו!\" אומרת נועה.", outcomeHintHeF: "\"יש לו סוד?\" שואלת הגיבורה. \"כן! תסתכלי מתחת לבטן שלו!\" אומרת נועה.", metricDeltas: { wisdom: 2, empathy: 1 } },
        ],
      },
      { id: "consequence", title: "A Tiny Star", titleHe: "כוכב קטנטן", spine: "The hero turns the horse over. Under his tummy is a tiny painted star. \"That's Jingle's star!\" says Noa. \"My grandpa painted it.\" The hero gives Jingle back to her.", spineHe: "הגיבור הופך את הסוס. מתחת לבטן שלו מצויר כוכב קטנטן. \"זה הכוכב של צלצול!\" אומרת נועה. \"סבא שלי צייר אותו.\" הגיבור מחזיר לה את צלצול.", spineHeF: "הגיבורה הופכת את הסוס. מתחת לבטן שלו מצויר כוכב קטנטן. \"זה הכוכב של צלצול!\" אומרת נועה. \"סבא שלי צייר אותו.\" הגיבורה מחזירה לה את צלצול." },
      { id: "growth", title: "Empty Hands", titleHe: "ידיים ריקות", spine: "Eli looks down at his empty hands. His lip wobbles. The hero kneels beside him: \"You wanted a horse too, didn't you?\" Eli nods.", spineHe: "אלי מסתכל על הידיים הריקות שלו. השפה שלו רועדת. הגיבור כורע לידו: \"גם אתה רצית סוס, נכון?\" אלי מהנהן.", spineHeF: "אלי מסתכל על הידיים הריקות שלו. השפה שלו רועדת. הגיבורה כורעת לידו: \"גם אתה רצית סוס, נכון?\" אלי מהנהן." },
      { id: "victory", title: "Clip-Clop, Jingle!", titleHe: "קלופ־קלופ, דינג!", spine: "Noa looks at Eli. \"Want to play with Jingle together?\" Clip-clop, jingle, jingle! The two children gallop him across the shiny floor, and the hero laughs.", spineHe: "נועה מסתכלת על אלי. \"רוצה לשחק עם צלצול ביחד?\" קלופ־קלופ, דינג, דינג! שני הילדים דוהרים איתו על הרצפה המבריקה, והגיבור צוחק.", spineHeF: "נועה מסתכלת על אלי. \"רוצה לשחק עם צלצול ביחד?\" קלופ־קלופ, דינג, דינג! שני הילדים דוהרים איתו על הרצפה המבריקה, והגיבורה צוחקת." },
      { id: "reflection", title: "Goodnight, Crown", titleHe: "לילה טוב, כתר", spine: "When the sun goes down, the hero hangs the golden crown on its hook. From far down the street comes a tiny sound: jingle, jingle. Bun yawns on the big chair.", spineHe: "כשהשמש שוקעת, הגיבור תולה את כתר הזהב על הוו. מרחוק, מקצה הרחוב, נשמע צליל קטן: דינג, דינג. ארנבוני מפהק על הכיסא הגדול.", spineHeF: "כשהשמש שוקעת, הגיבורה תולה את כתר הזהב על הוו. מרחוק, מקצה הרחוב, נשמע צליל קטן: דינג, דינג. ארנבוני מפהק על הכיסא הגדול." },
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
    ageRange: [3, 7],
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
    origin: "original",
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
    ageRange: [6, 8],
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
    ageRange: [4, 7],
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
    ageRange: [3, 7],
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
  {
    id: "the-tyrant-and-the-town",
    pack: "courage",
    title: "The Tyrant and the Town",
    titleHe: "העריץ והעיירה",
    theme: "Confronting unfair power with truth and community",
    themeHe: "להתמודד עם כוח לא הוגן בעזרת אמת וקהילה",
    origin: "original",
    ageRange: [6, 8],
    primaryMetric: "courage",
    dilemmaType: "courage",
    baseReward: {"courage":2,"truth":1},
    learningObjective: "Children learn that when someone uses power unfairly, the brave thing is to say the truth out loud and invite others to stand with you, and that real change comes from courage and community, not from being cruel back.",
    learningObjectiveHe: "ילדים לומדים שכאשר מישהו משתמש בכוח בצורה לא הוגנת, הדבר האמיץ הוא לומר את האמת בקול ולהזמין אחרים לעמוד לצידך, ושינוי אמיתי מגיע מאומץ וקהילה, ולא מלהיות אכזרי בחזרה.",
    parentReflection: {
      practiced: ["Naming an unfair situation out loud instead of staying silent","Finding courage even when your body feels scared (shaky voice, pounding heart)","Standing together as a community rather than fighting back with cruelty"],
      practicedHe: ["לקרוא בשם למצב לא הוגן בקול, במקום להישאר בשקט","למצוא אומץ גם כשהגוף מרגיש פחד (קול רועד, לב דופק)","לעמוד יחד כקהילה במקום להילחם בחזרה באכזריות"],
      questions: ["Have you ever seen something unfair but felt too scared to say anything? What happened?","What helps you feel braver when your tummy is nervous, like Maya's was?","Why do you think it mattered that the other kids stood up too, and not just Maya?"],
      questionsHe: ["האם ראית פעם משהו לא הוגן אבל פחדת מדי לומר משהו? מה קרה?","מה עוזר לך להרגיש אמיץ יותר כשהבטן שלך מתרגשת, כמו של מאיה?","למה לדעתך היה חשוב שגם הילדים האחרים קמו, ולא רק מאיה?"],
    },
    parentInsight: {"en":"This story draws on an ancient pattern: the tyrant who hoards what belongs to the community, and the unlikely hero who restores order by speaking the truth. Notice that Maya doesn't win through force or by humiliating Bruno. She wins by voluntarily confronting the thing she fears, articulating what is true, and letting others freely choose to stand with her. The bully isn't destroyed but disarmed and invited back into the community by sharing, which models that the goal of confronting bad behavior is repair, not revenge. For your child, the lesson is that a single honest voice has real weight, that courage means acting while afraid, and that standing together is how fairness gets restored.","he":"הסיפור נשען על תבנית עתיקה: העריץ שאוגר את מה ששייך לקהילה, והגיבור הבלתי צפוי שמשיב את הסדר על כנו באמצעות אמירת האמת. שימו לב שמאיה לא מנצחת בכוח או בהשפלת ברונו. היא מנצחת בכך שהיא בוחרת מרצונה להתעמת עם מה שהיא חוששת ממנו, מנסחת את מה שאמיתי, ומאפשרת לאחרים לבחור בחופשיות לעמוד לצידה. הבריון אינו מושמד אלא מפורק מנשקו ומוזמן בחזרה אל הקהילה דרך שיתוף, מה שמלמד שמטרת ההתמודדות עם התנהגות רעה היא תיקון, לא נקמה. עבור הילד שלכם, הלקח הוא שלקול כן אחד יש משקל אמיתי, שאומץ הוא לפעול למרות הפחד, ושעמידה יחד היא הדרך שבה הוגנות מושבת על כנה."},
    beats: [
      { id: "call", title: "The Locked-Up Playground", titleHe: "מגרש המשחקים הנעול", spine: "In the little town of Brightwell, the big sandy playground belonged to everyone. But a tall boy named Bruno put a rope around the swings and a sign that said 'Mine.' He decided who could play and who could not, and most days the answer was no.", spineHe: "בעיירה הקטנה בְּרַייטוֵל, מגרש המשחקים החולי הגדול היה שייך לכולם. אבל ילד גבוה בשם בְּרוּנוֹ קשר חבל סביב הנדנדות ותלה שלט שכתוב עליו 'שלי'. הוא החליט מי מותר לו לשחק ומי לא, וברוב הימים התשובה הייתה לא." },
      { id: "challenge", title: "A Town That Whispers", titleHe: "עיירה שלוחשת", spine: "A girl named Maya loved that playground. She watched Bruno take the good toys for himself and shoo the little kids away. Everyone whispered that it was wrong, but no one said it out loud. Maya felt the unfair thing sitting heavy in her chest.", spineHe: "ילדה בשם מאיה אהבה את מגרש המשחקים הזה. היא ראתה את ברונו לוקח לעצמו את הצעצועים הטובים ומגרש את הקטנים. כולם לחשו שזה לא בסדר, אבל אף אחד לא אמר את זה בקול. מאיה הרגישה את חוסר ההוגנות יושב כבד בחזה שלה." },
      { id: "fear", title: "The Big Cold Shadow", titleHe: "הצל הגדול והקר", spine: "Bruno was bigger than her, and his voice was loud. When Maya imagined standing in front of everyone and saying the truth, her hands went cold and her tummy flipped. What if he laughed at her? What if no one stood with her and she was all alone?", spineHe: "ברונו היה גדול ממנה, והקול שלו היה רועם. כשמאיה דמיינה את עצמה עומדת מול כולם ואומרת את האמת, הידיים שלה התקררו והבטן התהפכה. מה אם הוא יצחק עליה? מה אם אף אחד לא יעמוד לצידה והיא תישאר לבד לגמרי?" },
      { id: "decision", title: "What Will Maya Do?", titleHe: "מה מאיה תעשה?", spine: "The sun was warm, the swings hung empty behind the rope, and the little kids looked at Maya with hopeful eyes. She took a breath. She had to choose.", spineHe: "השמש חיממה, הנדנדות נתלו ריקות מאחורי החבל, והילדים הקטנים הביטו במאיה בעיניים מלאות תקווה. היא לקחה נשימה. היא הייתה צריכה לבחור.",
        choices: [
          { id: "a", label: "Go home and play alone where it's safe.", labelHe: "ללכת הביתה ולשחק לבד, איפה שבטוח.", outcomeHint: "The playground stays locked, and the heavy unfair feeling comes home with you.", outcomeHintHe: "מגרש המשחקים נשאר נעול, והתחושה הכבדה של חוסר ההוגנות חוזרת איתך הביתה.", metricDeltas: {} },
          { id: "b", label: "Quietly ask the other kids and a grown-up to help first.", labelHe: "לבקש בשקט מהילדים האחרים וממבוגר לעזור קודם.", outcomeHint: "Asking for help is wise and kind, and you don't have to do hard things all alone.", outcomeHintHe: "לבקש עזרה זה חכם וטוב לב, ואתה לא חייב לעשות דברים קשים לגמרי לבד.", metricDeltas: {"empathy":1,"wisdom":1} },
          { id: "c", label: "Stand up tall and say the truth out loud, even though it's scary.", labelHe: "לעמוד זקופה ולומר את האמת בקול, גם אם זה מפחיד.", outcomeHint: "Your voice shakes and your heart pounds, but the truth is finally in the open.", outcomeHintHe: "הקול שלך רועד והלב דופק, אבל האמת סוף סוף נמצאת בחוץ, גלויה לכולם.", metricDeltas: {"courage":2,"truth":1} },
        ],
      },
      { id: "consequence", title: "Maya Speaks", titleHe: "מאיה מדברת", spine: "Maya walked up to the rope. Her voice trembled, but she said it clear and true: 'This playground belongs to all of us. It isn't yours to lock away.' Bruno crossed his arms and frowned down at her. For one long second, it was just Maya and the big cold shadow.", spineHe: "מאיה צעדה אל החבל. הקול שלה רעד, אבל היא אמרה את זה ברור ובאמת: 'מגרש המשחקים הזה שייך לכולנו. הוא לא שלך לנעול אותו.' ברונו שילב ידיים והעווה את פניו כלפיה. לרגע ארוך אחד, היו רק מאיה והצל הגדול והקר." },
      { id: "growth", title: "One by One, They Rise", titleHe: "אחד-אחד, הם קמים", spine: "Then a small voice said, 'She's right.' Another kid stepped up. Then three more. Soon the whole town of children stood beside Maya, not shouting, not pushing, just standing together and saying the same true thing. Bruno's loud voice suddenly felt very small.", spineHe: "ואז קול קטן אמר: 'היא צודקת.' ילד נוסף התקדם. אחר כך עוד שלושה. עד מהרה כל ילדי העיירה עמדו לצד מאיה, בלי לצעוק, בלי לדחוף, פשוט עומדים יחד ואומרים את אותו דבר אמיתי. הקול הרועם של ברונו פתאום הרגיש קטן מאוד." },
      { id: "victory", title: "The Rope Comes Down", titleHe: "החבל יורד", spine: "Bruno looked at all the faces. No one was cruel to him, and that surprised him most of all. Slowly, he untied the rope. 'I just wanted to be the one who matters,' he said quietly. Maya smiled. 'You can matter by sharing.' And Bruno pushed the very first kid on the swing.", spineHe: "ברונו הביט בכל הפנים. אף אחד לא היה אכזרי כלפיו, וזה הפתיע אותו יותר מכל. לאט-לאט, הוא התיר את החבל. 'רק רציתי להיות זה שחשוב,' הוא אמר בשקט. מאיה חייכה. 'אתה יכול להיות חשוב על ידי שיתוף.' וברונו הדף את הילד הראשון על הנדנדה." },
      { id: "reflection", title: "The Playground That Belongs to All", titleHe: "מגרש המשחקים ששייך לכולם", spine: "That evening the swings creaked happily for everyone. Maya learned that one shaky true voice can wake up a whole town, and that real strength isn't about being the biggest. It's about telling the truth and standing together until the unfair thing is set right.", spineHe: "באותו ערב הנדנדות חרקו בשמחה לכולם. מאיה למדה שקול אמיתי אחד, גם אם הוא רועד, יכול להעיר עיירה שלמה, ושכוח אמיתי הוא לא להיות הכי גדול. הוא לומר את האמת ולעמוד יחד עד שמתקנים את מה שלא הוגן." },
    ],
  },
  {
    id: "the-friendly-monster",
    pack: "growth",
    title: "The Friendly Monster",
    titleHe: "המפלצת הידידותית",
    theme: "A gentle child discovers a big, fierce roar inside and learns to aim that strength to protect a friend — strength under control, not strength erased.",
    themeHe: "ילד עדין מגלה שיש בתוכו שאגה גדולה ואמיצה, ולומד לכוון את הכוח הזה כדי להגן על חבר — כוח בשליטה, לא כוח שנמחק.",
    origin: "original",
    ageRange: [4, 8],
    primaryMetric: "resilience",
    dilemmaType: "courage",
    baseReward: {"resilience":2,"courage":1},
    learningObjective: "Children learn that being \"harmless\" is not the same as being good. Real strength means having a big power inside, learning to control it, and pointing it toward protecting someone smaller — not hiding it away.",
    learningObjectiveHe: "ילדים לומדים ש\"להיות לא־מזיק\" זה לא אותו דבר כמו להיות טוב. כוח אמיתי הוא להחזיק כוח גדול בפנים, ללמוד לשלוט בו, ולכוון אותו כדי להגן על מישהו קטן ממך — לא להחביא אותו.",
    parentReflection: {
      practiced: ["Milo felt a big, fierce feeling and learned to steer it instead of hiding it or letting it explode.","He aimed his strength at protecting someone smaller and more vulnerable than himself.","He discovered that being gentle and being strong are not opposites — he could be both at once."],
      practicedHe: ["מילו הרגיש רגש גדול ועז ולמד לכוון אותו במקום להחביא אותו או לתת לו להתפוצץ.","הוא כיוון את הכוח שלו להגן על מישהו קטן ופגיע יותר ממנו.","הוא גילה שלהיות עדין ולהיות חזק זה לא הפכים — הוא יכול להיות גם וגם בו זמנית."],
      questions: ["Have you ever felt a really big feeling inside, like a roar? Where in your body did you feel it?","Milo used his big voice to protect his friend, not to scare him. What is something strong you could do to help someone?","Is it okay to be loud and big sometimes? When do you think a big, brave voice is the right thing to use?"],
      questionsHe: ["פעם הרגשת רגש ממש גדול בפנים, כמו שאגה? איפה בגוף הרגשת אותו?","מילו השתמש בקול הגדול שלו כדי להגן על החבר, לא כדי להפחיד אותו. מה זה משהו חזק שאתה יכול לעשות כדי לעזור למישהו?","האם זה בסדר להיות רועש וגדול לפעמים? מתי לדעתך קול גדול ואמיץ הוא הדבר הנכון להשתמש בו?"],
    },
    parentInsight: {"en":"This story works with one idea: gentleness that comes only from weakness is not the same as goodness. Real goodness shows when someone who is strong chooses to keep that strength under control and to use it to help. Milo isn't asked to erase his fierceness (his 'roar'); he's asked to integrate it — to know it, own it, and aim it. The monster inside is really his own strength, and the developmental task isn't to slay it but to befriend and harness it. For a 4–8 year old, this plants an early, healthy frame: big feelings and power are not shameful things to suppress, nor wild things to unleash — they are forces to take responsibility for and point toward protecting others.","he":"הסיפור הזה עובד עם רעיון אחד: עדינות שנובעת רק מחולשה אינה אותו דבר כמו טוּב. טוּב אמיתי נראה כשמישהו חזק בוחר להחזיק את הכוח שלו בשליטה ולהשתמש בו כדי לעזור. לא מבקשים ממילו למחוק את העזוּת שלו (את ה'שאגה'); מבקשים ממנו לשלב אותה — להכיר אותה, לקחת עליה בעלות, ולכוון אותה. המפלצת שבפנים היא למעשה הכוח שלו עצמו, והמשימה ההתפתחותית אינה להרוג אותה אלא להתיידד איתה ולרתום אותה. לילד בן 4–8 זה שותל מסגרת בריאה ומוקדמת: רגשות גדולים וכוח אינם דברים מבישים שצריך לדכא, ולא דברים פראיים שצריך לשחרר — הם כוחות שלוקחים עליהם אחריות ומכוונים אותם להגנה על אחרים."},
    beats: [
      { id: "call", title: "The Quiet One", titleHe: "השקט שבחבורה", spine: "Milo was the gentlest kid on the whole playground. He spoke softly, he stepped softly, and he was always, always careful never to be too big or too loud. \"A good friend is a small friend,\" he liked to think. But lately, deep in his tummy, something kept rumbling — like a sleepy mountain getting ready to wake up.", spineHe: "מילו היה הילד הכי עדין בכל הגינה. הוא דיבר בשקט, הוא צעד בשקט, ותמיד תמיד נזהר לא להיות גדול מדי או רועש מדי. \"חבר טוב הוא חבר קטן,\" הוא אהב לחשוב. אבל לאחרונה, עמוק בתוך הבטן שלו, משהו רעם בלי הפסקה — כמו הר מנומנם שמתכונן להתעורר." },
      { id: "challenge", title: "The Rumble Wakes Up", titleHe: "הרעם מתעורר", spine: "One afternoon, big kids cornered little Pip by the sandbox. They knocked over Pip's careful sand castle and laughed while Pip's eyes filled up. Milo felt the rumble in his tummy grow huge and warm and fierce, pushing up his chest like a roar that wanted out. It scared him. \"Big feelings are bad feelings,\" he whispered, and tried to swallow it back down.", spineHe: "אחר צהריים אחד, ילדים גדולים כיתרו את פיפ הקטן ליד ארגז החול. הם הפילו את מגדל החול שפיפ בנה בזהירות וצחקו בזמן שעיניו של פיפ התמלאו בדמעות. מילו הרגיש את הרעם בבטן גדל, חם ועז, ודוחף לו את החזה כמו שאגה שרוצה לצאת. זה הפחיד אותו. \"רגשות גדולים הם רגשות רעים,\" הוא לחש, וניסה לבלוע אותם בחזרה." },
      { id: "fear", title: "The Scary Power", titleHe: "הכוח המפחיד", spine: "Milo's heart pounded. What if the roar came out and he became loud and scary, just like the big kids? What if his strength hurt someone? Being a tiny, harmless mouse had always felt safe. The rumble pressed harder, and Milo squeezed his eyes shut, more afraid of the power inside him than of the bullies in front of him.", spineHe: "הלב של מילו הלם. מה אם השאגה תצא והוא ייהפך לרועש ומפחיד, בדיוק כמו הילדים הגדולים? מה אם הכוח שלו יפגע במישהו? להיות עכבר קטנטן ולא־מזיק תמיד הרגיש בטוח. הרעם לחץ חזק יותר, ומילו עצם את העיניים בחוזקה, מפוחד מהכוח שבתוכו יותר מאשר מהבריונים שמולו." },
      { id: "decision", title: "What Milo Does", titleHe: "מה מילו עושה", spine: "Pip looked up at Milo with wobbly, hoping eyes. The rumble was right there, ready. Milo had to choose what to do with the big strength inside him.", spineHe: "פיפ הביט במעלה אל מילו בעיניים רועדות ומלאות תקווה. הרעם היה ממש שם, מוכן. מילו היה צריך לבחור מה לעשות עם הכוח הגדול שבתוכו.",
        choices: [
          { id: "a", label: "Stay small and tiptoe away so no one notices him.", labelHe: "להישאר קטן ולחמוק על קצות האצבעות כדי שאף אחד לא ישים לב אליו.", outcomeHint: "Milo keeps himself safe and harmless — but Pip is left alone, and the rumble inside aches, unused.", outcomeHintHe: "מילו שומר על עצמו בטוח ולא־מזיק — אבל פיפ נשאר לבד, והרעם בפנים כואב, לא בשימוש.", metricDeltas: {} },
          { id: "b", label: "Run and bring a grown-up to help stop the big kids.", labelHe: "לרוץ ולהביא מבוגר שיעזור לעצור את הילדים הגדולים.", outcomeHint: "Asking for help is kind and wise — the grown-up comes, though Milo still hasn't met the strength waiting inside him.", outcomeHintHe: "לבקש עזרה זה טוב וחכם — המבוגר מגיע, אבל מילו עדיין לא פגש את הכוח שמחכה בתוכו.", metricDeltas: {"empathy":1,"wisdom":1} },
          { id: "c", label: "Let the roar out — but aim it: stand tall in front of Pip and say, in a big, steady voice, \"STOP. Leave my friend alone.\"", labelHe: "לתת לשאגה לצאת — אבל לכוון אותה: לעמוד זקוף לפני פיפ ולומר, בקול גדול ויציב, \"מספיק. עזבו את החבר שלי.\"", outcomeHint: "It costs Milo his cozy hiding place and makes his voice shake — but the big kids step back, and Pip is safe. Controlled strength, aimed to protect.", outcomeHintHe: "זה עולה למילו את מקום המחבוא הנעים שלו וגורם לקול שלו לרעוד — אבל הילדים הגדולים נסוגים, ופיפ בטוח. כוח בשליטה, מכוון להגנה.", metricDeltas: {"resilience":2,"courage":1} },
        ],
      },
      { id: "consequence", title: "The Roar with a Purpose", titleHe: "השאגה עם מטרה", spine: "Milo planted his feet and let the rumble rise — but he held the reins of it, the way you hold a strong, good dog on a leash. \"STOP,\" he said, big and steady. Not to hurt. To protect. His voice shook and his knees wobbled, and for a moment the playground went very quiet. The big kids blinked, surprised, and backed away from tiny Pip.", spineHe: "מילו נעץ את הרגליים ונתן לרעם לעלות — אבל הוא החזיק במושכות שלו, כמו שמחזיקים כלב חזק וטוב ברצועה. \"מספיק,\" הוא אמר, גדול ויציב. לא כדי לפגוע. כדי להגן. הקול שלו רעד והברכיים שלו רטטו, ולרגע הגינה כולה השתתקה. הילדים הגדולים מצמצו, מופתעים, ונסוגו מפיפ הקטן." },
      { id: "growth", title: "Strength on a Leash", titleHe: "כוח על רצועה", spine: "Milo's whole body buzzed. The roar hadn't turned him into a monster — he had been the one steering it the whole time. He understood something new: the rumble wasn't bad. A power you can't control is scary, and a power you hide is wasted. But a power you guide, pointed at protecting someone, is exactly what a friend is for.", spineHe: "כל הגוף של מילו רטט. השאגה לא הפכה אותו למפלצת — הוא היה זה שהוביל אותה כל הזמן. הוא הבין משהו חדש: הרעם לא היה רע. כוח שאתה לא יכול לשלוט בו הוא מפחיד, וכוח שאתה מחביא הוא בזבוז. אבל כוח שאתה מנחה, מכוון להגנה על מישהו, הוא בדיוק מה שחבר נועד לו." },
      { id: "victory", title: "Two Friends, One Castle", titleHe: "שני חברים, מגדל אחד", spine: "Milo knelt beside Pip and they rebuilt the sand castle together, taller than before, with a roaring dragon on top to guard it. Pip grinned. \"You sounded HUGE,\" Pip said. Milo smiled, feeling the gentle hum of the rumble resting calmly inside, ready but quiet. He was still kind. He was still gentle. He was just no longer harmless.", spineHe: "מילו כרע ליד פיפ והם בנו מחדש את מגדל החול ביחד, גבוה יותר מקודם, עם דרקון שואג בראשו ששומר עליו. פיפ חייך חיוך רחב. \"נשמעת ענק,\" אמר פיפ. מילו חייך, מרגיש את הזמזום העדין של הרעם נח ברוגע בפנים, מוכן אבל שקט. הוא עדיין היה טוב לב. הוא עדיין היה עדין. הוא פשוט כבר לא היה לא־מזיק." },
      { id: "reflection", title: "The Mountain Inside", titleHe: "ההר שבפנים", spine: "That night Milo thought about the sleepy mountain in his tummy. It wasn't a monster to be afraid of — it was a strength to take care of. \"I can be big AND good,\" he thought, drifting off. \"I just have to know where to point my roar.\" And the mountain inside him slept soundly, proud of the boy who had finally learned to wake it up the right way.", spineHe: "באותו לילה מילו חשב על ההר המנומנם שבבטן שלו. הוא לא היה מפלצת שצריך לפחד ממנה — הוא היה כוח שצריך לטפל בו. \"אני יכול להיות גדול וגם טוב,\" הוא חשב, נרדם לאט. \"אני רק צריך לדעת לאן לכוון את השאגה שלי.\" וההר שבתוכו ישן שינה עמוקה, גאה בילד שסוף סוף למד להעיר אותו בדרך הנכונה." },
    ],
  },
  {
    id: "the-lantern-path", pack: "courage", title: "The Lantern Path", titleHe: "שביל הפנסים",
    theme: "Asking for company can be a brave way through the dark", themeHe: "לבקש חברה יכולה להיות דרך אמיצה לעבור בחושך",
    origin: "original", ageRange: [3, 7], primaryMetric: "courage", dilemmaType: "courage",
    baseReward: { courage: 2, empathy: 1 },
    learningObjective: "Courage can mean naming fear and choosing trusted company for a hard step.",
    learningObjectiveHe: "אומץ יכול להיות לומר שפוחדים ולבחור בחברה בטוחה לצעד קשה.",
    parentReflection: {
      practiced: ["Naming fear without shame", "Asking for company", "Taking one manageable step"],
      practicedHe: ["לומר שפוחדים בלי להתבייש", "לבקש חברה", "לעשות צעד אחד שאפשר להתמודד איתו"],
      questions: ["What made the familiar path feel different?", "Who helps you feel steady?", "What small brave step could you take together?"],
      questionsHe: ["מה גרם לשביל המוכר להרגיש שונה?", "מי עוזר לך להרגיש יציב?", "איזה צעד אמיץ קטן אפשר לעשות יחד?"],
    },
    parentInsight: {
      en: "This story treats asking for company as capable action. The hero names the fear, chooses support, and still takes the step. That balance helps children separate courage from going alone.",
      he: "הסיפור מתייחס לבקשת חברה כפעולה של יכולת. הגיבור נותן שם לפחד, בוחר בתמיכה ועדיין עושה את הצעד. האיזון הזה עוזר לילדים להבחין בין אומץ לבין הליכה לבד.",
    },
    beats: [
      { id: "call", title: "The Last Lantern", titleHe: "הפנס האחרון", spine: "At dusk, the child hero notices that the little lantern at the end of the familiar garden path has gone dark.", spineHe: "עם רדת הערב, הגיבור הילד מבחין שהפנס הקטן בקצה שביל הגינה המוכר כבה." },
      { id: "challenge", title: "A Dim Familiar Path", titleHe: "שביל מוכר וחשוך", spine: "The path still leads past the mint, the round stones, and the old pear tree, but tonight every shadow looks larger.", spineHe: "השביל עדיין עובר ליד הנענע, האבנים העגולות ועץ האגס הישן, אבל הערב כל צל נראה גדול יותר." },
      { id: "fear", title: "The Wobbly Feeling", titleHe: "התחושה הרועדת", spine: "The hero's knees feel wobbly. The garden is safe and familiar, yet the dark makes the next step feel hard.", spineHe: "ברכי הגיבור רועדות. הגינה בטוחה ומוכרת, ובכל זאת החושך מקשה על הצעד הבא." },
      { id: "decision", title: "How Should We Go?", titleHe: "איך נלך?", spine: "The hero can pause, ask for company, or carry a small lantern forward one step at a time.", spineHe: "הגיבור יכול לעצור, לבקש חברה, או לשאת פנס קטן קדימה צעד אחר צעד.", choices: [
        { id: "a", label: "Pause on the porch until I feel ready", labelHe: "לעצור במרפסת עד שארגיש מוכן", outcomeHint: "The hero rests and breathes. Pausing is honest, and the lantern can wait until another moment.", outcomeHintHe: "הגיבור נח ונושם. לעצור זו בחירה כנה, והפנס יכול לחכות לרגע אחר.", metricDeltas: { wisdom: 1 } },
        { id: "b", label: "Ask someone I trust to walk with me", labelHe: "לבקש ממישהו שאני סומך עליו ללכת איתי", outcomeHint: "The hero names the fear and a trusted companion joins. Together, the shadows become ordinary garden shapes.", outcomeHintHe: "הגיבור נותן שם לפחד וחבר בטוח מצטרף. יחד, הצללים חוזרים להיות צורות רגילות בגינה.", metricDeltas: { courage: 1, empathy: 1 } },
        { id: "c", label: "Lift my lantern and take one slow step", labelHe: "להרים את הפנס ולעשות צעד איטי אחד", outcomeHint: "The hero does not rush. One careful pool of light leads to the next.", outcomeHintHe: "הגיבור לא ממהר. עיגול אור זהיר אחד מוביל אל הבא.", metricDeltas: { courage: 2, resilience: 1 } },
      ] },
      { id: "consequence", title: "Light Beside Light", titleHe: "אור לצד אור", spine: "With each chosen step, another firefly joins the lantern glow and the path becomes easier to see.", spineHe: "עם כל צעד שנבחר, גחלילית נוספת מצטרפת לאור הפנס והשביל נעשה קל יותר לראות." },
      { id: "growth", title: "Brave Together", titleHe: "אמיצים יחד", spine: "The hero learns that courage does not have to be lonely; asking for company can be the bravest first move.", spineHe: "הגיבור לומד שאומץ לא חייב להיות בודד; לבקש חברה יכול להיות הצעד הראשון האמיץ ביותר." },
      { id: "victory", title: "The Garden Glows", titleHe: "הגינה זוהרת", spine: "The last lantern flickers on, and a ribbon of warm lights leads all the way home.", spineHe: "הפנס האחרון נדלק, וסרט של אורות חמימים מוביל כל הדרך הביתה." },
      { id: "reflection", title: "One Light Is Enough", titleHe: "אור אחד מספיק", spine: "The hero smiles at the once-dark path and remembers: one honest request and one small step can begin the light.", spineHe: "הגיבור מחייך אל השביל שהיה חשוך וזוכר: בקשה כנה אחת וצעד קטן אחד יכולים להתחיל את האור." },
    ],
  },
  {
    id: "the-cloud-orchestra", pack: "wisdom", title: "The Cloud Orchestra", titleHe: "תזמורת העננים",
    theme: "Friends find harmony by listening and taking turns", themeHe: "חברים מוצאים הרמוניה כשהם מקשיבים ומתחלפים",
    origin: "original", ageRange: [3, 7], primaryMetric: "wisdom", dilemmaType: "prudence",
    baseReward: { wisdom: 2, empathy: 1 },
    learningObjective: "Cooperation grows when each voice has room and everyone listens for the shared rhythm.",
    learningObjectiveHe: "שיתוף פעולה צומח כשיש מקום לכל קול וכולם מקשיבים לקצב המשותף.",
    parentReflection: {
      practiced: ["Listening before joining", "Taking turns", "Making room for different ideas"],
      practicedHe: ["להקשיב לפני שמצטרפים", "להתחלף בתורות", "לפנות מקום לרעיונות שונים"],
      questions: ["What happened when everyone played at once?", "How did the hero help each friend be heard?", "Where could your family try a listening rhythm?"],
      questionsHe: ["מה קרה כשכולם ניגנו יחד בבת אחת?", "איך הגיבור עזר לשמוע כל חבר?", "איפה המשפחה שלכם יכולה לנסות קצב של הקשבה?"],
    },
    parentInsight: {
      en: "The orchestra gives children a concrete picture of cooperation: listen, leave space, answer, then join. The hero succeeds by organizing attention rather than controlling friends.",
      he: "התזמורת נותנת לילדים תמונה מוחשית של שיתוף פעולה: להקשיב, להשאיר מקום, לענות ואז להצטרף. הגיבור מצליח על ידי ארגון הקשב ולא על ידי שליטה בחברים.",
    },
    beats: [
      { id: "call", title: "A Song for the Moon", titleHe: "שיר לירח", spine: "The child hero and three cloud friends are invited to play a welcome song when the moon rises.", spineHe: "הגיבור הילד ושלושה חברי ענן מוזמנים לנגן שיר קבלת פנים כשהירח עולה." },
      { id: "challenge", title: "Thunder, Drizzle, Whistle", titleHe: "רעם, טפטוף, שריקה", spine: "One cloud booms, one drizzles, and one whistles. Each sound is wonderful, but together they tumble into noise.", spineHe: "ענן אחד רועם, אחד מטפטף ואחד שורק. כל צליל נהדר, אבל יחד הם מתגלגלים לרעש." },
      { id: "fear", title: "No Room for My Sound", titleHe: "אין מקום לצליל שלי", spine: "Everyone worries that listening means losing their own part, and the moon is already peeking over the hill.", spineHe: "כולם חוששים שלהקשיב פירושו לאבד את התפקיד שלהם, והירח כבר מציץ מעבר לגבעה." },
      { id: "decision", title: "Find the Rhythm", titleHe: "למצוא את הקצב", spine: "The hero must help the clouds choose how to make music together.", spineHe: "הגיבור צריך לעזור לעננים לבחור איך ליצור מוזיקה יחד.", choices: [
        { id: "a", label: "Stop and listen quietly for one round", labelHe: "לעצור ולהקשיב בשקט לסיבוב אחד", outcomeHint: "The quiet pause lets everyone notice the beat that was hiding underneath the noise.", outcomeHintHe: "העצירה השקטה מאפשרת לכולם להבחין בפעמה שהסתתרה מתחת לרעש.", metricDeltas: { empathy: 1 } },
        { id: "b", label: "Invite each cloud to play one turn", labelHe: "להזמין כל ענן לנגן בתורו", outcomeHint: "Each friend gets a clear moment, hears the others, and feels included.", outcomeHintHe: "כל חבר מקבל רגע ברור, שומע את האחרים ומרגיש שייך.", metricDeltas: { empathy: 2, wisdom: 1 } },
        { id: "c", label: "Tap a steady beat everyone can follow", labelHe: "להקיש פעמה יציבה שכולם יכולים לעקוב אחריה", outcomeHint: "The hero offers a simple rhythm; the clouds listen and weave their sounds around it.", outcomeHintHe: "הגיבור מציע קצב פשוט; העננים מקשיבים ושוזרים סביבו את הצלילים שלהם.", metricDeltas: { wisdom: 2, responsibility: 1 } },
      ] },
      { id: "consequence", title: "A Space Between Sounds", titleHe: "רווח בין הצלילים", spine: "The clouds leave tiny spaces for one another, and the noise begins to sound like a playful song.", spineHe: "העננים משאירים רווחים קטנים זה לזה, והרעש מתחיל להישמע כמו שיר שובב." },
      { id: "growth", title: "Listening Is Part of Playing", titleHe: "הקשבה היא חלק מהנגינה", spine: "The hero discovers that the best musicians do not only make sound; they also notice when another sound needs room.", spineHe: "הגיבור מגלה שהנגנים הטובים לא רק משמיעים צליל; הם גם מבחינים מתי צליל אחר צריך מקום." },
      { id: "victory", title: "The Moon Dances", titleHe: "הירח רוקד", spine: "Boom, patter, whistle, hush—the cloud orchestra plays one bright song and the moon seems to dance.", spineHe: "בום, טפטוף, שריקה, שקט — תזמורת העננים מנגנת שיר בהיר אחד והירח כאילו רוקד." },
      { id: "reflection", title: "Every Voice Has a Place", titleHe: "לכל קול יש מקום", spine: "Floating home, the hero hears the friends humming the shared rhythm and knows every voice mattered.", spineHe: "בדרך הביתה בין העננים, הגיבור שומע את החברים מזמזמים את הקצב המשותף ויודע שכל קול היה חשוב." },
    ],
  },
  {
    id: "the-little-bridge-builders", pack: "growth", title: "The Little Bridge Builders", titleHe: "בוני הגשר הקטנים",
    theme: "A big repair becomes possible one careful piece at a time", themeHe: "תיקון גדול נעשה אפשרי חלק זהיר אחד בכל פעם",
    origin: "original", ageRange: [3, 7], primaryMetric: "resilience", dilemmaType: "repair",
    baseReward: { resilience: 2, responsibility: 1 },
    learningObjective: "Large tasks feel manageable when we pause, plan, ask for help, and finish one useful piece at a time.",
    learningObjectiveHe: "משימות גדולות נעשות אפשריות כשעוצרים, מתכננים, מבקשים עזרה ומסיימים חלק שימושי אחד בכל פעם.",
    parentReflection: {
      practiced: ["Breaking a large job into pieces", "Repairing instead of blaming", "Accepting useful help"],
      practicedHe: ["לחלק משימה גדולה לחלקים", "לתקן במקום להאשים", "לקבל עזרה שימושית"],
      questions: ["Which bridge piece came first?", "What helped when the job felt too big?", "What could you rebuild one piece at a time?"],
      questionsHe: ["איזה חלק בגשר הגיע ראשון?", "מה עזר כשהעבודה הרגישה גדולה מדי?", "מה אפשר לבנות מחדש חלק אחד בכל פעם?"],
    },
    parentInsight: {
      en: "The broken bridge turns overwhelm into a sequence children can rehearse: look, choose one piece, test it, and continue. Responsibility appears as repair and follow-through rather than blame.",
      he: "הגשר השבור הופך הצפה לרצף שילדים יכולים לתרגל: להסתכל, לבחור חלק אחד, לבדוק ולהמשיך. אחריות מופיעה כתיקון והתמדה ולא כהאשמה.",
    },
    beats: [
      { id: "call", title: "The Toy-Stream Parade", titleHe: "מצעד נחל הצעצועים", spine: "The child hero and two tiny builder friends prepare a parade across the wooden bridge over their toy stream.", spineHe: "הגיבור הילד ושני חברים בונים קטנים מכינים מצעד על גשר העץ שמעל נחל הצעצועים." },
      { id: "challenge", title: "Splash—The Bridge Is Down", titleHe: "שפריץ — הגשר נפל", spine: "A rushing cup of water loosens the blocks, and the bridge tips into the stream just before the parade.", spineHe: "כוס מים זורמת משחררת את הקוביות, והגשר נופל אל הנחל רגע לפני המצעד." },
      { id: "fear", title: "Too Many Pieces", titleHe: "יותר מדי חלקים", spine: "Blocks, sticks, and ribbons float everywhere. The hero feels the whole job arrive at once and wants to give up.", spineHe: "קוביות, מקלות וסרטים צפים בכל מקום. הגיבור מרגיש שכל העבודה מגיעה בבת אחת ורוצה לוותר." },
      { id: "decision", title: "Where Do We Begin?", titleHe: "מאיפה מתחילים?", spine: "The builders can pause, share the jobs, or begin with one strong foundation block.", spineHe: "הבונים יכולים לעצור, לחלק תפקידים, או להתחיל בקוביית יסוד חזקה אחת.", choices: [
        { id: "a", label: "Pause and make a little plan", labelHe: "לעצור ולהכין תוכנית קטנה", outcomeHint: "The builders breathe, sort the pieces, and draw three simple steps before touching the bridge.", outcomeHintHe: "הבונים נושמים, ממיינים את החלקים ומציירים שלושה צעדים פשוטים לפני שנוגעים בגשר.", metricDeltas: { wisdom: 1, responsibility: 1 } },
        { id: "b", label: "Ask each friend to carry one kind of piece", labelHe: "לבקש מכל חבר לשאת סוג אחד של חלק", outcomeHint: "No one carries the whole bridge; each friend takes a useful job and the pile grows smaller.", outcomeHintHe: "אף אחד לא נושא את כל הגשר; כל חבר מקבל תפקיד שימושי והערימה קטנה.", metricDeltas: { empathy: 1, responsibility: 1 } },
        { id: "c", label: "Set one strong block, then the next", labelHe: "להניח קובייה חזקה אחת ואז את הבאה", outcomeHint: "The hero focuses on one piece at a time and soon a steady base appears.", outcomeHintHe: "הגיבור מתמקד בחלק אחד בכל פעם, ועד מהרה מופיע בסיס יציב.", metricDeltas: { resilience: 2, responsibility: 1 } },
      ] },
      { id: "consequence", title: "Build, Check, Build", titleHe: "לבנות, לבדוק, לבנות", spine: "After every piece, the friends press gently and check the bridge. One wobbly block is moved without blame.", spineHe: "אחרי כל חלק, החברים לוחצים בעדינות ובודקים את הגשר. קובייה מתנדנדת אחת מוזזת בלי האשמה." },
      { id: "growth", title: "Small Pieces Make Strong Things", titleHe: "חלקים קטנים יוצרים דברים חזקים", spine: "The hero learns that a large repair is only many small, careful jobs joined together.", spineHe: "הגיבור לומד שתיקון גדול הוא פשוט הרבה עבודות קטנות וזהירות שמתחברות יחד." },
      { id: "victory", title: "The Parade Crosses", titleHe: "המצעד חוצה", spine: "The rebuilt bridge holds. Tiny carts, paper flags, and cheering friends cross safely to the other side.", spineHe: "הגשר שנבנה מחדש מחזיק. עגלות קטנות, דגלי נייר וחברים מריעים חוצים בבטחה לצד השני." },
      { id: "reflection", title: "A Builder's Quiet Pride", titleHe: "הגאווה השקטה של בונה", spine: "The hero looks at the strong little bridge and remembers the first block that made the big job possible.", spineHe: "הגיבור מביט בגשר הקטן והחזק וזוכר את הקובייה הראשונה שאפשרה את העבודה הגדולה." },
    ],
  },
];

/** Look up a story spec by id. Returns undefined for unknown ids. */
export const getStorySpec = (id: string): HeroStorySpec | undefined =>
  HERO_STORIES.find((s) => s.id === id);

/**
 * W2-SHELLPLAY critic r1 (law 8): the title a parent reads for a stored run.
 * A run keeps the title it was told in (`run.language`). Read in that same
 * language it stays — it is the personalised retelling the child heard. Read
 * in the OTHER language it resolves through the catalogue by `storyId`
 * (`titleHe` / `title`), so a Hebrew library never shows an English title.
 * Only a run with no catalogue spec falls back to its stored title.
 */
export const runTitle = (
  run: { storyId: string; title: string; language?: "en" | "he" },
  uiLang: "en" | "he",
): string => {
  if (run.language === uiLang && run.title?.trim()) return run.title;
  const spec = getStorySpec(run.storyId);
  if (spec) return uiLang === "he" ? spec.titleHe || spec.title : spec.title;
  return run.title;
};

/** Stories belonging to a pack, in catalog order. */
export const storiesInPack = (pack: HeroPackId): HeroStorySpec[] =>
  HERO_STORIES.filter((s) => s.pack === pack);

/**
 * B-KID-46 (KB-03) — a story is offered in a language only when it can be TOLD
 * in that language: in Hebrew, every beat has `spineHe` and every Decision
 * choice has `labelHe` + `outcomeHintHe` (the authored fallback,
 * `authoredJourneyRender`, otherwise shows the English spine to a Hebrew
 * child). English is the authoring language, so every story qualifies.
 */
export const storyHasLanguage = (story: HeroStorySpec, lang: "en" | "he"): boolean =>
  lang !== "he" ||
  story.beats.every(
    (b) => Boolean(b.spineHe?.trim()) && (b.choices ?? []).every((c) => Boolean(c.labelHe?.trim() && c.outcomeHintHe?.trim())),
  );

/** The language a story is offered in: Hebrew when either the UI or the story
 *  (AI) language is Hebrew — a Hebrew UI never lists an English-only story, and
 *  a Hebrew narration never falls back to English text. */
export const storyLanguage = (uiLang: string, aiLang: string): "en" | "he" =>
  uiLang === "he" || aiLang === "he" ? "he" : "en";

/**
 * B-KID-23 — ⚠ REVIEW STATE: the Hebrew beat titles, beats, choices and
 * endings of the stories listed here are an AI FIRST PASS (5 Oct 2026, read
 * aloud to 3–7-year-olds: short sentences, no nikud), shipped the way the
 * B-GROWTH-11 milestone catalogue was (`MILESTONE_HE_REVIEW`). Native
 * editorial review is owed (GD-6 / G-02); remove an id once a native Hebrew
 * editor has signed that story off. Guard: lib/storyHebrew.test.ts.
 */
export const STORY_HE_REVIEW: Readonly<Record<string, "ai-first-pass">> = {
  "david-and-goliath": "ai-first-pass",
  "moses-and-pharaoh": "ai-first-pass",
  "the-lion-who-was-afraid": "ai-first-pass",
  "noahs-ark": "ai-first-pass",
  "jonah-and-the-great-fish": "ai-first-pass",
  "the-dragon-of-responsibility": "ai-first-pass",
  "joseph-and-his-brothers": "ai-first-pass",
  "jacob-wrestling-the-angel": "ai-first-pass",
  "the-garden-of-forgotten-seeds": "ai-first-pass",
  "king-solomons-choice": "ai-first-pass",
};

/** `list` narrowed to the stories that can be told in `lang` (order kept). */
export const storiesForLanguage = <S extends HeroStorySpec>(list: readonly S[], lang: "en" | "he"): S[] =>
  list.filter((s) => storyHasLanguage(s, lang));
