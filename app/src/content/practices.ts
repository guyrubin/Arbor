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
