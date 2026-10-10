/* i18nElevation/goals — B-CAREPRO-29 (2 Oct): the parent's chosen goals.
 *
 * The eight curated GOAL_TILES (practice/goalBuilder.ts, clinical-lead
 * reviewed) were English-only, and Profile derived "what we're working on" from
 * an English regex over free-text challenges — a Hebrew family never matched.
 * Profile, the packet and the Goal Builder now read the parent's chosen
 * `activeGoals` through these keys. The STORED label stays English (the coach
 * context reads it, byte-identical); these keys are display only.
 *
 * Register: parent, calm, plural Israeli-parent address; behaviour/situation
 * nouns only — no condition names, no effect verbs (the goalBuilder lint list
 * applies to the Hebrew too).
 */

export const en: Record<string, string> = {
  "elev.goal.tile.following-instructions": "Following multi-step instructions",
  "elev.goal.tile.separation-settling": "Settling at drop-off / easing separations",
  "elev.goal.tile.taking-turns": "Taking turns and sharing",
  "elev.goal.tile.trying-new-foods": "Trying new foods",
  "elev.goal.tile.bedtime-wind-down": "Winding down at bedtime",
  "elev.goal.tile.big-feelings": "Naming and managing big feelings",
  "elev.goal.tile.early-talking": "Building early talking / back-and-forth",
  "elev.goal.tile.transitions": "Moving between activities more smoothly",

  // Profile · Who chapter
  "elev.goal.profile.title": "What we're working on",
  "elev.goal.profile.empty": "Choose what you're working on",
  "elev.goal.profile.edit": "Change",

  // One current choice; earlier goals and notes stay stored.
  "elev.goal.modal.status": "What we're working on",
  "elev.goal.modal.pick": "Choose one thing to work on with {name}",
  "elev.goal.modal.yourChild": "your child",
  "elev.goal.modal.obs.one": "1 observation linked",
  "elev.goal.modal.obs.many": "{n} observations linked",
  "elev.goal.modal.obs.none": "No observations linked yet",
  "elev.goal.modal.lastLinked": "Last linked: {when}",
  "elev.goal.modal.today": "today",
  "elev.goal.modal.yesterday": "yesterday",
  "elev.goal.modal.daysAgo": "{n} days ago",
  "elev.goal.modal.replace": "This replaces “{goal}” as what you're working on. Your notes stay.",
  "elev.goal.modal.keepNotes": "Earlier choices and all your notes stay saved.",
  "elev.goal.modal.earlier": "Earlier",
  "elev.goal.modal.makeCurrent": "Make this what we're working on",
  "elev.goal.modal.cancel": "Cancel",
  "elev.goal.modal.saving": "Saving…",
  "elev.goal.modal.saveError": "We couldn't confirm this was saved. Try again.",
  "elev.goal.modal.retry": "Try again",

};

export const he: Record<string, string> = {
  "elev.goal.tile.following-instructions": "ביצוע הוראות של כמה שלבים",
  "elev.goal.tile.separation-settling": "להיפרד בגן בקלות יותר",
  "elev.goal.tile.taking-turns": "לחכות לתור ולשתף",
  "elev.goal.tile.trying-new-foods": "לטעום מאכלים חדשים",
  "elev.goal.tile.bedtime-wind-down": "להירגע לקראת השינה",
  "elev.goal.tile.big-feelings": "לתת שם לרגשות גדולים ולהתמודד איתם",
  "elev.goal.tile.early-talking": "דיבור ראשון ושיחה הלוך ושוב",
  "elev.goal.tile.transitions": "לעבור בין פעילויות בצורה חלקה יותר",

  "elev.goal.profile.title": "על מה אנחנו עובדים",
  "elev.goal.profile.empty": "בחרו על מה אתם עובדים",
  "elev.goal.profile.edit": "לשנות",

  "elev.goal.modal.status": "על מה אנחנו עובדים",
  "elev.goal.modal.pick": "בחרו דבר אחד לעבוד עליו עם {name}",
  "elev.goal.modal.yourChild": "הילד שלכם",
  "elev.goal.modal.obs.one": "תצפית אחת מקושרת",
  "elev.goal.modal.obs.many": "{n} תצפיות מקושרות",
  "elev.goal.modal.obs.none": "עדיין אין תצפיות מקושרות",
  "elev.goal.modal.lastLinked": "קושרה לאחרונה: {when}",
  "elev.goal.modal.today": "היום",
  "elev.goal.modal.yesterday": "אתמול",
  "elev.goal.modal.daysAgo": "לפני {n} ימים",
  "elev.goal.modal.replace": "הבחירה הזאת מחליפה את „{goal}” כדבר שאתם עובדים עליו. התיעוד שלכם נשאר.",
  "elev.goal.modal.keepNotes": "הבחירות הקודמות וכל התיעוד שלכם נשארים שמורים.",
  "elev.goal.modal.earlier": "בחירות קודמות",
  "elev.goal.modal.makeCurrent": "לבחור בזה כדבר שאנחנו עובדים עליו",
  "elev.goal.modal.cancel": "לבטל",
  "elev.goal.modal.saving": "שומרים…",
  "elev.goal.modal.saveError": "לא הצלחנו לאשר שהבחירה נשמרה. נסו שוב.",
  "elev.goal.modal.retry": "לנסות שוב",

};
