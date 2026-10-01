/* i18nElevation/offer — B-AI-06, the single proactive offer per open.
 *
 *   · reason.*  — the one-line WHY under the offer: what it was built from
 *                 (the step the parent chose, an appointment date, a re-check
 *                 that came due, the hour the parent logged around).
 *   · cta.*     — the offer's door, for kinds without a card of their own.
 *   · ctl.*     — Later (snooze a few hours) / Not today (a strike; three
 *                 within a week quiet that kind for seven days) / Undo.
 *
 * CLINICAL FIREWALL: a plain fact or the parent's own words. No count about
 * the child, no score, no verdict, no "falling behind", no comparison.
 * Hebrew = calm Israeli-parent register; flagged for native review.
 */
export const en: Record<string, string> = {
  "elev.offer.reason.followUp": "You chose to try “{step}” — how did it go?",
  // B-TODAY-18: the reason line for tomorrow's reason (the parent's own note).
  "elev.offer.reason.tomorrow": "You left this for today at the end of a previous day.",
  "elev.offer.reason.whatChanged": "Something new since you were last here.",
  "elev.offer.reason.apptToday": "You have an appointment today.",
  "elev.offer.reason.apptTomorrow": "You have an appointment tomorrow.",
  "elev.offer.reason.apptSoon": "You have an appointment in {days} days.",
  "elev.offer.reason.apptYesterday": "You had an appointment yesterday.",
  "elev.offer.reason.recheck": "The re-look you asked for on the Development Check is due.",
  "elev.offer.reason.prep": "Because the moments you logged often fall around this time of day.",
  "elev.offer.reason.calm": "Because this is usually when your evenings start to wind down.",
  "elev.offer.reason.grounded": "Matched to a moment you logged this week.",
  "elev.offer.reason.tonight": "It's evening — a calm way into tonight.",
  "elev.offer.reason.reminder": "A reminder you turned on in Smart Reminders.",
  "elev.offer.cta.followUp": "Tell us how it went",
  "elev.offer.cta.whatChanged": "Take a look",
  "elev.offer.cta.apptPrep": "Prepare your questions",
  "elev.offer.cta.apptNote": "Add a note from the visit",
  "elev.offer.cta.recheck": "Open the Development Check",
  "elev.offer.card.appt": "Appointments",
  "elev.offer.card.recheck": "Development Check",
  "elev.offer.ctl.later": "Later",
  "elev.offer.ctl.notToday": "Not today",
  "elev.offer.ctl.laterAria": "Show this again in a few hours",
  "elev.offer.ctl.notTodayAria": "Hide this for today",
  "elev.offer.toast.later": "We'll bring this back later today.",
  "elev.offer.toast.notToday": "Hidden for today.",
  "elev.offer.toast.undo": "Undo",
};

export const he: Record<string, string> = {
  "elev.offer.reason.followUp": "בחרתם לנסות „{step}” — איך זה הלך?",
  "elev.offer.reason.tomorrow": "השארתם את זה להיום בסוף אחד הימים הקודמים.",
  "elev.offer.reason.whatChanged": "יש משהו חדש מאז הביקור האחרון שלכם.",
  "elev.offer.reason.apptToday": "יש לכם פגישה היום.",
  "elev.offer.reason.apptTomorrow": "יש לכם פגישה מחר.",
  "elev.offer.reason.apptSoon": "יש לכם פגישה בעוד {days} ימים.",
  "elev.offer.reason.apptYesterday": "הייתה לכם פגישה אתמול.",
  "elev.offer.reason.recheck": "הגיע הזמן להסתכל שוב, כמו שביקשתם בבדיקת ההתפתחות.",
  "elev.offer.reason.prep": "כי הרגעים שתיעדתם קורים לרוב בשעה הזו של היום.",
  "elev.offer.reason.calm": "כי בשעה הזו הערבים שלכם בדרך כלל מתחילים להירגע.",
  "elev.offer.reason.grounded": "מותאם לרגע שתיעדתם השבוע.",
  "elev.offer.reason.tonight": "ערב — דרך רגועה להיכנס ללילה.",
  "elev.offer.reason.reminder": "תזכורת שהפעלתם בתזכורות החכמות.",
  "elev.offer.cta.followUp": "ספרו לנו איך הלך",
  "elev.offer.cta.whatChanged": "להציץ",
  "elev.offer.cta.apptPrep": "להכין שאלות",
  "elev.offer.cta.apptNote": "להוסיף הערה מהפגישה",
  "elev.offer.cta.recheck": "לפתוח את בדיקת ההתפתחות",
  "elev.offer.card.appt": "פגישות",
  "elev.offer.card.recheck": "בדיקת התפתחות",
  "elev.offer.ctl.later": "אחר כך",
  "elev.offer.ctl.notToday": "לא היום",
  "elev.offer.ctl.laterAria": "להציג שוב בעוד כמה שעות",
  "elev.offer.ctl.notTodayAria": "להסתיר להיום",
  "elev.offer.toast.later": "נחזיר את זה מאוחר יותר היום.",
  "elev.offer.toast.notToday": "הוסתר להיום.",
  "elev.offer.toast.undo": "ביטול",
};
