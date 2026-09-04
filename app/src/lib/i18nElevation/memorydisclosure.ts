/* i18nElevation/memorydisclosure — Wave L (2026-09-04): GP-14.
 *
 * "What the coach sees" reported a NUMBER — "Memory facts you approved (3 used
 * in the last answer)" — and never said WHICH. A count is not a disclosure: a
 * parent cannot check, correct or withdraw a fact they cannot see, so the
 * panel asked for trust while withholding the one thing trust needs. The
 * allow-list that decides what actually leaves the device
 * (ai/prompts MODEL_PROFILE_FIELDS + promptProfile) has always carried the
 * comment that it is meant to drive this list. Now it does.
 *
 * CLINICAL FIREWALL. Naming a fact the parent themselves approved is honest
 * disclosure. Grading the child is not. So this module names ONLY:
 *   - the parent's own approved fact text, verbatim, never re-worded, and
 *   - the NAMES of the profile fields sent (never their values, never a
 *     judgement about them).
 * No score, no band, no "areas of concern", no colour that means good or bad.
 *
 * Register: parent, calm, plural Israeli-parent address.
 */

export const en: Record<string, string> = {
  // ── The approved-memory facts, named.
  "elev.memdisc.facts.lead": "Memory you approved, sent with this question:",
  "elev.memdisc.facts.none": "Memory facts — none yet, so none are sent. Arbor asks before it remembers anything.",
  "elev.memdisc.facts.used": "{count} of them shaped the last answer.",
  "elev.memdisc.facts.usedOne": "1 of them shaped the last answer.",
  "elev.memdisc.facts.more": "and {n} more, all listed in Profile › Child Memory",
  "elev.memdisc.facts.quote": "“{fact}”",

  // ── The profile fields, named (values stay off this list on purpose).
  "elev.memdisc.profile.lead": "From {name}'s profile, only these details: {fields}.",
  "elev.memdisc.profile.empty": "From {name}'s profile: nothing yet — the profile is empty.",

  "elev.memdisc.field.name": "first name",
  "elev.memdisc.field.age": "age",
  "elev.memdisc.field.ageLabel": "age in months",
  "elev.memdisc.field.languages": "languages at home",
  "elev.memdisc.field.schoolContext": "school or daycare setting",
  "elev.memdisc.field.strengths": "strengths you listed",
  "elev.memdisc.field.challenges": "what you find hard right now",
  "elev.memdisc.field.activeGoals": "the goals you chose",
  "elev.memdisc.field.interests": "interests you listed",
  "elev.memdisc.field.preterm": "weeks at birth",
  "elev.memdisc.field.gender": "gender",
};

export const he: Record<string, string> = {
  "elev.memdisc.facts.lead": "הזיכרון שאישרתם, נשלח עם השאלה הזו:",
  "elev.memdisc.facts.none": "עובדות זיכרון — עדיין אין, אז לא נשלחת אף אחת. ארבור שואל לפני שהוא זוכר משהו.",
  "elev.memdisc.facts.used": "{count} מהן עיצבו את התשובה האחרונה.",
  "elev.memdisc.facts.usedOne": "אחת מהן עיצבה את התשובה האחרונה.",
  "elev.memdisc.facts.more": "ועוד {n}, כולן מופיעות בפרופיל › זיכרון הילד",
  "elev.memdisc.facts.quote": "״{fact}״",

  "elev.memdisc.profile.lead": "מהפרופיל של {name}, רק הפרטים האלה: {fields}.",
  "elev.memdisc.profile.empty": "מהפרופיל של {name}: עדיין כלום — הפרופיל ריק.",

  "elev.memdisc.field.name": "שם פרטי",
  "elev.memdisc.field.age": "גיל",
  "elev.memdisc.field.ageLabel": "גיל בחודשים",
  "elev.memdisc.field.languages": "שפות בבית",
  "elev.memdisc.field.schoolContext": "מסגרת הגן או בית הספר",
  "elev.memdisc.field.strengths": "החוזקות שציינתם",
  "elev.memdisc.field.challenges": "מה מאתגר אתכם עכשיו",
  "elev.memdisc.field.activeGoals": "המטרות שבחרתם",
  "elev.memdisc.field.interests": "תחומי עניין שציינתם",
  "elev.memdisc.field.preterm": "שבועות בלידה",
  "elev.memdisc.field.gender": "מגדר",
};
