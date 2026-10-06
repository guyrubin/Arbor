/**
 * B-LOOP-08 [content — clinical] — THE PRACTICE LIBRARY: one "do + say"
 * practice per live catalogue milestone (lib/milestoneData ALL_MILESTONES,
 * 2–60 months; the retired m-1…m-10 never get one), EN + HE, each naming
 * the evidence family it applies and the public document it comes from.
 *
 *  - `do`  : ONE concrete thing the parent does with the child today
 *            (≤ 25 words). The practice is the PARENT's behaviour — never a
 *            target, a count or a test for the child.
 *  - `say` : the exact sentence the parent says, in the child's register
 *            (≤ 15 words). Hebrew is authored natively (spoken Israeli
 *            Hebrew; parents addressed in the plural in `do`; the child in
 *            slash forms or neutral), never translated word for word.
 *  - `materials` (optional): household items only.
 *  - `shelf` and `ageMonths` are DERIVED from the catalogue row (shelf via
 *    lib/shelves/registry `milestoneShelf`) — never hand-assigned.
 *  - Every record ships `reviewStatus: "draft"`: nothing publishes before
 *    the clinical reviewer (G-01) signs (`isPracticePublishable` is the
 *    fail-closed gate). Each practice has a row in
 *    PAI/projects/arbor/execution/2026-10-06--milestone-loop/REVIEW-SHEET.md
 *    ("B-LOOP-08 practices"); the Hebrew lines go through the native review
 *    pack (`npx tsx scripts/milestone-he-review.mts --practices export`).
 *
 * Rules (guarded by content/practices.test.ts): no norm or verdict word, no
 * diagnosis term, no brand or licensed program name, no sleep-method words,
 * no food amounts / restriction / reward; feelings practices name a feeling
 * only as an offer ("Looks like…?"). The scan lists live HERE, once
 * (PRACTICE_BANNED), so the review import refuses the same words.
 *
 * The catalogue has NO sleep-tagged row and no family-domain row today, so
 * the Sleep and Family shelves carry no practice (B-LOOP-03: the tagged rows
 * are six feeding rows). A sleep practice arrives with a sourced sleep row.
 *
 * FIX-BY-ID LAYOUT (the review import depends on it): one `P("<milestoneId>"`
 * line opens each practice; `do:` and `say:` each sit on their own line as
 * `L("<en>", "<he>")`. Edit text in place; never regenerate the file.
 */
import type { Milestone } from "../types";
import { ALL_MILESTONES, bandForAgeMonths } from "../lib/milestoneData";
import { milestoneShelf, shelfDef, SHELF_IDS, type ShelfId } from "../lib/shelves/registry";
import { isPublishableContent, type ContentReviewStatus, type GovernedContentRecord, type LocalizedText } from "./governance";

/** The evidence family a practice applies (thesis §1.1, parent-implemented). */
export type PracticeTechnique =
  | "responsive_interaction"
  | "dialogic_reading"
  | "serve_and_return"
  | "child_directed_play"
  | "specific_praise"
  | "routine_building"
  | "joint_attention"
  | "fine_motor_play"
  | "gross_motor_play"
  | "executive_function_game";

export const PRACTICE_TECHNIQUES: readonly PracticeTechnique[] = [
  "responsive_interaction", "dialogic_reading", "serve_and_return", "child_directed_play", "specific_praise",
  "routine_building", "joint_attention", "fine_motor_play", "gross_motor_play", "executive_function_game",
];

/** A public, readable document. `url` only where the public URL is confirmed. */
export interface PracticeSource {
  org: string;
  title: string;
  url?: string;
  year: number;
}

export interface Practice {
  id: string;
  milestoneId: string;
  shelf: ShelfId;
  do: LocalizedText;
  say: LocalizedText;
  minutes: 5 | 10 | 15;
  materials?: LocalizedText;
  evidence: { technique: PracticeTechnique; source: PracticeSource };
  reviewStatus: ContentReviewStatus;
  ageMonths: number;
}

/**
 * The documents the practices cite. An undated web page carries the year it
 * was cited (2026) and says so in its title; a URL appears only where it is
 * already the catalogue's own (CDC) — every other URL is left for the
 * reviewer to confirm (REVIEW-SHEET risk notes).
 */
export const PRACTICE_SOURCES = {
  cdcMilestones: { org: "CDC", title: "Learn the Signs. Act Early. milestone checklists, 'Help your child learn and grow' tips (2022 revision)", url: "https://www.cdc.gov/ncbddd/actearly/milestones/index.html", year: 2022 },
  cdcPositiveParenting: { org: "CDC", title: "Positive Parenting Tips (web pages by age, undated; cited 2026)", year: 2026 },
  aapBrightFutures: { org: "AAP", title: "Bright Futures: Guidelines for Health Supervision of Infants, Children, and Adolescents, 4th edition", year: 2017 },
  aapPowerOfPlay: { org: "AAP", title: "The Power of Play: A Pediatric Role in Enhancing Development in Young Children (clinical report, Pediatrics)", year: 2018 },
  aapLiteracy: { org: "AAP", title: "Literacy Promotion: An Essential Component of Primary Care Pediatric Practice (policy statement, Pediatrics)", year: 2014 },
  ashaActivities: { org: "ASHA", title: "Activities to Encourage Speech and Language Development (web page, undated; cited 2026)", year: 2026 },
  harvardServeReturn: { org: "Harvard Center on the Developing Child", title: "Serve and Return (key concept page, undated; cited 2026)", year: 2026 },
  harvardExecutiveFunction: { org: "Harvard Center on the Developing Child", title: "Enhancing and Practicing Executive Function Skills with Children from Infancy to Adolescence", year: 2014 },
  whoUnicefCcd: { org: "WHO/UNICEF", title: "Care for Child Development: counselling cards (play and communication)", year: 2012 },
  whoMovement: { org: "WHO", title: "Guidelines on physical activity, sedentary behaviour and sleep for children under 5 years of age", year: 2019 },
  whoFeeding: { org: "WHO", title: "WHO Guideline for complementary feeding of infants and young children 6–23 months of age", year: 2023 },
} as const satisfies Record<string, PracticeSource>;

const S = PRACTICE_SOURCES;

/**
 * The one scan list (EN regexes, HE substrings — Hebrew glues particles to
 * the word). The test adds the catalogue rules (lib/milestoneHeRules) and
 * `findClinicalDiagnosisTerm`; the review import refuses the same words.
 */
export const PRACTICE_BANNED: { readonly en: readonly RegExp[]; readonly he: readonly string[] } = {
  en: [
    // targets, counts, drilling — the practice is the parent's behaviour
    /\bteach/i, /\btrain/i, /\btarget/i, /\bgoal/i, /\bstreak/i, /\bin a row\b/i, /\bpractice until\b/i,
    /\buntil (?:he|she|they|your|the child|the baby)\b/i,
    /\b(?:get|make)s?\s+(?:him|her|them|your (?:child|baby|toddler)|the (?:child|baby))\b/i,
    /\b(?:two|three|four|five|six|seven|eight|nine|ten)\s+times\b/i, /\d/,
    // norm / verdict / age words (the age firewall: no age statement in a practice)
    /\bshould\b/i, /\bnormal/i, /\bbehind\b/i, /\blate\b/i, /\bdelay/i, /\bon time\b/i, /\bahead\b/i,
    /\baverage\b/i, /\btypical/i, /\bmost children\b/i, /\bmonths old\b/i, /\byears old\b/i, /\bby age\b/i, /%/,
    // brand / licensed program names
    /\bhanen\b/i, /\bit takes two\b/i, /\bpcit\b/i, /\btriple p\b/i, /\bincredible years\b/i, /\bferber/i, /\bweissbluth/i, /\bmontessori\b/i,
    // sleep methods with a safety debate (scanned on EVERY practice)
    /\bcry(?:ing)?[- ]it[- ]out\b/i, /\bcontrolled crying\b/i, /\bextinction\b/i, /\blet (?:him|her|them) cry\b/i,
  ],
  he: [
    "ללמד", "לאמן", "אימון", "מטרה", "יעד", "רצף", "להכריח", "לגרום ל",
    "צריך", "צריכה", "צריכים", "עד גיל", "רוב הילדים", "ממוצע", "בזמן הנכון",
    "האנן", "פרבר", "מונטסורי", "שיטת", "לתת לו לבכות", "לתת לה לבכות", "לבכות עד",
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  ],
};

/** Food shelf only (responsive feeding and exposure — never amounts, restriction or reward). */
export const FOOD_BANNED: { readonly en: readonly RegExp[]; readonly he: readonly string[] } = {
  en: [/\bgrams?\b/i, /\bcups\b/i, /\bml\b/i, /\bounces?\b/i, /\bspoonfuls?\b/i, /\bfinish/i, /\bclean (?:your )?plate\b/i, /\breward/i, /\btreat\b/i, /\bdessert/i, /\bone more bite\b/i, /\ball gone\b/i, /\bno (?:more )?(?:sugar|snacks?)\b/i],
  he: ["לסיים את", "תסיים", "פרס", "כמות", "גרם", "כוסות", "עוד ביס", "צלחת ריקה", "קינוח", "ממתק", "אסור לאכול"],
};

/** Feelings shelf: a sentence that names an emotion must be a question (an offer, never a verdict). */
export const FEELING_WORDS: { readonly en: readonly RegExp[]; readonly he: readonly string[] } = {
  en: [/\bsad/i, /\bangry/i, /\bmad\b/i, /\bfrustrat/i, /\bscared/i, /\bafraid/i, /\bupset/i, /\bhappy/i, /\bsurpris/i, /\bworr/i, /\bannoy/i, /\bhard\b/i, /\bnervous/i, /\bjealous/i],
  he: ["עצוב", "כועס", "מתוסכל", "תסכול", "מפחד", "פוחד", "שמח", "הפתע", "הופתע", "דואג", "מעצבן", "קשה", "לחוץ", "מקנא"],
};

const L = (en: string, he: string): LocalizedText => ({ en, he });

const CATALOGUE: ReadonlyMap<string, Milestone> = new Map(ALL_MILESTONES.map((m) => [m.id, m]));

interface PracticeText {
  do: LocalizedText;
  say: LocalizedText;
  materials?: LocalizedText;
}

/** One practice for one catalogue row; shelf + age come from the row. */
function P(milestoneId: string, technique: PracticeTechnique, minutes: Practice["minutes"], source: PracticeSource, text: PracticeText): Practice {
  const row = CATALOGUE.get(milestoneId);
  if (!row) throw new Error(`B-LOOP-08: practice for unknown catalogue row ${milestoneId}`);
  return {
    id: `pr-${milestoneId}`,
    milestoneId,
    shelf: milestoneShelf(row),
    do: text.do,
    say: text.say,
    minutes,
    ...(text.materials ? { materials: text.materials } : {}),
    evidence: { technique, source },
    reviewStatus: "draft",
    ageMonths: row.ageMonths ?? 0,
  };
}

export const PRACTICES: readonly Practice[] = [
  /* ── batch 1/7 · Words · 2–18 months ─────────────────────────────────── */
  P("cdc-2m-3", "serve_and_return", 5, S.harvardServeReturn, {
    do: L("When your baby coos, pause, look at their face and copy the sound back. Then wait quietly for their next sound.", "כשהתינוק/ת משמיע/ה צליל, עצרו, הביטו בפנים שלו/ה והחזירו את אותו צליל. אחר כך חכו בשקט לצליל הבא."),
    say: L("Ooh! You said ooh! Tell me more.", "אההה! אמרת אההה! ספר/י לי עוד."),
  }),
  P("cdc-2m-4", "responsive_interaction", 5, S.whoUnicefCcd, {
    do: L("When a sudden noise startles your baby, come close, name the sound in a calm voice, and hold them while they settle.", "כשרעש פתאומי מבהיל את התינוק/ת, התקרבו, אמרו בקול רגוע מה היה הרעש והחזיקו קרוב עד שהגוף הקטן נרגע."),
    say: L("That was a big bang! It was the door. I'm here.", "זה היה בום גדול! זאת הייתה הדלת. אני פה."),
  }),
  P("cdc-4m-3", "serve_and_return", 5, S.harvardServeReturn, {
    do: L("Hold your baby face to face during a quiet moment. Say a short sound, then pause long enough for them to answer.", "החזיקו את התינוק/ת פנים מול פנים ברגע שקט. השמיעו צליל קצר ותנו לו/ה זמן לענות."),
    say: L("Ba-ba? Your turn. Oh, you're talking to me!", "בה-בה? תורך. וואו, את/ה מדבר/ת איתי!"),
  }),
  P("cdc-4m-4", "responsive_interaction", 5, S.cdcMilestones, {
    do: L("While your baby lies on a blanket, talk softly from one side, then the other. Smile when they turn to find you.", "כשהתינוק/ת שוכב/ת על שמיכה, דברו בשקט מצד אחד ואחר כך מהצד השני. חייכו כשהוא/היא מסתובב/ת למצוא אתכם."),
    say: L("Where's my voice? Here I am! You found me.", "איפה הקול שלי? הנה אני! מצאת אותי."),
  }),
  P("cdc-6m-3", "serve_and_return", 5, S.ashaActivities, {
    do: L("Copy the sounds your baby makes, then add a new one and wait. Keep the back-and-forth going while they enjoy it.", "חזרו על הצלילים שהתינוק/ת משמיע/ה, הוסיפו צליל חדש וחכו. המשיכו הלוך ושוב כל עוד זה כיף לו/ה."),
    say: L("Da-da-da! Your turn. Ma-ma-ma! Now you.", "דה-דה-דה! תורך. מה-מה-מה! עכשיו את/ה."),
  }),
  P("cdc-6m-4", "serve_and_return", 5, S.harvardServeReturn, {
    do: L("When your baby blows a raspberry, blow one back with a big face. Let them lead the game and copy whatever sound comes next.", "כשהתינוק/ת עושה 'פררר' עם השפתיים, עשו את זה בחזרה עם פרצוף גדול. תנו לו/ה להוביל את המשחק וחקו את הצליל הבא."),
    say: L("Pbbbt! That was a funny one! Again?", "פררר! איזה צליל מצחיק! עוד פעם?"),
  }),
  P("cdc-9m-4", "serve_and_return", 5, S.ashaActivities, {
    do: L("When your baby babbles, answer as if they told you something, then offer a real word with the same sound.", "כשהתינוק/ת ממלמל/ת, ענו כאילו סיפר/ה לכם משהו, ואחר כך תנו מילה אמיתית עם אותו צליל."),
    say: L("Bababa? Yes! Ball! Ba for ball.", "בבבה? כן! בננה! בה כמו בננה."),
  }),
  P("cdc-9m-5", "responsive_interaction", 5, S.cdcMilestones, {
    do: L("Before you pick your baby up, hold out your arms, say 'up', and pause a moment so they can reach toward you.", "לפני שאתם מרימים את התינוק/ת, הושיטו ידיים, אמרו 'הופה' וחכו רגע כדי שיוכל/תוכל להושיט ידיים אליכם."),
    say: L("Up? You want up! Up we go.", "הופה? רוצה למעלה? הופה, למעלה!"),
  }),
  P("cdc-12m-2", "routine_building", 5, S.cdcMilestones, {
    do: L("Make waving part of every goodbye: when someone leaves, wave slowly together at the door and say 'bye-bye' with them.", "הפכו את הנפנוף לחלק מכל פרידה: כשמישהו יוצא, נפנפו יחד ליד הדלת ואמרו 'ביי' ביחד."),
    say: L("Bye-bye, Grandma! We wave bye-bye. See you soon!", "ביי סבתא! מנפנפים ביי. להתראות!"),
  }),
  P("cdc-12m-3", "responsive_interaction", 5, S.ashaActivities, {
    do: L("Use your family names often during the day, pointing to the person. When your child tries any version of a name, answer warmly.", "השתמשו בשמות של בני המשפחה לאורך היום והצביעו על האדם. כשהילד/ה מנסה להגיד שם בכל צורה, ענו בחום."),
    say: L("Here's Daddy! Daddy's home! You said Dada!", "הנה אבא! אבא בבית! אמרת אבא!"),
  }),
  P("cdc-12m-4", "responsive_interaction", 5, S.aapBrightFutures, {
    do: L("When something isn't safe, say 'no' calmly with one short reason, then offer something they can do instead.", "כשמשהו לא בטוח, אמרו 'לא' ברוגע עם סיבה קצרה אחת, ותנו מיד משהו אחר שמותר לעשות."),
    say: L("No, hot. Here, you can hold the spoon.", "לא, חם. הנה, אפשר להחזיק את הכף."),
  }),
  P("cdc-15m-3", "responsive_interaction", 5, S.ashaActivities, {
    do: L("When your child says part of a word, like 'ba', say the whole word back clearly and happily, without asking them to repeat it.", "כשהילד/ה אומר/ת חלק ממילה, כמו 'בה', אמרו את המילה המלאה בבירור ובשמחה, בלי לבקש לחזור עליה."),
    say: L("Ba! Yes, ball! A red ball.", "בה! כן, בובה! בובה גדולה."),
  }),
  P("cdc-15m-4", "joint_attention", 5, S.cdcMilestones, {
    do: L("During a walk or at home, point to one thing your child is already looking at and name it, then wait for their look back.", "בטיול או בבית, הצביעו על משהו שהילד/ה כבר מסתכל/ת עליו, אמרו את השם שלו וחכו למבט בחזרה."),
    say: L("Look, a dog! The dog is drinking. Where's the dog?", "תראה/י, כלב! הכלב שותה. איפה הכלב?"),
  }),
  P("cdc-18m-4", "responsive_interaction", 5, S.ashaActivities, {
    do: L("At snack or dressing time, hold up two choices and name each one. Hand over whichever they pick, naming it again.", "בזמן ארוחה קטנה או התלבשות, הרימו שתי אפשרויות ואמרו את השם של כל אחת. תנו את מה שבחר/ה ואמרו שוב את השם."),
    say: L("Banana or apple? Banana! Here's your banana.", "בננה או תפוח? בננה! הנה הבננה שלך."),
  }),
  P("cdc-18m-5", "responsive_interaction", 5, S.aapBrightFutures, {
    do: L("Make tidying a small game: ask for one thing at a time, without pointing, and say thank you when it arrives.", "הפכו סידור למשחק קטן: בקשו דבר אחד בכל פעם, בלי להצביע, ואמרו תודה כשהוא מגיע."),
    say: L("Can you give me the sock? Thank you! You brought the sock.", "תביא/י לי את הגרב? תודה! הבאת את הגרב."),
  }),

  /* ── batch 2/7 · Words · 24–60 months ────────────────────────────────── */
  P("cdc-24m-3", "responsive_interaction", 5, S.ashaActivities, {
    do: L("When your child says one word, say it back with one more word added. Keep it light, a reply, not a correction.", "כשהילד/ה אומר/ת מילה אחת, החזירו אותה עם עוד מילה אחת. בקלילות, כמו תשובה ולא כמו תיקון."),
    say: L("Milk? More milk! You want more milk.", "חלב? עוד חלב! את/ה רוצה עוד חלב."),
  }),
  P("cdc-24m-4", "dialogic_reading", 10, S.aapLiteracy, {
    do: L("Read a picture book side by side. Instead of reading every word, ask 'where is…?' about one picture and wait for a point.", "קראו ספר תמונות זה לצד זה. במקום לקרוא כל מילה, שאלו 'איפה ה...?' על תמונה אחת וחכו להצבעה."),
    say: L("Where's the bear? There he is! A big brown bear.", "איפה הדובי? הנה הוא! דובי חום וגדול."),
    materials: L("A picture book from home", "ספר תמונות מהבית"),
  }),
  P("cdc-24m-5", "joint_attention", 5, S.cdcMilestones, {
    do: L("At bath or dressing time, touch and name one body part at a time, then ask where it is on them.", "באמבטיה או בהתלבשות, געו בחלק אחד של הגוף ואמרו את השם שלו, ואז שאלו איפה הוא אצל הילד/ה."),
    say: L("Here's my nose. Where's your nose? There it is!", "הנה האף שלי. איפה האף שלך? הנה הוא!"),
  }),
  P("asha-comm-24m", "responsive_interaction", 5, S.ashaActivities, {
    do: L("When you don't catch a word, repeat the part you understood and ask about it, so your child can show or say it again.", "כשלא הבנתם מילה, חזרו על החלק שכן הבנתם ושאלו עליו, כדי שהילד/ה יוכל/תוכל להראות או להגיד שוב."),
    say: L("You saw a big... what? Show me!", "ראית משהו גדול... מה? תראה/י לי!"),
  }),
  P("cdc-30m-3", "responsive_interaction", 10, S.ashaActivities, {
    do: L("While you cook or tidy, describe what you are doing in short, simple sentences, and name the things your child picks up.", "בזמן בישול או סידור, ספרו בקול מה אתם עושים במשפטים קצרים, ותנו שם לדברים שהילד/ה מרים/ה."),
    say: L("I'm cutting the cucumber. Crunch! You have the spoon.", "חותכים מלפפון. קראנץ'! ובידיים שלך כף."),
  }),
  P("cdc-30m-4", "child_directed_play", 10, S.aapPowerOfPlay, {
    do: L("Play with toy animals or cars on the floor and narrate what they do with action words, following whatever your child moves.", "שחקו על הרצפה עם חיות או מכוניות, ותארו במילות פעולה מה הן עושות, לפי מה שהילד/ה מזיז/ה."),
    say: L("The doggie runs! Now he jumps. Up, up, up!", "הכלבלב רץ! עכשיו הוא קופץ. למעלה, למעלה!"),
    materials: L("A few toy animals or cars", "כמה חיות צעצוע או מכוניות"),
  }),
  P("cdc-30m-5", "dialogic_reading", 10, S.aapLiteracy, {
    do: L("Look at a picture book together. Point to a picture, ask 'what's that?', and add a little more to whatever they say.", "הסתכלו יחד בספר תמונות. הצביעו על תמונה, שאלו 'מה זה?' והוסיפו עוד קצת למה שהילד/ה אומר/ת."),
    say: L("What's that? A truck! A big red truck.", "מה זה? משאית! משאית אדומה וגדולה."),
    materials: L("A picture book from home", "ספר תמונות מהבית"),
  }),
  P("cdc-36m-3", "responsive_interaction", 5, S.ashaActivities, {
    do: L("When your child tells you something, get down to their eye level, listen to the end, and repeat the key words back clearly.", "כשהילד/ה מספר/ת לכם משהו, רדו לגובה העיניים, הקשיבו עד הסוף והחזירו את המילים החשובות בבירור."),
    say: L("You went down the big slide? Wow, the big slide!", "ירדת במגלשה הגדולה? וואו, המגלשה הגדולה!"),
  }),
  P("cdc-36m-4", "serve_and_return", 5, S.harvardServeReturn, {
    do: L("When the questions come, answer briefly and honestly, then hand a question back so they can share their own idea.", "כשמגיעות השאלות, ענו בקצרה ובכנות, ואז החזירו שאלה כדי לשמוע מה הוא/היא חושב/ת."),
    say: L("Why is it raining? Clouds are full of water. What do you think?", "למה יורד גשם? העננים מלאים במים. ומה את/ה חושב/ת?"),
  }),
  P("cdc-36m-5", "child_directed_play", 5, S.cdcMilestones, {
    do: L("Sing a simple hello song that uses your child's name and the names of others in the room, leaving a gap for them to fill.", "שירו שיר שלום פשוט עם השם של הילד/ה ושל אחרים בחדר, ועצרו רגע כדי שימלא/תמלא את החסר."),
    say: L("Hello, Mommy! Hello, Grandpa! And hello to... who are you?", "שלום לאמא! שלום לסבא! ושלום ל... מי את/ה?"),
  }),
  P("cdc-36m-6", "serve_and_return", 10, S.harvardServeReturn, {
    do: L("At a calm moment, like the car or bath, start a chat about something they care about and keep it going with short replies.", "ברגע רגוע, כמו בנסיעה או באמבטיה, פתחו שיחה על משהו שמעניין את הילד/ה והמשיכו אותה בתשובות קצרות."),
    say: L("Tell me about the cat you saw. What was it doing?", "ספר/י לי על החתול שראית. מה הוא עשה?"),
  }),
  P("asha-comm-36m", "responsive_interaction", 5, S.ashaActivities, {
    do: L("When a word comes out differently, don't correct it. Say the word back the usual way inside your reply, then carry on.", "כשמילה יוצאת אחרת, אל תתקנו. אמרו אותה בצורה הרגילה בתוך התשובה שלכם, והמשיכו הלאה."),
    say: L("A tat? Yes, a cat! The cat is sleeping.", "תתול? כן, חתול! החתול ישן."),
  }),
  P("cdc-48m-6", "serve_and_return", 10, S.harvardServeReturn, {
    do: L("At a meal, ask one open question that has no right answer, then listen and build on what they say.", "בארוחה, שאלו שאלה פתוחה אחת בלי תשובה נכונה, הקשיבו, והמשיכו ממה שהילד/ה אומר/ת."),
    say: L("If you could be any animal, which one would you be?", "אם היית יכול/ה להיות כל חיה, איזו חיה היית?"),
  }),
  P("cdc-48m-7", "routine_building", 5, S.whoUnicefCcd, {
    do: L("Sing the same favourite song or rhyme at a daily moment, like the bath, and pause before a familiar word so they can join in.", "שירו את אותו שיר אהוב ברגע קבוע ביום, כמו באמבטיה, ועצרו לפני מילה מוכרת כדי שיוכל/תוכל להצטרף."),
    say: L("Our bath song! I'll start... and you sing the next word!", "השיר של האמבטיה! אני מתחיל/ה... ואת/ה ממשיך/ה!"),
  }),
  P("cdc-48m-8", "serve_and_return", 5, S.harvardServeReturn, {
    do: L("At bedtime or pickup, share one small thing from your own day first, then ask about one specific part of theirs.", "בזמן השכבה או באיסוף מהגן, ספרו קודם דבר קטן אחד מהיום שלכם, ואז שאלו על רגע מסוים מהיום שלו/ה."),
    say: L("I saw a funny dog today. Who did you play with outside?", "היום ראיתי כלב מצחיק. עם מי שיחקת בחצר?"),
  }),
  P("cdc-48m-9", "serve_and_return", 5, S.cdcMilestones, {
    do: L("Play a 'what is it for?' game with everyday things around the house, and give your own silly answers too.", "שחקו במשחק 'בשביל מה זה?' עם חפצים בבית, ותנו גם אתם תשובות מצחיקות."),
    say: L("What is a spoon for? For eating soup! Or... for a hat?", "בשביל מה יש כף? לאכול מרק! או... לשים על הראש?"),
  }),
  P("asha-comm-48m", "child_directed_play", 5, S.ashaActivities, {
    do: L("Play with sounds for fun: stretch out a sound, like 'sssnake', and invite your child to find other words that start the same way.", "שחקו בצלילים בשביל הכיף: מתחו צליל, כמו 'סססוס', והזמינו את הילד/ה למצוא עוד מילים שמתחילות באותו צליל."),
    say: L("Sssnake starts with sss. What else starts with sss?", "סססוס מתחיל בסס. מה עוד מתחיל בסס?"),
  }),
  P("cdc-60m-4", "dialogic_reading", 10, S.aapLiteracy, {
    do: L("Take turns telling a story about a family photo or a picture book page: you say one part, they add the next.", "ספרו סיפור בתורות על תמונה משפחתית או על עמוד בספר: אתם אומרים חלק אחד, והילד/ה מוסיף/ה את ההמשך."),
    say: L("Once upon a time, a little bear went out. And then what happened?", "פעם אחת, דובון קטן יצא לטייל. ואז מה קרה?"),
  }),
  P("cdc-60m-5", "dialogic_reading", 10, S.aapLiteracy, {
    do: L("After reading a book, ask one question about it with no wrong answer, like how a character felt or what might happen next.", "אחרי קריאת ספר, שאלו שאלה אחת עליו שאין לה תשובה לא נכונה, למשל מה הדמות הרגישה או מה היה קורה אחר כך."),
    say: L("How do you think the bunny felt when he got lost?", "איך לדעתך הרגיש הארנב כשהלך לאיבוד?"),
    materials: L("A picture book from home", "ספר תמונות מהבית"),
  }),
  P("cdc-60m-6", "serve_and_return", 10, S.harvardServeReturn, {
    do: L("Have a few minutes of talk with no phones nearby, on a topic they choose. Follow their lead and answer with interest.", "קחו כמה דקות של שיחה בלי טלפונים ליד, על נושא שהילד/ה בוחר/ת. לכו אחרי ההובלה שלו/ה וענו בעניין."),
    say: L("You choose what we talk about. I'm all ears.", "את/ה בוחר/ת על מה נדבר. אני כולי אוזן."),
  }),
  P("cdc-60m-7", "child_directed_play", 5, S.ashaActivities, {
    do: L("Play a silly rhyming game in the car or bath: say a word and enjoy whatever rhymes come back, real or made up.", "שחקו במשחק חרוזים מצחיק באוטו או באמבטיה: אמרו מילה ותיהנו מכל חרוז שחוזר, אמיתי או מומצא."),
    say: L("Cat, hat, bat... what else sounds like cat?", "גמל, חשמל, נמל... מה עוד מתחרז עם גמל?"),
  }),

  /* ── batch 3/7 · Feelings · 9–60 months, Play · 2–18 months ─────────── */
  P("cdc-9m-1", "responsive_interaction", 5, S.harvardServeReturn, {
    do: L("When your baby's face changes, mirror the expression gently and name the feeling as a guess, in a soft voice.", "כשהפנים של התינוק/ת משתנות, שקפו את ההבעה בעדינות ותנו לרגש שם כניחוש, בקול רך."),
    say: L("Oh, that face! Are you surprised? Was that a surprise?", "אוי, איזה פרצוף! הופתעת? זאת הייתה הפתעה?"),
  }),
  P("cdc-9m-2", "routine_building", 5, S.aapBrightFutures, {
    do: L("When you step out of the room, say a short, cheerful goodbye and come back soon. Avoid slipping away unseen.", "כשאתם יוצאים מהחדר, אמרו פרידה קצרה ועליזה וחזרו תוך זמן קצר. השתדלו לא להיעלם בלי להגיד."),
    say: L("I'm going to the kitchen. I'll be right back. Here I am!", "אני הולך/ת למטבח וחוזר/ת מיד. הנה אני!"),
  }),
  P("cdc-36m-1", "routine_building", 5, S.aapBrightFutures, {
    do: L("Keep drop-off short and the same each time: a hug, your goodbye phrase, and when you'll return in words they know.", "שמרו על פרידה קצרה וקבועה בגן: חיבוק, משפט הפרידה שלכם, ומתי תחזרו במילים שהילד/ה מכיר/ה."),
    say: L("Looks like goodbyes feel hard? I'll be back after nap.", "נראה שקשה להיפרד? אני חוזר/ת אחרי מנוחת הצהריים."),
  }),
  P("cdc-60m-1", "executive_function_game", 15, S.harvardExecutiveFunction, {
    do: L("Play a short board or card game as a family. Say whose turn it is out loud, and when someone loses, name it calmly.", "שחקו משחק קופסה או קלפים קצר עם המשפחה. אמרו בקול של מי התור, וכשמישהו מפסיד, תנו לזה שם ברוגע."),
    say: L("My turn, then your turn. Losing can feel annoying, right?", "תור שלי ואז תור שלך. להפסיד זה מעצבן, נכון?"),
    materials: L("Any simple card or board game at home", "משחק קלפים או קופסה פשוט שיש בבית"),
  }),
  P("cdc-2m-1", "responsive_interaction", 5, S.whoUnicefCcd, {
    do: L("When your baby fusses, pick them up, hold them close and talk or hum softly. Notice what settles them best.", "כשהתינוק/ת מתמרמר/ת, הרימו, החזיקו קרוב ודברו או זמזמו בשקט. שימו לב מה הכי מרגיע אותו/ה."),
    say: L("Shh, shh, I've got you. You're safe with me.", "שש, שש, אני כאן. הכול בסדר, אני איתך."),
  }),
  P("cdc-2m-2", "serve_and_return", 5, S.harvardServeReturn, {
    do: L("Spend a few minutes face to face, close enough to see each other well. Smile, talk softly, and smile back at every smile.", "בלו כמה דקות פנים מול פנים, קרוב מספיק כדי לראות טוב. חייכו, דברו בשקט וענו בחיוך על כל חיוך."),
    say: L("Hello, you! Is that a smile for me? I see you!", "שלום לך! זה חיוך בשבילי? אני רואה אותך!"),
  }),
  P("cdc-4m-1", "responsive_interaction", 5, S.harvardServeReturn, {
    do: L("When your baby smiles at you from across the room, come over and answer with your face and voice, even briefly.", "כשהתינוק/ת מחייך/ת אליכם מהצד השני של החדר, בואו וענו בפנים ובקול, גם לרגע קצר."),
    say: L("I saw that smile! You called me, and here I am.", "ראיתי את החיוך! קראת לי, והנה אני."),
  }),
  P("cdc-4m-2", "child_directed_play", 5, S.aapPowerOfPlay, {
    do: L("Try gentle silly things, like funny noises or soft tummy kisses, and repeat whatever brings a chuckle. Stop when they look away.", "נסו דברים מצחיקים ועדינים, כמו קולות משונים או נשיקות על הבטן, וחזרו על מה שמצחיק. עצרו כשהמבט פונה הצידה."),
    say: L("Boop! Where's your tummy? Boop! You think that's funny?", "בופ! איפה הבטן? בופ! זה מצחיק אותך?"),
  }),
  P("cdc-6m-1", "responsive_interaction", 5, S.aapBrightFutures, {
    do: L("When a new person comes close, hold your baby, greet the person warmly yourself, and let your baby watch from your arms.", "כשאדם חדש מתקרב, החזיקו את התינוק/ת, ברכו את האדם בחום בעצמכם, ותנו לתינוק/ת להסתכל מהידיים שלכם."),
    say: L("This is our neighbour. I know her. I'm holding you.", "זאת השכנה שלנו. אני מכיר/ה אותה. אני מחזיק/ה אותך."),
  }),
  P("cdc-6m-2", "child_directed_play", 5, S.aapPowerOfPlay, {
    do: L("Sit with your baby in front of a mirror. Wave, make faces, and point to their reflection, following what they look at.", "שבו עם התינוק/ת מול מראה. נפנפו, עשו פרצופים והצביעו על ההשתקפות, לפי מה שמושך את המבט שלו/ה."),
    say: L("Who's that? That's you! And here's me.", "מי זה? זה את/ה! והנה אני."),
    materials: L("A mirror at home", "מראה בבית"),
  }),
  P("cdc-9m-3", "child_directed_play", 5, S.whoUnicefCcd, {
    do: L("Play peek-a-boo with a cloth or your hands. Let your baby pull the cloth away, and wait for them to start the next round.", "שחקו קוקו עם בד או עם הידיים. תנו לתינוק/ת למשוך את הבד, וחכו שיתחיל/תתחיל את הסיבוב הבא."),
    say: L("Where did I go? Peek-a-boo! Here I am!", "איפה אני? קוקו! הנה אני!"),
    materials: L("A small cloth or scarf", "בד קטן או צעיף"),
  }),
  P("cdc-12m-1", "child_directed_play", 5, S.whoUnicefCcd, {
    do: L("Sit facing each other and play a clapping rhyme slowly. Pause before the clap and let your child's hands lead the rhythm.", "שבו זה מול זה ושחקו בשיר מחיאות כפיים לאט. עצרו לפני המחיאה ותנו לידיים של הילד/ה להוביל את הקצב."),
    say: L("Clap, clap, clap! Your turn. Clap, clap!", "כפיים, כפיים! תורך. עוד פעם כפיים!"),
  }),
  P("cdc-15m-1", "child_directed_play", 10, S.aapPowerOfPlay, {
    do: L("Go where other small children play, like a playground or a friend's home. Sit near your child and let them watch and join when ready.", "לכו למקום שבו ילדים קטנים משחקים, כמו גינה או בית של חברים. שבו ליד הילד/ה ותנו להסתכל ולהצטרף כשבא לו/ה."),
    say: L("Look, they're filling the bucket. Want to try too?", "תראה/י, הם ממלאים את הדלי. רוצה לנסות גם?"),
  }),
  P("cdc-15m-2", "joint_attention", 5, S.harvardServeReturn, {
    do: L("When your child holds something up to show you, stop what you are doing, look at it with them, and name it with interest.", "כשהילד/ה מרים/ה משהו כדי להראות לכם, עצרו את מה שאתם עושים, הסתכלו עליו יחד ותנו לו שם בעניין."),
    say: L("Oh, you're showing me your teddy! He's so soft.", "וואו, את/ה מראה לי את הדובי! הוא כל כך רך."),
  }),
  P("cdc-18m-1", "responsive_interaction", 10, S.aapBrightFutures, {
    do: L("At a safe park, stay in one visible spot while your child explores. When they look back, smile and wave so they know you're there.", "בגינה בטוחה, הישארו במקום אחד שרואים אתכם בזמן שהילד/ה חוקר/ת. כשהוא/היא מסתכל/ת אחורה, חייכו ונפנפו."),
    say: L("I'm right here on the bench. Go see!", "אני פה על הספסל. לך/לכי לראות!"),
  }),
  P("cdc-18m-2", "joint_attention", 5, S.harvardServeReturn, {
    do: L("When your child points, look where they point first, then name what you see together, and add one thing about it.", "כשהילד/ה מצביע/ה, הסתכלו קודם לאן שהוא/היא מצביע/ה, תנו שם למה שרואים, והוסיפו עליו עוד משהו."),
    say: L("You see the bird! A bird on the fence. It's singing.", "ראית ציפור! ציפור על הגדר. היא שרה."),
  }),
  P("cdc-18m-3", "routine_building", 5, S.cdcMilestones, {
    do: L("At dressing time, slow down and offer the sleeve or sock so your child can push in an arm or foot. Name each step.", "בזמן ההלבשה, האטו והגישו את השרוול או הגרב כך שהילד/ה יוכל/תוכל להכניס יד או רגל. תנו שם לכל שלב."),
    say: L("Arm in the sleeve... whoosh! Your arm came out!", "יד לשרוול... ושש! היד יצאה!"),
  }),

  /* ── batch 4/7 · Play · 24–60 months, Moving · 2–9 months ───────────── */
  P("cdc-24m-1", "responsive_interaction", 5, S.aapBrightFutures, {
    do: L("When someone nearby cries or laughs, notice it out loud together and wonder what happened, without asking your child to fix it.", "כשמישהו ליד בוכה או צוחק, שימו לב לזה בקול יחד ותהו מה קרה, בלי לבקש מהילד/ה לעשות משהו."),
    say: L("That boy is crying. Maybe he's sad? What happened, I wonder?", "הילד הזה בוכה. אולי הוא עצוב? מעניין מה קרה."),
  }),
  P("cdc-24m-2", "responsive_interaction", 5, S.harvardServeReturn, {
    do: L("In a new place or with a new thing, show a calm, interested face and voice first, then let your child take a closer look.", "במקום חדש או מול דבר חדש, הראו קודם פנים וקול רגועים וסקרנים, ואז תנו לילד/ה להתקרב ולהסתכל."),
    say: L("Hmm, a new dog. He looks friendly. Let's watch him first.", "הממ, כלב חדש. הוא נראה ידידותי. בוא/י נסתכל עליו קודם."),
  }),
  P("cdc-30m-1", "child_directed_play", 10, S.aapPowerOfPlay, {
    do: L("Set up two of the same simple toy so your child and another child can play side by side without waiting to share.", "הכינו שני צעצועים פשוטים זהים, כך שהילד/ה וחבר/ה יוכלו לשחק זה לצד זה בלי לחכות לתור."),
    say: L("You have a bucket, and your friend has a bucket too.", "לך יש דלי, וגם לחבר/ה שלך יש דלי."),
    materials: L("Two similar buckets or spoons", "שני דליים או שתי כפות דומות"),
  }),
  P("cdc-30m-2", "specific_praise", 5, S.cdcPositiveParenting, {
    do: L("When your child calls 'look at me!', stop and watch the whole thing, then describe exactly what you saw them do.", "כשהילד/ה קורא/ת 'תסתכלו עליי!', עצרו, צפו עד הסוף, ותארו בדיוק מה ראיתם."),
    say: L("I watched! You climbed all the way up and slid down.", "ראיתי! טיפסת עד למעלה וגלשת למטה."),
  }),
  P("cdc-36m-2", "child_directed_play", 10, S.aapPowerOfPlay, {
    do: L("At the playground, walk over with your child to children who are playing and describe their game, so joining feels easy.", "בגינה, גשו יחד עם הילד/ה לילדים שמשחקים ותארו את המשחק שלהם, כך שיהיה קל להצטרף."),
    say: L("They're building a sandcastle. Want to bring your shovel?", "הם בונים ארמון חול. רוצה להביא את האת שלך?"),
  }),
  P("cdc-48m-1", "child_directed_play", 15, S.aapPowerOfPlay, {
    do: L("Join your child's pretend game in the role they give you. Follow their story and ask what happens next rather than taking over.", "הצטרפו למשחק הדמיון בתפקיד שהילד/ה נותן/ת לכם. לכו אחרי הסיפור ושאלו מה קורה עכשיו, בלי לקחת פיקוד."),
    say: L("I'm the customer. What can I buy in your shop today?", "אני הלקוח/ה. מה אפשר לקנות היום בחנות שלך?"),
  }),
  P("cdc-48m-2", "child_directed_play", 15, S.aapPowerOfPlay, {
    do: L("Invite one friend over for a short, simple playdate, with a few toys out and a snack, and stay nearby without directing.", "הזמינו חבר/ה אחד/ת למפגש משחק קצר ופשוט, עם כמה צעצועים בחוץ וחטיף, והישארו בסביבה בלי לנהל."),
    say: L("Who would you like to play with this week?", "עם מי היית רוצה לשחק השבוע?"),
  }),
  P("cdc-48m-3", "specific_praise", 5, S.cdcPositiveParenting, {
    do: L("When your child is kind to someone who is upset, describe the kind act afterwards, quietly and specifically.", "כשהילד/ה מתנהג/ת בחום למישהו עצוב, תארו אחר כך את המעשה, בשקט ובמדויק."),
    say: L("You gave your friend your teddy when they were sad. That was kind.", "נתת לחבר/ה את הדובי כשהיה לו/ה עצוב. זה היה מעשה חם."),
  }),
  P("cdc-48m-4", "responsive_interaction", 5, S.aapBrightFutures, {
    do: L("At the playground, think out loud together about which heights feel safe, and let your child show you their own careful choice.", "בגינה, חשבו יחד בקול איזה גובה מרגיש בטוח, ותנו לילד/ה להראות לכם את הבחירה הזהירה שלו/ה."),
    say: L("That's really high. Where do you think is a safe place to jump?", "זה ממש גבוה. מאיפה בטוח לקפוץ, מה את/ה חושב/ת?"),
  }),
  P("cdc-48m-5", "routine_building", 5, S.cdcPositiveParenting, {
    do: L("Give your child one real job in a daily routine, like setting the spoons, and thank them for the specific help.", "תנו לילד/ה תפקיד אמיתי אחד בשגרה היומית, כמו לשים כפיות על השולחן, והודו על העזרה המסוימת."),
    say: L("You put a spoon by every plate. Thanks, helper!", "שמת כפית ליד כל צלחת. תודה על העזרה!"),
  }),
  P("cdc-60m-2", "routine_building", 10, S.cdcPositiveParenting, {
    do: L("Make one small chore part of the day, like matching socks from the laundry, and do it side by side while you chat.", "הפכו מטלה קטנה אחת לחלק מהיום, כמו להתאים גרביים מהכביסה, ועשו אותה יחד תוך כדי שיחה."),
    say: L("You find the stripy sock's partner, I'll find the blue one.", "את/ה מוצא/ת זוג לגרב המפוספס, ואני לכחול."),
    materials: L("Clean socks from the laundry", "גרביים נקיים מהכביסה"),
  }),
  P("cdc-60m-3", "child_directed_play", 10, S.aapPowerOfPlay, {
    do: L("Offer a little stage time: put on music, become the audience, and clap for the show your child creates.", "תנו במה קטנה: שימו מוזיקה, היו הקהל, ומחאו כפיים להופעה שהילד/ה יוצר/ת."),
    say: L("Ladies and gentlemen, the show begins! We're ready to watch.", "גבירותיי ורבותיי, ההופעה מתחילה! אנחנו מוכנים לצפות."),
  }),
  P("cdc-2m-7", "gross_motor_play", 5, S.whoMovement, {
    do: L("Place your baby on their tummy on your chest or a blanket while awake, and get down face to face to chat.", "כשהתינוק/ת ער/ה, השכיבו אותו/ה על הבטן על החזה שלכם או על שמיכה, ורדו לגובה הפנים כדי לדבר."),
    say: L("Hello down there! I can see your face.", "שלום לך שם למטה! אני רואה את הפנים שלך."),
  }),
  P("cdc-2m-8", "gross_motor_play", 5, S.whoMovement, {
    do: L("During a nappy change or after a bath, let your baby kick freely on a safe surface while you sing and gently touch each foot.", "בזמן החלפת חיתול או אחרי אמבטיה, תנו לתינוק/ת לבעוט בחופשיות על משטח בטוח, תוך כדי שירה ונגיעה עדינה בכל רגל."),
    say: L("Kick, kick, kick! Here's one foot, and here's the other.", "בעיטה, בעיטה! הנה רגל אחת, והנה השנייה."),
  }),
  P("cdc-4m-7", "gross_motor_play", 5, S.whoMovement, {
    do: L("Carry your baby upright against your shoulder for a short walk around the home, stopping to show them interesting things.", "שאו את התינוק/ת זקוף/ה על הכתף לסיבוב קצר בבית, ועצרו להראות דברים מעניינים."),
    say: L("Here's the window. Look at the tree outside!", "הנה החלון. תראה/י את העץ בחוץ!"),
  }),
  P("cdc-4m-8", "gross_motor_play", 5, S.whoMovement, {
    do: L("In tummy time, lie in front of your baby and hold a colourful object a little above eye level to look up at.", "בזמן שכיבה על הבטן, שכבו מול התינוק/ת והחזיקו חפץ צבעוני קצת מעל גובה העיניים."),
    say: L("Where's the red cup? Up here! You see it!", "איפה הכוס האדומה? פה למעלה! ראית אותה!"),
    materials: L("A colourful object, like a cup or spoon", "חפץ צבעוני, כמו כוס או כף"),
  }),
  P("cdc-6m-7", "gross_motor_play", 5, S.whoMovement, {
    do: L("On a blanket on the floor, place a toy just to one side so your baby can reach and roll toward it. Cheer the effort.", "על שמיכה על הרצפה, שימו צעצוע קצת בצד, כדי שהתינוק/ת יוכל/תוכל להושיט יד ולהתגלגל אליו. עודדו את הניסיון."),
    say: L("Ooh, you're reaching! Over you go!", "וואו, את/ה מושיט/ה יד! הופה, מתגלגלים!"),
  }),
  P("cdc-6m-8", "gross_motor_play", 5, S.whoMovement, {
    do: L("Sit on the floor with your baby supported between your legs, and place a toy just in front so they lean on their hands.", "שבו על הרצפה עם התינוק/ת בין הרגליים שלכם לתמיכה, ושימו צעצוע מקדימה כדי שיישען/תישען על הידיים כדי להסתכל."),
    say: L("I've got you. Look at the ball!", "אני מחזיק/ה אותך. תראה/י את הכדור!"),
  }),
  P("cdc-9m-8", "gross_motor_play", 10, S.whoMovement, {
    do: L("Give your baby plenty of free floor time on a safe mat, with a few toys spread around to reach for while sitting.", "תנו לתינוק/ת הרבה זמן חופשי על הרצפה, על מזרן בטוח, עם כמה צעצועים מסביב להושיט אליהם יד בישיבה."),
    say: L("You're sitting up! What will you grab first?", "את/ה יושב/ת! מה תיקח/י קודם?"),
  }),
  P("cdc-9m-9", "fine_motor_play", 5, S.whoUnicefCcd, {
    do: L("Hand your baby one safe object, then offer a second one to the same hand, and watch them work out the swap.", "תנו לתינוק/ת חפץ בטוח אחד, ואז הציעו חפץ שני לאותה יד, וצפו איך הוא/היא מסתדר/ת עם ההחלפה."),
    say: L("One spoon... and a lid! What will you do now?", "כף אחת... ומכסה! מה עושים עכשיו?"),
    materials: L("Two safe household objects, like a wooden spoon and a lid", "שני חפצים בטוחים מהבית, כמו כף עץ ומכסה"),
  }),

  /* ── batch 5/7 · Moving · 12–60 months, Hands · 30–60, School · 2–6 ─── */
  P("cdc-12m-7", "gross_motor_play", 5, S.whoMovement, {
    do: L("Clear a safe spot by a steady sofa and put a favourite toy on the seat, then stay close while your baby pulls up.", "פנו מקום בטוח ליד ספה יציבה ושימו צעצוע אהוב על המושב, והישארו קרוב בזמן שהתינוק/ת נעמד/ת."),
    say: L("Your bear is up here. Up, up, up!", "הדובי פה למעלה. הופה, למעלה!"),
  }),
  P("cdc-12m-8", "gross_motor_play", 10, S.whoMovement, {
    do: L("Line up steady furniture with small gaps and put a toy at the far end, so your child can travel along holding on.", "סדרו רהיטים יציבים בשורה עם רווחים קטנים ושימו צעצוע בקצה, כדי שהילד/ה יוכל/תוכל להתקדם בהחזקה."),
    say: L("Step, step, step! You're on your way to the ball.", "צעד, צעד, צעד! בדרך אל הכדור."),
  }),
  P("cdc-12m-9", "fine_motor_play", 5, S.whoUnicefCcd, {
    do: L("At mealtime, put a few soft, pea-sized pieces of food on the tray and let your child pick them up their own way.", "בארוחה, שימו על המגש כמה חתיכות אוכל רכות בגודל של אפונה, ותנו לילד/ה להרים אותן בדרך שלו/ה."),
    say: L("Little peas! You picked one up. Yum?", "אפונה קטנה! הרמת אחת. טעים?"),
  }),
  P("cdc-15m-7", "gross_motor_play", 5, S.whoMovement, {
    do: L("Kneel a short distance away with open arms and let your child walk or crawl to you, whichever they choose.", "כרעו במרחק קצר עם ידיים פתוחות ותנו לילד/ה ללכת או לזחול אליכם, מה שהוא/היא בוחר/ת."),
    say: L("Here I am! Come to me! You made it!", "אני כאן! בוא/י אליי! הגעת!"),
  }),
  P("cdc-18m-8", "gross_motor_play", 15, S.whoMovement, {
    do: L("Go for a slow walk outside at your child's speed, letting them stop to look and choose the way at safe spots.", "צאו להליכה איטית בחוץ, במהירות של הילד/ה, ותנו לעצור להסתכל ולבחור את הדרך במקומות בטוחים."),
    say: L("Which way, this way or that way? You lead!", "לאן הולכים, לפה או לשם? את/ה מוביל/ה!"),
  }),
  P("cdc-24m-9", "gross_motor_play", 10, S.whoMovement, {
    do: L("Roll a soft ball gently toward your child's feet outside or in a clear room, and kick it back when it comes to you.", "גלגלו כדור רך בעדינות לכיוון הרגליים של הילד/ה, בחוץ או בחדר פנוי, ובעטו אותו בחזרה כשהוא מגיע אליכם."),
    say: L("Here comes the ball! Boom! Back to me!", "הנה הכדור מגיע! בום! בחזרה אליי!"),
    materials: L("A soft ball", "כדור רך"),
  }),
  P("cdc-24m-10", "gross_motor_play", 10, S.whoMovement, {
    do: L("On safe stairs or a park climber, stay beside your child as they climb, offering a hand if they reach for it.", "במדרגות בטוחות או במתקן בגינה, עמדו ליד הילד/ה בזמן הטיפוס, והושיטו יד אם הוא/היא מבקש/ת."),
    say: L("Up you climb! I'm right next to you.", "מטפסים למעלה! אני ממש לידך."),
  }),
  P("cdc-30m-10", "gross_motor_play", 10, S.whoMovement, {
    do: L("Play a jumping game together, like hopping over a line of tape or jumping like frogs, jumping alongside your child.", "שחקו יחד במשחק קפיצות, כמו לקפוץ מעל פס על הרצפה או לקפוץ כמו צפרדעים, וקפצו גם אתם."),
    say: L("Frog jump! Ribbit! Let's jump like frogs!", "קפיצת צפרדע! קווה קווה! בוא/י נקפוץ כמו צפרדעים!"),
    materials: L("Masking tape or a rope on the floor", "נייר דבק או חבל על הרצפה"),
  }),
  P("cdc-36m-9", "fine_motor_play", 10, S.aapPowerOfPlay, {
    do: L("Thread large pasta tubes onto a shoelace together to make a necklace, letting your child choose each piece.", "השחילו יחד פסטה צינורות גדולה על שרוך נעל ליצירת שרשרת, ותנו לילד/ה לבחור כל חתיכה."),
    say: L("Which one is next? In it goes, through the hole!", "איזו חתיכה עכשיו? נכנסת דרך החור!"),
    materials: L("Large pasta tubes and a shoelace", "פסטה צינורות גדולה ושרוך נעל"),
  }),
  P("cdc-48m-13", "gross_motor_play", 10, S.whoMovement, {
    do: L("Toss a large soft ball gently from close by, with a ready signal first, and celebrate the try, caught or not.", "זרקו כדור גדול ורך בעדינות ממרחק קצר, אחרי סימן מוכן, ושמחו בניסיון, גם אם הכדור לא נתפס."),
    say: L("Ready? Hands out... here it comes! Good try!", "מוכן/ה? ידיים קדימה... הנה הוא בא! איזה ניסיון!"),
    materials: L("A large soft ball", "כדור גדול ורך"),
  }),
  P("cdc-60m-13", "gross_motor_play", 10, S.aapPowerOfPlay, {
    do: L("Make up a silly hopping game, like hopping across chalk squares or between cushions, and hop along too.", "המציאו משחק קפיצות מצחיק, כמו לקפוץ בין ריבועי גיר או בין כריות, וקפצו גם אתם."),
    say: L("Hop, hop, hop on one foot! Now it's my turn!", "הופ, הופ, הופ על רגל אחת! עכשיו תורי!"),
    materials: L("Chalk outside or cushions inside", "גיר בחוץ או כריות בבית"),
  }),
  P("cdc-30m-11", "fine_motor_play", 10, S.aapLiteracy, {
    do: L("Read a board book together and let your child turn every page, even if they skip pages or go back.", "קראו יחד ספר קרטון ותנו לילד/ה להפוך כל דף, גם אם הוא/היא מדלג/ת קדימה או חוזר/ת אחורה."),
    say: L("Your turn to turn the page. What's next?", "תורך להפוך את הדף. מה יש עכשיו?"),
    materials: L("A board book", "ספר קרטון"),
  }),
  P("cdc-48m-14", "fine_motor_play", 10, S.aapBrightFutures, {
    do: L("Put out an old shirt with big buttons for dress-up, and let your child work on opening them while you chat.", "הוציאו חולצה ישנה עם כפתורים גדולים למשחק תחפושות, ותנו לילד/ה לפתוח אותם בזמן שאתם מדברים."),
    say: L("The button goes through the hole... pop!", "הכפתור עובר דרך החור... פופ! נפתח."),
    materials: L("An old shirt with big buttons", "חולצה ישנה עם כפתורים גדולים"),
  }),
  P("cdc-60m-14", "fine_motor_play", 5, S.aapBrightFutures, {
    do: L("In the morning, leave a little extra time and let your child try one button on their coat, offering help only if asked.", "בבוקר, השאירו קצת זמן נוסף ותנו לילד/ה לנסות לכפתר כפתור אחד במעיל, ועזרו רק אם מבקשים."),
    say: L("Want to try the top button? I'm here if you want help.", "רוצה לנסות את הכפתור העליון? אני פה אם תרצה/י עזרה."),
  }),
  P("cdc-2m-5", "responsive_interaction", 5, S.whoUnicefCcd, {
    do: L("While your baby lies safely awake, move slowly across their view, talking as you go, and pause where they can see you.", "כשהתינוק/ת שוכב/ת ער/ה ובטוח/ה, זוזו לאט מול העיניים שלו/ה תוך כדי דיבור, ועצרו במקום שרואים אתכם."),
    say: L("I'm walking over here... and now I'm here!", "אני הולך/ת לפה... ועכשיו אני פה!"),
  }),
  P("cdc-2m-6", "joint_attention", 5, S.whoUnicefCcd, {
    do: L("Hold a bright object close to your baby's face, move it slowly from side to side, and talk about it.", "החזיקו חפץ צבעוני קרוב לפנים של התינוק/ת, הזיזו אותו לאט מצד לצד ודברו עליו."),
    say: L("Look at the red spoon. It's moving... there it goes!", "תראה/י את הכף האדומה. היא זזה... הנה היא הולכת!"),
    materials: L("A brightly coloured household object", "חפץ צבעוני מהבית"),
  }),
  P("cdc-4m-5", "child_directed_play", 5, S.aapPowerOfPlay, {
    do: L("When your baby is studying their hands, give them the time, then gently touch each hand and name it.", "כשהתינוק/ת מתבונן/ת בידיים, תנו לזה זמן, ואחר כך געו בעדינות בכל יד ותנו לה שם."),
    say: L("Those are your hands! One hand, two hands.", "אלה הידיים שלך! יד אחת, שתי ידיים."),
  }),
  P("cdc-4m-6", "fine_motor_play", 5, S.whoUnicefCcd, {
    do: L("Hold a light rattle or spoon within easy reach in front of your baby and let them swipe at it, without pulling it away.", "החזיקו רעשן קל או כף בהישג יד מול התינוק/ת, ותנו לו/ה לנסות לגעת, בלי להרחיק."),
    say: L("Here's the rattle! Shake, shake. You touched it!", "הנה הרעשן! שקשוק, שקשוק. נגעת בו!"),
    materials: L("A light rattle or a plastic spoon", "רעשן קל או כף פלסטיק"),
  }),
  P("cdc-6m-5", "child_directed_play", 5, S.aapBrightFutures, {
    do: L("Offer a few safe, clean objects of different textures, too big to swallow, and let your baby explore them with hands and mouth.", "הציעו כמה חפצים בטוחים ונקיים במרקמים שונים, גדולים מכדי להיבלע, ותנו לתינוק/ת לחקור אותם בידיים ובפה."),
    say: L("Soft cloth, hard spoon. How does that feel?", "מגבת רכה, כף קשה. איך זה מרגיש?"),
    materials: L("A clean washcloth, a wooden spoon, a large plastic lid", "מגבת פנים נקייה, כף עץ, מכסה פלסטיק גדול"),
  }),
  P("cdc-6m-6", "fine_motor_play", 5, S.whoUnicefCcd, {
    do: L("Place a favourite toy just within reach while your baby sits supported or lies on their tummy, and wait for the reach.", "שימו צעצוע אהוב בדיוק בהישג יד, כשהתינוק/ת יושב/ת עם תמיכה או שוכב/ת על הבטן, וחכו להושטת היד."),
    say: L("Your duck is right there. You got it!", "הברווז ממש פה. תפסת אותו!"),
  }),

  /* ── batch 6/7 · School & thinking · 9–30 months ────────────────────── */
  P("cdc-9m-6", "joint_attention", 5, S.whoUnicefCcd, {
    do: L("When your baby drops a spoon from the high chair, look down together, ask where it went, and show where it landed.", "כשהתינוק/ת מפיל/ה כף מהכיסא, הסתכלו יחד למטה, שאלו לאן היא נעלמה, והראו איפה היא נחתה."),
    say: L("Uh-oh! Where did the spoon go? Down there!", "אופס! לאן הכף הלכה? הנה היא, למטה!"),
  }),
  P("cdc-9m-7", "child_directed_play", 5, S.aapPowerOfPlay, {
    do: L("Give your baby two safe kitchen things, like a pot and a wooden spoon, and copy the rhythm they make.", "תנו לתינוק/ת שני כלי מטבח בטוחים, כמו סיר וכף עץ, וחקו את הקצב שהוא/היא יוצר/ת."),
    say: L("Bang, bang! You're a drummer! Bang, bang, bang!", "בום, בום! איזה מתופף/ת! בום, בום, בום!"),
    materials: L("A small pot and a wooden spoon", "סיר קטן וכף עץ"),
  }),
  P("cdc-12m-5", "child_directed_play", 10, S.aapPowerOfPlay, {
    do: L("Give your child a container and a few safe things to drop in and tip out, and take turns with them.", "תנו לילד/ה קופסה וכמה חפצים בטוחים להכניס ולשפוך, ושחקו בתורות."),
    say: L("In it goes! Clunk. And out it comes!", "נכנס פנימה! טראח. ויוצא החוצה!"),
    materials: L("A plastic box and a few large blocks or lids", "קופסת פלסטיק וכמה קוביות או מכסים גדולים"),
  }),
  P("cdc-12m-6", "executive_function_game", 5, S.harvardExecutiveFunction, {
    do: L("While your child watches, hide a toy under a cloth, then let them find it. Make the hiding easy to see at first.", "כשהילד/ה מסתכל/ת, החביאו צעצוע מתחת לבד ותנו לו/ה למצוא. בהתחלה החביאו כך שיהיה קל לראות."),
    say: L("Where did the duck go? Under the cloth! You found it!", "לאן הברווז נעלם? מתחת לבד! מצאת אותו!"),
    materials: L("A small cloth or towel", "בד קטן או מגבת"),
  }),
  P("cdc-15m-5", "child_directed_play", 10, S.aapPowerOfPlay, {
    do: L("Offer everyday things, like a cup, a hairbrush or a spoon, and show how you use them, then follow whatever your child tries.", "הציעו חפצים יומיומיים, כמו כוס, מברשת שיער או כף, הראו איך אתם משתמשים בהם, ולכו אחרי מה שהילד/ה מנסה."),
    say: L("You're brushing your hair! Now brush Teddy's hair?", "את/ה מסרק/ת את השיער! עכשיו גם לדובי?"),
    materials: L("A cup, a hairbrush, a spoon", "כוס, מברשת שיער, כף"),
  }),
  P("cdc-15m-6", "fine_motor_play", 10, S.aapPowerOfPlay, {
    do: L("Build a small tower together from blocks or small boxes, take turns adding one, and enjoy knocking it down.", "בנו יחד מגדל קטן מקוביות או מקופסאות קטנות, הוסיפו אחת בתורות, ותיהנו להפיל אותו."),
    say: L("One on top... and another! Crash! Build again?", "אחת למעלה... ועוד אחת! בום! בונים שוב?"),
    materials: L("Blocks or small boxes", "קוביות או קופסאות קטנות"),
  }),
  P("cdc-18m-6", "routine_building", 10, S.cdcPositiveParenting, {
    do: L("Let your child join a real chore with their own small tool, like a cloth for wiping, while you work side by side.", "תנו לילד/ה להצטרף למטלה אמיתית עם כלי קטן משלו/ה, כמו מטלית לניגוב, בזמן שאתם עובדים יחד."),
    say: L("You wipe this side, I'll wipe that side. Shiny table!", "את/ה מנגב/ת פה, ואני שם. איזה שולחן נוצץ!"),
    materials: L("A small cloth", "מטלית קטנה"),
  }),
  P("cdc-18m-7", "child_directed_play", 10, S.aapPowerOfPlay, {
    do: L("Sit on the floor and let your child choose a toy. Watch first, then copy what they do and describe it.", "שבו על הרצפה ותנו לילד/ה לבחור צעצוע. קודם צפו, אחר כך חקו את מה שהוא/היא עושה ותארו את זה."),
    say: L("Your car goes vroom! My car goes vroom too.", "המכונית שלך נוסעת ברררום! גם שלי ברררום."),
  }),
  P("cdc-24m-6", "fine_motor_play", 5, S.aapPowerOfPlay, {
    do: L("Give your child a container with a lid to open, with a small surprise inside, and let them work it out with both hands.", "תנו לילד/ה קופסה עם מכסה לפתוח, עם הפתעה קטנה בפנים, וחכו שיסתדר/תסתדר בשתי ידיים."),
    say: L("What's inside? Hold the box... and open!", "מה יש בפנים? מחזיקים את הקופסה... ופותחים!"),
    materials: L("A plastic tub with a lid and a small toy", "קופסת פלסטיק עם מכסה וצעצוע קטן"),
  }),
  P("cdc-24m-7", "child_directed_play", 5, S.aapPowerOfPlay, {
    do: L("Let your child press safe switches with you, like the light or the lift button, and talk about what happens.", "תנו לילד/ה ללחוץ איתכם על מתגים בטוחים, כמו האור או הכפתור במעלית, ודברו על מה שקורה."),
    say: L("You pressed it! The light is on. Now off!", "לחצת! האור דלק. ועכשיו כבה!"),
  }),
  P("cdc-24m-8", "child_directed_play", 10, S.aapPowerOfPlay, {
    do: L("Set out a plate, a spoon and a doll, and join your child's game as a guest, letting them decide what happens.", "הניחו צלחת, כף ובובה, והצטרפו למשחק כאורחים, ותנו לילד/ה להחליט מה קורה."),
    say: L("Is that dinner for Teddy? Can I have some too?", "זאת ארוחת ערב לדובי? אפשר גם לי קצת?"),
    materials: L("A plate, a spoon and a doll or teddy", "צלחת, כף ובובה או דובי"),
  }),
  P("cdc-30m-6", "child_directed_play", 10, S.aapPowerOfPlay, {
    do: L("When your child pretends, play along with the pretend object, like eating the 'cake' block, and ask about it.", "כשהילד/ה משחק/ת בכאילו, שחקו גם אתם עם החפץ המדומיין, כמו לאכול את ה'עוגה' מהקובייה, ושאלו עליו."),
    say: L("Mmm, cake! What flavour is it? Can I have more?", "ממ, עוגה! איזה טעם יש לה? אפשר עוד?"),
  }),
  P("cdc-30m-7", "executive_function_game", 5, S.harvardExecutiveFunction, {
    do: L("When your child gets stuck, like a toy out of reach, wait a moment before helping and ask what they could try.", "כשהילד/ה נתקע/ת, למשל צעצוע שלא מגיעים אליו, חכו רגע לפני שעוזרים ושאלו מה אפשר לנסות."),
    say: L("Hmm, it's up high. What could you use to reach it?", "הממ, זה גבוה. במה אפשר להשתמש כדי להגיע?"),
  }),
  P("cdc-30m-8", "executive_function_game", 5, S.harvardExecutiveFunction, {
    do: L("Turn a small task into a two-step silly mission, like 'touch the door, then jump', and swap so they give you one.", "הפכו משימה קטנה לשליחות מצחיקה בשני שלבים, כמו 'לגעת בדלת ואז לקפוץ', ואז החליפו תפקידים."),
    say: L("Touch your nose, then spin around! Now give me one!", "לגעת באף ואז להסתובב! עכשיו תורך לתת לי."),
  }),
  P("cdc-30m-9", "joint_attention", 5, S.cdcMilestones, {
    do: L("Name colours in passing during the day, like the red cup or the yellow bus, without quizzing your child.", "תנו שמות לצבעים במהלך היום, כמו הכוס האדומה או האוטובוס הצהוב, בלי לבחון את הילד/ה."),
    say: L("Look, a yellow bus! Yellow like your boots.", "תראה/י, אוטובוס צהוב! צהוב כמו המגפיים שלך."),
  }),

  /* ── batch 7/7 · School & thinking · 36–60 months, Body, food & growth ─ */
  P("cdc-36m-7", "fine_motor_play", 10, S.aapPowerOfPlay, {
    do: L("Draw side by side on big paper. Draw your own circles and lines, and describe what your child draws without correcting.", "ציירו זה לצד זה על דף גדול. ציירו עיגולים וקווים משלכם, ותארו את מה שהילד/ה מצייר/ת בלי לתקן."),
    say: L("You're making a round shape, round and round! Mine goes round too.", "את/ה מצייר/ת משהו עגול, סביב סביב! גם שלי עגול."),
    materials: L("Paper and crayons", "נייר וצבעים"),
  }),
  P("cdc-36m-8", "responsive_interaction", 5, S.aapBrightFutures, {
    do: L("While cooking, show your child the hot area from a safe distance, and say a short, steady safety phrase each time.", "בזמן בישול, הראו לילד/ה את האזור החם ממרחק בטוח, ואמרו כל פעם משפט בטיחות קצר וקבוע."),
    say: L("Hot! The stove is hot. We stay back here.", "חם! הכיריים חמות. אנחנו עומדים פה."),
  }),
  P("cdc-48m-10", "child_directed_play", 10, S.cdcMilestones, {
    do: L("Play 'I spy' with colours on a walk or in the car, taking turns choosing, and give easy hints.", "שחקו 'אני רואה משהו' עם צבעים בהליכה או באוטו, בחרו בתורות ותנו רמזים קלים."),
    say: L("I spy something green... it's on a tree!", "אני רואה משהו ירוק... הוא על העץ!"),
  }),
  P("cdc-48m-11", "routine_building", 5, S.cdcMilestones, {
    do: L("At breakfast, talk through the day in order using words like morning, afternoon and night, and let your child add parts.", "בארוחת הבוקר, עברו יחד על סדר היום עם מילים כמו בוקר, צהריים ולילה, ותנו לילד/ה להוסיף חלקים."),
    say: L("This morning, the park. Tonight, bath. What comes after the park?", "הבוקר גינה, בלילה אמבטיה. מה קורה אחרי הגינה?"),
  }),
  P("cdc-48m-12", "fine_motor_play", 15, S.aapPowerOfPlay, {
    do: L("Draw a family picture together, each drawing someone, and talk about the people while you draw.", "ציירו יחד ציור משפחתי, כל אחד מצייר מישהו אחר, ודברו על האנשים תוך כדי ציור."),
    say: L("Who are you drawing? Tell me about them.", "את מי את/ה מצייר/ת? ספר/י לי."),
    materials: L("Paper and crayons", "נייר וצבעים"),
  }),
  P("cdc-60m-8", "child_directed_play", 5, S.cdcMilestones, {
    do: L("Count real things together as part of the day, like stairs or apples, saying the numbers out loud with your child.", "ספרו יחד דברים אמיתיים במהלך היום, כמו מדרגות או תפוחים, ואמרו את המספרים בקול ביחד."),
    say: L("One, two, three stairs... let's count the rest together!", "אחת, שתיים, שלוש מדרגות... ממשיכים לספור ביחד!"),
  }),
  P("cdc-60m-9", "joint_attention", 5, S.cdcMilestones, {
    do: L("Point out numbers you see together, like on doors, buses or the lift, and wonder aloud what each one is for.", "הצביעו על מספרים שאתם רואים יחד, על דלתות, אוטובוסים או במעלית, ותהו בקול בשביל מה כל אחד."),
    say: L("Look, a number on our door! Which number is it?", "תראה/י, מספר על הדלת שלנו! איזה מספר זה?"),
  }),
  P("cdc-60m-10", "executive_function_game", 15, S.harvardExecutiveFunction, {
    do: L("Do one calm activity your child picks, like a puzzle, with screens away, and stay with it while it holds their interest.", "עשו יחד פעילות רגועה אחת שהילד/ה בוחר/ת, כמו פאזל, בלי מסכים, והישארו איתה כל עוד זה מעניין."),
    say: L("Let's find the corner pieces first. Which one fits here?", "בוא/י נמצא קודם את הפינות. איזה חלק מתאים פה?"),
  }),
  P("cdc-60m-11", "fine_motor_play", 10, S.aapLiteracy, {
    do: L("Write your child's name in big letters on a card for their door or drawings, and let them trace or copy any letters they want.", "כתבו את השם של הילד/ה באותיות גדולות על כרטיס לדלת או לציורים, ותנו לו/ה להעתיק או לעבור על אילו אותיות שירצה/תרצה."),
    say: L("This is your name. Which letter do you want to make?", "זה השם שלך. איזו אות בא לך לכתוב?"),
    materials: L("Paper or card and crayons", "נייר או כרטיס וצבעים"),
  }),
  P("asha-feed-9m", "responsive_interaction", 10, S.whoFeeding, {
    do: L("Offer a little of the family meal, mashed soft, and let your baby explore it. Follow their cues for when they are done.", "הציעו מעט מהארוחה המשפחתית, מעוכה ורכה, ותנו לתינוק/ת לחקור אותה. שימו לב לסימני השובע."),
    say: L("This is mashed carrot. Soft and orange. Want to touch it?", "זה גזר מעוך. רך וכתום. רוצה לגעת?"),
  }),
  P("asha-feed-12m", "responsive_interaction", 10, S.whoFeeding, {
    do: L("Sit and eat together, offering soft finger foods and a small open cup with a little water, and let your child lead.", "שבו לאכול יחד, הציעו אוכל רך שאפשר לאכול בידיים וכוס פתוחה קטנה עם קצת מים, ותנו לילד/ה להוביל."),
    say: L("Here's your cup. Sip, sip. Mmm, water!", "הנה הכוס שלך. לגימה קטנה. ממ, מים!"),
  }),
  P("cdc-15m-8", "responsive_interaction", 10, S.whoFeeding, {
    do: L("Put a few soft pieces of the family food on your child's plate and let them feed themselves, mess included, while you eat too.", "שימו כמה חתיכות רכות מהאוכל המשפחתי בצלחת של הילד/ה ותנו לו/ה לאכול לבד, כולל הלכלוך, בזמן שגם אתם אוכלים."),
    say: L("You picked up the pasta! I'm eating pasta too.", "הרמת פסטה! גם אני אוכל/ת פסטה."),
  }),
  P("cdc-18m-9", "responsive_interaction", 10, S.whoFeeding, {
    do: L("Offer water in a small open cup at meals and let spills happen, with a cloth nearby and a calm voice.", "הציעו מים בכוס פתוחה קטנה בארוחות, ותנו לשפיכות לקרות, עם מטלית קרובה וקול רגוע."),
    say: L("Oops, a little spill! That's okay. Here's the cloth.", "אופס, נשפך קצת! זה בסדר. הנה המטלית."),
    materials: L("A small open cup and a cloth", "כוס פתוחה קטנה ומטלית"),
  }),
  P("asha-feed-24m", "responsive_interaction", 10, S.aapBrightFutures, {
    do: L("Put a small taste of a new food next to a familiar one, eat it yourself happily, and let your child decide whether to try.", "שימו טעימה קטנה של מאכל חדש ליד מאכל מוכר, אכלו ממנו בעצמכם בהנאה, ותנו לילד/ה להחליט אם לטעום."),
    say: L("This is crunchy cucumber. I like the crunch. You can just look.", "זה מלפפון פריך. אני אוהב/ת את הקראנץ'. אפשר רק להסתכל."),
  }),
  P("cdc-60m-12", "routine_building", 15, S.aapBrightFutures, {
    do: L("Make a family meal a calm, shared time: real cutlery for everyone, food passed around, and your child serving themselves.", "הפכו ארוחה משפחתית לזמן רגוע ומשותף: סכו״ם אמיתי לכולם, מעבירים את האוכל, והילד/ה מגיש/ה לעצמו/ה."),
    say: L("Can you pass the salad? Thanks. Take what you'd like.", "תעביר/י לי את הסלט? תודה. קח/י מה שבא לך."),
  }),
];

/* ───────────────────────────── helpers ───────────────────────────── */

/** The practices for one catalogue row (one today; the type allows more). */
export function practicesForMilestone(milestoneId: string): Practice[] {
  return PRACTICES.filter((p) => p.milestoneId === milestoneId);
}

/**
 * The practice as a governed record for the fail-closed publication gate.
 * `concerns` stays empty: the parent-concern vocabulary (governance.ts) does
 * not describe a milestone practice, so even an approved practice stays
 * unpublishable until the framer maps one (REVIEW-SHEET residue).
 */
export function practiceAsGovernedRecord(p: Practice): GovernedContentRecord {
  return {
    id: p.id,
    version: "0.1",
    ageBands: [bandForAgeMonths(p.ageMonths).label],
    domains: [shelfDef(p.shelf).domain],
    concerns: [],
    locales: ["en", "he"],
    safetyClass: "general-parenting",
    reviewStatus: p.reviewStatus,
    reviewerRole: "Clinical reviewer (G-01)",
    reviewedBy: "",
    reviewedAt: "",
    reviewDueAt: "",
    evidenceRefs: [`${p.evidence.source.org}: ${p.evidence.source.title} (${p.evidence.source.year})`],
  };
}

/** Fail-closed: false for every draft (nothing renders publicly before G-01 signs). */
export const isPracticePublishable = (p: Practice, now = new Date()): boolean => isPublishableContent(practiceAsGovernedRecord(p), now);

/** Count table for reports: practices per shelf × milestone band (counts only). */
export function practiceCountTable(list: readonly Practice[] = PRACTICES): { shelf: ShelfId; band: string; bandMonths: number; count: number }[] {
  const cells = new Map<string, { shelf: ShelfId; band: string; bandMonths: number; count: number }>();
  for (const p of list) {
    const band = bandForAgeMonths(p.ageMonths);
    const key = `${p.shelf}|${band.months}`;
    const cell = cells.get(key) ?? { shelf: p.shelf, band: band.label, bandMonths: band.months, count: 0 };
    cell.count += 1;
    cells.set(key, cell);
  }
  return [...cells.values()].sort((a, b) => SHELF_IDS.indexOf(a.shelf) - SHELF_IDS.indexOf(b.shelf) || a.bandMonths - b.bandMonths);
}
