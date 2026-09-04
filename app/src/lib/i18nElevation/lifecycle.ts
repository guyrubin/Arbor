/* i18nElevation/lifecycle — Wave E (E1) lifecycle & re-engagement copy.
 *
 * One card, one moment, one open. The strings here are keyed by the moment
 * kinds lib/lifecycle.ts resolves:
 *   · back.*     — ENG-L5 / ENG-20(a): a return after fourteen quiet days.
 *   · birthday.* — ENG-20(b): the child's birthday, as a calendar fact.
 *   · band.*     — ENG-20(c): the child moved into a new age band.
 *   · week.*     — ENG-L3: the first-week keepsake, plus the first recap.
 *   · first.*    — ENG-L0: the first captured moment, and tonight's story.
 *   · loves.*    — ENG-L2: "tell Arbor one thing {name} loves".
 *   · d1.*       — ENG-L1: day one, framed forward.
 *   · stat.*     — the three count labels every keepsake card renders.
 *
 * NO LOSS FRAME. Nothing on a return references the absence: no streak, no
 * "you missed", no "it's been a while", no counter that can fall. The welcome
 * is anchored on the CHILD's age, which only ever moves forward. The ban list
 * lives in lib/lifecycle.ts (LIFECYCLE_LOSS_FRAME_BANS) and the guard test
 * scans both dictionaries against it.
 *
 * NOTHING WAS SENT. There is no push, no email and no local notification
 * behind any of this — every string is surfaced IN APP on the next open. So no
 * value may imply Arbor reached out, reminded, pinged or notified anyone.
 *
 * CLINICAL FIREWALL. Every number here is a COUNT of what the parent captured
 * or noticed, or the child's age. No score, no percentage, no band/verdict
 * word about the child, no weakest-domain pointer, no period-vs-period delta.
 * "Age band" copy names a stage of childhood, never a level the child reached.
 *
 * Hebrew = calm Israeli-parent transcreation (outcome language, no tech
 * framing), gender-neutral where the child's gender is unknown; flagged for
 * arbor-localization native review.
 */

export const en: Record<string, string> = {
  // ── Shared chrome ─────────────────────────────────────────────────────────
  "elev.lifecycle.aria": "A moment in {name}'s story",
  "elev.lifecycle.dismiss": "Dismiss",
  "elev.lifecycle.stat.total": "moments kept",
  "elev.lifecycle.stat.week": "this week",
  "elev.lifecycle.stat.noticed": "milestones noticed",

  // ── ENG-L5 / ENG-20(a): the return, anchored on the child, never the gap ──
  "elev.lifecycle.back.eyebrow": "Welcome back",
  "elev.lifecycle.back.title": "{name} is {age} now",
  "elev.lifecycle.back.body":
    "Everything you kept is still here, exactly as you left it. Pick up wherever suits you today.",
  "elev.lifecycle.back.cta": "See what is here",

  // ── ENG-20(b): birthday ───────────────────────────────────────────────────
  "elev.lifecycle.birthday.eyebrow": "Today",
  "elev.lifecycle.birthday.title": "Happy birthday, {name}",
  "elev.lifecycle.birthday.body":
    "{name} is {age} today. Here is the record you have kept together so far.",
  "elev.lifecycle.birthday.cta": "Open the growth picture",

  // ── ENG-20(c): a new age band ─────────────────────────────────────────────
  "elev.lifecycle.band.eyebrow": "A new stage",
  "elev.lifecycle.band.title": "{name} is {age} — new ground to explore",
  "elev.lifecycle.band.body":
    "Play ideas and things to notice have moved with {name}. Nothing you kept has changed.",
  "elev.lifecycle.band.cta": "See what is new",

  // ── ENG-L3: the first-week keepsake ───────────────────────────────────────
  "elev.lifecycle.week.eyebrow": "One week together",
  "elev.lifecycle.week.title": "{name}'s first week",
  "elev.lifecycle.week.body":
    "A week of paying attention, kept in one place. This is what you built.",
  "elev.lifecycle.week.cta": "Read the first recap",

  // ── ENG-L0: the first captured moment ─────────────────────────────────────
  "elev.lifecycle.first.eyebrow": "The first one",
  "elev.lifecycle.first.title": "{name}'s story has its first moment",
  "elev.lifecycle.first.body":
    "That is all it takes to start. Tonight you can read it back as a bedtime story.",
  "elev.lifecycle.first.cta": "Tonight's story",

  // ── ENG-L2: one thing they love ───────────────────────────────────────────
  "elev.lifecycle.loves.eyebrow": "One small thing",
  "elev.lifecycle.loves.title": "Tell Arbor one thing {name} loves",
  "elev.lifecycle.loves.body":
    "Play ideas start using it straight away — you will see it named on the reason line.",
  "elev.lifecycle.loves.placeholder": "Trains, the bath, grandma's dog…",
  "elev.lifecycle.loves.add": "Add",
  "elev.lifecycle.loves.save": "Save",
  "elev.lifecycle.loves.aria": "Things {name} loves",
  "elev.lifecycle.loves.saved": "Saved — play ideas will use this from now on.",

  // ── ENG-L1: day one ───────────────────────────────────────────────────────
  "elev.lifecycle.d1.eyebrow": "Day two",
  "elev.lifecycle.d1.title": "Yesterday is kept. Today needs one thing.",
  "elev.lifecycle.d1.body":
    "Twenty seconds is a full entry. One line about {name} is enough for today.",
  "elev.lifecycle.d1.cta": "Add today's moment",
};

export const he: Record<string, string> = {
  // ── Shared chrome ─────────────────────────────────────────────────────────
  "elev.lifecycle.aria": "רגע בסיפור של {name}",
  "elev.lifecycle.dismiss": "סגירה",
  "elev.lifecycle.stat.total": "רגעים שנשמרו",
  "elev.lifecycle.stat.week": "השבוע",
  "elev.lifecycle.stat.noticed": "אבני דרך שראיתם",

  // ── ENG-L5 / ENG-20(a) ────────────────────────────────────────────────────
  "elev.lifecycle.back.eyebrow": "טוב לראות אתכם",
  "elev.lifecycle.back.title": "{name} בן/בת {age} עכשיו",
  "elev.lifecycle.back.body":
    "כל מה ששמרתם נמצא כאן, בדיוק כמו שהשארתם. אפשר להמשיך מאיפה שנוח לכם היום.",
  "elev.lifecycle.back.cta": "לראות מה יש כאן",

  // ── ENG-20(b) ─────────────────────────────────────────────────────────────
  "elev.lifecycle.birthday.eyebrow": "היום",
  "elev.lifecycle.birthday.title": "יום הולדת שמח, {name}",
  "elev.lifecycle.birthday.body":
    "{name} בן/בת {age} היום. הנה התיעוד שאספתם יחד עד כה.",
  "elev.lifecycle.birthday.cta": "לפתוח את תמונת ההתפתחות",

  // ── ENG-20(c) ─────────────────────────────────────────────────────────────
  "elev.lifecycle.band.eyebrow": "שלב חדש",
  "elev.lifecycle.band.title": "{name} בן/בת {age} — יש שטח חדש לגלות",
  "elev.lifecycle.band.body":
    "רעיונות למשחק ודברים שכדאי לשים לב אליהם התקדמו יחד עם {name}. שום דבר ממה ששמרתם לא השתנה.",
  "elev.lifecycle.band.cta": "לראות מה חדש",

  // ── ENG-L3 ────────────────────────────────────────────────────────────────
  "elev.lifecycle.week.eyebrow": "שבוע יחד",
  "elev.lifecycle.week.title": "השבוע הראשון של {name}",
  "elev.lifecycle.week.body":
    "שבוע של תשומת לב, שמור במקום אחד. זה מה שבניתם.",
  "elev.lifecycle.week.cta": "לקרוא את הסיכום הראשון",

  // ── ENG-L0 ────────────────────────────────────────────────────────────────
  "elev.lifecycle.first.eyebrow": "הראשון",
  "elev.lifecycle.first.title": "לסיפור של {name} יש רגע ראשון",
  "elev.lifecycle.first.body":
    "זה כל מה שצריך כדי להתחיל. הערב אפשר לקרוא אותו בחזרה כסיפור לפני השינה.",
  "elev.lifecycle.first.cta": "הסיפור של הערב",

  // ── ENG-L2 ────────────────────────────────────────────────────────────────
  "elev.lifecycle.loves.eyebrow": "דבר קטן אחד",
  "elev.lifecycle.loves.title": "ספרו לארבור על דבר אחד ש{name} אוהב/ת",
  "elev.lifecycle.loves.body":
    "רעיונות המשחק מתחילים להשתמש בזה מיד — תראו את זה מופיע בשורת ההסבר.",
  "elev.lifecycle.loves.placeholder": "רכבות, אמבטיה, הכלב של סבתא…",
  "elev.lifecycle.loves.add": "הוספה",
  "elev.lifecycle.loves.save": "שמירה",
  "elev.lifecycle.loves.aria": "דברים ש{name} אוהב/ת",
  "elev.lifecycle.loves.saved": "נשמר — רעיונות המשחק ישתמשו בזה מעכשיו.",

  // ── ENG-L1 ────────────────────────────────────────────────────────────────
  "elev.lifecycle.d1.eyebrow": "היום השני",
  "elev.lifecycle.d1.title": "אתמול שמור. להיום צריך דבר אחד.",
  "elev.lifecycle.d1.body":
    "עשרים שניות הן רשומה שלמה. שורה אחת על {name} מספיקה להיום.",
  "elev.lifecycle.d1.cta": "להוסיף את הרגע של היום",
};
