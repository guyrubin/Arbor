/* i18nElevation/recap — W2 2.1/2.2/2.3 weekly recap strings (masterplan
 * ARBOR-UI-MASTERPLAN-2026-08-11 §4 · Maytal concept Row-1 #2 "מה הולך טוב" +
 * #4 three-block summary + #6 notification voice).
 *
 * REGISTRATION NOTE: this module is NOT yet wired into i18nElevation/index.ts
 * (that file is owned by the integration lane — add the ONE alphabetical
 * import + registry line there). Until then RecapStoryCards / SinceLastVisit /
 * WeeklyTab resolve these keys through a t()-first/local-fallback helper, so
 * behavior is identical before and after registration.
 *
 * CLINICAL FIREWALL: counts and event language ONLY. Maytal's frame 2 drew
 * per-domain trend arrows — those are BANNED (a trend delta on child data);
 * the translation doc replaces them with count chips, and every string here
 * follows that ruling. The "worth attention" block ships in the neutral
 * conversation framing ("שווה שיחה"), never warning language. No resettable
 * streak wording anywhere — continuity is cumulative ("days of moments
 * together"), pinned by recapStoryCards.test.ts.
 * Hebrew = calm Israeli-parent transcreation (mockup voice), gender-neutral
 * plural forms; flagged for arbor-localization native review. */

export const en: Record<string, string> = {
  // Since-strip entry line (2.1) + continuity counter (2.3 — totalDays only).
  "elev.recap.ready": "Your week with {name} is ready",
  "elev.recap.ready.aria": "Open the weekly recap",
  "elev.recap.days": "{n} days of moments together",

  // Story cards chrome.
  "elev.recap.aria": "Weekly recap story cards",
  "elev.recap.card.count": "Card {i} of {n}",
  "elev.recap.nav.prev": "Previous card",
  "elev.recap.nav.next": "Next card",

  // Card 1 — what went well (mockup frame 2 hero).
  "elev.recap.wentwell.eyebrow": "This week",
  "elev.recap.wentwell.title": "What went well ❤️",

  // Card 2 — evidence counts (frame 2, arrows → count chips).
  "elev.recap.evidence.title": "The week in moments",
  "elev.recap.chip.moments": "{n} moments captured",
  "elev.recap.chip.days": "{n} active days",
  "elev.recap.chip.resolved": "{n} worked through together",
  "elev.recap.chip.milestones": "{n} milestones reached",

  // Card 3 — the three-block summary (frame 4, neutral attention block).
  "elev.recap.summary.title": "My summary for this week",
  "elev.recap.block.progress": "Progress",
  "elev.recap.block.keep": "Keep doing",
  "elev.recap.block.attention": "Worth a conversation",
  "elev.recap.block.attention.empty": "Nothing waiting here this week",

  // Card 4 (LAST) — exactly one recommendation.
  "elev.recap.try.eyebrow": "One thing for the coming week",
  "elev.recap.try.title": "Try this week",

  // Deterministic fallback narrative (AI off / request failed). Localized like
  // every other string here: an English apology inside a Hebrew card is the
  // same language defect as an English AI paragraph.
  "elev.recap.insight.unavailable":
    "Live weekly insight isn't available right now — the summary below still reflects this week as you logged it.",

  // Email opt-in row (2.2 — honest fail-closed copy, Guy decision).
  "elev.recap.email.title": "Get this as a weekly email",
  "elev.recap.email.desc": "One short email when {name}'s week is ready.",
  "elev.recap.email.soon": "Coming soon — you're on the list.",
  "elev.recap.email.aria": "Weekly recap email opt-in",
};

export const he: Record<string, string> = {
  "elev.recap.ready": "הסיכום השבועי של {name} מוכן",
  "elev.recap.ready.aria": "לפתיחת הסיכום השבועי",
  "elev.recap.days": "{n} ימים של רגעים יחד",

  "elev.recap.aria": "כרטיסי הסיכום השבועי",
  "elev.recap.card.count": "כרטיס {i} מתוך {n}",
  "elev.recap.nav.prev": "הכרטיס הקודם",
  "elev.recap.nav.next": "הכרטיס הבא",

  "elev.recap.wentwell.eyebrow": "השבוע",
  "elev.recap.wentwell.title": "מה הלך טוב ❤️",

  "elev.recap.evidence.title": "השבוע ברגעים",
  "elev.recap.chip.moments": "{n} רגעים נשמרו",
  "elev.recap.chip.days": "{n} ימים פעילים",
  "elev.recap.chip.resolved": "{n} רגעים שצלחתם יחד",
  "elev.recap.chip.milestones": "{n} אבני דרך הושגו",

  "elev.recap.summary.title": "הסיכום שלי לשבוע הזה",
  "elev.recap.block.progress": "התקדמות",
  "elev.recap.block.keep": "מומלץ להמשיך",
  "elev.recap.block.attention": "שווה שיחה",
  "elev.recap.block.attention.empty": "אין משהו שמחכה כאן השבוע",

  "elev.recap.try.eyebrow": "דבר אחד לשבוע הקרוב",
  "elev.recap.try.title": "שווה לנסות השבוע",

  "elev.recap.insight.unavailable":
    "התובנה השבועית החיה אינה זמינה כרגע — הסיכום למטה עדיין משקף את השבוע כפי שתיעדתם.",

  "elev.recap.email.title": "לקבל את הסיכום גם במייל שבועי",
  "elev.recap.email.desc": "מייל קצר אחד כשהשבוע של {name} מוכן.",
  "elev.recap.email.soon": "בקרוב — שמרנו לך מקום ברשימה.",
  "elev.recap.email.aria": "הרשמה למייל הסיכום השבועי",
};
