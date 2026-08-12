import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { NON_DIAGNOSTIC_CONTRACT } from "../contracts/coach.js";
import {
  PROMPT_VERSIONS,
  buildChatPrompt,
  buildCouncilSynthesisPrompt,
  buildExtractLogPrompt,
  buildVoiceReplyPrompt,
  promptFingerprint,
  promptVersionOf,
  type PromptKey,
} from "./prompts.js";

/**
 * EVAL-6 — the prompt version-pin guard, in the contentHash pattern the repo
 * already uses for governed hard-moment cards: the registry pins {version,
 * sha256} per prompt; this test RECOMPUTES every fingerprint from source and
 * fails on mismatch. Editing a prompt template without bumping its version
 * fails `npm test` — a prompt edit can never again be a silent behavior change
 * with no eval invalidation and no telemetry trace.
 */
describe("EVAL-6 — PROMPT_VERSIONS hash guard", () => {
  const KEYS = Object.keys(PROMPT_VERSIONS) as PromptKey[];

  it("covers the contract and every extracted route prompt", () => {
    expect(KEYS.sort()).toEqual(
      ["coach_chat", "council_synthesis", "extract_log", "non_diagnostic_contract", "voice_reply"].sort(),
    );
  });

  for (const key of KEYS) {
    it(`"${key}" fingerprint matches its pinned sha256`, () => {
      expect(
        promptFingerprint(key),
        `prompt "${key}" changed — bump its version in PROMPT_VERSIONS (and refresh sha256) + re-run its eval suite`,
      ).toBe(PROMPT_VERSIONS[key].sha256);
    });

    it(`"${key}" version is semver and sha256 is a full digest`, () => {
      expect(PROMPT_VERSIONS[key].version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(PROMPT_VERSIONS[key].sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(promptVersionOf(key)).toBe(PROMPT_VERSIONS[key].version);
    });
  }

  it("NON_DIAGNOSTIC_CONTRACT has its OWN version (6+ routes embed it)", () => {
    expect(PROMPT_VERSIONS.non_diagnostic_contract).toBeTruthy();
  });
});

describe("EVAL-6 — builders keep the byte contract of the old inline templates", () => {
  const scholar = { name: "Vygotsky", concept: "ZPD", method: "Scaffold one step beyond.", defaultFrame: "aim" };

  it("chat prompt embeds contract, framework, memory fallback, scholar lens, and the parent question", () => {
    const prompt = buildChatPrompt({
      developmentalFramework: "FRAMEWORK-BLOCK",
      approvedMemory: "",
      knowledgeContext: "",
      childProfile: { name: "Mia" },
      scholar,
      message: "Morning shoes battle",
      languageDirective: "\nHEBREW-DIRECTIVE",
    });
    expect(prompt).toContain(NON_DIAGNOSTIC_CONTRACT);
    expect(prompt).toContain("FRAMEWORK-BLOCK");
    expect(prompt).toContain("No parent-approved child memory available.");
    expect(prompt).toContain("No matching Arbor AI Wiki cards found.");
    expect(prompt).toContain("ACTIVE SCHOLAR LENS — apply this method, do not just name it:");
    expect(prompt).toContain('prefer Six Frame "aim"');
    expect(prompt).toContain("Morning shoes battle");
    expect(prompt.trimEnd().endsWith("HEBREW-DIRECTIVE")).toBe(true);
  });

  it("council prompt embeds the takes block and its own knowledge fallback", () => {
    const prompt = buildCouncilSynthesisPrompt({
      developmentalFramework: "FW",
      approvedMemory: "fact",
      knowledgeContext: "",
      childProfile: null,
      councilTakes: "COUNCIL-TAKES-BLOCK",
      message: "Q",
      languageDirective: "",
    });
    expect(prompt).toContain(NON_DIAGNOSTIC_CONTRACT);
    expect(prompt).toContain("COUNCIL-TAKES-BLOCK");
    expect(prompt).toContain("No matching cards; keep uncertainty explicit.");
    expect(prompt).toContain("SCHOLAR COUNCIL");
  });

  it("voice prompt takes the persona as an ARG (livePersona.ts stays the only source) and keeps the spoken register rules", () => {
    const prompt = buildVoiceReplyPrompt({
      persona: "PERSONA-FROM-LIVEPERSONA",
      scholar,
      childProfile: { name: "Noa" },
      message: "He refuses shoes",
      languageDirective: "\nDIRECTIVE",
    });
    expect(prompt.startsWith(`${NON_DIAGNOSTIC_CONTRACT}\nPERSONA-FROM-LIVEPERSONA`)).toBe(true);
    expect(prompt).toContain("Reply in 2 to 4 short, spoken-friendly sentences");
    expect(prompt).toContain("Observations only — never a diagnosis.");
    expect(prompt.endsWith("DIRECTIVE")).toBe(true);
  });

  it("chat prompt renders the continuity transcript BEFORE the new question when recentTurns are present", () => {
    const prompt = buildChatPrompt({
      developmentalFramework: "FW",
      approvedMemory: "",
      knowledgeContext: "",
      childProfile: { name: "Mia" },
      scholar,
      message: "And what about bedtime?",
      languageDirective: "",
      recentTurns: [
        { role: "parent", text: "He melts down at iPad shutoff." },
        { role: "coach", text: "Try a two-minute warning and one choice." },
      ],
    });
    expect(prompt).toContain("Recent turns of this same conversation, for continuity");
    expect(prompt).toContain("Parent: He melts down at iPad shutoff.");
    expect(prompt).toContain("Coach: Try a two-minute warning and one choice.");
    // Transcript block sits BEFORE the new question.
    expect(prompt.indexOf("Recent turns of this same conversation")).toBeLessThan(prompt.indexOf("Parent question:"));
    // No weekly line without weeklyContext.
    expect(prompt).not.toContain("THIS WEEK AT A GLANCE");
  });

  it("chat prompt renders ONE counts-only weekly line when weeklyContext is present", () => {
    const prompt = buildChatPrompt({
      developmentalFramework: "FW",
      approvedMemory: "",
      knowledgeContext: "",
      childProfile: { name: "Mia" },
      scholar,
      message: "Q",
      languageDirective: "",
      weeklyContext: { momentCount: 4, milestonesCrossedCount: 2, lastActionOutcome: "not_today" },
    });
    expect(prompt).toContain(
      "THIS WEEK AT A GLANCE (parent-enabled, counts and categories only — no notes were shared): 4 moment(s) logged; 2 milestone(s) newly observed; last suggested action outcome: not today.",
    );
    expect(prompt).not.toContain("Recent turns of this same conversation");
    expect(prompt.indexOf("THIS WEEK AT A GLANCE")).toBeLessThan(prompt.indexOf("Parent question:"));
  });

  it("extract-log prompt interpolates the taxonomy list passed from the call site", () => {
    const prompt = buildExtractLogPrompt({
      childProfile: null,
      message: "Meltdown at breakfast",
      behaviorTypes: "A | B | C",
      languageDirective: "",
    });
    expect(prompt).toContain(NON_DIAGNOSTIC_CONTRACT);
    expect(prompt).toContain("prefer one of exactly A | B | C when one fits");
    expect(prompt).toContain("Return only JSON matching the schema.");
    expect(prompt).toContain('Parent description: "Meltdown at breakfast"');
  });
});

/**
 * Masterplan 1.3 — coach_chat 1.1.0: the two OPTIONAL context blocks
 * (recentTurns transcript + weeklyContext line) must be pure ADDITIONS.
 * The load-bearing guarantee is byte-parity on the legacy path: a request
 * carrying neither field produces EXACTLY the 1.0.0 prompt bytes — pinned
 * here against the retired 1.0.0 sha256 so a regression that perturbs the
 * legacy template (even by one byte) fails loudly.
 */
describe("Masterplan 1.3 — coach_chat legacy byte-parity (v1.0.0 pin)", () => {
  const COACH_CHAT_V1_0_0_SHA256 = "47871f42bfdb1cb2d63d2adcde56662e7792c40f086d4139dfd438d62a8686c5";
  const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
  const legacyArgs = {
    developmentalFramework: "«framework»",
    approvedMemory: "«approved-memory»",
    knowledgeContext: "«knowledge-cards»",
    childProfile: { id: "«child»", name: "«name»", age: 4 },
    scholar: { name: "«scholar»", concept: "«concept»", method: "«method»", defaultFrame: "«frame»" },
    message: "«parent-message»",
    languageDirective: "«language-directive»",
  } as const;

  it("with BOTH new fields absent, the prompt is byte-identical to coach_chat 1.0.0", () => {
    expect(sha256(buildChatPrompt({ ...legacyArgs }))).toBe(COACH_CHAT_V1_0_0_SHA256);
  });

  it("empty recentTurns / null weeklyContext (the sanitizers' degenerate outputs) also keep 1.0.0 bytes", () => {
    expect(sha256(buildChatPrompt({ ...legacyArgs, recentTurns: [], weeklyContext: null }))).toBe(
      COACH_CHAT_V1_0_0_SHA256,
    );
  });

  it("either block present breaks parity (so the new pin actually covers the new text)", () => {
    expect(
      sha256(buildChatPrompt({ ...legacyArgs, recentTurns: [{ role: "parent", text: "hi" }] })),
    ).not.toBe(COACH_CHAT_V1_0_0_SHA256);
    expect(
      sha256(buildChatPrompt({ ...legacyArgs, weeklyContext: { momentCount: 1, milestonesCrossedCount: 0 } })),
    ).not.toBe(COACH_CHAT_V1_0_0_SHA256);
  });
});
