/**
 * Learn Library seed catalogue — batch A (minds · language · feelings ·
 * behavior · sleep). Editorial stance per learnLibrary.ts design rules:
 * general developmental education, wide-normal ranges, no diagnosis-shaped
 * copy. EN/HE are parallel transcreations, not translations.
 */
import type { LocalizedText } from "../content/governance";
import type { LearnCard } from "./learnLibrary";

const L = (en: string, he: string): LocalizedText => ({ en, he });

export const LEARN_CARDS_CORE: LearnCard[] = [
  // ── Growing Minds ────────────────────────────────────────────────────────
  {
    id: "theory-of-mind",
    category: "minds",
    domains: ["cognition_executive_function", "social_development"],
    ageMin: 3,
    ageMax: 6,
    minutes: 4,
    title: L("Theory of mind: when children discover other people have thoughts", "תיאוריית המיינד: הרגע שבו ילדים מגלים שלאחרים יש מחשבות"),
    hook: L("Around age four, a quiet revolution happens: your child realizes that what's in their head isn't in everyone's head.", "בסביבות גיל ארבע מתרחשת מהפכה שקטה: הילד מגלה שמה שנמצא בראש שלו לא נמצא בראש של כולם."),
    keyPoints: [
      L("Theory of mind is the ability to understand that others have their own thoughts, beliefs and desires — different from yours.", "תיאוריית המיינד היא היכולת להבין שלאנשים אחרים יש מחשבות, אמונות ורצונות משלהם — שונים משלך."),
      L("Younger children often assume everyone knows what they know; realizing that beliefs can differ from reality is a genuine milestone.", "ילדים צעירים נוטים להניח שכולם יודעים מה שהם יודעים; ההבנה שאמונות יכולות להיות שונות מהמציאות היא אבן דרך אמיתית."),
      L("It typically unfolds between ages three and five, with wide, healthy variation from child to child.", "היכולת מתפתחת בדרך כלל בין גיל שלוש לחמש, עם שונות רחבה ובריאה בין ילדים."),
      L("It powers social life: predicting what a friend will do, comforting, negotiating, sharing a joke — even early fibbing is a sign it's growing.", "היא מניעה את החיים החברתיים: לנבא מה חבר יעשה, לנחם, לנהל משא ומתן, להבין בדיחה — אפילו שקרים ראשונים הם סימן שהיא מתפתחת."),
      L("Pretend play, sibling chats and books about characters' feelings are its daily gym; no drills needed.", "משחק דמיוני, שיחות עם אחים וספרים על רגשות של דמויות הם חדר הכושר היומי שלה; אין צורך בתרגול מכוון."),
    ],
    body: L(
      "Hold up a crayon box that turns out to contain buttons, and a three-year-old will insist that everyone else will also expect buttons. A five-year-old grins: they know a friend will be fooled, just as they were. That grin marks one of the most important developments of early childhood — theory of mind, the understanding that minds hold beliefs, and beliefs can be wrong.\n\nBefore this shift, children aren't being self-centered on purpose; other perspectives simply aren't visible to them yet. As theory of mind comes online, the social world lights up. Children begin to predict and explain other people's behavior, cooperate and compete with intention, comfort a sad friend, and understand that a story character can believe something the reader knows is false. Language grows alongside it: words like think, know, forget and hope appear more often, and pretend play gets richer because every role requires imagining another mind.\n\nYou may also meet its cheekier side. A child who tells you they definitely did not eat the cookie, with chocolate on their chin, is demonstrating a new discovery: you don't automatically know what they know. Developmentally, that first clumsy fib is less a character concern and more a cognitive leap.\n\nEveryday life feeds this ability naturally. Conversations about what people feel and why, wondering aloud about a character's plan, and lots of unhurried pretend play all give a child practice at stepping into other minds. The range is wide, and pace says nothing on its own; if communication overall feels worrying to you, that's a good conversation to have with your pediatric professional rather than a conclusion to draw at home.",
      "הראו לילד בן שלוש קופסת צבעים שמתגלה כמלאה בכפתורים, והוא יתעקש שגם כל אחד אחר יצפה לכפתורים. ילד בן חמש כבר מחייך: הוא יודע שחבר שלו יתבלבל, בדיוק כמוהו. החיוך הזה מסמן את אחת ההתפתחויות החשובות של הילדות המוקדמת — תיאוריית המיינד, ההבנה שבתוך ראשים יש אמונות, ושאמונות יכולות להיות שגויות.\n\nלפני השינוי הזה, ילדים אינם אגוצנטריים בכוונה; נקודות מבט אחרות פשוט עדיין אינן נראות להם. כשתיאוריית המיינד מבשילה, העולם החברתי נדלק. ילדים מתחילים לנבא ולהסביר התנהגות של אחרים, לשתף פעולה ולהתחרות בכוונה, לנחם חבר עצוב, ולהבין שדמות בסיפור יכולה להאמין במשהו שהקורא יודע שאינו נכון. השפה צומחת יחד עם זה: מילים כמו חושב, יודע, שכח ומקווה מופיעות יותר, והמשחק הדמיוני מתעשר, כי כל תפקיד דורש לדמיין מוח אחר.\n\nתפגשו גם את הצד השובב שלה. ילד שמצהיר שהוא ממש לא אכל את העוגייה, עם שוקולד על הסנטר, מדגים תגלית חדשה: אתם לא יודעים אוטומטית מה שהוא יודע. מבחינה התפתחותית, השקר הראשון והמגושם הזה הוא פחות עניין של אופי ויותר קפיצה קוגניטיבית.\n\nהחיים היומיומיים מזינים את היכולת הזאת באופן טבעי. שיחות על מה אנשים מרגישים ולמה, תהייה בקול על התוכנית של דמות בספר, והרבה משחק דמיוני רגוע — כל אלה מאמנים את הילד להיכנס למוחות אחרים. הטווח רחב, והקצב לבדו אינו אומר דבר; אם התקשורת בכללותה מדאיגה אתכם, זו שיחה טובה לקיים עם איש מקצוע, לא מסקנה להסיק בבית."
    ),
    tryToday: L(
      "During tonight's story, pause and ask: \"What does she think is in the box? What do WE know?\" Guessing at a character's mind is theory-of-mind practice disguised as reading.",
      "בסיפור של הערב, עצרו ושאלו: \"מה היא חושבת שיש בקופסה? ומה אנחנו יודעים?\" ניחוש המחשבות של דמות הוא אימון בתיאוריית המיינד במסווה של הקראה."
    ),
    ask: L("What signs of theory of mind might I notice in my child this month?", "אילו סימנים של תיאוריית המיינד אוכל לזהות אצל הילד שלי החודש?"),
  },
  {
    id: "executive-function",
    category: "minds",
    domains: ["cognition_executive_function"],
    ageMin: 2,
    ageMax: 8,
    minutes: 4,
    title: L("Executive function: the brain's air-traffic control", "תפקודים ניהוליים: מגדל הפיקוח של המוח"),
    hook: L("Holding a plan in mind, resisting an impulse, switching gears — these skills predict school success more than early academics do.", "להחזיק תוכנית בראש, לעצור דחף, להחליף הילוך — המיומנויות האלה חשובות להצלחה בבית הספר יותר מלימוד מוקדם."),
    keyPoints: [
      L("Executive function is a family of three skills: working memory, inhibition (impulse control) and cognitive flexibility.", "תפקודים ניהוליים הם משפחה של שלוש מיומנויות: זיכרון עבודה, עכבה (שליטה בדחפים) וגמישות מחשבתית."),
      L("It develops slowly — the brain regions behind it mature into the mid-twenties — so young children genuinely cannot 'just control themselves' yet.", "הם מתפתחים לאט — אזורי המוח שמאחוריהם מבשילים עד אמצע שנות העשרים — ולכן ילדים צעירים באמת עדיין לא מסוגלים 'פשוט להתאפק'."),
      L("Games with rules that flip — freeze dance, Simon Says, red-light-green-light — are among the best-studied everyday builders.", "משחקים עם חוקים מתחלפים — פסלים, המלך אמר, אור אדום אור ירוק — הם מהמאמנים היומיומיים הנחקרים ביותר."),
      L("Routines are external executive function: a predictable sequence lets the child practice running a plan before their brain can do it alone.", "שגרה היא תפקוד ניהולי חיצוני: רצף צפוי מאפשר לילד לתרגל הפעלת תוכנית לפני שהמוח שלו מסוגל לכך לבד."),
      L("Expect it to wobble when a child is tired, hungry or overwhelmed; capacity is real but shallow at this age.", "צפו לתנודות כשהילד עייף, רעב או מוצף; היכולת אמיתית אבל שברירית בגילים האלה."),
    ],
    body: L(
      "Every time a child waits for a turn, remembers a two-step instruction, or shifts from park mode to bath mode without falling apart, they are exercising executive function: the set of mental skills that manage attention, impulses and plans. Researchers usually describe three strands. Working memory holds information in mind and works with it. Inhibitory control stops the first impulse long enough to choose a response. Cognitive flexibility switches between rules or perspectives when the situation changes.\n\nThese skills live largely in the prefrontal cortex, one of the slowest-maturing parts of the brain. That timeline matters for expectations: a preschooler who grabs, interrupts or melts down at a transition is not failing at self-control — the machinery is still under construction. What adults provide in the meantime is scaffolding: predictable routines, warnings before transitions, naming the plan out loud, and breaking tasks into steps the child can hold.\n\nPlay is the training ground research keeps pointing to. Games where a rule must be remembered and an action inhibited — freeze when the music stops, do it only when Simon says — ask exactly the muscles executive function is made of. Pretend play does too, because staying in role means following internal rules. Cooking together, board games and even setting the table give working memory a friendly workout.\n\nExecutive function grows across the whole of childhood, and rough days are part of the curve, not a verdict. The most useful daily move is adjusting the load: fewer instructions at once, calmer transitions, one plan spoken aloud. The skills firm up with thousands of small repetitions in a context that doesn't overwhelm them.",
      "בכל פעם שילד מחכה לתורו, זוכר הוראה בת שני שלבים, או עובר ממצב גן־שעשועים למצב אמבטיה בלי להתפרק — הוא מפעיל תפקודים ניהוליים: מערך המיומנויות שמנהל קשב, דחפים ותוכניות. חוקרים מתארים בדרך כלל שלושה חוטים. זיכרון עבודה מחזיק מידע בראש ופועל איתו. עכבה עוצרת את הדחף הראשון מספיק זמן כדי לבחור תגובה. גמישות מחשבתית מחליפה בין חוקים או נקודות מבט כשהמצב משתנה.\n\nהמיומנויות האלה שוכנות בעיקר בקליפה הקדם־מצחית, מהאזורים האיטיים ביותר להבשיל במוח. ללוח הזמנים הזה יש משמעות לציפיות: ילד גן שחוטף, קוטע או קורס במעבר אינו נכשל בשליטה עצמית — המנגנון עדיין בבנייה. מה שמבוגרים מספקים בינתיים הוא פיגומים: שגרה צפויה, התרעה לפני מעברים, אמירת התוכנית בקול, ופירוק משימות לצעדים שהילד יכול להחזיק.\n\nמשחק הוא מגרש האימונים שהמחקר מצביע עליו שוב ושוב. משחקים שבהם צריך לזכור חוק ולעצור פעולה — לקפוא כשהמוזיקה נעצרת, לפעול רק כשהמלך אמר — מפעילים בדיוק את השרירים שמהם עשויים התפקודים הניהוליים. גם משחק דמיוני, כי להישאר בתפקיד פירושו לציית לחוקים פנימיים. בישול משותף, משחקי קופסה ואפילו עריכת שולחן נותנים לזיכרון העבודה אימון ידידותי.\n\nתפקודים ניהוליים צומחים לאורך כל הילדות, וימים קשים הם חלק מהעקומה, לא גזר דין. המהלך היומיומי המועיל ביותר הוא התאמת העומס: פחות הוראות בבת אחת, מעברים רגועים יותר, תוכנית אחת שנאמרת בקול. המיומנויות מתייצבות דרך אלפי חזרות קטנות בסביבה שלא מציפה אותן."
    ),
    tryToday: L(
      "Play one round of freeze dance before dinner. Stopping a body mid-move on cue is inhibition practice — and it reliably ends in giggles.",
      "שחקו סיבוב אחד של פסלים לפני ארוחת הערב. לעצור את הגוף באמצע תנועה לפי סימן זה תרגול עכבה — ובדרך כלל זה נגמר בצחקוקים."
    ),
    ask: L("Which everyday games would build my child's executive function right now?", "אילו משחקים יומיומיים יחזקו עכשיו את התפקודים הניהוליים של הילד שלי?"),
  },

  // ── Language & Communication ─────────────────────────────────────────────
  {
    id: "serve-and-return",
    category: "language",
    domains: ["language_communication", "attachment_regulation"],
    ageMin: 0,
    ageMax: 3,
    minutes: 3,
    title: L("Serve and return: the conversation loop that builds language", "הגשה וחזרה: לולאת השיחה שבונה שפה"),
    hook: L("Long before words, your baby is holding up their end of a conversation — and your reply is the active ingredient.", "הרבה לפני המילים, התינוק שלכם כבר מחזיק בצד שלו בשיחה — והתגובה שלכם היא החומר הפעיל."),
    keyPoints: [
      L("A coo, a point, a look — each is a 'serve'; responding with attention and words is the 'return' that wires language circuits.", "המיה, הצבעה, מבט — כל אחד מהם הוא 'הגשה'; תגובה בקשב ובמילים היא ה'חזרה' שמחווטת מעגלי שפה."),
      L("Back-and-forth turns matter more than word counts: alternating exchanges are a stronger ingredient than volume of speech alone.", "חילופי תורות הלוך ושוב חשובים יותר מספירת מילים: התחלפות בשיחה היא מרכיב חזק יותר מכמות דיבור בלבד."),
      L("Following the child's focus works best — talk about what they are looking at, not what you wish they'd look at.", "הכי טוב ללכת אחרי המיקוד של הילד — לדבר על מה שהוא מסתכל עליו, לא על מה שהייתם רוצים שיסתכל עליו."),
      L("Pauses are part of the loop: leaving space for a reply, even pre-verbal, teaches the rhythm of dialogue.", "השתיקות הן חלק מהלולאה: להשאיר מקום לתשובה, גם קדם־מילולית, מלמד את מקצב הדו־שיח."),
      L("Any language you speak richly at home is the right language for this; the loop transfers across languages.", "כל שפה שאתם דוברים בעושר בבית היא השפה הנכונה לזה; הלולאה עוברת בין שפות."),
    ],
    body: L(
      "Watch a parent and a ten-month-old 'chat' and you'll see a real conversation with only one fluent speaker. The baby babbles; the parent answers as if it meant something; the baby answers back. Developmental science calls this serve and return, and it is one of the most consistent findings in early language research: the number of these back-and-forth exchanges relates to language growth more strongly than the sheer quantity of words a child overhears.\n\nThe mechanism is attention. When a child serves — a look, a gesture, a sound — their brain is maximally tuned to what comes next. A return that meets that exact moment (\"Yes! That's the dog. He's digging!\") lands on open circuits. The same sentence delivered while the child is focused elsewhere does far less. This is why following the child's gaze beats redirecting it, and why screens, which cannot time their responses to a particular child's serves, are a weak substitute for a person.\n\nThe loop also carries emotional weight. Being answered teaches a baby that their signals move the world, which is the root of both communication and confidence. And it is wonderfully low-tech: narrating the vegetable aisle, echoing a toddler's two words back as three (\"Big truck!\" — \"Yes, a big red truck!\"), waiting an extra beat for their turn. In bilingual homes the loop works in every language you love; richness and responsiveness, not a specific language, are the ingredients.\n\nNo counting or performance is required. A handful of unhurried exchanges over breakfast is a genuine language lesson.",
      "הביטו בהורה ותינוק בן עשרה חודשים 'משוחחים' ותראו שיחה אמיתית שבה רק דובר אחד שולט בשפה. התינוק ממלמל; ההורה עונה כאילו זה אמר משהו; התינוק עונה בחזרה. מדע ההתפתחות קורא לזה הגשה וחזרה, וזה מהממצאים העקביים ביותר במחקר שפה מוקדם: מספר חילופי ההלוך־ושוב האלה קשור לצמיחת השפה יותר מכמות המילים שהילד שומע ברקע.\n\nהמנגנון הוא קשב. כשילד מגיש — מבט, מחווה, צליל — המוח שלו מכוון בשיא למה שיבוא עכשיו. חזרה שפוגשת בדיוק את הרגע הזה (\"כן! זה הכלב. הוא חופר!\") נוחתת על מעגלים פתוחים. אותו משפט שנאמר כשהילד ממוקד במשהו אחר עושה הרבה פחות. לכן ללכת אחרי המבט של הילד עדיף על להסיט אותו, ולכן מסכים — שאינם יכולים לתזמן את תגובותיהם להגשות של ילד מסוים — הם תחליף חלש לאדם.\n\nללולאה יש גם משקל רגשי. לקבל מענה מלמד תינוק שהאותות שלו מזיזים את העולם — וזה השורש של תקשורת וגם של ביטחון. וזה נפלא בפשטותו: לתאר את מדף הירקות בקול, להחזיר שתי מילים של פעוט כשלוש (\"משאית גדולה!\" — \"כן, משאית אדומה וגדולה!\"), לחכות עוד רגע לתור שלו. בבתים דו־לשוניים הלולאה עובדת בכל שפה שאתם אוהבים; העושר וההיענות הם המרכיבים, לא שפה מסוימת.\n\nלא נדרשות ספירות או הופעות. כמה חילופים רגועים על הבוקר הם שיעור שפה אמיתי."
    ),
    tryToday: L(
      "Pick one routine — diaper change, snack, stroller ride — and return every serve for five minutes: meet the look, name the thing, wait for the reply.",
      "בחרו שגרה אחת — החתלה, חטיף, טיול בעגלה — והחזירו כל הגשה במשך חמש דקות: פגשו את המבט, תנו שם לדבר, חכו לתשובה."
    ),
    ask: L("How can I get more back-and-forth exchanges into our day?", "איך להכניס יותר חילופי הגשה־וחזרה ליום שלנו?"),
  },
  {
    id: "late-talker-ranges",
    category: "language",
    domains: ["language_communication"],
    ageMin: 1,
    ageMax: 3,
    minutes: 4,
    title: L("Late talker or wide normal? What the ranges really say", "מדבר מאוחר או טווח רחב? מה הטווחים באמת אומרים"),
    hook: L("The distance between 'early talker' and 'late-but-fine' is enormous — and understanding matters more than talking.", "המרחק בין 'מדבר מוקדם' ל'מאוחר אבל בסדר' הוא עצום — והבנה חשובה יותר מדיבור."),
    keyPoints: [
      L("First words commonly arrive anywhere from 9 to 18 months; two-word combinations often between 18 and 30 months. The normal band is wide.", "מילים ראשונות מגיעות בדרך כלל בין 9 ל־18 חודשים; צירופי שתי מילים לרוב בין 18 ל־30 חודשים. הטווח התקין רחב."),
      L("Comprehension leads production: a child who follows simple requests and points to named things is building language even while quiet.", "הבנה מקדימה הפקה: ילד שמבצע בקשות פשוטות ומצביע על דברים שנקראים בשמם בונה שפה גם כשהוא שקט."),
      L("Gestures are language: pointing, waving and showing predict spoken vocabulary and count as communication.", "מחוות הן שפה: הצבעה, נפנוף והושטה מנבאות אוצר מילים דבור ונחשבות תקשורת."),
      L("Bilingual children may split vocabulary across languages; counting words in only one language undercounts them.", "ילדים דו־לשוניים מפצלים אוצר מילים בין שפות; ספירה בשפה אחת בלבד מחסירה."),
      L("What earns a professional conversation is a pattern — little understanding, few gestures, loss of skills, or your own persistent worry — not a single number on a single day.", "מה שמצדיק שיחה עם איש מקצוע הוא דפוס — הבנה מועטה, מעט מחוות, אובדן מיומנויות, או דאגה מתמשכת שלכם — לא מספר בודד ביום בודד."),
    ],
    body: L(
      "Few comparisons generate more quiet worry than language. One eighteen-month-old narrates the playground; another says three words and runs it. Both can be developing perfectly well, because expressive language has one of the widest normal ranges in early childhood.\n\nThe picture is clearer when you look at the whole communication system rather than the word count. Receptive language — what a child understands — typically runs ahead of speech and is the stronger signal. So are gestures: a toddler who points at what they want, brings you things to show, waves and shakes their head is communicating richly, and research finds early gesture use predicts later vocabulary. A quiet child with strong understanding, busy gestures and social engagement is usually a child on their own schedule.\n\nBilingual homes deserve a special note. A child learning two languages spreads early words across both; counted together, their vocabulary is typically on pace. Mixing languages in one sentence is normal skill, not confusion.\n\nThere are patterns worth raising with a professional, without alarm and without waiting for a birthday: if understanding seems limited, if gestures are few, if a child stops using words they had, or if you simply carry a persistent feeling that something is off. Speech-language professionals would rather see a family early and say 'all well' than late. In the meantime, the daily work is the same for every child: responsive conversation, books, songs, and time — served in whichever languages your family loves.",
      "מעט השוואות מייצרות דאגה שקטה כמו שפה. פעוט אחד בן שנה וחצי מדקלם את כל הגן; אחר אומר שלוש מילים ורץ הלאה. שניהם יכולים להתפתח מצוין, כי לשפה הדבורה יש מהטווחים התקינים הרחבים ביותר בילדות המוקדמת.\n\nהתמונה מתבהרת כשמסתכלים על כל מערכת התקשורת ולא על ספירת המילים. שפה קולטת — מה שהילד מבין — מקדימה בדרך כלל את הדיבור והיא הסימן החזק יותר. וכך גם מחוות: פעוט שמצביע על מה שהוא רוצה, מביא דברים להראות, מנופף ומניד בראש — מתקשר בעושר, והמחקר מוצא ששימוש מוקדם במחוות מנבא אוצר מילים מאוחר יותר. ילד שקט עם הבנה חזקה, מחוות פעילות ומעורבות חברתית הוא בדרך כלל ילד עם לוח זמנים משלו.\n\nבתים דו־לשוניים ראויים להערה מיוחדת. ילד שלומד שתי שפות מפזר מילים ראשונות בין שתיהן; בספירה משותפת אוצר המילים בדרך כלל בקצב. ערבוב שפות במשפט אחד הוא מיומנות תקינה, לא בלבול.\n\nיש דפוסים ששווה להעלות מול איש מקצוע, בלי בהלה ובלי לחכות ליום הולדת: אם ההבנה נראית מוגבלת, אם המחוות מעטות, אם הילד מפסיק להשתמש במילים שהיו לו, או אם אתם פשוט נושאים תחושה מתמשכת שמשהו לא מסתדר. קלינאי תקשורת מעדיפים לפגוש משפחה מוקדם ולומר 'הכול תקין' מאשר מאוחר. בינתיים, העבודה היומיומית זהה לכל ילד: שיחה נענית, ספרים, שירים וזמן — בכל שפה שהמשפחה שלכם אוהבת."
    ),
    tryToday: L(
      "For one day, notice communication instead of words: count points, shows, waves and looks. You'll likely find far more 'talking' than you thought.",
      "ליום אחד, שימו לב לתקשורת במקום למילים: ספרו הצבעות, הושטות, נפנופים ומבטים. סביר שתגלו הרבה יותר 'דיבור' משחשבתם."
    ),
    ask: L("How does my child's communication look across words, gestures and understanding?", "איך נראית התקשורת של הילד שלי במילים, במחוות ובהבנה?"),
  },

  // ── Big Feelings ─────────────────────────────────────────────────────────
  {
    id: "tantrums-development",
    category: "feelings",
    domains: ["attachment_regulation"],
    ageMin: 1,
    ageMax: 4,
    minutes: 4,
    title: L("Tantrums are development, not defiance", "התקפי זעם הם התפתחות, לא התרסה"),
    hook: L("A meltdown is what it looks like when a big feeling meets a brain that can't regulate it yet. That's biology, not bad parenting.", "התקף זעם הוא איך שנראה רגש גדול שפוגש מוח שעדיין לא יודע לווסת אותו. זו ביולוגיה, לא הורות גרועה."),
    keyPoints: [
      L("Tantrums peak in the toddler years because feelings mature faster than the brain systems that manage them.", "התקפי זעם בשיא בגיל הפעוטות כי הרגשות מבשילים מהר יותר ממערכות המוח שמנהלות אותם."),
      L("A child mid-meltdown can't process reasoning; the thinking brain is temporarily offline. Calm presence first, words later.", "ילד בשיא התקף לא יכול לעבד היגיון; המוח החושב מנותק זמנית. קודם נוכחות רגועה, מילים אחר כך."),
      L("Your calm is the tool: co-regulation — a settled adult nearby — is how children gradually learn to settle themselves.", "הרוגע שלכם הוא הכלי: ויסות משותף — מבוגר רגוע בקרבת מקום — הוא הדרך שבה ילדים לומדים בהדרגה להירגע בעצמם."),
      L("Holding a limit and being warm are compatible: 'I won't let you hit. I'm right here.'", "להחזיק גבול ולהיות חמים הולכים יחד: \"לא אתן לך להרביץ. אני כאן.\""),
      L("Frequency fades as language and self-regulation grow; what's worth discussing with a professional is a pattern that is intense, long, frequent and not easing with age — described in counts, not verdicts.", "התדירות דועכת ככל שהשפה והוויסות צומחים; מה ששווה לדון בו עם איש מקצוע הוא דפוס עז, ממושך, תכוף שאינו מתמתן עם הגיל — מתואר בספירות, לא בפסקי דין."),
    ],
    body: L(
      "In the space of a minute, a cheerful toddler can become a small storm on the supermarket floor. It helps to know what is actually happening: toddlers generate adult-sized emotions years before the brain circuitry that manages emotion is built. The gap between feeling and regulating is the tantrum. It is a stage of construction, not a verdict on your child or your parenting.\n\nDuring a full meltdown, the reasoning parts of the brain are temporarily overwhelmed. This is why explaining, negotiating or quizzing ('use your words!') mid-storm so often fails — the systems that could use those words are offline. What reaches a dysregulated child is not logic but state: a nearby adult whose body and voice are calm. Developmental scientists call it co-regulation; lending your settled nervous system until theirs can settle. Over hundreds of these loops, the child's own calming circuitry gets built.\n\nCalm does not mean permissive. Limits held kindly are part of the safety: you can block a hitting hand while staying warm, and you can decline to buy the cereal while accepting the disappointment that follows. Feelings are allowed; all behaviors are not. After the storm passes is the teaching window — name what happened, reconnect, and move on without a lecture.\n\nTantrums generally fade as language gives feelings another exit. Two practical notes: patterns are more informative than incidents, and you know your child. If storms are unusually frequent, long or intense for months, or you feel worried, bring your observations — the whens and how-oftens — to your pediatric professional. Observations travel better than labels.",
      "בתוך דקה, פעוט עליז יכול להפוך לסערה קטנה על רצפת הסופר. עוזר לדעת מה באמת קורה: פעוטות מייצרים רגשות בגודל של מבוגרים שנים לפני שהמעגלים המוחיים שמנהלים רגש נבנו. הפער בין להרגיש לבין לווסת — הוא התקף הזעם. זהו שלב בבנייה, לא פסק דין על הילד או על ההורות שלכם.\n\nבשיא ההתקף, החלקים החושבים של המוח מוצפים זמנית. לכן הסברים, משא ומתן או דרישות ('דבר במילים!') באמצע הסערה נכשלים כל כך הרבה — המערכות שהיו יכולות להשתמש במילים מנותקות. מה שמגיע לילד מוצף אינו היגיון אלא מצב: מבוגר קרוב שהגוף והקול שלו רגועים. מדעני התפתחות קוראים לזה ויסות משותף; להשאיל את מערכת העצבים המיושבת שלכם עד שזו שלו תוכל להתיישב. לאורך מאות לולאות כאלה נבנים מעגלי ההרגעה של הילד עצמו.\n\nרוגע אינו ותרנות. גבולות שמוחזקים בחום הם חלק מהביטחון: אפשר לחסום יד מכה ולהישאר חמים, ואפשר לסרב לקנות את הדגנים ולקבל את האכזבה שאחרי. כל הרגשות מותרים; לא כל ההתנהגויות. אחרי שהסערה חולפת נפתח חלון הלמידה — תנו שם למה שקרה, התחברו מחדש, והמשיכו בלי הרצאה.\n\nהתקפי זעם דועכים בדרך כלל כשהשפה נותנת לרגשות יציאה נוספת. שתי הערות מעשיות: דפוסים מלמדים יותר מאירועים, ואתם מכירים את הילד שלכם. אם הסערות תכופות, ארוכות או עזות במיוחד לאורך חודשים, או שאתם מודאגים — הביאו את התצפיות שלכם, המתי וכמה, לאיש מקצוע. תצפיות נוסעות טוב יותר מתוויות."
    ),
    tryToday: L(
      "Next storm, try saying almost nothing. Stay close, breathe slowly, one short line: \"I'm here. You're safe.\" Save the talking for after.",
      "בסערה הבאה, נסו לומר כמעט כלום. הישארו קרובים, נשמו לאט, משפט קצר אחד: \"אני כאן. את/ה בטוח/ה.\" את הדיבור שמרו לאחר כך."
    ),
    ask: L("What could our calm-down plan look like for the next tantrum?", "איך יכולה להיראות תוכנית ההרגעה שלנו להתקף הבא?"),
  },
  {
    id: "naming-feelings",
    category: "feelings",
    domains: ["attachment_regulation", "language_communication"],
    ageMin: 2,
    ageMax: 6,
    minutes: 3,
    title: L("Name it to tame it: how labeling feelings calms the brain", "לקרוא לרגש בשם: איך מילים מרגיעות את המוח"),
    hook: L("Putting a feeling into words measurably lowers its intensity — a skill your child borrows from you first.", "ניסוח רגש במילים מפחית את עוצמתו באופן מדיד — מיומנות שהילד שואל קודם כול מכם."),
    keyPoints: [
      L("Naming an emotion engages the brain's regulation systems and softens the alarm response; researchers call it affect labeling.", "מתן שם לרגש מפעיל את מערכות הוויסות במוח ומרכך את תגובת האזעקה; חוקרים קוראים לזה תיוג רגשי."),
      L("Children need the vocabulary before they can use the tool: sad, mad, scared, disappointed, frustrated, excited.", "ילדים צריכים את אוצר המילים לפני שיוכלו להשתמש בכלי: עצוב, כועס, מפוחד, מאוכזב, מתוסכל, נרגש."),
      L("Name it in the moment without arguing with it: 'You're so frustrated the tower fell' beats 'you're fine.'", "תנו שם ברגע עצמו בלי להתווכח עם הרגש: \"אתה כל כך מתוסכל שהמגדל נפל\" עדיף על \"הכול בסדר\"."),
      L("Naming is not approving: the feeling is welcome even when the behavior isn't.", "לתת שם אינו לאשר: הרגש רצוי גם כשההתנהגות לא."),
      L("Books and pretend play are safe practice fields for the feelings vocabulary.", "ספרים ומשחק דמיוני הם מגרשי אימון בטוחים לאוצר המילים הרגשי."),
    ],
    body: L(
      "\"You wanted the blue cup, and I gave you the red one. You're disappointed.\" It sounds almost too simple, yet this move — naming the feeling — is one of the best-supported tools in emotional development. Neuroscience studies of affect labeling find that putting an emotion into words dampens activity in the brain's alarm centers and recruits the regulating ones. In everyday terms: a named feeling is a slightly smaller feeling.\n\nFor young children the effect runs through you. They cannot label what they have no words for, so the vocabulary arrives secondhand — from parents narrating emotional weather without judgment. Over time the child internalizes both the words and the message underneath them: feelings have names, names make them speakable, and nothing about them is shameful.\n\nTwo details make naming work better. First, name without correcting: 'you're fine' or 'that's nothing to cry about' teaches that the signal was wrong, while 'that really surprised you' teaches that signals can be understood. Second, keep behavior separate: 'You're furious at your brother — and I won't let you hit him.' The feeling gets a name and a welcome; the fist gets a limit.\n\nStories are the gentlest gym. Characters get scared, jealous and brave at a safe distance, and wondering how the fox feels costs nothing. Pretend play does the same from the inside. None of this requires a curriculum — a family that talks about feelings in passing, the way it talks about weather, is teaching the skill every day.",
      "\"רצית את הכוס הכחולה, ונתתי לך את האדומה. אתה מאוכזב.\" זה נשמע כמעט פשוט מדי, ובכל זאת המהלך הזה — מתן שם לרגש — הוא מהכלים המבוססים ביותר בהתפתחות רגשית. מחקרי מוח על תיוג רגשי מוצאים שניסוח רגש במילים מרגיע פעילות במרכזי האזעקה של המוח ומגייס את מערכות הוויסות. במילים יומיומיות: רגש עם שם הוא רגש קצת יותר קטן.\n\nאצל ילדים צעירים האפקט עובר דרככם. הם לא יכולים לתייג את מה שאין להם מילים עבורו, ולכן אוצר המילים מגיע יד שנייה — מהורים שמתארים את מזג האוויר הרגשי בלי שיפוט. עם הזמן הילד מפנים גם את המילים וגם את המסר שמתחתיהן: לרגשות יש שמות, שמות הופכים אותם לניתנים לדיבור, ואין בהם שום בושה.\n\nשני פרטים משפרים את המהלך. ראשית, לתת שם בלי לתקן: \"הכול בסדר\" או \"אין על מה לבכות\" מלמדים שהאות היה שגוי, ואילו \"זה ממש הפתיע אותך\" מלמד שאותות אפשר להבין. שנית, להפריד התנהגות: \"אתה זועם על אח שלך — ולא אתן לך להרביץ לו.\" הרגש מקבל שם וקבלה; האגרוף מקבל גבול.\n\nסיפורים הם חדר הכושר העדין ביותר. דמויות מפחדות, מקנאות ומתאזרות באומץ ממרחק בטוח, ולתהות מה שועל מרגיש לא עולה כלום. משחק דמיוני עושה את אותו הדבר מבפנים. שום דבר מזה לא דורש תוכנית לימודים — משפחה שמדברת על רגשות כבדרך אגב, כמו על מזג האוויר, מלמדת את המיומנות כל יום."
    ),
    tryToday: L(
      "Catch one feeling today — theirs or yours — and name it out loud, plainly: \"I'm frustrated the drawer is stuck.\" Modeling counts double.",
      "תפסו רגש אחד היום — שלהם או שלכם — ותנו לו שם בקול, בפשטות: \"אני מתוסכלת שהמגירה נתקעה.\" דוגמה אישית שווה כפול."
    ),
    ask: L("Which feeling words should we grow at our child's age?", "אילו מילות רגש כדאי להצמיח בגיל של הילד שלנו?"),
  },

  // ── Behavior & Limits ────────────────────────────────────────────────────
  {
    id: "skill-not-will",
    category: "behavior",
    domains: ["attachment_regulation", "independence_adaptive_skills"],
    ageMin: 2,
    ageMax: 8,
    minutes: 4,
    title: L("Kids do well if they can: misbehavior as a skill gap", "ילדים מצליחים כשהם יכולים: התנהגות קשה כפער מיומנות"),
    hook: L("Flip one assumption — from 'won't' to 'can't yet' — and most discipline decisions change on their own.", "הפכו הנחה אחת — מ'לא רוצה' ל'עדיין לא יכול' — ורוב החלטות המשמעת ישתנו מעצמן."),
    keyPoints: [
      L("Challenging behavior usually marks a lagging skill (flexibility, frustration tolerance, transitions) meeting a demand that outstrips it.", "התנהגות מאתגרת מסמנת בדרך כלל מיומנות בפיגור (גמישות, סיבולת תסכול, מעברים) שפוגשת דרישה גדולה ממנה."),
      L("The question that changes everything: not 'how do I stop this?' but 'what makes this moment hard for this child?'", "השאלה שמשנה הכול: לא \"איך אני עוצר את זה?\" אלא \"מה הופך את הרגע הזה לקשה לילד הזה?\""),
      L("Punishment doesn't teach missing skills; practice, scaffolding and smaller steps do.", "עונש לא מלמד מיומנות חסרה; תרגול, פיגומים וצעדים קטנים יותר — כן."),
      L("Look for the pattern: same time, same trigger, same demand — the behavior is data about where the skill runs out.", "חפשו את הדפוס: אותה שעה, אותו טריגר, אותה דרישה — ההתנהגות היא מידע על המקום שבו המיומנות נגמרת."),
      L("Expectations still stand; the route changes — you lower the step, not the standard.", "הציפיות נשארות; המסלול משתנה — מנמיכים את המדרגה, לא את הרף."),
    ],
    body: L(
      "When a child repeatedly explodes at homework, refuses shoes, or falls apart at every playground exit, the traditional read is motivational: they won't behave. Child psychologist Ross Greene condensed decades of clinical experience into a different premise: kids do well if they can. When they aren't doing well, something — a skill, a capacity, a state — is missing for that specific moment.\n\nThe shift is practical, not sentimental. 'Won't' leads to consequences designed to raise motivation. But if the missing ingredient is a skill — cognitive flexibility, frustration tolerance, shifting between activities, handling sensory load — then motivation was never the bottleneck, which is why escalating consequences so often escalate everything else instead. 'Can't yet' leads somewhere more useful: identify the moment that is too hard, and either teach the skill or shrink the demand until practice is possible.\n\nThe behavior itself is your map. Difficult moments cluster: transitions, hunger, sibling proximity, tasks with too many steps. Noticing the cluster tells you which skill is overloaded. From there the moves are ordinary: warn before transitions, break tasks into steps, practice the hard thing when everyone is calm, and name what's happening ('leaving is the hard part for you — let's make a leaving plan').\n\nNone of this abandons expectations. The standard stays; the staircase gets an extra step. And the relationship changes tone: instead of adversaries in a compliance contest, you become collaborators against a problem. Children usually feel that difference quickly — being seen as struggling rather than bad is, for many, half the repair.",
      "כשילד מתפוצץ שוב ושוב על שיעורי בית, מסרב לנעליים, או מתפרק בכל יציאה מגן השעשועים, הקריאה המסורתית היא מוטיבציונית: הוא לא מוכן להתנהג. הפסיכולוג רוס גרין תמצת עשורים של ניסיון קליני להנחה אחרת: ילדים מצליחים כשהם יכולים. כשהם לא מצליחים, משהו — מיומנות, יכולת, מצב — חסר לרגע הספציפי הזה.\n\nהשינוי הזה מעשי, לא רגשני. 'לא רוצה' מוביל לעונשים שנועדו להעלות מוטיבציה. אבל אם המרכיב החסר הוא מיומנות — גמישות מחשבתית, סיבולת תסכול, מעבר בין פעילויות, התמודדות עם עומס חושי — אז מוטיבציה מעולם לא הייתה צוואר הבקבוק, ולכן הסלמת עונשים מסלימה לרוב את כל השאר במקום. 'עדיין לא יכול' מוביל למקום מועיל יותר: לזהות את הרגע שקשה מדי, וללמד את המיומנות או להקטין את הדרישה עד שאפשר לתרגל.\n\nההתנהגות עצמה היא המפה שלכם. רגעים קשים מתקבצים: מעברים, רעב, קרבת אחים, משימות עם יותר מדי שלבים. הבחנה בצביר מגלה איזו מיומנות עמוסה. משם הצעדים פשוטים: התרעה לפני מעבר, פירוק משימות לשלבים, תרגול הדבר הקשה כשכולם רגועים, ומתן שם למה שקורה (\"היציאה היא החלק הקשה בשבילך — בוא נבנה תוכנית יציאה\").\n\nשום דבר מזה לא מוותר על ציפיות. הרף נשאר; גרם המדרגות מקבל מדרגה נוספת. וגם הטון של הקשר משתנה: במקום יריבים בתחרות ציות, אתם נעשים שותפים נגד בעיה. ילדים מרגישים את ההבדל הזה מהר — להיראות כמתקשים ולא כרעים הוא, עבור רבים, חצי מהתיקון."
    ),
    tryToday: L(
      "Take your hardest daily moment and write one sentence: \"What skill does this moment demand that's still growing?\" Plan one size-down of the demand.",
      "קחו את הרגע הקשה ביותר ביום וכתבו משפט אחד: \"איזו מיומנות הרגע הזה דורש שעדיין צומחת?\" תכננו הקטנה אחת של הדרישה."
    ),
    ask: L("Help me map what makes our hardest moment of the day so hard.", "עזור לי למפות מה הופך את הרגע הקשה ביותר ביום שלנו לכל כך קשה."),
  },
  {
    id: "transitions-warnings",
    category: "behavior",
    domains: ["cognition_executive_function", "attachment_regulation"],
    ageMin: 2,
    ageMax: 6,
    minutes: 3,
    title: L("Why transitions are hard, and why warnings work", "למה מעברים קשים, ולמה התרעות עובדות"),
    hook: L("Leaving the park isn't about the park. Switching activities is heavy mental lifting for a young brain — and it can be scaffolded.", "לעזוב את הגן זה לא על הגן. החלפת פעילות היא הרמה מנטלית כבדה למוח צעיר — ואפשר לבנות לה פיגומים."),
    keyPoints: [
      L("Switching tasks uses cognitive flexibility — one of the last executive skills to mature; toddlers are genuinely bad at it, by design.", "החלפת משימה דורשת גמישות מחשבתית — ממיומנויות הניהול האחרונות להבשיל; פעוטות באמת חלשים בה, וכך זה אמור להיות."),
      L("A transition is also a small loss: the current game must die for the bath to exist. Grief-sized reactions make more sense through that lens.", "מעבר הוא גם אובדן קטן: המשחק הנוכחי צריך להסתיים כדי שהאמבטיה תתקיים. בעדשה הזאת, תגובות בגודל אֵבל מובנות יותר."),
      L("Advance warnings ('two more slides, then home') let the brain pre-load the switch instead of being ambushed by it.", "התרעות מראש (\"עוד שתי מגלשות ואז הביתה\") נותנות למוח לטעון את המעבר מראש במקום להיתפס בהפתעה."),
      L("Rituals carry transitions: the same goodbye song, the same shoes-then-jacket order. Predictability replaces negotiation.", "טקסים נושאים מעברים: אותו שיר פרידה, אותו סדר נעליים-ואז-מעיל. צפיפות תחליף למשא ומתן."),
      L("Giving the child a job in the switch ('you press the elevator button') converts passenger to driver.", "תפקיד לילד במעבר (\"אתה לוחץ על כפתור המעלית\") הופך נוסע לנהג."),
    ],
    body: L(
      "Count the transitions in a small child's day: wake up, leave the house, arrive, clean up, come to the table, into the bath, out of the bath, into bed. Each one asks the brain to end one world and boot another. For adults, that switch costs little. For a young child, whose cognitive flexibility is years from mature, every switch is real work — which is why so many of the day's storms break exactly at its seams.\n\nIt helps to see what a transition asks: disengage attention from something rewarding, hold the next thing in mind, inhibit the pull of the current one, and start moving. That is a full executive-function workout. Add feelings — the block tower was glorious, and 'clean-up' means ending it — and 'just put your shoes on' becomes a genuinely demanding request.\n\nScaffolding changes the odds. Warnings work because the brain handles a pre-announced switch far better than an ambush: 'after this book, pajamas.' Concrete markers beat clock-time; children live in events, not minutes — 'two more slides' communicates what 'five minutes' cannot. Rituals do quiet heavy lifting: the same song for leaving, the same order for bedtime. A predictable sequence removes the nightly negotiation, because the sequence, not the parent, is the authority. And a role in the transition ('you're the light-switcher') gives the child agency inside a moment that otherwise happens to them.\n\nTransitions stay imperfect; some days everything is heavy. But treated as skill practice rather than obedience tests, they get lighter with age — and the daily seams of your routine slowly stop being fault lines.",
      "ספרו את המעברים ביום של ילד קטן: להתעורר, לצאת מהבית, להגיע, לסדר, לבוא לשולחן, להיכנס לאמבטיה, לצאת מהאמבטיה, למיטה. כל אחד מהם מבקש מהמוח לסיים עולם אחד ולהפעיל אחר. למבוגרים המעבר הזה עולה מעט. לילד צעיר, שהגמישות המחשבתית שלו רחוקה שנים מבשלות, כל מעבר הוא עבודה אמיתית — ולכן כל כך הרבה מסערות היום פורצות בדיוק בתפרים שלו.\n\nעוזר לראות מה מעבר דורש: לנתק קשב ממשהו מתגמל, להחזיק את הדבר הבא בראש, לעכב את המשיכה של הנוכחי, ולהתחיל לזוז. זה אימון תפקודים ניהוליים מלא. הוסיפו רגשות — מגדל הקוביות היה מפואר, ו'לסדר' פירושו לסיים אותו — ו\"פשוט תנעל נעליים\" הופך לבקשה תובענית באמת.\n\nפיגומים משנים את הסיכויים. התרעות עובדות כי המוח מתמודד עם מעבר שהוכרז מראש הרבה יותר טוב מאשר עם מארב: \"אחרי הספר הזה, פיג'מה.\" סימנים מוחשיים עדיפים על זמן שעון; ילדים חיים באירועים, לא בדקות — \"עוד שתי מגלשות\" מתקשר מה ש\"חמש דקות\" לא יכול. טקסים מרימים משקל בשקט: אותו שיר ליציאה, אותו סדר לשינה. רצף צפוי מבטל את המשא ומתן הלילי, כי הרצף, לא ההורה, הוא הסמכות. ותפקיד במעבר (\"אתה מכבה האורות\") נותן לילד סוכנות בתוך רגע שאחרת פשוט קורה לו.\n\nמעברים נשארים לא מושלמים; יש ימים שהכול כבד. אבל כשמתייחסים אליהם כאל תרגול מיומנות ולא כמבחני ציות, הם מוקלים עם הגיל — והתפרים היומיומיים של השגרה מפסיקים לאט להיות קווי שבר."
    ),
    tryToday: L(
      "Pick your roughest daily transition and add two things: a concrete warning (\"after this episode\") and a job (\"you carry the keys\"). Run it for a week.",
      "בחרו את המעבר הקשה ביותר ביום והוסיפו שני דברים: התרעה מוחשית (\"אחרי הפרק הזה\") ותפקיד (\"אתה נושא את המפתחות\"). הריצו שבוע."
    ),
    ask: L("Design a smoother routine for our hardest transition of the day.", "עצב שגרה חלקה יותר למעבר הקשה ביותר ביום שלנו."),
  },

  // ── Sleep ────────────────────────────────────────────────────────────────
  {
    id: "sleep-regressions",
    category: "sleep",
    domains: ["independence_adaptive_skills"],
    ageMin: 0,
    ageMax: 3,
    minutes: 4,
    title: L("Sleep regressions: when better brains mean worse nights", "רגרסיות שינה: כשמוח משתפר, הלילות מתערערים"),
    hook: L("The night suddenly falls apart right when your baby learns something big. That's not a coincidence — and it passes.", "הלילה מתפרק פתאום בדיוק כשהתינוק לומד משהו גדול. זה לא צירוף מקרים — וזה עובר."),
    keyPoints: [
      L("So-called regressions usually ride developmental leaps: new motor skills, separation awareness, language bursts wake the brain up at night.", "מה שנקרא רגרסיה רוכב בדרך כלל על קפיצות התפתחות: מיומנויות תנועה חדשות, מודעות לפרידה ופרצי שפה מעירים את המוח בלילה."),
      L("Common windows cluster around 4 months, 8-10 months, 12 months, 18 months and 2 years — but babies don't read calendars; timing varies widely.", "חלונות שכיחים מתקבצים סביב 4 חודשים, 8–10 חודשים, שנה, שנה וחצי ושנתיים — אבל תינוקות לא קוראים לוח שנה; התזמון משתנה מאוד."),
      L("The 4-month shift is real reorganization: sleep cycles mature into their adult structure, with more brief wakings between cycles.", "השינוי של 4 חודשים הוא ארגון מחדש אמיתי: מחזורי השינה מבשילים למבנה בוגר, עם יותר יקיצות קצרות בין מחזורים."),
      L("Most rough patches run days to a few weeks; holding your familiar routine steady is usually the fastest road through.", "רוב התקופות הקשות נמשכות ימים עד שבועות ספורים; שמירה יציבה על השגרה המוכרת היא לרוב הדרך המהירה החוצה."),
      L("Protect the parents too: split nights, nap when possible, and treat survival mode as legitimate strategy, not failure.", "שמרו גם על ההורים: התחלקו בלילות, נמנמו כשאפשר, והתייחסו למצב הישרדות כאסטרטגיה לגיטימית, לא ככישלון."),
    ],
    body: L(
      "Your baby finally sleeps in stretches, you cautiously mention it aloud — and that week the night shatters into hourly wakings. The timing feels cruel, but there's a logic: infant sleep tends to wobble exactly when development leaps. A brain busy wiring a new skill is a brain that sleeps lighter, practices at 2am, and suddenly notices — and minds — that you left the room.\n\nThe famous four-month change is the most structural of these. Newborn sleep comes in two simple stages; around three to five months it reorganizes into the mature architecture of cycles that end in brief arousals. A baby who can drift back down after those arousals barely registers them; one who needs the exact conditions of falling asleep restored — arms, motion, feeding — calls out at each cycle's end. Nothing broke; the architecture changed, and habits are renegotiating.\n\nLater bumps track other leaps. Crawling and pulling to stand are so thrilling that cribs become practice gyms. Separation awareness, blooming late in the first year, makes goodnight a genuine parting. Language bursts, molars and new siblings all pass through the night too. These phases usually run days to a few weeks. Consistency is your quiet ally: the familiar routine, the same response pattern, boring nights. Regressions ending is the norm; new habits started during them (a 3am party, a return to rocking every waking) can outlast the phase, so choose sustainable responses where you can.\n\nAnd be as kind to yourselves as to the baby. Broken sleep erodes everyone; splitting shifts and lowering daytime ambitions for a couple of weeks is good strategy. If sleep is persistently effortful beyond these windows — or you're depleted past coping — that's worth an honest conversation with your health professional; support exists on both fronts.",
      "התינוק שלכם סוף סוף ישן רצפים, אתם מעזים לומר את זה בקול — ובאותו שבוע הלילה מתנפץ ליקיצות של שעה. התזמון מרגיש אכזרי, אבל יש בו היגיון: שנת תינוקות נוטה להתערער בדיוק כשההתפתחות מזנקת. מוח שעסוק בחיווט מיומנות חדשה הוא מוח שישן קל יותר, מתאמן בשתיים בלילה, ופתאום שם לב — ואכפת לו — שיצאתם מהחדר.\n\nהשינוי המפורסם של ארבעת החודשים הוא המבני מכולם. שנת יילוד מגיעה בשני שלבים פשוטים; סביב שלושה עד חמישה חודשים היא מתארגנת מחדש לארכיטקטורה הבוגרת של מחזורים שנגמרים ביקיצות קצרות. תינוק שיודע לצלול בחזרה אחרי היקיצות בקושי מרגיש בהן; תינוק שזקוק לשחזור מדויק של תנאי ההירדמות — ידיים, נדנוד, האכלה — קורא לכם בסוף כל מחזור. שום דבר לא התקלקל; הארכיטקטורה השתנתה, וההרגלים במשא ומתן מחודש.\n\nהמהמורות הבאות רוכבות על קפיצות אחרות. זחילה ועמידה כל כך מרגשות שהמיטה הופכת לחדר כושר. מודעות לפרידה, שפורחת לקראת סוף השנה הראשונה, הופכת את הלילה־טוב לפרידה של ממש. פרצי שפה, שיניים טוחנות ואחים חדשים — כולם עוברים גם דרך הלילה. השלבים האלה נמשכים בדרך כלל ימים עד שבועות ספורים. עקביות היא בעלת הברית השקטה: אותה שגרה מוכרת, אותו דפוס תגובה, לילות משעממים. רגרסיות שנגמרות הן הכלל; הרגלים חדשים שנולדו בתוכן (מסיבת שלוש לפנות בוקר, חזרה לנדנוד בכל יקיצה) עלולים לשרוד אחרי השלב — אז בחרו תגובות שתוכלו לחיות איתן.\n\nוהיו טובים לעצמכם כמו לתינוק. שינה שבורה שוחקת את כולם; חלוקת משמרות והנמכת שאפתנות היום לשבועיים היא אסטרטגיה טובה. אם השינה נשארת מאמץ מתמשך מעבר לחלונות האלה — או שאתם שחוקים מעבר ליכולת — זו שיחה כנה ששווה לקיים עם איש מקצוע; יש תמיכה בשתי החזיתות."
    ),
    tryToday: L(
      "Mid-regression, change nothing tonight: same routine, same order, same words. Predictability is the message that the world is still safe at 2am.",
      "באמצע רגרסיה, אל תשנו כלום הלילה: אותה שגרה, אותו סדר, אותן מילים. הצפיפות היא המסר שהעולם עדיין בטוח גם בשתיים בלילה."
    ),
    ask: L("How do we hold our sleep routine steady through this rough patch?", "איך נחזיק את שגרת השינה יציבה בתקופה הקשה הזאת?"),
  },
  {
    id: "bedtime-routine",
    category: "sleep",
    domains: ["independence_adaptive_skills", "attachment_regulation"],
    ageMin: 1,
    ageMax: 8,
    minutes: 3,
    title: L("The bedtime routine: why sameness is the active ingredient", "טקס השינה: הקביעות היא החומר הפעיל"),
    hook: L("A predictable wind-down sequence works like a lullaby for the nervous system — and its power is in the repetition, not the length.", "רצף הרגעה צפוי פועל כמו שיר ערש למערכת העצבים — וכוחו בחזרה, לא באורך."),
    keyPoints: [
      L("A consistent pre-sleep sequence is one of the most reliably supported sleep tools across childhood.", "רצף קבוע לפני שינה הוא מהכלים הנתמכים ביותר במחקר לאורך כל הילדות."),
      L("Each repeated step is a cue: bath, pajamas, book, song tell the body 'sleep is next' better than any instruction.", "כל שלב חוזר הוא רמז: אמבטיה, פיג'מה, ספר, שיר אומרים לגוף \"עכשיו שינה\" טוב יותר מכל הוראה."),
      L("Short and same beats long and negotiable: 20-30 minutes, same order, is the sweet spot for most families.", "קצר וקבוע עדיף על ארוך ופתוח למשא ומתן: 20–30 דקות באותו סדר הן נקודת המתיקות לרוב המשפחות."),
      L("Direction matters: move toward the bedroom, dim the light as you go — the environment does half the calming.", "לכיוון יש משמעות: התקדמו אל חדר השינה והנמיכו אור בדרך — הסביבה עושה חצי מההרגעה."),
      L("The routine is connection, not just logistics: those minutes of undivided attention are often why children cooperate with it.", "הטקס הוא חיבור, לא רק לוגיסטיקה: דקות הקשב המלא הן לרוב הסיבה שילדים משתפים פעולה."),
    ],
    body: L(
      "Across cultures and decades of research, one bedtime tool keeps outperforming its simplicity: doing the same few things, in the same order, at roughly the same time, every night. Studies of consistent bedtime routines find children fall asleep faster, wake less, and even show better daytime mood — with effects visible within weeks of starting.\n\nThe mechanism is conditioning, in the friendliest sense. Bodies love predictions. When bath is always followed by pajamas, then a book, then a song, then lights out, each step becomes a cue that the next is coming, and the whole sequence becomes a ramp the nervous system walks down. No single step is magic; the order is the magic. This is also why the routine holds up in hard weeks and hotel rooms — the sequence travels even when the setting doesn't.\n\nDesign matters less than families fear. Aim for twenty to thirty minutes: long enough to downshift, short enough to defend nightly. Keep it moving one direction — toward the bedroom, with light dimming and voices lowering along the way. Put the negotiable parts early (which pajamas, which book) so the tail end runs on rails. Screens sit poorly in the last stretch; bright, fast and interactive is the opposite of a ramp.\n\nAnd notice what the routine actually is for your child: a guaranteed, unhurried slice of you. For many children the book-and-song stretch is the most reliable one-on-one attention of the whole day. That's not overhead on the sleep plan. That is the sleep plan.",
      "לרוחב תרבויות ועשורים של מחקר, כלי שינה אחד ממשיך להכות את פשטותו: לעשות את אותם דברים מעטים, באותו סדר, בערך באותה שעה, כל ערב. מחקרים על טקסי שינה קבועים מוצאים שילדים נרדמים מהר יותר, מתעוררים פחות, ואפילו מגלים מצב רוח טוב יותר ביום — עם השפעות שנראות בתוך שבועות.\n\nהמנגנון הוא התניה, במובן הידידותי ביותר. גופים אוהבים תחזיות. כשאחרי אמבטיה תמיד באה פיג'מה, ואז ספר, ואז שיר, ואז כיבוי אור — כל שלב נעשה רמז לבא אחריו, וכל הרצף נעשה כבש שמערכת העצבים יורדת בו. אף שלב אינו קסם; הסדר הוא הקסם. לכן הטקס מחזיק גם בשבועות קשים ובחדרי מלון — הרצף נוסע גם כשהסביבה לא.\n\nהעיצוב חשוב פחות ממה שמשפחות חוששות. כוונו לעשרים־שלושים דקות: מספיק כדי להוריד הילוך, מספיק קצר כדי להגן עליו כל ערב. שמרו על כיוון אחד — אל חדר השינה, עם אור שמתעמעם וקולות שמתנמכים בדרך. מקמו את החלקים הפתוחים למשא ומתן מוקדם (איזו פיג'מה, איזה ספר) כדי שהסוף ירוץ על מסילה. מסכים יושבים רע בקטע האחרון; בהיר, מהיר ואינטראקטיבי הם ההפך מכבש.\n\nושימו לב מה הטקס באמת בשביל הילד: פרוסת זמן מובטחת ולא ממוהרת שלכם. עבור ילדים רבים, רגעי הספר והשיר הם הקשב האישי האמין ביותר ביום כולו. זו לא תקורה על תוכנית השינה. זו תוכנית השינה."
    ),
    tryToday: L(
      "Write your routine as four steps and say them out loud at the start tonight: \"Bath, pajamas, book, song.\" Children defend sequences they can predict.",
      "כתבו את הטקס שלכם כארבעה שלבים ואמרו אותם בקול בתחילת הערב: \"אמבטיה, פיג'מה, ספר, שיר.\" ילדים מגינים על רצפים שהם יכולים לחזות."
    ),
    ask: L("Help me design a 25-minute bedtime routine that fits our evenings.", "עזור לי לעצב טקס שינה של 25 דקות שמתאים לערבים שלנו."),
  },
];
