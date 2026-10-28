/**
 * plan-big-feelings — B-BOOK-76: big feelings that overflow, hitting,
 * throwing (ages 3–8; band 5–7 register, EN ≤ 40 / HE ≤ 34). Definition of
 * record: docs/everyday-plans/definition-plan-big-feelings.md. The steps are
 * the public positive-parenting guidance (AAP HealthyChildren on tantrums
 * and discipline; the emotion-coaching and calm-down steps the public
 * parent-programme evidence describes, never a brand): notice the body
 * getting hot, the calm place and what is in it, and after the storm the
 * fix (pick up, say it, start again). No condition is named; "tantrum" as a
 * label is banned in the child's text.
 *
 * Refrains: body "my body gets hot, then it cools down" / "הגוף שלי מתחמם,
 * ואז הוא מתקרר"; plan "we fix it and start again" / "אנחנו מתקנים ומתחילים
 * מחדש". Hooks: p3 and p4 end unresolved. Hebrew AI-written: NATIVE REVIEW
 * OWED. Unsigned: dark.
 */
import type { BookLine } from "../../types";
import type { PatternDef } from "../patterns";

const L = (en: string, he: string) => ({ en, he });
const same = (en: string, he: string): BookLine => ({ en, he: { m: he, f: he } });
const mf = (en: string, m: string, f: string): BookLine => ({ en, he: { m, f } });

const standLeft = { x: 0.3, y: 0.9, scale: 0.46, facing: "right" as const, z: "fr" as const };
const standRight = { x: 0.68, y: 0.9, scale: 0.46, facing: "left" as const, z: "fr" as const };
const corner = { x: 0.34, y: 0.9, scale: 0.38, facing: "right" as const, z: "fr" as const };

export const PLAN_BIG_FEELINGS: PatternDef = {
  id: "plan-big-feelings",
  title: L("My feelings and my calm place", "הרגשות שלי והפינה הרגועה שלי"),
  coverLine: L("A story about feelings that get too big, and what we do then.", "סיפור על רגשות שנעשים גדולים מדי, ומה אנחנו עושים אז."),
  coverNameLine: L("{name}'s special plan", "התוכנית המיוחדת של {name}"),
  shelf: "feelings",
  ageBands: ["36m", "48m", "60m", "6-8y"],
  ageText: "3–8",
  parentWords: L("Big feelings that overflow: hitting, throwing, screaming", "רגשות גדולים שעולים על גדותיהם: מכות, זריקות, צרחות"),
  knowledge: "A child whose feelings overflow is not choosing it; the body goes hot before the hands do, and a plan the child knows in advance gives the hot body somewhere to go and a way back afterwards.",
  frames: {
    cover: { id: "cover", text: same("A story about feelings that get too big, and what we do then.", "סיפור על רגשות שנעשים גדולים מדי, ומה אנחנו עושים אז."), pose: "hands-up", art: { plateId: "PF1", slot: standLeft, phoneCrop: 0.4 }, spread: true },
    bodyGood: {
      id: "p1",
      text: same(
        "My body is like a wonderful machine! It laughs, it runs, and it feels things. Happy feelings, sad feelings, cross feelings. All of them live inside me, and all of them are allowed.",
        "הגוף שלי הוא כמו מכונה נהדרת! הוא צוחק, רץ, ומרגיש דברים. רגשות שמחים, רגשות עצובים, רגשות כועסים. כולם גרים בתוכי, וכולם מותרים.",
      ),
      pose: "stand-tall",
      art: { plateId: "PF1", slot: standRight, phoneCrop: 0.6 },
    },
    howItWorks: {
      id: "p2",
      text: same(
        "When a feeling gets big, my body tells me first. My face gets hot, my hands squeeze tight, and my voice gets loud. Then, slowly, my body cools down again, like a kettle after the whistle.",
        "כשרגש נעשה גדול, הגוף שלי אומר לי קודם. הפנים שלי מתחממות, הידיים שלי נלחצות חזק, והקול שלי נעשה רם. ואז, לאט, הגוף שלי מתקרר שוב, כמו קומקום אחרי השריקה.",
      ),
      pose: "hold-tummy",
      art: { plateId: "PF2", slot: standLeft, phoneCrop: 0.45 },
    },
    sometimesHard: {
      id: "p3",
      text: mf(
        "Sometimes the feeling gets so big that it spills out. My hands hit, my feet kick, or a toy goes flying. Afterwards, I feel wobbly inside. The storm came too fast, and I did not see it coming.",
        "לפעמים הרגש נעשה כל כך גדול שהוא נשפך החוצה. הידיים שלי מכות, הרגליים שלי בועטות, או שצעצוע עף. אחר כך אני מרגיש רועד בפנים. הסערה באה מהר מדי, ולא ראיתי אותה מגיעה.",
        "לפעמים הרגש נעשה כל כך גדול שהוא נשפך החוצה. הידיים שלי מכות, הרגליים שלי בועטות, או שצעצוע עף. אחר כך אני מרגישה רועדת בפנים. הסערה באה מהר מדי, ולא ראיתי אותה מגיעה.",
      ),
      pose: "hug-knees",
      art: { plateId: "PF3", slot: corner, phoneCrop: 0.4 },
    },
    wePlan: {
      id: "p4",
      text: same(
        "My family and I want my big feelings to have a safe place to go. So now we have a new special plan. It has three steps, and we do them together.",
        "המשפחה שלי ואני רוצים שלרגשות הגדולים שלי יהיה מקום בטוח ללכת אליו. אז עכשיו יש לנו תוכנית מיוחדת וחדשה. יש בה שלושה שלבים, ואנחנו עושים אותם ביחד.",
      ),
      pose: "point-up",
      art: { plateId: "PF4", slot: standRight, phoneCrop: 0.6 },
    },
    win: {
      id: "p8",
      text: same(
        "Little by little, my body learns to feel the hot coming and to find my calm place. My body gets hot, then it cools down. When something spills, we fix it and start again. That is my plan!",
        "לאט לאט, הגוף שלי לומד להרגיש את החום מגיע ולמצוא את הפינה הרגועה שלי. הגוף שלי מתחמם, ואז הוא מתקרר. כשמשהו נשפך, אנחנו מתקנים ומתחילים מחדש. זאת התוכנית שלי!",
      ),
      closing: same("{name}'s body knows the way back.", "הגוף של {name} מכיר את הדרך חזרה."),
      pose: "hands-up",
      art: { plateId: "PF8", slot: { x: 0.5, y: 0.88, scale: 0.48, facing: "right", z: "fr" }, phoneCrop: 0.5 },
      spread: true,
    },
  },
  menu: [
    {
      id: "notice-the-hot",
      slot: 1,
      text: same(
        "Step one: when my face gets hot and my hands squeeze, that is my body's signal. My grown-up says our word, \"hot\", and I say it too. Now we both know the storm is near.",
        "שלב ראשון: כשהפנים שלי מתחממות והידיים שלי נלחצות, זה הסימן של הגוף שלי. המבוגר שלי אומר את המילה שלנו, \"חם\", ואני אומר או אומרת אותה גם. עכשיו שנינו יודעים שהסערה קרובה.",
      ),
      parentLine: L("Name the body signal early with one agreed word (\"hot\"), calmly, before the hands move; say the feeling, not a verdict.", "קראו בשם לסימן הגופני מוקדם במילה אחת מוסכמת (\"חם\"), ברוגע, לפני שהידיים זזות; אמרו את הרגש, לא שיפוט."),
      defaultTime: "afternoon",
      pose: "hold-tummy",
      art: { plateId: "PF5", slot: standLeft, phoneCrop: 0.4 },
      sourceIds: ["aap-tantrums", "parent-programme-evidence"],
    },
    {
      id: "calm-place",
      slot: 2,
      text: mf(
        "Step two: my calm place. A corner with a cushion, my soft toy, and a book. When the hot comes, I go there, or my grown-up comes with me. I breathe out slow, like blowing a candle.",
        "שלב שני: הפינה הרגועה שלי. פינה עם כרית, הבובה הרכה שלי, וספר. כשהחום מגיע, אני הולך לשם, או שהמבוגר שלי בא איתי. אני נושף לאט, כמו לכבות נר.",
        "שלב שני: הפינה הרגועה שלי. פינה עם כרית, הבובה הרכה שלי, וספר. כשהחום מגיע, אני הולכת לשם, או שהמבוגר שלי בא איתי. אני נושפת לאט, כמו לכבות נר.",
      ),
      parentLine: L("A calm place the child helped make, never a punishment corner; go with them when they need you; a long out-breath together.", "פינה רגועה שהילד או הילדה עזרו להכין, לעולם לא פינת עונש; לכו איתם כשהם צריכים אתכם; נשיפה ארוכה ביחד."),
      pose: "sit-calm",
      art: { plateId: "PF6", slot: corner, phoneCrop: 0.4 },
      sourceIds: ["aap-tantrums", "parent-programme-evidence"],
    },
    {
      id: "hold-and-wait",
      slot: 2,
      text: same(
        "Step two: when the storm is here, my grown-up stays near and keeps everyone safe. We wait for the storm to pass, like waiting for rain to stop. Then my body cools down.",
        "שלב שני: כשהסערה כאן, המבוגר שלי נשאר קרוב ושומר על כולם. אנחנו מחכים שהסערה תעבור, כמו לחכות שהגשם ייפסק. ואז הגוף שלי מתקרר.",
      ),
      parentLine: L("Stay near, keep everyone safe, say little, and wait for the storm to pass before any talking.", "הישארו קרוב, שמרו על כולם, דברו מעט, וחכו שהסערה תעבור לפני כל שיחה."),
      pose: "hug-knees",
      art: { plateId: "PF6", slot: corner, phoneCrop: 0.4 },
      sourceIds: ["aap-tantrums"],
    },
    {
      id: "fix-and-start-again",
      slot: 3,
      text: same(
        "Step three is the most important: after the storm, we fix it. We pick up what fell, I say what I felt, and we start again. The feeling was big, and I am still me.",
        "השלב השלישי הוא החשוב מכולם: אחרי הסערה, אנחנו מתקנים. אנחנו מרימים מה שנפל, אני אומר או אומרת מה הרגשתי, ואנחנו מתחילים מחדש. הרגש היה גדול, ואני עדיין אני.",
      ),
      parentLine: L("After the storm: repair together (pick up, name the feeling, start again), short and warm; no lecture, no punishment, no praise.", "אחרי הסערה: תיקון ביחד (להרים, לקרוא לרגש בשם, להתחיל מחדש), קצר וחם; בלי הרצאה, בלי עונש, בלי שבחים."),
      pose: "stand-tall",
      art: { plateId: "PF7", slot: standRight, phoneCrop: 0.55 },
      sourceIds: ["aap-discipline", "parent-programme-evidence"],
    },
  ],
  defaultSteps: ["notice-the-hot", "calm-place", "fix-and-start-again"],
  boxItems: [
    { id: "cushion", label: L("A soft cushion", "כרית רכה"), glyph: "weekend" },
    { id: "soft-toy", label: L("My soft toy", "הבובה הרכה שלי"), glyph: "toys" },
    { id: "calm-book", label: L("A calm book", "ספר רגוע"), glyph: "auto_stories" },
    { id: "squeeze-ball", label: L("A squeeze ball", "כדור לחיצה"), glyph: "toys" },
    { id: "candle-breath", label: L("The candle breath", "נשימת הנר"), glyph: "air" },
  ],
  defaultDurationDays: 21,
  minutesRange: [3, 10],
  sources: [
    { id: "aap-tantrums", label: L("AAP HealthyChildren.org: temper tantrums — stay calm, keep everyone safe, name the feeling, no reward for the outburst.", "AAP HealthyChildren.org: התקפי זעם — להישאר רגועים, לשמור על כולם, לקרוא לרגש בשם, בלי פרס על ההתפרצות."), url: "https://www.healthychildren.org/English/family-life/family-dynamics/communication-discipline/Pages/Temper-Tantrums.aspx" },
    { id: "aap-discipline", label: L("AAP HealthyChildren.org: disciplining your child — repair and consistent, warm limits; no physical punishment.", "AAP HealthyChildren.org: גבולות לילד — תיקון וגבולות עקביים וחמים; בלי עונש גופני."), url: "https://www.healthychildren.org/English/family-life/family-dynamics/communication-discipline/Pages/Disciplining-Your-Child.aspx" },
    { id: "parent-programme-evidence", label: L("The public evidence base of parent programmes (emotion coaching, calm-down steps, planned repair) as summarised in the AAP and NHS parenting pages; no brand is used.", "בסיס הראיות הציבורי של תוכניות הורים (אימון רגשי, שלבי הרגעה, תיקון מתוכנן) כפי שמסוכם בעמודי ההורות של AAP ו-NHS; בלי שם מותג.") },
  ],
  watchFor: [
    { id: "self-harm", text: L("Your child hurts themself on purpose when upset.", "הילד או הילדה פוגעים בעצמם בכוונה כשהם במצוקה.") },
    { id: "not-living", text: L("Your child has talked about not wanting to live.", "הילד או הילדה דיברו על כך שלא רוצים לחיות.") },
    { id: "sudden-event", text: L("The outbursts started suddenly after a frightening event.", "ההתפרצויות התחילו פתאום אחרי אירוע מפחיד.") },
    { id: "injury", text: L("Someone has been hurt and needed care because of an outburst.", "מישהו נפגע והיה צריך רופא בגלל התפרצות.") },
    { id: "most-days-long", text: L("The outbursts last a long time most days and your child cannot calm down at all.", "ההתפרצויות נמשכות זמן רב ברוב הימים והילד או הילדה לא מצליחים להירגע בכלל.") },
  ],
  parent: {
    knows: L(
      "A child whose feelings overflow is not choosing it: the body goes hot before the hands do, and a child who knows the plan in advance has somewhere for the hot to go and a way back afterwards. The plan is the signal word, the calm place and the repair, in that order; the calm place is never a punishment, and the repair is never a lecture. If anyone has been hurt and needed care, or your child hurts themself, that is your doctor's question first.",
      "ילד או ילדה שהרגשות שלהם עולים על גדותיהם לא בוחרים בזה: הגוף מתחמם לפני שהידיים זזות, וילד שמכיר את התוכנית מראש יודע לאן החום הולך ואיך חוזרים אחר כך. התוכנית היא מילת הסימן, הפינה הרגועה והתיקון, בסדר הזה; הפינה הרגועה אף פעם לא עונש, והתיקון אף פעם לא הרצאה. אם מישהו נפגע והיה צריך טיפול, או שהילד או הילדה פוגעים בעצמם, זו שאלה לרופא שלכם קודם.",
    ),
    whyNow: L(
      "Between three and eight, children learn to notice the body before the storm and to come back afterwards, when the adults are calm and the steps are the same every time. Naming the signal and repairing together is a developmentally informed parent practice; the outbursts usually shrink over a few weeks, and the repair is what the child keeps.",
      "בין גיל שלוש לשמונה ילדים לומדים לשים לב לגוף לפני הסערה ולחזור אחריה, כשהמבוגרים רגועים והשלבים זהים בכל פעם. לקרוא לסימן בשם ולתקן ביחד הם תרגול הורי מבוסס התפתחות; ההתפרצויות בדרך כלל מתקצרות בתוך כמה שבועות, והתיקון הוא מה שהילד שומר.",
    ),
    tomorrow: L("Make the calm place together tomorrow, in daylight, when nobody is upset: a cushion, the soft toy, a book. Agree the word. Visit it once for fun.", "הכינו מחר ביחד את הפינה הרגועה, באור יום, כשאף אחד לא עצבני: כרית, הבובה הרכה, ספר. סכמו על המילה. בקרו בה פעם אחת בכיף."),
    askAfter: mf("What is our word when the hot comes?", "מה המילה שלנו כשהחום מגיע?", "מה המילה שלנו כשהחום מגיע?"),
    together: L("Read it at a calm time, never during or right after a storm, and let your child show you the candle breath.", "קראו בזמן רגוע, אף פעם לא בזמן סערה או מיד אחריה, ותנו לילד או לילדה להראות לכם את נשימת הנר."),
    sourceNote: L(
      "The steps follow the AAP HealthyChildren pages on temper tantrums and discipline and the public evidence base of parent programmes (emotion coaching, calm-down steps, planned repair); no brand is used. The story form follows the social-story tradition. It is a developmentally informed parent practice; a child who hurts themself or others badly, or speaks of not wanting to live, needs your doctor, not a plan.",
      "השלבים עוקבים אחרי עמודי AAP HealthyChildren על התקפי זעם וגבולות ואחרי בסיס הראיות הציבורי של תוכניות הורים (אימון רגשי, שלבי הרגעה, תיקון מתוכנן); בלי שם מותג. צורת הסיפור הולכת בעקבות מסורת הסיפור החברתי. זהו תרגול הורי מבוסס התפתחות; ילד שפוגע בעצמו או באחרים קשה, או מדבר על כך שלא רוצה לחיות, צריך את הרופא שלכם, לא תוכנית.",
    ),
    firstWeek: L("The first week the storms are usually the same size; what changes first is the repair. That is expected. Say the word early, go to the place together, and count the repairs, not the storms.", "בשבוע הראשון הסערות בדרך כלל באותו גודל; מה שמשתנה קודם הוא התיקון. זה צפוי. אמרו את המילה מוקדם, לכו לפינה ביחד, וספרו תיקונים, לא סערות."),
  },
  bannedWords: { en: ["tantrum", "tantrums", "meltdown", "aggressive", "aggression", "naughty", "bad behaviour", "time out", "time-out", "ADHD", "oppositional"], he: ["התקף זעם", "התקפי זעם", "אלים", "אלימה", "אלימות", "ילד רע", "ילדה רעה", "שובב", "פסק זמן"] },
  poses: ["hands-up", "stand-tall", "hold-tummy", "hug-knees", "point-up", "sit-calm"],
  scepticsThree: [
    { en: "“A calm corner is a time-out by another name and shames the child.” Answered in the panel and the text: the child helped make it, the grown-up goes with them, it is never a punishment, and the step is swappable for staying near." },
    { en: "“Frequent, long, injurious outbursts can signal something beyond a parenting pattern.” Answered in the red lines: injury needing care, self-harm, talk of not wanting to live, a sudden onset and outbursts the child cannot come down from at all route to the doctor; no condition is named." },
    { en: "“Teaching a child to notice the hot asks for a self-regulation skill a three-year-old does not have.” Answered in the design: the grown-up says the word first and the child echoes; the plan rests on the adult's calm, and the repair step carries the plan at any age." },
  ],
};
