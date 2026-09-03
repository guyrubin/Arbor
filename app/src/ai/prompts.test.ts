import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { NON_DIAGNOSTIC_CONTRACT } from "../contracts/coach.js";
import {
  MODEL_PROFILE_FIELDS,
  PROMPT_VERSIONS,
  buildChatPrompt,
  buildCouncilSynthesisPrompt,
  buildExtractLogPrompt,
  buildVoiceReplyPrompt,
  promptFingerprint,
  promptProfile,
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
 * carrying neither field produces EXACTLY the block-free prompt bytes —
 * pinned here so a regression that perturbs the legacy template (even by
 * one byte) fails loudly.
 *
 * AI-12 (2026-09-03, coach_chat 1.2.0): the child profile now renders through
 * promptProfile() (the `id` in the canonical args is dropped), so the
 * block-free baseline moved from the retired 1.0.0 digest (47871f42…) to the
 * digest below. Same guarantee, new bytes — the ASSERTION is unchanged: with
 * both 1.3 fields absent the prompt equals the block-free rendering.
 */
describe("Masterplan 1.3 — coach_chat block-free byte-parity (v1.2.0 pin)", () => {
  const COACH_CHAT_V1_0_0_SHA256 = "781d9e82fb51556d1a8fc0d0458315df90eb9dd1aecfe04f0da186369951de88";
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

  it("with BOTH new fields absent, the prompt is byte-identical to the block-free 1.2.0 rendering", () => {
    expect(sha256(buildChatPrompt({ ...legacyArgs }))).toBe(COACH_CHAT_V1_0_0_SHA256);
  });

  it("empty recentTurns / null weeklyContext (the sanitizers' degenerate outputs) also keep the block-free bytes", () => {
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

/**
 * AI-12 / GP-16 (2026-09-03) — the promptProfile allow-list guard.
 *
 * Every builder used to `JSON.stringify(childProfile)` the RAW client object,
 * so the model was primed with `riskLevel` (a verdict primitive the firewall
 * bans from parent surfaces, injected upstream of every answer), the
 * Firestore id, avatar metadata and — when Storage is unavailable — a base64
 * `photoUrl` data URL. This pins: a deliberately leaky profile renders into
 * EVERY builder with none of those substrings present, while the allow-listed
 * facts survive. The negative control proves the fixture actually carries the
 * leaks (raw stringify contains all of them), so the guard cannot go vacuous.
 */
describe("AI-12 / GP-16 — promptProfile allow-list: no verdict, photo, avatar or id reaches any prompt", () => {
  const scholar = { name: "Vygotsky", concept: "ZPD", method: "Scaffold one step beyond.", defaultFrame: "aim" };
  const LEAKY_PROFILE = {
    id: "child-firestore-42",
    name: "Mia",
    age: 4,
    languages: ["en", "he"],
    schoolContext: "Gan Shalom, mornings",
    strengths: ["kind"],
    challenges: ["transitions"],
    riskLevel: "High",
    onboardingComplete: true,
    onboardingCompletedAt: "2026-01-02T00:00:00Z",
    photoUrl: "data:image/png;base64,AAAAQUFBQUFBQUE=",
    avatar: { style: "storybook", source: "photo", createdAt: "2026-01-01T00:00:00Z" },
    activeGoals: [{ goalId: "goal-7", label: "Calmer transitions", domainId: "social", addedAt: "2026-02-02T00:00:00Z" }],
    interests: ["Trains"],
    interestsUpdatedAt: "2026-03-03T00:00:00Z",
    preterm: { gestationalWeeks: 34 },
    gender: "girl",
  };
  const LEAK_SUBSTRINGS = [
    "riskLevel",
    '"High"',
    "photoUrl",
    "data:image",
    "base64,AAAA",
    "child-firestore-42",
    "avatar",
    "storybook",
    "onboardingComplete",
    "goal-7",
    "addedAt",
    "createdAt",
    "interestsUpdatedAt",
  ];
  const KEPT_FACTS = ["Mia", "Gan Shalom", "kind", "transitions", "Trains", "Calmer transitions", "gestationalWeeks", "girl", "4 years"];

  const builders: Record<string, () => string> = {
    coach_chat: () =>
      buildChatPrompt({
        developmentalFramework: "FW",
        approvedMemory: "",
        knowledgeContext: "",
        childProfile: LEAKY_PROFILE,
        scholar,
        message: "Q",
        languageDirective: "",
      }),
    council_synthesis: () =>
      buildCouncilSynthesisPrompt({
        developmentalFramework: "FW",
        approvedMemory: "",
        knowledgeContext: "",
        childProfile: LEAKY_PROFILE,
        councilTakes: "TAKES",
        message: "Q",
        languageDirective: "",
      }),
    voice_reply: () =>
      buildVoiceReplyPrompt({ persona: "PERSONA", scholar, childProfile: LEAKY_PROFILE, message: "Q", languageDirective: "" }),
    extract_log: () =>
      buildExtractLogPrompt({ childProfile: LEAKY_PROFILE, message: "Q", behaviorTypes: "A | B", languageDirective: "" }),
  };

  for (const [name, build] of Object.entries(builders)) {
    it(`${name}: renders none of the leak substrings and keeps the allow-listed facts`, () => {
      const prompt = build();
      for (const leak of LEAK_SUBSTRINGS) {
        expect(prompt, `${name} leaks "${leak}" into the model prompt`).not.toContain(leak);
      }
      for (const fact of KEPT_FACTS) {
        expect(prompt, `${name} dropped the allow-listed fact "${fact}"`).toContain(fact);
      }
    });
  }

  it("negative control: the raw JSON.stringify of the fixture DOES carry every leak substring", () => {
    const raw = JSON.stringify(LEAKY_PROFILE);
    for (const leak of LEAK_SUBSTRINGS) expect(raw).toContain(leak);
  });

  it("promptProfile emits only MODEL_PROFILE_FIELDS keys, and null for a missing profile", () => {
    const projected = promptProfile(LEAKY_PROFILE);
    expect(projected).not.toBeNull();
    for (const key of Object.keys(projected ?? {})) {
      expect((MODEL_PROFILE_FIELDS as readonly string[]).includes(key), `unexpected key ${key}`).toBe(true);
    }
    expect(projected?.activeGoals).toEqual([{ label: "Calmer transitions", domain: "social" }]);
    expect(promptProfile(null)).toBeNull();
    expect(promptProfile(undefined)).toBeNull();
    expect(promptProfile({})).toEqual({});
  });

  it("MODEL_PROFILE_FIELDS never lists the banned fields (the disclosure list and the wire share one constant)", () => {
    for (const banned of ["riskLevel", "photoUrl", "avatar", "id", "onboardingComplete", "onboardingCompletedAt", "interestsUpdatedAt"]) {
      expect((MODEL_PROFILE_FIELDS as readonly string[]).includes(banned)).toBe(false);
    }
  });
});
