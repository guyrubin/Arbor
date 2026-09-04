/* i18nElevation/closeloop — Wave L "Close the loop".
 *
 * Strings for the seams that turn an offer into a recorded, re-findable act:
 *   · thread.*    — Today's accepted/completed step as a JOURNAL THREAD row
 *                   (the new buildTimeline "actionOutcomes" source, TJB-05).
 *   · since.*     — the same act as a since-your-last-visit strip row.
 *   · echo.*      — the pattern echo shown after a save (TJB-06): a COUNT of
 *                   the parent's own logs, plus the route into Plans.
 *   · drafting    — the optimistic typed-capture line (TJB-09): the parent's
 *                   own words are already in the draft while Arbor reads them.
 *   · cue.*       — the Journal writing prompt carried onto the capture form
 *                   (TJB-12). Display only — never injected into the draft.
 *   · entry.*     — the tapped journal row's detail sheet (TJB-13).
 *   · recap.*     — the honest note when the week's suggestion came from
 *                   Arbor's built-in guidance and so cannot become today's
 *                   step (TJB-11: the move must never vanish silently).
 *   · carry.*     — an accepted step whose outcome was never asked, carried
 *                   past midnight instead of disappearing (ENG-12).
 *   · coldstart.* — the cold-start progress line (ENG-18).
 *
 * CLINICAL FIREWALL: every string states a COUNT or a plain fact about what
 * the PARENT did or what ARBOR can do next. Nothing here grades the child:
 * no score, %, band word, weakest-domain pointer, or period-vs-period delta.
 * The outcome words ("helped" / "not today") describe the SUGGESTION the
 * parent tried, never the child.
 *
 * Hebrew = transcreation in a calm Israeli-parent register (outcome language,
 * no tech framing); flagged for arbor-localization native review.
 */

export const en: Record<string, string> = {
  // ── TJB-05: Today's step as a thread row (kind "action").
  "elev.closeloop.thread.kind": "Today's step",
  "elev.closeloop.thread.filter": "Steps",
  "elev.closeloop.thread.title.accepted": "You made this today's step",
  "elev.closeloop.thread.title.helped": "You tried today's step — it helped",
  "elev.closeloop.thread.title.somewhat": "You tried today's step — it helped a little",
  "elev.closeloop.thread.title.not_today": "You tried today's step — not today",
  "elev.closeloop.thread.title.done": "You closed out today's step",

  // ── TJB-05: the same act on the since-your-last-visit strip.
  "elev.closeloop.since.accepted": "You set a step for the day",
  "elev.closeloop.since.outcome": "You said how the day's step went",

  // ── TJB-06: pattern echo after a save. A count of the parent's own notes.
  "elev.closeloop.echo.title": "You've noted “{type}” {n} times in the last {days} days",
  "elev.closeloop.echo.body": "Noticing it again is the useful part. A plan turns what you keep seeing into steps you can actually run.",
  "elev.closeloop.echo.cta": "Build a plan for this",
  "elev.closeloop.echo.dismiss": "Not now",

  // ── TJB-09: optimistic typed capture.
  "elev.closeloop.drafting": "Your words are in the draft — Arbor is filling in the rest.",

  // ── TJB-12: the Journal writing prompt, carried onto the capture form.
  "elev.closeloop.cue.lead": "You picked this prompt",
  "elev.closeloop.cue.clear": "Clear prompt",

  // ── TJB-13: the tapped journal row's detail sheet.
  "elev.closeloop.entry.aria": "Open this entry",
  "elev.closeloop.entry.title": "This entry",
  "elev.closeloop.entry.close": "Close",
  "elev.closeloop.entry.edit": "Edit this moment",
  "elev.closeloop.entry.noted": "Noted by",
  "elev.closeloop.entry.suggested": "Wording suggested by Arbor",
  "elev.closeloop.entry.when": "When",

  // ── TJB-11: the week's suggestion came from Arbor's built-in guidance.
  "elev.closeloop.recap.builtin": "Arbor put this together from your own counts this week.",
  "elev.closeloop.recap.builtin.why": "It stays here as something to read — only a written weekly read becomes today's step.",

  // ── ENG-12: an accepted step whose outcome was never asked.
  "elev.closeloop.carry.eyebrow": "Still open",
  "elev.closeloop.carry.ask": "You set this step on {date}. How did it go?",
  "elev.closeloop.carry.dismiss": "Skip this one",

  // ── ENG-18: cold-start progress.
  "elev.closeloop.coldstart.one": "One more day of moments and Arbor can start reading {name}'s daily rhythm.",
  "elev.closeloop.coldstart.many": "{n} more days of moments and Arbor can start reading {name}'s daily rhythm.",
};

export const he: Record<string, string> = {
  "elev.closeloop.thread.kind": "הצעד של היום",
  "elev.closeloop.thread.filter": "צעדים",
  "elev.closeloop.thread.title.accepted": "הפכתם את זה לצעד של היום",
  "elev.closeloop.thread.title.helped": "ניסיתם את הצעד של היום וזה עזר",
  "elev.closeloop.thread.title.somewhat": "ניסיתם את הצעד של היום וזה עזר קצת",
  "elev.closeloop.thread.title.not_today": "ניסיתם את הצעד של היום ולא היום",
  "elev.closeloop.thread.title.done": "סגרתם את הצעד של היום",

  "elev.closeloop.since.accepted": "קבעתם צעד ליום",
  "elev.closeloop.since.outcome": "סיפרתם איך הלך הצעד של היום",

  "elev.closeloop.echo.title": "תיעדתם “{type}” {n} פעמים ב-{days} הימים האחרונים",
  "elev.closeloop.echo.body": "דווקא השימו לב החוזר הוא הדבר המועיל. תוכנית מתרגמת את מה שאתם רואים שוב ושוב לצעדים שאפשר לבצע.",
  "elev.closeloop.echo.cta": "לבנות תוכנית לזה",
  "elev.closeloop.echo.dismiss": "לא עכשיו",

  "elev.closeloop.drafting": "המילים שלכם כבר בטיוטה — ארבור משלים את השאר.",

  "elev.closeloop.cue.lead": "בחרתם את השאלה הזו",
  "elev.closeloop.cue.clear": "לנקות את השאלה",

  "elev.closeloop.entry.aria": "לפתוח את הרשומה",
  "elev.closeloop.entry.title": "הרשומה הזו",
  "elev.closeloop.entry.close": "סגירה",
  "elev.closeloop.entry.edit": "לערוך את הרגע",
  "elev.closeloop.entry.noted": "תועד על ידי",
  "elev.closeloop.entry.suggested": "הניסוח הוצע על ידי Arbor",
  "elev.closeloop.entry.when": "מתי",

  "elev.closeloop.recap.builtin": "ארבור הרכיב את זה מהספירות שלכם השבוע.",
  "elev.closeloop.recap.builtin.why": "זה נשאר כאן לקריאה — רק סיכום שבועי כתוב הופך לצעד של היום.",

  "elev.closeloop.carry.eyebrow": "עדיין פתוח",
  "elev.closeloop.carry.ask": "קבעתם את הצעד הזה ב-{date}. איך הלך?",
  "elev.closeloop.carry.dismiss": "לדלג על זה",

  "elev.closeloop.coldstart.one": "עוד יום אחד של רגעים וארבור יוכל להתחיל לקרוא את הקצב היומי של {name}.",
  "elev.closeloop.coldstart.many": "עוד {n} ימים של רגעים וארבור יוכל להתחיל לקרוא את הקצב היומי של {name}.",
};
