// @icon-font-ignore — authored activity data only; "not_interested" is a
// saved option identifier, never a Material Symbols glyph or UI icon.
import type { Practice } from "./practices";

/** B-NEXT-18. Authored options for a parent's circumstances, never a child
 * assessment. The base activity keeps its age, shelf and evidence; adapted
 * copy is an editorial draft and does not inherit a clinical approval. */
export const PRACTICE_ADAPTATION_KEYS = ["two_minutes", "no_materials", "too_difficult", "not_interested"] as const;
export type PracticeAdaptationKey = typeof PRACTICE_ADAPTATION_KEYS[number];
export type PracticeAdaptationContent = Pick<Practice, "do" | "say" | "minutes" | "materials">;
export interface PracticeAdaptationRecord extends PracticeAdaptationContent {
  key: PracticeAdaptationKey;
  version: 1;
  basePracticeId: string;
}
const L = (en: string, he: string) => ({ en, he });
const none = L("No materials needed", "אין צורך באביזרים");
const book = L("A picture book from home", "ספר תמונות מהבית");
const V = (minutes: Practice["minutes"], enDo: string, heDo: string, enSay: string, heSay: string, materials = none): PracticeAdaptationContent => ({
  minutes, do: L(enDo, heDo), say: L(enSay, heSay), materials,
});
const four = (two: PracticeAdaptationContent, empty: PracticeAdaptationContent, easy: PracticeAdaptationContent, follow: PracticeAdaptationContent): Record<PracticeAdaptationKey, PracticeAdaptationContent> => ({
  two_minutes: two, no_materials: empty, too_difficult: easy, not_interested: follow,
});

export const PRACTICE_ADAPTATIONS: Readonly<Record<string, Readonly<Record<PracticeAdaptationKey, PracticeAdaptationContent>>>> = {
  "pr-family-01": four(
    V(2, "Choose a family photo. Name the person your child looks at, share a familiar moment, then put it away together.", "בחרו תמונה משפחתית. אמרו את שם האדם שמושך את המבט, הזכירו רגע משותף מוכר, ואז הניחו את התמונה יחד.", "That's Grandma. Remember our wave?", "זאת סבתא. זוכרים איך נופפנו?", L("A family photo", "תמונה משפחתית")),
    V(5, "Greet someone who is with you, using their name. Give your child time to look, wave or stay close.", "ברכו אדם שנמצא איתכם בשמו. תנו לילד/ה זמן להסתכל, לנופף או להישאר קרוב.", "Hello, Dad. We're here together.", "שלום אבא. אנחנו כאן ביחד."),
    V(2, "Stay on a familiar face in a family photo. Name that person gently; looking together is enough.", "הישארו על פנים מוכרות בתמונה משפחתית. אמרו בעדינות את שם האדם; מספיק להסתכל יחד.", "Here's Grandma. We can just look.", "הנה סבתא. אפשר פשוט להסתכל.", L("A familiar family photo", "תמונה משפחתית מוכרת")),
    V(5, "Put the photo aside. Join whatever your child notices and share a small moment together without asking for names.", "הניחו את התמונה בצד. הצטרפו למה שמעניין את הילד/ה ושתפו רגע קטן ביחד בלי לבקש שמות.", "I see what caught your eye.", "ראיתי מה משך את המבט שלך."),
  ),
  "pr-family-02": four(
    V(2, "Invite your child to carry a napkin to the table. Accept a yes or no, and thank them for any help.", "הזמינו את הילד/ה להביא מפית לשולחן. קבלו גם הסכמה וגם סירוב, והודו על כל עזרה.", "Want to bring this napkin? Thank you.", "רוצה להביא את המפית? תודה.", L("A napkin", "מפית")),
    V(5, "Invite your child to call the family for a meal with you. Say the names together, or let them listen.", "הזמינו את הילד/ה לקרוא איתכם למשפחה לארוחה. אמרו יחד את השמות, או תנו לו/ה להקשיב.", "Let's call everyone. Lunch is here!", "נקרא לכולם. האוכל מוכן!"),
    V(2, "Carry a napkin together, with your hand underneath if wanted. Describe the shared job without asking your child to do it alone.", "הביאו מפית יחד, עם היד שלכם מתחת אם רוצים. תארו את העשייה המשותפת בלי לבקש לעשות לבד.", "We're bringing this together.", "אנחנו מביאים את זה ביחד.", L("A napkin", "מפית")),
    V(5, "Offer a choice: call everyone together or watch while you set the table. Either way, keep your child included.", "הציעו בחירה: לקרוא יחד לכולם או להסתכל בזמן שאתם עורכים את השולחן. בכל בחירה, שמרו על תחושת השותפות.", "Want to call everyone, or watch with me?", "רוצה לקרוא לכולם, או להסתכל איתי?"),
  ),
  "pr-family-03": four(
    V(2, "With the familiar carer ready, offer a wave and say when you will return using a real event your child knows.", "כשהמטפל/ת המוכר/ת מוכנ/ה, הציעו נפנוף ואמרו מתי תחזרו לפי אירוע אמיתי שהילד/ה מכיר/ה.", "Your familiar grown-up is here. Goodbye for now.", "יש כאן מבוגר מוכר. נפרדים עכשיו."),
    V(5, "Choose a simple wave together. At the real handover, name the familiar adult staying and say truthfully when you will return.", "בחרו יחד נפנוף פשוט. בפרידה האמיתית, אמרו מי המבוגר/ת המוכר/ת שנשאר/ת ומתי באמת תחזרו.", "Your carer is here. Here's our goodbye wave.", "יש כאן מי שישמור עליך. הנה הנפנוף שלנו."),
    V(2, "Let the familiar carer come close before goodbye. Keep your words brief and your usual return promise truthful; a reply is optional.", "תנו למטפל/ת המוכר/ת להתקרב לפני הפרידה. דברו בקצרה ואמרו מתי באמת תחזרו; אין צורך בתשובה.", "We can take a quiet moment together.", "אפשר לקחת רגע שקט ביחד."),
    V(2, "Skip practising the ritual. At the real goodbye, say your short phrase, name who stays, and accept no wave or hug.", "דלגו על החזרה על הטקס. בפרידה האמיתית, אמרו את המשפט הקצר שלכם ומי נשאר, וקבלו גם פרידה בלי נפנוף או חיבוק.", "No wave needed. I'm saying goodbye now.", "לא חייבים לנופף. עכשיו נפרדים."),
  ),
  "pr-family-04": four(
    V(2, "Share a small moment from your day. Pause for your child to add anything, then let the conversation end naturally.", "שתפו רגע קטן מהיום שלכם. עצרו כדי לאפשר לילד/ה להוסיף משהו, ואז תנו לשיחה להסתיים בטבעיות.", "I saw a bird today. Anything you want to share?", "ראיתי ציפור היום. יש משהו שבא לך לספר?"),
    V(5, "Sit together wherever you are. Share something you noticed today and listen to whatever your child brings to the conversation.", "שבו יחד במקום שבו אתם נמצאים. ספרו על משהו ששמתם לב אליו היום והקשיבו לכל דבר שהילד/ה מביא/ה לשיחה.", "I'm listening. It can be any part of your day.", "יש לי זמן להקשיב. אפשר לספר על כל רגע מהיום."),
    V(2, "Tell a short moment from your own day without asking a question. Leave a pause; listening quietly also belongs in the conversation.", "ספרו בקצרה על רגע מהיום שלכם בלי לשאול שאלה. השאירו הפסקה; גם הקשבה שקטה היא חלק מהשיחה.", "I'll tell you something. You can just listen.", "אספר לך משהו. אפשר פשוט להקשיב."),
    V(5, "Set the day question aside. Invite your child to choose a topic, or sit together quietly if talking does not fit now.", "הניחו לשאלה על היום. הזמינו את הילד/ה לבחור נושא, או שבו יחד בשקט אם שיחה לא מתאימה כרגע.", "We can talk about your idea, or just sit.", "אפשר לדבר על רעיון שלך, או פשוט לשבת."),
  ),
  "pr-words-01": four(
    V(2, "Let your child choose a page. Follow their pointing and talk about that picture; the rest of the book can wait.", "תנו לילד/ה לבחור דף. עקבו אחרי ההצבעה ודברו על התמונה הזאת; שאר הספר יכול לחכות.", "You chose this page. What caught your eye?", "בחרת את הדף הזה. מה משך את המבט?", book),
    V(5, "Invite your child to choose something nearby to look at together. Follow their gaze and describe it without asking for an answer.", "הזמינו את הילד/ה לבחור משהו בסביבה להסתכל עליו יחד. עקבו אחרי המבט ותארו אותו בלי לבקש תשובה.", "You found the window. I see the light too.", "מצאת את החלון. גם אני רואה את האור."),
    V(2, "Hold the book open yourself while your child looks. Follow their attention; no page turning or talking is needed.", "החזיקו בעצמכם את הספר פתוח בזמן שהילד/ה מסתכל/ת. עקבו אחרי העניין; אין צורך להפוך דפים או לדבר.", "I'll hold it. We can look together.", "אני אחזיק. אפשר להסתכל יחד.", book),
    V(5, "Put the book down. Follow your child's current interest and describe what they show you; return to books another time.", "הניחו את הספר. הצטרפו למה שמעניין את הילד/ה כרגע ותארו את מה שהוא/היא מראה לכם; לספר נחזור בפעם אחרת.", "The book can wait. Show me your idea.", "הספר יכול לחכות. מה הרעיון שלך?"),
  ),
  "pr-words-02": four(
    V(2, "Name a picture your child notices, then pause. Welcome a look, sound or point before closing the book together.", "תנו שם לתמונה שהילד/ה שם/ה לב אליה, ואז עצרו. קבלו מבט, צליל או הצבעה לפני שסוגרים יחד את הספר.", "A cat. Meow. I'm looking with you.", "חתול. מיאו. אנחנו מסתכלים ביחד.", book),
    V(5, "Follow your child's pointing around the room. Name what they notice and pause, without turning it into a naming quiz.", "עקבו אחרי ההצבעה של הילד/ה בחדר. תנו שם למה שמעניין אותו/ה ועצרו, בלי להפוך את זה לחידון שמות.", "You noticed the door. Open door.", "שמת לב לדלת. דלת פתוחה."),
    V(2, "Choose a clear picture and name it once. Leave room for your child to look; pointing or speaking is optional.", "בחרו תמונה ברורה ואמרו את שמה פעם אחת. תנו לילד/ה זמן להסתכל; הצבעה או דיבור הם אפשרות.", "Here's the dog. Woof.", "הנה הכלב. הב הב.", book),
    V(5, "Close the book and copy a sound or gesture your child makes. Pause for their next idea, and stop when they move on.", "סגרו את הספר וחקו צליל או תנועה של הילד/ה. עצרו לקראת הרעיון הבא שלו/ה, והפסיקו כשהעניין עובר הלאה.", "I heard your sound. Here's mine.", "שמעתי את הצליל שלך. הנה שלי."),
  ),
  "pr-words-04": four(
    V(2, "Pause before a favourite page. Invite any guess about what comes next, then turn it together without checking the answer.", "עצרו לפני דף אהוב. הזמינו כל ניחוש לגבי ההמשך, ואז הפכו אותו יחד בלי לבדוק את התשובה.", "What might be next? Let's turn and see.", "מה אולי יבוא עכשיו? נהפוך ונראה.", book),
    V(5, "Tell a familiar tiny story from your day. Pause before the ending and welcome any idea your child adds.", "ספרו סיפור קצר ומוכר מהיום שלכם. עצרו לפני הסוף וקבלו כל רעיון שהילד/ה מוסיף/ה.", "We opened the door, and then…?", "פתחנו את הדלת, ואז…?"),
    V(2, "Turn to a familiar page and describe what happens yourself. Let your child listen or point without predicting the story.", "פתחו דף מוכר ותארו בעצמכם מה קורה בו. תנו לילד/ה להקשיב או להצביע בלי לנחש את ההמשך.", "Here's the next page. We can just look.", "הנה הדף הבא. אפשר פשוט להסתכל.", book),
    V(5, "Set the book aside and invite a pretend story led by your child. Follow their idea without steering toward the book's ending.", "הניחו את הספר והזמינו סיפור דמיוני בהובלת הילד/ה. עקבו אחרי הרעיון בלי לכוון אל הסוף של הספר.", "Your story now. What shall we pretend?", "עכשיו הסיפור שלך. מה נדמיין?"),
  ),
  "pr-cdc-24m-9": four(
    V(2, "In a clear space, roll a soft ball gently between you. Let your child send it back with hands or feet.", "במקום פנוי, גלגלו ביניכם כדור רך בעדינות. תנו לילד/ה להחזיר אותו בידיים או ברגליים.", "Here comes the ball. Send it your way.", "הנה הכדור. אפשר להחזיר בדרך שלך.", L("A soft ball and clear floor", "כדור רך ורצפה פנויה")),
    V(5, "In a clear space, take slow playful steps together. Let your child choose the next movement and copy it without rushing.", "במקום פנוי, עשו יחד צעדים איטיים ומשחקיים. תנו לילד/ה לבחור את התנועה הבאה וחקו אותה בלי למהר.", "A little step. What move comes next?", "צעד קטן. איזו תנועה עכשיו?"),
    V(2, "Sit close together on the floor and roll a soft ball slowly. Welcome any touch or return, with no kicking needed.", "שבו קרוב על הרצפה וגלגלו כדור רך לאט. קבלו כל נגיעה או החזרה, בלי צורך לבעוט.", "We can roll it sitting down.", "אפשר לגלגל בישיבה.", L("A soft ball", "כדור רך")),
    V(5, "Put the ball aside. Follow a movement your child chooses in a clear space, or pause together if movement does not fit now.", "הניחו את הכדור. הצטרפו לתנועה שהילד/ה בוחר/ת במקום פנוי, או עצרו יחד אם תנועה לא מתאימה עכשיו.", "Your move. Or we can take a break.", "התנועה שלך. ואפשר גם לנוח."),
  ),
  "pr-cdc-36m-7": four(
    V(2, "Make a line beside your child's drawing. Describe what you see and let them choose when to put the crayons down.", "ציירו קו לצד הציור של הילד/ה. תארו מה רואים ותנו לו/ה לבחור מתי להניח את הצבעים.", "Your line curls around. Here's mine.", "הקו שלך מתעגל. הנה שלי.", L("Paper and crayons", "נייר וצבעים")),
    V(5, "Draw pretend shapes in the air with your finger. Follow your child's movements and describe them without asking for a matching shape.", "ציירו צורות דמיוניות באוויר באצבע. עקבו אחרי התנועות של הילד/ה ותארו אותן בלי לבקש צורה תואמת.", "A line in the air. Where does yours go?", "קו באוויר. לאן הקו שלך הולך?"),
    V(2, "Offer a large crayon on paper. Any mark counts as part of the shared drawing; hold the paper steady if wanted.", "הציעו צבע עבה על דף. כל סימן הוא חלק מהציור המשותף; החזיקו את הדף במקום אם רוצים.", "There's your mark. I'll hold the paper.", "הנה הסימן שלך. אחזיק את הדף.", L("Paper and a large crayon", "נייר וצבע עבה")),
    V(5, "Set drawing aside and copy a gesture your child chooses. Make shapes together in the air, or simply watch their idea.", "הניחו לציור וחקו תנועה שהילד/ה בוחר/ת. צרו יחד צורות באוויר, או פשוט הסתכלו על הרעיון שלו/ה.", "I'll follow your hands.", "אעקוב אחרי הידיים שלך."),
  ),
  "pr-cdc-30m-1": four(
    V(2, "Offer similar toys side by side for a brief shared moment. Each child keeps their own; moving away is welcome.", "הציעו צעצועים דומים זה לצד זה לרגע משותף קצר. לכל ילד/ה צעצוע משלו/ה; אפשר גם להתרחק.", "One for each of you. Play your way.", "יש לכל אחד. אפשר לשחק בדרך שלכם.", L("Two similar age-appropriate toys", "שני צעצועים דומים שמתאימים לגיל")),
    V(5, "Sit or stand beside your child and make gentle pretend movements together. Each person can choose their own without taking turns.", "שבו או עמדו ליד הילד/ה ועשו יחד תנועות דמיוניות עדינות. כל אחד יכול לבחור תנועה משלו בלי לחכות לתור.", "My hands are birds. What will yours do?", "הידיים שלי ציפורים. מה הידיים שלך יעשו?"),
    V(2, "Stay beside your child at a comfortable distance from the other player. Watching together is enough; keep each toy with its owner.", "הישארו לצד הילד/ה במרחק שנעים לו/ה מהמשחק שלידכם. מספיק להסתכל יחד; כל צעצוע נשאר אצל מי שמשחק בו.", "We can watch from here together.", "אפשר להסתכל מפה ביחד.", L("Separate age-appropriate toys", "צעצועים נפרדים שמתאימים לגיל")),
    V(5, "Leave the shared setup and join your child's chosen play. Another child can stay nearby, with no invitation to share required.", "עזבו את הפעילות המשותפת והצטרפו למשחק שהילד/ה בוחר/ת. ילד/ה אחר/ת יכול/ה להישאר בקרבת מקום, בלי צורך להזמין או לחלוק.", "Let's follow your idea over here.", "נלך עם הרעיון שלך כאן."),
  ),
};

export function isPracticeAdaptationKey(value: unknown): value is PracticeAdaptationKey {
  return typeof value === "string" && (PRACTICE_ADAPTATION_KEYS as readonly string[]).includes(value);
}

export function adaptPractice(practice: Practice, key: PracticeAdaptationKey | null): { practice: Practice; adaptation?: PracticeAdaptationRecord } {
  const content = key ? PRACTICE_ADAPTATIONS[practice.id]?.[key] : undefined;
  if (!key || !content) return { practice };
  const { review: _review, ...base } = practice;
  return {
    practice: { ...base, ...content, reviewStatus: "draft" },
    adaptation: { ...content, key, version: 1, basePracticeId: practice.id },
  };
}

/** Restore exactly what the parent recorded, including the original copy.
 * The identifier must still belong to this activity's authored menu. */
export function restorePracticeAdaptation(practice: Practice, saved?: PracticeAdaptationRecord): { practice: Practice; adaptation?: PracticeAdaptationRecord } {
  if (!saved || saved.version !== 1 || saved.basePracticeId !== practice.id || !isPracticeAdaptationKey(saved.key) || !PRACTICE_ADAPTATIONS[practice.id]?.[saved.key]) return { practice };
  const validText = (value: unknown): value is Practice["do"] => {
    if (!value || typeof value !== "object") return false;
    const text = value as Record<string, unknown>;
    return [text.en, text.he].every((line) => typeof line === "string" && line.trim().length > 0 && line.length <= 800);
  };
  if (![2, 5, 10, 15].includes(saved.minutes) || !validText(saved.do) || !validText(saved.say) || (saved.materials !== undefined && !validText(saved.materials))) return { practice };
  const { review: _review, ...base } = practice;
  return { practice: { ...base, do: saved.do, say: saved.say, minutes: saved.minutes, materials: saved.materials, reviewStatus: "draft" }, adaptation: saved };
}

export const adaptationSessionKey = (childId: string, practiceId: string, day: string): string => JSON.stringify([childId, practiceId, day]);
