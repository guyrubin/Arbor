/* i18nElevation/evening — Wave L (2026-09-04): ENG-10 + ENG-11, the evening.
 *
 *  - ENG-10: `dayPartFor` (lib/timeOfDay) had ZERO production consumers and
 *    Bedtime Stories had no entry point at the hour a parent wants it. The
 *    evening door is now a real cue (lib/timeOfDay `bedtimeDoorOpen` →
 *    lib/jitai BEDTIME kind → route "bedtime-stories") plus a card on the Ask
 *    surface. These are its strings.
 *  - ENG-11: the timed cue was invisible outside the notification bell. The
 *    same card renders whichever cue is live right now, so the one nudge the
 *    parent is allowed to receive is actually on a page they open.
 *
 * Register: parent, calm, plural Israeli-parent address. Clinical firewall —
 * the copy describes the HOUR and the parent's own next move, never the child:
 * no score, no verdict, no "on track", nothing that grades a day.
 */

export const en: Record<string, string> = {
  // ── The BEDTIME cue (lib/jitai) — resolved through t() at every render site.
  "elev.evening.nudge.headline": "Evening with {name}",
  "elev.evening.nudge.body": "The wind-down is easier with something to settle into. Tonight's story can be about {name}.",
  "elev.evening.nudge.cta": "Open Bedtime Stories",

  // ── The card that makes a cue visible on a surface (ENG-11).
  "elev.evening.card.eyebrow": "Right now",
  "elev.evening.card.dismiss": "Not now",
  "elev.evening.card.dismissAria": "Hide this suggestion until tomorrow",
};

export const he: Record<string, string> = {
  "elev.evening.nudge.headline": "ערב עם {name}",
  "elev.evening.nudge.body": "ההירגעות קלה יותר כשיש למה להיכנס. הסיפור של הלילה יכול להיות על {name}.",
  "elev.evening.nudge.cta": "פתחו סיפורי לילה טוב",

  "elev.evening.card.eyebrow": "עכשיו",
  "elev.evening.card.dismiss": "לא עכשיו",
  "elev.evening.card.dismissAria": "להסתיר את ההצעה הזו עד מחר",
};
