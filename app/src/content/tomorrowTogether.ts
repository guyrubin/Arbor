import type { LocalizedText } from "./governance";
const L = (en: string, he: string): LocalizedText => ({ en, he });
export interface TomorrowKit {
  id: "goodbye" | "turns" | "joining"; title: LocalizedText; intro: LocalizedText;
  scenes: { title: LocalizedText; story: LocalizedText; say: LocalizedText }[];
  play: LocalizedText;
}
/** Parent-led everyday rehearsal, ages 3–6; an invitation, never a test. */
export const TOMORROW_KITS: readonly TomorrowKit[] = [
  { id: "goodbye", title: L("A goodbye at daycare", "פרידה בגן"), intro: L("Choose a calm moment before tomorrow's goodbye. Agree the plan with the grown-up at daycare.", "בחרו רגע רגוע לפני הפרידה של מחר. תאמו את התוכנית עם הצוות בגן."), scenes: [
    { title: L("Before the door", "לפני הדלת"), story: L("We arrive together. We can notice what is around us before going in.", "אנחנו מגיעים יחד. אפשר להסתכל סביב לפני שנכנסים."), say: L("I'm here. Shall we look inside together?", "אני כאן. נסתכל יחד פנימה?") },
    { title: L("Our goodbye", "הפרידה שלנו"), story: L("We say goodbye. A familiar grown-up stays nearby. A wave or a hug can be part of our goodbye.", "אנחנו נפרדים. מבוגר מוכר נשאר קרוב. אפשר לנופף או להתחבק."), say: L("I'll say goodbye, and your teacher will stay with you.", "אני אפרד, והגננת תישאר איתך.") },
    { title: L("Together again", "שוב יחד"), story: L("The grown-up who is collecting us comes back at the time we talked about.", "מי שאוסף אותנו מגיע בזמן שעליו דיברנו."), say: L("Let's say who will collect you and when.", "בואו נגיד מי יבוא לאסוף ומתי.") },
  ], play: L("Would you like to be the grown-up, use a toy, or just watch me?", "רוצה להיות המבוגר, לשחק עם בובה, או רק להסתכל?") },
  { id: "turns", title: L("Waiting for a turn", "מחכים לתור"), intro: L("Try a short, playful rehearsal with a familiar toy. Waiting can still feel hard tomorrow.", "נסו משחק קצר עם צעצוע מוכר. גם אחרי המשחק, ההמתנה מחר יכולה להיות קשה."), scenes: [
    { title: L("Someone is using it", "מישהו משחק עכשיו"), story: L("Someone else has the toy. We can want it and still ask for a turn.", "הצעצוע אצל מישהו אחר. אפשר לרצות אותו ולבקש תור."), say: L("You want a turn. I'm here to help you ask.", "רוצה תור? אני כאן לעזור לבקש.") },
    { title: L("While we wait", "בזמן שמחכים"), story: L("We can stay near our grown-up or choose something else while we wait.", "אפשר להישאר ליד המבוגר שלנו או לבחור משהו אחר בזמן ההמתנה."), say: L("Shall we stay together or find another game?", "נישאר יחד או נמצא עוד משחק?") },
    { title: L("When a turn is possible", "כשמגיע התור"), story: L("When a turn is available, we can join. Sometimes we choose another game instead.", "כשמתפנה תור, אפשר להצטרף. לפעמים בוחרים משחק אחר."), say: L("Would you still like a turn?", "עדיין רוצה תור?") },
  ], play: L("Shall I wait first, or shall our toys take turns?", "אני אחכה קודם, או שהבובות יחכו לתור?") },
  { id: "joining", title: L("Joining a game", "מצטרפים למשחק"), intro: L("Choose a familiar kind of play. Practise an invitation without promising how another child will respond.", "בחרו משחק מוכר. תרגלו הזמנה, בלי להבטיח איך ילד אחר יגיב."), scenes: [
    { title: L("Notice the game", "מסתכלים על המשחק"), story: L("We can watch for a moment and see what the children are doing.", "אפשר להסתכל רגע ולראות במה הילדים משחקים."), say: L("What are they playing? We can look together.", "במה הם משחקים? אפשר להסתכל יחד.") },
    { title: L("Try an invitation", "מנסים להצטרף"), story: L("We can ask to join, offer an idea, or ask our grown-up for help.", "אפשר לבקש להצטרף, להציע רעיון, או לבקש עזרה ממבוגר."), say: L("Could I build with you?", "אפשר לבנות איתכם?") },
    { title: L("More than one way", "יש עוד אפשרויות"), story: L("They might say yes or no. Our grown-up can help us choose what to do next.", "הם יכולים להסכים או לסרב. המבוגר שלנו יכול לעזור לבחור מה לעשות עכשיו."), say: L("I'm with you. Shall we try another idea?", "אני איתך. ננסה רעיון אחר?") },
  ], play: L("Would you like me to ask first, or would you like to try with a toy?", "רוצה שאבקש קודם, או לנסות עם בובה?") },
];
export const fitsTomorrowKit = (months: number | null): boolean => months != null && months >= 36 && months < 84;
