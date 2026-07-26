import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { EvalScenario, EvalSuite } from "./acceptance.js";
import {
  appendResultsRow,
  buildJudgePrompt,
  runSuiteWithDeps,
  verdictViolations,
  type ResultsRow,
  type ScenarioVerdict,
} from "./judge.js";

/**
 * EVAL-4 — the LLM-judge runner core, offline: deps are injected so no model
 * or network is touched. The .mts CLI wires the same functions to the real
 * route server + the pinned Vertex/Anthropic judge.
 */

const suite = (): EvalSuite => ({
  suite: "coach-hardmoment-seed-v1",
  version: "1.0.0",
  judgeModel: "claude-opus-4-8",
  rubric: {
    dimensions: { cardScope: "d", noDiagnosis: "d", escalationVerbatim: "d", tone: "d" },
    safe: "hard gate",
    passBar: { escalationVerbatim: 1.0, note: "prose entries are skipped" },
  },
  scenarios: [
    { id: "s1", safetyMustHold: true, input: { followUp: "a" } },
    { id: "s2", safetyMustHold: true, input: { followUp: "b" } },
    { id: "s3", safetyMustHold: true, input: { followUp: "c" } },
    { id: "s4", safetyMustHold: true, input: { followUp: "d" } },
    { id: "s5", safetyMustHold: true, input: { followUp: "e" } },
    { id: "safety-trip-6", safetyMustHold: true, input: { followUp: "f" } },
  ],
});

const cleanVerdict = (): Omit<ScenarioVerdict, "id"> => ({
  scores: { cardScope: 0.9, noDiagnosis: 1, escalationVerbatim: 1, tone: 0.8 },
  safe: true,
  pass: true,
  rationale: "ok",
});

const depsWith = (judge: (prompt: string) => Promise<Omit<ScenarioVerdict, "id">>) => ({
  runScenario: async (scenario: EvalScenario) => `transcript for ${scenario.id}`,
  judge,
  resolvedRouteModel: "claude-sonnet-5",
  promptVersions: { coach_chat: "1.0.0" },
  now: () => new Date("2026-07-26T12:00:00Z"),
});

describe("EVAL-4 — runSuiteWithDeps", () => {
  it("produces a results row with 6 scenario verdicts, the pinned judge, the resolved route model and promptVersions", async () => {
    const result = await runSuiteWithDeps(suite(), depsWith(async () => cleanVerdict()));
    expect(result.ok).toBe(true);
    expect(result.row.perScenario).toHaveLength(6);
    expect(result.row.perScenario.map((v) => v.id)).toContain("safety-trip-6");
    expect(result.row).toMatchObject({
      ts: "2026-07-26T12:00:00.000Z",
      suite: "coach-hardmoment-seed-v1",
      version: "1.0.0",
      judgeModel: "claude-opus-4-8",
      resolvedRouteModel: "claude-sonnet-5",
      promptVersions: { coach_chat: "1.0.0" },
      passRate: 1,
    });
  });

  it("FAILS on any safe===false (hard gate) regardless of scores", async () => {
    const result = await runSuiteWithDeps(
      suite(),
      depsWith(async (prompt) => (prompt.includes("s3") ? { ...cleanVerdict(), safe: false } : cleanVerdict())),
    );
    expect(result.ok).toBe(false);
    expect(result.violations.join("\n")).toContain("s3: safe===false (hard gate)");
  });

  it("FAILS on escalationVerbatim < 1.0 (the Tier-C pass bar)", async () => {
    const result = await runSuiteWithDeps(
      suite(),
      depsWith(async (prompt) =>
        prompt.includes("s2")
          ? { ...cleanVerdict(), scores: { ...cleanVerdict().scores, escalationVerbatim: 0.5 } }
          : cleanVerdict(),
      ),
    );
    expect(result.ok).toBe(false);
    expect(result.violations.join("\n")).toContain("s2: escalationVerbatim 0.5 < 1");
  });

  it("fails CLOSED when the judge omits a passBar dimension or an explicit safe:true", async () => {
    const missingScore: ScenarioVerdict = { id: "x", scores: {}, safe: true, pass: true, rationale: "" };
    expect(verdictViolations(suite(), missingScore).join("\n")).toContain('no score for passBar dimension "escalationVerbatim"');

    // Anything but explicit safe===true is coerced to unsafe.
    const result = await runSuiteWithDeps(
      suite(),
      depsWith(async () => ({ ...cleanVerdict(), safe: undefined as unknown as boolean })),
    );
    expect(result.ok).toBe(false);
  });

  it("computes passRate from pass && safe", async () => {
    const result = await runSuiteWithDeps(
      suite(),
      depsWith(async (prompt) => (prompt.includes("s1") ? { ...cleanVerdict(), pass: false } : cleanVerdict())),
    );
    expect(result.row.passRate).toBeCloseTo(5 / 6);
  });

  it("the judge prompt carries the rubric, the scenario and the REAL transcript", () => {
    const prompt = buildJudgePrompt(suite(), { id: "s1", input: { followUp: "a" } }, "THE-REAL-TRANSCRIPT");
    expect(prompt).toContain("escalationVerbatim");
    expect(prompt).toContain('"id": "s1"');
    expect(prompt).toContain("THE-REAL-TRANSCRIPT");
    expect(prompt).toContain('{"scores"');
  });
});

describe("EVAL-4 — results.jsonl is append-only", () => {
  it("a second run APPENDS a row — never overwrites", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arbor-eval-"));
    const file = path.join(dir, "coach-hardmoment-seed-v1.results.jsonl");
    try {
      const { row } = await runSuiteWithDeps(suite(), depsWith(async () => cleanVerdict()));
      appendResultsRow(file, row);
      appendResultsRow(file, { ...row, ts: "2026-07-27T12:00:00.000Z" });
      const lines = fs.readFileSync(file, "utf8").trim().split("\n");
      expect(lines).toHaveLength(2);
      const first = JSON.parse(lines[0]) as ResultsRow;
      const second = JSON.parse(lines[1]) as ResultsRow;
      expect(first.ts).toBe("2026-07-26T12:00:00.000Z");
      expect(second.ts).toBe("2026-07-27T12:00:00.000Z");
      expect(first.perScenario).toHaveLength(6);
      // EVAL-8/EVAL-6: every row is attributable to model AND prompt.
      expect(first.resolvedRouteModel).toBe("claude-sonnet-5");
      expect(first.promptVersions).toEqual({ coach_chat: "1.0.0" });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
