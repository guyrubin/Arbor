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
  // W2-SHELLPLAY critic r2 (B-PLAY-08): the parent page is the co-play door.
  "elev.practice.feelings.door.title": "Play Mood Mountain together",
  "elev.practice.feelings.door.tip": "Sit beside {name}. You name your feeling out loud first, then ask for theirs.",
  "elev.practice.feelings.door.cta": "Open in Kid Mode",
  "elev.practice.feelings.toolkit.sub": "Why each feeling happens, and calm-down practice to run on a good day.",
  // The quiet counts line that replaced three stat bubbles above the drill.
  "elev.practice.feelings.counts": "{rounds} feeling rounds · {calm} calm practices",
  // W2-SHELLPLAY critic r1 · #/feelings: the counter, the plural count line,
  // the toolkit chrome and the footer note — keyed (they were English in HE).
  "elev.practice.feelings.progress": "{n} of {total}",
  "elev.practice.feelings.count.rounds.one": "1 feelings round",
  "elev.practice.feelings.count.rounds.many": "{n} feelings rounds",
  "elev.practice.feelings.count.calm.one": "1 calm practice",
  "elev.practice.feelings.count.calm.many": "{n} calm practices",
  "elev.practice.feelings.why.label": "Why:",
  "elev.practice.feelings.looksLike.label": "Looks like:",
  "elev.practice.feelings.helps.label": "Helps:",
  "elev.practice.feelings.logged": "Logged",
  "elev.practice.feelings.talked": "We talked this through",
  "elev.practice.feelings.calm.intro": "Practise these during calm moments. That is when the body learns the route back.",
  "elev.practice.feelings.breath": "In {inhale}s, hold {hold}s, out {exhale}s × {rounds}",
  "elev.practice.feelings.completeRound": "Complete one round",
  "elev.practice.feelings.note": "This is coaching and practice, not mental-health diagnosis. Patterns worth discussing are surfaced gently in the Development Dashboard.",

  /* ── Stories door (#/stories parent branch, §3f rows 3–4) ───────────────── */
  // Lives here rather than in a module of its own: this file is the "parent
  // doors" dictionary, and #/stories is the last of them. One evening, one
  // story — the shelf is what you browse AFTER tonight is settled.
  "elev.stories.tonight.eyebrow": "Tonight's story",
  "elev.stories.tonight.cta": "Read it together",
  // W2-SHELLPLAY critic r1: the H1 names tonight (not the catalogue); the
  // cover's recessed well — what the story builds, the one thing to ask after.
  "elev.stories.tonight.h1": "Tonight's story",
  "elev.stories.tonight.h1.starring": "Tonight, starring {name}",
  "elev.stories.tonight.builds": "Builds",
  "elev.stories.tonight.askAfter": "Ask after",
  "elev.stories.sub": "One story for tonight, starring {name}. The whole shelf is below when you want it.",
  "elev.stories.counts.stories": "{n} stories read together",
  "elev.stories.catalogue.title": "Choose a different story",
  // B-PLAY-11: the one disclosure holding the pack filter + catalogue.
  "elev.stories.more": "More stories",
  // B-PLAY-05 + W2-SHELLPLAY critic r1: the Practice door's ONE sentence —
  // one unit (rounds), one stated window, at most one finished story title
  // (rendered bidi-isolated). Gender variants exist for Hebrew; English is the
  // same sentence for every child.
  "elev.practice.door.when.day": "Since {day}",
  "elev.practice.door.when.today": "Today",
  "elev.practice.door.when.week": "In the last 7 days",
  "elev.practice.door.rounds.one": "once",
  "elev.practice.door.rounds.many": "{n} times",
  "elev.practice.door.sentence.played.boy": "{when}, {name} played {rounds}.",
  "elev.practice.door.sentence.played.girl": "{when}, {name} played {rounds}.",
  "elev.practice.door.sentence.played.neutral": "{when}, {name} played {rounds}.",
  "elev.practice.door.sentence.playedFinished.boy": "{when}, {name} played {rounds} and finished {title}.",
  "elev.practice.door.sentence.playedFinished.girl": "{when}, {name} played {rounds} and finished {title}.",
  "elev.practice.door.sentence.playedFinished.neutral": "{when}, {name} played {rounds} and finished {title}.",
  "elev.practice.door.sentence.finished.boy": "{when}, {name} finished {title}.",
  "elev.practice.door.sentence.finished.girl": "{when}, {name} finished {title}.",
  "elev.practice.door.sentence.finished.neutral": "{when}, {name} finished {title}.",
  "elev.practice.studio.opensWorld": "Opens {world} in Kid Mode",
  "elev.practice.studio.window": "Counts: {when}",
  // B-SHELL-NEW-1b: keep the door sentence as one journal moment.
  "elev.practice.door.keep": "Keep it in the journal",
  "elev.practice.door.kept": "Kept in the journal",
  // W2-SHELLPLAY critic r1 · #/adventures — every literal keyed (18 English
  // strings rendered under lang=he). The parent lines talk ABOUT the story and
  // the child, never TO the child (law 2).
  "elev.practice.adventures.gen.title": "Make a brand-new adventure",
  "elev.practice.adventures.gen.sub": "A fresh comprehension story, made just for {name}.",
  "elev.practice.adventures.gen.create": "Create",
  "elev.practice.adventures.gen.creating": "Creating…",
  // W2-SHELLPLAY critic r2: ONE pre-formatted LTR range (two isolated numbers
  // around a neutral dash flipped to "4–2" in RTL).
  "elev.practice.adventures.ages": "Ages {range}",
  // W2-SHELLPLAY critic r2 (B-PLAY-09): the parent door into Story Quest.
  "elev.practice.adventures.door.title": "Story Quest is ready for {name}.",
  "elev.practice.adventures.door.last": "Last time: {title} — {n} scenes, {name}'s own choices.",
  "elev.practice.adventures.door.last.one": "Last time: {title} — 1 scene, {name}'s own choice.",
  "elev.practice.adventures.door.pick": "A good first story for {name}: {title}.",
  "elev.practice.adventures.door.cta": "Play {world} together",
  "elev.practice.adventures.choices.one": "1 choice",
  "elev.practice.adventures.choices.many": "{n} choices",
  "elev.practice.adventures.played": "Played ✓",
  "elev.practice.adventures.title.hungry-lion": "The Hungry Lion",
  "elev.practice.adventures.title.lost-mitten": "The Lost Mitten",
  "elev.practice.adventures.title.rocket-picnic": "Picnic on the Moon",
  "elev.practice.adventures.title.bedtime-bear": "Bear Can't Sleep",
  "elev.practice.adventures.parent.hungry-lion": "Leo the lion wakes up hungry — {name} follows simple steps to find his breakfast.",
  "elev.practice.adventures.parent.lost-mitten": "A mitten goes missing — {name} uses clues and where-words to track it down.",
  "elev.practice.adventures.parent.rocket-picnic": "A picnic on the moon — {name} puts the steps of a trip in order.",
  "elev.practice.adventures.parent.bedtime-bear": "Bruno the bear can't sleep — {name} works out what helps a body wind down.",
  "elev.practice.adventures.skill.vocabulary": "Vocabulary",
  "elev.practice.adventures.skill.logic": "Logic",
  "elev.practice.adventures.skill.sequencing": "Sequencing",
  "elev.practice.adventures.skill.instructions": "Following instructions",
  "elev.practice.adventures.skill.abstract": "Abstract thinking",
  "elev.practice.adventures.keepGoing": "Keep going →",
  "elev.practice.adventures.finish": "Finish the adventure 🎉",
  "elev.practice.adventures.tryAnother": "Try another one — thinking out loud together is the whole game.",
  "elev.practice.adventures.done.title": "{name} finished “{title}”!",
  "elev.practice.adventures.playAgain": "Play again",
  "elev.practice.adventures.more": "More adventures",
  "elev.practice.adventures.comic": "Make a hero comic",
  // W2-SHELLPLAY critic r1 · #/speech — descriptive scoring labels (no hue
  // carries correctness), the "when it's almost" line, the little-and-often
  // line (no repetition quota), and the honest Hebrew state (the sound drill is
  // English content).
  "elev.practice.speech.result.got": "Said it",
  "elev.practice.speech.result.almost": "Almost",
  "elev.practice.speech.result.missed": "Not yet — model it again",
  "elev.practice.speech.almost": "When it comes out almost — smile and say the word back, slowly. Hearing it again is the whole correction.",
  "elev.practice.speech.littleOften": "Little and often works best — a few minutes most days, and stop while it's still fun.",
  "elev.practice.speech.he.title": "A Hebrew sound set is coming",
  "elev.practice.speech.he.body": "The sound drill here is built on English words. Until the Hebrew set is ready, the Hebrew language work for {name} lives in Language & Communication.",
  "elev.practice.speech.he.cta": "Open Language & Communication",
  // W2-SHELLPLAY critic r2: the end of a round — a count of words said together
  // and tomorrow's open loop (the least-practised sound), never a target.
  "elev.practice.speech.roundDone": "{n} words said together this round.",
  "elev.practice.speech.roundDone.one": "1 word said together this round.",
  "elev.practice.speech.roundDone.next": "Tomorrow: {sound} — the sound practised least so far.",
  "elev.practice.speech.handover": "Hand over to Sound Lab",
  "elev.practice.speech.anotherRound": "Another round",
  // W2-SHELLPLAY critic r1: the subtitle names the one move (pick a world).
  "elev.practice.studio.subtitle": "Ten skill worlds {name} plays as the hero. Pick one to start.",
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
  "elev.practice.feelings.door.title": "משחקים יחד בהר הרגשות",
  "elev.practice.feelings.door.tip": "שבו ליד {name}. אתם ראשונים: אמרו את הרגש שלכם בקול, ואז שאלו על שלהם.",
  "elev.practice.feelings.door.cta": "לפתוח במצב ילדים",
  "elev.practice.feelings.toolkit.sub": "למה כל רגש מופיע, ותרגולי הרגעה לתרגל ביום טוב.",
  "elev.practice.feelings.counts": "{rounds} סבבי רגשות · {calm} תרגולי הרגעה",
  "elev.practice.feelings.progress": "{n} מתוך {total}",
  "elev.practice.feelings.count.rounds.one": "סבב רגשות אחד",
  "elev.practice.feelings.count.rounds.many": "{n} סבבי רגשות",
  "elev.practice.feelings.count.calm.one": "תרגול הרגעה אחד",
  "elev.practice.feelings.count.calm.many": "{n} תרגולי הרגעה",
  "elev.practice.feelings.why.label": "למה:",
  "elev.practice.feelings.looksLike.label": "איך זה נראה:",
  "elev.practice.feelings.helps.label": "מה עוזר:",
  "elev.practice.feelings.logged": "נרשם",
  "elev.practice.feelings.talked": "דיברנו על זה",
  "elev.practice.feelings.calm.intro": "תרגלו את אלה ברגעים רגועים. אז הגוף לומד את הדרך חזרה.",
  "elev.practice.feelings.breath": "שאיפה {inhale} שנ׳, עצירה {hold} שנ׳, נשיפה {exhale} שנ׳ × {rounds}",
  "elev.practice.feelings.completeRound": "השלמנו סבב אחד",
  "elev.practice.feelings.note": "זה אימון ותרגול, לא אבחון של בריאות הנפש. דפוסים ששווה לדבר עליהם עולים בעדינות בלוח ההתפתחות.",

  "elev.stories.tonight.eyebrow": "הסיפור של הערב",
  "elev.stories.tonight.cta": "קוראים יחד",
  "elev.stories.tonight.h1": "הסיפור של הערב",
  "elev.stories.tonight.h1.starring": "הערב, בכיכוב {name}",
  "elev.stories.tonight.builds": "בונה",
  "elev.stories.tonight.askAfter": "לשאול אחרי",
  "elev.stories.sub": "סיפור אחד לערב, בכיכוב {name}. כל המדף מחכה מתחת כשתרצו.",
  "elev.stories.counts.stories": "{n} סיפורים שקראתם יחד",
  "elev.stories.catalogue.title": "בחירת סיפור אחר",
  "elev.stories.more": "סיפורים נוספים",
  "elev.practice.door.when.day": "מאז {day}",
  "elev.practice.door.when.today": "היום",
  "elev.practice.door.when.week": "בשבעת הימים האחרונים",
  "elev.practice.door.rounds.one": "פעם אחת",
  "elev.practice.door.rounds.many": "{n} פעמים",
  "elev.practice.door.sentence.played.boy": "{when}, {name} שיחק {rounds}.",
  "elev.practice.door.sentence.played.girl": "{when}, {name} שיחקה {rounds}.",
  "elev.practice.door.sentence.played.neutral": "{when}, שיחקו עם {name} {rounds}.",
  "elev.practice.door.sentence.playedFinished.boy": "{when}, {name} שיחק {rounds} וסיים את {title}.",
  "elev.practice.door.sentence.playedFinished.girl": "{when}, {name} שיחקה {rounds} וסיימה את {title}.",
  "elev.practice.door.sentence.playedFinished.neutral": "{when}, שיחקו עם {name} {rounds}, והסיפור {title} הושלם.",
  "elev.practice.door.sentence.finished.boy": "{when}, {name} סיים את {title}.",
  "elev.practice.door.sentence.finished.girl": "{when}, {name} סיימה את {title}.",
  "elev.practice.door.sentence.finished.neutral": "{when}, הסיפור {title} של {name} הושלם.",
  "elev.practice.studio.opensWorld": "נפתח ב{world} במצב ילדים",
  "elev.practice.studio.window": "ספירה: {when}",
  "elev.practice.door.keep": "לשמור ביומן",
  "elev.practice.door.kept": "נשמר ביומן",
  "elev.practice.adventures.gen.title": "ליצור הרפתקה חדשה לגמרי",
  "elev.practice.adventures.gen.sub": "סיפור הבנה חדש, שנוצר במיוחד בשביל {name}.",
  "elev.practice.adventures.gen.create": "ליצור",
  "elev.practice.adventures.gen.creating": "יוצרים…",
  "elev.practice.adventures.ages": "גילאי {range}",
  "elev.practice.adventures.door.title": "מסע הסיפור מוכן ל־{name}.",
  "elev.practice.adventures.door.last": "בפעם האחרונה: {title} — {n} סצנות, הבחירות של {name}.",
  "elev.practice.adventures.door.last.one": "בפעם האחרונה: {title} — סצנה אחת, הבחירה של {name}.",
  "elev.practice.adventures.door.pick": "סיפור ראשון טוב ל־{name}: {title}.",
  "elev.practice.adventures.door.cta": "משחקים יחד ב{world}",
  "elev.practice.adventures.choices.one": "בחירה אחת",
  "elev.practice.adventures.choices.many": "{n} בחירות",
  "elev.practice.adventures.played": "שוחק ✓",
  "elev.practice.adventures.title.hungry-lion": "האריה הרעב",
  "elev.practice.adventures.title.lost-mitten": "הכפפה האבודה",
  "elev.practice.adventures.title.rocket-picnic": "פיקניק על הירח",
  "elev.practice.adventures.title.bedtime-bear": "הדב שלא מצליח להירדם",
  "elev.practice.adventures.parent.hungry-lion": "האריה ליאו מתעורר רעב — בעזרת הוראות פשוטות מוצאים לו ארוחת בוקר, יחד עם {name}.",
  "elev.practice.adventures.parent.lost-mitten": "כפפה נעלמה — רמזים ומילות מקום עוזרים למצוא אותה, יחד עם {name}.",
  "elev.practice.adventures.parent.rocket-picnic": "פיקניק על הירח — מסדרים את שלבי הטיול לפי הסדר, יחד עם {name}.",
  "elev.practice.adventures.parent.bedtime-bear": "הדב ברונו לא מצליח להירדם — מגלים מה עוזר לגוף להירגע, יחד עם {name}.",
  "elev.practice.adventures.skill.vocabulary": "אוצר מילים",
  "elev.practice.adventures.skill.logic": "היגיון",
  "elev.practice.adventures.skill.sequencing": "רצף וסדר",
  "elev.practice.adventures.skill.instructions": "מילוי הוראות",
  "elev.practice.adventures.skill.abstract": "חשיבה מופשטת",
  "elev.practice.adventures.keepGoing": "ממשיכים ←",
  "elev.practice.adventures.finish": "מסיימים את ההרפתקה 🎉",
  "elev.practice.adventures.tryAnother": "נסו עוד אחת — לחשוב בקול יחד זה כל המשחק.",
  "elev.practice.adventures.done.title": "„{title}” — עד הסוף, {name}!",
  "elev.practice.adventures.playAgain": "לשחק שוב",
  "elev.practice.adventures.more": "עוד הרפתקאות",
  "elev.practice.adventures.comic": "ליצור קומיקס גיבור",
  "elev.practice.speech.result.got": "נאמר",
  "elev.practice.speech.result.almost": "כמעט",
  "elev.practice.speech.result.missed": "עוד לא — נדגים שוב",
  "elev.practice.speech.almost": "כשזה יוצא כמעט — חייכו ואמרו את המילה שוב, לאט. לשמוע אותה שוב זה כל התיקון.",
  "elev.practice.speech.littleOften": "מעט ולעתים קרובות עובד הכי טוב — כמה דקות ברוב הימים, ולעצור כשעוד כיף.",
  "elev.practice.speech.he.title": "ערכת צלילים בעברית בדרך",
  "elev.practice.speech.he.body": "תרגול הצלילים כאן בנוי על מילים באנגלית. עד שהערכה בעברית תהיה מוכנה, העבודה על השפה העברית של {name} נמצאת בשפה ותקשורת.",
  "elev.practice.speech.he.cta": "לפתוח את שפה ותקשורת",
  "elev.practice.speech.roundDone": "{n} מילים נאמרו יחד בסבב הזה.",
  "elev.practice.speech.roundDone.one": "מילה אחת נאמרה יחד בסבב הזה.",
  "elev.practice.speech.roundDone.next": "מחר: {sound} — הצליל שתורגל הכי מעט עד עכשיו.",
  "elev.practice.speech.handover": "להעביר למעבדת הצלילים",
  "elev.practice.speech.anotherRound": "סבב נוסף",
  "elev.practice.studio.subtitle": "עשרה עולמות מיומנות ש{name} משחק בהם כגיבור. בחרו אחד כדי להתחיל.",
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
