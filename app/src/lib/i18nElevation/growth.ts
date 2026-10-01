/* i18nElevation/growth — E2 hub-hero strings for the Growth (Development) hub
 * and the Academy hub (workstream E2 Growth+Academy + E8 chip mounts).
 *
 * CLINICAL FIREWALL: every stat label below annotates a COUNT or plain
 * activity fact — never a percentage, verdict, trend delta, or deficit
 * framing. Hebrew = calm Israeli-parent transcreation, outcome language,
 * no AI/tech framing; flagged for arbor-localization native review. */

export const en: Record<string, string> = {
  // ── E2 · Growth (Development) hub hero
  "elev.hero.growth.eyebrow": "Growth",
  "elev.hero.growth.title": "Small moments become the growth story",
  "elev.hero.growth.sub": "Every milestone you notice is kept — Arbor remembers it for you.",
  "elev.hero.growth.cta": "Quick development check",
  "elev.hero.growth.stat.noticed": "of {total} noticed",
  // OBJ-GROWTH-01: the "7" was a hard-coded literal beside 6 rendered rows,
  // a "5 areas covered" teaser and Science's "7 developmental domains". The
  // total is interpolated from DOMAIN_META now; `{plural}` is resolved by
  // LanguageContext from `n`, so "1 area" reads singular.
  "elev.hero.growth.stat.domains": "area{plural} of {total}",
  "elev.hero.growth.stat.week": "logged this week",

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
  "elev.growth.lang.more.title": "Vocabulary log",
  "elev.growth.lang.more.sub": "Optional — count the words you hear, whenever you want to.",

  // B-GROWTH-04 — the Development Check door states the re-check date as text.
  "elev.growth.recheck.date": "Check again around {date}",

  // B-GROWTH-20 — Daily Play: the plan shows without a goal; the focus is optional.
  "elev.growth.play.setFocusOptional": "Set a focus to match it to what you're working on",

  // B-GROWTH-30 — the Record by area (spine Option A). Counts of things the
  // parent noticed and dates only; never a share, a total or a trend.
  "elev.growth.record.title": "What we know about {name}, by area",
  "elev.growth.record.sub": "Everything you've noted, grouped by area. Tap an area for its dated list.",
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
};

export const he: Record<string, string> = {
  "elev.hero.growth.eyebrow": "התפתחות",
  "elev.hero.growth.title": "כאן רגעים קטנים הופכים לסיפור ההתפתחות",
  "elev.hero.growth.sub": "כל אבן דרך ששמתם לב אליה נשמרת — ארבור זוכרת בשבילכם.",
  "elev.hero.growth.cta": "בדיקת התפתחות מהירה",
  "elev.hero.growth.stat.noticed": "מתוך {total} אבני דרך",
  "elev.hero.growth.stat.domains": "מתוך {total} תחומים",
  "elev.hero.growth.stat.week": "תועד השבוע",

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
  "elev.growth.lang.more.title": "יומן אוצר מילים",
  "elev.growth.lang.more.sub": "רשות — סופרים את המילים שאתם שומעים, מתי שמתאים לכם.",

  // B-GROWTH-04 — תאריך הבדיקה החוזרת, כטקסט
  "elev.growth.recheck.date": "לבדוק שוב בסביבות {date}",

  // B-GROWTH-20 — התוכנית מוצגת גם בלי מטרה; המיקוד הוא רשות
  "elev.growth.play.setFocusOptional": "הגדירו מיקוד כדי להתאים אותה למה שאתם עובדים עליו",

  // B-GROWTH-30 — התיעוד לפי תחום
  "elev.growth.record.title": "מה אנחנו יודעים על {name}, לפי תחום",
  "elev.growth.record.sub": "כל מה שרשמתם, מקובץ לפי תחום. הקישו על תחום לרשימה עם תאריכים.",
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
};
