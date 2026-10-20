// AR-REL-1: the sweep law decides the sweep's exit code; an injected overflow must exit non-zero.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SWEEP_LAW_EXIT, sweepLawFailures } from "./capture/sweep-law.mjs";
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
    return spawnSync(process.execPath, [path.join(scripts, "capture", "sweep-law.mjs"), file], { encoding: "utf8" });
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
