/* i18nElevation/loop — P5-LOOP (the milestone loop): Notice cards, the
 * shelf map, capture proposals, Today's three blocks, Tonight, the journal
 * shelves and the professional view.
 *
 * Parent register: plain words, counts never verdicts, no streaks, no
 * "behind", no colour, no "{n} not yet". The ONLY age sentence is
 * `milestoneAgeLine` (lib/milestoneAgeLine.ts) — no key here states an age.
 * Hebrew addresses the parent in the plural (the app's voice); a line about
 * the child writes the verb in the catalogue's slash form ("אמר/ה") and the
 * caller resolves it from the profile gender (lib/hebrewSlashGender).
 * Clinically sensitive lines have a row in
 * execution/2026-10-06--milestone-loop/REVIEW-SHEET.md. */

export const en: Record<string, string> = {
  // ── B-LOOP-04 · Notice card ─────────────────────────────────────────────
  "elev.loop.notice.aria": "Something to notice",
  "elev.loop.notice.seen": "Seen it",
  "elev.loop.notice.when": "When did you see it?",
  "elev.loop.notice.when.today": "Today",
  "elev.loop.notice.when.this_week": "This week",
  "elev.loop.notice.when.earlier": "Earlier",
  "elev.loop.notice.keep": "Keep a moment?",
  "elev.loop.notice.keep.placeholder": "One line, in your words",
  "elev.loop.notice.keep.save": "Keep it",
  "elev.loop.notice.keep.photo": "Add a photo",
  "elev.loop.notice.seenReceipt": "Noted under {shelf}.",
  "elev.loop.notice.keptReceipt": "Kept with this milestone.",
  "elev.loop.notice.thanks": "Noted. No need to test or push; everyday play is enough.",
};

export const he: Record<string, string> = {
  // ── B-LOOP-04 · Notice card ─────────────────────────────────────────────
  "elev.loop.notice.aria": "משהו לשים לב אליו",
  "elev.loop.notice.seen": "ראיתי",
  "elev.loop.notice.when": "מתי ראיתם?",
  "elev.loop.notice.when.today": "היום",
  "elev.loop.notice.when.this_week": "השבוע",
  "elev.loop.notice.when.earlier": "לפני כן",
  "elev.loop.notice.keep": "לשמור רגע?",
  "elev.loop.notice.keep.placeholder": "שורה אחת, במילים שלכם",
  "elev.loop.notice.keep.save": "לשמור",
  "elev.loop.notice.keep.photo": "להוסיף תמונה",
  "elev.loop.notice.seenReceipt": "נרשם תחת {shelf}.",
  "elev.loop.notice.keptReceipt": "נשמר ליד אבן הדרך הזו.",
  "elev.loop.notice.thanks": "נרשם. אין צורך לבדוק או ללחוץ; משחק רגיל מספיק.",
};
