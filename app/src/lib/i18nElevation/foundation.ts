/* i18nElevation/foundation — W1 foundation strings: hub live pulses (E1),
 * HubHero a11y bits (E2) and the EvidenceChip (E8).
 *
 * CLINICAL FIREWALL: every pulse below is a COUNT or a plain activity fact —
 * never a percentage, verdict, trend delta, or deficit framing.
 * Hebrew = transcreation in a calm Israeli-parent register (outcome language,
 * no AI/tech framing); flagged for arbor-localization native review. */

export const en: Record<string, string> = {
  // ── E8 · Evidence chip (research-anchored ONLY — never professional review)
  "elev.evidence.label": "Research-based · CDC/AAP",
  "elev.evidence.aria": "About the research behind Arbor",

  // ── E1 · Hub live pulses — Today (Day Windows via the rhythm engine)
  "elev.pulse.today.calmUntil": "Calm window until {time}",
  "elev.pulse.today.windDown": "Wind-down starts around {time}",
  "elev.pulse.today.captured": "{count} moments captured today",
  "elev.pulse.today.capturedOne": "1 moment captured today",
  "elev.pulse.today.empty": "Arbor is learning {name}'s rhythm",

  // ── Journal
  "elev.pulse.journal.week": "{count} moments this week",
  "elev.pulse.journal.weekOne": "1 moment this week",
  "elev.pulse.journal.empty": "The story starts with one small moment",

  // ── Behaviors (Moments)
  "elev.pulse.behaviors.week": "{count} moments logged this week",
  "elev.pulse.behaviors.weekOne": "1 moment logged this week",
  "elev.pulse.behaviors.empty": "Nothing logged this week",

  // ── Growth (milestones — always "x of y noticed", never a score)
  "elev.pulse.growth.noticed": "{count} of {total} milestones noticed",
  "elev.pulse.growth.empty": "The first milestone is waiting",

  // ── Practice / Stories / Learn (Heartwood D2+D3 hubs — no per-hub state in
  //    context yet; honest standing lines. Learn inherits the former Academy
  //    line: the parent-learning half of the D2 Academy split.)
  "elev.pulse.practice.empty": "Short, playful practice — a few minutes counts",
  "elev.pulse.stories.empty": "Stories with {name} as the hero",
  "elev.pulse.learn.empty": "Short, practical guidance — ready when you are",

  // ── Ask Arbor
  "elev.pulse.ask.review": "{count} notes awaiting your review",
  "elev.pulse.ask.reviewOne": "1 note awaiting your review",
  "elev.pulse.ask.continue": "Continue: {title}",
  "elev.pulse.ask.empty": "Ask anything about {name}",

  // ── Care Network
  "elev.pulse.care.briefReady": "A brief is ready to share",
  "elev.pulse.care.empty": "Bring in the people who help",

  // ── TJB-10/19 + ENG-07 · Weekly: back label, week chips, honest empty
  //    state. "this week's report will build itself" described a thing the
  //    code does not do — the report is generated when the parent asks.
  "elev.wk.back": "Back to Today",
  "elev.wk.thisWeek": "This week",
  "elev.wk.emptyThisWeek": "Nothing captured yet this week. Log a moment, then create this week's story.",
  "elev.wk.logMoment": "Log a moment",

  // ── MOB-11 · the birthday is OFFERED, never inferred from an age.
  "elev.ob.birthday.add": "Add exact birthday (optional)",
  "elev.ob.birthday.label": "Birthday",

  // ── OBJ-SHELL-07 · Smart Reminders: its own back label and its own
  //    Settings-row verb. "Back to Settings" pointed at Ask Arbor.
  "elev.sr.back": "Back to Today",
  "elev.sr.open": "Open reminders",

  // ── OBJ-PROFILE-04 · a rate-limited ledger read is OUR queue, not the
  //    parent's connection. Never "something interrupted the connection".
  "elev.memory.catchingUp": "Arbor is catching up — try again in a minute.",

  // ── IA-13 · an unknown hash lands on Today and says so, once.
  "elev.nav.linkMoved": "That link has moved — here's Today.",

  // ── OBJ-ASK-02 · age-band labels for the KNOWLEDGE_AGE_BANDS vocabulary
  //    (knowledge/retrievalKeys). The coach contract carries the band id and
  //    the attribution chip printed it raw ("3-5y"). These are the sentences.
  "elev.band.0-12m": "Under 1 year",
  "elev.band.12-36m": "1–3 years",
  "elev.band.3-5y": "3–5 years",
  "elev.band.6-8y": "6–8 years",
  "elev.band.9-12y": "9–12 years",
  "elev.band.rangeYears": "{from}–{to} years",
  "elev.band.rangeMonths": "{from}–{to} months",

  // ── Profile (the album motif — total captured moments, a count)
  "elev.pulse.profile.album": "The album is growing: {count} moments",
  "elev.pulse.profile.albumOne": "The album is growing: first moment saved",
  "elev.pulse.profile.empty": "{name}'s album starts here",

  // ── Builder E1 · Today hub + Weekly (object backlog, 2026-09-07) ──────────
  // TJB-14 · Day Windows: both of these were bare template literals, so the
  // Hebrew route printed English. `dw.daysLogged` ("{n} days logged") is the
  // badge on the data-rich branch; the low-data branch needs the progress
  // shape, which is why this is a second key rather than a reuse.
  "elev.dw.daysLoggedOf": "{n} of {total} days logged so far.",
  "elev.dw.context": "Patterns for {name}, based on what you've logged.",

  // OBJ-TODAY-06 · the weekly disclosure heading. Its Show/Hide verbs reuse
  // ov.tools.show / ov.tools.hide — one drawer vocabulary across the app.
  "elev.wk.more.title": "More from this week",

  // TJB-23 · the Today tools drawer's daily check-in, which carried no
  // translator at all. `hint` deliberately does NOT promise pattern insights:
  // nothing in src/ reads the `wellness` collection this card writes, so
  // transcreating that claim would have shipped it into a second language.
  "elev.checkin.title": "Today's check-in",
  "elev.checkin.mood": "Mood",
  "elev.checkin.moodAria": "Mood {n} of 5",
  "elev.checkin.sleep": "Sleep:",
  "elev.checkin.sleepValue": "{n}h",
  "elev.checkin.sleepAria": "Hours of sleep: {n}",
  "elev.checkin.appetite": "Appetite",
  "elev.checkin.appetite.good": "Good",
  "elev.checkin.appetite.ok": "Ok",
  "elev.checkin.appetite.poor": "Low",
  "elev.checkin.saved": "Saved for today.",
  "elev.checkin.hint": "Tap to log — kept with today's date.",
};

export const he: Record<string, string> = {
  "elev.evidence.label": "מבוסס מחקר · CDC/AAP",
  "elev.evidence.aria": "על המחקר שמאחורי ארבור",

  "elev.pulse.today.calmUntil": "חלון רגוע עד {time}",
  "elev.pulse.today.windDown": "ההרגעה מתחילה בסביבות {time}",
  "elev.pulse.today.captured": "{count} רגעים נשמרו היום",
  "elev.pulse.today.capturedOne": "רגע אחד נשמר היום",
  "elev.pulse.today.empty": "ארבור לומדת את הקצב של {name}",

  "elev.pulse.journal.week": "{count} רגעים השבוע",
  "elev.pulse.journal.weekOne": "רגע אחד השבוע",
  "elev.pulse.journal.empty": "הסיפור מתחיל ברגע קטן אחד",

  "elev.pulse.behaviors.week": "{count} אירועים נרשמו השבוע",
  "elev.pulse.behaviors.weekOne": "אירוע אחד נרשם השבוע",
  "elev.pulse.behaviors.empty": "לא נרשם דבר השבוע",

  "elev.pulse.growth.noticed": "שמתם לב ל‑{count} מתוך {total} אבני דרך",
  "elev.pulse.growth.empty": "אבן הדרך הראשונה מחכה לכם",

  "elev.pulse.practice.empty": "תרגול משחקי קצר — גם כמה דקות שוות",
  "elev.pulse.stories.empty": "סיפורים שבהם {name} הגיבור",
  "elev.pulse.learn.empty": "ידע קצר ומעשי — מוכן כשנוח לכם",

  "elev.pulse.ask.review": "{count} עדכונים ממתינים לאישור שלכם",
  "elev.pulse.ask.reviewOne": "עדכון אחד ממתין לאישור שלכם",
  "elev.pulse.ask.continue": "להמשיך: {title}",
  "elev.pulse.ask.empty": "שאלו כל דבר על {name}",

  "elev.pulse.care.briefReady": "סיכום מוכן לשיתוף",
  "elev.pulse.care.empty": "צרפו את האנשים שעוזרים בדרך",

  "elev.wk.back": "חזרה למסך היום",
  "elev.wk.thisWeek": "השבוע",
  "elev.wk.emptyThisWeek": "עוד לא נקלט כלום השבוע. תעדו רגע, ואז צרו את סיפור השבוע.",
  "elev.wk.logMoment": "לתעד רגע",
  "elev.ob.birthday.add": "להוסיף תאריך לידה מדויק (לא חובה)",
  "elev.ob.birthday.label": "תאריך לידה",
  "elev.sr.back": "חזרה למסך היום",
  "elev.sr.open": "פתחו תזכורות",
  "elev.memory.catchingUp": "ארבור משלימה פער — נסו שוב בעוד רגע.",
  "elev.nav.linkMoved": "הקישור הזה עבר — הנה מסך היום.",

  "elev.band.0-12m": "עד גיל שנה",
  "elev.band.12-36m": "גילאי 1–3",
  "elev.band.3-5y": "גילאי 3–5",
  "elev.band.6-8y": "גילאי 6–8",
  "elev.band.9-12y": "גילאי 9–12",
  "elev.band.rangeYears": "גילאי {from}–{to}",
  "elev.band.rangeMonths": "גילאי {from}–{to} חודשים",

  "elev.pulse.profile.album": "האלבום גדל: {count} רגעים",
  "elev.pulse.profile.albumOne": "האלבום גדל: הרגע הראשון נשמר",
  "elev.pulse.profile.empty": "האלבום של {name} מתחיל כאן",

  // ── Builder E1 · Today hub + Weekly (object backlog, 2026-09-07) ──────────
  "elev.dw.daysLoggedOf": "תיעדתם {n} מתוך {total} ימים עד כה.",
  "elev.dw.context": "דפוסים של {name}, לפי מה שתיעדתם.",

  "elev.wk.more.title": "עוד מהשבוע",

  "elev.checkin.title": "העדכון היומי",
  "elev.checkin.mood": "מצב רוח",
  "elev.checkin.moodAria": "מצב רוח {n} מתוך 5",
  "elev.checkin.sleep": "שינה:",
  "elev.checkin.sleepValue": "{n} שעות",
  "elev.checkin.sleepAria": "שעות שינה: {n}",
  "elev.checkin.appetite": "תיאבון",
  "elev.checkin.appetite.good": "טוב",
  "elev.checkin.appetite.ok": "בסדר",
  "elev.checkin.appetite.poor": "מועט",
  "elev.checkin.saved": "נשמר להיום.",
  "elev.checkin.hint": "הקישו כדי לתעד — נשמר עם התאריך של היום.",
};
