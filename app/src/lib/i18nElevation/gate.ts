/* i18nElevation/gate — E10 (kid-gate parent challenge + launcher safety line)
 * and E11 (first-steps rail) strings.
 *
 * CLINICAL FIREWALL: the only numbers below are plain counts ("{count} of
 * {total} done") — never percentages, verdicts, or trend deltas.
 * Hebrew = transcreation in a calm Israeli-parent register (outcome language,
 * no AI/tech framing); flagged for arbor-localization native review.
 * Kid dark-pattern ban: no streaks, no timers, no urgency language anywhere. */

export const en: Record<string, string> = {
  // ── E10 · Parent challenge (summoned by the 3s hold on kid-mode exit)
  "elev.gate.title": "A question for a grown-up",
  "elev.gate.sub": "Answer to go back to the parent area.",
  "elev.gate.mathAria": "Parent question: what is {a} plus {b}?",
  "elev.gate.answerAria": "Your answer",
  "elev.gate.confirm": "Confirm",
  "elev.gate.wrong": "Not quite — here's a fresh one.",
  "elev.gate.stay": "Stay in Kid Mode",
  "elev.gate.pinTitle": "Parent PIN",
  "elev.gate.pinSub": "Enter your 4-digit PIN to go back to the parent area.",
  "elev.gate.pinAria": "4-digit parent PIN",
  "elev.gate.pinWrong": "That PIN doesn't match.",
  "elev.gate.useMath": "Answer a question instead",
  "elev.gate.setPinToggle": "Set a parent PIN for next time (optional)",
  "elev.gate.setPinAria": "New 4-digit parent PIN",
  "elev.gate.setPinHint": "Saved on this device only — never with your child's data.",

  // ── E10 · Parent-side launcher safety line (ships true with the gate)
  "elev.kidmode.locked": "Parent-locked — your child can't exit or delete",

  // ── E11 · First-steps rail (parent-side, dismissible, counts only)
  "elev.rail.title": "First steps with Arbor",
  "elev.rail.sub": "Four small steps and the story is underway.",
  "elev.rail.progress": "{count} of {total} done",
  "elev.rail.dismiss": "Hide this checklist",
  "elev.rail.stepDone": "Done",
  "elev.rail.step.child": "Add your child",
  // W6.1: replaces the always-pre-checked child tile (onboarding already did it).
  "elev.rail.step.avatar": "Create {name}'s hero",
  "elev.rail.step.coach": "Meet the coach",
  "elev.rail.step.capture": "Capture a moment",
  "elev.rail.step.comic": "Create the first comic",
};

export const he: Record<string, string> = {
  "elev.gate.title": "שאלה למבוגרים",
  "elev.gate.sub": "עונים — וחוזרים לאזור ההורים.",
  "elev.gate.mathAria": "שאלה להורה: כמה זה {a} ועוד {b}?",
  "elev.gate.answerAria": "התשובה שלכם",
  "elev.gate.confirm": "אישור",
  "elev.gate.wrong": "לא מדויק — הנה שאלה חדשה.",
  "elev.gate.stay": "להישאר במצב ילדים",
  "elev.gate.pinTitle": "קוד הורים",
  "elev.gate.pinSub": "הקלידו את הקוד בן 4 הספרות כדי לחזור לאזור ההורים.",
  "elev.gate.pinAria": "קוד הורים בן 4 ספרות",
  "elev.gate.pinWrong": "הקוד לא תואם.",
  "elev.gate.useMath": "אפשר גם לענות על שאלה",
  "elev.gate.setPinToggle": "רוצים קוד הורים לפעם הבאה? (לא חובה)",
  "elev.gate.setPinAria": "קוד הורים חדש בן 4 ספרות",
  "elev.gate.setPinHint": "נשמר במכשיר הזה בלבד — אף פעם לא עם המידע של הילד.",

  "elev.kidmode.locked": "נעול להורים — הילד לא יכול לצאת או למחוק",

  "elev.rail.title": "צעדים ראשונים עם ארבור",
  "elev.rail.sub": "ארבעה צעדים קטנים — והסיפור יוצא לדרך.",
  "elev.rail.progress": "{count} מתוך {total} הושלמו",
  "elev.rail.dismiss": "להסתיר את הרשימה",
  "elev.rail.stepDone": "בוצע",
  "elev.rail.step.child": "הוסיפו את הילד שלכם",
  "elev.rail.step.avatar": "צרו את הגיבור של {name}",
  "elev.rail.step.coach": "הכירו את המאמן",
  "elev.rail.step.capture": "תעדו רגע אחד",
  "elev.rail.step.comic": "צרו את הקומיקס הראשון",
};
