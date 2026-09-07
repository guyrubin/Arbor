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
  "elev.plans.hint":
    "Tap a step to move it on: not started → in progress → done. On a computer you can also drag steps between the columns.",

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
  "elev.plans.daysActive": "{n} days running",
};

export const he: Record<string, string> = {
  "elev.plans.col.todo": "טרם התחיל",
  "elev.plans.col.doing": "בתהליך",
  "elev.plans.col.done": "הושלם",

  "elev.plans.step.advance": "{step} — {status}. הקישו כדי לקדם.",
  "elev.plans.hint":
    "הקישו על צעד כדי לקדם אותו: טרם התחיל ← בתהליך ← הושלם. במחשב אפשר גם לגרור צעדים בין העמודות.",

  "elev.plans.edit.title": "עריכת צעד",
  "elev.plans.edit.label": "הצעד",
  "elev.plans.edit.save": "שמירה",
  "elev.plans.edit.cancel": "ביטול",

  "elev.plans.delete.title": "מחיקת תוכנית",
  "elev.plans.delete.cta": "מחיקת תוכנית",

  "elev.plans.focusIssue": "במוקד: {issue}",
  "elev.plans.daysActive": "{n} ימים בתוקף",
};
