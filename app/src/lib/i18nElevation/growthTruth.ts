/* i18nElevation/growthTruth — Wave-T lane G strings: age integrity, the
 * age-window record, the Language Lab role rows, the day-0 hub-hero teach
 * line and the Profile hub's contract CTA (GP-01/02/03/08/09/15/26, RUN-08).
 *
 * CLINICAL FIREWALL: every string is a fact or a count — the child's AGE as
 * a plain label, "x of y in this age window", a language's ROLE in the home
 * (never a proficiency grade), and an empty-state teach line. No verdicts,
 * percentages, bands, or colour-coded status. `{age}` is always the label
 * from lib/childAge.ageLabel() ("7 months", "1 year 6 months"), never the
 * legacy whole-years number. Hebrew = calm Israeli-parent transcreation;
 * flagged for arbor-localization native review. */

export const en: Record<string, string> = {
  // ── GP-01 · age chips render the months-precise label, never "age 0"
  "elev.growthTruth.agechip.card": "For {age} old",
  "elev.growthTruth.agechip.switcher": "Showing content for children {age} old",

  // ── GP-03 · profile drawer age editor (years + months, one write)
  "elev.growthTruth.drawer.age": "Age",
  "elev.growthTruth.drawer.years": "Years",
  "elev.growthTruth.drawer.months": "Months",
  "elev.growthTruth.drawer.ageHint": "Arbor keeps the age in months so milestones, checks and picks stay in step.",

  // ── GP-08 / GP-09 · the age-window record
  "elev.growthTruth.window.noticed": "{checked} of {total} noticed in the {band} window",
  "elev.growthTruth.window.hint": "Counting this age window and the one before it. Later milestones are still there — open them below.",
  "elev.growthTruth.ms.showLater": "Show later milestones",
  "elev.growthTruth.ms.hideLater": "Hide later milestones",
  "elev.growthTruth.ms.laterBand": "Later",

  // ── GP-02 · Language Lab: roles in the home, counts of logged moments
  "elev.growthTruth.lang.role.home": "Home language",
  "elev.growthTruth.lang.role.second": "Second language",
  "elev.growthTruth.lang.role.also": "Also hears",
  "elev.growthTruth.lang.role.note.home": "The language {first} hears most. Keep it rich — it anchors everything else.",
  "elev.growthTruth.lang.role.note.second": "Children usually understand a second language before they speak it. Daily, low-pressure exposure is what builds it.",
  "elev.growthTruth.lang.role.note.also": "Hearing it in everyday moments is enough for now — playful and optional.",
  "elev.growthTruth.lang.count.one": "1 moment logged",
  "elev.growthTruth.lang.count.many": "{n} moments logged",
  "elev.growthTruth.lang.count.none": "Nothing logged yet",

  // ── RUN-08 · day-0 hub hero: a teach line instead of a wall of zeros
  "elev.growthTruth.hero.empty": "Nothing noticed yet — one moment starts the picture.",

  // ── GP-15 / RUN-20 · Profile hub CTA = the contract's primary move
  "elev.growthTruth.profile.cta.review": "Review what Arbor remembers",
  "elev.growthTruth.profile.cta.addFact": "Add a fact about {name}",

  // ── GP-26 / IA-09 · the strengths leaf gets one live door
  "elev.growthTruth.profile.openStrengths": "Open strengths & challenges",
};

export const he: Record<string, string> = {
  "elev.growthTruth.agechip.card": "לגיל {age}",
  "elev.growthTruth.agechip.switcher": "מציג תוכן לגיל {age}",

  "elev.growthTruth.drawer.age": "גיל",
  "elev.growthTruth.drawer.years": "שנים",
  "elev.growthTruth.drawer.months": "חודשים",
  "elev.growthTruth.drawer.ageHint": "ארבור שומרת את הגיל בחודשים כדי שאבני הדרך, הבדיקות והבחירות יישארו מתואמות.",

  "elev.growthTruth.window.noticed": "{checked} מתוך {total} נצפו בחלון הגיל {band}",
  "elev.growthTruth.window.hint": "נספרים חלון הגיל הנוכחי והקודם לו. אבני דרך מאוחרות יותר עדיין כאן — פתחו אותן למטה.",
  "elev.growthTruth.ms.showLater": "הצג אבני דרך מאוחרות יותר",
  "elev.growthTruth.ms.hideLater": "הסתר אבני דרך מאוחרות יותר",
  "elev.growthTruth.ms.laterBand": "בהמשך",

  "elev.growthTruth.lang.role.home": "שפת הבית",
  "elev.growthTruth.lang.role.second": "שפה שנייה",
  "elev.growthTruth.lang.role.also": "שומע/ת גם",
  "elev.growthTruth.lang.role.note.home": "השפה ש{first} שומע/ת הכי הרבה. שמרו עליה עשירה — היא העוגן של כל השאר.",
  "elev.growthTruth.lang.role.note.second": "ילדים בדרך כלל מבינים שפה שנייה לפני שהם מדברים אותה. חשיפה יומית וללא לחץ היא מה שבונה אותה.",
  "elev.growthTruth.lang.role.note.also": "לשמוע אותה ברגעי היום-יום מספיק בינתיים — בכיף ובלי חובה.",
  "elev.growthTruth.lang.count.one": "רגע אחד תועד",
  "elev.growthTruth.lang.count.many": "{n} רגעים תועדו",
  "elev.growthTruth.lang.count.none": "עדיין לא תועד דבר",

  "elev.growthTruth.hero.empty": "עדיין לא שמתם לב לכלום — רגע אחד מתחיל את התמונה.",

  "elev.growthTruth.profile.cta.review": "לסקור מה ארבור זוכרת",
  "elev.growthTruth.profile.cta.addFact": "להוסיף עובדה על {name}",

  "elev.growthTruth.profile.openStrengths": "לפתוח חוזקות ואתגרים",
};
