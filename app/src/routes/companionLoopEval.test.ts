/** B-AI-11: offline control/route proof, never a live-output quality score.
 * The canonical eight scenarios use the existing API, action-loop controls,
 * memory ledger, carry-over selector and deletion executor. Only IO and model
 * output are synthetic. No production collection, credential or provider.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createApiRouter } from "./api.js";
import { createTestConfig } from "../testConfig.js";
import { loadFramework } from "../services/framework.js";
import type { ModelProvider } from "../ai/modelRouter.js";
import { PROMPT_VERSIONS, promptFingerprint, type PromptKey } from "../ai/prompts.js";
import { type EvalSuite, type EvalScenario, validateSuite, deterministicGateErrors } from "../eval/acceptance.js";
import { liveJudgePlan, runSuiteWithDeps } from "../eval/judge.js";
import { runLiveSuite } from "../../scripts/eval-judge.mts";
import type { MemoryLedgerEvent, MemoryStore } from "../memory/types.js";
import { LocalShareStore } from "../sharing/shares.js";
import { LocalConsentStore } from "../sharing/consent.js";
import { createCounterStore } from "../server/quotaStore.js";
import { createEntitlementStore } from "../server/entitlements.js";
import { createReferralStore } from "../server/referral.js";
import { createConsultStore } from "../server/consultRequests.js";
import { createAdminMetricsStore } from "../server/adminMetrics.js";
import { createWaitlistStore } from "../server/waitlist.js";
import type { CompanionLedgerSource } from "../server/companionContext.js";
import { type ActionLoopEntry, type ActionOutcome, isObservationAction, completeObservation, activeActionFor, todayActionId } from "../actionLoop/model.js";
import { acceptTodayAction as persistAcceptedTodayAction } from "../actionLoop/accept.js";
import { MAX_CARRY_DAYS, selectCarryOverAction } from "../components/overview/carryOverAction.js";
import { CoachTryIt, tryItState } from "../components/coach/CoachAnswerCards.js";
import { DELETION_CLASS_ORDER, type DeletionOps } from "../server/accountDeletion.js";
import { screenForImmediateEscalation, renderEscalationMarkdown } from "../safety/escalation.js";

// The actual /account/delete handler and runAccountDeletion orchestration run.
// Only its external executors are injected; Firebase/RevenueCat are never called.
const deletion = vi.hoisted(() => ({ ops: null as DeletionOps | null, factoryCalls: 0 }));
// Mutation/unknown-call floor: even removal of the live-tier preflight cannot
// construct a real provider or initialize Firebase credentials in this gate.
vi.mock("../ai/modelRouter.js", async original => ({
  ...await original<typeof import("../ai/modelRouter.js")>(),
  createModelProvider: () => { throw new Error("Offline gate forbids provider construction"); },
  VertexGeminiProvider: class { constructor() { throw new Error("Offline gate forbids Vertex construction"); } },
}));
vi.mock("../ai/claudeVertexProvider.js", () => ({
  ClaudeVertexProvider: class { constructor() { throw new Error("Offline gate forbids Claude construction"); } },
}));
vi.mock("firebase-admin/app", async original => ({
  ...await original<typeof import("firebase-admin/app")>(),
  initializeApp: () => { throw new Error("Offline gate forbids Firebase initialization"); },
  applicationDefault: () => { throw new Error("Offline gate forbids credentials"); },
}));
vi.mock("../server/accountDeletion.js", async original => ({
  ...await original<typeof import("../server/accountDeletion.js")>(),
  createFirestoreDeletionOps: () => {
    deletion.factoryCalls++;
    if (!deletion.ops) throw new Error("Synthetic deletion operations were not installed");
    return deletion.ops;
  },
}));

const ROOT = resolve(__dirname, "../../..");
type Scenario = EvalScenario & {
  input: Record<string, any>;
  routeCoverage: string[];
  requirements: Record<"evidence" | "consent" | "safety" | "lifetime", string>;
};
const suite = JSON.parse(readFileSync(resolve(ROOT, "evals/companion-loop-v1.eval.json"), "utf8")) as Omit<EvalSuite, "scenarios"> & {
  scenarios: Scenario[]; promptHashes: Record<string, string>; routeModelPins: Record<string, string>;
};
const pins = JSON.parse(readFileSync(resolve(ROOT, "evals/pinned-models.json"), "utf8"));
const NOW = new Date("2026-10-10T12:00:00.000Z");
const DAY = 86_400_000;
const UID = "synthetic-parent-a", OTHER_UID = "synthetic-parent-b";
const CHILD = "synthetic-child-a", SIBLING = "synthetic-child-b";
const PROFILE = { id: CHILD, name: "Noa", age: 4 };
const config = createTestConfig({ modelProvider: "mock" });
let server: Server, base: string;
let activeRoutes: Set<string>;
let recommendation = "Choose shoes together before bedtime.";
let unsafeReply: string | undefined;
let failExpiryWrite = false;
const owned = new Set<string>();
const memory: MemoryLedgerEvent[] = [];
const ledgers = new Map<string, ActionLoopEntry[]>();
const memoryReads = vi.fn();
const key = (uid = UID, childId = CHILD) => `${uid}:${childId}`;
const rows = (uid = UID, childId = CHILD) => {
  if (!ledgers.has(key(uid, childId))) ledgers.set(key(uid, childId), []);
  return ledgers.get(key(uid, childId))!;
};
const memoryStore: MemoryStore = {
  // Deliberately return all children: the real fold/selection must scope them.
  listEvents: async childId => { memoryReads(childId); return [...memory]; },
  appendEvent: async event => {
    if (failExpiryWrite && event.eventType === "expired") throw new Error("synthetic tombstone unavailable");
    memory.push(event);
  },
  eraseChild: async childId => {
    const before = memory.length;
    for (let i = memory.length - 1; i >= 0; i--) if (memory[i].childId === childId) memory.splice(i, 1);
    return before - memory.length;
  },
  ownsChild: async (uid, childId) => owned.has(key(uid, childId)),
};
const loadLedger = vi.fn(async (uid: string, childId: string) => ({ actionLoops: [...rows(uid, childId)], insights: [] }));
const ledgerSource: CompanionLedgerSource = { load: loadLedger };
type Request = { prompt: string; promptVersion?: string; route: string; schema?: { properties?: Record<string, unknown> } };
const modelRequests: Request[] = [];
const contract = () => ({
  text: unsafeReply ?? "Try one small step together tonight.", riskLevel: "Low", ageBand: "3-5", domains: ["social_emotional"],
  nonDiagnosticHypotheses: [], todayPlan: [recommendation], parentScript: "Let's choose together.",
  avoid: ["Long lectures."], observe: ["What happens next."], escalateIf: ["The pattern intensifies for two weeks."],
  frameRouting: { aim: "support", twoAxes: "connection", story: "a small step", shadow: "pause", marriage: "teamwork", shepherd: "guide" },
  memoryProposals: [], handoffNotes: { teacher: "", professional: "" }, sourceCardsUsed: [],
});
const provider = {
  async *generateJsonStream(request: Request) {
    if (request.route !== "coach_high_stakes" || request.promptVersion !== PROMPT_VERSIONS.coach_chat.version) throw new Error("Unexpected scripted chat call");
    modelRequests.push(request); yield JSON.stringify(contract());
  },
  async *streamText(request: Request) {
    if (request.route !== "analysis_structured" || request.promptVersion !== PROMPT_VERSIONS.voice_reply.version) throw new Error("Unexpected scripted voice call");
    modelRequests.push(request); yield unsafeReply ?? "Try a small step together tonight.";
  },
  async generateJson(request: Request) {
    // If the semantic classifier is enabled by CI, it is still synthetic.
    if (request.schema?.properties?.safe) return { safe: true, reason: "synthetic screen" };
    if (request.route !== "analysis_structured" || request.promptVersion !== PROMPT_VERSIONS.todays_focus.version || !request.schema?.properties?.tryToday) throw new Error("Unexpected scripted structured call");
    modelRequests.push(request);
    return { focus: "A quiet start together.", tryToday: "Offer a quiet hello before questions.", sayThis: "I am here with you." };
  },
} as unknown as ModelProvider;

beforeAll(async () => {
  const entitlements = createEntitlementStore(config);
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { (req as any).user = { uid: req.header("x-eval-owner") ?? UID }; next(); });
  app.use("/api", createApiRouter({
    config, modelProvider: provider, memoryStore, shareStore: new LocalShareStore(), consentStore: new LocalConsentStore(),
    framework: loadFramework(), entitlementStore: entitlements, referralStore: createReferralStore(config, entitlements),
    counters: createCounterStore(config), consultStore: createConsultStore(config), adminMetrics: createAdminMetricsStore(config),
    waitlistStore: createWaitlistStore(config), companionLedgerSource: ledgerSource,
  }));
  server = await new Promise<Server>(done => { const started = app.listen(0, "127.0.0.1", () => done(started)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done())); });
beforeEach(() => {
  // Freeze Date only: HTTP, route deadlines and asynchronous IO stay real.
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(NOW);
  config.memoryAdapter = "local";
  activeRoutes = new Set(); memory.length = 0; modelRequests.length = 0; ledgers.clear(); owned.clear();
  owned.add(key()); owned.add(key(UID, SIBLING));
  memoryReads.mockClear(); loadLedger.mockClear(); failExpiryWrite = false; unsafeReply = undefined;
  deletion.ops = null; deletion.factoryCalls = 0;
});
afterEach(() => { vi.useRealTimers(); config.memoryAdapter = "local"; });

async function request(route: string, body?: unknown, method = "POST", uid = UID) {
  activeRoutes.add(route.startsWith("/api/memory/") ? "/api/memory" : route);
  const res = await fetch(base + route, { method, headers: { "Content-Type": "application/json", "x-eval-owner": uid, Accept: "text/event-stream" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const raw = await res.text();
  const frames: { event: string; data: any }[] = [];
  if (res.headers.get("content-type")?.includes("text/event-stream")) {
    for (const block of raw.split("\n\n")) {
      const event = block.match(/^event: (.+)$/m)?.[1];
      const data = block.match(/^data: (.+)$/m)?.[1];
      if (event && data) frames.push({ event, data: JSON.parse(data) });
    }
  }
  const json = frames.length ? frames.find(f => f.event === "done")?.data : JSON.parse(raw);
  return { status: res.status, raw, json, frames };
}
const body = (message: string, extra: Record<string, unknown> = {}) => ({ message, childProfile: PROFILE, language: "en", contextChildId: CHILD, ...extra });
const prompt = () => modelRequests.at(-1)!.prompt;
async function turn(route: string, message: string, extra: Record<string, unknown> = {}, uid = UID) {
  const result = await request(route, body(message, extra), "POST", uid);
  expect(result.status).toBe(200);
  expect(result.frames.filter(f => f.event === "error"), result.raw).toEqual([]);
  return result;
}
async function propose(fact: string, status = "approved", childId = CHILD) {
  const result = await request(`/api/memory/${childId}/propose`, { fact, source: "synthetic-parent", retention: "3 months" });
  expect(result.status).toBe(200);
  const item = result.json.items.find((entry: { fact: string }) => entry.fact === fact);
  expect(item).toBeDefined();
  if (status !== "pending") expect((await request(`/api/memory/${item.memoryId}`, { status }, "PATCH")).status).toBe(200);
  return item.memoryId as string;
}
function seed(fact: string, status: MemoryLedgerEvent["status"] = "approved", childId = CHILD, createdAt = NOW.toISOString()) {
  memory.push({ eventId: fact, memoryId: fact, childId, familyId: UID, fact, status,
    eventType: status === "pending" ? "proposed" : status, source: "synthetic-parent", actor: "parent", retention: "3 months", createdAt });
}

// Execute the ACTUAL context write callbacks, as the existing lifecycle tests
// do. The fake collection only persists rows; it never reimplements acceptance
// or outcome logic. Source extraction fails loudly if either seam is renamed.
const contextSource = ts.createSourceFile("ArborContext.tsx", readFileSync(resolve(ROOT, "app/src/context/ArborContext.tsx"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function declaration(name: string) {
  let found = "";
  const visit = (node: ts.Node) => {
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => ts.isIdentifier(d.name) && d.name.text === name)) found = node.getText(contextSource);
    ts.forEachChild(node, visit);
  };
  visit(contextSource);
  if (!found) throw new Error(`Missing actual action control: ${name}`);
  return found;
}
function accountUserTreeExecutor(db: { doc(path: string): { path: string }; recursiveDelete(ref: { path: string }): Promise<void> }): DeletionOps["userTree"] {
  const source = ts.createSourceFile("accountDeletion.ts", readFileSync(resolve(ROOT, "app/src/server/accountDeletion.ts"), "utf8"), ts.ScriptTarget.Latest, true);
  let method = "";
  const visit = (node: ts.Node) => {
    if (ts.isMethodDeclaration(node) && node.name.getText(source) === "userTree") method = node.getText(source);
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!method) throw new Error("Missing production account userTree executor");
  const code = ts.transpileModule(`return ({ ${method} }).userTree;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function("db", code)(db);
}
function controls(childId = CHILD) {
  const actionLoop = rows(UID, childId);
  const upsert = vi.fn(async (row: ActionLoopEntry, _options?: unknown) => {
    const at = actionLoop.findIndex(item => item.id === row.id);
    if (at < 0) actionLoop.push(row); else actionLoop[at] = row;
  });
  const scope = { writer: upsert, sequence: 0 };
  const scopeRef = { current: scope };
  const env = { actionLoop, actionLoopCol: { upsert }, childProfile: { id: childId }, acceptScopeRef: scopeRef, acceptScope: scope,
    persistAcceptedTodayAction, isObservationAction, todayActionId, activeFamilyTopic: null, track: vi.fn(), todayOutcomeProps: vi.fn(), setPlanStepStatus: vi.fn(), planStepStatusAfter: vi.fn() };
  const code = ts.transpileModule(`${declaration("acceptTodayAction")}\n${declaration("saveTodayOutcome")}\nreturn { acceptTodayAction, saveTodayOutcome };`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const calls = new Function(...Object.keys(env), code)(...Object.values(env)) as {
    acceptTodayAction: (text: string, capacity: string, source: string, plan?: unknown, options?: { awaitServer: boolean; isCurrent?: () => boolean }) => Promise<void>;
    saveTodayOutcome: (id: string, outcome: ActionOutcome, via?: string, held?: unknown, options?: { awaitServer: boolean }) => Promise<void>;
  };
  return { ...calls, ...env, upsert, retire: () => { scopeRef.current = { writer: vi.fn(async (_row: ActionLoopEntry, _options?: unknown) => {}), sequence: 0 }; } };
}
const accept = (h: ReturnType<typeof controls>, step: string) => h.acceptTodayAction(step, "tiny", "coach", undefined, { awaitServer: true });
const outcome = (h: ReturnType<typeof controls>, id: string, value: ActionOutcome, via = "card") => h.saveTodayOutcome(id, value, via, undefined, { awaitServer: true });
function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const cases: Record<string, (sc: Scenario) => Promise<void>> = {
  "cold-start": async sc => {
    const answer = await turn("/api/chat", sc.input.parentMessage, { acceptedActions: [{ recommendation: "WIRE_ACTION_CANARY", status: "completed" }], approvedMemory: "WIRE_MEMORY_CANARY" });
    expect(answer.json.contract.todayPlan).toEqual([sc.input.recommendation]);
    expect(answer.json.contract.approvedMemoryFactsUsed).toBe(0);
    expect(prompt()).not.toMatch(/WIRE_ACTION_CANARY|WIRE_MEMORY_CANARY|STEPS THE PARENT CHOSE TO TRY/);
    expect(rows()).toEqual([]); expect(memory).toEqual([]);
    await turn("/api/voice", sc.input.parentMessage);
    expect(prompt()).toContain("NO PRIOR CONVERSATION OR APPROVED MEMORY IS AVAILABLE");
    expect(prompt()).toContain("ask one short clarifying question");
    expect(rows()).toEqual([]); expect(memory).toEqual([]);
  },
  "text-to-voice-continuity": async sc => {
    const memoryId = await propose(sc.input.approvedFact, "pending");
    const answer = await turn("/api/chat", "What could we try tonight?");
    expect(prompt()).not.toContain(sc.input.approvedFact);
    expect(rows()).toEqual([]);
    const h = controls(); await accept(h, answer.json.contract.todayPlan[0]);
    expect(rows()).toHaveLength(1); expect(rows()[0].outcome).toBeUndefined();
    await turn("/api/voice", sc.input.parentMessage, { recentTurns: [{ role: "coach", text: sc.input.recommendation }, { role: "parent", text: "Yes, we will try that." }] });
    expect(prompt()).toContain(sc.input.recommendation);
    expect(prompt()).toContain("no outcome reported yet");
    expect(prompt()).toContain("does not mean they have already done it");
    expect((await request(`/api/memory/${memoryId}`, { status: "approved" }, "PATCH")).status).toBe(200);
    await outcome(h, rows()[0].id, sc.input.outcome);
    await turn("/api/voice", "What should we try next?");
    expect(prompt()).toContain(sc.input.approvedFact);
    expect(prompt()).toContain("parent reported: not today");
    expect(prompt()).toContain('do not repeat a step reported "not today" as-is');
    await request("/api/todays-focus", { childProfile: PROFILE, signals: { count: 0, lastActionOutcome: "helped", lastActionRecommendation: "WIRE_SUCCESS_CANARY" } });
    expect(prompt()).toContain(sc.input.recommendation); expect(prompt()).toContain('reported the attempt as "not_today"');
    expect(prompt()).not.toContain("WIRE_SUCCESS_CANARY");
    memoryReads.mockClear(); loadLedger.mockClear();
    await turn("/api/voice", sc.input.parentMessage, { privateMode: true, recentTurns: [{ role: "coach", text: sc.input.recommendation }] });
    expect(prompt()).not.toContain(sc.input.recommendation); expect(prompt()).not.toContain(sc.input.approvedFact);
    expect(memoryReads).not.toHaveBeenCalled(); expect(loadLedger).not.toHaveBeenCalled();
  },
  "two-children": async sc => {
    seed(sc.input.siblingFact, "approved", SIBLING);
    await accept(controls(SIBLING), sc.input.siblingRecommendation);
    const h = controls(); await accept(h, sc.input.recommendation);
    await turn("/api/chat", sc.input.parentMessage);
    expect(prompt()).toContain(sc.input.recommendation); expect(prompt()).not.toMatch(/SIBLING_.*CANARY/);
    await turn("/api/voice", sc.input.parentMessage, { contextChildId: SIBLING, recentTurns: [{ role: "coach", text: sc.input.siblingTurn }] });
    expect(prompt()).toContain(sc.input.recommendation); expect(prompt()).not.toMatch(/SIBLING_.*CANARY/);
    expect(loadLedger.mock.calls.every(([uid, child]) => uid === UID && child === CHILD)).toBe(true);
    memoryReads.mockClear(); loadLedger.mockClear(); modelRequests.length = 0;
    const denied = await request("/api/chat", body(sc.input.parentMessage), "POST", OTHER_UID);
    expect(denied.status).toBe(403); expect(modelRequests).toHaveLength(0);
    await turn("/api/voice", sc.input.parentMessage, { recentTurns: [{ role: "coach", text: sc.input.recommendation }] }, OTHER_UID);
    expect(prompt()).not.toContain(sc.input.recommendation); expect(prompt()).not.toMatch(/SIBLING_.*CANARY/);
    expect(memoryReads).not.toHaveBeenCalled(); expect(loadLedger).not.toHaveBeenCalled();
    h.retire(); const before = h.upsert.mock.calls.length;
    await expect(accept(h, "STALE_ACCOUNT_ACTION_CANARY")).rejects.toThrow("no longer current");
    expect(h.upsert).toHaveBeenCalledTimes(before);
  },
  "expired-memory": async sc => {
    seed(sc.input.approvedFact); seed(sc.input.expiredFact, "approved", CHILD, new Date(NOW.getTime() - 91 * DAY).toISOString());
    seed(sc.input.pendingFact, "pending"); seed(sc.input.rejectedFact, "rejected");
    failExpiryWrite = true; // negative control: failed tombstone must not revive a fact
    for (const route of ["/api/chat", "/api/voice"]) {
      await turn(route, sc.input.parentMessage);
      expect(prompt()).toContain(sc.input.approvedFact);
      expect(prompt()).not.toMatch(/EXPIRED_MEMORY_CANARY|PENDING_MEMORY_CANARY|REJECTED_MEMORY_CANARY/);
    }
    expect(memory.some(event => event.fact === sc.input.expiredFact && event.status === "approved")).toBe(true);
    const review = await request(`/api/memory/${CHILD}`, undefined, "GET");
    expect(review.status).toBe(200); expect(review.raw).not.toContain(sc.input.expiredFact);
    expect(review.json.items.some((item: any) => item.fact === sc.input.approvedFact)).toBe(true);
    failExpiryWrite = false;
    await turn("/api/voice", sc.input.parentMessage);
    expect(memory.some(event => event.fact === sc.input.expiredFact && event.status === "expired")).toBe(true);
    expect(prompt()).not.toContain(sc.input.expiredFact);
  },
  crisis: async sc => {
    await accept(controls(), sc.input.recommendation);
    seed("CRISIS_MEMORY_CANARY a quiet hello helped.");
    const before = JSON.stringify({ rows: rows(), memory });
    for (const [language, message] of Object.entries(sc.input.parentMessages) as [string, string][]) {
      const match = screenForImmediateEscalation({ message }); expect(match).not.toBeNull();
      const resources = renderEscalationMarkdown(match!);
      const chat = await turn("/api/chat", message, { language });
      expect(chat.json.text).toBe(resources); expect(chat.json.contract).toBeUndefined();
      const voice = await turn("/api/voice", message, { language });
      expect(voice.json.resourcesMarkdown).toBe(resources); expect(voice.json.escalation).toBe(match!.category);
      expect(chat.raw + voice.raw).not.toMatch(/CRISIS_.*CANARY/);
    }
    expect(modelRequests).toHaveLength(0); expect(memoryReads).not.toHaveBeenCalled(); expect(loadLedger).not.toHaveBeenCalled();
    expect(JSON.stringify({ rows: rows(), memory })).toBe(before);
    // Separate negative control: a benign question with an unsafe scripted
    // model reply must be blocked before any diagnostic delta is visible.
    unsafeReply = sc.input.stubbedUnsafeReply;
    for (const route of ["/api/chat", "/api/voice"]) {
      const blocked = await turn(route, "What can I try at bedtime?");
      expect(blocked.json.outputBlocked).toBe(true);
      expect(blocked.raw).not.toContain(unsafeReply);
    }
    expect(JSON.stringify({ rows: rows(), memory })).toBe(before);
  },
  "duplicate-action": async sc => {
    const answer = await turn("/api/chat", sc.input.parentMessage);
    const step = answer.json.contract.todayPlan[0]; const h = controls();
    await accept(h, step); const first = { ...rows()[0] };
    expect(tryItState(step, activeActionFor(rows(), todayActionId(CHILD)))).toBe("accepted");
    const onTryIt = vi.fn(), onUndo = vi.fn();
    const html = renderToStaticMarkup(React.createElement(CoachTryIt, { step, today: first, lang: "en", onTryIt, onUndo }));
    expect(html).toContain('data-state="accepted"'); expect(html).toContain("Undo"); expect(onTryIt).not.toHaveBeenCalled();
    expect(rows()).toHaveLength(1);
    await accept(h, sc.input.replacement);
    expect(rows().find(row => row.id === first.id)?.status).toBe("superseded");
    const current = activeActionFor(rows(), todayActionId(CHILD))!;
    expect(current.recommendation).toBe(sc.input.replacement);
    await outcome(h, current.id, "helped");
    const completed = { ...rows().find(row => row.id === current.id)! };
    expect(tryItState(step, completed)).toBe("hidden");
    await accept(h, step); // a deliberate source-level re-accept preserves rated history
    expect(rows().find(row => row.id === completed.id)).toEqual(completed);
    expect(rows().filter(row => row.status === "accepted")).toHaveLength(1);
    await turn("/api/voice", sc.input.parentMessage);
    expect(prompt().split(step).length - 1).toBe(1); // superseded first row excluded
    expect(prompt()).toContain("parent reported: helped");
    // Hold the supersede write. Retirement must prevent the next entry write
    // and success event even though the already-issued write can settle.
    const pending = deferred(); h.upsert.mockImplementationOnce(() => pending.promise);
    const writesBefore = h.upsert.mock.calls.length, tracksBefore = h.track.mock.calls.length;
    const stale = accept(h, "LATE_ACTION_CANARY"); const rejected = expect(stale).rejects.toThrow("no longer current");
    h.retire(); pending.resolve(); await rejected;
    expect(h.upsert).toHaveBeenCalledTimes(writesBefore + 1); expect(h.track).toHaveBeenCalledTimes(tracksBefore);
    expect(rows().some(row => row.recommendation === "LATE_ACTION_CANARY")).toBe(false);
  },
  "overdue-follow-up": async sc => {
    expect(sc.input.carryDays).toBe(MAX_CARRY_DAYS);
    const h = controls(); vi.setSystemTime(new Date(NOW.getTime() - DAY)); await accept(h, sc.input.recommendation); vi.setSystemTime(NOW);
    const pending = { ...rows()[0] }; const today = todayActionId(CHILD);
    expect(selectCarryOverAction(rows(), today, NOW.getTime())?.id).toBe(pending.id);
    expect(selectCarryOverAction(rows(), today, NOW.getTime(), [pending.id])).toBeNull();
    expect(rows()[0]).toEqual(pending); // skip does not erase the history
    const boundary = Date.parse(pending.acceptedAt) + MAX_CARRY_DAYS * DAY;
    expect(selectCarryOverAction(rows(), today, boundary)?.id).toBe(pending.id);
    expect(selectCarryOverAction(rows(), today, boundary + 1)).toBeNull();
    for (const patch of [{ status: "completed" as const }, { status: "superseded" as const }, { acceptedAt: "invalid" }, { acceptedAt: new Date(NOW.getTime() + DAY).toISOString() }, { id: today }]) {
      expect(selectCarryOverAction([{ ...pending, ...patch }], today, NOW.getTime())).toBeNull();
    }
    await turn("/api/chat", sc.input.parentMessage); expect(prompt()).toContain("no outcome reported yet");
    await outcome(h, pending.id, sc.input.outcome, "carry");
    expect(selectCarryOverAction(rows(), today, NOW.getTime())).toBeNull();
    await turn("/api/voice", sc.input.parentMessage); expect(prompt()).toContain("parent reported: helped");
    expect(prompt()).toContain(sc.input.recommendation);
    // A failed persistence acknowledgement cannot emit outcome success telemetry.
    const tracksBefore = h.track.mock.calls.length; h.upsert.mockRejectedValueOnce(new Error("synthetic denied write"));
    await expect(outcome(h, pending.id, "not_today", "carry")).rejects.toThrow("denied write");
    expect(h.track).toHaveBeenCalledTimes(tracksBefore);
  },
  "account-delete-pending-follow-up": async sc => {
    const h = controls(); vi.setSystemTime(new Date(NOW.getTime() - DAY)); await accept(h, sc.input.recommendation); vi.setSystemTime(NOW);
    seed(sc.input.approvedFact);
    expect(selectCarryOverAction(rows(), todayActionId(CHILD), NOW.getTime())).not.toBeNull();
    await turn("/api/chat", sc.input.parentMessage); expect(prompt()).toContain(sc.input.recommendation);
    const order: string[] = []; let failTree = true;
    const ops = Object.fromEntries(DELETION_CLASS_ORDER.map(name => [name, async () => { order.push(name); return { deleted: 0 }; }])) as unknown as DeletionOps;
    // Run the production userTree executor against a minimal Firestore IO
    // double, so changing its recursive-delete path cannot leave this green.
    ops.userTree = accountUserTreeExecutor({
      doc: path => ({ path }),
      recursiveDelete: async ref => {
        order.push("userTree"); expect(ref.path).toBe(`users/${UID}`);
        if (failTree) throw new Error("synthetic child tree unavailable");
        for (const [scope, actions] of ledgers) if (scope.startsWith(`${UID}:`)) actions.splice(0);
      },
    });
    ops.childData = async () => ({ deleted: await memoryStore.eraseChild(CHILD) });
    ops.authUser = async uid => { order.push("authUser"); for (const owner of owned) if (owner.startsWith(`${uid}:`)) owned.delete(owner); };
    deletion.ops = ops;
    // Router initialized with local IO; only this branch selector changes.
    // The external factory is mocked above, so this cannot create Firebase IO.
    config.memoryAdapter = "firestore";
    const unconfirmed = await request("/api/account/delete", { confirm: "not confirmed" });
    expect(unconfirmed.status).toBe(400); expect(deletion.factoryCalls).toBe(0);
    const partial = await request("/api/account/delete", { confirm: "DELETE" });
    expect(partial.json.complete).toBe(false); expect(partial.json.authDeleted).toBe(false);
    expect(partial.json.classes.find((c: any) => c.class === "userTree")).toMatchObject({ failed: 1, deleted: 0 });
    expect(order.filter(name => name === "userTree")).toHaveLength(2); expect(order).not.toContain("authUser");
    expect(selectCarryOverAction(rows(), todayActionId(CHILD), NOW.getTime())).not.toBeNull();
    failTree = false; order.length = 0;
    const complete = await request("/api/account/delete", { confirm: "DELETE" });
    expect(complete.json.complete).toBe(true); expect(complete.json.authDeleted).toBe(true);
    expect(complete.json.classes.find((c: any) => c.class === "userTree").deleted).toBe(1);
    expect(order.at(-1)).toBe("authUser"); expect(rows()).toEqual([]); expect(memory).toEqual([]);
    expect(selectCarryOverAction(rows(), todayActionId(CHILD), NOW.getTime())).toBeNull();
    h.retire(); await expect(accept(h, "POST_DELETE_ACTION_CANARY")).rejects.toThrow("no longer current");
    memoryReads.mockClear(); loadLedger.mockClear();
    await turn("/api/voice", sc.input.parentMessage);
    expect(prompt()).not.toMatch(/DELETE_ACTION_CANARY|DELETE_MEMORY_CANARY|POST_DELETE_ACTION_CANARY/);
    expect(memoryReads).not.toHaveBeenCalled(); expect(loadLedger).not.toHaveBeenCalled();
    expect((await request("/api/chat", body(sc.input.parentMessage))).status).toBe(403);
  },
};

describe("companion-loop-v1 canonical deterministic route/control gate", () => {
  it("uses the existing eval schema and covers exactly the canonical eight scenario IDs", () => {
    expect(validateSuite(suite, pins.judgeModels, pins.deadJudgeModels)).toEqual([]);
    expect(deterministicGateErrors(suite, ROOT)).toEqual([]);
    expect(suite.scenarios).toHaveLength(8);
    expect(suite.scenarios.map(sc => sc.id).sort()).toEqual(Object.keys(cases).sort());
    for (const sc of suite.scenarios) {
      expect(sc.tier).toBe("deterministic"); expect(sc.safetyMustHold).toBe(true);
      expect(sc.expected_behavior!.length).toBeGreaterThan(80);
      for (const name of ["evidence", "consent", "safety", "lifetime"] as const) expect(sc.requirements[name].length).toBeGreaterThan(40);
      expect(sc.routeCoverage).toContain(sc.route);
    }
    // Non-vacuous metadata negatives: duplicated/missing safety cases fail the
    // existing validator rather than becoming a fabricated passed scenario.
    expect(validateSuite({ ...suite, scenarios: [...suite.scenarios, suite.scenarios[0]] }).some(error => /duplicate/.test(error))).toBe(true);
    expect(validateSuite({ ...suite, scenarios: suite.scenarios.filter(sc => sc.id !== "crisis") }).some(error => /safety-trip/.test(error))).toBe(true);
  });

  it("pins current template versions AND recomputed hashes without claiming live resolved model measurements", () => {
    const expectedKeys = ["coach_chat", "voice_reply", "todays_focus", "non_diagnostic_contract"].sort();
    expect(Object.keys(suite.promptHashes).sort()).toEqual(expectedKeys);
    expect(Object.keys(suite.promptVersions ?? {}).sort()).toEqual(expectedKeys);
    for (const [name, hash] of Object.entries(suite.promptHashes)) {
      const key = name as PromptKey;
      expect(suite.promptVersions?.[key]).toBe(PROMPT_VERSIONS[key].version);
      expect(hash).toBe(PROMPT_VERSIONS[key].sha256); expect(hash).toBe(promptFingerprint(key));
    }
    for (const [route, resolved] of Object.entries(suite.routeModelPins)) expect(resolved).toBe(pins.routes[route].resolved);
    expect(suite.runner?.validationStatus).toContain("LIVE NOT RUN");
  });

  it("refuses an empty live tier before route/provider work or a results append", async () => {
    const plan = liveJudgePlan(suite);
    expect(plan.judged).toEqual([]); expect(plan.skippedDeterministic).toHaveLength(8);
    const runScenario = vi.fn(), judge = vi.fn();
    await expect(runSuiteWithDeps(suite, { runScenario, judge, resolvedRouteModel: "mock-not-a-live-model" })).rejects.toThrow("no live-judgeable scenarios");
    expect(runScenario).not.toHaveBeenCalled(); expect(judge).not.toHaveBeenCalled();
    const resultFile = resolve(ROOT, "evals/companion-loop-v1.results.jsonl");
    const before = existsSync(resultFile) ? readFileSync(resultFile, "utf8") : null;
    await expect(runLiveSuite(suite.suite)).rejects.toThrow("no live-judgeable scenarios");
    expect(existsSync(resultFile) ? readFileSync(resultFile, "utf8") : null).toBe(before);
  });

  it("PR127 observations cannot become tried recommendations or effectiveness outcomes", async () => {
    const h = controls();
    const observation = await persistAcceptedTodayAction({
      childId: CHILD, items: rows(), upsert: h.upsert, source: "onboarding", capacity: "tiny", observation: true,
      recommendation: "OBSERVATION_QUESTION_CANARY what caught your eye?", now: NOW,
    });
    expect(isObservationAction(observation)).toBe(true);
    const writes = h.upsert.mock.calls.length;
    for (const value of ["helped", "somewhat", "not_today"] as const) {
      await expect(outcome(h, observation.id, value)).rejects.toThrow("Observations record a moment");
    }
    expect(h.upsert).toHaveBeenCalledTimes(writes); expect(h.track).not.toHaveBeenCalled();
    expect(rows()[0].outcome).toBeUndefined();
    for (const state of ["accepted", "completed"] as const) {
      if (state === "completed") await h.upsert(completeObservation(observation, "OBSERVATION_WORDS_CANARY noticed a leaf.", NOW));
      expect(rows()[0].status).toBe(state); expect(rows()[0].outcome).toBeUndefined();
      for (const route of ["/api/chat", "/api/voice"]) {
        await turn(route, "What were we going to try?");
        expect(prompt()).not.toMatch(/OBSERVATION_(?:QUESTION|WORDS)_CANARY|STEPS THE PARENT CHOSE TO TRY/);
      }
    }
  });

  for (const sc of suite.scenarios) it(`${sc.id}: ${sc.expected_behavior}`, async () => {
    recommendation = sc.input.recommendation ?? "Choose shoes together before bedtime.";
    expect(cases[sc.id], `No implementation for ${sc.id}`).toBeTypeOf("function");
    await cases[sc.id](sc);
    // Declared route coverage is backed by actual loopback requests, not by a
    // list of source filenames. Extra memory setup routes are intentional.
    for (const route of sc.routeCoverage) expect(activeRoutes.has(route), `${sc.id} did not exercise ${route}`).toBe(true);
    for (const req of modelRequests) {
      const key: PromptKey = req.route === "coach_high_stakes" ? "coach_chat" : req.schema?.properties?.tryToday ? "todays_focus" : "voice_reply";
      expect(req.promptVersion).toBe(suite.promptVersions?.[key]);
    }
  });
});
