/**
 * B-LOOP-14 (guard) — the loop judge in check:acceptance is OPT-IN.
 *
 * The live tier of scripts/acceptance-eval.mts runs whenever judge
 * credentials are present (ANTHROPIC_API_KEY / ARBOR_EVAL_LIVE=1 /
 * GOOGLE_APPLICATION_CREDENTIALS). Since B-LOOP-14 the generated static suite
 * milestone-loop-v1 (one judge call per scenario, 512) sits in evals/, so a
 * routine check:acceptance in a Vertex shell would have made 512 judge calls.
 * Static suites are now judged there only with EVAL_LOOP_LIVE=1; their offline
 * validation and content-staleness WARN keep running. No network: pure
 * partition + the script's source.
 */
import { describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import * as acceptance from "./acceptance.js";
import { LOOP_LIVE_ENV, isStaticSuiteReport, liveSuitePreflightErrors, partitionLiveSuites, runOfflineAcceptance, staticSuitesSkippedLine, type SuiteReport } from "./acceptance.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, "..", "..", "..");
const SCRIPT = path.resolve(here, "..", "..", "scripts", "acceptance-eval.mts");

const report = (suite: string, mode?: string, scenarioCount = 6, liveScenarioCount = scenarioCount): SuiteReport => ({ suite, file: `${suite}.eval.json`, errors: [], warnings: [], ...(mode ? { mode } : {}), scenarioCount, liveScenarioCount });

describe("B-LOOP-14 (guard) — static suites are opt-in in the live tier", () => {
  const reports = [report("coach-core-v1"), report("milestone-loop-v1", "static", 512), report("voice-loop-v1", "route")];

  it("without EVAL_LOOP_LIVE the static suite is skipped and every other suite stays live", () => {
    for (const env of [{}, { [LOOP_LIVE_ENV]: "0" }, { [LOOP_LIVE_ENV]: "true" }, { GOOGLE_APPLICATION_CREDENTIALS: "/adc.json", ARBOR_EVAL_LIVE: "1" }]) {
      const { live, skipped } = partitionLiveSuites(reports, env);
      expect(live.map((r) => r.suite), JSON.stringify(env)).toEqual(["coach-core-v1", "voice-loop-v1"]);
      expect(skipped.map((r) => r.suite), JSON.stringify(env)).toEqual(["milestone-loop-v1"]);
    }
  });

  it("EVAL_LOOP_LIVE=1 includes it (the explicit opt-in)", () => {
    const { live, skipped } = partitionLiveSuites(reports, { [LOOP_LIVE_ENV]: "1" });
    expect(live.map((r) => r.suite)).toEqual(["coach-core-v1", "milestone-loop-v1", "voice-loop-v1"]);
    expect(skipped).toEqual([]);
  });

  it("one line names the skipped suite, its judge-call count and how to run it; nothing when none is skipped", () => {
    const line = staticSuitesSkippedLine([report("milestone-loop-v1", "static", 512)]);
    expect(line).toContain("milestone-loop-v1");
    expect(line).toContain("512 judge calls");
    expect(line).toContain("npm run eval:loop");
    expect(line).toContain("EVAL_LOOP_LIVE=1");
    expect(line!.split("\n")).toHaveLength(1);
    expect(staticSuitesSkippedLine([])).toBeNull();
  });

  it("the shipped tree: milestone-loop-v1 is reported as static with its scenario count, and is the one suite skipped by default", () => {
    const { reports: shipped } = runOfflineAcceptance(REPO_ROOT);
    const loop = shipped.find((r) => r.suite === "milestone-loop-v1");
    expect(loop, "evals/milestone-loop-v1.eval.json is committed").toBeTruthy();
    expect(isStaticSuiteReport(loop!)).toBe(true);
    expect(loop!.scenarioCount).toBeGreaterThanOrEqual(500);
    const { skipped, live } = partitionLiveSuites(shipped, {});
    expect(skipped.map((r) => r.suite)).toContain("milestone-loop-v1");
    expect(live.length + skipped.length).toBe(shipped.length);
    for (const r of live) expect(isStaticSuiteReport(r), r.suite).toBe(false);
  });

  it("scripts/acceptance-eval.mts judges only the partitioned live list and prints the skip line (source pin)", () => {
    const src = fs.readFileSync(SCRIPT, "utf8");
    expect(src).toMatch(/partitionLiveSuites\(reports, process\.env\)/);
    expect(src).toMatch(/staticSuitesSkippedLine\(skipped\)/);
    expect(src).toMatch(/for \(const report of live\)/);
    expect(src.indexOf("liveSuitePreflightErrors(live)")).toBeLessThan(src.indexOf('await import("./eval-judge.mts")'));
    // the live loop never iterates the unpartitioned list
    const liveTier = src.slice(src.indexOf("── Live tier"));
    expect(liveTier).not.toMatch(/for \(const report of reports\)/);
  });
});

/** Execute the actual acceptance CLI control flow with a fail-closed module
 * boundary. CommonJS transpilation exposes its dynamic runner import to the
 * fake require; unknown modules fail instead of opening a network/credential
 * path. The synthetic runner marks provider construction and results append,
 * so the old incremental loop fails the pending-plan tests even if the empty
 * suite itself refuses later. This never imports the live runner. */
async function executeAcceptanceScript(reports: SuiteReport[], env: Record<string, string> = { ARBOR_EVAL_LIVE: "1" }) {
  const source = fs.readFileSync(SCRIPT, "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const providerConstruction = vi.fn(), resultsAppend = vi.fn();
  const runLiveSuite = vi.fn(async (suite: string) => {
    providerConstruction(suite); resultsAppend(suite);
    return { ok: true, row: { passRate: 1 }, violations: [] };
  });
  const loadRunner = vi.fn(() => ({ runLiveSuite }));
  const require = (name: string) => {
    if (name === "node:path") return path;
    if (name === "../src/eval/acceptance.js") return { ...acceptance, runOfflineAcceptance: () => ({ reports, globalErrors: [] }) };
    if (name === "./eval-judge.mts") return loadRunner();
    throw new Error(`Offline acceptance test forbids import: ${name}`);
  };
  const messages: string[] = [];
  const output = (...args: unknown[]) => messages.push(args.map(String).join(" "));
  const exited = Symbol("script exit"); let exitCode = 0;
  const process = { cwd: () => path.resolve(REPO_ROOT, "app"), env, exit: (code: number) => { exitCode = code; throw exited; } };
  const run = new Function("require", "exports", "process", "console", `return (async () => { ${code}\n })();`);
  try { await run(require, {}, process, { log: output, warn: output, error: output }); }
  catch (error) { if (error !== exited) throw error; }
  return { exitCode, messages: messages.join("\n"), loadRunner, runLiveSuite, providerConstruction, resultsAppend };
}

describe("B-AI-11 — preflight the entire requested live plan before spending", () => {
  const coach = report("coach-core-v1"), voice = report("voice-loop-v1", "route", 23, 8);
  const pending = report("companion-loop-v1", undefined, 8, 0);
  const staticLoop = report("milestone-loop-v1", "static", 512);

  it.each([0, 1, 2])("pending suite at index %i stops the actual aggregate before runner/provider/append", async index => {
    const reports = [coach, voice]; reports.splice(index, 0, pending); reports.push(staticLoop);
    const result = await executeAcceptanceScript(reports);
    expect(result.exitCode).toBe(1);
    expect(result.messages).toContain("companion-loop-v1: live implementation pending");
    expect(result.messages).toContain("Faithful live scenario orchestration is required");
    expect(result.messages).toContain("no suites were run");
    expect(result.messages).not.toContain("live judge passRate=");
    expect(result.messages).not.toContain("check:acceptance passed");
    expect(result.loadRunner).not.toHaveBeenCalled(); expect(result.runLiveSuite).not.toHaveBeenCalled();
    expect(result.providerConstruction).not.toHaveBeenCalled(); expect(result.resultsAppend).not.toHaveBeenCalled();
  });

  it("route and mixed voice suites still run; static work stays opt-in", async () => {
    const result = await executeAcceptanceScript([coach, staticLoop, voice]);
    expect(result.exitCode).toBe(0);
    expect(result.runLiveSuite.mock.calls.map(([suite]) => suite)).toEqual([coach.suite, voice.suite]);
    expect(result.providerConstruction).toHaveBeenCalledTimes(2); expect(result.resultsAppend).toHaveBeenCalledTimes(2);
    expect(result.messages).toContain("512 judge calls");
    const optedIn = await executeAcceptanceScript([coach, staticLoop, voice], { ARBOR_EVAL_LIVE: "1", EVAL_LOOP_LIVE: "1" });
    expect(optedIn.exitCode).toBe(0);
    expect(optedIn.runLiveSuite.mock.calls.map(([suite]) => suite)).toEqual([coach.suite, staticLoop.suite, voice.suite]);
    expect(optedIn.providerConstruction).toHaveBeenCalledTimes(3); expect(optedIn.resultsAppend).toHaveBeenCalledTimes(3);
  });

  it("static opt-in cannot bypass a pending companion implementation", async () => {
    const result = await executeAcceptanceScript([coach, staticLoop, voice, pending], { ARBOR_EVAL_LIVE: "1", EVAL_LOOP_LIVE: "1" });
    expect(result.exitCode).toBe(1); expect(result.loadRunner).not.toHaveBeenCalled();
    expect(result.providerConstruction).not.toHaveBeenCalled(); expect(result.resultsAppend).not.toHaveBeenCalled();
  });

  it("without a live-tier request or credentials the offline tier labels the missing live implementation", async () => {
    const result = await executeAcceptanceScript([coach, pending], {});
    expect(result.exitCode).toBe(0); expect(result.loadRunner).not.toHaveBeenCalled();
    expect(result.messages).toContain("PENDING [companion-loop-v1] live implementation");
    expect(result.messages).toContain("offline tier passed; live validation not performed");
    expect(result.messages).not.toContain("live judge passRate=");
  });

  it("derives pending status from the existing real tier selector, not a suite-name exception", () => {
    const { reports } = runOfflineAcceptance(REPO_ROOT);
    const companion = reports.find(r => r.suite === "companion-loop-v1")!;
    const mixedVoice = reports.find(r => r.suite === "voice-loop-v1")!;
    const loop = reports.find(r => r.suite === "milestone-loop-v1")!;
    expect(companion.liveScenarioCount).toBe(0); expect(mixedVoice.liveScenarioCount).toBe(8);
    expect(loop.liveScenarioCount).toBe(loop.scenarioCount);
    expect(liveSuitePreflightErrors(partitionLiveSuites(reports, {}).live)).toEqual([
      expect.stringContaining("companion-loop-v1: live implementation pending"),
    ]);
    expect(liveSuitePreflightErrors([{ ...companion, suite: "another-pending-suite" }])[0]).toContain("another-pending-suite");
    expect(liveSuitePreflightErrors([coach, mixedVoice, loop])).toEqual([]);
    for (const count of [NaN, -1, Infinity]) {
      expect(liveSuitePreflightErrors([{ ...coach, liveScenarioCount: count }])).toHaveLength(1);
    }
  });
});
