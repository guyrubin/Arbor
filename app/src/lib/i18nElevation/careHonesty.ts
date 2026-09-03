/* Lane C (wave T) — Care / Safety export-honesty strings.
 * Registered through src/lib/i18nElevation/index.ts (base keys win), so every
 * key here is namespaced "elev.carehonesty.*". Hebrew = calm Israeli-parent
 * transcreation: outcome language, never AI/tech framing. */

export const en: Record<string, string> = {
  // ── Consult › audience selector (LC-08) — a required first step of the export bar
  "elev.carehonesty.consult.audience.label": "Who is this summary for?",
  "elev.carehonesty.consult.audience.clinician": "A clinician",
  "elev.carehonesty.consult.audience.teacher": "A teacher",
  "elev.carehonesty.consult.audience.self": "My own records",
  "elev.carehonesty.consult.audience.hint.clinician": "Full summary: patterns, development, and the notes you approved.",
  "elev.carehonesty.consult.audience.hint.teacher": "Classroom context only — no logged moments, milestones, or notes.",
  "elev.carehonesty.consult.audience.hint.self": "Everything you selected, for your own files.",
  // ── Consult › exact-text preview (LC-07)
  "elev.carehonesty.consult.preview.toggle": "Preview exactly what leaves",
  "elev.carehonesty.consult.preview.hint": "This is the text your recipient receives — word for word.",
  // ── Consult › fail-closed export blocks (LC-08)
  "elev.carehonesty.consult.blocked.teacher": "This can't go to a teacher as written: “{term}” is clinical language. Edit the note or choose a clinician.",
  "elev.carehonesty.consult.blocked.generic": "This summary can't leave as written. Adjust your selection and try again.",
  // ── Safety › market-first helplines (LC-14)
  "elev.carehonesty.safety.callNow": "Call now",
  "elev.carehonesty.safety.callPrimary": "Call {number}",
  "elev.carehonesty.safety.otherCountries": "Other countries",
};

export const he: Record<string, string> = {
  "elev.carehonesty.consult.audience.label": "למי מיועד הסיכום?",
  "elev.carehonesty.consult.audience.clinician": "איש מקצוע טיפולי",
  "elev.carehonesty.consult.audience.teacher": "גננת או מורה",
  "elev.carehonesty.consult.audience.self": "לרשומות שלי",
  "elev.carehonesty.consult.audience.hint.clinician": "סיכום מלא: דפוסים, התפתחות וההערות שאישרתם.",
  "elev.carehonesty.consult.audience.hint.teacher": "הקשר לכיתה בלבד — בלי רגעים שתועדו, אבני דרך או הערות.",
  "elev.carehonesty.consult.audience.hint.self": "כל מה שבחרתם, לתיקים שלכם.",
  "elev.carehonesty.consult.preview.toggle": "תצוגה מקדימה של מה שיוצא בדיוק",
  "elev.carehonesty.consult.preview.hint": "זה הטקסט שהנמען מקבל — מילה במילה.",
  "elev.carehonesty.consult.blocked.teacher": "זה לא יכול לצאת לגננת או למורה כפי שנכתב: “{term}” היא שפה קלינית. ערכו את ההערה או בחרו איש מקצוע טיפולי.",
  "elev.carehonesty.consult.blocked.generic": "הסיכום לא יכול לצאת כפי שהוא. שנו את הבחירה ונסו שוב.",
  "elev.carehonesty.safety.callNow": "להתקשר עכשיו",
  "elev.carehonesty.safety.callPrimary": "התקשרו ל־{number}",
  "elev.carehonesty.safety.otherCountries": "מדינות אחרות",
};
