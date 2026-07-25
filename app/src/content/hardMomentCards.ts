import { isPublishableContent, type ContentConcern, type GovernedContentRecord, type LocalizedText } from "./governance";

export type HardMomentCategory = "big-feelings" | "limits" | "relationships" | "separation" | "routines" | "transitions";

export interface HardMomentCard extends GovernedContentRecord {
  category: HardMomentCategory;
  title: LocalizedText;
  doNow: LocalizedText;
  sayThis: LocalizedText;
  avoid: LocalizedText;
  observe: LocalizedText;
  escalation: LocalizedText;
}

const L = (en: string, he: string): LocalizedText => ({ en, he });

/**
 * Shared fallback escalation for low-stakes routine cards. Higher-stakes
 * moments carry moment-specific escalation text (CONT-4) via the `escalation`
 * override below — observable thresholds + who to talk to, counts not
 * verdicts, no timelines framed as diagnostic cutoffs.
 */
export const sharedEscalation = L(
  "If anyone may be hurt, move to safety first. Seek professional help when the pattern is frequent, intense, worsening, or worrying you.",
  "אם מישהו עלול להיפגע, עברו קודם למקום בטוח. פנו לאיש מקצוע אם הדפוס תכוף, עוצמתי, מחמיר או מדאיג אתכם."
);

/**
 * CONT-5 — say-this scripts are spoken verbatim, so they never embed a
 * stranger's name. The active child's name is substituted at display time via
 * renderSayThis; other people appear as generic role words in BOTH locales.
 */
export const CHILD_NAME_TOKEN = "{{childName}}";

/**
 * Substitute the active child's name into a card's say-this script at display
 * time. Without a child profile the token is dropped for a neutral phrasing
 * (never a placeholder leaking to a parent surface).
 */
export function renderSayThis(card: HardMomentCard, childName?: string): LocalizedText {
  const render = (text: string): string => {
    const name = childName?.trim();
    if (name) return text.split(CHILD_NAME_TOKEN).join(name);
    const stripped = text.replace(/\{\{childName\}\},?\s*/g, "").trimStart();
    return stripped.charAt(0).toUpperCase() + stripped.slice(1);
  };
  return { en: render(card.sayThis.en), he: render(card.sayThis.he) };
}

interface CardMeta {
  /** AR-CAP-07 concern tags — controlled vocabulary, >=1 per card. */
  concerns: ContentConcern[];
  /**
   * CONT-3a honest-narrow: bands default to ["2-5"] because the scripts are
   * toddler/preschool register; only cards whose copy genuinely serves older
   * children claim more. Older-band variants are gated authoring (GD-10).
   */
  ageBands?: string[];
  /** CONT-4 moment-specific escalation override (draft until clinical review). */
  escalation?: LocalizedText;
}

function card(
  id: string,
  category: HardMomentCategory,
  title: LocalizedText,
  doNow: LocalizedText,
  sayThis: LocalizedText,
  avoid: LocalizedText,
  observe: LocalizedText,
  meta: CardMeta,
): HardMomentCard {
  return {
    id, category, title, doNow, sayThis, avoid, observe,
    escalation: meta.escalation ?? sharedEscalation,
    version: "1.0.0", ageBands: meta.ageBands ?? ["2-5"], domains: ["social-emotional"],
    concerns: meta.concerns, moment: id,
    locales: ["en", "he"], safetyClass: "general-parenting", reviewStatus: "draft",
    reviewerRole: "clinical-content-reviewer", reviewedBy: "", reviewedAt: "", reviewDueAt: "2027-07-22",
    evidenceRefs: ["internal:arbor-parenting-framework"],
  };
}

export const hardMomentCards: HardMomentCard[] = [
  card("tantrum", "big-feelings", L("Tantrum", "התקף זעם"), L("Lower your voice, reduce words, and stay close without crowding.", "הנמיכו את הקול, צמצמו מילים והישארו קרובים בלי להצטופף."), L("You're safe. I'm here. We'll talk when your body is calmer.", "אתם בטוחים. אני כאן. נדבר כשהגוף יירגע."), L("Do not reason, threaten, or demand an apology mid-storm.", "אל תנסו לשכנע, לאיים או לדרוש התנצלות באמצע הסערה."), L("Notice what happened just before and what helped recovery begin.", "שימו לב מה קרה ממש לפני ומה עזר להתחיל להירגע."), {
    concerns: ["regulation"],
    escalation: L(
      "If storms come many times a day, keep lasting longer than your calm-down steps can hold, or your child gets hurt during them, keep a short note of when they happen and share it with your pediatrician.",
      "אם הסערות מגיעות פעמים רבות ביום, נמשכות שוב ושוב מעבר למה שצעדי ההרגעה מחזיקים, או שהילד נפגע במהלכן — נהלו רישום קצר של מתי הן קורות ושתפו את רופא הילדים."
    ),
  }),
  card("refusal", "limits", L("Refusal", "סירוב"), L("Offer one clear limit and two acceptable ways to begin.", "הציבו גבול ברור אחד והציעו שתי דרכים מקובלות להתחיל."), L("This needs to happen. Do you want to start together or by yourself?", "זה צריך לקרות. להתחיל יחד או לבד?"), L("Avoid adding more choices or repeating the instruction louder.", "הימנעו מהוספת אפשרויות או מחזרה בקול חזק יותר."), L("Notice whether choice, connection, or a smaller first step helps.", "בדקו אם בחירה, חיבור או צעד ראשון קטן עוזרים."), { concerns: ["regulation", "routines"] }),
  card("hitting", "big-feelings", L("Hitting or kicking", "מכות או בעיטות"), L("Block calmly, create space, and move other children out of reach.", "עצרו בעדינות, צרו מרחק והרחיקו ילדים אחרים מטווח פגיעה."), L("I won't let you hit. I will help keep everyone safe.", "אני לא אתן לפגוע. אני אעזור לשמור על כולם בטוחים."), L("Avoid shaming, long explanations, or forcing closeness.", "הימנעו מבושה, הסברים ארוכים או כפיית קרבה."), L("Notice early body signs and the fastest safe route back to calm.", "שימו לב לסימני הגוף המוקדמים ולדרך הבטוחה והמהירה לרגיעה."), {
    concerns: ["aggression"],
    escalation: L(
      "If hitting leaves marks or injuries, happens several times on most days, or keeps aiming at the same child or adult, note when it happens and bring your notes to your pediatrician or the kindergarten team.",
      "אם המכות משאירות סימנים או פציעות, חוזרות כמה פעמים כמעט בכל יום, או מכוונות שוב ושוב לאותו ילד או מבוגר — רשמו מתי זה קורה והביאו את הרישום לרופא הילדים או לצוות הגן."
    ),
  }),
  card("sibling-conflict", "relationships", L("Sibling conflict", "ריב בין אחים"), L("Pause the action, hear each child briefly, then name the shared problem.", "עצרו את הפעולה, הקשיבו בקצרה לכל ילד ואז הגדירו את הבעיה המשותפת."), L("Two people want the same thing. Let's make a plan that keeps both of you safe.", "שני אנשים רוצים את אותו הדבר. בואו נמצא תכנית ששומרת על שניכם."), L("Avoid deciding who is the bad child or demanding instant sharing.", "הימנעו מלהחליט מי הילד הרע או לדרוש שיתוף מיידי."), L("Notice whether conflict clusters around fatigue, space, or scarce items.", "בדקו אם הריבים מתרכזים סביב עייפות, מרחב או חפץ מבוקש."), { concerns: ["peer-conflict"] }),
  card("separation", "separation", L("Separation", "פרידה"), L("Use the same short goodbye ritual and leave when you say you will.", "השתמשו בטקס פרידה קצר וקבוע וצאו כשאמרתם שתצאו."), L("I always come back. After snack, your grown-up will bring you to me.", "אני תמיד חוזר/ת. אחרי החטיף המבוגר שלך יחזיר אותך אליי."), L("Avoid sneaking away or restarting a long goodbye.", "הימנעו מהיעלמות בלי פרידה או מהתחלת פרידה ארוכה מחדש."), L("Notice how long settling takes and which predictable cue helps.", "שימו לב כמה זמן לוקח להירגע ואיזה סימן קבוע עוזר."), {
    concerns: ["separation"],
    escalation: L(
      "If goodbyes still end in strong distress even after the same short ritual has become steady, or worry about separating starts to shrink what your child will try at home, share what you see with the kindergarten teacher and your pediatrician.",
      "אם הפרידות עדיין מסתיימות במצוקה חזקה גם אחרי שטקס קצר וקבוע התייצב, או שהחשש מפרידה מצמצם את מה שהילד מוכן לנסות בבית — שתפו את הגננת ואת רופא הילדים במה שאתם רואים."
    ),
  }),
  card("bedtime", "routines", L("Bedtime resistance", "התנגדות לשינה"), L("Return to one quiet sequence with a visible final step.", "חזרו לרצף שקט אחד עם שלב סיום ברור."), L("First teeth, then one story, then lights low. I'll stay for two minutes.", "קודם שיניים, אחר כך סיפור אחד, ואז אור חלש. אשאר שתי דקות."), L("Avoid negotiating a new routine after every protest.", "הימנעו ממשא ומתן על טקס חדש אחרי כל מחאה."), L("Notice which step stretches and whether the day was unusually stimulating.", "בדקו איזה שלב מתארך והאם היום היה עמוס במיוחד."), { concerns: ["sleep", "routines"] }),
  card("leaving-play", "transitions", L("Stopping play", "הפסקת משחק"), L("Give a concrete ending cue and let the child complete one tiny closing action.", "תנו סימן סיום מוחשי ואפשרו לילד להשלים פעולת סגירה קטנה."), L("Two more turns, then you park the toy and we go.", "עוד שני תורים, אחר כך מחנים את הצעצוע ויוצאים."), L("Avoid surprise endings or vague promises of later.", "הימנעו מסיום מפתיע או מהבטחות מעורפלות לאחר כך."), L("Notice whether countdowns, a picture cue, or carrying a transition object helps.", "בדקו אם ספירה לאחור, תמונה או חפץ מעבר עוזרים."), { concerns: ["transitions"] }),
  card("morning-rush", "routines", L("Morning rush", "לחץ של בוקר"), L("Remove one nonessential demand and point to the next single step.", "הסירו דרישה לא חיונית אחת והצביעו על השלב היחיד הבא."), L("Right now: shoes. I'll hold the bag.", "עכשיו: נעליים. אני אחזיק את התיק."), L("Avoid listing the whole morning or narrating lateness repeatedly.", "הימנעו מרשימת כל משימות הבוקר או מחזרה על האיחור."), L("Notice the first bottleneck and prepare only that part tonight.", "זהו את צוואר הבקבוק הראשון והכינו רק אותו הערב."), { concerns: ["routines", "transitions"] }),
  card("homework", "transitions", L("Homework start", "התחלת שיעורי בית"), L("Shrink the start to two minutes and remove visible distractions.", "צמצמו את ההתחלה לשתי דקות והרחיקו הסחות גלויות."), L("Let's do the first tiny part, then check what your brain needs.", "נעשה את החלק הקטן הראשון ואז נבדוק מה המוח צריך."), L("Avoid turning the task into a character judgment.", "הימנעו מהפיכת המשימה לשיפוט על האופי."), L("Notice whether difficulty is starting, understanding, or sustaining attention.", "בדקו אם הקושי הוא בהתחלה, בהבנה או בשמירת הקשב."), { concerns: ["attention", "routines"], ageBands: ["6-9", "10-12"] }),
  card("screen-ending", "transitions", L("Ending screen time", "סיום זמן מסך"), L("Show the end point, acknowledge disappointment, and move to a prepared next action.", "הראו את נקודת הסיום, הכירו באכזבה ועברו לפעולה הבאה שהוכנה מראש."), L("The screen is finished. It's hard to stop. You can choose music or blocks next.", "המסך הסתיים. קשה לעצור. עכשיו אפשר לבחור מוזיקה או קוביות."), L("Avoid extending repeatedly after the limit or arguing about fairness.", "הימנעו מהארכות חוזרות אחרי הגבול או מוויכוח על הוגנות."), L("Notice which content and time of day make stopping harder.", "בדקו איזה תוכן ואיזו שעה מקשים יותר על הסיום."), { concerns: ["screens", "transitions"], ageBands: ["6-9", "10-12"] }),
  card("public-meltdown", "big-feelings", L("Meltdown in public", "סערה במקום ציבורי"), L("Move to a quieter edge, reduce the audience, and focus only on safety.", "עברו לפינה שקטה יותר, צמצמו קהל והתמקדו רק בבטיחות."), L("This is a lot. We'll find a quieter place together.", "זה הרבה. נמצא יחד מקום שקט יותר."), L("Avoid performing calm for onlookers or demanding quick compliance.", "הימנעו מלפעול בשביל הצופים או לדרוש ציות מהיר."), L("Notice noise, hunger, waiting, and how much warning the child had.", "בדקו רעש, רעב, המתנה וכמה הכנה הייתה לילד."), {
    concerns: ["regulation"],
    escalation: L(
      "If outings keep ending early because of meltdowns, or your child cannot settle even in a quiet spot with you close, note which outings are hardest and talk them through with your pediatrician.",
      "אם יציאות מסתיימות שוב ושוב לפני הזמן בגלל סערות, או שהילד מתקשה להירגע גם בפינה שקטה כשאתם קרובים — רשמו אילו יציאות הכי קשות ושוחחו עליהן עם רופא הילדים."
    ),
  }),
  card("whining", "limits", L("Whining", "יללות"), L("Respond to the need once, then model the usable voice or words.", "הגיבו לצורך פעם אחת ואז הדגימו קול או מילים שאפשר להשתמש בהם."), L("I want to understand. Try: 'Can you help me, please?'", "אני רוצה להבין. נסו: 'אפשר לעזור לי בבקשה?'"), L("Avoid mocking the voice or giving a long lecture.", "הימנעו מחיקוי לועג או מהרצאה ארוכה."), L("Notice whether whining rises with fatigue, waiting, or unclear expectations.", "בדקו אם היללות עולות עם עייפות, המתנה או ציפיות לא ברורות."), { concerns: ["regulation"] }),
  card("not-listening", "limits", L("Not responding", "לא מגיבים"), L("Move close, say the child's name, and give one observable instruction.", "התקרבו, אמרו את שם הילד ותנו הוראה אחת שאפשר לראות."), L("{{childName}}, feet on the floor, please.", "{{childName}}, רגליים על הרצפה בבקשה."), L("Avoid calling across rooms or stacking several instructions.", "הימנעו מקריאות מחדר אחר או מערימת הוראות."), L("Notice whether proximity, eye-level connection, or fewer words changes the response.", "בדקו אם קרבה, קשר בגובה העיניים או פחות מילים משנים את התגובה."), { concerns: ["attention"] }),
  card("fear-new-thing", "separation", L("Fear of something new", "פחד ממשהו חדש"), L("Offer the smallest voluntary step and keep warmth independent of the outcome.", "הציעו את הצעד הרצוני הקטן ביותר ושמרו על חום בלי קשר לתוצאה."), L("You don't have to do all of it. What is one tiny step you choose?", "לא צריך לעשות הכול. איזה צעד קטן אתם בוחרים?"), L("Avoid pushing, rescuing immediately, or praising only success.", "הימנעו מדחיפה, הצלה מיידית או שבח רק על הצלחה."), L("Notice the smallest distance or action the child can tolerate willingly.", "בדקו מה המרחק או הפעולה הקטנים שהילד מוכן לנסות מרצונו."), {
    concerns: ["fears"],
    escalation: L(
      "If fear keeps your child away from everyday places or activities they used to join, or the list of avoided things keeps growing, write down what is avoided and discuss it with your pediatrician.",
      "אם הפחד מרחיק את הילד ממקומות או מפעילויות יומיומיות שבעבר השתתף בהם, או שרשימת הדברים שהוא נמנע מהם ממשיכה להתארך — רשמו ממה הוא נמנע ושוחחו על כך עם רופא הילדים."
    ),
  }),
  card("losing-game", "big-feelings", L("Losing a game", "הפסד במשחק"), L("Hold the limit, name the disappointment, and pause before deciding whether to continue.", "שמרו על הגבול, תנו שם לאכזבה ועצרו לפני שמחליטים אם להמשיך."), L("You really wanted to win. We can breathe, then choose: one more round or finish.", "מאוד רציתם לנצח. אפשר לנשום ואז לבחור: עוד סיבוב או לסיים."), L("Avoid changing the result or calling the reaction silly.", "הימנעו משינוי התוצאה או מהגדרת התגובה כשטותית."), L("Notice how much recovery changes with preparation and game length.", "בדקו איך ההכנה ואורך המשחק משפיעים על זמן ההתאוששות."), { concerns: ["regulation", "peer-conflict"], ageBands: ["6-9", "10-12"] }),
  card("sharing", "relationships", L("Sharing conflict", "קושי בשיתוף"), L("Protect the current turn and make the next turn predictable.", "הגנו על התור הנוכחי והפכו את התור הבא לצפוי."), L("It's your friend's turn now. When the timer rings, it's your turn.", "עכשיו התור של החבר/ה. כשהטיימר יצלצל, זה יהיה התור שלך."), L("Avoid forcing immediate sharing of a prized object.", "הימנעו מכפיית שיתוף מיידי בחפץ יקר לילד."), L("Notice which objects need special rules before play begins.", "בדקו אילו חפצים צריכים כללים מיוחדים לפני המשחק."), { concerns: ["peer-conflict"] }),
  card("teasing", "relationships", L("Teasing or hurtful words", "הקנטות או מילים פוגעות"), L("Stop the words, check the hurt child, then coach repair after calm.", "עצרו את המילים, בדקו את הילד שנפגע ואז תרגלו תיקון לאחר רגיעה."), L("Those words hurt. Pause. We'll find a way to say what you needed.", "המילים האלה פוגעות. עוצרים. נמצא דרך לומר מה הייתם צריכים."), L("Avoid public humiliation or forced apologies without repair.", "הימנעו מהשפלה פומבית או מהתנצלות כפויה ללא תיקון."), L("Notice the need underneath: attention, belonging, power, or frustration.", "בדקו את הצורך שמתחת: תשומת לב, שייכות, כוח או תסכול."), {
    concerns: ["peer-conflict", "aggression"],
    escalation: L(
      "If hurtful words keep targeting the same child, continue after adults have stepped in, or your child starts avoiding the group, note what you see and talk with the teacher — and with your pediatrician if it keeps repeating.",
      "אם מילים פוגעות ממשיכות להיות מכוונות לאותו ילד, נמשכות גם אחרי התערבות של מבוגרים, או שהילד מתחיל להימנע מהקבוצה — רשמו מה אתם רואים ושוחחו עם הצוות החינוכי, ואם זה חוזר ונשנה גם עם רופא הילדים."
    ),
  }),
  card("clinging", "separation", L("Clinging", "היצמדות"), L("Offer connection first, then preview one short period of independence.", "הציעו קודם חיבור ואז הכינו לפרק קצר של עצמאות."), L("One long hug, then you play while I make tea. I'll check in after this song.", "חיבוק ארוך אחד, ואז משחקים בזמן שאני מכין/ה תה. אחזור אחרי השיר."), L("Avoid peeling the child away or promising constant availability.", "הימנעו מהפרדה בכוח או מהבטחה לזמינות מתמדת."), L("Notice which predictable return cue builds confidence.", "בדקו איזה סימן חזרה צפוי בונה ביטחון."), { concerns: ["separation"] }),
  card("school-dropoff", "separation", L("School drop-off", "פרידה בגן או בבית הספר"), L("Coordinate one brief handoff with the receiving adult and repeat it consistently.", "תאמו מסירה קצרה אחת עם המבוגר המקבל וחזרו עליה בעקביות."), L("Your teacher has you. One hug, one wave, and I return after lunch.", "המורה איתך. חיבוק אחד, נפנוף אחד, ואני חוזר/ת אחרי ארוחת הצהריים."), L("Avoid returning after leaving unless safety requires it.", "הימנעו מלחזור אחרי שכבר יצאתם אלא אם הבטיחות דורשת זאת."), L("Notice whether a job, object, or named first activity supports entry.", "בדקו אם תפקיד, חפץ או פעילות ראשונה ידועה עוזרים להיכנס."), {
    concerns: ["separation", "transitions"],
    escalation: L(
      "If your child keeps being unable to enter class even with a steady handoff, or mornings before school regularly include stomach aches or refusal to get ready, talk with the teacher about how entry looks and bring your notes to your pediatrician.",
      "אם הילד שוב ושוב לא מצליח להיכנס לכיתה גם עם מסירה קבועה, או שבקרים לפני הגן או בית הספר כוללים באופן קבוע כאבי בטן או סירוב להתארגן — שוחחו עם הצוות על איך נראית הכניסה והביאו את הרישום לרופא הילדים."
    ),
  }),
  card("getting-dressed", "routines", L("Getting dressed", "התלבשות"), L("Lay out two weather-appropriate options and start with one item.", "הניחו שתי אפשרויות מתאימות למזג האוויר והתחילו מפריט אחד."), L("Blue shirt or green shirt. You choose; I'll help with the label.", "חולצה כחולה או ירוקה. אתם בוחרים; אני אעזור עם התווית."), L("Avoid reopening the whole wardrobe after the choice.", "הימנעו מפתיחת כל הארון מחדש אחרי הבחירה."), L("Notice texture, tags, temperature, and which step needs help.", "בדקו מרקם, תוויות, טמפרטורה ואיזה שלב דורש עזרה."), { concerns: ["routines"] }),
  card("toothbrushing", "routines", L("Toothbrushing", "צחצוח שיניים"), L("Keep the sequence brief and predictable; let the child control one safe part.", "שמרו על רצף קצר וצפוי ותנו לילד שליטה בחלק בטוח אחד."), L("You choose the song. You brush first, then I finish.", "אתם בוחרים את השיר. אתם מתחילים לצחצח ואז אני מסיים/ת."), L("Avoid chasing with the toothbrush or adding threats.", "הימנעו מרדיפה עם המברשת או מהוספת איומים."), L("Notice taste, pressure, foam, timing, and control preferences.", "בדקו טעם, לחץ, קצף, תזמון והעדפות שליטה."), { concerns: ["routines"] }),
  card("mealtime", "routines", L("Mealtime refusal", "סירוב בארוחה"), L("Keep one familiar food available and remove pressure to taste.", "השאירו מזון מוכר אחד והסירו לחץ לטעום."), L("You decide what goes in your body. This food can stay on the plate.", "אתם מחליטים מה נכנס לגוף. האוכל יכול להישאר בצלחת."), L("Avoid bargaining bites, forcing food, or commenting on quantity.", "הימנעו ממשא ומתן על ביסים, כפייה או הערות על הכמות."), L("Notice smell, texture, timing, and whether sitting duration is realistic.", "בדקו ריח, מרקם, תזמון והאם משך הישיבה מציאותי."), {
    concerns: ["food"],
    escalation: L(
      "If the list of accepted foods keeps shrinking, whole food groups are dropping out, or your child's energy or growth worries you, keep a simple list of what is eaten for a few days and bring it to your pediatrician or a dietitian.",
      "אם רשימת המאכלים המקובלים ממשיכה להצטמצם, קבוצות מזון שלמות נעלמות, או שהאנרגיה או הגדילה של הילד מדאיגות אתכם — נהלו רשימה פשוטה של מה שנאכל במשך כמה ימים והביאו אותה לרופא הילדים או לדיאטנית."
    ),
  }),
  card("bath", "routines", L("Bath resistance", "התנגדות לאמבטיה"), L("Preview the sensory steps and let the child choose the first contact with water.", "הכינו מראש לשלבים החושיים ותנו לילד לבחור את המגע הראשון עם המים."), L("Feet first or hands first? You choose how we begin.", "רגליים קודם או ידיים קודם? אתם בוחרים איך מתחילים."), L("Avoid surprise splashing or rushing through distress.", "הימנעו מהתזה מפתיעה או מהאצה בזמן מצוקה."), L("Notice water temperature, sound, hair washing, and transition timing.", "בדקו טמפרטורת מים, רעש, חפיפת שיער ותזמון המעבר."), { concerns: ["routines", "fears"] }),
  card("waiting", "transitions", L("Waiting", "המתנה"), L("Make time visible and give the body a small job.", "הפכו את הזמן לגלוי ותנו לגוף משימה קטנה."), L("When the three dots are crossed out, it's our turn. Can you hold the list?", "כשנמחק את שלוש הנקודות, יגיע תורנו. אפשר להחזיק את הרשימה?"), L("Avoid saying just a minute when the wait is uncertain.", "הימנעו מלומר רק דקה כשההמתנה לא ידועה."), L("Notice the manageable wait length and whether movement helps.", "בדקו מה משך ההמתנה האפשרי והאם תנועה עוזרת."), { concerns: ["attention", "regulation"] }),
  card("change-of-plan", "transitions", L("Unexpected change", "שינוי לא צפוי"), L("Name what changed, preserve one familiar anchor, and show the new next step.", "ציינו מה השתנה, שמרו על עוגן מוכר אחד והראו את השלב הבא החדש."), L("The park is closed. The plan changed. Snack stays the same; then we choose home or the library.", "הפארק סגור. התכנית השתנתה. החטיף נשאר; אחר כך בוחרים בית או ספרייה."), L("Avoid pretending the change is insignificant.", "הימנעו מהעמדת פנים שהשינוי לא משמעותי."), L("Notice which anchors help: person, object, order, or visual plan.", "בדקו איזה עוגן עוזר: אדם, חפץ, סדר או תכנית חזותית."), { concerns: ["transitions"] }),
];

/** Product surfaces must consume this export, never the authoring list above. */
export const publishedHardMomentCards = hardMomentCards.filter((item) => isPublishableContent(item));
