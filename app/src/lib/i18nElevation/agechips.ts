/* i18nElevation/agechips — E6 "age-tuning visibility" strings: the small
 * "for age {age}" chip on band-matched activity/course cards (DailyPlayTab)
 * and the quiet "showing content for age {age}" line under the active child
 * in ProfileSwitcher.
 *
 * CLINICAL FIREWALL: these render the child's AGE as a plain fact — never a
 * developmental verdict, score, or "appropriate/behind" framing.
 * Hebrew = transcreation in a calm Israeli-parent register (outcome language,
 * no AI/tech framing); flagged for arbor-localization native review. */

export const en: Record<string, string> = {
  // ── E6 · Age chip on band-matched activity/course cards (a fact, not a claim)
  "elev.agechips.card": "For age {age}",

  // ── E6 · Quiet line under the active child in the profile switcher
  "elev.agechips.switcher": "Showing content for age {age}",
};

export const he: Record<string, string> = {
  "elev.agechips.card": "מותאם לגיל {age}",

  "elev.agechips.switcher": "מציג תוכן לגיל {age}",
};
