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
