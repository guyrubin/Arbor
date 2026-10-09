import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { NON_DIAGNOSTIC_CONTRACT } from "../contracts/coach.js";
import { CONCERN_CUES_EN, CONCERN_CUES_HE } from "../lib/loop/concernCues.js";
import {
  COACH_CHAT_FIELD_RULES,
  COACH_CHAT_GOVERNED_ESCALATION_BLOCK,
  COACH_CHAT_MEMORY_LEAD,
  MODEL_PROFILE_FIELDS,
  PROMPT_VERSIONS,
  ROUTINE_ESCALATION_GUIDANCE,
  buildChatPrompt,
  buildCouncilSynthesisPrompt,
  buildExtractLogPrompt,
  buildGeneratePlanPrompt,
  buildAnalyzeBehaviorPrompt,
  buildTodaysFocusPrompt,
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
      ["companion_attachments", "coach_chat", "council_synthesis", "extract_log", "non_diagnostic_contract", "voice_reply", "live_session", "todays_focus", "weekly_digest", "generate_plan", "analyze_behavior"].sort(),
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
    expect(prompt).toContain("Reply in exactly 2 or 3 short, spoken-friendly sentences in ONE paragraph, at most 55 words.");
    expect(prompt).toContain("A referral must fit INSIDE this three-sentence limit, never after it.");
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
 *
 * B-AI-01 eval fix (2026-10-01, coach_chat 1.4.1): COACH_CHAT_FIELD_RULES is
 * static template text, so the block-free digest moved from the 1.3.0/1.4.0
 * bytes (7d5b299d…) to the digest below. The optional blocks stay additions.
 */
describe("Masterplan 1.3 — coach_chat block-free byte-parity (v1.4.1 pin)", () => {
  // 1.5.1 (B-AI-14 coach-core): escalateIf rule sentence + the memory lead (facts present here) — new bytes.
  // 1.5.3 (B-AI-14): facts present here, so the approved-memory block moved to the first block after the contract — new bytes.
  const COACH_CHAT_BLOCK_FREE_SHA256 = "3ec52ba919df8d3557a6e33798ca9baac462c6994c2adfaba5c9ac8698a60efe";
  // 1.5.3 parity: WITHOUT facts the bytes are the 1.5.2 bytes (digests taken on 1.5.2 before the change).
  const COACH_CHAT_NO_FACT_SHA256_152 = "bb85929a284f1c387d4a26036b957e43dca81b01f116b5710aa37f3ea85f25b6";
  const COACH_CHAT_BLANK_FACT_SHA256_152 = "e19e666ead45e69ebf934b3c7639f518d8f97ce1ce2760f3ef7ea24eae5957f3";
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

  it("with BOTH new fields absent, the prompt is byte-identical to the block-free 1.4.1 rendering", () => {
    expect(sha256(buildChatPrompt({ ...legacyArgs }))).toBe(COACH_CHAT_BLOCK_FREE_SHA256);
  });

  it("coach_chat 1.5.3: a turn WITHOUT approved facts keeps the 1.5.2 bytes exactly (empty and blank memory)", () => {
    expect(sha256(buildChatPrompt({ ...legacyArgs, approvedMemory: "" }))).toBe(COACH_CHAT_NO_FACT_SHA256_152);
    expect(sha256(buildChatPrompt({ ...legacyArgs, approvedMemory: "   " }))).toBe(COACH_CHAT_BLANK_FACT_SHA256_152);
  });

  it("coach_chat 1.5.0: seededHardMoment absent or false keeps the 1.4.1 bytes; true adds the governed block once", () => {
    expect(sha256(buildChatPrompt({ ...legacyArgs, seededHardMoment: false }))).toBe(COACH_CHAT_BLOCK_FREE_SHA256);
    const seeded = buildChatPrompt({ ...legacyArgs, seededHardMoment: true });
    expect(seeded).toBe(buildChatPrompt({ ...legacyArgs }).replace(`${COACH_CHAT_FIELD_RULES}\nReturn only JSON`, `${COACH_CHAT_FIELD_RULES}\n${COACH_CHAT_GOVERNED_ESCALATION_BLOCK}\nReturn only JSON`));
    expect(seeded.split(COACH_CHAT_GOVERNED_ESCALATION_BLOCK).length).toBe(2);
    expect(COACH_CHAT_GOVERNED_ESCALATION_BLOCK).toMatch(/Return "escalateIf": \[\]/);
    expect(COACH_CHAT_GOVERNED_ESCALATION_BLOCK).toMatch(/shepherd/);
    expect(COACH_CHAT_GOVERNED_ESCALATION_BLOCK).toMatch(/do not reword it/);
    expect(PROMPT_VERSIONS.coach_chat.version).toBe("1.8.0");
  });

  it("empty recentTurns / null weeklyContext (the sanitizers' degenerate outputs) also keep the block-free bytes", () => {
    expect(sha256(buildChatPrompt({ ...legacyArgs, recentTurns: [], weeklyContext: null }))).toBe(
      COACH_CHAT_BLOCK_FREE_SHA256,
    );
  });

  it("either block present breaks parity (so the new pin actually covers the new text)", () => {
    expect(
      sha256(buildChatPrompt({ ...legacyArgs, recentTurns: [{ role: "parent", text: "hi" }] })),
    ).not.toBe(COACH_CHAT_BLOCK_FREE_SHA256);
    expect(
      sha256(buildChatPrompt({ ...legacyArgs, weeklyContext: { momentCount: 1, milestonesCrossedCount: 0 } })),
    ).not.toBe(COACH_CHAT_BLOCK_FREE_SHA256);
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

/**
 * B-AI-01 (← B-TODAY-24 server half) — the /todays-focus prompt moved out of
 * routes/api.ts into the versioned `buildTodaysFocusPrompt`. Byte-parity: with
 * no approved facts the builder renders EXACTLY the inline template it
 * replaced (copied verbatim below from api.ts @ 92a4b74).
 */
// B-TODAY-24 (todays_focus 1.1.0): the ONE parity test now carries the one
// added "sayThis" bullet; every other byte is still the retired inline template.
// B-LOOP-13 (todays_focus 1.3.0, live judge on 1.2.0): the zero-moment line
// splits into a cold start ("a first day together", no week) and "in the last
// 7 days: no moments"; one line forbids inventing a period or history; the
// focus bullet is grounded in the input (no "child's week"); sayThis says
// "exactly ONE sentence". The template below is the 1.3.0 no-journal form.
describe("B-AI-01 — todays_focus byte-parity with the retired inline template", () => {
  const legacyInline = (childProfile: unknown, count: number, triggerSent: string, lastActionRecommendation: string, lastActionOutcome: string, languageDirective: string) => {
    const starter = "Offer an age-appropriate starter step: something easy to try and notice together, not a fix for a problem.";
    const cold = count === 0 && !(lastActionRecommendation && lastActionOutcome);
    const weekLine =
      count === 0
        ? cold
          ? `What the parent has logged so far: nothing yet, and no earlier step is on record — treat today as a first day together. ${starter}`
          : `What the parent has logged in the last 7 days: no moments. ${starter}`
        : `What the parent has logged this week: ${count} moment${count === 1 ? "" : "s"}${triggerSent ? `, most often around "${triggerSent}"` : ""}.`;
    return `${NON_DIAGNOSTIC_CONTRACT}
You are Arbor's Today's Focus writer for a calm parenting app.
Child: ${childProfile ? JSON.stringify(promptProfile(childProfile)) : "unknown"}
${weekLine}${lastActionRecommendation && lastActionOutcome ? ` The parent last tried "${lastActionRecommendation}" and reported the attempt as "${lastActionOutcome}". Use that parent-reported outcome to avoid repeating an unhelpful step and adapt effort or framing.` : ""}
Use only the time frames and the history this input states: never invent a period ("this week", "lately", "recently", "again", "these days") or anything earlier that the input does not carry.
Write today's single most useful parenting focus:
- "focus": 1-2 short, warm sentences naming what to pay attention to today — grounded only in what this input states, never an assessment. The focus never grades or assesses the child: no "slight", "mild" or "serious" difficulty, problem or delay, nothing "points to" or "indicates" anything — it names the moment and the one thing to try.
- "tryToday": ONE small, concrete thing to try today — a developmental mechanism (serve-and-return, co-regulation, a transition cue), phrased as a doable step.
- "sayThis": exactly ONE sentence (under 140 characters; never two sentences) — the exact sentence the parent says to the child while doing tryToday, in the parent's voice: warm, plain words a child understands that invite or model the step; never the child's own line, never a label or a verdict, never "good job" — when the practice is noticing what the child did, say what they did.
Never include a score, percentage, trend, severity, readiness claim, diagnosis, or outcome claim. No headings, no markdown, no emojis.${languageDirective}
Return only JSON matching the schema.`;
  };
  const cases: Array<[unknown, number, string, string, string, string]> = [
    [{ id: "c", name: "Noa", age: 4 }, 3, "transitions", "Two-minute warning", "not_today", ""],
    [{ id: "c", name: "Noa", age: 4 }, 0, "", "", "", "\nIMPORTANT: Hebrew."],
    [null, 1, "", "step", "", ""],
    [null, 0, "", "step", "helped", ""],
  ];
  it("no facts → the builder bytes equal the inline template for every case", () => {
    for (const [p, count, trig, rec, out, dir] of cases) {
      expect(buildTodaysFocusPrompt({ childProfile: p, count, triggerSent: trig, lastActionRecommendation: rec, lastActionOutcome: out, languageDirective: dir }))
        .toBe(legacyInline(p, count, trig, rec, out, dir));
      expect(buildTodaysFocusPrompt({ childProfile: p, count, triggerSent: trig, lastActionRecommendation: rec, lastActionOutcome: out, languageDirective: dir, approvedFacts: [] }))
        .toBe(legacyInline(p, count, trig, rec, out, dir));
    }
  });
  it("approved facts add one quoted block (and break parity, so the pin covers it)", () => {
    const withFacts = buildTodaysFocusPrompt({ childProfile: null, count: 0, triggerSent: "", lastActionRecommendation: "", lastActionOutcome: "", languageDirective: "", approvedFacts: ["Bath helps bedtime"] });
    expect(withFacts).toContain('- "Bath helps bedtime"');
    expect(withFacts).not.toBe(legacyInline(null, 0, "", "", "", ""));
  });
  it("coach_chat 1.4.x: an empty ledger keeps the block-free bytes; a step adds the block", () => {
    const args = {
      developmentalFramework: "F", approvedMemory: "", knowledgeContext: "", childProfile: null,
      scholar: { name: "s", concept: "c", method: "m", defaultFrame: "f" }, message: "q", languageDirective: "",
    };
    expect(buildChatPrompt({ ...args, acceptedActions: [], keptInsights: [] })).toBe(buildChatPrompt(args));
    const withStep = buildChatPrompt({ ...args, acceptedActions: [{ recommendation: "Warn first", status: "completed", outcome: "not_today", acceptedAt: "2026-09-30T08:00:00Z" }] });
    expect(withStep).toContain('- "Warn first" (accepted 2026-09-30; parent reported: not today)');
  });
});

/**
 * B-AI-02 — /generate-plan's prompt moved into ai/prompts.ts. Without context
 * the builder renders EXACTLY the inline template it replaced (copied
 * verbatim from routes/api.ts @ 9fdd258); facts and past steps add one block.
 */
describe("B-AI-02 — generate_plan byte-parity; analyze_behavior has no trend", () => {
  const legacyPlan = (fw: string, profile: unknown, topic: unknown) => `
${NON_DIAGNOSTIC_CONTRACT}
${fw}

Generate a structured, non-diagnostic Arbor action plan.
Profile: ${JSON.stringify(promptProfile(profile))}
Focus Challenge: "${topic}"
Return JSON with title, issue, phases, scripts, and successIndicators.
`;
  it("no context → the builder bytes equal the retired inline template", () => {
    const p = { id: "c", name: "Noa", age: 4 };
    expect(buildGeneratePlanPrompt({ developmentalFramework: "FW", childProfile: p, challengeTopic: "transitions" })).toBe(legacyPlan("FW", p, "transitions"));
    expect(buildGeneratePlanPrompt({ developmentalFramework: "FW", childProfile: p, challengeTopic: "x", approvedFacts: [], pastSteps: [] })).toBe(legacyPlan("FW", p, "x"));
  });
  it("1.2.1 (B-GA-27): a condition-question focus adds the one condition block; the record block names labels as internal", () => {
    const p = { id: "c", name: "Dana", age: 7 };
    const asked = buildGeneratePlanPrompt({ developmentalFramework: "FW", childProfile: p, challengeTopic: "Meltdowns are getting worse every week, is this ADHD?" });
    expect(asked).toContain("The focus asks whether the child has a condition. Arbor never answers that");
    expect(asked.indexOf("The focus asks whether")).toBeGreaterThan(asked.indexOf("Focus Challenge:"));
    // A focus that names no condition question keeps the legacy bytes (no block).
    expect(buildGeneratePlanPrompt({ developmentalFramework: "FW", childProfile: p, challengeTopic: "She has ADHD, homework tips?" })).not.toContain("The focus asks whether");
    expect(buildGeneratePlanPrompt({ developmentalFramework: "FW", childProfile: p, challengeTopic: "transitions" })).toBe(legacyPlan("FW", p, "transitions"));
    const counted = buildGeneratePlanPrompt({ developmentalFramework: "FW", childProfile: p, challengeTopic: "mornings", recentTypeCounts: [{ type: "Transition Refusal", count: 4 }] });
    expect(counted).toContain("- \"Transition Refusal\": 4\nThese behaviour types are internal English labels: in the plan, describe each in the plan's own language and never copy the label.");
  });

  it("facts + past steps add one quoted block (and break parity)", () => {
    const withCtx = buildGeneratePlanPrompt({
      developmentalFramework: "FW", childProfile: null, challengeTopic: "t", approvedFacts: ["Bath helps"],
      pastSteps: [{ recommendation: "Warn first", status: "completed", outcome: "not_today", acceptedAt: "2026-09-30T00:00:00Z" }],
    });
    expect(withCtx).toContain('- "Bath helps"');
    expect(withCtx).toContain('- "Warn first" (parent reported: not today)');
  });
  it("analyze_behavior asks for no intensityTrend and carries the language directive", () => {
    const p = buildAnalyzeBehaviorPrompt({ developmentalFramework: "FW", childProfile: null, logs: [], languageDirective: "«HE»" });
    expect(p).not.toContain("intensityTrend");
    // B-AI-13: the count instruction sits between the return line and the directive.
    expect(p).toContain("Return JSON with frequencyCount, triggerBreakdown, expertInsights, actionPlanSuggestion.\nfrequencyCount maps each behaviorType");
    expect(p.trimEnd().endsWith("Counts are whole numbers of logs only.«HE»")).toBe(true);
  });
  it("B-AI-13: analyze_behavior requests counts, never a share — and never sees notes", () => {
    const p = buildAnalyzeBehaviorPrompt({
      developmentalFramework: "FW", childProfile: null, languageDirective: "",
      logs: [{ behaviorType: "Tantrum", trigger: "bedtime", notes: "NOTE-SENTINEL", response: "RESP-SENTINEL", resolutionNotes: "RES-SENTINEL", photoAttachment: "data:PHOTO", intensity: 4 }],
    });
    const task = p.slice(p.indexOf("Analyze Arbor parent-logged observations"));
    expect(task).not.toMatch(/percent|%|ratio|proportion|share of/i);
    expect(task).toContain("triggerBreakdown lists each trigger with count = how many logs name it");
    for (const sentinel of ["NOTE-SENTINEL", "RESP-SENTINEL", "RES-SENTINEL", "data:PHOTO", '"intensity"']) expect(p).not.toContain(sentinel);
    expect(p).toContain('{"behaviorType":"Tantrum","trigger":"bedtime"}');
    // NEGATIVE CONTROL: the pre-change prompt line forwarded the raw log.
    expect(`Behavior Logs: ${JSON.stringify([{ notes: "NOTE-SENTINEL" }])}`).toContain("NOTE-SENTINEL");
  });
  it("B-AI-13: analyze_behavior is pinned at 1.1.0", () => {
    expect(PROMPT_VERSIONS.analyze_behavior.version).toBe("1.1.0");
  });
});

/**
 * B-AI-01 eval fix (coach_chat 1.4.1): the field rules ride the /chat prompt
 * only. They answer four live-judge findings (crisis words in a routine
 * escalateIf, ignored approved memory, invented behaviour on a condition
 * question, graded confidence); council and voice keep their own pinned bytes.
 */
describe("coach_chat 1.4.1 — field rules", () => {
  const chatArgs = {
    developmentalFramework: "F", approvedMemory: "- Timer helps", knowledgeContext: "", childProfile: null,
    scholar: { name: "s", concept: "c", method: "m", defaultFrame: "f" }, message: "q", languageDirective: "",
  };
  it("the /chat prompt carries the rules right after the routine escalation guidance", () => {
    const prompt = buildChatPrompt(chatArgs);
    expect(prompt).toContain(`${ROUTINE_ESCALATION_GUIDANCE}\n${COACH_CHAT_FIELD_RULES}\nReturn only JSON`);
    expect(COACH_CHAT_FIELD_RULES).toMatch(/ARBOR APPROVED CHILD MEMORY/);
    expect(COACH_CHAT_FIELD_RULES).toMatch(/only a qualified professional can assess/);
    expect(COACH_CHAT_FIELD_RULES).toMatch(/never write that condition's name or any label back/);
    expect(COACH_CHAT_FIELD_RULES).toMatch(/In a routine answer no field names self-harm/);
    expect(COACH_CHAT_FIELD_RULES).toMatch(/never low, medium, high/);
    expect(PROMPT_VERSIONS.coach_chat.version).toBe("1.8.0");
  });
  it("coach_chat 1.5.1: escalateIf thresholds stay on the behaviour the parent described", () => {
    expect(COACH_CHAT_FIELD_RULES).toContain("Thresholds are about the behaviour the parent described and never introduce a danger the parent did not raise.");
  });
  it("coach_chat 1.5.1: the memory lead renders right under the facts ONLY when facts exist (EN + no-memory form unchanged)", () => {
    const withFacts = buildChatPrompt(chatArgs);
    expect(withFacts).toContain(`ARBOR APPROVED CHILD MEMORY:\n- Timer helps\n${COACH_CHAT_MEMORY_LEAD}\n`);
    expect(withFacts.split(COACH_CHAT_MEMORY_LEAD).length).toBe(2);
    expect(COACH_CHAT_MEMORY_LEAD).toMatch(/todayPlan step 1 starts from that fact, and the first sentence of "text" says the fact/);
    expect(COACH_CHAT_MEMORY_LEAD).toMatch(/never contradict it/);
    const noFacts = buildChatPrompt({ ...chatArgs, approvedMemory: "" });
    expect(noFacts).not.toContain(COACH_CHAT_MEMORY_LEAD);
    expect(noFacts).toContain("ARBOR APPROVED CHILD MEMORY:\nNo parent-approved child memory available.\n");
    expect(buildChatPrompt({ ...chatArgs, approvedMemory: "   " })).not.toContain(COACH_CHAT_MEMORY_LEAD);
    // the council prompt keeps its own memory block untouched
    const council = buildCouncilSynthesisPrompt({ developmentalFramework: "F", approvedMemory: "- Timer helps", knowledgeContext: "", childProfile: null, councilTakes: "T", message: "q", languageDirective: "" });
    expect(council).not.toContain(COACH_CHAT_MEMORY_LEAD);
  });
  it("coach_chat 1.5.3: with facts, the approved-memory block is the FIRST block after the contract — before the framework, the cards and the lens", () => {
    const prompt = buildChatPrompt({ ...chatArgs, developmentalFramework: "FRAMEWORK-BLOCK", knowledgeContext: "CARDS-BLOCK" });
    const memoryAt = prompt.indexOf("ARBOR APPROVED CHILD MEMORY:");
    expect(prompt.indexOf(NON_DIAGNOSTIC_CONTRACT)).toBe(1);
    expect(prompt.slice(1 + NON_DIAGNOSTIC_CONTRACT.length)).toMatch(/^\nARBOR APPROVED CHILD MEMORY:\n- Timer helps\n/);
    expect(memoryAt).toBeLessThan(prompt.indexOf("FRAMEWORK-BLOCK"));
    expect(memoryAt).toBeLessThan(prompt.indexOf("ARBOR AI WIKI SOURCE CARDS:"));
    expect(memoryAt).toBeLessThan(prompt.indexOf("ACTIVE SCHOLAR LENS"));
    expect(prompt.split("ARBOR APPROVED CHILD MEMORY:").length).toBe(2);
    // without facts the block stays after the framework (1.5.2 layout)
    const noFacts = buildChatPrompt({ ...chatArgs, approvedMemory: "", developmentalFramework: "FRAMEWORK-BLOCK" });
    expect(noFacts.indexOf("ARBOR APPROVED CHILD MEMORY:")).toBeGreaterThan(noFacts.indexOf("FRAMEWORK-BLOCK"));
  });

  it("council and voice prompts do not carry the /chat field rules", () => {
    const council = buildCouncilSynthesisPrompt({ developmentalFramework: "F", approvedMemory: "", knowledgeContext: "", childProfile: null, councilTakes: "T", message: "q", languageDirective: "" });
    const voice = buildVoiceReplyPrompt({ persona: "P", scholar: chatArgs.scholar, childProfile: null, message: "q", languageDirective: "" });
    expect(council).not.toContain(COACH_CHAT_FIELD_RULES);
    expect(voice).not.toContain(COACH_CHAT_FIELD_RULES);
  });
});

/* B-LOOP-06 — extract_log 1.3.0 / 1.3.1: the milestone-match block is OPTIONAL. With
   no candidates the rendered prompt is byte-identical to 1.2.0 (whose pinned
   digest was the single canonical build); with candidates the block lists
   ONLY the server's candidates and embeds the non-diagnostic contract. */
describe("B-LOOP-06 — extract_log milestone-match block", () => {
  const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
  const legacy = {
    childProfile: { id: "«child»", name: "«name»", age: 4 },
    message: "«parent-message»",
    behaviorTypes: "«behavior-types»",
    languageDirective: "«language-directive»",
  };
  it("no candidates ⇒ the 1.2.0 bytes (fbad6b9d…)", () => {
    expect(sha(buildExtractLogPrompt(legacy))).toBe("fbad6b9dc903299846b64b6eb0834f67cadec8cc84b7874194f0d88347aecdf6");
    expect(sha(buildExtractLogPrompt({ ...legacy, milestoneCandidates: [] }))).toBe("fbad6b9dc903299846b64b6eb0834f67cadec8cc84b7874194f0d88347aecdf6");
  });
  it("with candidates: one line per candidate, choose-only-from-list, null for a concern, contract embedded", () => {
    const p = buildExtractLogPrompt({
      ...legacy,
      milestoneCandidates: [
        { id: "cdc-24m-3", shelf: "words", title: "Says two words together" },
        { id: "cdc-24m-9", shelf: "moving", title: "Kicks a ball" },
      ],
    });
    expect(p).toContain(NON_DIAGNOSTIC_CONTRACT);
    expect(p).toContain('- cdc-24m-3 · words · "Says two words together"');
    expect(p).toContain('- cdc-24m-9 · moving · "Kicks a ball"');
    expect(p).toContain("Choose ONLY from this list, never another id.");
    // 1.3.1: a proposal needs a DEMONSTRATED skill; the worry / negation cues
    // are named in EN + HE from the one list the server guard screens.
    expect(p).toContain("Propose a shelf and a milestone ONLY for a skill the child DEMONSTRATED in the parent's words; otherwise set milestoneMatch to null.");
    expect(p).toContain("An everyday event that shows no skill (a meal, an outing, a visit) is null.");
    // 1.3.2 (B-GA-27): general play is not a listed skill by itself.
    expect(p).toContain("General play or being busy (\"played with his cars\", \"seemed busy\") is not itself a listed skill: give a milestoneId only when the words describe the exact action its title names; otherwise null or a shelf-only low pick.");
    expect(p).toContain("is never a milestone: when the description says");
    for (const cue of [...CONCERN_CUES_EN, ...CONCERN_CUES_HE]) expect(p).toContain(`"${cue}"`);
    expect(p).not.toContain("If the moment clearly belongs to one shelf");
    expect(p).toContain("Never infer a delay, a status, an emotion or a diagnosis.");
    expect(p.indexOf("Milestone match (optional)")).toBeLessThan(p.indexOf("Return only JSON matching the schema."));
  });
});

/* B-PROG-01 — the ONE program context line in todays_focus 1.2.0, coach_chat
   1.6.0, voice_reply 1.7.0 and live_session 1.5.0: present once when the
   family has an active program, and WITHOUT one every prompt keeps its
   previous bytes (parity). */
describe("B-PROG-01 — the active-program line", () => {
  const program = { name: "Talk Together", week: 3, skill: "Take turns: answer every sound, then wait." };
  const LINE = "Active program: Talk Together, week 3: Take turns: answer every sound, then wait.";
  const chatArgs = {
    developmentalFramework: "F", approvedMemory: "", knowledgeContext: "", childProfile: null,
    scholar: { name: "s", concept: "c", method: "m", defaultFrame: "f" }, message: "q", languageDirective: "",
    acceptedActions: [{ recommendation: "step", status: "accepted" as const, acceptedAt: "2026-10-01T00:00:00.000Z" }],
  };
  const focusArgs = { childProfile: null, count: 2, triggerSent: "", lastActionRecommendation: "", lastActionOutcome: "", languageDirective: "", approvedFacts: ["fact"] };
  const spoken = { profile: { age: 2 }, approvedMemory: "m", approvedMemoryFactsUsed: 1, recentTurns: [] } as Parameters<typeof buildVoiceReplyPrompt>[0]["companionContext"];
  const voiceArgs = { persona: "P", scholar: { name: "s", method: "m" }, childProfile: null, message: "q", languageDirective: "" };

  it("renders the line exactly once, in the spec's words, in all four prompts", async () => {
    const { buildLiveSystemInstruction } = await import("../lib/livePersona.js");
    const all = [
      buildChatPrompt({ ...chatArgs, activeProgram: program }),
      buildTodaysFocusPrompt({ ...focusArgs, activeProgram: program }),
      buildVoiceReplyPrompt({ ...voiceArgs, companionContext: { ...spoken!, program } }),
      buildLiveSystemInstruction("en", { ...spoken!, program }),
    ];
    for (const p of all) expect(p.split(LINE).length - 1).toBe(1);
    // placement: after the companion ledger in /chat, after the facts in /todays-focus
    const chat = all[0];
    expect(chat.indexOf(LINE)).toBeGreaterThan(chat.indexOf("STEPS THE PARENT CHOSE TO TRY"));
    expect(chat.indexOf(LINE)).toBeLessThan(chat.indexOf("ARBOR AI WIKI SOURCE CARDS"));
    const focus = all[1];
    expect(focus.indexOf(LINE)).toBeGreaterThan(focus.indexOf("Parent-approved facts"));
    expect(focus.indexOf(LINE)).toBeLessThan(focus.indexOf("What the parent has logged this week"));
  });

  it("parity: without an active program the four prompts keep their previous bytes", async () => {
    const { buildLiveSystemInstruction } = await import("../lib/livePersona.js");
    const strip = (s: string) => s.replace(`${LINE}\n`, "");
    expect(buildChatPrompt(chatArgs)).toBe(strip(buildChatPrompt({ ...chatArgs, activeProgram: program })));
    expect(buildTodaysFocusPrompt(focusArgs)).toBe(strip(buildTodaysFocusPrompt({ ...focusArgs, activeProgram: program })));
    expect(buildVoiceReplyPrompt({ ...voiceArgs, companionContext: spoken })).toBe(strip(buildVoiceReplyPrompt({ ...voiceArgs, companionContext: { ...spoken!, program } })));
    expect(buildLiveSystemInstruction("en", spoken)).toBe(strip(buildLiveSystemInstruction("en", { ...spoken!, program })));
    // an empty skill or name renders nothing
    expect(buildChatPrompt({ ...chatArgs, activeProgram: { ...program, skill: " " } })).toBe(buildChatPrompt(chatArgs));
    expect(PROMPT_VERSIONS.todays_focus.version).toBe("1.3.3");
    expect(PROMPT_VERSIONS.coach_chat.version).toBe("1.8.0");
    expect(PROMPT_VERSIONS.voice_reply.version).toBe("1.10.6");
    expect(PROMPT_VERSIONS.live_session.version).toBe("1.6.0");
  });
});

/* B-LOOP-13 — the journal in todays_focus 1.3.0, the practice line in
   coach_chat 1.7.0 and voice_reply 1.8.0 (never live_session). */
describe("B-LOOP-13 — the journal block and today's practice line", () => {
  const LINE = "Today's practice: 'Night night, teddy.' (not today).";
  const practice = { say: "Night night, teddy.", state: "not_today" as const };
  const chatArgs = {
    developmentalFramework: "F", approvedMemory: "", knowledgeContext: "", childProfile: null,
    scholar: { name: "s", concept: "c", method: "m", defaultFrame: "f" }, message: "q", languageDirective: "",
  };
  const spoken = { profile: { age: 2 }, approvedMemory: "m", approvedMemoryFactsUsed: 1, recentTurns: [] } as NonNullable<Parameters<typeof buildVoiceReplyPrompt>[0]["companionContext"]>;
  const voiceArgs = { persona: "P", scholar: { name: "s", method: "m" }, childProfile: null, message: "q", languageDirective: "" };
  const journal = {
    shelfCoverage: { sleep: 0, food: 2, words: 1, feelings: 0, play: 3, moving: 0, hands: 0, school: 0, family: 0 },
    nextMilestones: [{ id: "m-1", shelf: "words" as const, title: "Says two words together", ageLine: "Most children do this by 2 years" }],
    candidates: [
      { id: "pr-1", shelf: "sleep" as const, say: "Night night, teddy.", milestoneId: null, firstTier: true, do: "Tuck teddy in first." },
      { id: "pr-2", shelf: "words" as const, say: "LATER_TIER_SAY", milestoneId: "m-1", firstTier: false },
    ],
    restedShelves: ["food" as const],
    practice: null,
    nightAnswers: [{ date: "2026-10-05", practice: "Book time.", practiceOutcome: "helped" as const, whatHappened: "She hugged the book" }],
  };
  const focusArgs = { childProfile: null, count: 2, triggerSent: "", lastActionRecommendation: "", lastActionOutcome: "", languageDirective: "" };

  it("coach_chat and voice_reply render the line once; live_session never does", async () => {
    const { buildLiveSystemInstruction } = await import("../lib/livePersona.js");
    const chat = buildChatPrompt({ ...chatArgs, todayPractice: practice });
    const voice = buildVoiceReplyPrompt({ ...voiceArgs, companionContext: { ...spoken, todayPractice: practice } });
    for (const p of [chat, voice]) expect(p.split(LINE).length - 1).toBe(1);
    expect(chat.indexOf(LINE)).toBeLessThan(chat.indexOf("ARBOR AI WIKI SOURCE CARDS"));
    expect(voice.indexOf(LINE)).toBeLessThan(voice.indexOf("The parent just said"));
    expect(chat).toMatch(/never as a verdict about the child/);
    expect(buildLiveSystemInstruction("en", { ...spoken, todayPractice: practice })).toBe(buildLiveSystemInstruction("en", spoken));
  });

  it("parity: no practice ⇒ the previous bytes (chat, voice, focus)", () => {
    const strip = (x: string) => x.replace(/Today's practice: [^\n]*\n/, "");
    expect(buildChatPrompt(chatArgs)).toBe(strip(buildChatPrompt({ ...chatArgs, todayPractice: practice })));
    expect(buildChatPrompt({ ...chatArgs, todayPractice: null })).toBe(buildChatPrompt(chatArgs));
    expect(buildChatPrompt({ ...chatArgs, todayPractice: { say: " ", state: "pending" } })).toBe(buildChatPrompt(chatArgs));
    expect(buildVoiceReplyPrompt({ ...voiceArgs, companionContext: spoken })).toBe(strip(buildVoiceReplyPrompt({ ...voiceArgs, companionContext: { ...spoken, todayPractice: practice } })));
    expect(buildTodaysFocusPrompt({ ...focusArgs, journal: null })).toBe(buildTodaysFocusPrompt(focusArgs));
  });

  it("todays_focus renders the journal: counts as choosing input, candidates, rested shelves, night answers — never a quote", () => {
    const p = buildTodaysFocusPrompt({ ...focusArgs, journal });
    expect(p).toContain("THE PARENT'S JOURNAL");
    expect(p).toContain("sleep 0 · food 2 · words 1");
    expect(p).toMatch(/never write a number, never compare shelves or children/);
    expect(p).toContain('- m-1 · words · "Says two words together" · "Most children do this by 2 years"');
    expect(p).toContain('- pr-1 · sleep · do: "Tuck teddy in first." · say: "Night night, teddy."');
    // round 4: the step is written ABOUT the picked practice
    expect(p).toMatch(/Write focus, tryToday and sayThis ABOUT the practice you pick/);
    expect(p).toMatch(/never the child's own line, never a label or a verdict, never "good job"/);
    // round 2: only the FIRST TIER is listed; the model never ranks shelves
    expect(p).not.toContain("LATER_TIER_SAY");
    expect(p).toMatch(/FIRST TIER, already ordered by Arbor/);
    expect(p).toMatch(/Do not rank shelves yourself/);
    expect(p).toContain("rest them, never choose them: food");
    expect(p).toContain(`- 2026-10-05 · practice 'Book time.': helped · "She hugged the book"`);
    // round 2: the model writes no why (server-rendered from the chooser's reason)
    expect(p).not.toMatch(/"why"/);
    expect(p).not.toMatch(/quote/i);
    expect(p.indexOf("THE PARENT'S JOURNAL")).toBeLessThan(p.indexOf("What the parent has logged"));
  });

  it("a practice already set (dose row or pin) replaces the candidate list and the pick rules", () => {
    const set = buildTodaysFocusPrompt({ ...focusArgs, journal: { ...journal, practice: { id: "pr-1", shelf: "sleep", say: "Night night, teddy.", state: "pending", date: "2026-10-06" } } });
    expect(set).toContain("Today's practice: 'Night night, teddy.' (pending).");
    expect(set).toContain("already set by the parent");
    expect(set).not.toContain("Today's practice candidates");
    expect(set).not.toMatch(/"practiceId":/);
  });

  it("cold start says a first day and names no week; a night answer makes it not a cold start", () => {
    const cold = buildTodaysFocusPrompt({ ...focusArgs, count: 0 });
    expect(cold).toContain("nothing yet, and no earlier step is on record — treat today as a first day together");
    expect(cold).not.toContain("logged this week");
    expect(cold).toMatch(/never invent a period/);
    const warm = buildTodaysFocusPrompt({ ...focusArgs, count: 0, journal });
    expect(warm).toContain("in the last 7 days: no moments");
    expect(warm).toContain("(the journal's notes per shelf cover the last 30 days)");
  });

  it("versions: todays_focus 1.3.3 · coach_chat 1.7.0 · voice_reply 1.8.2 · live_session unchanged 1.5.0", () => {
    expect(PROMPT_VERSIONS.todays_focus.version).toBe("1.3.3");
    expect(PROMPT_VERSIONS.coach_chat.version).toBe("1.8.0");
    expect(PROMPT_VERSIONS.voice_reply.version).toBe("1.10.6");
    expect(PROMPT_VERSIONS.live_session.version).toBe("1.6.0");
  });
});

/* B-LOOP-13 round 2 — voice_reply 1.8.1 renders the night answers. */
describe("B-LOOP-13 round 2 — voice_reply night answers", () => {
  const spoken = { profile: { age: 4 }, approvedMemory: "", approvedMemoryFactsUsed: 0, recentTurns: [] } as NonNullable<Parameters<typeof buildVoiceReplyPrompt>[0]["companionContext"]>;
  const voiceArgs = { persona: "P", scholar: { name: "s", method: "m" }, childProfile: null, message: "What should we try tomorrow?", languageDirective: "" };
  const practice = { say: "This book or that one?", state: "pending" as const };
  const answers = [{ date: "2026-10-05", practice: "This book or that one?", practiceOutcome: "not_today" as const, whatHappened: "She was too tired." }];
  it("renders the answers after the practice line, says they ARE the earlier record, before the parent's words", () => {
    const v = buildVoiceReplyPrompt({ ...voiceArgs, companionContext: { ...spoken, todayPractice: practice, nightAnswers: answers } });
    expect(v).toContain(`Arbor catalogue guidance for the linked activity (suggested wording, NOT a record of anyone's speech): "This book or that one?".`);
    expect(v).toContain(`Parent-reported outcome: not today — it did not happen or did not work. Parent's own description: "She was too tired.".`);
    expect(v).not.toContain(`the parent tried 'This book or that one?'`);
    expect(v).toMatch(/this IS the earlier record/);
    expect(v).toMatch(/Answer from this journal: .* then build on it/);
    // round 3: with no turns and no memory, the no-prior-conversation rule gives way to the journal note
    expect(v).toContain("BUT THE PARENT'S PRACTICE JOURNAL BELOW IS THE EARLIER RECORD");
    expect(v).not.toContain("say you do not have the earlier step here");
    expect(v.indexOf("Today's practice:")).toBeLessThan(v.indexOf("THE PARENT'S PRACTICE JOURNAL —"));
    expect(v.indexOf("THE PARENT'S PRACTICE JOURNAL —")).toBeLessThan(v.indexOf("The parent just said"));
  });
  it("parity: no answers ⇒ the practice line alone; live_session never renders either", async () => {
    const { buildLiveSystemInstruction } = await import("../lib/livePersona.js");
    expect(buildVoiceReplyPrompt({ ...voiceArgs, companionContext: { ...spoken, todayPractice: practice, nightAnswers: [] } }))
      .toBe(buildVoiceReplyPrompt({ ...voiceArgs, companionContext: { ...spoken, todayPractice: practice } }));
    expect(buildLiveSystemInstruction("en", { ...spoken, todayPractice: practice, nightAnswers: answers })).toBe(buildLiveSystemInstruction("en", spoken));
  });
});
