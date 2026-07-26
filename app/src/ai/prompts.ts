/**
 * EVAL-6: version-pinned prompt builders.
 *
 * Every parent-facing generative route that used to inline its prompt template
 * in routes/api.ts gets a NAMED builder here plus an entry in PROMPT_VERSIONS
 * — {version, sha256} where the sha256 pins the builder's static template text
 * (computed over the builder applied to CANONICAL fingerprint args, so any
 * edit to the literal changes the hash). The guard test (prompts.test.ts)
 * mirrors the contentHash pattern from content/governance.ts: it recomputes
 * the fingerprints from source and fails with "prompt changed — bump version +
 * re-run its eval suite" on mismatch. That makes every prompt edit VISIBLE and
 * eval-invalidating instead of a silent behavior change.
 *
 * NON_DIAGNOSTIC_CONTRACT gets its own version because 6+ routes embed it —
 * an edit there invalidates every embedding builder's fingerprint too (their
 * hashes include the contract bytes), which is exactly the alarm we want.
 *
 * The `version` strings are stamped into:
 *   - every ai.usage telemetry event (src/ai/usage.ts, via the provider seam's
 *     `promptVersion` option), and
 *   - every eval results.jsonl row (scripts/eval-judge.mts),
 * so eval results can always be tied to the prompt that produced them, and
 * check:acceptance can WARN when a suite is stale against the live prompt.
 *
 * BYTE PARITY: the builders reproduce the pre-extraction api.ts template
 * literals exactly — route tests that pin prompt content through stub
 * providers (extractLog.test.ts, todaysFocus.test.ts pattern) stay green.
 */
import { createHash } from "node:crypto";
import { NON_DIAGNOSTIC_CONTRACT } from "../contracts/coach.js";

export type PromptKey =
  | "non_diagnostic_contract"
  | "coach_chat"
  | "council_synthesis"
  | "voice_reply"
  | "extract_log";

/**
 * The registry. Bump `version` (semver) whenever the corresponding template
 * text changes, then refresh `sha256` and RE-RUN the eval suites that declare
 * that prompt version (see each suite's `promptVersions` block).
 */
export const PROMPT_VERSIONS: Record<PromptKey, { version: string; sha256: string }> = {
  non_diagnostic_contract: { version: "1.0.0", sha256: "b9179613d1346f25bfc95c4f10a0bbada56a2c2bae5202bceb5fbb769555763a" },
  coach_chat: { version: "1.0.0", sha256: "47871f42bfdb1cb2d63d2adcde56662e7792c40f086d4139dfd438d62a8686c5" },
  council_synthesis: { version: "1.0.0", sha256: "eeca63a0b6f414c196b5914ee5f93ab175ae1217c07f8914e756259d8320208c" },
  voice_reply: { version: "1.0.0", sha256: "452e343ec9bcd855157d935c19d2b6d9e2bd4167d73b3ad0e33a9fa0c820b9ea" },
  extract_log: { version: "1.0.0", sha256: "f296df39c25469f3db5878adb03c2dd29781d8b19111cd68995d9b909b2b4891" },
};

export const promptVersionOf = (key: PromptKey): string => PROMPT_VERSIONS[key].version;

// ── Builders (byte-identical to the pre-EVAL-6 inline templates) ────────────

export type ChatPromptArgs = {
  developmentalFramework: string;
  approvedMemory: string;
  knowledgeContext: string;
  childProfile: unknown;
  scholar: { name: string; concept: string; method: string; defaultFrame: string };
  message: string;
  languageDirective: string;
};

/** /chat — the parent coach structured-contract prompt. */
export const buildChatPrompt = ({
  developmentalFramework,
  approvedMemory,
  knowledgeContext,
  childProfile,
  scholar,
  message,
  languageDirective,
}: ChatPromptArgs): string => `
${NON_DIAGNOSTIC_CONTRACT}
${developmentalFramework}

ARBOR APPROVED CHILD MEMORY:
${approvedMemory || "No parent-approved child memory available."}

ARBOR AI WIKI SOURCE CARDS:
${knowledgeContext || "No matching Arbor AI Wiki cards found. Use the framework contract and keep uncertainty explicit."}

You are the Arbor Parent Coach, a developmental parenting support assistant.
Current Child Profile Context:
${childProfile ? JSON.stringify(childProfile, null, 2) : "None provided"}

ACTIVE SCHOLAR LENS — apply this method, do not just name it:
${scholar.name} — ${scholar.concept}. ${scholar.method}
Ground "What To Do Today" and the parent script in this lens, and prefer Six Frame "${scholar.defaultFrame}" unless safety dictates otherwise.
Parent question:
${message}

Return only JSON that matches the response schema. Open with the "text" field FIRST: 2-4 warm, plain sentences that briefly acknowledge the parent and give the heart of your answer — no headings, no lists, no labels. Keep todayPlan to 1-3 steps. Include sourceCardsUsed as source-card ids you used. Include followUps: 2-3 short, natural next questions THIS parent is likely to ask after THIS answer (specific to their situation, never generic), each under 100 characters, in the same language as your other text values.${languageDirective}
`;

export type CouncilSynthesisPromptArgs = {
  developmentalFramework: string;
  approvedMemory: string;
  knowledgeContext: string;
  childProfile: unknown;
  councilTakes: string;
  message: string;
  languageDirective: string;
};

/** /council — the scholar-council synthesis prompt. */
export const buildCouncilSynthesisPrompt = ({
  developmentalFramework,
  approvedMemory,
  knowledgeContext,
  childProfile,
  councilTakes,
  message,
  languageDirective,
}: CouncilSynthesisPromptArgs): string => `
${NON_DIAGNOSTIC_CONTRACT}
${developmentalFramework}

ARBOR APPROVED CHILD MEMORY:
${approvedMemory || "No parent-approved child memory available."}

ARBOR AI WIKI SOURCE CARDS:
${knowledgeContext || "No matching cards; keep uncertainty explicit."}

You are the Arbor Parent Coach synthesizing a SCHOLAR COUNCIL into one answer.
Child Profile:
${childProfile ? JSON.stringify(childProfile, null, 2) : "None provided"}

${councilTakes}

Integrate the council's distinct lenses into one coherent, non-diagnostic answer — lead with connection, then capability, then context. Do not contradict the lenses.
Parent question:
${message}

Return only JSON matching the response schema. Keep todayPlan to 1-3 steps. Include sourceCardsUsed. Include followUps: 2-3 short, natural next questions this parent is likely to ask after this answer, each under 100 characters, in the same language as your other text values.${languageDirective}
`;

export type VoiceReplyPromptArgs = {
  /** SPOKEN_COACH_PERSONA — passed in from routes/api.ts so lib/livePersona.ts
   *  stays the ONLY module that states the persona text (AI-V9 grep guard). */
  persona: string;
  scholar: { name: string; method: string };
  childProfile: unknown;
  message: string;
  languageDirective: string;
};

/** /voice — the spoken-register reply prompt. */
export const buildVoiceReplyPrompt = ({
  persona,
  scholar,
  childProfile,
  message,
  languageDirective,
}: VoiceReplyPromptArgs): string => `${NON_DIAGNOSTIC_CONTRACT}
${persona} Apply this lens: ${scholar.name} — ${scholar.method}
Child: ${childProfile ? JSON.stringify(childProfile) : "unknown"}
The parent just said: "${message}"
Reply in 2 to 4 short, spoken-friendly sentences: briefly acknowledge, then give one concrete thing to try, in plain everyday language. No markdown, no headings, no bullet points, no emojis. Observations only — never a diagnosis. If there's a safety concern, gently suggest professional help.${languageDirective}`;

export type ExtractLogPromptArgs = {
  childProfile: unknown;
  message: string;
  /** CANONICAL_BEHAVIOR_TYPES.join(" | ") — joined at the call site so the
   *  behaviorTaxonomy grep guard keeps pinning routes/api.ts to the module. */
  behaviorTypes: string;
  languageDirective: string;
};

/** /extract-log — the one-structured-behavior-log extraction prompt. */
export const buildExtractLogPrompt = ({
  childProfile,
  message,
  behaviorTypes,
  languageDirective,
}: ExtractLogPromptArgs): string => `
${NON_DIAGNOSTIC_CONTRACT}
You are Arbor's logging assistant. Read the parent's description of a moment with their child and extract ONE structured behavior log. Observations only — never a diagnosis.

Child: ${childProfile ? JSON.stringify(childProfile) : "unknown"}
Parent description: "${message}"

Rules:
- behaviorType: prefer one of exactly ${behaviorTypes} when one fits; otherwise a short 2-4 word English label for the moment (e.g. "Morning refusal", "Screen shutoff meltdown").
- intensity: integer 1 (mild) to 5 (severe), inferred from the description.
- durationMinutes: best-guess integer (use 10 if unclear).
- context: one of exactly Home, School, Transit, Public.
- trigger: the immediate antecedent in a few words ("" if unknown).
- response: what the parent did, if mentioned ("" if unknown).
- notes: one short neutral sentence capturing anything else useful ("" if none).
Return only JSON matching the schema.${languageDirective}`;

// ── Fingerprints (the contentHash pattern applied to prompts) ───────────────

const sha256 = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");

/**
 * Canonical fingerprint args: FIXED sentinel values, so the fingerprint is a
 * pure function of the template text (static parts + placeholder positions).
 * Any edit to a template literal — even one character — changes the digest.
 */
const CANONICAL = {
  framework: "«framework»",
  memory: "«approved-memory»",
  knowledge: "«knowledge-cards»",
  childProfile: { id: "«child»", name: "«name»", age: 4 },
  scholar: { name: "«scholar»", concept: "«concept»", method: "«method»", defaultFrame: "«frame»" },
  councilTakes: "«council-takes»",
  message: "«parent-message»",
  languageDirective: "«language-directive»",
  persona: "«spoken-persona»",
  behaviorTypes: "«behavior-types»",
} as const;

/** Recompute the pinned template fingerprint for a prompt key. */
export const promptFingerprint = (key: PromptKey): string => {
  switch (key) {
    case "non_diagnostic_contract":
      return sha256(NON_DIAGNOSTIC_CONTRACT);
    case "coach_chat":
      return sha256(buildChatPrompt({
        developmentalFramework: CANONICAL.framework,
        approvedMemory: CANONICAL.memory,
        knowledgeContext: CANONICAL.knowledge,
        childProfile: CANONICAL.childProfile,
        scholar: CANONICAL.scholar,
        message: CANONICAL.message,
        languageDirective: CANONICAL.languageDirective,
      }));
    case "council_synthesis":
      return sha256(buildCouncilSynthesisPrompt({
        developmentalFramework: CANONICAL.framework,
        approvedMemory: CANONICAL.memory,
        knowledgeContext: CANONICAL.knowledge,
        childProfile: CANONICAL.childProfile,
        councilTakes: CANONICAL.councilTakes,
        message: CANONICAL.message,
        languageDirective: CANONICAL.languageDirective,
      }));
    case "voice_reply":
      return sha256(buildVoiceReplyPrompt({
        persona: CANONICAL.persona,
        scholar: CANONICAL.scholar,
        childProfile: CANONICAL.childProfile,
        message: CANONICAL.message,
        languageDirective: CANONICAL.languageDirective,
      }));
    case "extract_log":
      return sha256(buildExtractLogPrompt({
        childProfile: CANONICAL.childProfile,
        message: CANONICAL.message,
        behaviorTypes: CANONICAL.behaviorTypes,
        languageDirective: CANONICAL.languageDirective,
      }));
  }
};
