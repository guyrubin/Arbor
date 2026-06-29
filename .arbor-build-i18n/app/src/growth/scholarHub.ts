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
