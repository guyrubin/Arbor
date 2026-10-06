/**
 * B-ASKJB-38 (c) — the SCHOOL-AGE hard-moment set: 6–8 years ("6-8" in the
 * cards' inclusive-years notation = 72 ≤ months < 108). Ten cards in the
 * existing card shape (Do now · Say this · Avoid · Notice · When to get help)
 * with their sources in `evidenceRefs`.
 *
 * DRAFTS behind the editorial pilot (content/pilotRelease.ts), exactly like
 * the toddler set; the clinical reviewer signs each card before it leaves the
 * pilot. Where no page is specific to the moment, the card cites the general
 * AAP ages-and-stages page (flagged on the review sheet). Type-only import.
 */
import type { HardMomentCard, HardMomentCategory } from "./hardMomentCards";
import type { ContentConcern, LocalizedText } from "./governance";

const L = (en: string, he: string): LocalizedText => ({ en, he });

export const SCHOOL_SOURCES = {
  discipline: "https://www.healthychildren.org/English/family-life/family-dynamics/communication-discipline/Pages/Disciplining-Your-Child.aspx",
  sleep: "https://www.healthychildren.org/English/healthy-living/sleep/Pages/Bedtime-Trouble.aspx",
  /** General AAP ages-and-stages page (no moment-specific page cited yet). */
  aapAges: "https://www.healthychildren.org/English/ages-stages/Pages/default.aspx",
} as const;

const DANGER = L("If anyone is in immediate danger, seek local emergency help. ", "אם מישהו בסכנה מיידית, פנו לעזרת חירום מקומית. ");

function schoolCard(
  id: string,
  category: HardMomentCategory,
  concerns: ContentConcern[],
  sources: string[],
  copy: { title: LocalizedText; doNow: LocalizedText; sayThis: LocalizedText; avoid: LocalizedText; observe: LocalizedText; escalation: LocalizedText },
  heightened = false,
): HardMomentCard {
  return {
    id, category, ...copy,
    escalation: L(DANGER.en + copy.escalation.en, DANGER.he + copy.escalation.he),
    version: "1.0.0", ageBands: ["6-8"], domains: ["social-emotional"],
    concerns, moment: id,
    locales: ["en", "he"], safetyClass: heightened ? "heightened-care" : "general-parenting", reviewStatus: "draft",
    reviewerRole: "clinical-content-reviewer", reviewedBy: "", reviewedAt: "", reviewDueAt: "2027-10-06",
    evidenceRefs: sources,
  };
}

export const schoolHardMomentCards: HardMomentCard[] = [
  schoolCard("s-homework-start", "transitions", ["attention", "routines"], [SCHOOL_SOURCES.aapAges], {
    title: L("Starting homework", "להתחיל שיעורי בית"),
    doNow: L("Same place, same time, after a snack. Agree on the first small piece and sit nearby for the first few minutes.", "אותו מקום, אותה שעה, אחרי משהו קטן לאכול. סכמו על החלק הקטן הראשון ושבו בקרבת מקום בדקות הראשונות."),
    sayThis: L("Just the first two questions, then we look together.", "רק שתי השאלות הראשונות, ואז נסתכל יחד."),
    avoid: L("Doing it for them, or long arguments about how much is left.", "לעשות במקומם, או ויכוחים ארוכים על כמה נשאר."),
    observe: L("Notice whether the trouble is starting, staying on it, or one subject.", "שימו לב אם הקושי הוא להתחיל, להתמיד, או במקצוע אחד."),
    escalation: L("If homework ends in tears most days, or reading or writing seem much harder than for classmates, talk with the teacher and your pediatrician.", "אם שיעורי הבית מסתיימים בדמעות ברוב הימים, או שקריאה או כתיבה נראות קשות הרבה יותר מאשר לבני הכיתה, שוחחו עם המורה ועם רופא הילדים."),
  }),
  schoolCard("s-losing-games", "big-feelings", ["regulation"], [SCHOOL_SOURCES.discipline], {
    title: L("Losing at games", "להפסיד במשחק"),
    doNow: L("Pause the game, name the feeling, and play again later. Let them see you lose calmly too.", "עצרו את המשחק, תנו שם לרגש, ושחקו שוב מאוחר יותר. תנו להם לראות גם אתכם מפסידים ברוגע."),
    sayThis: L("Losing feels rotten. Shake hands, and we can play again tomorrow.", "להפסיד זה מרגיש רע. לוחצים ידיים, ואפשר לשחק שוב מחר."),
    avoid: L("Letting them win every time, or ending all games for good.", "לתת להם לנצח כל פעם, או להפסיק את כל המשחקים לתמיד."),
    observe: L("Notice which games are hardest and whether tiredness is part of it.", "שימו לב אילו משחקים הכי קשים והאם עייפות היא חלק מזה."),
    escalation: L("If losing often ends in hitting, breaking things, or friends no longer wanting to play, talk with the teacher and your pediatrician.", "אם הפסד מסתיים לעיתים קרובות במכות, בשבירת חפצים, או שחברים כבר לא רוצים לשחק, שוחחו עם המורה ועם רופא הילדים."),
  }),
  schoolCard("s-friend-trouble", "relationships", ["peer-conflict"], [SCHOOL_SOURCES.aapAges], {
    title: L("Trouble with a friend", "קושי עם חבר"),
    doNow: L("Listen to the whole story first. Ask what they would like to happen tomorrow, then plan one small step together.", "הקשיבו קודם לכל הסיפור. שאלו מה הם היו רוצים שיקרה מחר, ואז תכננו יחד צעד קטן אחד."),
    sayThis: L("That sounds hard. What would you like to try tomorrow?", "זה נשמע קשה. מה היית רוצה לנסות מחר?"),
    avoid: L("Calling the other child names, or fixing it for them before they asked.", "לכנות את הילד האחר בשמות, או לפתור במקומם לפני שביקשו."),
    observe: L("Notice whether it is one friend or many, and whether it follows them home.", "שימו לב אם מדובר בחבר אחד או בכמה, והאם זה ממשיך איתם הביתה."),
    escalation: L("If the same child is being targeted again and again, your child does not want to go to school, or there are stomach aches before school, talk with the teacher and your pediatrician.", "אם אותו ילד נפגע שוב ושוב, הילד לא רוצה ללכת לבית הספר, או שיש כאבי בטן לפני בית הספר, שוחחו עם המורה ועם רופא הילדים."),
  }, true),
  schoolCard("s-lying", "limits", ["regulation"], [SCHOOL_SOURCES.discipline], {
    title: L("Lying", "שקר"),
    doNow: L("Stay calm and make telling the truth easy: name what you saw, and keep the fix about repairing it.", "הישארו רגועים ותנו לאמת להיות קלה: אמרו מה ראיתם, והתמקדו בתיקון."),
    sayThis: L("I think something else happened. Telling me is safe. Let's fix it together.", "נראה לי שקרה משהו אחר. בטוח לספר לי. בואו נתקן את זה יחד."),
    avoid: L("Setting a trap with a question you know the answer to, or a punishment so big that lying feels safer.", "לטמון מלכודת בשאלה שאתם יודעים את התשובה עליה, או עונש כל כך גדול ששקר נראה בטוח יותר."),
    observe: L("Notice what the lies are about — avoiding trouble, wishing, or wanting to fit in.", "שימו לב על מה השקרים — להתחמק מצרות, משאלות, או רצון להשתלב."),
    escalation: L("If lying comes with taking things, hurting others, or lots of trouble at school, talk with the teacher and your pediatrician.", "אם השקרים מגיעים יחד עם לקיחת חפצים, פגיעה באחרים, או הרבה בעיות בבית הספר, שוחחו עם המורה ועם רופא הילדים."),
  }),
  schoolCard("s-screens", "transitions", ["screens"], [SCHOOL_SOURCES.aapAges], {
    title: L("Screens at seven", "מסכים בגיל שבע"),
    doNow: L("Agree on the plan before the screen goes on: how long, where it ends, and what comes next.", "סכמו על התכנית לפני שהמסך נדלק: כמה זמן, איפה זה נגמר ומה בא אחר כך."),
    sayThis: L("Two more minutes, then it goes on the shelf and we head out.", "עוד שתי דקות, ואז זה הולך למדף ויוצאים."),
    avoid: L("Ending it in the middle of a level without warning, or screens in the bedroom at night.", "לעצור באמצע שלב בלי הודעה, או מסכים בחדר השינה בלילה."),
    observe: L("Notice how the evening and sleep go on screen days and on screen-free days.", "שימו לב איך עוברים הערב והשינה בימים עם מסך ובימים בלי."),
    escalation: L("If screens crowd out sleep, friends or school, or stopping always ends in a big fight, talk with your pediatrician.", "אם המסכים דוחקים החוצה את השינה, החברים או בית הספר, או שכל עצירה נגמרת בריב גדול, שוחחו עם רופא הילדים."),
  }),
  schoolCard("s-bedtime-seven", "routines", ["sleep", "routines"], [SCHOOL_SOURCES.sleep], {
    title: L("Bedtime at seven", "שעת שינה בגיל שבע"),
    doNow: L("Keep the same lights-out time on school nights, with a quiet half hour before it and no screens in the bed.", "שמרו על אותה שעת כיבוי אורות בלילות של בית ספר, עם חצי שעה שקטה לפני ובלי מסכים במיטה."),
    sayThis: L("Reading time, then lights out. You can choose the book.", "זמן קריאה, ואז כיבוי אורות. אפשר לבחור את הספר."),
    avoid: L("Arguing about the time every night, or bedtime as a punishment.", "ויכוח על השעה בכל לילה, או שינה כעונש."),
    observe: L("Notice how long falling asleep takes and how the mornings go.", "שימו לב כמה זמן לוקח להירדם ואיך עוברים הבקרים."),
    escalation: L("If there is loud snoring, falling asleep takes very long most nights, or daytime tiredness affects school, talk with your pediatrician.", "אם יש נחירות חזקות, ההירדמות לוקחת זמן רב ברוב הלילות, או שעייפות ביום משפיעה על בית הספר, שוחחו עם רופא הילדים."),
  }),
  schoolCard("s-morning-rush", "routines", ["routines", "transitions"], [SCHOOL_SOURCES.aapAges], {
    title: L("The school-morning rush", "לחץ של בוקר לפני בית הספר"),
    doNow: L("Move what you can to the night before — clothes, bag, lunch — and keep one short list by the door.", "העבירו כל מה שאפשר לערב הקודם — בגדים, תיק, אוכל — ושמרו רשימה קצרה אחת ליד הדלת."),
    sayThis: L("Check the list. What's the next thing?", "בדקו את הרשימה. מה הדבר הבא?"),
    avoid: L("A stream of reminders, or doing every step for them because it's faster.", "זרם של תזכורות, או לעשות כל שלב במקומם כי זה מהר יותר."),
    observe: L("Notice which step always stalls the morning.", "שימו לב איזה שלב תמיד תוקע את הבוקר."),
    escalation: L("If mornings regularly bring stomach aches, tears, or refusal to go to school, talk with the teacher and your pediatrician.", "אם הבקרים מביאים באופן קבוע כאבי בטן, דמעות או סירוב ללכת לבית הספר, שוחחו עם המורה ועם רופא הילדים."),
  }),
  schoolCard("s-backtalk", "limits", ["regulation"], [SCHOOL_SOURCES.discipline], {
    title: L("Backtalk", "חוצפה"),
    doNow: L("Answer the tone once, calmly, then listen for what they mean.", "הגיבו לטון פעם אחת, ברוגע, ואז הקשיבו למה שמאחוריו."),
    sayThis: L("Try that again in a kinder voice — I want to hear what you mean.", "נסו שוב בקול נעים יותר — אני רוצה לשמוע מה הכוונה."),
    avoid: L("Shouting back, sarcasm, or punishments added on in anger.", "לצעוק בחזרה, ציניות, או עונשים שנערמים מתוך כעס."),
    observe: L("Notice when it comes: after school, when tired, after a no.", "שימו לב מתי זה מגיע: אחרי בית הספר, בעייפות, אחרי \"לא\"."),
    escalation: L("If anger at home feels constant, or it comes with hurting people or breaking things, talk with your pediatrician.", "אם הכעס בבית מרגיש קבוע, או שהוא מגיע עם פגיעה באנשים או שבירת חפצים, שוחחו עם רופא הילדים."),
  }),
  schoolCard("s-sibling-fights", "relationships", ["peer-conflict", "aggression"], [SCHOOL_SOURCES.discipline], {
    title: L("Sibling fights", "מריבות בין אחים"),
    doNow: L("Separate first if anyone is getting hurt. Later, when calm, let each one say what they want, and agree on one rule together.", "הפרידו קודם אם מישהו נפגע. אחר כך, ברוגע, תנו לכל אחד לומר מה הוא רוצה, וסכמו יחד על כלל אחד."),
    sayThis: L("Both of you, take a break. We'll sort it out when we're calm.", "שניכם, הפסקה. נסדר את זה כשנירגע."),
    avoid: L("Deciding who started it, or comparing one child to the other.", "להחליט מי התחיל, או להשוות ילד אחד לשני."),
    observe: L("Notice what most fights are about — space, turns, attention.", "שימו לב על מה רוב המריבות — מקום, תורות, תשומת לב."),
    escalation: L("If one child is often hurt or frightened, or the fights leave marks, talk with your pediatrician.", "אם ילד אחד נפגע או מפחד לעיתים קרובות, או שהמריבות משאירות סימנים, שוחחו עם רופא הילדים."),
  }, true),
  schoolCard("s-night-fears", "separation", ["fears", "sleep"], [SCHOOL_SOURCES.sleep], {
    title: L("Fear at night", "פחד בלילה"),
    doNow: L("Take the fear seriously, keep the routine the same, and add one small comfort — a night light or a check-in.", "קחו את הפחד ברצינות, שמרו על השגרה, והוסיפו נחמה קטנה אחת — מנורת לילה או ביקור קצר."),
    sayThis: L("You're safe. I'll check on you in five minutes.", "בבית הזה בטוח. אני אבוא לבדוק עוד חמש דקות."),
    avoid: L("Laughing at the fear, or scary shows and stories before bed.", "לצחוק על הפחד, או תוכניות וסיפורים מפחידים לפני השינה."),
    observe: L("Notice whether the fear started after something — a film, a move, a loss.", "שימו לב אם הפחד התחיל אחרי משהו — סרט, מעבר דירה, אובדן."),
    escalation: L("If fears keep your child from sleeping most nights for weeks, or spill into the day, talk with your pediatrician.", "אם הפחדים מונעים מהילד לישון ברוב הלילות במשך שבועות, או גולשים גם ליום, שוחחו עם רופא הילדים."),
  }),
];
