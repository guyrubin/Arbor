/* i18nElevation/careNetwork — LC-16 (Care Network › Find a Professional).
 *
 * WHY THIS MODULE EXISTS
 * FindProfessional.tsx shipped with exactly five t() calls and everything else
 * hard-coded English: the empty state, the filter chips, the specialty chips,
 * the consult-request form, the toasts. Arbor ships EN and HE with full RTL,
 * so a Hebrew-reading parent met an English wall on the one screen a worried
 * parent actually reaches. This module is that screen's string seam.
 *
 * WHAT THIS MODULE DOES NOT DO
 * It does not create professionals. LC-16's directory is EMPTY in production
 * and stays empty until a human has vetted real practitioners (the recorded
 * gate is "Guy (sourcing)"). Nothing here names, describes, or implies a
 * practitioner. The empty state is the honest surface, in two languages.
 *
 * THE PROMISE (do not soften in either language)
 * The empty state must keep saying all three things:
 *   1. the verified directory is opening soon;
 *   2. Arbor shows NOBODY until identity and credentials have been reviewed;
 *   3. the parent has a real alternative right now — prepare a private
 *      summary for someone they already trust.
 * Never imply a professional already exists here.
 *
 * FILTER LABELS ARE LABELS, NOT IDS
 * The screen's matcher switches on a stable FilterId ("verified", "ages_3_6"),
 * never on the displayed label. These strings are display-only: retranslating
 * one can change what a parent reads, never what the filter matches.
 *
 * BIDI
 * Interpolated values ({name}, {ages}, {price}) are FSI/PDI-wrapped by
 * translate() in lib/i18n.ts, so a Hebrew child name inside an English
 * sentence (or the reverse) cannot reorder the line. The one value that is
 * NOT interpolated — the literal age range inside the Hebrew filter label —
 * carries an explicit LRI/PDI pair, written as U+2066 / U+2069 escape
 * sequences so the control characters stay visible in review. Without them
 * "3–6" sits in an RTL run where the en-dash resolves to RTL and the range
 * renders "6–3".
 *
 * Hebrew = warm Israeli-parent register, plain, never clinical; flagged for
 * arbor-localization native review.
 */

export const en: Record<string, string> = {
  // ── Header ─────────────────────────────────────────────────────────────────
  "elev.careNet.eyebrow": "Care Network",
  "elev.careNet.search.placeholder": "Search by specialty, concern, or name",

  // ── Filter chips (display labels for the stable FilterIds) ────────────────
  "elev.careNet.filter.verified": "Verified by Arbor",
  "elev.careNet.filter.online": "Online",
  "elev.careNet.filter.inPerson": "In-person",
  "elev.careNet.filter.hebrew": "Hebrew",
  "elev.careNet.filter.english": "English",
  "elev.careNet.filter.ages36": "Ages 3–6",
  "elev.careNet.filter.insurance": "Insurance accepted",

  // ── Specialty chips (display labels; the search term stays canonical) ─────
  "elev.careNet.spec.psychologist": "Child Psychologist",
  "elev.careNet.spec.speech": "Speech Therapist",
  "elev.careNet.spec.ot": "Occupational Therapist",
  "elev.careNet.spec.parentCoach": "Parenting Coach",
  "elev.careNet.spec.eduConsultant": "Educational Consultant",
  "elev.careNet.spec.pediatrician": "Pediatrician",
  "elev.careNet.spec.neuro": "Autism / ADHD Specialist",
  "elev.careNet.spec.sleep": "Sleep Consultant",
  "elev.careNet.spec.family": "Family Therapist",
  "elev.careNet.spec.schoolReadiness": "School Readiness Specialist",

  // ── The empty state — the honest surface while the directory is empty ─────
  "elev.careNet.empty.title": "The verified directory is opening soon.",
  "elev.careNet.empty.body":
    "Arbor will only show professionals after their identity and credentials have been reviewed. You can still prepare a private summary for someone you already trust.",
  "elev.careNet.empty.cta": "Prepare a shareable summary",
  "elev.careNet.footer.verification":
    "No profile appears here until Arbor has completed its verification process.",

  // ── Professional card ─────────────────────────────────────────────────────
  "elev.careNet.card.verified": "Verified by Arbor",
  "elev.careNet.card.ages": "Ages {ages} · {price}",
  "elev.careNet.card.handles": "Handles:",
  "elev.careNet.card.request": "Request consultation",
  "elev.careNet.card.share": "Share Arbor summary",
  "elev.careNet.share.toast": "Build a shareable summary in Consult.",

  // ── Consult request ───────────────────────────────────────────────────────
  "elev.careNet.consult.title": "Request a consultation",
  "elev.careNet.consult.titleWith": "Request a consultation — {name}",
  "elev.careNet.consult.error": "Couldn't record the request — please try again.",
  "elev.careNet.consult.note.default": "We're working on {topic} with {name} ({age}).",
  "elev.careNet.note.label": "What's going on? (shared with the professional)",
  "elev.careNet.note.placeholder": "A sentence or two about what you'd like help with for {name}.",
  "elev.careNet.mode.label": "Preferred format",
  "elev.careNet.mode.either": "Either",
  "elev.careNet.mode.video": "Video call",
  "elev.careNet.mode.inPerson": "In person",
  "elev.careNet.privacy":
    "Nothing from {name}'s profile is shared automatically — only the note above. You stay in control of any reports you choose to share.",
  "elev.careNet.send": "Send the request",
  "elev.careNet.sending": "Sending…",

  // ── Consult recorded ──────────────────────────────────────────────────────
  "elev.careNet.done.title": "Request recorded",
  "elev.careNet.done.body":
    "Arbor saved your consultation request for {name}. We'll coordinate the introduction — you can prepare context to share meanwhile.",
  "elev.careNet.done.bodyGeneric":
    "Arbor saved your consultation request. We'll coordinate the introduction — you can prepare context to share meanwhile.",
  "elev.careNet.done.mail": "Send the intro email",
  "elev.careNet.done.summary": "Prepare a shareable summary",
};

export const he: Record<string, string> = {
  // ── Header ─────────────────────────────────────────────────────────────────
  // "רשת הטיפול" matches nav.title.care — the label the parent just tapped.
  "elev.careNet.eyebrow": "רשת הטיפול",
  "elev.careNet.search.placeholder": "חיפוש לפי תחום, נושא או שם",

  // ── Filter chips ──────────────────────────────────────────────────────────
  "elev.careNet.filter.verified": "מאומת בידי ארבור",
  "elev.careNet.filter.online": "אונליין",
  "elev.careNet.filter.inPerson": "פנים אל פנים",
  "elev.careNet.filter.hebrew": "עברית",
  "elev.careNet.filter.english": "אנגלית",
  // LRI…PDI around the range: inside an RTL line the en-dash between two
  // numbers otherwise resolves RTL and the range renders "6–3".
  "elev.careNet.filter.ages36": "גילאי \u20663–6\u2069",
  "elev.careNet.filter.insurance": "עובדים מול ביטוח",

  // ── Specialty chips ───────────────────────────────────────────────────────
  "elev.careNet.spec.psychologist": "פסיכולוג ילדים",
  "elev.careNet.spec.speech": "קלינאי תקשורת",
  "elev.careNet.spec.ot": "מרפא בעיסוק",
  "elev.careNet.spec.parentCoach": "מאמן הורים",
  "elev.careNet.spec.eduConsultant": "יועץ חינוכי",
  "elev.careNet.spec.pediatrician": "רופא ילדים",
  "elev.careNet.spec.neuro": "מומחה אוטיזם והפרעות קשב",
  "elev.careNet.spec.sleep": "יועץ שינה",
  "elev.careNet.spec.family": "מטפל משפחתי",
  "elev.careNet.spec.schoolReadiness": "מומחה למוכנות לכיתה א׳",

  // ── The empty state — same three promises, word for word ─────────────────
  "elev.careNet.empty.title": "המאגר המאומת ייפתח בקרוב.",
  "elev.careNet.empty.body":
    "ארבור תציג אנשי מקצוע רק אחרי שהזהות וההסמכות שלהם נבדקו. בינתיים אפשר להכין סיכום פרטי עבור מישהו שאתם כבר סומכים עליו.",
  "elev.careNet.empty.cta": "להכין סיכום לשיתוף",
  "elev.careNet.footer.verification":
    "שום פרופיל לא מופיע כאן עד שארבור משלימה את תהליך האימות.",

  // ── Professional card ─────────────────────────────────────────────────────
  "elev.careNet.card.verified": "מאומת בידי ארבור",
  "elev.careNet.card.ages": "גילאים {ages} · {price}",
  "elev.careNet.card.handles": "מתמחה ב:",
  "elev.careNet.card.request": "לבקש ייעוץ",
  "elev.careNet.card.share": "לשתף סיכום מארבור",
  "elev.careNet.share.toast": "בונים סיכום לשיתוף במסך הייעוץ.",

  // ── Consult request ───────────────────────────────────────────────────────
  "elev.careNet.consult.title": "בקשת ייעוץ",
  "elev.careNet.consult.titleWith": "בקשת ייעוץ — {name}",
  "elev.careNet.consult.error": "לא הצלחנו לשמור את הבקשה — נסו שוב.",
  "elev.careNet.consult.note.default": "אנחנו עובדים על {topic} עם {name} ({age}).",
  "elev.careNet.note.label": "מה קורה? (משותף עם איש המקצוע)",
  "elev.careNet.note.placeholder": "משפט או שניים על מה שהייתם רוצים עזרה בו עבור {name}.",
  "elev.careNet.mode.label": "איך נוח לכם להיפגש",
  "elev.careNet.mode.either": "לא משנה",
  "elev.careNet.mode.video": "שיחת וידאו",
  "elev.careNet.mode.inPerson": "פנים אל פנים",
  "elev.careNet.privacy":
    "שום דבר מהפרופיל של {name} לא משותף אוטומטית — רק ההערה שלמעלה. אתם שולטים בכל דוח שתבחרו לשתף.",
  "elev.careNet.send": "לשלוח את הבקשה",
  "elev.careNet.sending": "שולחים…",

  // ── Consult recorded ──────────────────────────────────────────────────────
  "elev.careNet.done.title": "הבקשה נשמרה",
  "elev.careNet.done.body":
    "ארבור שמרה את בקשת הייעוץ שלכם עבור {name}. אנחנו נתאם את ההיכרות — בינתיים אפשר להכין הקשר לשיתוף.",
  "elev.careNet.done.bodyGeneric":
    "ארבור שמרה את בקשת הייעוץ שלכם. אנחנו נתאם את ההיכרות — בינתיים אפשר להכין הקשר לשיתוף.",
  "elev.careNet.done.mail": "לשלוח את מייל ההיכרות",
  "elev.careNet.done.summary": "להכין סיכום לשיתוף",
};
