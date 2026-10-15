export type Feeling = 'sad' | 'worried' | 'angry' | 'excited' | 'proud' | 'lonely';
export type KindAction = 'together' | 'space' | 'help';
type LocalText = { en: string; he: string };
export interface ForestStory { id: string; feeling: Feeling; story: LocalText; responses: Record<KindAction, LocalText> }
export const FEELING_NAMES: Record<Feeling, LocalText> = {
  sad: { en: 'Sad', he: 'עצב' }, worried: { en: 'Worried', he: 'דאגה' }, angry: { en: 'Angry', he: 'כעס' },
  excited: { en: 'Excited', he: 'התרגשות' }, proud: { en: 'Proud', he: 'גאווה' }, lonely: { en: 'Lonely', he: 'בדידות' },
};
export const ACTION_NAMES: Record<KindAction, LocalText> = {
  together: { en: 'Offer company', he: 'להציע חברה' }, space: { en: 'Offer some space', he: 'להציע קצת מרחב' }, help: { en: 'Ask what might help', he: 'לשאול מה יכול לעזור' },
};
/** Explicit self-reports, never facial diagnosis. Every support choice is valid;
 * the response models asking permission instead of making a feeling disappear. */
export const FOREST_STORIES: readonly ForestStory[] = [
  { id: 'tower', feeling: 'sad', story: { en: '“My little tower fell over. I feel sad,” says Sprout.', he: '״המגדל הקטן שלי נפל. אני מרגיש עצב,״ אומר נבט.' }, responses: {
    together: { en: '“Would you like me to sit with you?” Sprout nods. You sit together. The sadness can stay.', he: '״רוצה שאשב לידך?״ נבט מהנהן. יושבים יחד. מותר לעצב להישאר.' },
    space: { en: '“Would a quiet moment help?” Sprout says yes. You stay nearby until Sprout is ready.', he: '״רגע שקט יכול לעזור?״ נבט אומר שכן. נשארים קרוב עד שיתאים לו.' },
    help: { en: '“What would help?” Sprout says, “Maybe we could build it again, when I’m ready.”', he: '״מה יכול לעזור?״ נבט אומר, ״אולי נבנה שוב, כשאהיה מוכן.״' },
  } },
  { id: 'new-path', feeling: 'worried', story: { en: '“This path is new to me. I feel worried,” says Sprout.', he: '״אני לא מכיר את השביל הזה. אני מרגיש דאגה,״ אומר נבט.' }, responses: {
    together: { en: '“Shall we walk together?” Sprout says yes. You take one small step side by side.', he: '״נלך יחד?״ נבט אומר שכן. עושים צעד קטן זה לצד זה.' },
    space: { en: '“Would you like a moment to look?” Sprout looks at the path. There is no hurry.', he: '״רוצה רגע להסתכל?״ נבט מביט בשביל. לא ממהרים.' },
    help: { en: '“What would help?” Sprout asks to see the map. You look at it together.', he: '״מה יכול לעזור?״ נבט מבקש לראות מפה. מסתכלים בה יחד.' },
  } },
  { id: 'turn', feeling: 'angry', story: { en: '“I was still using those blocks. I feel angry,” says Sprout.', he: '״עוד שיחקתי בקוביות האלה. אני מרגיש כעס,״ אומר נבט.' }, responses: {
    together: { en: '“I can stay with you.” Sprout says, “Yes, please.” You listen without rushing.', he: '״אני יכול להישאר איתך.״ נבט אומר, ״כן, בבקשה.״ מקשיבים בלי למהר.' },
    space: { en: '“Would you like some space?” Sprout takes a quiet moment. Feeling angry is allowed.', he: '״רוצה קצת מרחב?״ נבט לוקח רגע שקט. מותר לכעוס.' },
    help: { en: '“What do you want to say?” Sprout practises: “I’m still using these. You can have a turn next.”', he: '״מה תרצה לומר?״ נבט מתאמן: ״עוד לא סיימתי. אחר כך יהיה תורך.״' },
  } },
  { id: 'picnic', feeling: 'excited', story: { en: '“The picnic is today! I feel excited,” says Sprout.', he: '״הפיקניק היום! אני מרגיש התרגשות,״ אומר נבט.' }, responses: {
    together: { en: '“Can I celebrate with you?” Sprout smiles. You do a little happy wiggle together.', he: '״אפשר לשמוח איתך?״ נבט מחייך. עושים יחד תנועת שמחה קטנה.' },
    space: { en: '“Want a moment to enjoy it?” Sprout pictures the picnic. Big happy feelings belong too.', he: '״רוצה רגע ליהנות מזה?״ נבט מדמיין את הפיקניק. גם לשמחה גדולה יש מקום.' },
    help: { en: '“What shall we pack?” Sprout picks a blanket. You get ready together.', he: '״מה נארוז?״ נבט בוחר שמיכה. מתכוננים יחד.' },
  } },
  { id: 'seed', feeling: 'proud', story: { en: '“I kept caring for my seed, and it grew! I feel proud,” says Sprout.', he: '״המשכתי לטפל בזרע שלי, והוא צמח! אני מרגיש גאווה,״ אומר נבט.' }, responses: {
    together: { en: '“Can you show me?” Sprout points to the new leaf. You notice the care it took.', he: '״תראה לי?״ נבט מצביע על העלה החדש. שמים לב לטיפול שהשקיע.' },
    space: { en: '“Want a quiet moment with your plant?” Sprout sits beside it and enjoys what grew.', he: '״רוצה רגע שקט עם הצמח?״ נבט יושב לידו ונהנה ממה שצמח.' },
    help: { en: '“What would you like to do next?” Sprout chooses a spot where the plant can get light.', he: '״מה תרצה לעשות עכשיו?״ נבט בוחר מקום שבו הצמח יקבל אור.' },
  } },
  { id: 'bench', feeling: 'lonely', story: { en: '“I wanted someone to play with. I feel lonely,” says Sprout.', he: '״רציתי שמישהו ישחק איתי. אני מרגיש בדידות,״ אומר נבט.' }, responses: {
    together: { en: '“Would you like to play with me?” Sprout says yes. You choose a game together.', he: '״רוצה לשחק איתי?״ נבט אומר שכן. בוחרים משחק יחד.' },
    space: { en: '“Would a little space help first?” Sprout says, “Just a moment, then I’d like company.” You stay nearby.', he: '״קצת מרחב יעזור קודם?״ נבט אומר, ״רק רגע, ואז ארצה חברה.״ נשארים קרוב.' },
    help: { en: '“Who could we invite?” Sprout thinks of a friend. You ask a grown-up to help you invite them.', he: '״את מי נזמין?״ נבט חושב על חבר. מבקשים ממבוגר עזרה בהזמנה.' },
  } },
];
