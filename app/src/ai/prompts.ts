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
import { ageMonthsFromProfile } from "../lib/childAge.js";
import type { ChildProfile } from "../types.js";
import type { RecentTurn, WeeklyContext } from "./chatContext.js";

// ── AI-12 / GP-16: the ONE profile allow-list every prompt goes through ──────
//
// Before this, every builder and every inline route prompt did
// `JSON.stringify(childProfile)` on the raw client object — so the model was
// primed with `riskLevel` (a verdict primitive the clinical firewall bans from
// parent surfaces, injected UPSTREAM of every answer), the Firestore `id`, the
// avatar metadata, and — when Storage is unavailable — a base64 `photoUrl`
// data URL worth tens of thousands of tokens per call.
//
// `MODEL_PROFILE_FIELDS` is the single declaration of what the model may see;
// `promptProfile` projects any profile-shaped value onto it. Never `riskLevel`,
// `photoUrl`, `avatar`, `id`, onboarding stamps, timestamps. The same constant
// is meant to drive the Trust Center "what Arbor uses" list (GP-16) so the
// disclosure and the wire cannot drift apart.

export const MODEL_PROFILE_FIELDS = [
  "name",
  "age",
  "ageLabel",
  "languages",
  "schoolContext",
  "strengths",
  "challenges",
  "activeGoals",
  "interests",
  "preterm",
  "gender",
] as const;

export type ModelProfile = {
  name?: string;
  /** Whole years (legacy field) — kept so age-band reasoning stays stable. */
  age?: number;
  /** Months-precise label ("9 months", "4 years 2 months") from the B0 spine. */
  ageLabel?: string;
  languages?: string[];
  schoolContext?: string;
  strengths?: string[];
  challenges?: string[];
  /** Parent-selected goals — label + domain only (no ids, no timestamps). */
  activeGoals?: { label: string; domain?: string }[];
  interests?: string[];
  preterm?: { gestationalWeeks: number };
  gender?: string;
};

const stringList = (value: unknown, cap = 12): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const out = value.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim().slice(0, 80)).slice(0, cap);
  return out.length > 0 ? out : undefined;
};

const monthsLabel = (months: number): string => {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${months} month${months === 1 ? "" : "s"}`;
  const years = `${y} year${y === 1 ? "" : "s"}`;
  return m === 0 ? years : `${years} ${m} month${m === 1 ? "" : "s"}`;
};

/**
 * Project a child profile onto the model allow-list. `null`/`undefined` stay
 * `null` so every builder's "None provided"/"unknown" fallback is preserved.
 * Pure and deterministic for a given `now` (birthDate → months uses `now`).
 */
export const promptProfile = (profile: unknown, now?: Date): ModelProfile | null => {
  if (!profile || typeof profile !== "object") return null;
  const p = profile as Partial<ChildProfile> & Record<string, unknown>;
  const out: ModelProfile = {};
  if (typeof p.name === "string" && p.name.trim()) out.name = p.name.trim().slice(0, 80);
  if (typeof p.age === "number" && Number.isFinite(p.age)) out.age = Math.max(0, Math.round(p.age));
  const months = ageMonthsFromProfile(p as ChildProfile, now);
  if (months !== null) out.ageLabel = monthsLabel(months);
  const languages = stringList(p.languages);
  if (languages) out.languages = languages;
  if (typeof p.schoolContext === "string" && p.schoolContext.trim()) out.schoolContext = p.schoolContext.trim().slice(0, 200);
  const strengths = stringList(p.strengths);
  if (strengths) out.strengths = strengths;
  const challenges = stringList(p.challenges);
  if (challenges) out.challenges = challenges;
  if (Array.isArray(p.activeGoals)) {
    const goals = (p.activeGoals as unknown[])
      .filter((g): g is { label: string; domainId?: string } => !!g && typeof g === "object" && typeof (g as { label?: unknown }).label === "string")
      .slice(0, 3)
      .map((g) => (typeof g.domainId === "string" ? { label: g.label.slice(0, 80), domain: g.domainId } : { label: g.label.slice(0, 80) }));
    if (goals.length > 0) out.activeGoals = goals;
  }
  const interests = stringList(p.interests);
  if (interests) out.interests = interests;
  const weeks = (p.preterm as { gestationalWeeks?: unknown } | undefined)?.gestationalWeeks;
  if (typeof weeks === "number" && Number.isFinite(weeks)) out.preterm = { gestationalWeeks: weeks };
  if (typeof p.gender === "string" && p.gender.trim()) out.gender = p.gender.trim().slice(0, 20);
  return out;
};

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
  // 1.1.0 — masterplan 1.3: optional recentTurns transcript block + optional
  // weeklyContext line (both between the scholar-lens paragraph and "Parent
  // question:"). With BOTH absent the rendered prompt is byte-identical to
  // 1.0.0 (sha 47871f42…) — pinned by the legacy-parity test in prompts.test.ts.
  // 1.2.0 / x.1.0 (AI-12, 2026-09-03): the child profile is rendered through
  // promptProfile() — the allow-list above — so `riskLevel`, `photoUrl`,
  // `avatar` and ids never reach the model. Byte change on every builder.
  coach_chat: { version: "1.2.0", sha256: "d015d9755a34f91f1f31c76716774907f249cf5f107dbeac0aa3aa0aaa87c776" },
  council_synthesis: { version: "1.1.0", sha256: "6c00185e6fb6dde9296345c7b186b32fb4fbe54455e6155cfc92b3d374ae75de" },
  voice_reply: { version: "1.1.0", sha256: "ef00f7f8cebe131da356309a503f0aa2f6cf53e0ec5db651c59b45fd0114322c" },
  extract_log: { version: "1.1.0", sha256: "4d30bdb29b6a9b09138e5438cdefb32235cb188b4559af09cca325bf58755b53" },
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
  /** Masterplan 1.3(a) — sanitized same-thread transcript (routes/api.ts runs
   *  sanitizeRecentTurns on the client-supplied body field before this).
   *  Absent/empty ⇒ the rendered prompt is byte-identical to v1.0.0. */
  recentTurns?: RecentTurn[];
  /** Masterplan 1.3(b) — consent-gated counts-only weekly digest (sanitized
   *  server-side). Absent/null ⇒ byte-identical to v1.0.0. */
  weeklyContext?: WeeklyContext | null;
};

/** 1.3(a): the continuity transcript block — "" when there are no turns, so
 *  the legacy prompt bytes are untouched. Rendered BEFORE the new question. */
const renderRecentTurnsBlock = (turns?: RecentTurn[]): string => {
  if (!turns || turns.length === 0) return "";
  const lines = turns.map((t) => `${t.role === "parent" ? "Parent" : "Coach"}: ${t.text}`);
  return `Recent turns of this same conversation, for continuity — read them so pronouns and follow-ups resolve, and do not repeat advice already given:
${lines.join("\n")}
`;
};

/** 1.3(b): ONE short context line from the parent-enabled weekly digest —
 *  counts and category labels only; "" when the toggle is off/absent. */
const renderWeeklyContextLine = (weekly?: WeeklyContext | null): string => {
  if (!weekly) return "";
  const parts = [`${weekly.momentCount} moment(s) logged`];
  parts.push(`${weekly.milestonesCrossedCount} milestone(s) newly observed`);
  if (weekly.lastActionOutcome) parts.push(`last suggested action outcome: ${weekly.lastActionOutcome.replace("_", " ")}`);
  return `THIS WEEK AT A GLANCE (parent-enabled, counts and categories only — no notes were shared): ${parts.join("; ")}.
`;
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
  recentTurns,
  weeklyContext,
}: ChatPromptArgs): string => `
${NON_DIAGNOSTIC_CONTRACT}
${developmentalFramework}

ARBOR APPROVED CHILD MEMORY:
${approvedMemory || "No parent-approved child memory available."}

ARBOR AI WIKI SOURCE CARDS:
${knowledgeContext || "No matching Arbor AI Wiki cards found. Use the framework contract and keep uncertainty explicit."}

You are the Arbor Parent Coach, a developmental parenting support assistant.
Current Child Profile Context:
${childProfile ? JSON.stringify(promptProfile(childProfile), null, 2) : "None provided"}

ACTIVE SCHOLAR LENS — apply this method, do not just name it:
${scholar.name} — ${scholar.concept}. ${scholar.method}
Ground "What To Do Today" and the parent script in this lens, and prefer Six Frame "${scholar.defaultFrame}" unless safety dictates otherwise.
${renderRecentTurnsBlock(recentTurns)}${renderWeeklyContextLine(weeklyContext)}Parent question:
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
${childProfile ? JSON.stringify(promptProfile(childProfile), null, 2) : "None provided"}

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
Child: ${childProfile ? JSON.stringify(promptProfile(childProfile)) : "unknown"}
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

Child: ${childProfile ? JSON.stringify(promptProfile(childProfile)) : "unknown"}
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
  // Masterplan 1.3 — the coach_chat fingerprint pins the NEW optional blocks'
  // template text too (framing line, role labels, weekly-line phrasing).
  recentTurns: [
    { role: "parent", text: "«turn-parent»" },
    { role: "coach", text: "«turn-coach»" },
  ] as RecentTurn[],
  weeklyContext: {
    momentCount: 3,
    milestonesCrossedCount: 1,
    lastActionOutcome: "helped",
  } as WeeklyContext,
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
        recentTurns: CANONICAL.recentTurns,
        weeklyContext: CANONICAL.weeklyContext,
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
