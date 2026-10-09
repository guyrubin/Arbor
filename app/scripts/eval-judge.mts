/**
 * EVAL-4: the generic LLM-judge runner — `npm run eval:judge -- <suite-name>`
 * (e.g. `npm run eval:judge -- coach-hardmoment-seed-v1`).
 *
 * What a run does:
 *   1. loads evals/<suite>.eval.json;
 *   2. spins up the REAL API router in-process (createApiRouter with the real
 *      model provider from loadConfig()) and runs every scenario through its
 *      real route — hard-moment scenarios build the governed coach seed on the
 *      approved-fixture stamp (the hardMomentSurfaces.test.ts pattern; a
 *      SYNTHETIC child profile only, never real child data);
 *   3. makes ONE judge call per scenario on the suite's PINNED judgeModel —
 *      routed through ClaudeVertexProvider on the existing Vertex ADC (no new
 *      account), or through api.anthropic.com when ANTHROPIC_API_KEY is set;
 *   4. APPENDS {ts, suite, version, judgeModel, resolvedRouteModel,
 *      promptVersions, perScenario, passRate} to evals/<suite>.results.jsonl
 *      (append-only — a second run never overwrites the first);
 *   5. exits non-zero on any safe===false or any score below the suite
 *      passBar (escalationVerbatim < 1.0 is the canonical Tier-C fail).
 *
 * B-LOOP-14 STATIC mode: a suite whose scenarios are `tier: "static"` (or
 * `runner.mode: "static"`, e.g. milestone-loop-v1 — `npm run eval:loop`)
 * carries the text under judgement in `input.content`; no server starts,
 * step 2 is skipped, the judge reads the rendered content + its source, and
 * the row stamps the suite's contentHashes (a stale suite is refused).
 * `--ids a,b,c` judges a subset (scenario ids, or catalogue/practice ids).
 *
 * B-PROV-10 LIVE TIER ONLY (opt-in): a suite whose runner declares
 * `deterministicCiGate` (voice-loop-v1) is judged on its `tier: "live"`
 * scenarios only — its deterministic scenarios carry stubbed model replies /
 * screening-down conditions no live route can reproduce, so the row lists
 * them as `skippedDeterministic` with `skippedReason: "CI gate: <file>"` and
 * passRate counts judged scenarios only (src/eval/judge liveJudgePlan).
 * Suites without the field are judged in full, unchanged.
 *
 * Requires live model credentials — this is the LIVE half of the eval program;
 * the deterministic half runs in CI via `npm test` + `npm run check:acceptance`.
 */
import express from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createHash } from "node:crypto";
import { loadConfig } from "../src/config/env.js";
import { createModelProvider, VertexGeminiProvider, routeDecisionFor, toAnthropicVertexModelId, type ModelRoute } from "../src/ai/modelRouter.js";
import { ClaudeVertexProvider } from "../src/ai/claudeVertexProvider.js";
import { PROMPT_VERSIONS } from "../src/ai/prompts.js";
import { createApiRouter } from "../src/routes/api.js";
import { loadFramework } from "../src/services/framework.js";
import { LocalMemoryStore } from "../src/memory/localMemoryStore.js";
import { LocalShareStore } from "../src/sharing/shares.js";
import { LocalConsentStore } from "../src/sharing/consent.js";
import { createCounterStore } from "../src/server/quotaStore.js";
import { createEntitlementStore } from "../src/server/entitlements.js";
import { createReferralStore } from "../src/server/referral.js";
import { createConsultStore } from "../src/server/consultRequests.js";
import { createAdminMetricsStore } from "../src/server/adminMetrics.js";
import { createWaitlistStore } from "../src/server/waitlist.js";
import { hardMomentCards } from "../src/content/hardMomentCards.js";
import { hardMomentEvalSeedMessage } from "../src/eval/acceptance.js";
import { appendResultsRow, isStaticSuite, judgeVisibleInput, runSuiteWithDeps, type ScenarioVerdict } from "../src/eval/judge.js";
import { changedContentKeys } from "../src/eval/contentHashes.js";
import type { EvalScenario, EvalSuite } from "../src/eval/acceptance.js";
import { handoffWireBody, planWireBody, runnerInputError, todaysFocusWireBody } from "../src/eval/runnerInput.js";
import { syntheticDocumentDataUrl } from "./evalDocumentFixture.mjs";
import { PROGRAM_IMPORT_PROMPT } from "../src/ai/programImportPrompt.js";
import { PROGRAM_IMPORT_VERSION } from "../src/lib/programImport.js";
import type { CompanionLedgerSource } from "../src/server/companionContext.js";

const REPO_ROOT = path.resolve(process.cwd(), "..");

/** SYNTHETIC child profile — never real child data (suite fixture rule). */
const SYNTHETIC_PROFILE = { id: "eval-synthetic-child", name: "Noa", age: 4, ageBand: "3-5 years" };


const loadSuite = (name: string): EvalSuite => {
  const file = path.join(REPO_ROOT, "evals", `${name}.eval.json`);
  if (!fs.existsSync(file)) throw new Error(`Unknown suite "${name}" — expected ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as EvalSuite;
};

const routeOf = (scenario: EvalScenario): string => scenario.route ?? "/api/chat";

/** Explicit synthetic demographics, shared by the route and judge input. */
const syntheticProfileFor = (suite: EvalSuite, scenario: EvalScenario) => ({
  ...SYNTHETIC_PROFILE,
  id: "eval-" + suite.suite + "-" + scenario.id,
  ...(typeof scenario.input?.gender === "string" ? { gender: scenario.input.gender } : {}),
});

const modelRouteFor = (route: string): ModelRoute =>
  route === "/api/chat" ? "coach_high_stakes" : route === "/api/generate-handoff" ? "handoff_structured" : "analysis_structured";

/**
 * EVAL-5: seed parent-approved memory facts for a scenario through the SAME
 * parent seams the product uses — POST /memory/:childId/propose (pending) then
 * PATCH /memory/:memoryId {status:"approved"} (the parent approval act).
 * Nothing is written outside the existing ledger; synthetic child only.
 */
const seedApprovedMemory = async (baseUrl: string, childId: string, facts: readonly string[]): Promise<void> => {
  for (const fact of facts) {
    const proposeRes = await fetch(`${baseUrl}/api/memory/${childId}/propose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fact, source: "eval-fixture", retention: "3 months", prompt: "eval:approved-memory" }),
    });
    if (!proposeRes.ok) throw new Error(`memory propose failed (${proposeRes.status}) for eval fact`);
    const { items } = (await proposeRes.json()) as { items: { memoryId: string; fact: string }[] };
    const item = items.find((entry) => entry.fact === fact);
    if (!item) throw new Error("proposed eval fact not found in the review ledger");
    const approveRes = await fetch(`${baseUrl}/api/memory/${item.memoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    if (!approveRes.ok) throw new Error(`memory approve failed (${approveRes.status}) for eval fact`);
  }
};

// ── The real in-process server ───────────────────────────────────────────────
export const startServer = async (wrapProvider?: (provider: ReturnType<typeof createModelProvider>) => ReturnType<typeof createModelProvider>, companionLedgerSource?: CompanionLedgerSource) => {
  if (process.env.ARBOR_ENV === "prod" || process.env.MEMORY_ADAPTER === "firestore") throw new Error("Live evaluations require local synthetic stores; production data must not be used.");
  const config = loadConfig();
  const rawProvider = createModelProvider(config);
  const modelProvider = wrapProvider ? wrapProvider(rawProvider) : rawProvider;
  const entitlementStore = createEntitlementStore(config);
  const app = express();
  app.use(express.json({ limit: "12mb" }));
  app.use(
    "/api",
    createApiRouter({
      config,
      modelProvider,
      memoryStore: new LocalMemoryStore(),
      shareStore: new LocalShareStore(),
      consentStore: new LocalConsentStore(),
      framework: loadFramework(),
      entitlementStore,
      referralStore: createReferralStore(config, entitlementStore),
      counters: createCounterStore(config),
      consultStore: createConsultStore(config),
      adminMetrics: createAdminMetricsStore(config),
      waitlistStore: createWaitlistStore(config),
      companionLedgerSource,
    }),
  );
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  return { config, baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, server };
};

/** Collapse an SSE body into a transcript (deltas + terminal payload). */
const sseTranscript = (raw: string): string => {
  const deltas: string[] = [];
  const terminal: string[] = [];
  for (const block of raw.split("\n\n")) {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (!dataLines.length) continue;
    const data = JSON.parse(dataLines.join("\n"));
    if (event === "delta" && typeof data.text === "string") deltas.push(data.text);
    if (event === "done" || event === "error") terminal.push(`${event.toUpperCase()}: ${JSON.stringify(data)}`);
  }
  return `${deltas.join("")}\n\n${terminal.join("\n")}`.trim();
};

const buildScenarioRunner = (suite: EvalSuite, baseUrl: string) => async (scenario: EvalScenario): Promise<string> => {
  const route = routeOf(scenario);
  const locale = scenario.locale === "he" ? "he" : "en";
  const input = scenario.input ?? {};
  // B-CAREPRO-12 residue: one rule (src/eval/runnerInput) says what each route
  // needs; a scenario the runner cannot drive fails here, by name.
  const inputError = runnerInputError(scenario);
  if (inputError) throw new Error(`scenario "${scenario.id}" ${inputError}`);
  // A scenario never inherits another scenario's persisted synthetic memories.
  const scenarioProfile = syntheticProfileFor(suite, scenario);

  if (route === "/api/vision") {
    // The model gets bytes only. sourceLines and golden expectations are
    // visible to the judge, never leaked into the OCR request or prompt.
    const dataUrl = await syntheticDocumentDataUrl(input, locale);
    console.log(`[eval:vision] ${scenario.id} (${input.documentKind}, ${locale})`);
    const res = await fetch(`${baseUrl}/api/vision`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childId: scenarioProfile.id, childProfile: scenarioProfile, mode: "recommendations", image: { dataUrl }, language: locale }),
    });
    return `HTTP ${res.status}\n${await res.text()}`;
  }

  // B-CAREPRO-12 residue (school-handoff-v1): the School Brief route. The body
  // is what the client posts (logs with day/timestamp, milestones, language,
  // audience teacher); the server's allow-list is what the scenario tests. The
  // transcript is the raw status + JSON so the judge sees the brief or the 409
  // escalation contract exactly as the client would.
  if (route === "/api/generate-handoff") {
    const res = await fetch(`${baseUrl}/api/generate-handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(handoffWireBody(input, scenarioProfile)),
    });
    return `HTTP ${res.status}\n${await res.text()}`;
  }

  // B-TODAY-24 (today-focus-v1): the step card's route. Approved facts (the
  // scenario child's, and a sibling's for the isolation case) are seeded
  // through the real propose→approve seam first; the body is what Today
  // posts. The transcript is the raw status + JSON (focus, tryToday,
  // sayThis, inputsUsed) so the judge sees exactly what the card would.
  if (route === "/api/todays-focus") {
    const body = todaysFocusWireBody(input, scenarioProfile);
    const childId = String(body.childProfile.id ?? scenarioProfile.id);
    if (Array.isArray(input.approvedFacts) && input.approvedFacts.length > 0) {
      await seedApprovedMemory(baseUrl, childId, input.approvedFacts.map(String));
    }
    const sibling = (input.siblingSeed ?? null) as { childId?: unknown; approvedFacts?: unknown } | null;
    if (sibling && typeof sibling.childId === "string" && Array.isArray(sibling.approvedFacts) && sibling.approvedFacts.length > 0) {
      await seedApprovedMemory(baseUrl, sibling.childId, sibling.approvedFacts.map(String));
    }
    const res = await fetch(`${baseUrl}/api/todays-focus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return `HTTP ${res.status}\n${await res.text()}`;
  }

  // B-ASKJB-27 (plan-v1): the plan route. Approved facts (the scenario
  // child's, and a sibling's for the isolation case) are seeded through the
  // real propose->approve seam; the body is what PlansTab posts (counts only).
  if (route === "/api/generate-plan") {
    const body = planWireBody(input, scenarioProfile);
    const childId = String(body.childProfile.id ?? scenarioProfile.id);
    if (Array.isArray(input.approvedFacts) && input.approvedFacts.length > 0) {
      await seedApprovedMemory(baseUrl, childId, input.approvedFacts.map(String));
    }
    const sibling = (input.siblingSeed ?? null) as { childId?: unknown; approvedFacts?: unknown } | null;
    if (sibling && typeof sibling.childId === "string" && Array.isArray(sibling.approvedFacts) && sibling.approvedFacts.length > 0) {
      await seedApprovedMemory(baseUrl, sibling.childId, sibling.approvedFacts.map(String));
    }
    const res = await fetch(`${baseUrl}/api/generate-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return `HTTP ${res.status}\n${await res.text()}`;
  }

  if (route === "/api/live/turn") {
    const text = String(input.text ?? input.outputTranscription ?? "");
    const res = await fetch(`${baseUrl}/api/live/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: input.role ?? "model", text, language: locale }),
    });
    return `HTTP ${res.status}\n${await res.text()}`;
  }

  // EVAL-3 (capture-extract-v1): the capture-extraction route. The message is
  // taken as-is (deliberately including empty-ish inputs — the 400 path is a
  // scenario); the transcript is the raw status + JSON body so the judge sees
  // exactly the draft (or the 409/400 contract) a parent's client would.
  if (route === "/api/extract-log") {
    const res = await fetch(`${baseUrl}/api/extract-log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // B-LOOP-06: a milestone-match scenario carries its own aged child and
      // the candidate ids the client would send; the others post as before.
      body: JSON.stringify({
        message: String(input.message ?? ""),
        childProfile: input.childProfile && typeof input.childProfile === "object" ? input.childProfile : SYNTHETIC_PROFILE,
        language: locale,
        ...(Array.isArray(input.milestoneCandidateIds) ? { milestoneCandidateIds: input.milestoneCandidateIds } : {}),
      }),
    });
    return `HTTP ${res.status}\n${await res.text()}`;
  }

  // EVAL-5: scenarios that declare parent-approved memory get it seeded via
  // the real propose→approve seam before the coach call.
  if (Array.isArray(input.approvedMemoryFacts) && input.approvedMemoryFacts.length > 0) {
    await seedApprovedMemory(baseUrl, scenarioProfile.id, input.approvedMemoryFacts.map(String));
  }

  // Coach-seed suites: the message is the governed seed + the parent follow-up.
  let message = String(input.parentMessage ?? "");
  if (scenario.cardId) {
    const card = hardMomentCards.find((item) => item.id === scenario.cardId);
    if (!card) throw new Error(`scenario "${scenario.id}" references unknown card "${scenario.cardId}"`);
    // B-AI-14 (live fix): the ONE seeded message (src/eval/acceptance) — the
    // old inline call passed no age/now, so every seed was "" (fail-closed
    // age gate) and the route never saw the card. It throws on an empty seed.
    message = hardMomentEvalSeedMessage(card, locale, SYNTHETIC_PROFILE.name, String(input.followUp ?? ""));
  }
  if (!message) throw new Error(`scenario "${scenario.id}" has no parentMessage/followUp input`);

  if (route === "/api/voice") {
    const res = await fetch(`${baseUrl}/api/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        message, childProfile: scenarioProfile, language: locale,
        ...(Array.isArray(input.recentTurns) ? {
          recentTurns: input.recentTurns,
          contextChildId: input.contextChildId === "different-child" ? "different-child" : scenarioProfile.id,
        } : {}),
        ...(input.privateMode === true ? { privateMode: true } : {}),
        ...(typeof input.topicId === "string" ? { topicId: input.topicId } : {}),
        // B-LOOP-13 (voice_reply 1.8.0): the scenario's journal request (today's practice).
        ...(input.journal && typeof input.journal === "object" ? { journal: input.journal } : {}),
      }),
    });
    return sseTranscript(await res.text());
  }

  const attachmentData = input.documentKind && Array.isArray(input.sourceLines) ? await syntheticDocumentDataUrl(input, locale) : null;
  const res = await fetch(`${baseUrl}${route === "/api/council" ? route : "/api/chat"}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      childProfile: scenarioProfile,
      ...(attachmentData ? { childId: scenarioProfile.id, attachments: [{ id: "synthetic-document", childId: scenarioProfile.id, kind: input.documentKind === "photo" ? "photo" : "document", name: "synthetic-note", mimeType: attachmentData.slice(5, attachmentData.indexOf(";")), dataUrl: attachmentData }] } : {}),
      ...(Array.isArray(input.recentTurns) ? { recentTurns: input.recentTurns } : {}),
      language: locale,
      ...(input.privateMode === true ? { privateMode: true } : {}),
      ...(typeof input.topicId === "string" ? { topicId: input.topicId } : {}),
      // EVAL-5 (lens fidelity): the selected lens is load-bearing — pass it
      // through so the live answer is judged on APPLYING the method.
      ...(input.scholarLens ? { scholarLens: String(input.scholarLens) } : {}),
      // B-LOOP-13 (coach_chat 1.7.0): the scenario's journal request (today's practice).
      ...(input.journal && typeof input.journal === "object" ? { journal: input.journal } : {}),
    }),
  });
  const payload: any = await res.json();
  const contract = payload.contract ? `\n\nCONTRACT:\n${JSON.stringify(payload.contract, null, 2)}` : "";
  return `HTTP ${res.status}\n${String(payload.text ?? JSON.stringify(payload))}${contract}`;
};

// ── The pinned judge ─────────────────────────────────────────────────────────
const judgeSchemaFor = (suite: EvalSuite) => ({
  type: "OBJECT",
  required: ["scores", "safe", "pass", "rationale"],
  properties: {
    scores: {
      type: "OBJECT",
      required: Object.keys(suite.rubric?.dimensions ?? {}),
      properties: Object.fromEntries(
        Object.keys(suite.rubric?.dimensions ?? {}).map((dimension) => [dimension, { type: "NUMBER" }]),
      ),
    },
    safe: { type: "BOOLEAN" },
    pass: { type: "BOOLEAN" },
    rationale: { type: "STRING" },
  },
});

const buildJudgeCall = (suite: EvalSuite) => {
  // The suite chooses the judge explicitly; never silently substitute a model.
  if (suite.judgeModel?.startsWith("gemini-")) {
    const config = loadConfig();
    const judgeProvider = new VertexGeminiProvider({ ...config, modelProvider: "vertex", vertexModelHandoff: suite.judgeModel });
    return async (prompt: string): Promise<Omit<ScenarioVerdict, "id">> =>
      await judgeProvider.generateJson({ route: "handoff_structured", prompt, schema: judgeSchemaFor(suite), temperature: 0, promptVersion: "eval-judge" }) as Omit<ScenarioVerdict, "id">;
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return async (prompt: string): Promise<Omit<ScenarioVerdict, "id">> => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY as string,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: suite.judgeModel,
          max_tokens: 2048,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic judge call failed (${res.status}): ${await res.text()}`);
      const payload: any = await res.json();
      const text = (payload.content ?? []).map((part: any) => part?.text ?? "").join("");
      const jsonText = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      return JSON.parse(jsonText);
    };
  }
  // Default: the pinned judge on Claude-on-Vertex via the SAME ADC this repo
  // already uses — no new account, no new secret.
  const config = loadConfig();
  const judgeProvider = new ClaudeVertexProvider({ ...config, vertexModelHandoff: suite.judgeModel });
  return async (prompt: string): Promise<Omit<ScenarioVerdict, "id">> =>
    (await judgeProvider.generateJson({
      route: "handoff_structured",
      prompt,
      schema: judgeSchemaFor(suite),
      promptVersion: "eval-judge",
    })) as Omit<ScenarioVerdict, "id">;
};

// ── Entry points ─────────────────────────────────────────────────────────────
/**
 * B-LOOP-14 `--ids a,b,c`: keep the scenarios whose id is listed, or whose
 * `input.milestoneId` / `input.practiceId` is (so one catalogue id re-judges
 * its row and its practice in both languages). An id that matches nothing
 * throws — a typo never reads as a green subset.
 */
export const selectScenarios = (suite: EvalSuite, ids: readonly string[]): EvalScenario[] => {
  const wanted = new Set(ids.map((id) => id.trim()).filter(Boolean));
  const matches = (scenario: EvalScenario, id: string) =>
    scenario.id === id || scenario.input?.milestoneId === id || scenario.input?.practiceId === id;
  const unknown = [...wanted].filter((id) => !suite.scenarios.some((scenario) => matches(scenario, id)));
  if (unknown.length) throw new Error(`--ids: no scenario of "${suite.suite}" matches ${unknown.join(", ")}`);
  return suite.scenarios.filter((scenario) => [...wanted].some((id) => matches(scenario, id)));
};

/**
 * B-LOOP-14 — a static-content suite: no server, no route model. The suite
 * must be FRESH (its contentHashes equal the live source files), otherwise
 * the judge would grade text the app no longer prints.
 */
const runStaticSuite = async (suiteName: string, suite: EvalSuite, subset?: string[]) => {
  if (suite.contentHashes) {
    const changed = changedContentKeys(suite.contentHashes, REPO_ROOT);
    if (changed.length) {
      throw new Error(`suite "${suiteName}" is STALE against ${changed.join(", ")} — regenerate it (npm run eval:loop:build) before judging`);
    }
  }
  const result = await runSuiteWithDeps(suite, {
    runScenario: async (scenario) => { throw new Error(`static suite "${suiteName}": scenario "${scenario.id}" has no route to run`); },
    judge: buildJudgeCall(suite),
    resolvedRouteModel: "static-content",
    ...(subset ? { subset } : {}),
  });
  appendResultsRow(path.join(REPO_ROOT, "evals", `${suiteName}.results.jsonl`), result.row);
  return result;
};

export const runLiveSuite = async (suiteName: string, opts: { ids?: string[] } = {}) => {
  const suite = loadSuite(suiteName);
  let subset: string[] | undefined;
  if (opts.ids?.length) {
    suite.scenarios = selectScenarios(suite, opts.ids);
    subset = suite.scenarios.map((scenario) => scenario.id);
  }
  if (isStaticSuite(suite)) return runStaticSuite(suiteName, suite, subset);
  // The judge must see the exact synthetic profile supplied to the route;
  // otherwise a correctly restored child name appears to be hallucinated.
  suite.scenarios = suite.scenarios.map((scenario) => ({
    ...scenario,
    input: {
      ...judgeVisibleInput(scenario.input),
      suppliedChildProfile: syntheticProfileFor(suite, scenario),
      contextScope: scenario.input?.privateMode === true
        ? "Private turn: server excludes the supplied profile, stored memory and previous turns."
        : scenario.input?.contextChildId === "different-child"
          ? "Server excludes recentTurns because they are bound to another child; the supplied profile is allowed."
          : "Supplied profile and parent-approved memory are allowed; only same-child settled recentTurns are allowed.",
    },
  }));
  // Synthetic in-process fixtures only; startServer refuses production/Firestore.
  // IDs are derived by this runner, and no family store is ever queried or written.
  const fixtureFor = (childId: string) => suite.scenarios.find((scenario) => syntheticProfileFor(suite, scenario).id === childId)?.input;
  const fixtureLedger: CompanionLedgerSource = {
    load: async (_uid, childId) => ({ actionLoops: fixtureFor(childId)?.acceptedActionsFixture as unknown[] ?? [], insights: [] }),
    loadTopic: async (_uid, childId, topicId) => {
      const input = fixtureFor(childId);
      if (input?.topicReadFailure === true) throw new Error("Synthetic topic read unavailable");
      const raw = input?.familyTopicFixture;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
      const fixture = raw as Record<string, unknown>;
      return { ...fixture, id: topicId, childId: fixture.childId === "different-child" ? "different-child" : childId };
    },
  };
  const { config, baseUrl, server } = await startServer(undefined, fixtureLedger);
  try {
    const primaryRoute = modelRouteFor(routeOf(suite.scenarios[0] ?? {} as EvalScenario));
    const decision = routeDecisionFor(config, primaryRoute);
    const resolvedRouteModel = toAnthropicVertexModelId(decision.model);
    const result = await runSuiteWithDeps(suite, {
      runScenario: buildScenarioRunner(suite, baseUrl),
      judge: buildJudgeCall(suite),
      resolvedRouteModel,
      promptVersions: { ...Object.fromEntries(
        Object.entries(PROMPT_VERSIONS).map(([key, entry]) => [key, entry.version]),
      ), ...(suite.suite === "home-program-import" ? {
        home_program_import: PROGRAM_IMPORT_VERSION,
        home_program_import_sha256: createHash("sha256").update(PROGRAM_IMPORT_PROMPT).digest("hex"),
      } : {}) },
      ...(subset ? { subset } : {}),
    });
    appendResultsRow(path.join(REPO_ROOT, "evals", `${suiteName}.results.jsonl`), result.row);
    return result;
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
};

const isDirectRun = process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/eval-judge.mts") ?? false;
if (isDirectRun) {
  const suiteName = process.argv[2];
  if (!suiteName || suiteName.startsWith("--")) {
    console.error("Usage: npm run eval:judge -- <suite-name> [--ids a,b,c]   (e.g. coach-hardmoment-seed-v1)");
    process.exit(2);
  }
  // B-LOOP-14: `--ids a,b,c` (or `--ids=a,b,c`) judges a subset; the row says so.
  const idsAt = process.argv.findIndex((arg) => arg === "--ids" || arg.startsWith("--ids="));
  const idsArg = idsAt < 0 ? "" : process.argv[idsAt].startsWith("--ids=") ? process.argv[idsAt].slice(6) : process.argv[idsAt + 1] ?? "";
  if (idsAt >= 0 && !idsArg.trim()) {
    console.error("--ids needs a comma-separated list of scenario ids (or catalogue / practice ids)");
    process.exit(2);
  }
  const result = await runLiveSuite(suiteName, idsArg ? { ids: idsArg.split(",") } : {});
  console.log(
    `eval:judge [${suiteName}] passRate=${result.row.passRate.toFixed(2)} ` +
    `(${result.row.perScenario.length} scenario verdicts, judge=${result.row.judgeModel}, ` +
    `routeModel=${result.row.resolvedRouteModel}) — appended to evals/${suiteName}.results.jsonl`,
  );
  if (result.row.skippedDeterministic?.length) {
    console.log(`eval:judge [${suiteName}] skipped ${result.row.skippedDeterministic.length} deterministic scenario(s) — ${result.row.skippedReason}`);
  }
  if (!result.ok) {
    console.error("eval:judge FAILED:");
    for (const violation of result.violations) console.error(`- ${violation}`);
    process.exit(1);
  }
}
