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
 * Requires live model credentials — this is the LIVE half of the eval program;
 * the deterministic half runs in CI via `npm test` + `npm run check:acceptance`.
 */
import express from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { loadConfig } from "../src/config/env.js";
import { createModelProvider, routeDecisionFor, toAnthropicVertexModelId, type ModelRoute } from "../src/ai/modelRouter.js";
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
import { computeContentHash } from "../src/content/governance.js";
import { hardMomentCards, type HardMomentCard } from "../src/content/hardMomentCards.js";
import { buildHardMomentSeedPrompt } from "../src/content/hardMomentSurface.js";
import { appendResultsRow, runSuiteWithDeps, type ScenarioVerdict } from "../src/eval/judge.js";
import type { EvalScenario, EvalSuite } from "../src/eval/acceptance.js";

const REPO_ROOT = path.resolve(process.cwd(), "..");

/** SYNTHETIC child profile — never real child data (suite fixture rule). */
const SYNTHETIC_PROFILE = { id: "eval-synthetic-child", name: "Noa", age: 4, ageBand: "3-5 years" };

/** The approved-fixture stamp (test-only shape from content/selectCards.test.ts). */
const approveFixture = (card: HardMomentCard): HardMomentCard => ({
  ...card,
  reviewStatus: "approved",
  reviewedBy: "Dr. Noa Levi",
  reviewedAt: "2026-07-01",
  contentHash: computeContentHash(card),
});

const loadSuite = (name: string): EvalSuite => {
  const file = path.join(REPO_ROOT, "evals", `${name}.eval.json`);
  if (!fs.existsSync(file)) throw new Error(`Unknown suite "${name}" — expected ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as EvalSuite;
};

const routeOf = (scenario: EvalScenario): string => scenario.route ?? "/api/chat";

const modelRouteFor = (route: string): ModelRoute =>
  route === "/api/chat" ? "coach_high_stakes" : "analysis_structured";

// ── The real in-process server ───────────────────────────────────────────────
const startServer = async () => {
  const config = loadConfig();
  const modelProvider = createModelProvider(config);
  const entitlementStore = createEntitlementStore(config);
  const app = express();
  app.use(express.json());
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

  if (route === "/api/live/turn") {
    const text = String(input.text ?? input.outputTranscription ?? "");
    const res = await fetch(`${baseUrl}/api/live/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: input.role ?? "model", text, language: locale }),
    });
    return `HTTP ${res.status}\n${await res.text()}`;
  }

  // Coach-seed suites: the message is the governed seed + the parent follow-up.
  let message = String(input.parentMessage ?? "");
  if (scenario.cardId) {
    const card = hardMomentCards.find((item) => item.id === scenario.cardId);
    if (!card) throw new Error(`scenario "${scenario.id}" references unknown card "${scenario.cardId}"`);
    const seed = buildHardMomentSeedPrompt(approveFixture(card), locale, SYNTHETIC_PROFILE.name);
    message = `${seed}\n\nParent follow-up: ${String(input.followUp ?? "")}`;
  }
  if (!message) throw new Error(`scenario "${scenario.id}" has no parentMessage/followUp input`);

  if (route === "/api/voice") {
    const res = await fetch(`${baseUrl}/api/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ message, childProfile: SYNTHETIC_PROFILE, language: locale }),
    });
    return sseTranscript(await res.text());
  }

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, childProfile: SYNTHETIC_PROFILE, language: locale }),
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
export const runLiveSuite = async (suiteName: string) => {
  const suite = loadSuite(suiteName);
  const { config, baseUrl, server } = await startServer();
  try {
    const primaryRoute = modelRouteFor(routeOf(suite.scenarios[0] ?? {} as EvalScenario));
    const decision = routeDecisionFor(config, primaryRoute);
    const resolvedRouteModel = toAnthropicVertexModelId(decision.model);
    const result = await runSuiteWithDeps(suite, {
      runScenario: buildScenarioRunner(suite, baseUrl),
      judge: buildJudgeCall(suite),
      resolvedRouteModel,
      promptVersions: Object.fromEntries(
        Object.entries(PROMPT_VERSIONS).map(([key, entry]) => [key, entry.version]),
      ),
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
  if (!suiteName) {
    console.error("Usage: npm run eval:judge -- <suite-name>   (e.g. coach-hardmoment-seed-v1)");
    process.exit(2);
  }
  const result = await runLiveSuite(suiteName);
  console.log(
    `eval:judge [${suiteName}] passRate=${result.row.passRate.toFixed(2)} ` +
    `(${result.row.perScenario.length} scenario verdicts, judge=${result.row.judgeModel}, ` +
    `routeModel=${result.row.resolvedRouteModel}) — appended to evals/${suiteName}.results.jsonl`,
  );
  if (!result.ok) {
    console.error("eval:judge FAILED:");
    for (const violation of result.violations) console.error(`- ${violation}`);
    process.exit(1);
  }
}
