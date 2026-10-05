/* i18nElevation/childmemory — Wave L (2026-09-04): AI-11.
 *
 * Child Memory (components/sections/ChildMemory.tsx) is the surface where a
 * parent APPROVES, KEEPS or FORGETS what Arbor may remember about their child
 * — the consent surface of the whole memory moat. It shipped with its section
 * titles, its empty state and, worst of all, its three DECISION buttons
 * ("Approve" / "Dismiss" / "Forget") hard-coded in English. A Hebrew-reading
 * parent was being asked to make an irreversible privacy decision in a
 * language the rest of the app had already promised them it would not use.
 *
 * Register: parent, calm, plural Israeli-parent address. The buttons are
 * verbs, short, and unambiguous about direction: forget must never read as
 * merely concealing. (Prose deliberately unquoted — the icon-subset extractor
 * matches quoted lowercase words anywhere in a file, comments included, and a
 * quoted word that collides with a Material Symbols ligature is reported as a
 * phantom icon.)
 */

export const en: Record<string, string> = {

  // B-CAREPRO-25: the pending queue grouped by topic; the heading counts groups.
  "elev.childmem.pending.groups": "Pending your review: {count} topics",
  "elev.childmem.pending.groups.one": "Pending your review: 1 topic",
  "elev.childmem.pending.notes": "{count} notes waiting for you",
  "elev.childmem.pending.notes.one": "1 note waiting for you",
  "elev.childmem.group.other": "Other notes",
  "elev.childmem.group.similar": "{n} similar notes",
  "elev.childmem.group.seeAll": "See all {n}",
  "elev.childmem.group.seeLess": "Show fewer",
  "elev.childmem.group.dismissAll": "Dismiss all {n}",
  "elev.childmem.group.dismissConfirm": "Dismiss all {n} notes on this topic? Arbor will not remember them, and you can still approve new ones later.",
  "elev.childmem.group.dismissYes": "Yes, dismiss all",
  "elev.childmem.group.cancel": "Keep them",
  "elev.childmem.approved.title": "Approved memory",

  "elev.childmem.empty.title": "No memory yet",
  "elev.childmem.empty.body": "As you log moments and talk with Arbor, it will suggest facts about {name} for you to approve. Approved facts make every answer more personal.",
  // B-CAREPRO-06: an approved fact whose wording the plain-words scrub cannot keep.
  "elev.childmem.fact.unshown": "Kept as you approved it, but not shown here in clinical words. Edit it into your own words, or forget it.",


  "elev.childmem.action.approve": "Approve",
  "elev.childmem.action.remember": "Remember this",
  // Critic r1 (P0): since 34f4e13 parent-written facts are kept without a
  // queue, so every PENDING fact is a model inference — never "you wrote".
  "elev.childmem.provenance.inference": "Arbor noticed this in your conversation on {date}:",
  "elev.childmem.kept.topic": "Kept. Next time you ask about {topic}, Arbor will start from this.",
  "elev.childmem.kept.any": "Kept. Arbor will start from this the next time you ask.",
  "elev.childmem.action.dismiss": "Dismiss",
  "elev.childmem.action.forget": "Forget",

  // Builder M — R25 — #/memory demotion disclosure and its door to #/profile.
  "elev.childmem.more.title": "Moments and keepsakes",
  "elev.childmem.more.sub": "Firsts, what Arbor knows so far, and the keepsake for the month.",
  "elev.childmem.more.door": "Open the profile",
};

export const he: Record<string, string> = {

  "elev.childmem.pending.groups": "ממתין לאישורכם: {count} נושאים",
  "elev.childmem.pending.groups.one": "ממתין לאישורכם: נושא אחד",
  "elev.childmem.pending.notes": "{count} הערות מחכות לכם",
  "elev.childmem.pending.notes.one": "הערה אחת מחכה לכם",
  "elev.childmem.group.other": "הערות נוספות",
  "elev.childmem.group.similar": "{n} הערות דומות",
  "elev.childmem.group.seeAll": "להציג את כל ה-{n}",
  "elev.childmem.group.seeLess": "להציג פחות",
  "elev.childmem.group.dismissAll": "כל ה-{n} לא רלוונטיות",
  "elev.childmem.group.dismissConfirm": "לסמן את כל {n} ההערות בנושא הזה כלא רלוונטיות? ארבור לא יזכור אותן, ועדיין אפשר יהיה לאשר הערות חדשות בהמשך.",
  "elev.childmem.group.dismissYes": "כן, לסמן את כולן",
  "elev.childmem.group.cancel": "להשאיר אותן",
  "elev.childmem.approved.title": "זיכרון מאושר",

  "elev.childmem.empty.title": "עדיין אין זיכרון",
  "elev.childmem.empty.body": "ככל שתתעדו רגעים ותשוחחו עם ארבור, הוא יציע עובדות על {name} שתוכלו לאשר. עובדות מאושרות הופכות כל תשובה לאישית יותר.",
  "elev.childmem.fact.unshown": "נשמר כפי שאישרתם, אבל לא מוצג כאן במילים קליניות. ערכו אותו במילים שלכם, או בקשו לשכוח אותו.",


  "elev.childmem.action.approve": "אישור",
  "elev.childmem.action.remember": "לזכור את זה",
  "elev.childmem.provenance.inference": "ארבור שמה לב לזה בשיחה שלכם ב־{date}:",
  "elev.childmem.kept.topic": "נשמר. בפעם הבאה שתשאלו על {topic}, ארבור יתחיל מזה.",
  "elev.childmem.kept.any": "נשמר. ארבור יתחיל מזה בפעם הבאה שתשאלו.",
  "elev.childmem.action.dismiss": "לא רלוונטי",
  "elev.childmem.action.forget": "לשכוח",

  // Builder M — R25 — #/memory demotion disclosure and its door to #/profile.
  "elev.childmem.more.title": "רגעים ומזכרות",
  "elev.childmem.more.sub": "פעמים ראשונות, מה ארבור יודע עד כה והמזכרת של החודש.",
  "elev.childmem.more.door": "פתחו את הפרופיל",
};
