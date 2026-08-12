/* i18nElevation/sincevisit — W1 1.1 "Since your last visit" strip strings
 * (masterplan ARBOR-UI-MASTERPLAN-2026-08-11 §3 · Maytal concept Row-1 #1:
 * warm returning greeting + "חדש מאז הביקור האחרון" event rows + "ממשיכים
 * מאיפה שהפסקנו" resume framing).
 *
 * REGISTRATION NOTE: this module is NOT yet wired into i18nElevation/index.ts
 * (that file is owned by the integration lane — add the ONE alphabetical
 * import + registry line there). Until then SinceLastVisit.tsx resolves these
 * keys through its t()-first/local-fallback helper, so behavior is identical
 * before and after registration.
 *
 * CLINICAL FIREWALL: every row is EVENT language — a count or a plain activity
 * fact ("2 moments captured", "milestone crossed"). NEVER comparative or trend
 * wording (no "more/less than last time", no faster/slower, no arrows) — a
 * delta between visits is a trend by inspection. Pinned by
 * components/overview/sinceLastVisit.test.ts.
 * Hebrew = calm Israeli-parent transcreation (mockup voice), gender-neutral
 * passive verb forms; flagged for arbor-localization native review. */

export const en: Record<string, string> = {
  "elev.sincevisit.greeting": "Good to see you again 👋",
  "elev.sincevisit.title": "New since your last visit",
  "elev.sincevisit.aria": "What is new since your last visit",
  "elev.sincevisit.row.milestone": "Milestone crossed: {title}",
  "elev.sincevisit.row.moment.one": "One moment captured",
  "elev.sincevisit.row.moment.many": "{n} moments captured",
  "elev.sincevisit.row.play.one": "One activity completed",
  "elev.sincevisit.row.play.many": "{n} activities completed",
  "elev.sincevisit.row.convo.one": "Your conversation with Arbor continued",
  "elev.sincevisit.row.convo.many": "{n} conversations with Arbor updated",
  "elev.sincevisit.row.noticed": "Arbor noticed something — take a look",
  "elev.sincevisit.more": "+{n} more in Journal",
  "elev.sincevisit.resume": "Continuing where we left off",
};

export const he: Record<string, string> = {
  "elev.sincevisit.greeting": "שמחנו לראות אותך שוב 👋",
  "elev.sincevisit.title": "חדש מאז הביקור האחרון",
  "elev.sincevisit.aria": "מה חדש מאז הביקור האחרון",
  "elev.sincevisit.row.milestone": "אבן דרך חדשה: {title}",
  "elev.sincevisit.row.moment.one": "רגע אחד נשמר",
  "elev.sincevisit.row.moment.many": "{n} רגעים נשמרו",
  "elev.sincevisit.row.play.one": "פעילות אחת הושלמה",
  "elev.sincevisit.row.play.many": "{n} פעילויות הושלמו",
  "elev.sincevisit.row.convo.one": "השיחה שלכם עם ארבור התקדמה",
  "elev.sincevisit.row.convo.many": "{n} שיחות עם ארבור התעדכנו",
  "elev.sincevisit.row.noticed": "ארבור שמה לב למשהו — שווה מבט",
  "elev.sincevisit.more": "עוד {n} ביומן",
  "elev.sincevisit.resume": "ממשיכים מאיפה שהפסקנו",
};
