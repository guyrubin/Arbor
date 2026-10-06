/**
 * B-PROG-02 [content — clinical] — TALK TOGETHER v0.1 (מדברים ביחד): eight
 * weeks on the Words shelf. The definition of record is the human-readable
 * program document PAI/projects/arbor/PROGRAM-TALK-TOGETHER-v0.1.md; this
 * file transcribes it 1:1 (same order, same ids, same words). Edit the
 * document first, then this file.
 *
 *  - Built from the PUBLIC literature on responsive interaction, dialogic
 *    reading (PEER / CROWD are public method names) and serve-and-return
 *    (Harvard Center on the Developing Child). Described as "developmentally
 *    informed" — never clinical, never therapy, never a licensed program.
 *  - Each week adds ONE parent skill and keeps the previous ones.
 *  - Practices are REUSED from content/practices.ts (Words shelf); coach
 *    scripts are the parent's behaviour only, ≤ 20 words, EN + HE (Hebrew
 *    authored natively: parents in the plural, the child in slash forms).
 *  - Measures are counts over time against the child's own first week; never
 *    a grade, a percentage, a colour or a comparison.
 *  - `reviewStatus: "draft"`: the clinical reviewer (G-01, E6) signs before any
 *    public use. Review rows: execution/2026-10-06--milestone-loop/REVIEW-SHEET.md
 *    "B-PROG-02 Talk Together v0.1"; Hebrew review pack:
 *    `npx tsx scripts/milestone-he-review.mts --programs export`.
 *
 * Guard: content/programs/talkTogether.test.ts.
 */
import { PRACTICE_SOURCES, type PracticeSource } from "../practices";
import type { LocalizedText } from "../governance";
import type { MeasureDef, Program } from "./types";

const L = (en: string, he: string): LocalizedText => ({ en, he });

/** The program's evidence list (document §Sources, S1–S15, in order). Five are
 *  the practice library's own records, reused by reference. Citation details
 *  of the journal articles come from the builder's knowledge and were not
 *  checked against the publishers (no network) — the reviewer confirms each;
 *  no URL is given except CDC's, which is already the catalogue's. */
export const TALK_TOGETHER_SOURCES = {
  harvardServeReturn: PRACTICE_SOURCES.harvardServeReturn,
  harvardFiveSteps: { org: "Harvard Center on the Developing Child", title: "5 Steps for Brain-Building Serve and Return (parent guide)", year: 2017 },
  tamisLeMonda2014: { org: "Tamis-LeMonda, Kuchirko & Song (Current Directions in Psychological Science 23(2):121–126)", title: "Why is infant language learning facilitated by parental responsiveness?", year: 2014 },
  robertsKaiser2011: { org: "Roberts & Kaiser (American Journal of Speech-Language Pathology 20(3):180–199)", title: "The effectiveness of parent-implemented language interventions: a meta-analysis", year: 2011 },
  heidlage2020: { org: "Heidlage, Cunningham, Kaiser, Trivette, Barton, Frey & Roberts (Early Childhood Research Quarterly 50:6–23)", title: "The effects of parent-implemented language interventions on child linguistic outcomes: a meta-analysis", year: 2020 },
  romeo2018: { org: "Romeo, Leonard, Robinson, West, Mackey, Rowe & Gabrieli (Psychological Science 29(5):700–710)", title: "Beyond the 30-million-word gap: children's conversational exposure is associated with language-related brain function", year: 2018 },
  cleave2015: { org: "Cleave, Becker, Curran, Owen Van Horne & Fey (American Journal of Speech-Language Pathology 24(2):237–255)", title: "The efficacy of recasts in language intervention: a systematic review and meta-analysis", year: 2015 },
  ashaActivities: PRACTICE_SOURCES.ashaActivities,
  whitehurst1988: { org: "Whitehurst, Falco, Lonigan, Fischel, DeBaryshe, Valdez-Menchaca & Caulfield (Developmental Psychology 24(4):552–559)", title: "Accelerating language development through picture book reading", year: 1988 },
  whitehurst1992: { org: "Whitehurst (Reading Rockets, public article)", title: "Dialogic Reading: An Effective Way to Read to Preschoolers", year: 1992 },
  wwc2007: { org: "What Works Clearinghouse (IES, U.S. Department of Education)", title: "Early Childhood Education intervention report: Dialogic Reading", year: 2007 },
  mol2008: { org: "Mol, Bus, de Jong & Smeets (Early Education and Development 19(1):7–26)", title: "Added value of dialogic parent–child book readings: a meta-analysis", year: 2008 },
  aapLiteracy: PRACTICE_SOURCES.aapLiteracy,
  aapPowerOfPlay: PRACTICE_SOURCES.aapPowerOfPlay,
  cdcMilestones: PRACTICE_SOURCES.cdcMilestones,
} as const satisfies Record<string, PracticeSource>;

const S = TALK_TOGETHER_SOURCES;

export const TALK_TOGETHER: Program = {
  id: "talk-together",
  shelf: "words",
  parentSkill: L(
    "Talk with your child in turns: wait, follow their lead, say their words back, add one word, and share books.",
    "לדבר עם הילד/ה בתורות: לחכות, ללכת אחריו/אחריה, להחזיר את המילים, להוסיף מילה אחת ולקרוא ספרים ביחד.",
  ),
  evidence: {
    techniques: ["responsive_interaction", "serve_and_return", "dialogic_reading"],
    sources: Object.values(S),
  },
  weeks: [
    {
      n: 1,
      skill: L(
        "Observe, wait, listen: notice what interests your child, then wait for their turn.",
        "להתבונן, לחכות, להקשיב: לשים לב למה שמעניין את הילד/ה, ולחכות לתור שלו/שלה.",
      ),
      practices: ["pr-cdc-15m-4", "pr-cdc-18m-4", "pr-asha-comm-24m", "pr-cdc-36m-3", "pr-cdc-12m-3"],
      coachScripts: [
        { id: "tt-w1-s1", text: L("Stop and watch what has caught their eye. Say nothing yet, and wait for them to show you.", "עצרו והסתכלו במה שתפס לו/לה את העין. אל תגידו כלום עדיין, וחכו שיראה/תראה לכם.") },
        { id: "tt-w1-s2", text: L("Get to their eye level and wait a slow five seconds. A look, sound or point is their turn.", "רדו לגובה העיניים וחכו חמש שניות לאט. מבט, קול או הצבעה הם כבר התור שלו/שלה.") },
        { id: "tt-w1-s3", text: L("Listen to the end of what they try to say, without finishing the word for them. Then answer.", "הקשיבו עד הסוף למה שהוא/היא מנסה להגיד, בלי להשלים את המילה במקומו/במקומה. ואז ענו.") },
      ],
      watchFor: ["cdc-15m-4", "cdc-18m-4"],
    },
    {
      n: 2,
      skill: L(
        "Follow the lead: play and talk about what your child chooses.",
        "ללכת אחרי הילד/ה: לשחק ולדבר על מה שהוא/היא בוחר/ת.",
      ),
      practices: ["pr-cdc-30m-4", "pr-cdc-30m-3", "pr-cdc-36m-6", "pr-cdc-15m-4", "pr-cdc-36m-3"],
      coachScripts: [
        { id: "tt-w2-s1", text: L("Let them choose the toy and the game. Join in by doing what they do.", "תנו לו/לה לבחור את הצעצוע ואת המשחק. הצטרפו ועשו כמו שהוא/היא עושה.") },
        { id: "tt-w2-s2", text: L("Talk about what they are looking at right now, not what you planned. Short words, their topic.", "דברו על מה שהוא/היא מסתכל/ת עליו עכשיו, לא על מה שתכננתם. מילים קצרות, הנושא שלו/שלה.") },
        { id: "tt-w2-s3", text: L("Hold back the questions for now. Describe what their hands are doing, like a friendly sports commentator.", "עצרו רגע עם השאלות. תארו מה הידיים שלו/שלה עושות, כמו שדרן ספורט חביב.") },
      ],
      watchFor: ["cdc-18m-5", "cdc-30m-4"],
    },
    {
      n: 3,
      skill: L(
        "Serve and return: answer each look, sound or word, and keep the turns going.",
        "הלוך ושוב: לענות לכל מבט, קול או מילה, ולהמשיך את התורות.",
      ),
      practices: ["pr-cdc-36m-4", "pr-cdc-36m-6", "pr-cdc-36m-5", "pr-cdc-18m-4", "pr-cdc-30m-4"],
      coachScripts: [
        { id: "tt-w3-s1", text: L("When they turn to you, with a look, a sound or a word, answer. Then wait for their next turn.", "כשהוא/היא פונה אליכם, במבט, בקול או במילה, ענו. ואז חכו לתור הבא שלו/שלה.") },
        { id: "tt-w3-s2", text: L("Keep the back-and-forth going while they enjoy it. Stop while it is still fun.", "המשיכו את ההלוך ושוב כל עוד זה כיף לו/לה. עצרו כשזה עוד נעים.") },
        { id: "tt-w3-s3", text: L("If they look away, that is a turn too. Pause, then follow where their attention went.", "אם הוא/היא מסתכל/ת הצידה, גם זה תור. עצרו רגע, ואז לכו אחרי מה שמשך אותו/אותה.") },
      ],
      watchFor: ["cdc-36m-6", "cdc-36m-4"],
    },
    {
      n: 4,
      skill: L(
        "Say it back: repeat their words clearly, as a reply, never a correction.",
        "להחזיר את המילה: לחזור על המילים שלו/שלה בבהירות, כתשובה ולא כתיקון.",
      ),
      practices: ["pr-asha-comm-36m", "pr-cdc-15m-3", "pr-cdc-12m-3", "pr-asha-comm-24m", "pr-cdc-36m-3"],
      coachScripts: [
        { id: "tt-w4-s1", text: L("When a word comes out differently, say it back clearly inside your answer, without asking them to repeat it.", "כשמילה יוצאת אחרת, אמרו אותה בצורה ברורה בתוך התשובה שלכם, בלי לבקש לחזור עליה.") },
        { id: "tt-w4-s2", text: L("Say their word back as if you are agreeing, with a smile. That is the whole move.", "חזרו על המילה שלו/שלה כאילו אתם מסכימים, עם חיוך. וזהו, זה הכול.") },
        { id: "tt-w4-s3", text: L("If you did not catch it, say back the part you understood and ask about it.", "אם לא הבנתם, חזרו על החלק שכן הבנתם ושאלו עליו.") },
      ],
      watchFor: ["cdc-15m-3", "asha-comm-24m"],
    },
    {
      n: 5,
      skill: L(
        "Add one word: say their words back with one word more.",
        "להוסיף מילה אחת: לחזור על המילים שלו/שלה עם עוד מילה אחת.",
      ),
      practices: ["pr-cdc-24m-3", "pr-cdc-15m-3", "pr-cdc-30m-5", "pr-cdc-30m-3", "pr-asha-comm-36m", "pr-cdc-18m-4"],
      coachScripts: [
        { id: "tt-w5-s1", text: L("Say their word back with one word added. 'Car' becomes 'blue car'. Just one.", "חזרו על המילה שלו/שלה והוסיפו מילה אחת. „אוטו” הופך ל„אוטו כחול”. רק אחת.") },
        { id: "tt-w5-s2", text: L("Add a word that is already in the moment: what it does, its colour, or who it belongs to.", "הוסיפו מילה מתוך הרגע עצמו: מה הוא עושה, איזה צבע, או של מי זה.") },
        { id: "tt-w5-s3", text: L("No need for them to repeat your longer version. Hearing it is the practice.", "אין צורך שיחזור/תחזור על הגרסה הארוכה. עצם השמיעה היא התרגול.") },
      ],
      watchFor: ["cdc-24m-3", "cdc-30m-3"],
    },
    {
      n: 6,
      skill: L(
        "Share a book: take turns on each page instead of reading every word.",
        "ספר ביחד: לקחת תורות בכל דף במקום לקרוא כל מילה.",
      ),
      practices: ["pr-cdc-24m-4", "pr-cdc-30m-5", "pr-words-01", "pr-words-02", "pr-cdc-15m-4"],
      coachScripts: [
        { id: "tt-w6-s1", text: L("Let them hold the book and turn the pages. Talk about the page they stop on.", "תנו לו/לה להחזיק את הספר ולהפוך דפים. דברו על הדף שבו הוא/היא עוצר/ת.") },
        { id: "tt-w6-s2", text: L("Skip the words on the page if you like. Point, name one picture, and wait for their turn.", "אפשר לדלג על הטקסט. הצביעו, תנו שם לתמונה אחת, וחכו לתור שלו/שלה.") },
        { id: "tt-w6-s3", text: L("When they point, name it and add a little: 'A dog! A big dog.' Then turn the page together.", "כשהוא/היא מצביע/ה, תנו שם והוסיפו קצת: „כלב! כלב גדול.” ואז הופכים דף ביחד.") },
      ],
      watchFor: ["cdc-24m-4", "cdc-30m-5"],
    },
    {
      n: 7,
      skill: L(
        "Book prompts (PEER): prompt, respond, add a word, invite them to say it again.",
        "שאלות על הספר: להזמין, להגיב, להוסיף מילה, ולהזמין לומר שוב.",
      ),
      practices: ["pr-words-03", "pr-words-04", "pr-words-06", "pr-cdc-30m-5", "pr-cdc-24m-4", "pr-cdc-24m-3"],
      coachScripts: [
        { id: "tt-w7-s1", text: L("Prompt: ask about one picture, 'What's that?' Then wait for their answer before you add anything.", "הזמינו: שאלו על תמונה אחת, „מה זה?” ואז חכו לתשובה לפני שאתם מוסיפים משהו.") },
        { id: "tt-w7-s2", text: L("Respond warmly to any answer, then expand it by one word, and invite them to say it with you.", "הגיבו בחום לכל תשובה, הרחיבו במילה אחת, והזמינו אותו/אותה להגיד את זה איתכם.") },
        { id: "tt-w7-s3", text: L("One prompt per page is plenty. If they want to turn the page, follow them.", "שאלה אחת לדף זה מספיק. אם הוא/היא רוצה להפוך דף, לכו אחריו/אחריה.") },
      ],
      watchFor: ["cdc-30m-5", "cdc-24m-3"],
    },
    {
      n: 8,
      skill: L(
        "Leave a gap: pause in songs, rhymes and routines so they can fill in the word.",
        "להשאיר רווח: לעצור בשירים, בחרוזים ובשגרה כדי שהילד/ה ישלים/תשלים את המילה.",
      ),
      practices: ["pr-cdc-48m-7", "pr-cdc-36m-5", "pr-cdc-24m-5", "pr-cdc-30m-3", "pr-cdc-36m-6", "pr-words-05"],
      coachScripts: [
        { id: "tt-w8-s1", text: L("In a song you sing together, stop just before a familiar word and wait, smiling.", "בשיר שאתם שרים ביחד, עצרו רגע לפני מילה מוכרת וחכו בחיוך.") },
        { id: "tt-w8-s2", text: L("Leave a gap in daily routines: 'Ready, steady…' and let them say 'go'.", "השאירו רווח בשגרה: „היכון, הכון...” ותנו לו/לה להגיד „צא!”") },
        { id: "tt-w8-s3", text: L("Any sound in the gap is their turn. If nothing comes, fill it in yourself, kindly.", "כל קול ברווח הוא התור שלו/שלה. אם לא בא כלום, השלימו בעצמכם, בנעימות.") },
      ],
      watchFor: ["cdc-36m-5", "cdc-30m-3"],
    },
  ],
  measures: {
    dose: true,
    parentProxy: {
      id: "turns-waited",
      label: L("Turns you waited for", "תורות שחיכיתם להם"),
      countingRule: L(
        "After a practice (\"Did it\"), one tap: how many times you waited and your child took a turn — 0, 1, 2, 3, 4 or 5+. The week's number is the sum of that week's taps (5+ counts as 5), always shown beside the number of practice days it came from and beside your own first week. It counts your own waiting, not your child.",
        "אחרי תרגול („עשינו”), נגיעה אחת: כמה פעמים חיכיתם והילד/ה לקח/ה תור — 0, 1, 2, 3, 4 או 5+. המספר של השבוע הוא סכום הנגיעות של אותו שבוע (5+ נספר כ-5), ומוצג תמיד ליד מספר ימי התרגול שממנו הוא בא וליד השבוע הראשון שלכם. זו ספירה שלכם על ההמתנה שלכם, לא על הילד/ה.",
      ),
      source: "selfCount",
      unit: L("turns", "תורות"),
    },
    childProxy: {
      id: "new-words",
      label: L("New words this week", "מילים חדשות השבוע"),
      countingRule: L(
        "The number of entries you filed on the Words shelf during the program week, where each entry is a word you heard your child say for the first time. Counted from your own entries only; nothing is extracted from your text, and the app never tests your child. Shown beside your own first week.",
        "מספר הרשומות שתייקתם במדף „מילים” בשבוע התוכנית, כשכל רשומה היא מילה ששמעתם מהילד/ה בפעם הראשונה. נספר רק ממה שאתם רשמתם; שום דבר לא מחולץ מהטקסט, והאפליקציה אף פעם לא בודקת את הילד/ה. מוצג ליד השבוע הראשון שלכם.",
      ),
      source: "shelfEntries",
      unit: L("words", "מילים"),
    },
  },
  reviewStatus: "draft",
};

/** The dose measure's words (`measures.dose: true` = the actionLoops practice-day count). */
export const TALK_TOGETHER_DOSE: MeasureDef = {
  id: "practice-days",
  label: L("Practice days", "ימי תרגול"),
  countingRule: L(
    "For program week n, the number of local days with a practice row in the child's actionLoops ledger (practice.<childId>.<day>, source practice, status completed) whose outcome is not \"not today\". From 0 to 7; a day counts once. \"Not today\" days are never shown as missed.",
    "בכל שבוע של התוכנית, מספר הימים שבהם יש ביומן הפעולות של הילד/ה שורת תרגול שהושלמה, והתשובה בה אינה „לא היום”. בין 0 ל-7; כל יום נספר פעם אחת. ימי „לא היום” אף פעם לא מוצגים כהחמצה.",
  ),
  source: "actionLoops",
  unit: L("days", "ימים"),
};

/**
 * What the B-PROG-01 shape does not carry (residue for the engine owner): the
 * program's name, the age band it was built for, each week's "why" with its
 * sources (the program document's reviewer text, EN), and the SECOND child
 * proxy ("two-word phrases seen", from the milestone cdc-24m-3) — the type
 * has one `childProxy`. Kept beside the program so the type stays exactly as
 * the pack defines it.
 */
export const TALK_TOGETHER_META: {
  name: LocalizedText;
  builtFor: { fromMonths: number; toMonths: number };
  describedAs: LocalizedText;
  weekEvidence: { n: number; why: string; sources: PracticeSource[] }[];
  phrasesMeasure: MeasureDef;
} = {
  name: L("Talk Together", "מדברים ביחד"),
  builtFor: { fromMonths: 18, toMonths: 36 },
  describedAs: L("Developmentally informed parent practice", "תרגול להורים, מבוסס התפתחות"),
  weekEvidence: [
    { n: 1, why: "A child's look, sound or point is a \"serve\"; noticing it and pausing long enough for it to come is the first step of every exchange. Prompt replies that match what the child is already attending to are the responsiveness linked to faster word learning.", sources: [S.harvardServeReturn, S.harvardFiveSteps, S.tamisLeMonda2014] },
    { n: 2, why: "Talk that follows the child's own focus is a shared thread of the parent-implemented language strategies that improved children's expressive language in trials. Child-led play with an engaged adult is also the AAP's play advice.", sources: [S.robertsKaiser2011, S.heidlage2020, S.aapPowerOfPlay] },
    { n: 3, why: "Back-and-forth exchanges, answered and waited for, are the serve and return the Harvard Center describes as building early brain architecture. The number of conversational turns, more than the number of words a child hears, is associated with activity in the brain's language areas.", sources: [S.harvardServeReturn, S.harvardFiveSteps, S.romeo2018] },
    { n: 4, why: "Saying the child's attempt back in the clear adult form, inside a natural reply (a recast), is one of the best-studied language-support moves. ASHA's parent activities give the same advice: repeat and build on what the child says.", sources: [S.cleave2015, S.ashaActivities] },
    { n: 5, why: "Expansions, the child's own words said back with a little more, are a core strategy of the parent-implemented interventions whose meta-analyses found gains in children's expressive language. ASHA's activities describe adding to what the child says in the same way.", sources: [S.robertsKaiser2011, S.heidlage2020, S.ashaActivities] },
    { n: 6, why: "Book sharing in which the child talks, not only listens, is associated with larger oral-language gains than reading aloud alone, most of all at the youngest ages. The AAP advises reading together every day from infancy.", sources: [S.mol2008, S.whitehurst1988, S.aapLiteracy] },
    { n: 7, why: "Dialogic reading's PEER sequence (prompt, evaluate, expand, repeat) makes the child the teller of the book; it is a public method described by its authors and reviewed independently. In Hebrew it is described in plain words, without the English acronym.", sources: [S.whitehurst1988, S.whitehurst1992, S.wwc2007] },
    { n: 8, why: "Completion prompts, a familiar sentence with the last word left out, are the first of the CROWD prompts and the easiest for young children. Singing songs and saying rhymes together is among the CDC's tips, and ASHA lists songs and routines among its activities.", sources: [S.whitehurst1992, S.cdcMilestones, S.ashaActivities] },
  ],
  phrasesMeasure: {
    id: "two-word-phrases",
    label: L("Two-word phrases seen", "צירופי שתי מילים ששמעתם"),
    countingRule: L(
      "The number of moments in the program week that you confirmed for the milestone \"Says two words together\" (cdc-24m-3), for example \"more milk\"; each confirmed moment counts once, and only after you confirm the mapping. Shown beside your own first week.",
      "מספר הרגעים בשבוע התוכנית שאישרתם לאבן הדרך „מחבר/ת שתי מילים”, למשל „עוד חלב”; כל רגע מאושר נספר פעם אחת, ורק אחרי שאתם אישרתם את השיוך. מוצג ליד השבוע הראשון שלכם.",
    ),
    source: "milestone",
    unit: L("moments", "רגעים"),
  },
};
