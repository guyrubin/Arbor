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

/** W2-CAREPRO critic round 1 — a teacher never receives a severity GRADE.
 *  The diagnosis scan let "Severe transition anxiety" through to a teacher
 *  draft printed under "never a diagnosis or a developmental verdict". A grade
 *  word is a risk level (law 1), so the teacher scan refuses it too. English on
 *  a word boundary; Hebrew as a substring (same reasoning as above: particles
 *  glue to the word, and over-matching is the safe direction). */
export const TEACHER_GRADE_TERMS = [
  "severe", "severely", "severity",
  "mild", "mildly",
  "moderate", "moderately",
  "extreme", "extremely",
  "profound", "profoundly",
  "high-risk", "high risk", "at-risk", "at risk",
] as const;

export const TEACHER_GRADE_TERMS_HE = [
  // severe / severity
  "חמור", "חמורה", "חומרה",
  // extreme
  "קיצוני", "קיצונית",
  // graded ("in a mild/moderate degree")
  "בדרגה", "דרגת",
  // risk
  "בסיכון", "סיכון גבוה",
] as const;

/** Return the first severity-grade term found, or null. */
export function findTeacherGradeTerm(text: string): string | null {
  for (const term of TEACHER_GRADE_TERMS) {
    const re = new RegExp(`\\b${term.replace(/[-\s]/g, "[-\\s]")}\\b`, "i");
    if (re.test(text)) return term;
  }
  for (const term of TEACHER_GRADE_TERMS_HE) {
    if (text.includes(term)) return term;
  }
  return null;
}

/** The teacher egress scan: a diagnosis term OR a severity grade. */
export function findTeacherBlockedTerm(text: string): string | null {
  return findClinicalDiagnosisTerm(text) ?? findTeacherGradeTerm(text);
}

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

/* ── B-ASKJB-44 · handoff notes restate only what the parent reported ──────
 *
 * The coach wrote, into `handoffNotes.professional`, a finding nobody made:
 * "…ללא עדות לקשיי קשב או ויסות משמעותיים בהקשר זה" ("no evidence of
 * attention or regulation difficulties"), for an activity that had not even
 * happened (companion-topics-v1 topic-enjoy-he, 10 Oct), and on a re-run
 * "נצפתה אינטראקציה חיובית…" (an interaction "was observed"). A note written
 * for a teacher or clinician is the one place an invented negative finding
 * reads as a result, so this floor runs on the model's output (after the
 * output safety screen) before any note is shown or handed on. Two classes:
 *   1. an ABSENCE-of-finding outcome — "no evidence of", "shows no signs of",
 *      "no … difficulties", "ruled out", "within normal limits", a screening
 *      result, "developing normally";
 *   2. an UNATTRIBUTED observation — "was observed / noted / seen" with no
 *      agent, "נצפתה": Arbor observed nothing.
 * A clause that matches is dropped and the rest of the note kept verbatim,
 * EXCEPT (critic round 1):
 *   - a REPORTED finding — a named reporter or the first person comes before
 *     it ("Mom reports no sleep difficulties", "the pediatrician, who ruled
 *     out…", "הגננת סיפרה שהוא נצפה…"), or an agent follows ("was seen by a
 *     speech therapist");
 *   - an ESCALATION line — a condition ("If…", "אם…") or a referral action
 *     ("call…", "talk with your pediatrician", "להתקשר מיד") is the safety
 *     message itself and is never removed;
 *   - the School Brief's `crisisEscalationTrigger` field is never scrubbed.
 * English on word boundaries (case-insensitive); Hebrew as whole words with
 * a glued particle (`\b` cannot bound a Hebrew word: "לשלול" is not inside
 * "לשלוליות"). Event descriptions such as "fell asleep without any
 * difficulty" / "מטפסת ללא חשש" are not findings and are not listed. */
const NOUN_EN = String.raw`(?:signs?|evidence|indications?|indicators?|symptoms?|red\s+flags?|difficult(?:y|ies)|delays?|deficits?|impairments?|concerns?|problems?|issues?)`;
export const HANDOFF_FINDING_PATTERNS_EN: readonly RegExp[] = [
  new RegExp(String.raw`\bno\s+(?:clear\s+|obvious\s+|apparent\s+|real\s+|significant\s+|further\s+|current\s+)?(?:evidence|signs?|indications?|indicators?|symptoms?|red\s+flags?|traces?)\s+(?:of|that|for)\b`, "gi"),
  new RegExp(String.raw`\b(?:show|shows|showed|showing|display|displays|displayed|exhibit|exhibits|exhibited|present|presents|presented|demonstrate|demonstrates|demonstrated)\s+no\s+(?:\w+\s+){0,3}?${NOUN_EN}\b`, "gi"),
  new RegExp(String.raw`\b(?:does|did|do|is|was|are|were)\s*(?:not|n['’]t)\s+(?:show|showing|display|exhibit|present\s+with|demonstrate|have|appear\s+to\s+have)\s+(?:any\s+)?(?:\w+\s+){0,3}?${NOUN_EN}\b`, "gi"),
  new RegExp(String.raw`\bno\s+(?:\w+[\s,]+){0,4}?(?:difficult(?:y|ies)|delays?|deficits?|impairments?|red\s+flags?)\b`, "gi"),
  new RegExp(String.raw`\bno\s+(?:\w+\s+){0,3}?concerns?\s+(?:were\s+|was\s+|have\s+been\s+|has\s+been\s+)?(?:noted|observed|found|identified|detected|raised|present|seen)\b`, "gi"),
  new RegExp(String.raw`\b(?:without|free\s+(?:of|from))\s+(?:any\s+)?(?:signs?|evidence|indications?|symptoms?)\s+of\b`, "gi"),
  new RegExp(String.raw`\brul(?:e|es|ed|ing)\s+out\b`, "gi"),
  new RegExp(String.raw`\bwithin\s+(?:the\s+)?normal\s+(?:limits|range)\b`, "gi"),
  new RegExp(String.raw`\bnothing\s+(?:to\s+suggest|suggests|that\s+suggests|indicates|that\s+indicates|concerning|of\s+concern)\b`, "gi"),
  new RegExp(String.raw`\b(?:screen(?:ed|ing)?\s+(?:negative|clear|normal)|pass(?:ed|es)?\s+(?:the\s+|a\s+)?(?:screening|screen))\b`, "gi"),
  new RegExp(String.raw`\b(?:typical|normal)\s+development\b|\bdevelop(?:s|ing)\s+(?:normally|typically|on\s+track)\b|\bdevelopmentally\s+(?:normal|typical|on\s+track)\b`, "gi"),
  new RegExp(String.raw`\b(?:was|were|has\s+been|have\s+been|had\s+been)\s+(?:observed|noted|seen|identified|detected)\b(?!\s+by\b)`, "gi"),
];

/** Hebrew absence-of-finding phrases, matched as whole words (a glued ו/ש/כש allowed). */
export const HANDOFF_FINDING_TERMS_HE = [
  // "no evidence of"
  "אין עדות", "ללא עדות", "אין הוכחה", "ללא הוכחה",
  // "no signs of"
  "אין סימנים", "אין סימן", "ללא סימנים", "ללא סימן", "לא נראים סימנים", "לא נראה סימן", "לא נראו סימנים",
  "לא נצפו סימנים", "לא נצפה סימן", "לא מראה סימנים", "לא מראה סימן", "אינו מראה סימנים", "אינה מראה סימנים",
  "לא הראה סימנים", "לא הראתה סימנים", "אין אינדיקציה", "ללא אינדיקציה",
  // "no concern / difficulty / delay" (as a finding; "ללא קושי"/"ללא חשש" describe an event and are not listed)
  "אין חשש", "אין קשיים", "אין קושי", "לא נמצאו קשיים", "לא נצפו קשיים", "לא נמצא קושי", "אין עיכוב",
  // "ruled out" / "within normal limits" / "developing normally"
  "לשלול", "נשלל", "נשללה", "נשללו", "שולל", "שוללת",
  "בטווח התקין", "בטווח הנורמה", "בגבולות הנורמה", "בגבולות התקין", "התפתחות תקינה",
  "מתפתח כרגיל", "מתפתחת כרגיל", "מתפתח באופן תקין", "מתפתחת באופן תקין",
] as const;
const heWhole = (phrase: string) => String.raw`(?<!\p{L})(?:ו|ש|כש)?${phrase.trim().split(/\s+/).join(String.raw`\s+`)}(?!\p{L})`;
const HANDOFF_FINDING_HE = new RegExp(HANDOFF_FINDING_TERMS_HE.map(heWhole).join("|"), "gu");
/** Hebrew unattributed observation ("was observed / identified"), as whole words. */
const UNATTRIBUTED_FINDING_HE = /(?<!\p{L})(?:ו|ש|כש)?(?:נצפה|נצפתה|נצפו|זוהה|זוהתה|זוהו)(?!\p{L})/gu;

/* Critic round 2: attribution and escalation are decided by STRUCTURE, never
 * by a reporter-like or urgent word anywhere earlier in the clause. */
/** A third-person reporter a parent can quote (the first person is the model
 *  writing in the parent's voice and never counts on grammar alone). */
const REPORTER_EN = String.raw`(?:(?:the|her|his|their|our|my|a|an)\s+)?(?:\w+\s+)?(?:mom|mum|mommy|mother|dad|daddy|father|parents?|grand(?:ma|pa|mother|father|parents?)|family|teachers?|nanny|caregiver|babysitter|doctor|pediatrician|paediatrician|therapist|nurse|psychologist|clinician|specialist|audiologist)`;
const REPORTING_VERB_EN = String.raw`(?:reports?|reported|says?|said|notes?|noted|tells?|told|mentions?|mentioned|shares?|shared|observes?|observed|notices?|noticed|describes?|described|writes?|wrote|explains?|explained|confirms?|confirmed|finds?|found|sees|saw)`;
const NOT_CONJUNCTION_EN = String.raw`(?!(?:and|but|or|with|while|so|then|yet|although|though|because)\b)`;
/** "Mom reports …", "Her teacher said she was observed …": the reporter and a
 *  reporting verb directly govern the finding — at most three plain words
 *  between them, no comma, colon or conjunction. */
const GOVERNED_EN = new RegExp(String.raw`\b${REPORTER_EN}\s+(?:\w+\s+)?${REPORTING_VERB_EN}(?:\s+that)?(?:\s+${NOT_CONJUNCTION_EN}\w+){0,3}\s*$`, "i");
/** "… the pediatrician, who ruled out …": the reporter is the subject of the finding. */
const RELATIVE_EN = new RegExp(String.raw`\b${REPORTER_EN},?\s+(?:who|that)\s+(?:has\s+|had\s+|also\s+)?$`, "i");
/** "No signs of anxiety at drop-off, according to her teacher." */
const TRAILING_EN = new RegExp(String.raw`,?\s*(?:according\s+to|as\s+reported\s+by|as\s+noted\s+by|per)\s+${REPORTER_EN}\b[\s.!?]*$`, "i");
const REPORTER_HE = String.raw`(?:ה|ו)?(?:אמא|אבא|הורה|הורים|גננת|גנן|מורה|מורים|מטפלת|מטפל|רופא|רופאה|רופאת|סבתא|סבא|משפחה)(?:\s+\p{L}+)?`;
const REPORTING_VERB_HE = String.raw`(?:סיפר|סיפרה|סיפרו|מספר|מספרת|מספרים|מספרות|אמר|אמרה|אמרו|ציין|ציינה|ציינו|מציין|מציינת|דיווח|דיווחה|דיווחו|מדווח|מדווחת|מדווחים|ראה|ראתה|ראו|הבחין|הבחינה|הבחינו|כתב|כתבה|כתבו|קבע|קבעה)`;
const GOVERNED_HE = new RegExp(String.raw`(?<!\p{L})${REPORTER_HE}\s+${REPORTING_VERB_HE}(?:\s+(?!ו)\p{L}+){0,3}?(?:\s+(?:ש|כי)?)?\s*$|(?<!\p{L})${REPORTER_HE}\s+${REPORTING_VERB_HE}\s+(?:ש|כי\s+)?(?!ו)\p{L}*\s*$`, "u");
const TRAILING_HE = new RegExp(String.raw`,?\s*(?:לדבר(?:י|יה|יו)|לפי|כפי\s+ש(?:סיפר|סיפרה|אמר|אמרה|ציין|ציינה))(?:\s+${REPORTER_HE})?[\s.!?]*$`, "u");
/** A condition AND a referral action together: the line is a safety message. */
const CONDITION_EN = /\b(?:if|unless|in\s+case)\b/i;
const REFERRAL_EN = /\b(?:call|calls|calling|contact|phone|seek\s+(?:help|care|advice|support)|emergency|ambulance|112|911|101|988)\b|\b(?:talk|speak|discuss|consult|tell|refer)\b(?:\s+\w+){0,4}?\s+(?:pediatrician|paediatrician|doctor|GP|professional|clinician|nurse|therapist|specialist|parents?|family)s?\b/i;
const CONDITION_HE = /(?<!\p{L})(?:ו)?(?:אם|במידה|במקרה)(?!\p{L})/u;
const REFERRAL_HE = /(?<!\p{L})(?:ל|ו)?(?:התקשר\p{L}*|להתקשר|פנו|לפנות|פנה|פני|חירום|112|101)(?!\p{L})|(?<!\p{L})(?:לדבר|לשוחח|להתייעץ|להיוועץ|דברו|שוחחו|התייעצו|ליידע|יידעו)(?:\s+\S+){0,3}?\s+(?:עם\s+|את\s+)?(?:ה)?(?:רופא\p{L}*|איש\s+מקצוע|אשת\s+מקצוע|אנשי\s+מקצוע|מטפל\p{L}*|הורים|משפחה)/u;

type FindingMatch = { phrase: string; index: number };
const findingsIn = (text: string): FindingMatch[] => {
  const out: FindingMatch[] = [];
  for (const re of [...HANDOFF_FINDING_PATTERNS_EN, HANDOFF_FINDING_HE, UNATTRIBUTED_FINDING_HE]) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) out.push({ phrase: m[0], index: m.index ?? 0 });
  }
  return out.sort((a, b) => a.index - b.index);
};

/** The first invented-finding phrase in the text, or null (attribution is not considered here). */
export function findHandoffFinding(text: string): string | null {
  return findingsIn(text)[0]?.phrase.trim() ?? null;
}

/** Whitespace- and case-normalized, for "the parent's own input contains it". */
const normalize = (text: string) => text.toLocaleLowerCase().replace(/\s+/g, " ").trim();
/** The finding's own words without a glued Hebrew particle. */
const findingCore = (phrase: string) => phrase.trim().replace(/^(?:ו|ש|כש)(?=[֐-׿])/, "");

export type HandoffFloorOptions = {
  /** The parent's own words this answer or brief was made from (the chat
   *  message, the parent's earlier turns, the logged triggers and responses).
   *  A finding the parent wrote is theirs to pass on. */
  parentText?: string;
};

/** True when this clause states a finding nobody reported (and is not a safety message). */
export function statesUnreportedFinding(clause: string, opts: HandoffFloorOptions = {}): boolean {
  if ((CONDITION_EN.test(clause) && REFERRAL_EN.test(clause)) || (CONDITION_HE.test(clause) && REFERRAL_HE.test(clause))) return false;
  if (TRAILING_EN.test(clause) || TRAILING_HE.test(clause)) return false;
  const parent = opts.parentText ? normalize(opts.parentText) : "";
  return findingsIn(clause).some(({ phrase, index }) => {
    if (parent && parent.includes(normalize(findingCore(phrase)))) return false;
    const before = clause.slice(0, index);
    return !GOVERNED_EN.test(before) && !RELATIVE_EN.test(before) && !GOVERNED_HE.test(before);
  });
}

/** Drop every clause that states an unreported finding; an untouched note is returned byte-identical. */
export function withoutHandoffFindings(text: string, opts: HandoffFloorOptions = {}): string {
  const clauses = text.match(/[^.!?;。\n]+[.!?;。]*\s*/g) ?? [text];
  if (!clauses.some((clause) => statesUnreportedFinding(clause, opts))) return text;
  return clauses.filter((clause) => !statesUnreportedFinding(clause, opts)).join("").trim();
}

/** Fields of a School Brief draft the floor never touches: the escalation line is the safety message. */
export const HANDOFF_BRIEF_UNSCRUBBED_FIELDS: readonly string[] = ["crisisEscalationTrigger"];

/** The same floor over a structured School Brief / handoff draft: every string
 *  field and list item except the escalation line. Returns how many fields
 *  changed. Mutates in place. */
export function scrubHandoffBriefFindings(brief: Record<string, unknown>, opts: HandoffFloorOptions = {}): number {
  let changed = 0;
  for (const [key, value] of Object.entries(brief)) {
    if (HANDOFF_BRIEF_UNSCRUBBED_FIELDS.includes(key)) continue;
    if (typeof value === "string") {
      const next = withoutHandoffFindings(value, opts);
      if (next !== value) { brief[key] = next; changed++; }
    } else if (Array.isArray(value)) {
      const next = value
        .map((item) => (typeof item === "string" ? withoutHandoffFindings(item, opts) : item))
        .filter((item) => typeof item !== "string" || item.trim() !== "");
      if (next.length !== value.length || next.some((item, i) => item !== value[i])) { brief[key] = next; changed++; }
    }
  }
  return changed;
}
