import type { UiLang } from "./i18n";

/** User-facing recovery, shared by every parent dictation entry point. */
export function microphoneRecovery(error: string, lang: UiLang): string {
  const he = lang === "he";
  if (["not-allowed", "service-not-allowed", "permission", "NotAllowedError", "SecurityError"].includes(error)) {
    return he ? "המיקרופון חסום. פתחו את הרשאות האתר ליד הכתובת בדפדפן, אפשרו גישה למיקרופון ונסו שוב. אפשר גם לכתוב כאן."
      : "Microphone access is blocked. Open site permissions beside the browser address, allow the microphone, then try again. You can also type here.";
  }
  if (["audio-capture", "NotFoundError", "NotReadableError"].includes(error)) {
    return he ? "לא הצלחנו לפתוח את המיקרופון. בדקו שהוא מחובר, סגרו אפליקציה אחרת שמשתמשת בו ונסו שוב."
      : "We couldn’t open the microphone. Check that it is connected, close another app using it, then try again.";
  }
  if (error === "connection") return he ? "חיבור השיחה הקולית הסתיים. השיחה נשמרה כאן — אפשר לנסות שוב או להמשיך בכתיבה."
    : "The voice connection ended. Your conversation is still here — try again or continue typing.";
  if (error === "unsupported") return he ? "הדפדפן הזה לא תומך בהכתבה. אפשר לכתוב כאן או לפתוח את ארבור בכרום."
    : "This browser does not support dictation. You can type here or open Arbor in Chrome.";
  if (error === "network") return he ? "שירות ההכתבה בדפדפן לא התחבר. בדקו את החיבור ונסו שוב, או כתבו כאן."
    : "The browser’s dictation service couldn’t connect. Check your connection and try again, or type here.";
  return he ? "ההקלטה נעצרה לפני שקלטנו מילים. בדקו שהמיקרופון הנכון נבחר ונסו שוב כשאתם מוכנים. אפשר גם לכתוב כאן."
    : "Recording stopped before we heard any words. Check the selected microphone and try again when you’re ready. You can also type here.";
}
