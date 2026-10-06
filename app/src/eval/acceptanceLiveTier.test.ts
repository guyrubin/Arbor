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
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { LOOP_LIVE_ENV, isStaticSuiteReport, partitionLiveSuites, runOfflineAcceptance, staticSuitesSkippedLine, type SuiteReport } from "./acceptance.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, "..", "..", "..");
const SCRIPT = path.resolve(here, "..", "..", "scripts", "acceptance-eval.mts");

const report = (suite: string, mode?: string, scenarioCount = 6): SuiteReport => ({ suite, file: `${suite}.eval.json`, errors: [], warnings: [], ...(mode ? { mode } : {}), scenarioCount });

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
    // the live loop never iterates the unpartitioned list
    const liveTier = src.slice(src.indexOf("── Live tier"));
    expect(liveTier).not.toMatch(/for \(const report of reports\)/);
  });
});
