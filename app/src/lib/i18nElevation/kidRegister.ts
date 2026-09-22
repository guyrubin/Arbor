/* i18nElevation/kidRegister — Wave T lane K: the KID register strings
 * (KID-03/04/16/17/20/22/29, RUN-03/04/21).
 *
 * Three namespaces, all under "elev.*" (base dictionaries win on merge):
 *   elev.kid.*      — components/kidmode/** (the Kid Mode shell)
 *   elev.play.*     — kid-register subsets of components/practice/** (the
 *                     surfaces reachable from KidModeOverlay)
 *   elev.practice.* — PARENT-register copy that lane K moved out of the kid
 *                     register (the Kid-Mode door chips, Journey counts)
 *
 * Register laws (pinned by lib/kidRegisterScan.test.ts): every elev.kid.* /
 * elev.play.* value is counts-never-verdicts — no %, no score, no
 * development/diagnosis/assessment/accuracy vocabulary, no streak or
 * loss framing.
 *
 * HE (22 Sep 2026): the `he` export held English for 93 of its 118 keys, so
 * a Hebrew-speaking child met an English arcade H1, an English speech bubble
 * on Mood Mountain and an English back pill in every world. Those values are
 * now written Hebrew in the same warm ages-4-8 register as the rest of the
 * kid copy. THIS IS A FIRST PASS: GD-6/GD-7 native editorial sign-off is
 * still Guy's gate before release. Five lines stay English on purpose and
 * keep their `// GD-6` marker: four arcade WORLD names (their tiles are
 * locked to them verbatim by kidMode.test.ts, so a header cannot localize
 * before HeroArcade's WORLDS table does) and one aria string that is nothing
 * but interpolation slots.
 */

export const en: Record<string, string> = {
  // ── elev.kid — Kid Mode shell (RUN-21 greeting, KID-22 crash fallback)
  "elev.kid.greeting.ready": "Ready for today's adventure?",
  "elev.kid.greeting.playedYesterday": "You played {world} yesterday",
  "elev.kid.crash.title": "Oops — let's go back to the map",
  "elev.kid.crash.home": "Home",

  // ── elev.play.arcade — HeroArcade (KID-16: literals → keys, pips not %)
  "elev.play.arcade.allWorlds": "All worlds",
  "elev.play.arcade.heroOfWeek": "Hero of the week",
  "elev.play.arcade.yourHero": "Your hero",
  "elev.play.arcade.heroBrave": "{name} the Brave",
  "elev.play.arcade.level": "Level {n}",
  "elev.play.arcade.nextLevel": "Next level",
  "elev.play.arcade.nextLevelAria": "{n} of 5 stars toward the next level",
  "elev.play.arcade.daysPracticed": "days practiced",
  "elev.play.arcade.coachSay": "Pick a world, hero. Every win powers up {hero}!",
  "elev.play.arcade.coachSayGeneric": "Pick a world, hero. Every win powers up your hero!",
  "elev.play.arcade.chooseWorld": "Choose your world",
  "elev.play.arcade.soon": "Soon",
  "elev.play.arcade.comingSoonAria": "{world}, {tag}, coming soon",
  "elev.play.arcade.worldAria": "{world}, {tag}",
  "elev.play.arcade.starsAria": "{n} of 3 stars",
  "elev.play.arcade.new": "NEW",
  "elev.play.arcade.gear": "Your hero gear",
  "elev.play.arcade.firstGear": "Play a world to earn {name}'s first gear.",
  "elev.play.arcade.firstGearGeneric": "Play a world to earn your child's first gear.",
  "elev.play.arcade.comic.title": "Make {name}'s comic!",
  "elev.play.arcade.comic.titleGeneric": "Make your comic!",
  "elev.play.arcade.comic.bodyHero": "Turn your hero into a comic page, ready to share with the family.",
  "elev.play.arcade.comic.bodyNoHero": "Create {name}'s hero, then star them in a shareable comic.",
  "elev.play.arcade.comic.ctaHero": "Create comic page",
  "elev.play.arcade.comic.ctaNoHero": "Create my hero",

  // ── elev.play.cosmetic — earned gear labels + plain requirements (KID-02)
  "elev.play.cosmetic.sprout-frame.label": "Sprout",
  "elev.play.cosmetic.sprout-frame.req": "Try your first activity",
  "elev.play.cosmetic.explorer-badge.label": "Explorer",
  "elev.play.cosmetic.explorer-badge.req": "Play in 3 different areas",
  "elev.play.cosmetic.steady-title.label": "Steady",
  "elev.play.cosmetic.steady-title.req": "Practice on 3 different days",
  "elev.play.cosmetic.bloom-frame.label": "Bloom",
  "elev.play.cosmetic.bloom-frame.req": "Complete 10 activities",
  "elev.play.cosmetic.allrounder-badge.label": "All-rounder",
  "elev.play.cosmetic.allrounder-badge.req": "Play in all 5 areas",
  "elev.play.cosmetic.devoted-title.label": "Devoted",
  "elev.play.cosmetic.devoted-title.req": "Practice on 7 different days",
  "elev.play.cosmetic.star-frame.label": "Star",
  "elev.play.cosmetic.star-frame.req": "Complete 25 activities",
  "elev.play.cosmetic.tree-frame.label": "Mighty tree",
  "elev.play.cosmetic.tree-frame.req": "Complete 50 activities",

  // ── elev.play.soundlab — Sound Lab kid subset (KID-03)
  "elev.play.soundlab.title": "Sound Lab",
  "elev.play.soundlab.say": "Say it with me, {name}!",
  "elev.play.soundlab.pickSound": "Pick a sound",
  "elev.play.soundlab.soundAria": "Sound {sound}",
  "elev.play.soundlab.sayIt": "Say it together",
  "elev.play.soundlab.record": "Record",
  "elev.play.soundlab.stop": "Stop",
  "elev.play.soundlab.listen": "Listen back",
  "elev.play.soundlab.saved": "Saved!",
  "elev.play.soundlab.micOff": "The microphone is having a nap. Say it out loud, then tap how it went!",

  // ── elev.play.feelings — Mood Mountain kid subset (KID-04)
  "elev.play.feelings.title": "Mood Mountain",
  "elev.play.feelings.say": "Let's find the feeling, {name}!",
  "elev.play.feelings.selfCheck": "How are you feeling right now, {name}?",
  "elev.play.feelings.next": "Next feeling",
  "elev.play.feelings.yes": "Yes! This looks like {feeling}.",
  "elev.play.feelings.retry": "Good try — it might be {feeling}. Let's make that face together.",

  // ── elev.play.adventures — Story Quest finish (KID-29)
  "elev.play.adventures.done.sub": "{n} of {total} first-try answers. The End — keep this story!",

  // ── elev.play.mimic — Mimic Studio child controls (W3, HE pending GD-6)
  "elev.play.mimic.effortNote": "Every attempt counts — trying is the win.",
  "elev.play.mimic.round": "{pack} — round {current} of {total}",
  "elev.play.mimic.alreadyPlayed": "Already played — replays still count",
  "elev.play.mimic.mirrorOn": "Turn on mirror",
  "elev.play.mimic.mirrorOff": "Mirror off",
  "elev.play.mimic.tried": "Tried it!",
  "elev.play.mimic.close": "So close",
  "elev.play.mimic.nailed": "Nailed it ⭐",
  "elev.play.mimic.rated.nailed": "🎉 Amazing!",
  "elev.play.mimic.rated.close": "👏 Great try!",
  "elev.play.mimic.rated.tried": "💪 Trying is the win!",
  "elev.play.mimic.packComplete.title": "Pack complete!",
  "elev.play.mimic.packComplete.sub": "{name} played every round in {pack}. Pick another, or come back tomorrow.",
  "elev.play.mimic.playPack": "Play {pack}",
  "elev.play.mimic.stay": "Stay here",

  // ── elev.play.strip — weekly strip in Kid Mode (KID-18: done days only)
  "elev.play.strip.kidTitle": "Stars this week",
  "elev.play.strip.starAria": "A star for {day}",

  // ── elev.play.beat — Beat Keeper (no % readout)
  "elev.play.beat.title": "Beat Keeper",
  "elev.play.beat.scoredAria": "Round finished",
  "elev.play.beat.tapAria": "Tap on the beat",
  "elev.play.beat.startAria": "Start the beat",
  "elev.play.beat.tap": "TAP!",
  "elev.play.beat.start": "START",
  "elev.play.beat.complete.title": "Right on beat, {name}!",
  "elev.play.beat.complete.sub": "Steady taps build focus and self-control.",
  "elev.play.beat.replay": "Play again",
  "elev.play.beat.feedback.nailed": "Wow, {name}, you nailed the beat!",
  "elev.play.beat.feedback.next": "Nice rhythm! Try the next tempo.",
  "elev.play.beat.feedback.keep": "Keep feeling the beat — you’ve got this!",
  "elev.play.beat.next": "Next tempo",
  "elev.play.beat.finish": "Finish",
  "elev.play.beat.support": "Timing, focus & self-regulation",

  // ── Builder C ─────────────────────────────────────────────────────────
  // OBJ-KID-04: an AI-backed start that fails must ANSWER the child inside
  // `.arbor-play`. Pairs with the existing `elev.states.hero.opening` label.
  "elev.play.hero.rest": "The story is resting — let's pick another one!",
  "elev.play.adventures.napping": "The adventure is napping. Try one of these!",
  // OBJ-KID-03: one kid `say` line per world (the elev.play.soundlab.say /
  // elev.play.feelings.say pattern) so the explainer written FOR THE PARENT
  // renders only on the parent door.
  "elev.play.adventures.say": "Big stories, {name} — you choose what happens next!",
  "elev.play.mimic.say": "Can you do what I do, {name}?",
  "elev.play.mimic.mirrorSay": "Turn on the mirror and watch yourself make the face!",
  "elev.play.mimic.mirrorRest": "The mirror is having a nap — let's play it face to face!",
  "elev.play.mimic.rateAsk": "How did that one go?",

  // ── elev.practice — PARENT register (moved out of the kid register)
  "elev.practice.door.aria": "What Kid Mode promises",
  "elev.practice.door.locked": "Parent locked",
  "elev.practice.door.private": "Private by default",
  "elev.practice.door.stars": "Stars, never streaks",
  "elev.practice.journey.missionsDone": "Missions done",
  "elev.practice.journey.earned": "Earned",

  // ── Builder B (object backlog wave 1) — parent-register counts that replaced
  //    a percentage or an unearned-badge wall on a parent door.
  "elev.practice.feelings.named": "Feelings named",
  "elev.practice.journey.badgesEarned": "{n} of {total} effort badges earned",

  // ── Builder H (object backlog wave 1, §3d) ────────────────────────────
  // KID-09: the one read-aloud control, in the child's words. Every kid world
  // now carries it next to the thing the child is asked to understand.
  "elev.play.speak.label": "Hear it",
  // KID-07/08: Pattern Power ends instead of looping the same six puzzles.
  "elev.play.pattern.title": "Pattern Power",
  "elev.play.pattern.say": "What comes next? Tap the shape that finishes the pattern.",
  "elev.play.pattern.done.title": "You finished every pattern, {name}!",
  "elev.play.pattern.done.sub": "That is the whole set. A new set of shapes is waiting whenever you come back.",
  "elev.play.pattern.done.again": "Play this set again",
  // KID-27: Beat Keeper now makes a sound, so the invitation says so.
  "elev.play.beat.say": "Listen for the click, then tap the big button right on the beat!",
  // KID-23: a control the child cannot use is replaced by a line, never left
  // as a dead button. Never names a permission, a setting, or a grown-up task.
  "elev.play.mic.unavailable": "This device is not listening right now — say it out loud together instead!",
  "elev.play.mirror.unavailable": "No mirror on this device right now — play it face to face!",
};

export const he: Record<string, string> = {
  "elev.kid.greeting.ready": "מוכנים להרפתקה של היום?",
  "elev.kid.greeting.playedYesterday": "אתמול שיחקתם ב{world}",
  "elev.kid.crash.title": "אופס — בואו נחזור למפה",
  "elev.kid.crash.home": "בית",

  "elev.play.arcade.allWorlds": "כל העולמות",
  "elev.play.arcade.heroOfWeek": "גיבור/ת השבוע",
  "elev.play.arcade.yourHero": "הגיבור/ה שלכם",
  "elev.play.arcade.heroBrave": "{name} — גיבור/ת העולמות",
  "elev.play.arcade.level": "שלב {n}",
  "elev.play.arcade.nextLevel": "השלב הבא",
  "elev.play.arcade.nextLevelAria": "{n} מתוך 5 כוכבים לשלב הבא",
  "elev.play.arcade.daysPracticed": "ימים של משחק",
  "elev.play.arcade.coachSay": "בחרו עולם, גיבורים! כל הצלחה מחזקת את {hero}",
  "elev.play.arcade.coachSayGeneric": "בחרו עולם, גיבורים! כל הצלחה מחזקת את הגיבור/ה שלכם",
  "elev.play.arcade.chooseWorld": "בחרו עולם",
  "elev.play.arcade.soon": "בקרוב",
  "elev.play.arcade.comingSoonAria": "{world}, {tag}, בקרוב",
  // Pure interpolation — two slots and a comma, nothing to translate.
  "elev.play.arcade.worldAria": "{world}, {tag}", // GD-6
  "elev.play.arcade.starsAria": "{n} מתוך 3 כוכבים",
  "elev.play.arcade.new": "חדש",
  "elev.play.arcade.gear": "הציוד של הגיבור/ה",
  "elev.play.arcade.firstGear": "שחקו בעולם כדי לקבל את הציוד הראשון של {name}",
  "elev.play.arcade.firstGearGeneric": "שחקו בעולם כדי לקבל את הציוד הראשון של הילד/ה",
  "elev.play.arcade.comic.title": "מכינים קומיקס של {name}",
  "elev.play.arcade.comic.titleGeneric": "מכינים את הקומיקס שלכם!",
  "elev.play.arcade.comic.bodyHero": "הפכו את הגיבור/ה שלכם לדף קומיקס, מוכן לשיתוף עם המשפחה.",
  "elev.play.arcade.comic.bodyNoHero": "צרו דמות גיבור/ה ל{name}, ואז היא תככב בקומיקס לשיתוף.",
  "elev.play.arcade.comic.ctaHero": "יצירת דף קומיקס",
  "elev.play.arcade.comic.ctaNoHero": "יצירת הגיבור/ה שלי",

  "elev.play.cosmetic.sprout-frame.label": "ספראוט",
  "elev.play.cosmetic.sprout-frame.req": "נסו את הפעילות הראשונה",
  "elev.play.cosmetic.explorer-badge.label": "חוקר/ת",
  "elev.play.cosmetic.explorer-badge.req": "שחקו בשלושה תחומים שונים",
  "elev.play.cosmetic.steady-title.label": "מתמיד/ה",
  "elev.play.cosmetic.steady-title.req": "שחקו בשלושה ימים שונים",
  "elev.play.cosmetic.bloom-frame.label": "פריחה",
  "elev.play.cosmetic.bloom-frame.req": "השלימו עשר פעילויות",
  "elev.play.cosmetic.allrounder-badge.label": "כל התחומים",
  "elev.play.cosmetic.allrounder-badge.req": "שחקו בכל חמשת התחומים",
  "elev.play.cosmetic.devoted-title.label": "מסור/ה",
  "elev.play.cosmetic.devoted-title.req": "שחקו בשבעה ימים שונים",
  "elev.play.cosmetic.star-frame.label": "כוכב",
  "elev.play.cosmetic.star-frame.req": "השלימו 25 פעילויות",
  "elev.play.cosmetic.tree-frame.label": "עץ אדיר",
  "elev.play.cosmetic.tree-frame.req": "השלימו 50 פעילויות",

  // World NAMES stay EN in both maps until the arcade table itself localizes:
  // HeroArcade's WORLDS entries are EN literals and the kid home tile is locked
  // to them verbatim (kidMode.test.ts), so translating only the arrival header
  // would break KID-4 honest navigation — the child would tap "Sound Lab" and
  // land on a differently named screen.
  "elev.play.soundlab.title": "Sound Lab", // GD-6
  "elev.play.soundlab.say": "{name}, בואו נגיד את זה ביחד!",
  "elev.play.soundlab.pickSound": "בחרו צליל",
  "elev.play.soundlab.soundAria": "צליל {sound}",
  "elev.play.soundlab.sayIt": "אומרים ביחד",
  "elev.play.soundlab.record": "הקלטה",
  "elev.play.soundlab.stop": "עצירה",
  "elev.play.soundlab.listen": "להאזין שוב",
  "elev.play.soundlab.saved": "נשמר!",
  "elev.play.soundlab.micOff": "המיקרופון נח רגע. תגידו בקול רם, ואז בחרו איך זה הלך!",

  "elev.play.feelings.title": "Mood Mountain", // GD-6
  "elev.play.feelings.say": "{name}, בואו נמצא את הרגש!",
  "elev.play.feelings.selfCheck": "{name}, איך אתם מרגישים עכשיו?",
  "elev.play.feelings.next": "הרגש הבא",
  "elev.play.feelings.yes": "כן! זה נראה כמו {feeling}.",
  "elev.play.feelings.retry": "ניסיון יפה — אולי זה {feeling}. בואו נעשה את הפרצוף הזה ביחד.",

  "elev.play.adventures.done.sub": "{n} מתוך {total} תשובות בניסיון הראשון. הסוף — שמרו את הסיפור הזה!",

  "elev.play.mimic.effortNote": "כל ניסיון נחשב — עצם הניסיון הוא ההצלחה.",
  "elev.play.mimic.round": "{pack} — סיבוב {current} מתוך {total}",
  "elev.play.mimic.alreadyPlayed": "כבר שיחקתם — גם משחק חוזר נחשב",
  "elev.play.mimic.mirrorOn": "להדליק מראה",
  "elev.play.mimic.mirrorOff": "לכבות מראה",
  "elev.play.mimic.tried": "ניסינו!",
  "elev.play.mimic.close": "כמעט",
  "elev.play.mimic.nailed": "בול! ⭐",
  "elev.play.mimic.rated.nailed": "🎉 מדהים!",
  "elev.play.mimic.rated.close": "👏 ניסיון יפה!",
  "elev.play.mimic.rated.tried": "💪 הניסיון הוא ההצלחה!",
  "elev.play.mimic.packComplete.title": "סיימתם את הערכה!",
  "elev.play.mimic.packComplete.sub": "{name} עבר/ה את כל הסיבובים ב{pack}. אפשר לבחור ערכה אחרת, או לחזור מחר.",
  "elev.play.mimic.playPack": "לשחק ב{pack}",
  "elev.play.mimic.stay": "להישאר כאן",

  "elev.play.strip.kidTitle": "כוכבים השבוע",
  "elev.play.strip.starAria": "כוכב עבור {day}",

  "elev.play.beat.title": "Beat Keeper", // GD-6
  "elev.play.beat.scoredAria": "הסיבוב הסתיים",
  "elev.play.beat.tapAria": "הקישו לפי המקצב",
  "elev.play.beat.startAria": "להתחיל את המקצב",
  "elev.play.beat.tap": "הקישו!",
  "elev.play.beat.start": "מתחילים",
  "elev.play.beat.complete.title": "{name}, הייתם בדיוק בקצב!",
  "elev.play.beat.complete.sub": "הקשות יציבות מחזקות ריכוז ושליטה עצמית.",
  "elev.play.beat.replay": "לשחק שוב",
  "elev.play.beat.feedback.nailed": "וואו {name}, פגעתם בדיוק במקצב!",
  "elev.play.beat.feedback.next": "מקצב נהדר! נסו את הקצב הבא.",
  "elev.play.beat.feedback.keep": "תמשיכו להרגיש את המקצב — אתם בדרך!",
  "elev.play.beat.next": "הקצב הבא",
  "elev.play.beat.finish": "לסיים",
  "elev.play.beat.support": "תזמון, ריכוז וויסות עצמי",

  // ── Builder C ─────────────────────────────────────────────────────────
  "elev.play.hero.rest": "הסיפור נח עכשיו — בואו נבחר סיפור אחר!",
  "elev.play.adventures.napping": "ההרפתקה נמנמת עכשיו — בואו ננסה אחת מאלה!",
  "elev.play.adventures.say": "סיפורים גדולים, {name} — אתם בוחרים מה קורה עכשיו!",
  "elev.play.mimic.say": "אפשר לעשות כמוני, {name}?",
  "elev.play.mimic.mirrorSay": "הדליקו את המראה ותראו את עצמכם עושים את הפרצוף!",
  "elev.play.mimic.mirrorRest": "המראה נחה עכשיו — בואו נשחק פנים מול פנים!",
  "elev.play.mimic.rateAsk": "איך הלך הפעם?",

  "elev.practice.door.aria": "מה מצב ילדים מבטיח",
  "elev.practice.door.locked": "נעול להורים",
  "elev.practice.door.private": "פרטי כברירת מחדל",
  "elev.practice.door.stars": "כוכבים, אף פעם לא רצפים",
  "elev.practice.journey.missionsDone": "משימות שהושלמו",
  "elev.practice.journey.earned": "הושג",

  // ── Builder B (object backlog wave 1)
  "elev.practice.feelings.named": "רגשות שזוהו",
  "elev.practice.journey.badgesEarned": "{n} מתוך {total} תגי מאמץ הושגו",

  // ── Builder H (object backlog wave 1, §3d)
  "elev.play.speak.label": "לשמוע",
  "elev.play.pattern.title": "Pattern Power", // GD-6
  "elev.play.pattern.say": "מה בא עכשיו? הקישו על הצורה שמשלימה את התבנית.",
  "elev.play.pattern.done.title": "סיימתם את כל התבניות, {name}!",
  "elev.play.pattern.done.sub": "זו כל הערכה. ערכה חדשה של צורות מחכה לכם כשתחזרו.",
  "elev.play.pattern.done.again": "לשחק שוב בערכה הזו",
  "elev.play.beat.say": "הקשיבו לנקישה, ואז הקישו על הכפתור הגדול בדיוק לפי המקצב!",
  "elev.play.mic.unavailable": "המכשיר לא מקשיב עכשיו — תגידו בקול רם יחד!",
  "elev.play.mirror.unavailable": "אין מראה במכשיר עכשיו — שחקו פנים מול פנים!",
};
