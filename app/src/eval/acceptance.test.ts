import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { createTestConfig } from "../testConfig.js";
import { PROMPT_VERSIONS } from "../ai/prompts.js";
import {
  deterministicGateErrors,
  hardMomentSeedContractErrors,
  isSafetyTripScenario,
  modelPinDriftErrors,
  modelPinExpectations,
  offlineGateFiles,
  runOfflineAcceptance,
  stalePromptWarnings,
  validateSuite,
  type EvalSuite,
  type PinnedModels,
} from "./acceptance.js";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

const loadHardMomentSuite = (): EvalSuite =>
  JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "evals", "coach-hardmoment-seed-v1.eval.json"), "utf8")) as EvalSuite;

/** A minimal WELL-FORMED suite (the shape check:acceptance enforces). */
const wellFormedSuite = (): EvalSuite => ({
  suite: "test-suite-v1",
  version: "1.0.0",
  judgeModel: "claude-opus-4-8",
  runner: { offlineGate: "app/src/routes/voiceLoopEval.test.ts is the gate for test-suite-v1.eval.json" },
  rubric: {
    dimensions: { tone: "calm", noDiagnosis: "hard" },
    safe: "Hard boolean gate per the Arbor safety policy.",
    passBar: { noDiagnosis: 1.0 },
  },
  scenarios: [
    { id: "happy-1", safetyMustHold: true },
    { id: "happy-2", safetyMustHold: true },
    { id: "happy-3", safetyMustHold: true },
    { id: "happy-4", safetyMustHold: true },
    { id: "safety-trip-1", safetyMustHold: true },
  ],
});

// ── EVAL-1 acceptance (1): a deliberately malformed suite fails ─────────────
describe("EVAL-1 — suite schema validation", () => {
  it("a well-formed suite validates clean", () => {
    expect(validateSuite(wellFormedSuite(), ["claude-opus-4-8"])).toEqual([]);
  });

  it("an UNPINNED judge fails (latest / no digits / not in the pinned list)", () => {
    const latest = { ...wellFormedSuite(), judgeModel: "claude-opus-latest" };
    expect(validateSuite(latest).join("\n")).toContain('not pinned (contains "latest")');

    const bare = { ...wellFormedSuite(), judgeModel: "claude-opus" };
    expect(validateSuite(bare).join("\n")).toContain("no version digits");

    const unlisted = wellFormedSuite();
    expect(validateSuite(unlisted, ["some-other-judge-1"]).join("\n")).toContain(
      "not listed in evals/pinned-models.json judgeModels",
    );
  });

  it("a suite with NO safety-trip scenario fails", () => {
    const suite = wellFormedSuite();
    suite.scenarios = suite.scenarios.map((s, i) => ({ id: `benign-${i}`, safetyMustHold: true }));
    expect(validateSuite(suite).join("\n")).toContain("no safety-trip scenario");
  });

  it("fewer than 5 scenarios fails; a scenario without the hard safety gate fails", () => {
    const small = wellFormedSuite();
    small.scenarios = small.scenarios.slice(0, 3);
    expect(validateSuite(small).join("\n")).toContain("a suite needs >= 5");

    const soft = wellFormedSuite();
    soft.scenarios[0] = { id: "happy-1" }; // safetyMustHold missing
    expect(validateSuite(soft).join("\n")).toContain("does not carry safetyMustHold: true");
  });

  it("non-semver version and duplicate scenario ids fail", () => {
    const bad = { ...wellFormedSuite(), version: "v1" };
    expect(validateSuite(bad).join("\n")).toContain("is not semver");

    const dupes = wellFormedSuite();
    dupes.scenarios[1] = { id: "happy-1", safetyMustHold: true };
    expect(validateSuite(dupes).join("\n")).toContain('duplicate scenario id "happy-1"');
  });

  it("recognizes BOTH safety-trip conventions (id prefix and SAFETY-TRIP marker)", () => {
    expect(isSafetyTripScenario({ id: "safety-trip-parent-anger" })).toBe(true);
    expect(isSafetyTripScenario({ id: "voice-diagnosis-bait", expected_behavior: "SAFETY-TRIP: flags the draft" })).toBe(true);
    expect(isSafetyTripScenario({ id: "happy-path", expected_behavior: "streams clean" })).toBe(false);
  });
});

// ── EVAL-1 (2): deterministic contract assertions ───────────────────────────
describe("EVAL-1 — deterministic gate linkage", () => {
  it("extracts gate file paths from the runner block", () => {
    expect(offlineGateFiles(wellFormedSuite())).toEqual(["app/src/routes/voiceLoopEval.test.ts"]);
  });

  it("a dead offline-gate pointer fails", () => {
    const suite = wellFormedSuite();
    suite.runner = { offlineGate: "app/src/routes/thisFileDoesNotExist.test.ts" };
    expect(deterministicGateErrors(suite, REPO_ROOT).join("\n")).toContain("offline gate file missing");
  });

  it("a suite with NO declared gate fails (the deterministic tier must be pinned)", () => {
    const suite = wellFormedSuite();
    suite.runner = {};
    expect(deterministicGateErrors(suite, REPO_ROOT).join("\n")).toContain("declares no offline gate");
  });

  it("the coach-hardmoment seed contract holds on the real suite (escalation byte-identical)", () => {
    const suite = loadHardMomentSuite();
    expect(hardMomentSeedContractErrors(suite)).toEqual([]);
  });

  it("a scenario pointing at an unknown card fails the seed contract", () => {
    const suite = loadHardMomentSuite();
    const broken = { ...suite, scenarios: [{ ...suite.scenarios[0], cardId: "no-such-card" }] };
    expect(hardMomentSeedContractErrors(broken).join("\n")).toContain('unknown card "no-such-card"');
  });
});

// ── EVAL-8: model pin drift ─────────────────────────────────────────────────
describe("EVAL-8 — pinned-models drift check", () => {
  const config = createTestConfig({ vertexModelAnalysis: "gemini-2.5-flash" });
  const pinnedFor = (cfg = config): PinnedModels => ({
    routes: Object.fromEntries(
      Object.entries(modelPinExpectations(cfg)).map(([route, pin]) => [route, { provider: "x", ...pin }]),
    ),
  });

  it("matching pins pass", () => {
    expect(modelPinDriftErrors(pinnedFor(), config)).toEqual([]);
  });

  it("bumping VERTEX_MODEL_ANALYSIS without refreshing pinned-models.json fails", () => {
    const bumped = createTestConfig({ vertexModelAnalysis: "gemini-3.0-flash" });
    const errors = modelPinDriftErrors(pinnedFor(), bumped);
    expect(errors.join("\n")).toContain("model changed: re-run suites");
    expect(errors.join("\n")).toContain("analysis_structured");
  });

  it("a missing route pin fails", () => {
    const pinned = pinnedFor();
    delete pinned.routes.coach_high_stakes;
    expect(modelPinDriftErrors(pinned, config).join("\n")).toContain('route "coach_high_stakes" has no pin');
  });

  it("the coach pin expectation resolves the alias to the bare publisher id", () => {
    expect(modelPinExpectations(config).coach_high_stakes).toEqual({
      alias: "claude-sonnet-5@anthropic",
      resolved: "claude-sonnet-5",
    });
  });
});

// ── EVAL-6: stale-suite warnings ────────────────────────────────────────────
describe("EVAL-6 — stale-suite prompt-version warnings", () => {
  it("a suite validated on the LIVE prompt versions warns nothing", () => {
    const suite = wellFormedSuite();
    suite.promptVersions = { coach_chat: PROMPT_VERSIONS.coach_chat.version };
    expect(stalePromptWarnings(suite)).toEqual([]);
  });

  it("a suite validated on an OLD prompt version gets a STALE warning (never a hard fail)", () => {
    const suite = wellFormedSuite();
    suite.promptVersions = { coach_chat: "0.0.1" };
    const warnings = stalePromptWarnings(suite);
    expect(warnings.join("\n")).toContain("STALE");
    expect(warnings.join("\n")).toContain("re-run the suite");
  });

  it("an unknown prompt key is surfaced", () => {
    const suite = wellFormedSuite();
    suite.promptVersions = { nonexistent_prompt: "1.0.0" } as any;
    expect(stalePromptWarnings(suite).join("\n")).toContain('unknown prompt key "nonexistent_prompt"');
  });
});

// ── The real repo passes its own gate ───────────────────────────────────────
describe("check:acceptance — the shipped evals/ tree is green", () => {
  it("every authored suite passes schema + deterministic checks and pins are drift-free", () => {
    const { reports, globalErrors } = runOfflineAcceptance(REPO_ROOT);
    expect(globalErrors).toEqual([]);
    expect(reports.length).toBeGreaterThanOrEqual(3);
    for (const report of reports) {
      expect(report.errors, `${report.suite}: ${report.errors.join("; ")}`).toEqual([]);
      expect(report.warnings, `${report.suite}: ${report.warnings.join("; ")}`).toEqual([]);
    }
  });
});
