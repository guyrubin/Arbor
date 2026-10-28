/**
 * plan-dropoff — B-BOOK-76: crying at the kindergarten or school door (ages
 * 2–7; band 5–7 register, EN ≤ 40 / HE ≤ 34). Definition of record:
 * docs/everyday-plans/definition-plan-dropoff.md. The steps are the public
 * separation guidance (AAP HealthyChildren) and the graded-steps, parent-as-
 * coach approach of the public parent programme literature: a short goodbye
 * ritual that is the same every day, one object from home, and the door that
 * opens again at pick-up, said in child words. No condition is named.
 *
 * Refrains: body "the door opens again" / "הדלת נפתחת שוב"; plan "our
 * goodbye is short and the same" / "הפרידה שלנו קצרה ואותו דבר".
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
const atDoor = { x: 0.42, y: 0.9, scale: 0.44, facing: "right" as const, z: "fr" as const };

export const PLAN_DROPOFF: PatternDef = {
  id: "plan-dropoff",
  title: L("The door opens again", "הדלת נפתחת שוב"),
  coverLine: L("A story about the morning goodbye and the afternoon hello.", "סיפור על הפרידה בבוקר ועל השלום אחר הצהריים."),
  coverNameLine: L("{name}'s special plan", "התוכנית המיוחדת של {name}"),
  shelf: "feelings",
  ageBands: ["24m", "30m", "36m", "48m", "60m", "6-8y"],
  ageText: "2–7",
  parentWords: L("Cries at the kindergarten or school door", "בוכה בדלת של הגן או של בית הספר"),
  knowledge: "A morning goodbye that is short, the same every day and followed by a pick-up the child can picture teaches the body that the door opens again; lingering teaches the opposite.",
  frames: {
    cover: { id: "cover", text: same("A story about the morning goodbye and the afternoon hello.", "סיפור על הפרידה בבוקר ועל השלום אחר הצהריים."), pose: "hands-up", art: { plateId: "PD1", slot: standLeft, phoneCrop: 0.4 }, spread: true },
    bodyGood: {
      id: "p1",
      text: same(
        "My body is like a wonderful machine! It wakes up, it eats breakfast, and it puts on its shoes. Then it is ready for a whole day of playing and learning.",
        "הגוף שלי הוא כמו מכונה נהדרת! הוא מתעורר, אוכל ארוחת בוקר, ונועל נעליים. ואז הוא מוכן ליום שלם של משחק ולמידה.",
      ),
      pose: "stand-tall",
      art: { plateId: "PD2", slot: standRight, phoneCrop: 0.6 },
    },
    howItWorks: {
      id: "p2",
      text: same(
        "Every morning, my grown-up walks me to the door. Inside are my friends, my teacher, and my things. My grown-up goes to work, and later, in the afternoon, the door opens again.",
        "כל בוקר, המבוגר שלי מלווה אותי עד הדלת. בפנים יש החברים שלי, הגננת שלי, והדברים שלי. המבוגר שלי הולך לעבודה, ואחר כך, אחר הצהריים, הדלת נפתחת שוב.",
      ),
      pose: "hold-hand",
      art: { plateId: "PD1", slot: { x: 0.36, y: 0.9, scale: 0.44, facing: "right", z: "fr" }, phoneCrop: 0.4 },
    },
    sometimesHard: {
      id: "p3",
      text: mf(
        "Sometimes, at the door, my heart beats fast. My legs want to stay with my grown-up, and my eyes get wet. The goodbye feels very big. So I hold on, and I hold on.",
        "לפעמים, בדלת, הלב שלי דופק מהר. הרגליים שלי רוצות להישאר עם המבוגר שלי, והעיניים שלי נרטבות. הפרידה מרגישה ענקית. אז אני נאחז, ונאחז.",
        "לפעמים, בדלת, הלב שלי דופק מהר. הרגליים שלי רוצות להישאר עם המבוגר שלי, והעיניים שלי נרטבות. הפרידה מרגישה ענקית. אז אני נאחזת, ונאחזת.",
      ),
      pose: "hug-knees",
      art: { plateId: "PD3", slot: atDoor, phoneCrop: 0.45 },
    },
    wePlan: {
      id: "p4",
      text: same(
        "My family and I want the morning goodbye to feel small and safe. So now we have a new special plan. It has three steps, and we do them together.",
        "המשפחה שלי ואני רוצים שהפרידה בבוקר תרגיש קטנה ובטוחה. אז עכשיו יש לנו תוכנית מיוחדת וחדשה. יש בה שלושה שלבים, ואנחנו עושים אותם ביחד.",
      ),
      pose: "point-up",
      art: { plateId: "PD4", slot: standRight, phoneCrop: 0.6 },
    },
    win: {
      id: "p8",
      text: same(
        "Day after day, my body learns that the goodbye is short and the hello always comes. Our goodbye is short and the same, my thing from home is in my pocket, and the door opens again. That is my plan!",
        "יום אחרי יום, הגוף שלי לומד שהפרידה קצרה והשלום תמיד מגיע. הפרידה שלנו קצרה ואותו דבר, הדבר שלי מהבית בכיס, והדלת נפתחת שוב. זאת התוכנית שלי!",
      ),
      closing: same("{name}'s door opens again.", "הדלת של {name} נפתחת שוב."),
      pose: "hands-up",
      art: { plateId: "PD8", slot: { x: 0.5, y: 0.88, scale: 0.48, facing: "right", z: "fr" }, phoneCrop: 0.5 },
      spread: true,
    },
  },
  menu: [
    {
      id: "goodbye-ritual",
      slot: 1,
      text: same(
        "Step one: every {time}, at the door, we do our goodbye: a hug, a high five, and the same words. Our goodbye is short and the same, and then my grown-up goes.",
        "שלב ראשון: כל {time}, בדלת, אנחנו עושים את הפרידה שלנו: חיבוק, כיף, ואותן מילים. הפרידה שלנו קצרה ואותו דבר, ואז המבוגר שלי הולך.",
      ),
      parentLine: L("The same short goodbye every {time}: a hug, a high five, the same sentence; then leave, without coming back for one more.", "אותה פרידה קצרה כל {time}: חיבוק, כיף, אותו משפט; ואז ללכת, בלי לחזור לעוד אחד."),
      defaultTime: "morning",
      pose: "hold-hand",
      art: { plateId: "PD5", slot: atDoor, phoneCrop: 0.5 },
      sourceIds: ["aap-separation", "rapee-helping-anxious-child"],
    },
    {
      id: "kiss-in-the-hand",
      slot: 1,
      text: same(
        "Step one: every {time}, at the door, my grown-up puts a kiss in my hand and I close my fingers around it. The same kiss, the same words, and then my grown-up goes.",
        "שלב ראשון: כל {time}, בדלת, המבוגר שלי שם נשיקה בכף היד שלי ואני סוגר או סוגרת עליה את האצבעות. אותה נשיקה, אותן מילים, ואז המבוגר שלי הולך.",
      ),
      parentLine: L("A kiss pressed into the palm, the same sentence, then leave. The hand keeps the kiss all morning.", "נשיקה בכף היד, אותו משפט, ואז ללכת. היד שומרת את הנשיקה כל הבוקר."),
      defaultTime: "morning",
      pose: "hold-hand",
      art: { plateId: "PD5", slot: atDoor, phoneCrop: 0.5 },
      sourceIds: ["aap-separation"],
    },
    {
      id: "thing-from-home",
      slot: 2,
      text: same(
        "Step two: one small thing from home comes with me. A little stone, a photo card, or a ribbon, in my pocket. When I touch it, I remember that home is still there.",
        "שלב שני: דבר אחד קטן מהבית בא איתי. אבן קטנה, כרטיס עם תמונה, או סרט, בכיס שלי. כשאני נוגע או נוגעת בו, אני זוכר או זוכרת שהבית עדיין שם.",
      ),
      parentLine: L("One small object from home in the pocket (a stone, a photo card, a ribbon): a transitional object the child can touch during the day.", "חפץ אחד קטן מהבית בכיס (אבן, כרטיס עם תמונה, סרט): חפץ מעבר שהילד או הילדה יכולים לגעת בו במשך היום."),
      pose: "stand-tall",
      art: { plateId: "PD6", slot: { x: 0.34, y: 0.9, scale: 0.4, facing: "right", z: "fr" }, phoneCrop: 0.4 },
      sourceIds: ["aap-separation"],
    },
    {
      id: "door-opens-again",
      slot: 3,
      text: same(
        "Step three is the most important: my grown-up tells me when the door opens again, in my words: after snack, after the garden, after the story. Then I know, and I play until then.",
        "השלב השלישי הוא החשוב מכולם: המבוגר שלי אומר לי מתי הדלת נפתחת שוב, במילים שלי: אחרי האוכל, אחרי החצר, אחרי הסיפור. אז אני יודע או יודעת, ומשחק או משחקת עד אז.",
      ),
      parentLine: L("Say the pick-up time in the child's units (after snack, after the garden), the same every day, and be there then.", "אמרו את שעת האיסוף ביחידות של הילד (אחרי האוכל, אחרי החצר), אותו דבר כל יום, והיו שם בזמן."),
      pose: "sit-calm",
      art: { plateId: "PD7", slot: { x: 0.5, y: 0.9, scale: 0.42, facing: "right", z: "fr" }, phoneCrop: 0.5 },
      sourceIds: ["aap-separation", "rapee-helping-anxious-child"],
    },
  ],
  defaultSteps: ["goodbye-ritual", "thing-from-home", "door-opens-again"],
  boxItems: [
    { id: "little-stone", label: L("A little stone", "אבן קטנה"), glyph: "landscape" },
    { id: "photo-card", label: L("A photo card of my family", "כרטיס עם תמונה של המשפחה שלי"), glyph: "photo" },
    { id: "ribbon", label: L("A ribbon from home", "סרט מהבית"), glyph: "favorite" },
    { id: "pocket-note", label: L("A note from my grown-up", "פתק מהמבוגר שלי"), glyph: "note" },
  ],
  defaultDurationDays: 14,
  minutesRange: [3, 10],
  sources: [
    { id: "aap-separation", label: L("AAP HealthyChildren.org: soothing your child's separation anxiety — a brief, consistent goodbye ritual, a transitional object, honesty about the return.", "AAP HealthyChildren.org: הרגעת חרדת הפרידה של הילד — טקס פרידה קצר וקבוע, חפץ מעבר, כנות לגבי החזרה."), url: "https://www.healthychildren.org/English/ages-stages/toddler/Pages/Soothing-Your-Childs-Separation-Anxiety.aspx" },
    { id: "rapee-helping-anxious-child", label: L("Rapee, Wignall, Spence, Cobham & Lyneham, Helping Your Anxious Child (public parent book): graded steps, the parent as coach, a plan the child knows in advance.", "Rapee, Wignall, Spence, Cobham & Lyneham, Helping Your Anxious Child (ספר הורים ציבורי): צעדים מדורגים, ההורה כמאמן, תוכנית שהילד מכיר מראש.") },
  ],
  watchFor: [
    { id: "self-harm", text: L("Your child hurts themself when upset.", "הילד או הילדה פוגעים בעצמם כשהם במצוקה.") },
    { id: "not-living", text: L("Your child has talked about not wanting to live.", "הילד או הילדה דיברו על כך שלא רוצים לחיות.") },
    { id: "sudden-event", text: L("The crying at the door started suddenly after a frightening event.", "הבכי בדלת התחיל פתאום אחרי אירוע מפחיד.") },
    { id: "all-day", text: L("The distress lasts most of the day, every day, for weeks.", "המצוקה נמשכת רוב היום, כל יום, במשך שבועות.") },
    { id: "fear-of-place", text: L("Your child says something at the kindergarten frightens or hurts them.", "הילד או הילדה אומרים שמשהו בגן מפחיד או מכאיב להם.") },
  ],
  parent: {
    knows: L(
      "A child who cries at the door is not being clingy for its own sake: a long, uncertain goodbye keeps the body on alert, and a goodbye that is short, the same every day and followed by the pick-up the child was told about teaches the body that the door opens again. The plan is the goodbye, the object and the return, in that order. If your child says something at the kindergarten frightens or hurts them, that is a question for the staff and your doctor first.",
      "ילד או ילדה שבוכים בדלת לא נצמדים סתם: פרידה ארוכה ולא ברורה משאירה את הגוף דרוך, ופרידה קצרה, קבועה, ואחריה האיסוף שהבטיחו מלמדת את הגוף שהדלת נפתחת שוב. התוכנית היא הפרידה, החפץ והחזרה, בסדר הזה. אם הילד או הילדה אומרים שמשהו בגן מפחיד או מכאיב להם, זו שאלה לצוות ולרופא שלכם קודם.",
    ),
    whyNow: L(
      "Between two and seven, most children learn a new goodbye within two weeks when the ritual does not change and the return is kept. A short, predictable goodbye is a developmentally informed parent practice; lingering, sneaking out and coming back for one more hug all make the next morning harder.",
      "בין גיל שנתיים לשבע, רוב הילדים לומדים פרידה חדשה בתוך שבועיים כשהטקס לא משתנה והחזרה נשמרת. פרידה קצרה וצפויה היא תרגול הורי מבוסס התפתחות; להתעכב, לחמוק החוצה ולחזור לעוד חיבוק מקשים על הבוקר הבא.",
    ),
    tomorrow: L("Choose the goodbye words tonight and say them to your child before bed. Tomorrow at the door: the hug, the high five, the words, and go.", "בחרו הערב את מילות הפרידה ואמרו אותן לילד או לילדה לפני השינה. מחר בדלת: החיבוק, הכיף, המילים, וללכת."),
    askAfter: mf("What do we do at the door?", "מה אנחנו עושים בדלת?", "מה אנחנו עושים בדלת?"),
    together: L("Read it the evening before, and let your child do the high five on the page.", "קראו בערב שלפני, ותנו לילד או לילדה לעשות את הכיף על הדף."),
    sourceNote: L(
      "The steps follow the AAP HealthyChildren page on separation and the graded-steps, parent-as-coach approach of the public parent programme literature (Rapee et al.). The story form follows the social-story tradition. It is a developmentally informed parent practice; a child who is distressed most of the day, hurts themself or speaks of not wanting to live needs your doctor, not a plan.",
      "השלבים עוקבים אחרי עמוד AAP HealthyChildren על פרידה ואחרי גישת הצעדים המדורגים וההורה כמאמן מספרות תוכניות ההורים הציבורית (Rapee ואחרים). צורת הסיפור הולכת בעקבות מסורת הסיפור החברתי. זהו תרגול הורי מבוסס התפתחות; ילד שבמצוקה רוב היום, פוגע בעצמו או מדבר על כך שלא רוצה לחיות צריך את הרופא שלכם, לא תוכנית.",
    ),
    firstWeek: L("The first mornings are often louder: the tears may come faster once the goodbye is short. That is expected. Keep the ritual identical, leave after the words, and be at the door at the time you named. Count goodbyes, not tears.", "הבקרים הראשונים לרוב רועשים יותר: הדמעות עלולות לבוא מהר יותר כשהפרידה קצרה. זה צפוי. שמרו על טקס זהה, לכו אחרי המילים, והיו בדלת בשעה שאמרתם. ספרו פרידות, לא דמעות."),
  },
  bannedWords: { en: ["separation anxiety", "clingy", "attachment disorder", "school refusal"], he: ["חרדת פרידה", "נצמד", "נצמדת", "סרבנות"] },
  poses: ["hands-up", "stand-tall", "hold-hand", "hug-knees", "point-up", "sit-calm"],
  scepticsThree: [
    { en: "“A fixed goodbye can become a ritual the child cannot leave without, and a missed pick-up time breaks trust.” Answered in the panel: the ritual is short and the parent keeps the named time; the plan is the goodbye, the object and the return, never a bargain." },
    { en: "“Door distress can be a sign of something wrong at the setting, or of an anxiety disorder.” Answered in the red lines: fear of the place, all-day distress, self-harm and a sudden onset after an event route to the staff and the doctor and offer no plan; no disorder is named." },
    { en: "“A transitional object is for toddlers, not six-year-olds.” Answered in the menu: the object step is swappable and the pick-up step is the one the standard marks most important; the child's units carry the plan at any age." },
  ],
};
