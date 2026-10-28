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
 * A clause that states one is dropped and the rest of the note kept verbatim,
 * UNLESS (critic round 3: the parent's words decide, never grammar):
 *   - the PARENT'S OWN WORDS carry it — the finding phrase and its object
 *     (what follows it; for a passive or predicate finding, what precedes it
 *     too) in one statement the parent wrote (not a question, not an "if"),
 *     in order and close together, and every source the note credits (a
 *     reporter: "according to her teacher", "the pediatrician, who ruled
 *     out…", "לדברי הגננת"; or a name: "Dana says", "according to Dr. Cohen")
 *     named somewhere in that text. A teacher's or doctor's words the parent
 *     typed in are the parent's text. Attribution alone keeps nothing;
 *   - it is an ESCALATION line — a condition ("If…", "אם…") together with a
 *     referral action ("call…", "talk with your pediatrician", "להתקשר מיד")
 *     is the safety message itself and is never removed;
 *   - it sits in the School Brief's `crisisEscalationTrigger`, never scrubbed.
 * English on word boundaries (case-insensitive); Hebrew as whole words with
 * a glued particle (`\b` cannot bound a Hebrew word: "לשלול" is not inside
 * "לשלוליות"). Event descriptions such as "fell asleep without any
 * difficulty" / "מטפסת ללא חשש" are not findings and are not listed. */
const NOUN_EN = String.raw`(?:signs?|evidence|indications?|indicators?|symptoms?|red\s+flags?|difficult(?:y|ies)|delays?|deficits?|impairments?|concerns?|problems?|issues?)`;
/** "forward": the finding's object follows it ("no evidence OF …"). "both":
 *  a passive or predicate finding whose object can stand before it too
 *  ("Sensory issues have been ruled out", "His language is within normal limits"). */
type FindingKind = "forward" | "both";
const HANDOFF_FINDINGS_EN: readonly { re: RegExp; kind: FindingKind }[] = [
  { kind: "forward", re: new RegExp(String.raw`\bno\s+(?:clear\s+|obvious\s+|apparent\s+|real\s+|significant\s+|further\s+|current\s+)?(?:evidence|signs?|indications?|indicators?|symptoms?|red\s+flags?|traces?)\s+(?:of|that|for)\b`, "gi") },
  { kind: "forward", re: new RegExp(String.raw`\b(?:show|shows|showed|showing|display|displays|displayed|exhibit|exhibits|exhibited|present|presents|presented|demonstrate|demonstrates|demonstrated)\s+no\s+(?:\w+\s+){0,3}?${NOUN_EN}\b`, "gi") },
  { kind: "forward", re: new RegExp(String.raw`\b(?:does|did|do|is|was|are|were)\s*(?:not|n['’]t)\s+(?:show|showing|display|exhibit|present\s+with|demonstrate|have|appear\s+to\s+have)\s+(?:any\s+)?(?:\w+\s+){0,3}?${NOUN_EN}\b`, "gi") },
  { kind: "forward", re: new RegExp(String.raw`\bno\s+(?:\w+[\s,]+){0,4}?(?:difficult(?:y|ies)|delays?|deficits?|impairments?|red\s+flags?)\b`, "gi") },
  { kind: "forward", re: new RegExp(String.raw`\bno\s+(?:\w+\s+){0,3}?concerns?\s+(?:were\s+|was\s+|have\s+been\s+|has\s+been\s+)?(?:noted|observed|found|identified|detected|raised|present|seen)\b`, "gi") },
  { kind: "forward", re: new RegExp(String.raw`\b(?:without|free\s+(?:of|from))\s+(?:any\s+)?(?:signs?|evidence|indications?|symptoms?)\s+of\b`, "gi") },
  { kind: "both", re: new RegExp(String.raw`\brul(?:e|es|ed|ing)\s+out\b`, "gi") },
  { kind: "both", re: new RegExp(String.raw`\bwithin\s+(?:the\s+)?normal\s+(?:limits|range)\b`, "gi") },
  { kind: "forward", re: new RegExp(String.raw`\bnothing\s+(?:to\s+suggest|suggests|that\s+suggests|indicates|that\s+indicates|concerning|of\s+concern)\b`, "gi") },
  { kind: "both", re: new RegExp(String.raw`\b(?:screen(?:ed|ing)?\s+(?:negative|clear|normal)|pass(?:ed|es)?\s+(?:the\s+|a\s+)?(?:screening|screen))\b`, "gi") },
  { kind: "both", re: new RegExp(String.raw`\b(?:typical|normal)\s+development\b|\bdevelop(?:s|ing)\s+(?:normally|typically|on\s+track)\b|\bdevelopmentally\s+(?:normal|typical|on\s+track)\b`, "gi") },
  { kind: "both", re: new RegExp(String.raw`\b(?:was|were|has\s+been|have\s+been|had\s+been)\s+(?:observed|noted|seen|identified|detected)\b(?!\s+by\b)`, "gi") },
];
export const HANDOFF_FINDING_PATTERNS_EN: readonly RegExp[] = HANDOFF_FINDINGS_EN.map((finding) => finding.re);

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
/** The Hebrew terms whose object can stand on either side (passive verb or predicate). */
const HANDOFF_FINDING_TERMS_HE_BOTH: ReadonlySet<string> = new Set([
  "נשלל", "נשללה", "נשללו",
  "בטווח התקין", "בטווח הנורמה", "בגבולות הנורמה", "בגבולות התקין", "התפתחות תקינה",
  "מתפתח כרגיל", "מתפתחת כרגיל", "מתפתח באופן תקין", "מתפתחת באופן תקין",
]);
const heWhole = (phrase: string) => String.raw`(?<!\p{L})(?:ו|ש|כש)?${phrase.trim().split(/\s+/).join(String.raw`\s+`)}(?!\p{L})`;
const HANDOFF_FINDING_HE = new RegExp(HANDOFF_FINDING_TERMS_HE.map(heWhole).join("|"), "gu");
/** Hebrew unattributed observation ("was observed / identified"), as whole words. */
const UNATTRIBUTED_FINDING_HE = /(?<!\p{L})(?:ו|ש|כש)?(?:נצפה|נצפתה|נצפו|זוהה|זוהתה|זוהו)(?!\p{L})/gu;

/** A condition AND a referral action together: the line is a safety message (a doctor named by title counts: "talk with Dr. Levi", "דברו עם ד"ר לוי"). */
const CONDITION_EN = /\b(?:if|unless|in\s+case)\b/i;
const REFERRAL_EN = /\b(?:call|calls|calling|contact|phone|seek\s+(?:help|care|advice|support)|emergency|ambulance|112|911|101|988)\b|\b(?:talk|speak|discuss|consult|tell|refer)\b(?:\s+\w+){0,4}?\s+(?:pediatrician|paediatrician|doctor|dr|GP|professional|clinician|nurse|therapist|specialist|parents?|family)s?\b/i;
const CONDITION_HE = /(?<!\p{L})(?:ו)?(?:אם|במידה|במקרה)(?!\p{L})/u;
const REFERRAL_HE = /(?<!\p{L})(?:ל|ו)?(?:התקשר\p{L}*|להתקשר|פנו|לפנות|פנה|פני|חירום|112|101)(?!\p{L})|(?<!\p{L})(?:לדבר|לשוחח|להתייעץ|להיוועץ|דברו|שוחחו|התייעצו|ליידע|יידעו)(?:\s+\S+){0,3}?\s+(?:עם\s+|את\s+)?(?:ה)?(?:רופא\p{L}*|ד["״]ר|איש\s+מקצוע|אשת\s+מקצוע|אנשי\s+מקצוע|מטפל\p{L}*|הורים|משפחה)/u;

type FindingMatch = { phrase: string; index: number; kind: FindingKind };
/** The finding's own words without a glued Hebrew particle. */
const findingCore = (phrase: string) => phrase.trim().replace(/^(?:ו|ש|כש)(?=[֐-׿])/, "");
const findingsIn = (text: string): FindingMatch[] => {
  const out: FindingMatch[] = [];
  const scan = (re: RegExp, kindOf: (phrase: string) => FindingKind) => {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) out.push({ phrase: m[0], index: m.index ?? 0, kind: kindOf(m[0]) });
  };
  for (const { re, kind } of HANDOFF_FINDINGS_EN) scan(re, () => kind);
  scan(HANDOFF_FINDING_HE, (phrase) => (HANDOFF_FINDING_TERMS_HE_BOTH.has(findingCore(phrase).replace(/\s+/g, " ")) ? "both" : "forward"));
  scan(UNATTRIBUTED_FINDING_HE, () => "both");
  return out.sort((a, b) => a.index - b.index);
};

/** The first invented-finding phrase in the text, or null (the parent's words are not considered here). */
export function findHandoffFinding(text: string): string | null {
  return findingsIn(text)[0]?.phrase.trim() ?? null;
}

/* ── Words: "does the parent's text carry this finding?" ──────────────────
 * Tokens are lower-cased words (a hyphen splits: "drop-off" = "drop off").
 * English words compare on a light stem (shows/showed, difficulty/difficulties).
 * Hebrew words compare with their glued particles and endings handled, the
 * pattern of practice/dailyPlan.ts's Hebrew edge helpers: one side may carry
 * up to three particles (ו ה ש ל ב כ מ) the other lacks ("לחרדה" ~ "חרדה",
 * "שאין" ~ "אין"), and an ending may differ (ה ת י ו יי ים ות ית יות יים,
 * final letters folded: "סימנים" ~ "סימן") as long as at least three letters
 * of the word itself are shared. Never both sides stripped at once: that is
 * how "מורים" (teachers) would meet "הורים" (parents). */
const HE_LETTER = /[א-ת]/;
const isHebrewWord = (word: string) => HE_LETTER.test(word);
const HE_FINAL: Record<string, string> = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };
const foldHe = (word: string) => word.replace(/[ךםןףץ]/g, (c) => HE_FINAL[c] ?? c);
const tokenize = (text: string): string[] =>
  (text.normalize("NFC").replace(/\p{M}/gu, "").toLocaleLowerCase().replace(/[’`]/g, "'").match(/[\p{L}\p{N}]+(?:['״׳][\p{L}\p{N}]+)*/gu) ?? [])
    .map((word) => (isHebrewWord(word) ? foldHe(word) : word));
const heWords = (words: readonly string[]): ReadonlySet<string> => new Set(words.map(foldHe));

/** Hebrew function words a restatement may add or drop. Negations (לא, אין, ללא, בלי) are never here. */
const HE_STOP = heWords([
  "של", "את", "עם", "על", "אל", "גם", "רק", "כי", "או", "וגם", "אבל", "אך", "כך", "כן", "מן", "עוד", "כבר", "מאוד", "כל", "יש",
  "הוא", "היא", "הם", "הן", "זה", "זו", "זאת", "אלה", "אני", "אנחנו", "אתה", "אתם", "אתן",
  "לו", "לה", "להם", "להן", "לי", "לנו", "לך", "שלו", "שלה", "שלהם", "שלי", "שלנו", "שלך", "אותו", "אותה", "אותם",
  "היה", "הייתה", "היו", "יהיה", "כאשר", "בזמן", "אחרי", "לפני", "מאז", "בתוך",
  // the child, named by the role rather than the name the note uses
  "ילד", "ילדה", "ילדים", "בן", "בת", "תינוק", "תינוקת",
]);
/** English function words a restatement may add or drop. Negations (no, not, never) are never here. */
const EN_STOP: ReadonlySet<string> = new Set([
  "a", "an", "the", "of", "for", "to", "in", "on", "at", "by", "with", "from", "about", "into", "onto", "as", "and", "or", "nor", "so",
  "than", "then", "that", "this", "these", "those", "there", "here", "it", "its", "he", "she", "they", "him", "her", "his", "hers",
  "them", "their", "theirs", "i", "me", "my", "mine", "we", "us", "our", "ours", "you", "your", "is", "are", "was", "were", "be",
  "been", "being", "am", "has", "have", "had", "having", "do", "does", "did", "any", "some", "very", "really", "just", "also",
  "still", "even", "now", "all", "much", "quite", "who", "which", "whom", "whose", "what", "when", "where", "since", "during",
  "after", "before", "over", "under",
  // the child, named by the role rather than the name the note uses
  "child", "children", "kid", "kids", "son", "daughter", "boy", "girl", "baby", "toddler",
]);
/** A third-party reporter a note can credit: the parent must have named them. */
const REPORTER_THIRD_EN = ["teacher", "nanny", "caregiver", "babysitter", "doctor", "pediatrician", "paediatrician", "therapist", "nurse",
  "psychologist", "clinician", "specialist", "audiologist", "counselor", "counsellor", "educator", "aide", "principal",
  "grandma", "grandpa", "granny", "grandmother", "grandfather", "grandparent", "gp"];
const REPORTER_THIRD_HE = [...heWords(["גננת", "גנן", "גננות", "מורה", "מורים", "מורות", "מטפלת", "מטפל", "מטפלים", "רופא", "רופאה", "רופאת",
  "רופאים", "סבתא", "סבא", "אחות", "פסיכולוג", "פסיכולוגית", "קלינאית", "קלינאי", "יועצת", "יועץ", "סייעת", "מדריכה", "מדריך"])];
/** The parent, in the third person ("Mom reports…"): it is their own text, nothing to name. */
const REPORTER_PARENT = ["mom", "mum", "mommy", "mummy", "mother", "dad", "daddy", "father", "parent", "family",
  ...heWords(["אמא", "אבא", "הורה", "הורים", "משפחה"])];
/** Words that only credit a source ("according to", "reports", "לדברי"). */
const ATTRIBUTION_WORDS = ["according", "per", "reports", "reported", "says", "said", "notes", "noted", "tells", "told", "mentions",
  "mentioned", "shares", "shared", "observes", "observed", "notices", "noticed", "describes", "described", "writes", "wrote",
  "explains", "explained", "confirms", "confirmed", "finds", "found", "sees", "saw",
  ...heWords(["לדברי", "לדבריה", "לדבריו", "לדבריהם", "לפי", "כפי", "סיפר", "סיפרה", "סיפרו", "מספר", "מספרת", "מספרים", "מספרות",
    "אמר", "אמרה", "אמרו", "ציין", "ציינה", "ציינו", "מציין", "מציינת", "דיווח", "דיווחה", "דיווחו", "מדווח", "מדווחת", "מדווחים",
    "ראה", "ראתה", "ראו", "הבחין", "הבחינה", "הבחינו", "כתב", "כתבה", "כתבו", "קבע", "קבעה", "אומר", "אומרת", "אומרים", "אומרות"])];
/** A credit that names its source after it ("according to Dr. Cohen", "לדברי הגננת"); a Hebrew reporting verb may too ("אמרה הגננת"). */
const CREDIT_BEFORE_SOURCE = ["according", "per", ...heWords(["לדברי", "לדבריה", "לדבריו", "לדבריהם", "לפי", "כפי"])];
/** A parent's sentence that is a condition is not a report: "if there are no signs of …". */
const CONDITION_WORDS = ["if", "unless", "whether", ...heWords(["אם", "במידה"])];
/** Where a passive finding's subject starts: a relative, a contrast, a condition. */
const CLAUSE_START_WORDS = ["who", "which", "that", "whom", "but", "while", "although", "though", "whereas", "because", "yet", "if", "when",
  ...heWords(["כי", "אבל", "אך", "אולם", "כאשר", "בזמן", "למרות", "אם", "בעוד"])];
/** Where a finding's object ends: a contrast starts something the finding does not say. */
const OBJECT_END_WORDS = ["but", "while", "although", "though", "whereas", "however", "yet", ...heWords(["אבל", "אך", "אולם", "בעוד", "למרות"])];

const HE_PARTICLES = /^[והשלבכמ]{1,3}/;
const HE_ENDINGS = ["יות", "יימ", "ימ", "ות", "ית", "יי", "ה", "ת", "י", "ו"];
const heEndingForms = (word: string): Set<string> => {
  const out = new Set([word]);
  for (const end of HE_ENDINGS) if (word.length - end.length >= 2 && word.endsWith(end)) out.add(word.slice(0, -end.length));
  return out;
};
/** The word, and the word without 1–3 glued particles (each remainder ≥ 2 letters). */
const heBare = (word: string, keepStops = false): string[] => {
  const out = [word];
  const run = HE_PARTICLES.exec(word)?.[0].length ?? 0;
  for (let i = 1; i <= run; i++) {
    const rest = word.slice(i);
    if (rest.length >= 2 && (keepStops || !HE_STOP.has(rest))) out.push(rest);
  }
  return out;
};
const heSame = (a: string, b: string): boolean => {
  if (a === b) return true;
  const oneSided = (x: string, y: string) => {
    const yForms = heEndingForms(y);
    return heBare(x).some((rest) => rest === y || [...heEndingForms(rest)].some((form) => form.length >= 3 && yForms.has(form)));
  };
  return oneSided(a, b) || oneSided(b, a);
};
const enStem = (word: string): string => {
  let s = word.replace(/'s$/, "");
  if (s.length > 4 && s.endsWith("ies")) return `${s.slice(0, -3)}y`;
  if (s.length > 4 && /(?:s|x|z|ch|sh)es$/.test(s)) return s.slice(0, -2);
  if (s.length > 3 && s.endsWith("s") && !s.endsWith("ss")) s = s.slice(0, -1);
  if (s.length >= 6 && s.endsWith("ing")) return s.slice(0, -3);
  if (s.length >= 6 && s.endsWith("ed")) return s.slice(0, -2);
  return s;
};
const sameWordMemo = new Map<string, boolean>();
const sameWord = (a: string, b: string): boolean => {
  const he = isHebrewWord(a);
  if (he !== isHebrewWord(b)) return false;
  if (!he) return enStem(a) === enStem(b);
  const key = `${a}\u0000${b}`;
  let same = sameWordMemo.get(key);
  if (same === undefined) {
    if (sameWordMemo.size > 20_000) sameWordMemo.clear();
    same = heSame(a, b);
    sameWordMemo.set(key, same);
  }
  return same;
};
const isOneOf = (word: string, list: readonly string[]) => list.some((member) => sameWord(word, member));
const isStopWord = (word: string) => (isHebrewWord(word) ? heBare(word, true).some((rest) => HE_STOP.has(rest)) : EN_STOP.has(word));
/** A word the finding's object must carry: not a function word, not a source credit. */
const isObjectWord = (word: string) =>
  !isStopWord(word) && !isOneOf(word, ATTRIBUTION_WORDS) && !isOneOf(word, REPORTER_PARENT) && !isOneOf(word, REPORTER_THIRD_EN) && !isOneOf(word, REPORTER_THIRD_HE);

/** How many of the parent's words may stand between two words of the object. */
const OBJECT_GAP = 3;
/** Each word of `wanted`, in order, within OBJECT_GAP words of the previous match, walking `words` from `start` in `step`. */
const inOrderNear = (wanted: readonly string[], words: readonly string[], start: number, step: 1 | -1): boolean => {
  let at = start;
  for (const word of step === 1 ? wanted : [...wanted].reverse()) {
    let found = -1;
    for (let k = 0; k <= OBJECT_GAP; k++) {
      const i = at + step * k;
      if (i < 0 || i >= words.length) break;
      if (sameWord(word, words[i])) { found = i; break; }
    }
    if (found < 0) return false;
    at = found + step;
  }
  return true;
};

/** Clauses: split on . ! ? ; and line breaks, never after a title ("Dr. Cohen"). */
const CLAUSES = /(?:\b(?:dr|mr|mrs|ms|prof)\.(?=\s)|[^.!?;。\n])+[.!?;。]*\s*/gi;
type ParentWords = { sentences: string[][]; all: string[] };
let parentMemo: { text: string; words: ParentWords } | null = null;
/** The parent's text as sentences of words. A question is not a report, so a sentence ending "?" never carries a finding. */
const parentWordsOf = (text: string): ParentWords => {
  if (parentMemo?.text === text) return parentMemo.words;
  const all = (text.match(CLAUSES) ?? []).map((sentence) => ({ sentence, words: tokenize(sentence) })).filter(({ words }) => words.length > 0);
  const sentences = all.filter(({ sentence }) => !sentence.trim().endsWith("?")).map(({ words }) => words);
  const words = { sentences, all: all.flatMap(({ words: w }) => w) };
  parentMemo = { text, words };
  return words;
};

/** The object after a finding: up to a contrast, without function words or source credits. */
const objectAfter = (text: string): string[] => {
  const words = tokenize(text);
  const end = words.findIndex((word) => isOneOf(word, OBJECT_END_WORDS));
  return (end < 0 ? words : words.slice(0, end)).filter(isObjectWord);
};
/** The subject before a passive or predicate finding: back to a comma, a relative, a contrast or a reporting verb. */
const objectBefore = (text: string, phrase: string): string[] => {
  if (/^(?:ו|ש|כש)(?=[֐-׿])/.test(phrase.trim())) return []; // a glued "and"/"that" starts a new clause
  const words = tokenize(text.split(/[,;:–—()"“”«»]/).pop() ?? "");
  let from = 0;
  words.forEach((word, i) => { if (isOneOf(word, CLAUSE_START_WORDS) || isOneOf(word, ATTRIBUTION_WORDS)) from = i + 1; });
  return words.slice(from).filter(isObjectWord);
};
/** True when one sentence of the parent's text holds the finding phrase with its object around it. */
const parentStates = (clause: string, finding: FindingMatch, parent: ParentWords): boolean => {
  const phrase = tokenize(findingCore(finding.phrase));
  if (phrase.length === 0) return false;
  const after = objectAfter(clause.slice(finding.index + finding.phrase.length));
  const before = finding.kind === "both" ? objectBefore(clause.slice(0, finding.index), finding.phrase) : [];
  return parent.sentences.some((words) => {
    for (let j = 0; j + phrase.length <= words.length; j++) {
      if (!phrase.every((word, i) => sameWord(word, words[j + i]))) continue;
      if (words.slice(0, j).some((word) => isOneOf(word, CONDITION_WORDS))) continue; // "if there are no signs of …" is not a report
      if (inOrderNear(after, words, j + phrase.length, 1) && inOrderNear(before, words, j - 1, -1)) return true;
    }
    return false;
  });
};

/** Who a clause credits: every third-party reporter it names, the word a
 *  reporting verb follows ("Dana says", "Dr. Cohen said"), and the words an
 *  "according to" / "לדברי" or a Hebrew reporting verb names next ("according
 *  to Dr. Cohen", "אמרה הגננת"). The parent in the third person ("Mom
 *  reports", "according to Noa's mom") is the parent's own text and credits nobody. */
const creditedSources = (clause: string): string[] => {
  const words = tokenize(clause);
  const out: string[] = [];
  const isReporter = (word: string) => isOneOf(word, REPORTER_THIRD_EN) || isOneOf(word, REPORTER_THIRD_HE);
  const isSourceWord = (word: string) => !isStopWord(word) && !isOneOf(word, ATTRIBUTION_WORDS) && !/'s$/.test(word);
  words.forEach((word, i) => {
    if (isReporter(word)) out.push(word);
    if (!isOneOf(word, ATTRIBUTION_WORDS)) return;
    const before = words.slice(Math.max(0, i - 2), i).reverse().find(isSourceWord);
    if (before && !isOneOf(before, REPORTER_PARENT)) out.push(before);
    if (!isHebrewWord(word) && !isOneOf(word, CREDIT_BEFORE_SOURCE)) return;
    for (const next of words.slice(i + 1, i + 4).filter(isSourceWord)) {
      if (isOneOf(next, REPORTER_PARENT)) break;
      out.push(next);
      if (isReporter(next)) break;
    }
  });
  return out;
};

export type HandoffFloorOptions = {
  /** The parent's own words this answer or brief was made from (the chat
   *  message, the parent's earlier turns, the logged triggers and responses).
   *  A finding the parent wrote, with its object, is theirs to pass on —
   *  including a teacher's or doctor's words the parent typed in. */
  parentText?: string;
};

/** True when this clause states a finding the parent's words do not carry (and is not a safety message). */
export function statesUnreportedFinding(clause: string, opts: HandoffFloorOptions = {}): boolean {
  if ((CONDITION_EN.test(clause) && REFERRAL_EN.test(clause)) || (CONDITION_HE.test(clause) && REFERRAL_HE.test(clause))) return false;
  const findings = findingsIn(clause);
  if (findings.length === 0) return false;
  if (!opts.parentText) return true;
  const parent = parentWordsOf(opts.parentText);
  // Every source the note credits must be one the parent named.
  if (creditedSources(clause).some((source) => !parent.all.some((word) => sameWord(source, word)))) return true;
  return findings.some((finding) => !parentStates(clause, finding, parent));
}

/** Drop every clause that states an unreported finding; an untouched note is returned byte-identical. */
export function withoutHandoffFindings(text: string, opts: HandoffFloorOptions = {}): string {
  const clauses = text.match(CLAUSES) ?? [text];
  const dropped = clauses.map((clause) => statesUnreportedFinding(clause, opts));
  if (!dropped.includes(true)) return text;
  return clauses.filter((_, i) => !dropped[i]).join("").trim();
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
