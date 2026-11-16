/**
 * Family plan v1 — every parent-facing string on the screen, EN and HE.
 *
 * Words (COPY-RULES): things are "dates"; a date "has an adult" or "nobody
 * yet"; a message to another adult is a request, to yourself a reminder;
 * Arbor's reading of a message is "Arbor draft · you decide" until kept.
 * Counts are figures with units, never a verdict, and nothing describes the
 * child. Reminders are in the app only in v1 (no phone alert).
 */
type Fn<A extends unknown[] = []> = (...a: A) => string;

export interface FamilyPlanCopy {
  pageTitle: string;
  guideLabel: string;
  stops: { who: string; dates: string; cameIn: string; standing: string };
  stopSub: { who: Fn<[number, number]>; dates: Fn<[number]>; cameIn: Fn<[number]>; standing: Fn<[number, number]> };
  kicker: Fn<[string]>;
  isNew: string;
  startHere: string;
  figDates: Fn<[number]>;
  figWithAdult: Fn<[number]>;
  figNobody: string;
  figRange: Fn<[string, string]>;
  later: string;
  you: string;
  /** "you" inside a sentence ("Added by you"). */
  youMid: string;
  nobodyYet: string;
  laneDates: Fn<[number]>;
  laneAsked: string;
  legendHas: string;
  legendAsked: string;
  legendNone: string;
  tokenLabel: Fn<[string, string]>;
  stateHas: Fn<[string]>;
  /** The reader has it ("You have it"). */
  stateHasYou: string;
  stateAsked: Fn<[string]>;
  stateNone: string;
  nextLabel: string;
  nextNobody: Fn<[string, string]>;
  nextAsked: Fn<[string, string]>;
  nextAllCovered: string;
  whoTakes: string;
  askSomeone: string;
  openDate: string;
  datesTitle: string;
  datesSub: string;
  inDays: Fn<[number]>;
  today: string;
  tomorrow: string;
  dueOn: Fn<[string]>;
  reminderQueued: Fn<[string]>;
  askedAt: Fn<[string, string]>;
  noAnswer: string;
  emptyTitle: string;
  emptyBody: string;
  cameInTitle: string;
  addMessage: string;
  addDate: string;
  addToCalendar: string;
  calendarSaved: string;
  calendarShared: string;
  calendarUnavailable: string;
  theMessage: string;
  messagesKept: Fn<[number, number]>;
  noMessage: string;
  lineOf: Fn<[number]>;
  requestsReminders: string;
  inAppOnly: string;
  requestSent: Fn<[string, string]>;
  reminderLine: Fn<[string, string]>;
  reminderDue: Fn<[string]>;
  noReminders: string;
  forYou: string;
  forAdult: Fn<[string]>;
  figRequests: Fn<[number]>;
  figReminders: Fn<[number]>;
  standingTitle: string;
  standingTile: string;
  asked: string;
  accepted: string;
  done: string;
  askedNone: string;
  acceptedNone: string;
  doneNone: string;
  datesEmpty: string;
  // review
  reviewTitle: string;
  reviewPaste: string;
  reviewPasteHint: string;
  reviewRead: string;
  reviewReading: string;
  reviewKeepsLines: string;
  reviewFound: Fn<[number, number]>;
  reviewNothing: string;
  reviewDraft: string;
  reviewTickHint: string;
  reviewAddToPlan: string;
  reviewAddN: Fn<[number]>;
  reviewNotNow: string;
  reviewEdit: string;
  reviewDone: string;
  reviewNoDate: string;
  reviewAddADate: string;
  reviewKeepAsPrep: string;
  reviewPrepFor: Fn<[string]>;
  reviewDuplicate: string;
  reviewChecked: string;
  reviewCheckedNone: string;
  reviewChange: string;
  reviewFromVersion: string;
  reviewIfApply: Fn<[string]>;
  reviewIfApplyNobody: string;
  reviewApply: string;
  reviewApplyAsk: Fn<[string]>;
  reviewKeepBoth: string;
  reviewError: string;
  reviewBlocked: string;
  reviewCrisis: string;
  reviewQuota: string;
  reviewOffline: string;
  kinds: Record<"deadline" | "event" | "join" | "note", string>;
  // manual add & edit
  manualTitle: string;
  editTitle: string;
  fieldName: string;
  fieldKind: string;
  fieldDay: string;
  fieldTime: string;
  fieldTimeHint: string;
  save: string;
  cancel: string;
  // ask
  askTitle: string;
  askOne: string;
  takeItYourself: string;
  coParent: string;
  invitedNotJoined: string;
  inviteCoParent: string;
  noteTo: Fn<[string]>;
  notePrefill: Fn<[string, string]>;
  askButton: Fn<[string]>;
  takeButton: string;
  askHint: string;
  askFlowNow: string;
  askFlowAsked: string;
  askFlowYes: string;
  // date detail
  hasIt: Fn<[string]>;
  confirmedFor: Fn<[string]>;
  prepTitle: string;
  prepAdd: string;
  prepPlaceholder: string;
  prepNone: string;
  fromTheMessage: string;
  historyTitle: string;
  historyKeeps: string;
  history: {
    added: Fn<[string]>; asked: Fn<[string, string]>; took: Fn<[string]>; accepted: Fn<[string, string]>; declined: Fn<[string]>;
    changed: Fn<[string]>; reminder_stopped: Fn<[string]>; request_closed: string; prep_added: Fn<[string]>; done: Fn<[string]>; cancelled: Fn<[string]>; edited: Fn<[string]>;
  };
  markDone: string;
  cancelDate: string;
  editDate: string;
  versionLabel: Fn<[number]>;
  wasTime: Fn<[string]>;
  // receipts
  receipt: Record<"added" | "took" | "asked" | "changed" | "done" | "cancelled" | "prep" | "edited" | "undone" | "kept_note", Fn<[number]>>;
  duplicatesSkipped: Fn<[number]>;
  undo: string;
  saveError: string;
  retry: string;
  loading: string;
  // co-parent side
  coTitle: string;
  coAsksYou: Fn<[string]>;
  coTakeIt: string;
  coCant: string;
  coYesMeans: string;
  coYesFor: Fn<[number]>;
  coAddCalendar: string;
  coAnswered: Fn<[string]>;
  coChanged: string;
  coNoRequests: string;
  coPlanTitle: string;
  coYouHaveIt: string;
  coMarkDone: string;
  coDoneSaved: string;
  coError: string;
  coUnavailable: string;
}

const en: FamilyPlanCopy = {
  pageTitle: "The family plan",
  guideLabel: "On this page",
  stops: { who: "Who has what", dates: "The dates", cameIn: "What came in", standing: "Where each thing stands" },
  stopSub: {
    who: (n, none) => `${n} ${n === 1 ? "date" : "dates"}${none ? `, ${none} nobody yet` : ""}`,
    dates: (n) => (n ? "soonest first" : "none yet"),
    cameIn: (n) => `${n} ${n === 1 ? "message" : "messages"}`,
    standing: (asked, accepted) => `${asked} asked, ${accepted} accepted`,
  },
  kicker: (range) => `Who has what · ${range}`,
  isNew: "New",
  startHere: "Start here",
  figDates: (n) => (n === 1 ? "date" : "dates"),
  figWithAdult: () => "with an adult",
  figNobody: "nobody yet",
  figRange: (a, b) => (a === b ? a : `${a} to ${b}`),
  later: "Later",
  you: "You",
  youMid: "you",
  nobodyYet: "Nobody yet",
  laneDates: (n) => `${n} ${n === 1 ? "date" : "dates"}`,
  laneAsked: "asked",
  legendHas: "an adult said yes",
  legendAsked: "asked, no answer",
  legendNone: "nobody yet",
  tokenLabel: (title, state) => `${title}, ${state}`,
  stateHas: (who) => `${who} has it`,
  stateHasYou: "You have it",
  stateAsked: (who) => `asked ${who}, no answer yet`,
  stateNone: "nobody yet",
  nextLabel: "Next",
  nextNobody: (title, when) => `${title}, ${when}: nobody has it yet.`,
  nextAsked: (title, who) => `${title}: ${who} has not answered yet.`,
  nextAllCovered: "Every date this week has an adult.",
  whoTakes: "Who takes this?",
  askSomeone: "Ask someone",
  openDate: "Open",
  datesTitle: "The dates",
  datesSub: "soonest first",
  inDays: (n) => `In ${n} ${n === 1 ? "day" : "days"}`,
  today: "Today",
  tomorrow: "Tomorrow",
  dueOn: (day) => `Due ${day}`,
  reminderQueued: (at) => `A reminder is queued for ${at}.`,
  askedAt: (who, at) => `Asked ${who} ${at}.`,
  noAnswer: "No answer yet.",
  emptyTitle: "Nothing in the plan yet",
  emptyBody: "Paste a message from the kindergarten, or add a date yourself. Nothing joins the plan until you keep it.",
  cameInTitle: "What came in",
  addMessage: "Add a school message",
  addDate: "Add a date",
  addToCalendar: "Add to my calendar",
  calendarSaved: "Calendar file saved",
  calendarShared: "Calendar file ready to share",
  calendarUnavailable: "The calendar file could not be saved on this device",
  theMessage: "The message",
  messagesKept: (dates, msgs) => `${dates} ${dates === 1 ? "date" : "dates"} kept from ${msgs} ${msgs === 1 ? "message" : "messages"}`,
  noMessage: "No message yet. Paste one and Arbor drafts the dates it finds; you decide what joins the plan.",
  lineOf: (n) => `line ${n} of the message`,
  requestsReminders: "Requests and reminders",
  inAppOnly: "Reminders show here in Arbor. No phone alert is sent.",
  requestSent: (who, at) => `Request to ${who}, sent ${at}`,
  reminderLine: (title, at) => `${title}, reminder ${at}`,
  reminderDue: (title) => `${title}, reminder now`,
  noReminders: "No reminders queued.",
  forYou: "for you",
  forAdult: (who) => `for ${who}`,
  figRequests: (n) => (n === 1 ? "request with no answer" : "requests with no answer"),
  figReminders: (n) => (n === 1 ? "reminder queued" : "reminders queued"),
  standingTitle: "Where each thing stands",
  standingTile: "Asked, accepted, done",
  asked: "Asked",
  accepted: "Accepted",
  done: "Done",
  askedNone: "Nothing waiting for an answer.",
  acceptedNone: "No date has an adult yet.",
  doneNone: "Nothing yet. The adult who has it marks it.",
  datesEmpty: "No dates yet.",
  reviewTitle: "School message",
  reviewPaste: "Paste the message",
  reviewPasteHint: "Arbor reads it for dates and keeps only the lines a kept date came from, never the whole message.",
  reviewRead: "Find the dates",
  reviewReading: "Reading the message…",
  reviewKeepsLines: "Arbor keeps the lines it used, not the whole message.",
  reviewFound: (dated, notes) => `${dated} ${dated === 1 ? "date" : "dates"} found${notes ? `, ${notes} ${notes === 1 ? "note" : "notes"} with no date` : ""}`,
  reviewNothing: "Arbor found no dates in this message. You can add one yourself.",
  reviewDraft: "Arbor draft · you decide",
  reviewTickHint: "tick what joins the plan",
  reviewAddToPlan: "Add to the plan",
  reviewAddN: (n) => (n === 1 ? "Add 1 to the family plan" : `Add ${n} to the family plan`),
  reviewNotNow: "Not now",
  reviewEdit: "Edit",
  reviewDone: "Done",
  reviewNoDate: "No date in the message. Arbor does not guess one.",
  reviewAddADate: "Add a date",
  reviewKeepAsPrep: "Keep as prep",
  reviewPrepFor: (title) => `Kept as prep for ${title}`,
  reviewDuplicate: "Already in your plan: it will not be added twice.",
  reviewChecked: "Checked against your plan",
  reviewCheckedNone: "None of these is already in it.",
  reviewChange: "One thing changed",
  reviewFromVersion: "From a newer message",
  reviewIfApply: (who) => `If you apply it, ${who} is asked again for the new time and the old reminder stops.`,
  reviewIfApplyNobody: "If you apply it, the old reminder stops and a new one waits for the new time.",
  reviewApply: "Apply the change",
  reviewApplyAsk: (who) => `Apply and ask ${who} again`,
  reviewKeepBoth: "Keep both dates",
  reviewError: "Arbor could not read the message just now. Try again, or add the dates yourself.",
  reviewBlocked: "Arbor could not safely draft from this message. Add the dates yourself.",
  reviewCrisis: "This message may need more than a plan. Safety & urgent help is in the top bar.",
  reviewQuota: "Arbor has reached its limit for now. Add the dates yourself, or try again later.",
  reviewOffline: "You are offline. Add the dates yourself, or try again when you are back online.",
  kinds: { deadline: "Deadline", event: "Event", join: "A parent is asked to join", note: "Note" },
  manualTitle: "Add a date",
  editTitle: "Edit the date",
  fieldName: "What it is",
  fieldKind: "Kind",
  fieldDay: "Day",
  fieldTime: "Time",
  fieldTimeHint: "Leave empty when there is no time.",
  save: "Save",
  cancel: "Cancel",
  askTitle: "Who takes this?",
  askOne: "Ask one person",
  takeItYourself: "Take it yourself",
  coParent: "Co-parent",
  invitedNotJoined: "Invited, not joined",
  inviteCoParent: "Invite a co-parent",
  noteTo: (who) => `Your note to ${who}`,
  notePrefill: (title, when) => `Can you take ${title} on ${when}?`,
  askButton: (who) => `Ask ${who}`,
  takeButton: "I'll take it",
  askHint: "They get it in Arbor. It stays open until they say yes.",
  askFlowNow: "Now: nobody yet",
  askFlowAsked: "When you ask: asked, no answer yet",
  askFlowYes: "Only on their yes: they have it",
  hasIt: (who) => `${who} has it`,
  confirmedFor: (when) => `confirmed for ${when}`,
  prepTitle: "To prepare",
  prepAdd: "Add",
  prepPlaceholder: "A form to return, something to bring",
  prepNone: "Nothing to prepare yet.",
  fromTheMessage: "From the kindergarten's message",
  historyTitle: "How it got here",
  historyKeeps: "The history stays with the plan.",
  history: {
    added: (who) => `Added by ${who}`,
    asked: (who, to) => `${who} asked ${to}`,
    took: (who) => `${who} took it`,
    accepted: (who, ver) => `${who} said yes, ${ver}`,
    declined: (who) => `${who} can't take it`,
    changed: (old) => `Moved from ${old}`,
    reminder_stopped: (old) => `The reminder for ${old} stopped`,
    request_closed: "The open request closed",
    prep_added: (who) => `${who} added something to prepare`,
    done: (who) => `${who} marked it done`,
    cancelled: (who) => `${who} cancelled it`,
    edited: (who) => `${who} edited it`,
  },
  markDone: "Mark as done",
  cancelDate: "Cancel this date",
  editDate: "Edit",
  versionLabel: (n) => `version ${n}`,
  wasTime: (old) => `was ${old}`,
  receipt: {
    added: (n) => (n === 1 ? "1 date added to the family plan" : `${n} dates added to the family plan`),
    took: () => "You have it",
    asked: () => "Request sent in Arbor",
    changed: () => "Change applied",
    done: () => "Marked as done",
    cancelled: () => "Date cancelled",
    prep: () => "Added to prepare",
    edited: () => "Date saved",
    undone: () => "Undone",
    kept_note: () => "Kept as prep",
  },
  duplicatesSkipped: (n) => (n === 1 ? "1 was already in your plan" : `${n} were already in your plan`),
  undo: "Undo",
  saveError: "That did not save. Try again.",
  retry: "Try again",
  loading: "Loading the family plan…",
  coTitle: "Family plan",
  coAsksYou: (who) => `${who} asks you`,
  coTakeIt: "I'll take it",
  coCant: "I can't",
  coYesMeans: "Your yes is for this version. If the kindergarten changes it, you are asked again.",
  coYesFor: (n) => `Your yes is for version ${n}.`,
  coAddCalendar: "Add it to my calendar when I say yes",
  coAnswered: (a) => a,
  coChanged: "This date changed since you were asked. Here is the new version.",
  coNoRequests: "No requests for you right now.",
  coPlanTitle: "This week's dates",
  coYouHaveIt: "You have it",
  coMarkDone: "Mark as done",
  coDoneSaved: "Marked as done",
  coError: "That did not save. Try again.",
  coUnavailable: "The family plan is not available right now.",
};

const he: FamilyPlanCopy = {
  pageTitle: "התוכנית המשפחתית",
  guideLabel: "בעמוד הזה",
  stops: { who: "מי לוקח מה", dates: "התאריכים", cameIn: "מה הגיע", standing: "איפה כל דבר עומד" },
  stopSub: {
    who: (n, none) => `${n === 1 ? "תאריך אחד" : `${n} תאריכים`}${none ? `, ${none} עוד בלי מבוגר` : ""}`,
    dates: (n) => (n ? "הקרוב ביותר קודם" : "עוד אין"),
    cameIn: (n) => (n === 1 ? "הודעה אחת" : `${n} הודעות`),
    standing: (asked, accepted) => `${asked} בבקשה, ${accepted} אושרו`,
  },
  kicker: (range) => `מי לוקח מה · ${range}`,
  isNew: "חדש",
  startHere: "מתחילים כאן",
  figDates: (n) => (n === 1 ? "תאריך" : "תאריכים"),
  figWithAdult: () => "עם מבוגר",
  figNobody: "עוד בלי מבוגר",
  figRange: (a, b) => (a === b ? a : `${a} עד ${b}`),
  later: "בהמשך",
  you: "את/ה",
  youMid: "את/ה",
  nobodyYet: "עוד אף אחד",
  laneDates: (n) => (n === 1 ? "תאריך אחד" : `${n} תאריכים`),
  laneAsked: "נשלחה בקשה",
  legendHas: "מבוגר אמר כן",
  legendAsked: "נשלחה בקשה, אין תשובה",
  legendNone: "עוד אף אחד",
  tokenLabel: (title, state) => `${title}, ${state}`,
  stateHas: (who) => `אצל ${who}`,
  stateHasYou: "אצלך",
  stateAsked: (who) => `נשלחה בקשה ל${who}, עוד אין תשובה`,
  stateNone: "עוד אף אחד",
  nextLabel: "הבא",
  nextNobody: (title, when) => `${title}, ${when}: עוד אף אחד לא לקח.`,
  nextAsked: (title, who) => `${title}: ${who} עוד לא ענה.`,
  nextAllCovered: "לכל תאריך השבוע יש מבוגר.",
  whoTakes: "מי לוקח את זה?",
  askSomeone: "לבקש ממישהו",
  openDate: "פתיחה",
  datesTitle: "התאריכים",
  datesSub: "הקרוב ביותר קודם",
  inDays: (n) => (n === 1 ? "בעוד יום" : `בעוד ${n} ימים`),
  today: "היום",
  tomorrow: "מחר",
  dueOn: (day) => `עד ${day}`,
  reminderQueued: (at) => `תזכורת ממתינה ל${at}.`,
  askedAt: (who, at) => `נשלחה בקשה ל${who} ${at}.`,
  noAnswer: "עוד אין תשובה.",
  emptyTitle: "עוד אין כלום בתוכנית",
  emptyBody: "הדביקו הודעה מהגן, או הוסיפו תאריך בעצמכם. שום דבר לא נכנס לתוכנית עד שתשמרו.",
  cameInTitle: "מה הגיע",
  addMessage: "הוספת הודעה מהגן",
  addDate: "הוספת תאריך",
  addToCalendar: "הוספה ליומן שלי",
  calendarSaved: "קובץ היומן נשמר",
  calendarShared: "קובץ היומן מוכן לשיתוף",
  calendarUnavailable: "לא ניתן לשמור את קובץ היומן במכשיר הזה",
  theMessage: "ההודעה",
  messagesKept: (dates, msgs) => `${dates === 1 ? "תאריך אחד נשמר" : `${dates} תאריכים נשמרו`} מ${msgs === 1 ? "הודעה אחת" : `${msgs} הודעות`}`,
  noMessage: "עוד אין הודעה. הדביקו אחת ו-Arbor ינסח את התאריכים שהוא מוצא; אתם מחליטים מה נכנס לתוכנית.",
  lineOf: (n) => `שורה ${n} בהודעה`,
  requestsReminders: "בקשות ותזכורות",
  inAppOnly: "התזכורות מופיעות כאן ב-Arbor. לא נשלחת התראה לטלפון.",
  requestSent: (who, at) => `בקשה ל${who}, נשלחה ${at}`,
  reminderLine: (title, at) => `${title}, תזכורת ${at}`,
  reminderDue: (title) => `${title}, תזכורת עכשיו`,
  noReminders: "אין תזכורות ממתינות.",
  forYou: "בשבילך",
  forAdult: (who) => `בשביל ${who}`,
  figRequests: (n) => (n === 1 ? "בקשה בלי תשובה" : "בקשות בלי תשובה"),
  figReminders: (n) => (n === 1 ? "תזכורת ממתינה" : "תזכורות ממתינות"),
  standingTitle: "איפה כל דבר עומד",
  standingTile: "נשלח, אושר, בוצע",
  asked: "נשלח",
  accepted: "אושר",
  done: "בוצע",
  askedNone: "אין בקשה שמחכה לתשובה.",
  acceptedNone: "עוד אין תאריך עם מבוגר.",
  doneNone: "עוד כלום. המבוגר שלקח מסמן.",
  datesEmpty: "עוד אין תאריכים.",
  reviewTitle: "הודעה מהגן",
  reviewPaste: "הדביקו את ההודעה",
  reviewPasteHint: "Arbor קורא אותה כדי למצוא תאריכים ושומר רק את השורות שמהן הגיעו התאריכים שנשמרו, לא את כל ההודעה.",
  reviewRead: "מציאת התאריכים",
  reviewReading: "קורא את ההודעה…",
  reviewKeepsLines: "Arbor שומר את השורות שבהן השתמש, לא את כל ההודעה.",
  reviewFound: (dated, notes) => `${dated === 1 ? "נמצא תאריך אחד" : `נמצאו ${dated} תאריכים`}${notes ? `, ${notes === 1 ? "הערה אחת" : `${notes} הערות`} בלי תאריך` : ""}`,
  reviewNothing: "Arbor לא מצא תאריכים בהודעה הזאת. אפשר להוסיף תאריך בעצמכם.",
  reviewDraft: "טיוטה של Arbor · אתם מחליטים",
  reviewTickHint: "סמנו מה נכנס לתוכנית",
  reviewAddToPlan: "להוסיף לתוכנית",
  reviewAddN: (n) => (n === 1 ? "הוספת תאריך אחד לתוכנית" : `הוספת ${n} לתוכנית המשפחתית`),
  reviewNotNow: "לא עכשיו",
  reviewEdit: "עריכה",
  reviewDone: "סיום",
  reviewNoDate: "אין תאריך בהודעה. Arbor לא מנחש.",
  reviewAddADate: "הוספת תאריך",
  reviewKeepAsPrep: "לשמור כהכנה",
  reviewPrepFor: (title) => `נשמר כהכנה ל${title}`,
  reviewDuplicate: "כבר בתוכנית שלכם: לא יתווסף פעמיים.",
  reviewChecked: "נבדק מול התוכנית שלכם",
  reviewCheckedNone: "אף אחד מאלה עוד לא נמצא בה.",
  reviewChange: "דבר אחד השתנה",
  reviewFromVersion: "מהודעה חדשה יותר",
  reviewIfApply: (who) => `אם תעדכנו, ${who} יתבקש שוב לשעה החדשה והתזכורת הישנה תיעצר.`,
  reviewIfApplyNobody: "אם תעדכנו, התזכורת הישנה תיעצר ותזכורת חדשה תחכה לשעה החדשה.",
  reviewApply: "עדכון השינוי",
  reviewApplyAsk: (who) => `לעדכן ולבקש שוב מ${who}`,
  reviewKeepBoth: "לשמור את שני התאריכים",
  reviewError: "Arbor לא הצליח לקרוא את ההודעה כרגע. נסו שוב, או הוסיפו את התאריכים בעצמכם.",
  reviewBlocked: "Arbor לא יכול לנסח בבטחה מההודעה הזאת. הוסיפו את התאריכים בעצמכם.",
  reviewCrisis: "ייתכן שההודעה הזאת צריכה יותר מתוכנית. בטיחות ועזרה דחופה נמצאים בסרגל העליון.",
  reviewQuota: "Arbor הגיע למגבלה לעכשיו. הוסיפו את התאריכים בעצמכם, או נסו שוב מאוחר יותר.",
  reviewOffline: "אין חיבור. הוסיפו את התאריכים בעצמכם, או נסו שוב כשתחזרו לרשת.",
  kinds: { deadline: "מועד אחרון", event: "אירוע", join: "מבקשים שהורה יצטרף", note: "הערה" },
  manualTitle: "הוספת תאריך",
  editTitle: "עריכת התאריך",
  fieldName: "מה זה",
  fieldKind: "סוג",
  fieldDay: "יום",
  fieldTime: "שעה",
  fieldTimeHint: "השאירו ריק כשאין שעה.",
  save: "שמירה",
  cancel: "ביטול",
  askTitle: "מי לוקח את זה?",
  askOne: "לבקש מאדם אחד",
  takeItYourself: "לקחת בעצמך",
  coParent: "הורה שותף",
  invitedNotJoined: "הוזמן, עוד לא הצטרף",
  inviteCoParent: "הזמנת הורה שותף",
  noteTo: (who) => `ההודעה שלך ל${who}`,
  notePrefill: (title, when) => `תוכל/י לקחת את ${title} ב${when}?`,
  askButton: (who) => `לבקש מ${who}`,
  takeButton: "אני לוקח/ת",
  askHint: "הבקשה מגיעה אליו ב-Arbor ונשארת פתוחה עד שיגיד כן.",
  askFlowNow: "עכשיו: עוד אף אחד",
  askFlowAsked: "כשמבקשים: נשלחה בקשה, אין תשובה",
  askFlowYes: "רק כשיגיד כן: זה אצלו",
  hasIt: (who) => `אצל ${who}`,
  confirmedFor: (when) => `אושר ל${when}`,
  prepTitle: "להכין",
  prepAdd: "הוספה",
  prepPlaceholder: "טופס להחזיר, משהו להביא",
  prepNone: "עוד אין מה להכין.",
  fromTheMessage: "מההודעה של הגן",
  historyTitle: "איך זה הגיע לכאן",
  historyKeeps: "ההיסטוריה נשארת עם התוכנית.",
  history: {
    added: (who) => `נוסף על ידי ${who}`,
    asked: (who, to) => `${who} ביקש מ${to}`,
    took: (who) => `${who} לקח`,
    accepted: (who, ver) => `${who} אמר כן, ${ver}`,
    declined: (who) => `${who} לא יכול לקחת`,
    changed: (old) => `הוזז מ${old}`,
    reminder_stopped: (old) => `התזכורת ל${old} נעצרה`,
    request_closed: "הבקשה הפתוחה נסגרה",
    prep_added: (who) => `${who} הוסיף משהו להכין`,
    done: (who) => `${who} סימן שבוצע`,
    cancelled: (who) => `${who} ביטל`,
    edited: (who) => `${who} ערך`,
  },
  markDone: "סימון שבוצע",
  cancelDate: "ביטול התאריך",
  editDate: "עריכה",
  versionLabel: (n) => `גרסה ${n}`,
  wasTime: (old) => `היה ${old}`,
  receipt: {
    added: (n) => (n === 1 ? "תאריך אחד נוסף לתוכנית" : `${n} תאריכים נוספו לתוכנית`),
    took: () => "זה אצלך",
    asked: () => "הבקשה נשלחה ב-Arbor",
    changed: () => "השינוי עודכן",
    done: () => "סומן שבוצע",
    cancelled: () => "התאריך בוטל",
    prep: () => "נוסף להכנה",
    edited: () => "התאריך נשמר",
    undone: () => "בוטל",
    kept_note: () => "נשמר כהכנה",
  },
  duplicatesSkipped: (n) => (n === 1 ? "אחד כבר היה בתוכנית" : `${n} כבר היו בתוכנית`),
  undo: "ביטול",
  saveError: "זה לא נשמר. נסו שוב.",
  retry: "לנסות שוב",
  loading: "טוען את התוכנית המשפחתית…",
  coTitle: "התוכנית המשפחתית",
  coAsksYou: (who) => `${who} מבקש ממך`,
  coTakeIt: "אני לוקח/ת",
  coCant: "לא יכול/ה",
  coYesMeans: "ה״כן״ שלך הוא לגרסה הזאת. אם הגן ישנה, תתבקש/י שוב.",
  coYesFor: (n) => `ה״כן״ שלך הוא לגרסה ${n}.`,
  coAddCalendar: "להוסיף ליומן שלי כשאני אומר/ת כן",
  coAnswered: (a) => a,
  coChanged: "התאריך השתנה מאז שביקשו ממך. זו הגרסה החדשה.",
  coNoRequests: "אין בקשות בשבילך כרגע.",
  coPlanTitle: "התאריכים של השבוע",
  coYouHaveIt: "זה אצלך",
  coMarkDone: "סימון שבוצע",
  coDoneSaved: "סומן שבוצע",
  coError: "זה לא נשמר. נסו שוב.",
  coUnavailable: "התוכנית המשפחתית לא זמינה כרגע.",
};

export const familyPlanCopy: Record<"en" | "he", FamilyPlanCopy> = { en, he };
