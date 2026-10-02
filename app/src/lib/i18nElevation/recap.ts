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
  // B-TODAY-23: no "of" on the letter, not even the carousel position.
  "elev.recap.card.count": "Card {i} · {n} cards",
  "elev.recap.nav.prev": "Previous card",
  "elev.recap.nav.next": "Next card",

  // B-TODAY-23 — "What changed?" four-card letter. Event language only.
  // Card 1 — New this week (composeWhatChanged over the calendar week).
  "elev.recap.new.eyebrow": "New this week",
  "elev.recap.new.empty": "What you keep this week appears here.",
  // Card 2 — What helped (the parent's own step reports; the step is the subject).
  "elev.recap.helped.eyebrow": "What helped",
  "elev.recap.helped.helped": "helped {n}",
  "elev.recap.helped.somewhat": "helped a little {n}",
  "elev.recap.helped.notToday": "not today {n}",
  "elev.recap.helped.empty": "Steps you try this week appear here, with how they went.",
  // Card 3 — In your words (parent-written moments, client-side only).
  "elev.recap.words.eyebrow": "In your words",
  "elev.recap.words.prompt": "A question for this week",
  "elev.recap.words.capture": "Capture a moment",
  // Share caption sub-line (final card).
  "elev.recap.chip.moments": "{n} moments captured",

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
  // ENG-04/ENG-07: "you're on the list" — there is no list. The opt-in is
  // stored per account and honored the day a provider exists; nothing is
  // POSTed anywhere today, and the copy now says exactly that.
  "elev.recap.email.soon": "Weekly email isn't available yet. Your choice is saved and will apply as soon as it is.",
  "elev.recap.email.aria": "Weekly recap email opt-in",
};

export const he: Record<string, string> = {
  "elev.recap.ready": "הסיכום השבועי של {name} מוכן",
  "elev.recap.ready.aria": "לפתיחת הסיכום השבועי",
  "elev.recap.days": "{n} ימים של רגעים יחד",

  "elev.recap.aria": "כרטיסי הסיכום השבועי",
  "elev.recap.card.count": "כרטיס {i} · {n} כרטיסים",
  "elev.recap.nav.prev": "הכרטיס הקודם",
  "elev.recap.nav.next": "הכרטיס הבא",

  "elev.recap.new.eyebrow": "חדש השבוע",
  "elev.recap.new.empty": "מה שתשמרו השבוע יופיע כאן.",
  "elev.recap.helped.eyebrow": "מה עזר",
  "elev.recap.helped.helped": "עזר {n}",
  "elev.recap.helped.somewhat": "עזר קצת {n}",
  "elev.recap.helped.notToday": "לא היום {n}",
  "elev.recap.helped.empty": "צעדים שתנסו השבוע יופיעו כאן, עם איך שהם הלכו.",
  "elev.recap.words.eyebrow": "במילים שלכם",
  "elev.recap.words.prompt": "שאלה לשבוע הזה",
  "elev.recap.words.capture": "לתעד רגע",
  "elev.recap.chip.moments": "{n} רגעים נשמרו",

  "elev.recap.try.eyebrow": "דבר אחד לשבוע הקרוב",
  "elev.recap.try.title": "שווה לנסות השבוע",

  "elev.recap.insight.unavailable":
    "התובנה השבועית החיה אינה זמינה כרגע — הסיכום למטה עדיין משקף את השבוע כפי שתיעדתם.",

  "elev.recap.email.title": "לקבל את הסיכום גם במייל שבועי",
  "elev.recap.email.desc": "מייל קצר אחד כשהשבוע של {name} מוכן.",
  "elev.recap.email.soon": "המייל השבועי עדיין לא זמין. הבחירה שלכם נשמרה ותיכנס לתוקף ברגע שיהיה.",
  "elev.recap.email.aria": "הרשמה למייל הסיכום השבועי",
};
