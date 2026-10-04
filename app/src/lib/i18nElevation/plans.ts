/* i18nElevation/plans — TJB-16: the action-plan board, in both locales.
 *
 * The board's primary move is "advance a plan step". It used to be drag-only
 * (PointerSensor, distance 4) with a hover-revealed 12x12 pencil, window.prompt
 * for edit and window.confirm for delete — none of which a parent can operate
 * on a phone. Its column labels and its one instruction sentence were bare
 * English literals, so a Hebrew-speaking parent read an English board.
 *
 * Every value here is a COUNT or an instruction. The board carried a 43 %
 * completion ring and bar; a plan the parent is running is reported as
 * "{done}/{total} steps done" (the base key `plan.stepsCount`), never a share.
 *
 * HE is transcreated, calm-parent register — not a machine translation.
 */

export const en: Record<string, string> = {
  // ── Columns (the three step statuses)
  "elev.plans.col.todo": "Not started",
  "elev.plans.col.doing": "In progress",
  "elev.plans.col.done": "Done",

  // ── The step control: one tap moves a step on by one status
  "elev.plans.step.advance": "{step} — {status}. Tap to move it on.",
  "elev.plans.hint": "Tap a step's circle to move it on: not started → in progress → done.",

  // ── Edit a step (was window.prompt)
  "elev.plans.edit.title": "Edit step",
  "elev.plans.edit.label": "Step",
  "elev.plans.edit.save": "Save",
  "elev.plans.edit.cancel": "Cancel",

  // ── Delete a plan (was window.confirm)
  "elev.plans.delete.title": "Delete plan",
  "elev.plans.delete.cta": "Delete plan",

  // ── Board header
  "elev.plans.focusIssue": "Focus: {issue}",
  // B-ASKJB-26: days since creation, said as such (was "{n} days running").
  "elev.plans.startedAgo": "Started {n} days ago",
  "elev.plans.startedToday": "Started today",
  "elev.plans.steps.title": "Steps",
  // B-ASKJB-28: the one quiet routines row below the active plan.
  "elev.plans.routines.row": "Your routines ({n})",
  "elev.plans.routines.add": "Add a routine",

  // ── B-ASKJB-26: today's step, through the action loop
  "elev.plans.today.eyebrow": "From your plan",
  "elev.plans.today.day": "Day {n} of {plan}",
  "elev.plans.today.first": "Today's step · {plan}",
  "elev.plans.today.chip": "Today",
  // B-ASKJB-NEW-1g/1h: the track card speaks back to the last outcome.
  "elev.plans.echo.helped.yesterday": "Yesterday “{step}” helped {name}. Today, one small step more.",
  "elev.plans.echo.helped.last": "Last time “{step}” helped {name}. Today, one small step more.",
  "elev.plans.echo.somewhat.yesterday": "Yesterday “{step}” helped a little. Today, one small step more.",
  "elev.plans.echo.somewhat.last": "Last time “{step}” helped a little. Today, one small step more.",
  "elev.plans.echo.notYetTwice": "Twice not yet. Change this step?",
  "elev.plans.echo.first": "{name}'s first step starts today.",
  "elev.plans.echo.progress.one": "One step done with {name} so far. Today, one small step more.",
  "elev.plans.echo.progress.many": "{n} steps done with {name} so far. Today, one small step more.",
  "elev.plans.today.next": "Or try the next step instead",
  // ── B-ASKJB-26: the weekly check-in (the parent's answer, never a score)
  "elev.plans.check.q": "Signs it's working?",
  "elev.plans.check.yes": "Yes",
  "elev.plans.check.little": "A little",
  "elev.plans.check.not_yet": "Not yet",
  "elev.plans.check.signs": "What to look for:",
  "elev.plans.check.saved": "Noted. We'll ask again in a week.",
  "elev.plans.adjust": "Adjust the plan in Ask",
  "elev.plans.adjust.seed": "Help me adjust our plan \"{title}\". Two weekly check-ins in a row said it isn't working yet.{outcomes}",
  "elev.plans.adjust.outcomes": " Recent steps: {list}.",
  "elev.plans.outcome.helped": "helped",
  "elev.plans.outcome.somewhat": "helped a little",
  "elev.plans.outcome.not_today": "not today",
};

export const he: Record<string, string> = {
  "elev.plans.col.todo": "טרם התחיל",
  "elev.plans.col.doing": "בתהליך",
  "elev.plans.col.done": "הושלם",

  "elev.plans.step.advance": "{step} — {status}. הקישו כדי לקדם.",
  "elev.plans.hint": "הקישו על העיגול של צעד כדי לקדם אותו: טרם התחיל ← בתהליך ← הושלם.",

  "elev.plans.edit.title": "עריכת צעד",
  "elev.plans.edit.label": "הצעד",
  "elev.plans.edit.save": "שמירה",
  "elev.plans.edit.cancel": "ביטול",

  "elev.plans.delete.title": "מחיקת תוכנית",
  "elev.plans.delete.cta": "מחיקת תוכנית",

  "elev.plans.focusIssue": "במוקד: {issue}",
  "elev.plans.startedAgo": "התחלתם לפני {n} ימים",
  "elev.plans.startedToday": "התחלתם היום",
  "elev.plans.steps.title": "הצעדים",
  "elev.plans.routines.row": "השגרות שלכם ({n})",
  "elev.plans.routines.add": "הוספת שגרה",

  "elev.plans.today.eyebrow": "מתוך התוכנית שלכם",
  "elev.plans.today.day": "יום {n} בתוכנית {plan}",
  "elev.plans.today.first": "הצעד של היום · {plan}",
  "elev.plans.today.chip": "היום",
  "elev.plans.echo.helped.yesterday": "אתמול „{step}” עזר ל{name}. היום — עוד צעד קטן.",
  "elev.plans.echo.helped.last": "בפעם הקודמת „{step}” עזר ל{name}. היום — עוד צעד קטן.",
  "elev.plans.echo.somewhat.yesterday": "אתמול „{step}” עזר קצת. היום — עוד צעד קטן.",
  "elev.plans.echo.somewhat.last": "בפעם הקודמת „{step}” עזר קצת. היום — עוד צעד קטן.",
  "elev.plans.echo.notYetTwice": "פעמיים עדיין לא. לשנות את הצעד?",
  "elev.plans.echo.first": "הצעד הראשון של {name} מתחיל היום.",
  "elev.plans.echo.progress.one": "כבר צעד אחד עם {name}. היום — עוד צעד קטן.",
  "elev.plans.echo.progress.many": "כבר {n} צעדים עם {name}. היום — עוד צעד קטן.",
  "elev.plans.today.next": "או לנסות במקום זה את הצעד הבא",
  "elev.plans.check.q": "יש סימנים שזה עובד?",
  "elev.plans.check.yes": "כן",
  "elev.plans.check.little": "קצת",
  "elev.plans.check.not_yet": "עדיין לא",
  "elev.plans.check.signs": "למה לשים לב:",
  "elev.plans.check.saved": "נרשם. נשאל שוב בעוד שבוע.",
  "elev.plans.adjust": "לכוונן את התוכנית עם ארבור",
  "elev.plans.adjust.seed": "עזרו לי לכוונן את התוכנית שלנו \"{title}\". בשתי הבדיקות השבועיות האחרונות עוד לא ראינו שזה עובד.{outcomes}",
  "elev.plans.adjust.outcomes": " הצעדים האחרונים: {list}.",
  "elev.plans.outcome.helped": "עזר",
  "elev.plans.outcome.somewhat": "עזר קצת",
  "elev.plans.outcome.not_today": "לא היום",
};
