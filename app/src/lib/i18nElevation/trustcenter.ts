/* i18nElevation/trustcenter — masterplan 3.3 + 3.4 + 3.1 (Maytal Row-2, all six
 * frames): the Trust Center rebuild of the Science route (#/science), plus the
 * TrustLink chip other surfaces mount next to their why-lines.
 *
 * CLINICAL FIREWALL: every string is a count, a plain observation, or an
 * explicit negation. No verdicts, no trend deltas, no graded language. The ONE
 * place banned vocabulary may appear is inside the explicit "Arbor never
 * shows…" disclaimers — those keys are suffixed `.never` and the guard test
 * allowlists exactly that suffix. Honest-uncertainty rule (3.3): development is
 * described in ranges / "typical for this age" — never point claims; a
 * screening flag is a conversation starter, not a result (phrasing mirrors
 * i18nElevation/screeningcalm).
 *
 * GD-10 fail-closed: NO named-reviewer / "expert team" strings in this module.
 * The seam for "Reviewed by [name]" lives as a comment in SciencePage.tsx and
 * stays closed until Guy appoints a reviewer.
 *
 * Hebrew = calm Israeli-parent transcreation, outcome language, no AI/tech
 * framing; flagged for arbor-localization native review. The lock line ships
 * VERBATIM from Maytal's mockup frame 2.
 *
 * NOTE: not registered in i18nElevation/index.ts (that file's registry recipe
 * is owned separately). SciencePage.tsx and TrustLink.tsx resolve this module
 * DIRECTLY via trustText() below — same keys, same {var} interpolation as
 * t(), so an eventual index.ts registration is a pure no-op for callers. */

export const en: Record<string, string> = {
  // ── Page header + spine
  "elev.trust.title": "How Arbor works",
  "elev.trust.subtitle":
    "One place that explains what Arbor reads, what each sign means — and what Arbor will never do.",
  "elev.trust.spine":
    "Every “why did I get this?” across Arbor leads back to this page.",

  // ── Hub quick-nav row (Maytal frame 6 — one listing, each row → a section)
  "elev.trust.nav.how": "How Arbor works",
  "elev.trust.nav.data": "Your data",
  "elev.trust.nav.signs": "What signs mean",
  "elev.trust.nav.not": "What Arbor doesn't do",
  "elev.trust.nav.sources": "Sources",
  "elev.trust.nav.more": "Questions & contact",

  // ── Section 1 — How Arbor works (Maytal frame 2)
  "elev.trust.how.title": "How Arbor works",
  "elev.trust.how.body":
    "You share small everyday moments; Arbor connects them to what is typical for your child's age and suggests one small next step at a time. The more you share, the more personal the suggestions become — and you always decide what happens next.",
  "elev.trust.how.uses.title": "What the suggestions are based on",
  "elev.trust.how.uses.age": "Your child's age",
  "elev.trust.how.uses.shared": "What you've shared",
  "elev.trust.how.uses.activities": "Activities completed",
  "elev.trust.how.uses.screening": "Development-check answers",
  "elev.trust.how.uses.base": "Public scientific guidance",
  // Lock line — EN rendering of the verbatim mockup line.
  "elev.trust.how.lock": "Your information is secure — personal information is never shared.",

  // ── Section 2 — What data Arbor collects and uses
  "elev.trust.data.title": "What data Arbor collects and uses",
  "elev.trust.data.profile.label": "Child profile",
  "elev.trust.data.profile.desc": "Name, birth date, and the interests you add.",
  "elev.trust.data.moments.label": "Moments and journal notes",
  "elev.trust.data.moments.desc": "What you write stays in your family's space.",
  "elev.trust.data.play.label": "Activity history",
  "elev.trust.data.play.desc":
    "Which activities were completed, so the next suggestion can continue from there.",
  "elev.trust.data.screening.label": "Development-check answers",
  "elev.trust.data.screening.desc":
    "Used only to surface what may be worth a conversation.",
  "elev.trust.data.coach.label": "Coach conversations",
  "elev.trust.data.coach.desc":
    "Saved so you can return to them; the coach uses only what you approve.",
  "elev.trust.data.manage": "Everything can be exported or deleted, any time.",
  "elev.trust.data.manageCta": "Manage your data in Profile",

  // ── Section 3 — What each sign means (legend of ARBOR'S actual marks)
  "elev.trust.signs.title": "What each sign means",
  "elev.trust.signs.intro":
    "Arbor uses a small set of marks — all of them counts and plain observations.",
  "elev.trust.signs.check.label": "Milestone check",
  "elev.trust.signs.check.desc":
    "A running count of the milestones you've marked as observed. It only grows as you notice more.",
  "elev.trust.signs.flag.label": "“Worth a conversation”",
  "elev.trust.signs.flag.desc":
    "A conversation starter for your next visit with a professional — not a result. It marks a topic, never your child.",
  "elev.trust.signs.prov.label": "Who noticed",
  "elev.trust.signs.prov.desc":
    "Every moment carries its source: you, Arbor, or your child's own practice.",
  "elev.trust.signs.count.label": "Moments together",
  "elev.trust.signs.count.desc":
    "A cumulative count of captured moments. It never resets and is never compared week to week.",
  // Honest uncertainty (3.3): ranges + "typical for this age", never point claims.
  "elev.trust.signs.ranges":
    "Development is described in ranges — what is typical for this age — never a single number for your child. Every child has their own pace.",
  // ALLOWLISTED NEGATION (.never suffix): the one place banned vocabulary may
  // appear, stating plainly what Arbor refuses to render.
  "elev.trust.signs.never":
    "Arbor never shows scores, percentages (%), “high risk” labels, or an “on track” grade — and no red warnings, ever.",

  // ── Section 4 — What Arbor does NOT do (Maytal frame 4, verbatim spirit)
  "elev.trust.not.title": "What Arbor does not do",
  "elev.trust.not.diagnosis": "Not a diagnosis — Arbor never diagnoses or labels your child.",
  "elev.trust.not.substitute":
    "Not a substitute for a professional — Arbor prepares you for that conversation.",
  "elev.trust.not.medical": "No medical decisions — nothing in Arbor is medical advice.",
  "elev.trust.not.sell": "Never sells your data — your family's information is not a product.",

  // ── Section 5 — Where the information comes from
  "elev.trust.sources.title": "Where the information comes from",

  // ── Section 6 — Questions & contact (FAQ + contact rows)
  "elev.trust.more.title": "Questions and contact",
  "elev.trust.more.faq1.q": "Will Arbor tell me if something needs attention?",
  "elev.trust.more.faq1.a":
    "Arbor points out, in plain words, what may be worth a conversation with a professional — and never labels your child.",
  "elev.trust.more.faq2.q": "Who can see what I share?",
  "elev.trust.more.faq2.a":
    "Only your family account. Anything that leaves Arbor goes through you, with an explicit approval step.",
  "elev.trust.more.faq3.q": "Can we take our data with us — or erase it?",
  "elev.trust.more.faq3.a": "Yes. Export and erase are built in, from your child's profile.",
  "elev.trust.more.contact": "Talk to us",
  "elev.trust.more.contactSub":
    "The Consult hub is where you prepare questions and reach a professional.",
  "elev.trust.more.contactCta": "Open Consult",

  // ── TrustLink chip (mounted by other surfaces next to why-lines)
  "elev.trust.link": "How Arbor decides",
  "elev.trust.link.aria": "How Arbor decides — open the trust center",
};

export const he: Record<string, string> = {
  "elev.trust.title": "איך Arbor עובד",
  "elev.trust.subtitle":
    "מקום אחד שמסביר מה Arbor קורא, מה כל סימן אומר — ומה Arbor לעולם לא יעשה.",
  "elev.trust.spine": "כל שורת “למה קיבלתי את זה?” באפליקציה מובילה חזרה לעמוד הזה.",

  "elev.trust.nav.how": "איך Arbor עובד",
  "elev.trust.nav.data": "המידע שלכם",
  "elev.trust.nav.signs": "מה הסימנים אומרים",
  "elev.trust.nav.not": "מה Arbor לא עושה",
  "elev.trust.nav.sources": "מקורות",
  "elev.trust.nav.more": "שאלות ויצירת קשר",

  "elev.trust.how.title": "איך Arbor עובד",
  "elev.trust.how.body":
    "אתם משתפים רגעים קטנים מהיומיום; Arbor מחבר אותם למה שטיפוסי לגיל של הילד או הילדה, ומציע צעד קטן אחד בכל פעם. ככל שתשתפו יותר — ההצעות נעשות אישיות יותר, ואתם תמיד אלה שמחליטים מה הלאה.",
  "elev.trust.how.uses.title": "על מה ההצעות מבוססות",
  "elev.trust.how.uses.age": "הגיל של הילד או הילדה",
  "elev.trust.how.uses.shared": "מה ששיתפתם",
  "elev.trust.how.uses.activities": "פעילויות שהושלמו",
  "elev.trust.how.uses.screening": "תשובות מבדיקת ההתפתחות",
  "elev.trust.how.uses.base": "בסיס מדעי ממקורות ציבוריים",
  // VERBATIM from Maytal's mockup frame 2 — ships as-is.
  "elev.trust.how.lock": "המידע שלכם מאובטח — לא משתפים מידע אישי",

  "elev.trust.data.title": "איזה מידע Arbor אוסף ואיך הוא משמש",
  "elev.trust.data.profile.label": "פרופיל הילד",
  "elev.trust.data.profile.desc": "שם, תאריך לידה ותחומי העניין שהוספתם.",
  "elev.trust.data.moments.label": "רגעים ורשומות ביומן",
  "elev.trust.data.moments.desc": "מה שאתם כותבים נשאר במרחב המשפחתי שלכם.",
  "elev.trust.data.play.label": "היסטוריית פעילויות",
  "elev.trust.data.play.desc": "אילו פעילויות הושלמו, כדי שההצעה הבאה תמשיך מאותה נקודה.",
  "elev.trust.data.screening.label": "תשובות מבדיקת ההתפתחות",
  "elev.trust.data.screening.desc": "משמשות רק כדי להאיר מה ששווה שיחה.",
  "elev.trust.data.coach.label": "שיחות עם Arbor",
  "elev.trust.data.coach.desc": "נשמרות כדי שתוכלו לחזור אליהן; Arbor משתמש רק במה שאישרתם.",
  "elev.trust.data.manage": "אפשר לייצא או למחוק את הכול, בכל רגע.",
  "elev.trust.data.manageCta": "ניהול המידע בפרופיל",

  "elev.trust.signs.title": "מה המשמעות של כל סימן",
  "elev.trust.signs.intro": "‏Arbor משתמש בקומץ סימנים — כולם ספירות ותצפיות פשוטות.",
  "elev.trust.signs.check.label": "סימון אבן דרך",
  "elev.trust.signs.check.desc":
    "ספירה מצטברת של אבני הדרך שסימנתם. היא רק גדלה ככל שאתם שמים לב ליותר.",
  "elev.trust.signs.flag.label": "“שווה שיחה”",
  "elev.trust.signs.flag.desc":
    "נקודת פתיחה לשיחה עם איש מקצוע — לא תוצאה. הסימן מסמן נושא, אף פעם לא את הילד.",
  "elev.trust.signs.prov.label": "מי שם לב",
  "elev.trust.signs.prov.desc": "לכל רגע יש מקור: אתם, Arbor, או התרגול של הילד עצמו.",
  "elev.trust.signs.count.label": "רגעים ביחד",
  "elev.trust.signs.count.desc":
    "ספירה מצטברת של רגעים שנשמרו. היא לא מתאפסת ולעולם לא מושווית בין שבועות.",
  "elev.trust.signs.ranges":
    "התפתחות מתוארת בטווחים — מה שטיפוסי לגיל הזה — אף פעם לא מספר אחד לילד שלכם. לכל ילד ולכל ילדה קצב משלהם.",
  // ALLOWLISTED NEGATION (.never suffix) — mirrors the EN disclaimer.
  "elev.trust.signs.never":
    "‏Arbor לעולם לא מציג ציונים, אחוזים, תוויות “סיכון גבוה” או דירוג — ובלי אזהרות אדומות, אף פעם.",

  "elev.trust.not.title": "מה Arbor לא עושה",
  "elev.trust.not.diagnosis": "לא אבחנה — Arbor אף פעם לא מאבחן ולא מתייג את הילד.",
  "elev.trust.not.substitute": "לא תחליף לאיש מקצוע — Arbor מכין אתכם לשיחה איתו.",
  "elev.trust.not.medical": "בלי החלטות רפואיות — שום דבר ב‑Arbor הוא לא ייעוץ רפואי.",
  "elev.trust.not.sell": "לא מוכר את המידע שלכם — המידע של המשפחה שלכם הוא לא מוצר.",

  "elev.trust.sources.title": "מאיפה המידע",

  "elev.trust.more.title": "שאלות ויצירת קשר",
  "elev.trust.more.faq1.q": "‏Arbor יגיד לי אם משהו דורש תשומת לב?",
  "elev.trust.more.faq1.a":
    "‏Arbor מאיר, במילים פשוטות, מה ששווה שיחה עם איש מקצוע — ואף פעם לא מתייג את הילד.",
  "elev.trust.more.faq2.q": "מי יכול לראות מה ששיתפתי?",
  "elev.trust.more.faq2.a":
    "רק החשבון המשפחתי שלכם. כל מה שיוצא מ‑Arbor עובר דרככם, עם שלב אישור מפורש.",
  "elev.trust.more.faq3.q": "אפשר לקחת את המידע איתנו — או למחוק אותו?",
  "elev.trust.more.faq3.a": "כן. ייצוא ומחיקה מובנים, מתוך פרופיל הילד.",
  "elev.trust.more.contact": "דברו איתנו",
  "elev.trust.more.contactSub": "מרכז הייעוץ הוא המקום להכין שאלות ולפנות לאיש מקצוע.",
  "elev.trust.more.contactCta": "לפתיחת מרכז הייעוץ",

  "elev.trust.link": "איך Arbor מחליט",
  "elev.trust.link.aria": "איך Arbor מחליט — לפתיחת מרכז האמון",
};

/**
 * Direct accessor used until this module is registered in i18nElevation/
 * index.ts (that file is owned by another workstream this wave). Same
 * "{var}" interpolation contract as lib/i18n translate(); missing key →
 * the key itself (the app-wide convention), missing var → left as-is.
 * Same recipe as Screening.tsx × screeningcalm / DevelopmentCopilot × fullpicture.
 */
export function trustText(
  uiLang: string,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const raw = (uiLang === "he" ? he[key] : undefined) ?? en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}
