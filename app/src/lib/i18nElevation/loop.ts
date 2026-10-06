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
  "elev.loop.notice.undo": "Undo",
  "elev.loop.latest.change": "Not right? Change",
  // ── B-LOOP-05 · the shelf map (#/milestones) ────────────────────────────
  "elev.loop.shelfMap.title": "What to notice, shelf by shelf",
  "elev.loop.shelf.noticed": "{n} noticed",
  "elev.loop.shelf.noticed.one": "1 noticed",
  "elev.loop.shelf.door": "Earlier and later",
  "elev.loop.shelf.doorClose": "Hide earlier and later",
  "elev.loop.shelf.later": "to read, not to mark yet",
  "elev.loop.shelf.none": "No milestones on this shelf. Moments you add still land here.",
  "elev.loop.shelf.noneNow": "Nothing on this shelf for this age. Open Earlier and later to read the rest.",
  "elev.loop.search.label": "Search milestones",
  "elev.loop.search.placeholder": "Search by word, like ball",
  "elev.loop.search.empty": "Nothing matches “{q}”.",
  "elev.loop.search.clear": "Clear the search",
  // ── B-LOOP-06 · a saved moment's milestone proposal (capture sheet) ─────
  "elev.loop.capture.milestone.line": "Sounds like “{title}”, on {shelf}. Add it as seen?",
  "elev.loop.capture.milestone.add": "Add",
  "elev.loop.capture.milestone.done": "Added under {shelf}.",
  "elev.loop.capture.shelf.line": "This looks like it belongs on {shelf}. File it there?",
  "elev.loop.capture.shelf.file": "File it",
  "elev.loop.capture.shelf.done": "Filed under {shelf}.",
  "elev.loop.capture.notThis": "Not this",
  // ── B-LOOP-09 · Today's practice ────────────────────────────────────────
  "elev.loop.practice.caption": "Today's practice",
  "elev.loop.practice.say": "Say:",
  "elev.loop.practice.minutes": "{n} minutes",
  "elev.loop.practice.why": "A small thing for {shelf} today, from the milestone “{title}”.",
  "elev.loop.practice.didIt": "Did it",
  "elev.loop.practice.notToday": "Not today",
  "elev.loop.practice.didReceipt": "Noted. Tonight Arbor asks how it went.",
  "elev.loop.practice.notTodayReceipt": "Tomorrow is fine.",
  "elev.loop.practice.quoteMeta": "Your words, {date}",
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
  "elev.loop.notice.undo": "ביטול",
  "elev.loop.latest.change": "לא מדויק? לשנות",
  // ── B-LOOP-05 · the shelf map (#/milestones) ────────────────────────────
  "elev.loop.shelfMap.title": "מה לשים לב אליו, מדף אחר מדף",
  "elev.loop.shelf.noticed": "{n} נצפו",
  "elev.loop.shelf.noticed.one": "1 נצפה",
  "elev.loop.shelf.door": "מוקדם יותר ומאוחר יותר",
  "elev.loop.shelf.doorClose": "להסתיר את המוקדם והמאוחר",
  "elev.loop.shelf.later": "לקריאה, עוד לא לסימון",
  "elev.loop.shelf.none": "אין אבני דרך במדף הזה. רגעים שתוסיפו עדיין יגיעו לכאן.",
  "elev.loop.shelf.noneNow": "אין כאן משהו לגיל הזה. אפשר לפתוח „מוקדם יותר ומאוחר יותר” ולקרוא את השאר.",
  "elev.loop.search.label": "חיפוש אבני דרך",
  "elev.loop.search.placeholder": "חיפוש לפי מילה, למשל כדור",
  "elev.loop.search.empty": "לא נמצא דבר עבור „{q}”.",
  "elev.loop.search.clear": "ניקוי החיפוש",
  // ── B-LOOP-06 · a saved moment's milestone proposal (capture sheet) ─────
  "elev.loop.capture.milestone.line": "נשמע כמו „{title}”, במדף {shelf}. להוסיף כמשהו שראיתם?",
  "elev.loop.capture.milestone.add": "להוסיף",
  "elev.loop.capture.milestone.done": "נוסף תחת {shelf}.",
  "elev.loop.capture.shelf.line": "נראה שזה שייך למדף {shelf}. לתייק שם?",
  "elev.loop.capture.shelf.file": "לתייק",
  "elev.loop.capture.shelf.done": "תויק תחת {shelf}.",
  "elev.loop.capture.notThis": "לא זה",
  // ── B-LOOP-09 · Today's practice ────────────────────────────────────────
  "elev.loop.practice.caption": "התרגול של היום",
  "elev.loop.practice.say": "אמרו:",
  "elev.loop.practice.minutes": "{n} דקות",
  "elev.loop.practice.why": "משהו קטן למדף {shelf} היום, מתוך אבן הדרך „{title}”.",
  "elev.loop.practice.didIt": "עשינו",
  "elev.loop.practice.notToday": "לא היום",
  "elev.loop.practice.didReceipt": "נרשם. בערב נשאל איך זה הלך.",
  "elev.loop.practice.notTodayReceipt": "גם מחר זה בסדר.",
  "elev.loop.practice.quoteMeta": "המילים שלכם, {date}",
};
