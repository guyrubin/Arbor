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
