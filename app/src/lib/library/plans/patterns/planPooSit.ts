/**
 * plan-poo-sit — B-BOOK-76 (the worked proof): hard poo, holding it in, afraid
 * of the toilet. Band 5–7 register (EN ≤ 40 words a page, HE ≤ 34). Written to
 * kid-everyday-plans-standard §1–§5 from the definition file
 * docs/everyday-plans/definition-plan-poo-sit.md; the definition is the source
 * of record, this file transcribes it. The steps follow the public home-plan
 * half of the paediatric functional-constipation guidance (scheduled calm
 * sitting after a meal with the feet supported, a comfort while sitting, no
 * pressure to produce); the medical half stays with the family's doctor and
 * is never in the child's text.
 *
 * - First person, present and future; "we" carries the plan; never "you".
 * - Refrains: body "my tummy gets a chance" (HE "הבטן שלי מקבלת הזדמנות");
 *   plan "we just try" (HE "אנחנו רק מנסים"). Both return on the win page.
 * - Hooks: screens 3 and 4 end unresolved; every other screen rests.
 * - `{name}` only on the cover name line and the win page's frame line.
 * - Zero virtue nouns, zero diagnosis nouns, zero digits but a time.
 * - Hebrew is AI-written: NATIVE REVIEW OWED on every line (BR8). HE-m / HE-f
 *   authored separately (first person: the verbs differ).
 * - The licensed reviewer (B-GA-01) has NOT signed this pattern: it is dark
 *   (composable only in the sandbox and for the owner allow-list) until the
 *   B-GA-37 record exists for EN and HE.
 */
import type { BookLine } from "../../types";
import type { PatternDef } from "../patterns";

const L = (en: string, he: string) => ({ en, he });
/** A line whose Hebrew is the same in both genders. */
const same = (en: string, he: string): BookLine => ({ en, he: { m: he, f: he } });
const mf = (en: string, m: string, f: string): BookLine => ({ en, he: { m, f } });

/** Hero slots on the shared plates (master fractions). Placeholder geometry
 *  until the art agent delivers the plan plates (B-BOOK-76 wave 2). */
const standLeft = { x: 0.3, y: 0.9, scale: 0.46, facing: "right" as const, z: "fr" as const };
const standRight = { x: 0.68, y: 0.9, scale: 0.46, facing: "left" as const, z: "fr" as const };
const sitToilet = { x: 0.5, y: 0.84, scale: 0.4, facing: "right" as const, z: "fr" as const };
const sitFloor = { x: 0.36, y: 0.9, scale: 0.36, facing: "right" as const, z: "fr" as const };

export const PLAN_POO_SIT: PatternDef = {
  id: "plan-poo-sit",
  title: L("The toilet champion", "הבטן שלי לומדת לשחרר"),
  coverLine: L("A story about my tummy and our new plan.", "סיפור על הבטן שלי ועל התוכנית החדשה שלנו."),
  coverNameLine: L("{name}'s special plan", "התוכנית המיוחדת של {name}"),
  shelf: "body",
  ageBands: ["36m", "48m", "60m", "6-8y"],
  ageText: "3–8",
  parentWords: L("Hard poo, holding it in, or afraid of the toilet", "קקי קשה, התאפקות, או פחד מהשירותים"),
  knowledge: "A body learns to let go when sitting is calm, regular and free of pressure; the family's job is the chance, not the result.",
  frames: {
    cover: {
      id: "cover",
      text: same("A story about my tummy and our new plan.", "סיפור על הבטן שלי ועל התוכנית החדשה שלנו."),
      pose: "hands-up",
      art: { plateId: "PP1", slot: standLeft, phoneCrop: 0.4 },
      spread: true,
    },
    bodyGood: {
      id: "p1",
      text: same(
        "My body is like a wonderful machine! It can run fast, jump high, and climb to the top of the slide. It eats, it plays, and it grows a little every day.",
        "הגוף שלי הוא כמו מכונה נהדרת! הוא יכול לרוץ מהר, לקפוץ גבוה ולטפס עד למעלה במגלשה. הוא אוכל, משחק, וגדל קצת כל יום.",
      ),
      pose: "stand-tall",
      art: { plateId: "PP1", slot: standRight, phoneCrop: 0.6 },
    },
    howItWorks: {
      id: "p2",
      text: mf(
        "After I eat, my tummy does important work. It takes what my body needs from the food. What is left over becomes poo, and the poo waits inside until it is ready to come out.",
        "אחרי שאני אוכל, הבטן שלי עושה עבודה חשובה. היא לוקחת מהאוכל את מה שטוב לגוף שלי. מה שנשאר הופך לקקי, והקקי מחכה בפנים עד שהוא מוכן לצאת.",
        "אחרי שאני אוכלת, הבטן שלי עושה עבודה חשובה. היא לוקחת מהאוכל את מה שטוב לגוף שלי. מה שנשאר הופך לקקי, והקקי מחכה בפנים עד שהוא מוכן לצאת.",
      ),
      pose: "stand-tall",
      art: { plateId: "PP2", slot: { x: 0.22, y: 0.92, scale: 0.44, facing: "right", z: "fr" }, phoneCrop: 0.5 },
    },
    sometimesHard: {
      id: "p3",
      text: mf(
        "Sometimes the poo wants to come out, but it is a little hard. Sometimes it hurts, or it feels scary. Sometimes I am busy playing, and I would rather keep playing. So my tummy holds on, and holds on.",
        "לפעמים הקקי רוצה לצאת, אבל זה קצת קשה. לפעמים זה כואב, או מרגיש מפחיד. לפעמים אני עסוק במשחק, ומתחשק לי להמשיך לשחק. אז הבטן שלי מחזיקה, ומחזיקה.",
        "לפעמים הקקי רוצה לצאת, אבל זה קצת קשה. לפעמים זה כואב, או מרגיש מפחיד. לפעמים אני עסוקה במשחק, ומתחשק לי להמשיך לשחק. אז הבטן שלי מחזיקה, ומחזיקה.",
      ),
      pose: "hold-tummy",
      art: { plateId: "PP3", slot: standLeft, phoneCrop: 0.4 },
    },
    wePlan: {
      id: "p4",
      text: same(
        "My family and I want to help my tummy feel much better. So now we have a new special plan. It has three steps, and we do them together.",
        "המשפחה שלי ואני רוצים לעזור לבטן שלי להרגיש הרבה יותר טוב. אז עכשיו יש לנו תוכנית מיוחדת וחדשה. יש בה שלושה שלבים, ואנחנו עושים אותם ביחד.",
      ),
      pose: "point-up",
      art: { plateId: "PP4", slot: standRight, phoneCrop: 0.6 },
    },
    win: {
      id: "p8",
      text: same(
        "When the poo comes out, my tummy feels light and happy. Every time we sit, my body learns to let go at the right time. My tummy gets a chance, and we just try. That is my plan!",
        "כשהקקי יוצא, הבטן שלי מרגישה קלה ושמחה. בכל פעם שאנחנו יושבים, הגוף שלי לומד לשחרר בזמן הנכון. הבטן שלי מקבלת הזדמנות, ואנחנו רק מנסים. זאת התוכנית שלי!",
      ),
      closing: same("{name}'s tummy is learning.", "הבטן של {name} לומדת."),
      pose: "hands-up",
      art: { plateId: "PP8", slot: { x: 0.5, y: 0.88, scale: 0.48, facing: "right", z: "fr" }, phoneCrop: 0.5 },
      spread: true,
    },
  },
  menu: [
    {
      id: "sit-after-meal",
      slot: 1,
      text: same(
        "Step one: every {time}, we sit calmly on the toilet for about {minutes} minutes. My feet rest on a little step. I am comfy, and my tummy gets a chance.",
        "שלב ראשון: כל {time}, אנחנו יושבים בשקט על האסלה בערך {minutes} דקות. הרגליים שלי נחות על שרפרף קטן. נוח לי, והבטן שלי מקבלת הזדמנות.",
      ),
      parentLine: L("Sit calmly on the toilet for about {minutes} minutes every {time}, about twenty minutes after the meal, feet on a step.", "לשבת בשקט על האסלה בערך {minutes} דקות כל {time}, כעשרים דקות אחרי הארוחה, עם הרגליים על שרפרף."),
      defaultMinutes: 5,
      defaultTime: "evening",
      pose: "sit-calm",
      art: { plateId: "PP5", slot: sitToilet, phoneCrop: 0.5 },
      sourceIds: ["naspghan-espghan-2014", "nhs-constipation-children"],
    },
    {
      id: "sit-same-time",
      slot: 1,
      text: same(
        "Step one: every {time}, at the same time, we sit calmly on the toilet for about {minutes} minutes. My feet rest on a little step, and my tummy gets a chance.",
        "שלב ראשון: כל {time}, באותה שעה, אנחנו יושבים בשקט על האסלה בערך {minutes} דקות. הרגליים שלי נחות על שרפרף קטן, והבטן שלי מקבלת הזדמנות.",
      ),
      parentLine: L("Sit calmly at the same time every {time} for about {minutes} minutes, feet on a step.", "לשבת בשקט באותה שעה כל {time}, בערך {minutes} דקות, עם הרגליים על שרפרף."),
      defaultMinutes: 5,
      defaultTime: "evening",
      pose: "sit-calm",
      art: { plateId: "PP5", slot: sitToilet, phoneCrop: 0.5 },
      sourceIds: ["naspghan-espghan-2014", "aap-constipation"],
    },
    {
      id: "the-box",
      slot: 2,
      text: mf(
        "Step two: the wonder box! While I sit, I can have something I love from the box: a book, bubbles, a story from my grown-up, or a calm little game.",
        "שלב שני: קופסת הקסם! בזמן שאני יושב, יש לי משהו שאני אוהב מהקופסה: ספר, בועות סבון, סיפור מהמבוגר שלי, או משחק קטן ורגוע.",
        "שלב שני: קופסת הקסם! בזמן שאני יושבת, יש לי משהו שאני אוהבת מהקופסה: ספר, בועות סבון, סיפור מהמבוגר שלי, או משחק קטן ורגוע.",
      ),
      parentLine: L("A box of things only for sitting time: a book, bubbles, a story, a calm game.", "קופסה עם דברים שמיועדים רק לזמן הישיבה: ספר, בועות סבון, סיפור, משחק רגוע."),
      pose: "hold-box",
      art: { plateId: "PP6", slot: sitFloor, phoneCrop: 0.4 },
      sourceIds: ["naspghan-espghan-2014", "nhs-constipation-children"],
    },
    {
      id: "blow-bubbles",
      slot: 2,
      text: mf(
        "Step two: while I sit, I blow bubbles, slow and long. My tummy goes soft when I blow, and the bubbles float up to the ceiling.",
        "שלב שני: בזמן שאני יושב, אני מנשף בועות סבון, לאט ובאריכות. הבטן שלי נעשית רכה כשאני מנשף, והבועות עפות עד התקרה.",
        "שלב שני: בזמן שאני יושבת, אני מנשפת בועות סבון, לאט ובאריכות. הבטן שלי נעשית רכה כשאני מנשפת, והבועות עפות עד התקרה.",
      ),
      parentLine: L("Blow bubbles or breathe out slowly while sitting; a long out-breath relaxes the tummy.", "לנשוף בועות סבון או לנשוף לאט בזמן הישיבה; נשיפה ארוכה מרפה את הבטן."),
      pose: "sit-calm",
      art: { plateId: "PP5", slot: sitToilet, phoneCrop: 0.5 },
      sourceIds: ["nhs-constipation-children"],
    },
    {
      id: "just-try",
      slot: 3,
      text: mf(
        "Step three is the most important: we just try. I do not have to make poo every time. Sitting calmly gives my tummy a chance, and that is all we need.",
        "השלב השלישי הוא החשוב מכולם: אנחנו רק מנסים. אני לא חייב לעשות קקי בכל פעם. לשבת בשקט נותן לבטן שלי הזדמנות, וזה כל מה שחשוב.",
        "השלב השלישי הוא החשוב מכולם: אנחנו רק מנסים. אני לא חייבת לעשות קקי בכל פעם. לשבת בשקט נותן לבטן שלי הזדמנות, וזה כל מה שחשוב.",
      ),
      parentLine: L("Just try: no need to produce, no comment on the result. Sitting is the whole task.", "רק מנסים: אין צורך להצליח, ואין הערה על התוצאה. הישיבה עצמה היא כל המשימה."),
      pose: "sit-calm",
      art: { plateId: "PP7", slot: sitToilet, phoneCrop: 0.5 },
      sourceIds: ["naspghan-espghan-2014", "aap-constipation"],
    },
  ],
  defaultSteps: ["sit-after-meal", "the-box", "just-try"],
  boxItems: [
    { id: "book", label: L("A book I love", "ספר אהוב"), glyph: "auto_stories" },
    { id: "soap-bubbles", label: L("Bubbles", "בועות סבון"), glyph: "bubble" },
    { id: "story", label: L("A story from my grown-up", "סיפור מהמבוגר שלי"), glyph: "record_voice_over" },
    { id: "calm-game", label: L("A calm little game", "משחק קטן ורגוע"), glyph: "extension" },
    { id: "song", label: L("A song we sing", "שיר שאנחנו שרים"), glyph: "music_note" },
  ],
  defaultDurationDays: 21,
  minutesRange: [3, 10],
  sources: [
    {
      id: "naspghan-espghan-2014",
      label: L(
        "NASPGHAN / ESPGHAN joint guideline on functional constipation in children (Tabbers et al., 2014): the behavioural half — demystification without blame, scheduled calm toilet sitting after meals with a footstool, no pressure to produce. The medical half belongs to the family's doctor.",
        "ההנחיה המשותפת של NASPGHAN / ESPGHAN לעצירות תפקודית בילדים (Tabbers ואחרים, 2014): החלק ההתנהגותי — הסבר בלי האשמה, ישיבה רגועה וקבועה על האסלה אחרי ארוחות עם שרפרף לרגליים, בלי לחץ להצליח. החלק הרפואי שייך לרופא של המשפחה.",
      ),
      url: "https://journals.lww.com/jpgn/fulltext/2014/02000/evaluation_and_treatment_of_functional.24.aspx",
    },
    {
      id: "nhs-constipation-children",
      label: L("NHS: Constipation in children — regular toilet time after meals, feet supported, a relaxed routine, when to see a GP.", "NHS: עצירות בילדים — זמן קבוע בשירותים אחרי ארוחות, רגליים נתמכות, שגרה רגועה, ומתי לפנות לרופא."),
      url: "https://www.nhs.uk/conditions/baby/health/constipation-in-children/",
    },
    {
      id: "aap-constipation",
      label: L("AAP HealthyChildren.org: constipation and toilet-learning pages — a child-oriented pace, no punishment, the doctor for the medical questions.", "AAP HealthyChildren.org: עמודי העצירות ולמידת השירותים — קצב שמתאים לילד, בלי עונש, והרופא לשאלות הרפואיות."),
      url: "https://www.healthychildren.org/English/health-issues/conditions/abdominal/Pages/Constipation.aspx",
    },
  ],
  watchFor: [
    { id: "blood", text: L("There is blood in the poo.", "יש דם בקקי.") },
    { id: "fever-vomit", text: L("There is fever or vomiting with it.", "יש חום או הקאות יחד עם זה.") },
    { id: "swollen", text: L("The tummy is very swollen or very painful.", "הבטן נפוחה מאוד או כואבת מאוד.") },
    { id: "weight-growth", text: L("Your child is losing weight or not growing as before.", "הילד או הילדה מאבדים משקל או לא גדלים כמו קודם.") },
    { id: "from-birth", text: L("The poo problems have been there since birth.", "הקושי עם הקקי קיים מהלידה.") },
    { id: "after-event", text: L("It started after a fall or an illness.", "זה התחיל אחרי נפילה או מחלה.") },
    { id: "under-3", text: L("Your child is under three and has not started toilet learning yet.", "הילד או הילדה מתחת לגיל שלוש ועוד לא התחילו ללמוד שירותים.") },
  ],
  parent: {
    knows: L(
      "A child who holds poo in is not being difficult: a hard or painful poo teaches the body to hold on, and holding on makes the next one harder. The plan breaks that loop the way the paediatric guidance does at home: a calm, regular sit after a meal with the feet supported, something pleasant while sitting, and no pressure to produce. Any medicine or diet question stays with your doctor.",
      "ילד או ילדה שמתאפקים לא עושים קשיים: קקי קשה או כואב מלמד את הגוף להתאפק, וההתאפקות מקשה על הפעם הבאה. התוכנית שוברת את המעגל הזה כמו שההנחיות לרופאי ילדים מציעות לבית: ישיבה רגועה וקבועה אחרי ארוחה עם רגליים נתמכות, משהו נעים בזמן הישיבה, ובלי לחץ להצליח. כל שאלה על תרופות או תזונה נשארת אצל הרופא שלכם.",
    ),
    whyNow: L(
      "Between three and eight, the body learns toileting habits that last. A few weeks of calm, predictable sits is a developmentally informed parent practice that most families can keep up, and it works best before the holding has gone on for long.",
      "בין גיל שלוש לשמונה הגוף לומד הרגלי שירותים שנשארים. כמה שבועות של ישיבות רגועות וצפויות הם תרגול הורי מבוסס התפתחות שרוב המשפחות יכולות להתמיד בו, והוא עובד הכי טוב לפני שההתאפקות נמשכת זמן רב.",
    ),
    tomorrow: L(
      "Pick the sitting time tonight and put the step and the box in the bathroom before the first sit, so the first evening is about sitting, not about looking for things.",
      "בחרו הערב את שעת הישיבה ושימו את השרפרף והקופסה בשירותים לפני הישיבה הראשונה, כדי שהערב הראשון יהיה על ישיבה ולא על חיפוש דברים.",
    ),
    askAfter: mf("What goes in our wonder box?", "מה נכנס לקופסת הקסם שלנו?", "מה נכנס לקופסת הקסם שלנו?"),
    together: L("Read it again before the first sit, and let your child turn the pages.", "קראו שוב לפני הישיבה הראשונה, ותנו לילד או לילדה להפוך את הדפים."),
    sourceNote: L(
      "The steps follow the behavioural part of the NASPGHAN / ESPGHAN guideline on functional constipation in children (2014), the NHS page on constipation in children and the AAP HealthyChildren toilet pages. The story form follows the social-story tradition: facts first, the hard part named without shame, a small plan, a calm ending. It is a developmentally informed parent practice; the medical questions belong to your doctor.",
      "השלבים עוקבים אחרי החלק ההתנהגותי בהנחיית NASPGHAN / ESPGHAN לעצירות תפקודית בילדים (2014), עמוד ה-NHS על עצירות בילדים ועמודי השירותים של AAP HealthyChildren. צורת הסיפור הולכת בעקבות מסורת הסיפור החברתי: קודם עובדות, הקושי נאמר בלי בושה, תוכנית קטנה, סיום רגוע. זהו תרגול הורי מבוסס התפתחות; השאלות הרפואיות שייכות לרופא שלכם.",
    ),
    firstWeek: L(
      "The first week is often uneven: some sits produce nothing, some evenings your child does not want to sit at all. That is expected. Keep the sit short and the mood light, and count sits, not results.",
      "השבוע הראשון לרוב לא אחיד: בחלק מהישיבות לא קורה כלום, ובערבים מסוימים הילד או הילדה לא רוצים לשבת בכלל. זה צפוי. שמרו על ישיבה קצרה ועל מצב רוח קל, וספרו ישיבות, לא תוצאות.",
    ),
  },
  bannedWords: {
    en: ["constipation", "constipated", "encopresis", "soiling", "withholding", "laxative", "accident"],
    he: ["עצירות", "אנקופרזיס", "משלשל", "תאונה"],
  },
  poses: ["hands-up", "stand-tall", "hold-tummy", "point-up", "sit-calm", "hold-box"],
  scepticsThree: [
    { en: "“Scheduled sitting without stool softening can entrench withholding in a child whose stools are hard.” Answered in the panel: the medical half stays with the doctor; the red lines route pain, swelling and blood to care before any plan." },
    { en: "“A story that praises the toilet can shame a child who still soils.” Answered in the text: no verdict, no merit; the body learns, the child only tries; soiling words are banned in the child text." },
    { en: "“Toilet sitting is wrong for a child under three or one with problems since birth.” Answered in the red lines: both route to the doctor and no plan is offered." },
  ],
};
