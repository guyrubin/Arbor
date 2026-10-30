/* i18nElevation/auth — the pre-wow front door: the value promise on the
 * login screen (the last surface untouched by the Elevation Wave). Copy =
 * the two independently-validated share anchors + the research line.
 * Truthful-claims rule: research-anchored only, never professional review. */

export const en: Record<string, string> = {
  "elev.auth.trial.headline": "Your next useful moment starts here.",
  "elev.auth.trial.promise": "New to Arbor? Your account starts with 14 days of Plus. No card needed.",
  "elev.auth.trial.steps": "Create your account. Add your child with your consent. Choose a small step for today.",
  "elev.auth.trial.existing": "Already have an account? Sign in to continue with your current access.",
  "elev.auth.trial.setup": "Let’s make Arbor yours. Add your child, then choose one thing on your mind. The examples you explored have not been saved to this profile.",
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

  // B-RESID-05: new families create an account with e-mail (Google stays);
  // the invite-only line and its access request are gone (Guy, 11 Oct default).
  "elev.auth.signup.cta": "Create account",
  "elev.auth.signup.toSignup": "New to Arbor? Create an account",
  "elev.auth.signup.toSignin": "Already have an account? Sign in",
  "elev.auth.signup.passwordHint": "At least 6 characters",
  "elev.auth.signup.verifySent": "Account created. We sent a link to confirm your email.",
};

export const he: Record<string, string> = {
  "elev.auth.trial.headline": "הרגע המועיל הבא שלכם מתחיל כאן.",
  "elev.auth.trial.promise": "חדשים ב-Arbor? החשבון מתחיל עם 14 ימים של Plus. בלי כרטיס אשראי.",
  "elev.auth.trial.steps": "פותחים חשבון. מוסיפים את הילד בהסכמתכם. בוחרים צעד קטן להיום.",
  "elev.auth.trial.existing": "כבר יש לכם חשבון? התחברו כדי להמשיך עם הגישה הקיימת שלכם.",
  "elev.auth.trial.setup": "בואו נתאים את Arbor למשפחה שלכם. מוסיפים את הילד ואז בוחרים דבר אחד שמעסיק אתכם. הדוגמאות שראיתם לא נשמרו בפרופיל הזה.",
  "elev.auth.headline": "מלווה שמכיר את הילד שלכם",
  "elev.auth.p1": "צעד הבא רגוע ברגע קשה",
  "elev.auth.p2": "זוכר את מה שתבחרו, ושם לב למה שמשתנה",
  "elev.auth.p3": "סיפורים שהילד שלכם מככב בהם",
  "elev.auth.evidence": "מבוסס מחקר · CDC/AAP 2022",

  // ── Builder F · MOB-21
  "elev.auth.avatar.cta": "ליצור את הגיבור של {name}",
  "elev.auth.ob.seed": "{domain} מעסיק אותי עם {name} ({age}). מאיפה כדאי להתחיל?",

  "elev.auth.signup.cta": "יצירת חשבון",
  "elev.auth.signup.toSignup": "חדשים בארבור? יצירת חשבון",
  "elev.auth.signup.toSignin": "כבר יש לכם חשבון? התחברות",
  "elev.auth.signup.passwordHint": "6 תווים לפחות",
  "elev.auth.signup.verifySent": "החשבון נוצר. שלחנו קישור לאישור הדוא״ל.",
};
