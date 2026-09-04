/* i18nElevation/returnhooks — Wave E (2026-09-04): ENG-23, ENG-25, TJB-28.
 *
 * The three "why would a parent come back" strings families:
 *
 *  - ENG-23 (push priming): the Growth push switch shipped as a bare toggle at
 *    the very bottom of the page with no priming and NO honest statement of
 *    what it does. Arbor has no delivery path today (lib/push is inert without
 *    VITE_FIREBASE_VAPID_KEY), so the default copy here SAYS SO instead of
 *    promising a notification that can never arrive. The opt-in copy only
 *    appears in the build where the capability is actually present.
 *  - ENG-25 (Family Rituals cadence): each ritual carried a prose cadence
 *    ("Weekly, same evening each week") that nothing ever acted on. These are
 *    the strings for the real, in-app return: the ritual that is due now,
 *    surfaced the next time the parent opens Arbor.
 *  - TJB-28 ("Tomorrow's reason"): one concrete thing the parent left for
 *    themselves at the close of a day, shown on the next open. In-app only —
 *    Arbor does not send anything anywhere.
 *
 * CLINICAL FIREWALL: every string here describes the PARENT's own next move,
 * the HOUR, or a plain fact about what Arbor holds. Nothing grades the child,
 * ranks a domain, or carries a good/bad colour word. No streak, no guilt, no
 * "you missed" framing (AADC).
 *
 * Hebrew = calm Israeli-parent transcreation, plural address, gender-neutral
 * where the child is the subject; flagged for arbor-localization review.
 */

export const en: Record<string, string> = {
  // ── ENG-23 — the reminders card on Growth ───────────────────────────────
  "elev.rh.push.title": "Reminders",
  // The honest default: no delivery path exists, so the card promises nothing.
  "elev.rh.push.inapp.body":
    "Arbor does not send phone alerts. Anything worth your attention waits here and is the first thing you see next time you open the app.",
  "elev.rh.push.inapp.note": "Nothing is sent to you, and nothing leaves this device unasked.",
  // The opt-in path — only in a build where the capability is really present.
  "elev.rh.push.offer.body":
    "Arbor can send one quiet reminder a day to this device. You choose it, and you can switch it off in one tap.",
  "elev.rh.push.offer.point.one": "At most one a day, never at night.",
  "elev.rh.push.offer.point.two": "No name, no note, nothing about your child in it.",
  "elev.rh.push.offer.point.three": "Off again in one tap, on this screen.",
  "elev.rh.push.on.body": "This device gets one quiet reminder a day. Switch it off any time.",
  "elev.rh.push.blocked.body":
    "This browser is turning reminders down before Arbor sees them. You can change that in the site settings for this page — until then, everything still waits for you here.",
  "elev.rh.push.toggle.label": "Send one reminder a day",
  "elev.rh.push.toggle.sub": "To this device only",

  // ── ENG-25 — the ritual whose turn it is ────────────────────────────────
  "elev.rh.ritual.eyebrow": "Your family ritual",
  "elev.rh.ritual.first": "You have not run this one yet.",
  "elev.rh.ritual.turn": "It is this one's turn again.",
  "elev.rh.ritual.every.week": "Once a week",
  "elev.rh.ritual.every.month": "Once a month",
  "elev.rh.ritual.every.days": "Every {n} days",
  "elev.rh.ritual.steps": "How it goes",
  "elev.rh.ritual.did": "We did this",
  "elev.rh.ritual.open": "Open Family Formation",
  "elev.rh.ritual.next": "Back in {n} days.",
  "elev.rh.ritual.nextTomorrow": "Back tomorrow.",
  "elev.rh.ritual.settled": "Every ritual has had its turn this round. Nothing is waiting.",

  // ── TJB-28 — tomorrow's reason ──────────────────────────────────────────
  "elev.rh.tomorrow.eyebrow": "You left this for today",
  "elev.rh.tomorrow.ritual.title": "A family ritual is waiting",
  "elev.rh.tomorrow.ritual.body": "Ten minutes at the table is the whole of it.",
  "elev.rh.tomorrow.ritual.cta": "Open the ritual",
  "elev.rh.tomorrow.story.title": "A story you have not opened",
  "elev.rh.tomorrow.story.body": "The shelf still has a book {name} has never been the hero of.",
  "elev.rh.tomorrow.story.cta": "Open the shelf",
  "elev.rh.tomorrow.focus.title": "The thing you chose to watch for",
  "elev.rh.tomorrow.focus.body": "You picked one thing to look out for with {name}. Today is a good day for it.",
  "elev.rh.tomorrow.focus.cta": "See what you chose",
  "elev.rh.tomorrow.moment.title": "One moment with {name}",
  "elev.rh.tomorrow.moment.body": "Write down one thing you saw. That is the whole ask.",
  "elev.rh.tomorrow.moment.cta": "Write it down",
  "elev.rh.tomorrow.dismiss": "Not today",
  "elev.rh.tomorrow.dismissAria": "Put this away for now",
};

export const he: Record<string, string> = {
  // ── ENG-23 ──────────────────────────────────────────────────────────────
  "elev.rh.push.title": "תזכורות",
  "elev.rh.push.inapp.body":
    "ארבור לא שולח התראות לטלפון. כל מה שראוי לתשומת לבכם ממתין כאן, והוא הדבר הראשון שתראו בפעם הבאה שתפתחו את האפליקציה.",
  "elev.rh.push.inapp.note": "שום דבר לא נשלח אליכם, ושום דבר לא יוצא מהמכשיר הזה בלי שביקשתם.",
  "elev.rh.push.offer.body":
    "ארבור יכול לשלוח תזכורת שקטה אחת ביום למכשיר הזה. אתם בוחרים, ואפשר לכבות בלחיצה אחת.",
  "elev.rh.push.offer.point.one": "אחת ביום לכל היותר, אף פעם לא בלילה.",
  "elev.rh.push.offer.point.two": "בלי שם, בלי פתק, בלי שום דבר על הילד שלכם.",
  "elev.rh.push.offer.point.three": "כיבוי בלחיצה אחת, במסך הזה.",
  "elev.rh.push.on.body": "המכשיר הזה מקבל תזכורת שקטה אחת ביום. אפשר לכבות בכל רגע.",
  "elev.rh.push.blocked.body":
    "הדפדפן הזה חוסם תזכורות עוד לפני שארבור רואה אותן. אפשר לשנות זאת בהגדרות האתר של הדף — ועד אז, הכול ממשיך להמתין לכם כאן.",
  "elev.rh.push.toggle.label": "תזכורת אחת ביום",
  "elev.rh.push.toggle.sub": "למכשיר הזה בלבד",

  // ── ENG-25 ──────────────────────────────────────────────────────────────
  "elev.rh.ritual.eyebrow": "הטקס המשפחתי שלכם",
  "elev.rh.ritual.first": "את זה עוד לא עשיתם.",
  "elev.rh.ritual.turn": "הגיע שוב תורו של הטקס הזה.",
  "elev.rh.ritual.every.week": "פעם בשבוע",
  "elev.rh.ritual.every.month": "פעם בחודש",
  "elev.rh.ritual.every.days": "כל {n} ימים",
  "elev.rh.ritual.steps": "איך זה הולך",
  "elev.rh.ritual.did": "עשינו את זה",
  "elev.rh.ritual.open": "פתחו את בניית המשפחה",
  "elev.rh.ritual.next": "חוזר בעוד {n} ימים.",
  "elev.rh.ritual.nextTomorrow": "חוזר מחר.",
  "elev.rh.ritual.settled": "כל הטקסים קיבלו את תורם בסבב הזה. שום דבר לא ממתין.",

  // ── TJB-28 ──────────────────────────────────────────────────────────────
  "elev.rh.tomorrow.eyebrow": "השארתם את זה להיום",
  "elev.rh.tomorrow.ritual.title": "טקס משפחתי ממתין",
  "elev.rh.tomorrow.ritual.body": "עשר דקות ליד השולחן, וזהו.",
  "elev.rh.tomorrow.ritual.cta": "פתחו את הטקס",
  "elev.rh.tomorrow.story.title": "סיפור שעוד לא פתחתם",
  "elev.rh.tomorrow.story.body": "על המדף יש ספר ש{name} עוד לא היה הגיבור שלו.",
  "elev.rh.tomorrow.story.cta": "פתחו את המדף",
  "elev.rh.tomorrow.focus.title": "הדבר שבחרתם לשים לב אליו",
  "elev.rh.tomorrow.focus.body": "בחרתם דבר אחד לשים לב אליו עם {name}. היום זה יום טוב בשבילו.",
  "elev.rh.tomorrow.focus.cta": "ראו מה בחרתם",
  "elev.rh.tomorrow.moment.title": "רגע אחד עם {name}",
  "elev.rh.tomorrow.moment.body": "כתבו דבר אחד שראיתם. זו כל הבקשה.",
  "elev.rh.tomorrow.moment.cta": "כתבו את זה",
  "elev.rh.tomorrow.dismiss": "לא היום",
  "elev.rh.tomorrow.dismissAria": "הסתירו את זה לעכשיו",
};
