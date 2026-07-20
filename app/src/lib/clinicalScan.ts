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

/** Return the first clinical-diagnosis term found (word-boundary,
 *  case-insensitive), or null if the text is clean. */
export function findClinicalDiagnosisTerm(text: string): string | null {
  const lower = text.toLowerCase();
  for (const term of CLINICAL_DIAGNOSIS_TERMS) {
    const re = new RegExp(`\\b${term}\\b`, "i");
    if (re.test(lower)) return term;
  }
  return null;
}
