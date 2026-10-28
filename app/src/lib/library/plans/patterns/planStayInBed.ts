/**
 * plan-stay-in-bed — B-BOOK-76: getting up again and again, coming to the
 * parents' bed (ages 3–8; band 5–7 register, EN ≤ 40 / HE ≤ 34).
 * Definition of record: docs/everyday-plans/definition-plan-stay-in-bed.md.
 * The steps are the public bedtime guidance (AAP / NHS) and a published,
 * public technique: the "bedtime pass" (one allowed trip, then back), with
 * a calm walk-back and the morning check-in. No method that leaves a
 * distressed child without a response; never a brand.
 *
 * Refrains: body "my bed is my place at night" / "המיטה שלי היא המקום שלי
 * בלילה"; plan "one trip, then back" / "סיבוב אחד, ואז חזרה". Hooks: p3
 * and p4 end unresolved. Hebrew AI-written: NATIVE REVIEW OWED. Unsigned:
 * dark.
 */
import type { BookLine } from "../../types";
import type { PatternDef } from "../patterns";

const L = (en: string, he: string) => ({ en, he });
const same = (en: string, he: string): BookLine => ({ en, he: { m: he, f: he } });
const mf = (en: string, m: string, f: string): BookLine => ({ en, he: { m, f } });

const standLeft = { x: 0.3, y: 0.9, scale: 0.46, facing: "right" as const, z: "fr" as const };
const standRight = { x: 0.68, y: 0.9, scale: 0.46, facing: "left" as const, z: "fr" as const };
const inBed = { x: 0.5, y: 0.8, scale: 0.34, facing: "right" as const, z: "fr" as const };

export const PLAN_STAY_IN_BED: PatternDef = {
  id: "plan-stay-in-bed",
  title: L("One trip, then back", "סיבוב אחד, ואז חזרה"),
  coverLine: L("A story about my bed at night and the one trip.", "סיפור על המיטה שלי בלילה ועל הסיבוב האחד."),
  coverNameLine: L("{name}'s special plan", "התוכנית המיוחדת של {name}"),
  shelf: "sleep",
  ageBands: ["36m", "48m", "60m", "6-8y"],
  ageText: "3–8",
  parentWords: L("Gets up again and again, comes to our bed", "קם או קמה שוב ושוב, בא או באה למיטה שלנו"),
  knowledge: "A child who keeps getting up is testing where the night's edges are; one allowed trip the child controls, a calm walk-back every other time and a morning check-in make the edges clear and kind.",
  frames: {
    cover: { id: "cover", text: same("A story about my bed at night and the one trip.", "סיפור על המיטה שלי בלילה ועל הסיבוב האחד."), pose: "hug-knees", art: { plateId: "PB1", slot: inBed, phoneCrop: 0.5 }, spread: true },
    bodyGood: {
      id: "p1",
      text: same(
        "My body is like a wonderful machine! All day it runs, climbs and plays. At night it lies down in my bed, and my bed is my place at night.",
        "הגוף שלי הוא כמו מכונה נהדרת! כל היום הוא רץ, מטפס ומשחק. בלילה הוא שוכב במיטה שלי, והמיטה שלי היא המקום שלי בלילה.",
      ),
      pose: "stand-tall",
      art: { plateId: "PB2", slot: standRight, phoneCrop: 0.6 },
    },
    howItWorks: {
      id: "p2",
      text: mf(
        "When I lie still in the dark, my body gets heavy and warm. My thoughts go slow, like clouds. Then sleep comes, quietly, while I am not even looking.",
        "כשאני שוכב בשקט בחושך, הגוף שלי נעשה כבד וחם. המחשבות שלי נעשות איטיות, כמו עננים. ואז השינה מגיעה, בשקט, כשאני בכלל לא מסתכל.",
        "כשאני שוכבת בשקט בחושך, הגוף שלי נעשה כבד וחם. המחשבות שלי נעשות איטיות, כמו עננים. ואז השינה מגיעה, בשקט, כשאני בכלל לא מסתכלת.",
      ),
      pose: "lie-down",
      art: { plateId: "PB1", slot: inBed, phoneCrop: 0.5 },
    },
    sometimesHard: {
      id: "p3",
      text: mf(
        "Sometimes, after goodnight, my legs want to get up. I am thirsty, or I remember something, or I just want to see my grown-up. So I get up, and I get up again, and I get up again.",
        "לפעמים, אחרי לילה טוב, הרגליים שלי רוצות לקום. אני צמא, או שאני נזכר במשהו, או שאני סתם רוצה לראות את המבוגר שלי. אז אני קם, וקם שוב, וקם שוב.",
        "לפעמים, אחרי לילה טוב, הרגליים שלי רוצות לקום. אני צמאה, או שאני נזכרת במשהו, או שאני סתם רוצה לראות את המבוגר שלי. אז אני קמה, וקמה שוב, וקמה שוב.",
      ),
      pose: "stand-tall",
      art: { plateId: "PB3", slot: standLeft, phoneCrop: 0.4 },
    },
    wePlan: {
      id: "p4",
      text: same(
        "My family and I want my nights to feel clear and calm. So now we have a new special plan. It has three steps, and we do them together.",
        "המשפחה שלי ואני רוצים שהלילות שלי ירגישו ברורים ורגועים. אז עכשיו יש לנו תוכנית מיוחדת וחדשה. יש בה שלושה שלבים, ואנחנו עושים אותם ביחד.",
      ),
      pose: "point-up",
      art: { plateId: "PB4", slot: standRight, phoneCrop: 0.6 },
    },
    win: {
      id: "p8",
      text: same(
        "Night after night, my body learns to stay in my bed until the morning. My bed is my place at night. One trip, then back, and the morning always comes. That is my plan!",
        "לילה אחרי לילה, הגוף שלי לומד להישאר במיטה שלי עד הבוקר. המיטה שלי היא המקום שלי בלילה. סיבוב אחד, ואז חזרה, והבוקר תמיד מגיע. זאת התוכנית שלי!",
      ),
      closing: same("{name}'s bed is {name}'s place at night.", "המיטה של {name} היא המקום של {name} בלילה."),
      pose: "hands-up",
      art: { plateId: "PB8", slot: { x: 0.5, y: 0.88, scale: 0.48, facing: "right", z: "fr" }, phoneCrop: 0.5 },
      spread: true,
    },
  },
  menu: [
    {
      id: "my-place-at-night",
      slot: 1,
      text: mf(
        "Step one: every {time}, after our goodnight, I lie down in my bed, with my cuddly and my light. My bed is my place at night, and my grown-up is nearby.",
        "שלב ראשון: כל {time}, אחרי לילה טוב שלנו, אני שוכב במיטה שלי, עם הבובה שלי והאור שלי. המיטה שלי היא המקום שלי בלילה, והמבוגר שלי בסביבה.",
        "שלב ראשון: כל {time}, אחרי לילה טוב שלנו, אני שוכבת במיטה שלי, עם הבובה שלי והאור שלי. המיטה שלי היא המקום שלי בלילה, והמבוגר שלי בסביבה.",
      ),
      parentLine: L("The same goodnight every {time}, then the child's own bed with their cuddly and a low light; say where you will be.", "אותו לילה טוב כל {time}, ואז המיטה של הילד או הילדה עם הבובה ואור נמוך; אמרו איפה תהיו."),
      defaultTime: "bedtime",
      pose: "lie-down",
      art: { plateId: "PB5", slot: inBed, phoneCrop: 0.5 },
      sourceIds: ["aap-bedtime-routine", "nhs-sleep-young-children"],
    },
    {
      id: "one-trip-card",
      slot: 2,
      text: mf(
        "Step two: my one-trip card. If I need water or the toilet, I use my card for one trip. Then I go back to bed, and the card rests until tomorrow. One trip, then back.",
        "שלב שני: כרטיס הסיבוב שלי. אם אני רוצה מים או שירותים, אני משתמש בכרטיס לסיבוב אחד. ואז אני חוזר למיטה, והכרטיס נח עד מחר. סיבוב אחד, ואז חזרה.",
        "שלב שני: כרטיס הסיבוב שלי. אם אני רוצה מים או שירותים, אני משתמשת בכרטיס לסיבוב אחד. ואז אני חוזרת למיטה, והכרטיס נח עד מחר. סיבוב אחד, ואז חזרה.",
      ),
      parentLine: L("One card = one short allowed trip (water, toilet, a quick hug), handed over when used; the bedtime pass, a published public technique.", "כרטיס אחד = סיבוב קצר אחד מותר (מים, שירותים, חיבוק מהיר), שנמסר כשמשתמשים בו; 'כרטיס הלילה', טכניקה ציבורית שפורסמה."),
      pose: "hold-hand",
      art: { plateId: "PB6", slot: standLeft, phoneCrop: 0.4 },
      sourceIds: ["bedtime-pass-friman-1999", "aap-bedtime-routine"],
    },
    {
      id: "walk-back",
      slot: 2,
      text: mf(
        "Step two: if I get up again, my grown-up walks me back to bed, calm and quiet, with our goodnight words. The same walk, the same words, every time.",
        "שלב שני: אם אני קם שוב, המבוגר שלי מלווה אותי חזרה למיטה, ברוגע ובשקט, עם מילות הלילה טוב שלנו. אותה הליכה, אותן מילים, בכל פעם.",
        "שלב שני: אם אני קמה שוב, המבוגר שלי מלווה אותי חזרה למיטה, ברוגע ובשקט, עם מילות הלילה טוב שלנו. אותה הליכה, אותן מילים, בכל פעם.",
      ),
      parentLine: L("Every extra trip: walk the child back calmly, few words, the same goodnight sentence, no talk and no light; as many times as it takes.", "בכל סיבוב נוסף: ללוות את הילד או הילדה חזרה ברוגע, מעט מילים, אותו משפט לילה טוב, בלי שיחה ובלי אור; כמה פעמים שצריך."),
      pose: "hold-hand",
      art: { plateId: "PB6", slot: standLeft, phoneCrop: 0.4 },
      sourceIds: ["aap-bedtime-routine", "nhs-sleep-young-children"],
    },
    {
      id: "morning-check-in",
      slot: 3,
      text: mf(
        "Step three is the most important: in the morning, we talk about the night. Did my card rest, or did it go on a trip? Both are fine. We just try again tonight.",
        "השלב השלישי הוא החשוב מכולם: בבוקר, אנחנו מדברים על הלילה. הכרטיס שלי נח, או יצא לסיבוב? שניהם בסדר. אנחנו פשוט מנסים שוב הלילה.",
        "השלב השלישי הוא החשוב מכולם: בבוקר, אנחנו מדברים על הלילה. הכרטיס שלי נח, או יצא לסיבוב? שניהם בסדר. אנחנו פשוט מנסים שוב הלילה.",
      ),
      parentLine: L("A short morning check-in in plain words: was the card used, how did the night go; no praise, no blame, no reward.", "שיחת בוקר קצרה במילים פשוטות: האם השתמשו בכרטיס, איך עבר הלילה; בלי שבחים, בלי האשמה, בלי פרס."),
      pose: "stand-tall",
      art: { plateId: "PB7", slot: { x: 0.4, y: 0.9, scale: 0.4, facing: "right", z: "fr" }, phoneCrop: 0.45 },
      sourceIds: ["nhs-sleep-young-children", "bedtime-pass-friman-1999"],
    },
  ],
  defaultSteps: ["my-place-at-night", "one-trip-card", "morning-check-in"],
  boxItems: [
    { id: "trip-card", label: L("My one-trip card", "כרטיס הסיבוב שלי"), glyph: "style" },
    { id: "water-cup", label: L("A cup of water by the bed", "כוס מים ליד המיטה"), glyph: "water" },
    { id: "cuddly", label: L("My cuddly toy", "הבובה הרכה שלי"), glyph: "toys" },
    { id: "night-light", label: L("A small night light", "מנורת לילה קטנה"), glyph: "light_mode" },
  ],
  defaultDurationDays: 21,
  minutesRange: [3, 10],
  sources: [
    { id: "aap-bedtime-routine", label: L("AAP HealthyChildren.org: bedtime trouble — a consistent routine, calm returns to bed, the same words every time.", "AAP HealthyChildren.org: קשיי שינה — טקס קבוע, החזרות רגועות למיטה, אותן מילים בכל פעם."), url: "https://www.healthychildren.org/English/healthy-living/sleep/Pages/Bedtime-Trouble.aspx" },
    { id: "nhs-sleep-young-children", label: L("NHS: sleep tips for young children — a regular routine, a calm walk back, the morning after.", "NHS: טיפים לשינה לילדים צעירים — טקס קבוע, הליכה רגועה חזרה, הבוקר שאחרי."), url: "https://www.nhs.uk/conditions/baby/health/sleep-problems-in-young-children/" },
    { id: "bedtime-pass-friman-1999", label: L("Friman et al. (1999), Archives of Pediatrics & Adolescent Medicine: the bedtime pass — one allowed trip per night, a published public technique for children who keep getting up.", "Friman ואחרים (1999), Archives of Pediatrics & Adolescent Medicine: כרטיס הלילה — סיבוב אחד מותר ללילה, טכניקה ציבורית שפורסמה לילדים שקמים שוב ושוב.") },
  ],
  watchFor: [
    { id: "snoring", text: L("Your child snores loudly most nights.", "הילד או הילדה נוחרים בקול רוב הלילות.") },
    { id: "breathing-pauses", text: L("You have noticed pauses in your child's breathing during sleep.", "שמתם לב להפסקות בנשימה של הילד או הילדה בזמן השינה.") },
    { id: "daytime-sleep", text: L("Your child falls asleep during the day far more than children their age.", "הילד או הילדה נרדמים במשך היום הרבה יותר מילדים בגילם.") },
    { id: "sudden-fear", text: L("The getting up started suddenly after a frightening event, or with new fears.", "הקימות התחילו פתאום אחרי אירוע מפחיד, או עם פחדים חדשים.") },
    { id: "pain-at-night", text: L("Your child gets up because something hurts.", "הילד או הילדה קמים כי משהו כואב.") },
  ],
  parent: {
    knows: L(
      "A child who keeps getting up is looking for the night's edges. One allowed trip the child controls, a calm walk-back with the same words every other time, and a morning check-in make the edges clear without a fight. Every call is answered; nobody is left distressed. Snoring, breathing pauses, unusual daytime sleep, new fears or pain at night are your doctor's questions first.",
      "ילד או ילדה שקמים שוב ושוב מחפשים את הגבולות של הלילה. סיבוב אחד מותר שהילד שולט בו, הליכה רגועה חזרה עם אותן מילים בכל פעם אחרת, ושיחת בוקר הופכים את הגבולות לברורים בלי ריב. כל קריאה נענית; אף אחד לא נשאר במצוקה. נחירות, הפסקות נשימה, ישנוניות חריגה ביום, פחדים חדשים או כאב בלילה הם שאלות לרופא שלכם קודם.",
    ),
    whyNow: L(
      "Between three and eight, children can hold one clear night rule when it is the same every night and the adults stay calm. A trip the child controls plus a calm return is a developmentally informed parent practice that usually settles the nights within two to three weeks.",
      "בין גיל שלוש לשמונה ילדים יכולים לשמור על כלל לילה ברור אחד כשהוא זהה בכל לילה והמבוגרים נשארים רגועים. סיבוב שהילד שולט בו ועוד חזרה רגועה הם תרגול הורי מבוסס התפתחות שבדרך כלל מרגיע את הלילות בתוך שבועיים-שלושה.",
    ),
    tomorrow: L("Make the one-trip card together tomorrow, in daylight: a piece of card the child decorates. Put water by the bed. Tonight, hand over the card at goodnight.", "הכינו מחר ביחד את כרטיס הסיבוב, באור יום: פיסת קרטון שהילד או הילדה מקשטים. שימו מים ליד המיטה. הלילה, מסרו את הכרטיס בלילה טוב."),
    askAfter: mf("What is my card for?", "בשביל מה הכרטיס שלי?", "בשביל מה הכרטיס שלי?"),
    together: L("Read it after the bath, and let your child hold the card on the page.", "קראו אחרי האמבטיה, ותנו לילד או לילדה להחזיק את הכרטיס על הדף."),
    sourceNote: L(
      "The steps follow the AAP HealthyChildren and NHS pages on bedtime and the bedtime pass (Friman et al. 1999), a published public technique. The story form follows the social-story tradition. It is a developmentally informed parent practice; the medical questions belong to your doctor.",
      "השלבים עוקבים אחרי עמודי AAP HealthyChildren ו-NHS על זמן השינה ואחרי כרטיס הלילה (Friman ואחרים 1999), טכניקה ציבורית שפורסמה. צורת הסיפור הולכת בעקבות מסורת הסיפור החברתי. זהו תרגול הורי מבוסס התפתחות; השאלות הרפואיות שייכות לרופא שלכם.",
    ),
    firstWeek: L("The first nights usually have more trips, not fewer: the card goes early and the walk-backs are many. That is expected. Keep the words the same, keep the light off, and count nights, not trips.", "בלילות הראשונים בדרך כלל יש יותר סיבובים, לא פחות: הכרטיס יוצא מוקדם וההחזרות רבות. זה צפוי. שמרו על אותן מילים, שמרו על אור כבוי, וספרו לילות, לא סיבובים."),
  },
  bannedWords: { en: ["insomnia", "sleep training", "cry it out", "regression", "manipulation", "manipulative", "co-sleeping"], he: ["נדודי שינה", "אימון שינה", "לתת לבכות", "רגרסיה", "מניפולציה"] },
  poses: ["hug-knees", "stand-tall", "lie-down", "point-up", "hold-hand", "hands-up"],
  scepticsThree: [
    { en: "“A pass system is a token economy; the child learns to trade.” Answered in the text and the panel: the card is a permission the child holds, nothing is earned for not using it, and the morning check-in carries no reward." },
    { en: "“Repeated getting up can be pain, fear or sleep-disordered breathing.” Answered in the red lines: pain at night, new fears or a sudden onset, snoring, breathing pauses and daytime sleepiness route to the doctor and offer no plan." },
    { en: "“Walking a child back forty times is not realistic for an exhausted parent.” Answered in the menu: the walk-back is swappable for the card step, the first week is named as harder, and the parent's own sleep is the Today host's question (B-BOOK-78)." },
  ],
};
