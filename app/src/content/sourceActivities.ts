import type { LocalizedText } from "./governance";
import type { PlayActivity, PlayDomain } from "../playbank/content";

/** Original Arbor activity wording, informed by the linked public guidance.
 * Source verification is NOT clinical approval or an institutional partnership.
 * This bounded editorial pilot expires with the existing hard-moment pilot. */
export interface SourceActivity {
  id: string; title: LocalizedText; do: LocalizedText; say: LocalizedText;
  materials: LocalizedText; domain: PlayDomain; minMonths: number; maxMonths: number;
  source: string; checkedAt: string; reviewStatus: "draft" | "withdrawn";
}
const L = (en: string, he: string): LocalizedText => ({ en, he });
const source = (age: number) => `https://me.health.gov.il/parenting/age-menu/${age}-${age + 1}-years/grow-${age}-${age + 1}-years/`;
const A = (n: number, age: number, domain: PlayDomain, title: LocalizedText, action: LocalizedText, say: LocalizedText, materials = L("None", "ללא ציוד")): SourceActivity => ({
  id: `moh-play-${String(n).padStart(2, "0")}`, title, do: action, say, materials, domain,
  minMonths: age * 12, maxMonths: (age + 1) * 12 - 1, source: source(age), checkedAt: "2026-10-08", reviewStatus: "draft",
});
export const SOURCE_ACTIVITIES: readonly SourceActivity[] = [
  A(1, 2, "language", L("Pack together", "אורזים יחד"), L("Name familiar things while packing a bag together.", "תנו שמות לחפצים מוכרים כשאורזים יחד תיק."), L("Our hat goes here.", "הכובע שלנו נכנס לכאן."), L("A bag and everyday items", "תיק וחפצים יומיומיים")),
  A(2, 2, "language", L("Picture pause", "עוצרים בתמונה"), L("Pause at a picture your child notices. Follow their pointing.", "עצרו בתמונה שמעניינת את הילד או הילדה. עקבו אחרי ההצבעה."), L("What caught your eye?", "מה מעניין כאן?"), L("A picture book", "ספר תמונות")),
  A(3, 2, "motor", L("Big paper", "דף גדול"), L("Draw beside your child. Describe your own marks.", "ציירו לצד הילד או הילדה. תארו את הקווים שלכם."), L("My line goes around.", "הקו שלי מסתובב."), L("Paper and age-suitable crayons", "דף וצבעים מתאימים לגיל")),
  A(4, 2, "social", L("Teddy's day", "היום של הדובי"), L("Let your child choose what teddy does. Join their pretend play.", "תנו לילד או לילדה לבחור מה הדובי עושה. הצטרפו למשחק."), L("What is teddy doing?", "מה הדובי עושה?"), L("A soft toy", "בובה רכה")),
  A(5, 2, "social", L("Getting dressed", "מתלבשים יחד"), L("Leave time for your child to join in dressing.", "השאירו זמן לילד או לילדה להשתתף בלבוש."), L("Would you like a hand?", "אפשר לעזור?"), L("Today's clothes", "הבגדים של היום")),
  A(6, 2, "cognitive", L("In and out", "פנימה והחוצה"), L("Explore nesting large empty containers together.", "נסו יחד להכניס קופסאות גדולות וריקות זו לתוך זו."), L("Will this fit inside?", "זה ייכנס פנימה?"), L("Large plastic containers; no small parts", "קופסאות פלסטיק גדולות, ללא חלקים קטנים")),
  A(7, 2, "language", L("A familiar moment", "רגע מוכר"), L("Connect a book picture to something you did together.", "חברו תמונה בספר למשהו שעשיתם יחד."), L("We saw a dog too.", "גם אנחנו ראינו כלב."), L("A picture book", "ספר תמונות")),
  A(8, 3, "motor", L("Roll it back", "מגלגלים בחזרה"), L("Sit together on the floor and roll a soft ball.", "שבו יחד על הרצפה וגלגלו כדור רך."), L("Here comes the ball.", "הנה הכדור מגיע."), L("A soft ball and clear floor", "כדור רך ורצפה פנויה")),
  A(9, 3, "language", L("Their story", "הסיפור שלהם"), L("Invite your child to tell a story from a picture.", "הזמינו את הילד או הילדה לספר סיפור מתוך תמונה."), L("What happens here?", "מה קורה כאן?"), L("A picture book", "ספר תמונות")),
  A(10, 3, "motor", L("Dough together", "בצק יחד"), L("Shape dough side by side, following your child's ideas.", "צרו בבצק זה לצד זה, בעקבות הרעיונות של הילד או הילדה."), L("Tell me about this.", "מה יצרת כאן?"), L("Age-suitable play dough; supervise, not for eating", "בצק משחק מתאים לגיל; בהשגחה, לא לאכילה")),
  A(11, 3, "social", L("A pretend shop", "חנות בכאילו"), L("Let your child choose roles in a pretend shop.", "תנו לילד או לילדה לבחור תפקידים בחנות דמיונית."), L("What is in your shop?", "מה יש בחנות שלך?"), L("Large familiar toys", "צעצועים מוכרים וגדולים")),
  A(12, 3, "social", L("A place for clothes", "מקום לבגדים"), L("Put clothes away together, letting your child take a part.", "סדרו בגדים יחד ותנו לילד או לילדה להשתתף."), L("Where shall this go?", "לאן זה נכנס?"), L("Clothes and an accessible shelf", "בגדים ומדף נגיש")),
  A(13, 3, "cognitive", L("You choose", "הבחירה שלך"), L("Set aside free play time. Let your child lead.", "פנו זמן למשחק חופשי. תנו לילד או לילדה להוביל."), L("What shall we play?", "במה נשחק?")),
  A(14, 3, "language", L("Draw and tell", "מציירים ומספרים"), L("Listen as your child talks about a drawing.", "הקשיבו כשהילד או הילדה מספרים על ציור."), L("I'm listening.", "יש לי זמן להקשיב."), L("Paper and age-suitable crayons", "דף וצבעים מתאימים לגיל")),
  A(15, 4, "language", L("Tomorrow's moment", "רגע של מחר"), L("Talk about one familiar thing happening tomorrow.", "דברו על דבר מוכר אחד שיקרה מחר."), L("Tomorrow we'll walk together.", "מחר נלך יחד.")),
  A(16, 4, "cognitive", L("Set the table", "עורכים שולחן"), L("Count unbreakable cups together while setting the table.", "ספרו יחד כוסות לא שבירות כשעורכים שולחן."), L("Who needs a cup?", "למי עוד חסרה כוס?"), L("Unbreakable cups", "כוסות לא שבירות")),
  A(17, 4, "motor", L("A floor path", "שביל על הרצפה"), L("Follow an imaginary path on clear, level ground together.", "לכו יחד בשביל דמיוני על רצפה ישרה ופנויה."), L("Shall we walk together?", "נלך יחד?")),
  A(18, 4, "social", L("Join the game", "מצטרפים למשחק"), L("Offer to stand nearby while your child approaches a game.", "הציעו לעמוד קרוב כשהילד או הילדה ניגשים למשחק."), L("Would you like me nearby?", "להישאר קרוב?")),
  A(19, 4, "language", L("Wonder together", "תוהים יחד"), L("Pause during a story and wonder about a character.", "עצרו במהלך סיפור ותהו יחד על אחת הדמויות."), L("What might happen next?", "מה אולי יקרה עכשיו?"), L("A storybook", "ספר סיפורים")),
  A(20, 4, "social", L("Build a place", "בונים מקום"), L("Build an imaginary place together. Let your child direct.", "בנו יחד מקום דמיוני. תנו לילד או לילדה לכוון."), L("Where shall I put this?", "איפה לשים את זה?"), L("Large building blocks", "קוביות בנייה גדולות")),
];

export function availableSourceActivities(months: number | null, now = new Date()): SourceActivity[] {
  if (months == null || !Number.isFinite(months) || now < new Date("2026-10-08T00:00:00Z") || now >= new Date("2026-12-03T00:00:00Z")) return [];
  return SOURCE_ACTIVITIES.filter(a => a.reviewStatus === "draft" && months >= a.minMonths && months <= a.maxMonths);
}
export const sourceActivityForLog = (a: SourceActivity, lang: "en" | "he"): PlayActivity => ({
  id: a.id, title: a.title[lang], bands: [a.minMonths < 36 ? "toddler" : "preschool"], domain: a.domain,
  skillTags: [], householdItems: [a.materials[lang]], whatItBuilds: "", steps: [a.do[lang], a.say[lang]], durationMin: 5,
  source: { name: lang === "he" ? "הורות והורים — משרד הבריאות" : "Parenting — Israel Ministry of Health", org: "Israel Ministry of Health", url: a.source, kind: "guideline" },
});
