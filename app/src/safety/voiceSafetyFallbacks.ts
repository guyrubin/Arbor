/**
 * VC-6: the two /voice safety fallbacks are SPOKEN ALOUD mid-crisis, so they
 * must match the session language — a Hebrew-speaking parent in a Hebrew voice
 * session must never hear an English sentence at the worst possible moment.
 * Server-side he/en map keyed on the request `language` (mirrors the /voice
 * languageDirective pattern). The strings deliberately restate NO helpline
 * numbers — the numbers travel in `resourcesMarkdown`
 * (renderEscalationMarkdown verbatim), which the CRITICAL_HELPLINE_LITERALS
 * tripwire already covers. HE crisis copy is queued for clinical sign-off
 * (GG-4); the fail-closed behavior ships now.
 *
 * Moved verbatim out of routes/api.ts (GD-1 reviewer-preview) so the clinical
 * review queue can list the HE strings read-only. One source of truth — the
 * /voice route imports from here; no string changed in the move.
 */
export const VOICE_SAFETY_FALLBACKS = {
  en: {
    escalation:
      "I want to make sure you get the right help. This may need a real person right now — please reach out to a professional or local support line. ",
    blocked:
      "I want to be careful here. That's something best looked at with a professional who can see your child in person — like your pediatrician or family health centre. I can help you write down what you're noticing so that conversation is easier.",
  },
  he: {
    escalation:
      "חשוב לי שתקבלו עכשיו את העזרה הנכונה. ייתכן שזה מצריך אדם אמיתי ממש עכשיו — אנא פנו לאיש מקצוע או לקו תמיכה מקומי. ",
    blocked:
      "אני רוצה להיזהר כאן. את זה הכי טוב לבדוק עם איש מקצוע שיכול לראות את ילדכם מקרוב — למשל רופא הילדים או טיפת חלב. אני יכול לעזור לכם לרשום את מה שאתם שמים לב אליו, כדי שהשיחה הזו תהיה קלה יותר.",
  },
} as const;

export const voiceSafetyFallback = (language: unknown) =>
  VOICE_SAFETY_FALLBACKS[language === "he" ? "he" : "en"];
