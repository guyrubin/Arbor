/* i18nElevation/auth — the pre-wow front door: the value promise on the
 * login screen (the last surface untouched by the Elevation Wave). Copy =
 * the two independently-validated share anchors + the research line.
 * Truthful-claims rule: research-anchored only, never professional review. */

export const en: Record<string, string> = {
  // B-SHELL-15: companion-first. The promises lead with what a parent needs
  // on a hard day, then what Arbor keeps and notices, then the stories —
  // each one a thing that ships (Hard moment now, approved memory + "What
  // changed since you left", hero stories). Parent register; no child name
  // exists before sign-in.
  "elev.auth.headline": "A companion that knows your child",
  "elev.auth.p1": "A calm next step in a hard moment",
  "elev.auth.p2": "Remembers what you choose, and notices what changes",
  "elev.auth.p3": "Stories starring your child",
  "elev.auth.evidence": "Research-anchored · CDC/AAP 2022",

  // ── Builder F · MOB-21 · the avatar step's CTA said "Continue", which
  // promises the next step and delivers a modal instead. The label now names
  // what the tap actually does.
  "elev.auth.avatar.cta": "Create {name}'s hero",

  // B-SHELL-07: the first coach seed — model input, built in aiLang.
  "elev.auth.ob.seed": "{domain} is on my mind with {name} ({age}). Where should I start?",
};

export const he: Record<string, string> = {
  "elev.auth.headline": "מלווה שמכיר את הילד שלכם",
  "elev.auth.p1": "צעד הבא רגוע ברגע קשה",
  "elev.auth.p2": "זוכר את מה שתבחרו, ושם לב למה שמשתנה",
  "elev.auth.p3": "סיפורים שהילד שלכם מככב בהם",
  "elev.auth.evidence": "מבוסס מחקר · CDC/AAP 2022",

  // ── Builder F · MOB-21
  "elev.auth.avatar.cta": "ליצור את הגיבור של {name}",
  "elev.auth.ob.seed": "{domain} מעסיק אותי עם {name} ({age}). מאיפה כדאי להתחיל?",
};
