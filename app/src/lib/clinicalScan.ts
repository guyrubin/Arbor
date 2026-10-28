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
 * UNLESS:
 *   - the finding sits inside the CONDITION of an escalation line — a
 *     sentence whose main clause opens with an imperative referral ("If …,
 *     call the family", "Call the family if …", "אם …, יש להתקשר להורים";
 *     escalationCondition below). That condition is the safety message's
 *     trigger, not a claim, and in a School Brief the line may be the only
 *     "call the family" a teacher's copy carries. A finding in the line's
 *     tail (", who found…", ", as there is no evidence…", ", כי אין…") or
 *     main clause is checked like any other;
 *   - the PARENT'S OWN WORDS carry it (critic rounds 3–6): one statement the
 *     parent wrote holds a finding of the same kind ("doesn't show any signs
 *     of" = "no signs of") and EVERY content word of the clause in any order,
 *     with the clause's subject and credited source ("Dr. Levi says…",
 *     "…, according to her teacher", "לדברי הגננת") next to that finding,
 *     and the same number of negations outside the finding phrase. A
 *     statement is a sentence cut at "but / אבל", ", and" / ", ו" and a comma
 *     that opens a new subject; a question, a leading "if" / "אם" and a hedge
 *     ("I'm not sure…", "no one has told us…", "לא בטוחה ש…") are not
 *     reports. A teacher's or doctor's words the parent typed in are the
 *     parent's text. Attribution alone keeps nothing; the parent in the third
 *     person ("Mom reports", "לדברי אמה של נועה") and the child's own name
 *     need no match;
 *   - it sits in the School Brief's `crisisEscalationTrigger`, never scrubbed.
 * Known false negatives (the floor fails closed: a faithful note loses the
 * clause): a note in a different language from the parent's words; a clause
 * whose words the parent spread over two sentences ("The teacher called. She
 * said…"); a reworded noun ("evidence" for "signs"); a Hebrew noun and
 * verb of one root ("ריב" / "רבו"); a parent's statement with an
 * extra negation in it ("no signs of anxiety, not even at drop-off"); a
 * subject the parent put in a neighbouring comma part that narrates ("He was
 * seen by the pediatrician last month, who ruled out…"): a neighbouring part
 * counts only when it just names who said it.
 * English on word boundaries (case-insensitive); Hebrew as whole words with
 * a glued particle (`\b` cannot bound a Hebrew word: "לשלול" is not inside
 * "לשלוליות"). Event descriptions such as "fell asleep without any
 * difficulty" / "מטפסת ללא חשש" are not findings and are not listed. */
const NOUN_EN = String.raw`(?:signs?|evidence|indications?|indicators?|symptoms?|red\s+flags?|difficult(?:y|ies)|delays?|deficits?|impairments?|concerns?|problems?|issues?)`;
/** What a finding claims. A parent's rewording counts when it claims the same kind of thing. */
type FindingKey = "absence" | "ruled-out" | "normal" | "observed";
const HANDOFF_FINDINGS_EN: readonly { re: RegExp; key: FindingKey }[] = [
  { key: "absence", re: new RegExp(String.raw`\bno\s+(?:clear\s+|obvious\s+|apparent\s+|real\s+|significant\s+|further\s+|current\s+)?(?:evidence|signs?|indications?|indicators?|symptoms?|red\s+flags?|traces?)\s+(?:of|that|for)\b`, "gi") },
  { key: "absence", re: new RegExp(String.raw`\b(?:show|shows|showed|showing|display|displays|displayed|exhibit|exhibits|exhibited|present|presents|presented|demonstrate|demonstrates|demonstrated)\s+no\s+(?:\w+\s+){0,3}?${NOUN_EN}\b`, "gi") },
  { key: "absence", re: new RegExp(String.raw`\b(?:does|did|do|is|was|are|were)\s*(?:not|n['’]t)\s+(?:show|showing|display|exhibit|present\s+with|demonstrate|have|appear\s+to\s+have)\s+(?:any\s+)?(?:\w+\s+){0,3}?${NOUN_EN}\b`, "gi") },
  { key: "absence", re: new RegExp(String.raw`\bno\s+(?:\w+[\s,]+){0,4}?(?:difficult(?:y|ies)|delays?|deficits?|impairments?|red\s+flags?)\b`, "gi") },
  { key: "absence", re: new RegExp(String.raw`\bno\s+(?:\w+\s+){0,3}?concerns?\s+(?:were\s+|was\s+|have\s+been\s+|has\s+been\s+)?(?:noted|observed|found|identified|detected|raised|present|seen)\b`, "gi") },
  { key: "absence", re: new RegExp(String.raw`\b(?:without|free\s+(?:of|from))\s+(?:any\s+)?(?:signs?|evidence|indications?|symptoms?)\s+of\b`, "gi") },
  { key: "ruled-out", re: new RegExp(String.raw`\brul(?:e|es|ed|ing)\s+out\b`, "gi") },
  { key: "normal", re: new RegExp(String.raw`\bwithin\s+(?:the\s+)?normal\s+(?:limits|range)\b`, "gi") },
  { key: "absence", re: new RegExp(String.raw`\bnothing\s+(?:to\s+suggest|suggests|that\s+suggests|indicates|that\s+indicates|concerning|of\s+concern)\b`, "gi") },
  { key: "normal", re: new RegExp(String.raw`\b(?:screen(?:ed|ing)?\s+(?:negative|clear|normal)|pass(?:ed|es)?\s+(?:the\s+|a\s+)?(?:screening|screen))\b`, "gi") },
  { key: "normal", re: new RegExp(String.raw`\b(?:typical|normal)\s+development\b|\bdevelop(?:s|ing)\s+(?:normally|typically|on\s+track)\b|\bdevelopmentally\s+(?:normal|typical|on\s+track)\b`, "gi") },
  { key: "observed", re: new RegExp(String.raw`\b(?:was|were|has\s+been|have\s+been|had\s+been)\s+(?:observed|noted|seen|identified|detected)\b(?!\s+by\b)`, "gi") },
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
const HE_RULED_OUT: ReadonlySet<string> = new Set(["לשלול", "נשלל", "נשללה", "נשללו", "שולל", "שוללת"]);
const HE_NORMAL: ReadonlySet<string> = new Set([
  "בטווח התקין", "בטווח הנורמה", "בגבולות הנורמה", "בגבולות התקין", "התפתחות תקינה",
  "מתפתח כרגיל", "מתפתחת כרגיל", "מתפתח באופן תקין", "מתפתחת באופן תקין",
]);
const heWhole = (phrase: string) => String.raw`(?<!\p{L})(?:ו|ש|כש)?${phrase.trim().split(/\s+/).join(String.raw`\s+`)}(?!\p{L})`;
const HANDOFF_FINDING_HE = new RegExp(HANDOFF_FINDING_TERMS_HE.map(heWhole).join("|"), "gu");
/** Hebrew unattributed observation ("was observed / identified"), as whole words. */
const UNATTRIBUTED_FINDING_HE = /(?<!\p{L})(?:ו|ש|כש)?(?:נצפה|נצפתה|נצפו|זוהה|זוהתה|זוהו)(?!\p{L})/gu;

type FindingMatch = { phrase: string; index: number; key: FindingKey };
/** The finding's own words without a glued Hebrew particle. */
const findingCore = (phrase: string) => phrase.trim().replace(/^(?:ו|ש|כש)(?=[֐-׿])/, "");
const heKey = (phrase: string): FindingKey => {
  const core = findingCore(phrase).replace(/\s+/g, " ");
  return HE_RULED_OUT.has(core) ? "ruled-out" : HE_NORMAL.has(core) ? "normal" : "absence";
};
const findingsIn = (text: string): FindingMatch[] => {
  const out: FindingMatch[] = [];
  const scan = (re: RegExp, keyOf: (phrase: string) => FindingKey) => {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) out.push({ phrase: m[0], index: m.index ?? 0, key: keyOf(m[0]) });
  };
  for (const { re, key } of HANDOFF_FINDINGS_EN) scan(re, () => key);
  scan(HANDOFF_FINDING_HE, heKey);
  scan(UNATTRIBUTED_FINDING_HE, () => "observed");
  return out.sort((a, b) => a.index - b.index);
};

/** The first invented-finding phrase in the text, or null (the parent's words are not considered here). */
export function findHandoffFinding(text: string): string | null {
  return findingsIn(text)[0]?.phrase.trim() ?? null;
}

/* ── Escalation lines ────────────────────────────────────────────────────── */
/** A parent's hypothetical ("if there are no signs …", "אם אין סימנים …") is not a report; a narrated "when" is. */
const HYPOTHETICAL_START = /\b(?:if|unless|whether|in\s+case)\b|^\s*should\b|(?<!\p{L})ו?(?:אם|במידה|במקרה)(?!\p{L})/giu;
const LEADING_HYPOTHETICAL = /^\s*(?:if|unless|whether|in\s+case|should)\b|^\s*ו?(?:אם|במידה|במקרה)(?!\p{L})/iu;
const CONDITION_END = /[,:;–—]/;
/** True when `index` sits inside a condition (of the kind `starts` finds) that starts earlier in `text`. */
const insideCondition = (text: string, index: number, starts: RegExp): boolean => {
  starts.lastIndex = 0;
  for (const m of text.matchAll(starts)) {
    const at = m.index ?? 0;
    if (at > index) break;
    if (!CONDITION_END.test(text.slice(at, index))) return true;
  }
  return false;
};
/** Who a referral reaches: a doctor by title counts ("talk with Dr. Levi", "דברו עם ד"ר לוי"). */
const PROFESSIONAL_EN = String.raw`(?:pediatrician|paediatrician|doctor|dr|GP|professional|clinician|nurse|therapist|specialist|psychologist|psychiatrist|counsell?or|parents?|family|families)`;

/* Rounds 6–7 (critic rounds 5–7): an escalation line is a sentence whose
 * MAIN clause opens with an imperative referral ("call the family", "talk
 * with your pediatrician", "the teacher should contact the family", "יש
 * להתקשר להורים", "כדאי להתייעץ עם…", "דברו עם ד"ר לוי") and that a real
 * condition governs. Only a finding INSIDE that condition is exempt — it is
 * the trigger, not a claim. The condition is either
 *   - leading: from the start up to the comma or dash just before the
 *     imperative, however many commas it holds ("If he hurts himself or
 *     others, or shows no signs of calming…, call…", "After 20 minutes with
 *     no signs of calming, call…", "כעבור 20 דקות ללא סימנים…, התקשרו…"); or
 *   - after the command: from a real conjunction ("Call the family if …",
 *     "… should he show no signs …", "… in the event that …", "התקשרו להורים
 *     בכל מקרה ש…") to the first place a new clause starts: ", and",
 *     ", though", ", ו", a Hebrew "ו" before a new clause, a comma that opens
 *     a new subject (the comma pair of "if, after two weeks, …" excepted), a
 *     colon or a dash.
 * Either way it stops at a tail — ", who / which / as / since / because /
 * so", ", כי", ", ש…" — and a finding there, or anywhere in the main clause,
 * is checked like any other. A condition that is not a hypothetical and holds
 * a past-tense verb narrates ("When tested last month he showed no signs…")
 * and is never a trigger. "Once a week", "when convenient", "Contact with
 * peers…", "פנו ההורים", "התקשרו אלינו", "she told us to call" and "ואפשר
 * לפנות" are not conditions or commands. */
/** A bare call / contact needs its object ("call the family", "contact Dr. Levi", "call 112"); "Contact with peers…" is a noun. Talk / see / consult name a professional or the family. */
const REFERRAL_OBJECT_EN = String.raw`(?:the|your|his|her|their|our|a|an|us|me|them|him|dr|mr|mrs|ms|prof|911|112|999|101|988|emergency|${PROFESSIONAL_EN})`;
const REFERRAL_VERB_EN = String.raw`(?:(?:call|phone|contact|notify|inform|alert)\s+${REFERRAL_OBJECT_EN}|let\s+(?:\S+\s+){1,6}?know|seek\s+(?:help|care|advice|support)|get\s+(?:help|medical\s+help|emergency\s+help)|(?:check\s+(?:in\s+)?with|reach\s+out\s+to|talk\s+(?:with|to)|speak\s+(?:with|to)|consult|see|tell|discuss\s+(?:it\s+|this\s+|that\s+)?with|refer\s+(?:him\s+|her\s+|them\s+)?to)\s+(?:\S+\s+){0,3}?${PROFESSIONAL_EN}s?)\b`;
const IMPERATIVE_EN = new RegExp(String.raw`^\s*(?:(?:then|please|immediately|right\s+away|always)\s+)*(?:(?:you|staff|we|teachers?|the\s+(?:teacher|teachers|staff|school|nurse|caregiver))\s+(?:should|must|need\s+to|needs\s+to|have\s+to|has\s+to)\s+(?:(?:immediately|always|please|also)\s+)?)?${REFERRAL_VERB_EN}`, "i");
const REFERRAL_INFINITIVE_HE = String.raw`(?:להתקשר|לפנות|לעדכן|להודיע|ליידע|לדבר|לשוחח|להתייעץ|להיוועץ|להפנות)`;
/** A Hebrew command form is also a past tense ("פנו ההורים לרופאה", "התקשרו אלינו מהגן"): followed by a subject, an "us/me", or "from the …", it narrates. */
const HE_COMMAND = String.raw`(?:התקשרו|התקשרי|פנו|פני|דברו|דברי|עדכנו|עדכני|הודיעו|הודיעי|יידעו|התייעצו|התייעצי|שוחחו|שוחחי)`;
const HE_PAST_FOLLOWER = String.raw`(?:ה\p{L}+|אלינו|אליי|אלי|אליו|אליה|אותנו|אותי|לנו|לי|מה\p{L}+)`;
const IMPERATIVE_HE = new RegExp(String.raw`^\s*(?:(?:אז|מיד|נא)\s+)?(?:(?:יש|כדאי|מומלץ|צריך|חשוב)\s+(?:\S+\s+)?${REFERRAL_INFINITIVE_HE}(?!\p{L})|${HE_COMMAND}(?!\p{L})(?!\s+${HE_PAST_FOLLOWER}(?!\p{L})))`, "u");
const opensWithReferral = (text: string) => IMPERATIVE_EN.test(text) || IMPERATIVE_HE.test(text);
/** A condition that is not a hypothetical (when / once / after 20 minutes /
 *  with no … / כש / כאשר / כעבור / אחרי / ללא) and holds a past-tense verb
 *  narrates what happened ("When tested last month he showed no signs of
 *  delay…", "כשהרופאה בדקה אותו לא נמצאו…"): never an escalation trigger. */
const HYPOTHETICAL_LEAD = /^\s*(?:if|unless|in\s+case|should|in\s+the\s+event)\b|^\s*ו?(?:אם|במידה|במקרה|בכל\s+מקרה)(?!\p{L})/iu;
const PAST_EN = /\b(?:found|showed|displayed|exhibited|demonstrated|presented|saw|ruled|tested|assessed|checked|evaluated|examined|screened|diagnosed|did\s*(?:not|n['’]t)|(?:was|were|had\s+been|has\s+been|have\s+been)\s+(?:\w+\s+)?(?:seen|tested|assessed|checked|evaluated|examined|screened|observed|noted|found|ruled))\b/i;
const PAST_HE = /(?<!\p{L})(?:ו|ש|כש)?(?:נמצא|נמצאה|נמצאו|הראה|הראתה|הראו|נבדק|נבדקה|נבדקו|בדק|בדקה|בדקו|מצא|מצאה|מצאו|נצפה|נצפתה|נצפו|נשלל|נשללה|נשללו|היה|הייתה|היו|אובחן|אובחנה|ראה|ראתה)(?!\p{L})/u;
const narratesPast = (condition: string) => !HYPOTHETICAL_LEAD.test(condition) && (PAST_EN.test(condition) || PAST_HE.test(condition));
/** Where a real condition starts.
 *  Anywhere: if / unless / in case / in the event / should + subject; when /
 *  whenever / once / as soon as before a subject, "after", "no" or a comma
 *  ("when, after 20 minutes, …"); after + a time ("after 20 minutes"); אם /
 *  במידה / במקרה / בכל מקרה ש; כאשר / ברגע / a glued כש before a subject;
 *  כעבור / אחרי + a time. Leading only: "with no …", "without …", "ללא …".
 *  So "once a week", "when convenient", "when playing" are not conditions. */
const SUBJECT_EN = String.raw`(?:(?:he|she|they|it|we|you|i|there|the|his|her|their|this|that|your|my|our|no|after|before|within|still)\b|[A-Z]|,)`;
const TIME_EN = String.raw`(?:\d+|a|an|one|two|three|four|five|six|ten|fifteen|twenty|thirty|several|some|a\s+few)\s+(?:more\s+)?(?:minutes?|hours?|days?|weeks?|months?)`;
const TIME_HE = String.raw`(?:\d+|כמה|שבוע|שבועיים|חודש|חודשיים|יום|יומיים|שעה|רבע|חצי)`;
const CONJUNCTIONS = [
  /\b(?:if|unless|in\s+case|in\s+the\s+event)\b|\bshould\s+(?=(?:he|she|they|it|we|you|there|the)\b)/giu,
  new RegExp(String.raw`\b(?:[Ww]hen|[Ww]henever|[Oo]nce|[Aa]s\s+soon\s+as)\s*(?=${SUBJECT_EN})|\b[Aa]fter\s+(?=${TIME_EN}\b)`, "gu"),
  /(?<!\p{L})ו?(?:אם|במידה|במקרה)(?!\p{L})|(?<!\p{L})בכל\s+מקרה\s+(?=ש\p{L})/gu,
  /(?<!\p{L})ו?(?:כאשר|ברגע)\s+(?=(?:ה\p{L}|הוא|היא|הם|הן|אני|אנחנו|אין|יש|לא|ש\p{L}))/gu,
  /(?<!\p{L})ו?כש(?=(?:ה\p{L}|אין|יש|לא|אני|אנחנו|את))/gu,
  new RegExp(String.raw`(?<!\p{L})(?:כעבור|אחרי|לאחר)\s+(?=${TIME_HE}(?!\p{L}))`, "gu"),
];
const LEADING_ONLY = /^\s*(?:with\s+no|without)\b|^\s*ללא(?!\p{L})/iu;
const conjunctionsIn = (text: string): { at: number; end: number }[] => {
  const out = CONJUNCTIONS.flatMap((re) => {
    re.lastIndex = 0;
    return [...text.matchAll(re)].map((m) => ({ at: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
  });
  const lead = LEADING_ONLY.exec(text);
  if (lead) out.push({ at: lead.index, end: lead.index + lead[0].length });
  return out.sort((x, y) => x.at - y.at);
};
/** Where a leading condition stops: a colon or dash, or a tail (", who / which / as / since / because / so", ", כי", ", ש…"). */
const CONDITION_STOP = /[:–—]|,\s*(?:(?:who|which|whose|as|since|because|so|that)\b|כי(?!\p{L})|ש(?=\p{L}))/iu;
const stopAfter = (text: string, from: number): number => {
  const m = CONDITION_STOP.exec(text.slice(from));
  return m ? from + m.index : text.length;
};
/** After a command, a condition also stops where a new clause starts: ", and",
 *  ", though", ", ו", a Hebrew "ו" before a new clause ("ואין", "והוא"), or a
 *  comma that opens a new subject — except the comma pair of a parenthetical
 *  right after the conjunction ("if, after two weeks, there are…"). */
const NEW_CLAUSE_STOP = /,\s*(?:and|though|although|but|while|whereas|yet)\b|,\s*ו(?=\p{L})|\sו(?=(?:אין|יש|לא|ה\p{L}|אני|אנחנו)(?!\p{L}))/iu;
const trailingStop = (text: string, conjunction: { at: number; end: number }): number => {
  let from = conjunction.end;
  const parenthetical = /^\s*,[^,]*,/.exec(text.slice(from));
  if (parenthetical) from += parenthetical[0].length;
  let end = Math.min(stopAfter(text, from), (() => { const m = NEW_CLAUSE_STOP.exec(text.slice(from)); return m ? from + m.index : text.length; })());
  for (const m of text.slice(from, end).matchAll(/,/g)) {
    const at = from + (m.index ?? 0);
    const next = text.slice(at + 1).split(/[,:–—]/)[0];
    if (opensNewSubject(next) && !isCreditPart(next)) { end = at; break; }
  }
  return end;
};
/** The span of the condition that governs an escalation line's imperative referral, or null when the clause is not one. */
export function escalationCondition(clause: string): { start: number; end: number } | null {
  if (opensWithReferral(clause)) {
    const conjunction = conjunctionsIn(clause).find((c) => c.at > 0 && !LEADING_ONLY.test(clause.slice(c.at)));
    if (conjunction === undefined) return null;
    const end = trailingStop(clause, conjunction);
    return narratesPast(clause.slice(conjunction.at, end)) ? null : { start: conjunction.at, end };
  }
  const lead = conjunctionsIn(clause)[0];
  if (lead === undefined || clause.slice(0, lead.at).trim() !== "") return null;
  for (const m of clause.matchAll(/[,–—]/g)) {
    const at = m.index ?? 0;
    if (clause.slice(0, at).includes(":")) return null;
    if (!opensWithReferral(clause.slice(at + 1))) continue;
    const end = Math.min(at, stopAfter(clause, lead.at));
    return narratesPast(clause.slice(0, at)) ? null : { start: lead.at, end };
  }
  return null;
}
/** True when the clause is an escalation line (its main clause an imperative referral, a real condition governing it). */
export function isEscalationLine(clause: string): boolean {
  return escalationCondition(clause) !== null;
}

/* ── Words: "does the parent's text carry this clause?" ────────────────────
 * Tokens are lower-cased words (a hyphen splits: "drop-off" = "drop off";
 * ד"ר = ד״ר). English words compare on a light stem (shows/showed,
 * difficulty/difficulties). Hebrew words compare with their glued particles
 * and endings handled (the idea of practice/dailyPlan.ts's Hebrew edges —
 * one-letter prefixes in front, endings after — with its own matcher here):
 * one side may carry up to three particles (ו ה ש ל ב כ מ) the other lacks
 * ("לחרדה" ~ "חרדה", "שאין" ~ "אין"), an ending may differ (ה ת י ו יי ים ות
 * ית יות יים; final letters folded: "סימנים" ~ "סימן") with at least three
 * letters of the word shared, and each side may carry a different ב / ל
 * ("בגן" ~ "לגן"). Never other particles stripped on both sides at once:
 * that is how "מורים" (teachers) would meet "הורים" (parents). */
const HE_LETTER = /[א-ת]/;
const isHebrewWord = (word: string) => HE_LETTER.test(word);
const HE_FINAL: Record<string, string> = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };
const foldHe = (word: string) => word.replace(/[ךםןףץ]/g, (c) => HE_FINAL[c] ?? c);
const tokenize = (text: string): string[] =>
  (text.normalize("NFC").replace(/\p{M}/gu, "").replace(/(?<=[א-ת])"(?=[א-ת])/g, "״").replace(/(?<=[א-ת])'(?=[א-ת])/g, "׳")
    .toLocaleLowerCase().replace(/[’`]/g, "'").match(/[\p{L}\p{N}]+(?:['״׳][\p{L}\p{N}]+)*/gu) ?? [])
    .map((word) => (isHebrewWord(word) ? foldHe(word) : word));
const heWords = (words: readonly string[]): ReadonlySet<string> => new Set(words.map(foldHe));

/** Hebrew function words a restatement may add or drop. Negations are counted, never here. */
const HE_STOP = heWords([
  "של", "את", "עם", "על", "אל", "גם", "רק", "כי", "או", "וגם", "אבל", "אך", "כך", "כן", "מן", "עוד", "כבר", "מאוד", "כל", "יש",
  "הוא", "היא", "הם", "הן", "זה", "זו", "זאת", "אלה", "אני", "אנחנו", "אתה", "אתם", "אתן",
  "לו", "לה", "להם", "להן", "לי", "לנו", "לך", "שלו", "שלה", "שלהם", "שלי", "שלנו", "שלך", "אותו", "אותה", "אותם",
  "היה", "הייתה", "היו", "יהיה", "כאשר", "בזמן", "אחרי", "לפני", "מאז", "בתוך",
  // the child, named by the role rather than the name the note uses
  "ילד", "ילדה", "ילדים", "בן", "בת", "תינוק", "תינוקת",
]);
/** English function words a restatement may add or drop. Negations are counted, never here. */
const EN_STOP: ReadonlySet<string> = new Set([
  "a", "an", "the", "of", "for", "to", "in", "on", "at", "by", "with", "from", "about", "into", "onto", "as", "and", "or", "so",
  "than", "then", "that", "this", "these", "those", "there", "here", "it", "its", "he", "she", "they", "him", "her", "his", "hers",
  "them", "their", "theirs", "i", "me", "my", "mine", "we", "us", "our", "ours", "you", "your", "is", "are", "was", "were", "be",
  "been", "being", "am", "has", "have", "had", "having", "do", "does", "did", "any", "some", "very", "really", "just", "also",
  "still", "even", "now", "all", "much", "quite", "who", "which", "whom", "whose", "what", "when", "where", "since", "during",
  "after", "before", "over", "under",
  // the child, named by the role rather than the name the note uses
  "child", "children", "kid", "kids", "son", "daughter", "boy", "girl", "baby", "toddler",
]);
/** Negations: the parent's statement must carry at least as many as the clause. */
const NEGATION_EN: ReadonlySet<string> = new Set(["no", "not", "never", "none", "nothing", "without", "nor", "cannot"]);
const NEGATION_HE = heWords(["אין", "לא", "ללא", "בלי", "אינו", "אינה", "אינם", "אינן", "מבלי"]);
const isNegation = (word: string) => (isHebrewWord(word)
  ? NEGATION_HE.has(word) || NEGATION_HE.has(word.replace(/^(?:ו|ש|כש|וכש|וש)/, ""))
  : NEGATION_EN.has(word) || word.endsWith("n't"));
/** The parent, in the third person ("Mom reports…", "לדברי אמה של נועה"): their own text, nothing to match. */
const REPORTER_PARENT = ["mom", "mum", "mommy", "mummy", "mama", "mother", "dad", "daddy", "papa", "father", "parent", "family",
  ...heWords(["אמא", "אבא", "הורה", "הורים", "משפחה", "אמה", "אמו", "אביה", "אביו", "הוריה", "הוריו"])];
/** Verbs and prepositions that only credit a source ("according to", "concluded", "לדברי"); the source itself is a content word. */
const ATTRIBUTION_WORDS = ["according", "per", "reports", "reported", "says", "said", "notes", "noted", "tells", "told", "mentions",
  "mentioned", "shares", "shared", "observes", "observed", "notices", "noticed", "describes", "described", "writes", "wrote",
  "explains", "explained", "confirms", "confirmed", "finds", "found", "sees", "saw", "concludes", "concluded", "thinks", "thought",
  "believes", "believed", "feels", "felt",
  ...heWords(["לדברי", "לדבריה", "לדבריו", "לדבריהם", "לפי", "כפי", "סיפר", "סיפרה", "סיפרו", "מספר", "מספרת", "מספרים", "מספרות",
    "אמר", "אמרה", "אמרו", "ציין", "ציינה", "ציינו", "מציין", "מציינת", "דיווח", "דיווחה", "דיווחו", "מדווח", "מדווחת", "מדווחים",
    "ראה", "ראתה", "ראו", "הבחין", "הבחינה", "הבחינו", "כתב", "כתבה", "כתבו", "קבע", "קבעה", "אומר", "אומרת", "אומרים", "אומרות",
    "חושב", "חושבת", "חושבים", "סבור", "סבורה", "מצא", "מצאה", "מצאו", "מסר", "מסרה", "מסרו", "טוען", "טוענת"])];
/** A parent's sentence is cut at a contrast: "no signs of anxiety at school, but lots of crying at home" is two statements. */
const CONTRAST = /\b(?:but|while|although|though|whereas|however|yet)\b|(?<!\p{L})ו?(?:אבל|אך|אולם|בעוד|למרות)(?!\p{L})/giu;

const HE_PARTICLES = /^[והשלבכמ]{1,3}/;
const HE_ENDINGS = ["יות", "יימ", "ימ", "ות", "ית", "יי", "ה", "ת", "י", "ו"];
const heEndingForms = (word: string): string[] => {
  const out = [word];
  // a present participle and its past share a stem: נושכ / נשכ, בוכה / בכה
  if (word.length === 4 && word[1] === "ו") out.push(word[0] + word.slice(2));
  for (const end of HE_ENDINGS) if (word.length - end.length >= 2 && word.endsWith(end)) out.push(word.slice(0, -end.length));
  return out;
};
/** The word, and the word without 1–3 glued particles (each remainder ≥ 2 letters, not a function word unless asked). */
const heBare = (word: string, keepStops = false): string[] => {
  const out = [word];
  const run = HE_PARTICLES.exec(word)?.[0].length ?? 0;
  for (let i = 1; i <= run; i++) {
    const rest = word.slice(i);
    if (rest.length >= 2 && (keepStops || !HE_STOP.has(rest))) out.push(rest);
  }
  return out;
};
/** "בגן" / "לגן" → "גן": a ב or ל on each side (after an optional ו/ש). */
const hePrepless = (word: string): string | null => {
  const rest = /^[וש]?[בל](\p{L}{2,})$/u.exec(word)?.[1];
  return rest && !HE_STOP.has(rest) ? rest : null;
};
const heSame = (a: string, b: string): boolean => {
  if (a === b) return true;
  const oneSided = (x: string, y: string) => {
    const yForms = new Set(heEndingForms(y));
    return heBare(x).some((rest) => rest === y || heEndingForms(rest).some((form) => form.length >= 3 && yForms.has(form)));
  };
  const prep = hePrepless(a);
  return oneSided(a, b) || oneSided(b, a) || (prep !== null && prep === hePrepless(b));
};
/** Irregular forms a parent and a note swap ("fought" / "a fight", "bit" / "biting"). */
const EN_IRREGULAR: Readonly<Record<string, string>> = {
  bit: "bite", bites: "bite", biting: "bite", bitten: "bite", fought: "fight", fights: "fight", fighting: "fight",
  threw: "throw", thrown: "throw", throws: "throw", throwing: "throw", hit: "hit", hits: "hit", hitting: "hit",
  ran: "run", runs: "run", running: "run", cried: "cry", cries: "cry", crying: "cry", fell: "fall", fallen: "fall", falling: "fall",
  took: "take", taken: "take", taking: "take", gave: "give", given: "give", giving: "give", got: "get", gotten: "get", getting: "get",
  slept: "sleep", sleeping: "sleep", ate: "eat", eaten: "eat", eating: "eat", went: "go", gone: "go", came: "come", coming: "come",
  spoke: "speak", spoken: "speak", woke: "wake", woken: "wake", sat: "sit", sitting: "sit",
};
const enStem = (word: string): string => {
  const irregular = EN_IRREGULAR[word.replace(/'s$/, "")];
  if (irregular) return irregular;
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

/* ── The parent's statements, indexed once per parent text ─────────────── */
/** Cost caps (critic round 4 P2): the parent's text is read up to this many
 *  words (a full 200-log School Brief is ~16k), and one note or brief checks
 *  at most this many finding clauses against it. Past either cap the floor
 *  fails closed: a clause it did not check is dropped. */
export const HANDOFF_PARENT_WORDS_MAX = 20_000;
export const HANDOFF_FLOOR_MAX_CHECKS = 64;
/** Clauses: split on . ! ? ; and line breaks, never after a title ("Dr. Cohen"). */
const CLAUSES = /(?:\b(?:dr|mr|mrs|ms|prof)\.(?=\s)|[^.!?;。\n])+[.!?;。]*\s*/gi;

/** Comma parts of a text (also split at a colon or dash), as offsets. */
const partsOf = (text: string): { start: number; end: number }[] => {
  const out: { start: number; end: number }[] = [];
  let start = 0;
  for (const m of text.matchAll(/[,:–—]/g)) { out.push({ start, end: m.index ?? 0 }); start = (m.index ?? 0) + 1; }
  out.push({ start, end: text.length });
  return out;
};
/** A short part that only names who said it — a reporter or a name and at
 *  most a saying verb: "according to her teacher", "his teacher said", "the
 *  teacher told me", "אמרה הגננת", "לדברי הגננת". A part that narrates an
 *  event ("Saw Dr. Levi for his ears", "היינו אצל ד"ר לוי") never does. */
const CREDIT_LEAD = ["according", "per", ...heWords(["לדברי", "לדבריה", "לדבריו", "לדבריהם", "לפי", "כפי"])];
const SAYING_WORDS = ["says", "said", "reports", "reported", "tells", "told", "notes", "noted", "mentions", "mentioned", "writes", "wrote",
  "explains", "explained", "confirms", "confirmed", "thinks", "thought", "believes", "believed", "feels", "felt", "concludes", "concluded",
  "shares", "shared", "describes", "described",
  ...heWords(["סיפר", "סיפרה", "סיפרו", "מספר", "מספרת", "מספרים", "מספרות", "אמר", "אמרה", "אמרו", "ציין", "ציינה", "ציינו", "מציין",
    "מציינת", "דיווח", "דיווחה", "דיווחו", "מדווח", "מדווחת", "מדווחים", "כתב", "כתבה", "כתבו", "קבע", "קבעה", "אומר", "אומרת", "אומרים",
    "אומרות", "חושב", "חושבת", "חושבים", "סבור", "סבורה", "מסר", "מסרה", "מסרו", "טוען", "טוענת"])];
const OBJECT_PRONOUNS: ReadonlySet<string> = new Set(["me", "us", "him", "her", "them", ...heWords(["לי", "לנו", "לו", "לה", "להם"])]);
const isCreditPart = (text: string): boolean => {
  const words = tokenize(text);
  while (words.length > 1 && OBJECT_PRONOUNS.has(words[words.length - 1])) words.pop();
  if (words.length === 0 || words.length > 6) return false;
  const [first, second] = words;
  return isOneOf(first, CREDIT_LEAD) || isOneOf(words[words.length - 1], SAYING_WORDS)
    || (isHebrewWord(first) && (isOneOf(first, SAYING_WORDS) || (first === "כך" && second !== undefined && isOneOf(second, SAYING_WORDS))));
};
/** A part of the note that credits someone, however it says so ("Dr. Levi found", "according to the teacher"). */
const creditsSomeone = (text: string): boolean => {
  const words = tokenize(text);
  return words.length > 0 && words.length <= 6 && words.some((word) => isOneOf(word, CREDIT_LEAD) || isOneOf(word, ATTRIBUTION_WORDS));
};
/** The text with its finding phrases blanked, to count the negations outside them. */
const outsidePhrases = (text: string, findings: readonly FindingMatch[]) =>
  findings.reduce((out, f) => out.slice(0, f.index) + " ".repeat(f.phrase.length) + out.slice(f.index + f.phrase.length), text);
/** Where a parent's sentence holds two statements: ", and" / ", ו", or a comma
 *  that opens a new subject (a pronoun, "the", "there", a capitalised name;
 *  a Hebrew word with ה, אני, אנחנו) unless that part only credits a source. */
const AND_JOIN = /,\s*(?:and\b|ו(?=\p{L}))/giu;
const NEW_SUBJECT_EN = /^\s*(?:he|she|they|it|we|i|his|her|their|its|my|our|the|this|that|there|these|those)\b/i;
const NEW_SUBJECT_HE = /^\s*(?:ה\p{L}{2,}|אני|אנחנו)(?!\p{L})/u;
const opensNewSubject = (part: string) => NEW_SUBJECT_EN.test(part) || /^\s*[A-Z]/.test(part) || NEW_SUBJECT_HE.test(part);
/** A parent's hedge is not a report, like a question: "I'm not sure there are
 *  no signs…", "no one has told us…", "the doctor didn't say…", "לא בטוחה ש…". */
const HEDGE = /\b(?:not\s+sure|unsure|can['’]?t\s+say|cannot\s+say|didn['’]?t\s+say|did\s+not\s+say|don['’]?t\s+know|do\s+not\s+know|not\s+certain|no\s*-?\s*one|nobody|maybe|perhaps|might|unclear|not\s+clear)\b|(?<!\p{L})(?:לא\s+(?:בטוח|בטוחה|בטוחים|בטוחות|יודע|יודעת|יודעים|יודעות|ידוע|ברור|אמר|אמרה|אמרו)|אף\s+(?:אחד|אחת)|אולי|ייתכן|יתכן)(?!\p{L})/iu;

/** In its own comma part, a parent's finding reaches back this many words for its subject or source ("Her teacher said that she thinks there are no signs…"). */
const SPAN_LEAD_WORDS = 8;
type Statement = {
  /** Its words. */
  words: readonly string[];
  /** The kinds of finding it states (outside any "if"). */
  keys: ReadonlySet<FindingKey>;
  /** Each finding it states, with the words next to it: up to SPAN_LEAD_WORDS before it and the rest of its comma part, and a part on either side that only names who said it. */
  spans: { key: FindingKey; words: readonly string[] }[];
  /** Negations outside its finding phrases ("I'm NOT sure there are no signs"). */
  negations: number;
};
type ParentIndex = {
  statements: Statement[];
  /** The statements a word occurs in. */
  statementsWith: (word: string) => ReadonlySet<number>;
};
const EMPTY: ReadonlySet<number> = new Set();
const addTo = (map: Map<string, Set<number>>, key: string, id: number) => {
  let ids = map.get(key);
  if (!ids) map.set(key, (ids = new Set()));
  ids.add(id);
};
const buildParentIndex = (text: string): ParentIndex => {
  const statements: Statement[] = [];
  const en = new Map<string, Set<number>>();
  const heTok = new Map<string, Set<number>>(), heBareMap = new Map<string, Set<number>>();
  const heEnds = new Map<string, Set<number>>(), heBareEnds = new Map<string, Set<number>>(), hePrep = new Map<string, Set<number>>();
  let budget = HANDOFF_PARENT_WORDS_MAX;
  for (const sentence of text.match(CLAUSES) ?? []) {
    if (budget <= 0) break;
    // A question or a leading "if" is not a report.
    if (sentence.trim().endsWith("?") || LEADING_HYPOTHETICAL.test(sentence)) continue;
    const cuts = new Set([0, sentence.length]);
    for (const m of sentence.matchAll(CONTRAST)) cuts.add(m.index ?? 0);
    for (const m of sentence.matchAll(AND_JOIN)) cuts.add(m.index ?? 0);
    for (const part of partsOf(sentence).slice(1)) {
      const after = sentence.slice(part.start, part.end);
      if (sentence[part.start - 1] === "," && opensNewSubject(after) && !isCreditPart(after)) cuts.add(part.start - 1);
    }
    const bounds = [...cuts].sort((x, y) => x - y);
    const sentenceFindings = findingsIn(sentence);
    for (let c = 0; c + 1 < bounds.length; c++) {
      const [from, to] = [bounds[c], bounds[c + 1]];
      const statementText = sentence.slice(from, to);
      const words = tokenize(statementText);
      if (words.length === 0) continue;
      budget -= words.length;
      if (HEDGE.test(statementText)) continue;
      const local = sentenceFindings.filter((f) => f.index >= from && f.index < to).map((f) => ({ ...f, index: f.index - from }));
      const reported = local.filter((f) => !insideCondition(sentence, f.index + from, HYPOTHETICAL_START));
      const parts = partsOf(statementText);
      const partWords = parts.map((part) => tokenize(statementText.slice(part.start, part.end)));
      const id = statements.length;
      statements.push({
        words,
        keys: new Set(reported.map((f) => f.key)),
        spans: reported.map((f) => {
          const i = parts.findIndex((part) => f.index >= part.start && f.index < part.end);
          const before = tokenize(statementText.slice(parts[i].start, f.index)).length;
          const own = partWords[i].slice(Math.max(0, before - SPAN_LEAD_WORDS));
          const credit = (j: number) => (parts[j] && isCreditPart(statementText.slice(parts[j].start, parts[j].end)) ? partWords[j] : []);
          return { key: f.key, words: [...credit(i - 1), ...own, ...credit(i + 1)] };
        }),
        negations: tokenize(outsidePhrases(statementText, local)).filter(isNegation).length,
      });
      for (const word of words) {
        if (!isHebrewWord(word)) { addTo(en, enStem(word), id); continue; }
        addTo(heTok, word, id);
        for (const rest of heBare(word)) {
          addTo(heBareMap, rest, id);
          for (const form of heEndingForms(rest)) if (form.length >= 3) addTo(heBareEnds, form, id);
        }
        for (const form of heEndingForms(word)) if (form.length >= 3) addTo(heEnds, form, id);
        const prep = hePrepless(word);
        if (prep) addTo(hePrep, prep, id);
      }
    }
  }
  const memo = new Map<string, ReadonlySet<number>>();
  /* The same relation as sameWord, read from the index. */
  const statementsWith = (word: string): ReadonlySet<number> => {
    let ids = memo.get(word);
    if (ids) return ids;
    if (!isHebrewWord(word)) ids = en.get(enStem(word)) ?? EMPTY;
    else {
      const all = new Set<number>();
      const add = (found?: Set<number>) => found?.forEach((id) => all.add(id));
      for (const rest of heBare(word)) {
        add(heTok.get(rest));
        for (const form of heEndingForms(rest)) if (form.length >= 3) add(heEnds.get(form));
      }
      add(heBareMap.get(word));
      for (const form of heEndingForms(word)) if (form.length >= 3) add(heBareEnds.get(form));
      const prep = hePrepless(word);
      if (prep) add(hePrep.get(prep));
      ids = all;
    }
    memo.set(word, ids);
    return ids;
  };
  return { statements, statementsWith };
};
let parentMemo: { text: string; index: ParentIndex } | null = null;
const parentIndexOf = (text: string): ParentIndex => {
  if (parentMemo?.text !== text) parentMemo = { text, index: buildParentIndex(text) };
  return parentMemo.index;
};

export type HandoffFloorOptions = {
  /** The parent's own words this answer or brief was made from (the chat
   *  message, the parent's earlier turns, the logged triggers and responses).
   *  A finding the parent wrote is theirs to pass on — including a teacher's
   *  or doctor's words the parent typed in. */
  parentText?: string;
  /** The child's name(s): a note says "Noa" where the parent wrote "she". */
  childNames?: readonly string[];
};
/** How many finding clauses one note or brief may still check against the parent's text. */
type FloorBudget = { checks: number };

/** The words that say who or what a clause's finding is about, or who says
 *  it: what stands before the first finding (its subject, a leading
 *  "According to Dr. Cohen," or "Speech and language:") and a part that only
 *  credits a source (", according to her teacher"). */
const anchorsOf = (clause: string, findings: readonly FindingMatch[]): string[] => {
  const first = findings[0].index;
  const out: string[] = [];
  for (const part of partsOf(clause)) {
    const inPart = findings.find((f) => f.index >= part.start && f.index < part.end);
    if (inPart) out.push(...tokenize(clause.slice(part.start, inPart.index)));
    else if (part.end <= first || creditsSomeone(clause.slice(part.start, part.end))) out.push(...tokenize(clause.slice(part.start, part.end)));
  }
  return out;
};

/** True when this clause states a finding the parent's words do not carry (and is not an escalation line). */
export function statesUnreportedFinding(clause: string, opts: HandoffFloorOptions = {}, budget?: FloorBudget): boolean {
  // A finding inside an escalation line's condition is its trigger, never a claim.
  const condition = escalationCondition(clause);
  const findings = findingsIn(clause).filter((f) => !(condition && f.index >= condition.start && f.index < condition.end));
  if (findings.length === 0) return false;
  if (!opts.parentText) return true;
  if (budget && budget.checks-- <= 0) return true;
  const parent = parentIndexOf(opts.parentText);
  const names = (opts.childNames ?? []).flatMap((name) => tokenize(name));
  const words = tokenize(clause);
  const negations = tokenize(outsidePhrases(clause, findings)).filter(isNegation).length;
  // An observation ("He was observed biting…", "הוא נצפה נושך…") needs the
  // parent's words for what happened, not a passive "observed" of their own.
  const keys: FindingKey[] = [...new Set(findings.map((finding) => finding.key))].filter((key) => key !== "observed");
  const isParent = (word?: string) => word !== undefined && isOneOf(word, REPORTER_PARENT);
  // The parent's own possessor ("Noa's mom", "אמה של נועה") is the parent too.
  const ofParent = (i: number) => (words[i].endsWith("'s") && isParent(words[i + 1])) || (words[i - 1] === "של" && isParent(words[i - 2]));
  // The passive frame of an observation ("was observed", "נצפה") is not something the parent must have written.
  const frame = findings.filter((finding) => finding.key === "observed").flatMap((finding) => tokenize(finding.phrase));
  const required = [...new Set(words.filter((word, i) => !isStopWord(word) && !isNegation(word) && !isOneOf(word, ATTRIBUTION_WORDS)
    && !isParent(word) && !isOneOf(word, names) && !ofParent(i) && !frame.includes(word)))];
  const anchors = [...new Set(anchorsOf(clause, findings))].filter((word) => required.includes(word));
  // A statement of the parent's that states the same kind of finding, with the
  // same negations outside it, holding every content word of the clause …
  let candidates = parent.statements.flatMap((statement, id) =>
    statement.negations === negations && keys.every((key) => statement.keys.has(key)) ? [id] : []);
  for (const word of required) {
    if (candidates.length === 0) break;
    const ids = parent.statementsWith(word);
    candidates = candidates.filter((id) => ids.has(id));
  }
  // … with the subject and any credited source next to its finding.
  const near = (words: readonly string[]) => anchors.every((anchor) => words.some((word) => sameWord(anchor, word)));
  return !candidates.some((id) => (keys.length === 0
    ? near(parent.statements[id].words)
    : parent.statements[id].spans.some((span) => keys.includes(span.key) && near(span.words))));
}

/** Drop every clause that states an unreported finding; an untouched note is returned byte-identical. */
export function withoutHandoffFindings(text: string, opts: HandoffFloorOptions = {}, budget: FloorBudget = { checks: HANDOFF_FLOOR_MAX_CHECKS }): string {
  const clauses = text.match(CLAUSES) ?? [text];
  const dropped = clauses.map((clause) => statesUnreportedFinding(clause, opts, budget));
  if (!dropped.includes(true)) return text;
  return clauses.filter((_, i) => !dropped[i]).join("").trim();
}

/** Fields of a School Brief draft the floor never touches: the escalation line is the safety message. */
export const HANDOFF_BRIEF_UNSCRUBBED_FIELDS: readonly string[] = ["crisisEscalationTrigger"];

/** The same floor over a structured School Brief / handoff draft: every string
 *  field and list item except the escalation line, under one check budget.
 *  Returns how many fields changed. Mutates in place. */
export function scrubHandoffBriefFindings(brief: Record<string, unknown>, opts: HandoffFloorOptions = {}): number {
  const budget: FloorBudget = { checks: HANDOFF_FLOOR_MAX_CHECKS };
  let changed = 0;
  for (const [key, value] of Object.entries(brief)) {
    if (HANDOFF_BRIEF_UNSCRUBBED_FIELDS.includes(key)) continue;
    if (typeof value === "string") {
      const next = withoutHandoffFindings(value, opts, budget);
      if (next !== value) { brief[key] = next; changed++; }
    } else if (Array.isArray(value)) {
      const next = value
        .map((item) => (typeof item === "string" ? withoutHandoffFindings(item, opts, budget) : item))
        .filter((item) => typeof item !== "string" || item.trim() !== "");
      if (next.length !== value.length || next.some((item, i) => item !== value[i])) { brief[key] = next; changed++; }
    }
  }
  return changed;
}
