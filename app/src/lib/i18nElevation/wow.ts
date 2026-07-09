/* i18nElevation/wow — E0 (hero-comic wow onboarding) strings.
 *
 * The 2-minute front-door chain for a NEW family: add child → optional comic
 * avatar → first hero-comic page → share / enter Arbor.
 *
 * CLINICAL FIREWALL: no numbers here at all except the plain step counter
 * ("step {step} of {total}") — never percentages, verdicts, or deltas.
 * Kid dark-pattern ban: no streaks, timers, or urgency language; the single
 * celebration line is calm and one-shot.
 * Hebrew = transcreation in a calm Israeli-parent register (outcome language,
 * no AI/tech framing); flagged for arbor-localization native review.
 * Truthful-claims rule: evidence line is research-anchored (CDC/AAP 2022) —
 * never "built with psychologists". */

export const en: Record<string, string> = {
  // ── Frame
  "elev.wow.eyebrow": "Welcome to Arbor",
  "elev.wow.dismiss": "Skip the tour",
  "elev.wow.stepOf": "Step {step} of {total}",
  "elev.wow.evidence": "Research-anchored — CDC/AAP 2022 milestones",

  // ── Step 1 · Add your child
  "elev.wow.child.title": "Let's meet your child",
  "elev.wow.child.sub": "A name and an age are enough — from there, Arbor starts turning small everyday moments into your family's story.",
  "elev.wow.child.cta": "Add your child",

  // ── Step 2 · Comic hero avatar (optional; consent lives inside the creator)
  "elev.wow.avatar.title": "Turn {name} into a comic hero",
  "elev.wow.avatar.sub": "Describe {name} in a few words, or start from a photo — your choice. The photo is used once to draw the character and is never stored.",
  "elev.wow.avatar.cta": "Create the hero",
  "elev.wow.avatar.skip": "Skip for now — Sprout will star instead",

  // ── Step 3 · First hero-comic page (calm preparing state)
  "elev.wow.comic.preparing": "Drawing {name}'s first page…",
  "elev.wow.comic.preparingSub": "A moment of quiet while the first adventure takes shape.",

  // ── Step 4 · Closing card
  "elev.wow.done.title": "{name}'s story has begun",
  "elev.wow.done.sub": "This is page one. From here, the small moments you notice each week become pages in a story that grows with {name}.",
  "elev.wow.done.alt": "{name}'s first hero-comic page",
  "elev.wow.done.enter": "Enter Arbor",
};

export const he: Record<string, string> = {
  "elev.wow.eyebrow": "ברוכים הבאים לארבור",
  "elev.wow.dismiss": "לדלג על הסיור",
  "elev.wow.stepOf": "שלב {step} מתוך {total}",
  "elev.wow.evidence": "מעוגן במחקר — אבני דרך CDC/AAP 2022",

  "elev.wow.child.title": "רגע להכיר את הילד שלכם",
  "elev.wow.child.sub": "שם וגיל — זה כל מה שצריך. מכאן ארבור מתחילה להפוך רגעים קטנים מהיומיום לסיפור המשפחתי שלכם.",
  "elev.wow.child.cta": "הוסיפו את הילד שלכם",

  "elev.wow.avatar.title": "הופכים את {name} לגיבור קומיקס",
  "elev.wow.avatar.sub": "אפשר לתאר את {name} בכמה מילים, או להתחיל מתמונה — הבחירה שלכם. התמונה משמשת פעם אחת לציור הדמות ולעולם לא נשמרת.",
  "elev.wow.avatar.cta": "צרו את הגיבור",
  "elev.wow.avatar.skip": "אפשר לדלג — נבט יככב בינתיים",

  "elev.wow.comic.preparing": "מציירים את העמוד הראשון של {name}…",
  "elev.wow.comic.preparingSub": "רגע של שקט — ההרפתקה הראשונה מקבלת צורה.",

  "elev.wow.done.title": "הסיפור של {name} יצא לדרך",
  "elev.wow.done.sub": "זהו עמוד ראשון. מכאן, הרגעים הקטנים שתשימו לב אליהם בכל שבוע יהפכו לעמודים בסיפור שגדל יחד עם {name}.",
  "elev.wow.done.alt": "עמוד הקומיקס הראשון של {name}",
  "elev.wow.done.enter": "להיכנס לארבור",
};
