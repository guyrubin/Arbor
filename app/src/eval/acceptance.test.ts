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

  it("B-PROV-02 — a judge listed dead fails even when it is also listed live", () => {
    const suite = wellFormedSuite();
    expect(validateSuite(suite, ["claude-opus-4-8"], ["claude-opus-4-8"]).join("\n")).toContain("listed dead");
    expect(validateSuite(suite, ["claude-opus-4-8"], ["some-other-judge-1"])).toEqual([]);
  });

  it("B-PROV-02 — the shipped tree: every suite's judge is live and none is dead", () => {
    const evalsDir = path.resolve(__dirname, "..", "..", "..", "evals");
    const pinned = JSON.parse(fs.readFileSync(path.join(evalsDir, "pinned-models.json"), "utf8")) as PinnedModels;
    expect(pinned.deadJudgeModels).toContain("claude-opus-4-8");
    expect(pinned.deadJudgeModels).toContain("gemini-2.5-pro"); // B-GA-27: retires on Vertex 20 Oct 2026
    expect(pinned.judgeModels).toContain("gemini-3.8-flash");
    const suites = fs.readdirSync(evalsDir).filter((f) => f.endsWith(".eval.json"));
    expect(suites.length).toBeGreaterThanOrEqual(6);
    for (const file of suites) {
      const suite = JSON.parse(fs.readFileSync(path.join(evalsDir, file), "utf8")) as EvalSuite & { judgeNote?: string };
      expect(pinned.judgeModels, file).toContain(suite.judgeModel);
      expect(pinned.deadJudgeModels, file).not.toContain(suite.judgeModel);
    }
    // The four the item named plus school-handoff-v1 carry the interim note.
    for (const name of ["coach-core-v1", "voice-loop-v1", "coach-hardmoment-seed-v1", "capture-extract-v1", "school-handoff-v1"]) {
      const suite = JSON.parse(fs.readFileSync(path.join(evalsDir, `${name}.eval.json`), "utf8")) as { judgeNote?: string };
      expect(suite.judgeNote, name).toMatch(/^interim — same-vendor judge, self-preference risk; replace with claude-opus-5-5 on Vertex eu when B-PROV-03 lands$/);
    }
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

// ── B-GA-27: production env pin and retired models ──────────────────────────
describe("B-GA-27 — cloudbuild.prod.yaml matches the production pin; no retired model is pinned", () => {
  const evalsDir = path.join(REPO_ROOT, "evals");
  const pinned = JSON.parse(fs.readFileSync(path.join(evalsDir, "pinned-models.json"), "utf8")) as PinnedModels & {
    production: Record<string, string>;
    retiredModels: Record<string, string>;
  };
  const prodYaml = fs.readFileSync(path.join(REPO_ROOT, "cloudbuild.prod.yaml"), "utf8");
  const prodEnv = (key: string): string | undefined => prodYaml.match(new RegExp(`\\|${key}=([^|\\s]+)`))?.[1];

  it("every production text-route value in pinned-models.json is what cloudbuild.prod.yaml deploys", () => {
    expect(Object.keys(pinned.production).sort()).toEqual(["VERTEX_LOCATION", "VERTEX_MODEL_CHAT"]);
    for (const [key, value] of Object.entries(pinned.production)) expect(prodEnv(key), key).toBe(value);
  });

  it("text never runs on the global endpoint in production (GA DoD 6)", () => {
    expect(prodEnv("VERTEX_LOCATION")).not.toBe("global");
  });

  it("no route pin, production value or judge names a retired model", () => {
    const retired = Object.keys(pinned.retiredModels);
    expect(retired).toEqual(expect.arrayContaining(["gemini-2.5-flash", "gemini-2.5-pro"]));
    const used = [
      ...Object.values(pinned.routes).flatMap((pin) => [pin.alias, pin.resolved]),
      ...Object.values(pinned.production),
      ...(pinned.judgeModels ?? []),
    ];
    for (const id of used) expect(retired, id).not.toContain(id);
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
