/**
 * searchnav — strings for the W2 search + nav-weighting wave (masterplan
 * 2.4 + 2.7 + 1.9): search-result kind badges, the modal's library section
 * header, and the loading hint.
 *
 * Module follows the i18nElevation shape (flat `en` + `he` records, ALL keys
 * namespaced "elev.searchnav.*") so it is registration-ready for index.ts.
 * Registration in index.ts is deliberately NOT done here (that file is the
 * parallel-agent merge hotspot and is owned by the integrator) — until it
 * lands, consumers read these strings through searchnavText() below, which
 * resolves against these records directly and keeps working identically
 * after registration.
 *
 * Hebrew = calm Israeli-parent transcreation; outcome language, no AI/tech
 * framing (house i18nElevation rule).
 */

export const en: Record<string, string> = {
  "elev.searchnav.kind.route": "Go",
  "elev.searchnav.kind.learn": "Learn",
  "elev.searchnav.kind.masterclass": "Masterclass",
  "elev.searchnav.kind.routine": "Routine",
  "elev.searchnav.kind.scholar": "Scholar",
  "elev.searchnav.kind.hard-moment": "Hard moment",
  "elev.searchnav.kind.activity": "Activity",
  "elev.searchnav.kind.milestone": "Milestone",
  "elev.searchnav.kind.journey": "Journey",
  "elev.searchnav.kind.world": "Practice",
  "elev.searchnav.fromLibrary": "From the library",
  "elev.searchnav.loading": "Loading search…",
};

export const he: Record<string, string> = {
  "elev.searchnav.kind.route": "מעבר",
  "elev.searchnav.kind.learn": "למידה",
  "elev.searchnav.kind.masterclass": "מאסטרקלאס",
  "elev.searchnav.kind.routine": "שגרה",
  "elev.searchnav.kind.scholar": "חוקרים",
  "elev.searchnav.kind.hard-moment": "רגע קשה",
  "elev.searchnav.kind.activity": "פעילות",
  "elev.searchnav.kind.milestone": "אבן דרך",
  "elev.searchnav.kind.journey": "מסע",
  "elev.searchnav.kind.world": "תרגול",
  "elev.searchnav.fromLibrary": "מהספרייה",
  "elev.searchnav.loading": "החיפוש נטען…",
};

/**
 * Direct resolver for this module's strings. Works BEFORE the module is
 * registered in i18nElevation/index.ts (t() would return the raw key until
 * then) and keeps returning the same values after registration.
 */
export function searchnavText(key: string, heLang: boolean): string {
  return (heLang ? he[key] : undefined) ?? en[key] ?? key;
}
