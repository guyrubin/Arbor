export interface AcademyStoryFrame {
  coreQuestion: string;
  coreQuestionHe: string;
  archetype: string;
  archetypeHe: string;
  deepFrame: string;
  childTakeaway: string;
  visualGrammar: string;
  viralLine: string;
  viralLineHe: string;
}

const DEFAULT_FRAME: AcademyStoryFrame = {
  coreQuestion: "What kind of hero do I become when something hard stands in front of me?",
  coreQuestionHe: "איזה גיבור אני נהיה כשמשהו קשה עומד מולי?",
  archetype: "A child meets chaos, chooses a truthful aim, and grows stronger through action.",
  archetypeHe: "ילד פוגש כאוס, בוחר כיוון אמיתי, ומתחזק דרך פעולה.",
  deepFrame:
    "A good story does not preach. It lets the child feel the pull between hiding and becoming responsible, then shows how one small truthful action changes the world.",
  childTakeaway: "I can choose one honest, brave, kind next step.",
  visualGrammar:
    "premium cinematic children's Bible adventure, warm comic-book lighting, avatar hero centered, clear story props, expressive but non-scary faces, rich environment details, no text or logos",
  viralLine: "One small brave choice became a story worth sharing.",
  viralLineHe: "בחירה אמיצה קטנה הפכה לסיפור ששווה לשתף.",
};

export const ACADEMY_STORY_FRAMES: Record<string, AcademyStoryFrame> = {
  "david-and-goliath": {
    coreQuestion: "What do I do when the giant looks bigger than me?",
    coreQuestionHe: "מה אני עושה כשהענק נראה גדול ממני?",
    archetype: "The small hero faces chaos with an aimed heart and the tool already in their hand.",
    archetypeHe: "הגיבור הקטן פוגש כאוס עם לב מכוון והכלי שכבר ביד שלו.",
    deepFrame:
      "Courage is not pretending the giant is small. Courage is seeing the giant clearly, choosing the true aim, and stepping forward with the simple tool you actually have.",
    childTakeaway: "My fear can be loud, and I can still aim at what is right.",
    visualGrammar:
      "sunlit valley, giant shadow, smooth stones, sling, distant army, dust and golden light, avatar child hero in red-blue suit with a glowing heart, brave but gentle tension",
    viralLine: "The giant was huge. The brave step was small. That was enough.",
    viralLineHe: "הענק היה ענק. הצעד האמיץ היה קטן. וזה הספיק.",
  },
  "moses-and-pharaoh": {
    coreQuestion: "Can a small voice tell the truth in front of great power?",
    coreQuestionHe: "האם קול קטן יכול להגיד אמת מול כוח גדול?",
    archetype: "The truthful voice stands before the throne and speaks for those who cannot.",
    archetypeHe: "הקול האמיתי עומד מול הכס ומדבר בשביל מי שלא יכול.",
    deepFrame:
      "A child's voice becomes strong when it is ordered toward protection, fairness, and truth. The story should make speaking up feel scary, necessary, and noble.",
    childTakeaway: "My voice matters when I use it for what is right.",
    visualGrammar:
      "ancient palace, towering columns, warm desert light, river-blue accents, pharaoh silhouette, families waiting in the distance, avatar hero standing upright with a glowing heart",
    viralLine: "A steady voice can move a palace.",
    viralLineHe: "קול יציב יכול להזיז ארמון.",
  },
  "the-lion-who-was-afraid": {
    coreQuestion: "What if being brave starts by telling the truth about fear?",
    coreQuestionHe: "מה אם אומץ מתחיל בלספר את האמת על הפחד?",
    archetype: "The strong one admits fear, then walks toward the dark to protect the small one.",
    archetypeHe: "החזק מודה שהוא מפחד, ואז הולך אל החושך כדי להגן על הקטן.",
    deepFrame:
      "Fear shrinks when it is named and carried with kindness. The child's task is not to erase fear, but to become the sort of person who can move while afraid.",
    childTakeaway: "I can be scared and still take one kind brave step.",
    visualGrammar:
      "moonlit grassland, gentle lion, lantern glow, lost cub, blue shadows, soft stars, avatar hero beside the lion with a protective pose, magical but safe night",
    viralLine: "The brave lion was the one who admitted he was afraid.",
    viralLineHe: "האריה האמיץ היה זה שהודה שהוא מפחד.",
  },
  "noahs-ark": {
    coreQuestion: "Who do I become when I prepare before anyone claps?",
    coreQuestionHe: "מי אני נהיה כשאני מתכונן לפני שמישהו מוחא כפיים?",
    archetype: "The responsible builder creates order before the storm arrives.",
    archetypeHe: "הבונה האחראי יוצר סדר לפני שהסערה מגיעה.",
    deepFrame:
      "Responsibility often looks silly before it looks wise. The story should dignify slow preparation, repeated effort, and caring for creatures who depend on you.",
    childTakeaway: "Small steady work keeps what I love safe.",
    visualGrammar:
      "large wooden ark, pairs of animals, warm rain clouds, rainbow hints, tools and planks, family teamwork, avatar hero carrying a plank with blue bunny sidekick",
    viralLine: "The ark was built before the rain.",
    viralLineHe: "התיבה נבנתה לפני הגשם.",
  },
  "jonah-and-the-great-fish": {
    coreQuestion: "What happens when I stop running from the thing I know I should do?",
    coreQuestionHe: "מה קורה כשאני מפסיק לברוח ממה שאני יודע שצריך לעשות?",
    archetype: "The runaway turns around and finds responsibility waiting like a second chance.",
    archetypeHe: "הבורח מסתובב בחזרה ומגלה שאחריות מחכה לו כמו הזדמנות שנייה.",
    deepFrame:
      "The great fish is not punishment. It is the quiet place where the child notices that running did not remove the task, then chooses return over escape.",
    childTakeaway: "I can turn back, repair, and try again.",
    visualGrammar:
      "wide sea, gentle enormous fish, storm turning calm, glowing underwater blues, shoreline in the distance, avatar hero protected and reflective, no scary teeth",
    viralLine: "Turning back was the bravest direction.",
    viralLineHe: "להסתובב בחזרה היה הכיוון הכי אמיץ.",
  },
  "the-dragon-of-responsibility": {
    coreQuestion: "Can one small job keep a whole world warm?",
    coreQuestionHe: "האם משימה קטנה אחת יכולה לשמור עולם שלם חם?",
    archetype: "The keeper of the flame learns that daily duty is quiet power.",
    archetypeHe: "שומר הלהבה לומד שחובה יומיומית היא כוח שקט.",
    deepFrame:
      "The dragon is the living symbol of a responsibility that needs daily care. The story should make routine feel magical, trusted, and socially meaningful.",
    childTakeaway: "When I do my small job, others can trust me.",
    visualGrammar:
      "cozy village at dusk, friendly small dragon, lanterns glowing, little flame, flower pots, warm windows, avatar hero feeding the flame before play",
    viralLine: "The village stayed bright because one child remembered.",
    viralLineHe: "הכפר נשאר מואר כי ילד אחד זכר.",
  },
  "joseph-and-his-brothers": {
    coreQuestion: "Can pain become wisdom instead of revenge?",
    coreQuestionHe: "האם כאב יכול להפוך לחוכמה במקום לנקמה?",
    archetype: "The wounded dreamer becomes strong enough to forgive and feed the family.",
    archetypeHe: "החולם שנפגע מתחזק מספיק כדי לסלוח ולהאכיל את המשפחה.",
    deepFrame:
      "The story should treat resentment as heavy and forgiveness as a hard-won release. The child should feel that strength is not payback; strength is becoming useful through hardship.",
    childTakeaway: "I can let hurt teach me without letting it harden me.",
    visualGrammar:
      "colorful coat, warm granary hall, sacks of grain, family faces, golden dust, long table, avatar hero with an open-handed forgiving pose",
    viralLine: "He could have closed the door. He opened the table.",
    viralLineHe: "הוא יכול היה לסגור את הדלת. הוא פתח שולחן.",
  },
  "jacob-wrestling-the-angel": {
    coreQuestion: "What blessing waits on the other side of not giving up?",
    coreQuestionHe: "איזו ברכה מחכה בצד השני של לא לוותר?",
    archetype: "The night struggle transforms the child who holds on until dawn.",
    archetypeHe: "מאבק הלילה משנה את הילד שמחזיק עד הזריחה.",
    deepFrame:
      "The night is the place of difficulty, conscience, and transformation. The child is not asked to win by force, but to hold on long enough to become different.",
    childTakeaway: "Hard things can change me into someone stronger.",
    visualGrammar:
      "river at night, dawn line on the horizon, gentle luminous visitor, swirling starlight, tired determined avatar hero holding on, sacred but child-safe atmosphere",
    viralLine: "The night was long. The morning gave him a new name.",
    viralLineHe: "הלילה היה ארוך. הבוקר נתן לו שם חדש.",
  },
  "the-garden-of-forgotten-seeds": {
    coreQuestion: "Can I care for something before I can see it growing?",
    coreQuestionHe: "האם אני יכול לטפל במשהו לפני שאני רואה שהוא גדל?",
    archetype: "The patient gardener trusts hidden growth and returns every day.",
    archetypeHe: "הגנן הסבלני בוטח בצמיחה נסתרת וחוזר כל יום.",
    deepFrame:
      "The seeds are potential. The child's discipline is to act today for a future that has not appeared yet, and to learn that invisible growth is still growth.",
    childTakeaway: "Good things can grow quietly before I see them.",
    visualGrammar:
      "secret garden, tiny shoots, watering can, oversized flowers, morning light, butterflies, avatar hero kneeling gently by the soil with a hopeful face",
    viralLine: "The garden was growing before anyone could see it.",
    viralLineHe: "הגן גדל עוד לפני שמישהו ראה.",
  },
  "king-solomons-choice": {
    coreQuestion: "How do I find the truth when everyone is loud?",
    coreQuestionHe: "איך אני מוצא אמת כשכולם מדברים חזק?",
    archetype: "The wise judge slows down, listens beneath words, and protects what is whole.",
    archetypeHe: "השופט החכם מאט, מקשיב מתחת למילים, ושומר על מה ששלם.",
    deepFrame:
      "Wisdom is not cleverness for winning. Wisdom is disciplined attention: pause, listen, notice love, and choose the answer that protects life and trust.",
    childTakeaway: "When I slow down and listen, I can choose more wisely.",
    visualGrammar:
      "golden hall, gentle scales of justice, warm wise faces, small treasure protected whole, sunlit columns, avatar hero listening carefully with calm authority",
    viralLine: "The wisest choice protected what was whole.",
    viralLineHe: "הבחירה החכמה שמרה על מה שהיה שלם.",
  },
};

export const getAcademyStoryFrame = (storyId: string | undefined): AcademyStoryFrame =>
  storyId ? ACADEMY_STORY_FRAMES[storyId] ?? DEFAULT_FRAME : DEFAULT_FRAME;
