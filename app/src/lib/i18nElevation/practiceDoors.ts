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

  /* ── Builder L · R23 · the Development Journey's own CONTENT ──────────────
   * OBJ-PRACTICE-02 keyed JourneyTab's chrome and left the strings the page is
   * actually made of — the day missions, the aimed extras and the monthly
   * objectives — as English data in `practice/journey.ts` and
   * `practice/content.ts`. #/journey measured 32 Latin lines under lang=he.
   * Register: parent, effort targets only (KID-17) — days, rounds, moments;
   * never an accuracy threshold or a verdict on the child. */

  // The five cycle missions (practice/content.ts MISSION_CYCLE), by id: the
  // card title and the first step, which is the line the day card shows.
  "elev.practice.journey.mission.new-words.title": "Five new words",
  "elev.practice.journey.mission.new-words.step": "Pick 5 things around the house {name} doesn't name yet (whisk, hinge, shadow…).",
  "elev.practice.journey.mission.emotion-spotting.title": "Emotion detective",
  "elev.practice.journey.mission.emotion-spotting.step": "During a book or show, pause on a face and ask: \"How does she feel? How do you know?\"",
  "elev.practice.journey.mission.story-retell.title": "Story retell",
  "elev.practice.journey.mission.story-retell.step": "Read or tell a short story {name} knows well.",
  "elev.practice.journey.mission.sound-safari.title": "Sound safari",
  "elev.practice.journey.mission.sound-safari.step": "Pick one sound {name} is working on (or open Speech Coach for today's sound).",
  "elev.practice.journey.mission.social-play.title": "Turn-taking game",
  "elev.practice.journey.mission.social-play.step": "Pick any turn-based game (rolling a ball counts). You go, {name} goes.",

  // The ten aimed extras (practice/journey.ts EXTRA_BY_DOMAIN).
  "elev.practice.journey.extra.speech-sound.title": "Speech Coach: today's sound",
  "elev.practice.journey.extra.speech-sound.detail": "5 minutes on the current target sound — words first, then one silly sentence.",
  "elev.practice.journey.extra.mimic-round.title": "Mimic Studio round",
  "elev.practice.journey.extra.mimic-round.detail": "Two imitation rounds — mouth gymnastics count as speech practice.",
  "elev.practice.journey.extra.naming-hunt.title": "Words mode: naming hunt",
  "elev.practice.journey.extra.naming-hunt.detail": "Name 5 objects in one category (kitchen things, animals, clothes).",
  "elev.practice.journey.extra.question-of-the-day.title": "Express mode: question of the day",
  "elev.practice.journey.extra.question-of-the-day.detail": "One open question at dinner — wait, then expand their answer back.",
  "elev.practice.journey.extra.emotion-match.title": "Feelings Lab: emotion match",
  "elev.practice.journey.extra.emotion-match.detail": "One round of matching faces to feelings, then make the faces together.",
  "elev.practice.journey.extra.calm-down.title": "Calm-down practice",
  "elev.practice.journey.extra.calm-down.detail": "One guided breathing exercise during a calm moment — that's when it sticks.",
  "elev.practice.journey.extra.adventure-scene.title": "Adventure scene",
  "elev.practice.journey.extra.adventure-scene.detail": "One story scene with choices — thinking practice disguised as play.",
  "elev.practice.journey.extra.memory-match.title": "Memory Match round",
  "elev.practice.journey.extra.memory-match.detail": "One pairs round; the grid grows as they get stronger.",
  "elev.practice.journey.extra.story-journey.title": "Story Journey",
  "elev.practice.journey.extra.story-journey.detail": "One hero story with a real choice — talk about what the hero felt after.",
  "elev.practice.journey.extra.turn-taking.title": "Turn-taking game",
  "elev.practice.journey.extra.turn-taking.detail": "Any turn-based game; narrate the waiting and lose at least once.",

  // The ten monthly objectives (practice/journey.ts OBJECTIVE_TEMPLATES).
  "elev.practice.journey.objective.speech.0": "Practice one target sound on 8 different days",
  "elev.practice.journey.objective.speech.1": "Practice speech sounds on 12 different days",
  "elev.practice.journey.objective.language.0": "Play with 15 new words",
  "elev.practice.journey.objective.language.1": "Complete 8 Words/Express rounds",
  "elev.practice.journey.objective.emotional.0": "Name feelings in 10 real moments",
  "elev.practice.journey.objective.emotional.1": "Do 8 calm-down practices in calm times",
  "elev.practice.journey.objective.cognition.0": "Finish 4 adventures together",
  "elev.practice.journey.objective.cognition.1": "Play the bigger Memory Match grid",
  "elev.practice.journey.objective.social.0": "Complete 4 story journeys and talk about the choice",
  "elev.practice.journey.objective.social.1": "Practice losing gracefully 6 times",

  // The weekly-history count row — a count, never a share (law 1).
  "elev.practice.journey.history.count": "{reached} of {total}",
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

  // ── Builder L · R23 · תוכן מסע ההתפתחות (משימות, תוספות, יעדים חודשיים)
  "elev.practice.journey.mission.new-words.title": "חמש מילים חדשות",
  "elev.practice.journey.mission.new-words.step": "בחרו 5 דברים בבית ש{name} עדיין לא קורא/ת להם בשם (מטרפה, ציר, צל…).",
  "elev.practice.journey.mission.emotion-spotting.title": "בלשי רגשות",
  "elev.practice.journey.mission.emotion-spotting.step": "בספר או בסרטון, עצרו על פנים ושאלו: ״מה היא מרגישה? איך אתם יודעים?״",
  "elev.practice.journey.mission.story-retell.title": "לספר את הסיפור שוב",
  "elev.practice.journey.mission.story-retell.step": "קראו או ספרו סיפור קצר ש{name} מכיר/ה היטב.",
  "elev.practice.journey.mission.sound-safari.title": "ספארי צלילים",
  "elev.practice.journey.mission.sound-safari.step": "בחרו צליל אחד ש{name} מתאמן/ת עליו (או פתחו את מאמן הדיבור לצליל של היום).",
  "elev.practice.journey.mission.social-play.title": "משחק תורות",
  "elev.practice.journey.mission.social-play.step": "בחרו משחק תורות כלשהו (גם גלגול כדור נחשב). אתם, ואז {name}.",

  "elev.practice.journey.extra.speech-sound.title": "מאמן הדיבור: הצליל של היום",
  "elev.practice.journey.extra.speech-sound.detail": "חמש דקות על הצליל הנוכחי — קודם מילים, ואז משפט אחד מצחיק.",
  "elev.practice.journey.extra.mimic-round.title": "סבב באולפן החיקוי",
  "elev.practice.journey.extra.mimic-round.detail": "שני סבבי חיקוי — התעמלות פה נחשבת תרגול דיבור לכל דבר.",
  "elev.practice.journey.extra.naming-hunt.title": "מצב מילים: ציד שמות",
  "elev.practice.journey.extra.naming-hunt.detail": "תנו שם ל-5 חפצים מאותה קטגוריה (דברים במטבח, חיות, בגדים).",
  "elev.practice.journey.extra.question-of-the-day.title": "מצב הבעה: שאלת היום",
  "elev.practice.journey.extra.question-of-the-day.detail": "שאלה פתוחה אחת בארוחת הערב — חכו, ואז הרחיבו את התשובה בחזרה.",
  "elev.practice.journey.extra.emotion-match.title": "מעבדת הרגשות: התאמת רגשות",
  "elev.practice.journey.extra.emotion-match.detail": "סבב אחד של התאמת פנים לרגשות, ואז עשו את הפרצופים יחד.",
  "elev.practice.journey.extra.calm-down.title": "תרגול הרגעה",
  "elev.practice.journey.extra.calm-down.detail": "תרגיל נשימה מודרך אחד ברגע רגוע — אז זה נקלט.",
  "elev.practice.journey.extra.adventure-scene.title": "סצנת הרפתקה",
  "elev.practice.journey.extra.adventure-scene.detail": "סצנת סיפור אחת עם בחירות — תרגול חשיבה בתחפושת של משחק.",
  "elev.practice.journey.extra.memory-match.title": "סבב כספת הזיכרון",
  "elev.practice.journey.extra.memory-match.detail": "סבב זוגות אחד; הלוח גדל ככל שנעשה קל יותר.",
  "elev.practice.journey.extra.story-journey.title": "מסע סיפור",
  "elev.practice.journey.extra.story-journey.detail": "סיפור גיבור אחד עם בחירה אמיתית — דברו על מה שהגיבור הרגיש אחר כך.",
  "elev.practice.journey.extra.turn-taking.title": "משחק תורות",
  "elev.practice.journey.extra.turn-taking.detail": "כל משחק תורות; ספרו בקול על ההמתנה, והפסידו לפחות פעם אחת.",

  "elev.practice.journey.objective.speech.0": "לתרגל צליל מטרה אחד ב-8 ימים שונים",
  "elev.practice.journey.objective.speech.1": "לתרגל צלילי דיבור ב-12 ימים שונים",
  "elev.practice.journey.objective.language.0": "לשחק עם 15 מילים חדשות",
  "elev.practice.journey.objective.language.1": "להשלים 8 סבבי מילים או הבעה",
  "elev.practice.journey.objective.emotional.0": "לתת שם לרגשות ב-10 רגעים אמיתיים",
  "elev.practice.journey.objective.emotional.1": "לעשות 8 תרגולי הרגעה ברגעים רגועים",
  "elev.practice.journey.objective.cognition.0": "לסיים 4 הרפתקאות יחד",
  "elev.practice.journey.objective.cognition.1": "לשחק בלוח הזיכרון הגדול יותר",
  "elev.practice.journey.objective.social.0": "להשלים 4 מסעות סיפור ולדבר על הבחירה",
  "elev.practice.journey.objective.social.1": "לתרגל הפסד בכיף 6 פעמים",

  "elev.practice.journey.history.count": "{reached} מתוך {total}",
};
