/* i18nElevation/careprofile — E2 hero strings for Ask Arbor (coach), Care
 * Network (consult) and the Profile hub, + Profile stat-pill labels.
 *
 * CLINICAL FIREWALL: stat labels below caption COUNTS only — never a
 * percentage, verdict, trend delta, or deficit framing.
 * Hebrew = transcreation in a calm Israeli-parent register (outcome language,
 * no AI/tech framing); flagged for arbor-localization native review. */

export const en: Record<string, string> = {
  // ── E2 · Ask Arbor hero (slim)
  "elev.hero.ask.eyebrow": "Ask Arbor",
  "elev.hero.ask.title": "A calm next step, whenever you need one.",
  "elev.hero.ask.cta": "Ask a question",

  // ── E2 · Care Network hero (the redaction-controlled summary)
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
};

export const he: Record<string, string> = {
  "elev.hero.ask.eyebrow": "שאלו את ארבור",
  "elev.hero.ask.title": "צעד רגוע קדימה, בכל רגע שתצטרכו.",
  "elev.hero.ask.cta": "לשאול שאלה",

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
};
