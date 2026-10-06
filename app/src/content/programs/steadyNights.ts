/**
 * B-PROG-06 [content — clinical] — STEADY NIGHTS v0.1 (לילות רגועים): six
 * weeks on the Sleep shelf. The definition of record is the human-readable
 * program document PAI/projects/arbor/PROGRAM-STEADY-NIGHTS-v0.1.md; this file
 * transcribes it 1:1 (same order, same ids, same words). Edit the document
 * first, then this file.
 *
 *  - Built from public guidance on bedtime routines, light and screens,
 *    timing and wind-down, a parent sleep diary, and gradual steps the FAMILY
 *    chooses (the general finding of the behavioural-sleep reviews only).
 *    Described as "developmentally informed" — never clinical, never therapy,
 *    never a named sleep method or brand. The sleep-method safety rule of
 *    B-LOOP-08 applies in full: no approach that leaves a distressed child
 *    without a response, no amounts, no restriction, no target for the child.
 *  - Enrols from 12 months. Babies under 12 months are governed by the AAP
 *    2022 safe-sleep recommendations, quoted verbatim by the reviewer only
 *    (STEADY_NIGHTS_META.boundaries.safeSleepUnder12m is a placeholder, never
 *    rendered); pr-sleep-01 is NOT part of this program.
 *  - Practices are REUSED from content/practices.ts (Sleep shelf: pr-sleep-02…06
 *    as written, pr-sleep-07…21 added from the document). Coach scripts are the
 *    parent's behaviour only, ≤ 20 words, EN + HE (parents in the plural, the
 *    child in slash forms).
 *  - Watch-for is EMPTY every week: the catalogue has no sleep row.
 *  - Measures are counts over time against the family's own first week; the
 *    child proxy is the family's own diary (lib/sleepDiary.ts), hours as a
 *    number, never a recommended number of hours.
 *  - `reviewStatus: "draft"`: the clinical reviewer (G-01, E6) signs before any
 *    public use. Review rows: execution/2026-10-06--milestone-loop/REVIEW-SHEET.md
 *    "B-PROG-06 Steady Nights v0.1"; Hebrew review pack:
 *    `npx tsx scripts/milestone-he-review.mts --programs export`.
 *
 * Guard: content/programs/steadyNights.test.ts.
 */
import { PRACTICE_SOURCES, type PracticeSource } from "../practices";
import type { LocalizedText } from "../governance";
import type { MeasureDef, Program } from "./types";

const L = (en: string, he: string): LocalizedText => ({ en, he });

/** The program's evidence list (document §sources, S1–S12, in order) — the
 *  practice library's own records, reused by reference. `verified: false` marks
 *  the citations the reviewer confirms (no URL is given for those). */
export const STEADY_NIGHTS_SOURCES = {
  aapBedtimeTrouble: PRACTICE_SOURCES.aapBedtimeTrouble, // S1
  aapHealthyChildrenSleep: PRACTICE_SOURCES.aapHealthyChildrenSleep, // S2
  nhsSleepYoungChildren: PRACTICE_SOURCES.nhsStartForLifeSleep, // S3 (record retitled 6 Oct, R10)
  aapMediaYoungMinds: PRACTICE_SOURCES.aapMediaYoungMinds, // S4
  mindell2015Routines: PRACTICE_SOURCES.mindell2015Routines, // S5
  mindellWilliamson2018: PRACTICE_SOURCES.mindellWilliamson2018, // S6
  meltzerMindell2014: PRACTICE_SOURCES.meltzerMindell2014, // S7
  mindell2006Review: PRACTICE_SOURCES.mindell2006Review, // S8
  sheffieldSleepDiary: PRACTICE_SOURCES.sheffieldSleepDiary, // S9
  aapSafeSleep: PRACTICE_SOURCES.aapSafeSleep, // S10
  aapSleepBreathing2012: PRACTICE_SOURCES.aapSleepBreathing2012, // S11
  whoUnder5: PRACTICE_SOURCES.whoMovement, // S12
} as const satisfies Record<string, PracticeSource>;

const S = STEADY_NIGHTS_SOURCES;

export const STEADY_NIGHTS: Program = {
  id: "steady-nights",
  shelf: "sleep",
  parentSkill: L(
    "Keep one calm bedtime routine, shape light and timing around it, notice the pattern, and make small changes you choose.",
    "לשמור על טקס שינה רגוע אחד, להתאים אליו את האור ואת השעה, לשים לב למה שחוזר, ולעשות שינויים קטנים שאתם בוחרים.",
  ),
  evidence: {
    techniques: ["routine_building", "responsive_interaction", "specific_praise"],
    sources: Object.values(S),
  },
  weeks: [
    {
      n: 1,
      skill: L(
        "Keep one short, calm bedtime routine: the same steps, in the same order, every night.",
        "לשמור על טקס שינה אחד, קצר ורגוע: אותם שלבים, באותו סדר, בכל ערב.",
      ),
      practices: ["pr-sleep-07", "pr-sleep-02", "pr-sleep-09", "pr-sleep-10", "pr-sleep-08", "pr-sleep-06"],
      coachScripts: [
        { id: "sn-w1-s1", text: L("Stay calm and brief. Walk back to bed and say the same goodnight words as always.", "הישארו רגועים וקצרים. חזרו איתו/איתה למיטה ואמרו את אותן מילות לילה טוב כמו תמיד.") },
        { id: "sn-w1-s2", text: L("Name where you are in the routine: the book is done, now it's sleep. Then goodnight, once.", "אמרו איפה אתם בטקס: הספר נגמר, עכשיו ישנים. ואז לילה טוב, פעם אחת.") },
        { id: "sn-w1-s3", text: L("If a need was missed, a drink or the toilet, meet it quietly, then go back to the last step.", "אם פספסתם משהו, מים או שירותים, טפלו בזה בשקט, וחזרו לשלב האחרון.") },
      ],
      watchFor: [],
    },
    {
      n: 2,
      skill: L(
        "Dim the evening and brighten the morning: low light and screens off before bed, daylight after waking.",
        "ערב חשוך ובוקר מואר: אור נמוך ומסכים כבויים לפני השינה, אור יום אחרי ההשכמה.",
      ),
      practices: ["pr-sleep-03", "pr-sleep-11", "pr-sleep-12", "pr-sleep-14", "pr-sleep-07"],
      coachScripts: [
        { id: "sn-w2-s1", text: L("Keep the room dim and your voice low. Bright light and chatter wake everyone up again.", "השאירו את החדר חשוך ודברו בשקט. אור חזק ודיבורים מעירים את כולם מחדש.") },
        { id: "sn-w2-s2", text: L("If they ask for a screen, say no once, kindly, and offer the next routine step instead.", "אם מבקשים מסך, תגידו לא פעם אחת, בנעימות, והציעו במקום את השלב הבא בטקס.") },
        { id: "sn-w2-s3", text: L("If the dark is the trouble, switch on the nightlight, say where you'll be, and step out calmly.", "אם החושך מפחיד, הדליקו את מנורת הלילה, אמרו איפה תהיו, וצאו ברוגע.") },
      ],
      watchFor: [],
    },
    {
      n: 3,
      skill: L(
        "Start winding down at about the same time each evening, when the first sleepy signs show.",
        "להתחיל להירגע לקראת שינה בערך באותה שעה בכל ערב, כשמופיעים סימני העייפות הראשונים.",
      ),
      practices: ["pr-sleep-04", "pr-sleep-05", "pr-sleep-13", "pr-sleep-14", "pr-sleep-09"],
      coachScripts: [
        { id: "sn-w3-s1", text: L("Notice what came before tonight: a nap near bedtime, or a busy evening. Keep tonight's steps calm and the same.", "שימו לב מה היה לפני: שנת צהריים קרובה לערב, או ערב עמוס. הערב, שמרו על שלבים רגועים וקבועים.") },
        { id: "sn-w3-s2", text: L("Slow everything down: slow voice, slow moves, one quiet thing. Your calm sets the room.", "האטו הכול: קול איטי, תנועות איטיות, דבר שקט אחד. הרוגע שלכם קובע את האווירה בחדר.") },
        { id: "sn-w3-s3", text: L("Tomorrow, start the routine a little earlier, when you see the first yawn.", "מחר, התחילו את הטקס קצת יותר מוקדם, כשאתם רואים את הפיהוק הראשון.") },
      ],
      watchFor: [],
    },
    {
      n: 4,
      skill: L(
        "Keep a short sleep diary for a week, then read it together and notice one thing that repeats.",
        "לנהל יומן שינה קצר במשך שבוע, ואז לקרוא אותו יחד ולשים לב לדבר אחד שחוזר.",
      ),
      practices: ["pr-sleep-15", "pr-sleep-16", "pr-sleep-04", "pr-sleep-05", "pr-sleep-07"],
      coachScripts: [
        { id: "sn-w4-s1", text: L("Right now, just help them back to bed calmly. In the morning, note it in the diary.", "עכשיו, פשוט עזרו לו/לה לחזור למיטה ברוגע. בבוקר, רשמו את זה ביומן.") },
        { id: "sn-w4-s2", text: L("Note what happened before, not who was to blame. The diary is for spotting what repeats.", "רשמו מה קרה לפני, לא מי אשם. היומן נועד לגלות מה חוזר.") },
        { id: "sn-w4-s3", text: L("A hard night is information, not a failure. Write it down, and look at the whole week.", "לילה קשה הוא מידע, לא כישלון. רשמו אותו, ותסתכלו על כל השבוע.") },
      ],
      watchFor: [],
    },
    {
      n: 5,
      skill: L(
        "Choose one small change at sleep time, keep the rest the same, and respond the same calm way each time.",
        "לבחור שינוי קטן אחד בזמן ההירדמות, לשמור על כל השאר, ולהגיב באותה דרך רגועה בכל פעם.",
      ),
      practices: ["pr-sleep-19", "pr-sleep-17", "pr-sleep-18", "pr-sleep-10", "pr-sleep-20", "pr-sleep-15"],
      coachScripts: [
        { id: "sn-w5-s1", text: L("Walk them back to bed with as few words as possible. Same words, same calm, every time.", "החזירו אותו/אותה למיטה עם כמה שפחות מילים. אותן מילים, אותו רוגע, בכל פעם.") },
        { id: "sn-w5-s2", text: L("Keep to the small step you chose tonight. If they are very upset, comfort them first.", "הישארו עם הצעד הקטן שבחרתם הערב. אם הוא/היא נסער/ת מאוד, קודם כול נחמו.") },
        { id: "sn-w5-s3", text: L("Offer their comforter, say goodnight once more, and stay with the small step you chose.", "הציעו את הבובה או השמיכה, אמרו לילה טוב עוד פעם אחת, והישארו עם הצעד הקטן שבחרתם.") },
      ],
      watchFor: [],
    },
    {
      n: 6,
      skill: L(
        "Keep the routine through disrupted nights, and come back to it as soon as you can.",
        "לשמור על הטקס גם בלילות לא רגילים, ולחזור אליו ברגע שאפשר.",
      ),
      practices: ["pr-sleep-21", "pr-sleep-05", "pr-sleep-06", "pr-sleep-20", "pr-sleep-07", "pr-sleep-15"],
      coachScripts: [
        { id: "sn-w6-s1", text: L("Tonight is different, and that's fine. Do a short version of your usual steps, in order.", "הלילה שונה, וזה בסדר. עשו גרסה קצרה של השלבים הרגילים, לפי הסדר.") },
        { id: "sn-w6-s2", text: L("If they're unwell, comfort comes first. Go back to the routine when they're well again.", "אם הוא/היא חולה, קודם כול נחמה. חזרו לטקס כשירגיש/תרגיש טוב.") },
        { id: "sn-w6-s3", text: L("One rough night does not undo your weeks of routine. Tomorrow: same steps, same order.", "לילה אחד קשה לא מוחק שבועות של טקס. מחר: אותם שלבים, אותו סדר.") },
      ],
      watchFor: [],
    },
  ],
  measures: {
    dose: true,
    parentProxy: {
      id: "routine-in-order",
      label: L("Routine done in order", "הטקס נעשה לפי הסדר"),
      countingRule: L(
        "Each evening of the program, one tap after bedtime: \"Done in order\" or \"Not tonight\". The week's number is the count of nights in program week n tapped \"Done in order\" (0–7; one answer per night, the last tap that night wins). \"Not tonight\" and no tap are simply not counted, and never shown. It counts the parent's own routine, not anything the child did. Shown beside your own first week.",
        "בכל ערב של התוכנית, נגיעה אחת אחרי ההשכבה: „נעשה לפי הסדר” או „לא הערב”. המספר של השבוע הוא מספר הלילות באותו שבוע של התוכנית שסומנו „נעשה לפי הסדר” (בין 0 ל-7; תשובה אחת ללילה, הנגיעה האחרונה קובעת). „לא הערב” או בלי נגיעה פשוט לא נספרים ולא מוצגים. זו ספירה של הטקס שלכם, לא של מה שהילד/ה עשה/תה. מוצג ליד השבוע הראשון שלכם.",
      ),
      source: "selfCount",
      unit: L("nights", "לילות"),
    },
    childProxy: {
      id: "longest-stretch",
      label: L("Longest stretch asleep", "פרק השינה הרציף הארוך"),
      countingRule: L(
        "Per night: the longest gap between consecutive diary times (fell asleep → first noticed waking → … → woke up for the day), rounded to the nearest half hour, shown as hours (for example 7.5); wakings you did not notice are not in the diary, and the label says \"from your diary\". Per week: the middle value of that week's logged nights (with an even number of nights, the lower of the two middle values, so it is always a night that happened), shown with the number of nights it came from and beside your first diary week: the first program week with at least three nights logged; until then the baseline is blank, with no message. Never a recommended number of hours.",
        "בכל לילה: הפער הארוך ביותר בין שתי שעות עוקבות ביומן (נרדם/ה ← התעוררות ראשונה ששמתם לב אליה ← … ← קם/קמה בבוקר), מעוגל לחצי השעה הקרובה, מוצג בשעות (למשל 7.5). התעוררויות שלא שמתם לב אליהן לא נמצאות ביומן. בכל שבוע: הערך האמצעי של הלילות שנרשמו באותו שבוע (במספר זוגי, הנמוך מבין שני האמצעיים), יחד עם מספר הלילות שממנו הוא בא ועם המספר משבוע היומן הראשון שלכם: שבוע התוכנית הראשון שבו נרשמו לפחות שלושה לילות; עד אז המקום ריק, בלי הודעה. אף פעם לא מספר שעות מומלץ.",
      ),
      source: "sleepLogs",
      unit: L("hours", "שעות"),
    },
  },
  reviewStatus: "draft",
};

/** The dose measure's words (`measures.dose: true` = the actionLoops practice-day count). */
export const STEADY_NIGHTS_DOSE: MeasureDef = {
  id: "practice-days",
  label: L("Practice days", "ימי תרגול"),
  countingRule: L(
    "For program week n (local days startedAt + 7(n−1) … startedAt + 7n − 1), the number of local days with a practice row in the child's actionLoops ledger (practice.<childId>.<day>, source practice, status completed) whose outcome is not \"not today\". From 0 to 7; one row per day by construction, so a day counts once. A day not logged is never shown as missed.",
    "בכל שבוע של התוכנית, מספר הימים שבהם יש ביומן הפעולות של הילד/ה שורת תרגול שהושלמה, והתשובה בה אינה „לא היום”. בין 0 ל-7; כל יום נספר פעם אחת. יום שלא נרשם אף פעם לא מוצג כהחמצה.",
  ),
  source: "actionLoops",
  unit: L("days", "ימים"),
};

/**
 * What the B-PROG-01 shape does not carry (residue for the engine owner): the
 * program's name, the age window and per-week bands, each week's "why" with
 * its sources (the program document's reviewer text, EN), the two
 * parent-typed lines (stored on the enrolment, the parent's words verbatim,
 * never interpreted by the AI) and the boundary lines the program page renders.
 */
export const STEADY_NIGHTS_META: {
  name: LocalizedText;
  builtFor: { fromMonths: number; toMonths: number };
  enrolFromMonths: number;
  describedAs: LocalizedText;
  weekBands: { n: number; fromMonths: number }[];
  weekEvidence: { n: number; why: string; sources: PracticeSource[] }[];
  parentNotes: { id: "one-thing-that-repeats" | "the-step-we-chose"; week: number; prompt: LocalizedText; storedOn: "enrolment"; optional: boolean }[];
  boundaries: { professional: LocalizedText; week5Safety: LocalizedText; safeSleepUnder12m: string };
} = {
  name: L("Steady Nights", "לילות רגועים"),
  builtFor: { fromMonths: 12, toMonths: 72 },
  enrolFromMonths: 12,
  describedAs: L("Developmentally informed parent practice for calmer bedtimes", "תרגול להורים סביב ההשכבה, מבוסס התפתחות"),
  weekBands: [
    { n: 1, fromMonths: 12 },
    { n: 2, fromMonths: 12 },
    { n: 3, fromMonths: 12 },
    { n: 4, fromMonths: 12 },
    { n: 5, fromMonths: 18 },
    { n: 6, fromMonths: 12 },
  ],
  weekEvidence: [
    { n: 1, why: "The AAP advises a calming pre-sleep routine and a bedtime kept consistent every night. In a fourteen-country survey a nightly routine was associated with better sleep for young children, more so with each extra night per week it was kept.", sources: [S.aapBedtimeTrouble, S.mindell2015Routines, S.mindellWilliamson2018] },
    { n: 2, why: "The AAP advises no screens in the hour before bedtime and screen-free bedrooms. The NHS advises screens off before bed because their light can interfere with sleep, and a nightlight for a child who is afraid of the dark.", sources: [S.aapMediaYoungMinds, S.nhsSleepYoungChildren] },
    { n: 3, why: "The NHS advises a predictable routine at the same time each night and afternoon naps kept away from bedtime, and the AAP advises a consistent bedtime. The WHO's under-five guidance describes good sleep with regular sleep and wake-up times.", sources: [S.nhsSleepYoungChildren, S.aapBedtimeTrouble, S.whoUnder5] },
    { n: 4, why: "NHS children's services give families a printable sleep diary for keeping a record of a child's sleep, and the NHS advises talking to a health professional when sleep troubles persist, where the diary is the family's own record to bring. Behavioural-sleep studies use parent diaries as a main record of young children's sleep.", sources: [S.sheffieldSleepDiary, S.nhsSleepYoungChildren, S.mindell2006Review] },
    { n: 5, why: "The NHS advises taking a child who gets up back to bed with as little fuss as possible and keeping night wakings calm and dull; the AAP advises a comfort object and patience while habits form. Reviews of the behavioural-sleep literature find that consistent, gradual changes made by parents improve settling and night waking in young children; here the family chooses the step and the pace.", sources: [S.nhsSleepYoungChildren, S.aapBedtimeTrouble, S.meltzerMindell2014, S.mindell2006Review] },
    { n: 6, why: "The AAP stresses patience and a positive approach while new habits form, and the NHS notes that it takes several nights of repeating the same routine before it settles. The routine kept on most nights is what the routine studies associate with better sleep.", sources: [S.aapBedtimeTrouble, S.nhsSleepYoungChildren, S.mindell2015Routines, S.mindellWilliamson2018] },
  ],
  parentNotes: [
    { id: "one-thing-that-repeats", week: 4, prompt: L("Read this week's diary together. What is one thing that repeats?", "קראו יחד את היומן של השבוע. מה דבר אחד שחוזר?"), storedOn: "enrolment", optional: true },
    { id: "the-step-we-chose", week: 5, prompt: L("The small step we chose this week, in our own words.", "הצעד הקטן שבחרנו השבוע, במילים שלנו."), storedOn: "enrolment", optional: true },
  ],
  boundaries: {
    professional: L(
      "If sleep troubles go on or worry you, or your child snores loudly with pauses in breathing, talk to your family doctor, paediatrician or Tipat Halav nurse.",
      "אם קשיי השינה נמשכים או מדאיגים אתכם, או שהילד/ה נוחר/ת חזק עם הפסקות בנשימה, דברו עם רופא/ת המשפחה, רופא/ת הילדים או האחות בטיפת חלב.",
    ),
    week5Safety: L(
      "A step is always one you choose, and comfort always comes first. If your child is very upset, comfort them and pause the step.",
      "הצעד הוא תמיד אחד שאתם בוחרים, ונחמה תמיד באה קודם. אם הילד/ה נסער/ת מאוד, נחמו ועצרו את הצעד.",
    ),
    // R14: never paraphrased; the program does not enrol under 12 months, so this is not rendered.
    safeSleepUnder12m: "[AAP 2022 safe-sleep wording — reviewer to supply verbatim]",
  },
};
