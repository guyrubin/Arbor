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
  "elev.childmem.eyebrow": "My Child",
  "elev.childmem.trustNote": "You control everything here. Nothing is shared without your approval.",

  "elev.childmem.pending.title": "Pending your review ({count})",
  "elev.childmem.approved.title": "Approved memory",

  "elev.childmem.empty.title": "No memory yet",
  "elev.childmem.empty.body": "As you log moments and talk with Arbor, it will suggest facts about {name} for you to approve. Approved facts make every answer more personal.",

  "elev.childmem.timeBoxed": "Time-boxed · {retention}",

  "elev.childmem.action.approve": "Approve",
  "elev.childmem.action.dismiss": "Dismiss",
  "elev.childmem.action.forget": "Forget",
};

export const he: Record<string, string> = {
  "elev.childmem.eyebrow": "הילד שלי",
  "elev.childmem.trustNote": "אתם שולטים בכל מה שכאן. שום דבר לא משותף בלי האישור שלכם.",

  "elev.childmem.pending.title": "ממתין לאישורכם ({count})",
  "elev.childmem.approved.title": "זיכרון מאושר",

  "elev.childmem.empty.title": "עדיין אין זיכרון",
  "elev.childmem.empty.body": "ככל שתתעדו רגעים ותשוחחו עם ארבור, הוא יציע עובדות על {name} שתוכלו לאשר. עובדות מאושרות הופכות כל תשובה לאישית יותר.",

  "elev.childmem.timeBoxed": "מוגבל בזמן · {retention}",

  "elev.childmem.action.approve": "אישור",
  "elev.childmem.action.dismiss": "לא רלוונטי",
  "elev.childmem.action.forget": "לשכוח",
};
