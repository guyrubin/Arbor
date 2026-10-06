/**
 * B-ASKJB-38 (b) — the TODDLER hard-moment set: 12–36 months ("1-2" in the
 * cards' inclusive-years notation = 12 ≤ months < 36). Ten cards in the
 * existing card shape (Do now · Say this at her level · Avoid · Notice ·
 * When to get help) with their sources in `evidenceRefs`.
 *
 * DRAFTS. Every card ships `reviewStatus: "draft"` with no reviewer stamp; it
 * reaches a parent only through the editorial pilot (content/pilotRelease.ts
 * HARD_MOMENT_PILOT — same expiry, same withdrawal lever) until the clinical
 * reviewer signs it. The review sheet is in the B-ASKJB-38 builder report.
 *
 * Sources are pages the product already cites (lib/citedSources); where no
 * page is specific to the moment, the card cites the general CDC page for the
 * age (flagged on the review sheet). Type-only import: no runtime cycle with
 * hardMomentCards.ts, which assembles the catalogue.
 */
import type { HardMomentCard, HardMomentCategory } from "./hardMomentCards";
import type { ContentConcern, LocalizedText } from "./governance";

const L = (en: string, he: string): LocalizedText => ({ en, he });

export const TODDLER_SOURCES = {
  discipline: "https://www.healthychildren.org/English/family-life/family-dynamics/communication-discipline/Pages/Disciplining-Your-Child.aspx",
  separation: "https://www.healthychildren.org/English/ages-stages/toddler/Pages/Soothing-Your-Childs-Separation-Anxiety.aspx",
  sleep: "https://www.healthychildren.org/English/healthy-living/sleep/Pages/Bedtime-Trouble.aspx",
  food: "https://www.cdc.gov/infant-toddler-nutrition/foods-and-drinks/picky-eaters.html",
  /** General CDC page for the age (no moment-specific page cited yet). */
  cdcTwoYears: "https://www.cdc.gov/act-early/milestones/2-years.html",
} as const;

/** Clinical pre-review R16 (6 Oct): the danger prefix carries the Israeli
 *  numbers (MDA 101, police 100) and is OPT-IN — on for the heightened-care
 *  cards, off for the everyday ones (never on homework or the morning rush). */
export const DANGER = L("If anyone is in immediate danger, call 101 (ambulance) or 100 (police). ", "בסכנה מיידית, התקשרו למד״א 101 או למשטרה 100. ");

function toddlerCard(
  id: string,
  category: HardMomentCategory,
  concerns: ContentConcern[],
  sources: string[],
  copy: { title: LocalizedText; doNow: LocalizedText; sayThis: LocalizedText; avoid: LocalizedText; observe: LocalizedText; escalation: LocalizedText },
  heightened = false,
  /** Pre-review R18: a card whose band starts later than 12 months names it
   *  in a notation fits() reads (lib/age/forChild rangeOfNotation). */
  ageBands: string[] = ["1-2"],
): HardMomentCard {
  return {
    id, category, ...copy,
    escalation: heightened ? L(DANGER.en + copy.escalation.en, DANGER.he + copy.escalation.he) : copy.escalation,
    version: "1.0.0", ageBands, domains: ["social-emotional"],
    concerns, moment: id,
    locales: ["en", "he"], safetyClass: heightened ? "heightened-care" : "general-parenting", reviewStatus: "draft",
    reviewerRole: "clinical-content-reviewer", reviewedBy: "", reviewedAt: "", reviewDueAt: "2027-10-06",
    evidenceRefs: sources,
  };
}

export const toddlerHardMomentCards: HardMomentCard[] = [
  toddlerCard("t-biting", "big-feelings", ["aggression"], [TODDLER_SOURCES.discipline, TODDLER_SOURCES.cdcTwoYears], {
    title: L("Biting", "נשיכות"),
    doNow: L("Calmly move the child away from the person who was bitten and comfort that person first. Keep your face and voice quiet.", "הרחיקו בשקט את הילד ממי שננשך ונחמו קודם את מי שנפגע. שמרו על פנים וקול רגועים."),
    sayThis: L("No biting. Biting hurts. You can bite this.", "לא נושכים. נשיכה כואבת. את זה אפשר לנשוך."),
    avoid: L("Biting back, a long lecture, or a big reaction that makes biting interesting.", "לנשוך בחזרה, הרצאה ארוכה, או תגובה גדולה שהופכת את הנשיכה למעניינת."),
    observe: L("Notice when it happens: tired, teething, crowded, or when words are not there yet.", "שימו לב מתי זה קורה: עייפות, בקיעת שיניים, צפיפות, או כשעוד אין מילים."),
    escalation: L("If a bite breaks the skin, clean it and ask your pediatrician. If biting keeps happening often or at daycare every day, talk it through with the daycare team and your pediatrician.", "אם נשיכה פצעה את העור, נקו אותה ופנו לרופא הילדים. אם הנשיכות חוזרות לעיתים קרובות או במעון בכל יום, שוחחו על כך עם צוות המעון ועם רופא הילדים."),
  }, true),
  toddlerCard("t-hitting", "big-feelings", ["aggression"], [TODDLER_SOURCES.discipline], {
    title: L("Hitting at two", "מכות בגיל שנתיים"),
    doNow: L("Gently hold the hand or move out of reach. Get down to eye level and keep your words few.", "החזיקו בעדינות את היד או התרחקו מטווח ההגעה. רדו לגובה העיניים ודברו במילים מעטות."),
    sayThis: L("Gentle hands. I won't let you hit. You're angry.", "ידיים עדינות. אני לא אתן להכות. יש כאן כעס גדול, ואני כאן."),
    avoid: L("Hitting back or smacking the hand — it teaches the same thing you are trying to stop.", "להכות בחזרה או לתת מכה על היד — זה מלמד בדיוק את מה שמנסים לעצור."),
    observe: L("Notice what came just before: a toy taken, a no, a long day.", "שימו לב מה קרה רגע לפני: צעצוע שנלקח, סירוב, יום ארוך."),
    escalation: L("If hitting leads to injuries, happens many times a day, or worries you, write down when it happens and share it with your pediatrician.", "אם המכות גורמות לפציעות, קורות פעמים רבות ביום או מדאיגות אתכם, רשמו מתי זה קורה ושתפו את רופא הילדים."),
  }, true),
  toddlerCard("t-throwing-food", "routines", ["food"], [TODDLER_SOURCES.food], {
    title: L("Throwing food", "זריקת אוכל"),
    doNow: L("Take it as a sign the meal is over. Calmly lift the plate away and let the child down.", "קחו את זה כסימן שהארוחה נגמרה. הרימו בשקט את הצלחת ותנו לילד לרדת."),
    sayThis: L("Food stays on the table. All done? All done.", "האוכל נשאר על השולחן. סיימנו? סיימנו."),
    avoid: L("Pressing for more bites, or a game of picking it up again and again.", "ללחוץ לעוד ביס, או משחק של להרים שוב ושוב."),
    observe: L("Notice whether throwing starts when the child is full, bored, or the meal is long.", "שימו לב אם הזריקה מתחילה כשהילד שבע, משועמם, או כשהארוחה ארוכה."),
    escalation: L("If eating seems to drop off for days, weight or energy worry you, or meals end in distress most days, bring a few days of notes to your pediatrician.", "אם האכילה פוחתת במשך ימים, המשקל או האנרגיה מדאיגים אתכם, או שרוב הארוחות מסתיימות במצוקה, הביאו רישום של כמה ימים לרופא הילדים."),
  }),
  toddlerCard("t-potty-refusal", "routines", ["routines"], [TODDLER_SOURCES.cdcTwoYears], {
    title: L("Nappy or potty refusal", "סירוב לחיתול או לסיר"),
    doNow: L("Let it go for now. Offer the potty at easy moments, without asking twice, and keep nappy changes quick and calm.", "הניחו לזה כרגע. הציעו את הסיר ברגעים קלים, בלי לבקש פעמיים, ושמרו על החלפות חיתול קצרות ורגועות."),
    sayThis: L("The potty is here when you want it. Now, the nappy.", "הסיר כאן כשתרצו. עכשיו — חיתול."),
    avoid: L("Rewards and pressure, punishment for accidents, or starting during a big change at home.", "פרסים ולחץ, עונש על פספוסים, או להתחיל בזמן שינוי גדול בבית."),
    observe: L("Notice signs of readiness: staying dry longer, telling you after a wee, interest in the toilet.", "שימו לב לסימני מוכנות: נשאר יבש יותר זמן, מספר אחרי פיפי, מתעניין בשירותים."),
    escalation: L("If there is pain when going, blood, hard stools that hurt, or a child who was dry starts wetting again, ask your pediatrician.", "אם יש כאב ביציאות, דם, צואה קשה שכואבת, או שילד שהיה יבש מתחיל להירטב שוב, פנו לרופא הילדים."),
  }),
  toddlerCard("t-bedtime-two", "routines", ["sleep", "routines"], [TODDLER_SOURCES.sleep], {
    title: L("Bedtime at two", "שעת שינה בגיל שנתיים"),
    doNow: L("Keep the same short routine every night — bath, pyjamas, one book, lights low — in the same order, at the same time.", "שמרו על אותה שגרה קצרה בכל ערב — אמבטיה, פיג׳מה, ספר אחד, אור עמום — באותו סדר ובאותה שעה."),
    sayThis: L("Bath, pyjamas, book, sleep. Now it's book time.", "אמבטיה, פיג׳מה, ספר, שינה. עכשיו זמן ספר."),
    avoid: L("Screens in the last hour, new games at bedtime, or a routine that grows longer each night.", "מסכים בשעה האחרונה, משחקים חדשים לפני השינה, או שגרה שמתארכת מערב לערב."),
    observe: L("Notice which step goes smoothly and which one starts the protest.", "שימו לב איזה שלב עובר בקלות ואיזה שלב מתחיל את המחאה."),
    escalation: L("If there is loud snoring with pauses in breathing, or night waking leaves the whole family exhausted for weeks, talk with your pediatrician.", "אם יש נחירות חזקות עם הפסקות בנשימה, או שהתעוררויות בלילה מתישות את כל המשפחה במשך שבועות, שוחחו עם רופא הילדים."),
  }),
  toddlerCard("t-no-phase", "limits", ["regulation"], [TODDLER_SOURCES.discipline], {
    title: L("The \"no\" phase", "שלב ה\"לא\""),
    doNow: L("Turn questions into two small choices that are both fine with you. Save your own no for what matters.", "הפכו שאלות לשתי בחירות קטנות ששתיהן מתאימות לכם. שמרו את ה\"לא\" שלכם לדברים החשובים."),
    sayThis: L("Red cup or blue cup? You choose.", "כוס אדומה או כוס כחולה? הבחירה שלך."),
    avoid: L("Asking \"do you want to…?\" when there is no real choice, or turning every no into a battle.", "לשאול \"רוצה ל…?\" כשאין באמת בחירה, או להפוך כל \"לא\" למאבק."),
    observe: L("Notice how often the no is about wanting to do it alone.", "שימו לב כמה פעמים ה\"לא\" הוא בעצם רצון לעשות לבד."),
    escalation: L("If daily life feels like one long struggle, or the no comes with very few words or little back-and-forth play, share what you see with your pediatrician.", "אם החיים היומיומיים מרגישים כמו מאבק אחד ארוך, או שה\"לא\" מגיע עם מעט מאוד מילים או מעט משחק הדדי, שתפו את רופא הילדים במה שאתם רואים."),
  }),
  toddlerCard("t-daycare-separation", "separation", ["separation", "transitions"], [TODDLER_SOURCES.separation], {
    title: L("Separation at daycare", "פרידה במעון"),
    doNow: L("Keep the goodbye short and the same every day. Hand over to one familiar adult, say goodbye, and go.", "שמרו על פרידה קצרה וזהה בכל יום. מסרו למבוגר מוכר אחד, אמרו להתראות, וצאו."),
    sayThis: L("Hug, kiss, bye-bye. See you after nap.", "חיבוק, נשיקה, ביי ביי. אחרי השינה נתראה."),
    avoid: L("Slipping out without a goodbye, or coming back in after the goodbye.", "להתגנב בלי להיפרד, או לחזור פנימה אחרי שנפרדתם."),
    observe: L("Ask the team how long the crying lasts after you leave and what helps.", "שאלו את הצוות כמה זמן נמשך הבכי אחרי שאתם יוצאים ומה עוזר."),
    escalation: L("If distress lasts most of the day for weeks, eating or sleep change sharply, or the team is worried, talk with them and your pediatrician.", "אם המצוקה נמשכת רוב היום במשך שבועות, האכילה או השינה משתנות מאוד, או שהצוות מודאג, שוחחו איתם ועם רופא הילדים."),
  }),
  toddlerCard("t-public-meltdown", "big-feelings", ["regulation"], [TODDLER_SOURCES.discipline], {
    title: L("Meltdown in public at two", "סערה במקום ציבורי בגיל שנתיים"),
    doNow: L("Keep the child safe, move to a quieter corner, and stay close. Say very little until the storm passes.", "שמרו על הילד בטוח, עברו לפינה שקטה יותר והישארו קרובים. אמרו מעט מאוד עד שהסערה עוברת."),
    sayThis: L("I'm here. Big feeling. We wait together.", "אני כאן. רגש גדול. מחכים יחד."),
    avoid: L("Giving in to stop the noise, threats, or explaining while the child is still crying.", "לוותר כדי להפסיק את הרעש, איומים, או הסברים בזמן שהילד עוד בוכה."),
    observe: L("Notice the pattern: hungry, tired, too long out, too many people.", "שימו לב לדפוס: רעב, עייפות, יציאה ארוכה מדי, יותר מדי אנשים."),
    escalation: L("If meltdowns often last longer than a short while, include head-banging or hurting themselves, or happen many times a day, talk with your pediatrician.", "אם הסערות נמשכות לעיתים קרובות זמן רב, כוללות דפיקת ראש או פגיעה עצמית, או קורות פעמים רבות ביום, שוחחו עם רופא הילדים."),
  }, true),
  toddlerCard("t-new-sibling", "relationships", ["transitions", "regulation"], [TODDLER_SOURCES.cdcTwoYears], {
    title: L("A new baby arrives", "תינוק חדש בבית"),
    doNow: L("Keep the toddler's own routines the same and give a short daily time that is only theirs. Never leave the toddler alone with the baby.", "שמרו על השגרה של הפעוט כמו שהייתה ותנו זמן קצר בכל יום שהוא רק שלו. אל תשאירו את הפעוט לבד עם התינוק."),
    sayThis: L("This is our time. Just the two of us.", "זה הזמן שלנו. רק שנינו."),
    avoid: L("Telling the toddler to be the big one, blaming the baby for every no, or leaving the two of them alone together.", "לבקש מהפעוט להיות \"הגדול\", להאשים את התינוק בכל \"לא\", או להשאיר את שניהם לבד יחד."),
    observe: L("Notice going back to old habits — bottle, nappy, being carried. It is common and usually passes.", "שימו לב לחזרה להרגלים ישנים — בקבוק, חיתול, לבקש ידיים. זה שכיח ובדרך כלל עובר."),
    escalation: L("If the toddler tries to hurt the baby, keep them apart unless an adult is right there, and talk with your pediatrician soon. If the change in sleep, eating or mood lasts for weeks, talk with your pediatrician.", "אם הפעוט מנסה לפגוע בתינוק, אל תשאירו אותם יחד בלי מבוגר לידם, ושוחחו בהקדם עם רופא הילדים. אם השינוי בשינה, באכילה או במצב הרוח נמשך שבועות, שוחחו עם רופא הילדים."),
  }, true),
  toddlerCard("t-screen-handover", "transitions", ["screens", "transitions"], [TODDLER_SOURCES.cdcTwoYears], {
    title: L("Handing back the phone", "להחזיר את הטלפון"),
    doNow: L("Say what comes next before you take the screen, then swap it for something to hold.", "אמרו מה בא אחר כך לפני שלוקחים את המסך, ואז החליפו אותו במשהו להחזיק."),
    sayThis: L("Phone bye-bye. Now, ball!", "טלפון ביי ביי. עכשיו — כדור!"),
    avoid: L("Grabbing it without warning, or handing it back to stop the crying.", "לחטוף בלי הודעה, או להחזיר כדי להפסיק את הבכי."),
    observe: L("Notice how long the screen time was, and which next thing makes the swap easier.", "שימו לב כמה זמן נמשך המסך, ואיזה דבר הבא מקל על ההחלפה."),
    escalation: L("If screens have become the only way to calm the child, or play and talking with people are shrinking, talk with your pediatrician.", "אם המסך הפך לדרך היחידה להרגיע את הילד, או שהמשחק והדיבור עם אנשים מצטמצמים, שוחחו עם רופא הילדים."),
  }, false, ["18-24m", "2-3y"]),
];
