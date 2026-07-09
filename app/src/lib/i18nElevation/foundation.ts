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

  // ── Academy (no live per-course state in context yet — honest standing line)
  "elev.pulse.academy.empty": "Short, practical guidance — ready when you are",

  // ── Ask Arbor
  "elev.pulse.ask.review": "{count} notes awaiting your review",
  "elev.pulse.ask.reviewOne": "1 note awaiting your review",
  "elev.pulse.ask.continue": "Continue: {title}",
  "elev.pulse.ask.empty": "Ask anything about {name}",

  // ── Care Network
  "elev.pulse.care.briefReady": "A brief is ready to share",
  "elev.pulse.care.empty": "Bring in the people who help",

  // ── Profile (the album motif — total captured moments, a count)
  "elev.pulse.profile.album": "The album is growing: {count} moments",
  "elev.pulse.profile.albumOne": "The album is growing: first moment saved",
  "elev.pulse.profile.empty": "{name}'s album starts here",
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

  "elev.pulse.academy.empty": "ידע קצר ומעשי — מוכן כשנוח לכם",

  "elev.pulse.ask.review": "{count} עדכונים ממתינים לאישור שלכם",
  "elev.pulse.ask.reviewOne": "עדכון אחד ממתין לאישור שלכם",
  "elev.pulse.ask.continue": "להמשיך: {title}",
  "elev.pulse.ask.empty": "שאלו כל דבר על {name}",

  "elev.pulse.care.briefReady": "סיכום מוכן לשיתוף",
  "elev.pulse.care.empty": "צרפו את האנשים שעוזרים בדרך",

  "elev.pulse.profile.album": "האלבום גדל: {count} רגעים",
  "elev.pulse.profile.albumOne": "האלבום גדל: הרגע הראשון נשמר",
  "elev.pulse.profile.empty": "האלבום של {name} מתחיל כאן",
};
