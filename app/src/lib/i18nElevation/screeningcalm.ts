/* i18nElevation/screeningcalm — W0.3 Development Check calm-result strings
 * (Screening.tsx result screen, UI masterplan 2026-08-11).
 *
 * CLINICAL FIREWALL: the result screen renders ONE neutral card tone for every
 * outcome — no verdict tags, no green-vs-amber grading, counts and
 * observational language only. These strings carry that reframe: the headline
 * reports a COUNT ("2 areas worth a conversation"), never a judgment, and the
 * per-domain markers are routing words ("worth a conversation" / "reviewed"),
 * never pass/fail. Hebrew = calm Israeli-parent transcreation, outcome
 * language, no AI/tech framing; flagged for arbor-localization native review.
 *
 * NOTE: Screening.tsx resolves this module DIRECTLY (module-local lookup by
 * uiLang) — registration in i18nElevation/index.ts is a separate wiring step
 * owned by that file's registry recipe. Keys stay "elev.*"-namespaced so a
 * later registration merges cleanly with existing-keys-win semantics.
 */

export const en: Record<string, string> = {
  // ── Result headline (count-based, observational — never a verdict)
  "elev.screencalm.title.one": "1 area worth a conversation",
  "elev.screencalm.title.many": "{n} areas worth a conversation",
  "elev.screencalm.title.none": "Nothing stood out this time — {total} areas reviewed",
  "elev.screencalm.body.some":
    "These are conversation starters for a professional — not results, and not a score.",
  "elev.screencalm.body.none":
    "Every area was reviewed with your answers. Nothing here asks for action right now.",
  // ── Per-domain row markers (same neutral tone for every domain)
  "elev.screencalm.row.discuss": "worth a conversation",
  "elev.screencalm.row.reviewed": "reviewed",

  // ── B-CAREPRO-45 — every result screen: the answers are kept, never graded.
  "elev.screencalm.saved.title": "Your answers are saved for your next check-up",
  "elev.screencalm.saved.listLabel": "What you answered",
  "elev.screencalm.saved.worth": "Some answers are “not yet” — worth a conversation at the next visit.",
  "elev.screencalm.saved.last": "answers saved",
  // The passive watch card when nothing is listed: what it does, never a reassurance.
  "elev.screencalm.monitor.none": "Arbor reads your notes and the milestones you mark. Anything worth raising at a visit is listed here.",
};

export const he: Record<string, string> = {
  "elev.screencalm.title.one": "תחום אחד ששווה שיחה",
  "elev.screencalm.title.many": "{n} תחומים ששווים שיחה",
  "elev.screencalm.title.none": "שום דבר לא בלט הפעם — עברנו על {total} תחומים",
  "elev.screencalm.body.some": "אלה נקודות פתיחה לשיחה עם איש מקצוע — לא תוצאה ולא ציון.",
  "elev.screencalm.body.none": "עברנו על כל התחומים לפי התשובות שלכם. אין כאן שום דבר שמבקש פעולה כרגע.",
  "elev.screencalm.row.discuss": "שווה שיחה",
  "elev.screencalm.row.reviewed": "נבדק",

  "elev.screencalm.saved.title": "התשובות שלכם שמורות לבדיקה הבאה",
  "elev.screencalm.saved.listLabel": "מה עניתם",
  "elev.screencalm.saved.worth": "חלק מהתשובות הן „עדיין לא” — שווה לדבר עליהן בביקור הבא.",
  "elev.screencalm.saved.last": "התשובות נשמרו",
  "elev.screencalm.monitor.none": "ארבור קורא את הרישומים שלכם ואת אבני הדרך שסימנתם. כל מה ששווה להעלות בביקור יופיע כאן.",
};
