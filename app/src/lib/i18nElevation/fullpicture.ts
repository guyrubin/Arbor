/* i18nElevation/fullpicture — masterplan 1.7: the Development Copilot surface
 * renamed to parent language ("The Full Picture" / "התמונה המלאה") plus its
 * Development-hub entry card. Route id stays "copilot" — only the words change.
 *
 * CLINICAL FIREWALL: this surface fuses milestones + practice + screening +
 * logs, so every string here is observational and count-based — "worth a
 * conversation" routing words, counts of contributing observations, cumulative
 * practice tallies. Never a verdict, grade, band value, trend or risk level.
 * Hebrew = calm Israeli-parent transcreation, outcome language, no AI/tech
 * framing; flagged for arbor-localization native review.
 *
 * NOTE: DevelopmentCopilot.tsx and DevelopmentTab.tsx resolve this module
 * DIRECTLY (module-local lookup by uiLang, same recipe as Screening.tsx ×
 * i18nElevation/screeningcalm) — registration in i18nElevation/index.ts is a
 * separate wiring step owned by that file's registry recipe. Keys stay
 * "elev.*"-namespaced so a later registration merges cleanly with
 * existing-keys-win semantics.
 */

export const en: Record<string, string> = {
  // ── Surface header (route id "copilot" untouched)
  "elev.fullpicture.title": "The Full Picture",
  "elev.fullpicture.sub":
    "Everything Arbor sees about {name}, in one calm place — what you've noticed, practiced and logged, side by side.",

  // ── "Worth a conversation" section (formerly Watch signals — one neutral
  //    tone for every area; rows carry counts of contributing observations)
  "elev.fullpicture.watch.title": "Worth a conversation",
  "elev.fullpicture.watch.row.one": "1 observation worth a conversation",
  "elev.fullpicture.watch.row.many": "{n} observations worth a conversation",
  "elev.fullpicture.watch.empty.title": "Nothing to bring up yet.",
  "elev.fullpicture.watch.empty.body":
    "Arbor needs enough recent practice, logged moments, or a Development Check before a pattern is worth a conversation. Quiet here means \"not enough signal yet\" — not a clinical all-clear.",

  // ── Cumulative practice tile (GD-10: never a score or band value)
  "elev.fullpicture.pulse.moments":
    "Practice moments logged so far, across {k} skill area{kPlural} — a running tally of activity, never a score.",

  // ── Development-hub entry card (IA canon: a CARD on the hub's Now region)
  "elev.fullpicture.card.promise": "Everything Arbor sees about {name}, in one calm place",
  "elev.fullpicture.card.promise.generic": "Everything Arbor sees about your child, in one calm place",
  "elev.fullpicture.card.teaser": "{n} areas reviewed",
  "elev.fullpicture.card.cta": "Open the full picture",
};

export const he: Record<string, string> = {
  "elev.fullpicture.title": "התמונה המלאה",
  "elev.fullpicture.sub":
    "כל מה שארבור רואה על {name}, במקום רגוע אחד — מה ששמתם לב אליו, תרגלתם ותיעדתם, זה לצד זה.",

  "elev.fullpicture.watch.title": "שווה שיחה",
  "elev.fullpicture.watch.row.one": "תצפית אחת ששווה שיחה",
  "elev.fullpicture.watch.row.many": "{n} תצפיות ששוות שיחה",
  "elev.fullpicture.watch.empty.title": "אין עדיין משהו להעלות.",
  "elev.fullpicture.watch.empty.body":
    "ארבור צריך מספיק תרגול עדכני, רגעים מתועדים או בדיקת התפתחות לפני שדפוס שווה שיחה. שקט כאן אומר \"אין עדיין מספיק סימן\" — לא אישור קליני.",

  "elev.fullpicture.pulse.moments":
    "רגעי תרגול שנרשמו עד כה, ב־{k} תחומי מיומנות — ספירה מצטברת של פעילות, אף פעם לא ציון.",

  "elev.fullpicture.card.promise": "כל מה שארבור רואה על {name}, במקום רגוע אחד",
  "elev.fullpicture.card.promise.generic": "כל מה שארבור רואה על הילד או הילדה שלכם, במקום רגוע אחד",
  "elev.fullpicture.card.teaser": "{n} תחומים נסקרים",
  "elev.fullpicture.card.cta": "לתמונה המלאה",
};
