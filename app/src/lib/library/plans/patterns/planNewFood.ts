/**
 * plan-new-food — B-BOOK-76: refusing new food, eating five things (ages
 * 2–8; band 5–7 register, EN ≤ 40 / HE ≤ 34). Definition of record:
 * docs/everyday-plans/definition-plan-new-food.md. The steps are the public
 * fussy-eating guidance (NHS), the division of responsibility (a public
 * method: the parent decides what and when, the child decides whether and
 * how much) and the repeated-exposure evidence: the new food sits on the
 * plate with no need to eat it, one tiny taste when I want to, the same food
 * comes back many times. No condition is named; no pressure, no bribe.
 *
 * Refrains: body "my tongue learns new tastes slowly" / "הלשון שלי לומדת
 * טעמים חדשים לאט"; plan "it sits on my plate, and I decide" / "זה יושב
 * בצלחת שלי, ואני מחליט/ה" (m/f). Hooks: p3 and p4 end unresolved. Hebrew
 * AI-written: NATIVE REVIEW OWED. Unsigned: dark.
 */
import type { BookLine } from "../../types";
import type { PatternDef } from "../patterns";

const L = (en: string, he: string) => ({ en, he });
const same = (en: string, he: string): BookLine => ({ en, he: { m: he, f: he } });
const mf = (en: string, m: string, f: string): BookLine => ({ en, he: { m, f } });

const standLeft = { x: 0.3, y: 0.9, scale: 0.46, facing: "right" as const, z: "fr" as const };
const standRight = { x: 0.68, y: 0.9, scale: 0.46, facing: "left" as const, z: "fr" as const };
const atTable = { x: 0.42, y: 0.88, scale: 0.4, facing: "right" as const, z: "fr" as const };

export const PLAN_NEW_FOOD: PatternDef = {
  id: "plan-new-food",
  title: L("The food on my plate", "האוכל שבצלחת שלי"),
  coverLine: L("A story about new food, my plate, and tiny tastes.", "סיפור על אוכל חדש, הצלחת שלי, וטעימות קטנטנות."),
  coverNameLine: L("{name}'s special plan", "התוכנית המיוחדת של {name}"),
  shelf: "food",
  ageBands: ["24m", "30m", "36m", "48m", "60m", "6-8y"],
  ageText: "2–8",
  parentWords: L("Refuses new food, eats the same five things", "מסרב או מסרבת לאוכל חדש, אוכל/ת רק את אותם חמישה דברים"),
  knowledge: "A child learns a new food by meeting it many times without pressure; the parent decides what is on the table and when, the child decides whether and how much, and the tongue does the rest.",
  frames: {
    cover: { id: "cover", text: same("A story about new food, my plate, and tiny tastes.", "סיפור על אוכל חדש, הצלחת שלי, וטעימות קטנטנות."), pose: "sit-at-table", art: { plateId: "PN1", slot: atTable, phoneCrop: 0.45 }, spread: true },
    bodyGood: {
      id: "p1",
      text: same(
        "My body is like a wonderful machine! It runs, it climbs, and it eats. Food goes in, and my body turns it into jumping, thinking and growing.",
        "הגוף שלי הוא כמו מכונה נהדרת! הוא רץ, מטפס, ואוכל. אוכל נכנס, והגוף שלי הופך אותו לקפיצות, למחשבות ולגדילה.",
      ),
      pose: "stand-tall",
      art: { plateId: "PN2", slot: standRight, phoneCrop: 0.6 },
    },
    howItWorks: {
      id: "p2",
      text: same(
        "My tongue has tiny taste spots. When a food is new, the spots say: what is this? They learn new tastes slowly, a little at a time. The more times a food visits, the more my tongue knows it.",
        "ללשון שלי יש ניצני טעם קטנטנים. כשאוכל חדש, הניצנים אומרים: מה זה? הם לומדים טעמים חדשים לאט, קצת בכל פעם. ככל שאוכל מבקר יותר פעמים, הלשון שלי מכירה אותו יותר.",
      ),
      pose: "open-mouth-wide",
      art: { plateId: "PN3", slot: atTable, phoneCrop: 0.5 },
    },
    sometimesHard: {
      id: "p3",
      text: mf(
        "Sometimes a new food comes to the table, and my tummy says no. It looks strange, it smells strange, and I want my same things. So I push the plate away, and I push it away again.",
        "לפעמים אוכל חדש מגיע לשולחן, והבטן שלי אומרת לא. הוא נראה מוזר, מריח מוזר, ואני רוצה את הדברים הרגילים שלי. אז אני דוחף את הצלחת, ודוחף אותה שוב.",
        "לפעמים אוכל חדש מגיע לשולחן, והבטן שלי אומרת לא. הוא נראה מוזר, מריח מוזר, ואני רוצה את הדברים הרגילים שלי. אז אני דוחפת את הצלחת, ודוחפת אותה שוב.",
      ),
      pose: "hold-tummy",
      art: { plateId: "PN4", slot: atTable, phoneCrop: 0.45 },
    },
    wePlan: {
      id: "p4",
      text: same(
        "My family and I want mealtimes to feel easy, with no pushing from anyone. So now we have a new special plan. It has three steps, and we do them together.",
        "המשפחה שלי ואני רוצים שהארוחות ירגישו קלות, בלי דחיפות מאף אחד. אז עכשיו יש לנו תוכנית מיוחדת וחדשה. יש בה שלושה שלבים, ואנחנו עושים אותם ביחד.",
      ),
      pose: "point-up",
      art: { plateId: "PN5", slot: standLeft, phoneCrop: 0.4 },
    },
    win: {
      id: "p8",
      text: mf(
        "Meal after meal, my tongue learns new tastes slowly. The new food sits on my plate, and I decide. Some days I look, some days I taste. My same things are always there too. That is my plan!",
        "ארוחה אחרי ארוחה, הלשון שלי לומדת טעמים חדשים לאט. האוכל החדש יושב בצלחת שלי, ואני מחליט. יש ימים שאני מסתכל, יש ימים שאני טועם. הדברים הרגילים שלי תמיד שם גם. זאת התוכנית שלי!",
        "ארוחה אחרי ארוחה, הלשון שלי לומדת טעמים חדשים לאט. האוכל החדש יושב בצלחת שלי, ואני מחליטה. יש ימים שאני מסתכלת, יש ימים שאני טועמת. הדברים הרגילים שלי תמיד שם גם. זאת התוכנית שלי!",
      ),
      closing: same("{name}'s tongue is learning.", "הלשון של {name} לומדת."),
      pose: "hands-up",
      art: { plateId: "PN8", slot: { x: 0.5, y: 0.88, scale: 0.48, facing: "right", z: "fr" }, phoneCrop: 0.5 },
      spread: true,
    },
  },
  menu: [
    {
      id: "sits-on-my-plate",
      slot: 1,
      text: same(
        "Step one: every {time}, one new food sits on my plate, next to my same things. It can just sit there. Nobody says eat it. It sits on my plate, and I decide.",
        "שלב ראשון: כל {time}, אוכל חדש אחד יושב בצלחת שלי, ליד הדברים הרגילים שלי. הוא יכול פשוט לשבת שם. אף אחד לא אומר לאכול אותו. הוא יושב בצלחת שלי, ואני מחליט או מחליטה.",
      ),
      parentLine: L("Every {time}, one new food on the plate beside a familiar food; no comment, no pressure, no praise. You decide what is served; your child decides whether and how much.", "כל {time}, אוכל חדש אחד בצלחת ליד אוכל מוכר; בלי הערות, בלי לחץ, בלי שבחים. אתם מחליטים מה מוגש; הילד או הילדה מחליטים אם וכמה."),
      defaultTime: "evening",
      pose: "sit-at-table",
      art: { plateId: "PN6", slot: atTable, phoneCrop: 0.45 },
      sourceIds: ["nhs-fussy-eating", "division-of-responsibility", "repeated-exposure"],
    },
    {
      id: "tiny-taste",
      slot: 2,
      text: mf(
        "Step two: a tiny taste, when I want to. A crumb on my finger, a lick, or a nibble as small as a pea. If I do not like it, I can put it back. My tongue is just looking.",
        "שלב שני: טעימה קטנטנה, כשאני רוצה. פירור על האצבע, ליקוק, או נגיסה קטנה כמו אפונה. אם אני לא אוהב את זה, אני יכול להחזיר. הלשון שלי רק מסתכלת.",
        "שלב שני: טעימה קטנטנה, כשאני רוצה. פירור על האצבע, ליקוק, או נגיסה קטנה כמו אפונה. אם אני לא אוהבת את זה, אני יכולה להחזיר. הלשון שלי רק מסתכלת.",
      ),
      parentLine: L("A tiny taste is the child's choice (a crumb, a lick, a pea-sized bite) and may be spat out politely; never bargained for.", "טעימה קטנטנה היא בחירה של הילד או הילדה (פירור, ליקוק, נגיסה בגודל אפונה) ומותר להוציא בנימוס; אף פעם לא סוחרים עליה."),
      pose: "open-mouth-wide",
      art: { plateId: "PN6", slot: atTable, phoneCrop: 0.45 },
      sourceIds: ["repeated-exposure", "nhs-fussy-eating"],
    },
    {
      id: "we-cook-it",
      slot: 2,
      text: mf(
        "Step two: I help with the new food before it comes to the table. I wash it, stir it, or put it on the plate. My hands know it first, and then my tongue can meet it.",
        "שלב שני: אני עוזר עם האוכל החדש לפני שהוא מגיע לשולחן. אני שוטף אותו, מערבב, או שם בצלחת. הידיים שלי מכירות אותו קודם, ואז הלשון שלי יכולה לפגוש אותו.",
        "שלב שני: אני עוזרת עם האוכל החדש לפני שהוא מגיע לשולחן. אני שוטפת אותו, מערבבת, או שמה בצלחת. הידיים שלי מכירות אותו קודם, ואז הלשון שלי יכולה לפגוש אותו.",
      ),
      parentLine: L("Let your child handle the new food before the meal (wash, stir, plate); touching and smelling count as meeting it.", "תנו לילד או לילדה לגעת באוכל החדש לפני הארוחה (לשטוף, לערבב, לסדר בצלחת); לגעת ולהריח נחשבים פגישה איתו."),
      pose: "stand-tall",
      art: { plateId: "PN7", slot: standLeft, phoneCrop: 0.4 },
      sourceIds: ["nhs-fussy-eating", "repeated-exposure"],
    },
    {
      id: "comes-back-many-times",
      slot: 3,
      text: same(
        "Step three is the most important: the same food comes back, many times. Today, tomorrow, next week. Each visit, my tongue knows it a little more. No rush. My tongue learns new tastes slowly.",
        "השלב השלישי הוא החשוב מכולם: אותו אוכל חוזר, הרבה פעמים. היום, מחר, בשבוע הבא. בכל ביקור, הלשון שלי מכירה אותו קצת יותר. בלי למהר. הלשון שלי לומדת טעמים חדשים לאט.",
      ),
      parentLine: L("Serve the same new food many times over weeks (often ten or more meetings before a child accepts it); count the meetings, not the bites.", "הגישו את אותו אוכל חדש הרבה פעמים במשך שבועות (לעיתים עשר פגישות או יותר לפני שהילד מקבל אותו); ספרו פגישות, לא ביסים."),
      pose: "sit-at-table",
      art: { plateId: "PN7", slot: atTable, phoneCrop: 0.5 },
      sourceIds: ["repeated-exposure", "division-of-responsibility"],
    },
  ],
  defaultSteps: ["sits-on-my-plate", "tiny-taste", "comes-back-many-times"],
  boxItems: [
    { id: "my-plate", label: L("My own plate with a spot for the new food", "הצלחת שלי עם מקום לאוכל החדש"), glyph: "restaurant" },
    { id: "taste-spoon", label: L("A tiny tasting spoon", "כפית טעימה קטנטנה"), glyph: "flatware" },
    { id: "putting-back-bowl", label: L("A little bowl for putting back", "קערית קטנה להחזרה"), glyph: "radio_button_unchecked" },
    { id: "helper-apron", label: L("My helper apron", "הסינר שלי לעזרה במטבח"), glyph: "checkroom" },
  ],
  defaultDurationDays: 28,
  minutesRange: [3, 10],
  sources: [
    { id: "nhs-fussy-eating", label: L("NHS: fussy eaters — offer new foods alongside familiar ones, no pressure, keep mealtimes calm, keep offering.", "NHS: אכלנים בררנים — להגיש אוכל חדש לצד מוכר, בלי לחץ, ארוחות רגועות, להמשיך להציע."), url: "https://www.nhs.uk/conditions/baby/weaning-and-feeding/fussy-eaters/" },
    { id: "division-of-responsibility", label: L("The division of responsibility in feeding (a public method): the parent decides what, when and where; the child decides whether and how much.", "חלוקת האחריות בהאכלה (שיטה ציבורית): ההורה מחליט מה, מתי ואיפה; הילד מחליט אם וכמה.") },
    { id: "repeated-exposure", label: L("The repeated-exposure evidence in early childhood: acceptance of a new food rises with the number of neutral, pressure-free meetings, often ten or more.", "בסיס הראיות על חשיפה חוזרת בגיל הרך: הקבלה של אוכל חדש עולה עם מספר הפגישות הניטרליות ללא לחץ, לעיתים עשר או יותר.") },
  ],
  watchFor: [
    { id: "weight-loss", text: L("Your child is losing weight or has dropped off their growth line.", "הילד או הילדה מאבדים משקל או ירדו מקו הגדילה שלהם.") },
    { id: "choking-gagging", text: L("Your child chokes or gags on textures, or has trouble swallowing.", "הילד או הילדה נחנקים או מקיאים ממרקמים, או מתקשים לבלוע.") },
    { id: "under-ten-and-dropping", text: L("Your child eats fewer than ten foods and the list is still shrinking.", "הילד או הילדה אוכלים פחות מעשרה מאכלים והרשימה עדיין מתקצרת.") },
    { id: "allergy-reaction", text: L("A food has caused a rash, swelling, vomiting or breathing trouble.", "אוכל גרם לפריחה, נפיחות, הקאות או קושי בנשימה.") },
    { id: "under-1", text: L("Your child is under one year old.", "הילד או הילדה מתחת לגיל שנה.") },
  ],
  parent: {
    knows: L(
      "A child who refuses new food is not being difficult: a new taste is a question the tongue answers slowly, and pressure makes the answer no. The plan is the division of responsibility (you decide what and when, your child decides whether and how much) plus repetition without comment. Weight loss, choking or gagging, a shrinking list under ten foods or an allergic reaction are your doctor's questions first.",
      "ילד או ילדה שמסרבים לאוכל חדש לא עושים קשיים: טעם חדש הוא שאלה שהלשון עונה עליה לאט, ולחץ הופך את התשובה ללא. התוכנית היא חלוקת האחריות (אתם מחליטים מה ומתי, הילד מחליט אם וכמה) ועוד חזרה בלי הערות. ירידה במשקל, חנק או הקאה ממרקמים, רשימה שמתקצרת מתחת לעשרה מאכלים או תגובה אלרגית הן שאלות לרופא שלכם קודם.",
    ),
    whyNow: L(
      "Between two and eight, the list of accepted foods grows through calm, repeated meetings, and it shrinks under pressure. Serving the new food beside the familiar one, again and again, with no comment, is a developmentally informed parent practice that most families can keep for the weeks it takes.",
      "בין גיל שנתיים לשמונה רשימת המאכלים המקובלים גדלה דרך פגישות רגועות וחוזרות, ומתקצרת תחת לחץ. להגיש את האוכל החדש ליד המוכר, שוב ושוב, בלי הערות, הוא תרגול הורי מבוסס התפתחות שרוב המשפחות יכולות לשמור עליו בשבועות שזה לוקח.",
    ),
    tomorrow: L("Pick one new food for the week tonight. Tomorrow, put a small piece on the plate next to a favourite, say nothing about it, and eat it yourself.", "בחרו הערב אוכל חדש אחד לשבוע. מחר, שימו חתיכה קטנה בצלחת ליד מאכל אהוב, אל תגידו עליו כלום, ותאכלו אותו בעצמכם."),
    askAfter: mf("Which food is visiting our table this week?", "איזה אוכל מבקר בשולחן שלנו השבוע?", "איזה אוכל מבקר בשולחן שלנו השבוע?"),
    together: L("Read it away from the table, and let your child choose the little bowl for putting back.", "קראו רחוק מהשולחן, ותנו לילד או לילדה לבחור את הקערית להחזרה."),
    sourceNote: L(
      "The steps follow the NHS page on fussy eaters, the division of responsibility in feeding (a public method) and the repeated-exposure evidence in early childhood. The story form follows the social-story tradition. It is a developmentally informed parent practice; weight, swallowing and allergy questions belong to your doctor.",
      "השלבים עוקבים אחרי עמוד ה-NHS על אכלנים בררנים, חלוקת האחריות בהאכלה (שיטה ציבורית) ובסיס הראיות על חשיפה חוזרת בגיל הרך. צורת הסיפור הולכת בעקבות מסורת הסיפור החברתי. זהו תרגול הורי מבוסס התפתחות; שאלות על משקל, בליעה ואלרגיה שייכות לרופא שלכם.",
    ),
    firstWeek: L("The first week the new food usually just sits there, and that is the plan working. Serve it, say nothing, eat it yourself, and count the meetings, not the bites.", "בשבוע הראשון האוכל החדש בדרך כלל פשוט יושב שם, וזה התוכנית עובדת. הגישו אותו, אל תגידו כלום, תאכלו אותו בעצמכם, וספרו פגישות, לא ביסים."),
  },
  bannedWords: { en: ["picky", "fussy", "ARFID", "eating disorder", "feeding disorder", "underweight", "clean your plate"], he: ["בררן", "בררנית", "הפרעת אכילה", "תת משקל", "לגמור את הצלחת"] },
  poses: ["sit-at-table", "stand-tall", "open-mouth-wide", "hold-tummy", "point-up", "hands-up"],
  scepticsThree: [
    { en: "“Repeated exposure without any requirement can leave a child on five foods for years.” Answered in the red lines and the panel: fewer than ten foods and shrinking, or weight loss, route to the doctor; the plan is for the common pattern, not the medical one." },
    { en: "“Letting a child spit food out teaches bad manners.” Answered in the menu: the putting-back bowl is a polite, planned way to end a taste, and it is what makes the next taste possible." },
    { en: "“Involving the child in cooking is a bribe in disguise.” Answered in the text: handling the food is a meeting with it, not a trade; nothing is promised for eating." },
  ],
};
