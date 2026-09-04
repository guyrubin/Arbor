/* i18nElevation/aierrors — Wave L (2026-09-04): AI-06 + AI-24, honest failure.
 *
 *  - AI-06: a 429 (this account has used its hour of AI) and a 451 (Arbor is
 *    fail-closed because the parent has not granted consent for this child's
 *    photo or voice) both collapsed into one generic "something went wrong,
 *    try again". They are opposite problems: one resolves BY WAITING, the
 *    other NEVER resolves by waiting and needs the parent to do one specific
 *    thing. Two failures that need different actions must never share copy.
 *    Worse, ArborVision rendered the raw server `details` string — English
 *    prose, untranslated, straight into a Hebrew parent's screen.
 *  - AI-24: the composer stayed live with no connection and the send failed
 *    into the same generic error. Offline is not a failure of Arbor; it is a
 *    state the surface should say out loud BEFORE the parent types.
 *
 * Register: parent, calm, plural Israeli-parent address. Every message names
 * (a) what happened, in the parent's terms, and (b) the one thing to do next.
 * No blame, no jargon, no raw status codes on screen.
 */

export const en: Record<string, string> = {
  // ── 429 — the hourly AI allowance for this account is spent.
  "elev.aierrors.quota.title": "Arbor needs a short break",
  "elev.aierrors.quota.body": "This account has used its questions for the hour. Nothing is lost — try again a little later.",
  "elev.aierrors.quota.bodyMinutes": "This account has used its questions for the hour. It opens again in about {minutes} minutes — nothing is lost.",

  // ── 451 — fail-closed: no parental consent grant for this purpose.
  "elev.aierrors.consent.title": "Your permission is needed first",
  "elev.aierrors.consent.body": "Arbor will not look at a photo or listen to a recording of {name} until you allow it. You can give — or withdraw — that permission any time.",
  "elev.aierrors.consent.cta": "Open the profile to allow it",

  // ── Offline (AI-24).
  "elev.aierrors.offline.title": "No connection",
  "elev.aierrors.offline.body": "Arbor answers online. What you typed stays here — send it when you are back.",
  "elev.aierrors.offline.composer": "You are offline — Arbor will send this once the connection is back.",

  // ── Everything else: unchanged meaning, but still never the server's words.
  "elev.aierrors.generic.title": "That did not go through",
  "elev.aierrors.generic.body": "Something on our side did not answer. Your question is still here — try it again.",
  "elev.aierrors.retry": "Try again",
};

export const he: Record<string, string> = {
  "elev.aierrors.quota.title": "ארבור צריך הפסקה קצרה",
  "elev.aierrors.quota.body": "החשבון הזה ניצל את השאלות לשעה הזו. שום דבר לא אבד — נסו שוב בעוד זמן קצר.",
  "elev.aierrors.quota.bodyMinutes": "החשבון הזה ניצל את השאלות לשעה הזו. זה נפתח שוב בעוד כ־{minutes} דקות — שום דבר לא אבד.",

  "elev.aierrors.consent.title": "צריך קודם את האישור שלכם",
  "elev.aierrors.consent.body": "ארבור לא יסתכל על תמונה ולא יאזין להקלטה של {name} עד שתאשרו. אפשר לתת — או לבטל — את האישור בכל רגע.",
  "elev.aierrors.consent.cta": "פתחו את הפרופיל כדי לאשר",

  "elev.aierrors.offline.title": "אין חיבור",
  "elev.aierrors.offline.body": "ארבור עונה כשיש חיבור לאינטרנט. מה שכתבתם נשאר כאן — שלחו כשהחיבור חוזר.",
  "elev.aierrors.offline.composer": "אתם לא מחוברים — ארבור ישלח את זה ברגע שהחיבור יחזור.",

  "elev.aierrors.generic.title": "זה לא עבר",
  "elev.aierrors.generic.body": "משהו אצלנו לא ענה. השאלה שלכם עדיין כאן — נסו שוב.",
  "elev.aierrors.retry": "נסו שוב",
};
