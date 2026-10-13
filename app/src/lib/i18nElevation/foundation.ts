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
  // Builder L · R22 — the daily-play attribution line. The organisation name
  // that follows is a proper noun and a live link, so only the lead-in is
  // keyed; it was a bare JSX text node and printed English on the Hebrew hub.
  "elev.evidence.basedOn": "Based on",

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
  "elev.pulse.growth.noticed": "You noticed {count} milestones",
  "elev.pulse.growth.noticedOne": "You noticed 1 milestone",
  "elev.pulse.growth.empty": "The first milestone is waiting",

  // ── Practice / Stories / Learn (Heartwood D2+D3 hubs — no per-hub state in
  //    context yet; honest standing lines. Learn inherits the former Academy
  //    line: the parent-learning half of the D2 Academy split.)
  "elev.pulse.practice.empty": "Short, playful practice — a few minutes counts",
  // B-PLAY-04: count-only (plural forms), never a streak or a score.
  "elev.pulse.practice.rounds": "{count} rounds played this week",
  "elev.pulse.practice.roundsOne": "1 round played this week",
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

  // ── TJB-10/19 + ENG-07 · Weekly: week chips, honest empty state (v3
  //    F-NOW-3 deleted the stale back key; elev.wk.carry.back is the one).
  //    "this week's report will build itself" described a thing the
  //    code does not do — the report is generated when the parent asks.
  "elev.wk.thisWeek": "This week",
  "elev.wk.emptyThisWeek": "Nothing kept yet this week. Log a moment and it shows here, by day and by area.",
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
  "elev.pulse.profile.memory": "Arbor remembers {n} things about {name}",
  "elev.pulse.profile.memoryWaiting": "Arbor remembers {n} things about {name} · {k} waiting for you",
  "elev.pulse.profile.memoryOne": "Arbor remembers one thing about {name}",
  "elev.pulse.profile.memoryOneWaiting": "Arbor remembers one thing about {name} · {k} waiting for you",
  "elev.pulse.profile.waitingOnly": "{k} things about {name} waiting for you",

  // ── Builder E1 · Today hub + Weekly (object backlog, 2026-09-07) ──────────
  // TJB-14 · Day Windows: both of these were bare template literals, so the
  // Hebrew route printed English. `dw.daysLogged` ("{n} days logged") is the
  // badge on the data-rich branch; the low-data branch needs the progress
  // shape, which is why this is a second key rather than a reuse.
  "elev.dw.daysLoggedOf": "{n} of {total} days logged so far.",
  "elev.dw.context": "Patterns for {name}, based on what you've logged.",

  // TJB-28 · the Today receipt's second line, read back from the outcome the
  // parent just recorded. The claim is backed: `outcome` is written to the
  // action entry and sent to /api/todays-focus as `lastActionOutcome`.
  "elev.today.receipt.helped": "You said it helped. That goes into the step Arbor suggests next.",
  "elev.today.receipt.somewhat": "You said it helped a little. That goes into the step Arbor suggests next.",
  "elev.today.receipt.notToday": "You said not today. That goes into the step Arbor suggests next — nothing more is asked of you.",

  // TJB-08 · the in-place dictation strip inside QuickLogModal.
  "elev.ql.voice.stop": "Stop",
  // REC-01 · the one recording indicator (capture sheet + Behaviours).
  "elev.rec.on": "Recording",
  "elev.rec.stopAria": "Stop recording",

  // ── Builder I · shell chrome (object backlog, 2026-09-07) ────────────────
  // OBJ-SHELL-01: the mobile strip's focus label was the English literal
  // "Language transition" — the one word in that row that never translated.
  // It is a PRESENCE fact about the family (more than one language at home),
  // never a finding about the child.
  "elev.shell.focus.multilingual": "Growing up multilingual",

  // Builder M — R25 — #/weekly and #/smart-reminders demotion disclosures.
  "elev.wk.rest.title": "Milestones noticed this week",
  "elev.sr.more.title": "When Arbor may reach you",
  // B-TODAY-16: the phone-reminder card's section on #/smart-reminders.
  "elev.sr.delivery.heading": "Delivery",
  "elev.sr.more.sub": "Quiet hours, and holding nudges for a calm moment.",

  // v3 EXTRA-WEEKLY · the Weekly tab's glance: the week as counts only (no
  // share, no denominator, no score). Tiles, the day-by-day strip and its
  // legend, the screen-reader table, and the areas with records.
  "elev.wk.glance.title": "Week at a glance",
  "elev.wk.glance.sub": "What you kept, what helped, and what to carry into next week. Counts, not scores.",
  "elev.wk.glance.moments": "Moments",
  "elev.wk.glance.helped": "Steps that helped",
  "elev.wk.glance.tried": "tried on {n} days",
  "elev.wk.glance.tried.one": "tried on one day",
  // Each tile's sub-line: on how many days of the week it happened (never "n of 7").
  "elev.wk.glance.kept.days": "kept on {n} days",
  "elev.wk.glance.kept.days.one": "kept on one day",
  "elev.wk.glance.marked.days": "marked on {n} days",
  "elev.wk.glance.marked.days.one": "marked on one day",
  "elev.wk.glance.played.days": "played on {n} days",
  "elev.wk.glance.played.days.one": "played on one day",
  "elev.wk.glance.milestones": "New milestones",
  "elev.wk.glance.kid": "Kid world sessions",
  "elev.wk.glance.words": "Words kept",
  "elev.wk.glance.days": "Day by day",
  "elev.wk.glance.days.aria": "What was kept each day this week",
  "elev.wk.glance.legend.helped": "Step helped",
  "elev.wk.glance.legend.again": "Not this time",
  "elev.wk.glance.table.day": "Day",
  "elev.wk.glance.table.step": "Step",
  "elev.wk.glance.areas": "By area",
  "elev.wk.glance.areas.blank": "Blank = nothing recorded this week.",

  // v3 F-NOW-3 · the Weekly report as the v3 mock: the kicker and headline,
  //   the week steppers, the summary door, the tiles' sub-lines (counts only,
  //   never "5/7" or "+3"), What helped, the child's words, By area, and the
  //   For-next-week band.
  "elev.wk.kicker": "Weekly report · {range}",
  "elev.wk.headline": "{first}’s week, at a glance.",
  "elev.wk.prev": "Previous week",
  "elev.wk.next": "Next week",
  "elev.wk.prev.aria": "Previous week, {week}",
  "elev.wk.next.aria": "Next week, {week}",
  "elev.wk.summary.role": "Add to {role}’s summary",
  "elev.wk.tile.milestones": "Milestones",
  "elev.wk.tile.kid": "Kid world",
  "elev.wk.tile.helped": "helped {n} times",
  "elev.wk.tile.helped.one": "helped once",
  "elev.wk.tile.area": "{area} {n}",
  "elev.wk.tile.sessions": "sessions · {game} ×{n}",
  "elev.wk.place.home": "{n} at home",
  "elev.wk.place.school": "{n} at school",
  "elev.wk.place.transit": "{n} out and about",
  "elev.wk.place.public": "{n} in public",
  "elev.wk.days.title": "What happened each day",
  "elev.wk.legend.moments": "Moments you kept",
  "elev.wk.helped.title": "What helped",
  "elev.wk.helped.times": "Helped {n} times",
  "elev.wk.helped.once": "Helped once",
  "elev.wk.helped.not": "Not this time: {n}",
  "elev.wk.helped.none": "No step tried this week yet.",
  "elev.wk.words.title": "What {first} said this week",
  "elev.wk.words.quote": "“{phrase}”",
  "elev.wk.areas.note": "One line per area. Blank = nothing recorded this week.",
  "elev.wk.areas.milestones": "{n} new milestones",
  "elev.wk.carry.label": "For next week:",
  "elev.wk.carry.none": "Nothing to carry yet. Keep a moment or two, and next week’s idea shows up here.",
  "elev.wk.carry.writing": "Writing next week’s idea from what you kept…",
  "elev.wk.carry.history": "No idea was written for this week.",
  "elev.wk.carry.write": "Write it now",
  "elev.wk.carry.back": "Back to Now",
  // v3 F-NOW-3 (review round 2) · the Steps tile label as the mock names it,
  //   and the weekly-report email row's title on #/smart-reminders.
  "elev.wk.tile.steps": "Steps",
  "elev.wk.email.title": "Weekly report by email",
};

export const he: Record<string, string> = {
  "elev.evidence.label": "מבוסס מחקר · CDC/AAP",
  "elev.evidence.aria": "על המחקר שמאחורי ארבור",
  "elev.evidence.basedOn": "מבוסס על",

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

  "elev.pulse.growth.noticed": "שמתם לב ל‑{count} אבני דרך",
  "elev.pulse.growth.noticedOne": "שמתם לב לאבן דרך אחת",
  "elev.pulse.growth.empty": "אבן הדרך הראשונה מחכה לכם",

  "elev.pulse.practice.empty": "תרגול משחקי קצר — גם כמה דקות שוות",
  "elev.pulse.practice.rounds": "{count} סבבי משחק השבוע",
  "elev.pulse.practice.roundsOne": "סבב משחק אחד השבוע",
  "elev.pulse.stories.empty": "סיפורים שבהם {name} הגיבור",
  "elev.pulse.learn.empty": "ידע קצר ומעשי — מוכן כשנוח לכם",

  "elev.pulse.ask.review": "{count} עדכונים ממתינים לאישור שלכם",
  "elev.pulse.ask.reviewOne": "עדכון אחד ממתין לאישור שלכם",
  "elev.pulse.ask.continue": "להמשיך: {title}",
  "elev.pulse.ask.empty": "שאלו כל דבר על {name}",

  "elev.pulse.care.briefReady": "סיכום מוכן לשיתוף",
  "elev.pulse.care.empty": "צרפו את האנשים שעוזרים בדרך",

  "elev.wk.thisWeek": "השבוע",
  "elev.wk.emptyThisWeek": "עוד לא נשמר כלום השבוע. תעדו רגע והוא יופיע כאן, לפי יום ולפי תחום.",
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
  "elev.pulse.profile.memory": "ארבור זוכרת {n} דברים על {name}",
  "elev.pulse.profile.memoryWaiting": "ארבור זוכרת {n} דברים על {name} · {k} מחכים לכם",
  "elev.pulse.profile.memoryOne": "ארבור זוכרת דבר אחד על {name}",
  "elev.pulse.profile.memoryOneWaiting": "ארבור זוכרת דבר אחד על {name} · {k} מחכים לכם",
  "elev.pulse.profile.waitingOnly": "{k} דברים על {name} מחכים לכם",

  // ── Builder E1 · Today hub + Weekly (object backlog, 2026-09-07) ──────────
  "elev.dw.daysLoggedOf": "תיעדתם {n} מתוך {total} ימים עד כה.",
  "elev.dw.context": "דפוסים של {name}, לפי מה שתיעדתם.",



  "elev.today.receipt.helped": "אמרתם שזה עזר. זה נכנס לצעד שארבור תציע בפעם הבאה.",
  "elev.today.receipt.somewhat": "אמרתם שזה עזר קצת. זה נכנס לצעד שארבור תציע בפעם הבאה.",
  "elev.today.receipt.notToday": "אמרתם שלא היום. זה נכנס לצעד שארבור תציע בפעם הבאה — ולא נדרש מכם דבר נוסף.",

  "elev.ql.voice.stop": "עצירה",
  // REC-01 — gender-neutral; native review owed.
  "elev.rec.on": "מקליטים",
  "elev.rec.stopAria": "עצירת ההקלטה",

  // ── Builder I · shell chrome (object backlog, 2026-09-07) ────────────────
  "elev.shell.focus.multilingual": "גדל/ה עם יותר משפה אחת",

  // Builder M — R25 — #/weekly and #/smart-reminders demotion disclosures.
  "elev.wk.rest.title": "אבני דרך שסימנתם השבוע",
  "elev.sr.more.title": "מתי מותר לארבור לפנות אליכם",
  "elev.sr.delivery.heading": "איך התזכורות מגיעות",
  "elev.sr.more.sub": "שעות שקט, ושמירת התזכורות לרגע רגוע.",

  // v3 EXTRA-WEEKLY · the Weekly tab's glance (counts only).
  "elev.wk.glance.title": "מבט על השבוע",
  "elev.wk.glance.sub": "מה שמרתם, מה עזר ומה לקחת לשבוע הבא. ספירות, לא ציונים.",
  "elev.wk.glance.moments": "רגעים",
  "elev.wk.glance.helped": "צעדים שעזרו",
  "elev.wk.glance.tried": "נוסו ב-{n} ימים",
  "elev.wk.glance.tried.one": "נוסו ביום אחד",
  "elev.wk.glance.kept.days": "נשמרו ב-{n} ימים",
  "elev.wk.glance.kept.days.one": "נשמרו ביום אחד",
  "elev.wk.glance.marked.days": "סומנו ב-{n} ימים",
  "elev.wk.glance.marked.days.one": "סומנו ביום אחד",
  "elev.wk.glance.played.days": "התקיימו ב-{n} ימים",
  "elev.wk.glance.played.days.one": "התקיימו ביום אחד",
  "elev.wk.glance.milestones": "אבני דרך חדשות",
  "elev.wk.glance.kid": "מפגשים בעולם הילד",
  "elev.wk.glance.words": "מילים ששמרתם",
  "elev.wk.glance.days": "יום אחר יום",
  "elev.wk.glance.days.aria": "מה נשמר בכל יום השבוע",
  "elev.wk.glance.legend.helped": "הצעד עזר",
  "elev.wk.glance.legend.again": "לא הפעם",
  "elev.wk.glance.table.day": "יום",
  "elev.wk.glance.table.step": "צעד",
  "elev.wk.glance.areas": "לפי תחום",
  "elev.wk.glance.areas.blank": "ריק = לא תועד דבר השבוע.",

  // v3 F-NOW-3 · the Weekly report as the v3 mock (counts only).
  "elev.wk.kicker": "דוח שבועי · {range}",
  "elev.wk.headline": "השבוע של {first}, במבט אחד.",
  "elev.wk.prev": "שבוע קודם",
  "elev.wk.next": "שבוע הבא",
  "elev.wk.prev.aria": "שבוע קודם, {week}",
  "elev.wk.next.aria": "שבוע הבא, {week}",
  "elev.wk.summary.role": "להוסיף לתקציר עבור {role}",
  "elev.wk.tile.milestones": "אבני דרך",
  "elev.wk.tile.kid": "עולם הילד",
  "elev.wk.tile.helped": "עזר {n} פעמים",
  "elev.wk.tile.helped.one": "עזר פעם אחת",
  "elev.wk.tile.area": "{area} {n}",
  "elev.wk.tile.sessions": "מפגשים · {game} ×{n}",
  "elev.wk.place.home": "{n} בבית",
  "elev.wk.place.school": "{n} במסגרת",
  "elev.wk.place.transit": "{n} בדרכים",
  "elev.wk.place.public": "{n} במקום ציבורי",
  "elev.wk.days.title": "מה קרה בכל יום",
  "elev.wk.legend.moments": "רגעים ששמרתם",
  "elev.wk.helped.title": "מה עזר",
  "elev.wk.helped.times": "עזר {n} פעמים",
  "elev.wk.helped.once": "עזר פעם אחת",
  "elev.wk.helped.not": "לא הפעם: {n}",
  "elev.wk.helped.none": "השבוע עוד לא נוסה צעד.",
  "elev.wk.words.title": "המילים של {first} השבוע",
  "elev.wk.words.quote": "„{phrase}”",
  "elev.wk.areas.note": "שורה אחת לכל תחום. ריק = לא תועד השבוע.",
  "elev.wk.areas.milestones": "{n} אבני דרך חדשות",
  "elev.wk.carry.label": "לשבוע הבא:",
  "elev.wk.carry.none": "עוד אין מה לקחת הלאה. שמרו רגע או שניים, והרעיון לשבוע הבא יופיע כאן.",
  "elev.wk.carry.writing": "כותבים את הרעיון לשבוע הבא ממה ששמרתם…",
  "elev.wk.carry.history": "לשבוע הזה לא נכתב רעיון.",
  "elev.wk.carry.write": "לכתוב עכשיו",
  "elev.wk.carry.back": "חזרה לעכשיו",
  // v3 F-NOW-3 (review round 2) · the Steps tile and the email row's title.
  "elev.wk.tile.steps": "צעדים",
  "elev.wk.email.title": "הדוח השבועי במייל",
};
