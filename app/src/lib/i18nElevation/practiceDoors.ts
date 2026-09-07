/* i18nElevation/practiceDoors — the PARENT doors of the practice suite.
 *
 * OBJ-PRACTICE-02 / §3f: `JourneyTab` was ~90 % hardcoded English ("This week",
 * "Mark done", "Achievements", "Historical progression", the objectives
 * explainer…), and the Practice Studio launcher printed the ten Kid-Mode world
 * NAMES as English literals ("Sound Lab", "Mind Vault") on a Hebrew door. A key
 * that never existed cannot fall back — a Hebrew parent simply read English.
 *
 * Also home to the two DISCLOSURE labels §3f row 2 introduced when the speech
 * and feelings doors were brought inside their module budgets: the demoted
 * capability keeps a door, and the door needs a name in both languages.
 *
 * Register: parent — calm, explanatory, counts never verdicts (law 1). The kid
 * world names are the CHILD's vocabulary, kept so parent and child share one
 * word for the same place; they are transcreated, not transliterated.
 *
 * Hebrew = transcreation in a calm Israeli-parent register; flagged for
 * arbor-localization native review.
 */

export const en: Record<string, string> = {
  /* ── Practice Studio launcher (PracticeStudioTab) ───────────────────────── */
  // The Kid-Mode world each parent tile opens. Shared vocabulary: the word the
  // child uses for that place, so a parent can say "go to Sound Lab".
  "elev.practice.world.kid.speech": "Sound Lab",
  "elev.practice.world.kid.words": "Word World",
  "elev.practice.world.kid.feelings": "Mood Mountain",
  "elev.practice.world.kid.mimic": "Mimic Studio",
  "elev.practice.world.kid.adventures": "Story Quest",
  "elev.practice.world.kid.memory": "Mind Vault",
  "elev.practice.world.kid.reading": "Spell Forge",
  "elev.practice.world.kid.rhythm": "Beat Keeper",
  "elev.practice.world.kid.movement": "Hero Pose",
  "elev.practice.world.kid.logic": "Pattern Power",

  /* ── Development Journey (JourneyTab) ───────────────────────────────────── */
  "elev.practice.journey.activeDays": "Active practice days this week",
  "elev.practice.journey.objectivesDone": "Monthly objectives done",
  "elev.practice.journey.badgesLabel": "Effort badges earned",
  "elev.practice.journey.week.title": "This week",
  "elev.practice.journey.week.today": "Today",
  "elev.practice.journey.mission.done": "Done",
  "elev.practice.journey.mission.markDone": "Mark done",
  "elev.practice.journey.extra": "Aimed extra",
  "elev.practice.journey.objectives.title": "{month} objectives",
  "elev.practice.journey.objectives.start": "Start these",
  "elev.practice.journey.objectives.note":
    "Objectives follow the areas your own goals point to — coaching targets, not clinical goals.",
  "elev.practice.journey.objectives.completed": "Completed",
  "elev.practice.journey.objectives.tap": "Tap to mark complete",
  "elev.practice.journey.achievements.title": "Achievements",
  "elev.practice.journey.history.title": "Historical progression",
  "elev.practice.journey.history.empty":
    "Arbor keeps one weekly snapshot once practice data loads — a count of how many milestones you have noticed in each domain. It is historical context and a conversation starter, never a diagnostic chart.",
  "elev.practice.journey.history.noticed": "noticed",

  /* ── Demoted capability doors (§3f row 2, module budgets) ───────────────── */
  // Speech: Words & Express and Early reading are separate capabilities that
  // were competing with the sound drill for the top of the page.
  "elev.practice.speech.more": "More language practice",
  "elev.practice.speech.more.sub": "Vocabulary, expressive language and early reading — open when you want them.",
  // Feelings: the emotion library and the calm-down drills are reference, not
  // tonight's move. The scenario is the move.
  "elev.practice.feelings.match.title": "Emotion match",
  "elev.practice.feelings.why.title": "Why feelings happen",
  "elev.practice.feelings.calm.title": "Calm-down practice",
  "elev.practice.feelings.toolkit": "Feelings toolkit",
  "elev.practice.feelings.toolkit.sub": "Why each feeling happens, and calm-down practice to run on a good day.",
  // The quiet counts line that replaced three stat bubbles above the drill.
  "elev.practice.feelings.counts": "{rounds} feeling rounds · {calm} calm practices",

  /* ── Stories door (#/stories parent branch, §3f rows 3–4) ───────────────── */
  // Lives here rather than in a module of its own: this file is the "parent
  // doors" dictionary, and #/stories is the last of them. One evening, one
  // story — the shelf is what you browse AFTER tonight is settled.
  "elev.stories.tonight.eyebrow": "Tonight's story",
  "elev.stories.tonight.cta": "Read it together",
  "elev.stories.sub": "One story for tonight, starring {name}. The whole shelf is below when you want it.",
  "elev.stories.counts.stories": "{n} stories read together",
  "elev.stories.catalogue.title": "Choose a different story",
  "elev.stories.library.title": "Your library",
  "elev.stories.reader.back": "All journeys",
  "elev.stories.reader.immersive": "Immersive",
};

export const he: Record<string, string> = {
  "elev.practice.world.kid.speech": "מעבדת הצלילים",
  "elev.practice.world.kid.words": "עולם המילים",
  "elev.practice.world.kid.feelings": "הר הרגשות",
  "elev.practice.world.kid.mimic": "אולפן החיקוי",
  "elev.practice.world.kid.adventures": "מסע הסיפור",
  "elev.practice.world.kid.memory": "כספת הזיכרון",
  "elev.practice.world.kid.reading": "נפחיית האותיות",
  "elev.practice.world.kid.rhythm": "שומר הקצב",
  "elev.practice.world.kid.movement": "תנוחת הגיבור",
  "elev.practice.world.kid.logic": "כוח התבניות",

  "elev.practice.journey.activeDays": "ימי תרגול פעילים השבוע",
  "elev.practice.journey.objectivesDone": "יעדים חודשיים שהושלמו",
  "elev.practice.journey.badgesLabel": "עיטורי התמדה שנצברו",
  "elev.practice.journey.week.title": "השבוע",
  "elev.practice.journey.week.today": "היום",
  "elev.practice.journey.mission.done": "בוצע",
  "elev.practice.journey.mission.markDone": "סימון כבוצע",
  "elev.practice.journey.extra": "תוספת ממוקדת",
  "elev.practice.journey.objectives.title": "יעדים ל-{month}",
  "elev.practice.journey.objectives.start": "מתחילים",
  "elev.practice.journey.objectives.note":
    "היעדים נגזרים מהתחומים שהמטרות שלכם מכוונות אליהם — יעדי ליווי, לא יעדים קליניים.",
  "elev.practice.journey.objectives.completed": "הושלם",
  "elev.practice.journey.objectives.tap": "הקישו לסימון כהושלם",
  "elev.practice.journey.achievements.title": "עיטורים",
  "elev.practice.journey.history.title": "מבט לאחור",
  "elev.practice.journey.history.empty":
    "ארבור שומר תמונת מצב שבועית אחת ברגע שנצבר תרגול — ספירה של כמה אבני דרך שמתם לב אליהן בכל תחום. זהו הקשר היסטורי ופתח לשיחה, לעולם לא גרף אבחוני.",
  "elev.practice.journey.history.noticed": "שמתם לב",

  "elev.practice.speech.more": "עוד תרגול שפה",
  "elev.practice.speech.more.sub": "אוצר מילים, שפה מבעית וקריאה ראשונה — נפתח כשמתאים לכם.",
  "elev.practice.feelings.match.title": "התאמת רגשות",
  "elev.practice.feelings.why.title": "למה רגשות קורים",
  "elev.practice.feelings.calm.title": "תרגול הרגעה",
  "elev.practice.feelings.toolkit": "ארגז הכלים הרגשי",
  "elev.practice.feelings.toolkit.sub": "למה כל רגש מופיע, ותרגולי הרגעה לתרגל ביום טוב.",
  "elev.practice.feelings.counts": "{rounds} סבבי רגשות · {calm} תרגולי הרגעה",

  "elev.stories.tonight.eyebrow": "הסיפור של הערב",
  "elev.stories.tonight.cta": "קוראים יחד",
  "elev.stories.sub": "סיפור אחד לערב, בכיכוב {name}. כל המדף מחכה מתחת כשתרצו.",
  "elev.stories.counts.stories": "{n} סיפורים שקראתם יחד",
  "elev.stories.catalogue.title": "בחירת סיפור אחר",
  "elev.stories.library.title": "הספרייה שלכם",
  "elev.stories.reader.back": "כל המסעות",
  "elev.stories.reader.immersive": "מסך מלא",
};
