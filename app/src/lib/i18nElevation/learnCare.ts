/* i18nElevation/learnCare — Wave R3 (Learn & Care) string seam.
 *
 * Covers LC-04 (the Learn hub's real "today's read"), LC-09/LC-12 (appointment
 * tracking, in-app reminders, follow-up capture), LC-11 (School Brief: the
 * parent-only escalation note + the print egress), LC-17 (the real share
 * preview + recipient invite), LC-20 (reason for visit + prep questions) and
 * KID-12 (the parent strip shown on Kid Mode EXIT).
 *
 * CLINICAL FIREWALL: every string here names a COUNT, a date, a parent's own
 * words, or a plain activity fact. No score, no verdict tag, no colour word
 * meaning good/bad about the child, no percentage.
 *
 * NOTIFICATION HONESTY (LC-12): the app has no push/local-notification
 * infrastructure — no VAPID key, no @capacitor/local-notifications dependency.
 * Every reminder string therefore says the reminder appears IN ARBOR on the
 * next open, and explicitly says Arbor does not send phone alerts. Never
 * promise a notification this app cannot deliver.
 *
 * Hebrew = calm Israeli-parent transcreation (outcome language, no AI/tech
 * framing); flagged for arbor-localization native review.
 */

export const en: Record<string, string> = {
  // ── LC-04 · Learn hub: today's read ────────────────────────────────────────
  "elev.learnCare.pick.eyebrow": "Today's read",
  "elev.learnCare.pick.cta": "Read today's pick",
  "elev.learnCare.pick.stat.minutes": "min to read",
  "elev.learnCare.pick.why.age": "Chosen for where {name} is right now.",
  "elev.learnCare.pick.why.focus": "Chosen for {name}'s age and the area you have been exploring.",
  "elev.learnCare.pick.why.logs": "Chosen from what you noted this week.",
  "elev.learnCare.pick.why.saved": "Continues a topic you saved.",
  "elev.learnCare.pick.deeper": "Go deeper with a full course below.",

  // ── LC-21 · Learn read state ───────────────────────────────────────────────
  // What the PARENT opened, on their own device. A marker and a count — never
  // a fraction, a streak, or a word that grades the child. Both strings are
  // absent from the screen when nothing is known, so a cleared or blocked store
  // renders the plain library rather than a wrong "0".
  "elev.learnCare.read.badge": "Read",
  "elev.learnCare.read.count": "{n} already read",

  // ── LC-12 · Appointments ───────────────────────────────────────────────────
  "elev.learnCare.appt.when.label": "Date and time",
  "elev.learnCare.appt.when.missing": "No date yet",
  "elev.learnCare.appt.status.requested": "Requested",
  "elev.learnCare.appt.status.confirmed": "Confirmed",
  "elev.learnCare.appt.status.done": "Done",
  "elev.learnCare.appt.section.upcoming": "Upcoming",
  "elev.learnCare.appt.section.past": "Already happened",
  "elev.learnCare.appt.ics": "Add to calendar",
  "elev.learnCare.appt.ics.done": "Calendar file saved. Open it to add the appointment.",
  // Shown only when NEITHER egress path worked (see careTrack.saveIcsFile).
  // The old surface claimed "saved" unconditionally, including on a Capacitor
  // WKWebView where the blob download silently wrote nothing.
  "elev.learnCare.appt.ics.failed": "We couldn't hand the calendar file to your device. Try again.",
  "elev.learnCare.appt.reminder.title": "Coming up",
  "elev.learnCare.appt.reminder.line": "{who} — {date}",
  "elev.learnCare.appt.reminder.honesty":
    "Reminders appear here when you open Arbor. Arbor does not send phone notifications.",
  "elev.learnCare.appt.followUp.title": "How did it go?",
  "elev.learnCare.appt.followUp.hint": "What was said, and what happens next. Your words, kept with the appointment.",
  "elev.learnCare.appt.followUp.placeholder": "Write what you want to remember…",
  "elev.learnCare.appt.followUp.save": "Save follow-up",
  "elev.learnCare.appt.followUp.saved": "Follow-up saved with this appointment.",
  "elev.learnCare.appt.followUp.count.one": "1 follow-up note",
  "elev.learnCare.appt.followUp.count.many": "{count} follow-up notes",
  "elev.learnCare.appt.questions.toPacket": "Your prepared questions ride into the summary you hand over.",

  // ── LC-09 · find → share → track, one flow ─────────────────────────────────
  "elev.learnCare.track.created": "Added to Appointments as requested — follow it there.",
  "elev.learnCare.track.open": "Track it in Appointments",

  // ── LC-11 · School Brief ───────────────────────────────────────────────────
  "elev.learnCare.brief.escalation.title": "For you — not part of the teacher's copy",
  "elev.learnCare.brief.escalation.body":
    "This note stays with you. It is not in the brief the teacher receives.",
  "elev.learnCare.brief.escalation.cta": "Open Safety and support",
  "elev.learnCare.brief.print": "Save as PDF",
  "elev.learnCare.brief.printed": "Opened for printing. Choose “Save as PDF” to keep a copy.",
  "elev.learnCare.brief.oneDoor": "The teacher brief lives in School Brief",
  "elev.learnCare.brief.oneDoor.hint": "One teacher document, one door.",

  // ── LC-17 · Trusted Sharing ────────────────────────────────────────────────
  "elev.learnCare.share.preview.title": "They will see exactly this",
  "elev.learnCare.share.preview.hint":
    "Built with the same code the recipient's view uses — word for word.",
  "elev.learnCare.share.preview.empty": "These choices do not open any section yet. Pick at least one more.",
  "elev.learnCare.share.preview.blocked": "This combination cannot be shared safely. Change what is selected.",
  "elev.learnCare.share.invite.cta": "Send an invite",
  "elev.learnCare.share.invite.subject": "{child} on Arbor — I shared some context with you",
  "elev.learnCare.share.invite.body":
    "I shared part of {child}'s Arbor record with you. Open Arbor with this email address and look under Sharing to see it: {link}",
  "elev.learnCare.share.invite.hint": "Arbor does not email your recipient. Send the invite yourself so they know to look.",

  // ── LC-20 · Reason for visit + prepared questions ──────────────────────────
  "elev.learnCare.reason.label": "What I'd like help with",
  "elev.learnCare.reason.hint": "One line, in your words. It opens the summary so nobody has to ask first.",
  "elev.learnCare.reason.placeholder": "The one thing I most want to talk about is…",
  "elev.learnCare.reason.missing": "Add a line so the summary opens with your reason.",

  // ── KID-12 · The parent strip on Kid Mode exit ─────────────────────────────
  "elev.learnCare.kidExit.strip": "While you were away, {name}: {summary}",
  "elev.learnCare.kidExit.join": " · ",
};

export const he: Record<string, string> = {
  // ── LC-04 ──────────────────────────────────────────────────────────────────
  "elev.learnCare.pick.eyebrow": "הקריאה של היום",
  "elev.learnCare.pick.cta": "לקרוא את הבחירה של היום",
  "elev.learnCare.pick.stat.minutes": "דקות קריאה",
  "elev.learnCare.pick.why.age": "נבחר לפי המקום ש{name} נמצא בו עכשיו.",
  "elev.learnCare.pick.why.focus": "נבחר לפי הגיל של {name} והתחום שאתם חוקרים בזמן האחרון.",
  "elev.learnCare.pick.why.logs": "נבחר לפי מה שתיעדתם השבוע.",
  "elev.learnCare.pick.why.saved": "ממשיך נושא ששמרתם.",
  "elev.learnCare.pick.deeper": "להעמיק בקורס מלא למטה.",

  // ── LC-21 ──────────────────────────────────────────────────────────────────
  "elev.learnCare.read.badge": "נקרא",
  "elev.learnCare.read.count": "{n} כבר נקראו",

  // ── LC-12 ──────────────────────────────────────────────────────────────────
  "elev.learnCare.appt.when.label": "תאריך ושעה",
  "elev.learnCare.appt.when.missing": "עדיין בלי תאריך",
  "elev.learnCare.appt.status.requested": "נשלחה בקשה",
  "elev.learnCare.appt.status.confirmed": "נקבע",
  "elev.learnCare.appt.status.done": "התקיים",
  "elev.learnCare.appt.section.upcoming": "הפגישות הקרובות",
  "elev.learnCare.appt.section.past": "כבר התקיימו",
  "elev.learnCare.appt.ics": "להוסיף ליומן",
  "elev.learnCare.appt.ics.done": "קובץ היומן נשמר. פתחו אותו כדי להוסיף את הפגישה.",
  "elev.learnCare.appt.ics.failed": "לא הצלחנו למסור את קובץ היומן למכשיר. נסו שוב.",
  "elev.learnCare.appt.reminder.title": "מתקרב",
  "elev.learnCare.appt.reminder.line": "{who} — {date}",
  "elev.learnCare.appt.reminder.honesty":
    "התזכורות מופיעות כאן כשאתם פותחים את ארבור. ארבור לא שולח התראות לטלפון.",
  "elev.learnCare.appt.followUp.title": "איך היה?",
  "elev.learnCare.appt.followUp.hint": "מה נאמר ומה הצעד הבא. במילים שלכם, נשמר יחד עם הפגישה.",
  "elev.learnCare.appt.followUp.placeholder": "כתבו מה חשוב לכם לזכור…",
  "elev.learnCare.appt.followUp.save": "לשמור סיכום",
  "elev.learnCare.appt.followUp.saved": "הסיכום נשמר יחד עם הפגישה.",
  "elev.learnCare.appt.followUp.count.one": "סיכום אחד",
  "elev.learnCare.appt.followUp.count.many": "{count} סיכומים",
  "elev.learnCare.appt.questions.toPacket": "השאלות שהכנתם נכנסות לסיכום שתמסרו.",

  // ── LC-09 ──────────────────────────────────────────────────────────────────
  "elev.learnCare.track.created": "נוסף לפגישות כבקשה — אפשר לעקוב שם.",
  "elev.learnCare.track.open": "לעקוב בפגישות",

  // ── LC-11 ──────────────────────────────────────────────────────────────────
  "elev.learnCare.brief.escalation.title": "בשבילכם — לא חלק מהעותק של הצוות החינוכי",
  "elev.learnCare.brief.escalation.body": "ההערה הזו נשארת אצלכם. היא לא נמצאת במסמך שהגן או בית הספר מקבלים.",
  "elev.learnCare.brief.escalation.cta": "לפתוח בטיחות ותמיכה",
  "elev.learnCare.brief.print": "לשמור כ‑PDF",
  "elev.learnCare.brief.printed": "נפתח להדפסה. בחרו „שמירה כ‑PDF” כדי לשמור עותק.",
  "elev.learnCare.brief.oneDoor": "המסמך לצוות החינוכי נמצא במסמך לגן ולבית הספר",
  "elev.learnCare.brief.oneDoor.hint": "מסמך אחד לצוות החינוכי, דלת אחת.",

  // ── LC-17 ──────────────────────────────────────────────────────────────────
  "elev.learnCare.share.preview.title": "זה בדיוק מה שהם יראו",
  "elev.learnCare.share.preview.hint": "נבנה מאותו קוד שמייצר את התצוגה של המקבל — מילה במילה.",
  "elev.learnCare.share.preview.empty": "הבחירות האלה עדיין לא פותחות שום פרק. בחרו עוד אחד לפחות.",
  "elev.learnCare.share.preview.blocked": "אי אפשר לשתף את השילוב הזה בבטחה. שנו את מה שנבחר.",
  "elev.learnCare.share.invite.cta": "לשלוח הזמנה",
  "elev.learnCare.share.invite.subject": "{child} בארבור — שיתפתי אתכם בהקשר",
  "elev.learnCare.share.invite.body":
    "שיתפתי אתכם בחלק מהרשומה של {child} בארבור. היכנסו לארבור עם כתובת המייל הזו ובדקו במסך השיתוף: {link}",
  "elev.learnCare.share.invite.hint": "ארבור לא שולח מייל למקבל. שלחו את ההזמנה בעצמכם כדי שידעו להיכנס.",

  // ── LC-20 ──────────────────────────────────────────────────────────────────
  "elev.learnCare.reason.label": "מה הייתי רוצה לקבל עזרה בו",
  "elev.learnCare.reason.hint": "שורה אחת, במילים שלכם. היא פותחת את הסיכום כך שאף אחד לא צריך לשאול קודם.",
  "elev.learnCare.reason.placeholder": "הדבר שהכי חשוב לי לדבר עליו הוא…",
  "elev.learnCare.reason.missing": "הוסיפו שורה כדי שהסיכום ייפתח בסיבה שלכם.",

  // ── KID-12 ─────────────────────────────────────────────────────────────────
  "elev.learnCare.kidExit.strip": "בזמן שלא הייתם, {name}: {summary}",
  "elev.learnCare.kidExit.join": " · ",
};
