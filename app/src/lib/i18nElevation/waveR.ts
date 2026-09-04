/* i18nElevation/waveR — Wave R "Growth rhythm & explainability" strings.
 *
 * Covers: GP-06 (the hub's own observe row — noticing a milestone stops being
 * a four-tap expedition), GP-22 (the why-line → Trust Center chain on the
 * Growth lane's remaining why-lines), GP-23 (structured, keepable milestone
 * guidance), GP-13 (memory review gets an edit and an honest expiry date),
 * GP-32 (month in review, counts only), GP-33 (the first-words ledger) and
 * ENG-24 (the Monday anchor for the weekly ritual).
 *
 * CLINICAL FIREWALL: every string here reports a COUNT, a DATE, or a plain
 * fact about what the PARENT did or what ARBOR holds. None grades the child,
 * ranks a domain, names a "weakest" area, or carries a good/bad colour word.
 * The month-in-review copy in particular is written as a record of the
 * parent's noticing, never as a progress report on the child.
 *
 * Hebrew = calm Israeli-parent transcreation, outcome language, gender-neutral
 * phrasing where a child is the subject; flagged for arbor-localization review.
 */

export const en: Record<string, string> = {
  // ── GP-06 · the hub's primary move: notice a milestone, on the hub ─────────
  "elev.waveR.growth.hero.cta": "Notice a milestone",
  "elev.waveR.growth.observe.prompt": "Have you seen this at home?",
  "elev.waveR.growth.observe.hint":
    "Marking it writes it into the record with today's date. Nothing here is graded.",
  "elev.waveR.growth.observe.noticed": "Noticed {date}",
  "elev.waveR.growth.observe.aria": "Mark what you have noticed about this milestone",

  // ── GP-22 · why-lines, each with a door to the Trust Center ───────────────
  "elev.waveR.why.focus":
    "Picked from the milestones written for this age band, and what you have already marked.",
  "elev.waveR.why.watch":
    "Built from the milestones you have not marked yet in this age band — a count of open items, nothing more.",
  "elev.waveR.why.memory":
    "Every line here was proposed from something you wrote, and waits for your approval before Arbor uses it.",
  "elev.waveR.why.copilotFocus":
    "Composed from the areas you have logged in, and the milestones written for this age band.",
  "elev.waveR.why.copilotWatch":
    "Each row counts the observations you logged that mention this area. Counts only.",
  "elev.waveR.why.words":
    "Every line is a phrase you wrote down yourself, kept with the day you first wrote it.",

  // ── GP-23 · milestone guidance: structured, sourced, keepable ─────────────
  "elev.waveR.ms.explain.why":
    "Written for this milestone at {name}'s age, from Arbor's own guidance — not an assessment.",
  "elev.waveR.ms.explain.whyGeneric":
    "Written for this milestone at your child's age, from Arbor's own guidance — not an assessment.",
  "elev.waveR.ms.explain.keep": "Keep this",
  "elev.waveR.ms.explain.error.title": "That guidance did not load",
  "elev.waveR.ms.explain.error.body":
    "A connection hiccup, not your data. The milestone is safe — try again in a moment.",
  "elev.waveR.ms.gaps.why":
    "Built from the milestones you have already marked and the ones written for this age band.",
  "elev.waveR.ms.gaps.keep": "Keep this",

  // ── GP-13 · memory review: edit, and an honest expiry date ────────────────
  "elev.waveR.mem.edit": "Edit",
  "elev.waveR.mem.edit.aria": "Correct what Arbor remembers",
  "elev.waveR.mem.edit.factLabel": "What Arbor remembers",
  "elev.waveR.mem.edit.retentionLabel": "Keep this for",
  "elev.waveR.mem.retention.3months": "3 months",
  "elev.waveR.mem.retention.1year": "1 year",
  "elev.waveR.mem.retention.permanent": "Until I forget it",
  "elev.waveR.mem.save": "Save",
  "elev.waveR.mem.cancel": "Cancel",
  "elev.waveR.mem.saveFailed": "That change did not save. Try again.",
  // Advice at edit time, not a block: the fail-closed guard stays at the share
  // egress (consult/packet.ts). Without this the parent who types the word sees
  // a clean save and a co-parent later sees an unexplained blank share.
  "elev.waveR.mem.clinicalNote":
    "“{term}” reads as clinical language. The fact is kept, and a clinician you share with still sees it — but a co-parent or viewer share that includes your approved facts will not open while it is worded this way.",
  "elev.waveR.mem.forgetsOn": "Forgets on {date}",
  "elev.waveR.mem.keptUntilForget": "Kept until you forget it",

  // ── GP-32 · month in review — the parent's own noticing, counted ──────────
  "elev.waveR.month.eyebrow": "Month in review",
  "elev.waveR.month.title": "{month} with {name}",
  "elev.waveR.month.titleGeneric": "{month}",
  "elev.waveR.month.noticed.one": "You noticed 1 new thing",
  "elev.waveR.month.noticed.many": "You noticed {n} new things",
  "elev.waveR.month.areas.one": "1 area had something new written into it",
  "elev.waveR.month.areas.many": "{n} areas had something new written into them",
  "elev.waveR.month.moments.one": "1 moment kept",
  "elev.waveR.month.moments.many": "{n} moments kept",
  "elev.waveR.month.watch.title": "One thing to watch for this month",
  "elev.waveR.month.watch.accept": "Watch for this",
  "elev.waveR.month.watch.none":
    "Nothing is queued to watch for — the map is open whenever you want to look.",
  "elev.waveR.month.close": "Close",

  // ── GP-33 · the first-words ledger ───────────────────────────────────────
  "elev.waveR.words.eyebrow": "The words, written down",
  "elev.waveR.words.title": "{name}'s words",
  "elev.waveR.words.titleGeneric": "Your child's words",
  "elev.waveR.words.count.one": "1 word or phrase written down",
  "elev.waveR.words.count.many": "{n} words and phrases written down",
  "elev.waveR.words.langs.one": "in 1 language",
  "elev.waveR.words.langs.many": "in {n} languages",
  "elev.waveR.words.add": "Add a word you heard",
  "elev.waveR.words.empty":
    "No words written down yet. The first one you add starts the ledger.",
  "elev.waveR.words.firstOn": "First written down {date}",

  // ── AI-04 · the typed-turn proposals tray ────────────────────────────────
  // Every line describes an act of the PARENT (you asked / you keep / it was
  // written down). Nothing here grades the child or claims a finding.
  "elev.waveR.capture.eyebrow": "From your last answer",
  "elev.waveR.capture.title": "Keep any of this?",
  "elev.waveR.capture.body":
    "Arbor's own words from the answer you just read. Keeping one writes it into the journal with today's date and where it came from — you can edit it first.",
  "elev.waveR.capture.field.todayPlan": "Something to try",
  "elev.waveR.capture.field.parentScript": "Words to use",
  "elev.waveR.capture.field.observe": "Something to look out for",
  "elev.waveR.capture.asked": "You asked",
  "elev.waveR.capture.editLabel": "What gets kept",
  "elev.waveR.capture.keep": "Keep this",
  "elev.waveR.capture.edit": "Edit first",
  "elev.waveR.capture.skip": "Not this one",
  "elev.waveR.capture.kept": "Kept in the journal, with where it came from.",
  "elev.waveR.capture.keepFailed": "That did not save. Nothing was written — try again.",
  "elev.waveR.capture.duplicate": "Something very close to this is already in the record.",

  // ── AI-04 · what a kept row says about its own origin ────────────────────
  "elev.waveR.provenance.chip": "From Ask Arbor",
  "elev.waveR.provenance.line":
    "Arbor wrote these words in an answer to you. Keeping them was your choice, on {date}.",
  "elev.waveR.provenance.asked": "You had asked: {question}",
  "elev.waveR.provenance.prompt": "Arbor guidance, version {version}",

  // ── GP-31 · "Firsts" keepsakes: a note and a date on a fresh milestone ───
  "elev.waveR.keepsake.eyebrow": "A first, kept",
  "elev.waveR.keepsake.add": "Add a note and a date",
  "elev.waveR.keepsake.edit": "Edit this keepsake",
  "elev.waveR.keepsake.title": "Keep this first",
  "elev.waveR.keepsake.intro":
    "Write what you saw and the day you saw it. A photo is optional — the note and the date are enough.",
  "elev.waveR.keepsake.noteLabel": "What you saw",
  "elev.waveR.keepsake.notePlaceholder": "Took three steps from the sofa to me.",
  "elev.waveR.keepsake.dateLabel": "The day you saw it",
  "elev.waveR.keepsake.photoLabel": "A photo, if you have one",
  "elev.waveR.keepsake.photoAdd": "Add a photo",
  "elev.waveR.keepsake.photoRemove": "Remove the photo",
  "elev.waveR.keepsake.photoNote":
    "A photo is stored with this child's own data, and is deleted when they are.",
  "elev.waveR.keepsake.save": "Save the keepsake",
  "elev.waveR.keepsake.remove": "Remove the keepsake",
  "elev.waveR.keepsake.cancel": "Cancel",
  "elev.waveR.keepsake.share": "Share this first",
  "elev.waveR.keepsake.saved": "Kept, with the day you gave it.",
  "elev.waveR.keepsake.removed": "The keepsake is gone. The milestone stays marked.",
  "elev.waveR.keepsake.needNote": "Write a line about what you saw first.",
  "elev.waveR.keepsake.needDate": "Give the day you saw it.",
  "elev.waveR.keepsake.futureDate": "That day has not arrived yet.",
  "elev.waveR.keepsake.photoFailed": "That photo did not load. Your note and date are safe.",
  "elev.waveR.keepsake.on": "Kept for {date}",
  "elev.waveR.keepsake.count.one": "1 first kept with a note",
  "elev.waveR.keepsake.count.many": "{n} firsts kept with a note",
  "elev.waveR.keepsake.aria": "Keep a note and a date for this milestone",

  // ── ENG-24 · the Monday anchor ───────────────────────────────────────────
  "elev.waveR.recap.eyebrow": "Your week",
  "elev.waveR.recap.title": "A new week with {name} starts here",
  "elev.waveR.recap.titleGeneric": "A new week starts here",
  "elev.waveR.recap.body":
    "Last week is written up and waiting — a few cards, counts only, then one thing to carry into this week.",
  "elev.waveR.recap.cta": "Open last week",
  "elev.waveR.recap.later": "Not now",
};

export const he: Record<string, string> = {
  // ── GP-06 ────────────────────────────────────────────────────────────────
  "elev.waveR.growth.hero.cta": "לתעד התפתחות חדשה",
  "elev.waveR.growth.observe.prompt": "ראיתם את זה בבית?",
  "elev.waveR.growth.observe.hint":
    "סימון כותב את זה ליומן עם התאריך של היום. שום דבר כאן לא מקבל ציון.",
  "elev.waveR.growth.observe.noticed": "תועד ב־{date}",
  "elev.waveR.growth.observe.aria": "לסמן מה ראיתם בנוגע לאבן הדרך הזו",

  // ── GP-22 ────────────────────────────────────────────────────────────────
  "elev.waveR.why.focus":
    "נבחר מתוך אבני הדרך שנכתבו לטווח הגילים הזה, ומתוך מה שכבר סימנתם.",
  "elev.waveR.why.watch":
    "מבוסס על אבני הדרך שעדיין לא סימנתם בטווח הגילים הזה — ספירה של פריטים פתוחים, ותו לא.",
  "elev.waveR.why.memory":
    "כל שורה כאן הוצעה מתוך משהו שאתם כתבתם, ומחכה לאישור שלכם לפני שארבור משתמשת בה.",
  "elev.waveR.why.copilotFocus":
    "מורכב מהתחומים שתיעדתם בהם, ומאבני הדרך שנכתבו לטווח הגילים הזה.",
  "elev.waveR.why.copilotWatch":
    "כל שורה סופרת את התיעודים שכתבתם ומזכירים את התחום הזה. ספירה בלבד.",
  "elev.waveR.why.words":
    "כל שורה היא ביטוי שאתם כתבתם, נשמר עם היום שבו נכתב לראשונה.",

  // ── GP-23 ────────────────────────────────────────────────────────────────
  "elev.waveR.ms.explain.why":
    "נכתב לאבן הדרך הזו בגיל של {name}, מתוך התוכן של ארבור — לא הערכה מקצועית.",
  "elev.waveR.ms.explain.whyGeneric":
    "נכתב לאבן הדרך הזו בגיל של הילד או הילדה שלכם, מתוך התוכן של ארבור — לא הערכה מקצועית.",
  "elev.waveR.ms.explain.keep": "לשמור את זה",
  "elev.waveR.ms.explain.error.title": "ההסבר הזה לא נטען",
  "elev.waveR.ms.explain.error.body":
    "זו הייתה תקלת חיבור, לא הנתונים שלכם. אבן הדרך שמורה — נסו שוב עוד רגע.",
  "elev.waveR.ms.gaps.why":
    "מבוסס על אבני הדרך שכבר סימנתם ועל אלה שנכתבו לטווח הגילים הזה.",
  "elev.waveR.ms.gaps.keep": "לשמור את זה",

  // ── GP-13 ────────────────────────────────────────────────────────────────
  "elev.waveR.mem.edit": "עריכה",
  "elev.waveR.mem.edit.aria": "לתקן את מה שארבור זוכרת",
  "elev.waveR.mem.edit.factLabel": "מה שארבור זוכרת",
  "elev.waveR.mem.edit.retentionLabel": "לשמור למשך",
  "elev.waveR.mem.retention.3months": "3 חודשים",
  "elev.waveR.mem.retention.1year": "שנה",
  "elev.waveR.mem.retention.permanent": "עד שאבקש למחוק",
  "elev.waveR.mem.save": "שמירה",
  "elev.waveR.mem.cancel": "ביטול",
  "elev.waveR.mem.saveFailed": "השינוי לא נשמר. נסו שוב.",
  "elev.waveR.mem.clinicalNote":
    "“{term}” נחשבת שפה קלינית. העובדה נשמרת, ואיש מקצוע טיפולי שתשתפו עדיין רואה אותה — אבל שיתוף עם הורה שותף או עם צופה שכולל את העובדות שאישרתם לא ייפתח כל עוד היא מנוסחת כך.",
  "elev.waveR.mem.forgetsOn": "יישכח ב־{date}",
  "elev.waveR.mem.keptUntilForget": "נשמר עד שתבקשו למחוק",

  // ── GP-32 ────────────────────────────────────────────────────────────────
  "elev.waveR.month.eyebrow": "החודש שהיה",
  "elev.waveR.month.title": "{month} עם {name}",
  "elev.waveR.month.titleGeneric": "{month}",
  "elev.waveR.month.noticed.one": "תיעדתם דבר אחד חדש",
  "elev.waveR.month.noticed.many": "תיעדתם {n} דברים חדשים",
  "elev.waveR.month.areas.one": "בתחום אחד נכתב משהו חדש",
  "elev.waveR.month.areas.many": "ב־{n} תחומים נכתב משהו חדש",
  "elev.waveR.month.moments.one": "רגע אחד נשמר",
  "elev.waveR.month.moments.many": "{n} רגעים נשמרו",
  "elev.waveR.month.watch.title": "דבר אחד לשים לב אליו החודש",
  "elev.waveR.month.watch.accept": "לשים לב לזה",
  "elev.waveR.month.watch.none":
    "אין כרגע משהו בתור — המפה פתוחה מתי שתרצו להסתכל.",
  "elev.waveR.month.close": "סגירה",

  // ── GP-33 ────────────────────────────────────────────────────────────────
  "elev.waveR.words.eyebrow": "המילים, כתובות",
  "elev.waveR.words.title": "המילים של {name}",
  "elev.waveR.words.titleGeneric": "המילים של הילד או הילדה שלכם",
  "elev.waveR.words.count.one": "מילה או ביטוי אחד נכתבו",
  "elev.waveR.words.count.many": "{n} מילים וביטויים נכתבו",
  "elev.waveR.words.langs.one": "בשפה אחת",
  "elev.waveR.words.langs.many": "ב־{n} שפות",
  "elev.waveR.words.add": "להוסיף מילה ששמעתם",
  "elev.waveR.words.empty":
    "עוד לא נכתבו מילים. הראשונה שתוסיפו פותחת את היומן.",
  "elev.waveR.words.firstOn": "נכתב לראשונה ב־{date}",

  // ── AI-04 ────────────────────────────────────────────────────────────────
  "elev.waveR.capture.eyebrow": "מתוך התשובה האחרונה",
  "elev.waveR.capture.title": "לשמור משהו מזה?",
  "elev.waveR.capture.body":
    "אלה המילים של ארבור מהתשובה שקראתם עכשיו. שמירה כותבת אותן ליומן עם התאריך של היום ועם המקור שלהן — אפשר לערוך לפני.",
  "elev.waveR.capture.field.todayPlan": "משהו לנסות",
  "elev.waveR.capture.field.parentScript": "מילים להגיד",
  "elev.waveR.capture.field.observe": "משהו לשים לב אליו",
  "elev.waveR.capture.asked": "שאלתם",
  "elev.waveR.capture.editLabel": "מה יישמר",
  "elev.waveR.capture.keep": "לשמור את זה",
  "elev.waveR.capture.edit": "לערוך קודם",
  "elev.waveR.capture.skip": "לא את זה",
  "elev.waveR.capture.kept": "נשמר ביומן, יחד עם המקור.",
  "elev.waveR.capture.keepFailed": "זה לא נשמר. שום דבר לא נכתב — נסו שוב.",
  "elev.waveR.capture.duplicate": "משהו קרוב מאוד לזה כבר רשום.",

  // ── AI-04 ────────────────────────────────────────────────────────────────
  "elev.waveR.provenance.chip": "מתוך שיחה עם ארבור",
  "elev.waveR.provenance.line":
    "ארבור כתבה את המילים האלה בתשובה אליכם. ההחלטה לשמור אותן הייתה שלכם, ב־{date}.",
  "elev.waveR.provenance.asked": "שאלתם אז: {question}",
  "elev.waveR.provenance.prompt": "תוכן ההנחיה של ארבור, גרסה {version}",

  // ── GP-31 ────────────────────────────────────────────────────────────────
  "elev.waveR.keepsake.eyebrow": "פעם ראשונה, שמורה",
  "elev.waveR.keepsake.add": "להוסיף פתק ותאריך",
  "elev.waveR.keepsake.edit": "לערוך את המזכרת",
  "elev.waveR.keepsake.title": "לשמור את הפעם הראשונה",
  "elev.waveR.keepsake.intro":
    "כתבו מה ראיתם ובאיזה יום. תמונה היא רשות — הפתק והתאריך מספיקים.",
  "elev.waveR.keepsake.noteLabel": "מה ראיתם",
  "elev.waveR.keepsake.notePlaceholder": "שלושה צעדים מהספה אליי.",
  "elev.waveR.keepsake.dateLabel": "היום שבו ראיתם",
  "elev.waveR.keepsake.photoLabel": "תמונה, אם יש",
  "elev.waveR.keepsake.photoAdd": "להוסיף תמונה",
  "elev.waveR.keepsake.photoRemove": "להסיר את התמונה",
  "elev.waveR.keepsake.photoNote":
    "תמונה נשמרת יחד עם הנתונים של הילד או הילדה, ונמחקת יחד איתם.",
  "elev.waveR.keepsake.save": "לשמור את המזכרת",
  "elev.waveR.keepsake.remove": "להסיר את המזכרת",
  "elev.waveR.keepsake.cancel": "ביטול",
  "elev.waveR.keepsake.share": "לשתף את הפעם הראשונה",
  "elev.waveR.keepsake.saved": "נשמר, עם היום שנתתם.",
  "elev.waveR.keepsake.removed": "המזכרת הוסרה. אבן הדרך נשארת מסומנת.",
  "elev.waveR.keepsake.needNote": "כתבו קודם שורה על מה שראיתם.",
  "elev.waveR.keepsake.needDate": "ציינו את היום שבו ראיתם.",
  "elev.waveR.keepsake.futureDate": "היום הזה עוד לא הגיע.",
  "elev.waveR.keepsake.photoFailed": "התמונה לא נטענה. הפתק והתאריך שמורים.",
  "elev.waveR.keepsake.on": "נשמר לתאריך {date}",
  "elev.waveR.keepsake.count.one": "פעם ראשונה אחת נשמרה עם פתק",
  "elev.waveR.keepsake.count.many": "{n} פעמים ראשונות נשמרו עם פתק",
  "elev.waveR.keepsake.aria": "לשמור פתק ותאריך לאבן הדרך הזו",

  // ── ENG-24 ───────────────────────────────────────────────────────────────
  "elev.waveR.recap.eyebrow": "השבוע שלכם",
  "elev.waveR.recap.title": "שבוע חדש עם {name} מתחיל כאן",
  "elev.waveR.recap.titleGeneric": "שבוע חדש מתחיל כאן",
  "elev.waveR.recap.body":
    "השבוע שעבר כבר כתוב ומחכה — כמה כרטיסים, ספירות בלבד, ואז דבר אחד לקחת אל השבוע הזה.",
  "elev.waveR.recap.cta": "לפתוח את השבוע שעבר",
  "elev.waveR.recap.later": "לא עכשיו",
};
