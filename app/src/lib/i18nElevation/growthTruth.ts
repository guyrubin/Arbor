/* i18nElevation/growthTruth — Wave-T lane G strings: age integrity, the
 * age-window record, the Language Lab role rows, the day-0 hub-hero teach
 * line and the Profile hub's contract CTA (GP-01/02/03/08/09/15/26, RUN-08).
 *
 * CLINICAL FIREWALL: every string is a fact or a count — the child's AGE as
 * a plain label, "x of y in this age window", a language's ROLE in the home
 * (never a proficiency grade), and an empty-state teach line. No verdicts,
 * percentages, bands, or colour-coded status. `{age}` is always the label
 * from lib/childAge.ageLabel() ("7 months", "1 year 6 months"), never the
 * legacy whole-years number. Hebrew = calm Israeli-parent transcreation;
 * flagged for arbor-localization native review. */

export const en: Record<string, string> = {
  // ── GP-01 · age chips render the months-precise label, never "age 0"
  "elev.growthTruth.agechip.card": "For {age} old",
  "elev.growthTruth.agechip.switcher": "Showing content for children {age} old",

  // ── GP-03 · profile drawer age editor (years + months, one write)
  "elev.growthTruth.drawer.age": "Age",
  "elev.growthTruth.drawer.years": "Years",
  "elev.growthTruth.drawer.months": "Months",
  "elev.growthTruth.drawer.ageHint": "Arbor keeps the age in months so milestones, checks and picks stay in step.",

  // ── GP-08 / GP-09 · the age-window record
  "elev.growthTruth.window.noticed": "{checked} of {total} noticed in the {band} window",
  "elev.growthTruth.window.hint": "Counting this age window and the one before it. Later milestones are still there — open them below.",
  "elev.growthTruth.ms.showLater": "Show later milestones",
  "elev.growthTruth.ms.hideLater": "Hide later milestones",
  "elev.growthTruth.ms.laterBand": "Later",

  // ── GP-02 · Language Lab: roles in the home, counts of logged moments
  "elev.growthTruth.lang.role.home": "Home language",
  "elev.growthTruth.lang.role.second": "Second language",
  "elev.growthTruth.lang.role.also": "Also hears",
  "elev.growthTruth.lang.role.note.home": "The language {first} hears most. Keep it rich — it anchors everything else.",
  "elev.growthTruth.lang.role.note.second": "Children usually understand a second language before they speak it. Daily, low-pressure exposure is what builds it.",
  "elev.growthTruth.lang.role.note.also": "Hearing it in everyday moments is enough for now — playful and optional.",
  "elev.growthTruth.lang.count.one": "1 moment logged",
  "elev.growthTruth.lang.count.many": "{n} moments logged",
  "elev.growthTruth.lang.count.none": "Nothing logged yet",

  // ── RUN-08 · day-0 hub hero: a teach line instead of a wall of zeros
  "elev.growthTruth.hero.empty": "Nothing noticed yet — one moment starts the picture.",

  // ── OBJ-GROWTH-06 · "worth a conversation" rows speak the check's own voice
  "elev.growthTruth.watch.fromCheck": "From your latest Development Check",
  "elev.growthTruth.watch.soundsTypical": "Some sounds usually arrive later than this age — a speech-language professional is the right person to look",

  // ── OBJ-GROWTH-05 · the weekly focus and the Academy cards say WHY without
  //    ever naming a ranking of the child's areas (law 1, weakest-domain
  //    pointers). Every reason below is about what the FAMILY has done.
  "elev.growthTruth.focus.why.practised": "Picked from what you have practised with {name} lately. Small daily reps are what move it.",
  "elev.growthTruth.focus.why.day0": "Picked for {name}'s age — practise anything and this gets sharper.",
  "elev.growthTruth.learn.header": "Where to put your energy this week",
  "elev.growthTruth.learn.why.explored": "Picked for {name}'s age and the milestones you've noticed — an editorial suggestion, not a reading of {name}.",
  // W2-SHELLPLAY critic r1: the Learning Map rail before any milestone is noticed.
  "elev.growthTruth.learn.rail.noSignal": "Notice a milestone on Growth and these suggestions follow {name}",

  // ── GP-15 / RUN-20 · Profile hub CTA = the contract's primary move
  "elev.growthTruth.profile.cta.review": "Review what Arbor remembers",
  "elev.growthTruth.profile.cta.addFact": "Add a fact about {name}",

  // ── GP-26 / IA-09 · the strengths leaf gets one live door
  "elev.growthTruth.profile.openStrengths": "Open strengths & challenges",
  // B-GROWTH-05 — physical measurements live on Profile (spine domain 7).
  "elev.growthTruth.profile.measurements.title": "Measurements",
  "elev.growthTruth.profile.measurements.sub": "Height, weight and head size you noted, kept for the pediatrician.",

  // (B-GROWTH-26: the five practice-domain names moved to the one domain
  //  registry, lib/i18nElevation/domains.ts.)

  // (B-GROWTH-22: the Full Picture's chrome keys left with the retired #/copilot leaf.)

  // ── Builder L · R22 · the Milestones map's celebrate affordance
  "elev.growthTruth.ms.celebrate": "Celebrate",



  // Builder M — R25 — #/profile demotion disclosure (chapters 3-7 and the jump strip).
  "elev.growthTruth.profile.more.title": "The rest of the story",
  "elev.growthTruth.profile.more.sub": "Milestones, strengths, language, what Arbor remembers, and the next step.",

  // NEXTLEVEL critic r1 — #/milestones primary move (mark-milestone) + domain rows.
  "elev.ms.seenAny.title": "Seen any of these?",
  "elev.ms.seenAny.yes": "Yes, I've seen it",
  "elev.ms.seenAny.empty": "When {name} does something for the first time, it lands here.",
  "elev.ms.domainNext": "Next: {title}",
  // NEXTLEVEL critic r1 (B-NEXTLEVEL-NEW-1i/1j) — the parent's last first leads the summary.
  "elev.ms.latest.lead": "{name}'s latest:",
  "elev.ms.latest.when": "You noticed it on",
  "elev.ms.latest.area": "in {area}",
  "elev.ms.latest.areas": "across {n} areas",
  "elev.ms.latest.areas.one": "in 1 area",

  // B-GROWTH-35 — a kept fact with a relative time in it, dated by when it was written.
  "elev.growthTruth.profile.written": "written {date}:",
};

export const he: Record<string, string> = {
  "elev.growthTruth.agechip.card": "לגיל {age}",
  "elev.growthTruth.agechip.switcher": "מציג תוכן לגיל {age}",

  "elev.growthTruth.drawer.age": "גיל",
  "elev.growthTruth.drawer.years": "שנים",
  "elev.growthTruth.drawer.months": "חודשים",
  "elev.growthTruth.drawer.ageHint": "ארבור שומרת את הגיל בחודשים כדי שאבני הדרך, הבדיקות והבחירות יישארו מתואמות.",

  "elev.growthTruth.window.noticed": "{checked} מתוך {total} נצפו בחלון הגיל {band}",
  "elev.growthTruth.window.hint": "נספרים חלון הגיל הנוכחי והקודם לו. אבני דרך מאוחרות יותר עדיין כאן — פתחו אותן למטה.",
  "elev.growthTruth.ms.showLater": "הצג אבני דרך מאוחרות יותר",
  "elev.growthTruth.ms.hideLater": "הסתר אבני דרך מאוחרות יותר",
  "elev.growthTruth.ms.laterBand": "בהמשך",

  "elev.growthTruth.lang.role.home": "שפת הבית",
  "elev.growthTruth.lang.role.second": "שפה שנייה",
  "elev.growthTruth.lang.role.also": "שומע/ת גם",
  "elev.growthTruth.lang.role.note.home": "השפה ש{first} שומע/ת הכי הרבה. שמרו עליה עשירה — היא העוגן של כל השאר.",
  "elev.growthTruth.lang.role.note.second": "ילדים בדרך כלל מבינים שפה שנייה לפני שהם מדברים אותה. חשיפה יומית וללא לחץ היא מה שבונה אותה.",
  "elev.growthTruth.lang.role.note.also": "לשמוע אותה ברגעי היום-יום מספיק בינתיים — בכיף ובלי חובה.",
  "elev.growthTruth.lang.count.one": "רגע אחד תועד",
  "elev.growthTruth.lang.count.many": "{n} רגעים תועדו",
  "elev.growthTruth.lang.count.none": "עדיין לא תועד דבר",

  "elev.growthTruth.hero.empty": "עדיין לא שמתם לב לכלום — רגע אחד מתחיל את התמונה.",

  "elev.growthTruth.watch.fromCheck": "מבדיקת ההתפתחות האחרונה שלכם",
  "elev.growthTruth.watch.soundsTypical": "חלק מהצלילים מגיעים בדרך כלל מאוחר יותר מהגיל הזה — קלינאי/ת תקשורת היא הכתובת לבדוק",

  "elev.growthTruth.focus.why.practised": "נבחר לפי מה שתרגלתם עם {name} לאחרונה. חזרות קטנות ויומיומיות הן מה שמזיז את זה.",
  "elev.growthTruth.focus.why.day0": "נבחר לפי הגיל של {name} — תרגלו משהו, וזה יתחדד.",
  "elev.growthTruth.learn.header": "לאן להפנות אנרגיה השבוע",
  "elev.growthTruth.learn.why.explored": "נבחר לפי הגיל של {name} ואבני הדרך שסימנתם — המלצה עורכת, לא קריאה של {name}.",
  "elev.growthTruth.learn.rail.noSignal": "סמנו אבן דרך בצמיחה, וההצעות כאן יתאימו את עצמן ל{name}",

  "elev.growthTruth.profile.cta.review": "לסקור מה ארבור זוכרת",
  "elev.growthTruth.profile.cta.addFact": "להוסיף עובדה על {name}",

  "elev.growthTruth.profile.openStrengths": "לפתוח חוזקות ואתגרים",
  "elev.growthTruth.profile.measurements.title": "מדידות",
  "elev.growthTruth.profile.measurements.sub": "גובה, משקל והיקף ראש שתיעדתם, שמורים לביקור אצל רופא הילדים.",

  // (B-GROWTH-26: שמות התחומים עברו למרשם התחומים, lib/i18nElevation/domains.ts.)

  // (B-GROWTH-22: מפתחות התמונה המלאה יצאו עם #/copilot.)

  "elev.growthTruth.ms.celebrate": "לחגוג",



  // Builder M — R25 — #/profile demotion disclosure (chapters 3-7 and the jump strip).
  "elev.growthTruth.profile.more.title": "המשך הסיפור",
  "elev.growthTruth.profile.more.sub": "אבני דרך, חוזקות, שפה, מה ארבור זוכר והצעד הבא.",

  // NEXTLEVEL critic r1 — #/milestones primary move (mark-milestone) + domain rows.
  "elev.ms.seenAny.title": "ראיתם משהו מאלה?",
  "elev.ms.seenAny.yes": "כן, ראיתי",
  "elev.ms.seenAny.empty": "כש{name} יעשה משהו בפעם הראשונה, זה יופיע כאן.",
  "elev.ms.domainNext": "הבא: {title}",
  "elev.ms.latest.lead": "הכי חדש אצל {name}:",
  "elev.ms.latest.when": "סימנתם את זה ב־",
  "elev.ms.latest.area": "בתחום {area}",
  "elev.ms.latest.areas": "ב־{n} תחומים",
  "elev.ms.latest.areas.one": "בתחום אחד",

  // B-GROWTH-35 — עובדה שיש בה זמן יחסי מקבלת את התאריך שבו נכתבה.
  "elev.growthTruth.profile.written": "נכתב ב־{date}:",
};
