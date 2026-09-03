/* i18nElevation/storeShell — Wave T lane S: store readiness, billing and
 * shell chrome strings (MOB-01/02/03/07/08/09/13, IA-01).
 *
 * Every key is namespaced "elev.storeshell.*" (base dictionaries win on merge).
 * Honesty rule (MOB-13 guard, storeShell.test.ts): no key here promises an
 * email/notification — the only persisted request in the product is
 * api.requestAccess, whose copy lives in the base dictionary.
 */

export const en: Record<string, string> = {
  // MOB-01 — legal + support links (one row, three surfaces)
  "elev.storeshell.legal.aria": "Legal and support",
  "elev.storeshell.legal.privacy": "Privacy",
  "elev.storeshell.legal.terms": "Terms",
  "elev.storeshell.legal.support": "Support",

  // MOB-02 — compliant subscription disclosure
  "elev.storeshell.pw.choose": "Choose a plan",
  "elev.storeshell.pw.period.month": "month",
  "elev.storeshell.pw.period.year": "year",
  "elev.storeshell.pw.perMonthApprox": "≈ {price}/month",
  "elev.storeshell.pw.cta": "Start {plan} — {price}",
  "elev.storeshell.pw.pricesLoading": "Prices are loading from {store}…",
  "elev.storeshell.pw.disclosure": "Your subscription renews automatically every {period} until you cancel. Cancel anytime in {store}.",
  "elev.storeshell.store.ios": "the App Store",
  "elev.storeshell.store.android": "Google Play",
  "elev.storeshell.store.web": "Settings → Manage plan",

  // MOB-08 — money moments are legible
  "elev.storeshell.pw.purchaseFailed": "The purchase didn't go through and nothing was charged. Please try again.",
  "elev.storeshell.pw.checkoutUnavailable": "Checkout isn't available right now. Please try again in a moment.",
  "elev.storeshell.pw.restoreFailed": "We couldn't restore your purchases. Please try again.",
  "elev.storeshell.plan.verifying": "Checking your plan…",
  "elev.storeshell.plan.unverified": "Couldn't verify your plan — showing the last known state.",
  "elev.storeshell.plan.retry": "Retry",

  // MOB-13 — the at-limit gate sells instead of promising
  "elev.storeshell.ac.seePlus": "See Arbor Plus",

  // MOB-09 — avatar asked once
  "elev.storeshell.wow.sproutStars": "Sprout will star for now — you can create {name}'s hero anytime from the profile.",

  // MOB-03 — auth errors as keys (consumed via authErrorKey below)
  "elev.storeshell.auth.err.invalidCredential": "We couldn't sign you in. Please check your email and password, or request access.",
  "elev.storeshell.auth.err.userNotFound": "No Arbor account found for this email. Request access if you haven't been invited yet.",
  "elev.storeshell.auth.err.userDisabled": "This account has been disabled. Please contact support.",
  "elev.storeshell.auth.err.tooManyRequests": "Too many attempts. Please wait a moment and try again, or reset your password.",
  "elev.storeshell.auth.err.network": "We couldn't reach Arbor. Check your connection and try again.",
  "elev.storeshell.auth.err.popupBlocked": "Your browser blocked the sign-in window. Taking you to Google sign-in instead…",
  "elev.storeshell.auth.err.generic": "Something went wrong signing you in. Please try again or request access.",
};

export const he: Record<string, string> = {
  "elev.storeshell.legal.aria": "מידע משפטי ותמיכה",
  "elev.storeshell.legal.privacy": "פרטיות",
  "elev.storeshell.legal.terms": "תנאי שימוש",
  "elev.storeshell.legal.support": "תמיכה",

  "elev.storeshell.pw.choose": "בחרו תוכנית",
  "elev.storeshell.pw.period.month": "חודש",
  "elev.storeshell.pw.period.year": "שנה",
  "elev.storeshell.pw.perMonthApprox": "≈ {price} לחודש",
  "elev.storeshell.pw.cta": "התחילו {plan} — {price}",
  "elev.storeshell.pw.pricesLoading": "המחירים נטענים מ{store}…",
  "elev.storeshell.pw.disclosure": "המנוי מתחדש אוטומטית כל {period} עד שתבטלו. אפשר לבטל בכל עת ב{store}.",
  "elev.storeshell.store.ios": "App Store",
  "elev.storeshell.store.android": "Google Play",
  "elev.storeshell.store.web": "הגדרות ← ניהול תוכנית",

  "elev.storeshell.pw.purchaseFailed": "הרכישה לא הושלמה ולא בוצע חיוב. נסו שוב.",
  "elev.storeshell.pw.checkoutUnavailable": "התשלום אינו זמין כרגע. נסו שוב בעוד רגע.",
  "elev.storeshell.pw.restoreFailed": "לא הצלחנו לשחזר את הרכישות. נסו שוב.",
  "elev.storeshell.plan.verifying": "בודקים את התוכנית שלכם…",
  "elev.storeshell.plan.unverified": "לא הצלחנו לאמת את התוכנית — מוצג המצב האחרון הידוע.",
  "elev.storeshell.plan.retry": "נסו שוב",

  "elev.storeshell.ac.seePlus": "לצפייה בארבור פלוס",

  "elev.storeshell.wow.sproutStars": "ספראוט יככב בינתיים — אפשר ליצור את הגיבור של {name} בכל עת מהפרופיל.",

  "elev.storeshell.auth.err.invalidCredential": "לא הצלחנו לחבר אתכם. בדקו את הדוא״ל והסיסמה, או בקשו גישה.",
  "elev.storeshell.auth.err.userNotFound": "לא נמצא חשבון ארבור לדוא״ל הזה. בקשו גישה אם עדיין לא הוזמנתם.",
  "elev.storeshell.auth.err.userDisabled": "החשבון הזה הושבת. פנו לתמיכה.",
  "elev.storeshell.auth.err.tooManyRequests": "יותר מדי ניסיונות. המתינו רגע ונסו שוב, או אפסו את הסיסמה.",
  "elev.storeshell.auth.err.network": "לא הצלחנו להגיע לארבור. בדקו את החיבור ונסו שוב.",
  "elev.storeshell.auth.err.popupBlocked": "הדפדפן חסם את חלון ההתחברות. מעבירים אתכם להתחברות עם Google…",
  "elev.storeshell.auth.err.generic": "משהו השתבש בהתחברות. נסו שוב או בקשו גישה.",
};

/** MOB-03 — Firebase auth error code → i18n KEY (never a literal). The login
 *  screen renders `t(error)`, so AuthContext can hand it the key directly. */
export function authErrorKey(code: string | undefined | null): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/invalid-email":
      return "elev.storeshell.auth.err.invalidCredential";
    case "auth/user-not-found":
      return "elev.storeshell.auth.err.userNotFound";
    case "auth/user-disabled":
      return "elev.storeshell.auth.err.userDisabled";
    case "auth/too-many-requests":
      return "elev.storeshell.auth.err.tooManyRequests";
    case "auth/network-request-failed":
      return "elev.storeshell.auth.err.network";
    case "auth/popup-blocked":
      return "elev.storeshell.auth.err.popupBlocked";
    default:
      return "elev.storeshell.auth.err.generic";
  }
}

/** Every auth code the mapper knows — pinned by storeShell.test.ts so a new
 *  code cannot be added without both languages. */
export const AUTH_ERROR_CODES = [
  "auth/invalid-credential",
  "auth/wrong-password",
  "auth/invalid-email",
  "auth/user-not-found",
  "auth/user-disabled",
  "auth/too-many-requests",
  "auth/network-request-failed",
  "auth/popup-blocked",
] as const;
