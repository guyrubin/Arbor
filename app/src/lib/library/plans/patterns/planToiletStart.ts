/**
 * plan-toilet-start — B-BOOK-76: starting the toilet, not wanting to sit,
 * accidents (ages 2–4; band 3–4 register: screens 1 and 2 merge in meaning
 * but keep the skeleton's ids, EN ≤ 25 words a page, HE ≤ 22). Definition
 * of record: docs/everyday-plans/definition-plan-toilet-start.md. The steps
 * are the public toilet-training guidance (AAP HealthyChildren: readiness,
 * a child-oriented pace, no punishment; NHS potty training): sit at the
 * same times each day, even for a minute; the box; a wet patch is "a body
 * still learning". The word "accident" never reaches the child.
 *
 * Refrains: body "my body is still learning" / "הגוף שלי עדיין לומד";
 * plan "we sit, and then we go play" / "אנחנו יושבים, ואז הולכים לשחק".
 * Hooks: p3 and p4 end unresolved. Hebrew AI-written: NATIVE REVIEW OWED.
 * Unsigned: dark.
 */
import type { BookLine } from "../../types";
import type { PatternDef } from "../patterns";

const L = (en: string, he: string) => ({ en, he });
const same = (en: string, he: string): BookLine => ({ en, he: { m: he, f: he } });
const mf = (en: string, m: string, f: string): BookLine => ({ en, he: { m, f } });

const standLeft = { x: 0.3, y: 0.9, scale: 0.46, facing: "right" as const, z: "fr" as const };
const standRight = { x: 0.68, y: 0.9, scale: 0.46, facing: "left" as const, z: "fr" as const };
const sitPotty = { x: 0.5, y: 0.86, scale: 0.38, facing: "right" as const, z: "fr" as const };

export const PLAN_TOILET_START: PatternDef = {
  id: "plan-toilet-start",
  title: L("My potty and me", "הסיר שלי ואני"),
  coverLine: L("A story about my body, my potty, and our sits.", "סיפור על הגוף שלי, הסיר שלי, והישיבות שלנו."),
  coverNameLine: L("{name}'s special plan", "התוכנית המיוחדת של {name}"),
  shelf: "body",
  ageBands: ["24m", "30m", "36m", "48m"],
  ageText: "2–4",
  parentWords: L("Starting the potty: won't sit, wet patches, not ready yet", "מתחילים עם הסיר: לא רוצה לשבת, כתמים רטובים, עוד לא מוכן או מוכנה"),
  knowledge: "A body learns the potty at its own pace through short, regular, pressure-free sits; a wet patch is information, never a failure, and the plan asks the child only to sit.",
  frames: {
    cover: { id: "cover", text: same("A story about my body, my potty, and our sits.", "סיפור על הגוף שלי, הסיר שלי, והישיבות שלנו."), pose: "hands-up", art: { plateId: "PT1", slot: standLeft, phoneCrop: 0.4 }, spread: true },
    bodyGood: {
      id: "p1",
      text: same(
        "My body is like a wonderful machine! It runs, it jumps, and it drinks water. Then the water wants to come out again.",
        "הגוף שלי הוא כמו מכונה נהדרת! הוא רץ, קופץ, ושותה מים. ואז המים רוצים לצאת שוב.",
      ),
      pose: "stand-tall",
      art: { plateId: "PT1", slot: standRight, phoneCrop: 0.6 },
    },
    howItWorks: {
      id: "p2",
      text: same(
        "My tummy fills up, and then it tells me: time to go! Wee and poo come out, and my tummy feels light again.",
        "הבטן שלי מתמלאת, ואז היא אומרת לי: זמן ללכת! פיפי וקקי יוצאים, והבטן שלי מרגישה קלה שוב.",
      ),
      pose: "hold-tummy",
      art: { plateId: "PT2", slot: standLeft, phoneCrop: 0.45 },
    },
    sometimesHard: {
      id: "p3",
      text: mf(
        "Sometimes the potty feels strange, and I do not want to sit. Sometimes wee comes out while I play, and my pants get wet.",
        "לפעמים הסיר מרגיש מוזר, ואני לא רוצה לשבת. לפעמים הפיפי יוצא בזמן שאני משחק, והמכנסיים שלי נרטבים.",
        "לפעמים הסיר מרגיש מוזר, ואני לא רוצה לשבת. לפעמים הפיפי יוצא בזמן שאני משחקת, והמכנסיים שלי נרטבים.",
      ),
      pose: "hug-knees",
      art: { plateId: "PT3", slot: standLeft, phoneCrop: 0.4 },
    },
    wePlan: {
      id: "p4",
      text: same(
        "My family and I want the potty to feel easy and friendly. So now we have a new special plan. It has three steps.",
        "המשפחה שלי ואני רוצים שהסיר ירגיש קל וידידותי. אז עכשיו יש לנו תוכנית מיוחדת וחדשה. יש בה שלושה שלבים.",
      ),
      pose: "point-up",
      art: { plateId: "PT4", slot: standRight, phoneCrop: 0.6 },
    },
    win: {
      id: "p8",
      text: same(
        "My body learns when it is time to go. My body is still learning. We sit, and then we go play. That is my plan!",
        "הגוף שלי לומד מתי זמן ללכת. הגוף שלי עדיין לומד. אנחנו יושבים, ואז הולכים לשחק. זאת התוכנית שלי!",
      ),
      closing: same("{name}'s body is learning.", "הגוף של {name} לומד."),
      pose: "hands-up",
      art: { plateId: "PT8", slot: { x: 0.5, y: 0.88, scale: 0.48, facing: "right", z: "fr" }, phoneCrop: 0.5 },
      spread: true,
    },
  },
  menu: [
    {
      id: "sit-same-times",
      slot: 1,
      text: same(
        "Step one: every {time}, we sit on the potty, even for one little minute. Feet on the floor. We sit, and then we go play.",
        "שלב ראשון: כל {time}, אנחנו יושבים על הסיר, אפילו דקה אחת קטנה. הרגליים שלי על הרצפה. אנחנו יושבים, ואז הולכים לשחק.",
      ),
      parentLine: L("Short sits at the same times every {time} (after waking, after meals, before the bath), about {minutes} minutes at most, feet on the floor; then play.", "ישיבות קצרות באותן שעות כל {time} (אחרי ההשכמה, אחרי ארוחות, לפני האמבטיה), עד {minutes} דקות בערך, רגליים על הרצפה; ואז משחק."),
      defaultMinutes: 3,
      defaultTime: "morning",
      pose: "sit-calm",
      art: { plateId: "PT5", slot: sitPotty, phoneCrop: 0.5 },
      sourceIds: ["aap-toilet-training", "nhs-potty-training"],
    },
    {
      id: "the-box",
      slot: 2,
      text: mf(
        "Step two: the potty box! While I sit, I can have a book, a song, or a little toy from the box. Sitting is comfy.",
        "שלב שני: קופסת הסיר! בזמן שאני יושב, יש לי ספר, שיר, או צעצוע קטן מהקופסה. לשבת זה נוח.",
        "שלב שני: קופסת הסיר! בזמן שאני יושבת, יש לי ספר, שיר, או צעצוע קטן מהקופסה. לשבת זה נוח.",
      ),
      parentLine: L("A box of things only for potty time: a book, a song, a small toy. Sitting is the whole task.", "קופסה עם דברים שמיועדים רק לזמן הסיר: ספר, שיר, צעצוע קטן. הישיבה עצמה היא כל המשימה."),
      pose: "sit-calm",
      art: { plateId: "PT6", slot: sitPotty, phoneCrop: 0.5 },
      sourceIds: ["aap-toilet-training"],
    },
    {
      id: "still-learning",
      slot: 3,
      text: same(
        "Step three, the most important: wet pants get changed, and that is all. My body is still learning. Next time, we sit again.",
        "השלב השלישי הוא החשוב מכולם: כשהמכנסיים שלי נרטבים, אנחנו מחליפים אותם, וזה הכול. הגוף שלי עדיין לומד. בפעם הבאה, אנחנו יושבים שוב.",
      ),
      parentLine: L("A wet patch is changed calmly with the same few words every time (\"your body is still learning\"); no punishment, no sigh, no sticker.", "כתם רטוב מוחלף ברוגע עם אותן מילים בכל פעם (\"הגוף שלך עדיין לומד\"); בלי עונש, בלי אנחה, בלי מדבקה."),
      pose: "stand-tall",
      art: { plateId: "PT7", slot: standRight, phoneCrop: 0.55 },
      sourceIds: ["aap-toilet-training", "nhs-potty-training"],
    },
  ],
  defaultSteps: ["sit-same-times", "the-box", "still-learning"],
  boxItems: [
    { id: "potty-book", label: L("A potty book", "ספר לסיר"), glyph: "auto_stories" },
    { id: "potty-song", label: L("Our potty song", "השיר שלנו לסיר"), glyph: "music_note" },
    { id: "small-toy", label: L("A small toy", "צעצוע קטן"), glyph: "toys" },
    { id: "dry-pants", label: L("My own dry pants, ready", "התחתונים היבשים שלי, מוכנים"), glyph: "checkroom" },
  ],
  defaultDurationDays: 21,
  minutesRange: [3, 10],
  sources: [
    { id: "aap-toilet-training", label: L("AAP HealthyChildren.org: toilet training — readiness signs, a child-oriented pace, short regular sits, no punishment for wet pants.", "AAP HealthyChildren.org: למידת שירותים — סימני מוכנות, קצב שמתאים לילד, ישיבות קצרות וקבועות, בלי עונש על מכנסיים רטובים."), url: "https://www.healthychildren.org/English/ages-stages/toddler/toilet-training/Pages/default.aspx" },
    { id: "nhs-potty-training", label: L("NHS: how to potty train — when to start, a relaxed routine, what to do about wet patches.", "NHS: איך לגמול מחיתולים — מתי להתחיל, שגרה רגועה, מה עושים עם כתמים רטובים."), url: "https://www.nhs.uk/conditions/baby/babys-development/potty-training-and-bedwetting/how-to-potty-train/" },
  ],
  watchFor: [
    { id: "pain", text: L("Weeing or pooing hurts, or there is blood.", "כואב לעשות פיפי או קקי, או שיש דם.") },
    { id: "under-18m", text: L("Your child is under eighteen months.", "הילד או הילדה מתחת לגיל שנה וחצי.") },
    { id: "no-readiness", text: L("Your child cannot yet walk to the potty, pull pants down or stay dry for an hour or two.", "הילד או הילדה עוד לא מסוגלים ללכת לסיר, להוריד מכנסיים או להישאר יבשים שעה או שעתיים.") },
    { id: "hard-poo", text: L("The poo is hard or your child holds it in for days.", "הקקי קשה או שהילד או הילדה מתאפקים ימים.") },
    { id: "was-dry", text: L("Your child was dry for months and has started wetting again.", "הילד או הילדה היו יבשים חודשים והתחילו להרטיב שוב.") },
  ],
  parent: {
    knows: L(
      "A child who will not sit, or wets while playing, is not behind: the body learns the potty at its own pace, and pressure slows it. The plan asks the child only to sit, briefly and regularly, with something pleasant, and takes a wet patch as information, never a failure. Pain, blood, hard poo held for days, a return of wetting after months dry, or a child who cannot yet walk to the potty are your doctor's questions first.",
      "ילד או ילדה שלא רוצים לשבת, או מרטיבים בזמן משחק, לא מפגרים: הגוף לומד את הסיר בקצב שלו, ולחץ מאט אותו. התוכנית מבקשת מהילד רק לשבת, בקצרה ובקביעות, עם משהו נעים, ומתייחסת לכתם רטוב כמידע, אף פעם לא ככישלון. כאב, דם, קקי קשה שמתאפקים עליו ימים, חזרה להרטבה אחרי חודשים יבשים, או ילד שעוד לא יכול ללכת לסיר הם שאלות לרופא שלכם קודם.",
    ),
    whyNow: L(
      "Between two and four, most children learn the potty within weeks once they show readiness and the sits are short, regular and free of pressure. Short friendly sits are a developmentally informed parent practice; starting before readiness, or pushing, usually makes it take longer.",
      "בין גיל שנתיים לארבע, רוב הילדים לומדים את הסיר בתוך שבועות ברגע שהם מראים מוכנות והישיבות קצרות, קבועות ובלי לחץ. ישיבות קצרות וידידותיות הן תרגול הורי מבוסס התפתחות; להתחיל לפני המוכנות, או לדחוף, בדרך כלל מאריך את התהליך.",
    ),
    tomorrow: L("Put the potty where you can see it and the box beside it tonight. Tomorrow, the first sit after waking, one minute, then play.", "שימו הערב את הסיר במקום שרואים ואת הקופסה לידו. מחר, הישיבה הראשונה אחרי ההשכמה, דקה אחת, ואז משחק."),
    askAfter: mf("What is in our potty box?", "מה יש בקופסת הסיר שלנו?", "מה יש בקופסת הסיר שלנו?"),
    together: L("Read it on the floor beside the potty, and let your child sit a toy on it first.", "קראו על הרצפה ליד הסיר, ותנו לילד או לילדה להושיב עליו צעצוע קודם."),
    sourceNote: L(
      "The steps follow the AAP HealthyChildren toilet-training pages and the NHS potty-training page: readiness first, a child-oriented pace, short regular sits, no punishment. The story form follows the social-story tradition. It is a developmentally informed parent practice; pain, blood, hard poo and a return of wetting belong to your doctor.",
      "השלבים עוקבים אחרי עמודי למידת השירותים של AAP HealthyChildren ועמוד הגמילה מחיתולים של ה-NHS: קודם מוכנות, קצב שמתאים לילד, ישיבות קצרות וקבועות, בלי עונש. צורת הסיפור הולכת בעקבות מסורת הסיפור החברתי. זהו תרגול הורי מבוסס התפתחות; כאב, דם, קקי קשה וחזרה להרטבה שייכים לרופא שלכם.",
    ),
    firstWeek: L("The first week is mostly sits with nothing in the potty, and wet pants anyway. That is expected. Keep the sits short, change calmly, and count the sits, not the dry days.", "השבוע הראשון הוא בעיקר ישיבות בלי כלום בסיר, ומכנסיים רטובים בכל זאת. זה צפוי. שמרו על ישיבות קצרות, החליפו ברוגע, וספרו ישיבות, לא ימים יבשים."),
  },
  bannedWords: { en: ["accident", "accidents", "enuresis", "incontinence", "big kid", "baby", "dirty", "naughty", "sticker chart"], he: ["תאונה", "תאונות", "הרטבה", "תינוק", "תינוקת", "מלוכלך", "מלוכלכת", "טבלת מדבקות"] },
  poses: ["hands-up", "stand-tall", "hold-tummy", "hug-knees", "point-up", "sit-calm"],
  scepticsThree: [
    { en: "“Scheduled sits before readiness prolong training and can start withholding.” Answered in the red lines: no readiness signs, under eighteen months, hard or held poo and pain route to the doctor and offer no plan; the sits are a minute, feet on the floor, with no demand to produce." },
    { en: "“Calling a wet patch 'still learning' hides a regression.” Answered in the red lines: wetting after months dry routes to the doctor; the phrase is for the common first weeks only." },
    { en: "“A potty box is a bribe.” Answered in the text: the box is for the sit, not for the result; nothing is promised for wee or poo, and the sticker chart is banned from the child's text." },
  ],
};
