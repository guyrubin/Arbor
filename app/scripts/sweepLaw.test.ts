// AR-REL-1: the sweep law decides the sweep's exit code; an injected overflow must exit non-zero.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SWEEP_LAW_EXIT, expectedBaseCells, missingBaseCells, sweepLawFailures } from "./capture/sweep-law.mjs";
import { releaseMatrix, RELEASE_VIEWPORTS } from "./capture/release-config.mjs";

const scripts = path.dirname(fileURLToPath(import.meta.url));
const cell = (over: Record<string, unknown> = {}) => ({
  route: "overview", viewport: "375x812", lang: "en", mounted: true, consoleErrors: [],
  overflow: { scrollWidth: 375, clientWidth: 375 }, ...over,
});
const doc = (cells: unknown[]) => ({ completed: true, cells });

function runCli(body: unknown) {
  const dir = mkdtempSync(path.join(tmpdir(), "sweep-law-"));
  try {
    const file = path.join(dir, "sweep.json");
    writeFileSync(file, JSON.stringify(body));
    return spawnSync(process.execPath, [path.join(scripts, "capture", "sweep-law.mjs"), file], { encoding: "utf8", env: { ...process.env, GITHUB_ACTIONS: "" } });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("sweep law", () => {
  it("passes a clean sweep and fails each broken kind of cell", () => {
    expect(sweepLawFailures(doc([cell(), cell({ lang: "he" })]))).toEqual([]);
    const failures = sweepLawFailures(doc([
      cell({ route: "a", mounted: false }),
      cell({ route: "b", consoleErrors: ["TypeError: x"] }),
      cell({ route: "c", overflow: { scrollWidth: 412, clientWidth: 375 } }),
      cell({ route: "d", state: "open", reached: false, mounted: false, consoleErrors: ["ignored"] }),
      cell({ route: "e", state: "open", reached: true, overflow: { scrollWidth: 400, clientWidth: 375 } }),
    ]));
    expect(failures.map((f) => [f.cell, f.reasons])).toEqual([
      ["a 375x812 en", ["unmounted"]],
      ["b 375x812 en", ["console-error"]],
      ["c 375x812 en", ["overflow"]],
      ["e 375x812 en open", ["overflow"]],
    ]);
  });

  it("B-INF-11: fails a missing, unready or shotless base cell; an older sweep without the matrix is judged as before", () => {
    const vps = [{ w: 375, h: 812, lang: "en" }, { w: 375, h: 812, lang: "he" }];
    const expected = { cells: expectedBaseCells(["overview", "coach"], vps) };
    expect(expected.cells).toHaveLength(4);
    const three = [cell({ shot: "s.png" }), cell({ lang: "he", shot: "s.png" }), cell({ route: "coach", shot: "s.png" })];
    // The run died (or hit its deadline) before coach HE: that cell is missing, and the law says so.
    expect(sweepLawFailures({ completed: true, shots: true, expected, cells: three }).map((f) => [f.cell, f.reasons])).toEqual([["coach 375x812 he", ["missing"]]]);
    expect(missingBaseCells({ expected, cells: three })).toEqual([{ route: "coach", viewport: "375x812", lang: "he" }]);
    const full = [...three, cell({ route: "coach", lang: "he", shot: "s.png" })];
    expect(sweepLawFailures({ completed: true, shots: true, expected, cells: full })).toEqual([]);
    const broken = full.map((c, i) => (i === 0 ? { ...c, readyTimedOut: true } : i === 1 ? { ...c, shot: null } : c));
    expect(sweepLawFailures({ completed: true, shots: true, expected, cells: broken }).map((f) => [f.cell, f.reasons])).toEqual([
      ["overview 375x812 en", ["unready"]],
      ["overview 375x812 he", ["no-shot"]],
    ]);
    // --no-shots: no shot is expected; a pre-B-INF-11 sweep.json (no expected, no shots) keeps its verdict.
    expect(sweepLawFailures({ completed: true, shots: false, expected, cells: full.map((c) => ({ ...c, shot: null })) })).toEqual([]);
    expect(sweepLawFailures(doc([cell()]))).toEqual([]);
  });

  it("exits non-zero on an injected overflow, zero when clean, 1 when incomplete", () => {
    const clean = runCli(doc([cell()]));
    expect(clean.status).toBe(0);
    expect(clean.stdout).toContain("SWEEP-LAW PASS");
    const injected = runCli(doc([cell(), cell({ overflow: { scrollWidth: 999, clientWidth: 375 } })]));
    expect(injected.status).toBe(SWEEP_LAW_EXIT);
    expect(injected.stdout).toContain("SWEEP-LAW FAIL 1 cells");
    expect(runCli({ completed: false, cells: [] }).status).toBe(1);
  });

  it("is wired into the sweep, the release runner and the per-PR capture", () => {
    const sweep = readFileSync(path.join(scripts, "rendered-sweep.mjs"), "utf8");
    expect(sweep).toContain('from "./capture/sweep-law.mjs"');
    expect(sweep).toContain("if (!opts.reportOnly) process.exitCode = SWEEP_LAW_EXIT;");
    const runner = readFileSync(path.join(scripts, "capture", "run-release.mjs"), "utf8");
    expect(runner).toContain("{ lawExit: cell.group === 'base' }");
    expect(releaseMatrix("base-only")).toEqual(RELEASE_VIEWPORTS.map((v) => ({ viewport: v.id, group: "base", shard: 0 })));
    const workflow = readFileSync(path.join(scripts, "..", "..", ".github", "workflows", "arbor-capture.yml"), "utf8");
    expect(workflow).toContain("CAPTURE_SCOPE=base-only");
    expect(workflow).toContain("node app/scripts/capture/sweep-law.mjs");
  });
});
