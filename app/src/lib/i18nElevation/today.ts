/* i18nElevation/today — E4 "Today as conductor" strings: the time-aware hero
 * (play-quest vs wind-down capture), the family-system mini-card grid, and the
 * Kid Mode mini-card pulse.
 *
 * CLINICAL FIREWALL: every number rendered with these keys is a COUNT or a
 * plain activity fact — never a percentage, verdict, trend delta, or deficit
 * framing.
 * Hebrew = transcreation in a calm Israeli-parent register (outcome language,
 * no AI/tech framing); flagged for arbor-localization native review. */

export const en: Record<string, string> = {
  // ── E4 · Time-aware hero — play variant (morning / calm window)
  "elev.hero.today.play.eyebrow": "Today · Time together",
  "elev.hero.today.play.title": "A good moment for today's little quest with {name}",
  "elev.hero.today.play.cta": "Start today's quest",

  // ── E4 · Time-aware hero — capture variant (evening / wind-down)
  "elev.hero.today.capture.eyebrow": "Today · Wind-down",
  "elev.hero.today.capture.title": "Keep one small moment from today — Arbor remembers it for you",
  "elev.hero.today.capture.cta": "Capture a moment",

  // ── E4 · Hero stat labels (counts only)
  "elev.hero.today.stat.captured": "captured today",
  "elev.hero.today.stat.week": "this week",
  "elev.hero.today.stat.story": "moments in the story",

  // ── E4 · Family-system grid (live mini-cards, one per hub)
  "elev.today.family.title": "The whole picture",
  "elev.today.family.sub": "Everything Arbor is holding for you, at a glance",
  "elev.today.hub.behaviors": "Moments",
  "elev.today.hub.growth": "Growth",
  "elev.today.hub.academy": "Academy",
  "elev.today.hub.care": "Care Network",
  "elev.today.hub.profile": "Profile",
  "elev.today.hub.kidmode": "Kid Mode",

  // ── E4 · Kid Mode mini-card pulse (quest completions today — a count)
  "elev.pulse.kidmode.quests": "{count} quests completed today",
  "elev.pulse.kidmode.questsOne": "1 quest completed today",
  "elev.pulse.kidmode.empty": "Quests are ready — hand over the device",
  // B-TODAY-09: the step card's ONE seeded ask (was "Begin").
  "elev.today.askAbout": "Ask about this",
  // B-TODAY-13: the rhythm line's quiet door to #/day-windows.
  "elev.today.dw.link": "See the hours",
  // B-TODAY-19: the capture sheet's photo mode.
  "elev.capture.photo.label": "What's in the photo? (optional)",
  "elev.capture.photo.caption": "A photo moment",
  "elev.capture.photo.alt": "The photo you added",
  "elev.capture.photo.remove": "Remove photo",
  // B-TODAY-10: the capture bar's "Hard moment" tile and its sheet header.
  "elev.capture.hard.tile": "Hard moment",
  "elev.capture.hard.aria": "Hard moment now — words to use and what to do",
  "elev.capture.hard.title": "Hard moment now",
  "elev.capture.hard.lead": "Matched to the moments you logged. Use what helps.",
  "elev.capture.hard.logLead": "When it has passed, you can keep a note of it.",
  // B-TODAY-20: the capture sheet's reply after Save (no counts about the
  // child, no comparison — the echo line is elev.closeloop.echo.title).
  "elev.capture.reply.kept": "Kept in {name}'s journal",
  "elev.capture.reply.ask": "Ask Arbor about this",
  "elev.capture.reply.seed": "I just noted this about {name}: \"{text}\". What might it tell me, and is there one small thing I could try?",
  "elev.capture.reply.undo": "Undo",
  "elev.capture.reply.done": "Done",
  "elev.capture.reply.undone": "Removed from the journal.",
  // B-TODAY-18: the family line (one line per sibling, under the step).
  "elev.brief.family.aria": "Waiting for your other children",
  // B-TODAY-12: Ask's door to the grounded step that lives on Today's card.
  "elev.brief.grounded.open": "See it on Today",
  "elev.brief.hardMoment.why": "Picked from a pilot guide that matches moments you logged.",
  // B-TODAY-24: a why-line part, only when the server used approved facts.
  "elev.brief.why.facts": "{n} things you told Arbor",
  "elev.brief.why.facts.one": "1 thing you told Arbor",
  // B-TODAY-21: the ONE "What changed since you left" card — events and
  // counts only (no delta, comparison, total or verdict in either locale).
  "elev.brief.changed.title": "What changed since you left",
  "elev.brief.changed.milestone": "Noticed: {title}",
  "elev.brief.changed.step.helped": "You tried “{step}” — it helped",
  "elev.brief.changed.step.somewhat": "You tried “{step}” — it helped a little",
  "elev.brief.changed.facts.one": "1 new thing you approved about {name}",
  "elev.brief.changed.facts.many": "{n} new things you approved about {name}",
  "elev.brief.changed.moments.one": "1 moment kept",
  "elev.brief.changed.moments.many": "{n} moments kept",
  // B-TODAY-23: Weekly's "New this week" card counts "Keep this" ideas too.
  "elev.brief.changed.ideas.one": "1 idea you kept",
  "elev.brief.changed.ideas.many": "{n} ideas you kept",
  // B-TODAY-26: Tonight in the step slot, and the day-close line. The count
  // is today's moments (the day-close signal); no timer, no streak.
  "elev.tonight.eyebrow": "Tonight",
  "elev.tonight.headline.many": "Read tonight's story from today's {n} moments",
  "elev.tonight.headline.one": "Read tonight's story from today's moment",
  "elev.tonight.headline.none": "Read a story with {name} tonight",
  "elev.tonight.read": "Open tonight's story",
  "elev.tonight.routine": "Wind-down routine",
  "elev.dayclose.kept.many": "Kept today: {n} moments",
  "elev.dayclose.kept.one": "Kept today: 1 moment",
  "elev.dayclose.kept.none": "Nothing kept today",
  "elev.dayclose.goodnight": "Good night",
};

export const he: Record<string, string> = {
  "elev.hero.today.play.eyebrow": "היום · זמן ביחד",
  "elev.hero.today.play.title": "רגע טוב למשימה הקטנה של היום עם {name}",
  "elev.hero.today.play.cta": "מתחילים את המשימה של היום",

  "elev.hero.today.capture.eyebrow": "היום · סוף היום",
  "elev.hero.today.capture.title": "שווה לשמור רגע קטן אחד מהיום — ארבור זוכרת בשבילכם",
  "elev.hero.today.capture.cta": "לשמור רגע מהיום",

  "elev.hero.today.stat.captured": "נשמרו היום",
  "elev.hero.today.stat.week": "השבוע",
  "elev.hero.today.stat.story": "רגעים בסיפור",

  "elev.today.family.title": "התמונה המלאה",
  "elev.today.family.sub": "כל מה שארבור שומרת בשבילכם, במבט אחד",
  "elev.today.hub.behaviors": "רגעים",
  "elev.today.hub.growth": "התפתחות",
  "elev.today.hub.academy": "אקדמיה",
  "elev.today.hub.care": "רשת תמיכה",
  "elev.today.hub.profile": "פרופיל",
  "elev.today.hub.kidmode": "מצב ילדים",

  "elev.pulse.kidmode.quests": "{count} משימות הושלמו היום",
  "elev.pulse.kidmode.questsOne": "משימה אחת הושלמה היום",
  "elev.pulse.kidmode.empty": "המשימות מוכנות — אפשר למסור את המכשיר",
  "elev.today.askAbout": "לשאול על זה",
  "elev.today.dw.link": "לשעות היום",
  "elev.capture.photo.label": "מה רואים בתמונה? (רשות)",
  "elev.capture.photo.caption": "רגע בתמונה",
  "elev.capture.photo.alt": "התמונה שהוספתם",
  "elev.capture.photo.remove": "להסיר את התמונה",
  "elev.capture.hard.tile": "רגע קשה",
  "elev.capture.hard.aria": "רגע קשה עכשיו — מה להגיד ומה לעשות",
  "elev.capture.hard.title": "רגע קשה עכשיו",
  "elev.capture.hard.lead": "מותאם לרגעים שתיעדתם. קחו את מה שעוזר.",
  "elev.capture.hard.logLead": "כשזה עובר, אפשר לשמור על זה הערה.",
  "elev.capture.reply.kept": "נשמר ביומן של {name}",
  "elev.capture.reply.ask": "לשאול את ארבור על זה",
  "elev.capture.reply.seed": "רשמתי עכשיו משהו על {name}: \"{text}\". מה זה יכול לספר לי, והאם יש דבר קטן אחד שכדאי לנסות?",
  // P5 r1 A10 (r3 G1-8): "ביטול" read as Cancel; the reply removes the saved moment.
  "elev.capture.reply.undo": "בטל שמירה",
  "elev.capture.reply.done": "סיום",
  "elev.capture.reply.undone": "הוסר מהיומן.",
  "elev.brief.family.aria": "מה מחכה לשאר הילדים",
  "elev.brief.grounded.open": "לראות בעמוד היום",
  "elev.brief.hardMoment.why": "נבחר ממדריך פיילוט שמתאים לרגעים שתיעדתם.",
  "elev.brief.why.facts": "{n} דברים שסיפרתם לארבור",
  "elev.brief.why.facts.one": "דבר אחד שסיפרתם לארבור",
  "elev.brief.changed.title": "מה חדש מאז שהייתם כאן",
  "elev.brief.changed.milestone": "שמתם לב: {title}",
  "elev.brief.changed.step.helped": "ניסיתם „{step}” — זה עזר",
  "elev.brief.changed.step.somewhat": "ניסיתם „{step}” — זה עזר קצת",
  "elev.brief.changed.facts.one": "דבר חדש אחד שאישרתם על {name}",
  "elev.brief.changed.facts.many": "{n} דברים חדשים שאישרתם על {name}",
  "elev.brief.changed.moments.one": "רגע אחד נשמר",
  "elev.brief.changed.moments.many": "{n} רגעים נשמרו",
  "elev.brief.changed.ideas.one": "רעיון אחד ששמרתם",
  "elev.brief.changed.ideas.many": "{n} רעיונות ששמרתם",
  "elev.tonight.eyebrow": "הערב",
  "elev.tonight.headline.many": "קראו את הסיפור של הערב מ־{n} הרגעים של היום",
  "elev.tonight.headline.one": "קראו את הסיפור של הערב מהרגע של היום",
  "elev.tonight.headline.none": "קראו סיפור עם {name} הערב",
  "elev.tonight.read": "לסיפור של הערב",
  "elev.tonight.routine": "שגרת ההרגעה",
  "elev.dayclose.kept.many": "נשמרו היום: {n} רגעים",
  "elev.dayclose.kept.one": "נשמר היום: רגע אחד",
  "elev.dayclose.kept.none": "היום לא נשמר רגע",
  "elev.dayclose.goodnight": "לילה טוב",
};
