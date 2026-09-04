/**
 * EVAL-1: the check:acceptance harness core — the enforcement seam every
 * CONDITIONS ruling in the 2026-07-25 AI-excellence slate cites.
 *
 * Pure, testable logic consumed by scripts/acceptance-eval.mts (the CI entry
 * point) and by acceptance.test.ts. Three layers:
 *
 *   1. SUITE SCHEMA VALIDATION — every evals/*.eval.json must carry a PINNED
 *      judgeModel (a dated/numbered id, never "latest"; listed in
 *      evals/pinned-models.json judgeModels), a semver version, a rubric with
 *      the hard-safe gate + a passBar, and >=5 scenarios including at least
 *      one safety-trip. This codifies the ad-hoc checks
 *      content/hardMomentSurfaces.test.ts:142-153 made for one suite, for ALL
 *      suites, forever.
 *
 *   2. DETERMINISTIC CONTRACT ASSERTIONS — each suite's declared offline gate
 *      test file(s) must exist and cover the suite's scenarios (either by
 *      reading the suite JSON dynamically or by naming every deterministic
 *      scenario id literally). For coach-hardmoment-seed-v1 the seed contract
 *      itself is re-asserted here (escalation byte-identical, scope +
 *      no-diagnosis instructions) so the script tier fails even if the vitest
 *      gate were deleted.
 *
 *   3. MODEL PIN DRIFT (EVAL-8) — evals/pinned-models.json must match the
 *      loadConfig() defaults per route; bumping a VERTEX_MODEL_* default
 *      without refreshing the pin file (and re-running the affected suites)
 *      fails with "model changed: re-run suites".
 *
 * Plus the EVAL-6 stale-suite WARNING: suites declare the promptVersions they
 * validated; a mismatch against the live PROMPT_VERSIONS registry is surfaced
 * as a WARN line (never a hard fail — prompts may ship ahead of a re-run, but
 * the drift must be visible in every CI log).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import type { ArborConfig } from "../config/env.js";
import { loadConfig } from "../config/env.js";
import { toAnthropicVertexModelId } from "../ai/modelRouter.js";
import { PROMPT_VERSIONS, type PromptKey } from "../ai/prompts.js";
import { computeContentHash } from "../content/governance.js";
import { hardMomentCards, type HardMomentCard } from "../content/hardMomentCards.js";
import { buildHardMomentSeedPrompt } from "../content/hardMomentSurface.js";
import { HARD_MOMENT_PILOT } from "../content/pilotRelease.js";

export type EvalScenario = {
  id: string;
  tier?: string;
  route?: string;
  locale?: string;
  cardId?: string;
  input?: Record<string, unknown>;
  expected_behavior?: string;
  safetyMustHold?: boolean;
};

export type EvalSuite = {
  suite: string;
  version: string;
  judgeModel: string;
  feature?: string;
  runner?: { offlineGate?: string; liveJudge?: string; [key: string]: unknown };
  rubric?: { dimensions?: Record<string, string>; safe?: string; passBar?: Record<string, unknown> };
  scenarios: EvalScenario[];
  promptVersions?: Partial<Record<PromptKey, string>>;
};

export type PinnedModels = {
  routes: Record<string, { provider: string; alias: string; resolved: string; gate?: string }>;
  legacy?: Record<string, string>;
  judgeModels?: string[];
  auxiliary?: string[];
};

const SEMVER = /^\d+\.\d+\.\d+$/;

/** A scenario counts as the mandatory safety-trip when its id or its expected
 *  behavior says so — both authored conventions in the existing suites. */
export const isSafetyTripScenario = (scenario: EvalScenario): boolean =>
  scenario.id?.startsWith("safety-trip") || /SAFETY-TRIP/.test(scenario.expected_behavior ?? "");

/** Layer 1 — suite schema validation. Returns human-readable errors ([] = valid). */
export const validateSuite = (suite: EvalSuite, pinnedJudgeModels?: string[]): string[] => {
  const errors: string[] = [];
  if (!suite.suite || typeof suite.suite !== "string") errors.push("missing suite name");
  if (!SEMVER.test(suite.version ?? "")) errors.push(`version "${suite.version}" is not semver`);

  const judge = suite.judgeModel ?? "";
  if (!judge) errors.push("judgeModel missing — the judge must be pinned");
  else {
    if (/latest/i.test(judge)) errors.push(`judgeModel "${judge}" is not pinned (contains "latest")`);
    if (!/\d/.test(judge)) errors.push(`judgeModel "${judge}" is not pinned (no version digits)`);
    if (pinnedJudgeModels && !pinnedJudgeModels.includes(judge)) {
      errors.push(`judgeModel "${judge}" is not listed in evals/pinned-models.json judgeModels`);
    }
  }

  const dims = suite.rubric?.dimensions ?? {};
  if (Object.keys(dims).length === 0) errors.push("rubric.dimensions missing or empty");
  if (!suite.rubric?.safe) errors.push("rubric.safe (the hard safety gate) is missing");
  if (!suite.rubric?.passBar || Object.keys(suite.rubric.passBar).length === 0) {
    errors.push("rubric.passBar missing");
  }

  const scenarios = Array.isArray(suite.scenarios) ? suite.scenarios : [];
  if (scenarios.length < 5) errors.push(`only ${scenarios.length} scenarios — a suite needs >= 5`);
  if (!scenarios.some(isSafetyTripScenario)) errors.push("no safety-trip scenario — one is mandatory");
  const ids = new Set<string>();
  for (const scenario of scenarios) {
    if (!scenario.id) { errors.push("scenario without an id"); continue; }
    if (ids.has(scenario.id)) errors.push(`duplicate scenario id "${scenario.id}"`);
    ids.add(scenario.id);
    if (scenario.safetyMustHold !== true) {
      errors.push(`scenario "${scenario.id}" does not carry safetyMustHold: true (the hard safety gate)`);
    }
  }
  return errors;
};

/** Pull the repo-relative test-file paths a suite's runner block references. */
export const offlineGateFiles = (suite: EvalSuite): string[] => {
  const text = Object.values(suite.runner ?? {}).filter((v) => typeof v === "string").join("\n");
  return Array.from(new Set(text.match(/app\/(?:src|scripts)\/[\w./-]+\.(?:test\.ts|mts)/g) ?? []));
};

/**
 * Layer 2 — deterministic contract assertions.
 * Generic: every declared offline-gate file exists, and covers the suite —
 * either it loads the suite JSON itself (dynamic coverage) or it names every
 * deterministic-tier scenario id literally.
 */
export const deterministicGateErrors = (suite: EvalSuite, repoRoot: string): string[] => {
  const errors: string[] = [];
  const gates = offlineGateFiles(suite);
  if (gates.length === 0) {
    errors.push("runner declares no offline gate test file — the deterministic tier is unpinned");
    return errors;
  }
  const gateTexts: string[] = [];
  for (const rel of gates) {
    const full = path.join(repoRoot, rel);
    if (!fs.existsSync(full)) {
      errors.push(`offline gate file missing: ${rel}`);
      continue;
    }
    gateTexts.push(fs.readFileSync(full, "utf8"));
  }
  if (gateTexts.length === 0) return errors;

  const combined = gateTexts.join("\n");
  const dynamicCoverage = combined.includes(`${suite.suite}.eval.json`);
  if (!dynamicCoverage) {
    for (const scenario of suite.scenarios) {
      if (scenario.tier && scenario.tier !== "deterministic") continue;
      if (!combined.includes(scenario.id)) {
        errors.push(`scenario "${scenario.id}" is covered by no declared offline gate file`);
      }
    }
  }
  return errors;
};

/** The approved-fixture stamp (mirrors content/selectCards.test.ts — synthetic, test-only). */
const approveFixture = (card: HardMomentCard): HardMomentCard => ({
  ...card,
  reviewStatus: "approved",
  reviewedBy: "Dr. Noa Levi",
  reviewedAt: "2026-07-01",
  contentHash: computeContentHash(card),
});

/**
 * Layer 2, suite-specific — the coach-hardmoment seed contract, re-asserted in
 * the script tier (codifies hardMomentSurfaces.test.ts): every scenario's card
 * exists, and the built seed embeds the governed escalation BYTE-IDENTICAL
 * plus the scope + no-diagnosis instructions.
 */
/**
 * Lowest age (in months) inside the card's OWN authored bands. Selection is
 * fail-closed on age, so the seed contract has to exercise each card where its
 * metadata says it belongs — never at a hardcoded age that would silently make
 * a school-age card unpublishable and empty the prompt.
 */
const inBandMonths = (card: HardMomentCard): number | null => {
  for (const band of card.ageBands ?? []) {
    const closed = /^(\d+)\s*[-–]\s*(\d+)$/.exec(band.trim());
    if (closed) return Number(closed[1]) * 12;
    const open = /^(\d+)\s*\+$/.exec(band.trim());
    if (open) return Number(open[1]) * 12;
  }
  return null;
};

export const hardMomentSeedContractErrors = (suite: EvalSuite): string[] => {
  const errors: string[] = [];
  for (const scenario of suite.scenarios) {
    const card = hardMomentCards.find((item) => item.id === scenario.cardId);
    if (!card) {
      errors.push(`scenario "${scenario.id}" references unknown card "${scenario.cardId}"`);
      continue;
    }
    const locale = scenario.locale === "he" ? "he" : "en";
    const ageMonths = inBandMonths(card);
    if (ageMonths === null) {
      errors.push(`scenario "${scenario.id}": card "${card.id}" has no usable age band`);
      continue;
    }
    const escalation = locale === "he" ? card.escalation.he : card.escalation.en;
    // Inside the pilot window by construction, so the contract never depends on
    // the wall clock (the release opens at a UTC instant; a local-evening run
    // would otherwise see the pilot as not yet started and pass vacuously).
    const now = new Date(Date.parse(HARD_MOMENT_PILOT.availableFrom) + 60_000);
    // Both shipping routes must carry the identical safety frame: the reviewed
    // route AND the editorial pilot that actually serves parents today.
    const routes: [string, string][] = [
      ["reviewed", buildHardMomentSeedPrompt(approveFixture(card), locale, "Noa", { ageMonths, now })],
      ["pilot", buildHardMomentSeedPrompt(card, locale, "Noa", { ageMonths, now })],
    ];
    for (const [route, seed] of routes) {
      const at = `scenario "${scenario.id}" (${route})`;
      if (!seed) { errors.push(`${at}: seed is empty — the card is not publishable on this route`); continue; }
      if (!seed.includes(escalation)) errors.push(`${at}: escalation not byte-identical in seed`);
      if (!seed.includes("never paraphrased")) errors.push(`${at}: seed lost the never-paraphrase instruction`);
      if (!seed.includes("Do not diagnose, label, score, or give any verdict")) {
        errors.push(`${at}: seed lost the no-diagnosis instruction`);
      }
    }
    // The pilot route must disclose that it carries no individual clinical review.
    const pilotSeed = routes[1][1];
    if (pilotSeed && !pilotSeed.includes("not had individual clinical review")) {
      errors.push(`scenario "${scenario.id}" (pilot): seed lost the no-clinical-review disclosure`);
    }
  }
  return errors;
};

/** Route → {alias, resolved} expectations derived from an ArborConfig. */
export const modelPinExpectations = (config: ArborConfig): Record<string, { alias: string; resolved: string }> => ({
  coach_high_stakes: { alias: config.vertexModelChat, resolved: toAnthropicVertexModelId(config.vertexModelChat) },
  creative_low_risk: { alias: config.vertexModelStory, resolved: config.vertexModelStory },
  analysis_structured: { alias: config.vertexModelAnalysis, resolved: config.vertexModelAnalysis },
  handoff_structured: { alias: config.vertexModelHandoff, resolved: config.vertexModelHandoff },
  image_generation: { alias: config.vertexModelImage, resolved: config.vertexModelImage },
});

/** Layer 3 (EVAL-8) — pinned-models drift against the config defaults. */
export const modelPinDriftErrors = (pinned: PinnedModels, config: ArborConfig): string[] => {
  const errors: string[] = [];
  const expected = modelPinExpectations(config);
  for (const [route, expect] of Object.entries(expected)) {
    const pin = pinned.routes?.[route];
    if (!pin) {
      errors.push(`model changed: re-run suites — route "${route}" has no pin in evals/pinned-models.json`);
      continue;
    }
    if (pin.alias !== expect.alias || pin.resolved !== expect.resolved) {
      errors.push(
        `model changed: re-run suites — route "${route}" pinned ${pin.alias} -> ${pin.resolved} but config default is ${expect.alias} -> ${expect.resolved}`,
      );
    }
  }
  return errors;
};

/** EVAL-6 — stale-suite WARNINGS: declared promptVersions vs the live registry. */
export const stalePromptWarnings = (suite: EvalSuite): string[] => {
  const warnings: string[] = [];
  for (const [key, declared] of Object.entries(suite.promptVersions ?? {})) {
    const live = PROMPT_VERSIONS[key as PromptKey];
    if (!live) {
      warnings.push(`suite "${suite.suite}" declares unknown prompt key "${key}"`);
      continue;
    }
    if (live.version !== declared) {
      warnings.push(
        `suite "${suite.suite}" is STALE against prompt "${key}": validated @${declared}, live is @${live.version} — re-run the suite`,
      );
    }
  }
  return warnings;
};

/**
 * The config the pin file is compared against. Prefer the LIVE loadConfig()
 * (env included) so bumping VERTEX_MODEL_ANALYSIS — via env var OR via the
 * env.ts default — without refreshing evals/pinned-models.json fails
 * check:acceptance right where the bump happened. When the surrounding env is
 * incomplete for loadConfig() (e.g. MODEL_PROVIDER=vertex with no
 * GCP_PROJECT_ID on a CI box), fall back to the pure defaults with all
 * model-selection env vars cleared.
 */
export const defaultConfigForPinning = (): ArborConfig => {
  try {
    return loadConfig();
  } catch {
    /* incomplete env — compare against the pure code defaults below */
  }
  const KEYS = [
    "ARBOR_ENV", "MODEL_PROVIDER", "MEMORY_ADAPTER", "GCP_PROJECT_ID", "FIREBASE_PROJECT_ID",
    "VERTEX_MODEL_CHAT", "VERTEX_MODEL_STORY", "VERTEX_MODEL_ANALYSIS", "VERTEX_MODEL_HANDOFF",
    "VERTEX_MODEL_IMAGE", "GEMINI_MODEL", "GEMINI_IMAGE_MODEL",
  ];
  const saved: Record<string, string | undefined> = {};
  for (const key of KEYS) { saved[key] = process.env[key]; delete process.env[key]; }
  try {
    return loadConfig();
  } finally {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
};

export type SuiteReport = { suite: string; file: string; errors: string[]; warnings: string[] };

/** Load and check every evals/*.eval.json. Pure I/O composition of the layers above. */
export const runOfflineAcceptance = (repoRoot: string): { reports: SuiteReport[]; globalErrors: string[] } => {
  const evalsDir = path.join(repoRoot, "evals");
  const pinnedPath = path.join(evalsDir, "pinned-models.json");
  const globalErrors: string[] = [];

  let pinned: PinnedModels | null = null;
  if (!fs.existsSync(pinnedPath)) {
    globalErrors.push("evals/pinned-models.json is missing (EVAL-8)");
  } else {
    pinned = JSON.parse(fs.readFileSync(pinnedPath, "utf8")) as PinnedModels;
    globalErrors.push(...modelPinDriftErrors(pinned, defaultConfigForPinning()));
  }

  const files = fs.readdirSync(evalsDir).filter((name) => name.endsWith(".eval.json")).sort();
  if (files.length === 0) globalErrors.push("no evals/*.eval.json suites found");

  const reports: SuiteReport[] = [];
  for (const file of files) {
    const suite = JSON.parse(fs.readFileSync(path.join(evalsDir, file), "utf8")) as EvalSuite;
    const errors: string[] = [];
    if (`${suite.suite}.eval.json` !== file) errors.push(`suite name "${suite.suite}" does not match file name ${file}`);
    errors.push(...validateSuite(suite, pinned?.judgeModels));
    errors.push(...deterministicGateErrors(suite, repoRoot));
    if (suite.suite === "coach-hardmoment-seed-v1") errors.push(...hardMomentSeedContractErrors(suite));
    reports.push({ suite: suite.suite ?? file, file, errors, warnings: stalePromptWarnings(suite) });
  }
  return { reports, globalErrors };
};
