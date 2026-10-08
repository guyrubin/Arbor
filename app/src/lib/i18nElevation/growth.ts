/* i18nElevation/growth — E2 hub-hero strings for the Growth (Development) hub
 * and the Academy hub (workstream E2 Growth+Academy + E8 chip mounts).
 *
 * CLINICAL FIREWALL: every stat label below annotates a COUNT or plain
 * activity fact — never a percentage, verdict, trend delta, or deficit
 * framing. Hebrew = calm Israeli-parent transcreation, outcome language,
 * no AI/tech framing; flagged for arbor-localization native review. */

export const en: Record<string, string> = {
  "elev.growth.record.compactCount": "{n} saved · 4 weeks",
  // Growth portrait: observation detail, with no inferred assessment.
  "elev.growth.portrait.sub": "The little things you notice, brought together. Explore an area to see the moments behind it.",
  "elev.growth.portrait.mapLink": "See the whole picture",
  "elev.growth.record.areas": "Developmental areas in your record",
  "elev.growth.record.detail.eyebrow": "A closer look",
  "elev.growth.record.latestDate": "Latest saved · {date}",
  "elev.growth.record.earlier": "Earlier moments in this area",
  "elev.growth.record.photo": "Photo saved with this moment",
  "elev.growth.record.source.practice": "From a saved activity",
  "elev.growth.record.source.saved": "From your saved record",
  "elev.growth.record.item.speech": "Speech practice",
  "elev.growth.record.item.mimic": "A session of copying expressions",
  "elev.growth.record.item.story": "A story activity",
  "elev.growth.record.description.talking": "Words, conversations and the things you hear each day.",
  "elev.growth.record.description.moving": "Everyday movement, from a little jump to outdoor play.",
  "elev.growth.record.description.hands": "Drawing, exploring with the senses and doing things independently.",
  "elev.growth.record.description.thinking": "Questions, discoveries and everyday problem-solving.",
  "elev.growth.record.description.playing": "Joining in, taking turns and time with other children.",
  "elev.growth.record.description.feelings": "Feelings, transitions and the moments you work through together.",
  "elev.growth.record.description.body": "Sleep, mealtimes and the body measurements you have saved.",
  "elev.growth.record.description.family": "The people, places and routines around your child.",

  // ── E2 · Growth (Development) hub hero
  "elev.hero.growth.eyebrow": "Growth",
  "elev.hero.growth.title": "Small moments become the growth story",
  "elev.hero.growth.sub": "Every milestone you notice is kept — Arbor remembers it for you.",
  "elev.hero.growth.cta": "Quick development check",
  // B-GROWTH-34: plain counts under the hero number — never "of {total}"
  // (the row read "0 of 21 noticed · 0 areas of 6" beside a pill saying
  // "You noticed 5 milestones"). Singular keys are explicit "<base>One".
  "elev.hero.growth.stat.noticedCount": "noticed",
  "elev.hero.growth.stat.noticedCountOne": "noticed",
  "elev.hero.growth.stat.areas": "areas",
  "elev.hero.growth.stat.areasOne": "area",
  "elev.hero.growth.stat.moments": "moments this week",
  "elev.hero.growth.stat.momentsOne": "moment this week",

  // ── E2 · Academy hub hero
  "elev.hero.academy.eyebrow": "Academy",
  "elev.hero.academy.title": "Short courses, matched to where {name} is now",
  "elev.hero.academy.sub": "A few practical minutes at a time — ready when you are.",
  "elev.hero.academy.cta": "Continue the next course",
  "elev.hero.academy.stat.courses": "courses",
  "elev.hero.academy.stat.completed": "completed",
  "elev.hero.academy.stat.minNext": "min to next",

  // ── Development screen deep-dive link cards (the former inner-tab facets)
  "elev.growth.link.milestones.sub": "The full checklist — mark what you've noticed",
  "elev.growth.link.journey.sub": "The month-by-month development timeline",
  "elev.growth.link.copilot.label": "This week's focus",
  "elev.growth.link.copilot.sub": "One clear next step from milestones and daily practice",

  // ── Builder F · GP-17 / item 8 (chrome half) · Growth chrome that stayed
  // English inside the Hebrew app. Plural forms are explicit KEYS, never a
  // {plural} suffix token (the translator does not resolve those).
  "elev.growth.play.setFocus": "Set a focus",
  "elev.growth.play.goalsOne": "1 goal active",
  "elev.growth.play.goalsMany": "{n} goals active",
  // B-GROWTH-19 — Daily Play toasts. "added" fires only after a playLogs row
  // was written (it shows in the Journal), so it names that record.
  "elev.growth.play.toast.added": "Saved to {name}'s journal.",
  "elev.growth.play.toast.focusSet": "Focus set. Daily Play is now matched to what you're working on.",
  "elev.growth.play.toast.recorded": "Added to {name}'s record.",
  "elev.growth.play.comicCta": "Turn today's practice into a comic",
  "elev.growth.lang.duration.minutes": "{n} min",
  "elev.growth.lang.duration.daily": "Daily",
  "elev.growth.course.markDone": "Mark done",
  "elev.growth.course.markNotDone": "Mark not done",

  // ── Builder F · RUN-08 (Journey zero wall) + the charter-aim chip
  "elev.growth.journey.zeroTeach": "Nothing to count yet. Mark one day's practice below and this row starts keeping your record — days practised, objectives, effort badges.",
  "elev.growth.journey.aim": "Your aim: {domain}",


  // Builder M — R25 — #/language demotion disclosure (vocabulary log).
  // B-GROWTH-16: the disclosure now holds the practice ideas and the month list.
  "elev.growth.lang.more.title": "Practice ideas and words by month",
  "elev.growth.lang.more.sub": "Optional — four short routines, and the words you wrote down month by month.",
  "elev.growth.lang.words.latest": "Latest words",
  // B-GROWTH-15 — words written down reach the timeline: one row per day per
  // language. A count of words the parent noted, never a size expectation.
  "elev.growth.words.timeline.one": "1 new word in {language}",
  "elev.growth.words.timeline.many": "{count} new words in {language}",

  // B-GROWTH-04 — the Development Check door states the re-check date as text.
  "elev.growth.recheck.date": "Check again around {date}",

  // B-GROWTH-20 — Daily Play: the plan shows without a goal; the focus is optional.
  "elev.growth.play.setFocusOptional": "Set a focus to match it to what you're working on",

  // B-GROWTH-30 — the Record by area (spine Option A). Counts of things the
  // parent noticed and dates only; never a share, a total or a trend.
  "elev.growth.record.sub": "The developmental view of your record. Each area opens the words and moments you saved.",
  "elev.growth.record.empty": "As you note moments, words and milestones, they gather here by area.",
  "elev.growth.record.count.one": "1 thing noticed in the last 4 weeks",
  "elev.growth.record.count.many": "{n} things noticed in the last 4 weeks",
  "elev.growth.record.latest": "Latest: {item} · {date}",
  "elev.growth.record.item.measurement": "Measurement noted",
  "elev.growth.record.item.check": "Development Check answered",
  "elev.growth.record.item.practice": "Practice session",
  "elev.growth.record.item.word": "{phrase} ({language})",
  "elev.growth.record.sheet.milestones": "Milestones",
  "elev.growth.record.sheet.ask": "Ask Arbor about {domain}",
  "elev.growth.record.ask.seed": "Here is what I've noted about {name}'s {domain}. What is worth knowing right now?",
  // W2-GROWTH r1 + B-GROWTH-NEW-1A/1B — "What's new with {name}" and the
  // New-since rows (counts and the parent's own words; no comparison).
  "elev.growth.whatsNew.title": "What's new with {name}",
  "elev.growth.whatsNew.titleGeneric": "What's new",
  "elev.growth.newSince.label": "New since {date}",
  "elev.growth.newSince.labelWeek": "New this week",
  "elev.growth.newSince.noticed": "You marked ‘Seen it’: {title}",
  "elev.growth.newSince.word.one": "New word in {language}:",
  "elev.growth.newSince.word.many": "{n} new words in {language}:",
  "elev.growth.newSince.word.oneNoLang": "New word:",
  "elev.growth.newSince.word.oneNamed": "{name}'s new word:",
  "elev.growth.newSince.word.manyNamed": "{name}'s new words in {language}:",
  "elev.growth.newSince.word.manyNamedNoLang": "{name}'s new words:",
  "elev.growth.newSince.word.manyNoLang": "{n} new words:",
  "elev.growth.newSince.moment.one": "You wrote down:",
  "elev.growth.newSince.moment.oneNoNote": "You wrote down a moment",
  "elev.growth.newSince.moment.many": "{n} moments written down · latest:",
  "elev.growth.newSince.moment.manyNoNote": "{n} moments written down",
  "elev.growth.observe.kept": "Kept in {name}'s record · {date}",
  "elev.growth.observe.keptGeneric": "Kept in the record · {date}",
  "elev.growth.observe.notSureAgain": "You marked ‘Not sure’ on {date} — look again this week",
  "elev.growth.record.title": "{name}'s record",
  "elev.growth.record.titleGeneric": "The record",
  "elev.growth.record.tab.map": "Map",
  "elev.growth.record.tab.words": "Words",
  "elev.growth.record.tab.tree": "Tree",
  "elev.growth.deeper.title": "Go deeper",
  "elev.growth.more.title": "More from Growth",
  "elev.growth.more.sub": "The month in review and the Full Picture.",
};

export const he: Record<string, string> = {
  "elev.growth.record.compactCount": "{n} רשומות · 4 שבועות",
  // Growth portrait: observation detail, with no inferred assessment.
  "elev.growth.portrait.sub": "הדברים הקטנים ששמתם לב אליהם, בתמונה אחת. בחרו תחום כדי לראות את הרגעים ששמרתם.",
  "elev.growth.portrait.mapLink": "לראות את התמונה המלאה",
  "elev.growth.record.areas": "תחומי ההתפתחות ברשומות שלכם",
  "elev.growth.record.detail.eyebrow": "מבט מקרוב",
  "elev.growth.record.latestDate": "נשמר לאחרונה · {date}",
  "elev.growth.record.earlier": "רגעים קודמים בתחום הזה",
  "elev.growth.record.photo": "תמונה שנשמרה עם הרגע הזה",
  "elev.growth.record.source.practice": "פעילות שנשמרה",
  "elev.growth.record.source.saved": "נשמר ברשומות שלכם",
  "elev.growth.record.item.speech": "תרגול דיבור",
  "elev.growth.record.item.mimic": "פעילות של חיקוי הבעות",
  "elev.growth.record.item.story": "פעילות עם סיפור",
  "elev.growth.record.description.talking": "מילים, שיחות והדברים שאתם שומעים ביום־יום.",
  "elev.growth.record.description.moving": "תנועה ביום־יום, מקפיצה קטנה למשחק בחוץ.",
  "elev.growth.record.description.hands": "ציור, חקירה דרך החושים ועשייה עצמאית.",
  "elev.growth.record.description.thinking": "שאלות, תגליות ופתרון בעיות ביום־יום.",
  "elev.growth.record.description.playing": "להצטרף למשחק, לחכות לתור ולבלות עם ילדים אחרים.",
  "elev.growth.record.description.feelings": "רגשות, מעברים והרגעים שאתם עוברים יחד.",
  "elev.growth.record.description.body": "שינה, ארוחות ומדידות גוף ששמרתם.",
  "elev.growth.record.description.family": "האנשים, המקומות והשגרה שסביב הילד.",

  "elev.hero.growth.eyebrow": "התפתחות",
  "elev.hero.growth.title": "כאן רגעים קטנים הופכים לסיפור ההתפתחות",
  "elev.hero.growth.sub": "כל אבן דרך ששמתם לב אליה נשמרת — ארבור זוכרת בשבילכם.",
  "elev.hero.growth.cta": "בדיקת התפתחות מהירה",
  "elev.hero.growth.stat.noticedCount": "אבני דרך ששמתם לב אליהן",
  "elev.hero.growth.stat.noticedCountOne": "אבן דרך ששמתם לב אליה",
  "elev.hero.growth.stat.areas": "תחומים",
  "elev.hero.growth.stat.areasOne": "תחום",
  "elev.hero.growth.stat.moments": "רגעים השבוע",
  "elev.hero.growth.stat.momentsOne": "רגע השבוע",

  "elev.hero.academy.eyebrow": "אקדמיה",
  "elev.hero.academy.title": "קורסים קצרים, מותאמים לשלב של {name}",
  "elev.hero.academy.sub": "כמה דקות מעשיות בכל פעם — בדיוק כשנוח לכם.",
  "elev.hero.academy.cta": "להמשיך לקורס הבא",
  "elev.hero.academy.stat.courses": "קורסים",
  "elev.hero.academy.stat.completed": "הושלמו",
  "elev.hero.academy.stat.minNext": "דק׳ לקורס הבא",

  "elev.growth.link.milestones.sub": "הרשימה המלאה — סמנו מה ששמתם לב אליו",
  "elev.growth.link.journey.sub": "ציר ההתפתחות חודש אחר חודש",
  "elev.growth.link.copilot.label": "המיקוד של השבוע",
  "elev.growth.link.copilot.sub": "צעד הבא ברור אחד מאבני דרך ותרגול יומי",

  // ── Builder F · GP-17 / item 8 (chrome half)
  "elev.growth.play.setFocus": "לבחור מוקד",
  "elev.growth.play.goalsOne": "מוקד אחד פעיל",
  "elev.growth.play.goalsMany": "{n} מוקדים פעילים",
  "elev.growth.play.toast.added": "נשמר ביומן של {name}.",
  "elev.growth.play.toast.focusSet": "המוקד נקבע. המשחק היומי מותאם עכשיו למה שאתם עובדים עליו.",
  "elev.growth.play.toast.recorded": "נוסף לרשומה של {name}.",
  "elev.growth.play.comicCta": "להפוך את התרגול של היום לקומיקס",
  "elev.growth.lang.duration.minutes": "{n} דק׳",
  "elev.growth.lang.duration.daily": "כל יום",
  "elev.growth.course.markDone": "לסמן שנעשה",
  "elev.growth.course.markNotDone": "לבטל את הסימון",

  // ── Builder F · RUN-08 (Journey zero wall) + the charter-aim chip
  "elev.growth.journey.zeroTeach": "אין עדיין מה לספור. סמנו תרגול של יום אחד למטה והשורה הזו תתחיל לשמור את הרישום שלכם — ימי תרגול, יעדים ותגי מאמץ.",
  "elev.growth.journey.aim": "היעד שלכם: {domain}",


  // Builder M — R25 — #/language demotion disclosure (vocabulary log).
  // B-GROWTH-16: בגילוי עכשיו — רעיונות תרגול ורשימת החודשים.
  "elev.growth.lang.more.title": "רעיונות תרגול ומילים לפי חודש",
  "elev.growth.lang.more.sub": "רשות — ארבע שגרות קצרות, והמילים שרשמתם חודש אחר חודש.",
  "elev.growth.lang.words.latest": "המילים האחרונות",
  "elev.growth.words.timeline.one": "מילה חדשה אחת ב{language}",
  "elev.growth.words.timeline.many": "{count} מילים חדשות ב{language}",

  // B-GROWTH-04 — תאריך הבדיקה החוזרת, כטקסט
  "elev.growth.recheck.date": "לבדוק שוב בסביבות {date}",

  // B-GROWTH-20 — התוכנית מוצגת גם בלי מטרה; המיקוד הוא רשות
  "elev.growth.play.setFocusOptional": "הגדירו מיקוד כדי להתאים אותה למה שאתם עובדים עליו",

  // B-GROWTH-30 — התיעוד לפי תחום
  "elev.growth.record.sub": "המבט ההתפתחותי על הרשומות שלכם. בחרו תחום כדי לראות את המילים והרגעים ששמרתם.",
  "elev.growth.record.empty": "כשתרשמו רגעים, מילים ואבני דרך, הם יתקבצו כאן לפי תחום.",
  "elev.growth.record.count.one": "דבר אחד שנרשם ב-4 השבועות האחרונים",
  "elev.growth.record.count.many": "{n} דברים שנרשמו ב-4 השבועות האחרונים",
  "elev.growth.record.latest": "האחרון: {item} · {date}",
  "elev.growth.record.item.measurement": "נרשמה מדידה",
  "elev.growth.record.item.check": "מולאה בדיקת התפתחות",
  "elev.growth.record.item.practice": "מפגש תרגול",
  "elev.growth.record.item.word": "{phrase} ({language})",
  "elev.growth.record.sheet.milestones": "אבני דרך",
  "elev.growth.record.sheet.ask": "לשאול את ארבור על {domain}",
  "elev.growth.record.ask.seed": "זה מה שרשמתי על {domain} של {name}. מה כדאי לדעת עכשיו?",
  "elev.growth.whatsNew.title": "מה חדש אצל {name}",
  "elev.growth.whatsNew.titleGeneric": "מה חדש",
  "elev.growth.newSince.label": "חדש מאז {date}",
  "elev.growth.newSince.labelWeek": "חדש השבוע",
  "elev.growth.newSince.noticed": "סימנתם ‘ראיתי’: {title}",
  "elev.growth.newSince.word.one": "מילה חדשה ({language}):",
  "elev.growth.newSince.word.many": "{n} מילים חדשות ({language}):",
  "elev.growth.newSince.word.oneNoLang": "מילה חדשה:",
  "elev.growth.newSince.word.oneNamed": "המילה החדשה של {name}:",
  "elev.growth.newSince.word.manyNamed": "המילים החדשות של {name} ({language}):",
  "elev.growth.newSince.word.manyNamedNoLang": "המילים החדשות של {name}:",
  "elev.growth.newSince.word.manyNoLang": "{n} מילים חדשות:",
  "elev.growth.newSince.moment.one": "כתבתם:",
  "elev.growth.newSince.moment.oneNoNote": "כתבתם רגע אחד",
  "elev.growth.newSince.moment.many": "{n} רגעים נכתבו · האחרון:",
  "elev.growth.newSince.moment.manyNoNote": "{n} רגעים נכתבו",
  "elev.growth.observe.kept": "נשמר ברשומה של {name} · {date}",
  "elev.growth.observe.keptGeneric": "נשמר ברשומה · {date}",
  "elev.growth.observe.notSureAgain": "סימנתם ‘לא בטוחים’ ב־{date} — שווה להסתכל שוב השבוע",
  "elev.growth.record.title": "הרשומה של {name}",
  "elev.growth.record.titleGeneric": "הרשומה",
  "elev.growth.record.tab.map": "מפה",
  "elev.growth.record.tab.words": "מילים",
  "elev.growth.record.tab.tree": "עץ",
  "elev.growth.deeper.title": "להעמיק",
  "elev.growth.more.title": "עוד בהתפתחות",
  "elev.growth.more.sub": "סיכום החודש והתמונה המלאה.",
};
