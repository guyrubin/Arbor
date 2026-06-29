/**
 * AI-2 (WAF backlog): output-side safety screening.
 *
 * The input side is covered by `escalation.ts` (regex escalation screen). This
 * module screens what the MODEL produced before it reaches a parent:
 *
 *  1. A fast lexical layer (always on, zero latency) catches the contract
 *     violations that matter most for a non-diagnostic children's product:
 *     definitive diagnoses, medication dosing, and instructions to start/stop
 *     treatment.
 *  2. An optional semantic layer (ENABLE_OUTPUT_SAFETY_CLASSIFIER=true) runs a
 *     cheap structured classifier call on coach responses and replaces unsafe
 *     output with a safe fallback.
 */
import { Type } from "@google/genai";
import type { ModelProvider } from "../ai/modelRouter.js";

export type OutputScreenVerdict = {
  flagged: boolean;
  category: "diagnosis" | "medication" | "treatment_directive" | "semantic_unsafe" | null;
  reason: string | null;
};

const CONDITION_TOKENS = [
  "autism", "autistic", "adhd", "add\\b", "asperger", "ocd", "odd\\b", "bipolar",
  "depress(?:ion|ive)", "anxiety disorder", "dyslexia", "dyspraxia", "apraxia",
  "intellectual disability", "developmental delay", "sensory processing disorder",
  "attachment disorder", "conduct disorder", "ptsd", "tourette",
];
const CONDITIONS = CONDITION_TOKENS.join("|");

/**
 * Expand a regex source so its ASCII letters match case-insensitively (ADHD/adhd)
 * WITHOUT a global `/i` flag — escapes like `\b` are left intact. Used to embed the
 * condition vocabulary inside the case-SENSITIVE proper-name floor below, where the
 * leading name token must stay capitalization-sensitive (the `/i` flag would make
 * `\p{Lu}`/`[A-Z]` match lowercase too, defeating the "capitalized name" guard).
 */
const ciSource = (src: string): string =>
  src.replace(/\\?[A-Za-z]/g, (m) => (m[0] === "\\" ? m : `[${m.toLowerCase()}${m.toUpperCase()}]`));

// Proper-name subject: screenModelOutput runs on the ALIAS-RESTORED, child-facing
// text (routes/api.ts restoreDeep → screen), so a diagnostic claim's subject is
// usually the child's real FIRST NAME — not a pronoun or the [Child] alias — and the
// story / bedtime / hero-journey routes lean on the name heavily. "Mia has autism" /
// "Noah is autistic" must trip the floor (the semantic classifier is OFF by default
// and fails open). Case-SENSITIVE (no `/i`): the subject must be Capitalized (\p{Lu}),
// which keeps mid-sentence common nouns ("behavior is odd") out. The short homographs
// add/odd are dropped from this pattern so sentence-initial words ("Something is odd")
// don't false-positive — the pronoun/your-child patterns above still catch those acronyms.
const NAME_SUBJECT = "\\p{Lu}[\\p{L}\\u2019'\\-]*";
// Includes past tense (had/was/were/suffered) — the story/bedtime/hero-journey
// routes narrate in the past ("Olivia had developmental delay …").
const NAME_VERB = "(?:has|have|had|is|are|was|were|suffers? from|suffered from|shows? signs of having)";
const CONDITIONS_NAME = ciSource(
  CONDITION_TOKENS.filter((c) => c !== "add\\b" && c !== "odd\\b").join("|"),
);

// Hebrew/RTL diagnosis floor: Hebrew has no capitalization, so the name-subject trick
// does not apply — instead match the explicit Hebrew diagnostic frames around a
// clinical condition. Latin acronyms (ADHD/OCD/…) inside Hebrew text are case-folded.
const HE_CONDITIONS = ciSource(
  [
    "אוטיזם", "אוטיסט(?:ית|ים)?", "אספרגר", "היפראקטיביות", "הפרעת קשב",
    "דיכאון", "דיסלקציה", "דיספרקסיה", "אפרקסיה", "פיגור שכלי", "עיכוב התפתחותי",
    "תסמונת טורט", "OCD", "ADHD", "ADD", "PTSD",
  ].join("|"),
);

const DIAGNOSIS_PATTERNS = [
  // "your child has ADHD", "she is autistic", "this is autism", "he suffers from OCD"
  new RegExp(`(?:\\b(?:your (?:child|son|daughter)|he|she|they)|\\[\\s*child\\s*\\])\\s+(?:has|have|is|are|suffers? from|shows? signs of having)\\s+(?:\\w+\\s){0,2}(?:${CONDITIONS})`, "i"),
  new RegExp(`\\bdiagnos(?:is|e|ed) (?:of|with|as)\\s+(?:\\w+\\s){0,2}(?:${CONDITIONS})`, "i"),
  new RegExp(`\\bthis (?:is|confirms|indicates)\\s+(?:\\w+\\s){0,1}(?:${CONDITIONS})`, "i"),
  // Hedged / soft-inference phrasing the literal patterns above miss, e.g.
  // "this looks like ADHD", "seems like autism", "sounds like she has OCD",
  // "appears to be on the autism spectrum", "is likely ADHD", "points to anxiety disorder".
  // A bare "appears to be" alone is fine — a CONDITION token within two words is required,
  // so non-clinical phrasing ("the strategy appears to be working") never matches.
  new RegExp(`(?:\\blooks? like|\\bseems? like|\\bsounds? like|\\bappears? to be|(?:\\bis|'s) (?:likely|probably)|\\bpoints? to|\\bsuggests?)\\s+(?:\\w+\\s){0,3}(?:${CONDITIONS})`, "i"),
  // Proper-name subject (alias-restored, child-facing): "Mia has autism", "Noah is
  // autistic", "Liam suffers from OCD", "Ava shows signs of having ADHD". Case-sensitive.
  new RegExp(`\\b${NAME_SUBJECT}\\s+${NAME_VERB}\\s+(?:\\w+\\s){0,2}(?:${CONDITIONS_NAME})`, "u"),
  // Hebrew/RTL diagnostic frames:
  new RegExp(`יש\\s+ל\\p{L}+\\s+(?:${HE_CONDITIONS})`, "u"), // "יש למיה אוטיזם" — X has …
  new RegExp(`סובל(?:ת|ים|ות)?\\s+מ?(?:${HE_CONDITIONS})`, "u"), // "מיה סובלת מאוטיזם" — X suffers from …
  new RegExp(`אובח(?:ן|נה|נו)\\s+(?:עם\\s+|ב)?(?:${HE_CONDITIONS})`, "u"), // "אובחן עם …" — diagnosed with …
  new RegExp(`(?<!\\p{L})(?:הוא|היא)\\s+(?:${HE_CONDITIONS})`, "u"), // "מיה היא אוטיסטית" — X is …
];

const MEDICATION_PATTERNS = [
  /\b\d+(?:\.\d+)?\s?(?:mg|milligrams?|ml|millilit(?:re|er)s?|mcg|micrograms?)\b/i,
  /\b(?:give|administer|dose|dosage of)\b.{0,40}\b(?:melatonin|ritalin|methylphenidate|adderall|antihistamine|benadryl|ibuprofen|paracetamol|acetaminophen)\b/i,
];

const TREATMENT_PATTERNS = [
  /\b(?:stop|discontinue|skip|double|increase|decrease)\b.{0,30}\b(?:medication|meds|prescription|dose|dosage)\b/i,
];

/** Fast lexical screen — always on; pure, synchronous, testable. */
export const screenModelOutputLexical = (text: string): OutputScreenVerdict => {
  const t = text || "";
  for (const p of DIAGNOSIS_PATTERNS) {
    if (p.test(t)) return { flagged: true, category: "diagnosis", reason: "Definitive diagnostic claim in model output." };
  }
  for (const p of MEDICATION_PATTERNS) {
    if (p.test(t)) return { flagged: true, category: "medication", reason: "Medication dosing guidance in model output." };
  }
  for (const p of TREATMENT_PATTERNS) {
    if (p.test(t)) return { flagged: true, category: "treatment_directive", reason: "Start/stop-treatment directive in model output." };
  }
  return { flagged: false, category: null, reason: null };
};

const classifierEnabled = () =>
  ["1", "true", "yes", "on"].includes((process.env.ENABLE_OUTPUT_SAFETY_CLASSIFIER || "").toLowerCase());

/**
 * Semantic layer: one cheap structured call judging the response against the
 * non-diagnostic contract. Fails OPEN (never blocks delivery on classifier
 * errors) — the lexical layer above remains the hard floor.
 */
export const screenModelOutputSemantic = async (
  modelProvider: ModelProvider,
  text: string,
): Promise<OutputScreenVerdict> => {
  if (!classifierEnabled()) return { flagged: false, category: null, reason: null };
  try {
    const result = (await modelProvider.generateJson({
      route: "analysis_structured",
      temperature: 0,
      prompt: `You are a safety reviewer for a NON-DIAGNOSTIC parenting-support product for young children.
Review the assistant response below. Mark it unsafe ONLY if it: states or implies a clinical diagnosis for the child; gives medication or dosing instructions; tells the parent to start/stop/change a treatment; gives guidance that could physically endanger a child; or shames/blames the parent in a harmful way. General developmental guidance, observations, and "talk to a professional" suggestions are SAFE.

ASSISTANT RESPONSE TO REVIEW:
"""
${(text || "").slice(0, 8000)}
"""

Return only JSON matching the schema.`,
      schema: {
        type: Type.OBJECT,
        required: ["safe", "reason"],
        properties: {
          safe: { type: Type.BOOLEAN },
          reason: { type: Type.STRING },
        },
      },
    })) as { safe: boolean; reason: string };
    if (!result.safe) {
      return { flagged: true, category: "semantic_unsafe", reason: result.reason || "Semantic safety classifier flagged the response." };
    }
  } catch {
    /* fail open — lexical layer already ran */
  }
  return { flagged: false, category: null, reason: null };
};

/** Combined check used by the coach endpoints. */
export const screenModelOutput = async (
  modelProvider: ModelProvider,
  text: string,
): Promise<OutputScreenVerdict> => {
  const lexical = screenModelOutputLexical(text);
  if (lexical.flagged) return lexical;
  return screenModelOutputSemantic(modelProvider, text);
};

/** Parent-facing replacement when output is blocked. */
export const renderBlockedOutputMarkdown = () => `### Let's pause here
Part of the answer Arbor drafted stepped outside what an AI parenting coach should say — for example, it sounded diagnostic or medical.

Arbor only offers **observations and developmental guidance**, never a diagnosis or medical instruction.

**What to do instead:** if you're worried about a possible condition, medication, or treatment, bring your notes to your pediatrician, consultatiebureau, or family health centre — they can assess your child in person. You can generate a professional handoff brief from **Reports & Handoffs** to make that conversation easier.`;
