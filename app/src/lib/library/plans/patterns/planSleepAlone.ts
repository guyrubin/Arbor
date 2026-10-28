/**
 * plan-sleep-alone — B-BOOK-76: falling asleep only with a parent in the
 * room (ages 2–7; band 5–7 register, EN ≤ 40 / HE ≤ 34). Definition of
 * record: docs/everyday-plans/definition-plan-sleep-alone.md. The steps are
 * the public bedtime-routine guidance and the gradual "parent sits a little
 * further every few nights" approach the behavioural-sleep reviews describe
 * (the same evidence list as Steady Nights); the family chooses the pace. No
 * method that leaves a distressed child without a response; no target for
 * the child; never a named sleep method or brand.
 *
 * Refrains: body "my body knows how to sleep" / "הגוף שלי יודע לישון";
 * plan "we do the same four steps" / "אנחנו עושים את אותם ארבעה שלבים".
 * Hooks: p3 and p4 end unresolved. `{name}` only on the cover and the frame
 * line. Hebrew is AI-written: NATIVE REVIEW OWED. Unsigned: dark.
 */
import type { BookLine } from "../../types";
import type { PatternDef } from "../patterns";

const L = (en: string, he: string) => ({ en, he });
const same = (en: string, he: string): BookLine => ({ en, he: { m: he, f: he } });
const mf = (en: string, m: string, f: string): BookLine => ({ en, he: { m, f } });

const standLeft = { x: 0.3, y: 0.9, scale: 0.46, facing: "right" as const, z: "fr" as const };
const standRight = { x: 0.68, y: 0.9, scale: 0.46, facing: "left" as const, z: "fr" as const };
const inBed = { x: 0.5, y: 0.8, scale: 0.34, facing: "right" as const, z: "fr" as const };

export const PLAN_SLEEP_ALONE: PatternDef = {
  id: "plan-sleep-alone",
  title: L("My bed, my sleep", "המיטה שלי, השינה שלי"),
  coverLine: L("A story about my bed and our four steps.", "סיפור על המיטה שלי ועל ארבעת השלבים שלנו."),
  coverNameLine: L("{name}'s special plan", "התוכנית המיוחדת של {name}"),
  shelf: "sleep",
  ageBands: ["24m", "30m", "36m", "48m", "60m", "6-8y"],
  ageText: "2–7",
  parentWords: L("Falls asleep only with me in the room", "נרדם או נרדמת רק כשאני בחדר"),
  knowledge: "A child who falls asleep only with a parent present learns, in small steps the family chooses, to fall asleep with the parent a little further away; the routine stays the same every night.",
  frames: {
    cover: { id: "cover", text: same("A story about my bed and our four steps.", "סיפור על המיטה שלי ועל ארבעת השלבים שלנו."), pose: "hug-knees", art: { plateId: "PS1", slot: inBed, phoneCrop: 0.5 }, spread: true },
    bodyGood: {
      id: "p1",
      text: same(
        "My body is like a wonderful machine! All day it runs, climbs and plays. At night it rests, so tomorrow it can run and play again.",
        "הגוף שלי הוא כמו מכונה נהדרת! כל היום הוא רץ, מטפס ומשחק. בלילה הוא נח, כדי שמחר הוא יוכל לרוץ ולשחק שוב.",
      ),
      pose: "stand-tall",
      art: { plateId: "PS2", slot: standRight, phoneCrop: 0.6 },
    },
    howItWorks: {
      id: "p2",
      text: same(
        "When the room gets dark and quiet, my body gets sleepy. My eyes feel heavy, my breathing goes slow, and my body knows how to sleep all by itself.",
        "כשהחדר נעשה חשוך ושקט, הגוף שלי נעשה מנומנם. העיניים שלי כבדות, הנשימה שלי נעשית איטית, והגוף שלי יודע לישון בעצמו.",
      ),
      pose: "lie-down",
      art: { plateId: "PS1", slot: inBed, phoneCrop: 0.5 },
    },
    sometimesHard: {
      id: "p3",
      text: mf(
        "Sometimes, when it is time to sleep, I want my grown-up to stay right next to me. The room feels big, and my eyes want to stay open. So I call, and I call again.",
        "לפעמים, כשמגיע זמן לישון, אני רוצה שהמבוגר שלי יישאר ממש לידי. החדר מרגיש גדול, והעיניים שלי רוצות להישאר פקוחות. אז אני קורא, וקורא שוב.",
        "לפעמים, כשמגיע זמן לישון, אני רוצה שהמבוגר שלי יישאר ממש לידי. החדר מרגיש גדול, והעיניים שלי רוצות להישאר פקוחות. אז אני קוראת, וקוראת שוב.",
      ),
      pose: "hug-knees",
      art: { plateId: "PS3", slot: inBed, phoneCrop: 0.45 },
    },
    wePlan: {
      id: "p4",
      text: same(
        "My family and I want my nights to feel calm and safe. So now we have a new special plan. It has three steps, and we do them together.",
        "המשפחה שלי ואני רוצים שהלילות שלי ירגישו רגועים ובטוחים. אז עכשיו יש לנו תוכנית מיוחדת וחדשה. יש בה שלושה שלבים, ואנחנו עושים אותם ביחד.",
      ),
      pose: "point-up",
      art: { plateId: "PS4", slot: standLeft, phoneCrop: 0.4 },
    },
    win: {
      id: "p8",
      text: same(
        "Night after night, my body learns to fall asleep in my own bed. We do the same four steps, my grown-up is near, and my body knows how to sleep. That is my plan!",
        "לילה אחרי לילה, הגוף שלי לומד להירדם במיטה שלי. אנחנו עושים את אותם ארבעה שלבים, המבוגר שלי קרוב, והגוף שלי יודע לישון. זאת התוכנית שלי!",
      ),
      closing: same("{name}'s body knows how to sleep.", "הגוף של {name} יודע לישון."),
      pose: "hands-up",
      art: { plateId: "PS8", slot: { x: 0.5, y: 0.88, scale: 0.48, facing: "right", z: "fr" }, phoneCrop: 0.5 },
      spread: true,
    },
  },
  menu: [
    {
      id: "four-steps",
      slot: 1,
      text: same(
        "Step one: every {time}, we do the same four steps: bath, pyjamas, one story, and lights low. The same steps, in the same order, so my body knows that sleep is coming.",
        "שלב ראשון: כל {time}, אנחנו עושים את אותם ארבעה שלבים: אמבטיה, פיג'מה, סיפור אחד, ואור נמוך. אותם שלבים, באותו סדר, כדי שהגוף שלי יידע שהשינה מגיעה.",
      ),
      parentLine: L("The same four bedtime steps every {time}, in the same order, about twenty to thirty minutes in all.", "אותם ארבעה שלבי שינה כל {time}, באותו סדר, כעשרים עד שלושים דקות בסך הכול."),
      defaultTime: "bedtime",
      pose: "sit-calm",
      art: { plateId: "PS5", slot: { x: 0.36, y: 0.88, scale: 0.4, facing: "right", z: "fr" }, phoneCrop: 0.45 },
      sourceIds: ["aap-bedtime-routine", "mindell-williamson-2018"],
    },
    {
      id: "sit-further",
      slot: 2,
      text: mf(
        "Step two: my grown-up sits by my bed while I fall asleep. Every few nights, the chair moves a little further, nearer the door. My grown-up is still near, and I can hear them.",
        "שלב שני: המבוגר שלי יושב ליד המיטה שלי בזמן שאני נרדם. כל כמה לילות, הכיסא זז קצת יותר רחוק, קרוב יותר לדלת. המבוגר שלי עדיין קרוב, ואני שומע אותו.",
        "שלב שני: המבוגר שלי יושב ליד המיטה שלי בזמן שאני נרדמת. כל כמה לילות, הכיסא זז קצת יותר רחוק, קרוב יותר לדלת. המבוגר שלי עדיין קרוב, ואני שומעת אותו.",
      ),
      parentLine: L("Sit by the bed while your child falls asleep; every few nights, at your pace, move the chair a little further toward the door. Always answer a call; never leave a distressed child without a response.", "שבו ליד המיטה עד שהילד או הילדה נרדמים; כל כמה לילות, בקצב שלכם, הזיזו את הכיסא קצת יותר לכיוון הדלת. תמיד ענו לקריאה; לעולם אל תשאירו ילד במצוקה בלי מענה."),
      pose: "lie-down",
      art: { plateId: "PS6", slot: inBed, phoneCrop: 0.5 },
      sourceIds: ["meltzer-mindell-2014", "aap-bedtime-routine"],
    },
    {
      id: "check-back",
      slot: 2,
      text: mf(
        "Step two: after our four steps, my grown-up says goodnight and goes to the door. Then they come back to check on me, again and again, until I am asleep.",
        "שלב שני: אחרי ארבעת השלבים, המבוגר שלי אומר לילה טוב והולך לדלת. אחר כך הוא חוזר לבדוק מה איתי, שוב ושוב, עד שאני נרדם.",
        "שלב שני: אחרי ארבעת השלבים, המבוגר שלי אומר לילה טוב והולך לדלת. אחר כך הוא חוזר לבדוק מה איתי, שוב ושוב, עד שאני נרדמת.",
      ),
      parentLine: L("Say goodnight, step to the door, and come back to check in briefly and calmly, as often as your child needs, until they are asleep.", "אמרו לילה טוב, צאו לדלת, וחזרו לבדיקה קצרה ורגועה, כמה שהילד או הילדה צריכים, עד שנרדמים."),
      pose: "lie-down",
      art: { plateId: "PS6", slot: inBed, phoneCrop: 0.5 },
      sourceIds: ["meltzer-mindell-2014"],
    },
    {
      id: "morning-check-in",
      slot: 3,
      text: mf(
        "Step three is the most important: in the morning, we talk about the night. Some nights I fall asleep fast, some nights I call. Both are fine. We just try again tonight.",
        "השלב השלישי הוא החשוב מכולם: בבוקר, אנחנו מדברים על הלילה. יש לילות שאני נרדם מהר, ויש לילות שאני קורא. שניהם בסדר. אנחנו פשוט מנסים שוב הלילה.",
        "השלב השלישי הוא החשוב מכולם: בבוקר, אנחנו מדברים על הלילה. יש לילות שאני נרדמת מהר, ויש לילות שאני קוראת. שניהם בסדר. אנחנו פשוט מנסים שוב הלילה.",
      ),
      parentLine: L("A short morning check-in: what happened last night, in plain words, no praise and no blame. The next night is a new try.", "שיחת בוקר קצרה: מה קרה אתמול בלילה, במילים פשוטות, בלי שבחים ובלי האשמה. הלילה הבא הוא ניסיון חדש."),
      pose: "sit-calm",
      art: { plateId: "PS7", slot: { x: 0.4, y: 0.9, scale: 0.4, facing: "right", z: "fr" }, phoneCrop: 0.45 },
      sourceIds: ["nhs-sleep-young-children", "aap-bedtime-routine"],
    },
  ],
  defaultSteps: ["four-steps", "sit-further", "morning-check-in"],
  boxItems: [
    { id: "cuddly", label: L("My cuddly toy", "הבובה הרכה שלי"), glyph: "toys" },
    { id: "night-light", label: L("A small night light", "מנורת לילה קטנה"), glyph: "light_mode" },
    { id: "one-story", label: L("One story", "סיפור אחד"), glyph: "auto_stories" },
    { id: "quiet-song", label: L("A quiet song", "שיר שקט"), glyph: "music_note" },
  ],
  defaultDurationDays: 21,
  minutesRange: [3, 10],
  sources: [
    { id: "aap-bedtime-routine", label: L("AAP HealthyChildren.org: bedtime trouble and healthy sleep habits — a consistent, calm routine; the same steps in the same order.", "AAP HealthyChildren.org: קשיי שינה והרגלי שינה בריאים — טקס קבוע ורגוע; אותם שלבים באותו סדר."), url: "https://www.healthychildren.org/English/healthy-living/sleep/Pages/Bedtime-Trouble.aspx" },
    { id: "nhs-sleep-young-children", label: L("NHS: sleep tips for young children — a regular bedtime routine, a calm room, the morning after.", "NHS: טיפים לשינה לילדים צעירים — טקס שינה קבוע, חדר רגוע, הבוקר שאחרי."), url: "https://www.nhs.uk/conditions/baby/health/sleep-problems-in-young-children/" },
    { id: "mindell-williamson-2018", label: L("Mindell & Williamson (2018), Sleep Medicine Reviews: the benefits of a consistent bedtime routine in young children.", "Mindell & Williamson (2018), Sleep Medicine Reviews: היתרונות של טקס שינה קבוע אצל ילדים צעירים.") },
    { id: "meltzer-mindell-2014", label: L("Meltzer & Mindell (2014), Journal of Pediatric Psychology: review of behavioural approaches to bedtime problems, including gradual parental withdrawal and brief check-ins, with the family setting the pace.", "Meltzer & Mindell (2014), Journal of Pediatric Psychology: סקירה של גישות התנהגותיות לקשיי הירדמות, כולל התרחקות הדרגתית של ההורה ובדיקות קצרות, כשהמשפחה קובעת את הקצב.") },
  ],
  watchFor: [
    { id: "snoring", text: L("Your child snores loudly most nights.", "הילד או הילדה נוחרים בקול רוב הלילות.") },
    { id: "breathing-pauses", text: L("You have noticed pauses in your child's breathing during sleep.", "שמתם לב להפסקות בנשימה של הילד או הילדה בזמן השינה.") },
    { id: "daytime-sleep", text: L("Your child falls asleep during the day far more than children their age.", "הילד או הילדה נרדמים במשך היום הרבה יותר מילדים בגילם.") },
    { id: "under-1", text: L("Your child is under one year old.", "הילד או הילדה מתחת לגיל שנה.") },
    { id: "sudden-fear", text: L("The fear of sleeping alone started suddenly after a frightening event.", "הפחד לישון לבד התחיל פתאום אחרי אירוע מפחיד.") },
  ],
  parent: {
    knows: L(
      "A child who falls asleep only with a parent present has learned that this is how sleep starts; the plan teaches a new start in small steps the family chooses. The routine never changes; only the distance does, a little at a time, and every call is answered. Snoring, breathing pauses and unusual daytime sleepiness are questions for your doctor first.",
      "ילד או ילדה שנרדמים רק כשההורה נוכח למדו שככה השינה מתחילה; התוכנית מלמדת התחלה חדשה בצעדים קטנים שהמשפחה בוחרת. הטקס לא משתנה; רק המרחק משתנה, קצת בכל פעם, וכל קריאה נענית. נחירות, הפסקות נשימה וישנוניות חריגה ביום הן שאלות לרופא שלכם קודם.",
    ),
    whyNow: L(
      "Between two and seven, falling asleep alone is a skill most children can learn in a few weeks when the routine is steady and the change is gradual. A calm, predictable bedtime is a developmentally informed parent practice that most families can keep, and it gets harder the longer the old start stays in place.",
      "בין גיל שנתיים לשבע, להירדם לבד זו מיומנות שרוב הילדים יכולים ללמוד בכמה שבועות כשהטקס יציב והשינוי הדרגתי. זמן שינה רגוע וצפוי הוא תרגול הורי מבוסס התפתחות שרוב המשפחות יכולות לשמור עליו, והוא נעשה קשה יותר ככל שההתחלה הישנה נשארת.",
    ),
    tomorrow: L("Write the four steps on a card tonight and put it by the bed. Tomorrow evening, do them in that order and sit in the chair where it is now.", "כתבו הערב את ארבעת השלבים על כרטיס ושימו אותו ליד המיטה. מחר בערב, עשו אותם בסדר הזה ושבו בכיסא איפה שהוא עכשיו."),
    askAfter: mf("What are our four steps before sleep?", "מה ארבעת השלבים שלנו לפני השינה?", "מה ארבעת השלבים שלנו לפני השינה?"),
    together: L("Read it after the bath, before the lights go low, and let your child name the next step.", "קראו אחרי האמבטיה, לפני שהאור יורד, ותנו לילד או לילדה להגיד מה השלב הבא."),
    sourceNote: L(
      "The steps follow the AAP HealthyChildren and NHS pages on bedtime routines and the behavioural-sleep reviews (Mindell & Williamson 2018; Meltzer & Mindell 2014) on gradual parental withdrawal with the family setting the pace. The story form follows the social-story tradition. It is a developmentally informed parent practice; the medical questions belong to your doctor.",
      "השלבים עוקבים אחרי עמודי AAP HealthyChildren ו-NHS על טקסי שינה ואחרי הסקירות ההתנהגותיות (Mindell & Williamson 2018; Meltzer & Mindell 2014) על התרחקות הדרגתית של ההורה כשהמשפחה קובעת את הקצב. צורת הסיפור הולכת בעקבות מסורת הסיפור החברתי. זהו תרגול הורי מבוסס התפתחות; השאלות הרפואיות שייכות לרופא שלכם.",
    ),
    firstWeek: L("The first nights are often longer, not shorter: more calls, more check-ins. That is expected. Keep the routine identical, move the chair only when a few calm nights have passed, and count nights, not minutes.", "הלילות הראשונים לרוב ארוכים יותר, לא קצרים יותר: יותר קריאות, יותר בדיקות. זה צפוי. שמרו על טקס זהה, הזיזו את הכיסא רק אחרי כמה לילות רגועים, וספרו לילות, לא דקות."),
  },
  bannedWords: { en: ["insomnia", "sleep training", "cry it out", "self-soothe", "regression"], he: ["נדודי שינה", "אימון שינה", "לתת לבכות", "רגרסיה"] },
  poses: ["hug-knees", "stand-tall", "lie-down", "point-up", "sit-calm", "hands-up"],
  scepticsThree: [
    { en: "“Gradual withdrawal is a sleep-training method and some children become more distressed.” Answered in the panel: the family sets the pace, every call is answered, no method leaves a distressed child without a response, and the plan never names a method." },
    { en: "“Night-time fear can be a symptom of something else (sleep-disordered breathing, a frightening event).” Answered in the red lines: snoring, breathing pauses, unusual daytime sleep and a sudden onset after a frightening event route to the doctor and offer no plan." },
    { en: "“A story cannot replace the routine.” Answered in the design: the story is the delivery vehicle; the routine and the chair are the parent's week in Today." },
  ],
};
