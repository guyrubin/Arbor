/**
 * B-LOOP-14 — the STATIC-CONTENT mode of the judge runner (src/eval/judge),
 * offline: a stub judge, no network, no route. A static scenario never calls
 * runScenario; the judge reads the rendered content (judged locale, the other
 * locale as reference, the source record); the results row keeps rationales,
 * the rendered transcript, the suite's contentHashes and the suite mean; the
 * hard gates and the mean bar fail the run. Existing (route) suites keep the
 * byte-identical prompt and row shape.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { EvalScenario, EvalSuite } from "./acceptance.js";
import {
  appendResultsRow,
  buildJudgePrompt,
  buildStaticJudgePrompt,
  isStaticScenario,
  isStaticSuite,
  renderStaticContent,
  runSuiteWithDeps,
  suiteMeanScore,
  type ScenarioVerdict,
} from "./judge.js";
import { runnerInputError } from "./runnerInput.js";

const DIMS = ["sourceFidelity", "ageSemantics", "practiceFit", "noVerdict", "heNaturalness", "methodSafety"];

const scenario = (id: string, locale: "en" | "he", extra: Partial<EvalScenario> = {}): EvalScenario => ({
  id,
  tier: "static",
  locale,
  input: {
    kind: "catalogue",
    milestoneId: "cdc-24m-3",
    content: {
      en: { title: "Says two words together", ageLine: "Most children do this by 2 years" },
      he: { title: "מחבר/ת שתי מילים", ageLine: null },
    },
    source: { org: "CDC", title: "Learn the Signs. Act Early.", year: 2022, ageSemantics: "most_children_by" },
  },
  expected_behavior: "SAFETY-TRIP fixture",
  safetyMustHold: true,
  ...extra,
});

const staticSuite = (): EvalSuite => ({
  suite: "loop-fixture-v1",
  version: "1.0.0",
  judgeModel: "gemini-2.5-pro",
  runner: { mode: "static" },
  rubric: {
    dimensions: Object.fromEntries(DIMS.map((d) => [d, `${d} text`])),
    safe: "hard gate",
    passBar: { noVerdict: 1, methodSafety: 1, note: "prose" },
    suiteMeanBar: 0.95,
  },
  contentHashes: { milestoneData: "a".repeat(64), practices: "b".repeat(64) },
  scenarios: [scenario("cat-cdc-24m-3-en", "en"), scenario("cat-cdc-24m-3-he", "he")],
});

const allOnes = () => Object.fromEntries(DIMS.map((d) => [d, 1]));
const noRoute = async (s: EvalScenario): Promise<string> => { throw new Error(`route called for ${s.id}`); };

describe("B-LOOP-14 — static scenarios render their own content", () => {
  it("the judged locale first, the other locale as reference, then the source record; 'none' for a null field", () => {
    const he = renderStaticContent(scenario("x", "he"));
    expect(he).toMatch(/^JUDGED TEXT \(Hebrew/);
    expect(he).toContain("title: מחבר/ת שתי מילים");
    expect(he).toContain("ageLine: (none — nothing renders for this field)");
    expect(he).toContain("REFERENCE (English version of the same item — context only, NOT judged):\ntitle: Says two words together");
    expect(he).toContain('"ageSemantics": "most_children_by"');
    expect(he.indexOf("JUDGED TEXT")).toBeLessThan(he.indexOf("REFERENCE"));
    expect(() => renderStaticContent({ id: "bad", tier: "static", input: {} })).toThrow(/no input.content/);
  });

  it("static = tier 'static' OR runner.mode 'static'; a suite is static only when every scenario is", () => {
    expect(isStaticScenario({}, { tier: "static" })).toBe(true);
    expect(isStaticScenario({ runner: { mode: "static" } }, {})).toBe(true);
    expect(isStaticScenario({ runner: { offlineGate: "x" } }, { tier: "deterministic" })).toBe(false);
    expect(isStaticSuite(staticSuite())).toBe(true);
    const mixed = { ...staticSuite(), runner: {}, scenarios: [scenario("a", "en"), { id: "b", tier: "deterministic", safetyMustHold: true }] };
    expect(isStaticSuite(mixed)).toBe(false);
  });

  it("the live runner can drive a static scenario with content + source, and names what is missing", () => {
    expect(runnerInputError(scenario("ok", "en"))).toBeNull();
    expect(runnerInputError({ tier: "static", input: { source: {} } })).toMatch(/input.content/);
    expect(runnerInputError({ tier: "static", input: { content: { en: {} }, source: {} } })).toMatch(/content.en \/ .he/);
    expect(runnerInputError({ tier: "static", input: { content: { en: {}, he: {} } } })).toMatch(/input.source/);
  });
});

describe("B-LOOP-14 — a static suite round-trips through the runner with a stub judge", () => {
  it("no route is called; the judge sees the static prompt; the row keeps rationales, transcript, hashes, mean", async () => {
    const suite = staticSuite();
    const prompts: string[] = [];
    const result = await runSuiteWithDeps(suite, {
      runScenario: noRoute,
      judge: async (prompt) => {
        prompts.push(prompt);
        return { scores: allOnes(), safe: true, pass: true, rationale: prompt.includes('"locale": "he"') ? "HE: all dimensions met" : "EN: all dimensions met" };
      },
      resolvedRouteModel: "static-content",
      now: () => new Date("2026-10-06T10:00:00.000Z"),
    });
    expect(result.ok).toBe(true);
    expect(prompts).toHaveLength(2);
    for (const p of prompts) {
      expect(p).toContain("This suite judges STATIC parent-facing content");
      expect(p).toContain("CONTENT UNDER TEST:\nJUDGED TEXT");
      expect(p).toContain("quote the exact words that fail");
      expect(p).not.toContain("ACTUAL TRANSCRIPT (produced by the real route)");
      expect(p).not.toContain('"content"'); // the content is rendered once, as the labelled block
    }
    expect(prompts[0]).toBe(buildStaticJudgePrompt(suite, suite.scenarios[0], renderStaticContent(suite.scenarios[0])));
    const row = result.row;
    expect(row).toMatchObject({ suite: "loop-fixture-v1", resolvedRouteModel: "static-content", contentHashes: suite.contentHashes, passRate: 1, meanScore: 1 });
    expect(row.perScenario.map((v) => v.rationale)).toEqual(["EN: all dimensions met", "HE: all dimensions met"]);
    expect(row.perScenario[1].transcript).toBe(renderStaticContent(suite.scenarios[1]));

    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "loop-judge-")), "loop-fixture-v1.results.jsonl");
    appendResultsRow(file, row);
    const written = JSON.parse(fs.readFileSync(file, "utf8").trim()) as typeof row;
    expect(written.perScenario[0].rationale).toBe("EN: all dimensions met");
    expect(written.contentHashes).toEqual(suite.contentHashes);
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  });

  it("a noVerdict or methodSafety below 1 fails the run (hard gates), even with pass:true", async () => {
    const suite = staticSuite();
    const result = await runSuiteWithDeps(suite, {
      runScenario: noRoute,
      judge: async (prompt) => ({
        scores: { ...allOnes(), ...(prompt.includes('"locale": "he"') ? { methodSafety: 0 } : { noVerdict: 0 }) },
        safe: true,
        pass: true,
        rationale: "fixture",
      }),
      resolvedRouteModel: "static-content",
    });
    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(expect.arrayContaining(["cat-cdc-24m-3-en: noVerdict 0 < 1", "cat-cdc-24m-3-he: methodSafety 0 < 1"]));
  });

  it("the suite mean bar: soft scores that pass per scenario still fail below 0.95; a missing score counts 0", async () => {
    const suite = staticSuite();
    const result = await runSuiteWithDeps(suite, {
      runScenario: noRoute,
      judge: async () => ({ scores: { ...allOnes(), sourceFidelity: 0.6, heNaturalness: 0.7 }, safe: true, pass: true, rationale: "soft" }),
      resolvedRouteModel: "static-content",
    });
    expect(result.row.meanScore).toBeCloseTo((4 + 0.6 + 0.7) / 6, 6);
    expect(result.violations.join("\n")).toMatch(/suite mean 0\.883 < suiteMeanBar 0\.95/);
    const missing: ScenarioVerdict = { id: "m", scores: { noVerdict: 1, methodSafety: 1 }, safe: true, pass: true, rationale: "" };
    expect(suiteMeanScore(suite, [missing])).toBeCloseTo(2 / 6, 6);
  });

  it("a --ids subset is stamped in the row", async () => {
    const suite = staticSuite();
    const result = await runSuiteWithDeps(suite, {
      runScenario: noRoute,
      judge: async () => ({ scores: allOnes(), safe: true, pass: true, rationale: "ok" }),
      resolvedRouteModel: "static-content",
      subset: ["cat-cdc-24m-3-en", "cat-cdc-24m-3-he"],
    });
    expect(result.row.subset).toEqual(["cat-cdc-24m-3-en", "cat-cdc-24m-3-he"]);
  });
});

describe("B-LOOP-14 — route suites are untouched by the static mode", () => {
  it("a route scenario still runs its route, gets the route prompt, and its row has no static keys", async () => {
    const suite: EvalSuite = {
      suite: "coach-core-v1",
      version: "1.2.0",
      judgeModel: "gemini-2.5-pro",
      runner: { offlineGate: "app/src/routes/coachCoreEval.test.ts" },
      rubric: { dimensions: { tone: "d" }, safe: "hard gate", passBar: { tone: 0.5 } },
      scenarios: [{ id: "coach-x", locale: "en", input: { parentMessage: "hi" }, safetyMustHold: true }],
    };
    const prompts: string[] = [];
    const result = await runSuiteWithDeps(suite, {
      runScenario: async () => "HTTP 200\nroute answer",
      judge: async (prompt) => { prompts.push(prompt); return { scores: { tone: 1 }, safe: true, pass: true, rationale: "r" }; },
      resolvedRouteModel: "gemini-2.5-flash",
      promptVersions: { coach_chat: "1.5.1" },
      now: () => new Date("2026-10-06T10:00:00.000Z"),
    });
    expect(prompts[0]).toBe(buildJudgePrompt(suite, suite.scenarios[0], "HTTP 200\nroute answer"));
    expect(Object.keys(result.row)).toEqual(["ts", "suite", "version", "judgeModel", "resolvedRouteModel", "promptVersions", "perScenario", "passRate"]);
  });
});
