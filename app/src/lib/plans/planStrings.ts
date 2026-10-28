/**
 * lib/plans/planStrings — B-BOOK-77/78: the parent-register strings of the
 * Everyday Plans composer, the plans section and Today's plan lead, EN + HE,
 * in the elevation-dictionary pattern (one typed key set, two Records, one
 * accessor), kept beside the feature so it adds no line to lib/i18n.ts.
 * Positioning lexicon: "developmentally informed parent practice", never
 * treatment; counts, never scores; no verdict about the child. HE: native
 * review owed.
 */
export type PlanStringKey =
  | "section.title"
  | "section.lede"
  | "section.running"
  | "section.doors"
  | "section.nights"
  | "section.daysLeft"
  | "section.review"
  | "section.empty"
  | "door.open"
  | "door.dark"
  | "stage.door.kicker"
  | "stage.door.body"
  | "stage.door.start"
  | "stage.redLines.title"
  | "stage.redLines.body"
  | "stage.redLines.none"
  | "stage.redLines.next"
  | "stage.care.title"
  | "stage.care.body"
  | "stage.care.safety"
  | "stage.care.back"
  | "stage.steps.title"
  | "stage.steps.body"
  | "stage.steps.step"
  | "stage.steps.swap"
  | "stage.steps.minutes"
  | "stage.steps.time"
  | "stage.steps.own"
  | "stage.steps.ownHint"
  | "stage.steps.ownPhrase"
  | "stage.steps.ownPhrasing"
  | "stage.steps.ownLabel"
  | "stage.steps.ownApprove"
  | "stage.steps.ownDrop"
  | "stage.steps.ownRefused"
  | "stage.steps.origin"
  | "stage.steps.origin.parent"
  | "stage.steps.origin.practitioner"
  | "stage.steps.practitionerLabel"
  | "stage.approved.print"
  | "section.print"
  | "print.kicker"
  | "print.title"
  | "print.approved"
  | "print.nights"
  | "print.steps"
  | "print.box"
  | "print.pages"
  | "print.watchFor"
  | "print.sources"
  | "print.consent"
  | "print.footer"
  | "print.watermark"
  | "stage.steps.next"
  | "stage.box.title"
  | "stage.box.body"
  | "stage.box.duration"
  | "stage.box.next"
  | "stage.preview.title"
  | "stage.preview.body"
  | "stage.preview.approve"
  | "stage.preview.saving"
  | "stage.preview.error"
  | "stage.approved.title"
  | "stage.approved.body"
  | "stage.approved.done"
  | "back"
  | "time.morning"
  | "time.after-meal"
  | "time.afternoon"
  | "time.evening"
  | "time.bedtime"
  | "today.kicker"
  | "today.say"
  | "today.meta"
  | "today.why"
  | "today.time"
  | "today.size"
  | "today.night.q"
  | "today.night.yes"
  | "today.night.no"
  | "today.night.done"
  | "today.night.undo"
  | "today.night.journal"
  | "today.night.journaled"
  | "today.open"
  | "review.title"
  | "review.body"
  | "review.keep"
  | "review.change"
  | "review.close"
  | "plates.title"
  | "plates.body"
  | "plates.paint"
  | "plates.repaint"
  | "plates.painting"
  | "plates.loading"
  | "plates.noStorage"
  | "plates.painted"
  | "plates.failed"
  | "plates.unpainted"
  | "plates.error"
  | "plates.cap"
  | "plates.stopped";

const EN: Record<PlanStringKey, string> = {
  "section.title": "Everyday plans",
  "section.lede": "{name}'s own story for one hard everyday pattern, with the steps you choose. A developmentally informed parent practice, read with zero AI at bedtime.",
  "section.running": "Running now",
  "section.doors": "Start a plan",
  "section.nights": "{count} nights confirmed",
  "section.daysLeft": "{count} days to go",
  "section.review": "The plan's time is up: keep going, change a step, or close it.",
  "section.empty": "No plan is running. Pick the pattern you are living with this month.",
  "door.open": "Make {name}'s plan",
  "door.dark": "Being reviewed; not available for your family yet.",
  "stage.door.kicker": "Everyday plan",
  "stage.door.body": "In a few minutes you will have {name}'s own story for this: a short first-person book with three small steps you choose from a sourced menu, read with zero AI. First, a few questions that decide whether a plan is the right next step.",
  "stage.door.start": "Let's see",
  "stage.redLines.title": "First: is any of these true?",
  "stage.redLines.body": "Tick what you have noticed. If any is true, this plan is not the next step; your doctor is.",
  "stage.redLines.none": "None of these",
  "stage.redLines.next": "Continue",
  "stage.care.title": "Talk to your doctor first",
  "stage.care.body": "What you ticked is a question for the family's own doctor before any plan. Arbor offers no plan for it.",
  "stage.care.safety": "Help and safety",
  "stage.care.back": "Back",
  "stage.steps.title": "The three steps",
  "stage.steps.body": "Three small, concrete steps from a sourced menu. Swap one if another fits your family better. The child hears them in the book exactly as written here.",
  "stage.steps.step": "Step {n}",
  "stage.steps.swap": "Swap this step",
  "stage.steps.minutes": "Minutes",
  "stage.steps.time": "When",
  "stage.steps.own": "Or write a step in your own words",
  "stage.steps.ownHint": "For example, what your child's therapist told you to do. Arbor phrases it for the book; you approve the exact line before the child can hear it.",
  "stage.steps.ownPhrase": "Phrase it for the book",
  "stage.steps.ownPhrasing": "Phrasing…",
  "stage.steps.ownLabel": "Phrased by Arbor's AI from your words. Not in the book until you approve it.",
  "stage.steps.ownApprove": "Approve this exact line",
  "stage.steps.ownDrop": "Drop it",
  "stage.steps.ownRefused": "Arbor could not phrase that line for a child's book. Try plainer words, or choose a step from the menu.",
  "stage.steps.origin": "Whose step is this?",
  "stage.steps.origin.parent": "My own words",
  "stage.steps.origin.practitioner": "A step from the professional who works with {name}",
  "stage.steps.practitionerLabel": "A step from the professional who works with {name}, in your words — phrased by Arbor's AI. Not in the book until you approve it.",
  "stage.approved.print": "Print {name}'s plan",
  "section.print": "Print",
  "plates.title": "Pattern plates (owner)",
  "plates.body": "The shared, child-free art of each pattern, painted once in storage and read by every family. Only accounts on the owner list see this.",
  "plates.paint": "Paint plates",
  "plates.repaint": "Repaint all",
  "plates.painting": "Painting…",
  "plates.loading": "Reading the plate list…",
  "plates.noStorage": "Plate storage is not configured here.",
  "plates.painted": "painted",
  "plates.failed": "failed",
  "plates.unpainted": "not painted",
  "plates.error": "Painting did not finish. Try again.",
  "plates.cap": "Over the per-run cap. Paint one pattern at a time.",
  "plates.stopped": "Stopped early; run again to continue.",
  "print.kicker": "Parent copy — not for the child's shelf",
  "print.title": "{name}'s plan",
  "print.approved": "Approved by a parent on {date}, for {days} days.",
  "print.nights": "Nights confirmed by a parent so far: {count}",
  "print.steps": "The steps, as the grown-ups do them",
  "print.box": "The box",
  "print.pages": "The book, page by page, as {name} hears it",
  "print.watchFor": "When to stop the plan and talk to your family's doctor",
  "print.sources": "Where the steps come from",
  "print.consent": "Family data: this is {name}'s plan, printed by a parent from Arbor on {date}, with no photo and no grade of {name}. Share it only with people you trust with {name}'s information; they should not keep a copy longer than you want them to.",
  "print.footer": "Arbor supports developmentally informed parent practice. It gives no medical advice and never grades a child; your family's own doctor comes first.",
  "print.watermark": "{name}'s plan · parent copy · made with Arbor",
  "stage.steps.next": "Continue",
  "stage.box.title": "The box, and how long",
  "stage.box.body": "What goes in the box your child can choose from, and how many days the plan sits first at bedtime.",
  "stage.box.duration": "Days",
  "stage.box.next": "Preview the book",
  "stage.preview.title": "Read it as {name} will",
  "stage.preview.body": "Every word the child will hear. When it reads right, make it {name}'s plan.",
  "stage.preview.approve": "This is {name}'s plan",
  "stage.preview.saving": "Saving…",
  "stage.preview.error": "The plan could not be saved. Try again.",
  "stage.approved.title": "{name}'s plan is ready",
  "stage.approved.body": "It sits first at bedtime for {days} days. The steps are your week in Today, and the nights you confirm are counted on your shelf. Nothing here grades {name}.",
  "stage.approved.done": "Done",
  back: "Back",
  "time.morning": "Every morning",
  "time.after-meal": "After lunch",
  "time.afternoon": "Every afternoon",
  "time.evening": "Every evening",
  "time.bedtime": "At bedtime",
  "today.kicker": "{name}'s plan",
  "today.say": "Small steps, the same every day.",
  "today.meta": "Day {day} of {days}",
  "today.why": "you made this plan for {name}",
  "today.time": "This evening",
  "today.size": "Three small steps",
  "today.night.q": "Did the plan happen tonight?",
  "today.night.yes": "Yes, we did it",
  "today.night.no": "Not tonight",
  "today.night.done": "Counted for tonight.",
  "today.night.undo": "Undo",
  "today.night.journal": "Keep tonight in the journal",
  "today.night.journaled": "Kept in the journal.",
  "today.open": "Open the plan",
  "review.title": "The plan's time is up",
  "review.body": "{count} nights confirmed. Keep going, change a step, or close it.",
  "review.keep": "Keep going two more weeks",
  "review.change": "Change a step",
  "review.close": "Close the plan",
};

const HE: Record<PlanStringKey, string> = {
  "section.title": "תוכניות ליום-יום",
  "section.lede": "הסיפור של {name} על דפוס יום-יומי קשה אחד, עם השלבים שאתם בוחרים. תרגול הורי מבוסס התפתחות, שנקרא בלי AI לפני השינה.",
  "section.running": "רץ עכשיו",
  "section.doors": "להתחיל תוכנית",
  "section.nights": "{count} לילות אושרו",
  "section.daysLeft": "עוד {count} ימים",
  "section.review": "הזמן של התוכנית נגמר: להמשיך, לשנות שלב, או לסגור.",
  "section.empty": "אין תוכנית שרצה. בחרו את הדפוס שאתם חיים איתו החודש.",
  "door.open": "להכין את התוכנית של {name}",
  "door.dark": "בבדיקה; עדיין לא זמין למשפחה שלכם.",
  "stage.door.kicker": "תוכנית ליום-יום",
  "stage.door.body": "בעוד כמה דקות יהיה ל{name} סיפור משלו על זה: ספר קצר בגוף ראשון עם שלושה שלבים קטנים שאתם בוחרים מתפריט מבוסס מקורות, שנקרא בלי AI. קודם, כמה שאלות שמחליטות אם תוכנית היא הצעד הנכון.",
  "stage.door.start": "בואו נראה",
  "stage.redLines.title": "קודם: האם משהו מאלה נכון?",
  "stage.redLines.body": "סמנו מה שמתם לב אליו. אם משהו מזה נכון, התוכנית הזאת היא לא הצעד הבא; הרופא שלכם הוא.",
  "stage.redLines.none": "אף אחד מאלה",
  "stage.redLines.next": "להמשיך",
  "stage.care.title": "דברו קודם עם הרופא שלכם",
  "stage.care.body": "מה שסימנתם הוא שאלה לרופא של המשפחה לפני כל תוכנית. Arbor לא מציעה תוכנית בשביל זה.",
  "stage.care.safety": "עזרה ובטיחות",
  "stage.care.back": "חזרה",
  "stage.steps.title": "שלושת השלבים",
  "stage.steps.body": "שלושה שלבים קטנים וקונקרטיים מתפריט מבוסס מקורות. החליפו שלב אם אחר מתאים יותר למשפחה שלכם. הילד או הילדה שומעים אותם בספר בדיוק כמו שכתוב כאן.",
  "stage.steps.step": "שלב {n}",
  "stage.steps.swap": "להחליף את השלב",
  "stage.steps.minutes": "דקות",
  "stage.steps.time": "מתי",
  "stage.steps.own": "או כתבו שלב במילים שלכם",
  "stage.steps.ownHint": "למשל, מה שהמטפל או המטפלת של הילד אמרו לכם לעשות. Arbor מנסחת את זה לספר; אתם מאשרים את השורה המדויקת לפני שהילד יכול לשמוע אותה.",
  "stage.steps.ownPhrase": "לנסח לספר",
  "stage.steps.ownPhrasing": "מנסחים…",
  "stage.steps.ownLabel": "נוסח על ידי ה-AI של Arbor מהמילים שלכם. לא בספר עד שתאשרו.",
  "stage.steps.ownApprove": "לאשר את השורה המדויקת הזאת",
  "stage.steps.ownDrop": "לוותר עליה",
  "stage.steps.ownRefused": "Arbor לא הצליחה לנסח את השורה הזאת לספר ילדים. נסו מילים פשוטות יותר, או בחרו שלב מהתפריט.",
  "stage.steps.origin": "של מי השלב הזה?",
  "stage.steps.origin.parent": "במילים שלי",
  "stage.steps.origin.practitioner": "שלב מאיש או אשת המקצוע שעובדים עם {name}",
  "stage.steps.practitionerLabel": "שלב מאיש או אשת המקצוע שעובדים עם {name}, במילים שלכם — נוסח על ידי ה-AI של Arbor. לא בספר עד שתאשרו.",
  "stage.approved.print": "להדפיס את התוכנית של {name}",
  "section.print": "להדפיס",
  "plates.title": "לוחות הדפוס (בעלים)",
  "plates.body": "האיור המשותף של כל דפוס, בלי ילד ובלי טקסט, מצויר פעם אחת לאחסון ונקרא על ידי כל משפחה. רק חשבונות ברשימת הבעלים רואים את זה.",
  "plates.paint": "לצייר לוחות",
  "plates.repaint": "לצייר הכול מחדש",
  "plates.painting": "מציירים…",
  "plates.loading": "קוראים את רשימת הלוחות…",
  "plates.noStorage": "אחסון הלוחות לא מוגדר כאן.",
  "plates.painted": "צויר",
  "plates.failed": "נכשל",
  "plates.unpainted": "לא צויר",
  "plates.error": "הציור לא הסתיים. נסו שוב.",
  "plates.cap": "מעבר למכסה לריצה. ציירו דפוס אחד בכל פעם.",
  "plates.stopped": "נעצר מוקדם; הריצו שוב כדי להמשיך.",
  "print.kicker": "עותק להורים — לא למדף של הילד",
  "print.title": "התוכנית של {name}",
  "print.approved": "אושרה על ידי הורה ב-{date}, ל-{days} ימים.",
  "print.nights": "לילות שהורה אישר עד עכשיו: {count}",
  "print.steps": "השלבים, כמו שהמבוגרים עושים אותם",
  "print.box": "הקופסה",
  "print.pages": "הספר, עמוד אחרי עמוד, כמו ש{name} שומע/ת אותו",
  "print.watchFor": "מתי לעצור את התוכנית ולדבר עם רופא/ת המשפחה",
  "print.sources": "מאיפה השלבים מגיעים",
  "print.consent": "מידע משפחתי: זאת התוכנית של {name}, שהודפסה על ידי הורה מ-Arbor ב-{date}, בלי תמונה ובלי ציון של {name}. שתפו אותה רק עם אנשים שאתם סומכים עליהם עם המידע של {name}; הם לא אמורים לשמור עותק יותר ממה שתרצו.",
  "print.footer": "Arbor תומכת בפרקטיקה הורית מבוססת התפתחות. היא לא נותנת ייעוץ רפואי ולא מדרגת ילדים; רופא/ת המשפחה שלכם קודמים.",
  "print.watermark": "התוכנית של {name} · עותק להורים · נוצר עם Arbor",
  "stage.steps.next": "להמשיך",
  "stage.box.title": "הקופסה, וכמה זמן",
  "stage.box.body": "מה נכנס לקופסה שהילד או הילדה יכולים לבחור ממנה, וכמה ימים התוכנית יושבת ראשונה לפני השינה.",
  "stage.box.duration": "ימים",
  "stage.box.next": "לראות את הספר",
  "stage.preview.title": "לקרוא כמו ש{name} יקרא",
  "stage.preview.body": "כל מילה שהילד או הילדה ישמעו. כשזה נקרא נכון, הפכו את זה לתוכנית של {name}.",
  "stage.preview.approve": "זאת התוכנית של {name}",
  "stage.preview.saving": "שומרים…",
  "stage.preview.error": "התוכנית לא נשמרה. נסו שוב.",
  "stage.approved.title": "התוכנית של {name} מוכנה",
  "stage.approved.body": "היא יושבת ראשונה לפני השינה במשך {days} ימים. השלבים הם השבוע שלכם ב'היום', והלילות שאתם מאשרים נספרים במדף שלכם. שום דבר כאן לא מדרג את {name}.",
  "stage.approved.done": "סיימנו",
  back: "חזרה",
  "time.morning": "כל בוקר",
  "time.after-meal": "אחרי ארוחת הצהריים",
  "time.afternoon": "כל אחר צהריים",
  "time.evening": "כל ערב",
  "time.bedtime": "לפני השינה",
  "today.kicker": "התוכנית של {name}",
  "today.say": "צעדים קטנים, אותו דבר כל יום.",
  "today.meta": "יום {day} מתוך {days}",
  "today.why": "הכנתם את התוכנית הזאת בשביל {name}",
  "today.time": "הערב",
  "today.size": "שלושה שלבים קטנים",
  "today.night.q": "התוכנית קרתה הלילה?",
  "today.night.yes": "כן, עשינו",
  "today.night.no": "לא הלילה",
  "today.night.done": "נספר להלילה.",
  "today.night.undo": "לבטל",
  "today.night.journal": "לשמור את הלילה ביומן",
  "today.night.journaled": "נשמר ביומן.",
  "today.open": "לפתוח את התוכנית",
  "review.title": "הזמן של התוכנית נגמר",
  "review.body": "{count} לילות אושרו. להמשיך, לשנות שלב, או לסגור.",
  "review.keep": "להמשיך עוד שבועיים",
  "review.change": "לשנות שלב",
  "review.close": "לסגור את התוכנית",
};

export function planString(key: PlanStringKey, lang: "en" | "he", vars: Record<string, string | number> = {}): string {
  const raw = (lang === "he" ? HE : EN)[key];
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export const PLAN_STRINGS = { en: EN, he: HE } as const;
