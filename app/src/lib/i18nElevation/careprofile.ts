/* i18nElevation/careprofile — E2 hero strings for Ask Arbor (coach), Care
 * Network (consult) and the Profile hub, + Profile stat-pill labels.
 *
 * CLINICAL FIREWALL: stat labels below caption COUNTS only — never a
 * percentage, verdict, trend delta, or deficit framing.
 * Hebrew = transcreation in a calm Israeli-parent register (outcome language,
 * no AI/tech framing); flagged for arbor-localization native review. */

export const en: Record<string, string> = {
  // B-CAREPRO-33: "Still true?" on the facts every Care document quotes.
  "elev.profile.fact.asOf": "as of {month}",
  "elev.profile.fact.stillTrue": "Still true?",
  "elev.profile.fact.keep": "Keep",
  "elev.profile.fact.edit": "Edit",
  // ── E2 · Ask Arbor hero (slim)
  "elev.hero.ask.eyebrow": "Ask Arbor",
  "elev.hero.ask.title": "A calm next step, whenever you need one.",
  "elev.hero.ask.cta": "Ask a question",

  // ── E2 · Care Network hero (the redaction-controlled summary)
  // W2-CAREPRO r1 (B-CAREPRO-36 hero part): Consult opens on the job.
  "elev.consult.h1": "Prepare for a visit",
  "elev.consult.h1.visit": "Prepare for {profession} on {date}",
  // NEXTLEVEL critic r1: the H1 follows the CHOSEN audience; the booked visit
  // stays one quiet line when the parent picks someone else.
  "elev.consult.h1.audience": "Prepare for the {audience}",
  "elev.consult.visitLine": "Your next visit: {profession} on {date}",
  "elev.consult.visitOutcome.q": "What did they suggest? {profession}, {date}",
  "elev.consult.forName": "for {name}",
  "elev.hero.care.eyebrow": "Care Network",
  "elev.hero.care.title": "One summary you control, ready for everyone who helps {name}.",
  "elev.hero.care.sub": "You choose what goes in — nothing is shared until you send it.",
  "elev.hero.care.cta": "Review the summary",

  // ── E2 · Profile hero (the family-album motif)
  "elev.hero.profile.eyebrow": "Profile",
  "elev.hero.profile.title": "The family album that grows itself.",
  "elev.hero.profile.sub": "Everyone who loves {name}, and every moment you've kept — in one place.",
  "elev.hero.profile.cta": "Add a family member",

  // ── Profile stat-pill labels (counts only)
  "elev.stat.children": "children",
  "elev.stat.family": "family members",
  "elev.stat.moments": "moments captured",
  // W2-GROWTH r1 + B-GROWTH-NEW-1E/1F — what Arbor remembers, on Profile.
  "elev.profile.knows.lead": "Arbor remembers:",
  "elev.profile.knows.leadNamed": "What Arbor knows about {name}:",
  "elev.profile.identity.langsAsOf": "{langs} (as of {month})",
  "elev.profile.identity.schoolAsOf": "{school} (as of {month})",
  "elev.profile.knows.since": "kept since {month}",
  "elev.profile.knows.empty": "Tell Arbor one thing about {name} worth remembering.",
  "elev.profile.remember.title": "What Arbor would like to remember",
  "elev.profile.remember.keep": "Keep",
  "elev.profile.remember.notQuite": "Not quite",
  "elev.profile.remember.forget": "Forget",
  "elev.profile.remember.more": "See all {n} waiting",
  "elev.profile.ms.noticed": "{n} milestones noticed",
  "elev.profile.ms.noticedOne": "1 milestone noticed",
  // B-SHELL-26 — the queue is gone: the parent's own facts are kept on creation;
  // Profile lists what Arbor remembers, each with Forget only. Inferences are
  // asked inline (B-AI-07) and on #/memory.
  "elev.profile.remembers.title": "Things Arbor remembers",
  // P1-NEXTLEVEL critic r2: no count on Profile — the newest inference is
  // named, never counted (the count lives on #/memory only).
  "elev.profile.remembers.noticedAbout": "Arbor noticed something about {topic} — check it",
  "elev.profile.remembers.noticed": "Arbor noticed something to check with you",
  "elev.profile.who.title": "About {name}",
  // v3 FEAT-09 — #/handoff is the care summary builder (the Care summary pill).
  // "Our question" puts the family question the parent picked into the summary
  // as one line; it is off until the parent turns it on.
  "elev.consult.h1.summary": "Build a care summary",
  "elev.consult.summary.lede": "Untick anything you'd rather keep to yourself. Nothing leaves until you share it.",
  "elev.consult.topic.include": "Our question",
  "elev.consult.topic.line": "Our question: {title}",
  // v3 EXTRA-CARE — the Care landing (#/consult): the kicker and sub, the
  // next-visit card with its three prep steps, the aside (Help and safety,
  // Who sees what), the doors and the trust line; the visit-outcome receipt.
  "elev.consult.kicker": "You don't have to do it alone",
  "elev.consult.sub": "Prepare for a conversation and choose what to share with your care team.",
  "elev.consult.visit.kicker": "Your next visit",
  "elev.consult.inDays": "In {n} days",
  "elev.consult.inDays.zero": "Today",
  "elev.consult.inDays.one": "Tomorrow",
  "elev.consult.inDays.two": "In 2 days",
  "elev.consult.step.bring": "Choose what to bring",
  "elev.consult.step.preview": "Preview the summary",
  "elev.consult.step.share": "Share",
  "elev.consult.bring.label": "What to bring",
  "elev.consult.bring.moments": "Moments",
  "elev.consult.bring.moments.one": "1 moment",
  "elev.consult.bring.moments.other": "{n} moments",
  "elev.consult.bring.development": "Development map",
  "elev.consult.bring.words": "Words and firsts",
  "elev.consult.bring.steps": "Steps and outcomes",
  "elev.consult.preview.note": "Arbor's own lines say what you saw and how often, never a diagnosis. Your words go as you wrote them; a line you untick stays out.",
  "elev.consult.aside.label": "Help and who sees what",
  "elev.consult.aside.safety": "Help and safety",
  "elev.consult.aside.sharing": "Who sees what",
  "elev.consult.aside.manage": "Manage",
  "elev.consult.aside.openSafety": "Open Safety",
  "elev.consult.sharing.none": "No one yet. Nothing is shared until you choose.",
  "elev.consult.sharing.unavailable": "Couldn't load who has access. Open Manage to check.",
  "elev.consult.sharing.loading": "Checking who has access…",
  "elev.consult.sharing.more": "and {n} more",
  "elev.consult.doors.label": "More for your care team",
  "elev.consult.door.schoolBrief": "One page for the teacher, in classroom words.",
  "elev.consult.door.appointments": "Visits you booked and what they suggested.",
  "elev.consult.door.summary": "A summary for anyone on your care team.",
  "elev.consult.trust": "Nothing reaches your care team until you choose. Arbor's own wording says what you saw and how often, never a diagnosis.",
  "elev.consult.visitOutcome.saveError": "That wasn't saved. Your answer is still here; try again.",
  "elev.consult.visitOutcome.saving": "Saving…",
  "elev.consult.visitOutcome.queued": "Not confirmed yet. Your answer is kept on this device and finishes saving when the connection is back. You can try again.",
  "elev.consult.visitOutcome.held": "Not confirmed yet: kept on this device. Save again once you're online.",
};

export const he: Record<string, string> = {
  "elev.profile.fact.asOf": "נכון ל{month}",
  "elev.profile.fact.stillTrue": "עדיין נכון?",
  "elev.profile.fact.keep": "כן, עדיין נכון",
  "elev.profile.fact.edit": "לעדכן",
  "elev.hero.ask.eyebrow": "שאלו את ארבור",
  "elev.hero.ask.title": "צעד רגוע קדימה, בכל רגע שתצטרכו.",
  "elev.hero.ask.cta": "לשאול שאלה",

  "elev.consult.h1": "מתכוננים לפגישה",
  "elev.consult.h1.visit": "מתכוננים לפגישה עם {profession} ב־{date}",
  // NEXTLEVEL critic r1: the H1 follows the CHOSEN audience.
  "elev.consult.h1.audience": "מתכוננים לפגישה עם {audience}",
  "elev.consult.visitLine": "הפגישה הבאה: {profession} ב־{date}",
  "elev.consult.visitOutcome.q": "מה המליצו? {profession}, {date}",
  "elev.consult.forName": "עבור {name}",
  "elev.hero.care.eyebrow": "מעגל הטיפול",
  "elev.hero.care.title": "סיכום אחד בשליטתכם, מוכן לכל מי שמלווה את {name}.",
  "elev.hero.care.sub": "אתם בוחרים מה נכנס — שום דבר לא משותף עד שאתם שולחים.",
  "elev.hero.care.cta": "לעבור על הסיכום",

  "elev.hero.profile.eyebrow": "פרופיל",
  "elev.hero.profile.title": "אלבום המשפחה שגדל מעצמו.",
  "elev.hero.profile.sub": "כל מי שאוהב את {name}, וכל רגע ששמרתם — במקום אחד.",
  "elev.hero.profile.cta": "להוסיף בן משפחה",

  "elev.stat.children": "ילדים",
  "elev.stat.family": "בני משפחה",
  "elev.stat.moments": "רגעים שנשמרו",
  "elev.profile.knows.lead": "ארבור זוכרת:",
  "elev.profile.knows.leadNamed": "מה ארבור יודעת על {name}:",
  "elev.profile.identity.langsAsOf": "{langs} (נכון ל{month})",
  "elev.profile.identity.schoolAsOf": "{school} (נכון ל{month})",
  "elev.profile.knows.since": "מאז {month}",
  "elev.profile.knows.empty": "ספרו לארבור דבר אחד על {name} ששווה לזכור.",
  "elev.profile.remember.title": "מה ארבור רוצה לזכור",
  "elev.profile.remember.keep": "לשמור",
  "elev.profile.remember.notQuite": "לא בדיוק",
  "elev.profile.remember.forget": "לשכוח",
  "elev.profile.remember.more": "לכל {n} הממתינים",
  "elev.profile.ms.noticed": "שמתם לב ל־{n} אבני דרך",
  "elev.profile.ms.noticedOne": "שמתם לב לאבן דרך אחת",
  "elev.profile.remembers.title": "דברים שארבור זוכרת",
  "elev.profile.remembers.noticedAbout": "ארבור שמה לב למשהו בנושא {topic} — לבדוק",
  "elev.profile.remembers.noticed": "ארבור שמה לב למשהו לבדוק איתכם",
  "elev.profile.who.title": "על {name}",
  // v3 FEAT-09 — סיכום לצוות המטפל, ו"השאלה שלנו" כשורה אחת שההורה בוחר להוסיף.
  "elev.consult.h1.summary": "להכין סיכום לצוות המטפל",
  "elev.consult.summary.lede": "הסירו את הסימון מכל מה שתעדיפו לשמור לעצמכם. שום דבר לא יוצא עד שתשתפו.",
  "elev.consult.topic.include": "השאלה שלנו",
  "elev.consult.topic.line": "השאלה שלנו: {title}",
  // v3 EXTRA-CARE — דף הבית של הטיפול: הפגישה הבאה ושלושת שלבי ההכנה, עזרה ובטיחות, מי רואה מה, דלתות ושורת האמון.
  "elev.consult.kicker": "לא צריך לעשות את זה לבד",
  "elev.consult.sub": "להתכונן לשיחה ולבחור מה לשתף עם הצוות המטפל.",
  "elev.consult.visit.kicker": "הפגישה הבאה שלכם",
  "elev.consult.inDays": "בעוד {n} ימים",
  "elev.consult.inDays.zero": "היום",
  "elev.consult.inDays.one": "מחר",
  "elev.consult.inDays.two": "בעוד יומיים",
  "elev.consult.step.bring": "לבחור מה להביא",
  "elev.consult.step.preview": "לראות את הסיכום",
  "elev.consult.step.share": "לשתף",
  "elev.consult.bring.label": "מה להביא",
  "elev.consult.bring.moments": "רגעים",
  "elev.consult.bring.moments.one": "רגע אחד",
  "elev.consult.bring.moments.other": "{n} רגעים",
  "elev.consult.bring.development": "מפת ההתפתחות",
  "elev.consult.bring.words": "מילים ופעמים ראשונות",
  "elev.consult.bring.steps": "צעדים ותוצאות",
  "elev.consult.preview.note": "השורות של ארבור אומרות מה ראיתם וכמה פעמים, אף פעם לא אבחנה. המילים שלכם יוצאות כמו שכתבתם; שורה שהסרתם ממנה את הסימון לא נשלחת.",
  "elev.consult.aside.label": "עזרה ומי רואה מה",
  "elev.consult.aside.safety": "עזרה ובטיחות",
  "elev.consult.aside.sharing": "מי רואה מה",
  "elev.consult.aside.manage": "ניהול",
  "elev.consult.aside.openSafety": "לפתוח את דף הבטיחות",
  "elev.consult.sharing.none": "עדיין אף אחד. שום דבר לא משותף עד שתבחרו.",
  "elev.consult.sharing.unavailable": "לא הצלחנו לבדוק למי יש גישה. אפשר לבדוק בניהול.",
  "elev.consult.sharing.loading": "בודקים למי יש גישה…",
  "elev.consult.sharing.more": "ועוד {n}",
  "elev.consult.doors.label": "עוד בשביל הצוות המטפל",
  "elev.consult.door.schoolBrief": "דף אחד לצוות החינוכי, במילים של הכיתה.",
  "elev.consult.door.appointments": "הפגישות שקבעתם ומה המליצו בהן.",
  "elev.consult.door.summary": "סיכום לכל מי שבצוות המטפל.",
  "elev.consult.trust": "שום דבר לא מגיע לצוות המטפל עד שתבחרו. הניסוח של ארבור אומר מה ראיתם וכמה פעמים, אף פעם לא אבחנה.",
  "elev.consult.visitOutcome.saveError": "השמירה לא הצליחה. התשובה עדיין כאן; אפשר לנסות שוב.",
  "elev.consult.visitOutcome.saving": "שומרים…",
  "elev.consult.visitOutcome.queued": "עדיין לא אושר. התשובה שמורה במכשיר הזה ותסיים להישמר כשהחיבור חוזר. אפשר לנסות שוב.",
  "elev.consult.visitOutcome.held": "עדיין לא אושר: שמור במכשיר הזה. שמרו שוב כשהחיבור חוזר.",
};
