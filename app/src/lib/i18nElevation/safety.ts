/* i18nElevation/safety — W0.2 (Safety screen can actually summon help).
 *
 * Every user-visible string on src/components/tabs/SafetyTab.tsx: crisis
 * script, the tel:-linked crisis-helpline directory (labels keyed by
 * HELPLINE_DIRECTORY ids from src/safety/escalation.ts —
 * `elev.safety.helpline.<id>`), warning-sign checklist, safety review,
 * emergency contacts, approved-memory list and the static safeguards.
 *
 * CLINICAL FIREWALL: plain facts and instructions only — no percentages,
 * verdicts, or deficit framing. Crisis copy leads with emergency services.
 * Hebrew = transcreation in a calm Israeli-parent register (outcome language,
 * no AI/tech framing); flagged for arbor-localization native review. */

export const en: Record<string, string> = {
  // ── Header
  "elev.safety.header.title": "Safety & Escalation",
  "elev.safety.header.sub": "Emergency contacts and crisis language — ready the moment you need them.",

  // ── Crisis script (pinned)
  "elev.safety.crisis.kicker": "Crisis script — say this",
  "elev.safety.crisis.script": "“I am here. You are safe. I am not going anywhere. We will get through this moment together, and then we will figure out the next step — you don’t have to do it alone.”",
  "elev.safety.crisis.danger": "If there is immediate danger to your child or others, contact local emergency services first.",

  // ── Crisis helplines (tel: directory)
  "elev.safety.helplines.title": "Crisis helplines",
  "elev.safety.helplines.sub": "Tap a number to call.",
  "elev.safety.helplines.group.il": "Israel",
  "elev.safety.helplines.group.eu": "European Union",
  "elev.safety.helplines.group.nl": "Netherlands",
  "elev.safety.helplines.group.be": "Belgium",
  "elev.safety.helplines.group.us": "United States",
  "elev.safety.helpline.il_eran": "ERAN emotional first aid (24/7)",
  "elev.safety.helpline.il_mda": "Magen David Adom — ambulance",
  "elev.safety.helpline.il_police": "Police",
  "elev.safety.helpline.eu_112": "Emergency services (EU-wide; also from mobiles in Israel)",
  "elev.safety.helpline.nl_113": "113 Suicide Prevention (free)",
  "elev.safety.helpline.be_1813": "Zelfmoordlijn — suicide prevention",
  "elev.safety.helpline.be_1712": "Violence & abuse line",
  "elev.safety.helpline.us_988": "988 Suicide & Crisis Lifeline",
  "elev.safety.helpline.us_911": "Emergency services",
  "elev.safety.helplines.findLocal": "Country not listed? Find a local helpline",

  // ── Escalation checklist — warning signs
  "elev.safety.checklist.title": "Escalation checklist — warning signs",
  "elev.safety.sign.1": "Sudden loss of previously mastered skills (regression)",
  "elev.safety.sign.2": "Talk of self-harm or harming others",
  "elev.safety.sign.3": "Persistent withdrawal from people and play",
  "elev.safety.sign.4": "Sleep or appetite change lasting more than two weeks",
  "elev.safety.sign.5": "Injury, fever, or a medical concern needing review",
  "elev.safety.sign.6": "Escalating aggression that endangers self or others",
  "elev.safety.checklist.note": "Any checked sign is a prompt to consult a professional promptly.",

  // ── Safety review
  "elev.safety.review.title": "Safety review",
  "elev.safety.review.mark": "Mark reviewed",
  "elev.safety.review.last": "Last reviewed:",
  "elev.safety.review.never": "never",
  "elev.safety.review.stale": "It’s been a while — review safety info monthly to keep it current.",

  // ── Emergency contacts
  "elev.safety.contacts.title": "Emergency contacts",
  "elev.safety.contacts.name": "Name",
  "elev.safety.contacts.role": "Role (e.g. Pediatrician)",
  "elev.safety.contacts.phone": "Phone",
  "elev.safety.contacts.notes": "Notes",

  // ── What Arbor knows (approved memory)
  "elev.safety.memory.title": "What Arbor knows about {name}",
  "elev.safety.memory.sub": "Only parent-approved observations become active memory. Forget any of them at any time.",
  "elev.safety.memory.empty": "No approved memory yet. Approve observations from the Child Memory queue.",
  "elev.safety.memory.forget": "Forget",

  // ── Static safeguards
  "elev.safety.guard.medical.title": "Medical escalation safeguard",
  "elev.safety.guard.medical.body": "The Parent Coach screens high-risk terms (fever, injury, self-harm, abuse, regression, severe distress) and routes parents toward professional or urgent support.",
  "elev.safety.guard.gdpr.title": "GDPR & data minimization",
  "elev.safety.guard.gdpr.body": "Arbor is designed for GDPR-aligned children’s data minimization. No unsupervised AI interaction for children; details are stored as parent-approved observations.",
  "elev.safety.guard.handoff.title": "Multi-professional handoff",
  "elev.safety.guard.handoff.body": "The printable summary bridges home observations with specialized care profiles, giving teachers and clinics non-diagnosing observational context instantly.",
};

export const he: Record<string, string> = {
  // ── Header
  "elev.safety.header.title": "בטיחות ועזרה מיידית",
  "elev.safety.header.sub": "אנשי קשר לחירום ומילים לרגעי משבר — מוכנים בדיוק לרגע שבו תצטרכו אותם.",

  // ── Crisis script (pinned)
  "elev.safety.crisis.kicker": "מילים לרגע משבר — אמרו כך",
  "elev.safety.crisis.script": "“אני כאן. אני איתך, ואני נשאר כאן. נעבור את הרגע הזה ביחד, ואחר כך נחשוב ביחד מה הצעד הבא — לא צריך להתמודד עם זה לבד.”",
  "elev.safety.crisis.danger": "אם יש סכנה מיידית לילד או לאחרים, פנו קודם כול לשירותי החירום המקומיים.",

  // ── Crisis helplines (tel: directory)
  "elev.safety.helplines.title": "קווי סיוע בשעת משבר",
  "elev.safety.helplines.sub": "הקישו על מספר כדי להתקשר.",
  "elev.safety.helplines.group.il": "ישראל",
  "elev.safety.helplines.group.eu": "האיחוד האירופי",
  "elev.safety.helplines.group.nl": "הולנד",
  "elev.safety.helplines.group.be": "בלגיה",
  "elev.safety.helplines.group.us": "ארצות הברית",
  "elev.safety.helpline.il_eran": "ער״ן — עזרה ראשונה נפשית (24/7)",
  "elev.safety.helpline.il_mda": "מגן דוד אדום — אמבולנס",
  "elev.safety.helpline.il_police": "משטרה",
  "elev.safety.helpline.eu_112": "שירותי חירום (בכל האיחוד האירופי, וגם מניידים בישראל)",
  "elev.safety.helpline.nl_113": "113 מניעת אובדנות (שיחת חינם)",
  "elev.safety.helpline.be_1813": "Zelfmoordlijn — קו מניעת אובדנות",
  "elev.safety.helpline.be_1712": "קו אלימות והתעללות",
  "elev.safety.helpline.us_988": "988 — קו סיוע לאובדנות ומשבר",
  "elev.safety.helpline.us_911": "שירותי חירום",
  "elev.safety.helplines.findLocal": "המדינה שלכם לא ברשימה? מצאו קו סיוע מקומי",

  // ── Escalation checklist — warning signs
  "elev.safety.checklist.title": "רשימת סימני אזהרה",
  "elev.safety.sign.1": "אובדן פתאומי של יכולות שכבר נרכשו (נסיגה)",
  "elev.safety.sign.2": "דיבור על פגיעה עצמית או על פגיעה באחרים",
  "elev.safety.sign.3": "הסתגרות מתמשכת מאנשים וממשחק",
  "elev.safety.sign.4": "שינוי בשינה או בתיאבון שנמשך יותר משבועיים",
  "elev.safety.sign.5": "פציעה, חום או חשש רפואי שדורש בדיקה",
  "elev.safety.sign.6": "תוקפנות מסלימה שמסכנת את הילד או את הסביבה",
  "elev.safety.checklist.note": "כל סימן שסומן הוא תזכורת לפנות בהקדם לאיש מקצוע.",

  // ── Safety review
  "elev.safety.review.title": "רענון בטיחות",
  "elev.safety.review.mark": "סימון כנבדק",
  "elev.safety.review.last": "נבדק לאחרונה:",
  "elev.safety.review.never": "עוד לא",
  "elev.safety.review.stale": "עבר קצת זמן — כדאי לרענן את פרטי הבטיחות פעם בחודש כדי שיישארו עדכניים.",

  // ── Emergency contacts
  "elev.safety.contacts.title": "אנשי קשר לחירום",
  "elev.safety.contacts.name": "שם",
  "elev.safety.contacts.role": "תפקיד (למשל רופא ילדים)",
  "elev.safety.contacts.phone": "טלפון",
  "elev.safety.contacts.notes": "הערות",

  // ── What Arbor knows (approved memory)
  "elev.safety.memory.title": "מה ארבור יודעת על {name}",
  "elev.safety.memory.sub": "רק תצפיות שאישרתם הופכות לזיכרון פעיל. אפשר למחוק כל אחת מהן בכל רגע.",
  "elev.safety.memory.empty": "עוד אין זיכרונות מאושרים. אשרו תצפיות מתור הזיכרון של הילד.",
  "elev.safety.memory.forget": "לשכוח",

  // ── Static safeguards
  "elev.safety.guard.medical.title": "מנגנון הסלמה רפואית",
  "elev.safety.guard.medical.body": "המאמן ההורי מזהה מונחים בסיכון גבוה (חום, פציעה, פגיעה עצמית, התעללות, נסיגה, מצוקה קשה) ומכוון הורים לעזרה מקצועית או דחופה.",
  "elev.safety.guard.gdpr.title": "GDPR ומזעור נתונים",
  "elev.safety.guard.gdpr.body": "ארבור בנויה למזעור נתוני ילדים בהתאם ל־GDPR. אין אינטראקציה של ילדים עם AI ללא ליווי; פרטים נשמרים רק כתצפיות שאושרו על ידי ההורים.",
  "elev.safety.guard.handoff.title": "העברה בין אנשי מקצוע",
  "elev.safety.guard.handoff.body": "הסיכום להדפסה מחבר בין תצפיות מהבית לפרופילי טיפול מקצועיים, ומעניק לגננות, למורים ולמרפאות הקשר תצפיתי — לא אבחנתי — באופן מיידי.",
};

// The masterplan names these records safetyEn/safetyHe; the index registry
// consumes `en`/`he` (module contract above). Export both names for the same
// objects so either import shape works.
export { en as safetyEn, he as safetyHe };
