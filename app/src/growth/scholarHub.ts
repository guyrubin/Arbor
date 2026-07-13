/**
 * Scholar Hub — weekly developmental-concept feed (AP-055).
 *
 * Reads the child's EXISTING dev-score/domain data (computeDevScore →
 * focusDomain) and surfaces ONE curated editorial article per week,
 * matched to the lowest-scoring domain.
 *
 * Design rules (binding):
 *  - Static catalogue only. No AI call. No new child-data write.
 *  - The lowest domain is framed as the next OPPORTUNITY to nurture,
 *    never as a deficit, delay, weakness, or problem.
 *  - Articles are general developmental education — no per-article claim,
 *    no outcome statement, no effect-size assertion.
 *  - Provenance: presented as "this week's pick based on your Development Map",
 *    an editorial suggestion, not a diagnosis.
 */

export interface ScholarArticle {
  id: string;
  /** Domain id this article maps to (matches framework.json domain ids). */
  domain: string;
  titleEn: string;
  titleHe: string;
  /** One-paragraph editorial summary — general developmental education only.
   *  No developmental claims, no outcome statements, no effect-size language. */
  bodyEn: string;
  bodyHe: string;
  /** Invitational reading-time indicator only. */
  readingMinutes: number;
  /** Topic area label — human-readable, editorial tone. */
  topicEn: string;
  topicHe: string;
}

/**
 * Static curated article catalogue.
 * Covers the four prototype topic areas per AP-055 AC#2:
 *   Regulation, Attachment, Bilingualism, Transitions
 * plus the remaining five framework.json domains.
 *
 * Content stance: general developmental education.
 * No developmental claim, no outcome assertion, no effect-size language.
 */
export const SCHOLAR_ARTICLES: ScholarArticle[] = [
  // ── attachment_regulation ───────────────────────────────────────────────
  {
    id: "co-regulation-as-skill",
    domain: "attachment_regulation",
    titleEn: "Co-regulation: the skill behind every calm-down",
    titleHe: "ויסות משותף: המיומנות מאחורי כל הרגעה",
    topicEn: "Regulation",
    topicHe: "ויסות",
    readingMinutes: 4,
    bodyEn:
      "Emotion regulation is not a switch children flip on demand — it is a capacity that develops slowly through repeated experiences of being regulated by a caring adult. When a parent stays calm during a child's big feeling, lends their settled nervous system to the child, and gently names what is happening, the child's brain begins to build its own internal circuit for calming down. This process, called co-regulation, is the upstream source of the self-regulation children show later in school and social settings. The parent's role is not to stop the feeling but to accompany it — staying present, lowering the temperature with a calm body and voice, and narrating the emotion without amplifying it. Over many repetitions, the child internalises the pattern: big feelings are survivable, and I have someone who helps me through them.",
    bodyHe:
      "ויסות רגשות אינו מתג שילדים מדליקים לפי דרישה — זוהי יכולת המתפתחת לאט דרך חוויות חוזרות של ויסות על ידי מבוגר מטפל. כשהורה נשאר רגוע במהלך רגש גדול של הילד, מציב את מערכת העצבים המאוזנת שלו לרשות הילד, ומנסח בעדינות מה קורה — המוח של הילד מתחיל לבנות מעגל פנימי משלו להירגעות. תהליך זה, הנקרא ויסות משותף, הוא המקור הראשוני לוויסות העצמי שילדים מגלים מאוחר יותר בבית הספר ובמסגרות חברתיות. תפקיד ההורה אינו לעצור את הרגש אלא ללוות אותו — להישאר נוכח, להוריד את הטמפרטורה בגוף וקול רגועים, ולתאר את הרגש בלי להגביר אותו. לאורך חזרות רבות, הילד מפנים את הדפוס: רגשות גדולים ניתנים לשרידה, ויש לי מישהו שעוזר לי לעבור אותם.",
  },
  {
    id: "attachment-repair-cycles",
    domain: "attachment_regulation",
    titleEn: "Attachment: why rupture and repair build trust",
    titleHe: "התקשרות: מדוע קרע ותיקון בונים אמון",
    topicEn: "Attachment",
    topicHe: "התקשרות",
    readingMinutes: 5,
    bodyEn:
      "A secure attachment is not built on the absence of conflict — it is built through the reliable repair that follows it. Every close relationship between a parent and child includes moments of misattunement: a distracted response, a sharp word, a moment where connection was lost. What research in developmental psychology consistently finds is that it is the predictable return to connection — the repair — that shapes the child's internal working model of relationships. When a child experiences that ruptures are temporary and that the caring adult always comes back, they learn that relationships are safe enough to depend on. This makes repair one of the most powerful parenting tools available, not a confession of failure but an active investment in the relationship.",
    bodyHe:
      "התקשרות בטוחה לא נבנית על היעדר קונפליקט — היא נבנית דרך התיקון האמין שבא אחריו. כל מערכת יחסים קרובה בין הורה לילד כוללת רגעים של חוסר הלימה: תגובה מוסחת, מילה חדה, רגע שבו החיבור אבד. מה שמחקרים בפסיכולוגיה התפתחותית מוצאים בעקביות הוא שהחזרה הצפויה לחיבור — התיקון — היא שמעצבת את הדגם הפנימי של הילד ביחס למערכות יחסים. כשילד חווה שקרעים הם זמניים ושהמבוגר המטפל תמיד חוזר, הוא לומד שמערכות יחסים בטוחות מספיק להסתמך עליהן. זה הופך את התיקון לאחד מכלי ההורות החזקים ביותר הקיימים — לא הודאה בכישלון אלא השקעה פעילה במערכת היחסים.",
  },

  // ── language_communication ──────────────────────────────────────────────
  {
    id: "bilingual-home-environment",
    domain: "language_communication",
    titleEn: "Raising bilingual children: what the evidence supports",
    titleHe: "גידול ילדים דו-לשוניים: מה הממצאים תומכים בו",
    topicEn: "Bilingualism",
    topicHe: "דו-לשוניות",
    readingMinutes: 5,
    bodyEn:
      "Children raised in multilingual households develop language on a slightly different timeline than monolingual peers — their total vocabulary across languages is typically equivalent, but each individual language may have fewer words at first. This is a normal feature of bilingual development, not a delay. What consistently supports bilingual language growth is meaningful, joyful exposure in each language: books, songs, conversation, and play in both. Research in language acquisition points toward using both languages in natural, unpressured contexts — formal correction tends to discourage output, while enthusiastic engagement with whatever language the child uses tends to encourage it. A second language that is used for something real (stories, games, a relationship with a family member) grows faster than one practiced only in drills.",
    bodyHe:
      "ילדים המגדלים בבתים רב-לשוניים מפתחים שפה בציר זמן מעט שונה מעמיתיהם החד-לשוניים — אוצר המילים הכולל שלהם על פני כל השפות בדרך כלל שקול, אבל כל שפה בנפרד עשויה לכלול בתחילה מילים פחות. זוהי תכונה נורמלית של התפתחות דו-לשונית, לא עיכוב. מה שתומך בעקביות בצמיחת שפה דו-לשונית הוא חשיפה משמעותית ושמחה בכל שפה: ספרים, שירים, שיחה ומשחק בשתיהן. מחקרים ברכישת שפה מצביעים על שימוש בשתי השפות בהקשרים טבעיים וללא לחץ — תיקון פורמלי נוטה להרתיע הפקה, בעוד שמעורבות נלהבת עם כל שפה שהילד משתמש בה נוטה לעודד אותה. שפה שנייה המשמשת למשהו אמיתי (סיפורים, משחקים, מערכת יחסים עם בן משפחה) צומחת מהר יותר מאחת שמתורגלת רק בתרגילים.",
  },

  // ── cognition_executive_function ────────────────────────────────────────
  {
    id: "executive-function-play",
    domain: "cognition_executive_function",
    titleEn: "How play builds executive function",
    titleHe: "כיצד משחק בונה תפקוד ניהולי",
    topicEn: "Thinking & attention",
    topicHe: "חשיבה וקשב",
    readingMinutes: 4,
    bodyEn:
      "Executive function — the cluster of mental skills that includes working memory, flexible thinking, and self-control — is not primarily trained through worksheets or apps. Developmentally, it is most reliably built through open-ended, self-directed play, especially play that requires the child to hold a rule in mind (like pretend play with roles), resist an impulse (like waiting their turn), and adapt when the game changes direction. The adult's role in this kind of development is often to create the conditions for play and then get out of the way: providing materials and time, introducing a challenge if the child is stuck, and resisting the urge to solve problems the child can solve themselves. Executive function skills that are built through play tend to be more durable than those taught through instruction, because the child exercises them intrinsically.",
    bodyHe:
      "תפקוד ניהולי — אשכול מיומנויות מנטליות הכולל זיכרון עבודה, חשיבה גמישה ושליטה עצמית — אינו מתורגל בעיקרו דרך דפי עבודה או אפליקציות. מבחינה התפתחותית, הוא נבנה באופן אמין ביותר דרך משחק פתוח ומונחה-עצמי, במיוחד משחק הדורש מהילד להחזיק כלל בראש (כמו משחק דמיון עם תפקידים), לעמוד בפני דחף (כמו לחכות לתורו) ולהתאים כשהמשחק משנה כיוון. תפקיד המבוגר בסוג זה של התפתחות הוא לעתים קרובות ליצור את התנאים למשחק ואז לפנות מקום: לספק חומרים וזמן, להכניס אתגר אם הילד תקוע, ולעמוד בפני הדחף לפתור בעיות שהילד יכול לפתור בעצמו. מיומנויות תפקוד ניהולי הנבנות דרך משחק נוטות להיות עמידות יותר מאלו שנלמדות דרך הוראה, כי הילד מפעיל אותן באופן פנימי.",
  },

  // ── social_development ──────────────────────────────────────────────────
  {
    id: "peer-play-stages",
    domain: "social_development",
    titleEn: "The natural stages of peer play",
    titleHe: "השלבים הטבעיים של משחק עם בני גיל",
    topicEn: "Social play",
    topicHe: "משחק חברתי",
    readingMinutes: 4,
    bodyEn:
      "Children's social play develops through recognisable stages — not because one is better than another, but because each builds the capacity for the next. Very young children typically engage in parallel play: playing alongside, but not with, another child, absorbed in their own activity while watching peripherally. This gives way gradually to associative play, where children use the same materials or share a loose theme without coordinated rules, and eventually to cooperative play, where children negotiate roles, goals, and rules together. Conflict in early social play is not a social failure — it is a primary driver of social learning, because navigating disagreement is where children develop the capacity for perspective-taking, compromise, and repair. Patience with messy social moments is one of the most developmentally supportive things a caregiver can offer.",
    bodyHe:
      "המשחק החברתי של ילדים מתפתח דרך שלבים ניתנים לזיהוי — לא מפני שאחד טוב מהאחר, אלא מפני שכל שלב בונה את היכולת לשלב הבא. ילדים צעירים מאוד עוסקים בדרך כלל במשחק מקביל: משחק לצד ילד אחר, אך לא איתו, שקועים בפעילות שלהם תוך צפייה היקפית. זה מפנה בהדרגה מקום למשחק אסוציאטיבי, שבו ילדים משתמשים באותם חומרים או משתפים נושא רופף ללא כללים מתואמים, ובסופו של דבר למשחק שיתופי, שבו ילדים מנהלים משא ומתן על תפקידים, מטרות וכללים יחד. קונפליקט במשחק חברתי מוקדם אינו כישלון חברתי — הוא מניע ראשי של למידה חברתית, כי ניווט אי-הסכמה הוא המקום שבו ילדים מפתחים יכולות של נטילת פרספקטיבה, פשרה ותיקון. סבלנות ברגעים חברתיים מבולגנים היא אחת הדברים התומכים ביותר מבחינה התפתחותית שמטפל יכול להציע.",
  },

  // ── independence_adaptive_skills ────────────────────────────────────────
  {
    id: "transitions-predictable-routines",
    domain: "independence_adaptive_skills",
    titleEn: "Transitions: why predictable routines reduce friction",
    titleHe: "מעברים: מדוע שגרות צפויות מפחיתות חיכוך",
    topicEn: "Transitions",
    topicHe: "מעברים",
    readingMinutes: 4,
    bodyEn:
      "Transitions — moving from one activity, place, or person to another — are among the most reliably challenging moments in early childhood because they require the child to disengage from something absorbing, hold an upcoming change in working memory, and regulate the discomfort of not-yet. Children are not being difficult when transitions are hard; their nervous system is doing exactly what a developing nervous system does. The most consistent finding in early childhood research is that predictability dramatically reduces transition friction: when a child knows the sequence that comes next (a visual schedule, a transition song, a specific phrase the caregiver uses), the working memory load shrinks and the emotional cost goes down. Giving a child agency within a predictable structure — 'you choose: shoes first or jacket first?' — builds both cooperation and a sense of competence over time.",
    bodyHe:
      "מעברים — מעבר מפעילות אחת, מקום אחד, או אדם אחד לאחר — הם בין הרגעים המאתגרים ביותר בילדות המוקדמת, כי הם דורשים מהילד להתנתק ממשהו מרתק, להחזיק שינוי קרוב בזיכרון העבודה, ולווסת את אי-הנוחות של ה-עוד-לא. ילדים לא מתנהגים בצורה קשה כשמעברים קשים; מערכת העצבים שלהם עושה בדיוק מה שמערכת עצבים מתפתחת עושה. הממצא העקבי ביותר במחקרי ילדות מוקדמת הוא שצפיות מפחיתה דרמטית את חיכוך המעבר: כשילד יודע את הרצף שיבוא (לוח זמנים חזותי, שיר מעבר, ביטוי ספציפי שהמטפל משתמש בו), עומס זיכרון העבודה מצטמצם והעלות הרגשית יורדת. מתן עצמאות לילד בתוך מבנה צפוי — 'אתה בוחר: נעליים קודם או מעיל קודם?' — בונה גם שיתוף פעולה וגם תחושת מסוגלות לאורך זמן.",
  },

  // ── sensory_motor_patterns ──────────────────────────────────────────────
  {
    id: "sensory-environment-design",
    domain: "sensory_motor_patterns",
    titleEn: "Designing a sensory-aware environment at home",
    titleHe: "תכנון סביבה מודעת-חושים בבית",
    topicEn: "Sensory environment",
    topicHe: "סביבה חושית",
    readingMinutes: 4,
    bodyEn:
      "Children vary widely in how much sensory input their nervous system processes comfortably — some seek more stimulation, others are quickly overwhelmed by noise, textures, or crowds. Neither end of this spectrum is a problem; it is a feature of individual nervous system variation. What supports children across the sensory spectrum is an environment that offers predictability and agency: knowing what comes next, having a quieter space available when stimulation builds, and being able to choose what they engage with rather than being caught by surprise. Parents often notice that difficult moments cluster around certain times or settings (loud restaurants, busy transitions, scratchy clothes) — these observations are valuable data, not parenting failures. Small adjustments to the sensory environment — more warning before loud events, softer textures available, dimmer lighting in the evening — can meaningfully reduce the number of overwhelm moments across a day.",
    bodyHe:
      "ילדים נבדלים מאוד בכמות הקלט החושי שמערכת העצבים שלהם מעבדת בנוחות — חלקם מחפשים עוד גירוי, אחרים מוצפים במהירות מרעש, מרקמים או עומס אנשים. אף אחד מקצוות הספקטרום הזה אינו בעיה; זוהי תכונה של שונות פרטנית במערכת העצבים. מה שתומך בילדים לאורך הספקטרום החושי הוא סביבה המציעה צפיות ועצמאות: לדעת מה בא אחר כך, להחזיק מרחב שקט יותר זמין כשהגירוי מצטבר, ולהיות מסוגל לבחור במה לעסוק במקום להיתפס בהפתעה. הורים לעתים קרובות שמים לב שרגעים קשים מתקבצים סביב זמנים או מסגרות מסוימים (מסעדות רועשות, מעברים עמוסים, בגדים מגרדים) — תצפיות אלה הן נתונים בעלי ערך, לא כישלונות הורות. התאמות קטנות בסביבה החושית — יותר אזהרה לפני אירועים רועשים, מרקמים רכים יותר זמינים, תאורה עמומה יותר בערב — יכולות להפחית באופן משמעותי את מספר רגעי ההצפה לאורך היום.",
  },

  // ── ecosystem_stressors ─────────────────────────────────────────────────
  {
    id: "family-transitions-context",
    domain: "ecosystem_stressors",
    titleEn: "How family context shapes child development",
    titleHe: "כיצד הקשר משפחתי מעצב את התפתחות הילד",
    topicEn: "Family context",
    topicHe: "הקשר משפחתי",
    readingMinutes: 4,
    bodyEn:
      "A child does not develop in isolation — they develop within a web of relationships, routines, and environmental conditions that can either buffer or amplify whatever they are navigating at a given stage. Family transitions (a new sibling, a house move, a change in school, caregiver stress) do not derail development — they are part of the context every family moves through. What research on family resilience consistently shows is that the key protective factor is not the absence of stress but the family's capacity to stay coordinated during it: maintaining enough of the routines and rituals the child recognises, keeping communication open about what is changing, and giving the child a small but real sense of agency in what they can influence. Co-parent alignment — both caregivers sharing the same basic framework for what is happening — is one of the most stabilising things available during periods of transition.",
    bodyHe:
      "ילד אינו מתפתח בבידוד — הוא מתפתח בתוך רשת של מערכות יחסים, שגרות ותנאים סביבתיים שיכולים לספוג מכות עבורו או להגביר כל מה שהוא מנווט בשלב מסוים. מעברים משפחתיים (אח/ות חדש, מעבר דירה, שינוי בגן/בית הספר, לחץ מטפל) אינם משגים את ההתפתחות — הם חלק מהקשר שכל משפחה עוברת. מה שמחקר חוסן משפחתי מראה בעקביות הוא שגורם ההגנה המרכזי אינו היעדר לחץ אלא יכולת המשפחה להישאר מתואמת במהלכו: שמירה על מספיק שגרות וטקסים שהילד מכיר, שמירה על תקשורת פתוחה לגבי מה משתנה, ומתן לילד תחושה קטנה אך אמיתית של עצמאות בנוגע למה שהוא יכול להשפיע עליו. יישור קו של הורים — שני המטפלים חולקים את אותה מסגרת בסיסית לגבי מה שקורה — הוא אחד הדברים המייצבים ביותר הזמינים בתקופות של מעבר.",
  },

  // ── attachment_regulation (added) ───────────────────────────────────────
  {
    id: "serve-and-return-brain-architecture",
    domain: "attachment_regulation",
    titleEn: "Serve and return: the conversation that builds a brain",
    titleHe: "מסירה והחזרה: השיחה שבונה מוח",
    topicEn: "Attachment",
    topicHe: "התקשרות",
    readingMinutes: 4,
    bodyEn:
      "Long before a baby can talk, they are already starting conversations. A coo, a reach, a wide-eyed look, a pointed finger — each is a 'serve', an invitation for connection. When a caring adult 'returns' it by making eye contact, using words, mirroring the sound, or following the child's gaze, a back-and-forth exchange begins. The Center on the Developing Child at Harvard University describes this pattern of serve-and-return interaction as one of the ways early relationships help shape the developing architecture of a child's brain, laying groundwork for communication and social capacities. The beautiful part for parents is how ordinary this is: no special toys or curriculum are required, only noticing what the child is interested in and responding to it. Naming what the baby looks at, waiting for their reply, and letting them lead the rhythm turns everyday moments — a diaper change, a walk, a meal — into the exchanges through which connection is built.",
    bodyHe:
      "הרבה לפני שתינוק יכול לדבר, הוא כבר מתחיל שיחות. גרגור, הושטת יד, מבט בעיניים פעורות, אצבע מצביעה — כל אחד מהם הוא 'מסירה', הזמנה לחיבור. כשמבוגר מטפל 'מחזיר' אותה דרך יצירת קשר עין, שימוש במילים, שיקוף הצליל, או מעקב אחר מבט הילד, מתחיל חילופין של הלוך ושוב. המרכז להתפתחות הילד באוניברסיטת הרווארד מתאר את דפוס האינטראקציה הזה של מסירה והחזרה כאחת הדרכים שבהן מערכות יחסים מוקדמות מסייעות לעצב את הארכיטקטורה המתפתחת של מוח הילד, ומניחות תשתית ליכולות תקשורת וחברה. החלק היפה עבור הורים הוא כמה שזה יומיומי: אין צורך בצעצועים מיוחדים או בתוכנית לימודים, רק בשימת לב למה שמעניין את הילד ובתגובה אליו. לתת שם למה שהתינוק מביט בו, לחכות לתשובתו, ולתת לו להוביל את הקצב — כל אלה הופכים רגעים יומיומיים כמו החלפת חיתול, טיול או ארוחה לחילופין שדרכם נבנה החיבור.",
  },
  {
    id: "name-it-to-tame-it",
    domain: "attachment_regulation",
    titleEn: "Name it to tame it: how words calm big feelings",
    titleHe: "לתת שם כדי להרגיע: כיצד מילים מרגיעות רגשות גדולים",
    topicEn: "Regulation",
    topicHe: "ויסות",
    readingMinutes: 3,
    bodyEn:
      "When a child is swept up in a wave of anger, fear, or disappointment, a parent's instinct is often to fix the problem or talk the child out of the feeling. Psychiatrist Dan Siegel offers a different starting point, captured in the phrase 'name it to tame it': gently putting the feeling into words. When a caregiver reflects back what they see — 'you were really hoping to stay longer, and now you feel disappointed' — they help the child connect the raw, wordless storm of sensation to language. Naming an emotion is thought to help bring the more reflective, verbal parts of the brain into contact with the more reactive, alarm-driven parts, so the feeling becomes something the child can observe rather than only be swept up in. This is not about talking a child out of an emotion or rushing them past it; it is about accompanying the feeling with words while it runs its course. Over time, hearing feelings named by a trusted adult helps a child build their own inner vocabulary for what is happening inside them.",
    bodyHe:
      "כשילד נסחף בגל של כעס, פחד או אכזבה, האינסטינקט של ההורה לרוב הוא לפתור את הבעיה או לשכנע את הילד לצאת מהרגש. הפסיכיאטר דן סיגל מציע נקודת פתיחה אחרת, המגולמת בביטוי 'לתת שם כדי להרגיע': להלביש בעדינות את הרגש במילים. כשמטפל משקף בחזרה את מה שהוא רואה — 'ממש קיווית להישאר עוד, ועכשיו אתה מרגיש אכזבה' — הוא מסייע לילד לחבר את סערת התחושות הגולמית וחסרת המילים אל השפה. מקובל לחשוב שמתן שם לרגש עוזר להביא את החלקים הרפלקטיביים והמילוליים יותר של המוח למגע עם החלקים הריאקטיביים ומונעי-האזעקה יותר, כך שהרגש הופך למשהו שהילד יכול להתבונן בו במקום רק להיסחף בו. אין מדובר בשכנוע הילד לצאת מהרגש או בהאצתו מעברו; מדובר בליווי הרגש במילים בזמן שהוא מתרחש. לאורך זמן, שמיעת רגשות מקבלים שם ממבוגר מהימן עוזרת לילד לבנות אוצר מילים פנימי משלו למה שקורה בתוכו.",
  },

  // ── sensory_motor_patterns (added) ──────────────────────────────────────
  {
    id: "routines-calm-nervous-system",
    domain: "sensory_motor_patterns",
    titleEn: "Why predictable rhythms settle a child's nervous system",
    titleHe: "מדוע קצב צפוי מרגיע את מערכת העצבים של הילד",
    topicEn: "Regulation & rhythm",
    topicHe: "ויסות וקצב",
    readingMinutes: 4,
    bodyEn:
      "A young child's nervous system is doing an enormous amount of work simply to make sense of a world that is still new. Much of a child's day is spent predicting what comes next — and when the world is predictable, that prediction is easy and the body can stay settled. When it is not, the nervous system has to stay on alert, scanning for what might happen. This is one reason familiar daily rhythms — a similar order to mornings, a recognisable wind-down before sleep, a few dependable rituals — often help children feel calmer and more cooperative. Predictability lowers the moment-to-moment load of anticipating the unknown, freeing the child's energy for play, curiosity, and connection. Routines do not have to be rigid schedules measured by the clock; what matters is the recognisable sequence — first this, then that. When life does need to change, a little advance warning and a familiar ritual carried into the new situation can help a child's body stay grounded through it.",
    bodyHe:
      "מערכת העצבים של ילד צעיר עושה עבודה עצומה רק כדי להבין עולם שעדיין חדש עבורו. חלק גדול מיומו של ילד מוקדש לחיזוי מה יבוא אחר כך — וכשהעולם צפוי, החיזוי קל והגוף יכול להישאר רגוע. כשהוא אינו צפוי, מערכת העצבים נאלצת להישאר בכוננות, סורקת מה עלול לקרות. זו אחת הסיבות שקצב יומי מוכר — סדר דומה לבקרים, שגרת הרגעה מזוהה לפני השינה, כמה טקסים אמינים — עוזר לעתים קרובות לילדים להרגיש רגועים ומשתפים פעולה יותר. צפיות מפחיתה את העומס הרגעי של ציפייה לבלתי-ידוע, ומשחררת את האנרגיה של הילד למשחק, סקרנות וחיבור. שגרות אינן חייבות להיות לוחות זמנים נוקשים הנמדדים בשעון; מה שחשוב הוא הרצף המזוהה — קודם זה, אחר כך זה. כשהחיים כן צריכים להשתנות, אזהרה קטנה מראש וטקס מוכר הנישא אל המצב החדש יכולים לעזור לגוף הילד להישאר יציב לאורכו.",
  },

  // ── cognition_executive_function (added) ────────────────────────────────
  {
    id: "science-of-play",
    domain: "cognition_executive_function",
    titleEn: "The serious science of play",
    titleHe: "המדע הרציני של המשחק",
    topicEn: "Play & learning",
    topicHe: "משחק ולמידה",
    readingMinutes: 4,
    bodyEn:
      "Play can look like the opposite of learning — unstructured, silly, going nowhere in particular. Developmental science tells a different story: play is one of the primary ways young children learn about the physical world, other people, and themselves. In free, child-led play, a child sets their own goals, tests ideas, adjusts when something does not work, and practises the give-and-take of imagination and negotiation. The American Academy of Pediatrics has emphasised, in its writing on the role of play, that unstructured playtime is a meaningful part of healthy development, not a break from it. Crucially, the richest play is often the least equipped: a box, some cushions, water, sticks, a few figures. Open-ended materials invite the child to supply the ideas, which is exactly where the developmental work happens. The adult's most useful role is frequently to protect time and space for play, join when invited, and resist the urge to direct it or turn every moment into a lesson.",
    bodyHe:
      "משחק יכול להיראות כהיפוכה של למידה — לא מובנה, שטותי, לא מוביל לשום מקום מסוים. המדע ההתפתחותי מספר סיפור אחר: משחק הוא אחת הדרכים העיקריות שבהן ילדים צעירים לומדים על העולם הפיזי, על אנשים אחרים ועל עצמם. במשחק חופשי ומונחה-ילד, הילד מציב לעצמו מטרות, בוחן רעיונות, מתאים כשמשהו לא עובד, ומתרגל את הנתינה והקבלה של דמיון ומשא ומתן. האקדמיה האמריקאית לרפואת ילדים הדגישה, בכתיבתה על תפקיד המשחק, שזמן משחק לא מובנה הוא חלק משמעותי מהתפתחות בריאה, ולא הפסקה ממנה. באופן מהותי, המשחק העשיר ביותר הוא לעתים קרובות המצויד ביותר במיעוט: קופסה, כמה כריות, מים, מקלות, כמה דמויות. חומרים פתוחים מזמינים את הילד לספק את הרעיונות, וזה בדיוק המקום שבו מתרחשת העבודה ההתפתחותית. תפקידו המועיל ביותר של המבוגר הוא לעתים קרובות להגן על זמן ומרחב למשחק, להצטרף כשמזמינים אותו, ולעמוד בפני הדחף לכוון אותו או להפוך כל רגע לשיעור.",
  },

  // ── ecosystem_stressors (added) ─────────────────────────────────────────
  {
    id: "temperament-goodness-of-fit",
    domain: "ecosystem_stressors",
    titleEn: "Temperament and 'goodness of fit'",
    titleHe: "מזג ו'התאמה טובה'",
    topicEn: "Temperament & fit",
    topicHe: "מזג והתאמה",
    readingMinutes: 4,
    bodyEn:
      "Children arrive with their own built-in style — how intensely they react, how quickly they warm to new people and places, how active or cautious they tend to be. In the pioneering work of Alexander Thomas and Stella Chess, this inborn style was called temperament, and their most enduring idea was 'goodness of fit': the degree to which the demands and expectations of a child's environment match the child they actually are. Their observation was that temperament on its own does not decide how things go — what matters more is the fit between the child and how the people and settings around them respond. A cautious child given time to warm up, or a spirited child given room to move, can flourish; the same children pressed to be someone they are not may struggle more. This reframes many everyday tensions not as something wrong with the child or the parent, but as a fit that can be adjusted — shaping the environment and expectations to work with a child's nature rather than against it.",
    bodyHe:
      "ילדים מגיעים עם סגנון מובנה משלהם — עד כמה הם מגיבים בעוצמה, כמה מהר הם מתחממים לאנשים ומקומות חדשים, עד כמה הם נוטים להיות פעילים או זהירים. בעבודתם פורצת הדרך של אלכסנדר תומס וסטלה צ'ס, סגנון מולד זה נקרא מזג, והרעיון המתמשך ביותר שלהם היה 'התאמה טובה': המידה שבה הדרישות והציפיות של סביבת הילד תואמות את הילד שהוא באמת. התצפית שלהם הייתה שהמזג כשלעצמו אינו קובע כיצד הדברים יתפתחו — מה שחשוב יותר הוא ההתאמה בין הילד לבין האופן שבו האנשים והמסגרות סביבו מגיבים. ילד זהיר שמקבל זמן להתחמם, או ילד תוסס שמקבל מרחב לנוע, יכולים לפרוח; אותם ילדים בדיוק, כשנלחצים להיות מי שאינם, עשויים להתקשות יותר. זה ממסגר מחדש מתחים יומיומיים רבים לא כמשהו שלא בסדר אצל הילד או ההורה, אלא כהתאמה שניתן לכוונן — עיצוב הסביבה והציפיות כך שיעבדו עם טבע הילד ולא נגדו.",
  },

  // ── social_development (added) ──────────────────────────────────────────
  {
    id: "special-time-child-led",
    domain: "social_development",
    titleEn: "The quiet power of 'special time'",
    titleHe: "כוחו השקט של 'זמן מיוחד'",
    topicEn: "Connection",
    topicHe: "חיבור",
    readingMinutes: 3,
    bodyEn:
      "Amid busy days full of instructions — hurry up, put that down, not now — children can go long stretches without the experience of an adult simply delighting in them. 'Special time' is a small, deliberate practice drawn from child-led play approaches used in parent-child relationship work: a short, protected window, even five or ten minutes, in which the parent follows the child's lead completely. The child chooses the activity; the adult narrates warmly, joins in, and holds back on questions, corrections, and teaching. The value lies precisely in the lack of agenda — the child experiences being enjoyed for who they are, not for what they achieve. Because it is predictable and repeated (rather than one grand outing), special time becomes a reliable deposit into the relationship that children can count on. Many caregivers find that a little regular, undivided, follow-the-child attention makes cooperation easier in the rest of the day, because connection has already been fed.",
    bodyHe:
      "בתוך ימים עמוסים מלאי הוראות — תזדרז, תניח את זה, לא עכשיו — ילדים יכולים לעבור פרקי זמן ארוכים בלי החוויה של מבוגר שפשוט נהנה מהם. 'זמן מיוחד' הוא תרגול קטן ומכוון השאוב מגישות משחק מונחה-ילד המשמשות בעבודה על יחסי הורה-ילד: חלון זמן קצר ומוגן, אפילו חמש או עשר דקות, שבו ההורה עוקב באופן מלא אחר הובלת הילד. הילד בוחר את הפעילות; המבוגר מתאר בחמימות, מצטרף, ונמנע משאלות, תיקונים והוראה. הערך טמון דווקא בהיעדר האג'נדה — הילד חווה שנהנים ממנו על מי שהוא, לא על מה שהוא משיג. מכיוון שהוא צפוי וחוזר (ולא בילוי גדול חד-פעמי), הזמן המיוחד הופך להפקדה אמינה במערכת היחסים שהילדים יכולים לסמוך עליה. מטפלים רבים מגלים שמעט תשומת לב סדירה, בלתי-מחולקת ומונחית-ילד מקלה על שיתוף הפעולה בשאר היום, כי החיבור כבר הוזן.",
  },

  // ── language_communication (added) ──────────────────────────────────────
  {
    id: "reading-aloud-dialogic",
    domain: "language_communication",
    titleEn: "Reading aloud as a two-way conversation",
    titleHe: "קריאה בקול כשיחה דו-כיוונית",
    topicEn: "Reading aloud",
    topicHe: "קריאה בקול",
    readingMinutes: 4,
    bodyEn:
      "Reading a picture book to a child is wonderful — and it becomes even richer when it turns from a monologue into a conversation. This is the idea behind dialogic reading, developed by Grover Whitehurst and colleagues, in which the adult reads less like a narrator and more like a partner, inviting the child to become the storyteller. Rather than reading straight through, the adult pauses to ask open questions ('what do you think is happening here?'), follows the child's answer, gently expands on it, and lets the child fill in a familiar line. The approach is often summarised with the prompts to complete, recall, ask open-ended and 'wh-' questions, and connect the book to the child's own life. What makes this powerful for language is the back-and-forth: the child is not just hearing words but producing them, being listened to, and having their contribution built upon. The same book, read many times, becomes a fresh conversation each time as the child takes on a bigger role in telling it.",
    bodyHe:
      "קריאת ספר מאויר לילד היא נפלאה — והיא נעשית עשירה עוד יותר כשהיא הופכת ממונולוג לשיחה. זהו הרעיון שמאחורי קריאה דיאלוגית, שפותחה על ידי גרובר וייטהרסט ועמיתיו, שבה המבוגר קורא פחות כמספר ויותר כשותף, ומזמין את הילד להפוך למספר הסיפור. במקום לקרוא ברצף, המבוגר עוצר כדי לשאול שאלות פתוחות ('מה לדעתך קורה כאן?'), עוקב אחר תשובת הילד, מרחיב אותה בעדינות, ומאפשר לילד להשלים שורה מוכרת. הגישה מסוכמת לעתים קרובות בהנחיות להשלים, להיזכר, לשאול שאלות פתוחות ושאלות 'מה/מי/למה', ולקשר את הספר לחיי הילד עצמו. מה שהופך זאת לרב-עוצמה עבור השפה הוא ההלוך ושוב: הילד לא רק שומע מילים אלא מפיק אותן, מוקשב לו, ותרומתו נבנית הלאה. אותו ספר, הנקרא פעמים רבות, הופך לשיחה רעננה בכל פעם ככל שהילד נוטל תפקיד גדול יותר בסיפורו.",
  },

  // ── independence_adaptive_skills (added) ────────────────────────────────
  {
    id: "toddler-autonomy-no",
    domain: "independence_adaptive_skills",
    titleEn: "The toddler 'no': autonomy in the making",
    titleHe: "ה'לא' של הפעוט: עצמאות בהתהוות",
    topicEn: "Autonomy",
    topicHe: "עצמאות",
    readingMinutes: 4,
    bodyEn:
      "The sudden arrival of a firm, frequent 'no' can feel like defiance, but it usually signals something developmentally healthy: a child discovering that they are a separate person with a will of their own. Erik Erikson framed the toddler years as a period centred on autonomy — the growing drive to do things oneself and to have some say over what happens. Saying 'no', insisting on the red cup, wanting to put on shoes unaided: these are early experiments in agency, not battles to be won or lost. Children of this age genuinely need real, safe opportunities to exercise choice, which is why offering bounded options ('grapes or apple?') so often works better than open-ended demands or head-on commands. The task for caregivers is not to crush the emerging will nor to hand over the whole household, but to hold clear limits warmly while making room for the child to practise deciding. A child who is allowed to exercise autonomy within safe boundaries is doing exactly the developmental work this stage is for.",
    bodyHe:
      "ההופעה הפתאומית של 'לא' נחרץ ותכוף יכולה להרגיש כמו התרסה, אך בדרך כלל היא מסמנת משהו בריא מבחינה התפתחותית: ילד המגלה שהוא אדם נפרד בעל רצון משלו. אריק אריקסון מיסגר את שנות הפעוטות כתקופה שבמרכזה עצמאות — הדחף הגובר לעשות דברים בעצמו ולומר משהו לגבי מה שקורה. לומר 'לא', להתעקש על הכוס האדומה, לרצות לנעול נעליים ללא עזרה: אלה ניסויים מוקדמים במסוגלות, לא קרבות שיש לנצח או להפסיד. ילדים בגיל זה באמת זקוקים להזדמנויות אמיתיות ובטוחות לתרגל בחירה, ולכן הצעת אפשרויות תחומות ('ענבים או תפוח?') לעתים קרובות עובדת טוב יותר מדרישות פתוחות או פקודות חזיתיות. המשימה של המטפלים אינה למחוץ את הרצון המתהווה ולא למסור את כל הבית, אלא להחזיק גבולות ברורים בחמימות תוך פינוי מקום לילד לתרגל החלטה. ילד שמורשה לתרגל עצמאות בתוך גבולות בטוחים עושה בדיוק את העבודה ההתפתחותית שהשלב הזה נועד לה.",
  },
];

/** Map domain id → best-match article id (one article per domain). */
const DOMAIN_TO_ARTICLE: Record<string, string> = {
  attachment_regulation: "co-regulation-as-skill",
  language_communication: "bilingual-home-environment",
  cognition_executive_function: "executive-function-play",
  social_development: "peer-play-stages",
  independence_adaptive_skills: "transitions-predictable-routines",
  sensory_motor_patterns: "sensory-environment-design",
  ecosystem_stressors: "family-transitions-context",
};

/** Fallback article when no domain data is available. */
const FALLBACK_ARTICLE_ID = "co-regulation-as-skill";

/**
 * Select the weekly Scholar Hub article.
 *
 * Reads the `focusDomain` from the EXISTING computeDevScore result
 * (already computed by DevScoreCard; caller passes it in to avoid
 * re-computation and any accidental duplicate read).
 *
 * No-data / no-focusDomain: returns the fallback article with
 * `isDefault = true` so the UI can render the graceful empty state.
 */
export function selectWeeklyArticle(focusDomain: string | null): {
  article: ScholarArticle;
  isDefault: boolean;
} {
  if (!focusDomain) {
    const fallback = SCHOLAR_ARTICLES.find((a) => a.id === FALLBACK_ARTICLE_ID)!;
    return { article: fallback, isDefault: true };
  }
  const articleId = DOMAIN_TO_ARTICLE[focusDomain];
  const article =
    SCHOLAR_ARTICLES.find((a) => a.id === articleId) ??
    SCHOLAR_ARTICLES.find((a) => a.id === FALLBACK_ARTICLE_ID)!;
  return { article, isDefault: false };
}
