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

  // Goal Builder (components/practice/GoalBuilderModal.tsx)
  "elev.goal.modal.status": "Your focus areas",
  "elev.goal.modal.pick": "Pick a focus for {name}",
  "elev.goal.modal.pickSub": "Choose 1 to 3. Activities on Daily Play will be matched to what you pick.",
  "elev.goal.modal.yourChild": "your child",
  "elev.goal.modal.remove": "Remove {goal}",
  "elev.goal.modal.obs.one": "1 observation linked",
  "elev.goal.modal.obs.many": "{n} observations linked",
  "elev.goal.modal.obs.none": "No observations linked yet",
  "elev.goal.modal.lastLinked": "Last linked: {when}",
  "elev.goal.modal.today": "today",
  "elev.goal.modal.yesterday": "yesterday",
  "elev.goal.modal.daysAgo": "{n} days ago",
  "elev.goal.modal.removeConfirm": "Remove “{goal}”?",
  "elev.goal.modal.removeYes": "Yes, remove",
  "elev.goal.modal.keep": "Keep it",
  "elev.goal.modal.addAnother": "Add another focus",
  "elev.goal.modal.obsHint": "Observations are linked automatically when you log a moment in the same area.",
  "elev.goal.modal.more.one": "Choose 1 more focus.",
  "elev.goal.modal.more.many": "Choose up to {n} more focuses.",
  "elev.goal.modal.cap": "You can set up to 3 focuses.",
  "elev.goal.modal.save.one": "Save 1 focus",
  "elev.goal.modal.save.many": "Save {n} focuses",
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

  "elev.goal.modal.status": "תחומי המיקוד שלכם",
  "elev.goal.modal.pick": "בחרו מיקוד בשביל {name}",
  "elev.goal.modal.pickSub": "בחרו בין 1 ל-3. הפעילויות במשחק היומי יותאמו למה שבחרתם.",
  "elev.goal.modal.yourChild": "הילד שלכם",
  "elev.goal.modal.remove": "להסיר את {goal}",
  "elev.goal.modal.obs.one": "תצפית אחת מקושרת",
  "elev.goal.modal.obs.many": "{n} תצפיות מקושרות",
  "elev.goal.modal.obs.none": "עדיין אין תצפיות מקושרות",
  "elev.goal.modal.lastLinked": "קושרה לאחרונה: {when}",
  "elev.goal.modal.today": "היום",
  "elev.goal.modal.yesterday": "אתמול",
  "elev.goal.modal.daysAgo": "לפני {n} ימים",
  "elev.goal.modal.removeConfirm": "להסיר את „{goal}”?",
  "elev.goal.modal.removeYes": "כן, להסיר",
  "elev.goal.modal.keep": "להשאיר",
  "elev.goal.modal.addAnother": "להוסיף מיקוד",
  "elev.goal.modal.obsHint": "תצפיות מתקשרות לבד כשאתם מתעדים רגע באותו תחום.",
  "elev.goal.modal.more.one": "אפשר לבחור עוד מיקוד אחד.",
  "elev.goal.modal.more.many": "אפשר לבחור עוד עד {n} תחומי מיקוד.",
  "elev.goal.modal.cap": "אפשר להגדיר עד 3 תחומי מיקוד.",
  "elev.goal.modal.save.one": "לשמור מיקוד אחד",
  "elev.goal.modal.save.many": "לשמור {n} תחומי מיקוד",
};
