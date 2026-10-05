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
};
