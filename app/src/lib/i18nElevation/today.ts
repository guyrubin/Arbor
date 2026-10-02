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
};
