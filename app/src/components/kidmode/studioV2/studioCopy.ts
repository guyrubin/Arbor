import type { StudioActivityId, StudioLanguage, StudioWorldId } from "./studioCatalog";
interface ActivityCopy { title: string; description: string; instruction: string }
interface WorldCopy { title: string; description: string; headline: string; hint: string }
interface StudioCopy {
  hello: string; helloNoName: string; invitation: string; collection: string; hero: string; noHero: string; guide: string; takeMe: string;
  quest: string; questTitle: string; questContinue: string; questOpen: string; questLoading: string; progress: (done: number) => string;
  books: string; allBooks: string; booksHint: string; activities: Record<StudioActivityId, ActivityCopy>; worlds: Record<StudioWorldId, WorldCopy>;
  play: string; kept: string; keepsake: string; keepsakeHint: string; empty: string; worldActivities: string;
}
const en: StudioCopy = {
  hello: "Hi", helloNoName: "Hi there!", invitation: "Pick a world to play in.", collection: "My keepsakes", hero: "Your hero", noHero: "A place for your hero", guide: "Tap Sprout for a hint", takeMe: "Take me",
  quest: "MY COZY CORNER", questTitle: "A cozy corner", questContinue: "Keep going", questOpen: "Visit my corner", questLoading: "Opening your corner…", progress: n => `${n} of 4 done`,
  books: "My books", allBooks: "Open my bookshelf", booksHint: "Pick a story to read.", play: "Play", kept: "Kept", keepsake: "A keepsake from your play", keepsakeHint: "Things you make and stories you finish stay in your collection.", empty: "More adventures are waiting as you grow.", worldActivities: "Pick something to play",
  worlds: {
    playbank: { title: "Playbank", description: "Find, match and discover", headline: "Back to Playbank!", hint: "Which game would you like to try?" },
    stories: { title: "Hero Stories", description: "Your stories are waiting", headline: "Your story is waiting.", hint: "Pick a book. Let’s turn the pages." },
    feelings: { title: "Feelings", description: "Every feeling belongs", headline: "Hello, feelings!", hint: "Make a cozy corner of your own." },
    studio: { title: "Studio", description: "Listen, move and make", headline: "Welcome to the Studio!", hint: "Shall we make a little music?" },
  },
  activities: {
    "river-rescue": { title: "Canal Quest", description: "Plan a path. Sail your boat.", instruction: "Build a water path, collect the supplies, and sail to the dock." },
    "feelings-forest": { title: "Story Theater", description: "Little stories. Big feelings.", instruction: "Listen to Sprout’s story, name the feeling, and choose how to help." },
    "rhythm-garden": { title: "Sound Orbit", description: "Catch a rhythm. Make it yours.", instruction: "Play the sound pods, then make a tune of your own." },
    memory: { title: "Memory Match", description: "Find the pairs", instruction: "Turn over two cards. Can you find a pair?" },
    feelings: { title: "Feelings Detective", description: "Every feeling has a story", instruction: "Listen to the story. Which feeling did they name?" },
    mimic: { title: "Mimic Studio", description: "Try a silly face", instruction: "Try the face or movement. You can pass whenever you like." },
    "sound-explorer": { title: "Sound Explorer", description: "Listen and match", instruction: "Listen to the sound, then choose what made it." },
    pattern: { title: "Sequence Quest", description: "What comes next?", instruction: "Look at the pattern. Choose what comes next." },
    "calm-builder": { title: "Calm Builder", description: "Make a place of your own", instruction: "Choose a spot, something soft, and a light for your corner." },
    beat: { title: "Rhythm Hero", description: "Tap the beat", instruction: "Watch the beat and tap along." },
    puzzle: { title: "Puzzle Planet", description: "Piece it together", instruction: "Choose a piece, then choose where it belongs." },
    sneak: { title: "Sneak & Freeze", description: "Move, then stand still", instruction: "Move when it is time to go. Freeze when the cat looks back." },
    reading: { title: "Spell Forge", description: "Play with letters", instruction: "Choose letters and discover a word." },
    adventures: { title: "Story Quest", description: "Choose your adventure", instruction: "Listen to the story and choose what happens next." },
    pose: { title: "Hero Pose", description: "Move like your hero", instruction: "Look at the pose, then try it in your own way." },
    speech: { title: "Sound Lab", description: "Play with words and sounds", instruction: "Listen to the word and try saying it." },
  },
};
const he: StudioCopy = {
  hello: "היי", helloNoName: "היי!", invitation: "בוחרים עולם לשחק בו.", collection: "המזכרות שלי", hero: "הגיבור שלך", noHero: "מקום לגיבור שלך", guide: "נוגעים בנבט לקבלת רמז", takeMe: "בואו נלך",
  quest: "הפינה הנעימה שלי", questTitle: "פינה נעימה", questContinue: "ממשיכים", questOpen: "לפינה שלי", questLoading: "פותחים את הפינה…", progress: n => `${n} מתוך 4 הושלמו`,
  books: "הספרים שלי", allBooks: "למדף הספרים שלי", booksHint: "בוחרים סיפור לקרוא.", play: "לשחק", kept: "נשמר", keepsake: "מזכרת מהמשחק שלך", keepsakeHint: "דברים שיצרת וסיפורים שסיימת נשארים באוסף שלך.", empty: "עוד הרפתקאות מחכות בהמשך.", worldActivities: "בוחרים במה לשחק",
  worlds: {
    playbank: { title: "עולם המשחקים", description: "מוצאים, מתאימים ומגלים", headline: "חוזרים לעולם המשחקים!", hint: "איזה משחק ננסה?" },
    stories: { title: "סיפורי גיבורים", description: "הסיפורים שלך מחכים", headline: "הסיפור שלך מחכה.", hint: "בוחרים ספר. נדפדף יחד." },
    feelings: { title: "עולם הרגשות", description: "יש מקום לכל רגש", headline: "שלום, רגשות!", hint: "ניצור פינה נעימה משלך." },
    studio: { title: "הסטודיו", description: "מקשיבים, זזים ויוצרים", headline: "ברוכים הבאים לסטודיו!", hint: "אולי ניצור קצת מוזיקה?" },
  },
  activities: {
    "river-rescue": { title: "מסע בתעלות", description: "מתכננים מסלול. משיטים סירה.", instruction: "בונים מסלול במים, אוספים את הציוד ושטים למזח." },
    "feelings-forest": { title: "תיאטרון הסיפורים", description: "סיפורים קטנים. רגשות גדולים.", instruction: "מקשיבים לסיפור של נבט, נותנים שם לרגש ובוחרים איך לעזור." },
    "rhythm-garden": { title: "מסלול הצלילים", description: "תופסים קצב. יוצרים מנגינה משלך.", instruction: "מנגנים על כלי הצליל ויוצרים מנגינה משלך." },
    memory: { title: "משחק הזיכרון", description: "מוצאים זוגות", instruction: "הופכים שני קלפים. איפה הזוג?" },
    feelings: { title: "בלשי הרגשות", description: "מאחורי כל רגש יש סיפור", instruction: "מקשיבים לסיפור. איזה רגש הדמות ציינה?" },
    mimic: { title: "סטודיו לחיקויים", description: "מנסים פרצוף מצחיק", instruction: "מנסים את הפרצוף או התנועה. אפשר לדלג מתי שרוצים." },
    "sound-explorer": { title: "מגלי הצלילים", description: "מקשיבים ומתאימים", instruction: "מקשיבים לצליל ובוחרים מה השמיע אותו." },
    pattern: { title: "מסע הדפוסים", description: "מה בא אחר כך?", instruction: "מביטים בדפוס ובוחרים מה בא אחר כך." },
    "calm-builder": { title: "בונים פינה נעימה", description: "יוצרים מקום משלך", instruction: "בוחרים מקום, משהו רך ותאורה לפינה שלך." },
    beat: { title: "גיבורי הקצב", description: "מקישים בקצב", instruction: "מביטים בפעימה ומקישים איתה." },
    puzzle: { title: "עולם הפאזלים", description: "מחברים חלקים", instruction: "בוחרים חלק ואז בוחרים לאן הוא שייך." },
    sneak: { title: "דג מלוח", description: "זזים ועוצרים", instruction: "זזים כשהחתול לא מסתכל. קופאים כשהוא מסתובב." },
    reading: { title: "קסם האותיות", description: "משחקים באותיות", instruction: "בוחרים אותיות ומגלים מילה." },
    adventures: { title: "מסע הסיפורים", description: "בוחרים הרפתקה", instruction: "מקשיבים לסיפור ובוחרים מה יקרה בהמשך." },
    pose: { title: "תנוחת גיבור", description: "זזים כמו הגיבור שלך", instruction: "מביטים בתנוחה ומנסים אותה בדרך שלך." },
    speech: { title: "מעבדת הצלילים", description: "משחקים במילים ובצלילים", instruction: "מקשיבים למילה ומנסים לומר אותה." },
  },
};
export function studioCopy(lang: StudioLanguage): StudioCopy { return lang === "he" ? he : en; }
