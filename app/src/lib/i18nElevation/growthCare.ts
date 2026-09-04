/* i18nElevation/growthCare — Wave G "Growth & Care as systems" strings.
 *
 * Covers: THE AGE GAP (hard-moment guides explain their own age range instead
 * of vanishing), GP-07 (Growth's timeline door), GP-10 (dates + "first time"
 * language on the record), GP-11 (calm screening result, restored answers,
 * "flagged" reworded), GP-34 ("watch for it this week"), GP-33 (first-words
 * ledger).
 *
 * CLINICAL FIREWALL: every string here reports a COUNT, a DATE, or a plain
 * fact about what Arbor has written. None grades the child, ranks a domain, or
 * carries a good/bad colour word. The age-gap copy in particular is written to
 * put the gap on ARBOR ("we have not written these yet"), never on the child.
 *
 * NOTE: consumers resolve this module DIRECTLY (module-local lookup by uiLang,
 * the same recipe Screening.tsx × screeningcalm and DevelopmentTab.tsx ×
 * fullpicture already use). Registration in i18nElevation/index.ts is that
 * file's own recipe and is owned separately. Keys stay "elev.*"-namespaced so a
 * later registration merges cleanly under existing-keys-win semantics.
 *
 * Hebrew = calm Israeli-parent transcreation, outcome language, gender-neutral
 * phrasing where a child is the subject; flagged for arbor-localization review.
 */

export const en: Record<string, string> = {
  // ── THE AGE GAP: hard-moment guides say what ages they were written for ────
  "elev.gcare.hm.age.title": "No guides written for this age yet",
  "elev.gcare.hm.age.range": "Written for ages {from}–{to}",
  "elev.gcare.hm.age.rangeOpen": "Written for ages {from} and up",
  "elev.gcare.hm.age.child": "your child",
  "elev.gcare.hm.age.body.younger":
    "These hard-moment guides are written for ages {from}–{to}, and {who} is younger than that. This list is empty because we have not written those guides yet — not because of anything about {who}.",
  "elev.gcare.hm.age.body.older":
    "These hard-moment guides are written for ages {from}–{to}, and {who} is older than that. This list is empty because we have not written those guides yet — not because of anything about {who}.",
  "elev.gcare.hm.age.body.gap":
    "These hard-moment guides are written for ages {from}–{to}, but none of them covers {who}'s age exactly. This list is empty because of what we have written so far, not because of anything about {who}.",
  "elev.gcare.hm.age.body.unknown":
    "These hard-moment guides are written for ages {from}–{to}. Add a birth date to the profile and we will show the ones written for that age.",
  "elev.gcare.hm.age.elsewhere":
    "Ask Arbor is still here for the moment you are in right now.",

  // ── GP-07: Growth's timeline door ─────────────────────────────────────────
  "elev.gcare.growth.link.timeline.label": "Story",
  "elev.gcare.growth.link.timeline.sub": "Month by month, everything you have kept",

  // ── GP-10: the record keeps dates and says "first time" ───────────────────
  "elev.gcare.ms.observe.yes": "Seen it",
  "elev.gcare.ms.observePrompt": "Mark what you have seen for the first time",
  "elev.gcare.ms.noticedOn": "Noticed {date}",
  "elev.gcare.ms.noticedUndated": "Noticed",

  // ── GP-11: the calm result has somewhere to go; answers survive a refresh ──
  "elev.gcare.screen.last.worth.one": "1 area worth a conversation",
  "elev.gcare.screen.last.worth.many": "{n} areas worth a conversation",
  "elev.gcare.screen.calm.title": "What to do with a calm result",
  "elev.gcare.screen.calm.body":
    "Nothing here asks for action today. The useful next move is the ordinary one: play together, and keep noticing.",
  "elev.gcare.screen.calm.play": "Today's play idea",
  "elev.gcare.screen.calm.record": "Open the record",
  "elev.gcare.screen.draft.restored": "Your answers from earlier are still here.",
  "elev.gcare.screen.draft.clear": "Clear and start over",

  // ── GP-34: close the loop — "watch for it this week" ──────────────────────
  "elev.gcare.screen.watch.title": "Watch for it this week",
  "elev.gcare.screen.watch.body":
    "Pick one thing to look for. It becomes this week's focus on Development, and your re-check is booked at the same time.",
  "elev.gcare.screen.watch.cta": "Watch for this",
  "elev.gcare.screen.watch.chosen": "Watching this week",
  "elev.gcare.growth.watch.eyebrow": "You chose to watch this",
  "elev.gcare.growth.watch.clear": "Stop watching this",

  // ── GP-33: the first-words ledger ─────────────────────────────────────────
  "elev.gcare.lang.words.title": "{name}'s words",
  "elev.gcare.lang.words.titleGeneric": "Words you have kept",
  "elev.gcare.lang.words.count.one": "1 word kept",
  "elev.gcare.lang.words.count.many": "{n} words kept",
  "elev.gcare.lang.words.empty": "No words kept yet. The first one you write down starts the ledger.",
  "elev.gcare.lang.words.add": "Add a word you heard",
};

export const he: Record<string, string> = {
  // ── THE AGE GAP ───────────────────────────────────────────────────────────
  "elev.gcare.hm.age.title": "עדיין לא נכתבו מדריכים לגיל הזה",
  "elev.gcare.hm.age.range": "נכתבו לגילי {from}–{to}",
  "elev.gcare.hm.age.rangeOpen": "נכתבו לגיל {from} ומעלה",
  "elev.gcare.hm.age.child": "הילד או הילדה",
  "elev.gcare.hm.age.body.younger":
    "מדריכי הרגעים הקשים נכתבו לגילי {from}–{to}, והגיל של {who} נמוך מזה. הרשימה ריקה כי עדיין לא כתבנו את המדריכים האלה — ולא בגלל משהו אצל {who}.",
  "elev.gcare.hm.age.body.older":
    "מדריכי הרגעים הקשים נכתבו לגילי {from}–{to}, והגיל של {who} גבוה מזה. הרשימה ריקה כי עדיין לא כתבנו את המדריכים האלה — ולא בגלל משהו אצל {who}.",
  "elev.gcare.hm.age.body.gap":
    "מדריכי הרגעים הקשים נכתבו לגילי {from}–{to}, אבל אף אחד מהם לא מכסה בדיוק את הגיל של {who}. הרשימה ריקה בגלל מה שכתבנו עד היום, ולא בגלל משהו אצל {who}.",
  "elev.gcare.hm.age.body.unknown":
    "מדריכי הרגעים הקשים נכתבו לגילי {from}–{to}. הוסיפו תאריך לידה בפרופיל ונציג את המדריכים שנכתבו לגיל הזה.",
  "elev.gcare.hm.age.elsewhere": "אפשר לשאול את ארבור על הרגע שקורה עכשיו.",

  // ── GP-07 ─────────────────────────────────────────────────────────────────
  "elev.gcare.growth.link.timeline.label": "הסיפור",
  "elev.gcare.growth.link.timeline.sub": "חודש אחרי חודש, כל מה ששמרתם",

  // ── GP-10 ─────────────────────────────────────────────────────────────────
  "elev.gcare.ms.observe.yes": "ראיתי",
  "elev.gcare.ms.observePrompt": "סמנו מה ראיתם בפעם הראשונה",
  "elev.gcare.ms.noticedOn": "נצפה ב־{date}",
  "elev.gcare.ms.noticedUndated": "נצפה",

  // ── GP-11 ─────────────────────────────────────────────────────────────────
  "elev.gcare.screen.last.worth.one": "תחום אחד ששווה שיחה",
  "elev.gcare.screen.last.worth.many": "{n} תחומים ששווים שיחה",
  "elev.gcare.screen.calm.title": "מה עושים עם תוצאה רגועה",
  "elev.gcare.screen.calm.body":
    "אין כאן שום דבר שמבקש פעולה היום. הצעד הבא המועיל הוא הרגיל: לשחק יחד ולהמשיך לשים לב.",
  "elev.gcare.screen.calm.play": "רעיון למשחק היום",
  "elev.gcare.screen.calm.record": "פתחו את הרשומה",
  "elev.gcare.screen.draft.restored": "התשובות שהתחלתם קודם עדיין כאן.",
  "elev.gcare.screen.draft.clear": "לנקות ולהתחיל מחדש",

  // ── GP-34 ─────────────────────────────────────────────────────────────────
  "elev.gcare.screen.watch.title": "לשים לב לזה השבוע",
  "elev.gcare.screen.watch.body":
    "בחרו דבר אחד לשים לב אליו. הוא יהפוך למוקד השבוע במסך ההתפתחות, ובאותה הזדמנות נקבע גם תזכורת לבדיקה חוזרת.",
  "elev.gcare.screen.watch.cta": "לשים לב לזה",
  "elev.gcare.screen.watch.chosen": "שמים לב לזה השבוע",
  "elev.gcare.growth.watch.eyebrow": "בחרתם לשים לב לזה",
  "elev.gcare.growth.watch.clear": "להפסיק לשים לב לזה",

  // ── GP-33 ─────────────────────────────────────────────────────────────────
  "elev.gcare.lang.words.title": "המילים של {name}",
  "elev.gcare.lang.words.titleGeneric": "המילים ששמרתם",
  "elev.gcare.lang.words.count.one": "מילה אחת שמורה",
  "elev.gcare.lang.words.count.many": "{n} מילים שמורות",
  "elev.gcare.lang.words.empty": "עדיין לא נשמרו מילים. המילה הראשונה שתכתבו פותחת את הרשומה.",
  "elev.gcare.lang.words.add": "הוסיפו מילה ששמעתם",
};
