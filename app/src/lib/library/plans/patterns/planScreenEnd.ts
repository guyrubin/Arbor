/**
 * plan-screen-end — B-BOOK-76: ending screens, leaving the house, switching
 * activities (ages 2–8; band 5–7 register, EN ≤ 40 / HE ≤ 34). Definition of
 * record: docs/everyday-plans/definition-plan-screen-end.md. The steps are
 * the public transition guidance (AAP Media and Young Minds 2016: a plan for
 * screen time with warnings and a clear end; the visual-schedule and
 * transition-warning evidence as public method): the warning in the child's
 * units, a timer the child can see, and the next thing named and pictured.
 * No brand; no condition named.
 *
 * Refrains: body "my body gets ready for the next thing" / "הגוף שלי מתכונן
 * לדבר הבא"; plan "two more, then we go" / "עוד שניים, ואז הולכים".
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
const onSofa = { x: 0.4, y: 0.86, scale: 0.38, facing: "right" as const, z: "fr" as const };

export const PLAN_SCREEN_END: PatternDef = {
  id: "plan-screen-end",
  title: L("Two more, then we go", "עוד שניים, ואז הולכים"),
  coverLine: L("A story about the end of the screen and the start of the next thing.", "סיפור על סוף המסך ועל תחילת הדבר הבא."),
  coverNameLine: L("{name}'s special plan", "התוכנית המיוחדת של {name}"),
  shelf: "family",
  ageBands: ["24m", "30m", "36m", "48m", "60m", "6-8y"],
  ageText: "2–8",
  parentWords: L("Ending screens or switching activities ends in a fight", "סיום מסכים או מעבר בין פעילויות נגמר בריב"),
  knowledge: "A change that arrives with a warning the child understands, a timer the child can see and a next thing the child can picture is a change the body can get ready for; a sudden end is not.",
  frames: {
    cover: { id: "cover", text: same("A story about the end of the screen and the start of the next thing.", "סיפור על סוף המסך ועל תחילת הדבר הבא."), pose: "hands-up", art: { plateId: "PE1", slot: standLeft, phoneCrop: 0.4 }, spread: true },
    bodyGood: {
      id: "p1",
      text: same(
        "My body is like a wonderful machine! It can build a tower, watch a show, and run outside. It loves to be busy, and it loves to know what comes next.",
        "הגוף שלי הוא כמו מכונה נהדרת! הוא יכול לבנות מגדל, לראות תוכנית, ולרוץ בחוץ. הוא אוהב להיות עסוק, והוא אוהב לדעת מה בא אחר כך.",
      ),
      pose: "stand-tall",
      art: { plateId: "PE1", slot: standRight, phoneCrop: 0.6 },
    },
    howItWorks: {
      id: "p2",
      text: same(
        "When I am deep inside a show or a game, my eyes and my ears are busy. My body forgets the room around me. It needs a little time to come back, like a diver coming up for air.",
        "כשאני עמוק בתוך תוכנית או משחק, העיניים והאוזניים שלי עסוקות. הגוף שלי שוכח את החדר שמסביב. הוא לוקח קצת זמן לחזור, כמו צוללן שעולה לנשום.",
      ),
      pose: "sit-calm",
      art: { plateId: "PE2", slot: onSofa, phoneCrop: 0.45 },
    },
    sometimesHard: {
      id: "p3",
      text: mf(
        "Sometimes the screen goes off all at once, in the middle of the best part. My body is not ready. My voice gets loud, my feet stamp, and the next thing feels like a wall.",
        "לפעמים המסך נכבה בבת אחת, באמצע החלק הכי טוב. הגוף שלי לא מוכן. הקול שלי נעשה רם, הרגליים שלי רוקעות, והדבר הבא מרגיש כמו קיר.",
        "לפעמים המסך נכבה בבת אחת, באמצע החלק הכי טוב. הגוף שלי לא מוכן. הקול שלי נעשה רם, הרגליים שלי רוקעות, והדבר הבא מרגיש כמו קיר.",
      ),
      pose: "hug-knees",
      art: { plateId: "PE3", slot: onSofa, phoneCrop: 0.45 },
    },
    wePlan: {
      id: "p4",
      text: same(
        "My family and I want the end of the screen to feel soft, not sudden. So now we have a new special plan. It has three steps, and we do them together.",
        "המשפחה שלי ואני רוצים שסוף המסך ירגיש רך, לא פתאומי. אז עכשיו יש לנו תוכנית מיוחדת וחדשה. יש בה שלושה שלבים, ואנחנו עושים אותם ביחד.",
      ),
      pose: "point-up",
      art: { plateId: "PE4", slot: standRight, phoneCrop: 0.6 },
    },
    win: {
      id: "p8",
      text: same(
        "Day by day, my body learns that the end is coming and what comes after. Two more, then we go. My body gets ready for the next thing, and the next thing is good too. That is my plan!",
        "יום אחרי יום, הגוף שלי לומד שהסוף מגיע ומה בא אחריו. עוד שניים, ואז הולכים. הגוף שלי מתכונן לדבר הבא, וגם הדבר הבא טוב. זאת התוכנית שלי!",
      ),
      closing: same("{name}'s body is ready for the next thing.", "הגוף של {name} מוכן לדבר הבא."),
      pose: "hands-up",
      art: { plateId: "PE8", slot: { x: 0.5, y: 0.88, scale: 0.48, facing: "right", z: "fr" }, phoneCrop: 0.5 },
      spread: true,
    },
  },
  menu: [
    {
      id: "warning-in-my-units",
      slot: 1,
      text: same(
        "Step one: before the end, my grown-up gives me a warning in my words: two more songs, one more round, or the end of this episode. Two more, then we go. I know how much is left.",
        "שלב ראשון: לפני הסוף, המבוגר שלי נותן לי אזהרה במילים שלי: עוד שני שירים, עוד סיבוב אחד, או סוף הפרק הזה. עוד שניים, ואז הולכים. אני יודע או יודעת כמה נשאר.",
      ),
      parentLine: L("A warning in the child's units (two more songs, one more round, the end of this episode), calmly, every time; then the end comes exactly then.", "אזהרה ביחידות של הילד (עוד שני שירים, עוד סיבוב אחד, סוף הפרק הזה), ברוגע, בכל פעם; ואז הסוף מגיע בדיוק אז."),
      defaultTime: "afternoon",
      pose: "sit-calm",
      art: { plateId: "PE5", slot: onSofa, phoneCrop: 0.45 },
      sourceIds: ["aap-media-young-minds", "transition-warning-evidence"],
    },
    {
      id: "timer-i-can-see",
      slot: 2,
      text: mf(
        "Step two: a timer I can see. The sand runs down, or the colour shrinks. When it is nearly gone, I know the end is close. I watch it, and my body gets ready.",
        "שלב שני: טיימר שאני רואה. החול יורד, או הצבע מתכווץ. כשכמעט נגמר, אני יודע שהסוף קרוב. אני מסתכל עליו, והגוף שלי מתכונן.",
        "שלב שני: טיימר שאני רואה. החול יורד, או הצבע מתכווץ. כשכמעט נגמר, אני יודעת שהסוף קרוב. אני מסתכלת עליו, והגוף שלי מתכונן.",
      ),
      parentLine: L("A visible timer (sand, a colour timer) the child can watch; it ends the screen, not you.", "טיימר שרואים (חול, טיימר צבע) שהילד או הילדה יכולים להסתכל עליו; הוא מסיים את המסך, לא אתם."),
      pose: "sit-calm",
      art: { plateId: "PE6", slot: onSofa, phoneCrop: 0.45 },
      sourceIds: ["transition-warning-evidence", "aap-media-young-minds"],
    },
    {
      id: "my-job-at-the-end",
      slot: 2,
      text: mf(
        "Step two: at the end, I have a job. I press the button, or I close the lid. My hands do the ending, so the ending is mine too.",
        "שלב שני: בסוף, יש לי תפקיד. אני לוחץ על הכפתור, או סוגר את המכסה. הידיים שלי עושות את הסיום, אז הסיום גם שלי.",
        "שלב שני: בסוף, יש לי תפקיד. אני לוחצת על הכפתור, או סוגרת את המכסה. הידיים שלי עושות את הסיום, אז הסיום גם שלי.",
      ),
      parentLine: L("Give the child the ending: they press the button or close the lid themselves, every time.", "תנו לילד או לילדה את הסיום: הם לוחצים על הכפתור או סוגרים את המכסה בעצמם, בכל פעם."),
      pose: "stand-tall",
      art: { plateId: "PE6", slot: standLeft, phoneCrop: 0.4 },
      sourceIds: ["transition-warning-evidence"],
    },
    {
      id: "next-thing-pictured",
      slot: 3,
      text: same(
        "Step three is the most important: the next thing has a name and a picture. Snack at the table, shoes and the park, or the bath with the boats. I see it, and we go there together.",
        "השלב השלישי הוא החשוב מכולם: לדבר הבא יש שם ותמונה. חטיף ליד השולחן, נעליים והפארק, או אמבטיה עם הסירות. אני רואה אותו, ואנחנו הולכים לשם ביחד.",
      ),
      parentLine: L("Name and show the next thing before the end (a picture card or pointing to it), and go there together; the next thing is never a chore dressed up as a reward.", "אמרו והראו את הדבר הבא לפני הסוף (כרטיס תמונה או להצביע עליו), ולכו לשם ביחד; הדבר הבא הוא אף פעם לא מטלה מחופשת לפינוק."),
      pose: "point-up",
      art: { plateId: "PE7", slot: standRight, phoneCrop: 0.55 },
      sourceIds: ["transition-warning-evidence", "aap-media-young-minds"],
    },
  ],
  defaultSteps: ["warning-in-my-units", "timer-i-can-see", "next-thing-pictured"],
  boxItems: [
    { id: "sand-timer", label: L("A sand timer", "שעון חול"), glyph: "hourglass_top" },
    { id: "picture-cards", label: L("Picture cards of the next things", "כרטיסי תמונה של הדברים הבאים"), glyph: "photo" },
    { id: "the-button", label: L("I press the button", "לחיצה על הכפתור"), glyph: "check_circle" },
    { id: "two-more-song", label: L("Our 'two more' song", "השיר שלנו 'עוד שניים'"), glyph: "music_note" },
  ],
  defaultDurationDays: 14,
  minutesRange: [3, 10],
  sources: [
    { id: "aap-media-young-minds", label: L("AAP, Media and Young Minds (2016) and the Family Media Plan: a plan for screen use with warnings and a clear end, screens off before transitions and bedtime.", "AAP, Media and Young Minds (2016) ותוכנית המדיה המשפחתית: תוכנית לשימוש במסכים עם אזהרות וסוף ברור, מסכים כבויים לפני מעברים ושינה."), url: "https://publications.aap.org/pediatrics/article/138/5/e20162591/60503/Media-and-Young-Minds" },
    { id: "transition-warning-evidence", label: L("The public evidence on transition warnings, visual timers and visual schedules for young children (early-childhood and occupational-therapist parent guidance); a public method, no brand.", "בסיס הראיות הציבורי על אזהרות מעבר, טיימרים חזותיים ולוחות זמנים חזותיים לילדים צעירים (הדרכת הורים מהגיל הרך ומריפוי בעיסוק); שיטה ציבורית, בלי מותג.") },
  ],
  watchFor: [
    { id: "self-harm", text: L("Your child hurts themself when a screen ends.", "הילד או הילדה פוגעים בעצמם כשהמסך נגמר.") },
    { id: "all-transitions-every-time", text: L("Every change, all day, ends in a long storm your child cannot come down from.", "כל שינוי, כל היום, נגמר בסערה ארוכה שהילד או הילדה לא מצליחים לצאת ממנה.") },
    { id: "sudden-event", text: L("It started suddenly after a frightening event.", "זה התחיל פתאום אחרי אירוע מפחיד.") },
    { id: "screens-replace-sleep", text: L("Screens are replacing sleep or meals most days.", "מסכים מחליפים שינה או ארוחות ברוב הימים.") },
  ],
  parent: {
    knows: L(
      "A child who fights the end of a screen is not fighting you: the end arrived before the body could get ready. A warning the child understands, a timer the child can see and a next thing the child can picture turn a wall into a slope. The plan is the warning, the timer and the next thing, in that order, and the end comes exactly when you said. If screens are replacing sleep or meals most days, start with your doctor.",
      "ילד או ילדה שנלחמים בסוף המסך לא נלחמים בכם: הסוף הגיע לפני שהגוף הספיק להתכונן. אזהרה שהילד מבין, טיימר שהילד רואה ודבר הבא שהילד יכול לדמיין הופכים קיר למדרון. התוכנית היא האזהרה, הטיימר והדבר הבא, בסדר הזה, והסוף מגיע בדיוק כשאמרתם. אם מסכים מחליפים שינה או ארוחות ברוב הימים, התחילו ברופא שלכם.",
    ),
    whyNow: L(
      "Between two and eight, children learn transitions through repetition: the same warning, the same timer, the same kind of next thing. A predictable end is a developmentally informed parent practice that works within days when it is kept every time, and it gets harder the more often the end is negotiated.",
      "בין גיל שנתיים לשמונה ילדים לומדים מעברים דרך חזרה: אותה אזהרה, אותו טיימר, אותו סוג של דבר הבא. סוף צפוי הוא תרגול הורי מבוסס התפתחות שעובד בתוך ימים כששומרים עליו בכל פעם, והוא נעשה קשה יותר ככל שהסוף נתון למשא ומתן.",
    ),
    tomorrow: L("Choose the warning words tonight (two more songs, one more round) and put the timer next to the screen. Tomorrow, say the words once, start the timer, and end exactly then.", "בחרו הערב את מילות האזהרה (עוד שני שירים, עוד סיבוב אחד) ושימו את הטיימר ליד המסך. מחר, אמרו את המילים פעם אחת, הפעילו את הטיימר, וסיימו בדיוק אז."),
    askAfter: mf("What comes after the screen tomorrow?", "מה בא אחרי המסך מחר?", "מה בא אחרי המסך מחר?"),
    together: L("Read it before a screen time, not at its end, and let your child choose the next thing's picture.", "קראו לפני זמן מסך, לא בסופו, ותנו לילד או לילדה לבחור את התמונה של הדבר הבא."),
    sourceNote: L(
      "The steps follow the AAP statement Media and Young Minds and the Family Media Plan, and the public evidence on transition warnings, visual timers and visual schedules for young children; no brand is used. The story form follows the social-story tradition. It is a developmentally informed parent practice; a child who cannot come down from any change, or hurts themself, needs your doctor, not a plan.",
      "השלבים עוקבים אחרי הצהרת AAP Media and Young Minds ותוכנית המדיה המשפחתית, ואחרי בסיס הראיות הציבורי על אזהרות מעבר, טיימרים חזותיים ולוחות זמנים חזותיים לילדים צעירים; בלי מותג. צורת הסיפור הולכת בעקבות מסורת הסיפור החברתי. זהו תרגול הורי מבוסס התפתחות; ילד שלא מצליח לצאת משום שינוי, או פוגע בעצמו, צריך את הרופא שלכם, לא תוכנית.",
    ),
    firstWeek: L("The first ends are often louder, because the warning is new and the end is firm. That is expected. Say the words once, let the timer end it, go to the next thing together, and count the ends that went to plan, not the shouting.", "הסיומים הראשונים לרוב רועשים יותר, כי האזהרה חדשה והסוף יציב. זה צפוי. אמרו את המילים פעם אחת, תנו לטיימר לסיים, לכו לדבר הבא ביחד, וספרו סיומים שהלכו לפי התוכנית, לא צעקות."),
  },
  bannedWords: { en: ["addiction", "addicted", "screen addiction", "meltdown", "tantrum", "ADHD"], he: ["התמכרות", "מכור", "מכורה", "התקף זעם"] },
  poses: ["hands-up", "stand-tall", "sit-calm", "hug-knees", "point-up"],
  scepticsThree: [
    { en: "“Warnings and timers teach the child to negotiate the end rather than accept it.” Answered in the panel: the words are said once, the timer ends the screen, and the end comes exactly then; the plan never bargains." },
    { en: "“A child who storms at every transition all day may have needs a parenting pattern does not meet.” Answered in the red lines: all-day storms the child cannot come down from, self-harm and a sudden onset route to the doctor; no condition is named." },
    { en: "“The 'next thing' becomes a bribe.” Answered in the text and the panel: the next thing is the ordinary next thing (snack, shoes, bath), named and pictured, never a treat traded for compliance." },
  ],
};
