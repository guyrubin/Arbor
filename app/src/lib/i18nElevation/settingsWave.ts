/* i18nElevation/settingsWave — Wave S+L lane B: Settings About section
 * (MOB-20/CR-19/RUN-17), the one ChildAgeField (MOB-11), first-run i18n
 * (MOB-10), the avatar CTA + consolidated consent block (MOB-21/MOB-27) and
 * push priming (MOB-19/ENG-23).
 *
 * Every key is namespaced "elev.settingsWave.*" (base dictionaries win on
 * merge). Consent copy is snapshot-pinned in consentCopy.test.ts — it may
 * grow, never shrink. Push copy states the enforced contract only (max 2 a
 * day, quiet hours, never the child by name) — AADC: no guilt, no streaks.
 */

export const en: Record<string, string> = {
  // ── MOB-20 / CR-19 / RUN-17 — Settings ──────────────────────────────────
  "elev.settingsWave.about.title": "About",
  "elev.settingsWave.about.sub": "Version, support, and your data.",
  "elev.settingsWave.about.version": "App version",
  "elev.settingsWave.about.version.web": "Arbor {version}",
  "elev.settingsWave.about.version.native": "Arbor {version} · build {build}",
  "elev.settingsWave.about.support": "Support",
  "elev.settingsWave.about.support.sub": "We read every message — usually answered within 2 business days.",
  "elev.settingsWave.about.support.email": "Email support",
  "elev.settingsWave.about.support.page": "Help page",
  "elev.settingsWave.about.legal": "Privacy & terms",
  "elev.settingsWave.about.legal.sub": "What Arbor stores, and the rules we follow.",
  "elev.settingsWave.about.export": "Export my data",
  "elev.settingsWave.about.export.sub": "Download {name}'s full record as a file you keep.",
  "elev.settingsWave.about.export.cta": "Export",
  "elev.settingsWave.about.exported": "Data exported",
  "elev.settingsWave.about.exportFail": "Couldn't export right now — please try again.",
  "elev.settingsWave.about.delete": "Delete account",
  "elev.settingsWave.about.delete.sub": "Removes your account and every child record — permanently.",
  "elev.settingsWave.about.delete.cta": "Delete…",
  "elev.settingsWave.notif.open": "Open Gentle Reminders",
  "elev.settingsWave.language.applied": "Applies as soon as you tap.",

  // ── MOB-11 — the one child-age field ────────────────────────────────────
  "elev.settingsWave.age.dob": "Date of birth",
  "elev.settingsWave.age.dob.hint": "Keeps milestones, checks, and picks exactly in step with {name}'s age. Never shown in stories.",
  "elev.settingsWave.age.dob.missing": "Add the birthday, or enter the age instead.",
  "elev.settingsWave.age.notSure": "Not sure — enter the age instead",
  "elev.settingsWave.age.useDob": "Enter the birthday instead",
  "elev.settingsWave.age.years.less": "One year less",
  "elev.settingsWave.age.years.more": "One year more",
  "elev.settingsWave.age.months.less": "One month less",
  "elev.settingsWave.age.months.more": "One month more",
  "elev.settingsWave.age.newborn": "Newborn",
  "elev.settingsWave.age.childFallback": "your child",

  // ── MOB-10 — first-run speaks the parent's language ─────────────────────
  "elev.settingsWave.ob.coachSeed": "{domain} is on my mind with {name} ({age}). Where should I start?",
  "elev.settingsWave.auth.accessFail": "Couldn't record the request. Please email {email}.",

  // ── MOB-21 — the step-4 CTA says what it does ────────────────────────────
  "elev.settingsWave.ob.avatar.cta": "Create {name}'s hero",
  "elev.settingsWave.ob.avatar.skip": "Use Sprout for now",

  // ── MOB-27 — ONE consent block (three plain lines + the AI note) ─────────
  "elev.settingsWave.consent.line.info": "Your child's name and age — so guidance, stories, and checks fit their stage.",
  "elev.settingsWave.consent.line.photo": "An optional photo, only to draw a character — used once, never stored. You choose that later.",
  "elev.settingsWave.consent.line.voice": "Optional voice practice — recordings are used for that exercise only and are not kept.",

  // ── MOB-19 / ENG-23 — push priming + honest availability ────────────────
  "elev.settingsWave.push.section": "Delivery",
  "elev.settingsWave.push.title": "Reminders on your phone",
  "elev.settingsWave.push.sub": "The same gentle nudges, delivered as phone notifications.",
  "elev.settingsWave.push.prime.title": "Before your phone asks",
  "elev.settingsWave.push.prime.body": "At most 2 a day, never in quiet hours, never about {name} by name.",
  "elev.settingsWave.push.prime.cta": "Enable",
  "elev.settingsWave.push.prime.later": "Not now",
  "elev.settingsWave.push.unavailable": "Phone notifications aren't available in this build yet — reminders still appear in the app bell.",
  "elev.settingsWave.push.on": "Phone notifications are on.",
  "elev.settingsWave.push.off": "Phone notifications are off.",
  "elev.settingsWave.push.denied": "Your phone blocked notifications. You can allow them in your phone's settings.",
};

export const he: Record<string, string> = {
  "elev.settingsWave.about.title": "אודות",
  "elev.settingsWave.about.sub": "גרסה, תמיכה והנתונים שלכם.",
  "elev.settingsWave.about.version": "גרסת האפליקציה",
  "elev.settingsWave.about.version.web": "ארבור {version}",
  "elev.settingsWave.about.version.native": "ארבור {version} · build {build}",
  "elev.settingsWave.about.support": "תמיכה",
  "elev.settingsWave.about.support.sub": "אנחנו קוראים כל הודעה — בדרך כלל עונים תוך יומיים עסקים.",
  "elev.settingsWave.about.support.email": "שלחו מייל לתמיכה",
  "elev.settingsWave.about.support.page": "דף עזרה",
  "elev.settingsWave.about.legal": "פרטיות ותנאים",
  "elev.settingsWave.about.legal.sub": "מה ארבור שומרת, ולפי אילו כללים אנחנו פועלים.",
  "elev.settingsWave.about.export": "ייצוא הנתונים שלי",
  "elev.settingsWave.about.export.sub": "הורדת הרשומה המלאה של {name} כקובץ שנשאר אצלכם.",
  "elev.settingsWave.about.export.cta": "ייצוא",
  "elev.settingsWave.about.exported": "הנתונים יוצאו",
  "elev.settingsWave.about.exportFail": "לא הצלחנו לייצא כרגע — נסו שוב.",
  "elev.settingsWave.about.delete": "מחיקת חשבון",
  "elev.settingsWave.about.delete.sub": "מוחקת את החשבון ואת כל רשומות הילדים — לצמיתות.",
  "elev.settingsWave.about.delete.cta": "מחיקה…",
  "elev.settingsWave.notif.open": "פתיחת תזכורות עדינות",
  "elev.settingsWave.language.applied": "מוחל מיד עם הלחיצה.",

  "elev.settingsWave.age.dob": "תאריך לידה",
  "elev.settingsWave.age.dob.hint": "שומר את אבני הדרך, הבדיקות והבחירות מתואמות בדיוק לגיל של {name}. לעולם לא מופיע בסיפורים.",
  "elev.settingsWave.age.dob.missing": "הוסיפו תאריך לידה, או הזינו גיל במקום.",
  "elev.settingsWave.age.notSure": "לא בטוחים — הזינו גיל במקום",
  "elev.settingsWave.age.useDob": "הזינו תאריך לידה במקום",
  "elev.settingsWave.age.years.less": "שנה פחות",
  "elev.settingsWave.age.years.more": "שנה יותר",
  "elev.settingsWave.age.months.less": "חודש פחות",
  "elev.settingsWave.age.months.more": "חודש יותר",
  "elev.settingsWave.age.newborn": "תינוק/ת",
  "elev.settingsWave.age.childFallback": "הילד/ה שלכם",

  "elev.settingsWave.ob.coachSeed": "{domain} מעסיק אותי אצל {name} ({age}). מאיפה כדאי להתחיל?",
  "elev.settingsWave.auth.accessFail": "לא הצלחנו לשמור את הבקשה. אפשר לכתוב אל {email}.",

  "elev.settingsWave.ob.avatar.cta": "יצירת הגיבור/ה של {name}",
  "elev.settingsWave.ob.avatar.skip": "להמשיך עם ספראוט בינתיים",

  "elev.settingsWave.consent.line.info": "השם והגיל של הילד/ה — כדי שההכוונה, הסיפורים והבדיקות יתאימו לשלב שלו/ה.",
  "elev.settingsWave.consent.line.photo": "תמונה, לבחירתכם, רק כדי לצייר דמות — בשימוש חד-פעמי, לא נשמרת. את זה תחליטו בהמשך.",
  "elev.settingsWave.consent.line.voice": "תרגול דיבור, לבחירתכם — ההקלטות משמשות רק לאותו תרגיל ואינן נשמרות.",

  "elev.settingsWave.push.section": "אופן המסירה",
  "elev.settingsWave.push.title": "תזכורות בטלפון",
  "elev.settingsWave.push.sub": "אותן תזכורות עדינות, כהתראות בטלפון.",
  "elev.settingsWave.push.prime.title": "לפני שהטלפון ישאל",
  "elev.settingsWave.push.prime.body": "לכל היותר 2 ביום, אף פעם לא בשעות השקט, ואף פעם לא על {name} בשם.",
  "elev.settingsWave.push.prime.cta": "הפעלה",
  "elev.settingsWave.push.prime.later": "לא עכשיו",
  "elev.settingsWave.push.unavailable": "התראות בטלפון עדיין לא זמינות בגרסה הזו — התזכורות ממשיכות להופיע בפעמון שבאפליקציה.",
  "elev.settingsWave.push.on": "התראות בטלפון פועלות.",
  "elev.settingsWave.push.off": "התראות בטלפון כבויות.",
  "elev.settingsWave.push.denied": "הטלפון חסם התראות. אפשר לאפשר אותן בהגדרות הטלפון.",
};
