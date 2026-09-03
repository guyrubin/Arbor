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
 * loss framing. HE values are EN placeholders behind the GD-6 native
 * transcreation gate (never machine-translated); each placeholder line is
 * marked `// GD-6` so the native reviewer can grep the worklist.
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

  // ── elev.play.feelings — Mood Mountain kid subset (KID-04)
  "elev.play.feelings.title": "Mood Mountain",
  "elev.play.feelings.say": "Let's find the feeling, {name}!",
  "elev.play.feelings.selfCheck": "How are you feeling right now, {name}?",
  "elev.play.feelings.next": "Next feeling",
  "elev.play.feelings.yes": "Yes! This looks like {feeling}.",
  "elev.play.feelings.retry": "Good try — it might be {feeling}. Let's make that face together.",

  // ── elev.play.adventures — Story Quest finish (KID-29)
  "elev.play.adventures.done.sub": "{n} of {total} first-try answers. The End — keep this story!",

  // ── elev.play.mimic — Mimic Studio kid-safe note (KID-29)
  "elev.play.mimic.effortNote": "Every attempt counts — trying is the win.",

  // ── elev.play.strip — weekly strip in Kid Mode (KID-18: done days only)
  "elev.play.strip.kidTitle": "Stars this week",
  "elev.play.strip.starAria": "A star for {day}",

  // ── elev.play.beat — Beat Keeper (no % readout)
  "elev.play.beat.scoredAria": "Round scored",

  // ── elev.practice — PARENT register (moved out of the kid register)
  "elev.practice.door.aria": "What Kid Mode promises",
  "elev.practice.door.locked": "Parent locked",
  "elev.practice.door.private": "Private by default",
  "elev.practice.door.stars": "Stars, never streaks",
  "elev.practice.journey.missionsDone": "Missions done",
  "elev.practice.journey.earned": "Earned",
};

export const he: Record<string, string> = {
  "elev.kid.greeting.ready": "Ready for today's adventure?", // GD-6
  "elev.kid.greeting.playedYesterday": "You played {world} yesterday", // GD-6
  "elev.kid.crash.title": "Oops — let's go back to the map", // GD-6
  "elev.kid.crash.home": "Home", // GD-6

  "elev.play.arcade.allWorlds": "All worlds", // GD-6
  "elev.play.arcade.heroOfWeek": "Hero of the week", // GD-6
  "elev.play.arcade.yourHero": "Your hero", // GD-6
  "elev.play.arcade.heroBrave": "{name} the Brave", // GD-6
  "elev.play.arcade.level": "Level {n}", // GD-6
  "elev.play.arcade.nextLevel": "Next level", // GD-6
  "elev.play.arcade.nextLevelAria": "{n} of 5 stars toward the next level", // GD-6
  "elev.play.arcade.daysPracticed": "days practiced", // GD-6
  "elev.play.arcade.coachSay": "Pick a world, hero. Every win powers up {hero}!", // GD-6
  "elev.play.arcade.coachSayGeneric": "Pick a world, hero. Every win powers up your hero!", // GD-6
  "elev.play.arcade.chooseWorld": "Choose your world", // GD-6
  "elev.play.arcade.soon": "Soon", // GD-6
  "elev.play.arcade.comingSoonAria": "{world}, {tag}, coming soon", // GD-6
  "elev.play.arcade.worldAria": "{world}, {tag}", // GD-6
  "elev.play.arcade.starsAria": "{n} of 3 stars", // GD-6
  "elev.play.arcade.new": "NEW", // GD-6
  "elev.play.arcade.gear": "Your hero gear", // GD-6
  "elev.play.arcade.firstGear": "Play a world to earn {name}'s first gear.", // GD-6
  "elev.play.arcade.firstGearGeneric": "Play a world to earn your child's first gear.", // GD-6
  "elev.play.arcade.comic.title": "Make {name}'s comic!", // GD-6
  "elev.play.arcade.comic.titleGeneric": "Make your comic!", // GD-6
  "elev.play.arcade.comic.bodyHero": "Turn your hero into a comic page, ready to share with the family.", // GD-6
  "elev.play.arcade.comic.bodyNoHero": "Create {name}'s hero, then star them in a shareable comic.", // GD-6
  "elev.play.arcade.comic.ctaHero": "Create comic page", // GD-6
  "elev.play.arcade.comic.ctaNoHero": "Create my hero", // GD-6

  "elev.play.cosmetic.sprout-frame.label": "Sprout", // GD-6
  "elev.play.cosmetic.sprout-frame.req": "Try your first activity", // GD-6
  "elev.play.cosmetic.explorer-badge.label": "Explorer", // GD-6
  "elev.play.cosmetic.explorer-badge.req": "Play in 3 different areas", // GD-6
  "elev.play.cosmetic.steady-title.label": "Steady", // GD-6
  "elev.play.cosmetic.steady-title.req": "Practice on 3 different days", // GD-6
  "elev.play.cosmetic.bloom-frame.label": "Bloom", // GD-6
  "elev.play.cosmetic.bloom-frame.req": "Complete 10 activities", // GD-6
  "elev.play.cosmetic.allrounder-badge.label": "All-rounder", // GD-6
  "elev.play.cosmetic.allrounder-badge.req": "Play in all 5 areas", // GD-6
  "elev.play.cosmetic.devoted-title.label": "Devoted", // GD-6
  "elev.play.cosmetic.devoted-title.req": "Practice on 7 different days", // GD-6
  "elev.play.cosmetic.star-frame.label": "Star", // GD-6
  "elev.play.cosmetic.star-frame.req": "Complete 25 activities", // GD-6
  "elev.play.cosmetic.tree-frame.label": "Mighty tree", // GD-6
  "elev.play.cosmetic.tree-frame.req": "Complete 50 activities", // GD-6

  "elev.play.soundlab.title": "Sound Lab", // GD-6
  "elev.play.soundlab.say": "Say it with me, {name}!", // GD-6
  "elev.play.soundlab.pickSound": "Pick a sound", // GD-6
  "elev.play.soundlab.soundAria": "Sound {sound}", // GD-6
  "elev.play.soundlab.sayIt": "Say it together", // GD-6
  "elev.play.soundlab.record": "Record", // GD-6
  "elev.play.soundlab.stop": "Stop", // GD-6
  "elev.play.soundlab.listen": "Listen back", // GD-6
  "elev.play.soundlab.saved": "Saved!", // GD-6

  "elev.play.feelings.title": "Mood Mountain", // GD-6
  "elev.play.feelings.say": "Let's find the feeling, {name}!", // GD-6
  "elev.play.feelings.selfCheck": "How are you feeling right now, {name}?", // GD-6
  "elev.play.feelings.next": "Next feeling", // GD-6
  "elev.play.feelings.yes": "Yes! This looks like {feeling}.", // GD-6
  "elev.play.feelings.retry": "Good try — it might be {feeling}. Let's make that face together.", // GD-6

  "elev.play.adventures.done.sub": "{n} of {total} first-try answers. The End — keep this story!", // GD-6

  "elev.play.mimic.effortNote": "Every attempt counts — trying is the win.", // GD-6

  "elev.play.strip.kidTitle": "Stars this week", // GD-6
  "elev.play.strip.starAria": "A star for {day}", // GD-6

  "elev.play.beat.scoredAria": "Round scored", // GD-6

  "elev.practice.door.aria": "מה מצב ילדים מבטיח",
  "elev.practice.door.locked": "נעול להורים",
  "elev.practice.door.private": "פרטי כברירת מחדל",
  "elev.practice.door.stars": "כוכבים, אף פעם לא רצפים",
  "elev.practice.journey.missionsDone": "משימות שהושלמו",
  "elev.practice.journey.earned": "הושג",
};
