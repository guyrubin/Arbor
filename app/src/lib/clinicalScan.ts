/* Shared clinical-language scan + child-data field ceilings (IA W4.1).
 *
 * Owned by arbor-safety. Pure + deterministic — no React, no network, no
 * storage, and NO component imports — so the two DISTINCT child-data egress
 * surfaces that consume it (the School Brief, `src/schoolBrief/schoolBrief.ts`,
 * and the consult packet's audience presets, `src/consult/packet.ts`) share
 * ONE fail-closed scanner without ever importing each other. Extracted
 * verbatim from schoolBrief.ts, which re-exports everything here so its
 * public contract is byte-compatible and unchanged.
 */

/** School Brief Condition 2: the ONLY fields that may appear in the
 *  teacher-facing export. These are the warm/practical, non-diagnostic,
 *  parent-mediated transition fields. The raw memory-ledger / behavior-log
 *  record is intentionally NOT here. This allowlist is also the curated data
 *  ceiling for the consult packet's non-clinician (teacher) preset. */
export const CURATED_FIELDS = [
  "overview",
  "keyStrengths",
  "classroomChallenges",
  "languageSupportPlan",
  "suggestedTeacherStrategies",
] as const;
export type CuratedField = (typeof CURATED_FIELDS)[number];

/** School Brief Condition 2 (negative): raw-record keys that MUST NOT leak
 *  into a non-clinician export. If a caller hands a builder a record carrying
 *  these, they are ignored. */
export const RAW_RECORD_KEYS = [
  // behavior-log fields
  "behaviorType", "intensity", "trigger", "response", "notes", "timestamp",
  "resolved", "logs", "behaviorLogs", "context", "durationMinutes",
  // memory-ledger fields
  "memory", "memoryEvents", "memoryLedger", "fact", "status", "approvedMemoryItems",
  // misc raw identifiers
  "crisisEscalationTrigger", // generator may return it, but it is NOT exported to a teacher
] as const;

/** School Brief Condition 3: clinical-diagnosis terms that must never appear
 *  in output shown to a non-clinician (teacher). Word-boundary,
 *  case-insensitive. Clinician audiences (therapist, pediatrician) are exempt
 *  by policy — "speech delay" is legitimate shorthand in a pediatrician
 *  summary — but no audience ever receives riskLevel/percentage tokens. */
export const CLINICAL_DIAGNOSIS_TERMS = [
  "diagnosis", "diagnose", "diagnosed",
  "disorder", "adhd", "autism", "autistic",
  "delay", "delayed", "deficit",
] as const;

export class ClinicalLanguageError extends Error {
  readonly term: string;
  constructor(term: string, message?: string) {
    super(message ?? `School Brief blocked: clinical-diagnosis term "${term}" is not allowed in a teacher brief.`);
    this.name = "ClinicalLanguageError";
    this.term = term;
  }
}

/** School Brief Condition 3, Hebrew. The brief is GENERATED in the parent's
 *  language, and the teacher it is written for is very often a Hebrew-speaking
 *  gan teacher — so a scanner that only knows English does not merely miss a
 *  few phrasings, it switches the whole Condition-3 guarantee off for exactly
 *  the population the feature was built for. A Hebrew brief saying
 *  "סימנים של עיכוב שפתי" or "חשד להפרעת קשב" used to export clean.
 *
 *  Note these are matched as SUBSTRINGS, not with `\b`. That is deliberate on
 *  two counts. First, JavaScript's `\b` is defined over [A-Za-z0-9_], so a
 *  Hebrew letter is a non-word character on both sides and `\bאוטיזם\b` can
 *  never match — adding Hebrew terms to the English matcher would have looked
 *  like a fix and guarded nothing. Second, Hebrew glues its particles to the
 *  word (ה/ו/ב/ל/מ/ש prefixes, plural and construct suffixes), so
 *  "להפרעת", "עיכובים" and "מאובחנת" are the same claim and a boundary match
 *  would let each of them through. Over-matching is the safe direction for a
 *  fail-closed egress scan. */
export const CLINICAL_DIAGNOSIS_TERMS_HE = [
  // diagnosis / diagnosed
  "אבחון", "אבחנה", "מאובחן", "לאבחן",
  // disorder (incl. the construct form used in "הפרעת קשב")
  "הפרעה", "הפרעת",
  // autism spectrum
  "אוטיז", "אוטיסט", "אספרגר",
  // delay
  "עיכוב", "מעוכב",
  // deficit / impairment / disability
  "ליקוי", "לקות", "פיגור",
  // named conditions
  "תסמונת", "דיסלקצי", "דיסגרפי", "היפראקטיב",
] as const;

/** The scanner's coverage, keyed by the language a document can be GENERATED
 *  in. `lib/api.ts` defines that set as "en" | "he"; the guard test pins this
 *  map against it, so adding a third generation language fails the build here
 *  rather than silently shipping an unscannable export. */
export const CLINICAL_DIAGNOSIS_TERMS_BY_LANGUAGE = {
  en: CLINICAL_DIAGNOSIS_TERMS,
  he: CLINICAL_DIAGNOSIS_TERMS_HE,
} as const;

/** Return the first clinical-diagnosis term found, or null if the text is
 *  clean. English matches on a word boundary, case-insensitively, exactly as
 *  before; Hebrew matches as a substring, for the reasons above. The scan is
 *  language-agnostic at the call site on purpose — a caller must never have to
 *  know which language the model replied in to be protected. */
export function findClinicalDiagnosisTerm(text: string): string | null {
  const lower = text.toLowerCase();
  for (const term of CLINICAL_DIAGNOSIS_TERMS) {
    const re = new RegExp(`\\b${term}\\b`, "i");
    if (re.test(lower)) return term;
  }
  for (const term of CLINICAL_DIAGNOSIS_TERMS_HE) {
    if (text.includes(term)) return term;
  }
  return null;
}
